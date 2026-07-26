/** Tipo de ocupación de la vivienda (residente). No confundir con rol STAFF/SECURITY. */
export type OccupancyType = "OWNER" | "TENANT" | "TEMPORARY";

export const OCCUPANCY_LABELS: Record<OccupancyType, string> = {
  OWNER: "Propietario",
  TENANT: "En arriendo",
  TEMPORARY: "Ocupación temporal",
};

export function occupancyLabel(
  value: string | null | undefined,
  isOwner?: boolean | null,
): string {
  const raw = (value ?? (isOwner ? "OWNER" : "")).trim().toUpperCase();
  if (raw === "OWNER" || raw === "TENANT" || raw === "TEMPORARY") {
    return OCCUPANCY_LABELS[raw];
  }
  return "—";
}
