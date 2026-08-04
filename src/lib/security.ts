export type SecurityPost = "LOBBY" | "PATROL" | "MIXED";
export type ShiftType = "DAY" | "NIGHT";

export const SECURITY_POST_LABELS: Record<SecurityPost, string> = {
  LOBBY: "Lobby / recepción",
  PATROL: "Patrullaje",
  MIXED: "Mixto (lobby y patrulla)",
};

export const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  DAY: "Turno día",
  NIGHT: "Turno noche",
};

export function parseSecurityPost(raw: string): SecurityPost | null {
  const v = raw.trim().toUpperCase();
  if (v === "LOBBY" || v === "PATROL" || v === "MIXED") return v;
  return null;
}

export function parseShiftType(raw: string): ShiftType | null {
  const v = raw.trim().toUpperCase();
  if (v === "DAY" || v === "NIGHT") return v;
  return null;
}
