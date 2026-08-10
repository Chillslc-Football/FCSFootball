-- Align notification_preferences defaults with the mobile client:
-- fresh installs must not silently enable alert categories.
--
-- Existing rows are intentionally left unchanged so returning users keep
-- whatever preferences they already have (saved or previously defaulted).

alter table public.notification_preferences
  alter column game_start_enabled set default false,
  alter column score_enabled set default false,
  alter column quarter_end_enabled set default false,
  alter column halftime_enabled set default false,
  alter column close_game_enabled set default false,
  alter column final_enabled set default false,
  alter column favorite_games_enabled set default false;

-- Keep register_device insert explicit so new device rows match client defaults
-- even if column defaults are out of date in an environment.
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
  on conflict on constraint devices_device_uuid_key do update set
    expo_push_token = coalesce(excluded.expo_push_token, d.expo_push_token),
    platform = coalesce(excluded.platform, d.platform),
    app_version = coalesce(excluded.app_version, d.app_version),
    -- Keep prior enabled state when this call has no token (launch reconcile).
    notifications_enabled = case
      when excluded.expo_push_token is not null then true
      else d.notifications_enabled
    end,
    last_seen_at = now(),
    updated_at = now()
  returning d.id into v_device_id;

  insert into public.notification_preferences (
    device_id,
    favorite_games_enabled,
    game_start_enabled,
    score_enabled,
    quarter_end_enabled,
    halftime_enabled,
    close_game_enabled,
    final_enabled
  )
  values (
    v_device_id,
    false,
    false,
    false,
    false,
    false,
    false,
    false
  )
  on conflict (device_id) do nothing;

  return query
    select d.id, d.device_uuid
    from public.devices d
    where d.id = v_device_id;
end;
$$;

grant execute on function public.register_device(text, text, text, text, boolean) to anon, authenticated;
