-- =============================================================================
-- NEXORA — reset_tenant_data.sql (OPCIONAL, destructivo)
-- Vacía datos de aplicación para empezar de cero SIN tocar migraciones/schema.
-- NO borra auth.users (hazlo desde Auth Dashboard si quieres cuentas nuevas).
-- Ejecutar en SQL Editor solo cuando quieras un wipe completo de negocio.
-- =============================================================================

BEGIN;

-- Orden aproximado respetando FKs habituales
TRUNCATE TABLE
  public.poll_votes,
  public.poll_options,
  public.polls,
  public.complex_projects,
  public.ticket_updates,
  public.maintenance_tickets,
  public.admin_fee_payments,
  public.utility_bills,
  public.shift_logs,
  public.guard_shifts,
  public.emergency_alerts,
  public.deliveries,
  public.visitors,
  public.reservations,
  public.amenities,
  public.authorized_vehicles,
  public.pets,
  public.vehicles,
  public.move_requests,
  public.complex_invites,
  public.units,
  public.complexes
RESTART IDENTITY CASCADE;

-- Desvincular perfiles restantes (si aún hay auth.users)
UPDATE public.profiles
SET
  complex_id = NULL,
  unit_id = NULL,
  role = 'RESIDENT',
  is_owner = false,
  registration_status = 'APPROVED',
  updated_at = timezone('utc', now());

COMMIT;
