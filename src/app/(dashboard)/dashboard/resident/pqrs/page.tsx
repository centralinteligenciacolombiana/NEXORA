import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MessageSquareWarning } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CreatePqrsForm } from "@/components/resident/create-pqrs-form";
import {
  PqrsTicketList,
  type PqrsListItem,
} from "@/components/shared/pqrs-ticket-list";

export default async function ResidentPqrsPage() {
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
    .from("maintenance_tickets")
    .select(
      "id, radicado, title, type, status, priority, created_at, location_details",
    )
    .eq("complex_id", profile.complex_id)
    .eq("created_by", user.id)
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
          <MessageSquareWarning className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">PQRS y fallas</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Reporta novedades y sigue el radicado.
          </p>
        </div>
      </div>

      <CreatePqrsForm />

      <section className="space-y-3">
        <h2 className="font-semibold">Mis solicitudes</h2>
        <PqrsTicketList
          tickets={tickets}
          hrefBase="/dashboard/resident/pqrs"
          emptyMessage="Aún no has radicado solicitudes."
        />
      </section>
    </div>
  );
}
