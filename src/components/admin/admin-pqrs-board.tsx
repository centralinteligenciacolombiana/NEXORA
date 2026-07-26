"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PRIORITY_BADGE,
  PRIORITY_LABELS,
  TICKET_STATUS_BADGE,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
  type MaintenancePriority,
  type MaintenanceTicketStatus,
  type MaintenanceTicketType,
} from "@/lib/pqrs";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";
import type { PqrsListItem } from "@/components/shared/pqrs-ticket-list";

interface AdminPqrsBoardProps {
  tickets: PqrsListItem[];
}

type ViewMode = "list" | "kanban";

const KANBAN_COLUMNS: MaintenanceTicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
];

export function AdminPqrsBoard({ tickets }: AdminPqrsBoardProps) {
  const [view, setView] = useState<ViewMode>("kanban");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;
      return true;
    });
  }, [tickets, statusFilter, priorityFilter, typeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--slate-100)] p-1">
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-medium",
              view === "kanban" ? "bg-white shadow-sm" : "text-[var(--muted)]",
            )}
          >
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-medium",
              view === "list" ? "bg-white shadow-sm" : "text-[var(--muted)]",
            )}
          >
            Lista
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-black/10 bg-white px-3 text-sm"
        >
          <option value="ALL">Todos los estados</option>
          {KANBAN_COLUMNS.map((s) => (
            <option key={s} value={s}>
              {TICKET_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-10 rounded-lg border border-black/10 bg-white px-3 text-sm"
        >
          <option value="ALL">Todas las prioridades</option>
          {(Object.keys(PRIORITY_LABELS) as MaintenancePriority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-lg border border-black/10 bg-white px-3 text-sm"
        >
          <option value="ALL">Todos los tipos</option>
          {(Object.keys(TICKET_TYPE_LABELS) as MaintenanceTicketType[]).map(
            (t) => (
              <option key={t} value={t}>
                {TICKET_TYPE_LABELS[t]}
              </option>
            ),
          )}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-white px-4 py-10 text-center text-sm text-[var(--muted)]">
          No hay tickets con esos filtros.
        </p>
      ) : view === "list" ? (
        <ul className="space-y-3">
          {filtered.map((t) => (
            <TicketCard key={t.id} ticket={t} />
          ))}
        </ul>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {KANBAN_COLUMNS.map((col) => {
            const colTickets = filtered.filter((t) => t.status === col);
            return (
              <div
                key={col}
                className="w-64 shrink-0 rounded-2xl bg-[var(--slate-100)] p-3"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {TICKET_STATUS_LABELS[col]} ({colTickets.length})
                </p>
                <ul className="space-y-2">
                  {colTickets.map((t) => (
                    <TicketCard key={t.id} ticket={t} compact />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TicketCard({
  ticket: t,
  compact = false,
}: {
  ticket: PqrsListItem;
  compact?: boolean;
}) {
  return (
    <li>
      <Link
        href={`/dashboard/admin/pqrs/${t.id}`}
        className={cn(
          "block rounded-xl border border-[var(--border)] bg-white p-3 shadow-sm transition-colors hover:border-[var(--brand)]/30",
          compact && "p-2.5",
        )}
      >
        <p className="font-mono text-[10px] text-[var(--brand)]">{t.radicado}</p>
        <p className="mt-0.5 text-sm font-semibold leading-snug">{t.title}</p>
        {!compact && (
          <p className="mt-1 text-xs text-[var(--muted)]">
            {TICKET_TYPE_LABELS[t.type as MaintenanceTicketType] ?? t.type}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge
            variant={
              TICKET_STATUS_BADGE[t.status as MaintenanceTicketStatus] ?? "muted"
            }
          >
            {TICKET_STATUS_LABELS[t.status as MaintenanceTicketStatus] ??
              t.status}
          </Badge>
          <Badge
            variant={PRIORITY_BADGE[t.priority as MaintenancePriority] ?? "muted"}
          >
            {PRIORITY_LABELS[t.priority as MaintenancePriority] ?? t.priority}
          </Badge>
        </div>
        {!compact && (
          <p className="mt-1 text-[10px] text-[var(--slate-500)]">
            {formatDateTime(t.created_at)}
          </p>
        )}
      </Link>
    </li>
  );
}
