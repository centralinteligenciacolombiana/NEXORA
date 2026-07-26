import Link from "next/link";
import {
  FolderKanban,
  Link2,
  MessageSquareWarning,
  Settings,
  UserCheck,
  Vote,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getDashboardBackgrounds } from "@/lib/dashboard-backgrounds";
import {
  BackgroundPanel,
  GlassCard,
} from "@/components/ui/background-panel";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("complex_id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "ADMIN") {
    redirect("/onboarding");
  }

  const { data: complex } = await supabase
    .from("complexes")
    .select("name, city, slug")
    .eq("id", profile.complex_id)
    .single();

  const tiles = [
    {
      href: "/dashboard/admin/approvals",
      icon: UserCheck,
      title: "Confirmar registros",
      description:
        "Aprueba o rechaza a quien se registró con el link o QR del conjunto.",
    },
    {
      href: "/dashboard/admin/invites",
      icon: Link2,
      title: "Invitaciones QR / Link",
      description: "Genera el enlace y código QR para compartir con la comunidad.",
    },
    {
      href: "/dashboard/admin/settings",
      icon: Settings,
      title: "Datos del conjunto",
      description: "Torres, unidades, logo y zonas comunes.",
    },
    {
      href: "/dashboard/admin/projects",
      icon: FolderKanban,
      title: "Proyectos",
      description: "Portafolio y rendición de cuentas anual.",
    },
    {
      href: "/dashboard/admin/voting",
      icon: Vote,
      title: "Votaciones",
      description: "Encuestas express y resultados en vivo.",
    },
    {
      href: "/dashboard/admin/pqrs",
      icon: MessageSquareWarning,
      title: "PQRS",
      description: "Quejas, fallas y seguimiento de tickets.",
    },
    {
      href: "/dashboard/admin/finances",
      icon: Wallet,
      title: "Finanzas",
      description: "Cuotas, recordatorios y comprobantes.",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <BackgroundPanel
        bgImageUrls={getDashboardBackgrounds("admin")}
        overlayOpacity="bg-slate-950/60"
        priority
        rounded="3xl"
        carouselIntervalMs={7500}
        contentClassName="p-5 sm:p-7"
      >
        <p className="nexora-text-on-dark text-sm font-medium text-indigo-100">
          Panel de administración
        </p>
        <h1 className="nexora-text-on-dark mt-1 font-display text-2xl font-semibold text-white sm:text-3xl">
          {complex?.name ?? "Tu conjunto"}
        </h1>
        <p className="nexora-text-on-dark mt-2 max-w-2xl text-sm text-slate-200 sm:text-base">
          Prepara el terreno: configura el conjunto, genera invitaciones QR/link
          y da acceso a cada residente.
          {complex?.city ? ` · ${complex.city}` : ""}
        </p>
      </BackgroundPanel>

      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <GlassCard
              key={tile.href}
              as="div"
              padding="none"
              className="transition-colors hover:border-[var(--brand)]/40"
            >
              <Link href={tile.href} className="block px-5 py-4">
                <Icon className="size-5 text-[var(--brand)]" aria-hidden />
                <span className="mt-3 block font-semibold text-[var(--foreground)]">
                  {tile.title}
                </span>
                <span className="mt-1 block text-sm text-[var(--muted)]">
                  {tile.description}
                </span>
              </Link>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
