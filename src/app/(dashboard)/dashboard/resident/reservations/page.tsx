import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ResidentReservationsClient,
  type AmenityOption,
  type ReservationRow,
} from "@/components/resident/resident-reservations-client";
import type { ReservationStatus } from "@/lib/reservations";

export default async function ResidentReservationsPage() {
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

  const [{ data: amenityRows }, { data: reservationRows }] = await Promise.all([
    supabase
      .from("amenities")
      .select(
        "id, name, description, rules, capacity, available_from, available_to, requires_approval, max_hours",
      )
      .eq("complex_id", profile.complex_id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("reservations")
      .select(
        "id, start_time, end_time, status, notes, amenities(name)",
      )
      .eq("reserved_by", user.id)
      .order("start_time", { ascending: false })
      .limit(30),
  ]);

  const amenities: AmenityOption[] = (amenityRows ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    rules: a.rules ?? null,
    capacity: a.capacity,
    available_from: String(a.available_from),
    available_to: String(a.available_to),
    requires_approval: a.requires_approval,
    max_hours: a.max_hours != null ? Number(a.max_hours) : null,
  }));

  const reservations: ReservationRow[] = (reservationRows ?? []).map((r) => {
    const amenity = Array.isArray(r.amenities) ? r.amenities[0] : r.amenities;
    return {
      id: r.id,
      start_time: r.start_time,
      end_time: r.end_time,
      status: r.status as ReservationStatus,
      notes: r.notes,
      amenityName:
        (amenity as { name?: string } | null)?.name ?? "Zona común",
    };
  });

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
          <CalendarDays className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Reservas de zonas comunes
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Consulta disponibilidad y solicita tu franja.
          </p>
        </div>
      </div>

      <ResidentReservationsClient
        amenities={amenities}
        reservations={reservations}
      />
    </div>
  );
}
