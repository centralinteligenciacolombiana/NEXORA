import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Package, QrCode, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { CreateVisitorPassForm } from "@/components/resident/create-visitor-pass-form";
import {
  VISITOR_ACCESS_LABELS,
  VISITOR_STATUS_LABELS,
  isVisitorPassActive,
} from "@/lib/visitors";
import { formatDateTime } from "@/lib/utils";
import type { VisitorAccessType, VisitorStatus } from "@/types";

export default async function ResidentVisitsPage() {
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

  const [{ data: visitors }, { data: deliveries }] = await Promise.all([
    profile.unit_id
      ? supabase
          .from("visitors")
          .select(
            "id, visitor_name, status, access_type, valid_from, valid_until, entry_time, created_at",
          )
          .eq("unit_id", profile.unit_id)
          .eq("is_delivery", false)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    profile.unit_id
      ? supabase
          .from("deliveries")
          .select("id, courier_company, package_details, status, created_at")
          .eq("unit_id", profile.unit_id)
          .in("status", ["PENDING", "AT_RECEPTION"])
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

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
        <h1 className="font-display text-2xl font-semibold">Visitas y paquetes</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Registra visitantes, genera su QR y renueva cuando venza la
          autorización.
        </p>
      </div>

      {profile.unit_id ? (
        <CreateVisitorPassForm />
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
          Necesitas una unidad asignada para autorizar visitas.
        </p>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-[var(--brand)]" aria-hidden />
          <h2 className="font-semibold">Mis autorizaciones</h2>
        </div>
        {(visitors ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
            Aún no has registrado visitantes.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
            {(visitors ?? []).map((v) => {
              const accessType = (v.access_type ?? "TODAY") as VisitorAccessType;
              const status = v.status as VisitorStatus;
              const active = isVisitorPassActive({
                status,
                validFrom: v.valid_from,
                validUntil: v.valid_until,
              }).active;

              return (
                <li key={v.id}>
                  <Link
                    href={`/dashboard/resident/visits/${v.id}`}
                    className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {v.visitor_name}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {VISITOR_ACCESS_LABELS[accessType]}
                        {v.valid_until
                          ? ` · hasta ${formatDateTime(v.valid_until)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={active ? "success" : "muted"}>
                        {active
                          ? "Vigente"
                          : VISITOR_STATUS_LABELS[status] ?? status}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--brand)]">
                        <QrCode className="size-3" aria-hidden />
                        Ver QR
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Package className="size-4 text-[var(--emerald)]" aria-hidden />
          <h2 className="font-semibold">Encomiendas pendientes</h2>
        </div>
        {(deliveries ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
            No hay paquetes pendientes en portería.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
            {(deliveries ?? []).map((d) => (
              <li
                key={d.id}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {d.courier_company || "Paquete"}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {d.package_details || formatDateTime(d.created_at)}
                  </p>
                </div>
                <Badge variant="warning">{d.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
