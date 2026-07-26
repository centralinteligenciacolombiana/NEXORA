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

export function weekdayKeyFromDate(date: Date): WeekdayKey {
  return JS_DAY_TO_KEY[date.getDay()] ?? "MONDAY";
}

export type TrashReminderKind = "today" | "tomorrow" | null;

export function getTrashReminder(
  trashDays: string[] | null | undefined,
  trashTime: string | null | undefined,
  now = new Date(),
): { kind: TrashReminderKind; message: string } | null {
  const days = (trashDays ?? []).map((d) => d.toUpperCase());
  if (days.length === 0) return null;

  const todayKey = weekdayKeyFromDate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = weekdayKeyFromDate(tomorrow);

  const timePart = trashTime?.trim() ? ` a las ${trashTime.trim()}` : "";

  if (days.includes(todayKey)) {
    return {
      kind: "today",
      message: `Hoy pasa la basura${timePart || ""}`,
    };
  }

  if (days.includes(tomorrowKey)) {
    return {
      kind: "tomorrow",
      message: `Mañana pasa la basura${timePart || ""}`,
    };
  }

  return null;
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
