"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CopyInviteButtonProps {
  url: string;
  label?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CopyInviteButton({
  url,
  label = "Copiar enlace",
  variant = "secondary",
  size = "sm",
  className,
}: CopyInviteButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={className}
    >
      {copied ? (
        <>
          <Check className="size-4" aria-hidden />
          Copiado
        </>
      ) : (
        <>
          <Copy className="size-4" aria-hidden />
          {label}
        </>
      )}
      <span className="sr-only">
        <Link2 className="size-4" />
      </span>
    </Button>
  );
}
