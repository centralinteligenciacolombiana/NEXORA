import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

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

  const { data: reservations } = await supabase
    .from("reservations")
    .select(
      "id, start_time, end_time, status, notes, amenities(name)",
    )
    .eq("reserved_by", user.id)
    .order("start_time", { ascending: false })
    .limit(20);

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
        <h1 className="font-display text-2xl font-semibold">Reservas</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Zonas comunes reservadas por ti.
        </p>
      </div>

      {(reservations ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-12 text-center">
          <CalendarDays className="mx-auto size-8 text-[var(--muted)]" aria-hidden />
          <p className="mt-3 text-sm text-[var(--muted)]">
            No tienes reservas activas. Pronto podrás reservar salón, BBQ y más.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          {(reservations ?? []).map((r) => {
            const amenity = Array.isArray(r.amenities)
              ? r.amenities[0]
              : r.amenities;
            return (
              <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {(amenity as { name?: string } | null)?.name ?? "Zona común"}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatDateTime(r.start_time)} → {formatDateTime(r.end_time)}
                  </p>
                </div>
                <Badge variant="default">{r.status}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
