-- =============================================================================
-- NEXORA: borrar un usuario de Auth (y datos asociados) para reiniciar registro
-- Ejecutar en Supabase → SQL Editor
-- =============================================================================
-- 1) Cambia el correo abajo
-- 2) Corre el bloque completo
-- =============================================================================

DO $$
DECLARE
  v_email text := 'REEMPLAZA_CON_EL_CORREO@ejemplo.com'; -- ← CAMBIA ESTO
  v_user_id uuid;
  v_complex_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email);

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No existe usuario con email %', v_email;
    RETURN;
  END IF;

  SELECT complex_id INTO v_complex_id
  FROM public.profiles
  WHERE id = v_user_id;

  RAISE NOTICE 'Borrando user_id=% complex_id=%', v_user_id, v_complex_id;

  -- Si el admin llegó a crear un conjunto y quieres borrarlo también:
  -- (solo si ese complex no tiene otros usuarios que quieras conservar)
  IF v_complex_id IS NOT NULL THEN
    -- Desasocia perfiles del complejo antes de borrarlo
    UPDATE public.profiles
    SET complex_id = NULL, unit_id = NULL, role = 'RESIDENT'
    WHERE complex_id = v_complex_id;

    DELETE FROM public.complexes WHERE id = v_complex_id;
    RAISE NOTICE 'Complejo % eliminado (si existía)', v_complex_id;
  END IF;

  -- Auth cascadea a profiles si hay FK ON DELETE CASCADE;
  -- si no, borramos perfil explícitamente.
  DELETE FROM public.profiles WHERE id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;

  RAISE NOTICE 'Usuario % eliminado. Ya puedes registrarte de nuevo.', v_email;
END $$;

-- Verificación rápida (debe devolver 0 filas):
-- SELECT id, email FROM auth.users WHERE lower(email) = lower('REEMPLAZA_CON_EL_CORREO@ejemplo.com');
