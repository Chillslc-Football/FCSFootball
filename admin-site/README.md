# FCS Pulse Media Admin

Authenticated admin app for media suggestions and directory management.

**Hostname:** `https://admin.fcspulse.com`

## Stack

- Vite + React + TypeScript
- Supabase Auth (email/password)
- Server authorization via `is_app_admin()` + security-definer RPCs
- Cloudflare Pages static hosting

No public registration. Admins must exist in Supabase Auth **and** `admin_email_allowlist`.

## Local development

```bash
cd admin-site
cp .env.example .env
# set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Cloudflare Pages

| Setting | Value |
|---|---|
| Root directory | `admin-site` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Framework preset | Vite |

Environment variables (Pages → Settings → Environment variables):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Custom domain: `admin.fcspulse.com`

SPA deep links require `public/_redirects` with:

```
/* /index.html 200
```

Vite copies that file into `dist/_redirects` on build (verified by `scripts/verify-spa-redirects.mjs`). Redeploy Cloudflare Pages after changing it so `/suggestions/:id` and other client routes serve `index.html` on direct open/refresh.

## Supabase setup

1. Ensure Auth users exist for allowlisted emails (Dashboard → Authentication → Users). Disable public sign-up.
2. Allowlist emails in `admin_email_allowlist`.
3. Apply migrations and deploy functions (see repo report / commands below).

```bash
supabase.cmd db push
supabase.cmd secrets set MEDIA_ADMIN_SITE_URL=https://admin.fcspulse.com
supabase.cmd functions deploy submit-media-suggestion
supabase.cmd functions deploy admin-media-notify
supabase.cmd functions deploy review-media-suggestion --no-verify-jwt
```

`review-media-suggestion` is disabled (HTTP 410) so old token links fail closed.

## Routes

- `/login`
- `/suggestions`
- `/suggestions/:id`
- `/sources`
- `/sources/new`
- `/sources/:id`
- `/corrections`
