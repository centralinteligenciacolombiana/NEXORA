# NEXORA

PWA para administrar conjuntos residenciales (Next.js 15 + Supabase + Tailwind).

## Variables de entorno (Netlify / local)

Copia `.env.example` a `.env.local` en desarrollo. En Netlify → Site settings → Environment variables:

| Variable | Obligatoria | Notas |
|----------|-------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | `https://XXXX.supabase.co` (sin `/rest/v1`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Solo servidor; nunca en el cliente |
| `NEXT_PUBLIC_APP_URL` | Sí | URL pública, ej. `https://tu-sitio.netlify.app` |
| `RESEND_API_KEY` | Recomendada | Correos (invites / avisos) |
| `RESEND_FROM_EMAIL` | Recomendada | Ej. `NEXORA <onboarding@resend.dev>` |

Tras el primer deploy, actualiza `NEXT_PUBLIC_APP_URL` con la URL de Netlify y en Supabase → Authentication → URL Configuration añade esa URL a **Site URL** y **Redirect URLs**.

## Scripts

```bash
npm install
npm run dev
npm run build
```
