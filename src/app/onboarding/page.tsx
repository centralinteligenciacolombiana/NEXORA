import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ROLE_DASHBOARD, type UserRole } from "@/types";

/**
 * Usuarios autenticados sin conjunto: completar registro de conjunto
 * o esperar/abrir un enlace de invitación.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.complex_id) {
    const role = (profile.role as UserRole) ?? "RESIDENT";
    redirect(ROLE_DASHBOARD[role]);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
      <p className="font-display text-sm font-semibold tracking-wide text-[var(--brand)]">
        NEXORA
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold">
        Hola{profile?.full_name ? `, ${profile.full_name}` : ""}
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        Tu cuenta aún no está vinculada a un conjunto. Elige una opción:
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/register/complex/complete"
          className="rounded-xl border border-black/10 bg-[var(--surface)] px-5 py-4 transition-colors hover:border-[var(--brand)]"
        >
          <span className="block font-semibold text-[var(--foreground)]">
            Soy administrador
          </span>
          <span className="mt-1 block text-sm text-[var(--muted)]">
            Completar el registro de un conjunto nuevo (serás el primer admin).
          </span>
        </Link>

        <div className="rounded-xl border border-dashed border-black/15 bg-[var(--surface)]/70 px-5 py-4">
          <span className="block font-semibold text-[var(--foreground)]">
            Soy residente o personal
          </span>
          <span className="mt-1 block text-sm text-[var(--muted)]">
            Abre el enlace de invitación que te envió tu administración
            (WhatsApp, correo, etc.). Ese link ya define tu conjunto.
          </span>
        </div>
      </div>
    </main>
  );
}
