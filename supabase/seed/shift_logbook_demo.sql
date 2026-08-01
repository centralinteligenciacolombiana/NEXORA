-- =============================================================================
-- NEXORA — seed demo bitácora de relevos
-- Uso: pegar en Supabase SQL Editor DESPUÉS de tener al menos 1–2 perfiles
--      con role = 'SECURITY' en el mismo complex.
-- No crea usuarios Auth; reutiliza guardias existentes.
-- =============================================================================

DO $$
DECLARE
  v_complex_id uuid;
  v_guard_a uuid;
  v_guard_b uuid;
  v_shift_a uuid;
  v_shift_b uuid;
BEGIN
  -- Primer conjunto activo
  SELECT id INTO v_complex_id
  FROM public.complexes
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_complex_id IS NULL THEN
    RAISE NOTICE 'Seed omitido: no hay complexes.';
    RETURN;
  END IF;

  UPDATE public.complexes
  SET enable_shift_logbook = true
  WHERE id = v_complex_id;

  -- Hasta 2 guardias SECURITY del conjunto
  SELECT id INTO v_guard_a
  FROM public.profiles
  WHERE complex_id = v_complex_id
    AND role = 'SECURITY'
    AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO v_guard_b
  FROM public.profiles
  WHERE complex_id = v_complex_id
    AND role = 'SECURITY'
    AND is_active = true
    AND id <> v_guard_a
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_guard_a IS NULL THEN
    RAISE NOTICE 'Seed omitido: no hay perfiles SECURITY en el complejo %. Invita guardias primero.', v_complex_id;
    RETURN;
  END IF;

  -- Cerrar turnos ACTIVE previos de estos guardias (idempotente)
  UPDATE public.guard_shifts
  SET status = 'FINISHED',
      ended_at = COALESCE(ended_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  WHERE guard_id IN (v_guard_a, COALESCE(v_guard_b, v_guard_a))
    AND status = 'ACTIVE';

  -- Turno NIGHT finalizado (guard A) — relevo anterior
  INSERT INTO public.guard_shifts (
    id, complex_id, guard_id, shift_type, status, started_at, ended_at
  ) VALUES (
    gen_random_uuid(),
    v_complex_id,
    v_guard_a,
    'NIGHT',
    'FINISHED',
    timezone('utc', now()) - interval '10 hours',
    timezone('utc', now()) - interval '1 hour'
  )
  RETURNING id INTO v_shift_a;

  INSERT INTO public.shift_logs (
    complex_id, shift_id, author_guard_id, title, description
  ) VALUES (
    v_complex_id,
    v_shift_a,
    v_guard_a,
    'Relevo noche — llaves y novedades',
    E'Turno noche cerrado.\n'
    || E'- Visitante no autorizado rechazado en torre B (22:40).\n'
    || E'- Paquete Amazon pendiente en casillero 3 (apto 502).\n'
    || E'- Cámara perimetral patio OK.\n'
    || E'Recibir con linterna cargada.'
  );

  -- Si hay segundo guardia: turno DAY activo + nota propia
  IF v_guard_b IS NOT NULL THEN
    INSERT INTO public.guard_shifts (
      id, complex_id, guard_id, shift_type, status, started_at, ended_at
    ) VALUES (
      gen_random_uuid(),
      v_complex_id,
      v_guard_b,
      'DAY',
      'ACTIVE',
      timezone('utc', now()) - interval '45 minutes',
      NULL
    )
    RETURNING id INTO v_shift_b;

    INSERT INTO public.shift_logs (
      complex_id, shift_id, author_guard_id, title, description
    ) VALUES (
      v_complex_id,
      v_shift_b,
      v_guard_b,
      'Entrada turno día — recibido',
      E'Recibí el relevo de noche. Revisaré casillero 3 y rondaré torre B.'
    );

    RAISE NOTICE 'Seed OK: complex %, guard noche %, guard día ACTIVE %',
      v_complex_id, v_guard_a, v_guard_b;
  ELSE
    -- Un solo guardia: deja turno DAY activo para que pruebe el feed + publicar
    INSERT INTO public.guard_shifts (
      id, complex_id, guard_id, shift_type, status, started_at, ended_at
    ) VALUES (
      gen_random_uuid(),
      v_complex_id,
      v_guard_a,
      'DAY',
      'ACTIVE',
      timezone('utc', now()) - interval '20 minutes',
      NULL
    )
    RETURNING id INTO v_shift_b;

    RAISE NOTICE 'Seed OK (1 guardia): complex %, turno DAY ACTIVE %, log noche listo',
      v_complex_id, v_guard_a;
  END IF;
END $$;
