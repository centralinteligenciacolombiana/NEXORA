-- =============================================================================
-- 16_visitor_access_passes.sql
-- Pases de visita con vigencia: solo hoy u acceso abierto por periodo.
-- El residente registra visitantes y renueva/cancela; seguridad valida la ventana.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'visitor_access_type'
  ) THEN
    CREATE TYPE public.visitor_access_type AS ENUM ('TODAY', 'OPEN');
  END IF;
END $$;

ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS access_type public.visitor_access_type NOT NULL DEFAULT 'TODAY';

ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS valid_from timestamptz NOT NULL DEFAULT timezone('utc', now());

ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS valid_until timestamptz;

COMMENT ON COLUMN public.visitors.access_type IS
  'TODAY = autorizado solo el día de vigencia; OPEN = puede entrar en cualquier momento dentro de valid_until.';
COMMENT ON COLUMN public.visitors.valid_until IS
  'Fin de la autorización del QR. NULL no debería usarse en pases nuevos; si está en el pasado, el pase no vale.';

CREATE INDEX IF NOT EXISTS idx_visitors_valid_until
  ON public.visitors (valid_until)
  WHERE valid_until IS NOT NULL;

-- Residente puede renovar / cancelar pases de su unidad (no check-in).
DROP POLICY IF EXISTS "visitors_resident_update_own" ON public.visitors;
CREATE POLICY "visitors_resident_update_own"
  ON public.visitors FOR UPDATE TO authenticated
  USING (
    public.belongs_to_unit(unit_id)
    AND status IN ('PENDING', 'APPROVED', 'CHECKED_IN', 'CANCELLED')
  )
  WITH CHECK (
    public.belongs_to_unit(unit_id)
  );

-- Ops (seguridad/admin) ya tienen visitors_ops_update desde migración 12.
