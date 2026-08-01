import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  AdminAmenitiesClient,
  type AdminAmenityRow,
  type AdminReservationRow,
} from "@/components/admin/admin-amenities-client";
import type { ReservationStatus } from "@/lib/reservations";

export default async function AdminAmenitiesPage() {
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
    redirect("/login");
  }

  const [{ data: amenities }, { data: pending }, { data: units }] =
    await Promise.all([
      supabase
        .from("amenities")
        .select(
          "id, name, description, rules, capacity, available_from, available_to, requires_approval, is_active, max_hours",
        )
        .eq("complex_id", profile.complex_id)
        .order("name", { ascending: true }),
      supabase
        .from("reservations")
        .select(
          "id, start_time, end_time, status, notes, unit_id, reserved_by, amenities!inner(name, complex_id)",
        )
        .eq("status", "PENDING")
        .eq("amenities.complex_id", profile.complex_id)
        .order("start_time", { ascending: true }),
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

  const reservedByIds = [
    ...new Set((pending ?? []).map((r) => r.reserved_by).filter(Boolean)),
  ];
  const nameById = new Map<string, string>();
  if (reservedByIds.length > 0) {
    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", reservedByIds);
    for (const p of people ?? []) {
      nameById.set(p.id, p.full_name?.trim() || "Residente");
    }
  }

  const amenityRows: AdminAmenityRow[] = (amenities ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    rules: a.rules ?? null,
    capacity: a.capacity,
    available_from: String(a.available_from),
    available_to: String(a.available_to),
    requires_approval: a.requires_approval,
    is_active: a.is_active,
    max_hours: a.max_hours != null ? Number(a.max_hours) : null,
  }));

  const pendingRows: AdminReservationRow[] = (pending ?? []).map((r) => {
    const amenity = Array.isArray(r.amenities) ? r.amenities[0] : r.amenities;
    return {
      id: r.id,
      start_time: r.start_time,
      end_time: r.end_time,
      status: r.status as ReservationStatus,
      notes: r.notes,
      amenityName: (amenity as { name?: string } | null)?.name ?? "Zona",
      unitLabel: unitLabel.get(r.unit_id) ?? "Unidad",
      residentName: nameById.get(r.reserved_by) ?? "Residente",
    };
  });

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <Link
        href="/dashboard/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <CalendarDays className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Zonas comunes y reservas
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Configura amenidades y aprueba solicitudes.
          </p>
        </div>
      </div>

      <AdminAmenitiesClient
        amenities={amenityRows}
        pendingReservations={pendingRows}
      />
    </div>
  );
}
