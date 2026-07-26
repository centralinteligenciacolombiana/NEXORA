-- =============================================================================
-- NEXORA — 02_multi_complex.sql
-- Multi-conjunto: complexes, invites, complex_id en tablas, límite 2 admins
-- Ejecutar en SQL Editor DESPUÉS de 01_initial_schema.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- complexes (conjuntos residenciales)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complexes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,
  address       text,
  city          text,
  phone         text,
  email         text,
  nit           text,
  description   text,
  logo_url      text,
  cover_url     text,
  max_admins    integer NOT NULL DEFAULT 2 CHECK (max_admins >= 1 AND max_admins <= 2),
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at    timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_complexes_slug ON public.complexes (slug);

DROP TRIGGER IF EXISTS trg_complexes_updated_at ON public.complexes;
CREATE TRIGGER trg_complexes_updated_at
  BEFORE UPDATE ON public.complexes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- complex_invites (links de registro amarrados al conjunto)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complex_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id    uuid NOT NULL REFERENCES public.complexes (id) ON DELETE CASCADE,
  token         text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  role          public.user_role NOT NULL DEFAULT 'RESIDENT',
  unit_id       uuid REFERENCES public.units (id) ON DELETE SET NULL,
  email         text,
  label         text,
  max_uses      integer,
  uses_count    integer NOT NULL DEFAULT 0,
  expires_at    timestamptz,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT complex_invites_role_allowed
    CHECK (role IN ('ADMIN', 'RESIDENT', 'STAFF', 'SECURITY'))
);

CREATE INDEX IF NOT EXISTS idx_complex_invites_token ON public.complex_invites (token);
CREATE INDEX IF NOT EXISTS idx_complex_invites_complex_id ON public.complex_invites (complex_id);

DROP TRIGGER IF EXISTS trg_complex_invites_updated_at ON public.complex_invites;
CREATE TRIGGER trg_complex_invites_updated_at
  BEFORE UPDATE ON public.complex_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Añadir complex_id a tablas existentes
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS complex_id uuid REFERENCES public.complexes (id) ON DELETE SET NULL;

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS complex_id uuid REFERENCES public.complexes (id) ON DELETE CASCADE;

ALTER TABLE public.amenities
  ADD COLUMN IF NOT EXISTS complex_id uuid REFERENCES public.complexes (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_profiles_complex_id ON public.profiles (complex_id);
CREATE INDEX IF NOT EXISTS idx_units_complex_id ON public.units (complex_id);
CREATE INDEX IF NOT EXISTS idx_amenities_complex_id ON public.amenities (complex_id);

-- Unicidad de número de unidad por conjunto
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_number_tower_unique;
DO $$ BEGIN
  ALTER TABLE public.units
    ADD CONSTRAINT units_number_tower_complex_unique UNIQUE (complex_id, number, tower);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Helpers multi-tenant
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_complex_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT complex_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.belongs_to_complex(p_complex_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_complex_id IS NOT NULL AND p_complex_id = public.current_complex_id();
$$;

CREATE OR REPLACE FUNCTION public.admin_count(p_complex_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.profiles
  WHERE complex_id = p_complex_id
    AND role = 'ADMIN'
    AND is_active = true;
$$;

-- Impide más de max_admins (2) administradores por conjunto
CREATE OR REPLACE FUNCTION public.enforce_max_admins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
  v_count integer;
BEGIN
  IF NEW.role = 'ADMIN' AND NEW.complex_id IS NOT NULL AND NEW.is_active = true THEN
    SELECT max_admins INTO v_max FROM public.complexes WHERE id = NEW.complex_id;
    v_max := COALESCE(v_max, 2);

    SELECT COUNT(*)::integer INTO v_count
    FROM public.profiles
    WHERE complex_id = NEW.complex_id
      AND role = 'ADMIN'
      AND is_active = true
      AND id IS DISTINCT FROM NEW.id;

    IF v_count >= v_max THEN
      RAISE EXCEPTION 'Este conjunto ya tiene el máximo de % administradores', v_max;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_enforce_max_admins ON public.profiles;
CREATE TRIGGER trg_profiles_enforce_max_admins
  BEFORE INSERT OR UPDATE OF role, complex_id, is_active ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_admins();

-- -----------------------------------------------------------------------------
-- RPC: registrar conjunto + primer admin (bootstrap)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_complex(
  p_name text,
  p_slug text,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_complex public.complexes%ROWTYPE;
  v_invite public.complex_invites%ROWTYPE;
  v_existing uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para registrar un conjunto';
  END IF;

  SELECT complex_id INTO v_existing FROM public.profiles WHERE id = v_uid;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Tu cuenta ya pertenece a un conjunto';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 3 THEN
    RAISE EXCEPTION 'El nombre del conjunto es obligatorio';
  END IF;

  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Slug inválido. Usa solo minúsculas, números y guiones';
  END IF;

  INSERT INTO public.complexes (
    name, slug, address, city, phone, email, description, created_by
  )
  VALUES (
    trim(p_name),
    lower(trim(p_slug)),
    NULLIF(trim(p_address), ''),
    NULLIF(trim(p_city), ''),
    NULLIF(trim(p_phone), ''),
    NULLIF(trim(p_email), ''),
    NULLIF(trim(p_description), ''),
    v_uid
  )
  RETURNING * INTO v_complex;

  UPDATE public.profiles
  SET
    role = 'ADMIN',
    complex_id = v_complex.id,
    is_owner = false,
    full_name = COALESCE(full_name, email),
    updated_at = timezone('utc', now())
  WHERE id = v_uid;

  -- Invite por defecto para residentes (compartible por WhatsApp, email, etc.)
  INSERT INTO public.complex_invites (
    complex_id, role, label, max_uses, created_by
  )
  VALUES (
    v_complex.id,
    'RESIDENT',
    'Registro de residentes',
    NULL,
    v_uid
  )
  RETURNING * INTO v_invite;

  RETURN jsonb_build_object(
    'complex', to_jsonb(v_complex),
    'invite', to_jsonb(v_invite)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: validar invite (público / autenticado) sin exponer todos los tokens
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.complex_invites%ROWTYPE;
  v_complex public.complexes%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM public.complex_invites
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitación no encontrada');
  END IF;

  IF v_invite.is_active = false THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitación desactivada');
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < timezone('utc', now()) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitación expirada');
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitación agotada');
  END IF;

  SELECT * INTO v_complex FROM public.complexes WHERE id = v_invite.complex_id;

  IF v_complex.is_active = false THEN
    RETURN jsonb_build_object('valid', false, 'error', 'El conjunto no está activo');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'invite', jsonb_build_object(
      'id', v_invite.id,
      'token', v_invite.token,
      'role', v_invite.role,
      'unit_id', v_invite.unit_id,
      'label', v_invite.label,
      'email', v_invite.email
    ),
    'complex', jsonb_build_object(
      'id', v_complex.id,
      'name', v_complex.name,
      'slug', v_complex.slug,
      'city', v_complex.city,
      'address', v_complex.address,
      'logo_url', v_complex.logo_url
    )
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: aceptar invite tras registrarse / iniciar sesión
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite public.complex_invites%ROWTYPE;
  v_payload jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión';
  END IF;

  v_payload := public.get_invite_by_token(p_token);
  IF (v_payload ->> 'valid')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '%', COALESCE(v_payload ->> 'error', 'Invitación inválida');
  END IF;

  SELECT * INTO v_invite FROM public.complex_invites WHERE token = p_token;

  -- Si ya pertenece a otro conjunto, bloquear
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid
      AND complex_id IS NOT NULL
      AND complex_id IS DISTINCT FROM v_invite.complex_id
  ) THEN
    RAISE EXCEPTION 'Tu cuenta ya pertenece a otro conjunto';
  END IF;

  -- Si el invite pide email específico
  IF v_invite.email IS NOT NULL THEN
    IF lower((SELECT email FROM public.profiles WHERE id = v_uid)) IS DISTINCT FROM lower(v_invite.email) THEN
      RAISE EXCEPTION 'Esta invitación está reservada para otro correo';
    END IF;
  END IF;

  UPDATE public.profiles
  SET
    complex_id = v_invite.complex_id,
    role = v_invite.role,
    unit_id = COALESCE(v_invite.unit_id, unit_id),
    updated_at = timezone('utc', now())
  WHERE id = v_uid;

  UPDATE public.complex_invites
  SET uses_count = uses_count + 1,
      updated_at = timezone('utc', now())
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'complex_id', v_invite.complex_id,
    'role', v_invite.role
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: crear invite (solo ADMIN del conjunto)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_complex_invite(
  p_role public.user_role DEFAULT 'RESIDENT',
  p_label text DEFAULT NULL,
  p_max_uses integer DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_complex_id uuid;
  v_invite public.complex_invites%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo administradores pueden crear invitaciones';
  END IF;

  v_complex_id := public.current_complex_id();
  IF v_complex_id IS NULL THEN
    RAISE EXCEPTION 'No tienes conjunto asignado';
  END IF;

  IF p_role = 'ADMIN' AND public.admin_count(v_complex_id) >= 2 THEN
    RAISE EXCEPTION 'Ya existen 2 administradores en este conjunto';
  END IF;

  INSERT INTO public.complex_invites (
    complex_id, role, label, max_uses, expires_at, unit_id, email, created_by
  )
  VALUES (
    v_complex_id, p_role, p_label, p_max_uses, p_expires_at, p_unit_id, p_email, v_uid
  )
  RETURNING * INTO v_invite;

  RETURN to_jsonb(v_invite);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_complex TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_complex_invite TO authenticated;

-- -----------------------------------------------------------------------------
-- RLS complexes / invites
-- -----------------------------------------------------------------------------
ALTER TABLE public.complexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complex_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "complexes_select_member" ON public.complexes;
CREATE POLICY "complexes_select_member" ON public.complexes FOR SELECT TO authenticated
  USING (public.is_ops() OR id = public.current_complex_id() OR created_by = auth.uid());

-- Lectura mínima pública por slug (portada del conjunto) — solo datos no sensibles
-- Se maneja vía get_invite_by_token / vistas; no abrimos SELECT anónimo completo.

DROP POLICY IF EXISTS "complexes_admin_update" ON public.complexes;
CREATE POLICY "complexes_admin_update" ON public.complexes FOR UPDATE TO authenticated
  USING (public.is_admin() AND id = public.current_complex_id())
  WITH CHECK (public.is_admin() AND id = public.current_complex_id());

DROP POLICY IF EXISTS "complexes_no_direct_insert" ON public.complexes;
-- Insert solo vía register_complex (SECURITY DEFINER)

DROP POLICY IF EXISTS "invites_admin_select" ON public.complex_invites;
CREATE POLICY "invites_admin_select" ON public.complex_invites FOR SELECT TO authenticated
  USING (public.is_admin() AND complex_id = public.current_complex_id());

DROP POLICY IF EXISTS "invites_admin_update" ON public.complex_invites;
CREATE POLICY "invites_admin_update" ON public.complex_invites FOR UPDATE TO authenticated
  USING (public.is_admin() AND complex_id = public.current_complex_id())
  WITH CHECK (public.is_admin() AND complex_id = public.current_complex_id());

DROP POLICY IF EXISTS "invites_admin_delete" ON public.complex_invites;
CREATE POLICY "invites_admin_delete" ON public.complex_invites FOR DELETE TO authenticated
  USING (public.is_admin() AND complex_id = public.current_complex_id());

-- Insert de invites vía create_complex_invite (SECURITY DEFINER)

-- Actualizar policies de units para filtrar por complex
DROP POLICY IF EXISTS "units_select_own_or_ops" ON public.units;
CREATE POLICY "units_select_own_or_ops" ON public.units FOR SELECT TO authenticated
  USING (
    (complex_id IS NOT NULL AND public.belongs_to_complex(complex_id))
    OR id = public.current_unit_id()
    OR public.is_ops()
  );

DROP POLICY IF EXISTS "units_admin_insert" ON public.units;
CREATE POLICY "units_admin_insert" ON public.units FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "units_admin_update" ON public.units;
CREATE POLICY "units_admin_update" ON public.units FOR UPDATE TO authenticated
  USING (public.is_admin() AND complex_id = public.current_complex_id())
  WITH CHECK (public.is_admin() AND complex_id = public.current_complex_id());

COMMENT ON TABLE public.complexes IS 'Conjuntos residenciales (multi-tenant)';
COMMENT ON TABLE public.complex_invites IS 'Links de registro amarrados a un conjunto y rol';
COMMENT ON FUNCTION public.register_complex IS 'Bootstrap: crea conjunto + asigna primer ADMIN + invite de residentes';
COMMENT ON FUNCTION public.accept_invite IS 'Vincula al usuario autenticado al conjunto del token';
