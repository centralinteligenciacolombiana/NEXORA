"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import {
  updateTrashScheduleAction,
  type FinanceActionState,
} from "@/lib/actions/finances";
import { WEEKDAY_KEYS, WEEKDAY_LABELS, type WeekdayKey } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TrashScheduleFormProps {
  initialDays: string[];
  initialTime: string;
  initialNotes: string;
}

export function TrashScheduleForm({
  initialDays,
  initialTime,
  initialNotes,
}: TrashScheduleFormProps) {
  const [state, formAction, pending] = useActionState(
    updateTrashScheduleAction,
    {} as FinanceActionState,
  );

  const selected = new Set(initialDays.map((d) => d.toUpperCase()));

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <Trash2 className="size-4 text-[var(--brand)]" aria-hidden />
        <h2 className="font-semibold">Recolección de basura</h2>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Días de recolección</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WEEKDAY_KEYS.map((day) => (
            <label
              key={day}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                selected.has(day)
                  ? "border-[var(--brand)]/40 bg-[var(--brand-soft)]"
                  : "border-[var(--border)] bg-white",
              )}
            >
              <input
                type="checkbox"
                name="trashDays"
                value={day}
                defaultChecked={selected.has(day)}
                className="size-4 accent-[var(--brand)]"
              />
              {WEEKDAY_LABELS[day as WeekdayKey]}
            </label>
          ))}
        </div>
      </fieldset>

      <Input
        name="trashTime"
        label="Horario"
        defaultValue={initialTime}
        placeholder="Ej. 8:00 PM"
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="trash-notes" className="text-sm font-medium">
          Notas
        </label>
        <textarea
          id="trash-notes"
          name="trashNotes"
          rows={3}
          defaultValue={initialNotes}
          placeholder="Sacar bolsas la noche anterior, separar reciclaje…"
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
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

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Guardando…" : "Guardar horario"}
      </Button>
    </form>
  );
}
