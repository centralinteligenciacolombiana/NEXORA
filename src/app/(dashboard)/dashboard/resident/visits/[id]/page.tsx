import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  VisitorPassQrCard,
  type VisitorPassView,
} from "@/components/resident/visitor-pass-qr-card";
import type { VisitorAccessType, VisitorStatus } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ResidentVisitorPassPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("unit_id, role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "RESIDENT" || !profile.unit_id) {
    redirect("/login");
  }

  const { data: visitor } = await supabase
    .from("visitors")
    .select(
      "id, visitor_name, qr_code, access_type, status, valid_from, valid_until, notes, unit_id",
    )
    .eq("id", id)
    .eq("unit_id", profile.unit_id)
    .maybeSingle();

  if (!visitor?.qr_code) {
    notFound();
  }

  const [{ data: complex }, { data: unit }] = await Promise.all([
    supabase
      .from("complexes")
      .select("name")
      .eq("id", profile.complex_id)
      .maybeSingle(),
    supabase
      .from("units")
      .select("number, tower")
      .eq("id", profile.unit_id)
      .maybeSingle(),
  ]);

  const pass: VisitorPassView = {
    id: visitor.id,
    visitorName: visitor.visitor_name,
    qrCode: visitor.qr_code,
    accessType: (visitor.access_type ?? "TODAY") as VisitorAccessType,
    status: visitor.status as VisitorStatus,
    validFrom: visitor.valid_from,
    validUntil: visitor.valid_until,
    notes: visitor.notes,
    unitLabel: unit
      ? [unit.tower, `Apto ${unit.number}`].filter(Boolean).join(" · ")
      : "—",
    complexName: complex?.name ?? "—",
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Link
        href="/dashboard/resident/visits"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a visitas
      </Link>

      <VisitorPassQrCard pass={pass} />
    </div>
  );
}
