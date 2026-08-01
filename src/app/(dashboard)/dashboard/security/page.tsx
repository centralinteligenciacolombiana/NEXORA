import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardBackgrounds } from "@/lib/dashboard-backgrounds";
import { EmergencyAlertsBanner } from "@/components/security/emergency-alerts-banner";
import { QrCheckInPanel } from "@/components/security/qr-check-in-panel";
import { DeliveryFormPanel } from "@/components/security/delivery-form-panel";
import { RecentActivityPanel } from "@/components/security/recent-activity-panel";
import {
  BackgroundPanel,
  GlassCard,
} from "@/components/ui/background-panel";
import type { SecurityAlertView } from "@/components/security/emergency-alerts-banner";

function unitLabel(tower: string | null | undefined, number: string) {
  return [tower, `Apto ${number}`].filter(Boolean).join(" · ");
}

export default async function SecurityDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile?.complex_id ||
    (profile.role !== "SECURITY" && profile.role !== "ADMIN")
  ) {
    redirect("/login");
  }

  const { data: complex } = await supabase
    .from("complexes")
    .select("id, name")
    .eq("id", profile.complex_id)
    .maybeSingle();

  if (!complex) {
    redirect("/login");
  }

  const { data: units } = await supabase
    .from("units")
    .select("id, number, tower")
    .eq("complex_id", complex.id)
    .eq("is_active", true)
    .order("tower", { ascending: true })
    .order("number", { ascending: true });

  const unitIds = (units ?? []).map((u) => u.id);
  const unitMap = new Map(
    (units ?? []).map((u) => [u.id, unitLabel(u.tower, u.number)]),
  );

  let initialAlerts: SecurityAlertView[] = [];
  if (unitIds.length > 0) {
    const { data: alerts } = await supabase
      .from("emergency_alerts")
      .select("id, unit_id, status, alert_type, created_at, triggered_by")
      .eq("status", "ACTIVE")
      .in("unit_id", unitIds)
      .order("created_at", { ascending: false });

    const triggerIds = [
      ...new Set((alerts ?? []).map((a) => a.triggered_by).filter(Boolean)),
    ];

    const nameById = new Map<string, string>();
    if (triggerIds.length > 0) {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", triggerIds);
      for (const p of people ?? []) {
        if (p.full_name) nameById.set(p.id, p.full_name.trim());
      }
    }

    initialAlerts = (alerts ?? []).map((a) => ({
      id: a.id,
      unit_id: a.unit_id,
      status: a.status,
      alert_type: a.alert_type,
      created_at: a.created_at,
      unitLabel: unitMap.get(a.unit_id) ?? "Unidad",
      residentName: nameById.get(a.triggered_by) ?? "Residente",
    }));
  }

  const shiftStart = new Date();
  shiftStart.setHours(shiftStart.getHours() - 12);

  const [{ data: recentVisitors }, { data: recentDeliveries }] =
    await Promise.all([
      unitIds.length > 0
        ? supabase
            .from("visitors")
            .select(
              "id, visitor_name, status, entry_time, created_at, unit_id",
            )
            .in("unit_id", unitIds)
            .gte("created_at", shiftStart.toISOString())
            .order("created_at", { ascending: false })
            .limit(15)
        : Promise.resolve({ data: [] }),
      unitIds.length > 0
        ? supabase
            .from("deliveries")
            .select(
              "id, courier_company, package_details, status, created_at, unit_id",
            )
            .in("unit_id", unitIds)
            .gte("created_at", shiftStart.toISOString())
            .order("created_at", { ascending: false })
            .limit(15)
        : Promise.resolve({ data: [] }),
    ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackgroundPanel
        bgImageUrls={getDashboardBackgrounds("security")}
        overlayOpacity="bg-slate-950/70"
        priority
        rounded="3xl"
        carouselIntervalMs={8000}
        contentClassName="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6"
      >
        <div>
          <p className="nexora-text-on-dark flex items-center gap-1.5 text-sm font-medium text-slate-200">
            <Shield className="size-4" aria-hidden />
            Portería · {complex.name}
          </p>
          <h1 className="nexora-text-on-dark font-display text-2xl font-semibold text-white sm:text-3xl">
            Consola de seguridad
          </h1>
          <p className="nexora-text-on-dark mt-1 text-sm text-slate-200">
            Hola{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.
            Alertas, ingresos y encomiendas en tiempo real.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            href="/dashboard/security/utilities"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/25"
          >
            Recibos de servicios
          </Link>
          <Link
            href="/dashboard/security/logbook"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/25"
          >
            Bitácora de relevos
          </Link>
          <Link
            href="/dashboard/security/vehicles"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/25"
          >
            Verificar placa
          </Link>
          <Link
            href="/dashboard/security/deliveries"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--surface)] px-4 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Entregar paquetes
          </Link>
        </div>
      </BackgroundPanel>

      {/* Alertas rojas sobre superficie clara: máximo contraste táctil */}
      <EmergencyAlertsBanner
        complexId={complex.id}
        unitIds={unitIds}
        initialAlerts={initialAlerts}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard as="div" padding="none" className="overflow-hidden">
          <QrCheckInPanel />
        </GlassCard>
        <GlassCard as="div" padding="none" className="overflow-hidden">
          <DeliveryFormPanel units={units ?? []} />
        </GlassCard>
      </div>

      <GlassCard as="section" padding="md">
        <RecentActivityPanel
          visitors={(recentVisitors ?? []).map((v) => ({
            id: v.id,
            visitor_name: v.visitor_name,
            status: v.status,
            entry_time: v.entry_time,
            created_at: v.created_at,
            unitLabel: unitMap.get(v.unit_id) ?? "Unidad",
          }))}
          deliveries={(recentDeliveries ?? []).map((d) => ({
            id: d.id,
            courier_company: d.courier_company,
            package_details: d.package_details,
            status: d.status,
            created_at: d.created_at,
            unitLabel: unitMap.get(d.unit_id) ?? "Unidad",
          }))}
        />
      </GlassCard>
    </div>
  );
}
