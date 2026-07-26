-- =============================================================================
-- NEXORA — 04_complex_settings.sql
-- Torres y campos de configuración del conjunto
-- =============================================================================

ALTER TABLE public.complexes
  ADD COLUMN IF NOT EXISTS towers text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.complexes.towers IS 'Lista de torres/bloques del conjunto (ej. {Torre A, Torre B})';
