-- =============================================================================
-- NEXORA — 11_pqrs_and_maintenance.sql
-- PQRS, reportes de falla y seguimiento administrativo
-- Ejecutar DESPUÉS de 10_projects_and_voting.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.maintenance_ticket_type AS ENUM (
    'DAMAGE_REPORT', 'PETITION', 'COMPLAINT', 'SUGGESTION'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.maintenance_ticket_status AS ENUM (
    'OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.maintenance_priority AS ENUM (
    'LOW', 'MEDIUM', 'HIGH', 'URGENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- maintenance_tickets
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id         uuid NOT NULL REFERENCES public.complexes (id) ON DELETE CASCADE,
  unit_id            uuid REFERENCES public.units (id) ON DELETE SET NULL,
  created_by         uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  radicado           text NOT NULL,
  type               public.maintenance_ticket_type NOT NULL DEFAULT 'PETITION',
  title              text NOT NULL,
  description        text NOT NULL,
  location_details   text,
  status             public.maintenance_ticket_status NOT NULL DEFAULT 'OPEN',
  priority           public.maintenance_priority NOT NULL DEFAULT 'MEDIUM',
  evidence_urls      text[] NOT NULL DEFAULT '{}',
  admin_response     text,
  solution_image_url text,
  resolved_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT maintenance_tickets_radicado_unique UNIQUE (radicado)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_complex
  ON public.maintenance_tickets (complex_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_status
  ON public.maintenance_tickets (complex_id, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_created_by
  ON public.maintenance_tickets (created_by);
CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_unit
  ON public.maintenance_tickets (unit_id);

DROP TRIGGER IF EXISTS trg_maintenance_tickets_updated_at ON public.maintenance_tickets;
CREATE TRIGGER trg_maintenance_tickets_updated_at
  BEFORE UPDATE ON public.maintenance_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.maintenance_tickets IS
  'PQRS y reportes de falla / mantenimiento de zonas comunes';
COMMENT ON COLUMN public.maintenance_tickets.radicado IS
  'Número de radicado legible (ej. PQRS-2026-A1B2)';

-- -----------------------------------------------------------------------------
-- ticket_updates (historial / timeline)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_updates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id           uuid NOT NULL REFERENCES public.maintenance_tickets (id) ON DELETE CASCADE,
  author_id           uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  comment             text,
  status_changed_to   text,
  attachment_url      text,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ticket_updates_ticket
  ON public.ticket_updates (ticket_id, created_at ASC);

COMMENT ON TABLE public.ticket_updates IS
  'Historial de comentarios y cambios de estado de un ticket PQRS';

-- -----------------------------------------------------------------------------
-- RLS maintenance_tickets
-- -----------------------------------------------------------------------------
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maintenance_tickets_select" ON public.maintenance_tickets;
CREATE POLICY "maintenance_tickets_select"
  ON public.maintenance_tickets FOR SELECT TO authenticated
  USING (
    public.belongs_to_complex(complex_id)
    AND (
      public.is_ops()
      OR created_by = auth.uid()
      OR (unit_id IS NOT NULL AND public.belongs_to_unit(unit_id))
    )
  );

DROP POLICY IF EXISTS "maintenance_tickets_resident_insert" ON public.maintenance_tickets;
CREATE POLICY "maintenance_tickets_resident_insert"
  ON public.maintenance_tickets FOR INSERT TO authenticated
  WITH CHECK (
    public.belongs_to_complex(complex_id)
    AND created_by = auth.uid()
    AND (
      unit_id IS NULL
      OR public.belongs_to_unit(unit_id)
    )
  );

DROP POLICY IF EXISTS "maintenance_tickets_admin_update" ON public.maintenance_tickets;
CREATE POLICY "maintenance_tickets_admin_update"
  ON public.maintenance_tickets FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  )
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "maintenance_tickets_admin_delete" ON public.maintenance_tickets;
CREATE POLICY "maintenance_tickets_admin_delete"
  ON public.maintenance_tickets FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

-- -----------------------------------------------------------------------------
-- RLS ticket_updates
-- -----------------------------------------------------------------------------
ALTER TABLE public.ticket_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket_updates_select" ON public.ticket_updates;
CREATE POLICY "ticket_updates_select"
  ON public.ticket_updates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_tickets t
      WHERE t.id = ticket_id
        AND public.belongs_to_complex(t.complex_id)
        AND (
          public.is_ops()
          OR t.created_by = auth.uid()
          OR (t.unit_id IS NOT NULL AND public.belongs_to_unit(t.unit_id))
        )
    )
  );

DROP POLICY IF EXISTS "ticket_updates_insert" ON public.ticket_updates;
CREATE POLICY "ticket_updates_insert"
  ON public.ticket_updates FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.maintenance_tickets t
      WHERE t.id = ticket_id
        AND public.belongs_to_complex(t.complex_id)
        AND (
          public.is_admin()
          OR t.created_by = auth.uid()
        )
    )
  );

-- -----------------------------------------------------------------------------
-- Storage: evidencias de mantenimiento / PQRS
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'maintenance-evidence',
  'maintenance-evidence',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "maintenance_evidence_select_public" ON storage.objects;
CREATE POLICY "maintenance_evidence_select_public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'maintenance-evidence');

DROP POLICY IF EXISTS "maintenance_evidence_insert_member" ON storage.objects;
CREATE POLICY "maintenance_evidence_insert_member"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'maintenance-evidence'
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
  );

DROP POLICY IF EXISTS "maintenance_evidence_delete_own_or_admin" ON storage.objects;
CREATE POLICY "maintenance_evidence_delete_own_or_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'maintenance-evidence'
    AND (public.is_admin() OR owner = auth.uid())
  );
