"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, PawPrint, Pencil, Trash2 } from "lucide-react";
import {
  createPetAction,
  deletePetAction,
  updatePetAction,
  type PetActionState,
} from "@/lib/actions/pets";
import { PET_SPECIES_OPTIONS } from "@/lib/pets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/background-panel";

export type ResidentPetRow = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
};

function PetForm({
  initial,
  onCancel,
}: {
  initial?: ResidentPetRow;
  onCancel?: () => void;
}) {
  const action = initial ? updatePetAction : createPetAction;
  const [state, formAction, pending] = useActionState(
    action,
    {} as PetActionState,
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

  const speciesDefault = initial?.species ?? "Perro";
  const knownSpecies = PET_SPECIES_OPTIONS.includes(
    speciesDefault as (typeof PET_SPECIES_OPTIONS)[number],
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      {initial ? <input type="hidden" name="petId" value={initial.id} /> : null}

      <Input
        name="name"
        label="Nombre"
        required
        defaultValue={initial?.name ?? ""}
        maxLength={60}
        placeholder="Ej. Luna"
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pet-species" className="text-sm font-medium">
          Especie / tipo
        </label>
        <select
          id="pet-species"
          name="species"
          required
          defaultValue={knownSpecies ? speciesDefault : "Otro"}
          className="min-h-11 w-full rounded-lg border border-black/10 bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
        >
          {PET_SPECIES_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <Input
        name="breed"
        label="Raza (opcional)"
        defaultValue={initial?.breed ?? ""}
        maxLength={60}
        placeholder="Ej. Labrador"
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pet-photo" className="text-sm font-medium">
          Foto {initial ? "(opcional, reemplaza)" : "(opcional)"}
        </label>
        <label
          htmlFor="pet-photo"
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--slate-100)] px-3 text-sm text-[var(--muted)]"
        >
          <Camera className="size-4" aria-hidden />
          Adjuntar imagen
        </label>
        <input
          id="pet-photo"
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
              : "Registrar mascota"}
        </Button>
      </div>
    </form>
  );
}

export function ResidentPetsClient({ pets }: { pets: ResidentPetRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function onDelete(id: string) {
    if (!confirm("¿Eliminar esta mascota?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deletePetAction(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <PetForm />

      <section className="space-y-3">
        <h2 className="font-semibold">Mis mascotas</h2>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {pets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            Aún no has registrado mascotas.
          </p>
        ) : (
          <ul className="space-y-3">
            {pets.map((p) => (
              <li key={p.id}>
                {editingId === p.id ? (
                  <PetForm initial={p} onCancel={() => setEditingId(null)} />
                ) : (
                  <GlassCard as="article" padding="md">
                    <div className="flex gap-3">
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photo_url}
                          alt=""
                          className="size-16 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                          <PawPrint className="size-6" aria-hidden />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{p.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant="default">{p.species}</Badge>
                          {p.breed ? (
                            <Badge variant="muted">{p.breed}</Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="min-h-10"
                        onClick={() => setEditingId(p.id)}
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
                        onClick={() => onDelete(p.id)}
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
