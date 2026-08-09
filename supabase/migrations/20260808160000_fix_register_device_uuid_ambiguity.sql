-- Fix: register_device failed with
--   column reference "device_uuid" is ambiguous
--
-- Cause: RETURNS TABLE (id uuid, device_uuid text) creates PL/pgSQL OUT
-- variables with those names. ON CONFLICT (device_uuid) then collides with
-- the OUT variable. Use the unique constraint name instead, and keep
-- RETURNING/SELECT fully qualified.
--
-- RPC signature unchanged for client compatibility.

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

  insert into public.notification_preferences (device_id)
  values (v_device_id)
  on conflict (device_id) do nothing;

  return query
    select d.id, d.device_uuid
    from public.devices d
    where d.id = v_device_id;
end;
$$;

grant execute on function public.register_device(text, text, text, text, boolean) to anon, authenticated;
