export type VehicleType = "CAR" | "MOTORCYCLE";

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  CAR: "Automóvil",
  MOTORCYCLE: "Motocicleta",
};

/** Normaliza placa para búsqueda/unicidad (sin espacios ni guiones). */
export function normalizePlate(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function formatPlateDisplay(raw: string): string {
  const n = normalizePlate(raw);
  if (n.length === 6) {
    // ABC123 → ABC-123 (común CO)
    return `${n.slice(0, 3)}-${n.slice(3)}`;
  }
  if (n.length === 5) {
    // ABC12 → ABC-12 / moto
    return `${n.slice(0, 3)}-${n.slice(3)}`;
  }
  return n;
}

export function isValidPlate(raw: string): boolean {
  const n = normalizePlate(raw);
  return n.length >= 5 && n.length <= 12;
}
