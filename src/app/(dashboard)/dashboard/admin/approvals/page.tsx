import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  AdminApprovalsClient,
  type PendingRegistrationRow,
} from "@/components/admin/admin-approvals-client";
import { occupancyLabel } from "@/lib/occupancy";
import { formatDateTime } from "@/lib/utils";

export default async function AdminApprovalsPage() {
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

  const { data: pending } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, role, unit_id, occupancy_type, login_code, created_at, is_owner",
    )
    .eq("complex_id", profile.complex_id)
    .eq("registration_status", "PENDING")
    .order("created_at", { ascending: false });

  const unitIds = [
    ...new Set(
      (pending ?? [])
        .map((p) => p.unit_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const unitById = new Map<string, string>();
  if (unitIds.length > 0) {
    const { data: units } = await supabase
      .from("units")
      .select("id, number, tower")
      .in("id", unitIds);
    for (const u of units ?? []) {
      unitById.set(
        u.id,
        [u.tower, `Apto ${u.number}`].filter(Boolean).join(" · "),
      );
    }
  }

  const ROLE_LABEL: Record<string, string> = {
    RESIDENT: "Residente",
    SECURITY: "Seguridad",
    STAFF: "Mantenimiento",
    ADMIN: "Admin",
  };

  const rows: PendingRegistrationRow[] = (pending ?? []).map((p) => {
    return {
      id: p.id,
      fullName: p.full_name?.trim() || "Sin nombre",
      email: p.email ?? "—",
      phone: p.phone,
      unitLabel: p.unit_id
        ? (unitById.get(p.unit_id) ?? "Unidad")
        : "Sin unidad",
      occupancyLabel: occupancyLabel(p.occupancy_type, p.is_owner),
      roleLabel: ROLE_LABEL[p.role] ?? p.role,
      loginCode: p.login_code,
      createdAt: formatDateTime(p.created_at),
    };
  });

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--brand)]">
            <UserCheck className="size-4" aria-hidden />
            Altas nuevas
          </p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            Confirmar registros
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Personas que se registraron con el link o QR (residentes, seguridad
            o mantenimiento). Confirma solo si pertenecen al conjunto.
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

      <AdminApprovalsClient rows={rows} />
    </div>
  );
}
