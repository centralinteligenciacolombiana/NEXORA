-- =============================================================================
-- NEXORA — 25_tenant_lifecycle_and_registration_purge.sql
-- Ciclo de vida del conjunto + alta limpia (solo APPROVED permanece en profiles)
--
-- Reglas:
-- 1) Máx. 1–2 ADMIN (APPROVED o PENDING) por conjunto
-- 2) Al borrar un conjunto: Auth users del tenant + datos CASCADE
-- 3) Rechazo/anulación: aviso (correo + registration_denials) y borrar Auth+profile
-- 4) registration_denials = solo email + motivo (no es un perfil)
--
-- Ejecutar DESPUÉS de 24_security_profiles_and_shift_reports.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) Avisos de anulación
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registration_denials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  email_lower   text GENERATED ALWAYS AS (lower(trim(email))) STORED,
  complex_id    uuid REFERENCES public.complexes (id) ON DELETE SET NULL,
  complex_name  text NOT NULL,
  reason        text NOT NULL CHECK (char_length(trim(reason)) >= 5),
  denied_by     uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  denied_at     timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at    timestamptz NOT NULL DEFAULT (timezone('utc', now()) + interval '90 days'),
  consumed_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_registration_denials_email_active
  ON public.registration_denials (email_lower, expires_at DESC)
  WHERE consumed_at IS NULL;

COMMENT ON TABLE public.registration_denials IS
  'Recibo corto de rechazo/anulación. No guarda perfil ni unidad. Expira en 90 días.';

ALTER TABLE public.registration_denials ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- B) Máximo 2 ADMIN (PENDING o APPROVED)
-- ---------------------------------------------------------------------------
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
  IF NEW.role = 'ADMIN'
     AND NEW.complex_id IS NOT NULL
     AND NEW.is_active IS DISTINCT FROM false
     AND COALESCE(NEW.registration_status, 'APPROVED') IN ('PENDING', 'APPROVED')
  THEN
    SELECT max_admins INTO v_max FROM public.complexes WHERE id = NEW.complex_id;
    v_max := COALESCE(v_max, 2);

    SELECT COUNT(*)::integer INTO v_count
    FROM public.profiles
    WHERE complex_id = NEW.complex_id
      AND role = 'ADMIN'
      AND is_active IS DISTINCT FROM false
      AND COALESCE(registration_status, 'APPROVED') IN ('PENDING', 'APPROVED')
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
  BEFORE INSERT OR UPDATE OF role, complex_id, is_active, registration_status
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_admins();

-- ---------------------------------------------------------------------------
-- C) Login: consultar aviso de anulación
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_registration_denial(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.registration_denials%ROWTYPE;
  v_email text := lower(trim(COALESCE(p_email, '')));
BEGIN
  IF v_email = '' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_row
  FROM public.registration_denials
  WHERE email_lower = v_email
    AND consumed_at IS NULL
    AND expires_at > timezone('utc', now())
  ORDER BY denied_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  UPDATE public.registration_denials
  SET consumed_at = timezone('utc', now())
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'found', true,
    'complex_name', v_row.complex_name,
    'reason', v_row.reason,
    'denied_at', v_row.denied_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_registration_denial(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- D) Preparar rechazo / anulación (luego la app borra Auth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_registration_purge(
  p_user_id uuid,
  p_reason text,
  p_allow_approved boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_target public.profiles%ROWTYPE;
  v_complex public.complexes%ROWTYPE;
  v_reason text := trim(COALESCE(p_reason, ''));
  v_email text;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo administradores pueden anular registros';
  END IF;

  IF char_length(v_reason) < 5 THEN
    RAISE EXCEPTION 'Indica un motivo de al menos 5 caracteres';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  IF v_target.complex_id IS NULL
     OR v_target.complex_id IS DISTINCT FROM public.current_complex_id() THEN
    RAISE EXCEPTION 'El usuario no pertenece a tu conjunto';
  END IF;

  IF v_target.id = v_admin_id THEN
    RAISE EXCEPTION 'No puedes anular tu propia cuenta desde aquí';
  END IF;

  IF v_target.role = 'ADMIN'
     AND COALESCE(v_target.registration_status, 'APPROVED') = 'APPROVED' THEN
    RAISE EXCEPTION 'No se puede anular a otro administrador aprobado. Contacta soporte NEXORA.';
  END IF;

  IF NOT p_allow_approved
     AND COALESCE(v_target.registration_status, 'APPROVED') IS DISTINCT FROM 'PENDING' THEN
    RAISE EXCEPTION 'Solo se pueden rechazar registros pendientes';
  END IF;

  IF p_allow_approved
     AND COALESCE(v_target.registration_status, 'APPROVED') NOT IN ('PENDING', 'APPROVED') THEN
    RAISE EXCEPTION 'Estado de registro no anulable';
  END IF;

  SELECT * INTO v_complex FROM public.complexes WHERE id = v_target.complex_id;

  v_email := COALESCE(
    nullif(trim(v_target.email), ''),
    (SELECT nullif(trim(email), '') FROM auth.users WHERE id = v_target.id)
  );

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'El usuario no tiene correo para notificar';
  END IF;

  INSERT INTO public.registration_denials (
    email, complex_id, complex_name, reason, denied_by
  ) VALUES (
    v_email,
    v_complex.id,
    COALESCE(v_complex.name, 'tu conjunto'),
    v_reason,
    v_admin_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_target.id,
    'email', v_email,
    'full_name', COALESCE(v_target.full_name, ''),
    'complex_name', COALESCE(v_complex.name, 'tu conjunto'),
    'reason', v_reason,
    'role', v_target.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.prepare_registration_purge(uuid, text, boolean)
  TO authenticated;

DROP FUNCTION IF EXISTS public.reject_registration(uuid);

CREATE OR REPLACE FUNCTION public.reject_registration(
  p_user_id uuid,
  p_reason text DEFAULT 'Registro no confirmado por la administración.'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.prepare_registration_purge(p_user_id, p_reason, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_registration(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.annul_member_registration(
  p_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.prepare_registration_purge(p_user_id, p_reason, true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.annul_member_registration(uuid, text)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- E) Borrar conjunto completo (tenant wipe)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_complex_cascade(
  p_complex_id uuid,
  p_confirm_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_complex public.complexes%ROWTYPE;
  v_ids uuid[];
  v_id uuid;
  v_deleted_users integer := 0;
BEGIN
  SELECT * INTO v_complex FROM public.complexes WHERE id = p_complex_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conjunto no encontrado';
  END IF;

  IF trim(COALESCE(p_confirm_name, '')) IS DISTINCT FROM v_complex.name THEN
    RAISE EXCEPTION 'Confirmación inválida: escribe el nombre exacto del conjunto';
  END IF;

  IF v_uid IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = v_uid
        AND complex_id = p_complex_id
        AND role = 'ADMIN'
        AND is_active IS DISTINCT FROM false
        AND COALESCE(registration_status, 'APPROVED') = 'APPROVED'
    ) THEN
      RAISE EXCEPTION 'Solo un administrador aprobado del conjunto puede borrarlo';
    END IF;
  END IF;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_ids
  FROM public.profiles
  WHERE complex_id = p_complex_id;

  FOREACH v_id IN ARRAY v_ids
  LOOP
    DELETE FROM auth.users WHERE id = v_id;
    v_deleted_users := v_deleted_users + 1;
  END LOOP;

  DELETE FROM public.complexes WHERE id = p_complex_id;

  RETURN jsonb_build_object(
    'success', true,
    'complex_id', p_complex_id,
    'complex_name', v_complex.name,
    'deleted_auth_users', v_deleted_users
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_complex_cascade(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.delete_complex_cascade(uuid, text) IS
  'Borra Auth+profiles del tenant y el conjunto (CASCADE de datos). Confirmar con el nombre exacto.';

-- ---------------------------------------------------------------------------
-- F) Limpieza legado REJECTED → denial + delete Auth
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_email text;
  v_cname text;
BEGIN
  FOR r IN
    SELECT p.id, p.email, p.complex_id, c.name AS complex_name
    FROM public.profiles p
    LEFT JOIN public.complexes c ON c.id = p.complex_id
    WHERE p.registration_status = 'REJECTED'
  LOOP
    v_email := nullif(trim(r.email), '');
    IF v_email IS NULL THEN
      SELECT nullif(trim(email), '') INTO v_email FROM auth.users WHERE id = r.id;
    END IF;
    v_cname := COALESCE(r.complex_name, 'el conjunto');

    IF v_email IS NOT NULL THEN
      INSERT INTO public.registration_denials (email, complex_id, complex_name, reason)
      VALUES (
        v_email,
        r.complex_id,
        v_cname,
        'Registro previamente rechazado. Debes volver a registrarte con una invitación válida.'
      );
    END IF;

    DELETE FROM auth.users WHERE id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- G) Vista directorio plataforma (SQL Editor / service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_platform_tenant_directory AS
SELECT
  c.id AS complex_id,
  c.name AS complex_name,
  c.slug,
  c.city,
  c.is_active AS complex_active,
  c.max_admins,
  c.created_at AS complex_created_at,
  p.id AS user_id,
  p.email,
  p.full_name,
  p.role,
  p.registration_status,
  p.is_active AS user_active,
  p.phone,
  p.login_code,
  p.unit_id,
  u.number AS unit_number,
  u.tower AS unit_tower,
  p.created_at AS profile_created_at
FROM public.complexes c
LEFT JOIN public.profiles p ON p.complex_id = c.id
LEFT JOIN public.units u ON u.id = p.unit_id;

COMMENT ON VIEW public.v_platform_tenant_directory IS
  'Directorio multi-tenant para soporte NEXORA. Usar en SQL Editor o service_role.';

REVOKE ALL ON public.v_platform_tenant_directory FROM anon, authenticated;
GRANT SELECT ON public.v_platform_tenant_directory TO service_role;
