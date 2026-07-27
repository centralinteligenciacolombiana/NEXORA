"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, UserRound } from "lucide-react";
import {
  assignGuardShiftAction,
  setEnableShiftLogbookAction,
  type ShiftType,
} from "@/lib/actions/shifts";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SecurityGuardRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  activeShiftType: ShiftType | null;
};

interface AdminSecuritySettingsClientProps {
  enableShiftLogbook: boolean;
  guards: SecurityGuardRow[];
}

export function AdminSecuritySettingsClient({
  enableShiftLogbook: initialEnabled,
  guards,
}: AdminSecuritySettingsClientProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled]);

  function onToggle(next: boolean) {
    setEnabled(next);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await setEnableShiftLogbookAction(next);
      if (result.error) {
        setEnabled(!next);
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Guardado.");
      router.refresh();
    });
  }

  function onAssign(guardId: string, shiftType: ShiftType | null) {
    setAssigningId(guardId);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await assignGuardShiftAction({ guardId, shiftType });
      setAssigningId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Turno actualizado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
        <Switch
          id="enable-shift-logbook"
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={pending}
          label="Bitácora digital de relevos"
          description="Permite a portería registrar novedades y fotos al entregar el turno."
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Asignación de turnos</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Define quién está de Día o Noche. Los residentes verán solo turnos
            activos.
          </p>
        </div>

        {guards.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            No hay usuarios con rol SECURITY. Invita personal desde Invitaciones.
          </p>
        ) : (
          <ul className="space-y-3">
            {guards.map((g) => (
              <li
                key={g.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  {g.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.avatar_url}
                      alt=""
                      className="size-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-12 items-center justify-center rounded-full bg-[var(--slate-100)] text-[var(--muted)]">
                      <UserRound className="size-5" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {g.full_name || "Sin nombre"}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {g.email}
                    </p>
                    <div className="mt-1.5">
                      {g.activeShiftType === "DAY" && (
                        <Badge variant="warning">
                          <Sun className="mr-1 size-3" aria-hidden />
                          Turno Día
                        </Badge>
                      )}
                      {g.activeShiftType === "NIGHT" && (
                        <Badge variant="muted">
                          <Moon className="mr-1 size-3" aria-hidden />
                          Turno Noche
                        </Badge>
                      )}
                      {!g.activeShiftType && (
                        <Badge variant="muted">Sin turno</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      g.activeShiftType === "DAY" ? "primary" : "secondary"
                    }
                    className={cn(
                      "min-h-10",
                      g.activeShiftType === "DAY" && "ring-2 ring-[var(--brand)]/20",
                    )}
                    disabled={pending && assigningId === g.id}
                    onClick={() => onAssign(g.id, "DAY")}
                  >
                    <Sun className="size-3.5" aria-hidden />
                    Día
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      g.activeShiftType === "NIGHT" ? "primary" : "secondary"
                    }
                    className="min-h-10"
                    disabled={pending && assigningId === g.id}
                    onClick={() => onAssign(g.id, "NIGHT")}
                  >
                    <Moon className="size-3.5" aria-hidden />
                    Noche
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-10"
                    disabled={
                      !g.activeShiftType || (pending && assigningId === g.id)
                    }
                    onClick={() => onAssign(g.id, null)}
                  >
                    Liberar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && !error && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
    </div>
  );
}
