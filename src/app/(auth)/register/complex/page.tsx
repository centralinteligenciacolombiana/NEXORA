import Link from "next/link";
import { AuthForm, Input } from "@/components/shared/auth-form";
import { registerComplexAction } from "@/lib/actions/auth";

export default function RegisterComplexPage() {
  return (
    <div className="rounded-2xl border border-black/5 bg-[var(--surface)] p-6 shadow-sm sm:p-8">
      <h2 className="font-display text-2xl font-semibold text-[var(--foreground)]">
        Registrar conjunto
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Crea el espacio de tu comunidad. Tú serás el primer administrador (máx.
        2 por conjunto).
      </p>
      <div className="mt-6">
        <AuthForm
          action={registerComplexAction}
          submitLabel="Crear conjunto y cuenta"
          footer={
            <p className="text-center text-sm text-[var(--muted)]">
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/login"
                className="font-medium text-[var(--brand)] hover:underline"
              >
                Inicia sesión
              </Link>
            </p>
          }
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Tu cuenta (administrador)
          </p>
          <Input
            name="fullName"
            label="Nombre completo"
            type="text"
            required
            placeholder="María Gómez"
          />
          <Input
            name="email"
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            required
            placeholder="admin@conjunto.com"
          />
          <Input
            name="phone"
            label="Teléfono"
            type="tel"
            placeholder="300 123 4567"
          />
          <Input
            name="password"
            label="Contraseña"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Mínimo 8 caracteres"
          />

          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Datos del conjunto
          </p>
          <Input
            name="complexName"
            label="Nombre del conjunto"
            type="text"
            required
            placeholder="Residencial Los Almendros"
          />
          <Input
            name="slug"
            label="Identificador URL (opcional)"
            type="text"
            placeholder="los-almendros"
          />
          <Input
            name="city"
            label="Ciudad"
            type="text"
            placeholder="Bogotá"
          />
          <Input
            name="address"
            label="Dirección"
            type="text"
            placeholder="Calle 123 #45-67"
          />
        </AuthForm>
      </div>
    </div>
  );
}
