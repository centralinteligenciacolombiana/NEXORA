"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyInviteButton } from "@/components/shared/copy-invite-button";

interface InviteQrCardProps {
  url: string;
  title?: string;
  size?: number;
}

export function InviteQrCard({
  url,
  title = "Código QR de invitación",
  size = 180,
}: InviteQrCardProps) {
  const canvasWrapRef = useRef<HTMLDivElement>(null);

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
    link.download = `nexora-invite-qr-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="rounded-xl border border-black/5 bg-white p-4 sm:p-5">
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Escanea para registrarte o imprime el QR en carteleras de la
        copropiedad.
      </p>

      <div
        ref={canvasWrapRef}
        className="mx-auto mt-4 flex w-fit rounded-xl border border-black/5 bg-white p-3"
      >
        <QRCodeCanvas
          value={url}
          size={size}
          level="M"
          includeMargin
          bgColor="#ffffff"
          fgColor="#0d4f3c"
        />
      </div>

      <code className="mt-3 block overflow-x-auto rounded-lg bg-[var(--background)] px-3 py-2 text-[11px] text-[var(--foreground)]">
        {url}
      </code>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <CopyInviteButton
          url={url}
          label="Copiar enlace"
          variant="primary"
          size="md"
          className="flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={handleDownload}
          className="flex-1"
        >
          <Download className="size-4" aria-hidden />
          Descargar PNG
        </Button>
      </div>
    </div>
  );
}
