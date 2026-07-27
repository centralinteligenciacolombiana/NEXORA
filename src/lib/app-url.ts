/**
 * URL pública de la app (invites, emails, metadata).
 *
 * Prioridad:
 * 1. NEXT_PUBLIC_APP_URL si no es localhost
 * 2. En Netlify: URL / DEPLOY_PRIME_URL
 * 3. Solo en desarrollo: http://localhost:3000
 *
 * En producción, un NEXT_PUBLIC_APP_URL apuntando a localhost se ignora.
 */
export function getAppUrl(): string {
  const configured = normalizeBase(process.env.NEXT_PUBLIC_APP_URL);
  const isProd =
    process.env.NODE_ENV === "production" || process.env.NETLIFY === "true";

  if (configured && !(isProd && isLocalhost(configured))) {
    return configured;
  }

  const netlifyUrl =
    normalizeBase(process.env.URL) ??
    normalizeBase(process.env.DEPLOY_PRIME_URL) ??
    normalizeBase(process.env.DEPLOY_URL);

  if (netlifyUrl && !isLocalhost(netlifyUrl)) {
    return netlifyUrl;
  }

  if (configured && !isProd) {
    return configured;
  }

  return "http://localhost:3000";
}

function normalizeBase(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/$/, "");
}

function isLocalhost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}
