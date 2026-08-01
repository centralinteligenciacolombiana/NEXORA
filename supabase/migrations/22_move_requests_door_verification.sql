-- =============================================================================
-- NEXORA — 22_move_requests_door_verification.sql
-- Separación: ADMIN aprueba/rechaza; SECURITY solo verifica en portería.
-- Ejecutar DESPUÉS de 21_move_requests.sql
-- =============================================================================

-- Verificación física en puerta (mismo patrón que payments verified_at/by)
ALTER TABLE public.move_requests
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.move_requests.verified_at IS
  'Momento en que portería confirmó el ingreso/salida físico';
COMMENT ON COLUMN public.move_requests.verified_by IS
  'Usuario SECURITY que verificó la mudanza en portería';

CREATE INDEX IF NOT EXISTS idx_move_requests_approved_upcoming
  ON public.move_requests (complex_id, proposed_at)
  WHERE status = 'APPROVED';

-- -----------------------------------------------------------------------------
-- RLS: quitar update genérico de ops; admin review vs security verify
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "move_requests_ops_update" ON public.move_requests;

-- Solo ADMIN cambia aprobación (status, reviewed_*, review_notes, etc.)
DROP POLICY IF EXISTS "move_requests_admin_review" ON public.move_requests;
CREATE POLICY "move_requests_admin_review"
  ON public.move_requests FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND public.belongs_to_complex(complex_id)
  )
  WITH CHECK (
    public.is_admin()
    AND public.belongs_to_complex(complex_id)
  );

-- SECURITY solo puede actualizar filas ya APPROVED (política de fila).
-- El trigger enforce_move_request_verify_columns impide tocar status/reviewed_*.
DROP POLICY IF EXISTS "move_requests_security_verify" ON public.move_requests;
CREATE POLICY "move_requests_security_verify"
  ON public.move_requests FOR UPDATE TO authenticated
  USING (
    status = 'APPROVED'
    AND public.belongs_to_complex(complex_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role = 'SECURITY'
        AND p.complex_id = public.current_complex_id()
    )
  )
  WITH CHECK (
    status = 'APPROVED'
    AND public.belongs_to_complex(complex_id)
    AND verified_at IS NOT NULL
    AND verified_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role = 'SECURITY'
        AND p.complex_id = public.current_complex_id()
    )
  );

COMMENT ON POLICY "move_requests_admin_review" ON public.move_requests IS
  'Solo ADMIN puede aprobar/rechazar o editar la decisión administrativa';
COMMENT ON POLICY "move_requests_security_verify" ON public.move_requests IS
  'SECURITY solo actualiza verificación de mudanzas ya APPROVED; no puede cambiar status';

-- -----------------------------------------------------------------------------
-- Trigger: SECURITY no puede alterar columnas de aprobación aunque el UPDATE pase RLS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_move_request_verify_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active = true;

  -- Admin: sin restricciones adicionales
  IF v_role = 'ADMIN' THEN
    RETURN NEW;
  END IF;

  -- Residente: no debe cambiar aprobación ni verificación
  IF v_role = 'RESIDENT' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
       OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
    THEN
      RAISE EXCEPTION 'No autorizado a cambiar el estado de la mudanza';
    END IF;
    RETURN NEW;
  END IF;

  -- SECURITY: solo puede setear verified_* sobre APPROVED; nada de approval fields
  IF v_role = 'SECURITY' THEN
    IF OLD.status IS DISTINCT FROM 'APPROVED' THEN
      RAISE EXCEPTION 'Solo se pueden verificar mudanzas ya aprobadas por administración';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
       OR NEW.request_type IS DISTINCT FROM OLD.request_type
       OR NEW.proposed_at IS DISTINCT FROM OLD.proposed_at
       OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
       OR NEW.complex_id IS DISTINCT FROM OLD.complex_id
       OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
       OR NEW.moving_company IS DISTINCT FROM OLD.moving_company
       OR NEW.notes IS DISTINCT FROM OLD.notes
    THEN
      RAISE EXCEPTION 'Seguridad no puede cambiar la aprobación ni los datos de la solicitud';
    END IF;

    IF NEW.verified_by IS DISTINCT FROM auth.uid() OR NEW.verified_at IS NULL THEN
      RAISE EXCEPTION 'Verificación inválida: debe registrar verified_by = auth.uid()';
    END IF;

    -- No re-verificar (idempotente: si ya estaba verificado, bloquear cambio)
    IF OLD.verified_at IS NOT NULL THEN
      RAISE EXCEPTION 'Esta mudanza ya fue verificada en portería';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Rol no autorizado para actualizar mudanzas';
END;
$$;

DROP TRIGGER IF EXISTS trg_move_requests_verify_columns ON public.move_requests;
CREATE TRIGGER trg_move_requests_verify_columns
  BEFORE UPDATE ON public.move_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_move_request_verify_columns();

COMMENT ON FUNCTION public.enforce_move_request_verify_columns() IS
  'Impide que SECURITY altere status/reviewed_*; solo permite verified_at/verified_by';
