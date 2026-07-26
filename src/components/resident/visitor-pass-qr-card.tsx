"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { Download, RefreshCw, Ban } from "lucide-react";
import {
  cancelVisitorPassAction,
  renewVisitorPassAction,
} from "@/lib/actions/visitors";
import {
  OPEN_ACCESS_DAY_OPTIONS,
  VISITOR_ACCESS_LABELS,
  isVisitorPassActive,
} from "@/lib/visitors";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { VisitorAccessType, VisitorStatus } from "@/types";

export interface VisitorPassView {
  id: string;
  visitorName: string;
  qrCode: string;
  accessType: VisitorAccessType;
  status: VisitorStatus;
  validFrom: string;
  validUntil: string | null;
  notes: string | null;
  unitLabel: string;
  complexName: string;
}

interface VisitorPassQrCardProps {
  pass: VisitorPassView;
}

export function VisitorPassQrCard({ pass }: VisitorPassQrCardProps) {
  const router = useRouter();
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [renewType, setRenewType] = useState<VisitorAccessType>(pass.accessType);
  const [openDays, setOpenDays] = useState("7");

  const validity = isVisitorPassActive({
    status: pass.status,
    validFrom: pass.validFrom,
    validUntil: pass.validUntil,
  });

  function handleDownload() {
    const canvas = canvasWrapRef.current?.querySelector("canvas");
    if (!canvas) return;

    const exportSize = 512;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = exportSize;
    exportCanvas.height = exportSize;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, exportSize, exportSize);
    ctx.drawImage(canvas, 0, 0, exportSize, exportSize);

    const link = document.createElement("a");
    link.download = `nexora-visita-${pass.visitorName.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  }

  function handleRenew() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await renewVisitorPassAction(
        pass.id,
        renewType,
        Number(openDays),
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Pase renovado.");
      router.refresh();
    });
  }

  function handleCancel() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await cancelVisitorPassAction(pass.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Pase cancelado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold">
              {pass.visitorName}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {pass.complexName} · {pass.unitLabel}
            </p>
          </div>
          <Badge variant={validity.active ? "success" : "danger"}>
            {validity.active ? "Autorizado" : "No autorizado"}
          </Badge>
        </div>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted)]">Tipo</dt>
            <dd className="font-medium">
              {VISITOR_ACCESS_LABELS[pass.accessType]}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Vigente hasta</dt>
            <dd className="font-medium">
              {pass.validUntil ? formatDateTime(pass.validUntil) : "—"}
            </dd>
          </div>
          {pass.notes && (
            <div className="sm:col-span-2">
              <dt className="text-[var(--muted)]">Nota</dt>
              <dd className="font-medium">{pass.notes}</dd>
            </div>
          )}
        </dl>

        {!validity.active && validity.reason && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {validity.reason} Renueva la autorización para generar un QR válido.
          </p>
        )}

        {validity.active && (
          <>
            <div
              ref={canvasWrapRef}
              className="mx-auto mt-5 flex w-fit rounded-xl border border-black/5 bg-white p-3"
            >
              <QRCodeCanvas
                value={pass.qrCode}
                size={200}
                level="M"
                includeMargin
                bgColor="#ffffff"
                fgColor="#0d4f3c"
              />
            </div>
            <p className="mt-2 text-center text-xs text-[var(--muted)]">
              El visitante muestra este QR en portería. Si no lo tiene, seguridad
              puede llamar para autorizar el ingreso.
            </p>
            <code className="mt-3 block overflow-x-auto rounded-lg bg-[var(--background)] px-3 py-2 text-center text-[11px] tracking-wide text-[var(--foreground)]">
              {pass.qrCode}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleDownload}
              className="mt-3 w-full"
            >
              <Download className="size-4" aria-hidden />
              Descargar QR
            </Button>
          </>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <h2 className="font-semibold">Renovar autorización</h2>
        <p className="text-sm text-[var(--muted)]">
          Al renovar se genera un QR nuevo; el anterior deja de servir.
        </p>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Nuevo tipo</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="renewType"
              checked={renewType === "TODAY"}
              onChange={() => setRenewType("TODAY")}
            />
            Solo hoy
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="renewType"
              checked={renewType === "OPEN"}
              onChange={() => setRenewType("OPEN")}
            />
            Acceso libre
          </label>
        </fieldset>

        {renewType === "OPEN" && (
          <Select
            name="openDays"
            label="Duración"
            value={openDays}
            onChange={(e) => setOpenDays(e.target.value)}
          >
            {OPEN_ACCESS_DAY_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days} días
              </option>
            ))}
          </Select>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            size="lg"
            className="flex-1"
            disabled={pending}
            onClick={handleRenew}
          >
            <RefreshCw className="size-4" aria-hidden />
            {pending ? "Renovando…" : "Renovar pase"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="flex-1"
            disabled={pending || pass.status === "CANCELLED"}
            onClick={handleCancel}
          >
            <Ban className="size-4" aria-hidden />
            Cancelar
          </Button>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
