import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ResidentDeliveriesTabs,
  type ResidentDelivery,
} from "@/components/resident/resident-deliveries-tabs";

export default async function ResidentDeliveriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("unit_id, role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "RESIDENT") {
    redirect("/login");
  }

  if (!profile.unit_id) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Link
          href="/dashboard/resident"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver al inicio
        </Link>
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-12 text-center">
          <Package className="mx-auto size-8 text-[var(--muted)]" aria-hidden />
          <p className="mt-3 text-sm text-[var(--muted)]">
            No tienes una unidad asignada. Contacta a la administración.
          </p>
        </div>
      </div>
    );
  }

  const { data: rows } = await supabase
    .from("deliveries")
    .select(
      "id, courier_company, package_details, status, verification_code, received_at, delivered_at, created_at, received_by",
    )
    .eq("unit_id", profile.unit_id)
    .order("created_at", { ascending: false });

  const receiverIds = [
    ...new Set(
      (rows ?? [])
        .map((r) => r.received_by)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const nameById = new Map<string, string>();
  if (receiverIds.length > 0) {
    const { data: receivers } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", receiverIds);
    for (const r of receivers ?? []) {
      if (r.full_name) nameById.set(r.id, r.full_name);
    }
  }

  const deliveries: ResidentDelivery[] = (rows ?? []).map((r) => ({
    id: r.id,
    courier_company: r.courier_company,
    package_details: r.package_details,
    status: r.status,
    verification_code: r.verification_code,
    received_at: r.received_at,
    delivered_at: r.delivered_at,
    created_at: r.created_at,
    received_by_name: r.received_by
      ? (nameById.get(r.received_by) ?? null)
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

      <div>
        <h1 className="font-display text-2xl font-semibold">Encomiendas</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Paquetes en portería y historial de retiros.
        </p>
      </div>

      <ResidentDeliveriesTabs deliveries={deliveries} />
    </div>
  );
}
