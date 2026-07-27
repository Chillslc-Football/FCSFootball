-- Community FCS media submissions + public listings + admin allowlist
-- Apply with: supabase db push

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Admin allowlist (email-based; checked server-side via JWT email claim)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_email_allowlist (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint admin_email_allowlist_email_lower check (email = lower(email))
);

insert into public.admin_email_allowlist (email)
values ('chillslc@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_email_allowlist a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public listings
-- ---------------------------------------------------------------------------
create table if not exists public.media_creators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  scope text not null check (scope in ('national', 'team')),
  team_id text,
  team_name text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  featured boolean not null default false,
  source_submission_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_creators_status_idx on public.media_creators (status);
create index if not exists media_creators_scope_team_idx on public.media_creators (scope, team_id);

create table if not exists public.media_links (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.media_creators(id) on delete cascade,
  resource_type text not null check (
    resource_type in ('podcast', 'youtube', 'x_twitter', 'website', 'newsletter', 'other')
  ),
  label text,
  url text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_links_creator_idx on public.media_links (creator_id);

create table if not exists public.media_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_name text not null,
  scope text not null check (scope in ('national', 'team')),
  team_id text,
  team_name text,
  resource_type text not null check (
    resource_type in ('podcast', 'youtube', 'x_twitter', 'website', 'newsletter', 'other')
  ),
  submitted_url text not null,
  submitted_url_normalized text not null,
  description text,
  submitter_name text,
  submitter_email text,
  submitter_notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  published_creator_id uuid references public.media_creators(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_submissions_status_idx on public.media_submissions (status);
create index if not exists media_submissions_url_norm_idx
  on public.media_submissions (submitted_url_normalized);
create index if not exists media_submissions_team_idx on public.media_submissions (team_id);
create index if not exists media_submissions_type_idx on public.media_submissions (resource_type);

alter table public.media_creators
  drop constraint if exists media_creators_source_submission_id_fkey;
alter table public.media_creators
  add constraint media_creators_source_submission_id_fkey
  foreign key (source_submission_id) references public.media_submissions(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.normalize_media_url(raw_url text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
begin
  cleaned := lower(trim(raw_url));
  cleaned := regexp_replace(cleaned, '^https?://', '');
  cleaned := regexp_replace(cleaned, '^www\.', '');
  cleaned := regexp_replace(cleaned, '/+$', '');
  return cleaned;
end;
$$;

create or replace function public.slugify_media_name(raw_name text)
returns text
language plpgsql
immutable
as $$
declare
  slug text;
begin
  slug := lower(trim(raw_name));
  slug := regexp_replace(slug, '[^a-z0-9]+', '-', 'g');
  slug := regexp_replace(slug, '^-+|-+$', '', 'g');
  if slug = '' then
    slug := 'creator';
  end if;
  return left(slug, 80);
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists media_creators_set_updated_at on public.media_creators;
create trigger media_creators_set_updated_at
  before update on public.media_creators
  for each row execute function public.set_updated_at();

drop trigger if exists media_links_set_updated_at on public.media_links;
create trigger media_links_set_updated_at
  before update on public.media_links
  for each row execute function public.set_updated_at();

drop trigger if exists media_submissions_set_updated_at on public.media_submissions;
create trigger media_submissions_set_updated_at
  before update on public.media_submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.admin_email_allowlist enable row level security;
alter table public.media_creators enable row level security;
alter table public.media_links enable row level security;
alter table public.media_submissions enable row level security;

revoke all on table public.admin_email_allowlist from anon, authenticated;
revoke all on table public.media_creators from anon, authenticated;
revoke all on table public.media_links from anon, authenticated;
revoke all on table public.media_submissions from anon, authenticated;

grant select on table public.admin_email_allowlist to authenticated;
grant select on table public.media_creators to anon, authenticated;
grant select on table public.media_links to anon, authenticated;

grant select, insert, update, delete on table public.media_creators to authenticated;
grant select, insert, update, delete on table public.media_links to authenticated;
grant select, insert, update, delete on table public.media_submissions to authenticated;

grant all on table public.admin_email_allowlist to service_role;
grant all on table public.media_creators to service_role;
grant all on table public.media_links to service_role;
grant all on table public.media_submissions to service_role;

-- Allowlist: admins can read (to confirm their own access); no public read of full list needed
create policy admin_allowlist_admin_select on public.admin_email_allowlist
  for select to authenticated
  using (public.is_app_admin());

-- Public: active creators only
create policy media_creators_public_select on public.media_creators
  for select to anon, authenticated
  using (status = 'active' or public.is_app_admin());

create policy media_creators_admin_write on public.media_creators
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Public: active links on active creators
create policy media_links_public_select on public.media_links
  for select to anon, authenticated
  using (
    public.is_app_admin()
    or (
      is_active = true
      and exists (
        select 1 from public.media_creators c
        where c.id = creator_id and c.status = 'active'
      )
    )
  );

create policy media_links_admin_write on public.media_links
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Submissions: admin only (no anon policies = public cannot read/write directly)
create policy media_submissions_admin_all on public.media_submissions
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- Public submit RPC (pending only). Does not expose submitter emails via SELECT.
-- ---------------------------------------------------------------------------
create or replace function public.submit_media_resource(
  p_submitted_name text,
  p_scope text,
  p_resource_type text,
  p_submitted_url text,
  p_team_id text default null,
  p_team_name text default null,
  p_description text default null,
  p_submitter_name text default null,
  p_submitter_email text default null,
  p_submitter_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(p_submitted_name);
  v_scope text := lower(trim(p_scope));
  v_type text := lower(trim(p_resource_type));
  v_url text := trim(p_submitted_url);
  v_norm text;
  v_id uuid;
  v_existing uuid;
begin
  if v_name is null or length(v_name) < 2 then
    raise exception 'submitted_name is required';
  end if;
  if v_scope not in ('national', 'team') then
    raise exception 'scope must be national or team';
  end if;
  if v_type not in ('podcast', 'youtube', 'x_twitter', 'website', 'newsletter', 'other') then
    raise exception 'invalid resource_type';
  end if;
  if v_url is null or v_url !~* '^https?://' then
    raise exception 'submitted_url must be an http(s) URL';
  end if;
  if v_scope = 'team' and (p_team_name is null or length(trim(p_team_name)) < 2) then
    raise exception 'team_name is required for team-specific submissions';
  end if;

  v_norm := public.normalize_media_url(v_url);

  select id into v_existing
  from public.media_submissions
  where submitted_url_normalized = v_norm
    and status in ('pending', 'approved')
  limit 1;

  if v_existing is not null then
    raise exception 'duplicate_submission' using errcode = 'P0001';
  end if;

  insert into public.media_submissions (
    submitted_name,
    scope,
    team_id,
    team_name,
    resource_type,
    submitted_url,
    submitted_url_normalized,
    description,
    submitter_name,
    submitter_email,
    submitter_notes,
    status
  ) values (
    v_name,
    v_scope,
    nullif(trim(coalesce(p_team_id, '')), ''),
    case when v_scope = 'team' then trim(p_team_name) else null end,
    v_type,
    v_url,
    v_norm,
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_submitter_name, '')), ''),
    nullif(trim(coalesce(p_submitter_email, '')), ''),
    nullif(trim(coalesce(p_submitter_notes, '')), ''),
    'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_media_resource(
  text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.submit_media_resource(
  text, text, text, text, text, text, text, text, text, text
) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_media_submissions(
  p_status text default null,
  p_team_id text default null,
  p_resource_type text default null,
  p_search text default null
)
returns setof public.media_submissions
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  return query
  select s.*
  from public.media_submissions s
  where (p_status is null or s.status = p_status)
    and (p_team_id is null or s.team_id = p_team_id)
    and (p_resource_type is null or s.resource_type = p_resource_type)
    and (
      p_search is null
      or s.submitted_name ilike '%' || p_search || '%'
      or coalesce(s.team_name, '') ilike '%' || p_search || '%'
      or s.submitted_url ilike '%' || p_search || '%'
    )
  order by s.created_at desc;
end;
$$;

revoke all on function public.admin_list_media_submissions(text, text, text, text) from public;
grant execute on function public.admin_list_media_submissions(text, text, text, text) to authenticated;

create or replace function public.admin_update_media_submission(
  p_id uuid,
  p_submitted_name text default null,
  p_scope text default null,
  p_team_id text default null,
  p_team_name text default null,
  p_resource_type text default null,
  p_submitted_url text default null,
  p_description text default null,
  p_admin_notes text default null
)
returns public.media_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.media_submissions;
  v_url text;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_row from public.media_submissions where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;

  v_url := coalesce(nullif(trim(p_submitted_url), ''), v_row.submitted_url);
  if v_url !~* '^https?://' then
    raise exception 'submitted_url must be an http(s) URL';
  end if;

  update public.media_submissions
  set
    submitted_name = coalesce(nullif(trim(p_submitted_name), ''), submitted_name),
    scope = coalesce(nullif(trim(p_scope), ''), scope),
    team_id = case
      when p_team_id is null then team_id
      else nullif(trim(p_team_id), '')
    end,
    team_name = case
      when p_team_name is null then team_name
      else nullif(trim(p_team_name), '')
    end,
    resource_type = coalesce(nullif(trim(p_resource_type), ''), resource_type),
    submitted_url = v_url,
    submitted_url_normalized = public.normalize_media_url(v_url),
    description = case
      when p_description is null then description
      else nullif(trim(p_description), '')
    end,
    admin_notes = case
      when p_admin_notes is null then admin_notes
      else nullif(trim(p_admin_notes), '')
    end,
    updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_update_media_submission(
  uuid, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.admin_update_media_submission(
  uuid, text, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.admin_reject_media_submission(
  p_id uuid,
  p_admin_notes text default null
)
returns public.media_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.media_submissions;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  update public.media_submissions
  set
    status = 'rejected',
    admin_notes = case
      when p_admin_notes is null then admin_notes
      else nullif(trim(p_admin_notes), '')
    end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'not_found';
  end if;

  return v_row;
end;
$$;

revoke all on function public.admin_reject_media_submission(uuid, text) from public;
grant execute on function public.admin_reject_media_submission(uuid, text) to authenticated;

create or replace function public.admin_approve_media_submission(
  p_id uuid,
  p_admin_notes text default null
)
returns public.media_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.media_submissions;
  v_creator_id uuid;
  v_slug text;
  v_base_slug text;
  v_suffix integer := 0;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_sub from public.media_submissions where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_sub.status = 'approved' and v_sub.published_creator_id is not null then
    -- Idempotent re-approve path: keep listing active and refresh link
    v_creator_id := v_sub.published_creator_id;
    update public.media_creators
    set
      name = v_sub.submitted_name,
      description = v_sub.description,
      scope = v_sub.scope,
      team_id = v_sub.team_id,
      team_name = v_sub.team_name,
      status = 'active',
      updated_at = now()
    where id = v_creator_id;

    update public.media_links
    set
      resource_type = v_sub.resource_type,
      label = v_sub.submitted_name,
      url = v_sub.submitted_url,
      is_active = true,
      updated_at = now()
    where creator_id = v_creator_id;

    update public.media_submissions
    set
      status = 'approved',
      admin_notes = case
        when p_admin_notes is null then admin_notes
        else nullif(trim(p_admin_notes), '')
      end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    where id = p_id
    returning * into v_sub;

    return v_sub;
  end if;

  v_base_slug := public.slugify_media_name(v_sub.submitted_name);
  v_slug := v_base_slug;
  while exists (select 1 from public.media_creators where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  insert into public.media_creators (
    name,
    slug,
    description,
    scope,
    team_id,
    team_name,
    status,
    featured,
    source_submission_id
  ) values (
    v_sub.submitted_name,
    v_slug,
    v_sub.description,
    v_sub.scope,
    v_sub.team_id,
    v_sub.team_name,
    'active',
    false,
    v_sub.id
  )
  returning id into v_creator_id;

  insert into public.media_links (
    creator_id,
    resource_type,
    label,
    url,
    sort_order,
    is_active
  ) values (
    v_creator_id,
    v_sub.resource_type,
    v_sub.submitted_name,
    v_sub.submitted_url,
    0,
    true
  );

  update public.media_submissions
  set
    status = 'approved',
    admin_notes = case
      when p_admin_notes is null then admin_notes
      else nullif(trim(p_admin_notes), '')
    end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    published_creator_id = v_creator_id,
    updated_at = now()
  where id = p_id
  returning * into v_sub;

  return v_sub;
end;
$$;

revoke all on function public.admin_approve_media_submission(uuid, text) from public;
grant execute on function public.admin_approve_media_submission(uuid, text) to authenticated;

create or replace function public.admin_set_media_creator_status(
  p_creator_id uuid,
  p_status text
)
returns public.media_creators
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.media_creators;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;
  if p_status not in ('active', 'inactive') then
    raise exception 'invalid status';
  end if;

  update public.media_creators
  set status = p_status, updated_at = now()
  where id = p_creator_id
  returning * into v_row;

  if not found then
    raise exception 'not_found';
  end if;

  if p_status = 'inactive' then
    update public.media_links
    set is_active = false, updated_at = now()
    where creator_id = p_creator_id;
  end if;

  return v_row;
end;
$$;

revoke all on function public.admin_set_media_creator_status(uuid, text) from public;
grant execute on function public.admin_set_media_creator_status(uuid, text) to authenticated;

-- Public listings helper (active only)
create or replace function public.list_public_media_creators()
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  logo_url text,
  scope text,
  team_id text,
  team_name text,
  featured boolean,
  links jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.name,
    c.slug,
    c.description,
    c.logo_url,
    c.scope,
    c.team_id,
    c.team_name,
    c.featured,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', l.id,
            'resource_type', l.resource_type,
            'label', l.label,
            'url', l.url,
            'sort_order', l.sort_order
          )
          order by l.sort_order, l.created_at
        )
        from public.media_links l
        where l.creator_id = c.id and l.is_active = true
      ),
      '[]'::jsonb
    ) as links
  from public.media_creators c
  where c.status = 'active'
  order by c.featured desc, c.name asc;
$$;

revoke all on function public.list_public_media_creators() from public;
grant execute on function public.list_public_media_creators() to anon, authenticated, service_role;
