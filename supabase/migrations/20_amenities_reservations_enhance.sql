-- =============================================================================
-- NEXORA — 20_amenities_reservations_enhance.sql
-- Horarios/reglas en amenities, estado REJECTED, anti double-booking
-- Ejecutar DESPUÉS de 19_pets_breed_and_photos.sql
-- =============================================================================

-- Horario disponible diario + reglas básicas
ALTER TABLE public.amenities
  ADD COLUMN IF NOT EXISTS available_from time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS available_to time NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS rules text;

COMMENT ON COLUMN public.amenities.available_from IS 'Hora inicio de disponibilidad diaria (hora local Colombia)';
COMMENT ON COLUMN public.amenities.available_to IS 'Hora fin de disponibilidad diaria';
COMMENT ON COLUMN public.amenities.rules IS 'Reglas básicas visibles al reservar';

-- Nuevo estado rechazado (aprobación admin)
DO $$ BEGIN
  ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'REJECTED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Extensión para rangos (anti solapamiento)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Impide solapes en la misma amenity para reservas vivas
ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_no_overlap;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_no_overlap
  EXCLUDE USING gist (
    amenity_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status IN ('PENDING', 'CONFIRMED'));

COMMENT ON CONSTRAINT reservations_no_overlap ON public.reservations IS
  'Evita doble reserva en el mismo espacio y franja horaria';

-- Residentes pueden cancelar sus PENDING/CONFIRMED (soft → CANCELLED vía UPDATE)
DROP POLICY IF EXISTS "reservations_resident_update_own" ON public.reservations;
CREATE POLICY "reservations_resident_update_own"
  ON public.reservations FOR UPDATE TO authenticated
  USING (
    reserved_by = auth.uid()
    OR public.belongs_to_unit(unit_id)
  )
  WITH CHECK (
    reserved_by = auth.uid()
    OR public.belongs_to_unit(unit_id)
  );

-- Admin del conjunto puede actualizar cualquier reserva del tenant
DROP POLICY IF EXISTS "reservations_admin_update" ON public.reservations;
CREATE POLICY "reservations_admin_update"
  ON public.reservations FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND public.unit_in_current_complex(unit_id)
  )
  WITH CHECK (
    public.is_admin()
    AND public.unit_in_current_complex(unit_id)
  );
