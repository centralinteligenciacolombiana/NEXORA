"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelReservationAction,
  createReservationAction,
  type ReservationActionState,
} from "@/lib/actions/reservations";
import {
  RESERVATION_STATUS_BADGE,
  RESERVATION_STATUS_LABELS,
  type ReservationStatus,
} from "@/lib/reservations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/background-panel";
import { formatDateTime } from "@/lib/utils";

export type AmenityOption = {
  id: string;
  name: string;
  description: string | null;
  rules: string | null;
  capacity: number | null;
  available_from: string;
  available_to: string;
  requires_approval: boolean;
  max_hours: number | null;
};

export type ReservationRow = {
  id: string;
  start_time: string;
  end_time: string;
  status: ReservationStatus;
  notes: string | null;
  amenityName: string;
};

function sliceTime(t: string) {
  return String(t).slice(0, 5);
}

export function ResidentReservationsClient({
  amenities,
  reservations,
}: {
  amenities: AmenityOption[];
  reservations: ReservationRow[];
}) {
  const [state, formAction, pending] = useActionState(
    createReservationAction,
    {} as ReservationActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(amenities[0]?.id ?? "");
  const [cancelPending, startCancel] = useTransition();
  const [cancelError, setCancelError] = useState<string | null>(null);

  const selected = amenities.find((a) => a.id === selectedId) ?? amenities[0];

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.success, router]);

  function onCancel(id: string) {
    if (!confirm("¿Cancelar esta reserva?")) return;
    setCancelError(null);
    startCancel(async () => {
      const result = await cancelReservationAction(id);
      if (result.error) {
        setCancelError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {amenities.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          El administrador aún no configuró zonas comunes reservables.
        </p>
      ) : (
        <form
          ref={formRef}
          action={formAction}
          className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <h2 className="font-semibold">Nueva reserva</h2>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="amenityId" className="text-sm font-medium">
              Zona común
            </label>
            <select
              id="amenityId"
              name="amenityId"
              required
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-black/10 bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
            >
              {amenities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.requires_approval ? " · requiere aprobación" : ""}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="rounded-xl bg-[var(--slate-100)] px-3 py-2 text-xs text-[var(--muted)]">
              <p>
                Disponible {sliceTime(selected.available_from)}–
                {sliceTime(selected.available_to)}
                {selected.capacity ? ` · cupo ${selected.capacity}` : ""}
                {selected.max_hours ? ` · máx. ${selected.max_hours}h` : ""}
              </p>
              {selected.description ? <p className="mt-1">{selected.description}</p> : null}
              {selected.rules ? (
                <p className="mt-1 font-medium text-[var(--foreground)]">
                  Reglas: {selected.rules}
                </p>
              ) : null}
            </div>
          )}

          <Input name="date" label="Fecha" type="date" required />
          <div className="grid grid-cols-2 gap-2">
            <Input
              name="startTime"
              label="Desde"
              type="time"
              required
              defaultValue={selected ? sliceTime(selected.available_from) : "08:00"}
            />
            <Input
              name="endTime"
              label="Hasta"
              type="time"
              required
              defaultValue={
                selected
                  ? sliceTime(selected.available_to)
                  : "10:00"
              }
            />
          </div>
          <Input name="notes" label="Notas (opcional)" maxLength={200} />

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
            {pending ? "Reservando…" : "Solicitar reserva"}
          </Button>
        </form>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Mis reservas</h2>
        {cancelError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {cancelError}
          </p>
        )}
        {reservations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            Aún no tienes reservas.
          </p>
        ) : (
          <ul className="space-y-3">
            {reservations.map((r) => (
              <li key={r.id}>
                <GlassCard as="article" padding="md">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{r.amenityName}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatDateTime(r.start_time)} →{" "}
                        {formatDateTime(r.end_time)}
                      </p>
                      {r.notes ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">{r.notes}</p>
                      ) : null}
                    </div>
                    <Badge variant={RESERVATION_STATUS_BADGE[r.status]}>
                      {RESERVATION_STATUS_LABELS[r.status]}
                    </Badge>
                  </div>
                  {(r.status === "PENDING" || r.status === "CONFIRMED") && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-3 min-h-10 w-full text-red-700"
                      disabled={cancelPending}
                      onClick={() => onCancel(r.id)}
                    >
                      Cancelar
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
