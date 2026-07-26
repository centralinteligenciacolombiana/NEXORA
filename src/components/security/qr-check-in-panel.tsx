"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Keyboard, ScanLine } from "lucide-react";
import {
  checkInVisitorByQrAction,
  type SecurityActionState,
} from "@/lib/actions/security";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QrCheckInPanel() {
  const [mode, setMode] = useState<"manual" | "camera">("manual");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, formAction, pending] = useActionState(
    checkInVisitorByQrAction,
    {} as SecurityActionState,
  );

  useEffect(() => {
    if (mode !== "camera") {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }

    let cancelled = false;
    setCameraError(null);

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraError(
          "No se pudo abrir la cámara. Usa el ingreso manual del código.",
        );
        setMode("manual");
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [mode]);

  return (
    <section className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <ScanLine className="size-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Escaner / lector de QR</h2>
          <p className="text-sm text-[var(--muted)]">
            Valida el pase de visita con cámara o código manual.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={mode === "camera" ? "primary" : "secondary"}
          size="lg"
          className="min-h-12"
          onClick={() => setMode("camera")}
        >
          <Camera className="size-4" aria-hidden />
          Cámara
        </Button>
        <Button
          type="button"
          variant={mode === "manual" ? "primary" : "secondary"}
          size="lg"
          className="min-h-12"
          onClick={() => setMode("manual")}
        >
          <Keyboard className="size-4" aria-hidden />
          Manual
        </Button>
      </div>

      {mode === "camera" && (
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-black">
          <video
            ref={videoRef}
            className="aspect-[4/3] w-full object-cover"
            playsInline
            muted
          />
          <p className="bg-slate-900 px-3 py-2 text-center text-xs text-slate-300">
            Apunta al QR y escribe/pega el código abajo para confirmar el
            ingreso.
          </p>
        </div>
      )}

      {cameraError && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {cameraError}
        </p>
      )}

      <form action={formAction} className="mt-4 space-y-3">
        <Input
          name="qrCode"
          label="Código del pase"
          placeholder="Pega o escribe el código QR"
          required
          className="h-12 text-base"
          autoComplete="off"
        />
        <Button
          type="submit"
          size="lg"
          className="min-h-12 w-full"
          disabled={pending}
        >
          {pending ? "Validando…" : "Registrar ingreso"}
        </Button>
      </form>

      {state.error && (
        <div
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
          role="alert"
        >
          <p className="text-sm font-semibold text-red-800">
            {state.authorized === false ? "No autorizado" : "Error"}
          </p>
          <p className="mt-1 text-sm text-red-700">{state.error}</p>
          {(state.visitorName || state.unitLabel || state.accessLabel) && (
            <p className="mt-2 text-sm text-red-800">
              {[state.visitorName, state.unitLabel, state.accessLabel]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      )}

      {state.success && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-[var(--emerald-soft)] px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <CheckCircle2 className="size-4" aria-hidden />
            {state.message}
          </p>
          {(state.visitorName || state.unitLabel || state.accessLabel) && (
            <p className="mt-1 text-sm text-emerald-800">
              {[state.visitorName, state.unitLabel, state.accessLabel]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
