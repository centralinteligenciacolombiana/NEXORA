"use client";

import { useActionState, useEffect, useRef } from "react";
import { Camera, NotebookPen } from "lucide-react";
import {
  createShiftLogAction,
  type ShiftActionState,
} from "@/lib/actions/shifts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LogbookFormProps {
  hasActiveShift: boolean;
}

export function LogbookForm({ hasActiveShift }: LogbookFormProps) {
  const [state, formAction, pending] = useActionState(
    createShiftLogAction,
    {} as ShiftActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <NotebookPen className="size-4 text-[var(--brand)]" aria-hidden />
        <h2 className="font-semibold">Registrar novedad de relevo</h2>
      </div>

      {!hasActiveShift && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          No tienes un turno activo asignado. Igual puedes dejar la nota; el
          admin puede asignarte Día/Noche en Configuración → Seguridad.
        </p>
      )}

      <Input
        name="title"
        label="Título"
        required
        maxLength={120}
        placeholder="Ej. Ruido en torre B, llave extraviada…"
      />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="log-description"
          className="text-sm font-medium text-[var(--foreground)]"
        >
          Detalle
        </label>
        <textarea
          id="log-description"
          name="description"
          required
          rows={4}
          maxLength={2000}
          placeholder="Describe la novedad para el compañero que entra de relevo…"
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="log-evidence"
          className="text-sm font-medium text-[var(--foreground)]"
        >
          Foto de evidencia (opcional)
        </label>
        <label
          htmlFor="log-evidence"
          className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--slate-100)] px-3 text-sm text-[var(--muted)] hover:border-[var(--brand)]/40"
        >
          <Camera className="size-4" aria-hidden />
          Adjuntar imagen
        </label>
        <input
          id="log-evidence"
          name="evidence"
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

      <Button
        type="submit"
        size="lg"
        className="min-h-12 w-full"
        disabled={pending}
      >
        {pending ? "Guardando…" : "Publicar en bitácora"}
      </Button>
    </form>
  );
}
