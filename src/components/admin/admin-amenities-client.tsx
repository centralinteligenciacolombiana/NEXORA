"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteAmenityAction,
  setReservationStatusAction,
  upsertAmenityAction,
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

export type AdminAmenityRow = {
  id: string;
  name: string;
  description: string | null;
  rules: string | null;
  capacity: number | null;
  available_from: string;
  available_to: string;
  requires_approval: boolean;
  is_active: boolean;
  max_hours: number | null;
};

export type AdminReservationRow = {
  id: string;
  start_time: string;
  end_time: string;
  status: ReservationStatus;
  notes: string | null;
  amenityName: string;
  unitLabel: string;
  residentName: string;
};

function sliceTime(t: string) {
  return String(t).slice(0, 5);
}

export function AdminAmenitiesClient({
  amenities,
  pendingReservations,
}: {
  amenities: AdminAmenityRow[];
  pendingReservations: AdminReservationRow[];
}) {
  const [state, formAction, pending] = useActionState(
    upsertAmenityAction,
    {} as ReservationActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [editing, setEditing] = useState<AdminAmenityRow | null>(null);
  const [actionPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setEditing(null);
      router.refresh();
    }
  }, [state.success, router]);

  function onDelete(id: string) {
    if (!confirm("¿Eliminar esta zona común?")) return;
    setErr(null);
    startTransition(async () => {
      const r = await deleteAmenityAction(id);
      if (r.error) setErr(r.error);
      else {
        setMsg(r.message ?? "Eliminada.");
        router.refresh();
      }
    });
  }

  function onStatus(id: string, status: "CONFIRMED" | "REJECTED") {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const r = await setReservationStatusAction({ reservationId: id, status });
      if (r.error) setErr(r.error);
      else {
        setMsg(r.message ?? "OK");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {pendingReservations.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Reservas por aprobar</h2>
          <ul className="space-y-3">
            {pendingReservations.map((r) => (
              <li key={r.id}>
                <GlassCard as="article" padding="md">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{r.amenityName}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {r.unitLabel} · {r.residentName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatDateTime(r.start_time)} →{" "}
                        {formatDateTime(r.end_time)}
                      </p>
                    </div>
                    <Badge variant={RESERVATION_STATUS_BADGE[r.status]}>
                      {RESERVATION_STATUS_LABELS[r.status]}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-10"
                      disabled={actionPending}
                      onClick={() => onStatus(r.id, "CONFIRMED")}
                    >
                      Aprobar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-10 text-red-700"
                      disabled={actionPending}
                      onClick={() => onStatus(r.id, "REJECTED")}
                    >
                      Rechazar
                    </Button>
                  </div>
                </GlassCard>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form
        ref={formRef}
        action={formAction}
        className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <h2 className="font-semibold">
          {editing ? "Editar zona común" : "Nueva zona común"}
        </h2>
        {editing ? (
          <input type="hidden" name="amenityId" value={editing.id} />
        ) : null}

        <Input
          name="name"
          label="Nombre"
          required
          defaultValue={editing?.name ?? ""}
          placeholder="Salón social, Piscina…"
        />
        <Input
          name="description"
          label="Descripción"
          defaultValue={editing?.description ?? ""}
        />
        <Input
          name="rules"
          label="Reglas básicas"
          defaultValue={editing?.rules ?? ""}
          placeholder="No ruido después de 10pm…"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            name="availableFrom"
            label="Desde"
            type="time"
            required
            defaultValue={
              editing ? sliceTime(editing.available_from) : "08:00"
            }
          />
          <Input
            name="availableTo"
            label="Hasta"
            type="time"
            required
            defaultValue={editing ? sliceTime(editing.available_to) : "22:00"}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            name="capacity"
            label="Capacidad"
            type="number"
            min={1}
            defaultValue={editing?.capacity?.toString() ?? ""}
          />
          <Input
            name="maxHours"
            label="Máx. horas"
            type="number"
            step="0.5"
            min={0.5}
            defaultValue={editing?.max_hours?.toString() ?? ""}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requiresApproval"
            defaultChecked={editing?.requires_approval ?? false}
            className="size-4 rounded border-black/20"
          />
          Requiere aprobación del administrador
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={editing?.is_active ?? true}
            className="size-4 rounded border-black/20"
          />
          Activa
        </label>

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

        <div className="flex gap-2">
          {editing && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 flex-1"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </Button>
          )}
          <Button type="submit" className="min-h-11 flex-1" disabled={pending}>
            {pending ? "Guardando…" : editing ? "Guardar" : "Crear zona"}
          </Button>
        </div>
      </form>

      {(err || msg) && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            err ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {err ?? msg}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Zonas configuradas</h2>
        {amenities.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Ninguna aún.</p>
        ) : (
          <ul className="space-y-3">
            {amenities.map((a) => (
              <li key={a.id}>
                <GlassCard as="article" padding="md">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{a.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {sliceTime(a.available_from)}–{sliceTime(a.available_to)}
                        {a.requires_approval ? " · aprobación" : " · auto"}
                        {!a.is_active ? " · inactiva" : ""}
                      </p>
                    </div>
                    <Badge variant={a.is_active ? "success" : "muted"}>
                      {a.is_active ? "Activa" : "Off"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="min-h-10"
                      onClick={() => setEditing(a)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-10 text-red-700"
                      disabled={actionPending}
                      onClick={() => onDelete(a.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </GlassCard>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
