"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastProps {
  message: string | null;
  variant?: "success" | "error";
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({
  message,
  variant = "success",
  onDismiss,
  durationMs = 4500,
}: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-lg sm:left-auto sm:right-6",
        variant === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : "border-red-200 bg-red-50 text-red-900",
      )}
    >
      {variant === "success" && (
        <CheckCircle2
          className="mt-0.5 size-5 shrink-0 text-emerald-600"
          aria-hidden
        />
      )}
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100"
        aria-label="Cerrar"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, variant: "success" | "error" = "success") => {
      setToast({ message, variant });
    },
    [],
  );

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showToast, dismissToast };
}
