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
import { formatDateTime } from "@/lib/utils";

export type PqrsListItem = {
  id: string;
  radicado: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  created_at: string;
  location_details: string | null;
};

interface PqrsTicketListProps {
  tickets: PqrsListItem[];
  hrefBase: string;
  emptyMessage: string;
}

export function PqrsTicketList({
  tickets,
  hrefBase,
  emptyMessage,
}: PqrsTicketListProps) {
  if (tickets.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--border)] bg-white px-4 py-10 text-center text-sm text-[var(--muted)]">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {tickets.map((t) => (
        <li key={t.id}>
          <Link
            href={`${hrefBase}/${t.id}`}
            className="block rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm transition-colors hover:border-[var(--brand)]/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-[var(--brand)]">
                  {t.radicado}
                </p>
                <p className="mt-0.5 truncate font-semibold">{t.title}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {TICKET_TYPE_LABELS[t.type as MaintenanceTicketType] ?? t.type}
                  {t.location_details ? ` · ${t.location_details}` : ""}
                </p>
                <p className="mt-1 text-xs text-[var(--slate-500)]">
                  {formatDateTime(t.created_at)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge
                  variant={
                    TICKET_STATUS_BADGE[t.status as MaintenanceTicketStatus] ??
                    "muted"
                  }
                >
                  {TICKET_STATUS_LABELS[t.status as MaintenanceTicketStatus] ??
                    t.status}
                </Badge>
                <Badge
                  variant={
                    PRIORITY_BADGE[t.priority as MaintenancePriority] ?? "muted"
                  }
                >
                  {PRIORITY_LABELS[t.priority as MaintenancePriority] ??
                    t.priority}
                </Badge>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
