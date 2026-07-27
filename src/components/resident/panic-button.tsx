"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Siren } from "lucide-react";
import {
  triggerPanicAlertAction,
  type EmergencyActionState,
} from "@/lib/actions/emergency";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PanicButton() {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    triggerPanicAlertAction,
    {} as EmergencyActionState,
  );

  useEffect(() => {
    if (state.success) {
      setConfirming(false);
    }
  }, [state.success]);

  if (state.success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-[var(--emerald-soft)] p-4 text-center sm:p-5">
        <CheckCircle2 className="mx-auto size-8 text-[var(--emerald)]" aria-hidden />
        <p className="mt-2 text-sm font-semibold text-emerald-900">
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 sm:p-5",
        confirming
          ? "border-red-300 bg-[var(--danger-soft)]"
          : "border-red-100 bg-[var(--surface)]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-[var(--danger)]">
          <Siren className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-[var(--foreground)]">
            Emergencia / Pánico
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Notifica de inmediato a portería y seguridad del conjunto.
          </p>
        </div>
      </div>

      {!confirming ? (
        <Button
          type="button"
          className="mt-4 w-full bg-[var(--danger)] hover:bg-red-700 focus:ring-red-500"
          size="lg"
          onClick={() => setConfirming(true)}
        >
          <AlertTriangle className="size-4" aria-hidden />
          Botón de pánico
        </Button>
      ) : (
        <form action={formAction} className="mt-4 space-y-3">
          <p className="rounded-xl bg-[var(--surface)]/85 px-3 py-2 text-center text-sm font-medium text-red-800">
            ¿Confirmas enviar la alerta a portería ahora?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[var(--danger)] hover:bg-red-700 focus:ring-red-500"
              disabled={pending}
            >
              {pending ? "Enviando…" : "Sí, enviar alerta"}
            </Button>
          </div>
        </form>
      )}

      {state.error && (
        <p className="mt-3 rounded-lg bg-[var(--surface)] px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
