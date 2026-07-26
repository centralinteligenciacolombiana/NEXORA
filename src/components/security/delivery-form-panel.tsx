"use client";

import { useActionState, useEffect, useRef } from "react";
import { Package } from "lucide-react";
import {
  registerDeliveryAction,
  type SecurityActionState,
} from "@/lib/actions/security";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type SecurityUnitOption = {
  id: string;
  number: string;
  tower?: string | null;
};

interface DeliveryFormPanelProps {
  units: SecurityUnitOption[];
}

function unitLabel(unit: SecurityUnitOption) {
  return [unit.tower, `Apto ${unit.number}`].filter(Boolean).join(" · ");
}

export function DeliveryFormPanel({ units }: DeliveryFormPanelProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    registerDeliveryAction,
    {} as SecurityActionState,
  );

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <section className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--emerald-soft)] text-[var(--emerald)]">
          <Package className="size-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Recepción de encomiendas</h2>
          <p className="text-sm text-[var(--muted)]">
            Registra paquetes llegados a portería.
          </p>
        </div>
      </div>

      <form ref={formRef} action={formAction} className="mt-4 space-y-3">
        <Select
          name="unitId"
          label="Unidad"
          required
          defaultValue=""
          className="h-12 text-base"
        >
          <option value="" disabled>
            Selecciona apartamento
          </option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unitLabel(unit)}
            </option>
          ))}
        </Select>

        <Input
          name="courierCompany"
          label="Empresa de mensajería"
          required
          placeholder="Servientrega, MercadoLibre, Inter Rapidísimo…"
          className="h-12 text-base"
          list="courier-suggestions"
        />
        <datalist id="courier-suggestions">
          <option value="Servientrega" />
          <option value="Inter Rapidísimo" />
          <option value="Coordinadora" />
          <option value="MercadoLibre" />
          <option value="Amazon" />
          <option value="Rappi" />
          <option value="Otro" />
        </datalist>

        <Input
          name="packageDetails"
          label="Detalle (opcional)"
          placeholder="Caja mediana, sobre, etc."
          className="h-12 text-base"
        />

        <Button
          type="submit"
          size="lg"
          className="min-h-12 w-full"
          disabled={pending || units.length === 0}
        >
          {pending ? "Registrando…" : "Registrar encomienda PENDING"}
        </Button>
      </form>

      {units.length === 0 && (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No hay unidades cargadas en este conjunto.
        </p>
      )}

      {state.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      {state.success && state.message && (
        <p className="mt-3 rounded-lg bg-[var(--emerald-soft)] px-3 py-2 text-sm font-medium text-emerald-900">
          {state.message}
        </p>
      )}
    </section>
  );
}
