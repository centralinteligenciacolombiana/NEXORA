import Link from "next/link";
import { AuthForm, Input } from "@/components/shared/auth-form";
import { loginAction } from "@/lib/actions/auth";

interface LoginPageProps {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <div className="rounded-2xl border border-black/5 bg-[var(--surface)] p-6 shadow-sm sm:p-8">
      <h2 className="font-display text-2xl font-semibold text-[var(--foreground)]">
        Iniciar sesión
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Accede al panel de tu conjunto
      </p>

      {params.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {params.error}
        </p>
      )}

      <div className="mt-6">
        <AuthForm action={loginAction} submitLabel="Entrar">
          <Input
            name="email"
            label="Correo o unidad"
            type="text"
            autoComplete="username"
            required
            placeholder="tu@email.com o TorreA-501"
          />
          <Input
            name="password"
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </AuthForm>
      </div>
      <div className="mt-6 space-y-2 text-center text-sm text-[var(--muted)]">
        <p className="text-xs">
          Residentes: entra con tu correo confirmado o con tu unidad (ej.
          TorreA-501).
        </p>
        <p>
          ¿Administras un conjunto nuevo?{" "}
          <Link
            href="/register/complex"
            className="font-medium text-[var(--brand)] hover:underline"
          >
            Regístralo aquí
          </Link>
        </p>
        <p className="text-xs">
          Residentes y personal: usa el enlace o QR que compartió tu
          administración.
        </p>
      </div>
    </div>
  );
}
