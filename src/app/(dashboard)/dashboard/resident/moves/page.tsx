import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ResidentMovesClient,
  type ResidentMoveRow,
} from "@/components/resident/resident-moves-client";
import type { MoveRequestStatus, MoveRequestType } from "@/lib/moves";

export default async function ResidentMovesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id, unit_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "RESIDENT") {
    redirect("/login");
  }

  const { data: rows } = await supabase
    .from("move_requests")
    .select(
      "id, request_type, proposed_at, moving_company, notes, status, review_notes, verified_at, verified_by",
    )
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });

  const verifierIds = [
    ...new Set(
      (rows ?? [])
        .map((r) => r.verified_by)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const nameById = new Map<string, string>();
  if (verifierIds.length > 0) {
    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", verifierIds);
    for (const p of people ?? []) {
      nameById.set(p.id, p.full_name?.trim() || "Portería");
    }
  }

  const requests: ResidentMoveRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    request_type: r.request_type as MoveRequestType,
    proposed_at: r.proposed_at,
    moving_company: r.moving_company,
    notes: r.notes,
    status: r.status as MoveRequestStatus,
    review_notes: r.review_notes,
    verified_at: r.verified_at,
    verified_by_name: r.verified_by
      ? (nameById.get(r.verified_by) ?? "Portería")
      : null,
  }));

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <Link
        href="/dashboard/resident"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver al inicio
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Truck className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Autorización de mudanza
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Solicita ingreso o salida · administración aprueba · portería
            verifica.
          </p>
        </div>
      </div>

      {!profile.unit_id ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          Necesitas una unidad asignada.
        </p>
      ) : (
        <ResidentMovesClient requests={requests} />
      )}
    </div>
  );
}
