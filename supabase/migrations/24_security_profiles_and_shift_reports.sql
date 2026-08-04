-- =============================================================================
-- NEXORA — 24_security_profiles_and_shift_reports.sql
-- Perfil laboral SECURITY + reporte al cerrar turno + realtime de turnos
-- Ejecutar DESPUÉS de 23_fix_register_complex_and_profile_bootstrap.sql
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.security_post AS ENUM ('LOBBY', 'PATROL', 'MIXED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Preferencias / datos laborales del guardia (opcionales al registro)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_shift_type public.shift_type,
  ADD COLUMN IF NOT EXISTS security_post public.security_post,
  ADD COLUMN IF NOT EXISTS security_notes text;

COMMENT ON COLUMN public.profiles.preferred_shift_type IS
  'Turno habitual declarado por SECURITY (DAY/NIGHT), opcional';
COMMENT ON COLUMN public.profiles.security_post IS
  'Puesto habitual: lobby, patrulla o mixto';
COMMENT ON COLUMN public.profiles.security_notes IS
  'Notas laborales / horario libre del personal de seguridad';

-- Datos del turno en curso / cerrado
ALTER TABLE public.guard_shifts
  ADD COLUMN IF NOT EXISTS post_assignment public.security_post,
  ADD COLUMN IF NOT EXISTS end_report_summary text,
  ADD COLUMN IF NOT EXISTS end_report_incidents text,
  ADD COLUMN IF NOT EXISTS end_report_at timestamptz;

COMMENT ON COLUMN public.guard_shifts.post_assignment IS
  'Puesto cubierto en este turno (lobby/patrulla/mixto)';
COMMENT ON COLUMN public.guard_shifts.end_report_summary IS
  'Resumen del turno al cerrar (obligatorio para FINISHED vía app)';
COMMENT ON COLUMN public.guard_shifts.end_report_incidents IS
  'Novedades / incidentes reportados al cerrar';
COMMENT ON COLUMN public.guard_shifts.end_report_at IS
  'Momento en que se registró el reporte de cierre';

CREATE INDEX IF NOT EXISTS idx_guard_shifts_finished_reports
  ON public.guard_shifts (complex_id, ended_at DESC)
  WHERE status = 'FINISHED' AND end_report_summary IS NOT NULL;

-- Realtime: residentes/admin ven cambios de turnos activos
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.guard_shifts;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Publicación supabase_realtime no encontrada';
END $$;
