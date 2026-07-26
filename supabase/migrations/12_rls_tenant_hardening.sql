-- =============================================================================
-- NEXORA — 12_rls_tenant_hardening.sql
-- Remediación auditoría Alta (H1–H5): signup, profiles UPDATE, tenant RLS, storage
-- Ejecutar DESPUÉS de 11_pqrs_and_maintenance.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- [H1] handle_new_user: siempre RESIDENT (roles superiores solo vía invite/RPC)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'RESIDENT'::public.user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Crea perfil con rol RESIDENT fijo. ADMIN/SECURITY/STAFF solo vía accept_invite / register_complex.';

-- -----------------------------------------------------------------------------
-- Helpers tenant-aware
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'ADMIN'
      AND is_active = true
      AND complex_id IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_ops()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('ADMIN', 'SECURITY', 'STAFF')
      AND is_active = true
      AND complex_id IS NOT NULL
  );
$$;

-- Unidad pertenece al conjunto del usuario autenticado
CREATE OR REPLACE FUNCTION public.unit_in_current_complex(p_unit_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.units u
    WHERE u.id = p_unit_id
      AND public.belongs_to_complex(u.complex_id)
  );
$$;

COMMENT ON FUNCTION public.unit_in_current_complex(uuid) IS
  'True si la unidad pertenece al complex_id del perfil autenticado';

-- -----------------------------------------------------------------------------
-- [H2] Bloquear UPDATE sensible en profiles
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_confirm_own_email" ON public.profiles;

-- El propio usuario solo puede editar campos no sensibles (nombre, phone, avatar…)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.current_profile_role()
    AND complex_id IS NOT DISTINCT FROM public.current_complex_id()
    AND unit_id IS NOT DISTINCT FROM public.current_unit_id()
    AND is_active IS NOT DISTINCT FROM (
      SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Admin solo gestiona perfiles de SU conjunto
DROP POLICY IF EXISTS "profiles_select_own_or_ops" ON public.profiles;
CREATE POLICY "profiles_select_own_or_ops"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      public.is_ops()
      AND complex_id IS NOT NULL
      AND public.belongs_to_complex(complex_id)
    )
    OR (unit_id IS NOT NULL AND public.belongs_to_unit(unit_id))
  );

DROP POLICY IF EXISTS "profiles_admin_insert" ON public.profiles;
CREATE POLICY "profiles_admin_insert"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "profiles_admin_update_all" ON public.profiles;
CREATE POLICY "profiles_admin_update_all"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND complex_id IS NOT NULL
    AND public.belongs_to_complex(complex_id)
  )
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete"
  ON public.profiles FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND complex_id IS NOT NULL
    AND public.belongs_to_complex(complex_id)
  );

-- Confirmación de email solo vía SECURITY DEFINER (service role / confirm route)
CREATE OR REPLACE FUNCTION public.confirm_own_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  UPDATE public.profiles
  SET email_confirmed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_own_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_own_email() TO authenticated;

-- -----------------------------------------------------------------------------
-- complexes: no listar todos vía is_ops()
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "complexes_select_member" ON public.complexes;
CREATE POLICY "complexes_select_member"
  ON public.complexes FOR SELECT TO authenticated
  USING (
    id = public.current_complex_id()
    OR created_by = auth.uid()
  );

-- units delete scoped (insert/update ya en 02)
DROP POLICY IF EXISTS "units_admin_delete" ON public.units;
CREATE POLICY "units_admin_delete"
  ON public.units FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "units_select_own_or_ops" ON public.units;
CREATE POLICY "units_select_own_or_ops"
  ON public.units FOR SELECT TO authenticated
  USING (
    id = public.current_unit_id()
    OR (
      public.is_ops()
      AND complex_id IS NOT NULL
      AND public.belongs_to_complex(complex_id)
    )
  );

-- -----------------------------------------------------------------------------
-- [H3] vehicles / pets / visitors / deliveries / reservations / emergency / pqrs
-- -----------------------------------------------------------------------------

-- vehicles
DROP POLICY IF EXISTS "vehicles_select_own_or_ops" ON public.vehicles;
CREATE POLICY "vehicles_select_own_or_ops"
  ON public.vehicles FOR SELECT TO authenticated
  USING (
    public.belongs_to_unit(unit_id)
    OR (public.is_ops() AND public.unit_in_current_complex(unit_id))
  );

DROP POLICY IF EXISTS "vehicles_resident_insert" ON public.vehicles;
CREATE POLICY "vehicles_resident_insert"
  ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (
    public.belongs_to_unit(unit_id)
    OR (public.is_admin() AND public.unit_in_current_complex(unit_id))
  );

DROP POLICY IF EXISTS "vehicles_resident_update" ON public.vehicles;
CREATE POLICY "vehicles_resident_update"
  ON public.vehicles FOR UPDATE TO authenticated
  USING (
    public.belongs_to_unit(unit_id)
    OR (public.is_admin() AND public.unit_in_current_complex(unit_id))
  )
  WITH CHECK (
    public.belongs_to_unit(unit_id)
    OR (public.is_admin() AND public.unit_in_current_complex(unit_id))
  );

DROP POLICY IF EXISTS "vehicles_resident_delete" ON public.vehicles;
CREATE POLICY "vehicles_resident_delete"
  ON public.vehicles FOR DELETE TO authenticated
  USING (
    public.belongs_to_unit(unit_id)
    OR (public.is_admin() AND public.unit_in_current_complex(unit_id))
  );

-- pets
DROP POLICY IF EXISTS "pets_select_own_or_ops" ON public.pets;
CREATE POLICY "pets_select_own_or_ops"
  ON public.pets FOR SELECT TO authenticated
  USING (
    public.belongs_to_unit(unit_id)
    OR (public.is_ops() AND public.unit_in_current_complex(unit_id))
  );

DROP POLICY IF EXISTS "pets_resident_insert" ON public.pets;
CREATE POLICY "pets_resident_insert"
  ON public.pets FOR INSERT TO authenticated
  WITH CHECK (
    public.belongs_to_unit(unit_id)
    OR (public.is_admin() AND public.unit_in_current_complex(unit_id))
  );

DROP POLICY IF EXISTS "pets_resident_update" ON public.pets;
CREATE POLICY "pets_resident_update"
  ON public.pets FOR UPDATE TO authenticated
  USING (
    public.belongs_to_unit(unit_id)
    OR (public.is_admin() AND public.unit_in_current_complex(unit_id))
  )
  WITH CHECK (
    public.belongs_to_unit(unit_id)
    OR (public.is_admin() AND public.unit_in_current_complex(unit_id))
  );

DROP POLICY IF EXISTS "pets_resident_delete" ON public.pets;
CREATE POLICY "pets_resident_delete"
  ON public.pets FOR DELETE TO authenticated
  USING (
    public.belongs_to_unit(unit_id)
    OR (public.is_admin() AND public.unit_in_current_complex(unit_id))
  );

-- visitors
DROP POLICY IF EXISTS "visitors_select_own_or_ops" ON public.visitors;
CREATE POLICY "visitors_select_own_or_ops"
  ON public.visitors FOR SELECT TO authenticated
  USING (
    public.belongs_to_unit(unit_id)
    OR (public.is_ops() AND public.unit_in_current_complex(unit_id))
  );

DROP POLICY IF EXISTS "visitors_resident_insert" ON public.visitors;
CREATE POLICY "visitors_resident_insert"
  ON public.visitors FOR INSERT TO authenticated
  WITH CHECK (
    public.belongs_to_unit(unit_id)
    OR (public.is_admin() AND public.unit_in_current_complex(unit_id))
  );

DROP POLICY IF EXISTS "visitors_ops_update" ON public.visitors;
CREATE POLICY "visitors_ops_update"
  ON public.visitors FOR UPDATE TO authenticated
  USING (public.is_ops() AND public.unit_in_current_complex(unit_id))
  WITH CHECK (public.is_ops() AND public.unit_in_current_complex(unit_id));

DROP POLICY IF EXISTS "visitors_resident_delete" ON public.visitors;
CREATE POLICY "visitors_resident_delete"
  ON public.visitors FOR DELETE TO authenticated
  USING (
    (public.belongs_to_unit(unit_id) AND status IN ('PENDING', 'APPROVED', 'CANCELLED'))
    OR (public.is_admin() AND public.unit_in_current_complex(unit_id))
  );

-- deliveries
DROP POLICY IF EXISTS "deliveries_select_own_or_ops" ON public.deliveries;
CREATE POLICY "deliveries_select_own_or_ops"
  ON public.deliveries FOR SELECT TO authenticated
  USING (
    public.belongs_to_unit(unit_id)
    OR (public.is_ops() AND public.unit_in_current_complex(unit_id))
  );

DROP POLICY IF EXISTS "deliveries_ops_insert" ON public.deliveries;
CREATE POLICY "deliveries_ops_insert"
  ON public.deliveries FOR INSERT TO authenticated
  WITH CHECK (public.is_ops() AND public.unit_in_current_complex(unit_id));

DROP POLICY IF EXISTS "deliveries_ops_update" ON public.deliveries;
CREATE POLICY "deliveries_ops_update"
  ON public.deliveries FOR UPDATE TO authenticated
  USING (public.is_ops() AND public.unit_in_current_complex(unit_id))
  WITH CHECK (public.is_ops() AND public.unit_in_current_complex(unit_id));

DROP POLICY IF EXISTS "deliveries_admin_delete" ON public.deliveries;
CREATE POLICY "deliveries_admin_delete"
  ON public.deliveries FOR DELETE TO authenticated
  USING (public.is_admin() AND public.unit_in_current_complex(unit_id));

-- [H4] amenities
DROP POLICY IF EXISTS "amenities_select_authenticated" ON public.amenities;
CREATE POLICY "amenities_select_authenticated"
  ON public.amenities FOR SELECT TO authenticated
  USING (
    public.belongs_to_complex(complex_id)
    AND (is_active = true OR public.is_ops())
  );

DROP POLICY IF EXISTS "amenities_admin_insert" ON public.amenities;
CREATE POLICY "amenities_admin_insert"
  ON public.amenities FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "amenities_admin_update" ON public.amenities;
CREATE POLICY "amenities_admin_update"
  ON public.amenities FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  )
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "amenities_admin_delete" ON public.amenities;
CREATE POLICY "amenities_admin_delete"
  ON public.amenities FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

-- reservations
DROP POLICY IF EXISTS "reservations_select_own_or_ops" ON public.reservations;
CREATE POLICY "reservations_select_own_or_ops"
  ON public.reservations FOR SELECT TO authenticated
  USING (
    reserved_by = auth.uid()
    OR public.belongs_to_unit(unit_id)
    OR (public.is_ops() AND public.unit_in_current_complex(unit_id))
  );

DROP POLICY IF EXISTS "reservations_ops_update" ON public.reservations;
CREATE POLICY "reservations_ops_update"
  ON public.reservations FOR UPDATE TO authenticated
  USING (public.is_ops() AND public.unit_in_current_complex(unit_id))
  WITH CHECK (public.is_ops() AND public.unit_in_current_complex(unit_id));

DROP POLICY IF EXISTS "reservations_resident_delete" ON public.reservations;
CREATE POLICY "reservations_resident_delete"
  ON public.reservations FOR DELETE TO authenticated
  USING (
    (
      (reserved_by = auth.uid() OR public.belongs_to_unit(unit_id))
      AND status IN ('PENDING', 'CANCELLED')
    )
    OR (public.is_admin() AND public.unit_in_current_complex(unit_id))
  );

-- pqrs_and_work_orders (legacy)
DROP POLICY IF EXISTS "pqrs_select_own_or_ops" ON public.pqrs_and_work_orders;
CREATE POLICY "pqrs_select_own_or_ops"
  ON public.pqrs_and_work_orders FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR (unit_id IS NOT NULL AND public.belongs_to_unit(unit_id))
    OR (
      public.is_ops()
      AND (
        unit_id IS NULL
        OR public.unit_in_current_complex(unit_id)
      )
    )
  );

DROP POLICY IF EXISTS "pqrs_resident_insert" ON public.pqrs_and_work_orders;
CREATE POLICY "pqrs_resident_insert"
  ON public.pqrs_and_work_orders FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      unit_id IS NULL
      OR public.belongs_to_unit(unit_id)
      OR (public.is_ops() AND public.unit_in_current_complex(unit_id))
    )
  );

DROP POLICY IF EXISTS "pqrs_ops_update" ON public.pqrs_and_work_orders;
CREATE POLICY "pqrs_ops_update"
  ON public.pqrs_and_work_orders FOR UPDATE TO authenticated
  USING (
    public.is_ops()
    AND (unit_id IS NULL OR public.unit_in_current_complex(unit_id))
  )
  WITH CHECK (
    public.is_ops()
    AND (unit_id IS NULL OR public.unit_in_current_complex(unit_id))
  );

DROP POLICY IF EXISTS "pqrs_admin_delete" ON public.pqrs_and_work_orders;
CREATE POLICY "pqrs_admin_delete"
  ON public.pqrs_and_work_orders FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND (unit_id IS NULL OR public.unit_in_current_complex(unit_id))
  );

-- emergency_alerts
DROP POLICY IF EXISTS "emergency_alerts_select_own_or_ops" ON public.emergency_alerts;
CREATE POLICY "emergency_alerts_select_own_or_ops"
  ON public.emergency_alerts FOR SELECT TO authenticated
  USING (
    triggered_by = auth.uid()
    OR public.belongs_to_unit(unit_id)
    OR (public.is_ops() AND public.unit_in_current_complex(unit_id))
  );

DROP POLICY IF EXISTS "emergency_alerts_resident_insert" ON public.emergency_alerts;
CREATE POLICY "emergency_alerts_resident_insert"
  ON public.emergency_alerts FOR INSERT TO authenticated
  WITH CHECK (
    triggered_by = auth.uid()
    AND public.belongs_to_unit(unit_id)
  );

DROP POLICY IF EXISTS "emergency_alerts_ops_update" ON public.emergency_alerts;
CREATE POLICY "emergency_alerts_ops_update"
  ON public.emergency_alerts FOR UPDATE TO authenticated
  USING (public.is_ops() AND public.unit_in_current_complex(unit_id))
  WITH CHECK (public.is_ops() AND public.unit_in_current_complex(unit_id));

DROP POLICY IF EXISTS "emergency_alerts_admin_delete" ON public.emergency_alerts;
CREATE POLICY "emergency_alerts_admin_delete"
  ON public.emergency_alerts FOR DELETE TO authenticated
  USING (public.is_admin() AND public.unit_in_current_complex(unit_id));

-- -----------------------------------------------------------------------------
-- [H5] Buckets privados + SELECT por folder complex_id
-- -----------------------------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id IN ('payment-proofs', 'shift-evidence', 'maintenance-evidence');

-- Quitar SELECT público
DROP POLICY IF EXISTS "payment_proofs_select_public" ON storage.objects;
DROP POLICY IF EXISTS "shift_evidence_select_public" ON storage.objects;
DROP POLICY IF EXISTS "maintenance_evidence_select_public" ON storage.objects;

-- Lectura autenticada solo del folder de su conjunto
DROP POLICY IF EXISTS "payment_proofs_select_member" ON storage.objects;
CREATE POLICY "payment_proofs_select_member"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
  );

DROP POLICY IF EXISTS "shift_evidence_select_member" ON storage.objects;
CREATE POLICY "shift_evidence_select_member"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'shift-evidence'
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
  );

DROP POLICY IF EXISTS "maintenance_evidence_select_member" ON storage.objects;
CREATE POLICY "maintenance_evidence_select_member"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'maintenance-evidence'
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
  );

-- DELETE scoped al folder del complex
DROP POLICY IF EXISTS "payment_proofs_delete_own_or_admin" ON storage.objects;
CREATE POLICY "payment_proofs_delete_own_or_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
    AND (public.is_admin() OR owner = auth.uid())
  );

DROP POLICY IF EXISTS "shift_evidence_delete_own_or_admin" ON storage.objects;
CREATE POLICY "shift_evidence_delete_own_or_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'shift-evidence'
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
    AND (public.is_admin() OR owner = auth.uid())
  );

DROP POLICY IF EXISTS "maintenance_evidence_delete_own_or_admin" ON storage.objects;
CREATE POLICY "maintenance_evidence_delete_own_or_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'maintenance-evidence'
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
    AND (public.is_admin() OR owner = auth.uid())
  );
