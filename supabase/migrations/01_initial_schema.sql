-- =============================================================================
-- NEXORA — 01_initial_schema.sql
-- Schema inicial: tablas, enums, triggers, helpers RLS y políticas
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('ADMIN', 'RESIDENT', 'STAFF', 'SECURITY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.visitor_status AS ENUM (
    'PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'DENIED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_status AS ENUM (
    'PENDING', 'AT_RECEPTION', 'DELIVERED', 'RETURNED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.alert_type AS ENUM ('PANIC', 'MEDICAL', 'FIRE', 'SECURITY', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.alert_status AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.reservation_status AS ENUM (
    'PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_type AS ENUM ('PQRS', 'WORK_ORDER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM (
    'OPEN', 'IN_PROGRESS', 'WAITING_RESIDENT', 'RESOLVED', 'CLOSED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- units
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.units (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number      text NOT NULL,
  tower       text,
  floor       integer,
  owner_id    uuid,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT units_number_tower_unique UNIQUE (number, tower)
);

CREATE INDEX IF NOT EXISTS idx_units_owner_id ON public.units (owner_id);
CREATE INDEX IF NOT EXISTS idx_units_number ON public.units (number);

DROP TRIGGER IF EXISTS trg_units_updated_at ON public.units;
CREATE TRIGGER trg_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- profiles (1:1 auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email       text,
  full_name   text,
  phone       text,
  role        public.user_role NOT NULL DEFAULT 'RESIDENT',
  unit_id     uuid REFERENCES public.units (id) ON DELETE SET NULL,
  is_owner    boolean NOT NULL DEFAULT false,
  avatar_url  text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at  timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_unit_id ON public.profiles (unit_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

DO $$ BEGIN
  ALTER TABLE public.units
    ADD CONSTRAINT units_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES public.profiles (id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Auto-perfil al registrar usuario
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
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'RESIDENT')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Sincroniza units.owner_id cuando is_owner = true
CREATE OR REPLACE FUNCTION public.sync_unit_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_owner = true AND NEW.unit_id IS NOT NULL THEN
    UPDATE public.units
    SET owner_id = NEW.id,
        updated_at = timezone('utc', now())
    WHERE id = NEW.unit_id;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.is_owner = true
     AND (NEW.is_owner = false OR NEW.unit_id IS DISTINCT FROM OLD.unit_id)
     AND OLD.unit_id IS NOT NULL THEN
    UPDATE public.units
    SET owner_id = NULL,
        updated_at = timezone('utc', now())
    WHERE id = OLD.unit_id
      AND owner_id = OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_unit_owner ON public.profiles;
CREATE TRIGGER trg_profiles_sync_unit_owner
  AFTER INSERT OR UPDATE OF is_owner, unit_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_unit_owner();

-- -----------------------------------------------------------------------------
-- vehicles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     uuid NOT NULL REFERENCES public.units (id) ON DELETE CASCADE,
  plate       text NOT NULL,
  model       text,
  color       text,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT vehicles_plate_unique UNIQUE (plate)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_unit_id ON public.vehicles (unit_id);

DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- pets
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     uuid NOT NULL REFERENCES public.units (id) ON DELETE CASCADE,
  name        text NOT NULL,
  species     text NOT NULL,
  photo_url   text,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at  timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_pets_unit_id ON public.pets (unit_id);

DROP TRIGGER IF EXISTS trg_pets_updated_at ON public.pets;
CREATE TRIGGER trg_pets_updated_at
  BEFORE UPDATE ON public.pets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- visitors
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visitors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       uuid NOT NULL REFERENCES public.units (id) ON DELETE CASCADE,
  visitor_name  text NOT NULL,
  document_id   text,
  qr_code       text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  entry_time    timestamptz,
  exit_time     timestamptz,
  status        public.visitor_status NOT NULL DEFAULT 'PENDING',
  is_delivery   boolean NOT NULL DEFAULT false,
  created_by    uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT visitors_exit_after_entry
    CHECK (exit_time IS NULL OR entry_time IS NULL OR exit_time >= entry_time)
);

CREATE INDEX IF NOT EXISTS idx_visitors_unit_id ON public.visitors (unit_id);
CREATE INDEX IF NOT EXISTS idx_visitors_status ON public.visitors (status);
CREATE INDEX IF NOT EXISTS idx_visitors_qr_code ON public.visitors (qr_code);

DROP TRIGGER IF EXISTS trg_visitors_updated_at ON public.visitors;
CREATE TRIGGER trg_visitors_updated_at
  BEFORE UPDATE ON public.visitors
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- deliveries
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deliveries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id            uuid NOT NULL REFERENCES public.units (id) ON DELETE CASCADE,
  courier_company    text,
  package_details    text,
  photo_url          text,
  status             public.delivery_status NOT NULL DEFAULT 'PENDING',
  verification_code  text DEFAULT upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  received_at        timestamptz,
  delivered_at       timestamptz,
  received_by        uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT deliveries_delivered_after_received
    CHECK (delivered_at IS NULL OR received_at IS NULL OR delivered_at >= received_at)
);

CREATE INDEX IF NOT EXISTS idx_deliveries_unit_id ON public.deliveries (unit_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries (status);

DROP TRIGGER IF EXISTS trg_deliveries_updated_at ON public.deliveries;
CREATE TRIGGER trg_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- amenities (zonas comunes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.amenities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  capacity        integer,
  location        text,
  is_active       boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT false,
  max_hours       numeric(4, 1),
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now())
);

DROP TRIGGER IF EXISTS trg_amenities_updated_at ON public.amenities;
CREATE TRIGGER trg_amenities_updated_at
  BEFORE UPDATE ON public.amenities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- reservations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amenity_id    uuid NOT NULL REFERENCES public.amenities (id) ON DELETE CASCADE,
  unit_id       uuid NOT NULL REFERENCES public.units (id) ON DELETE CASCADE,
  reserved_by   uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  start_time    timestamptz NOT NULL,
  end_time      timestamptz NOT NULL,
  status        public.reservation_status NOT NULL DEFAULT 'PENDING',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT reservations_end_after_start CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_reservations_amenity_id ON public.reservations (amenity_id);
CREATE INDEX IF NOT EXISTS idx_reservations_unit_id ON public.reservations (unit_id);
CREATE INDEX IF NOT EXISTS idx_reservations_start_time ON public.reservations (start_time);

DROP TRIGGER IF EXISTS trg_reservations_updated_at ON public.reservations;
CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- pqrs_and_work_orders
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pqrs_and_work_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       uuid REFERENCES public.units (id) ON DELETE SET NULL,
  created_by    uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  assigned_to   uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ticket_type   public.ticket_type NOT NULL DEFAULT 'PQRS',
  category      text,
  subject       text NOT NULL,
  description   text NOT NULL,
  status        public.ticket_status NOT NULL DEFAULT 'OPEN',
  priority      public.ticket_priority NOT NULL DEFAULT 'MEDIUM',
  photo_url     text,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at    timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_pqrs_unit_id ON public.pqrs_and_work_orders (unit_id);
CREATE INDEX IF NOT EXISTS idx_pqrs_status ON public.pqrs_and_work_orders (status);
CREATE INDEX IF NOT EXISTS idx_pqrs_type ON public.pqrs_and_work_orders (ticket_type);
CREATE INDEX IF NOT EXISTS idx_pqrs_assigned_to ON public.pqrs_and_work_orders (assigned_to);

DROP TRIGGER IF EXISTS trg_pqrs_updated_at ON public.pqrs_and_work_orders;
CREATE TRIGGER trg_pqrs_updated_at
  BEFORE UPDATE ON public.pqrs_and_work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- emergency_alerts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_alerts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       uuid NOT NULL REFERENCES public.units (id) ON DELETE CASCADE,
  triggered_by  uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  alert_type    public.alert_type NOT NULL DEFAULT 'PANIC',
  status        public.alert_status NOT NULL DEFAULT 'ACTIVE',
  notes         text,
  resolved_by   uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at    timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_emergency_alerts_unit_id ON public.emergency_alerts (unit_id);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_status ON public.emergency_alerts (status);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_created_at ON public.emergency_alerts (created_at DESC);

DROP TRIGGER IF EXISTS trg_emergency_alerts_updated_at ON public.emergency_alerts;
CREATE TRIGGER trg_emergency_alerts_updated_at
  BEFORE UPDATE ON public.emergency_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- Helpers RLS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_unit_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT unit_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = true
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
  );
$$;

CREATE OR REPLACE FUNCTION public.belongs_to_unit(p_unit_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_unit_id IS NOT NULL AND p_unit_id = public.current_unit_id();
$$;

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pqrs_and_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;

-- ----- profiles -----
DROP POLICY IF EXISTS "profiles_select_own_or_ops" ON public.profiles;
CREATE POLICY "profiles_select_own_or_ops" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_ops()
    OR (unit_id IS NOT NULL AND public.belongs_to_unit(unit_id))
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (public.is_admin() OR role = public.current_profile_role())
  );

DROP POLICY IF EXISTS "profiles_admin_insert" ON public.profiles;
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_admin_update_all" ON public.profiles;
CREATE POLICY "profiles_admin_update_all" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin());

-- ----- units -----
DROP POLICY IF EXISTS "units_select_own_or_ops" ON public.units;
CREATE POLICY "units_select_own_or_ops" ON public.units FOR SELECT TO authenticated
  USING (public.is_ops() OR id = public.current_unit_id());

DROP POLICY IF EXISTS "units_admin_insert" ON public.units;
CREATE POLICY "units_admin_insert" ON public.units FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "units_admin_update" ON public.units;
CREATE POLICY "units_admin_update" ON public.units FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "units_admin_delete" ON public.units;
CREATE POLICY "units_admin_delete" ON public.units FOR DELETE TO authenticated
  USING (public.is_admin());

-- ----- vehicles -----
DROP POLICY IF EXISTS "vehicles_select_own_or_ops" ON public.vehicles;
CREATE POLICY "vehicles_select_own_or_ops" ON public.vehicles FOR SELECT TO authenticated
  USING (public.is_ops() OR public.belongs_to_unit(unit_id));

DROP POLICY IF EXISTS "vehicles_resident_insert" ON public.vehicles;
CREATE POLICY "vehicles_resident_insert" ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.belongs_to_unit(unit_id));

DROP POLICY IF EXISTS "vehicles_resident_update" ON public.vehicles;
CREATE POLICY "vehicles_resident_update" ON public.vehicles FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.belongs_to_unit(unit_id))
  WITH CHECK (public.is_admin() OR public.belongs_to_unit(unit_id));

DROP POLICY IF EXISTS "vehicles_resident_delete" ON public.vehicles;
CREATE POLICY "vehicles_resident_delete" ON public.vehicles FOR DELETE TO authenticated
  USING (public.is_admin() OR public.belongs_to_unit(unit_id));

-- ----- pets -----
DROP POLICY IF EXISTS "pets_select_own_or_ops" ON public.pets;
CREATE POLICY "pets_select_own_or_ops" ON public.pets FOR SELECT TO authenticated
  USING (public.is_ops() OR public.belongs_to_unit(unit_id));

DROP POLICY IF EXISTS "pets_resident_insert" ON public.pets;
CREATE POLICY "pets_resident_insert" ON public.pets FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.belongs_to_unit(unit_id));

DROP POLICY IF EXISTS "pets_resident_update" ON public.pets;
CREATE POLICY "pets_resident_update" ON public.pets FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.belongs_to_unit(unit_id))
  WITH CHECK (public.is_admin() OR public.belongs_to_unit(unit_id));

DROP POLICY IF EXISTS "pets_resident_delete" ON public.pets;
CREATE POLICY "pets_resident_delete" ON public.pets FOR DELETE TO authenticated
  USING (public.is_admin() OR public.belongs_to_unit(unit_id));

-- ----- visitors -----
DROP POLICY IF EXISTS "visitors_select_own_or_ops" ON public.visitors;
CREATE POLICY "visitors_select_own_or_ops" ON public.visitors FOR SELECT TO authenticated
  USING (public.is_ops() OR public.belongs_to_unit(unit_id));

DROP POLICY IF EXISTS "visitors_resident_insert" ON public.visitors;
CREATE POLICY "visitors_resident_insert" ON public.visitors FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.belongs_to_unit(unit_id));

DROP POLICY IF EXISTS "visitors_resident_update_own" ON public.visitors;
CREATE POLICY "visitors_resident_update_own" ON public.visitors FOR UPDATE TO authenticated
  USING (public.belongs_to_unit(unit_id)) WITH CHECK (public.belongs_to_unit(unit_id));

DROP POLICY IF EXISTS "visitors_ops_update" ON public.visitors;
CREATE POLICY "visitors_ops_update" ON public.visitors FOR UPDATE TO authenticated
  USING (public.is_ops()) WITH CHECK (public.is_ops());

DROP POLICY IF EXISTS "visitors_resident_delete" ON public.visitors;
CREATE POLICY "visitors_resident_delete" ON public.visitors FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (public.belongs_to_unit(unit_id) AND status IN ('PENDING', 'APPROVED', 'CANCELLED'))
  );

-- ----- deliveries -----
DROP POLICY IF EXISTS "deliveries_select_own_or_ops" ON public.deliveries;
CREATE POLICY "deliveries_select_own_or_ops" ON public.deliveries FOR SELECT TO authenticated
  USING (public.is_ops() OR public.belongs_to_unit(unit_id));

DROP POLICY IF EXISTS "deliveries_ops_insert" ON public.deliveries;
CREATE POLICY "deliveries_ops_insert" ON public.deliveries FOR INSERT TO authenticated
  WITH CHECK (public.is_ops());

DROP POLICY IF EXISTS "deliveries_ops_update" ON public.deliveries;
CREATE POLICY "deliveries_ops_update" ON public.deliveries FOR UPDATE TO authenticated
  USING (public.is_ops()) WITH CHECK (public.is_ops());

DROP POLICY IF EXISTS "deliveries_resident_update_own" ON public.deliveries;
CREATE POLICY "deliveries_resident_update_own" ON public.deliveries FOR UPDATE TO authenticated
  USING (public.belongs_to_unit(unit_id)) WITH CHECK (public.belongs_to_unit(unit_id));

DROP POLICY IF EXISTS "deliveries_admin_delete" ON public.deliveries;
CREATE POLICY "deliveries_admin_delete" ON public.deliveries FOR DELETE TO authenticated
  USING (public.is_admin());

-- ----- amenities -----
DROP POLICY IF EXISTS "amenities_select_authenticated" ON public.amenities;
CREATE POLICY "amenities_select_authenticated" ON public.amenities FOR SELECT TO authenticated
  USING (is_active = true OR public.is_ops());

DROP POLICY IF EXISTS "amenities_admin_insert" ON public.amenities;
CREATE POLICY "amenities_admin_insert" ON public.amenities FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "amenities_admin_update" ON public.amenities;
CREATE POLICY "amenities_admin_update" ON public.amenities FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "amenities_admin_delete" ON public.amenities;
CREATE POLICY "amenities_admin_delete" ON public.amenities FOR DELETE TO authenticated
  USING (public.is_admin());

-- ----- reservations -----
DROP POLICY IF EXISTS "reservations_select_own_or_ops" ON public.reservations;
CREATE POLICY "reservations_select_own_or_ops" ON public.reservations FOR SELECT TO authenticated
  USING (
    public.is_ops()
    OR public.belongs_to_unit(unit_id)
    OR reserved_by = auth.uid()
  );

DROP POLICY IF EXISTS "reservations_resident_insert" ON public.reservations;
CREATE POLICY "reservations_resident_insert" ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (
    reserved_by = auth.uid()
    AND (public.is_admin() OR public.belongs_to_unit(unit_id))
  );

DROP POLICY IF EXISTS "reservations_resident_update_own" ON public.reservations;
CREATE POLICY "reservations_resident_update_own" ON public.reservations FOR UPDATE TO authenticated
  USING (reserved_by = auth.uid() OR public.belongs_to_unit(unit_id))
  WITH CHECK (reserved_by = auth.uid() OR public.belongs_to_unit(unit_id));

DROP POLICY IF EXISTS "reservations_ops_update" ON public.reservations;
CREATE POLICY "reservations_ops_update" ON public.reservations FOR UPDATE TO authenticated
  USING (public.is_ops()) WITH CHECK (public.is_ops());

DROP POLICY IF EXISTS "reservations_resident_delete" ON public.reservations;
CREATE POLICY "reservations_resident_delete" ON public.reservations FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      (reserved_by = auth.uid() OR public.belongs_to_unit(unit_id))
      AND status IN ('PENDING', 'CANCELLED')
    )
  );

-- ----- pqrs_and_work_orders -----
DROP POLICY IF EXISTS "pqrs_select_own_or_ops" ON public.pqrs_and_work_orders;
CREATE POLICY "pqrs_select_own_or_ops" ON public.pqrs_and_work_orders FOR SELECT TO authenticated
  USING (
    public.is_ops()
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR (unit_id IS NOT NULL AND public.belongs_to_unit(unit_id))
  );

DROP POLICY IF EXISTS "pqrs_resident_insert" ON public.pqrs_and_work_orders;
CREATE POLICY "pqrs_resident_insert" ON public.pqrs_and_work_orders FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_ops()
      OR unit_id IS NULL
      OR public.belongs_to_unit(unit_id)
    )
  );

DROP POLICY IF EXISTS "pqrs_creator_update" ON public.pqrs_and_work_orders;
CREATE POLICY "pqrs_creator_update" ON public.pqrs_and_work_orders FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND status IN ('OPEN', 'WAITING_RESIDENT'))
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "pqrs_ops_update" ON public.pqrs_and_work_orders;
CREATE POLICY "pqrs_ops_update" ON public.pqrs_and_work_orders FOR UPDATE TO authenticated
  USING (public.is_ops()) WITH CHECK (public.is_ops());

DROP POLICY IF EXISTS "pqrs_admin_delete" ON public.pqrs_and_work_orders;
CREATE POLICY "pqrs_admin_delete" ON public.pqrs_and_work_orders FOR DELETE TO authenticated
  USING (public.is_admin());

-- ----- emergency_alerts -----
DROP POLICY IF EXISTS "emergency_alerts_select_own_or_ops" ON public.emergency_alerts;
CREATE POLICY "emergency_alerts_select_own_or_ops" ON public.emergency_alerts FOR SELECT TO authenticated
  USING (
    public.is_ops()
    OR public.belongs_to_unit(unit_id)
    OR triggered_by = auth.uid()
  );

DROP POLICY IF EXISTS "emergency_alerts_resident_insert" ON public.emergency_alerts;
CREATE POLICY "emergency_alerts_resident_insert" ON public.emergency_alerts FOR INSERT TO authenticated
  WITH CHECK (
    triggered_by = auth.uid()
    AND (public.is_ops() OR public.belongs_to_unit(unit_id))
  );

DROP POLICY IF EXISTS "emergency_alerts_ops_update" ON public.emergency_alerts;
CREATE POLICY "emergency_alerts_ops_update" ON public.emergency_alerts FOR UPDATE TO authenticated
  USING (public.is_ops()) WITH CHECK (public.is_ops());

DROP POLICY IF EXISTS "emergency_alerts_admin_delete" ON public.emergency_alerts;
CREATE POLICY "emergency_alerts_admin_delete" ON public.emergency_alerts FOR DELETE TO authenticated
  USING (public.is_admin());

-- =============================================================================
COMMENT ON TABLE public.units IS 'Unidades habitacionales (número + torre/bloque)';
COMMENT ON TABLE public.profiles IS 'Perfil extendido de auth.users con rol y unidad';
COMMENT ON TABLE public.amenities IS 'Zonas comunes reservables';
COMMENT ON TABLE public.reservations IS 'Reservas de amenities por unidad';
COMMENT ON TABLE public.pqrs_and_work_orders IS 'PQRS y órdenes de trabajo';
COMMENT ON TABLE public.emergency_alerts IS 'Alertas de emergencia / botón de pánico';
