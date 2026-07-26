import Link from "next/link";
import { getDashboardBackgrounds } from "@/lib/dashboard-backgrounds";
import { BackgroundMedia } from "@/components/ui/background-media";

export default function HomePage() {
  const backgrounds = getDashboardBackgrounds("landing");

  return (
    <main className="relative min-h-screen overflow-hidden">
      <BackgroundMedia
        images={backgrounds}
        priority
        intervalMs={6500}
        className="z-0"
      />
      {/* Overlay: legibilidad WCAG sobre fotos */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-slate-950/75 via-slate-950/55 to-slate-950/80"
      />

      <div className="relative z-[2] mx-auto flex min-h-screen max-w-5xl flex-col px-5 pb-10 pt-6 sm:px-8 sm:pt-8">
        <header className="flex items-center justify-between">
          <p className="nexora-text-on-dark font-display text-lg font-semibold tracking-wide text-white sm:text-xl">
            NEXORA
          </p>
          <Link
            href="/login"
            className="text-sm font-medium text-white/85 transition-colors hover:text-white"
          >
            Ya tengo cuenta
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 sm:py-20">
          <p className="nexora-text-on-dark mb-4 max-w-xl font-display text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl animate-[fadeUp_0.7s_ease-out]">
            NEXORA
          </p>
          <h1 className="sr-only">
            NEXORA — administración de conjuntos residenciales
          </h1>
          <p className="nexora-text-on-dark max-w-md text-base leading-relaxed text-white/90 sm:text-lg animate-[fadeUp_0.7s_ease-out_0.12s_both]">
            Un ecosistema digital por cada conjunto residencial. El administrador
            configura su comunidad; los residentes entran solo con el enlace de
            su conjunto.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center animate-[fadeUp_0.7s_ease-out_0.24s_both]">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-[#c4a35a] px-6 py-3.5 text-sm font-semibold text-[#0a2e24] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register/complex"
              className="inline-flex items-center justify-center rounded-lg border border-white/40 bg-white/15 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              Registrar mi conjunto
            </Link>
          </div>

          <p className="nexora-text-on-dark mt-8 max-w-sm text-sm text-white/70 animate-[fadeUp_0.7s_ease-out_0.36s_both]">
            ¿Eres residente? Pide a tu administración el enlace de registro. No
            elijas un conjunto ajeno: el link ya viene amarrado al tuyo.
          </p>
        </section>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
