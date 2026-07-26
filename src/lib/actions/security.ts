"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  isVisitorPassActive,
  visitorAccessLabel,
} from "@/lib/visitors";
import type { VisitorAccessType, VisitorStatus } from "@/types";

export type SecurityActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  visitorName?: string;
  unitLabel?: string;
  accessLabel?: string;
  validUntilLabel?: string;
  authorized?: boolean;
};

async function requireSecurityOps() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Debes iniciar sesión." as const,
      supabase,
      profile: null,
      user: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile?.complex_id ||
    (profile.role !== "SECURITY" && profile.role !== "ADMIN")
  ) {
    return {
      error: "Solo seguridad o administración pueden usar esta consola." as const,
      supabase,
      profile: null,
      user: null,
    };
  }

  return { error: null, supabase, profile, user };
}

export async function resolveEmergencyAlertAction(
  alertId: string,
): Promise<SecurityActionState> {
  const auth = await requireSecurityOps();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const { data: alert, error: findError } = await auth.supabase
    .from("emergency_alerts")
    .select("id, unit_id, status, units!inner(id, complex_id)")
    .eq("id", alertId)
    .maybeSingle();

  if (findError) {
    return { error: findError.message };
  }

  if (!alert) {
    return { error: "Alerta no encontrada." };
  }

  const unit = Array.isArray(alert.units) ? alert.units[0] : alert.units;
  const unitRow = unit as { complex_id?: string } | null;

  if (!unitRow?.complex_id || unitRow.complex_id !== auth.profile.complex_id) {
    return { error: "La alerta no pertenece a este conjunto." };
  }

  if (alert.status === "RESOLVED") {
    return { success: true, message: "La alerta ya estaba resuelta." };
  }

  const { error } = await auth.supabase
    .from("emergency_alerts")
    .update({
      status: "RESOLVED",
      resolved_by: auth.user.id,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", alertId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/security");
  return { success: true, message: "Alerta marcada como resuelta." };
}

export async function registerDeliveryAction(
  _prev: SecurityActionState,
  formData: FormData,
): Promise<SecurityActionState> {
  const unitId = String(formData.get("unitId") ?? "").trim();
  const courierCompany = String(formData.get("courierCompany") ?? "").trim();
  const packageDetails = String(formData.get("packageDetails") ?? "").trim();

  if (!unitId) {
    return { error: "Selecciona la unidad destinataria." };
  }

  if (!courierCompany) {
    return { error: "Indica la empresa de mensajería." };
  }

  const { registerDeliveryWithNotify } = await import("@/lib/actions/deliveries");
  const result = await registerDeliveryWithNotify({
    unitId,
    courierCompany,
    packageDetails: packageDetails || undefined,
  });

  return {
    error: result.error,
    success: result.success,
    message: result.message,
    unitLabel: result.message?.includes("para ")
      ? result.message.replace(/^Encomienda registrada para /, "").replace(/\..*$/, "")
      : undefined,
  };
}

export async function checkInVisitorByQrAction(
  _prev: SecurityActionState,
  formData: FormData,
): Promise<SecurityActionState> {
  const auth = await requireSecurityOps();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado.", authorized: false };
  }

  const qrCode = String(formData.get("qrCode") ?? "").trim();
  if (!qrCode) {
    return {
      error: "Ingresa o escanea el código QR del pase.",
      authorized: false,
    };
  }

  const { data: visitor, error: findError } = await auth.supabase
    .from("visitors")
    .select(
      "id, visitor_name, status, access_type, valid_from, valid_until, unit_id, units!inner(id, number, tower, complex_id)",
    )
    .eq("qr_code", qrCode)
    .maybeSingle();

  if (findError) {
    return { error: findError.message, authorized: false };
  }

  if (!visitor) {
    return {
      error: "Pase no encontrado. Verifica el código QR.",
      authorized: false,
    };
  }

  const unit = Array.isArray(visitor.units) ? visitor.units[0] : visitor.units;
  const unitRow = unit as {
    complex_id?: string;
    number?: string;
    tower?: string | null;
  } | null;

  const unitLabel = [unitRow?.tower, unitRow?.number]
    .filter(Boolean)
    .join(" · ");
  const accessType = (visitor.access_type ?? "TODAY") as VisitorAccessType;
  const status = visitor.status as VisitorStatus;
  const baseInfo = {
    visitorName: visitor.visitor_name,
    unitLabel,
    accessLabel: visitorAccessLabel(accessType),
    validUntilLabel: visitor.valid_until ?? undefined,
  };

  if (unitRow?.complex_id !== auth.profile.complex_id) {
    return {
      error: "Este pase no corresponde a este conjunto.",
      authorized: false,
      ...baseInfo,
    };
  }

  const validity = isVisitorPassActive({
    status,
    validFrom: visitor.valid_from,
    validUntil: visitor.valid_until,
  });

  if (!validity.active) {
    return {
      error: validity.reason ?? "Visitante no autorizado para ingresar hoy.",
      authorized: false,
      ...baseInfo,
    };
  }

  // Acceso libre: puede ingresar varias veces mientras el pase esté vigente.
  const keepOpenStatus = accessType === "OPEN";

  const { error: updateError } = await auth.supabase
    .from("visitors")
    .update({
      status: keepOpenStatus ? "APPROVED" : "CHECKED_IN",
      entry_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", visitor.id);

  if (updateError) {
    return { error: updateError.message, authorized: false, ...baseInfo };
  }

  revalidatePath("/dashboard/security");
  return {
    success: true,
    authorized: true,
    message: "Autorizado para ingresar. Ingreso registrado.",
    ...baseInfo,
  };
}
