import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ImageOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getSignedStorageUrl,
  getSignedStorageUrls,
} from "@/lib/supabase/storage";
import {
  PqrsTimeline,
  type TimelineUpdate,
} from "@/components/shared/pqrs-timeline";
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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ResidentPqrsDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "RESIDENT") {
    redirect("/login");
  }

  const { data: ticket } = await supabase
    .from("maintenance_tickets")
    .select(
      "id, radicado, title, description, type, status, priority, location_details, evidence_urls, admin_response, solution_image_url, created_at, resolved_at, created_by",
    )
    .eq("id", id)
    .eq("complex_id", profile.complex_id)
    .maybeSingle();

  if (!ticket || ticket.created_by !== user.id) {
    notFound();
  }

  const { data: updatesRaw } = await supabase
    .from("ticket_updates")
    .select(
      "id, comment, status_changed_to, attachment_url, created_at, author_id",
    )
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });

  const authorIds = [
    ...new Set((updatesRaw ?? []).map((u) => u.author_id).filter(Boolean)),
  ];
  const nameById = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);
    for (const a of authors ?? []) {
      nameById.set(a.id, a.full_name?.trim() || "Usuario");
    }
  }

  const evidence = (ticket.evidence_urls as string[] | null) ?? [];
  const [signedEvidence, signedSolution, signedAttachments] = await Promise.all(
    [
      getSignedStorageUrls("maintenance-evidence", evidence),
      getSignedStorageUrl("maintenance-evidence", ticket.solution_image_url),
      getSignedStorageUrls(
        "maintenance-evidence",
        (updatesRaw ?? []).map((u) => u.attachment_url),
      ),
    ],
  );

  const updates: TimelineUpdate[] = (updatesRaw ?? []).map((u, i) => ({
    id: u.id,
    comment: u.comment,
    status_changed_to: u.status_changed_to,
    attachment_url: signedAttachments[i] ?? null,
    created_at: u.created_at,
    authorName: nameById.get(u.author_id) ?? "Usuario",
  }));

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <Link
        href="/dashboard/resident/pqrs"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mis solicitudes
      </Link>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
        <p className="font-mono text-sm text-[var(--brand)]">{ticket.radicado}</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">{ticket.title}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge
            variant={
              TICKET_STATUS_BADGE[ticket.status as MaintenanceTicketStatus]
            }
          >
            {TICKET_STATUS_LABELS[ticket.status as MaintenanceTicketStatus]}
          </Badge>
          <Badge
            variant={PRIORITY_BADGE[ticket.priority as MaintenancePriority]}
          >
            {PRIORITY_LABELS[ticket.priority as MaintenancePriority]}
          </Badge>
          <Badge variant="muted">
            {TICKET_TYPE_LABELS[ticket.type as MaintenanceTicketType]}
          </Badge>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Radicado {formatDateTime(ticket.created_at)}
          {ticket.location_details ? ` · ${ticket.location_details}` : ""}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--slate-700)]">
          {ticket.description}
        </p>

        {evidence.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {evidence.map((path, i) => {
              const signed = signedEvidence[i];
              if (!signed) {
                return (
                  <span
                    key={`${path}-${i}`}
                    className="flex aspect-square items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--slate-100)] text-[var(--muted)]"
                    role="img"
                    aria-label="Evidencia no disponible"
                  >
                    <ImageOff className="size-5" aria-hidden />
                  </span>
                );
              }
              return (
                <a
                  key={`${path}-${i}`}
                  href={signed}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="overflow-hidden rounded-lg border border-[var(--border)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signed}
                    alt={`Evidencia ${i + 1}`}
                    className="aspect-square object-cover"
                  />
                </a>
              );
            })}
          </div>
        )}

        {ticket.admin_response && (
          <div className="mt-4 rounded-xl bg-[var(--brand-soft)] px-3 py-3">
            <p className="text-xs font-semibold text-[var(--brand)]">
              Respuesta oficial
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--slate-700)]">
              {ticket.admin_response}
            </p>
          </div>
        )}

        {ticket.solution_image_url &&
          (signedSolution ? (
            <a
              href={signedSolution}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block overflow-hidden rounded-xl border border-[var(--border)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedSolution}
                alt="Solución"
                className="max-h-56 w-full object-cover"
              />
            </a>
          ) : (
            <span
              className="mt-3 flex h-32 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--slate-100)] text-[var(--muted)]"
              role="img"
              aria-label="Imagen de solución no disponible"
            >
              <ImageOff className="size-6" aria-hidden />
            </span>
          ))}
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 font-semibold">Historial de seguimiento</h2>
        <PqrsTimeline updates={updates} />
      </section>
    </div>
  );
}
