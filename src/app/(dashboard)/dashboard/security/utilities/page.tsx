import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  SecurityUtilitiesClient,
  type PendingUtilityBill,
} from "@/components/security/security-utilities-client";

function unitLabel(tower: string | null | undefined, number: string) {
  return [tower, `Apto ${number}`].filter(Boolean).join(" · ");
}

export default async function SecurityUtilitiesPage() {
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
    .eq("is_active", true)
    .order("tower", { ascending: true })
    .order("number", { ascending: true });

  const { data: bills } = await supabase
    .from("utility_bills")
    .select(
      "id, service_type, period_name, received_at, unit_id, units!inner(number, tower)",
    )
    .eq("complex_id", profile.complex_id)
    .eq("status", "PENDING")
    .order("received_at", { ascending: false });

  const pendingBills: PendingUtilityBill[] = (bills ?? []).map((b) => {
    const unit = Array.isArray(b.units) ? b.units[0] : b.units;
    const unitRow = unit as { number?: string; tower?: string | null } | null;
    return {
      id: b.id,
      service_type: b.service_type,
      period_name: b.period_name,
      received_at: b.received_at,
      unitLabel: unitLabel(unitRow?.tower, unitRow?.number ?? "?"),
      unitNumber: unitRow?.number ?? "",
      unitTower: unitRow?.tower ?? null,
    };
  });

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
          <FileText className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Recibos de servicios
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Registra llegadas y entrégalos con PIN al residente.
          </p>
        </div>
      </div>

      <SecurityUtilitiesClient
        units={units ?? []}
        pendingBills={pendingBills}
      />
    </div>
  );
}
