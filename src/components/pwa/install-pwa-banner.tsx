"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * Banner opcional para instalar NEXORA cuando el navegador lo permite.
 */
export function InstallPwaBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (localStorage.getItem("nexora-pwa-dismissed") === "1") {
        setDismissed(true);
      }
    } catch {
      // ignore
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  if (dismissed || !deferred) return null;

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem("nexora-pwa-dismissed", "1");
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="fixed inset-x-0 bottom-20 z-50 mx-auto w-[min(100%-1.5rem,28rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-lg backdrop-blur-md sm:bottom-6"
      role="dialog"
      aria-label="Instalar NEXORA"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Download className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instalar NEXORA</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Acceso rápido desde tu pantalla de inicio, como una app.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => void handleInstall()}>
              Instalar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
            >
              Ahora no
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
