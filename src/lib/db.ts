/**
 * Acceso a datos vía Supabase.
 * Usar createClient desde:
 *  - `@/lib/supabase/client` en Client Components
 *  - `@/lib/supabase/server` en Server Components / Actions
 */

export { createClient as createBrowserClient } from "@/lib/supabase/client";
export { createClient as createServerClient } from "@/lib/supabase/server";
