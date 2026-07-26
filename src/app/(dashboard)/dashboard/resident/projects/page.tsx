import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ResidentProjectsGallery,
  type ResidentProjectCard,
} from "@/components/resident/resident-projects-gallery";
import type { ProjectStatus } from "@/lib/projects-voting";

export default async function ResidentProjectsPage() {
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

  const { data: rows } = await supabase
    .from("complex_projects")
    .select(
      "id, title, description, status, year, budget, cover_image_url",
    )
    .eq("complex_id", profile.complex_id)
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });

  const projects: ResidentProjectCard[] = (rows ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    status: p.status as ProjectStatus,
    year: p.year,
    budget: p.budget != null ? Number(p.budget) : null,
    cover_image_url: p.cover_image_url,
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
          <FolderKanban className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Proyectos y rendición
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Portafolio de gestión de la copropiedad.
          </p>
        </div>
      </div>

      <ResidentProjectsGallery projects={projects} />
    </div>
  );
}
