-- =============================================================================
-- NEXORA — 03_accept_invite_unit.sql
-- Extiende accept_invite para vincular apartamento/unidad al aceptar
-- =============================================================================

DROP FUNCTION IF EXISTS public.accept_invite(text);
DROP FUNCTION IF EXISTS public.accept_invite(text, text, text);

CREATE OR REPLACE FUNCTION public.accept_invite(
  p_token text,
  p_unit_number text DEFAULT NULL,
  p_tower text DEFAULT NULL
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
    IF lower((SELECT email FROM public.profiles WHERE id = v_uid)) IS DISTINCT FROM lower(v_invite.email) THEN
      RAISE EXCEPTION 'Esta invitación está reservada para otro correo';
    END IF;
  END IF;

  v_unit_id := v_invite.unit_id;
  v_tower := NULLIF(trim(COALESCE(p_tower, '')), '');

  IF v_unit_id IS NULL AND p_unit_number IS NOT NULL AND length(trim(p_unit_number)) > 0 THEN
    SELECT id INTO v_unit_id
    FROM public.units
    WHERE complex_id = v_invite.complex_id
      AND number = trim(p_unit_number)
      AND tower IS NOT DISTINCT FROM v_tower
    LIMIT 1;

    IF v_unit_id IS NULL THEN
      INSERT INTO public.units (complex_id, number, tower)
      VALUES (v_invite.complex_id, trim(p_unit_number), v_tower)
      RETURNING id INTO v_unit_id;
    END IF;
  END IF;

  UPDATE public.profiles
  SET
    complex_id = v_invite.complex_id,
    role = v_invite.role,
    unit_id = COALESCE(v_unit_id, unit_id),
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
    'unit_id', v_unit_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite(text, text, text) TO authenticated;
