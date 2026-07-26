import Link from "next/link";
import { AuthForm, Input } from "@/components/shared/auth-form";
import { completeComplexRegistrationAction } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ROLE_DASHBOARD, type UserRole } from "@/types";

export default async function CompleteComplexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/register/complex");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.complex_id) {
    redirect(ROLE_DASHBOARD[(profile.role as UserRole) ?? "ADMIN"]);
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="font-display text-2xl font-semibold">Completar conjunto</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Tu cuenta ya está lista. Define los datos del conjunto residencial.
      </p>
      <div className="mt-6">
        <AuthForm
          action={completeComplexRegistrationAction}
          submitLabel="Crear conjunto"
          footer={
            <p className="text-center text-sm text-[var(--muted)]">
              <Link href="/onboarding" className="text-[var(--brand)] hover:underline">
                Volver
              </Link>
            </p>
          }
        >
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
          <Input name="city" label="Ciudad" type="text" placeholder="Bogotá" />
          <Input
            name="address"
            label="Dirección"
            type="text"
            placeholder="Calle 123 #45-67"
          />
          <Input name="phone" label="Teléfono del conjunto" type="tel" />
        </AuthForm>
      </div>
    </div>
  );
}
