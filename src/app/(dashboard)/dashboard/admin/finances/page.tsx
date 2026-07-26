import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSignedStorageUrl } from "@/lib/supabase/storage";
import {
  AdminFinancesClient,
  type AdminFeeNoticeView,
  type AdminPaymentProofView,
} from "@/components/admin/admin-finances-client";

function unitLabel(tower: string | null | undefined, number: string) {
  return [tower, `Apto ${number}`].filter(Boolean).join(" · ");
}

export default async function AdminFinancesPage() {
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

  const { data: noticesRaw } = await supabase
    .from("admin_fee_notices")
    .select(
      "id, period_name, due_date, amount, bank_details, payment_link, created_at",
    )
    .eq("complex_id", profile.complex_id)
    .order("due_date", { ascending: false });

  const noticeIds = (noticesRaw ?? []).map((n) => n.id);

  const { data: allPayments } =
    noticeIds.length > 0
      ? await supabase
          .from("unit_payments")
          .select(
            "id, status, payment_proof_url, paid_at, unit_id, fee_notice_id, units!inner(number, tower)",
          )
          .in("fee_notice_id", noticeIds)
      : { data: [] as never[] };

  const notices: AdminFeeNoticeView[] = (noticesRaw ?? []).map((n) => {
    const payments = (allPayments ?? []).filter(
      (p) => p.fee_notice_id === n.id,
    );
    return {
      id: n.id,
      period_name: n.period_name,
      due_date: n.due_date,
      amount: Number(n.amount),
      bank_details: n.bank_details,
      payment_link: n.payment_link,
      created_at: n.created_at,
      pendingCount: payments.filter((p) => p.status === "PENDING").length,
      paidCount: payments.filter((p) => p.status === "PAID").length,
      verifiedCount: payments.filter((p) => p.status === "VERIFIED").length,
    };
  });

  const noticeById = new Map((noticesRaw ?? []).map((n) => [n.id, n]));

  const paidPayments = (allPayments ?? []).filter((p) => p.status === "PAID");
  const signedProofUrls = await Promise.all(
    paidPayments.map((p) =>
      getSignedStorageUrl("payment-proofs", p.payment_proof_url),
    ),
  );

  const proofs: AdminPaymentProofView[] = paidPayments.map((p, i) => {
    const unit = Array.isArray(p.units) ? p.units[0] : p.units;
    const unitRow = unit as { number?: string; tower?: string | null } | null;
    const notice = noticeById.get(p.fee_notice_id);
    return {
      id: p.id,
      status: p.status,
      payment_proof_url: signedProofUrls[i] ?? null,
      paid_at: p.paid_at,
      unitLabel: unitLabel(unitRow?.tower, unitRow?.number ?? "?"),
      period_name: notice?.period_name ?? "—",
      amount: Number(notice?.amount ?? 0),
    };
  });

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--brand)]">
            <Wallet className="size-4" aria-hidden />
            Finanzas
          </p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            Cuota de administración
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Publica avisos, envía recordatorios y verifica comprobantes.
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

      <AdminFinancesClient notices={notices} proofs={proofs} />
    </div>
  );
}
