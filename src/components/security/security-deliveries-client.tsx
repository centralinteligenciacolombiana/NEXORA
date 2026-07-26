"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Package, Search, X } from "lucide-react";
import {
  markDeliveryDeliveredAction,
  type DeliveryActionState,
} from "@/lib/actions/deliveries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";

export type SecurityPendingDelivery = {
  id: string;
  courier_company: string | null;
  package_details: string | null;
  verification_code: string | null;
  received_at: string | null;
  created_at: string;
  unit_id: string;
  unitLabel: string;
  unitNumber: string;
  unitTower: string | null;
};

interface SecurityDeliveriesClientProps {
  deliveries: SecurityPendingDelivery[];
}

function DeliverConfirmModal({
  delivery,
  onClose,
}: {
  delivery: SecurityPendingDelivery;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    markDeliveryDeliveredAction,
    {} as DeliveryActionState,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deliver-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="deliver-modal-title" className="text-lg font-semibold">
              Confirmar entrega
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {delivery.unitLabel} · {delivery.courier_company}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--slate-100)]"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        {state.success ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-[var(--emerald-soft)] p-4 text-center">
            <CheckCircle2 className="mx-auto size-8 text-[var(--emerald)]" />
            <p className="mt-2 text-sm font-semibold text-emerald-900">
              {state.message}
            </p>
            <Button
              type="button"
              className="mt-4 w-full"
              onClick={() => {
                onClose();
                router.refresh();
              }}
            >
              Listo
            </Button>
          </div>
        ) : (
          <form action={formAction} className="mt-5 space-y-4">
            <input type="hidden" name="deliveryId" value={delivery.id} />
            <Input
              name="pin"
              label="PIN de 4 dígitos del residente"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              required
              placeholder="••••"
              className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
              autoComplete="one-time-code"
            />
            {state.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="min-h-12"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="lg"
                className="min-h-12"
                disabled={pending}
              >
                {pending ? "Confirmando…" : "Confirmar"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function SecurityDeliveriesClient({
  deliveries,
}: SecurityDeliveriesClientProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SecurityPendingDelivery | null>(
    null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return deliveries;
    return deliveries.filter((d) => {
      const hay =
        `${d.unitNumber} ${d.unitTower ?? ""} ${d.unitLabel} ${d.courier_company ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [deliveries, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por apto, torre o mensajería…"
          className="h-12 w-full rounded-xl border border-[var(--border)] bg-white py-2 pl-10 pr-3 text-base outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-white px-4 py-10 text-center text-sm text-[var(--muted)]">
          No hay paquetes pendientes
          {query ? " para esa búsqueda" : ""}.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((d) => (
            <li
              key={d.id}
              className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <Package className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold">{d.unitLabel}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {d.courier_company || "Mensajería"}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--slate-500)]">
                      Recibido {formatDateTime(d.received_at ?? d.created_at)}
                    </p>
                  </div>
                </div>
                <Badge variant="warning">PENDING</Badge>
              </div>
              <Button
                type="button"
                size="lg"
                className="mt-4 min-h-12 w-full"
                onClick={() => setSelected(d)}
              >
                Marcar como entregado
              </Button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <DeliverConfirmModal
          key={selected.id}
          delivery={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
