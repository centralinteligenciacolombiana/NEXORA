# Auditoría de seguridad NEXORA

**Fecha:** 21 jul 2026  
**Alcance:** migraciones SQL 01–11, middleware, server actions, secretos, onboarding  
**Veredicto:** no desplegar a producción multi-conjunto hasta remediar hallazgos **Alta**.

> También existe un canvas en Cursor:  
> `C:\Users\Crhistian\.cursor\projects\c-Users-Crhistian-Documents-NEXORA\canvases\nexora-security-audit.canvas.tsx`  
> (panel al lado del chat; no aparece en el árbol del repo).

---

## Resumen

| Gravedad | Cantidad |
|----------|----------|
| Alta     | 6        |
| Media    | 8        |
| Baja     | 4        |

**26** server actions mutan con `getUser()` + rol + `complex_id` de forma correcta.  
**Secretos** (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`) solo en servidor.

---

## 1. Multitenant y RLS

### Bien aislado (fases 08–11)
`guard_shifts`, `shift_logs`, `utility_bills`, `admin_fee_notices`, `unit_payments` (lado admin), `complex_projects`, `polls` / opciones / votos (insert), `maintenance_tickets`, `ticket_updates` — usan `belongs_to_complex` / `current_complex_id`.

### Roto / incompleto
`deliveries`, `visitors`, `emergency_alerts`, `vehicles`, `pets`, `reservations`, `amenities`, `pqrs_and_work_orders`, policies admin de `profiles`, `units` delete — usan `is_ops()` / `is_admin()` **sin** filtrar por conjunto.

**Causa raíz:** `is_admin()` e `is_ops()` en `01_initial_schema.sql` solo miran el rol, no `complex_id`.

---

## 2. Middleware y Server Actions

- Middleware refresca sesión y redirige por rol; ADMIN puede usar `/dashboard/security` (intencional).
- Si `role` es `null` pero hay `complex_id`, el guard de prefijos **no aplica** → riesgo medio.
- `resolveEmergencyAlertAction` actualiza solo por `alertId` (sin scope de complex) → IDOR si RLS global.
- `triggerPanicAlertAction` no exige `role === "RESIDENT"`.

---

## 3. Secretos

| Check | Estado |
|-------|--------|
| Service role / Resend en `"use client"` | No |
| Prefijo `NEXT_PUBLIC_` en secretos | No |
| Cliente solo anon URL/key | Sí |
| `.env*.local` en `.gitignore` | Sí |

Mejora baja: `import "server-only"` en `src/lib/supabase/admin.ts`.

---

## 4. Onboarding

### `/register/complex`
`register_complex` crea `complexes`, asigna perfil `ADMIN` + `complex_id`, invite RESIDENT. Happy path OK. Si falla tras crear auth user → recuperación en `/onboarding` o `/register/complex/complete`.

### `/register/invite/[token]`
Tokens expirados / inactivos / `max_uses` agotados se rechazan. Email match + rol desde invite. **No** reutilización de tokens inválidos vía RPC. Mejoras: carrera en `uses_count`; no crear units libres en `accept_invite`.

---

## 5. Hallazgos

### Alta (bloqueantes)

| ID | Hallazgo | Ajuste |
|----|----------|--------|
| H1 | `handle_new_user` toma `role` de metadata de signup | Forzar siempre `RESIDENT` |
| H2 | `profiles_confirm_own_email` permite UPDATE libre (OR con otras policies) | Drop/restringir a RPC service role |
| H3 | `is_ops`/`is_admin` globales en tablas legacy | Migración: AND `belongs_to_complex` |
| H4 | `amenities` sin scope de tenant | Policies con `current_complex_id` |
| H5 | Buckets públicos (payment-proofs, evidencias) | Buckets privados + SELECT por folder |
| H6 | `resolveEmergencyAlertAction` sin complex | Join `units.complex_id` + endurecer RLS |

### Media

| ID | Hallazgo |
|----|----------|
| M1 | Middleware: `role` null bypasea guardas |
| M2 | Panic sin exigir RESIDENT |
| M3 | `create_complex_invite` no valida `unit_id` del mismo complex |
| M4 | `accept_invite` puede crear units arbitrarias |
| M5 | `unit_payments` resident UPDATE demasiado permisivo |
| M6 | Storage DELETE por admin global |
| M7 | Carrera TOCTOU en `uses_count` de invites |
| M8 | Usuarios huérfanos tras fallo parcial de registro |

### Baja

| ID | Hallazgo |
|----|----------|
| B1 | Falta `server-only` en admin client |
| B2 | `staff` y `resident/qr` solo protegidos por middleware |
| B3 | Invite bootstrap sin `max_uses`/expiry |
| B4 | `poll_votes` visibles a todo el complex (no secreto) |

---

## Plan de acción inmediato

1. ~~Crear `supabase/migrations/12_rls_tenant_hardening.sql`~~ **Hecho**
2. ~~Privar buckets Storage; DELETE solo en folder del complex~~ **Hecho**
3. ~~Parchear `resolveEmergencyAlertAction` y `triggerPanicAlertAction`~~ **Hecho**
4. ~~Middleware: denegar `/dashboard/*` si no hay `role`~~ **Hecho**
5. ~~`import "server-only"` en admin.ts~~ **Hecho**

**Acción requerida:** ejecutar `12_rls_tenant_hardening.sql` en el SQL Editor de Supabase.

## Confirmación de flujos

Creación de conjunto e invitación **funcionan** en el camino feliz. Tokens inválidos no se reutilizan. Los puntos ciegos son recuperación tras fallos parciales y endurecimiento RLS/roles — no un bloqueo total del onboarding.
