"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import {
  cancelMoveRequestAction,
  createMoveRequestAction,
  type MoveActionState,
} from "@/lib/actions/moves";
import {
  MOVE_STATUS_BADGE,
  MOVE_STATUS_LABELS,
  MOVE_TYPE_LABELS,
  type MoveRequestStatus,
  type MoveRequestType,
} from "@/lib/moves";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/background-panel";
import { formatDateTime } from "@/lib/utils";

export type ResidentMoveRow = {
  id: string;
  request_type: MoveRequestType;
  proposed_at: string;
  moving_company: string | null;
  notes: string | null;
  status: MoveRequestStatus;
  review_notes: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
};

export function ResidentMovesClient({
  requests,
}: {
  requests: ResidentMoveRow[];
}) {
  const [state, formAction, pending] = useActionState(
    createMoveRequestAction,
    {} as MoveActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [cancelPending, startCancel] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.success, router]);

  function onCancel(id: string) {
    if (!confirm("¿Cancelar esta solicitud?")) return;
    setError(null);
    startCancel(async () => {
      const r = await cancelMoveRequestAction(id);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <form
        ref={formRef}
        action={formAction}
        className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <h2 className="font-semibold">Nueva solicitud</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="requestType" className="text-sm font-medium">
            Tipo
          </label>
          <select
            id="requestType"
            name="requestType"
            required
            defaultValue="MOVE_IN"
            className="min-h-11 w-full rounded-lg border border-black/10 bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
          >
            <option value="MOVE_IN">{MOVE_TYPE_LABELS.MOVE_IN}</option>
            <option value="MOVE_OUT">{MOVE_TYPE_LABELS.MOVE_OUT}</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input name="date" label="Fecha" type="date" required />
          <Input name="time" label="Hora" type="time" required defaultValue="09:00" />
        </div>

        <Input
          name="movingCompany"
          label="Empresa de mudanzas (opcional)"
          maxLength={120}
          placeholder="Nombre de la empresa"
        />
        <Input
          name="notes"
          label="Detalles"
          maxLength={400}
          placeholder="Ascensor, torre, contacto…"
        />

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.success && state.message && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {state.message}
          </p>
        )}

        <Button type="submit" className="min-h-12 w-full" disabled={pending}>
          {pending ? "Enviando…" : "Solicitar autorización"}
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">Mis solicitudes</h2>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {requests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            No has solicitado mudanzas aún.
          </p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id}>
                <GlassCard as="article" padding="md">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {MOVE_TYPE_LABELS[r.request_type]}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatDateTime(r.proposed_at)}
                      </p>
                      {r.moving_company ? (
                        <p className="mt-1 text-xs">{r.moving_company}</p>
                      ) : null}
                      {r.notes ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">{r.notes}</p>
                      ) : null}
                      {r.review_notes ? (
                        <p className="mt-2 text-xs text-[var(--slate-700)]">
                          Respuesta: {r.review_notes}
                        </p>
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
                                Verificada en portería ·{" "}
                                {formatDateTime(r.verified_at)}
                                {r.verified_by_name
                                  ? ` · ${r.verified_by_name}`
                                  : ""}
                              </span>
                            </p>
                          ) : (
                            <Badge variant="warning">
                              Aprobada · pendiente en portería
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <Badge variant={MOVE_STATUS_BADGE[r.status]}>
                      {MOVE_STATUS_LABELS[r.status]}
                    </Badge>
                  </div>
                  {r.status === "PENDING" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-3 min-h-10 w-full text-red-700"
                      disabled={cancelPending}
                      onClick={() => onCancel(r.id)}
                    >
                      Cancelar solicitud
                    </Button>
                  )}
                </GlassCard>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
