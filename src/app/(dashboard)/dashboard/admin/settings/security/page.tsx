import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  AdminSecuritySettingsClient,
  type SecurityGuardRow,
} from "@/components/admin/admin-security-settings-client";
import type { ShiftType } from "@/lib/actions/shifts";

export default async function AdminSecuritySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "ADMIN") {
    redirect("/onboarding");
  }

  const [{ data: complex }, { data: securityProfiles }, { data: activeShifts }] =
    await Promise.all([
      supabase
        .from("complexes")
        .select("id, enable_shift_logbook")
        .eq("id", profile.complex_id)
        .single(),
      supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("complex_id", profile.complex_id)
        .eq("role", "SECURITY")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
      supabase
        .from("guard_shifts")
        .select("guard_id, shift_type")
        .eq("complex_id", profile.complex_id)
        .eq("status", "ACTIVE"),
    ]);

  if (!complex) {
    redirect("/dashboard/admin");
  }

  const shiftByGuard = new Map(
    (activeShifts ?? []).map((s) => [s.guard_id, s.shift_type as ShiftType]),
  );

  const guards: SecurityGuardRow[] = (securityProfiles ?? []).map((g) => ({
    id: g.id,
    full_name: g.full_name,
    email: g.email,
    avatar_url: g.avatar_url,
    activeShiftType: shiftByGuard.get(g.id) ?? null,
  }));

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--brand)]">
            <Shield className="size-4" aria-hidden />
            Seguridad
          </p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            Turnos y bitácora
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Activa la bitácora de relevos y asigna turnos Día / Noche.
          </p>
        </div>
        <Link
          href="/dashboard/admin/settings"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Configuración
        </Link>
      </div>

      <AdminSecuritySettingsClient
        enableShiftLogbook={complex.enable_shift_logbook ?? true}
        guards={guards}
      />
    </div>
  );
}
