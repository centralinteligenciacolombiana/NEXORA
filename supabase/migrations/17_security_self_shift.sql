-- =============================================================================
-- NEXORA — 17_security_self_shift.sql
-- Permite a SECURITY iniciar/finalizar SU propio turno (clock-in / clock-out)
-- sin depender siempre del admin. El admin conserva asignación remota.
-- Ejecutar DESPUÉS de 16_visitor_access_passes.sql
-- =============================================================================

-- SECURITY puede crear su propio turno ACTIVE en su conjunto
DROP POLICY IF EXISTS "guard_shifts_security_insert_own" ON public.guard_shifts;
CREATE POLICY "guard_shifts_security_insert_own"
  ON public.guard_shifts FOR INSERT TO authenticated
  WITH CHECK (
    guard_id = auth.uid()
    AND complex_id = public.current_complex_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role = 'SECURITY'
        AND p.complex_id = public.current_complex_id()
    )
  );

-- SECURITY puede finalizar (o actualizar) su propio turno
DROP POLICY IF EXISTS "guard_shifts_security_update_own" ON public.guard_shifts;
CREATE POLICY "guard_shifts_security_update_own"
  ON public.guard_shifts FOR UPDATE TO authenticated
  USING (
    guard_id = auth.uid()
    AND complex_id = public.current_complex_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role = 'SECURITY'
    )
  )
  WITH CHECK (
    guard_id = auth.uid()
    AND complex_id = public.current_complex_id()
  );

COMMENT ON POLICY "guard_shifts_security_insert_own" ON public.guard_shifts IS
  'Portería puede marcar entrada de turno (clock-in) sobre sí misma';
COMMENT ON POLICY "guard_shifts_security_update_own" ON public.guard_shifts IS
  'Portería puede marcar salida / actualizar su propio turno';
