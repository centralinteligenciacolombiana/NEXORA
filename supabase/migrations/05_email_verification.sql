-- =============================================================================
-- NEXORA — 05_email_verification.sql
-- Confirmación de correo en profiles
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;

COMMENT ON COLUMN public.profiles.email_confirmed_at IS 'Marca de confirmación de correo (vía Resend /auth/confirm)';

-- Permitir al usuario autenticado marcar su propio email confirmado
-- (también lo hace el service role / SECURITY DEFINER en confirmación)
DROP POLICY IF EXISTS "profiles_confirm_own_email" ON public.profiles;
CREATE POLICY "profiles_confirm_own_email"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
