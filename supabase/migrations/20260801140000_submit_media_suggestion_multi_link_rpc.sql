-- Ensure public.submit_media_suggestion matches the mobile app RPC payload:
--   p_name text
--   p_platform_links jsonb
--   p_is_national boolean
--   p_conference_ids text[]
--   p_team_ids text[]
--   p_notes text
--
-- Root cause of PostgREST "Could not find the function ... p_platform_links":
-- the multi-link overload was defined in an earlier migration but not applied
-- (or not visible in the schema cache) on the live project.

-- ---------------------------------------------------------------------------
-- Schema prerequisites (idempotent)
-- ---------------------------------------------------------------------------
alter table public.media_suggestions
  add column if not exists name text;

alter table public.media_suggestions
  add column if not exists platform_links jsonb not null default '{}'::jsonb;

alter table public.media_suggestions
  add column if not exists notes text;

alter table public.media_suggestions
  add column if not exists is_national boolean not null default false;

alter table public.media_suggestions
  drop constraint if exists media_suggestions_provider_check;

alter table public.media_suggestions
  add constraint media_suggestions_provider_check
  check (
    provider in (
      'spotify',
      'youtube',
      'x',
      'website',
      'apple',
      'facebook',
      'instagram',
      'rss',
      'other',
      'multi'
    )
  );

-- Drop only this exact overload so CREATE is clean (does not touch legacy
-- provider/url overloads).
drop function if exists public.submit_media_suggestion(
  text,
  jsonb,
  boolean,
  text[],
  text[],
  text
);

create function public.submit_media_suggestion(
  p_name text,
  p_platform_links jsonb,
  p_is_national boolean default false,
  p_conference_ids text[] default '{}',
  p_team_ids text[] default '{}',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_links jsonb := coalesce(p_platform_links, '{}'::jsonb);
  v_clean jsonb := '{}'::jsonb;
  v_key text;
  v_url text;
  v_allowed text[] := array[
    'website',
    'spotify',
    'apple',
    'youtube',
    'x',
    'facebook',
    'instagram',
    'rss',
    'other'
  ];
  v_order text[] := array[
    'website',
    'spotify',
    'apple',
    'youtube',
    'x',
    'facebook',
    'instagram',
    'rss',
    'other'
  ];
  v_primary_key text := null;
  v_primary_url text := null;
  v_is_national boolean := coalesce(p_is_national, false);
  v_conference_ids text[] := coalesce(p_conference_ids, '{}');
  v_team_ids text[] := coalesce(p_team_ids, '{}');
  v_scope text;
  v_legacy_conference text;
  v_legacy_team text;
  v_id uuid;
  v_conf text;
  v_team text;
begin
  if v_name is null then
    raise exception 'name is required';
  end if;

  if jsonb_typeof(v_links) <> 'object' then
    raise exception 'platform_links must be a JSON object';
  end if;

  for v_key, v_url in
    select key, nullif(trim(value #>> '{}'), '')
    from jsonb_each(v_links)
  loop
    if v_key = any (v_allowed) and v_url is not null then
      if v_url !~* '^https?://' then
        raise exception '% must be an http(s) URL', v_key;
      end if;
      v_clean := v_clean || jsonb_build_object(v_key, v_url);
    end if;
  end loop;

  if v_clean = '{}'::jsonb then
    raise exception 'at least one platform link is required';
  end if;

  foreach v_key in array v_order loop
    if v_clean ? v_key then
      v_primary_key := v_key;
      v_primary_url := v_clean ->> v_key;
      exit;
    end if;
  end loop;

  select coalesce(array_agg(distinct trim(x)), '{}')
  into v_conference_ids
  from unnest(v_conference_ids) as x
  where length(trim(x)) > 0;

  select coalesce(array_agg(distinct trim(x)), '{}')
  into v_team_ids
  from unnest(v_team_ids) as x
  where length(trim(x)) > 0;

  if not v_is_national
     and coalesce(array_length(v_conference_ids, 1), 0) = 0
     and coalesce(array_length(v_team_ids, 1), 0) = 0 then
    raise exception 'coverage requires national, a conference, or a team';
  end if;

  if v_is_national and coalesce(array_length(v_team_ids, 1), 0) = 0
     and coalesce(array_length(v_conference_ids, 1), 0) = 0 then
    v_scope := 'national';
  elsif coalesce(array_length(v_team_ids, 1), 0) > 0 then
    v_scope := 'team';
  elsif coalesce(array_length(v_conference_ids, 1), 0) > 0 then
    v_scope := 'conference';
  else
    v_scope := 'national';
  end if;

  v_legacy_team := case when coalesce(array_length(v_team_ids, 1), 0) > 0
    then v_team_ids[1] else null end;
  v_legacy_conference := case when coalesce(array_length(v_conference_ids, 1), 0) > 0
    then v_conference_ids[1] else null end;

  -- Single function body = one transaction: join-table failures roll back the insert.
  insert into public.media_suggestions (
    name,
    provider,
    submitted_url,
    platform_links,
    scope,
    conference_id,
    team_id,
    is_national,
    notes,
    status,
    submitted_by
  ) values (
    v_name,
    coalesce(v_primary_key, 'other'),
    coalesce(v_primary_url, ''),
    v_clean,
    v_scope,
    v_legacy_conference,
    v_legacy_team,
    v_is_national,
    nullif(trim(coalesce(p_notes, '')), ''),
    'pending',
    auth.uid()
  )
  returning id into v_id;

  foreach v_team in array v_team_ids loop
    insert into public.media_suggestion_teams (media_suggestion_id, team_id)
    values (v_id, v_team)
    on conflict do nothing;
  end loop;

  foreach v_conf in array v_conference_ids loop
    insert into public.media_suggestion_conferences (media_suggestion_id, conference_id)
    values (v_id, v_conf)
    on conflict do nothing;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.submit_media_suggestion(text, jsonb, boolean, text[], text[], text) from public;
grant execute on function public.submit_media_suggestion(text, jsonb, boolean, text[], text[], text)
  to anon, authenticated, service_role;

-- Refresh PostgREST schema cache so the new overload is callable immediately.
notify pgrst, 'reload schema';
