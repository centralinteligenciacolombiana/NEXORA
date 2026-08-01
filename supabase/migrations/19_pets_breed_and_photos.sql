-- =============================================================================
-- NEXORA — 19_pets_breed_and_photos.sql
-- Amplía pets (breed) + bucket de fotos. La tabla pets ya existía en 01.
-- Admin/ops ya pueden SELECT vía RLS (unit_in_current_complex).
-- Ejecutar DESPUÉS de 18_authorized_vehicles.sql
-- =============================================================================

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS breed text;

COMMENT ON COLUMN public.pets.breed IS 'Raza opcional de la mascota';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pet-photos',
  'pet-photos',
  true,
  3145728,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "pet_photos_select_public" ON storage.objects;
CREATE POLICY "pet_photos_select_public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'pet-photos');

-- path: {complex_id}/{unit_id}/...
DROP POLICY IF EXISTS "pet_photos_insert_resident" ON storage.objects;
CREATE POLICY "pet_photos_insert_resident"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pet-photos'
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
    AND (storage.foldername(name))[2] = public.current_unit_id()::text
  );

DROP POLICY IF EXISTS "pet_photos_update_resident" ON storage.objects;
CREATE POLICY "pet_photos_update_resident"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'pet-photos'
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
    AND (storage.foldername(name))[2] = public.current_unit_id()::text
  )
  WITH CHECK (
    bucket_id = 'pet-photos'
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
    AND (storage.foldername(name))[2] = public.current_unit_id()::text
  );

DROP POLICY IF EXISTS "pet_photos_delete_resident" ON storage.objects;
CREATE POLICY "pet_photos_delete_resident"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'pet-photos'
    AND (
      public.is_admin()
      OR (
        (storage.foldername(name))[1] = public.current_complex_id()::text
        AND (storage.foldername(name))[2] = public.current_unit_id()::text
      )
    )
  );
