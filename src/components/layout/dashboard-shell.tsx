"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  BookOpen,
  FileText,
  FolderKanban,
  Home,
  LayoutDashboard,
  Link2,
  LogOut,
  MessageSquareWarning,
  Package,
  QrCode,
  Settings,
  Shield,
  Trash2,
  UserRound,
  UserCheck,
  Vote,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth";
import { AppAtmosphere } from "@/components/layout/app-atmosphere";
import { MobileBottomBar } from "@/components/layout/mobile-bottom-bar";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { getShellBackground } from "@/lib/dashboard-backgrounds";
import type { UserRole } from "@/types";

interface DashboardShellProps {
  children: React.ReactNode;
  role?: UserRole | null;
  complexName?: string | null;
  registrationStatus?: string | null;
}

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  ADMIN: [
    { href: "/dashboard/admin", label: "Inicio", icon: LayoutDashboard, exact: true },
    {
      href: "/dashboard/admin/approvals",
      label: "Confirmar altas",
      icon: UserCheck,
    },
    { href: "/dashboard/admin/invites", label: "Invitaciones", icon: Link2 },
    {
      href: "/dashboard/admin/settings",
      label: "Configuración",
      icon: Settings,
    },
    {
      href: "/dashboard/admin/settings/security",
      label: "Turnos",
      icon: BookOpen,
    },
    {
      href: "/dashboard/admin/settings/community",
      label: "Comunidad",
      icon: Trash2,
    },
    {
      href: "/dashboard/admin/finances",
      label: "Finanzas",
      icon: Wallet,
    },
    {
      href: "/dashboard/admin/projects",
      label: "Proyectos",
      icon: FolderKanban,
    },
    {
      href: "/dashboard/admin/voting",
      label: "Votaciones",
      icon: Vote,
    },
    {
      href: "/dashboard/admin/pqrs",
      label: "PQRS",
      icon: MessageSquareWarning,
    },
    { href: "/dashboard/security", label: "Portería", icon: Shield },
    { href: "/dashboard/security/deliveries", label: "Paquetes", icon: Package },
  ],
  RESIDENT: [
    { href: "/dashboard/resident", label: "Inicio", icon: Home, exact: true },
    { href: "/dashboard/resident/visits", label: "Visitas", icon: QrCode },
    {
      href: "/dashboard/resident/deliveries",
      label: "Paquetes",
      icon: Package,
    },
    {
      href: "/dashboard/resident/finances",
      label: "Finanzas",
      icon: Wallet,
    },
    {
      href: "/dashboard/resident/pqrs",
      label: "PQRS",
      icon: MessageSquareWarning,
    },
    {
      href: "/dashboard/resident/projects",
      label: "Proyectos",
      icon: FolderKanban,
    },
    {
      href: "/dashboard/resident/voting",
      label: "Votar",
      icon: Vote,
    },
    {
      href: "/dashboard/resident/security-team",
      label: "Vigilancia",
      icon: Shield,
    },
    { href: "/dashboard/resident/profile", label: "Perfil", icon: UserRound },
  ],
  STAFF: [{ href: "/dashboard/staff", label: "Inicio", icon: Building2, exact: true }],
  SECURITY: [
    { href: "/dashboard/security", label: "Portería", icon: Shield, exact: true },
    { href: "/dashboard/security/deliveries", label: "Paquetes", icon: Package },
    {
      href: "/dashboard/security/utilities",
      label: "Recibos",
      icon: FileText,
    },
    {
      href: "/dashboard/security/logbook",
      label: "Bitácora",
      icon: BookOpen,
    },
  ],
};

const RESIDENT_TABS = [
  {
    href: "/dashboard/resident",
    label: "Inicio",
    icon: Home,
    exact: true,
  },
  {
    href: "/dashboard/resident/visits",
    label: "Visitas",
    icon: QrCode,
    exact: false,
  },
  {
    href: "/dashboard/resident/deliveries",
    label: "Paquetes",
    icon: Package,
    exact: false,
  },
  {
    href: "/dashboard/resident/profile",
    label: "Perfil",
    icon: UserRound,
    exact: false,
  },
] as const;

const SECURITY_TABS = [
  {
    href: "/dashboard/security",
    label: "Portería",
    icon: Shield,
    exact: true,
  },
  {
    href: "/dashboard/security/deliveries",
    label: "Paquetes",
    icon: Package,
    exact: false,
  },
  {
    href: "/dashboard/security/utilities",
    label: "Recibos",
    icon: FileText,
    exact: false,
  },
  {
    href: "/dashboard/security/logbook",
    label: "Bitácora",
    icon: BookOpen,
    exact: false,
  },
] as const;

export function DashboardShell({
  children,
  role,
  complexName,
  registrationStatus,
}: DashboardShellProps) {
  const pathname = usePathname();
  const awaitingApproval =
    registrationStatus === "PENDING" || registrationStatus === "REJECTED";
  const items = role && !awaitingApproval ? NAV_BY_ROLE[role] : [];
  const homeHref = items[0]?.href ?? "/";
  const isResident = role === "RESIDENT" && !awaitingApproval;
  const isSecurity = role === "SECURITY" && !awaitingApproval;
  const showBottomBar = isResident || isSecurity;
  const showMobileDrawer = !awaitingApproval && items.length > 0;
  const bgImage = getShellBackground(role);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <AppAtmosphere imageSrc={bgImage} />

      <header className="sticky top-0 z-30 border-b border-[var(--border)]/80 bg-[var(--surface)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-6">
          <div className="min-w-0 flex-1">
            <Link
              href={awaitingApproval ? "/dashboard/pending-approval" : homeHref}
              className="font-display text-lg font-semibold tracking-wide text-[var(--brand)]"
            >
              NEXORA
            </Link>
            {complexName && (
              <p className="truncate text-xs text-[var(--muted)]">
                {complexName}
              </p>
            )}
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {items.map((item) => {
              const Icon = item.icon;
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                      : "text-[var(--muted)] hover:bg-[var(--slate-100)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--slate-100)] hover:text-[var(--foreground)]"
              >
                <LogOut className="size-4" aria-hidden />
                Salir
              </button>
            </form>
          </nav>

          {/* Mobile / tablet: menú (Salir va dentro del drawer) */}
          <div className="flex items-center gap-2 lg:hidden">
            {showMobileDrawer ? (
              <MobileNavDrawer
                items={items}
                homeHref={homeHref}
                complexName={complexName}
              />
            ) : (
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 px-3 text-sm font-semibold text-[var(--foreground)] shadow-sm"
                  aria-label="Salir"
                >
                  <LogOut className="size-4 shrink-0" aria-hidden />
                  <span>Salir</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      <main
        className={cn(
          "relative z-10 mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6 sm:py-8",
          showBottomBar && "pb-24 sm:pb-8",
        )}
      >
        {children}
      </main>

      {isResident && (
        <MobileBottomBar items={RESIDENT_TABS} ariaLabel="Navegación residente" />
      )}
      {isSecurity && (
        <MobileBottomBar items={SECURITY_TABS} ariaLabel="Navegación seguridad" />
      )}
    </div>
  );
}
