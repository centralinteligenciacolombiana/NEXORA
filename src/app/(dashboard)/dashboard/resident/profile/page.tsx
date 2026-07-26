import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/lib/actions/auth";
import {
  ResidentProfileForm,
  type ResidentProfileView,
} from "@/components/resident/resident-profile-form";
import { Button } from "@/components/ui/button";
import { occupancyLabel } from "@/lib/occupancy";

export default async function ResidentProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, email, phone, role, complex_id, unit_id, avatar_url, email_confirmed_at, login_code, occupancy_type, is_owner",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "RESIDENT") {
    redirect("/login");
  }

  const [{ data: complex }, { data: unit }] = await Promise.all([
    supabase
      .from("complexes")
      .select("name, city")
      .eq("id", profile.complex_id)
      .maybeSingle(),
    profile.unit_id
      ? supabase
          .from("units")
          .select("number, tower")
          .eq("id", profile.unit_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const view: ResidentProfileView = {
    fullName: profile.full_name?.trim() || "",
    email: profile.email ?? user.email ?? "",
    phone: profile.phone ?? "",
    avatarUrl: profile.avatar_url,
    emailConfirmed: Boolean(profile.email_confirmed_at),
    loginCode: profile.login_code,
    occupancyLabel: occupancyLabel(profile.occupancy_type, profile.is_owner),
    complexName: complex
      ? [complex.name, complex.city].filter(Boolean).join(" · ")
      : "—",
    unitLabel: unit
      ? [unit.tower, `Apto ${unit.number}`].filter(Boolean).join(" · ")
      : "—",
    roleLabel: "Residente",
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Link
        href="/dashboard/resident"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver al inicio
      </Link>

      <div>
        <h1 className="font-display text-2xl font-semibold">Perfil</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Tus datos en el conjunto. Puedes actualizarlos cuando quieras.
        </p>
      </div>

      <ResidentProfileForm profile={view} />

      <form action={logoutAction}>
        <Button type="submit" variant="secondary" className="w-full">
          <LogOut className="size-4" aria-hidden />
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
