-- =============================================================================
-- NEXORA — Consultas de soporte multi-tenant (Supabase → SQL Editor)
-- Ejecutar como postgres / con rol que bypass RLS (Editor por defecto).
-- Requiere migración 25 (vista v_platform_tenant_directory).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Todos los conjuntos
-- ---------------------------------------------------------------------------
SELECT
  id,
  name,
  slug,
  city,
  is_active,
  max_admins,
  created_at
FROM public.complexes
ORDER BY name;

-- ---------------------------------------------------------------------------
-- 2) Directorio completo: conjunto + personas + rol
-- ---------------------------------------------------------------------------
SELECT *
FROM public.v_platform_tenant_directory
ORDER BY complex_name, role, full_name;

-- ---------------------------------------------------------------------------
-- 3) Conteo por rol en cada conjunto
-- ---------------------------------------------------------------------------
SELECT
  complex_name,
  role,
  registration_status,
  count(*) AS total
FROM public.v_platform_tenant_directory
WHERE user_id IS NOT NULL
GROUP BY complex_name, role, registration_status
ORDER BY complex_name, role;

-- ---------------------------------------------------------------------------
-- 4) Solo administradores (máx. 2 por conjunto)
-- ---------------------------------------------------------------------------
SELECT complex_name, full_name, email, registration_status, user_active
FROM public.v_platform_tenant_directory
WHERE role = 'ADMIN'
ORDER BY complex_name, full_name;

-- ---------------------------------------------------------------------------
-- 5) Residentes de un conjunto (cambia el slug o nombre)
-- ---------------------------------------------------------------------------
SELECT full_name, email, unit_tower, unit_number, login_code, registration_status
FROM public.v_platform_tenant_directory
WHERE complex_name ILIKE '%NOMBRE_DEL_CONJUNTO%'
  AND role = 'RESIDENT'
ORDER BY unit_tower, unit_number, full_name;

-- ---------------------------------------------------------------------------
-- 6) Seguridad / mantenimiento
-- ---------------------------------------------------------------------------
SELECT complex_name, role, full_name, email, registration_status
FROM public.v_platform_tenant_directory
WHERE role IN ('SECURITY', 'STAFF')
ORDER BY complex_name, role, full_name;

-- ---------------------------------------------------------------------------
-- 7) Pendientes de aprobación (altas en revisión)
-- ---------------------------------------------------------------------------
SELECT complex_name, role, full_name, email, phone, unit_number, profile_created_at
FROM public.v_platform_tenant_directory
WHERE registration_status = 'PENDING'
ORDER BY profile_created_at DESC;

-- ---------------------------------------------------------------------------
-- 8) Buscar persona por correo (soporte)
-- ---------------------------------------------------------------------------
SELECT *
FROM public.v_platform_tenant_directory
WHERE lower(email) = lower('correo@ejemplo.com');

-- ---------------------------------------------------------------------------
-- 9) Borrar UN usuario Auth (libera correo para re-registro)
--    ¡Irreversible!
-- ---------------------------------------------------------------------------
-- SELECT public.prepare_registration_purge(...)  -- desde app admin preferible
-- O manual:
-- DELETE FROM auth.users WHERE id = 'uuid-del-usuario';

-- ---------------------------------------------------------------------------
-- 10) Borrar UN conjunto completo (todo el tenant: gente + datos)
--     Confirmar con el nombre EXACTO del conjunto.
-- ---------------------------------------------------------------------------
-- SELECT public.delete_complex_cascade(
--   'uuid-del-conjunto'::uuid,
--   'Nombre Exacto Del Conjunto'
-- );

-- Verificar que ya no exista:
-- SELECT * FROM public.complexes WHERE id = 'uuid-del-conjunto';
-- SELECT * FROM public.profiles WHERE complex_id = 'uuid-del-conjunto';

-- ---------------------------------------------------------------------------
-- 11) Avisos de anulación recientes (correo + motivo, sin perfil)
-- ---------------------------------------------------------------------------
SELECT email, complex_name, reason, denied_at, expires_at, consumed_at
FROM public.registration_denials
ORDER BY denied_at DESC
LIMIT 50;
