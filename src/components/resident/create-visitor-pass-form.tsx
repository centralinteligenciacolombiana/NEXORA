"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import {
  createVisitorPassAction,
  type VisitorActionState,
} from "@/lib/actions/visitors";
import { OPEN_ACCESS_DAY_OPTIONS } from "@/lib/visitors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { VisitorAccessType } from "@/types";

export function CreateVisitorPassForm() {
  const router = useRouter();
  const [accessType, setAccessType] = useState<VisitorAccessType>("TODAY");
  const [state, formAction, pending] = useActionState(
    createVisitorPassAction,
    {} as VisitorActionState,
  );

  useEffect(() => {
    if (state.success && state.visitorId) {
      router.push(`/dashboard/resident/visits/${state.visitorId}`);
      router.refresh();
    }
  }, [state.success, state.visitorId, router]);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-center gap-2">
        <UserPlus className="size-4 text-[var(--brand)]" aria-hidden />
        <h2 className="font-semibold">Registrar visitante</h2>
      </div>
      <p className="text-sm text-[var(--muted)]">
        Autoriza el ingreso y genera un QR con vigencia. Cuando venza, debes
        renovarlo.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          name="firstName"
          label="Nombre"
          required
          maxLength={60}
          autoComplete="off"
          placeholder="María"
        />
        <Input
          name="lastName"
          label="Apellido"
          required
          maxLength={60}
          autoComplete="off"
          placeholder="Pérez"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tipo de acceso</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-3 has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand-soft)]">
          <input
            type="radio"
            name="accessType"
            value="TODAY"
            checked={accessType === "TODAY"}
            onChange={() => setAccessType("TODAY")}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium">Solo hoy</span>
            <span className="text-xs text-[var(--muted)]">
              Válido hasta las 11:59 p. m. (hora Colombia).
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-3 has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand-soft)]">
          <input
            type="radio"
            name="accessType"
            value="OPEN"
            checked={accessType === "OPEN"}
            onChange={() => setAccessType("OPEN")}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium">Acceso libre</span>
            <span className="text-xs text-[var(--muted)]">
              Puede entrar cualquier día y hora dentro del periodo que
              autorices.
            </span>
          </span>
        </label>
      </fieldset>

      {accessType === "OPEN" && (
        <Select name="openDays" label="Duración de la autorización" defaultValue="7">
          {OPEN_ACCESS_DAY_OPTIONS.map((days) => (
            <option key={days} value={days}>
              {days} días
            </option>
          ))}
        </Select>
      )}

      <Input
        name="notes"
        label="Nota (opcional)"
        maxLength={200}
        placeholder="Ej. familiar, proveedor, cita…"
      />

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Autorizando…" : "Autorizar y generar QR"}
      </Button>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
