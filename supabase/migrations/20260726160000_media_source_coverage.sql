-- Flexible multi-select coverage for media_sources + media_suggestions.
-- Additive only: keeps legacy scope / team_id / conference_id columns.
-- Apply with: supabase db push

-- ---------------------------------------------------------------------------
-- media_sources: is_national + join tables
-- ---------------------------------------------------------------------------
alter table public.media_sources
  add column if not exists is_national boolean not null default false;

create table if not exists public.media_source_teams (
  media_source_id uuid not null references public.media_sources(id) on delete cascade,
  team_id text not null,
  created_at timestamptz not null default now(),
  primary key (media_source_id, team_id)
);

create table if not exists public.media_source_conferences (
  media_source_id uuid not null references public.media_sources(id) on delete cascade,
  conference_id text not null,
  created_at timestamptz not null default now(),
  primary key (media_source_id, conference_id)
);

create index if not exists media_source_teams_team_id_idx
  on public.media_source_teams (team_id);
create index if not exists media_source_conferences_conference_id_idx
  on public.media_source_conferences (conference_id);

-- ---------------------------------------------------------------------------
-- media_suggestions: is_national + join tables
-- ---------------------------------------------------------------------------
alter table public.media_suggestions
  add column if not exists is_national boolean not null default false;

create table if not exists public.media_suggestion_teams (
  media_suggestion_id uuid not null references public.media_suggestions(id) on delete cascade,
  team_id text not null,
  created_at timestamptz not null default now(),
  primary key (media_suggestion_id, team_id)
);

create table if not exists public.media_suggestion_conferences (
  media_suggestion_id uuid not null references public.media_suggestions(id) on delete cascade,
  conference_id text not null,
  created_at timestamptz not null default now(),
  primary key (media_suggestion_id, conference_id)
);

create index if not exists media_suggestion_teams_team_id_idx
  on public.media_suggestion_teams (team_id);
create index if not exists media_suggestion_conferences_conference_id_idx
  on public.media_suggestion_conferences (conference_id);

-- ---------------------------------------------------------------------------
-- Backfill from legacy columns
-- ---------------------------------------------------------------------------
update public.media_sources
set is_national = true
where scope = 'national';

insert into public.media_source_teams (media_source_id, team_id)
select id, team_id
from public.media_sources
where scope = 'team'
  and team_id is not null
  and length(trim(team_id)) > 0
on conflict do nothing;

insert into public.media_source_conferences (media_source_id, conference_id)
select id, conference_id
from public.media_sources
where scope = 'conference'
  and conference_id is not null
  and length(trim(conference_id)) > 0
on conflict do nothing;

-- Team-scoped rows that also carried a conference_id (e.g. Big Sky metadata)
insert into public.media_source_conferences (media_source_id, conference_id)
select id, conference_id
from public.media_sources
where conference_id is not null
  and length(trim(conference_id)) > 0
  and scope = 'team'
on conflict do nothing;

update public.media_suggestions
set is_national = true
where scope = 'national';

insert into public.media_suggestion_teams (media_suggestion_id, team_id)
select id, team_id
from public.media_suggestions
where scope = 'team'
  and team_id is not null
  and length(trim(team_id)) > 0
on conflict do nothing;

insert into public.media_suggestion_conferences (media_suggestion_id, conference_id)
select id, conference_id
from public.media_suggestions
where scope = 'conference'
  and conference_id is not null
  and length(trim(conference_id)) > 0
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS (match existing media_sources / media_suggestions style)
-- ---------------------------------------------------------------------------
alter table public.media_source_teams enable row level security;
alter table public.media_source_conferences enable row level security;
alter table public.media_suggestion_teams enable row level security;
alter table public.media_suggestion_conferences enable row level security;

revoke all on table public.media_source_teams from anon, authenticated;
revoke all on table public.media_source_conferences from anon, authenticated;
revoke all on table public.media_suggestion_teams from anon, authenticated;
revoke all on table public.media_suggestion_conferences from anon, authenticated;

grant select on table public.media_source_teams to anon, authenticated;
grant select on table public.media_source_conferences to anon, authenticated;
grant select, insert, update, delete on table public.media_source_teams to authenticated;
grant select, insert, update, delete on table public.media_source_conferences to authenticated;
grant all on table public.media_source_teams to service_role;
grant all on table public.media_source_conferences to service_role;

grant select, insert, update, delete on table public.media_suggestion_teams to authenticated;
grant select, insert, update, delete on table public.media_suggestion_conferences to authenticated;
grant all on table public.media_suggestion_teams to service_role;
grant all on table public.media_suggestion_conferences to service_role;

drop policy if exists media_source_teams_public_select on public.media_source_teams;
create policy media_source_teams_public_select on public.media_source_teams
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.media_sources s
      where s.id = media_source_id
        and (s.is_approved = true or public.is_app_admin())
    )
  );

drop policy if exists media_source_teams_admin_write on public.media_source_teams;
create policy media_source_teams_admin_write on public.media_source_teams
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists media_source_conferences_public_select on public.media_source_conferences;
create policy media_source_conferences_public_select on public.media_source_conferences
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.media_sources s
      where s.id = media_source_id
        and (s.is_approved = true or public.is_app_admin())
    )
  );

drop policy if exists media_source_conferences_admin_write on public.media_source_conferences;
create policy media_source_conferences_admin_write on public.media_source_conferences
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists media_suggestion_teams_admin_all on public.media_suggestion_teams;
create policy media_suggestion_teams_admin_all on public.media_suggestion_teams
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists media_suggestion_conferences_admin_all on public.media_suggestion_conferences;
create policy media_suggestion_conferences_admin_all on public.media_suggestion_conferences
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- list_approved_media_sources — include coverage arrays (one query)
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
  order by s.display_order asc, s.name asc;
$$;

revoke all on function public.list_approved_media_sources() from public;
grant execute on function public.list_approved_media_sources()
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- submit_media_suggestion — flexible coverage (join tables)
-- Keep legacy overload for older clients.
-- ---------------------------------------------------------------------------
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
declare
  v_provider text := lower(trim(p_provider));
  v_url text := trim(p_submitted_url);
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
  if v_provider not in ('spotify', 'youtube', 'x') then
    raise exception 'provider must be spotify, youtube, or x';
  end if;
  if v_url is null or v_url !~* '^https?://' then
    raise exception 'submitted_url must be an http(s) URL';
  end if;

  -- Normalize arrays (trim, drop empties, distinct)
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

  -- Legacy scope / scalar columns for compatibility
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
    provider,
    submitted_url,
    scope,
    conference_id,
    team_id,
    is_national,
    notes,
    status,
    submitted_by
  ) values (
    v_provider,
    v_url,
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

revoke all on function public.submit_media_suggestion(text, text, boolean, text[], text[], text) from public;
grant execute on function public.submit_media_suggestion(text, text, boolean, text[], text[], text)
  to anon, authenticated, service_role;

-- Legacy submit signature (single scope) — maps into flexible coverage
create or replace function public.submit_media_suggestion(
  p_provider text,
  p_submitted_url text,
  p_scope text,
  p_conference_id text default null,
  p_team_id text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text := lower(trim(p_scope));
  v_is_national boolean := false;
  v_conference_ids text[] := '{}';
  v_team_ids text[] := '{}';
begin
  if v_scope = 'national' then
    v_is_national := true;
  elsif v_scope = 'conference' then
    if p_conference_id is null or length(trim(p_conference_id)) = 0 then
      raise exception 'conference_id is required for conference scope';
    end if;
    v_conference_ids := array[trim(p_conference_id)];
  elsif v_scope = 'team' then
    if p_team_id is null or length(trim(p_team_id)) = 0 then
      raise exception 'team_id is required for team scope';
    end if;
    v_team_ids := array[trim(p_team_id)];
  else
    raise exception 'scope must be national, conference, or team';
  end if;

  return public.submit_media_suggestion(
    p_provider,
    p_submitted_url,
    v_is_national,
    v_conference_ids,
    v_team_ids,
    p_notes
  );
end;
$$;

revoke all on function public.submit_media_suggestion(text, text, text, text, text, text) from public;
grant execute on function public.submit_media_suggestion(text, text, text, text, text, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- admin_list_media_suggestions — include coverage arrays
-- ---------------------------------------------------------------------------
drop function if exists public.admin_list_media_suggestions(text);

create or replace function public.admin_list_media_suggestions(p_status text default 'pending')
returns table (
  id uuid,
  provider text,
  submitted_url text,
  scope text,
  conference_id text,
  team_id text,
  notes text,
  status text,
  submitted_by uuid,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  is_national boolean,
  team_ids text[],
  conference_ids text[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  return query
  select
    s.id,
    s.provider,
    s.submitted_url,
    s.scope,
    s.conference_id,
    s.team_id,
    s.notes,
    s.status,
    s.submitted_by,
    s.created_at,
    s.reviewed_at,
    s.reviewed_by,
    s.is_national,
    coalesce(
      (
        select array_agg(t.team_id order by t.team_id)
        from public.media_suggestion_teams t
        where t.media_suggestion_id = s.id
      ),
      '{}'::text[]
    ) as team_ids,
    coalesce(
      (
        select array_agg(c.conference_id order by c.conference_id)
        from public.media_suggestion_conferences c
        where c.media_suggestion_id = s.id
      ),
      '{}'::text[]
    ) as conference_ids
  from public.media_suggestions s
  where (p_status is null or s.status = p_status)
  order by s.created_at desc;
end;
$$;

revoke all on function public.admin_list_media_suggestions(text) from public;
grant execute on function public.admin_list_media_suggestions(text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_review_media_suggestion — optional coverage assignment; no auto-publish
-- ---------------------------------------------------------------------------
drop function if exists public.admin_review_media_suggestion(uuid, text);

create or replace function public.admin_review_media_suggestion(
  p_id uuid,
  p_status text,
  p_is_national boolean default null,
  p_conference_ids text[] default null,
  p_team_ids text[] default null
)
returns public.media_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.media_suggestions;
  v_is_national boolean;
  v_conference_ids text[] := '{}';
  v_team_ids text[] := '{}';
  v_scope text;
  v_conf text;
  v_team text;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'status must be approved or rejected';
  end if;

  select * into v_row from public.media_suggestions where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;

  -- When coverage args are provided, replace suggestion mappings.
  if p_is_national is not null or p_conference_ids is not null or p_team_ids is not null then
    v_is_national := coalesce(p_is_national, v_row.is_national, false);

    if p_conference_ids is not null then
      select coalesce(array_agg(distinct trim(x)), '{}')
      into v_conference_ids
      from unnest(p_conference_ids) as x
      where length(trim(x)) > 0;
    else
      select coalesce(array_agg(c.conference_id order by c.conference_id), '{}')
      into v_conference_ids
      from public.media_suggestion_conferences c
      where c.media_suggestion_id = p_id;
    end if;

    if p_team_ids is not null then
      select coalesce(array_agg(distinct trim(x)), '{}')
      into v_team_ids
      from unnest(p_team_ids) as x
      where length(trim(x)) > 0;
    else
      select coalesce(array_agg(t.team_id order by t.team_id), '{}')
      into v_team_ids
      from public.media_suggestion_teams t
      where t.media_suggestion_id = p_id;
    end if;

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

    delete from public.media_suggestion_teams where media_suggestion_id = p_id;
    delete from public.media_suggestion_conferences where media_suggestion_id = p_id;

    foreach v_team in array v_team_ids loop
      insert into public.media_suggestion_teams (media_suggestion_id, team_id)
      values (p_id, v_team)
      on conflict do nothing;
    end loop;

    foreach v_conf in array v_conference_ids loop
      insert into public.media_suggestion_conferences (media_suggestion_id, conference_id)
      values (p_id, v_conf)
      on conflict do nothing;
    end loop;

    update public.media_suggestions
    set
      is_national = v_is_national,
      scope = v_scope,
      team_id = case when coalesce(array_length(v_team_ids, 1), 0) > 0 then v_team_ids[1] else null end,
      conference_id = case when coalesce(array_length(v_conference_ids, 1), 0) > 0 then v_conference_ids[1] else null end,
      status = p_status,
      reviewed_at = now(),
      reviewed_by = auth.uid()
    where id = p_id
    returning * into v_row;
  else
    update public.media_suggestions
    set
      status = p_status,
      reviewed_at = now(),
      reviewed_by = auth.uid()
    where id = p_id
    returning * into v_row;
  end if;

  -- Approval does NOT auto-publish a media_sources row.
  return v_row;
end;
$$;

revoke all on function public.admin_review_media_suggestion(uuid, text, boolean, text[], text[]) from public;
grant execute on function public.admin_review_media_suggestion(uuid, text, boolean, text[], text[])
  to authenticated;
