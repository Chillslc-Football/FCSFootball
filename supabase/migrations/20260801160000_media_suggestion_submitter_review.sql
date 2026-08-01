-- Submitter email + coverage display labels + review-link token metadata.
-- Approval still only updates suggestion status (no auto-publish to media_sources).

alter table public.media_suggestions
  add column if not exists submitter_email text;

alter table public.media_suggestions
  add column if not exists coverage_labels jsonb not null default '{}'::jsonb;

alter table public.media_suggestions
  add column if not exists review_action_token_hash text;

alter table public.media_suggestions
  add column if not exists review_action_expires_at timestamptz;

-- reviewed_at already exists from the original media_suggestions table.

comment on column public.media_suggestions.submitter_email is
  'Submitter contact email for owner clarification; not public.';

comment on column public.media_suggestions.coverage_labels is
  'Optional display maps: {"teams":{"id":"Name"},"conferences":{"id":"Name"}}.';

comment on column public.media_suggestions.review_action_token_hash is
  'SHA-256 hex of review nonce; cleared after successful approve/reject.';

comment on column public.media_suggestions.review_action_expires_at is
  'Expiration for email Approve/Reject action tokens.';

-- Replace multi-link submit signature to accept submitter email + coverage labels.
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
  p_notes text default null,
  p_submitter_email text default null,
  p_coverage_labels jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_email text := nullif(lower(trim(coalesce(p_submitter_email, ''))), '');
  v_links jsonb := coalesce(p_platform_links, '{}'::jsonb);
  v_labels jsonb := coalesce(p_coverage_labels, '{}'::jsonb);
  v_clean jsonb := '{}'::jsonb;
  v_key text;
  v_url text;
  v_allowed text[] := array[
    'website', 'spotify', 'apple', 'youtube', 'x',
    'facebook', 'instagram', 'rss', 'other'
  ];
  v_order text[] := array[
    'website', 'spotify', 'apple', 'youtube', 'x',
    'facebook', 'instagram', 'rss', 'other'
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

  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'submitter_email must be a valid email';
  end if;

  if jsonb_typeof(v_links) <> 'object' then
    raise exception 'platform_links must be a JSON object';
  end if;

  if jsonb_typeof(v_labels) <> 'object' then
    v_labels := '{}'::jsonb;
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
    submitter_email,
    coverage_labels,
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
    v_email,
    v_labels,
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

revoke all on function public.submit_media_suggestion(
  text, jsonb, boolean, text[], text[], text, text, jsonb
) from public;
grant execute on function public.submit_media_suggestion(
  text, jsonb, boolean, text[], text[], text, text, jsonb
) to anon, authenticated, service_role;

-- Retire legacy provider/url overload that can no longer satisfy required submitter_email.
create or replace function public.submit_media_suggestion(
  p_provider text,
  p_submitted_url text,
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
begin
  raise exception
    'legacy provider submit is retired; use name, platform_links, and submitter_email';
end;
$$;

revoke all on function public.submit_media_suggestion(text, text, boolean, text[], text[], text) from public;
grant execute on function public.submit_media_suggestion(text, text, boolean, text[], text[], text)
  to anon, authenticated, service_role;

-- Token-based review for email Approve/Reject (service_role / edge only).
create or replace function public.review_media_suggestion_with_token(
  p_id uuid,
  p_status text,
  p_token_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.media_suggestions;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'invalid_status';
  end if;
  if p_token_hash is null or length(trim(p_token_hash)) = 0 then
    raise exception 'invalid_token';
  end if;

  select * into v_row
  from public.media_suggestions
  where id = p_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;

  if v_row.status is distinct from 'pending' then
    raise exception 'already_reviewed';
  end if;

  if v_row.review_action_token_hash is null
     or v_row.review_action_token_hash is distinct from trim(p_token_hash) then
    raise exception 'invalid_token';
  end if;

  if v_row.review_action_expires_at is null
     or v_row.review_action_expires_at < now() then
    raise exception 'expired_token';
  end if;

  update public.media_suggestions
  set
    status = p_status,
    reviewed_at = now(),
    review_action_token_hash = null,
    review_action_expires_at = null
  where id = p_id
    and status = 'pending'
    and review_action_token_hash = trim(p_token_hash);

  if not found then
    raise exception 'already_reviewed';
  end if;

  return p_status;
end;
$$;

revoke all on function public.review_media_suggestion_with_token(uuid, text, text) from public;
grant execute on function public.review_media_suggestion_with_token(uuid, text, text)
  to service_role;

notify pgrst, 'reload schema';
