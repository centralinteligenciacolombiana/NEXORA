import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/background-panel";
import { Badge } from "@/components/ui/badge";
import {
  SECURITY_POST_LABELS,
  SHIFT_TYPE_LABELS,
  type SecurityPost,
  type ShiftType,
} from "@/lib/security";
import { formatDateTime } from "@/lib/utils";

export default async function AdminSecurityReportsPage() {
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

  const { data: reports } = await supabase
    .from("guard_shifts")
    .select(
      "id, guard_id, shift_type, post_assignment, started_at, ended_at, end_report_summary, end_report_incidents, end_report_at",
    )
    .eq("complex_id", profile.complex_id)
    .eq("status", "FINISHED")
    .not("end_report_summary", "is", null)
    .order("ended_at", { ascending: false })
    .limit(40);

  const guardIds = [
    ...new Set((reports ?? []).map((r) => r.guard_id).filter(Boolean)),
  ];
  const nameById = new Map<string, string>();
  if (guardIds.length > 0) {
    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", guardIds);
    for (const p of people ?? []) {
      nameById.set(p.id, p.full_name?.trim() || "Guardia");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--brand)]">
            <ClipboardList className="size-4" aria-hidden />
            Supervisión
          </p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            Reportes de turno
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Consolidados al cerrar cada turno de seguridad. Ideal para jefes de
            seguridad y administración.
          </p>
        </div>
        <Link
          href="/dashboard/admin/settings/security"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Turnos
        </Link>
      </div>

      {(reports ?? []).length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-12 text-center text-sm text-[var(--muted)]">
          Aún no hay reportes de cierre. Aparecerán cuando seguridad finalice un
          turno con su bitácora de cierre.
        </p>
      ) : (
        <ul className="space-y-3">
          {(reports ?? []).map((r) => {
            const post = r.post_assignment as SecurityPost | null;
            const shift = r.shift_type as ShiftType;
            return (
              <li key={r.id}>
                <GlassCard as="article" padding="md">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">
                      {nameById.get(r.guard_id) ?? "Guardia"}
                    </p>
                    <Badge variant={shift === "DAY" ? "warning" : "muted"}>
                      {SHIFT_TYPE_LABELS[shift]}
                    </Badge>
                    {post ? (
                      <Badge variant="default">
                        {SECURITY_POST_LABELS[post]}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {r.started_at ? formatDateTime(r.started_at) : "—"} →{" "}
                    {r.ended_at ? formatDateTime(r.ended_at) : "—"}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--slate-700)]">
                    {r.end_report_summary}
                  </p>
                  {r.end_report_incidents ? (
                    <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      <p className="text-xs font-semibold uppercase tracking-wide">
                        Novedades
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {r.end_report_incidents}
                      </p>
                    </div>
                  ) : null}
                </GlassCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
