import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4 py-10">
      <Link
        href="/"
        className="mb-8 font-display text-2xl font-semibold tracking-wide text-[var(--brand)] sm:text-3xl"
      >
        NEXORA
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
