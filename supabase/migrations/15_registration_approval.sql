-- =============================================================================
-- NEXORA — 15_registration_approval.sql
-- El residente se registra vía QR/link; el admin confirma antes del acceso pleno.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'APPROVED';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_registration_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_registration_status_check
  CHECK (registration_status IN ('PENDING', 'APPROVED', 'REJECTED'));

COMMENT ON COLUMN public.profiles.registration_status IS
  'PENDING = esperando OK del admin; APPROVED = acceso completo; REJECTED = denegado';

CREATE INDEX IF NOT EXISTS idx_profiles_registration_pending
  ON public.profiles (complex_id, registration_status)
  WHERE registration_status = 'PENDING';

-- Actualizar accept_invite: nuevos miembros quedan PENDING
DROP FUNCTION IF EXISTS public.accept_invite(text, text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.accept_invite(
  p_token text,
  p_unit_number text DEFAULT NULL,
  p_tower text DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_occupancy_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite public.complex_invites%ROWTYPE;
  v_payload jsonb;
  v_unit_id uuid;
  v_tower text;
  v_number text;
  v_unit public.units%ROWTYPE;
  v_occupancy text;
  v_is_owner boolean := false;
  v_login_code text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión';
  END IF;

  v_payload := public.get_invite_by_token(p_token);
  IF (v_payload ->> 'valid')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '%', COALESCE(v_payload ->> 'error', 'Invitación inválida');
  END IF;

  SELECT * INTO v_invite FROM public.complex_invites WHERE token = p_token;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid
      AND complex_id IS NOT NULL
      AND complex_id IS DISTINCT FROM v_invite.complex_id
  ) THEN
    RAISE EXCEPTION 'Tu cuenta ya pertenece a otro conjunto';
  END IF;

  IF v_invite.email IS NOT NULL THEN
    IF lower((SELECT email FROM public.profiles WHERE id = v_uid))
       IS DISTINCT FROM lower(v_invite.email) THEN
      RAISE EXCEPTION 'Esta invitación está reservada para otro correo';
    END IF;
  END IF;

  v_occupancy := upper(nullif(trim(COALESCE(p_occupancy_type, '')), ''));
  IF v_occupancy IS NOT NULL
     AND v_occupancy NOT IN ('OWNER', 'TENANT', 'TEMPORARY') THEN
    RAISE EXCEPTION 'Tipo de ocupación inválido';
  END IF;
  v_is_owner := (v_occupancy = 'OWNER');

  v_unit_id := COALESCE(p_unit_id, v_invite.unit_id);
  v_tower := NULLIF(trim(COALESCE(p_tower, '')), '');
  v_number := NULLIF(trim(COALESCE(p_unit_number, '')), '');

  IF v_invite.role = 'RESIDENT' AND v_unit_id IS NULL AND v_number IS NULL THEN
    RAISE EXCEPTION 'Indica el número de tu apartamento o casa';
  END IF;

  IF v_unit_id IS NOT NULL THEN
    SELECT * INTO v_unit FROM public.units WHERE id = v_unit_id;
    IF NOT FOUND OR v_unit.complex_id IS DISTINCT FROM v_invite.complex_id THEN
      RAISE EXCEPTION 'La unidad seleccionada no pertenece a este conjunto';
    END IF;
    v_number := v_unit.number;
    v_tower := v_unit.tower;
  ELSIF v_number IS NOT NULL THEN
    SELECT id INTO v_unit_id
    FROM public.units
    WHERE complex_id = v_invite.complex_id
      AND number = v_number
      AND tower IS NOT DISTINCT FROM v_tower
    LIMIT 1;

    IF v_unit_id IS NULL THEN
      INSERT INTO public.units (complex_id, number, tower)
      VALUES (v_invite.complex_id, v_number, v_tower)
      RETURNING id INTO v_unit_id;
    END IF;
  END IF;

  IF v_number IS NOT NULL THEN
    v_login_code := upper(
      regexp_replace(
        CASE
          WHEN v_tower IS NOT NULL AND length(v_tower) > 0
            THEN v_tower || '-' || v_number
          ELSE v_number
        END,
        '\s+',
        '',
        'g'
      )
    );
  END IF;

  UPDATE public.profiles
  SET
    complex_id = v_invite.complex_id,
    role = v_invite.role,
    unit_id = COALESCE(v_unit_id, unit_id),
    is_owner = CASE
      WHEN v_invite.role = 'RESIDENT' THEN v_is_owner
      ELSE is_owner
    END,
    occupancy_type = CASE
      WHEN v_invite.role = 'RESIDENT' THEN v_occupancy
      ELSE occupancy_type
    END,
    login_code = COALESCE(v_login_code, login_code),
    -- Espera confirmación del administrador del conjunto
    registration_status = 'PENDING',
    updated_at = timezone('utc', now())
  WHERE id = v_uid;

  UPDATE public.complex_invites
  SET uses_count = uses_count + 1,
      updated_at = timezone('utc', now())
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'complex_id', v_invite.complex_id,
    'role', v_invite.role,
    'unit_id', v_unit_id,
    'login_code', v_login_code,
    'registration_status', 'PENDING'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite(text, text, text, uuid, text)
  TO authenticated;

-- Admin aprueba registro
CREATE OR REPLACE FUNCTION public.approve_registration(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo administradores pueden aprobar registros';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  IF v_target.complex_id IS NULL
     OR v_target.complex_id IS DISTINCT FROM public.current_complex_id() THEN
    RAISE EXCEPTION 'El usuario no pertenece a tu conjunto';
  END IF;

  UPDATE public.profiles
  SET
    registration_status = 'APPROVED',
    updated_at = timezone('utc', now())
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'status', 'APPROVED');
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_registration(uuid) TO authenticated;

-- Admin rechaza registro
CREATE OR REPLACE FUNCTION public.reject_registration(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo administradores pueden rechazar registros';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  IF v_target.complex_id IS NULL
     OR v_target.complex_id IS DISTINCT FROM public.current_complex_id() THEN
    RAISE EXCEPTION 'El usuario no pertenece a tu conjunto';
  END IF;

  UPDATE public.profiles
  SET
    registration_status = 'REJECTED',
    updated_at = timezone('utc', now())
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'status', 'REJECTED');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_registration(uuid) TO authenticated;
