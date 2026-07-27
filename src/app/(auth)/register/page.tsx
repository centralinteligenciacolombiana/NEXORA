import Link from "next/link";
import { redirect } from "next/navigation";

/** Registro abierto sin invite no está permitido (evitar elegir conjunto ajeno). */
export default function RegisterIndexPage() {
  redirect("/register/complex");

  return (
    <div className="rounded-2xl border border-black/5 bg-[var(--surface)] p-6 text-center shadow-sm">
      <p className="text-sm text-[var(--muted)]">
        Redirigiendo…{" "}
        <Link href="/register/complex" className="text-[var(--brand)]">
          Registrar conjunto
        </Link>
      </p>
    </div>
  );
}
