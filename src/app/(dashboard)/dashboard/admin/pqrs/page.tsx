import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MessageSquareWarning } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminPqrsBoard } from "@/components/admin/admin-pqrs-board";
import type { PqrsListItem } from "@/components/shared/pqrs-ticket-list";

export default async function AdminPqrsPage() {
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
    .from("maintenance_tickets")
    .select(
      "id, radicado, title, type, status, priority, created_at, location_details",
    )
    .eq("complex_id", profile.complex_id)
    .order("created_at", { ascending: false });

  const tickets: PqrsListItem[] = (rows ?? []).map((t) => ({
    id: t.id,
    radicado: t.radicado,
    title: t.title,
    type: t.type,
    status: t.status,
    priority: t.priority,
    created_at: t.created_at,
    location_details: t.location_details,
  }));

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--brand)]">
            <MessageSquareWarning className="size-4" aria-hidden />
            Gestión
          </p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            PQRS y mantenimiento
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"} · lista / kanban
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

      <AdminPqrsBoard tickets={tickets} />
    </div>
  );
}
