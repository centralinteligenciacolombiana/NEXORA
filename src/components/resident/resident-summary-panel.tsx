import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ChevronRight,
  MessageSquareWarning,
  Package,
  Trash2,
  Vote,
  FolderKanban,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/background-panel";
import { cn } from "@/lib/utils";

export type SummaryItemTone = "brand" | "warning" | "success" | "danger" | "muted";

export interface ResidentSummaryItem {
  id: string;
  href?: string;
  title: string;
  subtitle: string;
  icon: "vote" | "project" | "trash" | "package" | "pqrs" | "wallet";
  tone?: SummaryItemTone;
  badge?: string;
  badgeVariant?: "default" | "success" | "warning" | "danger" | "muted";
}

const ICONS: Record<ResidentSummaryItem["icon"], LucideIcon> = {
  vote: Vote,
  project: FolderKanban,
  trash: Trash2,
  package: Package,
  pqrs: MessageSquareWarning,
  wallet: Wallet,
};

const TONE_ICON: Record<SummaryItemTone, string> = {
  brand: "bg-[var(--brand-soft)] text-[var(--brand)]",
  warning: "bg-amber-50 text-amber-700",
  success: "bg-emerald-50 text-emerald-700",
  danger: "bg-red-50 text-red-700",
  muted: "bg-black/5 text-[var(--muted)]",
};

interface ResidentSummaryPanelProps {
  items: ResidentSummaryItem[];
}

function SummaryRow({ item }: { item: ResidentSummaryItem }) {
  const Icon = ICONS[item.icon];
  const tone = item.tone ?? "brand";
  const content = (
    <>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          TONE_ICON[tone],
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {item.title}
          </span>
          {item.badge ? (
            <Badge variant={item.badgeVariant ?? "muted"}>{item.badge}</Badge>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--muted)]">
          {item.subtitle}
        </span>
      </span>
      {item.href ? (
        <ChevronRight
          className="size-4 shrink-0 text-[var(--muted)]"
          aria-hidden
        />
      ) : null}
    </>
  );

  const className = cn(
    "flex w-full items-center gap-3 rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/80 px-3 py-3 transition-colors",
    item.href && "hover:border-[var(--brand)]/35 active:bg-[var(--brand-soft)]/40",
  );

  if (item.href) {
    return (
      <Link href={item.href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className} role="status">
      {content}
    </div>
  );
}

/**
 * Centro compacto de avisos del residente.
 * Solo se renderiza si hay ítems aplicables.
 */
export function ResidentSummaryPanel({ items }: ResidentSummaryPanelProps) {
  if (items.length === 0) return null;

  return (
    <GlassCard as="section" blur="md" padding="md" className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--slate-700)]">
          Para ti ahora
        </h2>
        <span className="text-xs text-[var(--muted)]">
          {items.length} aviso{items.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <SummaryRow item={item} />
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
