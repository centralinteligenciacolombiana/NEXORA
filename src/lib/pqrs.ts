export type MaintenanceTicketType =
  | "DAMAGE_REPORT"
  | "PETITION"
  | "COMPLAINT"
  | "SUGGESTION";

export type MaintenanceTicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "REJECTED";

export type MaintenancePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export const TICKET_TYPE_LABELS: Record<MaintenanceTicketType, string> = {
  DAMAGE_REPORT: "Falla en zona común",
  PETITION: "Petición",
  COMPLAINT: "Queja / Reclamo",
  SUGGESTION: "Sugerencia",
};

export const TICKET_STATUS_LABELS: Record<MaintenanceTicketStatus, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En proceso",
  RESOLVED: "Resuelto",
  REJECTED: "Rechazado",
};

export const TICKET_STATUS_BADGE: Record<
  MaintenanceTicketStatus,
  "default" | "warning" | "success" | "muted"
> = {
  OPEN: "default",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  REJECTED: "muted",
};

export const PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const PRIORITY_BADGE: Record<
  MaintenancePriority,
  "muted" | "default" | "warning" | "danger"
> = {
  LOW: "muted",
  MEDIUM: "default",
  HIGH: "warning",
  URGENT: "danger",
};

/** Genera radicado legible: PQRS-2026-A1B2 */
export function generateRadicado(now = new Date()): string {
  const year = now.getFullYear();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PQRS-${year}-${suffix}`;
}
