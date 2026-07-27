"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, MessageSquarePlus } from "lucide-react";
import {
  createMaintenanceTicketAction,
  type PqrsActionState,
} from "@/lib/actions/pqrs";
import {
  TICKET_TYPE_LABELS,
  type MaintenanceTicketType,
} from "@/lib/pqrs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function CreatePqrsForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createMaintenanceTicketAction,
    {} as PqrsActionState,
  );

  useEffect(() => {
    if (state.success && state.ticketId) {
      router.push(`/dashboard/resident/pqrs/${state.ticketId}`);
      router.refresh();
    }
  }, [state.success, state.ticketId, router]);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-center gap-2">
        <MessageSquarePlus className="size-4 text-[var(--brand)]" aria-hidden />
        <h2 className="font-semibold">Nueva solicitud / reporte</h2>
      </div>

      <Select name="type" label="Categoría" required defaultValue="DAMAGE_REPORT">
        {(Object.keys(TICKET_TYPE_LABELS) as MaintenanceTicketType[]).map(
          (key) => (
            <option key={key} value={key}>
              {TICKET_TYPE_LABELS[key]}
            </option>
          ),
        )}
      </Select>

      <Input
        name="title"
        label="Título"
        required
        maxLength={120}
        placeholder="Ej. Luz dañada en parqueadero"
      />

      <Input
        name="locationDetails"
        label="Ubicación"
        placeholder="Piscina, Ascensor Torre 2, Parqueadero #15…"
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pqrs-desc" className="text-sm font-medium">
          Descripción detallada
        </label>
        <textarea
          id="pqrs-desc"
          name="description"
          required
          rows={4}
          maxLength={4000}
          placeholder="Cuéntanos qué sucede, desde cuándo y cualquier detalle útil…"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pqrs-evidence" className="text-sm font-medium">
          Evidencia fotográfica (hasta 3)
        </label>
        <label
          htmlFor="pqrs-evidence"
          className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--slate-100)] px-3 text-sm text-[var(--muted)] hover:border-[var(--brand)]/40"
        >
          <Camera className="size-4" aria-hidden />
          Adjuntar fotos
        </label>
        <input
          id="pqrs-evidence"
          name="evidence"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
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

      <Button type="submit" size="lg" className="min-h-12 w-full" disabled={pending}>
        {pending ? "Enviando…" : "Radicar solicitud"}
      </Button>
    </form>
  );
}
