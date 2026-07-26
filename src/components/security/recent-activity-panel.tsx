import { Package, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export type RecentVisitorRow = {
  id: string;
  visitor_name: string;
  status: string;
  entry_time: string | null;
  created_at: string;
  unitLabel: string;
};

export type RecentDeliveryRow = {
  id: string;
  courier_company: string | null;
  package_details: string | null;
  status: string;
  created_at: string;
  unitLabel: string;
};

interface RecentActivityPanelProps {
  visitors: RecentVisitorRow[];
  deliveries: RecentDeliveryRow[];
}

export function RecentActivityPanel({
  visitors,
  deliveries,
}: RecentActivityPanelProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Ingresos del turno</h2>
        <p className="text-sm text-[var(--muted)]">
          Últimos visitantes y encomiendas registrados.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/80 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 border-b border-[var(--border)] bg-white/50 px-4 py-3">
            <Users className="size-4 text-[var(--brand)]" aria-hidden />
            <h3 className="font-semibold">Visitantes</h3>
          </div>
          {visitors.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              Sin ingresos de visitas aún.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {visitors.map((v) => (
                <li
                  key={v.id}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {v.visitor_name}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {v.unitLabel} ·{" "}
                      {formatDateTime(v.entry_time ?? v.created_at)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      v.status === "CHECKED_IN" ? "success" : "muted"
                    }
                  >
                    {v.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/80 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 border-b border-[var(--border)] bg-white/50 px-4 py-3">
            <Package className="size-4 text-[var(--emerald)]" aria-hidden />
            <h3 className="font-semibold">Encomiendas</h3>
          </div>
          {deliveries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              Sin encomiendas registradas aún.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {deliveries.map((d) => (
                <li
                  key={d.id}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {d.courier_company || "Paquete"}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {d.unitLabel} · {formatDateTime(d.created_at)}
                    </p>
                    {d.package_details && (
                      <p className="mt-0.5 truncate text-xs text-[var(--slate-500)]">
                        {d.package_details}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={d.status === "PENDING" ? "warning" : "muted"}
                  >
                    {d.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
