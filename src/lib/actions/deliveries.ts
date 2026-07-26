"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendPackageNotificationEmail } from "@/lib/email/send";

export type DeliveryActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

function generatePickupPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

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
      error: "Solo seguridad o administración." as const,
      supabase,
      profile: null,
      user: null,
    };
  }

  return { error: null, supabase, profile, user };
}

/** Marca un paquete como entregado validando el PIN del residente. */
export async function markDeliveryDeliveredAction(
  _prev: DeliveryActionState,
  formData: FormData,
): Promise<DeliveryActionState> {
  const auth = await requireSecurityOps();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const deliveryId = String(formData.get("deliveryId") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!deliveryId) {
    return { error: "Falta el identificador del paquete." };
  }

  if (!/^\d{4}$/.test(pin)) {
    return { error: "El PIN debe ser de 4 dígitos." };
  }

  const { data: delivery, error: findError } = await auth.supabase
    .from("deliveries")
    .select(
      "id, status, verification_code, unit_id, units!inner(id, number, tower, complex_id)",
    )
    .eq("id", deliveryId)
    .maybeSingle();

  if (findError) {
    return { error: findError.message };
  }

  if (!delivery) {
    return { error: "Paquete no encontrado." };
  }

  const unit = Array.isArray(delivery.units)
    ? delivery.units[0]
    : delivery.units;
  const unitRow = unit as { complex_id?: string } | null;

  if (unitRow?.complex_id !== auth.profile.complex_id) {
    return { error: "El paquete no pertenece a este conjunto." };
  }

  if (delivery.status === "DELIVERED") {
    return { success: true, message: "Este paquete ya estaba entregado." };
  }

  if (delivery.status !== "PENDING" && delivery.status !== "AT_RECEPTION") {
    return { error: `No se puede entregar un paquete en estado ${delivery.status}.` };
  }

  if (delivery.verification_code !== pin) {
    return { error: "PIN incorrecto. Pide al residente el código de 4 dígitos." };
  }

  const { error: updateError } = await auth.supabase
    .from("deliveries")
    .update({
      status: "DELIVERED",
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", deliveryId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/dashboard/security");
  revalidatePath("/dashboard/security/deliveries");
  revalidatePath("/dashboard/resident/deliveries");
  revalidatePath("/dashboard/resident");

  return {
    success: true,
    message: "Paquete marcado como entregado.",
  };
}

/**
 * Registra encomienda con PIN de 4 dígitos y notifica por correo a residentes de la unidad.
 * Usado desde el formulario de portería (también re-exportado en security actions).
 */
export async function registerDeliveryWithNotify(params: {
  unitId: string;
  courierCompany: string;
  packageDetails?: string;
}): Promise<DeliveryActionState & { pin?: string }> {
  const auth = await requireSecurityOps();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const { data: unit } = await auth.supabase
    .from("units")
    .select("id, complex_id, number, tower")
    .eq("id", params.unitId)
    .maybeSingle();

  if (!unit || unit.complex_id !== auth.profile.complex_id) {
    return { error: "La unidad no pertenece a este conjunto." };
  }

  const { data: complex } = await auth.supabase
    .from("complexes")
    .select("name")
    .eq("id", auth.profile.complex_id)
    .single();

  const pin = generatePickupPin();
  const receivedAt = new Date();

  const { data: inserted, error } = await auth.supabase
    .from("deliveries")
    .insert({
      unit_id: params.unitId,
      courier_company: params.courierCompany,
      package_details: params.packageDetails || null,
      status: "PENDING",
      verification_code: pin,
      received_at: receivedAt.toISOString(),
      received_by: auth.user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  const unitLabel = [unit.tower, `Apto ${unit.number}`]
    .filter(Boolean)
    .join(" · ");

  // Notificar a residentes de la unidad
  const { data: residents } = await auth.supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("unit_id", params.unitId)
    .eq("is_active", true);

  for (const resident of residents ?? []) {
    const email = resident.email?.trim();
    if (!email) continue;

    void sendPackageNotificationEmail({
      to: email,
      userName: resident.full_name ?? "Residente",
      complexName: complex?.name ?? "Tu conjunto",
      unitLabel,
      courierCompany: params.courierCompany,
      pin,
      receivedAt,
    });
  }

  revalidatePath("/dashboard/security");
  revalidatePath("/dashboard/security/deliveries");
  revalidatePath("/dashboard/resident/deliveries");
  revalidatePath("/dashboard/resident");

  return {
    success: true,
    message: `Encomienda registrada para ${unitLabel}. PIN: ${pin}`,
    pin,
  };
}
