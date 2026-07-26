import { redirect } from "next/navigation";

/** Ruta legada: el QR vive en cada pase de visita. */
export default function ResidentQrPage() {
  redirect("/dashboard/resident/visits");
}
