-- Unified FCS Media directory (media_sources) + public suggestions
-- Apply with: supabase db push
-- Does not remove media_creators / media_links / media_submissions.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- media_sources (approved public directory)
-- ---------------------------------------------------------------------------
create table if not exists public.media_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subtitle text,
  description text,
  scope text not null check (scope in ('national', 'conference', 'team')),
  conference_id text,
  team_id text,
  logo_url text,
  spotify_url text,
  youtube_url text,
  x_url text,
  apple_podcast_url text,
  is_approved boolean not null default false,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_sources_is_approved_idx
  on public.media_sources (is_approved);
create index if not exists media_sources_scope_idx
  on public.media_sources (scope);
create index if not exists media_sources_team_id_idx
  on public.media_sources (team_id);
create index if not exists media_sources_conference_id_idx
  on public.media_sources (conference_id);
create index if not exists media_sources_display_order_idx
  on public.media_sources (display_order);

drop trigger if exists media_sources_set_updated_at on public.media_sources;
create trigger media_sources_set_updated_at
  before update on public.media_sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- media_suggestions (pending review — not public)
-- ---------------------------------------------------------------------------
create table if not exists public.media_suggestions (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('spotify', 'youtube', 'x')),
  submitted_url text not null,
  scope text not null check (scope in ('national', 'conference', 'team')),
  conference_id text,
  team_id text,
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create index if not exists media_suggestions_status_idx
  on public.media_suggestions (status);
create index if not exists media_suggestions_created_at_idx
  on public.media_suggestions (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.media_sources enable row level security;
alter table public.media_suggestions enable row level security;

revoke all on table public.media_sources from anon, authenticated;
revoke all on table public.media_suggestions from anon, authenticated;

grant select on table public.media_sources to anon, authenticated;
grant select, insert, update, delete on table public.media_sources to authenticated;
grant all on table public.media_sources to service_role;

grant select, insert, update, delete on table public.media_suggestions to authenticated;
grant all on table public.media_suggestions to service_role;

-- Public: approved sources only (admins can also read unapproved)
drop policy if exists media_sources_public_select on public.media_sources;
create policy media_sources_public_select on public.media_sources
  for select to anon, authenticated
  using (is_approved = true or public.is_app_admin());

drop policy if exists media_sources_admin_write on public.media_sources;
create policy media_sources_admin_write on public.media_sources
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Suggestions: no public select; admins manage; insert via security definer RPC
drop policy if exists media_suggestions_admin_all on public.media_suggestions;
create policy media_suggestions_admin_all on public.media_suggestions
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------
create or replace function public.list_approved_media_sources()
returns setof public.media_sources
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.media_sources
  where is_approved = true
  order by display_order asc, name asc;
$$;

revoke all on function public.list_approved_media_sources() from public;
grant execute on function public.list_approved_media_sources()
  to anon, authenticated, service_role;

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
  v_provider text := lower(trim(p_provider));
  v_url text := trim(p_submitted_url);
  v_scope text := lower(trim(p_scope));
  v_id uuid;
begin
  if v_provider not in ('spotify', 'youtube', 'x') then
    raise exception 'provider must be spotify, youtube, or x';
  end if;
  if v_url is null or v_url !~* '^https?://' then
    raise exception 'submitted_url must be an http(s) URL';
  end if;
  if v_scope not in ('national', 'conference', 'team') then
    raise exception 'scope must be national, conference, or team';
  end if;
  if v_scope = 'conference' and (p_conference_id is null or length(trim(p_conference_id)) = 0) then
    raise exception 'conference_id is required for conference scope';
  end if;
  if v_scope = 'team' and (p_team_id is null or length(trim(p_team_id)) = 0) then
    raise exception 'team_id is required for team scope';
  end if;

  insert into public.media_suggestions (
    provider,
    submitted_url,
    scope,
    conference_id,
    team_id,
    notes,
    status,
    submitted_by
  ) values (
    v_provider,
    v_url,
    v_scope,
    case when v_scope = 'conference' then trim(p_conference_id) else null end,
    case when v_scope = 'team' then trim(p_team_id) else null end,
    nullif(trim(coalesce(p_notes, '')), ''),
    'pending',
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_media_suggestion(text, text, text, text, text, text) from public;
grant execute on function public.submit_media_suggestion(text, text, text, text, text, text)
  to anon, authenticated, service_role;

create or replace function public.admin_list_media_suggestions(p_status text default 'pending')
returns setof public.media_suggestions
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  return query
  select *
  from public.media_suggestions
  where (p_status is null or status = p_status)
  order by created_at desc;
end;
$$;

revoke all on function public.admin_list_media_suggestions(text) from public;
grant execute on function public.admin_list_media_suggestions(text) to authenticated;

create or replace function public.admin_review_media_suggestion(
  p_id uuid,
  p_status text
)
returns public.media_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.media_suggestions;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'status must be approved or rejected';
  end if;

  update public.media_suggestions
  set
    status = p_status,
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'not_found';
  end if;

  -- Approval does NOT auto-publish a media_sources row.
  -- Developer must complete creator details before publishing.
  return v_row;
end;
$$;

revoke all on function public.admin_review_media_suggestion(uuid, text) from public;
grant execute on function public.admin_review_media_suggestion(uuid, text) to authenticated;
