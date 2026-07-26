-- =============================================================================
-- NEXORA — 09_schedules_and_finances.sql
-- Basura, recibos de servicios públicos y cuotas de administración
-- Ejecutar DESPUÉS de 08_security_shifts_and_logbook.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Horarios de recolección de basura (complexes)
-- -----------------------------------------------------------------------------
ALTER TABLE public.complexes
  ADD COLUMN IF NOT EXISTS trash_days text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trash_notes text,
  ADD COLUMN IF NOT EXISTS trash_time text;

COMMENT ON COLUMN public.complexes.trash_days IS
  'Días de recolección: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY';
COMMENT ON COLUMN public.complexes.trash_time IS
  'Hora legible de recolección (ej. 8:00 PM)';
COMMENT ON COLUMN public.complexes.trash_notes IS
  'Notas adicionales sobre recolección de basura';

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.utility_service_type AS ENUM (
    'WATER', 'ELECTRICITY', 'GAS', 'INTERNET', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.utility_bill_status AS ENUM ('PENDING', 'PICKED_UP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.unit_payment_status AS ENUM ('PENDING', 'PAID', 'VERIFIED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- utility_bills (recibos físicos en portería)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.utility_bills (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id          uuid NOT NULL REFERENCES public.complexes (id) ON DELETE CASCADE,
  unit_id             uuid NOT NULL REFERENCES public.units (id) ON DELETE CASCADE,
  service_type        public.utility_service_type NOT NULL DEFAULT 'OTHER',
  period_name         text,
  verification_code   text,
  status              public.utility_bill_status NOT NULL DEFAULT 'PENDING',
  received_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  delivered_at        timestamptz,
  received_by         uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT utility_bills_delivered_after_received
    CHECK (
      delivered_at IS NULL
      OR delivered_at >= received_at
    )
);

CREATE INDEX IF NOT EXISTS idx_utility_bills_complex_id
  ON public.utility_bills (complex_id);
CREATE INDEX IF NOT EXISTS idx_utility_bills_unit_status
  ON public.utility_bills (unit_id, status);
CREATE INDEX IF NOT EXISTS idx_utility_bills_pending
  ON public.utility_bills (complex_id, status)
  WHERE status = 'PENDING';

DROP TRIGGER IF EXISTS trg_utility_bills_updated_at ON public.utility_bills;
CREATE TRIGGER trg_utility_bills_updated_at
  BEFORE UPDATE ON public.utility_bills
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.utility_bills IS
  'Recibos de servicios públicos recibidos en portería';

-- -----------------------------------------------------------------------------
-- admin_fee_notices (avisos de cuota de administración)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_fee_notices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id     uuid NOT NULL REFERENCES public.complexes (id) ON DELETE CASCADE,
  period_name    text NOT NULL,
  due_date       date NOT NULL,
  amount         numeric(12, 2) NOT NULL CHECK (amount >= 0),
  bank_details   text,
  payment_link   text,
  created_by     uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at     timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_admin_fee_notices_complex
  ON public.admin_fee_notices (complex_id, due_date DESC);

DROP TRIGGER IF EXISTS trg_admin_fee_notices_updated_at ON public.admin_fee_notices;
CREATE TRIGGER trg_admin_fee_notices_updated_at
  BEFORE UPDATE ON public.admin_fee_notices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.admin_fee_notices IS
  'Avisos mensuales de cuota de administración';

-- -----------------------------------------------------------------------------
-- unit_payments (estado de pago por unidad)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unit_payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id         uuid NOT NULL REFERENCES public.complexes (id) ON DELETE CASCADE,
  unit_id            uuid NOT NULL REFERENCES public.units (id) ON DELETE CASCADE,
  fee_notice_id      uuid NOT NULL REFERENCES public.admin_fee_notices (id) ON DELETE CASCADE,
  status             public.unit_payment_status NOT NULL DEFAULT 'PENDING',
  payment_proof_url  text,
  paid_at            timestamptz,
  verified_at        timestamptz,
  verified_by        uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT unit_payments_unique_unit_notice UNIQUE (unit_id, fee_notice_id)
);

CREATE INDEX IF NOT EXISTS idx_unit_payments_notice
  ON public.unit_payments (fee_notice_id, status);
CREATE INDEX IF NOT EXISTS idx_unit_payments_unit
  ON public.unit_payments (unit_id, status);

DROP TRIGGER IF EXISTS trg_unit_payments_updated_at ON public.unit_payments;
CREATE TRIGGER trg_unit_payments_updated_at
  BEFORE UPDATE ON public.unit_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.unit_payments IS
  'Estado de pago de cuota de administración por unidad';

-- -----------------------------------------------------------------------------
-- RLS utility_bills
-- -----------------------------------------------------------------------------
ALTER TABLE public.utility_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "utility_bills_select" ON public.utility_bills;
CREATE POLICY "utility_bills_select"
  ON public.utility_bills FOR SELECT TO authenticated
  USING (
    public.belongs_to_complex(complex_id)
    AND (
      public.is_ops()
      OR public.belongs_to_unit(unit_id)
    )
  );

DROP POLICY IF EXISTS "utility_bills_ops_insert" ON public.utility_bills;
CREATE POLICY "utility_bills_ops_insert"
  ON public.utility_bills FOR INSERT TO authenticated
  WITH CHECK (
    public.belongs_to_complex(complex_id)
    AND public.is_ops()
  );

DROP POLICY IF EXISTS "utility_bills_ops_update" ON public.utility_bills;
CREATE POLICY "utility_bills_ops_update"
  ON public.utility_bills FOR UPDATE TO authenticated
  USING (
    public.belongs_to_complex(complex_id)
    AND public.is_ops()
  )
  WITH CHECK (
    public.belongs_to_complex(complex_id)
    AND public.is_ops()
  );

DROP POLICY IF EXISTS "utility_bills_admin_delete" ON public.utility_bills;
CREATE POLICY "utility_bills_admin_delete"
  ON public.utility_bills FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

-- -----------------------------------------------------------------------------
-- RLS admin_fee_notices
-- -----------------------------------------------------------------------------
ALTER TABLE public.admin_fee_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_fee_notices_select" ON public.admin_fee_notices;
CREATE POLICY "admin_fee_notices_select"
  ON public.admin_fee_notices FOR SELECT TO authenticated
  USING (public.belongs_to_complex(complex_id));

DROP POLICY IF EXISTS "admin_fee_notices_admin_insert" ON public.admin_fee_notices;
CREATE POLICY "admin_fee_notices_admin_insert"
  ON public.admin_fee_notices FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "admin_fee_notices_admin_update" ON public.admin_fee_notices;
CREATE POLICY "admin_fee_notices_admin_update"
  ON public.admin_fee_notices FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  )
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "admin_fee_notices_admin_delete" ON public.admin_fee_notices;
CREATE POLICY "admin_fee_notices_admin_delete"
  ON public.admin_fee_notices FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

-- -----------------------------------------------------------------------------
-- RLS unit_payments
-- -----------------------------------------------------------------------------
ALTER TABLE public.unit_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unit_payments_select" ON public.unit_payments;
CREATE POLICY "unit_payments_select"
  ON public.unit_payments FOR SELECT TO authenticated
  USING (
    public.belongs_to_complex(complex_id)
    AND (
      public.is_ops()
      OR public.belongs_to_unit(unit_id)
    )
  );

DROP POLICY IF EXISTS "unit_payments_admin_insert" ON public.unit_payments;
CREATE POLICY "unit_payments_admin_insert"
  ON public.unit_payments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "unit_payments_admin_update" ON public.unit_payments;
CREATE POLICY "unit_payments_admin_update"
  ON public.unit_payments FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  )
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

-- Residente puede subir comprobante (PENDING → PAID) de su unidad
DROP POLICY IF EXISTS "unit_payments_resident_update" ON public.unit_payments;
CREATE POLICY "unit_payments_resident_update"
  ON public.unit_payments FOR UPDATE TO authenticated
  USING (
    public.belongs_to_unit(unit_id)
    AND status IN ('PENDING', 'PAID')
  )
  WITH CHECK (
    public.belongs_to_unit(unit_id)
    AND status IN ('PENDING', 'PAID')
  );

DROP POLICY IF EXISTS "unit_payments_admin_delete" ON public.unit_payments;
CREATE POLICY "unit_payments_admin_delete"
  ON public.unit_payments FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

-- -----------------------------------------------------------------------------
-- Storage: comprobantes de pago
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "payment_proofs_select_public" ON storage.objects;
CREATE POLICY "payment_proofs_select_public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "payment_proofs_insert_member" ON storage.objects;
CREATE POLICY "payment_proofs_insert_member"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
  );

DROP POLICY IF EXISTS "payment_proofs_delete_own_or_admin" ON storage.objects;
CREATE POLICY "payment_proofs_delete_own_or_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (public.is_admin() OR owner = auth.uid())
  );
