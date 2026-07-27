"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Upload,
  Wallet,
} from "lucide-react";
import {
  uploadPaymentProofAction,
  type FinanceActionState,
} from "@/lib/actions/finances";
import {
  UTILITY_SERVICE_LABELS,
  formatCurrencyCOP,
  type UtilityServiceType,
} from "@/lib/community";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, cn } from "@/lib/utils";

export type ResidentFeeCard = {
  paymentId: string;
  status: string;
  period_name: string;
  due_date: string;
  amount: number;
  bank_details: string | null;
  payment_link: string | null;
  payment_proof_url: string | null;
};

export type ResidentUtilityBill = {
  id: string;
  service_type: string;
  period_name: string | null;
  verification_code: string | null;
  received_at: string;
  status: string;
  delivered_at: string | null;
};

interface ResidentFinancesClientProps {
  fee: ResidentFeeCard | null;
  bills: ResidentUtilityBill[];
}

type TabKey = "admin" | "utilities";

export function ResidentFinancesClient({
  fee,
  bills,
}: ResidentFinancesClientProps) {
  const [tab, setTab] = useState<TabKey>("admin");
  const pendingBills = bills.filter((b) => b.status === "PENDING");
  const pickedBills = bills.filter((b) => b.status === "PICKED_UP");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--slate-100)] p-1">
        <button
          type="button"
          onClick={() => setTab("admin")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            tab === "admin"
              ? "bg-[var(--surface)] text-[var(--brand)] shadow-sm"
              : "text-[var(--muted)]",
          )}
        >
          <Wallet className="size-4" aria-hidden />
          Administración
        </button>
        <button
          type="button"
          onClick={() => setTab("utilities")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            tab === "utilities"
              ? "bg-[var(--surface)] text-amber-800 shadow-sm"
              : "text-[var(--muted)]",
          )}
        >
          <FileText className="size-4" aria-hidden />
          Recibos ({pendingBills.length})
        </button>
      </div>

      {tab === "admin" ? (
        <AdminFeeSection fee={fee} />
      ) : (
        <UtilitiesSection pending={pendingBills} history={pickedBills} />
      )}
    </div>
  );
}

function AdminFeeSection({ fee }: { fee: ResidentFeeCard | null }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    uploadPaymentProofAction,
    {} as FinanceActionState,
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  if (!fee) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
        No hay cuota de administración publicada para este mes.
      </p>
    );
  }

  const statusVariant =
    fee.status === "VERIFIED"
      ? "success"
      : fee.status === "PAID"
        ? "warning"
        : "muted";

  const statusLabel =
    fee.status === "VERIFIED"
      ? "Verificado"
      : fee.status === "PAID"
        ? "Comprobante enviado"
        : "Pendiente de pago";

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">Cuota de administración</p>
          <h2 className="font-display text-xl font-semibold">{fee.period_name}</h2>
          <p className="mt-1 text-2xl font-semibold text-[var(--brand)]">
            {formatCurrencyCOP(fee.amount)}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
            <Clock className="size-3.5" aria-hidden />
            Vence {formatDate(`${fee.due_date}T12:00:00`)}
          </p>
        </div>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>

      {fee.bank_details && (
        <pre className="whitespace-pre-wrap rounded-xl bg-[var(--slate-100)] px-3 py-2 text-xs text-[var(--slate-700)]">
          {fee.bank_details}
        </pre>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {fee.payment_link && (
          <a
            href={fee.payment_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white hover:bg-[var(--brand-hover)]"
          >
            <ExternalLink className="size-4" aria-hidden />
            Ir a pagar
          </a>
        )}
      </div>

      {fee.status !== "VERIFIED" && (
        <form action={formAction} className="space-y-3 border-t border-[var(--border)] pt-4">
          <input type="hidden" name="paymentId" value={fee.paymentId} />
          <p className="text-sm font-medium">Subir comprobante</p>
          <label
            htmlFor="proof"
            className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--slate-100)] px-3 text-sm text-[var(--muted)] hover:border-[var(--brand)]/40"
          >
            <Upload className="size-4" aria-hidden />
            Imagen o PDF
          </label>
          <input
            id="proof"
            name="proof"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            required
            className="sr-only"
          />
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}
          {state.success && state.message && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {state.message}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Subiendo…" : "Enviar comprobante"}
          </Button>
        </form>
      )}

      {fee.status === "VERIFIED" && (
        <p className="flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="size-4" aria-hidden />
          Pago verificado por administración.
        </p>
      )}

      {fee.payment_proof_url && fee.status !== "PENDING" && (
        <a
          href={fee.payment_proof_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[var(--brand)] hover:underline"
        >
          Ver mi comprobante
        </a>
      )}
    </div>
  );
}

function UtilitiesSection({
  pending,
  history,
}: {
  pending: ResidentUtilityBill[];
  history: ResidentUtilityBill[];
}) {
  return (
    <div className="space-y-4">
      {pending.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          No tienes recibos pendientes en portería.
        </p>
      ) : (
        <ul className="space-y-3">
          {pending.map((b) => (
            <li
              key={b.id}
              className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {UTILITY_SERVICE_LABELS[
                      b.service_type as UtilityServiceType
                    ] ?? b.service_type}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {b.period_name ? `${b.period_name} · ` : ""}
                    {formatDateTime(b.received_at)}
                  </p>
                </div>
                <Badge variant="warning">PENDING</Badge>
              </div>
              <div className="mt-3 rounded-xl border border-amber-200 bg-[var(--surface)] px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                  PIN de retiro
                </p>
                <p className="mt-1 font-mono text-3xl font-bold tracking-[0.35em] text-[var(--brand)]">
                  {b.verification_code ?? "————"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--slate-700)]">
            Historial
          </h3>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {history.map((b) => (
              <li key={b.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {UTILITY_SERVICE_LABELS[
                    b.service_type as UtilityServiceType
                  ] ?? b.service_type}
                </span>
                <Badge variant="success">Entregado</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
