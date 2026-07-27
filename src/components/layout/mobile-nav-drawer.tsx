"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth";

export type MobileNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  exact?: boolean;
};

interface MobileNavDrawerProps {
  items: MobileNavItem[];
  homeHref: string;
  complexName?: string | null;
}

export function MobileNavDrawer({
  items,
  homeHref,
  complexName,
}: MobileNavDrawerProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const panel =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] lg:hidden"
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/55"
              aria-label="Cerrar menú"
              onClick={() => setOpen(false)}
            />
            <aside
              className="absolute inset-y-0 right-0 flex h-dvh w-[min(100%,18.5rem)] flex-col bg-[var(--surface)] shadow-2xl"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={homeHref}
                    className="font-display text-lg font-semibold text-[var(--brand)]"
                    onClick={() => setOpen(false)}
                  >
                    NEXORA
                  </Link>
                  {complexName && (
                    <p className="truncate text-xs text-[var(--muted)]">
                      {complexName}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] hover:bg-[var(--slate-100)]"
                  aria-label="Cerrar"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>

              <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
                <ul className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = item.exact
                      ? pathname === item.href
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                            active
                              ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                              : "text-[var(--foreground)] hover:bg-[var(--slate-100)]",
                          )}
                        >
                          <Icon className="size-5 shrink-0" aria-hidden />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div
                className="shrink-0 border-t border-[var(--border)] p-3"
                style={{
                  paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
                }}
              >
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
                  >
                    <LogOut className="size-4" aria-hidden />
                    Salir
                  </button>
                </form>
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 text-[var(--foreground)] shadow-sm lg:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        aria-label="Abrir menú"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      {panel}
    </>
  );
}
