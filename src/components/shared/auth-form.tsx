"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import type { AuthActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

interface AuthFormProps {
  action: (
    prev: AuthActionState,
    formData: FormData,
  ) => Promise<AuthActionState>;
  submitLabel: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthForm({
  action,
  submitLabel,
  children,
  footer,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  if (state.success && state.message) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-white text-emerald-700">
          <MailCheck className="size-6" aria-hidden />
        </div>
        <h3 className="mt-3 font-display text-lg font-semibold text-emerald-950">
          Revisa tu correo
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-emerald-900">
          {state.message}
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {children}
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Procesando…" : submitLabel}
      </Button>
      {footer}
    </form>
  );
}

export { Input };
