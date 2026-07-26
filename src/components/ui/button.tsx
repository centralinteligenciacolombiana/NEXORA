import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

const variantStyles = {
  primary:
    "bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] focus:ring-[var(--brand)]",
  secondary:
    "border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--slate-100)]",
  outline:
    "border border-[var(--brand)]/30 bg-transparent text-[var(--brand)] hover:bg-[var(--brand-soft)]",
  ghost: "text-[var(--muted)] hover:bg-[var(--slate-100)] hover:text-[var(--foreground)]",
};

const sizeStyles = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
