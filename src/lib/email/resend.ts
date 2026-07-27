import { Resend } from "resend";

let resendClient: Resend | null = null;

/** Cliente Resend (singleton). Requiere RESEND_API_KEY. */
export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada en el entorno.");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

export function getResendFromEmail(): string {
  return (
    process.env.RESEND_FROM_EMAIL ?? "NEXORA <onboarding@resend.dev>"
  );
}

export { getAppUrl } from "@/lib/app-url";

