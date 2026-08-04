-- =============================================================================
-- NEXORA — 23_fix_register_complex_and_profile_bootstrap.sql
-- Corrige FK complex_invites.created_by → profiles, asegura handle_new_user,
-- y limpia datos huérfanos tras un wipe manual de auth.users.
-- Ejecutar DESPUÉS de 22_move_requests_door_verification.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Limpieza segura de huérfanos (tras borrar usuarios en Auth Dashboard)
-- -----------------------------------------------------------------------------

-- Invites cuyo created_by ya no existe en profiles
UPDATE public.complex_invites ci
SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ci.created_by);

-- Conjuntos sin ningún perfil ADMIN activo (restos de un wipe)
DELETE FROM public.complexes c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.complex_id = c.id
    AND p.role = 'ADMIN'
    AND p.is_active = true
);

-- Perfiles sin usuario Auth (no debería ocurrir con ON DELETE CASCADE, por si acaso)
DELETE FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

-- -----------------------------------------------------------------------------
-- 2) Asegurar FK de complex_invites.created_by → public.profiles
-- -----------------------------------------------------------------------------
ALTER TABLE public.complex_invites
  DROP CONSTRAINT IF EXISTS complex_invites_created_by_fkey;

ALTER TABLE public.complex_invites
  ADD CONSTRAINT complex_invites_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.profiles (id)
  ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 3) handle_new_user: siempre crea perfil RESIDENT (idempotente)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    role,
    is_active,
    registration_status
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      NEW.email
    ),
    NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), ''),
    'RESIDENT'::public.user_role,
    true,
    'APPROVED'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(
      NULLIF(trim(EXCLUDED.full_name), ''),
      public.profiles.full_name
    ),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at = timezone('utc', now());

  RETURN NEW;
EXCEPTION
  WHEN undefined_column THEN
    -- Compatibilidad si registration_status aún no existe en algún entorno viejo
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
      'RESIDENT'::public.user_role
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
  'Crea/actualiza perfil RESIDENT al insertar en auth.users. Roles elevados solo vía invite/register_complex.';

-- Backfill: usuarios Auth sin perfil
INSERT INTO public.profiles (id, email, full_name, role, is_active, registration_status)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data ->> 'full_name', u.email),
  'RESIDENT'::public.user_role,
  true,
  'APPROVED'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4) register_complex: UPSERT perfil ANTES del invite (evita el error de FK)
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
  v_email text;
  v_full_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para registrar un conjunto';
  END IF;

  -- Datos desde Auth (fuente de verdad de la sesión actual)
  SELECT
    u.email,
    COALESCE(u.raw_user_meta_data ->> 'full_name', u.email)
  INTO v_email, v_full_name
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'No se encontró el usuario autenticado en Auth';
  END IF;

  -- Garantiza fila en profiles ANTES de cualquier FK (created_by del invite)
  INSERT INTO public.profiles (
    id, email, full_name, role, is_active, registration_status
  )
  VALUES (
    v_uid,
    COALESCE(NULLIF(trim(p_email), ''), v_email),
    v_full_name,
    'RESIDENT'::public.user_role,
    true,
    'APPROVED'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(NULLIF(trim(p_email), ''), EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    updated_at = timezone('utc', now());

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
    COALESCE(NULLIF(trim(p_email), ''), v_email),
    NULLIF(trim(p_description), ''),
    v_uid
  )
  RETURNING * INTO v_complex;

  UPDATE public.profiles
  SET
    role = 'ADMIN',
    complex_id = v_complex.id,
    is_owner = false,
    full_name = COALESCE(NULLIF(trim(full_name), ''), v_full_name, email),
    email = COALESCE(NULLIF(trim(p_email), ''), email, v_email),
    registration_status = 'APPROVED',
    updated_at = timezone('utc', now())
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo promover el perfil a ADMIN (perfil ausente)';
  END IF;

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

COMMENT ON FUNCTION public.register_complex(text, text, text, text, text, text, text) IS
  'Bootstrap de conjunto + admin. Upsert de profiles antes de complex_invites.created_by.';

-- -----------------------------------------------------------------------------
-- 5) RPC auxiliar: asegurar perfil de la sesión (útil desde el app tras wipe)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_own_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.profiles%ROWTYPE;
  v_email text;
  v_full_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión';
  END IF;

  SELECT u.email, COALESCE(u.raw_user_meta_data ->> 'full_name', u.email)
  INTO v_email, v_full_name
  FROM auth.users u
  WHERE u.id = v_uid;

  INSERT INTO public.profiles (
    id, email, full_name, role, is_active, registration_status
  )
  VALUES (
    v_uid,
    v_email,
    v_full_name,
    'RESIDENT'::public.user_role,
    true,
    'APPROVED'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(public.profiles.email, EXCLUDED.email),
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    updated_at = timezone('utc', now())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_own_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_complex(text, text, text, text, text, text, text) TO authenticated;
