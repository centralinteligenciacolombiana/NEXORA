import * as React from "react";
import {
  getAppUrl,
  getResendClient,
  getResendFromEmail,
} from "@/lib/email/resend";
import { EmailVerification } from "@/lib/email/templates/EmailVerification";

/** Canales soportados hoy y en el futuro */
export type NotificationChannel = "EMAIL" | "WHATSAPP" | "SMS";

export type EmailOtpType = "signup" | "magiclink" | "email";

export interface SendVerificationCodeInput {
  to: string;
  name: string;
  token: string;
  type: NotificationChannel;
  /** Código corto opcional para mostrar en el mensaje */
  code?: string;
  /** Tipo OTP de Supabase (solo aplica a EMAIL) */
  otpType?: EmailOtpType;
}

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  id?: string;
  error?: string;
}

/**
 * Servicio de notificaciones extensible.
 * Hoy implementa EMAIL (Resend). WHATSAPP y SMS quedan preparados.
 */
export class NotificationService {
  async sendVerificationCode(
    input: SendVerificationCodeInput,
  ): Promise<NotificationResult> {
    switch (input.type) {
      case "EMAIL":
        return this.sendEmailVerification(input);
      case "WHATSAPP":
        return this.sendWhatsAppVerification(input);
      case "SMS":
        return this.sendSmsVerification(input);
      default: {
        const _exhaustive: never = input.type;
        return {
          success: false,
          channel: _exhaustive,
          error: `Canal no soportado: ${String(input.type)}`,
        };
      }
    }
  }

  private async sendEmailVerification(
    input: SendVerificationCodeInput,
  ): Promise<NotificationResult> {
    try {
      const otpType = input.otpType ?? "signup";
      const confirmUrl = `${getAppUrl()}/auth/confirm?token_hash=${encodeURIComponent(input.token)}&type=${otpType}`;
      const resend = getResendClient();

      const { data, error } = await resend.emails.send({
        from: getResendFromEmail(),
        to: input.to,
        subject: "Confirma tu correo y activa tu cuenta — NEXORA",
        react: React.createElement(EmailVerification, {
          name: input.name,
          confirmUrl,
          code: input.code,
        }),
      });

      if (error) {
        return {
          success: false,
          channel: "EMAIL",
          error: error.message,
        };
      }

      return {
        success: true,
        channel: "EMAIL",
        id: data?.id,
      };
    } catch (err) {
      return {
        success: false,
        channel: "EMAIL",
        error: err instanceof Error ? err.message : "Error al enviar el correo",
      };
    }
  }

  /** Placeholder: integrar Twilio / Meta Cloud API más adelante */
  private async sendWhatsAppVerification(
    input: SendVerificationCodeInput,
  ): Promise<NotificationResult> {
    console.warn(
      "[NotificationService] WHATSAPP aún no implementado:",
      input.to,
    );
    return {
      success: false,
      channel: "WHATSAPP",
      error: "WHATSAPP no está configurado todavía.",
    };
  }

  /** Placeholder: integrar proveedor SMS más adelante */
  private async sendSmsVerification(
    input: SendVerificationCodeInput,
  ): Promise<NotificationResult> {
    console.warn("[NotificationService] SMS aún no implementado:", input.to);
    return {
      success: false,
      channel: "SMS",
      error: "SMS no está configurado todavía.",
    };
  }
}

/** Instancia compartida para server actions / route handlers */
export const notificationService = new NotificationService();
