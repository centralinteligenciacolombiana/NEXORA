"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  sendTicketCreatedEmail,
  sendTicketUpdatedEmail,
} from "@/lib/email/send";
import {
  generateRadicado,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
  type MaintenancePriority,
  type MaintenanceTicketStatus,
  type MaintenanceTicketType,
} from "@/lib/pqrs";

export type PqrsActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  ticketId?: string;
};

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
    .select("id, role, complex_id, unit_id, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "RESIDENT") {
    return { error: "Solo residentes." as const, supabase, profile: null, user: null };
  }

  return { error: null, supabase, profile, user };
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
    .select("id, role, complex_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "ADMIN") {
    return { error: "Solo administradores." as const, supabase, profile: null, user: null };
  }

  return { error: null, supabase, profile, user };
}

async function uploadEvidenceFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  complexId: string,
  userId: string,
  files: File[],
): Promise<{ urls: string[]; error?: string }> {
  const urls: string[] = [];
  const allowed = ["image/jpeg", "image/png", "image/webp"];

  for (const file of files.slice(0, 3)) {
    if (file.size === 0) continue;
    if (!allowed.includes(file.type)) {
      return { urls, error: "Solo se permiten imágenes JPG, PNG o WebP." };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { urls, error: "Cada imagen debe pesar máximo 5 MB." };
    }

    const ext =
      file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${complexId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from("maintenance-evidence")
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (error) return { urls, error: error.message };

    // Path relativo; se firma al visualizar (bucket privado).
    urls.push(path);
  }

  return { urls };
}

function revalidatePqrs(ticketId?: string) {
  revalidatePath("/dashboard/resident/pqrs");
  revalidatePath("/dashboard/admin/pqrs");
  revalidatePath("/dashboard/resident");
  revalidatePath("/dashboard/admin");
  if (ticketId) {
    revalidatePath(`/dashboard/resident/pqrs/${ticketId}`);
    revalidatePath(`/dashboard/admin/pqrs/${ticketId}`);
  }
}

export async function createMaintenanceTicketAction(
  _prev: PqrsActionState,
  formData: FormData,
): Promise<PqrsActionState> {
  const auth = await requireResident();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const type = String(formData.get("type") ?? "").trim() as MaintenanceTicketType;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const locationDetails = String(formData.get("locationDetails") ?? "").trim();

  if (!(type in TICKET_TYPE_LABELS)) {
    return { error: "Selecciona una categoría válida." };
  }
  if (!title) return { error: "El título es obligatorio." };
  if (!description) return { error: "La descripción es obligatoria." };

  const evidenceFiles = formData
    .getAll("evidence")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (evidenceFiles.length > 3) {
    return { error: "Máximo 3 fotografías de evidencia." };
  }

  let evidenceUrls: string[] = [];
  if (evidenceFiles.length > 0) {
    const uploaded = await uploadEvidenceFiles(
      auth.supabase,
      auth.profile.complex_id,
      auth.user.id,
      evidenceFiles,
    );
    if (uploaded.error) return { error: uploaded.error };
    evidenceUrls = uploaded.urls;
  }

  const radicado = generateRadicado();

  const { data: ticket, error } = await auth.supabase
    .from("maintenance_tickets")
    .insert({
      complex_id: auth.profile.complex_id,
      unit_id: auth.profile.unit_id,
      created_by: auth.user.id,
      radicado,
      type,
      title,
      description,
      location_details: locationDetails || null,
      status: "OPEN",
      priority: "MEDIUM",
      evidence_urls: evidenceUrls,
    })
    .select("id")
    .single();

  if (error || !ticket) {
    return { error: error?.message ?? "No se pudo crear la solicitud." };
  }

  await auth.supabase.from("ticket_updates").insert({
    ticket_id: ticket.id,
    author_id: auth.user.id,
    comment: "Solicitud creada por el residente.",
    status_changed_to: "OPEN",
  });

  const { data: complex } = await auth.supabase
    .from("complexes")
    .select("name")
    .eq("id", auth.profile.complex_id)
    .single();

  const email = auth.profile.email?.trim();
  if (email) {
    void sendTicketCreatedEmail({
      to: email,
      userName: auth.profile.full_name ?? "Residente",
      complexName: complex?.name ?? "Tu conjunto",
      radicado,
      title,
      typeLabel: TICKET_TYPE_LABELS[type],
      ticketId: ticket.id,
    });
  }

  revalidatePqrs(ticket.id);
  return {
    success: true,
    message: `Solicitud creada. Radicado: ${radicado}`,
    ticketId: ticket.id,
  };
}

export async function updateMaintenanceTicketAction(
  _prev: PqrsActionState,
  formData: FormData,
): Promise<PqrsActionState> {
  const auth = await requireAdmin();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const ticketId = String(formData.get("ticketId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as MaintenanceTicketStatus;
  const priority = String(formData.get("priority") ?? "").trim() as MaintenancePriority;
  const adminResponse = String(formData.get("adminResponse") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  const solutionFile = formData.get("solutionImage");

  if (!ticketId) return { error: "Falta el ticket." };
  if (!["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"].includes(status)) {
    return { error: "Estado inválido." };
  }
  if (!["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) {
    return { error: "Prioridad inválida." };
  }

  const { data: ticket } = await auth.supabase
    .from("maintenance_tickets")
    .select(
      "id, status, priority, radicado, title, admin_response, created_by, complex_id",
    )
    .eq("id", ticketId)
    .eq("complex_id", auth.profile.complex_id)
    .maybeSingle();

  if (!ticket) return { error: "Ticket no encontrado." };

  let solutionImageUrl: string | null = null;
  if (solutionFile instanceof File && solutionFile.size > 0) {
    const uploaded = await uploadEvidenceFiles(
      auth.supabase,
      auth.profile.complex_id,
      auth.user.id,
      [solutionFile],
    );
    if (uploaded.error) return { error: uploaded.error };
    solutionImageUrl = uploaded.urls[0] ?? null;
  }

  const now = new Date().toISOString();
  const statusChanged = ticket.status !== status;
  const payload: Record<string, unknown> = {
    status,
    priority,
    updated_at: now,
  };

  if (adminResponse) {
    payload.admin_response = adminResponse;
  }
  if (solutionImageUrl) {
    payload.solution_image_url = solutionImageUrl;
  }
  if (status === "RESOLVED" || status === "REJECTED") {
    payload.resolved_at = now;
  } else if (ticket.status === "RESOLVED" || ticket.status === "REJECTED") {
    payload.resolved_at = null;
  }

  const { error } = await auth.supabase
    .from("maintenance_tickets")
    .update(payload)
    .eq("id", ticketId);

  if (error) return { error: error.message };

  const timelineComment =
    comment ||
    adminResponse ||
    (statusChanged
      ? `Estado actualizado a ${TICKET_STATUS_LABELS[status]}.`
      : "Actualización de administración.");

  await auth.supabase.from("ticket_updates").insert({
    ticket_id: ticketId,
    author_id: auth.user.id,
    comment: timelineComment,
    status_changed_to: statusChanged ? status : null,
    attachment_url: solutionImageUrl,
  });

  // Notificar al residente si hay respuesta o cambio a RESOLVED/REJECTED/IN_PROGRESS
  const shouldNotify =
    Boolean(adminResponse) ||
    status === "RESOLVED" ||
    status === "REJECTED" ||
    (statusChanged && status === "IN_PROGRESS");

  if (shouldNotify) {
    const { data: creator } = await auth.supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", ticket.created_by)
      .maybeSingle();

    const { data: complex } = await auth.supabase
      .from("complexes")
      .select("name")
      .eq("id", ticket.complex_id)
      .single();

    const email = creator?.email?.trim();
    if (email) {
      void sendTicketUpdatedEmail({
        to: email,
        userName: creator?.full_name ?? "Residente",
        complexName: complex?.name ?? "Tu conjunto",
        radicado: ticket.radicado,
        title: ticket.title,
        statusLabel: TICKET_STATUS_LABELS[status],
        adminResponse: adminResponse || ticket.admin_response,
        ticketId,
        resolved: status === "RESOLVED",
      });
    }
  }

  revalidatePqrs(ticketId);
  return { success: true, message: "Ticket actualizado." };
}
