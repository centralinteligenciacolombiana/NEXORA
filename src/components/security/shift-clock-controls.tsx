"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun } from "lucide-react";
import {
  endOwnShiftWithReportAction,
  startOwnShiftAction,
  type ShiftActionState,
  type ShiftType,
} from "@/lib/actions/shifts";
import {
  SECURITY_POST_LABELS,
  type SecurityPost,
} from "@/lib/security";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ShiftClockControlsProps {
  activeShiftType: ShiftType | null;
  activePost?: SecurityPost | null;
  preferredPost?: SecurityPost | null;
  canSelfManage: boolean;
}

export function ShiftClockControls({
  activeShiftType,
  activePost = null,
  preferredPost = null,
  canSelfManage,
}: ShiftClockControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [post, setPost] = useState<SecurityPost | "">(
    preferredPost ?? activePost ?? "",
  );

  const [reportState, reportAction, reportPending] = useActionState(
    endOwnShiftWithReportAction,
    {} as ShiftActionState,
  );

  if (!canSelfManage) {
    return null;
  }

  function start(shiftType: ShiftType) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await startOwnShiftAction(
        shiftType,
        post === "" ? null : post,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Listo.");
      router.refresh();
    });
  }

  if (reportState.success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        {reportState.message}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Tu turno</p>
          <p className="text-xs text-[var(--muted)]">
            Marca entrada/salida y deja el reporte de cierre
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

      {activePost || preferredPost ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Puesto:{" "}
          {SECURITY_POST_LABELS[(activePost ?? preferredPost)!]}
        </p>
      ) : null}

      {!activeShiftType ? (
        <>
          <div className="mt-3">
            <label htmlFor="postStart" className="text-sm font-medium">
              Puesto de este turno
            </label>
            <select
              id="postStart"
              value={post}
              onChange={(e) =>
                setPost(e.target.value as SecurityPost | "")
              }
              className="mt-1.5 min-h-11 w-full rounded-lg border border-black/10 bg-[var(--surface)] px-3 text-sm"
            >
              <option value="">Sin indicar</option>
              <option value="LOBBY">{SECURITY_POST_LABELS.LOBBY}</option>
              <option value="PATROL">{SECURITY_POST_LABELS.PATROL}</option>
              <option value="MIXED">{SECURITY_POST_LABELS.MIXED}</option>
            </select>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              className="min-h-11"
              disabled={pending}
              onClick={() => start("DAY")}
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
              onClick={() => start("NIGHT")}
            >
              <Moon className="size-3.5" aria-hidden />
              Entrar Noche
            </Button>
          </div>
        </>
      ) : !closing ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-3 min-h-11 w-full"
          onClick={() => setClosing(true)}
        >
          <LogOut className="size-3.5" aria-hidden />
          Cerrar turno con reporte
        </Button>
      ) : (
        <form action={reportAction} className="mt-3 space-y-3">
          <div>
            <label htmlFor="postAssignment" className="text-sm font-medium">
              Puesto cubierto
            </label>
            <select
              id="postAssignment"
              name="postAssignment"
              defaultValue={activePost ?? preferredPost ?? ""}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-black/10 bg-[var(--surface)] px-3 text-sm"
            >
              <option value="">Sin indicar</option>
              <option value="LOBBY">{SECURITY_POST_LABELS.LOBBY}</option>
              <option value="PATROL">{SECURITY_POST_LABELS.PATROL}</option>
              <option value="MIXED">{SECURITY_POST_LABELS.MIXED}</option>
            </select>
          </div>
          <div>
            <label htmlFor="summary" className="text-sm font-medium">
              Resumen del turno *
            </label>
            <textarea
              id="summary"
              name="summary"
              required
              rows={3}
              minLength={10}
              placeholder="Qué ocurrió en el turno, estado del conjunto, llaves, cámaras…"
              className="mt-1.5 w-full rounded-lg border border-black/10 bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
            />
          </div>
          <div>
            <label htmlFor="incidents" className="text-sm font-medium">
              Novedades / incidentes
            </label>
            <textarea
              id="incidents"
              name="incidents"
              rows={3}
              placeholder="Visitantes, paquetes, alarmas, pendientes para el relevo…"
              className="mt-1.5 w-full rounded-lg border border-black/10 bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
            />
          </div>
          {(reportState.error || error) && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {reportState.error ?? error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => setClosing(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={reportPending}>
              {reportPending ? "Guardando…" : "Cerrar y reportar"}
            </Button>
          </div>
        </form>
      )}

      {error && !closing && (
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
