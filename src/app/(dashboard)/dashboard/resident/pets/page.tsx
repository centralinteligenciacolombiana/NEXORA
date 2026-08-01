import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, PawPrint } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ResidentPetsClient,
  type ResidentPetRow,
} from "@/components/resident/resident-pets-client";

export default async function ResidentPetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id, unit_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "RESIDENT") {
    redirect("/login");
  }

  if (!profile.unit_id) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Link
          href="/dashboard/resident"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver al inicio
        </Link>
        <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          Necesitas una unidad asignada para registrar mascotas.
        </p>
      </div>
    );
  }

  const { data: rows } = await supabase
    .from("pets")
    .select("id, name, species, breed, photo_url")
    .eq("unit_id", profile.unit_id)
    .order("created_at", { ascending: false });

  const pets: ResidentPetRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    species: r.species,
    breed: r.breed ?? null,
    photo_url: r.photo_url,
  }));

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
          <PawPrint className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">Mascotas</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Registra las mascotas de tu unidad.
          </p>
        </div>
      </div>

      <ResidentPetsClient pets={pets} />
    </div>
  );
}
