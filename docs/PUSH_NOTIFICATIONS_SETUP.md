# Push Notifications Setup

## 1. Environment variables

Copy `.env.example` to `.env.local` and set:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_EAS_PROJECT_ID=your-eas-project-id
```

Never commit secrets. Do **not** put the Supabase service role key in the mobile app.

## 2. Supabase project

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Copy the project URL and anon key into `.env.local`.

## 3. Apply migrations

From the repo root:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Migration file: `supabase/migrations/20260717181500_notifications.sql`

## 4. Deploy Edge Function

```bash
supabase functions deploy poll-espn-games
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The function uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically in the Edge runtime.

## 5. Schedule the function

Use Supabase Dashboard → Database → Extensions → enable `pg_cron`, `pg_net`, and Vault.

**Do not** call the Edge Function with empty headers. Deployed `poll-espn-games` uses `verify_jwt = true`, so cron must send a **service_role JWT** as `Authorization: Bearer …` (and `apikey`).

**Do not** commit the service role key. Store it in Supabase Vault:

1. Dashboard → Project Settings → API → copy the **service_role** secret (legacy JWT starting with `eyJ`).
2. Dashboard → Database → Vault → create secret named exactly:
   - `poll_espn_games_service_role_key`
3. Or run (local machine, never commit output):
   - `powershell -File scripts/fix-poll-espn-games-cron-auth.ps1`

Then schedule / repair the job (one active job named `poll-espn-games`):

```sql
select cron.schedule(
  'poll-espn-games',
  '* * * * *',
  $cmd$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/poll-espn-games',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'poll_espn_games_service_role_key'),
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'poll_espn_games_service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $cmd$
);
```

If the job already exists, use `cron.alter_job` instead of creating a second schedule. See `supabase/manual/20260808_fix_poll_espn_games_cron_auth.sql`.

**Health check (manual):** recent rows in `net._http_response` for this URL should be `status_code` 2xx, not 401. Cron `job_run_details.status = succeeded` only means the SQL fired — always check HTTP status codes.

Cadence: every 1 minute (`* * * * *`) for live season.

## 6. Expo push configuration

1. Create an Expo account and EAS project: `eas init`
2. Set `EXPO_PUBLIC_EAS_PROJECT_ID` in `.env.local`
3. Configure push credentials:

```bash
eas credentials
```

## 7. Android FCM

In EAS, upload or generate a Firebase Cloud Messaging key for Android push.

## 8. iOS APNs

Configure Apple Push Notification key/certificate in EAS even if Android is the primary test target.

## 9. EAS development build

Expo Go does **not** support reliable remote push testing.

```bash
npm install -g eas-cli
eas build --profile development --platform android
```

Install the resulting APK/AAB on a physical device.

## 10. Test on physical Android device

1. Launch the dev build
2. Settings → enable notification preferences
3. Add a favorite team or tap the bell on a game card
4. Grant notification permission when prompted
5. Developer → Notification Test → send local test notification

## 11. Test followed-game alerts

1. Tap the bell on any game in Scores or Conferences
2. Confirm “Game alerts enabled”
3. Verify row in `device_followed_games` in Supabase

## 12. Test favorite synchronization

1. Add a favorite with an ESPN team ID
2. Confirm `device_favorites` row appears after sync
3. Remove favorite locally — server row should be removed on next sync

## 13. Test deduplication

1. Invoke `poll-espn-games` twice during a live game
2. Confirm `sent_notification_events` unique constraint prevents duplicate pushes

## 14. ESPN close-game findings

See [ESPN_CLOSE_GAME_INVESTIGATION.md](./ESPN_CLOSE_GAME_INVESTIGATION.md).

Close-game notifications are **deferred** until ESPN exposes a verified close-game field.

## 15. Known limitations

- ESPN endpoints are undocumented and may change without notice
- Close-game alerts are not active
- Push requires Supabase + EAS + physical device
- Favorites without ESPN numeric team IDs are ineligible for automatic monitoring
- Slug-only favorites remain visible locally but are not synced for notifications
