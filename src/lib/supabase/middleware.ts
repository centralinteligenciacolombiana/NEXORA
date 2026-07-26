import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROLE_DASHBOARD, type UserRole } from "@/types";
import {
  getSupabaseAnonKeySafe,
  getSupabaseUrlSafe,
} from "@/lib/supabase/env";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
  return to;
}

function roleHome(role: string | null | undefined): string {
  if (role && role in ROLE_DASHBOARD) {
    return ROLE_DASHBOARD[role as UserRole];
  }
  return "/onboarding";
}

/**
 * Refresca la sesión y aplica redirecciones por rol / conjunto.
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = getSupabaseUrlSafe();
  const supabaseAnonKey = getSupabaseAnonKeySafe();

  // Sin env en Edge: no tumbar el sitio (Netlify muestra "edge function crashed").
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[middleware] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/auth/")) {
      return supabaseResponse;
    }

    const isAuthPage =
      pathname === "/login" || pathname.startsWith("/register");
    const isOnboarding = pathname === "/onboarding";
    const isDashboardRoot = pathname === "/dashboard";
    const isDashboardArea = pathname.startsWith("/dashboard/");
    const isLegacyPanel =
      pathname === "/admin" ||
      pathname.startsWith("/admin/") ||
      pathname === "/resident" ||
      pathname.startsWith("/resident/") ||
      pathname === "/staff" ||
      pathname.startsWith("/staff/");

    if (!user) {
      if (isDashboardArea || isDashboardRoot || isOnboarding || isLegacyPanel) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("next", pathname);
        return copyCookies(supabaseResponse, NextResponse.redirect(url));
      }
      return supabaseResponse;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, complex_id, registration_status")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role ?? null;
    const hasComplex = Boolean(profile?.complex_id);
    const regStatus = profile?.registration_status ?? "APPROVED";
    const home = hasComplex ? roleHome(role) : "/onboarding";
    const isPendingGate = pathname === "/dashboard/pending-approval";

    if (
      hasComplex &&
      (regStatus === "PENDING" || regStatus === "REJECTED") &&
      role !== "ADMIN"
    ) {
      if (
        !isPendingGate &&
        (isDashboardArea || isDashboardRoot || isLegacyPanel)
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/pending-approval";
        url.search = "";
        return copyCookies(supabaseResponse, NextResponse.redirect(url));
      }
      if (isAuthPage && !pathname.startsWith("/register/invite/")) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/pending-approval";
        url.search = "";
        return copyCookies(supabaseResponse, NextResponse.redirect(url));
      }
      if (isPendingGate) {
        return supabaseResponse;
      }
    }

    if (isPendingGate && regStatus === "APPROVED") {
      const url = request.nextUrl.clone();
      url.pathname = home;
      url.search = "";
      return copyCookies(supabaseResponse, NextResponse.redirect(url));
    }

    if (isAuthPage) {
      if (pathname.startsWith("/register/invite/")) {
        return supabaseResponse;
      }
      if (pathname.startsWith("/register/complex") && !hasComplex) {
        return supabaseResponse;
      }
      const url = request.nextUrl.clone();
      url.pathname = home;
      url.search = "";
      return copyCookies(supabaseResponse, NextResponse.redirect(url));
    }

    if (!hasComplex) {
      const allowedWithoutComplex =
        isOnboarding ||
        pathname.startsWith("/register/complex") ||
        pathname.startsWith("/register/invite/");
      if (!allowedWithoutComplex) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        url.search = "";
        return copyCookies(supabaseResponse, NextResponse.redirect(url));
      }
      return supabaseResponse;
    }

    if (isOnboarding) {
      const url = request.nextUrl.clone();
      url.pathname = home;
      url.search = "";
      return copyCookies(supabaseResponse, NextResponse.redirect(url));
    }

    if (isDashboardRoot) {
      const url = request.nextUrl.clone();
      url.pathname = home;
      return copyCookies(supabaseResponse, NextResponse.redirect(url));
    }

    if (isLegacyPanel) {
      const url = request.nextUrl.clone();
      if (pathname.startsWith("/admin")) {
        url.pathname = pathname.replace(/^\/admin/, "/dashboard/admin");
      } else if (pathname.startsWith("/resident")) {
        url.pathname = pathname.replace(/^\/resident/, "/dashboard/resident");
      } else if (pathname.startsWith("/staff")) {
        url.pathname =
          role === "SECURITY"
            ? pathname.replace(/^\/staff/, "/dashboard/security")
            : pathname.replace(/^\/staff/, "/dashboard/staff");
      }
      return copyCookies(supabaseResponse, NextResponse.redirect(url));
    }

    if (isDashboardArea && !isPendingGate) {
      if (!role) {
        const url = request.nextUrl.clone();
        url.pathname = hasComplex ? "/login" : "/onboarding";
        url.search = "";
        return copyCookies(supabaseResponse, NextResponse.redirect(url));
      }

      if (pathname.startsWith("/dashboard/pending-approval")) {
        return supabaseResponse;
      }

      const allowedPrefixes: string[] = [ROLE_DASHBOARD[role as UserRole]];

      if (role === "ADMIN") {
        allowedPrefixes.push("/dashboard/security");
      }

      const allowed = allowedPrefixes.some((prefix) =>
        pathname.startsWith(prefix),
      );

      if (!allowed) {
        const url = request.nextUrl.clone();
        url.pathname = ROLE_DASHBOARD[role as UserRole];
        url.search = "";
        return copyCookies(supabaseResponse, NextResponse.redirect(url));
      }
    }

    return supabaseResponse;
  } catch (error) {
    console.error("[middleware] error inesperado:", error);
    return NextResponse.next({ request });
  }
}
