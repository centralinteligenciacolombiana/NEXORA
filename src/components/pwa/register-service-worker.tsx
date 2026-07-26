"use client";

import { useEffect } from "react";

/**
 * Registra el service worker en producción (y en localhost) para PWA instalable.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (process.env.NODE_ENV !== "production" && !isLocalhost) return;

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Silencioso: no bloquear la UI si el SW falla (HTTP sin HTTPS, etc.)
    });
  }, []);

  return null;
}
