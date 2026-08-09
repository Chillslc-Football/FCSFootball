# App release policy (optional + required updates)

Remote, per-platform control of FCS Pulse store updates via Supabase `app_release_policy`.

## Semantics

| Condition | Result |
|---|---|
| `installed_build < minimum_supported_build` | **Required update** (blocking) |
| `minimum_supported_build ≤ installed_build < latest_build` | **Optional update** (dismissible) |
| `installed_build ≥ latest_build` | Current |

iOS and Android rows are independent (different build numbers).

## Operational sequence (critical)

**Never raise `minimum_supported_build` until the replacement build is live in that store.**

1. Build the fixed release (EAS production).
2. Submit to Apple / Google.
3. Wait until the store listing actually offers the new build.
4. Verify on a device that Update shows the new build.
5. **Then** raise `minimum_supported_build` (and `latest_build` if needed).

Do **not** automate minimum bumps from EAS build. Users can be locked out while review is pending.

## Initial seed values (safe)

From EAS production (2026-08-07):

| Platform | `latest_build` | `minimum_supported_build` | Notes |
|---|---:|---:|---|
| iOS | 2 | 1 | App Store numeric ID not in iTunes lookup yet — `store_url` empty until set |
| Android | 4 | 1 | Play URL seeded from package `com.chillslc.fcsfootball` |

`minimum_supported_build = 1` avoids locking existing installs at launch.

### Still needed

- **iOS `store_url`**: set to the real App Store HTTPS URL including `/idXXXXXXXX` once the listing exists. Until then, the Update button cannot open the App Store.

## Manual policy update (SQL)

Use Supabase Dashboard → SQL (service role), or any trusted service-role client. Anon/authenticated clients are **SELECT-only**.

```sql
-- Example: after iOS build 6 is LIVE on the App Store
update public.app_release_policy
set
  latest_build = 6,
  minimum_supported_build = 6, -- only after store availability
  latest_version = '1.0.1',
  required_update_message = 'Please update FCS Pulse to continue.',
  store_url = 'https://apps.apple.com/app/idYOUR_NUMERIC_ID',
  updated_at = now()
where platform = 'ios';

-- Example: Android optional update only
update public.app_release_policy
set
  latest_build = 9,
  minimum_supported_build = 8, -- keep existing users unblocked
  update_message = 'Bug fixes and improvements.',
  updated_at = now()
where platform = 'android';
```

## Client behavior

- Startup check + foreground recheck when 5-hour TTL expires.
- Network / Supabase / malformed policy → **fail open** (no lockout).
- Expo Go → enforcement bypassed (Developer simulation still works in `__DEV__`).
- Optional “Not Now” dismisses for the rest of the app session.
- Required update: no Skip / Not Now; Android back is swallowed.

## Developer simulation

Developer menu (local only, does not write Supabase):

- Simulate Current / Optional / Required
- Clear Simulation
- Refresh Release Policy

## Admin UI

No in-app write admin screen in this task. Use SQL above (or a future small admin form with authenticated service path). Existing Admin media tools are unrelated.
