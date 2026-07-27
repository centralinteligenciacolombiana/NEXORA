"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type ResidentDelivery = {
  id: string;
  courier_company: string | null;
  package_details: string | null;
  status: string;
  verification_code: string | null;
  received_at: string | null;
  delivered_at: string | null;
  created_at: string;
  received_by_name?: string | null;
};

interface ResidentDeliveriesTabsProps {
  deliveries: ResidentDelivery[];
}

type TabKey = "pending" | "delivered";

export function ResidentDeliveriesTabs({
  deliveries,
}: ResidentDeliveriesTabsProps) {
  const [tab, setTab] = useState<TabKey>("pending");

  const pending = useMemo(
    () =>
      deliveries.filter(
        (d) => d.status === "PENDING" || d.status === "AT_RECEPTION",
      ),
    [deliveries],
  );

  const delivered = useMemo(
    () => deliveries.filter((d) => d.status === "DELIVERED"),
    [deliveries],
  );

  const list = tab === "pending" ? pending : delivered;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--slate-100)] p-1">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            tab === "pending"
              ? "bg-[var(--surface)] text-amber-800 shadow-sm"
              : "text-[var(--muted)]",
          )}
        >
          <Package className="size-4" aria-hidden />
          Pendientes ({pending.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("delivered")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            tab === "delivered"
              ? "bg-[var(--surface)] text-emerald-800 shadow-sm"
              : "text-[var(--muted)]",
          )}
        >
          <CheckCircle2 className="size-4" aria-hidden />
          Entregados ({delivered.length})
        </button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-12 text-center">
          <Truck className="mx-auto size-8 text-[var(--muted)]" aria-hidden />
          <p className="mt-3 text-sm text-[var(--muted)]">
            {tab === "pending"
              ? "No tienes paquetes pendientes por retirar."
              : "Aún no hay paquetes en el historial de entregados."}
          </p>
        </div>
      ) : tab === "pending" ? (
        <ul className="space-y-3">
          {list.map((d) => (
            <li
              key={d.id}
              className="rounded-2xl border border-amber-200/80 bg-amber-50/55 p-4 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-amber-50/45"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--surface)] text-amber-700">
                    <Package className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">
                      {d.courier_company || "Mensajería"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--muted)]">
                      <Clock className="size-3.5" aria-hidden />
                      {formatDateTime(d.received_at ?? d.created_at)}
                    </p>
                    {d.package_details && (
                      <p className="mt-1 text-sm text-[var(--slate-700)]">
                        {d.package_details}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="warning">PENDING</Badge>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200 bg-[var(--surface)] px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                  PIN / código de retiro
                </p>
                <p className="mt-1 font-mono text-3xl font-bold tracking-[0.35em] text-[var(--brand)]">
                  {d.verification_code ?? "————"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Muéstralo al vigilante en portería
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-white/50 bg-[var(--surface)]/90 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-[var(--surface)]/75">
          {list.map((d) => (
            <li key={d.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {d.courier_company || "Mensajería"}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Entregado:{" "}
                    {d.delivered_at
                      ? formatDateTime(d.delivered_at)
                      : "—"}
                  </p>
                  {d.received_by_name && (
                    <p className="mt-0.5 text-xs text-[var(--slate-500)]">
                      Recibido en portería por {d.received_by_name}
                    </p>
                  )}
                </div>
                <Badge variant="success">DELIVERED</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
