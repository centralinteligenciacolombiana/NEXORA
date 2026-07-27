import Link from "next/link";
import { AppAtmosphere } from "@/components/layout/app-atmosphere";
import { APP_AUTH_BACKGROUND } from "@/lib/dashboard-backgrounds";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <AppAtmosphere imageSrc={APP_AUTH_BACKGROUND} />
      <Link
        href="/"
        className="relative z-10 mb-8 font-display text-2xl font-semibold tracking-wide text-[var(--brand)] sm:text-3xl"
      >
        NEXORA
      </Link>
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
