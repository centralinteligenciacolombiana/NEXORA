"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ShiftActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

export type ShiftType = "DAY" | "NIGHT";

async function requireAdminComplex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión." as const, supabase, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "ADMIN") {
    return {
      error: "Solo administradores." as const,
      supabase,
      profile: null,
    };
  }

  return { error: null, supabase, profile };
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

export async function setEnableShiftLogbookAction(
  enabled: boolean,
): Promise<ShiftActionState> {
  const auth = await requireAdminComplex();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const { error } = await auth.supabase
    .from("complexes")
    .update({
      enable_shift_logbook: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.profile.complex_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/admin/settings/security");
  revalidatePath("/dashboard/security/logbook");
  return {
    success: true,
    message: enabled
      ? "Bitácora digital activada."
      : "Bitácora digital desactivada.",
  };
}

/**
 * Asigna turno DAY/NIGHT a un guardia SECURITY (cierra el ACTIVE previo).
 * Si shiftType es null, solo finaliza el turno activo.
 */
export async function assignGuardShiftAction(params: {
  guardId: string;
  shiftType: ShiftType | null;
}): Promise<ShiftActionState> {
  const auth = await requireAdminComplex();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const complexId = auth.profile.complex_id;

  const { data: guard } = await auth.supabase
    .from("profiles")
    .select("id, role, complex_id, is_active, full_name")
    .eq("id", params.guardId)
    .maybeSingle();

  if (
    !guard ||
    guard.complex_id !== complexId ||
    guard.role !== "SECURITY" ||
    !guard.is_active
  ) {
    return { error: "El usuario no es un guardia activo de este conjunto." };
  }

  const now = new Date().toISOString();

  // Cerrar turno ACTIVE actual del guardia
  const { error: finishError } = await auth.supabase
    .from("guard_shifts")
    .update({
      status: "FINISHED",
      ended_at: now,
      updated_at: now,
    })
    .eq("guard_id", params.guardId)
    .eq("status", "ACTIVE");

  if (finishError) {
    return { error: finishError.message };
  }

  if (!params.shiftType) {
    revalidatePaths();
    return {
      success: true,
      message: `Turno finalizado para ${guard.full_name ?? "el guardia"}.`,
    };
  }

  const { error: insertError } = await auth.supabase.from("guard_shifts").insert({
    complex_id: complexId,
    guard_id: params.guardId,
    shift_type: params.shiftType,
    status: "ACTIVE",
    started_at: now,
    ended_at: null,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePaths();
  const label = params.shiftType === "DAY" ? "Día" : "Noche";
  return {
    success: true,
    message: `${guard.full_name ?? "Guardia"} asignado al turno de ${label}.`,
  };
}

function revalidatePaths() {
  revalidatePath("/dashboard/admin/settings/security");
  revalidatePath("/dashboard/admin/people");
  revalidatePath("/dashboard/admin/security-reports");
  revalidatePath("/dashboard/resident");
  revalidatePath("/dashboard/resident/security-team");
  revalidatePath("/dashboard/security/logbook");
  revalidatePath("/dashboard/security");
}

/**
 * Seguridad marca entrada de turno (DAY/NIGHT) sobre sí misma.
 * Cierra un ACTIVE previo del mismo guardia si existiera.
 */
export async function startOwnShiftAction(
  shiftType: ShiftType,
  postAssignment?: "LOBBY" | "PATROL" | "MIXED" | null,
): Promise<ShiftActionState> {
  const auth = await requireSecurityOps();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  if (auth.profile.role !== "SECURITY") {
    return {
      error:
        "Solo personal de seguridad puede marcar su propio turno. Usa asignación admin.",
    };
  }

  const complexId = auth.profile.complex_id;
  const now = new Date().toISOString();

  // Preferencia de perfil si no viene en el form
  let post = postAssignment ?? null;
  if (!post) {
    const { data: prof } = await auth.supabase
      .from("profiles")
      .select("security_post")
      .eq("id", auth.user.id)
      .maybeSingle();
    post = (prof?.security_post as typeof post) ?? null;
  }

  const { error: finishError } = await auth.supabase
    .from("guard_shifts")
    .update({
      status: "FINISHED",
      ended_at: now,
      updated_at: now,
    })
    .eq("guard_id", auth.user.id)
    .eq("status", "ACTIVE");

  if (finishError) {
    return { error: finishError.message };
  }

  const { error: insertError } = await auth.supabase.from("guard_shifts").insert({
    complex_id: complexId,
    guard_id: auth.user.id,
    shift_type: shiftType,
    status: "ACTIVE",
    started_at: now,
    ended_at: null,
    post_assignment: post,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePaths();
  const label = shiftType === "DAY" ? "Día" : "Noche";
  return {
    success: true,
    message: `Turno de ${label} iniciado. Ya puedes dejar novedades en bitácora.`,
  };
}

/**
 * Cierra el turno ACTIVE con reporte obligatorio (se consolida para supervisores/admin).
 * También publica un resumen en la bitácora de relevos.
 */
export async function endOwnShiftWithReportAction(
  _prev: ShiftActionState,
  formData: FormData,
): Promise<ShiftActionState> {
  const auth = await requireSecurityOps();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  if (auth.profile.role !== "SECURITY") {
    return { error: "Solo personal de seguridad puede cerrar su propio turno." };
  }

  const summary = String(formData.get("summary") ?? "").trim();
  const incidents = String(formData.get("incidents") ?? "").trim();
  const postRaw = String(formData.get("postAssignment") ?? "").trim().toUpperCase();
  const post =
    postRaw === "LOBBY" || postRaw === "PATROL" || postRaw === "MIXED"
      ? postRaw
      : null;

  if (summary.length < 10) {
    return {
      error: "El reporte de cierre debe tener al menos 10 caracteres.",
    };
  }

  const now = new Date().toISOString();
  const { data: active } = await auth.supabase
    .from("guard_shifts")
    .select("id, shift_type, post_assignment")
    .eq("guard_id", auth.user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!active) {
    return { error: "No tienes un turno activo para cerrar." };
  }

  const { error } = await auth.supabase
    .from("guard_shifts")
    .update({
      status: "FINISHED",
      ended_at: now,
      updated_at: now,
      post_assignment: post ?? active.post_assignment,
      end_report_summary: summary,
      end_report_incidents: incidents || null,
      end_report_at: now,
    })
    .eq("id", active.id)
    .eq("status", "ACTIVE");

  if (error) {
    return { error: error.message };
  }

  // Bitácora: deja el relevo visible para el compañero entrante
  const title =
    active.shift_type === "NIGHT"
      ? "Cierre de turno noche"
      : "Cierre de turno día";
  const description = [
    summary,
    incidents ? `\nNovedades / incidentes:\n${incidents}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await auth.supabase.from("shift_logs").insert({
    complex_id: auth.profile.complex_id,
    shift_id: active.id,
    author_guard_id: auth.user.id,
    title,
    description,
  });

  revalidatePaths();
  return {
    success: true,
    message: "Turno cerrado y reporte guardado para supervisión.",
  };
}

/** @deprecated Prefer endOwnShiftWithReportAction — mantiene compat si no hay form. */
export async function endOwnShiftAction(): Promise<ShiftActionState> {
  return {
    error:
      "Para cerrar el turno debes completar el reporte de cierre en bitácora / controles de turno.",
  };
}

export async function createShiftLogAction(
  _prev: ShiftActionState,
  formData: FormData,
): Promise<ShiftActionState> {
  const auth = await requireSecurityOps();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const complexId = auth.profile.complex_id;

  const { data: complex } = await auth.supabase
    .from("complexes")
    .select("enable_shift_logbook")
    .eq("id", complexId)
    .maybeSingle();

  if (!complex?.enable_shift_logbook) {
    return {
      error: "La bitácora digital está desactivada por la administración.",
    };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const file = formData.get("evidence");

  if (!title) {
    return { error: "El título es obligatorio." };
  }
  if (!description) {
    return { error: "La descripción es obligatoria." };
  }

  const { data: activeShift } = await auth.supabase
    .from("guard_shifts")
    .select("id")
    .eq("guard_id", auth.user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  let evidenceUrl: string | null = null;

  if (file instanceof File && file.size > 0) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      return { error: "La evidencia debe ser una imagen (JPG, PNG, WebP o GIF)." };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { error: "La imagen no puede superar 5 MB." };
    }

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "jpg";

    const path = `${complexId}/${auth.user.id}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await auth.supabase.storage
      .from("shift-evidence")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return { error: `No se pudo subir la foto: ${uploadError.message}` };
    }

    // Path relativo; se firma al visualizar (bucket privado).
    evidenceUrl = path;
  }

  const { error: insertError } = await auth.supabase.from("shift_logs").insert({
    complex_id: complexId,
    shift_id: activeShift?.id ?? null,
    author_guard_id: auth.user.id,
    title,
    description,
    evidence_url: evidenceUrl,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath("/dashboard/security/logbook");
  revalidatePath("/dashboard/security");

  return { success: true, message: "Novedad registrada en la bitácora." };
}
