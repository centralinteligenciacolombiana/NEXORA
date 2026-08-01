export type MoveRequestType = "MOVE_IN" | "MOVE_OUT";
export type MoveRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export const MOVE_TYPE_LABELS: Record<MoveRequestType, string> = {
  MOVE_IN: "Ingreso / mudanza entrante",
  MOVE_OUT: "Salida / mudanza saliente",
};

export const MOVE_VERIFY_ACTION_LABELS: Record<MoveRequestType, string> = {
  MOVE_IN: "Marcar ingreso verificado",
  MOVE_OUT: "Marcar salida verificada",
};

export const MOVE_STATUS_LABELS: Record<MoveRequestStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};

export const MOVE_STATUS_BADGE: Record<
  MoveRequestStatus,
  "warning" | "success" | "danger"
> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};
