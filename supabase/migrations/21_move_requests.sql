-- =============================================================================
-- NEXORA — 21_move_requests.sql
-- Autorización de mudanza (ingreso / salida) con aprobación admin/seguridad
-- Ejecutar DESPUÉS de 20_amenities_reservations_enhance.sql
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.move_request_type AS ENUM ('MOVE_IN', 'MOVE_OUT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.move_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.move_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id        uuid NOT NULL REFERENCES public.complexes (id) ON DELETE CASCADE,
  unit_id           uuid NOT NULL REFERENCES public.units (id) ON DELETE CASCADE,
  requested_by      uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  request_type      public.move_request_type NOT NULL,
  proposed_at       timestamptz NOT NULL,
  moving_company    text,
  notes             text,
  status            public.move_request_status NOT NULL DEFAULT 'PENDING',
  reviewed_by       uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at       timestamptz,
  review_notes      text,
  created_at        timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at        timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_move_requests_complex_status
  ON public.move_requests (complex_id, status, proposed_at);

CREATE INDEX IF NOT EXISTS idx_move_requests_unit
  ON public.move_requests (unit_id);

CREATE INDEX IF NOT EXISTS idx_move_requests_requester
  ON public.move_requests (requested_by);

DROP TRIGGER IF EXISTS trg_move_requests_updated_at ON public.move_requests;
CREATE TRIGGER trg_move_requests_updated_at
  BEFORE UPDATE ON public.move_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.move_requests IS
  'Solicitudes de autorización de mudanza (ingreso/salida) de una unidad';

ALTER TABLE public.move_requests ENABLE ROW LEVEL SECURITY;

-- Residente: ve las suyas; ops: ve todas del tenant
DROP POLICY IF EXISTS "move_requests_select" ON public.move_requests;
CREATE POLICY "move_requests_select"
  ON public.move_requests FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.belongs_to_unit(unit_id)
    OR (
      public.is_ops()
      AND public.belongs_to_complex(complex_id)
    )
  );

DROP POLICY IF EXISTS "move_requests_resident_insert" ON public.move_requests;
CREATE POLICY "move_requests_resident_insert"
  ON public.move_requests FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND public.belongs_to_unit(unit_id)
    AND complex_id = public.current_complex_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'RESIDENT'
        AND p.is_active = true
    )
  );

-- Residente puede cancelar solo PENDING (UPDATE → REJECTED no; usamos delete o status)
DROP POLICY IF EXISTS "move_requests_resident_update_own" ON public.move_requests;
CREATE POLICY "move_requests_resident_update_own"
  ON public.move_requests FOR UPDATE TO authenticated
  USING (
    requested_by = auth.uid()
    AND status = 'PENDING'
  )
  WITH CHECK (
    requested_by = auth.uid()
  );

-- Admin / Security aprueban o rechazan
DROP POLICY IF EXISTS "move_requests_ops_update" ON public.move_requests;
CREATE POLICY "move_requests_ops_update"
  ON public.move_requests FOR UPDATE TO authenticated
  USING (
    public.is_ops()
    AND public.belongs_to_complex(complex_id)
  )
  WITH CHECK (
    public.is_ops()
    AND public.belongs_to_complex(complex_id)
  );

DROP POLICY IF EXISTS "move_requests_resident_delete" ON public.move_requests;
CREATE POLICY "move_requests_resident_delete"
  ON public.move_requests FOR DELETE TO authenticated
  USING (
    requested_by = auth.uid()
    AND status = 'PENDING'
  );
