/** Roles de usuario en el conjunto residencial */
export type UserRole = "ADMIN" | "RESIDENT" | "STAFF" | "SECURITY";

export const USER_ROLES = [
  "ADMIN",
  "RESIDENT",
  "STAFF",
  "SECURITY",
] as const satisfies readonly UserRole[];

/** Conjunto residencial (tenant) */
export interface Complex {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  nit?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  maxAdmins: number;
  isActive: boolean;
  enableShiftLogbook?: boolean;
  trashDays?: string[];
  trashNotes?: string | null;
  trashTime?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Invitación de registro amarrada a un conjunto */
export interface ComplexInvite {
  id: string;
  complexId: string;
  token: string;
  role: UserRole;
  unitId?: string | null;
  email?: string | null;
  label?: string | null;
  maxUses?: number | null;
  usesCount: number;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
}

/** Perfil de usuario (tabla profiles) */
export interface Profile {
  id: string;
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
  role: UserRole;
  complexId?: string | null;
  unitId?: string | null;
  isOwner: boolean;
  registrationStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  occupancyType?: "OWNER" | "TENANT" | "TEMPORARY" | null;
  loginCode?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Unidad habitacional dentro del conjunto */
export interface Unit {
  id: string;
  complexId: string;
  number: string;
  tower?: string | null;
  floor?: number | null;
  ownerId?: string | null;
}

/** Tipo de autorización de un pase de visita */
export type VisitorAccessType = "TODAY" | "OPEN";

/** Estado del ciclo de vida de un visitante / pase */
export type VisitorStatus =
  | "PENDING"
  | "APPROVED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "DENIED"
  | "CANCELLED";

/** Pase de visita con QR y ventana de autorización */
export interface VisitorPass {
  id: string;
  unitId: string;
  visitorName: string;
  documentId?: string | null;
  qrCode: string;
  accessType: VisitorAccessType;
  validFrom: string;
  validUntil?: string | null;
  status: VisitorStatus;
  entryTime?: string | null;
  exitTime?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Payload público de get_invite_by_token */
export interface InvitePreview {
  valid: boolean;
  error?: string;
  invite?: {
    id: string;
    token: string;
    role: UserRole;
    unit_id?: string | null;
    label?: string | null;
    email?: string | null;
  };
  complex?: {
    id: string;
    name: string;
    slug: string;
    city?: string | null;
    address?: string | null;
    logo_url?: string | null;
  };
}

/** Respuesta genérica de API */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

/** Rutas de panel por rol */
export const ROLE_DASHBOARD: Record<UserRole, string> = {
  ADMIN: "/dashboard/admin",
  RESIDENT: "/dashboard/resident",
  STAFF: "/dashboard/staff",
  SECURITY: "/dashboard/security",
};
