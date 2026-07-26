"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Pencil, Trash2 } from "lucide-react";
import {
  deleteProjectAction,
  upsertProjectAction,
  type ProjectVotingActionState,
} from "@/lib/actions/projects-voting";
import {
  PROJECT_STATUS_BADGE,
  PROJECT_STATUS_LABELS,
  formatProjectBudget,
  type ProjectStatus,
} from "@/lib/projects-voting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type AdminProjectRow = {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  year: number;
  budget: number | null;
  cover_image_url: string | null;
};

interface AdminProjectsClientProps {
  projects: AdminProjectRow[];
  currentYear: number;
}

export function AdminProjectsClient({
  projects,
  currentYear,
}: AdminProjectsClientProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminProjectRow | null>(null);
  const [state, formAction, pending] = useActionState(
    upsertProjectAction,
    {} as ProjectVotingActionState,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (state.success) {
      setEditing(null);
      router.refresh();
    }
  }, [state.success, router]);

  function onDelete(id: string) {
    if (!window.confirm("¿Eliminar este proyecto?")) return;
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const result = await deleteProjectAction(id);
      if (result.error) {
        setErr(result.error);
        return;
      }
      setMsg(result.message ?? "Eliminado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form
        key={editing?.id ?? "new"}
        action={formAction}
        className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex items-center gap-2">
          <FolderKanban className="size-4 text-[var(--brand)]" aria-hidden />
          <h2 className="font-semibold">
            {editing ? "Editar proyecto" : "Nuevo proyecto"}
          </h2>
        </div>

        {editing && (
          <input type="hidden" name="projectId" value={editing.id} />
        )}

        <Input
          name="title"
          label="Título"
          required
          defaultValue={editing?.title ?? ""}
          placeholder="Remodelación lobby"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="project-desc" className="text-sm font-medium">
            Descripción
          </label>
          <textarea
            id="project-desc"
            name="description"
            rows={3}
            defaultValue={editing?.description ?? ""}
            placeholder="Detalle para la rendición de cuentas…"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            name="year"
            label="Año"
            type="number"
            required
            min={2000}
            max={2100}
            defaultValue={editing?.year ?? currentYear}
          />
          <Select
            name="status"
            label="Estado"
            defaultValue={editing?.status ?? "PROPOSED"}
          >
            {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map(
              (s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </option>
              ),
            )}
          </Select>
          <Input
            name="budget"
            label="Presupuesto (COP)"
            type="number"
            min={0}
            step={1000}
            defaultValue={editing?.budget ?? ""}
            placeholder="Opcional"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cover" className="text-sm font-medium">
            Imagen de portada {editing ? "(opcional al editar)" : ""}
          </label>
          <input
            id="cover"
            name="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand-soft)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--brand)]"
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

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending
              ? "Guardando…"
              : editing
                ? "Guardar cambios"
                : "Crear proyecto"}
          </Button>
          {editing && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">Portafolio ({projects.length})</h2>
        {projects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
            Aún no hay proyectos publicados.
          </p>
        ) : (
          <ul className="space-y-3">
            {projects.map((p) => (
              <li
                key={p.id}
                className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm"
              >
                {p.cover_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.cover_image_url}
                    alt=""
                    className="h-36 w-full object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{p.title}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {p.year}
                        {formatProjectBudget(p.budget)
                          ? ` · ${formatProjectBudget(p.budget)}`
                          : ""}
                      </p>
                    </div>
                    <Badge variant={PROJECT_STATUS_BADGE[p.status]}>
                      {PROJECT_STATUS_LABELS[p.status]}
                    </Badge>
                  </div>
                  {p.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-[var(--slate-700)]">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditing(p)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => onDelete(p.id)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Eliminar
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {err && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
      )}
      {msg && !err && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </p>
      )}
    </div>
  );
}
