"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, Wrench } from "lucide-react";
import {
  updateMaintenanceTicketAction,
  type PqrsActionState,
} from "@/lib/actions/pqrs";
import {
  PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type MaintenancePriority,
  type MaintenanceTicketStatus,
} from "@/lib/pqrs";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

interface AdminTicketManageFormProps {
  ticketId: string;
  status: string;
  priority: string;
  adminResponse: string | null;
}

export function AdminTicketManageForm({
  ticketId,
  status,
  priority,
  adminResponse,
}: AdminTicketManageFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateMaintenanceTicketAction,
    {} as PqrsActionState,
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <Wrench className="size-4 text-[var(--brand)]" aria-hidden />
        <h2 className="font-semibold">Gestión del ticket</h2>
      </div>

      <input type="hidden" name="ticketId" value={ticketId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Select name="status" label="Estado" defaultValue={status}>
          {(Object.keys(TICKET_STATUS_LABELS) as MaintenanceTicketStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {TICKET_STATUS_LABELS[s]}
              </option>
            ),
          )}
        </Select>
        <Select name="priority" label="Prioridad" defaultValue={priority}>
          {(Object.keys(PRIORITY_LABELS) as MaintenancePriority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-response" className="text-sm font-medium">
          Respuesta oficial / plan de reparación
        </label>
        <textarea
          id="admin-response"
          name="adminResponse"
          rows={4}
          defaultValue={adminResponse ?? ""}
          placeholder="Describe la gestión o solución para el residente…"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-comment" className="text-sm font-medium">
          Nota interna en el historial (opcional)
        </label>
        <textarea
          id="admin-comment"
          name="comment"
          rows={2}
          placeholder="Se mostrará en la línea de tiempo…"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="solution-image" className="text-sm font-medium">
          Foto de solución (opcional)
        </label>
        <label
          htmlFor="solution-image"
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--slate-100)] px-3 text-sm text-[var(--muted)]"
        >
          <Camera className="size-4" aria-hidden />
          Adjuntar imagen
        </label>
        <input
          id="solution-image"
          name="solutionImage"
          type="file"
          accept="image/jpeg,image/png,image/webp"
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

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Guardando…" : "Guardar y notificar"}
      </Button>
    </form>
  );
}
