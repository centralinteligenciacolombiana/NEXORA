-- =============================================================================
-- NEXORA — Borrar un conjunto completo (tenant wipe)
-- Supabase → SQL Editor. ¡IRREVERSIBLE!
-- Requiere migración 25 (delete_complex_cascade).
-- =============================================================================

-- 1) Lista conjuntos para copiar id y nombre exacto
SELECT id, name, slug, city, created_at
FROM public.complexes
ORDER BY name;

-- 2) Ver personas ligadas (opcional)
SELECT complex_name, role, full_name, email, registration_status
FROM public.v_platform_tenant_directory
WHERE complex_id = 'PEGAR-UUID-DEL-CONJUNTO'::uuid;

-- 3) BORRAR TODO: Auth users del conjunto + perfil + datos CASCADE
--    El segundo argumento debe ser el nombre EXACTO (mayúsculas/espacios).
SELECT public.delete_complex_cascade(
  'PEGAR-UUID-DEL-CONJUNTO'::uuid,
  'Nombre Exacto Del Conjunto'
);

-- 4) Verificar
SELECT count(*) AS complejos_restantes
FROM public.complexes
WHERE id = 'PEGAR-UUID-DEL-CONJUNTO'::uuid;

SELECT count(*) AS perfiles_huerfanos
FROM public.profiles
WHERE complex_id = 'PEGAR-UUID-DEL-CONJUNTO'::uuid;
