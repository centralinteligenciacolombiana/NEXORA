import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  SecurityMovesClient,
  type SecurityMoveRow,
} from "@/components/security/security-moves-client";
import type { MoveRequestType } from "@/lib/moves";

/** Inicio del día en America/Bogota como ISO (UTC). */
function startOfTodayBogotaIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}T00:00:00-05:00`;
}

export default async function SecurityMovesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile?.complex_id ||
    (profile.role !== "SECURITY" && profile.role !== "ADMIN")
  ) {
    redirect("/login");
  }

  const fromIso = new Date(startOfTodayBogotaIso()).toISOString();

  const [{ data: rows }, { data: units }] = await Promise.all([
    supabase
      .from("move_requests")
      .select(
        "id, request_type, proposed_at, moving_company, notes, unit_id, requested_by, verified_at, verified_by",
      )
      .eq("complex_id", profile.complex_id)
      .eq("status", "APPROVED")
      .gte("proposed_at", fromIso)
      .order("proposed_at", { ascending: true })
      .limit(40),
    supabase
      .from("units")
      .select("id, number, tower")
      .eq("complex_id", profile.complex_id),
  ]);

  const unitLabel = new Map(
    (units ?? []).map((u) => [
      u.id,
      [u.tower, `Apto ${u.number}`].filter(Boolean).join(" · "),
    ]),
  );

  const personIds = [
    ...new Set(
      (rows ?? [])
        .flatMap((r) => [r.requested_by, r.verified_by])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const nameById = new Map<string, string>();
  if (personIds.length > 0) {
    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", personIds);
    for (const p of people ?? []) {
      nameById.set(p.id, p.full_name?.trim() || "Usuario");
    }
  }

  const list: SecurityMoveRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    request_type: r.request_type as MoveRequestType,
    proposed_at: r.proposed_at,
    moving_company: r.moving_company,
    notes: r.notes,
    unitLabel: unitLabel.get(r.unit_id) ?? "Unidad",
    residentName: nameById.get(r.requested_by) ?? "Residente",
    verified_at: r.verified_at,
    verified_by_name: r.verified_by
      ? (nameById.get(r.verified_by) ?? "Portería")
      : null,
  }));

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <Link
        href="/dashboard/security"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a seguridad
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Truck className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">Mudanzas</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Solo aprobadas · hoy y próximas · verifica en portería
          </p>
        </div>
      </div>

      <SecurityMovesClient rows={list} />
    </div>
  );
}
