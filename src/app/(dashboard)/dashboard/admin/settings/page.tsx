import Link from "next/link";
import { ArrowLeft, Building2, Shield, Trash2, Trees, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  AddAmenityForm,
  AddUnitForm,
  ComplexSettingsForm,
} from "@/components/shared/complex-settings-forms";
import { Badge } from "@/components/ui/badge";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "ADMIN") {
    redirect("/onboarding");
  }

  const { data: complex } = await supabase
    .from("complexes")
    .select(
      "id, name, address, city, phone, email, description, logo_url, towers",
    )
    .eq("id", profile.complex_id)
    .single();

  if (!complex) {
    redirect("/dashboard/admin");
  }

  const [{ data: units }, { data: amenities }] = await Promise.all([
    supabase
      .from("units")
      .select("id, number, tower, floor")
      .eq("complex_id", complex.id)
      .order("tower", { ascending: true })
      .order("number", { ascending: true }),
    supabase
      .from("amenities")
      .select("id, name, location, capacity, is_active")
      .eq("complex_id", complex.id)
      .order("name", { ascending: true }),
  ]);

  const towers = (complex.towers as string[] | null) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-[var(--muted)]">Configuración</p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            Datos del conjunto
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Prepara torres, unidades, logo y zonas comunes antes de invitar.
          </p>
        </div>
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver al panel
        </Link>
      </div>

      <Link
        href="/dashboard/admin/settings/security"
        className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 shadow-sm transition-colors hover:border-[var(--brand)]/30"
      >
        <span className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
            <Shield className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold">
              Seguridad y bitácora
            </span>
            <span className="block text-xs text-[var(--muted)]">
              Turnos Día/Noche y bitácora de relevos
            </span>
          </span>
        </span>
        <span className="text-xs font-medium text-[var(--brand)]">Abrir</span>
      </Link>

      <Link
        href="/dashboard/admin/settings/community"
        className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 shadow-sm transition-colors hover:border-[var(--brand)]/30"
      >
        <span className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
            <Trash2 className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold">
              Horarios comunitarios
            </span>
            <span className="block text-xs text-[var(--muted)]">
              Recolección de basura y avisos
            </span>
          </span>
        </span>
        <span className="text-xs font-medium text-[var(--brand)]">Abrir</span>
      </Link>

      <Link
        href="/dashboard/admin/finances"
        className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 shadow-sm transition-colors hover:border-[var(--brand)]/30"
      >
        <span className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
            <Wallet className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold">
              Cuota de administración
            </span>
            <span className="block text-xs text-[var(--muted)]">
              Avisos, recordatorios y comprobantes
            </span>
          </span>
        </span>
        <span className="text-xs font-medium text-[var(--brand)]">Abrir</span>
      </Link>

      <ComplexSettingsForm
        initial={{
          name: complex.name ?? "",
          address: complex.address ?? "",
          city: complex.city ?? "",
          phone: complex.phone ?? "",
          email: complex.email ?? "",
          description: complex.description ?? "",
          logoUrl: complex.logo_url ?? "",
          towers: towers.join("\n"),
        }}
      />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-[var(--brand)]" aria-hidden />
          <h2 className="font-semibold">
            Unidades{" "}
            <span className="text-sm font-normal text-[var(--muted)]">
              ({units?.length ?? 0})
            </span>
          </h2>
        </div>
        <AddUnitForm towers={towers} />
        {(units ?? []).length > 0 && (
          <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-[var(--surface)]">
            {(units ?? []).map((unit) => (
              <li
                key={unit.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="font-medium">
                  {unit.tower ? `${unit.tower} · ` : ""}
                  {unit.number}
                </span>
                {unit.floor != null && (
                  <Badge variant="muted">Piso {unit.floor}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trees className="size-4 text-[var(--brand)]" aria-hidden />
          <h2 className="font-semibold">
            Zonas comunes{" "}
            <span className="text-sm font-normal text-[var(--muted)]">
              ({amenities?.length ?? 0})
            </span>
          </h2>
        </div>
        <AddAmenityForm />
        {(amenities ?? []).length > 0 && (
          <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-[var(--surface)]">
            {(amenities ?? []).map((amenity) => (
              <li
                key={amenity.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{amenity.name}</p>
                  {amenity.location && (
                    <p className="text-xs text-[var(--muted)]">
                      {amenity.location}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {amenity.capacity != null && (
                    <Badge variant="muted">Cap. {amenity.capacity}</Badge>
                  )}
                  <Badge variant={amenity.is_active ? "success" : "muted"}>
                    {amenity.is_active ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
