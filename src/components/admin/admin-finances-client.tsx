"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Mail, Wallet } from "lucide-react";
import {
  publishAdminFeeNoticeAction,
  sendFeeRemindersAction,
  verifyUnitPaymentAction,
  type FinanceActionState,
} from "@/lib/actions/finances";
import { formatCurrencyCOP } from "@/lib/community";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

export type AdminFeeNoticeView = {
  id: string;
  period_name: string;
  due_date: string;
  amount: number;
  bank_details: string | null;
  payment_link: string | null;
  created_at: string;
  pendingCount: number;
  paidCount: number;
  verifiedCount: number;
};

export type AdminPaymentProofView = {
  id: string;
  status: string;
  payment_proof_url: string | null;
  paid_at: string | null;
  unitLabel: string;
  period_name: string;
  amount: number;
};

interface AdminFinancesClientProps {
  notices: AdminFeeNoticeView[];
  proofs: AdminPaymentProofView[];
}

export function AdminFinancesClient({
  notices,
  proofs,
}: AdminFinancesClientProps) {
  const router = useRouter();
  const [publishState, publishAction, publishing] = useActionState(
    publishAdminFeeNoticeAction,
    {} as FinanceActionState,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onRemind(noticeId: string) {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const result = await sendFeeRemindersAction(noticeId);
      if (result.error) {
        setErr(result.error);
        return;
      }
      setMsg(result.message ?? "Recordatorios enviados.");
    });
  }

  function onVerify(paymentId: string) {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const result = await verifyUnitPaymentAction(paymentId);
      if (result.error) {
        setErr(result.error);
        return;
      }
      setMsg(result.message ?? "Verificado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <form
        action={publishAction}
        className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5"
      >
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-[var(--brand)]" aria-hidden />
          <h2 className="font-semibold">Publicar cuota del mes</h2>
        </div>

        <Input
          name="periodName"
          label="Periodo"
          required
          placeholder="Julio 2026"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="dueDate" label="Fecha límite" type="date" required />
          <Input
            name="amount"
            label="Valor (COP)"
            type="number"
            min="0"
            step="1000"
            required
            placeholder="250000"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bank-details" className="text-sm font-medium">
            Datos bancarios / instrucciones
          </label>
          <textarea
            id="bank-details"
            name="bankDetails"
            rows={3}
            placeholder="Banco, cuenta, titular, NIT…"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
          />
        </div>
        <Input
          name="paymentLink"
          label="Link de pago (PSE / Wompi)"
          type="url"
          placeholder="https://…"
        />

        {publishState.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {publishState.error}
          </p>
        )}
        {publishState.success && publishState.message && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {publishState.message}
          </p>
        )}

        <Button type="submit" disabled={publishing} className="w-full sm:w-auto">
          {publishing ? "Publicando…" : "Publicar aviso"}
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">Avisos publicados</h2>
        {notices.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            Aún no hay cuotas publicadas.
          </p>
        ) : (
          <ul className="space-y-3">
            {notices.map((n) => (
              <li
                key={n.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{n.period_name}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {formatCurrencyCOP(n.amount)} · Vence{" "}
                      {formatDate(`${n.due_date}T12:00:00`)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--slate-500)]">
                      Pendientes {n.pendingCount} · Reportados {n.paidCount} ·
                      Verificados {n.verifiedCount}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3 min-h-10"
                  disabled={pending || n.pendingCount === 0}
                  onClick={() => onRemind(n.id)}
                >
                  <Mail className="size-3.5" aria-hidden />
                  Enviar recordatorio por correo
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Comprobantes por verificar</h2>
        {proofs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            No hay comprobantes pendientes.
          </p>
        ) : (
          <ul className="space-y-3">
            {proofs.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{p.unitLabel}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {p.period_name} · {formatCurrencyCOP(p.amount)}
                    </p>
                    <Badge variant="warning" className="mt-1.5">
                      {p.status}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() => onVerify(p.id)}
                  >
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    Verificar
                  </Button>
                </div>
                {p.payment_proof_url && (
                  <a
                    href={p.payment_proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block text-sm font-medium text-[var(--brand)] hover:underline"
                  >
                    Ver comprobante
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {err && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
      )}
      {msg && !err && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </p>
      )}
    </div>
  );
}
