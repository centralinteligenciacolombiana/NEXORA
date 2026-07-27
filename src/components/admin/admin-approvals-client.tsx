"use client";

import { useTransition } from "react";
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

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-12 text-center text-sm text-[var(--muted)]">
        No hay registros pendientes de confirmación.
      </p>
    );
  }

  return (
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

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await approveRegistrationAction(row.id);
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
                  onClick={() =>
                    startTransition(async () => {
                      if (
                        !window.confirm(
                          "¿Rechazar este registro? No tendrá acceso al conjunto.",
                        )
                      ) {
                        return;
                      }
                      await rejectRegistrationAction(row.id);
                    })
                  }
                >
                  <XCircle className="size-3.5" aria-hidden />
                  Rechazar
                </Button>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

