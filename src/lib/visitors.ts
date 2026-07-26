import type { VisitorAccessType, VisitorStatus } from "@/types";

export const VISITOR_ACCESS_LABELS: Record<VisitorAccessType, string> = {
  TODAY: "Solo hoy",
  OPEN: "Acceso libre",
};

export const VISITOR_STATUS_LABELS: Record<VisitorStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Autorizado",
  CHECKED_IN: "Ingresó",
  CHECKED_OUT: "Salió",
  DENIED: "Denegado",
  CANCELLED: "Cancelado",
};

export const OPEN_ACCESS_DAY_OPTIONS = [7, 15, 30] as const;

const BOGOTA_OFFSET = "-05:00";

/** Fecha civil actual en America/Bogota (YYYY-MM-DD). */
export function bogotaCalendarDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Fin del día civil en Bogotá (23:59:59.999 -05). */
export function endOfBogotaDay(calendarDate: string): Date {
  return new Date(`${calendarDate}T23:59:59.999${BOGOTA_OFFSET}`);
}

/** Suma días a una fecha civil YYYY-MM-DD. */
export function addCalendarDays(calendarDate: string, days: number): string {
  const [y, m, d] = calendarDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d!));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function computeVisitorValidity(
  accessType: VisitorAccessType,
  openDays: number,
  now = new Date(),
): { validFrom: string; validUntil: string } {
  const today = bogotaCalendarDate(now);
  const validFrom = now.toISOString();

  if (accessType === "TODAY") {
    return {
      validFrom,
      validUntil: endOfBogotaDay(today).toISOString(),
    };
  }

  const days = Math.max(1, Math.min(90, Math.floor(openDays)));
  const lastDay = addCalendarDays(today, days - 1);
  return {
    validFrom,
    validUntil: endOfBogotaDay(lastDay).toISOString(),
  };
}

export function isVisitorPassActive(input: {
  status: VisitorStatus;
  validFrom?: string | null;
  validUntil?: string | null;
  now?: Date;
}): { active: boolean; reason?: string } {
  const now = input.now ?? new Date();

  if (
    input.status === "CANCELLED" ||
    input.status === "DENIED" ||
    input.status === "CHECKED_OUT"
  ) {
    return {
      active: false,
      reason: `El pase está ${VISITOR_STATUS_LABELS[input.status].toLowerCase()}.`,
    };
  }

  if (input.validFrom && new Date(input.validFrom) > now) {
    return { active: false, reason: "La autorización aún no inicia." };
  }

  if (input.validUntil && new Date(input.validUntil) < now) {
    return {
      active: false,
      reason: "La autorización venció. El residente debe renovar el pase.",
    };
  }

  return { active: true };
}

export function visitorAccessLabel(
  accessType: VisitorAccessType | null | undefined,
): string {
  if (!accessType) return "—";
  return VISITOR_ACCESS_LABELS[accessType];
}
