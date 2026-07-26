import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  AdminProjectsClient,
  type AdminProjectRow,
} from "@/components/admin/admin-projects-client";
import type { ProjectStatus } from "@/lib/projects-voting";

export default async function AdminProjectsPage() {
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

  const { data: rows } = await supabase
    .from("complex_projects")
    .select(
      "id, title, description, status, year, budget, cover_image_url",
    )
    .eq("complex_id", profile.complex_id)
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });

  const projects: AdminProjectRow[] = (rows ?? []).map((p) => ({
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--brand)]">
            <FolderKanban className="size-4" aria-hidden />
            Proyectos
          </p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            Portafolio de gestión
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Rendición de cuentas por año y estado.
          </p>
        </div>
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver
        </Link>
      </div>

      <AdminProjectsClient
        projects={projects}
        currentYear={new Date().getFullYear()}
      />
    </div>
  );
}
