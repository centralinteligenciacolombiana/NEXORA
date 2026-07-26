"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Search, X } from "lucide-react";
import {
  markUtilityBillPickedUpAction,
  registerUtilityBillAction,
  type FinanceActionState,
} from "@/lib/actions/finances";
import {
  UTILITY_SERVICE_LABELS,
  type UtilityServiceType,
} from "@/lib/community";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";

export type SecurityUnitOption = {
  id: string;
  number: string;
  tower?: string | null;
};

export type PendingUtilityBill = {
  id: string;
  service_type: string;
  period_name: string | null;
  received_at: string;
  unitLabel: string;
  unitNumber: string;
  unitTower: string | null;
};

interface SecurityUtilitiesClientProps {
  units: SecurityUnitOption[];
  pendingBills: PendingUtilityBill[];
}

function unitOptionLabel(unit: SecurityUnitOption) {
  return [unit.tower, `Apto ${unit.number}`].filter(Boolean).join(" · ");
}

function DeliverBillModal({
  bill,
  onClose,
}: {
  bill: PendingUtilityBill;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    markUtilityBillPickedUpAction,
    {} as FinanceActionState,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Entregar recibo</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {bill.unitLabel} ·{" "}
              {UTILITY_SERVICE_LABELS[bill.service_type as UtilityServiceType] ??
                bill.service_type}
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
            <input type="hidden" name="billId" value={bill.id} />
            <Input
              name="pin"
              label="PIN de 4 dígitos"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              required
              placeholder="••••"
              className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
            />
            {state.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Confirmando…" : "Confirmar"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function SecurityUtilitiesClient({
  units,
  pendingBills,
}: SecurityUtilitiesClientProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [regState, regAction, registering] = useActionState(
    registerUtilityBillAction,
    {} as FinanceActionState,
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PendingUtilityBill | null>(null);

  useEffect(() => {
    if (regState.success) formRef.current?.reset();
  }, [regState.success]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pendingBills;
    return pendingBills.filter((b) => {
      const hay = `${b.unitNumber} ${b.unitTower ?? ""} ${b.unitLabel} ${b.service_type}`.toLowerCase();
      return hay.includes(q);
    });
  }, [pendingBills, query]);

  return (
    <div className="space-y-6">
      <form
        ref={formRef}
        action={regAction}
        className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-[var(--brand)]" aria-hidden />
          <h2 className="font-semibold">Registrar recibo llegado</h2>
        </div>

        <Select name="unitId" label="Unidad" required defaultValue="" className="h-12">
          <option value="" disabled>
            Selecciona apartamento
          </option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {unitOptionLabel(u)}
            </option>
          ))}
        </Select>

        <Select
          name="serviceType"
          label="Tipo de servicio"
          required
          defaultValue="WATER"
          className="h-12"
        >
          {(Object.keys(UTILITY_SERVICE_LABELS) as UtilityServiceType[]).map(
            (key) => (
              <option key={key} value={key}>
                {UTILITY_SERVICE_LABELS[key]}
              </option>
            ),
          )}
        </Select>

        <Input
          name="periodName"
          label="Periodo (opcional)"
          placeholder="Julio 2026"
        />

        {regState.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {regState.error}
          </p>
        )}
        {regState.success && regState.message && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {regState.message}
          </p>
        )}

        <Button type="submit" size="lg" className="min-h-12 w-full" disabled={registering}>
          {registering ? "Guardando…" : "Registrar y notificar"}
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">Pendientes por entregar</h2>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por apto…"
            className="h-12 w-full rounded-xl border border-[var(--border)] bg-white py-2 pl-10 pr-3 text-base outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
            No hay recibos pendientes.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((b) => (
              <li
                key={b.id}
                className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{b.unitLabel}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {UTILITY_SERVICE_LABELS[
                        b.service_type as UtilityServiceType
                      ] ?? b.service_type}
                      {b.period_name ? ` · ${b.period_name}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--slate-500)]">
                      {formatDateTime(b.received_at)}
                    </p>
                  </div>
                  <Badge variant="warning">PENDING</Badge>
                </div>
                <Button
                  type="button"
                  className="mt-3 min-h-12 w-full"
                  onClick={() => setSelected(b)}
                >
                  Entregar con PIN
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <DeliverBillModal
          key={selected.id}
          bill={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
