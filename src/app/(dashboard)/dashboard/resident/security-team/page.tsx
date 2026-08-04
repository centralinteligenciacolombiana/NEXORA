import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Moon, Shield, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OnDutySecurityLive } from "@/components/shared/on-duty-security-live";
import { fetchOnDutyGuards } from "@/lib/on-duty-security";

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

  const onDuty = await fetchOnDutyGuards(supabase, complex.id);
  const dayGuards = onDuty.filter((t) => t.shiftType === "DAY");
  const nightGuards = onDuty.filter((t) => t.shiftType === "NIGHT");

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
            Quién está de turno ahora en {complex.name} (se actualiza en vivo)
          </p>
        </div>
      </div>

      <OnDutySecurityLive
        complexId={complex.id}
        initialGuards={onDuty}
        title="En turno ahora"
        emptyMessage="No hay turnos de seguridad activos en este momento."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <ShiftBucket
          title="Turno día"
          icon={<Sun className="size-4" aria-hidden />}
          count={dayGuards.length}
        />
        <ShiftBucket
          title="Turno noche"
          icon={<Moon className="size-4" aria-hidden />}
          count={nightGuards.length}
        />
      </div>
    </div>
  );
}

function ShiftBucket({
  title,
  icon,
  count,
}: {
  title: string;
  icon: ReactNode;
  count: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--slate-700)]">
        {icon}
        {title}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold">{count}</p>
      <p className="text-xs text-[var(--muted)]">
        {count === 1 ? "persona" : "personas"}
      </p>
    </div>
  );
}
