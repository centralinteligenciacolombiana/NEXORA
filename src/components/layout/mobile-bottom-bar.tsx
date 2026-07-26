"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, QrCode, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
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

export function MobileBottomBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación residente"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white/95 backdrop-blur-md sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  active
                    ? "text-[var(--brand)]"
                    : "text-[var(--slate-500)] hover:text-[var(--slate-700)]",
                )}
              >
                <Icon
                  className={cn("size-5", active && "stroke-[2.25px]")}
                  aria-hidden
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
