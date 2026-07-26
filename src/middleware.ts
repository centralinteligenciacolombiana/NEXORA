import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (error) {
    console.error("[middleware] fatal:", error);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    /*
     * Excluye estáticos, PWA y assets; incluye el resto de rutas de la app.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
