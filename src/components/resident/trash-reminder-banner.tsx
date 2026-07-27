"use client";

import { Trash2 } from "lucide-react";

interface TrashReminderBannerProps {
  message: string;
  kind?: "today";
  notes?: string | null;
}

export function TrashReminderBanner({
  message,
  notes,
}: TrashReminderBannerProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[var(--brand)]/25 bg-gradient-to-br from-[var(--brand-soft)] via-[var(--surface)] to-[var(--emerald-soft)] p-4 shadow-sm"
      role="status"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-[var(--brand)]/10 blur-xl"
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/15 text-[var(--brand)]">
          <Trash2
            className="size-5 animate-[pulse_2s_ease-in-out_infinite]"
            aria-hidden
          />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {message}
          </p>
          {notes ? (
            <p className="mt-1 text-xs text-[var(--muted)]">{notes}</p>
          ) : (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Recuerda sacar las bolsas a tiempo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
