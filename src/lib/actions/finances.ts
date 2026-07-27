"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  sendAdminFeeReminderEmail,
  sendUtilityBillEmail,
} from "@/lib/email/send";
import {
  UTILITY_SERVICE_LABELS,
  formatCurrencyCOP,
  normalizeTrashDays,
  type UtilityServiceType,
} from "@/lib/community";

export type FinanceActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  pin?: string;
  sentCount?: number;
};

function generatePickupPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function unitLabel(tower: string | null | undefined, number: string) {
  return [tower, `Apto ${number}`].filter(Boolean).join(" · ");
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión." as const, supabase, profile: null, user: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "ADMIN") {
    return { error: "Solo administradores." as const, supabase, profile: null, user: null };
  }

  return { error: null, supabase, profile, user };
}

async function requireSecurityOps() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión." as const, supabase, profile: null, user: null };
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

async function requireResident() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión." as const, supabase, profile: null, user: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, complex_id, unit_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "RESIDENT") {
    return { error: "Solo residentes." as const, supabase, profile: null, user: null };
  }

  return { error: null, supabase, profile, user };
}

export async function updateTrashScheduleAction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const auth = await requireAdmin();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const trashTime = String(formData.get("trashTime") ?? "").trim();
  const trashNotes = String(formData.get("trashNotes") ?? "").trim();
  const selected = formData.getAll("trashDays").map(String);
  const trashDays = normalizeTrashDays(selected);

  const { error } = await auth.supabase
    .from("complexes")
    .update({
      trash_days: trashDays,
      trash_time: trashTime || null,
      trash_notes: trashNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.profile.complex_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/admin/settings/community");
  revalidatePath("/dashboard/resident");
  return { success: true, message: "Horario de basura guardado." };
}

export async function publishAdminFeeNoticeAction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const auth = await requireAdmin();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const periodName = String(formData.get("periodName") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const bankDetails = String(formData.get("bankDetails") ?? "").trim();
  const paymentLink = String(formData.get("paymentLink") ?? "").trim();

  if (!periodName) return { error: "El periodo es obligatorio." };
  if (!dueDate) return { error: "La fecha límite es obligatoria." };

  const amount = Number.parseFloat(amountRaw.replace(/,/g, "."));
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Ingresa un valor válido." };
  }

  const complexId = auth.profile.complex_id;

  const { data: notice, error } = await auth.supabase
    .from("admin_fee_notices")
    .insert({
      complex_id: complexId,
      period_name: periodName,
      due_date: dueDate,
      amount,
      bank_details: bankDetails || null,
      payment_link: paymentLink || null,
      created_by: auth.user.id,
    })
    .select("id")
    .single();

  if (error || !notice) {
    return { error: error?.message ?? "No se pudo publicar el aviso." };
  }

  const { data: units } = await auth.supabase
    .from("units")
    .select("id")
    .eq("complex_id", complexId)
    .eq("is_active", true);

  if ((units ?? []).length > 0) {
    const rows = (units ?? []).map((u) => ({
      complex_id: complexId,
      unit_id: u.id,
      fee_notice_id: notice.id,
      status: "PENDING" as const,
    }));

    const { error: seedError } = await auth.supabase
      .from("unit_payments")
      .insert(rows);

    if (seedError) {
      return {
        error: `Aviso creado, pero falló el registro por unidades: ${seedError.message}`,
      };
    }
  }

  revalidatePath("/dashboard/admin/finances");
  revalidatePath("/dashboard/resident/finances");
  revalidatePath("/dashboard/resident");
  return {
    success: true,
    message: `Aviso «${periodName}» publicado para ${(units ?? []).length} unidades.`,
  };
}

export async function sendFeeRemindersAction(
  noticeId: string,
): Promise<FinanceActionState> {
  const auth = await requireAdmin();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const complexId = auth.profile.complex_id;

  const { data: notice } = await auth.supabase
    .from("admin_fee_notices")
    .select(
      "id, period_name, due_date, amount, bank_details, payment_link, complex_id",
    )
    .eq("id", noticeId)
    .eq("complex_id", complexId)
    .maybeSingle();

  if (!notice) return { error: "Aviso no encontrado." };

  const { data: complex } = await auth.supabase
    .from("complexes")
    .select("name")
    .eq("id", complexId)
    .single();

  const { data: pending } = await auth.supabase
    .from("unit_payments")
    .select("id, unit_id, units!inner(id, number, tower)")
    .eq("fee_notice_id", noticeId)
    .eq("status", "PENDING");

  if (!pending || pending.length === 0) {
    return { success: true, message: "No hay unidades con cuota pendiente.", sentCount: 0 };
  }

  const unitIds = pending.map((p) => p.unit_id);
  const { data: residents } = await auth.supabase
    .from("profiles")
    .select("id, email, full_name, unit_id")
    .in("unit_id", unitIds)
    .eq("role", "RESIDENT")
    .eq("is_active", true);

  const amountLabel = formatCurrencyCOP(notice.amount);
  const dueDateLabel = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
  }).format(new Date(`${notice.due_date}T12:00:00`));

  let sentCount = 0;

  for (const payment of pending) {
    const unit = Array.isArray(payment.units)
      ? payment.units[0]
      : payment.units;
    const unitRow = unit as { number?: string; tower?: string | null } | null;
    const label = unitLabel(unitRow?.tower, unitRow?.number ?? "?");

    const unitResidents = (residents ?? []).filter(
      (r) => r.unit_id === payment.unit_id,
    );

    for (const r of unitResidents) {
      const email = r.email?.trim();
      if (!email) continue;

      const result = await sendAdminFeeReminderEmail({
        to: email,
        userName: r.full_name ?? "Residente",
        complexName: complex?.name ?? "Tu conjunto",
        unitLabel: label,
        periodName: notice.period_name,
        amountLabel,
        dueDateLabel,
        bankDetails: notice.bank_details,
        paymentLink: notice.payment_link,
      });

      if (result.success) sentCount += 1;
    }
  }

  return {
    success: true,
    message: `Se enviaron ${sentCount} recordatorios por correo.`,
    sentCount,
  };
}

export async function verifyUnitPaymentAction(
  paymentId: string,
): Promise<FinanceActionState> {
  const auth = await requireAdmin();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const now = new Date().toISOString();
  const { error } = await auth.supabase
    .from("unit_payments")
    .update({
      status: "VERIFIED",
      verified_at: now,
      verified_by: auth.user.id,
      updated_at: now,
    })
    .eq("id", paymentId)
    .eq("complex_id", auth.profile.complex_id)
    .in("status", ["PAID", "PENDING"]);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/admin/finances");
  revalidatePath("/dashboard/resident/finances");
  return { success: true, message: "Pago verificado." };
}

export async function uploadPaymentProofAction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const auth = await requireResident();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  if (!auth.profile.unit_id) {
    return { error: "No tienes una unidad asignada." };
  }

  const paymentId = String(formData.get("paymentId") ?? "").trim();
  const file = formData.get("proof");

  if (!paymentId) return { error: "Falta el identificador del pago." };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjunta el comprobante (imagen o PDF)." };
  }

  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];
  if (!allowed.includes(file.type)) {
    return { error: "Formato no permitido. Usa JPG, PNG, WebP o PDF." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "El archivo no puede superar 5 MB." };
  }

  const { data: payment } = await auth.supabase
    .from("unit_payments")
    .select("id, unit_id, status, complex_id")
    .eq("id", paymentId)
    .eq("unit_id", auth.profile.unit_id)
    .maybeSingle();

  if (!payment) return { error: "Pago no encontrado." };
  if (payment.status === "VERIFIED") {
    return { error: "Este pago ya fue verificado." };
  }

  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";

  const path = `${payment.complex_id}/${payment.unit_id}/${paymentId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await auth.supabase.storage
    .from("payment-proofs")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: `No se pudo subir: ${uploadError.message}` };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await auth.supabase
    .from("unit_payments")
    .update({
      status: "PAID",
      // Path relativo; se firma al visualizar (bucket privado).
      payment_proof_url: path,
      paid_at: now,
      updated_at: now,
    })
    .eq("id", paymentId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/dashboard/resident/finances");
  revalidatePath("/dashboard/admin/finances");
  return { success: true, message: "Comprobante enviado. Pendiente de verificación." };
}

export async function registerUtilityBillAction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const auth = await requireSecurityOps();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const unitId = String(formData.get("unitId") ?? "").trim();
  const serviceType = String(formData.get("serviceType") ?? "").trim() as UtilityServiceType;
  const periodName = String(formData.get("periodName") ?? "").trim();

  if (!unitId) return { error: "Selecciona la unidad." };
  if (!(serviceType in UTILITY_SERVICE_LABELS)) {
    return { error: "Tipo de servicio inválido." };
  }

  const { data: unit } = await auth.supabase
    .from("units")
    .select("id, complex_id, number, tower")
    .eq("id", unitId)
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

  const { error } = await auth.supabase.from("utility_bills").insert({
    complex_id: auth.profile.complex_id,
    unit_id: unitId,
    service_type: serviceType,
    period_name: periodName || null,
    verification_code: pin,
    status: "PENDING",
    received_at: receivedAt.toISOString(),
    received_by: auth.user.id,
  });

  if (error) return { error: error.message };

  const label = unitLabel(unit.tower, unit.number);
  const serviceLabel = UTILITY_SERVICE_LABELS[serviceType];

  const { data: residents } = await auth.supabase
    .from("profiles")
    .select("email, full_name")
    .eq("unit_id", unitId)
    .eq("is_active", true);

  for (const r of residents ?? []) {
    const email = r.email?.trim();
    if (!email) continue;
    void sendUtilityBillEmail({
      to: email,
      userName: r.full_name ?? "Residente",
      complexName: complex?.name ?? "Tu conjunto",
      unitLabel: label,
      serviceLabel,
      periodName: periodName || null,
      pin,
    });
  }

  revalidatePath("/dashboard/security/utilities");
  revalidatePath("/dashboard/security");
  revalidatePath("/dashboard/resident/finances");
  revalidatePath("/dashboard/resident");

  return {
    success: true,
    message: `Recibo de ${serviceLabel} registrado para ${label}. PIN: ${pin}`,
    pin,
  };
}

export async function markUtilityBillPickedUpAction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const auth = await requireSecurityOps();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const billId = String(formData.get("billId") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!billId) return { error: "Falta el recibo." };
  if (!/^\d{4}$/.test(pin)) return { error: "El PIN debe ser de 4 dígitos." };

  const { data: bill, error: findError } = await auth.supabase
    .from("utility_bills")
    .select("id, status, verification_code, complex_id")
    .eq("id", billId)
    .eq("complex_id", auth.profile.complex_id)
    .maybeSingle();

  if (findError) return { error: findError.message };
  if (!bill) return { error: "Recibo no encontrado." };
  if (bill.status === "PICKED_UP") {
    return { success: true, message: "Este recibo ya fue entregado." };
  }
  if (bill.verification_code !== pin) {
    return { error: "PIN incorrecto." };
  }

  const { error } = await auth.supabase
    .from("utility_bills")
    .update({
      status: "PICKED_UP",
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", billId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/security/utilities");
  revalidatePath("/dashboard/resident/finances");
  return { success: true, message: "Recibo marcado como entregado." };
}
