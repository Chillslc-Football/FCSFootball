# FCS media submissions + admin review

Secure foundation for community-suggested FCS **creator/outlet profiles** with multiple channels
(podcasts, YouTube, X, websites, newsletters, Facebook, Instagram).

## Architecture (smallest safe approach)

| Layer | Choice |
|-------|--------|
| Database | Existing Supabase Postgres |
| Public submit | Edge Function `submit-media-resource` → `submit_media_creator_submission` (pending only) |
| Email | Resend from the Edge Function (secrets server-side only) |
| Admin auth | Supabase Auth email/password + `admin_email_allowlist` checked by `is_app_admin()` |
| Authorization | RLS + security definer RPCs (not client-only checks) |
| Public listings | One card per `media_creators` with nested active `media_links` |

No public end-user accounts are required to submit. Administrators use a dedicated Auth user on the allowlist.

## Apply database migrations

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Migrations:

- `supabase/migrations/20260726130000_media_submissions.sql`
- `supabase/migrations/20260726140000_media_creator_submissions.sql` (multi-link creator submissions)

## Deploy Edge Function

```bash
supabase functions deploy submit-media-resource
```

Set secrets (Dashboard → Edge Functions → Secrets, or CLI):

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set RESEND_FROM_EMAIL="FCS Pulse <notifications@yourdomain.com>"
```

`SUPABASE_URL` and the service role key are normally provided by the Supabase runtime (same pattern as `poll-espn-games`).

## Client environment variables

Already used by the app:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

No email API keys belong in the mobile app.

## Designate chillslc@gmail.com as administrator

1. Migration seeds `admin_email_allowlist` with `chillslc@gmail.com`.
2. In Supabase Dashboard → Authentication → Users, create a user with email **chillslc@gmail.com** and a strong password (or invite that email).
3. Sign in from the app’s `/admin` screen with that email/password.
4. Server-side `is_app_admin()` must return true (JWT email matches allowlist). Non-allowlisted users are signed out immediately.

To add another admin later:

```sql
insert into public.admin_email_allowlist (email) values ('other@example.com');
```

## Email delivery to chillslc@gmail.com

1. Create a [Resend](https://resend.com) account and API key.
2. Verify a sending domain (or use Resend’s onboarding sender for tests).
3. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` on the Edge Function.
4. On each successful submit, the function emails **chillslc@gmail.com** with submission details and a note that review is required.
5. If `RESEND_API_KEY` is missing, the submission is still stored as `pending`, and the function returns `emailSent: false` (check function logs).

## Reaching the admin screen without exposing it to normal users

- Route: `/admin` (not in the bottom tab bar).
- Production Settings shows **Media submissions** only when an allowlisted admin session is already active.
- Development builds may show a Settings shortcut to `/admin`, but data access still requires allowlisted Auth.
- Owners can open `/admin` directly (Expo Router path / deep link). Unauthenticated or non-allowlisted users only see the sign-in form and cannot list or mutate submissions.

## Public vs admin capabilities

Public / anon:

- Create pending submissions (Edge Function)
- Read active public creators/links

Public cannot:

- Read pending/rejected submissions or submitter emails
- Approve, reject, edit, or deactivate listings

Admins (allowlisted Auth):

- List/filter submissions
- Edit, approve (publishes creator + link), reject
- Deactivate published listings

## Tests

```bash
npm run test:media-submissions
npx.cmd tsc --noEmit
```
