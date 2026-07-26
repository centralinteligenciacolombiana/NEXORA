-- =============================================================================
-- NEXORA — 13_resident_self_unit_registration.sql
-- El residente declara torre/apto y ocupación al registrarse (sin catálogo previo).
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS occupancy_type text
    CHECK (
      occupancy_type IS NULL
      OR occupancy_type IN ('OWNER', 'TENANT', 'TEMPORARY')
    );

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS login_code text;

CREATE INDEX IF NOT EXISTS idx_profiles_login_code_lower
  ON public.profiles (lower(login_code))
  WHERE login_code IS NOT NULL;

COMMENT ON COLUMN public.profiles.occupancy_type IS
  'OWNER | TENANT | TEMPORARY — declarado por el residente al unirse';
COMMENT ON COLUMN public.profiles.login_code IS
  'Código de acceso tipo TORREA-501 (alternativa al correo en login)';

-- accept_invite: crea unidad si no existe + guarda ocupación y login_code
DROP FUNCTION IF EXISTS public.accept_invite(text, text, text, uuid);
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

  -- Residentes deben declarar unidad (número)
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
    'login_code', v_login_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite(text, text, text, uuid, text)
  TO authenticated;

-- Resolver email por código de unidad (login alternativo)
CREATE OR REPLACE FUNCTION public.resolve_login_identifier(p_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text := trim(COALESCE(p_identifier, ''));
  v_code text;
  v_rows jsonb;
  v_count int;
BEGIN
  IF v_raw = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identificador vacío');
  END IF;

  -- Si parece correo, devolverlo tal cual
  IF position('@' IN v_raw) > 0 THEN
    RETURN jsonb_build_object('ok', true, 'email', lower(v_raw), 'via', 'email');
  END IF;

  v_code := upper(regexp_replace(v_raw, '\s+', '', 'g'));

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'email', p.email,
        'complex_id', p.complex_id,
        'full_name', p.full_name
      )
    ),
    '[]'::jsonb
  ),
  count(*)::int
  INTO v_rows, v_count
  FROM public.profiles p
  WHERE p.login_code IS NOT NULL
    AND lower(p.login_code) = lower(v_code)
    AND p.is_active = true
    AND p.email IS NOT NULL;

  IF v_count = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'No encontramos una cuenta con esa unidad. Usa tu correo.'
    );
  END IF;

  IF v_count > 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'Hay varias cuentas con esa unidad. Inicia sesión con tu correo electrónico.'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'email', lower(v_rows -> 0 ->> 'email'),
    'via', 'unit'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO anon, authenticated;
