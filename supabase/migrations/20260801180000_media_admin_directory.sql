-- Authenticated Media Admin: publish pipeline, audit, corrections prep, is_active.
-- Apply with: supabase db push
-- Authorization: is_app_admin() / admin_email_allowlist (no public review endpoints).

-- ---------------------------------------------------------------------------
-- media_sources: platform_links jsonb + active flag
-- ---------------------------------------------------------------------------
alter table public.media_sources
  add column if not exists platform_links jsonb not null default '{}'::jsonb;

alter table public.media_sources
  add column if not exists website_url text;

alter table public.media_sources
  add column if not exists is_active boolean not null default true;

create index if not exists media_sources_is_active_idx
  on public.media_sources (is_active);

-- Backfill platform_links from scalar columns when empty.
update public.media_sources
set platform_links = jsonb_strip_nulls(
  jsonb_build_object(
    'website', nullif(trim(coalesce(website_url, '')), ''),
    'spotify', nullif(trim(coalesce(spotify_url, '')), ''),
    'apple', nullif(trim(coalesce(apple_podcast_url, '')), ''),
    'youtube', nullif(trim(coalesce(youtube_url, '')), ''),
    'x', nullif(trim(coalesce(x_url, '')), '')
  )
)
where platform_links = '{}'::jsonb
   or platform_links is null;

-- ---------------------------------------------------------------------------
-- media_suggestions: draft publish fields + publish link + admin notes
-- ---------------------------------------------------------------------------
alter table public.media_suggestions
  add column if not exists description text;

alter table public.media_suggestions
  add column if not exists logo_url text;

alter table public.media_suggestions
  add column if not exists admin_notes text;

alter table public.media_suggestions
  add column if not exists published_media_source_id uuid
    references public.media_sources(id) on delete set null;

alter table public.media_suggestions
  add column if not exists outcome_notified_at timestamptz;

create index if not exists media_suggestions_published_source_idx
  on public.media_suggestions (published_media_source_id);

-- ---------------------------------------------------------------------------
-- Audit trail (minimal)
-- ---------------------------------------------------------------------------
create table if not exists public.media_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null check (entity_type in ('suggestion', 'source', 'correction')),
  entity_id uuid not null,
  related_entity_id uuid,
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_email text,
  summary text not null,
  changed_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists media_admin_audit_log_created_at_idx
  on public.media_admin_audit_log (created_at desc);
create index if not exists media_admin_audit_log_entity_idx
  on public.media_admin_audit_log (entity_type, entity_id);

alter table public.media_admin_audit_log enable row level security;
revoke all on table public.media_admin_audit_log from anon, authenticated;
grant select, insert on table public.media_admin_audit_log to authenticated;
grant all on table public.media_admin_audit_log to service_role;

drop policy if exists media_admin_audit_log_admin_all on public.media_admin_audit_log;
create policy media_admin_audit_log_admin_all on public.media_admin_audit_log
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- Community corrections queue (future mobile "Suggest an Edit")
-- ---------------------------------------------------------------------------
create table if not exists public.media_correction_suggestions (
  id uuid primary key default gen_random_uuid(),
  media_source_id uuid references public.media_sources(id) on delete set null,
  correction_type text not null check (
    correction_type in (
      'wrong_tag',
      'broken_link',
      'updated_artwork',
      'incorrect_description',
      'inactive_creator',
      'other'
    )
  ),
  proposed_changes jsonb not null default '{}'::jsonb,
  details text,
  submitter_email text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'applied')),
  admin_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists media_correction_suggestions_status_idx
  on public.media_correction_suggestions (status, created_at desc);

alter table public.media_correction_suggestions enable row level security;
revoke all on table public.media_correction_suggestions from anon, authenticated;
grant select, insert, update on table public.media_correction_suggestions to authenticated;
grant all on table public.media_correction_suggestions to service_role;

-- Public insert via security definer later; admins manage now.
drop policy if exists media_correction_suggestions_admin_all on public.media_correction_suggestions;
create policy media_correction_suggestions_admin_all on public.media_correction_suggestions
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.media_admin_write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_summary text,
  p_changed_fields jsonb default '{}'::jsonb,
  p_related_entity_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  insert into public.media_admin_audit_log (
    action,
    entity_type,
    entity_id,
    related_entity_id,
    admin_user_id,
    admin_email,
    summary,
    changed_fields
  ) values (
    p_action,
    p_entity_type,
    p_entity_id,
    p_related_entity_id,
    auth.uid(),
    nullif(v_email, ''),
    p_summary,
    coalesce(p_changed_fields, '{}'::jsonb)
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.media_admin_write_audit(text, text, uuid, text, jsonb, uuid) from public;
grant execute on function public.media_admin_write_audit(text, text, uuid, text, jsonb, uuid)
  to authenticated, service_role;

create or replace function public.media_platform_links_to_scalars(p_links jsonb)
returns table (
  website_url text,
  spotify_url text,
  youtube_url text,
  x_url text,
  apple_podcast_url text
)
language sql
immutable
as $$
  select
    nullif(trim(coalesce(p_links ->> 'website', '')), ''),
    nullif(trim(coalesce(p_links ->> 'spotify', '')), ''),
    nullif(trim(coalesce(p_links ->> 'youtube', '')), ''),
    nullif(trim(coalesce(p_links ->> 'x', '')), ''),
    nullif(trim(coalesce(p_links ->> 'apple', '')), '');
$$;

create or replace function public.media_normalize_platform_links(p_links jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_keys text[] := array[
    'website', 'spotify', 'apple', 'youtube', 'x',
    'facebook', 'instagram', 'rss', 'other'
  ];
  v_key text;
  v_url text;
  v_out jsonb := '{}'::jsonb;
begin
  if p_links is null or jsonb_typeof(p_links) <> 'object' then
    return '{}'::jsonb;
  end if;
  foreach v_key in array v_keys loop
    v_url := nullif(trim(coalesce(p_links ->> v_key, '')), '');
    if v_url is not null then
      if v_url !~* '^https?://' then
        raise exception 'invalid_platform_url:%', v_key;
      end if;
      v_out := v_out || jsonb_build_object(v_key, v_url);
    end if;
  end loop;
  return v_out;
end;
$$;

create or replace function public.media_derive_scope(
  p_is_national boolean,
  p_team_ids text[],
  p_conference_ids text[]
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_is_national, false)
      and coalesce(cardinality(p_team_ids), 0) = 0
      and coalesce(cardinality(p_conference_ids), 0) = 0
      then 'national'
    when coalesce(cardinality(p_team_ids), 0) > 0 then 'team'
    when coalesce(cardinality(p_conference_ids), 0) > 0 then 'conference'
    else 'national'
  end;
$$;

create or replace function public.media_replace_source_coverage(
  p_source_id uuid,
  p_is_national boolean,
  p_team_ids text[],
  p_conference_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team text;
  v_conf text;
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
  v_scope text;
begin
  select coalesce(array_agg(distinct trim(x)), '{}')
  into v_team_ids
  from unnest(coalesce(p_team_ids, '{}')) as x
  where length(trim(x)) > 0;

  select coalesce(array_agg(distinct trim(x)), '{}')
  into v_conf_ids
  from unnest(coalesce(p_conference_ids, '{}')) as x
  where length(trim(x)) > 0;

  if not coalesce(p_is_national, false)
     and coalesce(cardinality(v_team_ids), 0) = 0
     and coalesce(cardinality(v_conf_ids), 0) = 0 then
    raise exception 'coverage requires national, a conference, or a team';
  end if;

  v_scope := public.media_derive_scope(p_is_national, v_team_ids, v_conf_ids);

  delete from public.media_source_teams where media_source_id = p_source_id;
  delete from public.media_source_conferences where media_source_id = p_source_id;

  foreach v_team in array v_team_ids loop
    insert into public.media_source_teams (media_source_id, team_id)
    values (p_source_id, v_team)
    on conflict do nothing;
  end loop;

  foreach v_conf in array v_conf_ids loop
    insert into public.media_source_conferences (media_source_id, conference_id)
    values (p_source_id, v_conf)
    on conflict do nothing;
  end loop;

  update public.media_sources
  set
    is_national = coalesce(p_is_national, false),
    scope = v_scope,
    team_id = case when coalesce(cardinality(v_team_ids), 0) > 0 then v_team_ids[1] else null end,
    conference_id = case when coalesce(cardinality(v_conf_ids), 0) > 0 then v_conf_ids[1] else null end,
    updated_at = now()
  where id = p_source_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public list: approved + active only
-- ---------------------------------------------------------------------------
drop function if exists public.list_approved_media_sources();

create or replace function public.list_approved_media_sources()
returns table (
  id uuid,
  name text,
  subtitle text,
  description text,
  scope text,
  conference_id text,
  team_id text,
  logo_url text,
  spotify_url text,
  youtube_url text,
  x_url text,
  apple_podcast_url text,
  is_approved boolean,
  display_order integer,
  created_at timestamptz,
  updated_at timestamptz,
  is_national boolean,
  team_ids text[],
  conference_ids text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.subtitle,
    s.description,
    s.scope,
    s.conference_id,
    s.team_id,
    s.logo_url,
    s.spotify_url,
    s.youtube_url,
    s.x_url,
    s.apple_podcast_url,
    s.is_approved,
    s.display_order,
    s.created_at,
    s.updated_at,
    s.is_national,
    coalesce(
      (
        select array_agg(t.team_id order by t.team_id)
        from public.media_source_teams t
        where t.media_source_id = s.id
      ),
      '{}'::text[]
    ) as team_ids,
    coalesce(
      (
        select array_agg(c.conference_id order by c.conference_id)
        from public.media_source_conferences c
        where c.media_source_id = s.id
      ),
      '{}'::text[]
    ) as conference_ids
  from public.media_sources s
  where s.is_approved = true
    and coalesce(s.is_active, true) = true
  order by s.display_order asc, s.name asc;
$$;

revoke all on function public.list_approved_media_sources() from public;
grant execute on function public.list_approved_media_sources()
  to anon, authenticated, service_role;

-- Also hide inactive from public SELECT policy
drop policy if exists media_sources_public_select on public.media_sources;
create policy media_sources_public_select on public.media_sources
  for select to anon, authenticated
  using (
    (is_approved = true and coalesce(is_active, true) = true)
    or public.is_app_admin()
  );

-- ---------------------------------------------------------------------------
-- Admin suggestion queue
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_media_suggestion_queue(
  p_status text default 'pending',
  p_search text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;
  if p_status is not null and p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid_status';
  end if;

  return coalesce(
    (
      select jsonb_agg(row_data order by (row_data ->> 'submittedAt') desc)
      from (
        select jsonb_build_object(
          'id', s.id,
          'name', coalesce(nullif(trim(s.name), ''), s.provider || ' suggestion'),
          'submitterEmail', s.submitter_email,
          'submittedAt', s.created_at,
          'status', s.status,
          'isNational', coalesce(s.is_national, false),
          'teams', coalesce(
            (
              select jsonb_agg(
                coalesce(s.coverage_labels -> 'teams' ->> t.team_id, t.team_id)
                order by t.team_id
              )
              from public.media_suggestion_teams t
              where t.media_suggestion_id = s.id
            ),
            '[]'::jsonb
          ),
          'teamIds', coalesce(
            (
              select jsonb_agg(t.team_id order by t.team_id)
              from public.media_suggestion_teams t
              where t.media_suggestion_id = s.id
            ),
            '[]'::jsonb
          ),
          'conferences', coalesce(
            (
              select jsonb_agg(
                coalesce(s.coverage_labels -> 'conferences' ->> c.conference_id, c.conference_id)
                order by c.conference_id
              )
              from public.media_suggestion_conferences c
              where c.media_suggestion_id = s.id
            ),
            '[]'::jsonb
          ),
          'conferenceIds', coalesce(
            (
              select jsonb_agg(c.conference_id order by c.conference_id)
              from public.media_suggestion_conferences c
              where c.media_suggestion_id = s.id
            ),
            '[]'::jsonb
          ),
          'platformCount', (
            select count(*)::int
            from jsonb_each_text(coalesce(s.platform_links, '{}'::jsonb)) e
            where length(trim(e.value)) > 0
          ),
          'notesPreview', left(coalesce(s.notes, ''), 140),
          'publishedMediaSourceId', s.published_media_source_id,
          'reviewedAt', s.reviewed_at
        ) as row_data
        from public.media_suggestions s
        where (p_status is null or s.status = p_status)
          and (
            v_search is null
            or s.name ilike '%' || v_search || '%'
            or coalesce(s.submitter_email, '') ilike '%' || v_search || '%'
            or coalesce(s.notes, '') ilike '%' || v_search || '%'
          )
      ) q
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.admin_list_media_suggestion_queue(text, text) from public;
grant execute on function public.admin_list_media_suggestion_queue(text, text) to authenticated;

create or replace function public.admin_get_media_suggestion_detail(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.media_suggestions;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  select * into s from public.media_suggestions where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;

  return jsonb_build_object(
    'id', s.id,
    'name', coalesce(nullif(trim(s.name), ''), ''),
    'description', s.description,
    'logoUrl', s.logo_url,
    'platformLinks', coalesce(s.platform_links, '{}'::jsonb),
    'isNational', coalesce(s.is_national, false),
    'teamIds', coalesce(
      (
        select jsonb_agg(t.team_id order by t.team_id)
        from public.media_suggestion_teams t
        where t.media_suggestion_id = s.id
      ),
      '[]'::jsonb
    ),
    'conferenceIds', coalesce(
      (
        select jsonb_agg(c.conference_id order by c.conference_id)
        from public.media_suggestion_conferences c
        where c.media_suggestion_id = s.id
      ),
      '[]'::jsonb
    ),
    'coverageLabels', coalesce(s.coverage_labels, '{}'::jsonb),
    'submitterEmail', s.submitter_email,
    'notes', s.notes,
    'adminNotes', s.admin_notes,
    'status', s.status,
    'submittedAt', s.created_at,
    'reviewedAt', s.reviewed_at,
    'reviewedBy', s.reviewed_by,
    'publishedMediaSourceId', s.published_media_source_id,
    'outcomeNotifiedAt', s.outcome_notified_at
  );
end;
$$;

revoke all on function public.admin_get_media_suggestion_detail(uuid) from public;
grant execute on function public.admin_get_media_suggestion_detail(uuid) to authenticated;

create or replace function public.admin_update_media_suggestion_draft(
  p_id uuid,
  p_name text,
  p_description text default null,
  p_logo_url text default null,
  p_platform_links jsonb default null,
  p_is_national boolean default null,
  p_team_ids text[] default null,
  p_conference_ids text[] default null,
  p_notes text default null,
  p_coverage_labels jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.media_suggestions;
  v_links jsonb;
  v_name text;
  v_logo text;
  v_team text;
  v_conf text;
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
  v_scope text;
  v_primary_key text;
  v_primary_url text;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_row from public.media_suggestions where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  v_name := nullif(trim(coalesce(p_name, v_row.name, '')), '');
  if v_name is null then
    raise exception 'name_required';
  end if;

  v_links := public.media_normalize_platform_links(
    coalesce(p_platform_links, v_row.platform_links, '{}'::jsonb)
  );
  if v_links = '{}'::jsonb then
    raise exception 'platform_links_required';
  end if;

  v_logo := nullif(trim(coalesce(p_logo_url, '')), '');
  if v_logo is not null and v_logo !~* '^https?://' then
    raise exception 'invalid_logo_url';
  end if;

  select coalesce(array_agg(distinct trim(x)), '{}')
  into v_team_ids
  from unnest(coalesce(p_team_ids, '{}')) as x
  where length(trim(x)) > 0;

  select coalesce(array_agg(distinct trim(x)), '{}')
  into v_conf_ids
  from unnest(coalesce(p_conference_ids, '{}')) as x
  where length(trim(x)) > 0;

  if p_is_national is not null or p_team_ids is not null or p_conference_ids is not null then
    if not coalesce(p_is_national, v_row.is_national, false)
       and coalesce(cardinality(v_team_ids), 0) = 0
       and coalesce(cardinality(v_conf_ids), 0) = 0
       and p_team_ids is not null
       and p_conference_ids is not null then
      raise exception 'coverage requires national, a conference, or a team';
    end if;
  end if;

  if p_team_ids is null then
    select coalesce(array_agg(t.team_id), '{}') into v_team_ids
    from public.media_suggestion_teams t where t.media_suggestion_id = p_id;
  end if;
  if p_conference_ids is null then
    select coalesce(array_agg(c.conference_id), '{}') into v_conf_ids
    from public.media_suggestion_conferences c where c.media_suggestion_id = p_id;
  end if;

  v_scope := public.media_derive_scope(
    coalesce(p_is_national, v_row.is_national, false),
    v_team_ids,
    v_conf_ids
  );

  select e.key, e.value
  into v_primary_key, v_primary_url
  from jsonb_each_text(v_links) e
  order by case e.key
    when 'website' then 1 when 'spotify' then 2 when 'apple' then 3
    when 'youtube' then 4 when 'x' then 5 else 9 end
  limit 1;

  if p_team_ids is not null or p_conference_ids is not null or p_is_national is not null then
    delete from public.media_suggestion_teams where media_suggestion_id = p_id;
    delete from public.media_suggestion_conferences where media_suggestion_id = p_id;

    foreach v_team in array v_team_ids loop
      insert into public.media_suggestion_teams (media_suggestion_id, team_id)
      values (p_id, v_team) on conflict do nothing;
    end loop;
    foreach v_conf in array v_conf_ids loop
      insert into public.media_suggestion_conferences (media_suggestion_id, conference_id)
      values (p_id, v_conf) on conflict do nothing;
    end loop;
  end if;

  update public.media_suggestions
  set
    name = v_name,
    description = nullif(trim(coalesce(p_description, '')), ''),
    logo_url = v_logo,
    platform_links = v_links,
    provider = coalesce(v_primary_key, provider, 'multi'),
    submitted_url = coalesce(v_primary_url, submitted_url, 'https://fcspulse.com'),
    is_national = coalesce(p_is_national, is_national, false),
    scope = v_scope,
    team_id = case when coalesce(cardinality(v_team_ids), 0) > 0 then v_team_ids[1] else null end,
    conference_id = case when coalesce(cardinality(v_conf_ids), 0) > 0 then v_conf_ids[1] else null end,
    notes = case when p_notes is null then notes else nullif(trim(p_notes), '') end,
    coverage_labels = coalesce(p_coverage_labels, coverage_labels)
  where id = p_id;

  perform public.media_admin_write_audit(
    'suggestion_draft_saved',
    'suggestion',
    p_id,
    'Saved draft changes for media suggestion',
    jsonb_build_object(
      'name', v_name,
      'platformLinks', v_links,
      'isNational', coalesce(p_is_national, v_row.is_national, false),
      'teamIds', to_jsonb(v_team_ids),
      'conferenceIds', to_jsonb(v_conf_ids)
    )
  );

  return public.admin_get_media_suggestion_detail(p_id);
end;
$$;

revoke all on function public.admin_update_media_suggestion_draft(
  uuid, text, text, text, jsonb, boolean, text[], text[], text, jsonb
) from public;
grant execute on function public.admin_update_media_suggestion_draft(
  uuid, text, text, text, jsonb, boolean, text[], text[], text, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- Approve and publish (atomic)
-- ---------------------------------------------------------------------------
create or replace function public.admin_approve_and_publish_media_suggestion(
  p_id uuid,
  p_existing_source_id uuid default null,
  p_confirm_overwrite boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sug public.media_suggestions;
  v_source_id uuid;
  v_links jsonb;
  v_name text;
  v_scalars record;
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
  v_mode text;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_sug from public.media_suggestions where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_sug.status = 'approved' and v_sug.published_media_source_id is not null then
    raise exception 'already_published';
  end if;
  if v_sug.status = 'rejected' then
    raise exception 'already_reviewed';
  end if;

  v_name := nullif(trim(coalesce(v_sug.name, '')), '');
  if v_name is null then
    raise exception 'name_required';
  end if;

  v_links := public.media_normalize_platform_links(coalesce(v_sug.platform_links, '{}'::jsonb));
  if v_links = '{}'::jsonb then
    raise exception 'platform_links_required';
  end if;

  select coalesce(array_agg(t.team_id order by t.team_id), '{}')
  into v_team_ids
  from public.media_suggestion_teams t
  where t.media_suggestion_id = p_id;

  select coalesce(array_agg(c.conference_id order by c.conference_id), '{}')
  into v_conf_ids
  from public.media_suggestion_conferences c
  where c.media_suggestion_id = p_id;

  if not coalesce(v_sug.is_national, false)
     and coalesce(cardinality(v_team_ids), 0) = 0
     and coalesce(cardinality(v_conf_ids), 0) = 0 then
    raise exception 'coverage requires national, a conference, or a team';
  end if;

  select * into v_scalars from public.media_platform_links_to_scalars(v_links);

  if p_existing_source_id is not null then
    if not coalesce(p_confirm_overwrite, false) then
      raise exception 'overwrite_confirmation_required';
    end if;
    if not exists (select 1 from public.media_sources where id = p_existing_source_id) then
      raise exception 'source_not_found';
    end if;
    v_source_id := p_existing_source_id;
    v_mode := 'update';

    update public.media_sources
    set
      name = v_name,
      description = v_sug.description,
      logo_url = v_sug.logo_url,
      platform_links = v_links,
      website_url = v_scalars.website_url,
      spotify_url = v_scalars.spotify_url,
      youtube_url = v_scalars.youtube_url,
      x_url = v_scalars.x_url,
      apple_podcast_url = v_scalars.apple_podcast_url,
      is_approved = true,
      is_active = true,
      updated_at = now()
    where id = v_source_id;
  else
    v_mode := 'create';
    insert into public.media_sources (
      name,
      description,
      logo_url,
      scope,
      is_national,
      platform_links,
      website_url,
      spotify_url,
      youtube_url,
      x_url,
      apple_podcast_url,
      is_approved,
      is_active,
      display_order
    ) values (
      v_name,
      v_sug.description,
      v_sug.logo_url,
      'national',
      coalesce(v_sug.is_national, false),
      v_links,
      v_scalars.website_url,
      v_scalars.spotify_url,
      v_scalars.youtube_url,
      v_scalars.x_url,
      v_scalars.apple_podcast_url,
      true,
      true,
      100
    )
    returning id into v_source_id;
  end if;

  perform public.media_replace_source_coverage(
    v_source_id,
    coalesce(v_sug.is_national, false),
    v_team_ids,
    v_conf_ids
  );

  update public.media_suggestions
  set
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    published_media_source_id = v_source_id,
    review_action_token_hash = null,
    review_action_expires_at = null
  where id = p_id;

  perform public.media_admin_write_audit(
    'suggestion_approved_published',
    'suggestion',
    p_id,
    format('Approved and published suggestion (%s)', v_mode),
    jsonb_build_object(
      'mediaSourceId', v_source_id,
      'mode', v_mode,
      'name', v_name,
      'platformLinks', v_links
    ),
    v_source_id
  );

  return jsonb_build_object(
    'ok', true,
    'suggestionId', p_id,
    'mediaSourceId', v_source_id,
    'mode', v_mode,
    'status', 'approved'
  );
end;
$$;

revoke all on function public.admin_approve_and_publish_media_suggestion(uuid, uuid, boolean) from public;
grant execute on function public.admin_approve_and_publish_media_suggestion(uuid, uuid, boolean)
  to authenticated;

create or replace function public.admin_reject_media_suggestion(
  p_id uuid,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sug public.media_suggestions;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_sug from public.media_suggestions where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_sug.status <> 'pending' then
    raise exception 'already_reviewed';
  end if;

  update public.media_suggestions
  set
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
    review_action_token_hash = null,
    review_action_expires_at = null
  where id = p_id;

  perform public.media_admin_write_audit(
    'suggestion_rejected',
    'suggestion',
    p_id,
    'Rejected media suggestion',
    jsonb_build_object('adminNotes', nullif(trim(coalesce(p_admin_notes, '')), ''))
  );

  return jsonb_build_object('ok', true, 'suggestionId', p_id, 'status', 'rejected');
end;
$$;

revoke all on function public.admin_reject_media_suggestion(uuid, text) from public;
grant execute on function public.admin_reject_media_suggestion(uuid, text) to authenticated;

create or replace function public.admin_mark_suggestion_outcome_notified(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;
  update public.media_suggestions
  set outcome_notified_at = coalesce(outcome_notified_at, now())
  where id = p_id;
end;
$$;

revoke all on function public.admin_mark_suggestion_outcome_notified(uuid) from public;
grant execute on function public.admin_mark_suggestion_outcome_notified(uuid)
  to authenticated, service_role;

create or replace function public.admin_find_media_source_matches(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := lower(trim(coalesce(p_name, '')));
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;
  if v_name = '' then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'isActive', coalesce(s.is_active, true),
          'isApproved', s.is_approved
        )
        order by s.name
      )
      from public.media_sources s
      where lower(s.name) = v_name
         or lower(s.name) like '%' || v_name || '%'
      limit 20
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.admin_find_media_source_matches(text) from public;
grant execute on function public.admin_find_media_source_matches(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin media source directory
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_media_sources(
  p_search text default null,
  p_national boolean default null,
  p_team_id text default null,
  p_conference_id text default null,
  p_active boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  return coalesce(
    (
      select jsonb_agg(row_data order by (row_data ->> 'name'))
      from (
        select jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'description', s.description,
          'logoUrl', s.logo_url,
          'isNational', coalesce(s.is_national, false),
          'isApproved', s.is_approved,
          'isActive', coalesce(s.is_active, true),
          'platformLinks', coalesce(s.platform_links, '{}'::jsonb),
          'teamIds', coalesce(
            (
              select jsonb_agg(t.team_id order by t.team_id)
              from public.media_source_teams t
              where t.media_source_id = s.id
            ),
            '[]'::jsonb
          ),
          'conferenceIds', coalesce(
            (
              select jsonb_agg(c.conference_id order by c.conference_id)
              from public.media_source_conferences c
              where c.media_source_id = s.id
            ),
            '[]'::jsonb
          ),
          'updatedAt', s.updated_at
        ) as row_data
        from public.media_sources s
        where (v_search is null or s.name ilike '%' || v_search || '%')
          and (p_national is null or s.is_national = p_national)
          and (p_active is null or coalesce(s.is_active, true) = p_active)
          and (
            p_team_id is null
            or exists (
              select 1 from public.media_source_teams t
              where t.media_source_id = s.id and t.team_id = trim(p_team_id)
            )
          )
          and (
            p_conference_id is null
            or exists (
              select 1 from public.media_source_conferences c
              where c.media_source_id = s.id and c.conference_id = trim(p_conference_id)
            )
          )
      ) q
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.admin_list_media_sources(text, boolean, text, text, boolean) from public;
grant execute on function public.admin_list_media_sources(text, boolean, text, text, boolean)
  to authenticated;

create or replace function public.admin_get_media_source_detail(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.media_sources;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;
  select * into s from public.media_sources where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;

  return jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'subtitle', s.subtitle,
    'description', s.description,
    'logoUrl', s.logo_url,
    'platformLinks', coalesce(s.platform_links, '{}'::jsonb),
    'isNational', coalesce(s.is_national, false),
    'isApproved', s.is_approved,
    'isActive', coalesce(s.is_active, true),
    'displayOrder', s.display_order,
    'teamIds', coalesce(
      (
        select jsonb_agg(t.team_id order by t.team_id)
        from public.media_source_teams t
        where t.media_source_id = s.id
      ),
      '[]'::jsonb
    ),
    'conferenceIds', coalesce(
      (
        select jsonb_agg(c.conference_id order by c.conference_id)
        from public.media_source_conferences c
        where c.media_source_id = s.id
      ),
      '[]'::jsonb
    ),
    'createdAt', s.created_at,
    'updatedAt', s.updated_at
  );
end;
$$;

revoke all on function public.admin_get_media_source_detail(uuid) from public;
grant execute on function public.admin_get_media_source_detail(uuid) to authenticated;

create or replace function public.admin_upsert_media_source(
  p_id uuid default null,
  p_name text default null,
  p_description text default null,
  p_logo_url text default null,
  p_platform_links jsonb default null,
  p_is_national boolean default false,
  p_team_ids text[] default '{}',
  p_conference_ids text[] default '{}',
  p_is_active boolean default true,
  p_is_approved boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_links jsonb;
  v_logo text;
  v_scalars record;
  v_action text;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;
  if v_name is null then
    raise exception 'name_required';
  end if;

  v_links := public.media_normalize_platform_links(coalesce(p_platform_links, '{}'::jsonb));
  if v_links = '{}'::jsonb then
    raise exception 'platform_links_required';
  end if;

  v_logo := nullif(trim(coalesce(p_logo_url, '')), '');
  if v_logo is not null and v_logo !~* '^https?://' then
    raise exception 'invalid_logo_url';
  end if;

  select * into v_scalars from public.media_platform_links_to_scalars(v_links);

  if p_id is null then
    v_action := 'source_created';
    insert into public.media_sources (
      name,
      description,
      logo_url,
      scope,
      is_national,
      platform_links,
      website_url,
      spotify_url,
      youtube_url,
      x_url,
      apple_podcast_url,
      is_approved,
      is_active
    ) values (
      v_name,
      nullif(trim(coalesce(p_description, '')), ''),
      v_logo,
      'national',
      coalesce(p_is_national, false),
      v_links,
      v_scalars.website_url,
      v_scalars.spotify_url,
      v_scalars.youtube_url,
      v_scalars.x_url,
      v_scalars.apple_podcast_url,
      coalesce(p_is_approved, true),
      coalesce(p_is_active, true)
    )
    returning id into v_id;
  else
    v_action := 'source_updated';
    if not exists (select 1 from public.media_sources where id = p_id) then
      raise exception 'not_found';
    end if;
    v_id := p_id;
    update public.media_sources
    set
      name = v_name,
      description = nullif(trim(coalesce(p_description, '')), ''),
      logo_url = v_logo,
      platform_links = v_links,
      website_url = v_scalars.website_url,
      spotify_url = v_scalars.spotify_url,
      youtube_url = v_scalars.youtube_url,
      x_url = v_scalars.x_url,
      apple_podcast_url = v_scalars.apple_podcast_url,
      is_approved = coalesce(p_is_approved, is_approved),
      is_active = coalesce(p_is_active, is_active),
      updated_at = now()
    where id = v_id;
  end if;

  perform public.media_replace_source_coverage(
    v_id,
    coalesce(p_is_national, false),
    coalesce(p_team_ids, '{}'),
    coalesce(p_conference_ids, '{}')
  );

  perform public.media_admin_write_audit(
    v_action,
    'source',
    v_id,
    case when p_id is null then 'Created media source' else 'Updated media source' end,
    jsonb_build_object(
      'name', v_name,
      'platformLinks', v_links,
      'isNational', coalesce(p_is_national, false),
      'isActive', coalesce(p_is_active, true),
      'teamIds', to_jsonb(coalesce(p_team_ids, '{}')),
      'conferenceIds', to_jsonb(coalesce(p_conference_ids, '{}'))
    )
  );

  return public.admin_get_media_source_detail(v_id);
end;
$$;

revoke all on function public.admin_upsert_media_source(
  uuid, text, text, text, jsonb, boolean, text[], text[], boolean, boolean
) from public;
grant execute on function public.admin_upsert_media_source(
  uuid, text, text, text, jsonb, boolean, text[], text[], boolean, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- Corrections queue list (prep)
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_media_corrections(p_status text default 'pending')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'mediaSourceId', c.media_source_id,
          'correctionType', c.correction_type,
          'details', c.details,
          'submitterEmail', c.submitter_email,
          'status', c.status,
          'createdAt', c.created_at
        )
        order by c.created_at desc
      )
      from public.media_correction_suggestions c
      where (p_status is null or c.status = p_status)
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.admin_list_media_corrections(text) from public;
grant execute on function public.admin_list_media_corrections(text) to authenticated;
