import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ImageOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSignedStorageUrls } from "@/lib/supabase/storage";
import { AdminTicketManageForm } from "@/components/admin/admin-ticket-manage-form";
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

export default async function AdminPqrsDetailPage({ params }: PageProps) {
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

  if (!profile?.complex_id || profile.role !== "ADMIN") {
    redirect("/onboarding");
  }

  const { data: ticket } = await supabase
    .from("maintenance_tickets")
    .select(
      "id, radicado, title, description, type, status, priority, location_details, evidence_urls, admin_response, solution_image_url, created_at, resolved_at, created_by, unit_id",
    )
    .eq("id", id)
    .eq("complex_id", profile.complex_id)
    .maybeSingle();

  if (!ticket) notFound();

  const [{ data: creator }, { data: unit }, { data: updatesRaw }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", ticket.created_by)
        .maybeSingle(),
      ticket.unit_id
        ? supabase
            .from("units")
            .select("number, tower")
            .eq("id", ticket.unit_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("ticket_updates")
        .select(
          "id, comment, status_changed_to, attachment_url, created_at, author_id",
        )
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true }),
    ]);

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
  const [signedEvidence, signedAttachments] = await Promise.all([
    getSignedStorageUrls("maintenance-evidence", evidence),
    getSignedStorageUrls(
      "maintenance-evidence",
      (updatesRaw ?? []).map((u) => u.attachment_url),
    ),
  ]);

  const updates: TimelineUpdate[] = (updatesRaw ?? []).map((u, i) => ({
    id: u.id,
    comment: u.comment,
    status_changed_to: u.status_changed_to,
    attachment_url: signedAttachments[i] ?? null,
    created_at: u.created_at,
    authorName: nameById.get(u.author_id) ?? "Usuario",
  }));

  const unitLabel = unit
    ? [unit.tower, `Apto ${unit.number}`].filter(Boolean).join(" · ")
    : null;

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <Link
        href="/dashboard/admin/pqrs"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver al tablero
      </Link>

      <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
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
          {creator?.full_name || "Residente"}
          {creator?.email ? ` · ${creator.email}` : ""}
          {unitLabel ? ` · ${unitLabel}` : ""}
        </p>
        <p className="mt-1 text-xs text-[var(--slate-500)]">
          {formatDateTime(ticket.created_at)}
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
      </div>

      <AdminTicketManageForm
        ticketId={ticket.id}
        status={ticket.status}
        priority={ticket.priority}
        adminResponse={ticket.admin_response}
      />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 font-semibold">Historial</h2>
        <PqrsTimeline updates={updates} />
      </section>
    </div>
  );
}
