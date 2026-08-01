"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Truck, XCircle } from "lucide-react";
import { reviewMoveRequestAction } from "@/lib/actions/moves";
import {
  MOVE_STATUS_BADGE,
  MOVE_STATUS_LABELS,
  MOVE_TYPE_LABELS,
  type MoveRequestStatus,
  type MoveRequestType,
} from "@/lib/moves";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/background-panel";
import { formatDateTime } from "@/lib/utils";

export type AdminMoveRow = {
  id: string;
  request_type: MoveRequestType;
  proposed_at: string;
  moving_company: string | null;
  notes: string | null;
  status: MoveRequestStatus;
  unitLabel: string;
  residentName: string;
  review_notes: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
};

export function AdminMovesClient({ rows }: { rows: AdminMoveRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function review(id: string, status: "APPROVED" | "REJECTED") {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const r = await reviewMoveRequestAction({ requestId: id, status });
      if (r.error) {
        setError(r.error);
        return;
      }
      setMessage(r.message ?? "OK");
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-12 text-center text-sm text-[var(--muted)]">
        No hay solicitudes de mudanza.
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
                    <Badge variant={MOVE_STATUS_BADGE[r.status]}>
                      {MOVE_STATUS_LABELS[r.status]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    {r.unitLabel} · {r.residentName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {formatDateTime(r.proposed_at)}
                  </p>
                  {r.moving_company ? (
                    <p className="mt-1 text-sm">{r.moving_company}</p>
                  ) : null}
                  {r.notes ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">{r.notes}</p>
                  ) : null}
                  {r.review_notes ? (
                    <p className="mt-2 text-xs">Nota: {r.review_notes}</p>
                  ) : null}

                  {r.status === "APPROVED" && (
                    <div className="mt-2">
                      {r.verified_at ? (
                        <p className="flex items-start gap-1.5 text-xs text-emerald-800">
                          <CheckCircle2
                            className="mt-0.5 size-3.5 shrink-0"
                            aria-hidden
                          />
                          <span>
                            Verificada en portería · {formatDateTime(r.verified_at)}
                            {r.verified_by_name
                              ? ` · ${r.verified_by_name}`
                              : ""}
                          </span>
                        </p>
                      ) : (
                        <Badge variant="warning">Pendiente de verificación</Badge>
                      )}
                    </div>
                  )}

                  {r.status === "PENDING" && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-10"
                        disabled={pending}
                        onClick={() => review(r.id, "APPROVED")}
                      >
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        Aprobar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-10 text-red-700"
                        disabled={pending}
                        onClick={() => review(r.id, "REJECTED")}
                      >
                        <XCircle className="size-3.5" aria-hidden />
                        Rechazar
                      </Button>
                    </div>
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
