import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Package,
  QrCode,
  FolderKanban,
  MessageSquareWarning,
  Vote,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTrashReminder } from "@/lib/community";
import { getDashboardBackgrounds } from "@/lib/dashboard-backgrounds";
import {
  isPollOpen,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/lib/projects-voting";
import { PanicButton } from "@/components/resident/panic-button";
import { OnDutySecurityLive } from "@/components/shared/on-duty-security-live";
import { fetchOnDutyGuards } from "@/lib/on-duty-security";
import {
  ResidentSummaryPanel,
  type ResidentSummaryItem,
} from "@/components/resident/resident-summary-panel";
import {
  BackgroundPanel,
  GlassCard,
} from "@/components/ui/background-panel";
import { Badge } from "@/components/ui/badge";

export default async function ResidentDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, complex_id, unit_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "RESIDENT") {
    redirect("/login");
  }

  const [{ data: complex }, { data: unit }] = await Promise.all([
    supabase
      .from("complexes")
      .select("id, name, city, trash_days, trash_time, trash_notes")
      .eq("id", profile.complex_id)
      .maybeSingle(),
    profile.unit_id
      ? supabase
          .from("units")
          .select("id, number, tower, floor")
          .eq("id", profile.unit_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!complex) {
    redirect("/login");
  }

  let pendingDeliveries = 0;
  let pendingUtilityBills = 0;
  if (profile.unit_id) {
    const [{ count: deliveryCount }, { count: billCount }] = await Promise.all([
      supabase
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .eq("unit_id", profile.unit_id)
        .eq("status", "PENDING"),
      supabase
        .from("utility_bills")
        .select("id", { count: "exact", head: true })
        .eq("unit_id", profile.unit_id)
        .eq("status", "PENDING"),
    ]);
    pendingDeliveries = deliveryCount ?? 0;
    pendingUtilityBills = billCount ?? 0;
  }

  const trashReminder = getTrashReminder(
    complex.trash_days as string[] | null,
    complex.trash_time,
  );

  const [
    onDutyGuards,
    { data: pollRows },
    { data: projectRows },
    { data: myTickets },
  ] = await Promise.all([
    fetchOnDutyGuards(supabase, profile.complex_id),
    supabase
      .from("polls")
      .select("id, title, status, starts_at, ends_at")
      .eq("complex_id", profile.complex_id)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("complex_projects")
      .select("id, title, status")
      .eq("complex_id", profile.complex_id)
      .in("status", ["PROPOSED", "IN_PROGRESS"])
      .order("updated_at", { ascending: false })
      .limit(4),
    supabase
      .from("maintenance_tickets")
      .select("id, radicado, title, status, updated_at")
      .eq("complex_id", profile.complex_id)
      .eq("created_by", user.id)
      .in("status", ["OPEN", "IN_PROGRESS", "RESOLVED"])
      .order("updated_at", { ascending: false })
      .limit(12),
  ]);

  const openPolls = (pollRows ?? []).filter((p) => isPollOpen(p));
  const pollIds = openPolls.map((p) => p.id);

  const { data: myVotes } =
    pollIds.length > 0 && profile.unit_id
      ? await supabase
          .from("poll_votes")
          .select("poll_id")
          .eq("unit_id", profile.unit_id)
          .in("poll_id", pollIds)
      : { data: [] as { poll_id: string }[] };

  const votedPollIds = new Set((myVotes ?? []).map((v) => v.poll_id));

  const ticketIds = (myTickets ?? []).map((t) => t.id);
  const { data: ticketUpdates } =
    ticketIds.length > 0
      ? await supabase
          .from("ticket_updates")
          .select("ticket_id, author_id, created_at")
          .in("ticket_id", ticketIds)
          .neq("author_id", user.id)
          .order("created_at", { ascending: false })
      : { data: [] as { ticket_id: string; author_id: string; created_at: string }[] };

  const latestReplyByTicket = new Map<string, string>();
  for (const u of ticketUpdates ?? []) {
    if (!latestReplyByTicket.has(u.ticket_id)) {
      latestReplyByTicket.set(u.ticket_id, u.created_at);
    }
  }

  const summaryItems: ResidentSummaryItem[] = [];

  if (trashReminder) {
    summaryItems.push({
      id: "trash-today",
      icon: "trash",
      tone: "brand",
      title: trashReminder.message,
      subtitle:
        complex.trash_notes?.trim() ||
        "Recuerda sacar las bolsas a tiempo.",
      badge: "Hoy",
      badgeVariant: "warning",
    });
  }

  if (pendingDeliveries > 0) {
    summaryItems.push({
      id: "deliveries-pending",
      href: "/dashboard/resident/deliveries",
      icon: "package",
      tone: "warning",
      title:
        pendingDeliveries === 1
          ? "Tienes un paquete en portería"
          : `Tienes ${pendingDeliveries} paquetes en portería`,
      subtitle: "Pasa a reclamarlo con tu documento",
      badge: String(pendingDeliveries),
      badgeVariant: "warning",
    });
  }

  if (pendingUtilityBills > 0) {
    summaryItems.push({
      id: "bills-pending",
      href: "/dashboard/resident/finances",
      icon: "wallet",
      tone: "warning",
      title:
        pendingUtilityBills === 1
          ? "Tienes un recibo pendiente"
          : `Tienes ${pendingUtilityBills} recibos pendientes`,
      subtitle: "Revisa cuotas y servicios",
      badge: String(pendingUtilityBills),
      badgeVariant: "warning",
    });
  }

  for (const poll of openPolls) {
    const hasVoted = votedPollIds.has(poll.id);
    summaryItems.push({
      id: `poll-${poll.id}`,
      href: "/dashboard/resident/voting",
      icon: "vote",
      tone: hasVoted ? "success" : "brand",
      title: poll.title,
      subtitle: hasVoted
        ? "Ya votaste · Ver resultados"
        : "Votación activa · Tu unidad aún no vota",
      badge: hasVoted ? "Votado" : "Pendiente",
      badgeVariant: hasVoted ? "success" : "warning",
    });
  }

  for (const project of projectRows ?? []) {
    const status = project.status as ProjectStatus;
    summaryItems.push({
      id: `project-${project.id}`,
      href: "/dashboard/resident/projects",
      icon: "project",
      tone: status === "IN_PROGRESS" ? "warning" : "muted",
      title: project.title,
      subtitle: `Proyecto · ${PROJECT_STATUS_LABELS[status] ?? status}`,
      badge: PROJECT_STATUS_LABELS[status] ?? status,
      badgeVariant: status === "IN_PROGRESS" ? "warning" : "muted",
    });
  }

  for (const ticket of myTickets ?? []) {
    if (!latestReplyByTicket.has(ticket.id)) continue;
    // No inundar: máximo 3 PQRS con respuesta en el panel
    const pqrsShown = summaryItems.filter((i) => i.icon === "pqrs").length;
    if (pqrsShown >= 3) break;

    summaryItems.push({
      id: `pqrs-${ticket.id}`,
      href: `/dashboard/resident/pqrs/${ticket.id}`,
      icon: "pqrs",
      tone: "brand",
      title: ticket.title,
      subtitle: `Hay una respuesta en ${ticket.radicado}`,
      badge: "Respuesta",
      badgeVariant: "default",
    });
  }

  const firstName =
    profile.full_name?.trim().split(/\s+/)[0] ||
    user.email?.split("@")[0] ||
    "vecino";

  const unitLabel = unit
    ? [unit.tower, `Apto ${unit.number}`].filter(Boolean).join(" · ")
    : "Sin unidad asignada";

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <BackgroundPanel
        bgImageUrls={getDashboardBackgrounds("resident")}
        overlayOpacity="bg-slate-950/65"
        priority
        rounded="3xl"
        carouselIntervalMs={6500}
        contentClassName="space-y-4 p-5 sm:p-6"
        imageAlt=""
      >
        <header className="space-y-1">
          <p className="nexora-text-on-dark text-sm font-medium text-teal-50">
            {complex.name}
            {complex.city ? ` · ${complex.city}` : ""}
          </p>
          <h1 className="nexora-text-on-dark font-display text-3xl font-semibold tracking-tight text-white">
            ¡Hola, {firstName}!
          </h1>
          <p className="nexora-text-on-dark text-sm text-slate-200">{unitLabel}</p>
        </header>

        <PanicButton />
      </BackgroundPanel>

      <ResidentSummaryPanel items={summaryItems} />

      <GlassCard as="section" blur="md">
        <h2 className="text-sm font-semibold text-[var(--slate-700)]">
          Acceso rápido
        </h2>

        <Link
          href="/dashboard/resident/visits"
          className="mt-3 flex w-full items-center gap-3 rounded-xl bg-[var(--brand)] px-4 py-3.5 text-white transition-colors hover:bg-[var(--brand-hover)]"
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-white/15">
            <QrCode className="size-5" aria-hidden />
          </span>
          <span className="flex-1 text-left">
            <span className="block text-sm font-semibold">
              Generar Pase QR de Visita
            </span>
            <span className="block text-xs text-emerald-50">
              Autoriza el ingreso de tus visitas
            </span>
          </span>
        </Link>

        <Link
          href="/dashboard/resident/deliveries"
          className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/80 px-4 py-3 transition-colors hover:border-[var(--brand)]/30"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--emerald)]">
              <Package className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold text-[var(--foreground)]">
                Encomiendas
              </span>
              <span className="block text-xs text-[var(--muted)]">
                Paquetes en portería
              </span>
            </span>
          </span>
          <Badge
            variant={pendingDeliveries > 0 ? "warning" : "muted"}
            className="min-w-8 justify-center text-sm"
          >
            {pendingDeliveries}
          </Badge>
        </Link>

        <Link
          href="/dashboard/resident/finances"
          className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/80 px-4 py-3 transition-colors hover:border-[var(--brand)]/30"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--brand)]">
              <Wallet className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold text-[var(--foreground)]">
                Finanzas y recibos
              </span>
              <span className="block text-xs text-[var(--muted)]">
                Cuota y servicios en portería
              </span>
            </span>
          </span>
          <Badge
            variant={pendingUtilityBills > 0 ? "warning" : "muted"}
            className="min-w-8 justify-center text-sm"
          >
            {pendingUtilityBills}
          </Badge>
        </Link>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Link
            href="/dashboard/resident/pqrs"
            className="flex flex-col gap-2 rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/80 px-3 py-3 transition-colors hover:border-[var(--brand)]/30"
          >
            <MessageSquareWarning className="size-5 text-[var(--brand)]" aria-hidden />
            <span className="text-sm font-semibold">PQRS</span>
          </Link>
          <Link
            href="/dashboard/resident/projects"
            className="flex flex-col gap-2 rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/80 px-3 py-3 transition-colors hover:border-[var(--brand)]/30"
          >
            <FolderKanban className="size-5 text-[var(--brand)]" aria-hidden />
            <span className="text-sm font-semibold">Proyectos</span>
          </Link>
          <Link
            href="/dashboard/resident/voting"
            className="flex flex-col gap-2 rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/80 px-3 py-3 transition-colors hover:border-[var(--brand)]/30"
          >
            <Vote className="size-5 text-[var(--brand)]" aria-hidden />
            <span className="text-sm font-semibold">Votaciones</span>
          </Link>
        </div>
      </GlassCard>

      <div className="space-y-2">
        <OnDutySecurityLive
          complexId={profile.complex_id}
          initialGuards={onDutyGuards}
          title="Seguridad en turno ahora"
          emptyMessage="No hay turnos activos ahora. Revisa más tarde."
          compact
        />
        <p className="text-right">
          <Link
            href="/dashboard/resident/security-team"
            className="text-xs font-medium text-[var(--brand)] hover:underline"
          >
            Ver detalle →
          </Link>
        </p>
      </div>
    </div>
  );
}
