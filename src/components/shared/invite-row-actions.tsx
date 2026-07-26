"use client";

import { useState, useTransition } from "react";
import { QrCode, Trash2 } from "lucide-react";
import { deleteInviteAction } from "@/lib/actions/invites";
import { Button } from "@/components/ui/button";
import { CopyInviteButton } from "@/components/shared/copy-invite-button";
import { InviteQrCard } from "@/components/shared/invite-qr-card";

interface InviteRowActionsProps {
  inviteId: string;
  url: string;
  label?: string;
  /** Enlaces sin usos o inactivos se pueden limpiar con más confianza */
  canDelete?: boolean;
}

export function InviteRowActions({
  inviteId,
  url,
  label,
  canDelete = true,
}: InviteRowActionsProps) {
  const [showQr, setShowQr] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    const ok = window.confirm(
      "¿Eliminar esta invitación? El enlace y el QR dejarán de funcionar.",
    );
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteInviteAction(inviteId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <CopyInviteButton url={url} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowQr((v) => !v)}
        >
          <QrCode className="size-4" aria-hidden />
          {showQr ? "Ocultar QR" : "Ver QR"}
        </Button>
        {canDelete && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={handleDelete}
            className="text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            <Trash2 className="size-4" aria-hidden />
            {pending ? "Eliminando…" : "Eliminar"}
          </Button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {showQr && (
        <InviteQrCard
          url={url}
          title={label ? `QR — ${label}` : "Código QR"}
          size={160}
        />
      )}
    </div>
  );
}
