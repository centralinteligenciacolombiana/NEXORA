/**
 * Seed + verificación de bitácora de relevos (ITEM 2).
 * Uso: node --env-file=.env.local scripts/seed-shift-logbook.mjs
 *
 * Si no hay SECURITY, crea 2 usuarios demo Auth + profiles en el primer complex.
 * Credenciales demo (solo entorno de prueba):
 *   guardia.noche@nexora.demo / NexoraDemo!2026
 *   guardia.dia@nexora.demo   / NexoraDemo!2026
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEMO_PASSWORD = "NexoraDemo!2026";
const DEMO_GUARDS = [
  {
    email: "guardia.noche@nexora.demo",
    full_name: "Carlos Pérez (Noche)",
  },
  {
    email: "guardia.dia@nexora.demo",
    full_name: "Ana Gómez (Día)",
  },
];

if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

async function ensureAuthUser(email, fullName) {
  const { data: listed } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const existing = listed?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (existing) return existing.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    throw new Error(`No se pudo crear ${email}: ${error?.message}`);
  }
  return data.user.id;
}

async function ensureSecurityProfile(userId, complexId, email, fullName) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, role, complex_id")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("profiles")
      .update({
        role: "SECURITY",
        complex_id: complexId,
        full_name: fullName,
        email,
        is_active: true,
        registration_status: "APPROVED",
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return userId;
  }

  const { error } = await supabase.from("profiles").insert({
    id: userId,
    role: "SECURITY",
    complex_id: complexId,
    full_name: fullName,
    email,
    is_active: true,
    is_owner: false,
    registration_status: "APPROVED",
  });
  if (error) throw new Error(error.message);
  return userId;
}

async function main() {
  const { data: complex, error: cErr } = await supabase
    .from("complexes")
    .select("id, name, enable_shift_logbook")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (cErr || !complex) {
    console.error("No hay complexes activos:", cErr?.message);
    process.exit(1);
  }

  await supabase
    .from("complexes")
    .update({ enable_shift_logbook: true })
    .eq("id", complex.id);

  let { data: guards } = await supabase
    .from("profiles")
    .select("id, full_name, role, email")
    .eq("complex_id", complex.id)
    .eq("role", "SECURITY")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(2);

  if (!guards?.length) {
    console.log("No hay SECURITY — creando guardias demo…");
    const created = [];
    for (const g of DEMO_GUARDS) {
      const id = await ensureAuthUser(g.email, g.full_name);
      await ensureSecurityProfile(id, complex.id, g.email, g.full_name);
      created.push({ id, full_name: g.full_name, email: g.email, role: "SECURITY" });
    }
    guards = created;
    console.log("Demo password:", DEMO_PASSWORD);
    for (const g of DEMO_GUARDS) console.log(" ", g.email);
  }

  const guardA = guards[0];
  const guardB = guards[1] ?? null;

  await supabase
    .from("guard_shifts")
    .update({
      status: "FINISHED",
      ended_at: new Date().toISOString(),
    })
    .in(
      "guard_id",
      guards.map((g) => g.id),
    )
    .eq("status", "ACTIVE");

  const { data: nightShift, error: nErr } = await supabase
    .from("guard_shifts")
    .insert({
      complex_id: complex.id,
      guard_id: guardA.id,
      shift_type: "NIGHT",
      status: "FINISHED",
      started_at: hoursAgo(10),
      ended_at: hoursAgo(1),
    })
    .select("id")
    .single();

  if (nErr || !nightShift) {
    console.error("Error creando turno noche:", nErr?.message);
    process.exit(1);
  }

  const { error: logErr } = await supabase.from("shift_logs").insert({
    complex_id: complex.id,
    shift_id: nightShift.id,
    author_guard_id: guardA.id,
    title: "Relevo noche — llaves y novedades",
    description:
      "Turno noche cerrado.\n" +
      "- Visitante no autorizado rechazado en torre B (22:40).\n" +
      "- Paquete Amazon pendiente en casillero 3 (apto 502).\n" +
      "- Cámara perimetral patio OK.\n" +
      "Recibir con linterna cargada.",
  });

  if (logErr) {
    console.error("Error insertando log noche:", logErr.message);
    process.exit(1);
  }

  const dayGuard = guardB ?? guardA;
  const { data: dayShift, error: dErr } = await supabase
    .from("guard_shifts")
    .insert({
      complex_id: complex.id,
      guard_id: dayGuard.id,
      shift_type: "DAY",
      status: "ACTIVE",
      started_at: hoursAgo(0.75),
      ended_at: null,
    })
    .select("id")
    .single();

  if (dErr || !dayShift) {
    console.error("Error creando turno día:", dErr?.message);
    process.exit(1);
  }

  if (guardB && guardB.id !== guardA.id) {
    await supabase.from("shift_logs").insert({
      complex_id: complex.id,
      shift_id: dayShift.id,
      author_guard_id: guardB.id,
      title: "Entrada turno día — recibido",
      description:
        "Recibí el relevo de noche. Revisaré casillero 3 y rondaré torre B.",
    });
  }

  const { data: recentLogs } = await supabase
    .from("shift_logs")
    .select("id, title, created_at")
    .eq("complex_id", complex.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: activeShifts } = await supabase
    .from("guard_shifts")
    .select("id, shift_type, status, started_at, guard_id")
    .eq("complex_id", complex.id)
    .eq("status", "ACTIVE");

  console.log("--- Seed bitácora OK ---");
  console.log("Complex:", complex.name);
  console.log("Guardias:", guards.length);
  console.log("Turnos ACTIVE:", activeShifts?.length ?? 0);
  console.log("Últimos logs:");
  for (const l of recentLogs ?? []) {
    console.log(`  · ${l.title}`);
  }
  console.log(
    "\nE2E: login SECURITY → /dashboard/security/logbook (ver Último relevo + publicar).",
  );
  console.log(
    "Aplica también supabase/migrations/17_security_self_shift.sql para clock-in propio.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
