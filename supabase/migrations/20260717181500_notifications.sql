-- Push notification backend schema for FCSFootball
-- Apply with: supabase db push  OR  supabase migration up

create extension if not exists "pgcrypto";

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  device_uuid text not null unique,
  expo_push_token text,
  platform text,
  app_version text,
  notifications_enabled boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists devices_expo_push_token_idx
  on public.devices (expo_push_token)
  where expo_push_token is not null;

create table if not exists public.device_favorites (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  espn_team_id text not null,
  team_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, espn_team_id)
);

create table if not exists public.device_followed_games (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  event_id text not null,
  away_team_id text,
  home_team_id text,
  away_team_name text not null,
  home_team_name text not null,
  kickoff_at timestamptz,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (device_id, event_id)
);

create index if not exists device_followed_games_event_id_idx
  on public.device_followed_games (event_id);

create table if not exists public.monitored_games (
  event_id text primary key,
  away_team_id text,
  home_team_id text,
  kickoff_at timestamptz,
  state text,
  status_name text,
  period integer,
  display_clock text,
  away_score integer,
  home_score integer,
  espn_close_game_active boolean not null default false,
  last_polled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sent_notification_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  event_id text not null,
  dedupe_key text not null,
  notification_type text not null,
  payload_json jsonb,
  sent_at timestamptz not null default now(),
  unique (device_id, event_id, dedupe_key)
);

create index if not exists sent_notification_events_event_id_idx
  on public.sent_notification_events (event_id);

create table if not exists public.notification_preferences (
  device_id uuid primary key references public.devices(id) on delete cascade,
  game_start_enabled boolean not null default true,
  score_enabled boolean not null default true,
  quarter_end_enabled boolean not null default true,
  halftime_enabled boolean not null default true,
  close_game_enabled boolean not null default true,
  final_enabled boolean not null default true,
  favorite_games_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper: resolve device row by UUID
create or replace function public.device_id_for_uuid(p_device_uuid text)
returns uuid
language sql
stable
as $$
  select id from public.devices where device_uuid = p_device_uuid limit 1;
$$;

-- Register or refresh a device + default preferences
create or replace function public.register_device(
  p_device_uuid text,
  p_expo_push_token text default null,
  p_platform text default null,
  p_app_version text default null,
  p_notifications_enabled boolean default false
)
returns table (id uuid, device_uuid text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_id uuid;
begin
  insert into public.devices as d (
    device_uuid,
    expo_push_token,
    platform,
    app_version,
    notifications_enabled,
    last_seen_at,
    updated_at
  )
  values (
    p_device_uuid,
    p_expo_push_token,
    p_platform,
    p_app_version,
    coalesce(p_notifications_enabled, false),
    now(),
    now()
  )
  on conflict (device_uuid) do update set
    expo_push_token = coalesce(excluded.expo_push_token, d.expo_push_token),
    platform = coalesce(excluded.platform, d.platform),
    app_version = coalesce(excluded.app_version, d.app_version),
    notifications_enabled = case
      when excluded.expo_push_token is not null then true
      else d.notifications_enabled
    end,
    last_seen_at = now(),
    updated_at = now()
  returning d.id into v_device_id;

  insert into public.notification_preferences (device_id)
  values (v_device_id)
  on conflict (device_id) do nothing;

  return query
    select d.id, d.device_uuid
    from public.devices d
    where d.id = v_device_id;
end;
$$;

create or replace function public.sync_device_favorites(
  p_device_uuid text,
  p_favorites jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_id uuid;
begin
  v_device_id := public.device_id_for_uuid(p_device_uuid);
  if v_device_id is null then
    raise exception 'device not registered';
  end if;

  delete from public.device_favorites where device_id = v_device_id;

  insert into public.device_favorites (device_id, espn_team_id, team_name, updated_at)
  select
    v_device_id,
    fav.espn_team_id,
    fav.team_name,
    now()
  from jsonb_to_recordset(coalesce(p_favorites, '[]'::jsonb)) as fav(
    espn_team_id text,
    team_name text
  )
  where fav.espn_team_id is not null and fav.espn_team_id <> '';
end;
$$;

create or replace function public.upsert_followed_game(
  p_device_uuid text,
  p_event_id text,
  p_away_team_id text,
  p_home_team_id text,
  p_away_team_name text,
  p_home_team_name text,
  p_kickoff_at timestamptz,
  p_notifications_enabled boolean default true,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_id uuid;
begin
  v_device_id := public.device_id_for_uuid(p_device_uuid);
  if v_device_id is null then
    raise exception 'device not registered';
  end if;

  insert into public.device_followed_games (
    device_id,
    event_id,
    away_team_id,
    home_team_id,
    away_team_name,
    home_team_name,
    kickoff_at,
    notifications_enabled,
    expires_at
  )
  values (
    v_device_id,
    p_event_id,
    p_away_team_id,
    p_home_team_id,
    p_away_team_name,
    p_home_team_name,
    p_kickoff_at,
    coalesce(p_notifications_enabled, true),
    p_expires_at
  )
  on conflict (device_id, event_id) do update set
    away_team_id = excluded.away_team_id,
    home_team_id = excluded.home_team_id,
    away_team_name = excluded.away_team_name,
    home_team_name = excluded.home_team_name,
    kickoff_at = excluded.kickoff_at,
    notifications_enabled = excluded.notifications_enabled,
    expires_at = excluded.expires_at;
end;
$$;

create or replace function public.remove_followed_game(
  p_device_uuid text,
  p_event_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_id uuid;
begin
  v_device_id := public.device_id_for_uuid(p_device_uuid);
  if v_device_id is null then
    return;
  end if;

  delete from public.device_followed_games
  where device_id = v_device_id and event_id = p_event_id;
end;
$$;

create or replace function public.list_followed_games(p_device_uuid text)
returns setof public.device_followed_games
language sql
security definer
set search_path = public
as $$
  select fg.*
  from public.device_followed_games fg
  join public.devices d on d.id = fg.device_id
  where d.device_uuid = p_device_uuid
    and fg.notifications_enabled = true
    and (fg.expires_at is null or fg.expires_at > now());
$$;

create or replace function public.get_notification_preferences(p_device_uuid text)
returns setof public.notification_preferences
language sql
security definer
set search_path = public
as $$
  select np.*
  from public.notification_preferences np
  join public.devices d on d.id = np.device_id
  where d.device_uuid = p_device_uuid;
$$;

create or replace function public.update_notification_preferences(
  p_device_uuid text,
  p_favorite_games_enabled boolean,
  p_game_start_enabled boolean,
  p_score_enabled boolean,
  p_quarter_end_enabled boolean,
  p_halftime_enabled boolean,
  p_close_game_enabled boolean,
  p_final_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_id uuid;
begin
  v_device_id := public.device_id_for_uuid(p_device_uuid);
  if v_device_id is null then
    raise exception 'device not registered';
  end if;

  insert into public.notification_preferences (
    device_id,
    favorite_games_enabled,
    game_start_enabled,
    score_enabled,
    quarter_end_enabled,
    halftime_enabled,
    close_game_enabled,
    final_enabled,
    updated_at
  )
  values (
    v_device_id,
    p_favorite_games_enabled,
    p_game_start_enabled,
    p_score_enabled,
    p_quarter_end_enabled,
    p_halftime_enabled,
    p_close_game_enabled,
    p_final_enabled,
    now()
  )
  on conflict (device_id) do update set
    favorite_games_enabled = excluded.favorite_games_enabled,
    game_start_enabled = excluded.game_start_enabled,
    score_enabled = excluded.score_enabled,
    quarter_end_enabled = excluded.quarter_end_enabled,
    halftime_enabled = excluded.halftime_enabled,
    close_game_enabled = excluded.close_game_enabled,
    final_enabled = excluded.final_enabled,
    updated_at = now();
end;
$$;

-- RLS: client uses SECURITY DEFINER RPCs; direct table access denied to anon
alter table public.devices enable row level security;
alter table public.device_favorites enable row level security;
alter table public.device_followed_games enable row level security;
alter table public.monitored_games enable row level security;
alter table public.sent_notification_events enable row level security;
alter table public.notification_preferences enable row level security;

revoke all on public.devices from anon, authenticated;
revoke all on public.device_favorites from anon, authenticated;
revoke all on public.device_followed_games from anon, authenticated;
revoke all on public.monitored_games from anon, authenticated;
revoke all on public.sent_notification_events from anon, authenticated;
revoke all on public.notification_preferences from anon, authenticated;

grant execute on function public.register_device(text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.sync_device_favorites(text, jsonb) to anon, authenticated;
grant execute on function public.upsert_followed_game(text, text, text, text, text, text, timestamptz, boolean, timestamptz) to anon, authenticated;
grant execute on function public.remove_followed_game(text, text) to anon, authenticated;
grant execute on function public.list_followed_games(text) to anon, authenticated;
grant execute on function public.get_notification_preferences(text) to anon, authenticated;
grant execute on function public.update_notification_preferences(text, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to anon, authenticated;
