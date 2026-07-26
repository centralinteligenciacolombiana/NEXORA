import { DashboardShell } from "@/components/layout/dashboard-shell";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: UserRole | null = null;
  let complexName: string | null = null;
  let registrationStatus: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, complex_id, registration_status")
      .eq("id", user.id)
      .maybeSingle();

    role = (profile?.role as UserRole) ?? null;
    registrationStatus = profile?.registration_status ?? "APPROVED";

    if (profile?.complex_id) {
      const { data: complex } = await supabase
        .from("complexes")
        .select("name")
        .eq("id", profile.complex_id)
        .maybeSingle();
      complexName = complex?.name ?? null;
    }
  }

  return (
    <DashboardShell
      role={role}
      complexName={complexName}
      registrationStatus={registrationStatus}
    >
      {children}
    </DashboardShell>
  );
}
