-- Creator-first media submissions (multiple links per submission)
-- Apply with: supabase db push
-- Redeploy: supabase functions deploy submit-media-resource

-- ---------------------------------------------------------------------------
-- Expand supported link types
-- ---------------------------------------------------------------------------
alter table public.media_links drop constraint if exists media_links_resource_type_check;
alter table public.media_links
  add constraint media_links_resource_type_check check (
    resource_type in (
      'podcast', 'youtube', 'x_twitter', 'website', 'newsletter',
      'facebook', 'instagram', 'other'
    )
  );

alter table public.media_submissions drop constraint if exists media_submissions_resource_type_check;
alter table public.media_submissions
  add constraint media_submissions_resource_type_check check (
    resource_type in (
      'podcast', 'youtube', 'x_twitter', 'website', 'newsletter',
      'facebook', 'instagram', 'other'
    )
  );

-- ---------------------------------------------------------------------------
-- Submission parent columns for creator-first workflow
-- ---------------------------------------------------------------------------
alter table public.media_submissions
  add column if not exists submission_type text;

alter table public.media_submissions
  add column if not exists existing_creator_id uuid references public.media_creators(id) on delete set null;

update public.media_submissions
set submission_type = 'new_creator'
where submission_type is null;

alter table public.media_submissions
  alter column submission_type set default 'new_creator';

alter table public.media_submissions
  drop constraint if exists media_submissions_submission_type_check;

alter table public.media_submissions
  add constraint media_submissions_submission_type_check
  check (submission_type in ('new_creator', 'add_links'));

alter table public.media_submissions
  alter column submission_type set not null;

-- Legacy single-URL columns remain for backward compatibility; new rows still populate
-- the first link into them so older admin UIs do not crash.

-- ---------------------------------------------------------------------------
-- Child link rows
-- ---------------------------------------------------------------------------
create table if not exists public.media_submission_links (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.media_submissions(id) on delete cascade,
  link_type text not null check (
    link_type in (
      'podcast', 'youtube', 'x_twitter', 'website', 'newsletter',
      'facebook', 'instagram', 'other'
    )
  ),
  url text not null,
  url_normalized text not null,
  label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists media_submission_links_submission_idx
  on public.media_submission_links (submission_id);
create index if not exists media_submission_links_url_norm_idx
  on public.media_submission_links (url_normalized);

alter table public.media_submission_links enable row level security;
revoke all on table public.media_submission_links from anon, authenticated;
grant select, insert, update, delete on table public.media_submission_links to authenticated;
grant all on table public.media_submission_links to service_role;

drop policy if exists media_submission_links_admin_all on public.media_submission_links;
create policy media_submission_links_admin_all on public.media_submission_links
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Backfill legacy single-URL submissions into child rows
insert into public.media_submission_links (
  submission_id, link_type, url, url_normalized, label, sort_order
)
select
  s.id,
  s.resource_type,
  s.submitted_url,
  s.submitted_url_normalized,
  null,
  0
from public.media_submissions s
where not exists (
  select 1 from public.media_submission_links l where l.submission_id = s.id
)
and s.submitted_url is not null
and length(trim(s.submitted_url)) > 0;

-- Prevent duplicate active URLs per creator
create unique index if not exists media_links_creator_url_uidx
  on public.media_links (creator_id, (public.normalize_media_url(url)))
  where is_active = true;

-- ---------------------------------------------------------------------------
-- Submit: creator + multiple links (jsonb payload)
-- ---------------------------------------------------------------------------
create or replace function public.submit_media_creator_submission(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := lower(trim(coalesce(p_payload->>'submission_type', '')));
  v_scope text := lower(trim(coalesce(p_payload->>'scope', '')));
  v_name text := trim(coalesce(p_payload->>'proposed_name', p_payload->>'submitted_name', ''));
  v_description text := nullif(trim(coalesce(p_payload->>'proposed_description', p_payload->>'description', '')), '');
  v_team_id text := nullif(trim(coalesce(p_payload->>'team_id', '')), '');
  v_team_name text := nullif(trim(coalesce(p_payload->>'team_name', '')), '');
  v_existing_creator_id uuid := nullif(trim(coalesce(p_payload->>'existing_creator_id', '')), '')::uuid;
  v_submitter_name text := nullif(trim(coalesce(p_payload->>'submitter_name', '')), '');
  v_submitter_email text := nullif(trim(coalesce(p_payload->>'submitter_email', '')), '');
  v_submitter_notes text := nullif(trim(coalesce(p_payload->>'submitter_notes', '')), '');
  v_links jsonb := coalesce(p_payload->'links', '[]'::jsonb);
  v_link jsonb;
  v_link_type text;
  v_url text;
  v_label text;
  v_norm text;
  v_id uuid;
  v_first_type text;
  v_first_url text;
  v_first_norm text;
  v_idx integer := 0;
  v_creator_name text;
  v_creator_scope text;
  v_seen text[];
begin
  if v_type not in ('new_creator', 'add_links') then
    raise exception 'submission_type must be new_creator or add_links';
  end if;

  if jsonb_typeof(v_links) <> 'array' or jsonb_array_length(v_links) < 1 then
    raise exception 'at least one link is required';
  end if;

  if v_type = 'new_creator' then
    if v_name is null or length(v_name) < 2 then
      raise exception 'creator or outlet name is required';
    end if;
    if v_scope not in ('national', 'team') then
      raise exception 'scope must be national or team';
    end if;
    if v_scope = 'team' and (v_team_name is null or length(v_team_name) < 2) then
      raise exception 'team_name is required for team-specific submissions';
    end if;
  else
    if v_existing_creator_id is null then
      raise exception 'existing_creator_id is required when adding links';
    end if;
    select c.name, c.scope, c.team_id, c.team_name
      into v_creator_name, v_creator_scope, v_team_id, v_team_name
    from public.media_creators c
    where c.id = v_existing_creator_id and c.status = 'active';
    if not found then
      raise exception 'existing creator not found';
    end if;
    v_name := v_creator_name;
    v_scope := v_creator_scope;
  end if;

  v_seen := array[]::text[];
  for v_link in select * from jsonb_array_elements(v_links)
  loop
    v_link_type := lower(trim(coalesce(v_link->>'link_type', v_link->>'resource_type', '')));
    v_url := trim(coalesce(v_link->>'url', ''));
    v_label := nullif(trim(coalesce(v_link->>'label', '')), '');

    if v_link_type not in (
      'podcast', 'youtube', 'x_twitter', 'website', 'newsletter', 'facebook', 'instagram', 'other'
    ) then
      raise exception 'invalid link_type';
    end if;
    if v_url is null or v_url !~* '^https?://' then
      raise exception 'each link must be a valid http(s) URL';
    end if;

    v_norm := public.normalize_media_url(v_url);
    if v_norm = any(v_seen) then
      raise exception 'duplicate_submission';
    end if;
    v_seen := array_append(v_seen, v_norm);

    if exists (
      select 1 from public.media_submission_links l
      join public.media_submissions s on s.id = l.submission_id
      where l.url_normalized = v_norm
        and s.status = 'pending'
    ) then
      raise exception 'duplicate_submission';
    end if;

    if v_type = 'add_links' and exists (
      select 1 from public.media_links ml
      where ml.creator_id = v_existing_creator_id
        and ml.is_active = true
        and public.normalize_media_url(ml.url) = v_norm
    ) then
      raise exception 'duplicate_submission';
    end if;

    if v_idx = 0 then
      v_first_type := v_link_type;
      v_first_url := v_url;
      v_first_norm := v_norm;
    end if;
    v_idx := v_idx + 1;
  end loop;

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
    status,
    submission_type,
    existing_creator_id
  ) values (
    v_name,
    v_scope,
    case when v_scope = 'team' then v_team_id else null end,
    case when v_scope = 'team' then v_team_name else null end,
    v_first_type,
    v_first_url,
    v_first_norm,
    v_description,
    v_submitter_name,
    v_submitter_email,
    v_submitter_notes,
    'pending',
    v_type,
    case when v_type = 'add_links' then v_existing_creator_id else null end
  )
  returning id into v_id;

  v_idx := 0;
  for v_link in select * from jsonb_array_elements(v_links)
  loop
    v_link_type := lower(trim(coalesce(v_link->>'link_type', v_link->>'resource_type', '')));
    v_url := trim(coalesce(v_link->>'url', ''));
    v_label := nullif(trim(coalesce(v_link->>'label', '')), '');
    v_norm := public.normalize_media_url(v_url);

    insert into public.media_submission_links (
      submission_id, link_type, url, url_normalized, label, sort_order
    ) values (
      v_id, v_link_type, v_url, v_norm, v_label, v_idx
    );
    v_idx := v_idx + 1;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.submit_media_creator_submission(jsonb) from public;
grant execute on function public.submit_media_creator_submission(jsonb)
  to anon, authenticated, service_role;

-- Keep legacy single-link RPC as a thin wrapper for compatibility
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
begin
  return public.submit_media_creator_submission(
    jsonb_build_object(
      'submission_type', 'new_creator',
      'proposed_name', p_submitted_name,
      'proposed_description', p_description,
      'scope', p_scope,
      'team_id', p_team_id,
      'team_name', p_team_name,
      'submitter_name', p_submitter_name,
      'submitter_email', p_submitter_email,
      'submitter_notes', p_submitter_notes,
      'links', jsonb_build_array(
        jsonb_build_object(
          'link_type', p_resource_type,
          'url', p_submitted_url
        )
      )
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: get submission with links (legacy-safe)
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_media_submission(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.media_submissions;
  v_links jsonb;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_sub from public.media_submissions where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'link_type', l.link_type,
        'url', l.url,
        'label', l.label,
        'sort_order', l.sort_order
      )
      order by l.sort_order, l.created_at
    ),
    '[]'::jsonb
  )
  into v_links
  from public.media_submission_links l
  where l.submission_id = p_id;

  if v_links = '[]'::jsonb and v_sub.submitted_url is not null then
    v_links := jsonb_build_array(
      jsonb_build_object(
        'id', null,
        'link_type', v_sub.resource_type,
        'url', v_sub.submitted_url,
        'label', null,
        'sort_order', 0
      )
    );
  end if;

  return jsonb_build_object(
    'submission', to_jsonb(v_sub),
    'links', v_links
  );
end;
$$;

revoke all on function public.admin_get_media_submission(uuid) from public;
grant execute on function public.admin_get_media_submission(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin approve: create creator or attach links; skip exact URL duplicates
-- ---------------------------------------------------------------------------
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
  v_link record;
  v_has_child boolean := false;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_sub from public.media_submissions where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  select exists (
    select 1 from public.media_submission_links where submission_id = p_id
  ) into v_has_child;

  if v_sub.submission_type = 'add_links' then
    v_creator_id := v_sub.existing_creator_id;
    if v_creator_id is null then
      raise exception 'existing_creator_id is required';
    end if;
    if not exists (
      select 1 from public.media_creators where id = v_creator_id
    ) then
      raise exception 'existing creator not found';
    end if;

    update public.media_creators
    set status = 'active', updated_at = now()
    where id = v_creator_id;
  elsif v_sub.published_creator_id is not null then
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
  else
    v_base_slug := public.slugify_media_name(v_sub.submitted_name);
    v_slug := v_base_slug;
    while exists (select 1 from public.media_creators where slug = v_slug) loop
      v_suffix := v_suffix + 1;
      v_slug := v_base_slug || '-' || v_suffix::text;
    end loop;

    insert into public.media_creators (
      name, slug, description, scope, team_id, team_name, status, featured, source_submission_id
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
  end if;

  if v_has_child then
    for v_link in
      select * from public.media_submission_links
      where submission_id = p_id
      order by sort_order, created_at
    loop
      if exists (
        select 1 from public.media_links ml
        where ml.creator_id = v_creator_id
          and ml.is_active = true
          and public.normalize_media_url(ml.url) = v_link.url_normalized
      ) then
        continue;
      end if;

      insert into public.media_links (
        creator_id, resource_type, label, url, sort_order, is_active
      ) values (
        v_creator_id,
        v_link.link_type,
        v_link.label,
        v_link.url,
        v_link.sort_order,
        true
      );
    end loop;
  else
    if not exists (
      select 1 from public.media_links ml
      where ml.creator_id = v_creator_id
        and ml.is_active = true
        and public.normalize_media_url(ml.url) = v_sub.submitted_url_normalized
    ) then
      insert into public.media_links (
        creator_id, resource_type, label, url, sort_order, is_active
      ) values (
        v_creator_id,
        v_sub.resource_type,
        v_sub.submitted_name,
        v_sub.submitted_url,
        0,
        true
      );
    end if;
  end if;

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
    existing_creator_id = coalesce(existing_creator_id, v_creator_id),
    updated_at = now()
  where id = p_id
  returning * into v_sub;

  return v_sub;
end;
$$;

-- Public searchable creator list for "add links" selector (active only, no emails)
create or replace function public.list_public_media_creator_options(p_search text default null)
returns table (
  id uuid,
  name text,
  scope text,
  team_name text,
  description text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.scope, c.team_name, c.description
  from public.media_creators c
  where c.status = 'active'
    and (
      p_search is null
      or length(trim(p_search)) = 0
      or c.name ilike '%' || trim(p_search) || '%'
      or coalesce(c.team_name, '') ilike '%' || trim(p_search) || '%'
    )
  order by c.name asc
  limit 50;
$$;

revoke all on function public.list_public_media_creator_options(text) from public;
grant execute on function public.list_public_media_creator_options(text)
  to anon, authenticated, service_role;
