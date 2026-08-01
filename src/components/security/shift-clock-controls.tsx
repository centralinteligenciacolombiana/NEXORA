"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Moon, Sun } from "lucide-react";
import {
  endOwnShiftAction,
  startOwnShiftAction,
  type ShiftType,
} from "@/lib/actions/shifts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ShiftClockControlsProps {
  activeShiftType: ShiftType | null;
  /** Solo SECURITY puede clock-in/out propio */
  canSelfManage: boolean;
}

export function ShiftClockControls({
  activeShiftType,
  canSelfManage,
}: ShiftClockControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!canSelfManage) {
    return null;
  }

  function run(
    action: () => Promise<{ error?: string; message?: string; success?: boolean }>,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Listo.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Tu turno</p>
          <p className="text-xs text-[var(--muted)]">
            Marca entrada/salida para el relevo
          </p>
        </div>
        {activeShiftType === "DAY" && (
          <Badge variant="warning">
            <Sun className="mr-1 size-3" aria-hidden />
            En turno · Día
          </Badge>
        )}
        {activeShiftType === "NIGHT" && (
          <Badge variant="muted">
            <Moon className="mr-1 size-3" aria-hidden />
            En turno · Noche
          </Badge>
        )}
        {!activeShiftType && <Badge variant="muted">Fuera de turno</Badge>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {!activeShiftType ? (
          <>
            <Button
              type="button"
              size="sm"
              className="min-h-11"
              disabled={pending}
              onClick={() => run(() => startOwnShiftAction("DAY"))}
            >
              <Sun className="size-3.5" aria-hidden />
              Entrar Día
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-11"
              disabled={pending}
              onClick={() => run(() => startOwnShiftAction("NIGHT"))}
            >
              <Moon className="size-3.5" aria-hidden />
              Entrar Noche
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="col-span-2 min-h-11 sm:col-span-3"
            disabled={pending}
            onClick={() => run(() => endOwnShiftAction())}
          >
            <LogOut className="size-3.5" aria-hidden />
            Finalizar turno
          </Button>
        )}
      </div>

      {!activeShiftType && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--muted)]">
          <LogIn className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          También el admin puede asignarte turno en Configuración → Seguridad.
        </p>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && !error && (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
    </div>
  );
}
