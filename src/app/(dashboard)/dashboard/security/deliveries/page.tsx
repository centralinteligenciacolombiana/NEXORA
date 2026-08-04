import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  SecurityDeliveriesClient,
  type SecurityPendingDelivery,
} from "@/components/security/security-deliveries-client";

function unitLabel(tower: string | null | undefined, number: string) {
  return [tower, `Apto ${number}`].filter(Boolean).join(" · ");
}

export default async function SecurityDeliveriesPage() {
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

  if (
    !profile?.complex_id ||
    (profile.role !== "SECURITY" && profile.role !== "ADMIN")
  ) {
    redirect("/login");
  }

  const { data: units } = await supabase
    .from("units")
    .select("id, number, tower")
    .eq("complex_id", profile.complex_id)
    .eq("is_active", true);

  const unitIds = (units ?? []).map((u) => u.id);
  const unitById = new Map(
    (units ?? []).map((u) => [
      u.id,
      {
        label: unitLabel(u.tower, u.number),
        number: u.number,
        tower: u.tower,
      },
    ]),
  );

  let pending: SecurityPendingDelivery[] = [];

  if (unitIds.length > 0) {
    const { data: rows } = await supabase
      .from("deliveries")
      .select(
        "id, courier_company, package_details, verification_code, received_at, created_at, unit_id, status",
      )
      .in("unit_id", unitIds)
      .in("status", ["PENDING", "AT_RECEPTION"])
      .order("created_at", { ascending: false });

    pending = (rows ?? []).map((r) => {
      const u = unitById.get(r.unit_id);
      return {
        id: r.id,
        courier_company: r.courier_company,
        package_details: r.package_details,
        verification_code: r.verification_code,
        received_at: r.received_at,
        created_at: r.created_at,
        unit_id: r.unit_id,
        unitLabel: u?.label ?? "Unidad",
        unitNumber: u?.number ?? "",
        unitTower: u?.tower ?? null,
      };
    });
  }

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
        <div className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          <Package className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Entregar encomiendas
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Busca la unidad y confirma el PIN del residente.
          </p>
        </div>
      </div>

      <SecurityDeliveriesClient deliveries={pending} />
    </div>
  );
}
