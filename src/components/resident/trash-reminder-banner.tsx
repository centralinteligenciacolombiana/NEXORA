"use client";

import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrashReminderBannerProps {
  message: string;
  kind: "today" | "tomorrow";
  notes?: string | null;
}

export function TrashReminderBanner({
  message,
  kind,
  notes,
}: TrashReminderBannerProps) {
  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-top-2 relative overflow-hidden rounded-2xl border p-4 shadow-sm duration-500",
        kind === "today"
          ? "border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100"
          : "border-sky-200 bg-gradient-to-br from-sky-50 via-cyan-50 to-sky-100",
      )}
      role="status"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-white/40 blur-xl"
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            kind === "today"
              ? "bg-amber-200/80 text-amber-900"
              : "bg-sky-200/80 text-sky-900",
          )}
        >
          <Trash2
            className={cn(
              "size-5",
              kind === "today" && "animate-[pulse_2s_ease-in-out_infinite]",
            )}
            aria-hidden
          />
        </span>
        <div>
          <p
            className={cn(
              "text-sm font-semibold",
              kind === "today" ? "text-amber-950" : "text-sky-950",
            )}
          >
            {message}
          </p>
          {notes ? (
            <p
              className={cn(
                "mt-1 text-xs",
                kind === "today" ? "text-amber-800/80" : "text-sky-800/80",
              )}
            >
              {notes}
            </p>
          ) : (
            <p
              className={cn(
                "mt-1 text-xs",
                kind === "today" ? "text-amber-800/80" : "text-sky-800/80",
              )}
            >
              Recuerda sacar las bolsas a tiempo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
