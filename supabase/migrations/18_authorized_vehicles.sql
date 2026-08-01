-- =============================================================================
-- NEXORA — 18_authorized_vehicles.sql
-- Placas autorizadas por unidad (residente CRUD; seguridad lectura del tenant)
-- Ejecutar DESPUÉS de 17_security_self_shift.sql
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.vehicle_type AS ENUM ('CAR', 'MOTORCYCLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.authorized_vehicles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id      uuid NOT NULL REFERENCES public.complexes (id) ON DELETE CASCADE,
  unit_id         uuid NOT NULL REFERENCES public.units (id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  plate           text NOT NULL,
  plate_normalized text NOT NULL,
  vehicle_type    public.vehicle_type NOT NULL DEFAULT 'CAR',
  color           text,
  photo_url       text,
  notes           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT authorized_vehicles_plate_len CHECK (char_length(plate_normalized) BETWEEN 5 AND 12)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_authorized_vehicles_complex_plate
  ON public.authorized_vehicles (complex_id, plate_normalized)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_authorized_vehicles_unit
  ON public.authorized_vehicles (unit_id);

CREATE INDEX IF NOT EXISTS idx_authorized_vehicles_complex_plate
  ON public.authorized_vehicles (complex_id, plate_normalized);

DROP TRIGGER IF EXISTS trg_authorized_vehicles_updated_at ON public.authorized_vehicles;
CREATE TRIGGER trg_authorized_vehicles_updated_at
  BEFORE UPDATE ON public.authorized_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.authorized_vehicles IS
  'Vehículos autorizados por unidad para control de ingreso en portería';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.authorized_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authorized_vehicles_select" ON public.authorized_vehicles;
CREATE POLICY "authorized_vehicles_select"
  ON public.authorized_vehicles FOR SELECT TO authenticated
  USING (
    public.belongs_to_unit(unit_id)
    OR (
      public.is_ops()
      AND public.belongs_to_complex(complex_id)
    )
  );

DROP POLICY IF EXISTS "authorized_vehicles_resident_insert" ON public.authorized_vehicles;
CREATE POLICY "authorized_vehicles_resident_insert"
  ON public.authorized_vehicles FOR INSERT TO authenticated
  WITH CHECK (
    public.belongs_to_unit(unit_id)
    AND complex_id = public.current_complex_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'RESIDENT'
        AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "authorized_vehicles_resident_update" ON public.authorized_vehicles;
CREATE POLICY "authorized_vehicles_resident_update"
  ON public.authorized_vehicles FOR UPDATE TO authenticated
  USING (public.belongs_to_unit(unit_id))
  WITH CHECK (public.belongs_to_unit(unit_id));

DROP POLICY IF EXISTS "authorized_vehicles_resident_delete" ON public.authorized_vehicles;
CREATE POLICY "authorized_vehicles_resident_delete"
  ON public.authorized_vehicles FOR DELETE TO authenticated
  USING (public.belongs_to_unit(unit_id));

-- -----------------------------------------------------------------------------
-- Storage: fotos de vehículos
-- path: {complex_id}/{unit_id}/{filename}
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  true,
  3145728,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "vehicle_photos_select_public" ON storage.objects;
CREATE POLICY "vehicle_photos_select_public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'vehicle-photos');

DROP POLICY IF EXISTS "vehicle_photos_insert_resident" ON storage.objects;
CREATE POLICY "vehicle_photos_insert_resident"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
    AND (storage.foldername(name))[2] = public.current_unit_id()::text
  );

DROP POLICY IF EXISTS "vehicle_photos_update_resident" ON storage.objects;
CREATE POLICY "vehicle_photos_update_resident"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
    AND (storage.foldername(name))[2] = public.current_unit_id()::text
  )
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
    AND (storage.foldername(name))[2] = public.current_unit_id()::text
  );

DROP POLICY IF EXISTS "vehicle_photos_delete_resident" ON storage.objects;
CREATE POLICY "vehicle_photos_delete_resident"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (
      public.is_admin()
      OR (
        (storage.foldername(name))[1] = public.current_complex_id()::text
        AND (storage.foldername(name))[2] = public.current_unit_id()::text
      )
    )
  );
