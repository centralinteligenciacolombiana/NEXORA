import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  AdminPeopleClient,
  type AdminPeopleMember,
} from "@/components/admin/admin-people-client";
import { OnDutySecurityLive } from "@/components/shared/on-duty-security-live";
import { fetchOnDutyGuards } from "@/lib/on-duty-security";
import { occupancyLabel } from "@/lib/occupancy";
import { formatDateTime } from "@/lib/utils";
import type { UserRole } from "@/types";

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrador",
  RESIDENT: "Residente",
  SECURITY: "Seguridad",
  STAFF: "Mantenimiento",
};

export default async function AdminPeoplePage() {
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

  const [{ data: rows }, { data: activeShifts }, { data: units }, onDuty] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone, role, unit_id, occupancy_type, is_owner, registration_status, is_active, login_code, created_at",
        )
        .eq("complex_id", profile.complex_id)
        .order("full_name", { ascending: true }),
      supabase
        .from("guard_shifts")
        .select("guard_id, shift_type")
        .eq("complex_id", profile.complex_id)
        .eq("status", "ACTIVE"),
      supabase
        .from("units")
        .select("id, number, tower")
        .eq("complex_id", profile.complex_id),
      fetchOnDutyGuards(supabase, profile.complex_id),
    ]);

  const unitById = new Map(
    (units ?? []).map((u) => [
      u.id,
      [u.tower, `Apto ${u.number}`].filter(Boolean).join(" · "),
    ]),
  );

  const shiftByGuard = new Map(
    (activeShifts ?? []).map((s) => [
      s.guard_id,
      s.shift_type as "DAY" | "NIGHT",
    ]),
  );

  const members: AdminPeopleMember[] = (rows ?? []).map((p) => {
    const role = (p.role as UserRole) ?? "RESIDENT";
    const statusRaw = (p.registration_status ?? "APPROVED") as
      | "PENDING"
      | "APPROVED"
      | "REJECTED";
    return {
      id: p.id,
      fullName: p.full_name?.trim() || "Sin nombre",
      email: p.email ?? "—",
      phone: p.phone,
      role,
      roleLabel: ROLE_LABEL[role] ?? role,
      unitLabel: p.unit_id ? (unitById.get(p.unit_id) ?? "Unidad") : null,
      occupancyLabel:
        role === "RESIDENT"
          ? occupancyLabel(p.occupancy_type, p.is_owner)
          : null,
      registrationStatus: statusRaw,
      isActive: p.is_active !== false,
      loginCode: p.login_code,
      createdAtLabel: formatDateTime(p.created_at),
      activeShift:
        role === "SECURITY" ? (shiftByGuard.get(p.id) ?? null) : null,
    };
  });

  const approved = members.filter((m) => m.registrationStatus === "APPROVED");
  const counts = {
    total: approved.length,
    residents: approved.filter((m) => m.role === "RESIDENT").length,
    security: approved.filter((m) => m.role === "SECURITY").length,
    staff: approved.filter((m) => m.role === "STAFF").length,
    onDuty: approved.filter((m) => m.role === "SECURITY" && m.activeShift)
      .length,
    pending: members.filter((m) => m.registrationStatus === "PENDING").length,
  };

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--brand)]">
            <Users className="size-4" aria-hidden />
            Comunidad
          </p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            Personas del conjunto
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Residentes, seguridad, mantenimiento y administradores. Filtra,
            busca y ve quién está de turno en seguridad.
          </p>
        </div>
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver
        </Link>
      </div>

      <OnDutySecurityLive
        complexId={profile.complex_id}
        initialGuards={onDuty}
        title="Seguridad en turno ahora"
        emptyMessage="Nadie de seguridad marcado en turno ahora."
      />

      <AdminPeopleClient members={members} counts={counts} />
    </div>
  );
}
