import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Car } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { VehiclePlateLookup } from "@/components/security/vehicle-plate-lookup";

export default async function SecurityVehiclesPage() {
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

  if (
    !profile?.complex_id ||
    (profile.role !== "SECURITY" && profile.role !== "ADMIN")
  ) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <Link
        href="/dashboard/security"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a seguridad
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Car className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Verificar placa
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Consulta si un vehículo está autorizado en el conjunto.
          </p>
        </div>
      </div>

      <VehiclePlateLookup />
    </div>
  );
}
