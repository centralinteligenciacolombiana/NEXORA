"use client";

import { useActionState } from "react";
import {
  addAmenityAction,
  addUnitAction,
  updateComplexSettingsAction,
  type SettingsActionState,
} from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function Feedback({ state }: { state: SettingsActionState }) {
  if (!state.error && !state.message) return null;
  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm ${
        state.success
          ? "bg-emerald-50 text-emerald-800"
          : "bg-red-50 text-red-700"
      }`}
      role="status"
    >
      {state.error ?? state.message}
    </p>
  );
}

interface ComplexSettingsFormProps {
  initial: {
    name: string;
    address: string;
    city: string;
    phone: string;
    email: string;
    description: string;
    logoUrl: string;
    towers: string;
  };
}

export function ComplexSettingsForm({ initial }: ComplexSettingsFormProps) {
  const [state, action, pending] = useActionState(
    updateComplexSettingsAction,
    {} as SettingsActionState,
  );

  return (
    <form action={action} className="space-y-4 rounded-xl border border-black/5 bg-white p-4 sm:p-5">
      <div>
        <h2 className="font-semibold">Datos del conjunto</h2>
        <p className="text-sm text-[var(--muted)]">
          Información visible en invitaciones y portada del ecosistema.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" label="Nombre" required defaultValue={initial.name} />
        <Input name="city" label="Ciudad" defaultValue={initial.city} />
        <Input
          name="address"
          label="Dirección"
          defaultValue={initial.address}
          className="sm:col-span-2"
        />
        <Input name="phone" label="Teléfono" defaultValue={initial.phone} />
        <Input name="email" label="Correo" type="email" defaultValue={initial.email} />
        <Input
          name="logoUrl"
          label="URL del logo"
          type="url"
          placeholder="https://..."
          defaultValue={initial.logoUrl}
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium">
            Torres / bloques
          </label>
          <textarea
            name="towers"
            rows={3}
            defaultValue={initial.towers}
            placeholder={"Torre A\nTorre B\nBloque 1"}
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Una por línea (o separadas por coma).
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium">Descripción</label>
          <textarea
            name="description"
            rows={3}
            defaultValue={initial.description}
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
          />
        </div>
      </div>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar datos del conjunto"}
      </Button>
    </form>
  );
}

interface AddUnitFormProps {
  towers: string[];
}

export function AddUnitForm({ towers }: AddUnitFormProps) {
  const [state, action, pending] = useActionState(
    addUnitAction,
    {} as SettingsActionState,
  );

  return (
    <form action={action} className="space-y-3 rounded-xl border border-black/5 bg-white p-4 sm:p-5">
      <div>
        <h2 className="font-semibold">Agregar unidad</h2>
        <p className="text-sm text-[var(--muted)]">
          Apartamentos o casas del conjunto.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input name="number" label="Número" required placeholder="501" />
        {towers.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Torre</label>
            <select
              name="tower"
              className="h-10 rounded-lg border border-black/10 bg-white px-3 text-sm"
              defaultValue=""
            >
              <option value="">Sin torre</option>
              {towers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Input name="tower" label="Torre / bloque" placeholder="Torre A" />
        )}
        <Input name="floor" label="Piso" type="number" placeholder="5" />
      </div>
      <Feedback state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Agregando…" : "Agregar unidad"}
      </Button>
    </form>
  );
}

export function AddAmenityForm() {
  const [state, action, pending] = useActionState(
    addAmenityAction,
    {} as SettingsActionState,
  );

  return (
    <form action={action} className="space-y-3 rounded-xl border border-black/5 bg-white p-4 sm:p-5">
      <div>
        <h2 className="font-semibold">Agregar zona común</h2>
        <p className="text-sm text-[var(--muted)]">
          Salón social, gimnasio, piscina, BBQ, etc.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" label="Nombre" required placeholder="Salón social" />
        <Input name="location" label="Ubicación" placeholder="Piso 1" />
        <Input name="capacity" label="Capacidad" type="number" placeholder="40" />
        <Input
          name="description"
          label="Descripción"
          placeholder="Reserva previa requerida"
        />
      </div>
      <Feedback state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Agregando…" : "Agregar zona común"}
      </Button>
    </form>
  );
}
