-- =============================================================================
-- NEXORA — 08_security_shifts_and_logbook.sql
-- Turnos de seguridad (guard_shifts) y bitácora digital de relevos (shift_logs)
-- Ejecutar DESPUÉS de 07_realtime_emergency_alerts.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Flag de bitácora en el conjunto (Admin)
-- Nota: el tenant es public.complexes (no residential_complexes)
-- -----------------------------------------------------------------------------
ALTER TABLE public.complexes
  ADD COLUMN IF NOT EXISTS enable_shift_logbook boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.complexes.enable_shift_logbook IS
  'Si true, portería puede registrar y leer la bitácora digital de relevos';

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.shift_type AS ENUM ('DAY', 'NIGHT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.shift_status AS ENUM ('ACTIVE', 'FINISHED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- guard_shifts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guard_shifts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id   uuid NOT NULL REFERENCES public.complexes (id) ON DELETE CASCADE,
  guard_id     uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  shift_type   public.shift_type NOT NULL,
  status       public.shift_status NOT NULL DEFAULT 'ACTIVE',
  started_at   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ended_at     timestamptz,
  created_at   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT guard_shifts_ended_when_finished
    CHECK (
      (status = 'ACTIVE' AND ended_at IS NULL)
      OR (status = 'FINISHED' AND ended_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_guard_shifts_complex_id
  ON public.guard_shifts (complex_id);

CREATE INDEX IF NOT EXISTS idx_guard_shifts_guard_id
  ON public.guard_shifts (guard_id);

CREATE INDEX IF NOT EXISTS idx_guard_shifts_active
  ON public.guard_shifts (complex_id, status)
  WHERE status = 'ACTIVE';

-- Un solo turno ACTIVE por guardia
CREATE UNIQUE INDEX IF NOT EXISTS uq_guard_shifts_one_active_per_guard
  ON public.guard_shifts (guard_id)
  WHERE status = 'ACTIVE';

DROP TRIGGER IF EXISTS trg_guard_shifts_updated_at ON public.guard_shifts;
CREATE TRIGGER trg_guard_shifts_updated_at
  BEFORE UPDATE ON public.guard_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.guard_shifts IS 'Turnos activos/finalizados de personal SECURITY';

-- -----------------------------------------------------------------------------
-- shift_logs (bitácora de novedades / relevos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id       uuid NOT NULL REFERENCES public.complexes (id) ON DELETE CASCADE,
  shift_id         uuid REFERENCES public.guard_shifts (id) ON DELETE SET NULL,
  author_guard_id  uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text NOT NULL,
  evidence_url     text,
  created_at       timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_shift_logs_complex_created
  ON public.shift_logs (complex_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shift_logs_shift_id
  ON public.shift_logs (shift_id);

COMMENT ON TABLE public.shift_logs IS 'Bitácora digital de novedades entre relevos de portería';

-- -----------------------------------------------------------------------------
-- RLS: residentes pueden ver perfiles SECURITY del mismo conjunto
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_security_same_complex" ON public.profiles;
CREATE POLICY "profiles_select_security_same_complex"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    role = 'SECURITY'
    AND is_active = true
    AND complex_id IS NOT NULL
    AND complex_id = public.current_complex_id()
  );

-- -----------------------------------------------------------------------------
-- RLS guard_shifts
-- -----------------------------------------------------------------------------
ALTER TABLE public.guard_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guard_shifts_select_same_complex" ON public.guard_shifts;
CREATE POLICY "guard_shifts_select_same_complex"
  ON public.guard_shifts FOR SELECT TO authenticated
  USING (public.belongs_to_complex(complex_id));

DROP POLICY IF EXISTS "guard_shifts_admin_insert" ON public.guard_shifts;
CREATE POLICY "guard_shifts_admin_insert"
  ON public.guard_shifts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "guard_shifts_admin_update" ON public.guard_shifts;
CREATE POLICY "guard_shifts_admin_update"
  ON public.guard_shifts FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  )
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "guard_shifts_admin_delete" ON public.guard_shifts;
CREATE POLICY "guard_shifts_admin_delete"
  ON public.guard_shifts FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

-- -----------------------------------------------------------------------------
-- RLS shift_logs (solo ops del conjunto; escritura SECURITY/ADMIN)
-- -----------------------------------------------------------------------------
ALTER TABLE public.shift_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift_logs_select_ops" ON public.shift_logs;
CREATE POLICY "shift_logs_select_ops"
  ON public.shift_logs FOR SELECT TO authenticated
  USING (
    public.belongs_to_complex(complex_id)
    AND public.is_ops()
  );

DROP POLICY IF EXISTS "shift_logs_insert_security" ON public.shift_logs;
CREATE POLICY "shift_logs_insert_security"
  ON public.shift_logs FOR INSERT TO authenticated
  WITH CHECK (
    public.belongs_to_complex(complex_id)
    AND author_guard_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('SECURITY', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "shift_logs_admin_delete" ON public.shift_logs;
CREATE POLICY "shift_logs_admin_delete"
  ON public.shift_logs FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

-- -----------------------------------------------------------------------------
-- Storage: evidencias de bitácora (bucket público de lectura)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shift-evidence',
  'shift-evidence',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "shift_evidence_select_public" ON storage.objects;
CREATE POLICY "shift_evidence_select_public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'shift-evidence');

DROP POLICY IF EXISTS "shift_evidence_insert_ops" ON storage.objects;
CREATE POLICY "shift_evidence_insert_ops"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shift-evidence'
    AND public.is_ops()
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
  );

DROP POLICY IF EXISTS "shift_evidence_delete_own_or_admin" ON storage.objects;
CREATE POLICY "shift_evidence_delete_own_or_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'shift-evidence'
    AND (
      public.is_admin()
      OR owner = auth.uid()
    )
  );
