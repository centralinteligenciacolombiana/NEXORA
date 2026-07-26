import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, QrCode, FolderKanban, MessageSquareWarning, Vote, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTrashReminder } from "@/lib/community";
import { getDashboardBackgrounds } from "@/lib/dashboard-backgrounds";
import { PanicButton } from "@/components/resident/panic-button";
import {
  ResidentSecurityTeamCard,
  type SecurityTeamPreviewGuard,
} from "@/components/resident/resident-security-team-card";
import { TrashReminderBanner } from "@/components/resident/trash-reminder-banner";
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

  const { data: activeShifts } = await supabase
    .from("guard_shifts")
    .select("id, shift_type, guard_id")
    .eq("complex_id", profile.complex_id)
    .eq("status", "ACTIVE")
    .order("started_at", { ascending: true })
    .limit(6);

  const guardIds = [...new Set((activeShifts ?? []).map((s) => s.guard_id))];
  const guardNameById = new Map<
    string,
    { full_name: string | null; avatar_url: string | null }
  >();
  if (guardIds.length > 0) {
    const { data: guards } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", guardIds);
    for (const g of guards ?? []) {
      guardNameById.set(g.id, {
        full_name: g.full_name,
        avatar_url: g.avatar_url,
      });
    }
  }

  const securityGuards: SecurityTeamPreviewGuard[] = (activeShifts ?? []).map(
    (s) => {
      const g = guardNameById.get(s.guard_id);
      return {
        id: s.id,
        fullName: g?.full_name?.trim() || "Personal de seguridad",
        avatarUrl: g?.avatar_url ?? null,
        shiftType: s.shift_type as "DAY" | "NIGHT",
      };
    },
  );

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
          <p className="nexora-text-on-dark text-sm font-medium text-indigo-100">
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

      {trashReminder && (
        <TrashReminderBanner
          kind={trashReminder.kind!}
          message={trashReminder.message}
          notes={complex.trash_notes}
        />
      )}

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
            <span className="block text-xs text-indigo-100">
              Autoriza el ingreso de tus visitas
            </span>
          </span>
        </Link>

        <Link
          href="/dashboard/resident/deliveries"
          className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)]/80 bg-white/70 px-4 py-3 transition-colors hover:border-[var(--brand)]/30"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-white text-[var(--emerald)]">
              <Package className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold text-[var(--foreground)]">
                Encomiendas pendientes
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
          className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)]/80 bg-white/70 px-4 py-3 transition-colors hover:border-[var(--brand)]/30"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-white text-[var(--brand)]">
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
            className="flex flex-col gap-2 rounded-xl border border-[var(--border)]/80 bg-white/70 px-3 py-3 transition-colors hover:border-[var(--brand)]/30"
          >
            <MessageSquareWarning className="size-5 text-[var(--brand)]" aria-hidden />
            <span className="text-sm font-semibold">PQRS</span>
          </Link>
          <Link
            href="/dashboard/resident/projects"
            className="flex flex-col gap-2 rounded-xl border border-[var(--border)]/80 bg-white/70 px-3 py-3 transition-colors hover:border-[var(--brand)]/30"
          >
            <FolderKanban className="size-5 text-[var(--brand)]" aria-hidden />
            <span className="text-sm font-semibold">Proyectos</span>
          </Link>
          <Link
            href="/dashboard/resident/voting"
            className="flex flex-col gap-2 rounded-xl border border-[var(--border)]/80 bg-white/70 px-3 py-3 transition-colors hover:border-[var(--brand)]/30"
          >
            <Vote className="size-5 text-[var(--brand)]" aria-hidden />
            <span className="text-sm font-semibold">Votaciones</span>
          </Link>
        </div>
      </GlassCard>

      <ResidentSecurityTeamCard guards={securityGuards} />
    </div>
  );
}
