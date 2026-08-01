"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Car, Bike, Pencil, Trash2, Camera } from "lucide-react";
import {
  createAuthorizedVehicleAction,
  deleteAuthorizedVehicleAction,
  updateAuthorizedVehicleAction,
  type VehicleActionState,
} from "@/lib/actions/vehicles";
import {
  VEHICLE_TYPE_LABELS,
  type VehicleType,
} from "@/lib/vehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/background-panel";

export type ResidentVehicleRow = {
  id: string;
  plate: string;
  vehicle_type: VehicleType;
  color: string | null;
  photo_url: string | null;
  notes: string | null;
};

interface ResidentVehiclesClientProps {
  vehicles: ResidentVehicleRow[];
}

function VehicleForm({
  initial,
  onCancel,
}: {
  initial?: ResidentVehicleRow;
  onCancel?: () => void;
}) {
  const action = initial
    ? updateAuthorizedVehicleAction
    : createAuthorizedVehicleAction;
  const [state, formAction, pending] = useActionState(
    action,
    {} as VehicleActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      onCancel?.();
      router.refresh();
    }
  }, [state.success, onCancel, router]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      {initial ? <input type="hidden" name="vehicleId" value={initial.id} /> : null}

      <Input
        name="plate"
        label="Placa"
        required
        defaultValue={initial?.plate ?? ""}
        placeholder="ABC123"
        maxLength={12}
        autoCapitalize="characters"
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="vehicleType" className="text-sm font-medium">
          Tipo
        </label>
        <select
          id="vehicleType"
          name="vehicleType"
          required
          defaultValue={initial?.vehicle_type ?? "CAR"}
          className="min-h-11 w-full rounded-lg border border-black/10 bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
        >
          <option value="CAR">{VEHICLE_TYPE_LABELS.CAR}</option>
          <option value="MOTORCYCLE">{VEHICLE_TYPE_LABELS.MOTORCYCLE}</option>
        </select>
      </div>

      <Input
        name="color"
        label="Color"
        defaultValue={initial?.color ?? ""}
        placeholder="Ej. Gris plata"
        maxLength={40}
      />

      <Input
        name="notes"
        label="Notas (opcional)"
        defaultValue={initial?.notes ?? ""}
        placeholder="Ej. Parqueadero sótano B"
        maxLength={120}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="vehicle-photo" className="text-sm font-medium">
          Foto {initial ? "(opcional, reemplaza)" : "(opcional)"}
        </label>
        <label
          htmlFor="vehicle-photo"
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--slate-100)] px-3 text-sm text-[var(--muted)]"
        >
          <Camera className="size-4" aria-hidden />
          Adjuntar imagen
        </label>
        <input
          id="vehicle-photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
        />
      </div>

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
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 flex-1"
            onClick={onCancel}
          >
            Cancelar
          </Button>
        )}
        <Button type="submit" className="min-h-11 flex-1" disabled={pending}>
          {pending
            ? "Guardando…"
            : initial
              ? "Guardar cambios"
              : "Registrar vehículo"}
        </Button>
      </div>
    </form>
  );
}

export function ResidentVehiclesClient({ vehicles }: ResidentVehiclesClientProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function onDelete(id: string) {
    if (!confirm("¿Eliminar este vehículo autorizado?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAuthorizedVehicleAction(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <VehicleForm />

      <section className="space-y-3">
        <h2 className="font-semibold">Mis vehículos</h2>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {vehicles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            Aún no has registrado placas autorizadas.
          </p>
        ) : (
          <ul className="space-y-3">
            {vehicles.map((v) => (
              <li key={v.id}>
                {editingId === v.id ? (
                  <VehicleForm
                    initial={v}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <GlassCard as="article" padding="md">
                    <div className="flex gap-3">
                      {v.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.photo_url}
                          alt=""
                          className="size-16 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                          {v.vehicle_type === "MOTORCYCLE" ? (
                            <Bike className="size-6" aria-hidden />
                          ) : (
                            <Car className="size-6" aria-hidden />
                          )}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg font-semibold tracking-wide">
                          {v.plate}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant="muted">
                            {VEHICLE_TYPE_LABELS[v.vehicle_type]}
                          </Badge>
                          {v.color ? (
                            <Badge variant="default">{v.color}</Badge>
                          ) : null}
                        </div>
                        {v.notes ? (
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {v.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="min-h-10"
                        onClick={() => setEditingId(v.id)}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-10 text-red-700"
                        disabled={pending}
                        onClick={() => onDelete(v.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Eliminar
                      </Button>
                    </div>
                  </GlassCard>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
