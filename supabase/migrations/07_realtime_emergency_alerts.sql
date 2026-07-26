-- =============================================================================
-- NEXORA — 07_realtime_emergency_alerts.sql
-- Habilita Realtime en emergency_alerts para la consola de portería
-- =============================================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_alerts;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Publicación supabase_realtime no encontrada (entorno local sin Realtime)';
END $$;
