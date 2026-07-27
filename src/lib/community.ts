/** Días de semana usados en complexes.trash_days */
export const WEEKDAY_KEYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

const WEEKDAY_SET = new Set<string>(WEEKDAY_KEYS);

/** getDay() JS: 0=domingo … 6=sábado → clave trash_days */
const JS_DAY_TO_KEY: WeekdayKey[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

/** Día de la semana en America/Bogota (calendario Colombia). */
export function weekdayKeyInBogota(now = new Date()): WeekdayKey {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    weekday: "short",
  }).format(now);
  const map: Record<string, WeekdayKey> = {
    Sun: "SUNDAY",
    Mon: "MONDAY",
    Tue: "TUESDAY",
    Wed: "WEDNESDAY",
    Thu: "THURSDAY",
    Fri: "FRIDAY",
    Sat: "SATURDAY",
  };
  return map[weekday] ?? JS_DAY_TO_KEY[now.getDay()] ?? "MONDAY";
}

export function weekdayKeyFromDate(date: Date): WeekdayKey {
  return weekdayKeyInBogota(date);
}

/** Normaliza trash_days desde DB (array, string CSV, etc.). */
export function normalizeTrashDays(
  trashDays: string[] | string | null | undefined,
): WeekdayKey[] {
  let raw: string[] = [];
  if (Array.isArray(trashDays)) {
    raw = trashDays;
  } else if (typeof trashDays === "string" && trashDays.trim()) {
    raw = trashDays.split(/[,|;]+/);
  }

  const out: WeekdayKey[] = [];
  for (const item of raw) {
    const key = item.trim().toUpperCase();
    if (WEEKDAY_SET.has(key) && !out.includes(key as WeekdayKey)) {
      out.push(key as WeekdayKey);
    }
  }
  return out;
}

export type TrashReminderKind = "today";

/**
 * Aviso de basura: solo el día configurado por el admin (hora Colombia).
 * No muestra anticipación de “mañana” para no cubrir casi toda la semana.
 */
export function getTrashReminder(
  trashDays: string[] | string | null | undefined,
  trashTime: string | null | undefined,
  now = new Date(),
): { kind: TrashReminderKind; message: string } | null {
  const days = normalizeTrashDays(trashDays);
  if (days.length === 0) return null;

  const todayKey = weekdayKeyInBogota(now);
  if (!days.includes(todayKey)) {
    return null;
  }

  const timePart = trashTime?.trim() ? ` a las ${trashTime.trim()}` : "";
  const dayLabel = WEEKDAY_LABELS[todayKey];

  return {
    kind: "today",
    message: `Hoy (${dayLabel}) pasa la basura${timePart}`,
  };
}

export type UtilityServiceType =
  | "WATER"
  | "ELECTRICITY"
  | "GAS"
  | "INTERNET"
  | "OTHER";

export const UTILITY_SERVICE_LABELS: Record<UtilityServiceType, string> = {
  WATER: "Agua",
  ELECTRICITY: "Energía",
  GAS: "Gas",
  INTERNET: "Internet",
  OTHER: "Otro",
};

export function formatCurrencyCOP(amount: number | string): string {
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}
