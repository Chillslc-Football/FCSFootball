-- Cross-platform app release policy (optional + required updates).
-- Clients: SELECT only (anon/authenticated). Writes: service_role / Dashboard SQL.
--
-- OPERATIONAL SAFETY — raising minimum_supported_build:
-- 1. Ship fixed build to Apple / Google
-- 2. Wait until the store listing actually offers that build
-- 3. Verify update is available on a device
-- 4. THEN raise minimum_supported_build
-- Never auto-raise minimum during EAS build.

create table if not exists public.app_release_policy (
  platform text primary key
    check (platform in ('ios', 'android')),
  latest_build integer not null
    check (latest_build >= 1),
  minimum_supported_build integer not null
    check (minimum_supported_build >= 1),
  latest_version text not null default '1.0.0',
  update_message text,
  required_update_message text,
  store_url text not null default '',
  updated_at timestamptz not null default now(),
  constraint app_release_policy_min_lte_latest
    check (minimum_supported_build <= latest_build)
);

comment on table public.app_release_policy is
  'Per-platform remote release control. Clients read-only; raise minimum only after store availability.';

comment on column public.app_release_policy.latest_build is
  'Highest build available in that platform store (iOS CFBundleVersion / Android versionCode).';

comment on column public.app_release_policy.minimum_supported_build is
  'Builds below this must update. Keep <= currently supported production builds.';

comment on column public.app_release_policy.store_url is
  'HTTPS store listing URL (App Store / Play). Native schemes derived in-app when possible.';

drop trigger if exists app_release_policy_set_updated_at on public.app_release_policy;
create trigger app_release_policy_set_updated_at
  before update on public.app_release_policy
  for each row execute function public.set_updated_at();

alter table public.app_release_policy enable row level security;

revoke all on table public.app_release_policy from anon, authenticated;
grant select on table public.app_release_policy to anon, authenticated;
grant all on table public.app_release_policy to service_role;

drop policy if exists "app_release_policy_public_read" on public.app_release_policy;
create policy "app_release_policy_public_read"
  on public.app_release_policy
  for select
  to anon, authenticated
  using (true);

-- Safe launch seeds from EAS production remote versions (2026-08-07):
--   iOS build number 2, Android versionCode 4
-- minimum_supported_build = 1 so existing installs are NOT locked out.
-- iOS store_url left empty until App Store numeric ID is known (itunes lookup empty).
insert into public.app_release_policy (
  platform,
  latest_build,
  minimum_supported_build,
  latest_version,
  update_message,
  required_update_message,
  store_url
)
values
  (
    'ios',
    2,
    1,
    '1.0.0',
    'A newer version of FCS Pulse is available.',
    'A newer version of FCS Pulse is required to continue.',
    ''
  ),
  (
    'android',
    4,
    1,
    '1.0.0',
    'A newer version of FCS Pulse is available.',
    'A newer version of FCS Pulse is required to continue.',
    'https://play.google.com/store/apps/details?id=com.chillslc.fcsfootball'
  )
on conflict (platform) do nothing;
