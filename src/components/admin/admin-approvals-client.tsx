"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, UserRound } from "lucide-react";
import {
  approveRegistrationAction,
  rejectRegistrationAction,
} from "@/lib/actions/invites";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type PendingRegistrationRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  unitLabel: string;
  occupancyLabel: string;
  roleLabel: string;
  loginCode: string | null;
  createdAt: string;
};

export function AdminApprovalsClient({
  rows,
}: {
  rows: PendingRegistrationRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-12 text-center text-sm text-[var(--muted)]">
        No hay registros pendientes de confirmación.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {feedback ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                <UserRound className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{row.fullName}</p>
                  <Badge variant="warning">Pendiente</Badge>
                  <Badge variant="muted">{row.roleLabel}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-[var(--muted)]">{row.email}</p>
                <dl className="mt-3 grid gap-1 text-sm text-[var(--slate-700)] sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Unidad</dt>
                    <dd className="font-medium">{row.unitLabel}</dd>
                  </div>
                  {row.roleLabel === "Residente" ? (
                    <div>
                      <dt className="text-xs text-[var(--muted)]">Ocupación</dt>
                      <dd className="font-medium">{row.occupancyLabel}</dd>
                    </div>
                  ) : (
                    <div>
                      <dt className="text-xs text-[var(--muted)]">Rol</dt>
                      <dd className="font-medium">{row.roleLabel}</dd>
                    </div>
                  )}
                  {row.loginCode && (
                    <div>
                      <dt className="text-xs text-[var(--muted)]">Usuario</dt>
                      <dd className="font-mono text-sm font-medium">
                        {row.loginCode}
                      </dd>
                    </div>
                  )}
                  {row.phone && (
                    <div>
                      <dt className="text-xs text-[var(--muted)]">Teléfono</dt>
                      <dd className="font-medium">{row.phone}</dd>
                    </div>
                  )}
                </dl>

                {rejectingId === row.id ? (
                  <div className="mt-4 space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
                    <label className="block text-sm font-medium text-red-900">
                      Motivo del rechazo (obligatorio)
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        maxLength={500}
                        className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-red-400"
                        placeholder="Ej. No figura en el padrón de residentes / documento no válido"
                      />
                    </label>
                    <p className="text-xs text-red-800/80">
                      Se enviará el motivo por correo, se borrará su cuenta y no
                      quedará registro en la base de datos del conjunto.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            setFeedback(null);
                            setError(null);
                            const result = await rejectRegistrationAction(
                              row.id,
                              reason,
                            );
                            if (result.error) {
                              setError(result.error);
                              return;
                            }
                            setFeedback(result.message ?? "Registro anulado.");
                            setRejectingId(null);
                            setReason("");
                          })
                        }
                      >
                        Confirmar anulación
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          setRejectingId(null);
                          setReason("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          setFeedback(null);
                          setError(null);
                          const result = await approveRegistrationAction(row.id);
                          if (result.error) {
                            setError(result.error);
                            return;
                          }
                          setFeedback(result.message ?? "Confirmado.");
                        })
                      }
                    >
                      <CheckCircle2 className="size-3.5" aria-hidden />
                      Confirmar: sí pertenece
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => {
                        setRejectingId(row.id);
                        setReason("");
                        setError(null);
                      }}
                    >
                      <XCircle className="size-3.5" aria-hidden />
                      Rechazar y borrar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
