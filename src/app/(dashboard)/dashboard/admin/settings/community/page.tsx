import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TrashScheduleForm } from "@/components/admin/trash-schedule-form";

export default async function AdminCommunitySettingsPage() {
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

  const { data: complex } = await supabase
    .from("complexes")
    .select("id, name, trash_days, trash_time, trash_notes")
    .eq("id", profile.complex_id)
    .single();

  if (!complex) redirect("/dashboard/admin");

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--brand)]">
            <Trash2 className="size-4" aria-hidden />
            Comunidad
          </p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            Horarios comunitarios
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Configura recolección de basura para {complex.name}.
          </p>
        </div>
        <Link
          href="/dashboard/admin/settings"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Configuración
        </Link>
      </div>

      <TrashScheduleForm
        initialDays={(complex.trash_days as string[] | null) ?? []}
        initialTime={complex.trash_time ?? ""}
        initialNotes={complex.trash_notes ?? ""}
      />
    </div>
  );
}
