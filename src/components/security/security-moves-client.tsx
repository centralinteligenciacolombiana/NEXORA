"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Truck } from "lucide-react";
import { verifyMoveAtDoorAction } from "@/lib/actions/moves";
import {
  MOVE_TYPE_LABELS,
  MOVE_VERIFY_ACTION_LABELS,
  type MoveRequestType,
} from "@/lib/moves";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/background-panel";
import { formatDateTime } from "@/lib/utils";

export type SecurityMoveRow = {
  id: string;
  request_type: MoveRequestType;
  proposed_at: string;
  moving_company: string | null;
  notes: string | null;
  unitLabel: string;
  residentName: string;
  verified_at: string | null;
  verified_by_name: string | null;
};

export function SecurityMovesClient({ rows }: { rows: SecurityMoveRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function verify(id: string) {
    setError(null);
    setMessage(null);
    setBusyId(id);
    startTransition(async () => {
      const r = await verifyMoveAtDoorAction(id);
      setBusyId(null);
      if (r.error) {
        setError(r.error);
        return;
      }
      setMessage(r.message ?? "Verificado.");
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-12 text-center text-sm text-[var(--muted)]">
        No hay mudanzas aprobadas para hoy o próximas.
      </p>
    );
  }

  return (
    <div className="space-y-3">
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
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <GlassCard as="article" padding="md">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <Truck className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">
                      {MOVE_TYPE_LABELS[r.request_type]}
                    </p>
                    <Badge variant="success">Aprobada</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    {r.unitLabel} · {r.residentName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Programada: {formatDateTime(r.proposed_at)}
                  </p>
                  {r.moving_company ? (
                    <p className="mt-1 text-sm">{r.moving_company}</p>
                  ) : null}
                  {r.notes ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">{r.notes}</p>
                  ) : null}

                  {r.verified_at ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
                        <CheckCircle2 className="size-4" aria-hidden />
                        Verificada en portería
                      </p>
                      <p className="mt-0.5 text-xs text-emerald-800">
                        {formatDateTime(r.verified_at)}
                        {r.verified_by_name ? ` · ${r.verified_by_name}` : ""}
                      </p>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3 min-h-11 w-full"
                      disabled={pending && busyId === r.id}
                      onClick={() => verify(r.id)}
                    >
                      <CheckCircle2 className="size-3.5" aria-hidden />
                      {pending && busyId === r.id
                        ? "Registrando…"
                        : MOVE_VERIFY_ACTION_LABELS[r.request_type]}
                    </Button>
                  )}
                </div>
              </div>
            </GlassCard>
          </li>
        ))}
      </ul>
    </div>
  );
}
