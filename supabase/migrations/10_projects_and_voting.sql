-- =============================================================================
-- NEXORA — 10_projects_and_voting.sql
-- Portafolio de proyectos y sistema de votaciones / encuestas
-- Ejecutar DESPUÉS de 09_schedules_and_finances.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.project_status AS ENUM (
    'PROPOSED', 'IN_PROGRESS', 'COMPLETED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.poll_status AS ENUM ('ACTIVE', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- complex_projects
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complex_projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id       uuid NOT NULL REFERENCES public.complexes (id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  status           public.project_status NOT NULL DEFAULT 'PROPOSED',
  year             integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
  budget           numeric(14, 2) CHECK (budget IS NULL OR budget >= 0),
  cover_image_url  text,
  created_by       uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at       timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_complex_projects_complex_year
  ON public.complex_projects (complex_id, year DESC);

CREATE INDEX IF NOT EXISTS idx_complex_projects_status
  ON public.complex_projects (complex_id, status);

DROP TRIGGER IF EXISTS trg_complex_projects_updated_at ON public.complex_projects;
CREATE TRIGGER trg_complex_projects_updated_at
  BEFORE UPDATE ON public.complex_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.complex_projects IS
  'Portafolio de proyectos / rendición de cuentas de la copropiedad';

-- -----------------------------------------------------------------------------
-- polls
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.polls (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id   uuid NOT NULL REFERENCES public.complexes (id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  status       public.poll_status NOT NULL DEFAULT 'ACTIVE',
  starts_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ends_at      timestamptz,
  created_by   uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT polls_ends_after_starts
    CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_polls_complex_status
  ON public.polls (complex_id, status);

DROP TRIGGER IF EXISTS trg_polls_updated_at ON public.polls;
CREATE TRIGGER trg_polls_updated_at
  BEFORE UPDATE ON public.polls
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.polls IS 'Encuestas y votaciones digitales del conjunto';

-- -----------------------------------------------------------------------------
-- poll_options
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poll_options (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id      uuid NOT NULL REFERENCES public.polls (id) ON DELETE CASCADE,
  option_text  text NOT NULL,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id
  ON public.poll_options (poll_id, sort_order);

COMMENT ON TABLE public.poll_options IS 'Opciones de respuesta de una encuesta';

-- -----------------------------------------------------------------------------
-- poll_votes (1 voto por unidad por encuesta)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     uuid NOT NULL REFERENCES public.polls (id) ON DELETE CASCADE,
  option_id   uuid NOT NULL REFERENCES public.poll_options (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  unit_id     uuid NOT NULL REFERENCES public.units (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT poll_votes_one_per_unit UNIQUE (poll_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON public.poll_votes (poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON public.poll_votes (option_id);

COMMENT ON TABLE public.poll_votes IS
  'Votos: una unidad (apartamento) solo puede votar una vez por encuesta';

-- -----------------------------------------------------------------------------
-- RLS complex_projects
-- -----------------------------------------------------------------------------
ALTER TABLE public.complex_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "complex_projects_select" ON public.complex_projects;
CREATE POLICY "complex_projects_select"
  ON public.complex_projects FOR SELECT TO authenticated
  USING (public.belongs_to_complex(complex_id));

DROP POLICY IF EXISTS "complex_projects_admin_insert" ON public.complex_projects;
CREATE POLICY "complex_projects_admin_insert"
  ON public.complex_projects FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "complex_projects_admin_update" ON public.complex_projects;
CREATE POLICY "complex_projects_admin_update"
  ON public.complex_projects FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  )
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "complex_projects_admin_delete" ON public.complex_projects;
CREATE POLICY "complex_projects_admin_delete"
  ON public.complex_projects FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

-- -----------------------------------------------------------------------------
-- RLS polls
-- -----------------------------------------------------------------------------
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "polls_select" ON public.polls;
CREATE POLICY "polls_select"
  ON public.polls FOR SELECT TO authenticated
  USING (public.belongs_to_complex(complex_id));

DROP POLICY IF EXISTS "polls_admin_insert" ON public.polls;
CREATE POLICY "polls_admin_insert"
  ON public.polls FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "polls_admin_update" ON public.polls;
CREATE POLICY "polls_admin_update"
  ON public.polls FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  )
  WITH CHECK (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

DROP POLICY IF EXISTS "polls_admin_delete" ON public.polls;
CREATE POLICY "polls_admin_delete"
  ON public.polls FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND complex_id = public.current_complex_id()
  );

-- -----------------------------------------------------------------------------
-- RLS poll_options
-- -----------------------------------------------------------------------------
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "poll_options_select" ON public.poll_options;
CREATE POLICY "poll_options_select"
  ON public.poll_options FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = poll_id
        AND public.belongs_to_complex(p.complex_id)
    )
  );

DROP POLICY IF EXISTS "poll_options_admin_insert" ON public.poll_options;
CREATE POLICY "poll_options_admin_insert"
  ON public.poll_options FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = poll_id
        AND p.complex_id = public.current_complex_id()
        AND public.is_admin()
    )
  );

DROP POLICY IF EXISTS "poll_options_admin_delete" ON public.poll_options;
CREATE POLICY "poll_options_admin_delete"
  ON public.poll_options FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = poll_id
        AND p.complex_id = public.current_complex_id()
        AND public.is_admin()
    )
  );

-- -----------------------------------------------------------------------------
-- RLS poll_votes
-- -----------------------------------------------------------------------------
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "poll_votes_select" ON public.poll_votes;
CREATE POLICY "poll_votes_select"
  ON public.poll_votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = poll_id
        AND public.belongs_to_complex(p.complex_id)
    )
  );

DROP POLICY IF EXISTS "poll_votes_resident_insert" ON public.poll_votes;
CREATE POLICY "poll_votes_resident_insert"
  ON public.poll_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.belongs_to_unit(unit_id)
    AND EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = poll_id
        AND public.belongs_to_complex(p.complex_id)
        AND p.status = 'ACTIVE'
        AND (p.ends_at IS NULL OR p.ends_at > timezone('utc', now()))
    )
    AND EXISTS (
      SELECT 1 FROM public.poll_options o
      WHERE o.id = option_id AND o.poll_id = poll_id
    )
  );

-- Sin UPDATE/DELETE de votos por residentes (inmutables)
DROP POLICY IF EXISTS "poll_votes_admin_delete" ON public.poll_votes;
CREATE POLICY "poll_votes_admin_delete"
  ON public.poll_votes FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = poll_id
        AND p.complex_id = public.current_complex_id()
        AND public.is_admin()
    )
  );

-- -----------------------------------------------------------------------------
-- Storage: portadas de proyectos
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-covers',
  'project-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "project_covers_select_public" ON storage.objects;
CREATE POLICY "project_covers_select_public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'project-covers');

DROP POLICY IF EXISTS "project_covers_insert_admin" ON storage.objects;
CREATE POLICY "project_covers_insert_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-covers'
    AND public.is_admin()
    AND (storage.foldername(name))[1] = public.current_complex_id()::text
  );

DROP POLICY IF EXISTS "project_covers_delete_admin" ON storage.objects;
CREATE POLICY "project_covers_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-covers'
    AND public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- Realtime resultados de votación
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Publicación supabase_realtime no encontrada';
END $$;
