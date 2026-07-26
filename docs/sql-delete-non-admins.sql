-- =============================================================================
-- NEXORA: borrar TODOS los usuarios excepto administradores (role = ADMIN)
-- Ejecutar en Supabase → SQL Editor
-- =============================================================================
-- Conserva cuentas ADMIN (y su conjunto). Elimina RESIDENT / SECURITY / STAFF
-- y huérfanos en auth.users sin perfil admin.
-- =============================================================================

DO $$
DECLARE
  r record;
  v_deleted int := 0;
BEGIN
  -- 1) Usuarios con perfil que NO son ADMIN
  FOR r IN
    SELECT p.id, p.email, p.role
    FROM public.profiles p
    WHERE COALESCE(p.role, 'RESIDENT') <> 'ADMIN'
  LOOP
    DELETE FROM public.profiles WHERE id = r.id;
    DELETE FROM auth.users WHERE id = r.id;
    v_deleted := v_deleted + 1;
    RAISE NOTICE 'Eliminado % (%)', r.email, r.role;
  END LOOP;

  -- 2) auth.users sin perfil (intentos fallidos / huérfanos), excepto si
  --    su metadata dice ADMIN (por si acaso)
  FOR r IN
    SELECT u.id, u.email
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
      AND COALESCE(u.raw_user_meta_data->>'role', '') <> 'ADMIN'
  LOOP
    DELETE FROM auth.users WHERE id = r.id;
    v_deleted := v_deleted + 1;
    RAISE NOTICE 'Eliminado huérfano %', r.email;
  END LOOP;

  RAISE NOTICE 'Listo. Usuarios eliminados: %. Los ADMIN se conservaron.', v_deleted;
END $$;

-- Ver qué quedó:
-- SELECT u.email, p.role, p.registration_status
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON p.id = u.id
-- ORDER BY p.role, u.email;
