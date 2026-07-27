"use client";

import { useMemo, useState } from "react";
import { FolderKanban, ImageOff } from "lucide-react";
import {
  PROJECT_STATUS_BADGE,
  PROJECT_STATUS_LABELS,
  formatProjectBudget,
  type ProjectStatus,
} from "@/lib/projects-voting";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ResidentProjectCard = {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  year: number;
  budget: number | null;
  cover_image_url: string | null;
};

interface ResidentProjectsGalleryProps {
  projects: ResidentProjectCard[];
}

type TabKey = ProjectStatus;

export function ResidentProjectsGallery({
  projects,
}: ResidentProjectsGalleryProps) {
  const [tab, setTab] = useState<TabKey>("IN_PROGRESS");

  const counts = useMemo(
    () => ({
      PROPOSED: projects.filter((p) => p.status === "PROPOSED").length,
      IN_PROGRESS: projects.filter((p) => p.status === "IN_PROGRESS").length,
      COMPLETED: projects.filter((p) => p.status === "COMPLETED").length,
    }),
    [projects],
  );

  const list = projects.filter((p) => p.status === tab);

  const tabs: TabKey[] = ["PROPOSED", "IN_PROGRESS", "COMPLETED"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--slate-100)] p-1">
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-lg px-2 py-2.5 text-center text-xs font-medium transition-colors sm:text-sm",
              tab === key
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted)]",
            )}
          >
            {PROJECT_STATUS_LABELS[key]}
            <span className="mt-0.5 block text-[10px] text-[var(--slate-500)]">
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-12 text-center">
          <FolderKanban className="mx-auto size-8 text-[var(--muted)]" aria-hidden />
          <p className="mt-3 text-sm text-[var(--muted)]">
            No hay proyectos en «{PROJECT_STATUS_LABELS[tab]}».
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {list.map((p) => (
            <li
              key={p.id}
              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm"
            >
              {p.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.cover_image_url}
                  alt=""
                  className="aspect-[16/10] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/10] w-full items-center justify-center bg-[var(--slate-100)] text-[var(--muted)]">
                  <ImageOff className="size-8" aria-hidden />
                </div>
              )}
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-snug">{p.title}</h3>
                  <Badge variant={PROJECT_STATUS_BADGE[p.status]}>
                    {p.year}
                  </Badge>
                </div>
                {p.description && (
                  <p className="line-clamp-3 text-sm text-[var(--muted)]">
                    {p.description}
                  </p>
                )}
                {formatProjectBudget(p.budget) && (
                  <p className="text-sm font-medium text-[var(--brand)]">
                    Presupuesto: {formatProjectBudget(p.budget)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
