import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSignedStorageUrl } from "@/lib/supabase/storage";
import {
  ResidentFinancesClient,
  type ResidentFeeCard,
  type ResidentUtilityBill,
} from "@/components/resident/resident-finances-client";

export default async function ResidentFinancesPage() {
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

  let fee: ResidentFeeCard | null = null;
  let bills: ResidentUtilityBill[] = [];

  if (profile.unit_id) {
    const [{ data: notices }, { data: billsRaw }] = await Promise.all([
      supabase
        .from("admin_fee_notices")
        .select(
          "id, period_name, due_date, amount, bank_details, payment_link",
        )
        .eq("complex_id", profile.complex_id)
        .order("due_date", { ascending: false })
        .limit(1),
      supabase
        .from("utility_bills")
        .select(
          "id, service_type, period_name, verification_code, received_at, status, delivered_at",
        )
        .eq("unit_id", profile.unit_id)
        .order("received_at", { ascending: false })
        .limit(30),
    ]);

    bills = (billsRaw ?? []).map((b) => ({
      id: b.id,
      service_type: b.service_type,
      period_name: b.period_name,
      verification_code: b.verification_code,
      received_at: b.received_at,
      status: b.status,
      delivered_at: b.delivered_at,
    }));

    const latest = notices?.[0];
    if (latest) {
      const { data: payment } = await supabase
        .from("unit_payments")
        .select("id, status, payment_proof_url")
        .eq("fee_notice_id", latest.id)
        .eq("unit_id", profile.unit_id)
        .maybeSingle();

      if (payment) {
        const signedProof = await getSignedStorageUrl(
          "payment-proofs",
          payment.payment_proof_url,
        );
        fee = {
          paymentId: payment.id,
          status: payment.status,
          period_name: latest.period_name,
          due_date: latest.due_date,
          amount: Number(latest.amount),
          bank_details: latest.bank_details,
          payment_link: latest.payment_link,
          payment_proof_url: signedProof,
        };
      }
    }
  }

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
          <Wallet className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Finanzas y recibos
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Cuota de administración y recibos en portería.
          </p>
        </div>
      </div>

      {!profile.unit_id ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          No tienes una unidad asignada. Contacta a la administración.
        </p>
      ) : (
        <ResidentFinancesClient fee={fee} bills={bills} />
      )}
    </div>
  );
}
