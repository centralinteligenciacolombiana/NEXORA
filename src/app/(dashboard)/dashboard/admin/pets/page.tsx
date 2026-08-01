import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, PawPrint } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/background-panel";
import { Badge } from "@/components/ui/badge";

export default async function AdminPetsPage() {
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
    redirect("/login");
  }

  const { data: units } = await supabase
    .from("units")
    .select("id, number, tower")
    .eq("complex_id", profile.complex_id);

  const unitIds = (units ?? []).map((u) => u.id);
  const unitLabel = new Map(
    (units ?? []).map((u) => [
      u.id,
      [u.tower, `Apto ${u.number}`].filter(Boolean).join(" · "),
    ]),
  );

  const { data: pets } =
    unitIds.length > 0
      ? await supabase
          .from("pets")
          .select("id, name, species, breed, photo_url, unit_id, created_at")
          .in("unit_id", unitIds)
          .order("created_at", { ascending: false })
      : { data: [] as never[] };

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <Link
        href="/dashboard/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <PawPrint className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Mascotas del conjunto
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Vista de control · solo lectura
          </p>
        </div>
      </div>

      {(pets ?? []).length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          No hay mascotas registradas aún.
        </p>
      ) : (
        <ul className="space-y-3">
          {(pets ?? []).map((p) => (
            <li key={p.id}>
              <GlassCard as="article" padding="md">
                <div className="flex gap-3">
                  {p.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photo_url}
                      alt=""
                      className="size-14 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="flex size-14 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                      <PawPrint className="size-5" aria-hidden />
                    </span>
                  )}
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {unitLabel.get(p.unit_id) ?? "Unidad"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge variant="default">{p.species}</Badge>
                      {p.breed ? (
                        <Badge variant="muted">{p.breed}</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
