export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW"
  | "REJECTED";

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Aprobada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
  NO_SHOW: "No asistió",
  REJECTED: "Rechazada",
};

export const RESERVATION_STATUS_BADGE: Record<
  ReservationStatus,
  "default" | "success" | "warning" | "danger" | "muted"
> = {
  PENDING: "warning",
  CONFIRMED: "success",
  CANCELLED: "muted",
  COMPLETED: "muted",
  NO_SHOW: "muted",
  REJECTED: "danger",
};

/** Combina fecha YYYY-MM-DD + HH:MM en ISO (interpreta como America/Bogota offset fijo -05). */
export function combineBogotaDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  // Colombia sin DST: UTC-5
  const iso = `${date}T${time}:00-05:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function timeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
