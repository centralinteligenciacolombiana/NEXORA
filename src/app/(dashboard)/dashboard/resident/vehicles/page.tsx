import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Car } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ResidentVehiclesClient,
  type ResidentVehicleRow,
} from "@/components/resident/resident-vehicles-client";
import type { VehicleType } from "@/lib/vehicles";

export default async function ResidentVehiclesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id, unit_id, registration_status")
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
        <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          Necesitas una unidad asignada para registrar vehículos.
        </p>
      </div>
    );
  }

  const { data: rows } = await supabase
    .from("authorized_vehicles")
    .select("id, plate, vehicle_type, color, photo_url, notes")
    .eq("unit_id", profile.unit_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const vehicles: ResidentVehicleRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    plate: r.plate,
    vehicle_type: r.vehicle_type as VehicleType,
    color: r.color,
    photo_url: r.photo_url,
    notes: r.notes,
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
          <Car className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Vehículos autorizados
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Registra las placas de tu unidad para ingreso en portería.
          </p>
        </div>
      </div>

      <ResidentVehiclesClient vehicles={vehicles} />
    </div>
  );
}
