import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { ROLE_DASHBOARD, type UserRole } from "@/types";

export default async function PendingApprovalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, email, role, complex_id, unit_id, registration_status, login_code, occupancy_type",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id) {
    redirect("/onboarding");
  }

  const status = profile.registration_status ?? "APPROVED";

  if (status === "APPROVED") {
    redirect(ROLE_DASHBOARD[(profile.role as UserRole) ?? "RESIDENT"]);
  }

  const { data: complex } = await supabase
    .from("complexes")
    .select("name")
    .eq("id", profile.complex_id)
    .maybeSingle();

  const { data: unit } = profile.unit_id
    ? await supabase
        .from("units")
        .select("number, tower")
        .eq("id", profile.unit_id)
        .maybeSingle()
    : { data: null };

  const unitLabel = unit
    ? [unit.tower, `Apto ${unit.number}`].filter(Boolean).join(" · ")
    : null;

  const rejected = status === "REJECTED";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-sm sm:p-8">
        <div
          className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${
            rejected
              ? "bg-red-50 text-red-600"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {rejected ? (
            <ShieldCheck className="size-7" aria-hidden />
          ) : (
            <Clock3 className="size-7" aria-hidden />
          )}
        </div>

        <h1 className="mt-4 font-display text-2xl font-semibold">
          {rejected
            ? "Registro no aprobado"
            : "Tu registro está en revisión"}
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {rejected
            ? "La administración no confirmó tu pertenencia al conjunto. Si crees que es un error, contacta a la administración."
            : `Hola${profile.full_name ? `, ${profile.full_name.split(/\s+/)[0]}` : ""}. Tus datos ya quedaron registrados${complex?.name ? ` en ${complex.name}` : ""}. La administración debe confirmar que perteneces al conjunto antes de darte acceso completo.`}
        </p>

        {!rejected && (
          <ul className="mt-5 space-y-2 rounded-xl bg-[var(--slate-100)] px-4 py-3 text-left text-sm text-[var(--slate-700)]">
            {unitLabel && (
              <li>
                <span className="text-[var(--muted)]">Unidad: </span>
                <strong>{unitLabel}</strong>
              </li>
            )}
            {profile.login_code && (
              <li>
                <span className="text-[var(--muted)]">Usuario: </span>
                <strong>{profile.login_code}</strong>
              </li>
            )}
            <li>
              <span className="text-[var(--muted)]">Correo: </span>
              <strong>{profile.email ?? user.email}</strong>
            </li>
          </ul>
        )}

        {!rejected && (
          <p className="mt-4 text-xs text-[var(--muted)]">
            Puedes cerrar esta ventana. Cuando te aprueben, inicia sesión de
            nuevo y entrarás al panel.
          </p>
        )}

        <form action={logoutAction} className="mt-6">
          <Button type="submit" variant="secondary" className="w-full">
            <LogOut className="size-4" aria-hidden />
            Cerrar sesión
          </Button>
        </form>

        <p className="mt-4 text-xs text-[var(--muted)]">
          ¿Ya te confirmaron?{" "}
          <Link href="/login" className="font-medium text-[var(--brand)] hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
