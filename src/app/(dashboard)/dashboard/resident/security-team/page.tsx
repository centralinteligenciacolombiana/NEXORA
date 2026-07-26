import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Moon, Shield, Sun, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

type ActiveGuard = {
  shiftId: string;
  shiftType: "DAY" | "NIGHT";
  startedAt: string;
  fullName: string;
  avatarUrl: string | null;
};

export default async function ResidentSecurityTeamPage() {
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

  const { data: complex } = await supabase
    .from("complexes")
    .select("id, name")
    .eq("id", profile.complex_id)
    .maybeSingle();

  if (!complex) redirect("/login");

  const { data: shifts } = await supabase
    .from("guard_shifts")
    .select("id, shift_type, started_at, guard_id")
    .eq("complex_id", complex.id)
    .eq("status", "ACTIVE")
    .order("started_at", { ascending: true });

  const guardIds = [...new Set((shifts ?? []).map((s) => s.guard_id))];
  const profileById = new Map<
    string,
    { full_name: string | null; avatar_url: string | null }
  >();

  if (guardIds.length > 0) {
    const { data: guards } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", guardIds);
    for (const g of guards ?? []) {
      profileById.set(g.id, {
        full_name: g.full_name,
        avatar_url: g.avatar_url,
      });
    }
  }

  const team: ActiveGuard[] = (shifts ?? []).map((s) => {
    const g = profileById.get(s.guard_id);
    return {
      shiftId: s.id,
      shiftType: s.shift_type as "DAY" | "NIGHT",
      startedAt: s.started_at,
      fullName: g?.full_name?.trim() || "Personal de seguridad",
      avatarUrl: g?.avatar_url ?? null,
    };
  });

  const dayGuards = team.filter((t) => t.shiftType === "DAY");
  const nightGuards = team.filter((t) => t.shiftType === "NIGHT");

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <Link
        href="/dashboard/resident"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver al inicio
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Shield className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Personal de seguridad
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Turnos activos hoy en {complex.name}
          </p>
        </div>
      </div>

      {team.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-12 text-center text-sm text-[var(--muted)]">
          No hay turnos de seguridad activos en este momento.
        </p>
      ) : (
        <div className="space-y-5">
          <GuardSection
            title="Turno Día"
            icon={<Sun className="size-4" aria-hidden />}
            guards={dayGuards}
            empty="Nadie asignado al turno de día."
          />
          <GuardSection
            title="Turno Noche"
            icon={<Moon className="size-4" aria-hidden />}
            guards={nightGuards}
            empty="Nadie asignado al turno de noche."
          />
        </div>
      )}
    </div>
  );
}

function GuardSection({
  title,
  icon,
  guards,
  empty,
}: {
  title: string;
  icon: ReactNode;
  guards: ActiveGuard[];
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--slate-700)]">
        {icon}
        {title}
      </h2>
      {guards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-white px-4 py-6 text-center text-sm text-[var(--muted)]">
          {empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {guards.map((g) => (
            <li
              key={g.shiftId}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm"
            >
              {g.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={g.avatarUrl}
                  alt=""
                  className="size-14 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-14 items-center justify-center rounded-full bg-[var(--slate-100)] text-[var(--muted)]">
                  <UserRound className="size-6" aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{g.fullName}</p>
                <p className="text-xs text-[var(--muted)]">
                  Desde {formatDateTime(g.startedAt)}
                </p>
              </div>
              <Badge variant={g.shiftType === "DAY" ? "warning" : "muted"}>
                {g.shiftType === "DAY" ? "Día" : "Noche"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
