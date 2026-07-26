import {
  TICKET_STATUS_LABELS,
  type MaintenanceTicketStatus,
} from "@/lib/pqrs";
import { formatDateTime } from "@/lib/utils";

export type TimelineUpdate = {
  id: string;
  comment: string | null;
  status_changed_to: string | null;
  attachment_url: string | null;
  created_at: string;
  authorName: string;
};

interface PqrsTimelineProps {
  updates: TimelineUpdate[];
}

export function PqrsTimeline({ updates }: PqrsTimelineProps) {
  if (updates.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Aún no hay novedades en el historial.
      </p>
    );
  }

  return (
    <ol className="relative space-y-0 border-l-2 border-[var(--border)] pl-5">
      {updates.map((u) => (
        <li key={u.id} className="relative pb-6 last:pb-0">
          <span className="absolute -left-[1.4rem] top-1 size-3 rounded-full border-2 border-white bg-[var(--brand)] shadow" />
          <p className="text-xs text-[var(--muted)]">
            {formatDateTime(u.created_at)} · {u.authorName}
          </p>
          {u.status_changed_to && (
            <p className="mt-1 text-xs font-semibold text-[var(--brand)]">
              Estado →{" "}
              {TICKET_STATUS_LABELS[
                u.status_changed_to as MaintenanceTicketStatus
              ] ?? u.status_changed_to}
            </p>
          )}
          {u.comment && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--slate-700)]">
              {u.comment}
            </p>
          )}
          {u.attachment_url && (
            <a
              href={u.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block overflow-hidden rounded-xl border border-[var(--border)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u.attachment_url}
                alt="Adjunto"
                className="max-h-48 w-full object-cover"
              />
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}
