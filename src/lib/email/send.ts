import * as React from "react";
import {
  getAppUrl,
  getResendClient,
  getResendFromEmail,
} from "@/lib/email/resend";
import {
  InviteEmail,
  type InviteEmailRole,
} from "@/lib/email/templates/InviteEmail";
import { PackageNotificationEmail } from "@/lib/email/templates/PackageNotificationEmail";
import { UtilityBillEmail } from "@/lib/email/templates/UtilityBillEmail";
import { AdminFeeReminderEmail } from "@/lib/email/templates/AdminFeeReminderEmail";
import { TicketCreatedEmail } from "@/lib/email/templates/TicketCreatedEmail";
import { TicketUpdatedEmail } from "@/lib/email/templates/TicketUpdatedEmail";
import { RegistrationDeniedEmail } from "@/lib/email/templates/RegistrationDeniedEmail";

export interface SendInviteEmailParams {
  to: string;
  userName: string;
  complexName: string;
  role: InviteEmailRole;
  inviteUrl: string;
  supportEmail?: string;
}

export interface SendInviteEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Env�a el correo transaccional de invitaci�n / confirmaci�n v�a Resend.
 */
export async function sendInviteEmail(
  params: SendInviteEmailParams,
): Promise<SendInviteEmailResult> {
  const { to, userName, complexName, role, inviteUrl, supportEmail } = params;

  if (!process.env.RESEND_API_KEY) {
    console.error("[email] RESEND_API_KEY no est� configurada");
    return { success: false, error: "RESEND_API_KEY no configurada" };
  }

  if (!to || !inviteUrl) {
    console.error("[email] Faltan destinatario o inviteUrl");
    return { success: false, error: "Par�metros incompletos" };
  }

  try {
    const resend = getResendClient();
    const from = getResendFromEmail();

    console.info("[email] Enviando invitaci�n", {
      to,
      complexName,
      role,
    });

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `�nete a ${complexName} en NEXORA`,
      react: React.createElement(InviteEmail, {
        userName,
        complexName,
        role,
        inviteUrl,
        supportEmail,
      }),
    });

    if (error) {
      console.error("[email] Error Resend:", error.message);
      return { success: false, error: error.message };
    }

    console.info("[email] Invitaci�n enviada", { id: data?.id, to });
    return { success: true, id: data?.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al enviar correo";
    console.error("[email] Excepci�n:", message);
    return { success: false, error: message };
  }
}

export interface SendPackageNotificationParams {
  to: string;
  userName: string;
  complexName: string;
  unitLabel: string;
  courierCompany: string;
  pin: string;
  receivedAt: Date | string;
}

/**
 * Notifica al residente que tiene una encomienda en porter�a.
 */
export async function sendPackageNotificationEmail(
  params: SendPackageNotificationParams,
): Promise<SendInviteEmailResult> {
  const {
    to,
    userName,
    complexName,
    unitLabel,
    courierCompany,
    pin,
    receivedAt,
  } = params;

  if (!process.env.RESEND_API_KEY) {
    console.error("[email] RESEND_API_KEY no est� configurada");
    return { success: false, error: "RESEND_API_KEY no configurada" };
  }

  if (!to) {
    console.error("[email] Falta destinatario para notificaci�n de paquete");
    return { success: false, error: "Par�metros incompletos" };
  }

  const receivedLabel = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(typeof receivedAt === "string" ? new Date(receivedAt) : receivedAt);

  const deliveriesUrl = `${getAppUrl()}/dashboard/resident/deliveries`;

  try {
    const resend = getResendClient();
    const from = getResendFromEmail();

    console.info("[email] Notificando encomienda", {
      to,
      courierCompany,
      unitLabel,
    });

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `Nueva encomienda en porter�a ? ${complexName}`,
      react: React.createElement(PackageNotificationEmail, {
        userName,
        complexName,
        unitLabel,
        courierCompany,
        pin,
        receivedAt: receivedLabel,
        deliveriesUrl,
      }),
    });

    if (error) {
      console.error("[email] Error Resend (paquete):", error.message);
      return { success: false, error: error.message };
    }

    console.info("[email] Notificaci�n de encomienda enviada", {
      id: data?.id,
      to,
    });
    return { success: true, id: data?.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al enviar correo";
    console.error("[email] Excepci�n (paquete):", message);
    return { success: false, error: message };
  }
}

export interface SendUtilityBillEmailParams {
  to: string;
  userName: string;
  complexName: string;
  unitLabel: string;
  serviceLabel: string;
  periodName?: string | null;
  pin: string;
}

export async function sendUtilityBillEmail(
  params: SendUtilityBillEmailParams,
): Promise<SendInviteEmailResult> {
  const { to, userName, complexName, unitLabel, serviceLabel, periodName, pin } =
    params;

  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY no configurada" };
  }
  if (!to) {
    return { success: false, error: "Par�metros incompletos" };
  }

  try {
    const resend = getResendClient();
    const from = getResendFromEmail();
    const financesUrl = `${getAppUrl()}/dashboard/resident/finances`;

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `Recibo de ${serviceLabel} en porter�a ? ${complexName}`,
      react: React.createElement(UtilityBillEmail, {
        userName,
        complexName,
        unitLabel,
        serviceLabel,
        periodName,
        pin,
        financesUrl,
      }),
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, id: data?.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al enviar correo";
    return { success: false, error: message };
  }
}

export interface SendAdminFeeReminderParams {
  to: string;
  userName: string;
  complexName: string;
  unitLabel: string;
  periodName: string;
  amountLabel: string;
  dueDateLabel: string;
  bankDetails?: string | null;
  paymentLink?: string | null;
}

export async function sendAdminFeeReminderEmail(
  params: SendAdminFeeReminderParams,
): Promise<SendInviteEmailResult> {
  const {
    to,
    userName,
    complexName,
    unitLabel,
    periodName,
    amountLabel,
    dueDateLabel,
    bankDetails,
    paymentLink,
  } = params;

  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY no configurada" };
  }
  if (!to) {
    return { success: false, error: "Par�metros incompletos" };
  }

  try {
    const resend = getResendClient();
    const from = getResendFromEmail();
    const financesUrl = `${getAppUrl()}/dashboard/resident/finances`;

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `Recordatorio cuota ${periodName} ? ${complexName}`,
      react: React.createElement(AdminFeeReminderEmail, {
        userName,
        complexName,
        unitLabel,
        periodName,
        amountLabel,
        dueDateLabel,
        bankDetails,
        paymentLink,
        financesUrl,
      }),
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, id: data?.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al enviar correo";
    return { success: false, error: message };
  }
}

export interface SendTicketCreatedEmailParams {
  to: string;
  userName: string;
  complexName: string;
  radicado: string;
  title: string;
  typeLabel: string;
  ticketId: string;
}

export async function sendTicketCreatedEmail(
  params: SendTicketCreatedEmailParams,
): Promise<SendInviteEmailResult> {
  const { to, userName, complexName, radicado, title, typeLabel, ticketId } =
    params;

  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY no configurada" };
  }
  if (!to) return { success: false, error: "Par�metros incompletos" };

  try {
    const resend = getResendClient();
    const from = getResendFromEmail();
    const ticketUrl = `${getAppUrl()}/dashboard/resident/pqrs/${ticketId}`;

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `Radicado ${radicado} ? solicitud recibida`,
      react: React.createElement(TicketCreatedEmail, {
        userName,
        complexName,
        radicado,
        title,
        typeLabel,
        ticketUrl,
      }),
    });

    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al enviar correo";
    return { success: false, error: message };
  }
}

export interface SendTicketUpdatedEmailParams {
  to: string;
  userName: string;
  complexName: string;
  radicado: string;
  title: string;
  statusLabel: string;
  adminResponse?: string | null;
  ticketId: string;
  resolved?: boolean;
}

export async function sendTicketUpdatedEmail(
  params: SendTicketUpdatedEmailParams,
): Promise<SendInviteEmailResult> {
  const {
    to,
    userName,
    complexName,
    radicado,
    title,
    statusLabel,
    adminResponse,
    ticketId,
    resolved = false,
  } = params;

  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY no configurada" };
  }
  if (!to) return { success: false, error: "Par�metros incompletos" };

  try {
    const resend = getResendClient();
    const from = getResendFromEmail();
    const ticketUrl = `${getAppUrl()}/dashboard/resident/pqrs/${ticketId}`;

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: resolved
        ? `Soluci�n ${radicado} ? ${title}`
        : `Actualizaci�n ${radicado}: ${statusLabel}`,
      react: React.createElement(TicketUpdatedEmail, {
        userName,
        complexName,
        radicado,
        title,
        statusLabel,
        adminResponse,
        ticketUrl,
        resolved,
      }),
    });

    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al enviar correo";
    return { success: false, error: message };
  }
}

export interface SendRegistrationDeniedParams {
  to: string;
  userName: string;
  complexName: string;
  reason: string;
  supportEmail?: string;
}

/** Notifica rechazo/anulaci�n de registro (cuenta eliminada). */
export async function sendRegistrationDeniedEmail(
  params: SendRegistrationDeniedParams,
): Promise<SendInviteEmailResult> {
  const { to, userName, complexName, reason, supportEmail } = params;

  if (!process.env.RESEND_API_KEY) {
    console.error("[email] RESEND_API_KEY no est� configurada");
    return { success: false, error: "RESEND_API_KEY no configurada" };
  }

  if (!to || !reason.trim()) {
    return { success: false, error: "Par�metros incompletos" };
  }

  try {
    const resend = getResendClient();
    const from = getResendFromEmail();

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `Registro anulado ? ${complexName}`,
      react: React.createElement(RegistrationDeniedEmail, {
        userName,
        complexName,
        reason,
        supportEmail,
      }),
    });

    if (error) {
      console.error("[email] Error rechazo:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al enviar correo";
    console.error("[email] Excepci�n rechazo:", message);
    return { success: false, error: message };
  }
}
