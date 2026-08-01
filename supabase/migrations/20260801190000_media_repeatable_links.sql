-- Repeatable media links (normalized child tables) + admin Reports apply/reject.
-- Idempotent. Leaves legacy platform_links / scalar URL columns intact.
-- Apply with: supabase db push

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.media_source_links (
  id uuid primary key default gen_random_uuid(),
  media_source_id uuid not null references public.media_sources(id) on delete cascade,
  platform text not null check (
    platform in (
      'website', 'spotify', 'apple', 'youtube', 'x',
      'facebook', 'instagram', 'rss', 'other'
    )
  ),
  label text,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_source_links_url_http check (url ~* '^https?://')
);

create table if not exists public.media_suggestion_links (
  id uuid primary key default gen_random_uuid(),
  media_suggestion_id uuid not null references public.media_suggestions(id) on delete cascade,
  platform text not null check (
    platform in (
      'website', 'spotify', 'apple', 'youtube', 'x',
      'facebook', 'instagram', 'rss', 'other'
    )
  ),
  label text,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_suggestion_links_url_http check (url ~* '^https?://')
);

create index if not exists media_source_links_source_idx
  on public.media_source_links (media_source_id, sort_order);
create index if not exists media_suggestion_links_suggestion_idx
  on public.media_suggestion_links (media_suggestion_id, sort_order);

create unique index if not exists media_source_links_unique_url_idx
  on public.media_source_links (
    media_source_id,
    lower(regexp_replace(trim(url), '/+$', ''))
  );

create unique index if not exists media_suggestion_links_unique_url_idx
  on public.media_suggestion_links (
    media_suggestion_id,
    lower(regexp_replace(trim(url), '/+$', ''))
  );

drop trigger if exists media_source_links_set_updated_at on public.media_source_links;
create trigger media_source_links_set_updated_at
  before update on public.media_source_links
  for each row execute function public.set_updated_at();

drop trigger if exists media_suggestion_links_set_updated_at on public.media_suggestion_links;
create trigger media_suggestion_links_set_updated_at
  before update on public.media_suggestion_links
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.media_source_links enable row level security;
alter table public.media_suggestion_links enable row level security;

revoke all on table public.media_source_links from anon, authenticated;
revoke all on table public.media_suggestion_links from anon, authenticated;

grant select on table public.media_source_links to anon, authenticated;
grant select, insert, update, delete on table public.media_source_links to authenticated;
grant all on table public.media_source_links to service_role;

grant select, insert, update, delete on table public.media_suggestion_links to authenticated;
grant all on table public.media_suggestion_links to service_role;

drop policy if exists media_source_links_public_select on public.media_source_links;
create policy media_source_links_public_select on public.media_source_links
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.media_sources s
      where s.id = media_source_id
        and (
          (s.is_approved = true and coalesce(s.is_active, true) = true)
          or public.is_app_admin()
        )
    )
  );

drop policy if exists media_source_links_admin_write on public.media_source_links;
create policy media_source_links_admin_write on public.media_source_links
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists media_suggestion_links_admin_all on public.media_suggestion_links;
create policy media_suggestion_links_admin_all on public.media_suggestion_links
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.media_normalize_link_url_key(p_url text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(p_url, '')), '/+$', ''));
$$;

create or replace function public.media_links_json_to_rows(p_links jsonb)
returns table (
  platform text,
  label text,
  url text,
  sort_order integer
)
language plpgsql
immutable
as $$
declare
  v_item jsonb;
  v_idx integer := 0;
  v_platform text;
  v_url text;
  v_label text;
  v_seen text[] := '{}';
  v_key text;
begin
  if p_links is null or jsonb_typeof(p_links) <> 'array' then
    return;
  end if;

  for v_item in select value from jsonb_array_elements(p_links)
  loop
    v_platform := lower(trim(coalesce(v_item ->> 'platform', '')));
    v_url := trim(coalesce(v_item ->> 'url', ''));
    v_label := nullif(trim(coalesce(v_item ->> 'label', '')), '');
    if v_platform = '' and v_url = '' and v_label is null then
      continue;
    end if;
    if v_platform not in (
      'website', 'spotify', 'apple', 'youtube', 'x',
      'facebook', 'instagram', 'rss', 'other'
    ) then
      raise exception 'invalid_platform';
    end if;
    if v_url is null or v_url !~* '^https?://' then
      raise exception 'invalid_link_url';
    end if;
    v_key := public.media_normalize_link_url_key(v_url);
    if v_key = any (v_seen) then
      raise exception 'duplicate_link_url';
    end if;
    v_seen := array_append(v_seen, v_key);
    platform := v_platform;
    label := v_label;
    url := v_url;
    sort_order := coalesce((v_item ->> 'sort_order')::integer, v_idx);
    v_idx := v_idx + 1;
    return next;
  end loop;
end;
$$;

create or replace function public.media_platform_links_object_to_rows(p_links jsonb)
returns table (
  platform text,
  label text,
  url text,
  sort_order integer
)
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
  v_idx integer := 0;
begin
  if p_links is null or jsonb_typeof(p_links) <> 'object' then
    return;
  end if;
  foreach v_key in array v_keys loop
    v_url := nullif(trim(coalesce(p_links ->> v_key, '')), '');
    if v_url is null then
      continue;
    end if;
    if v_url !~* '^https?://' then
      continue;
    end if;
    platform := v_key;
    label := null;
    url := v_url;
    sort_order := v_idx;
    v_idx := v_idx + 1;
    return next;
  end loop;
end;
$$;

create or replace function public.media_rows_to_platform_links_object(
  p_rows jsonb
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_out jsonb := '{}'::jsonb;
  v_row record;
begin
  for v_row in
    select * from public.media_links_json_to_rows(p_rows)
    order by sort_order
  loop
    if not (v_out ? v_row.platform) then
      v_out := v_out || jsonb_build_object(v_row.platform, v_row.url);
    end if;
  end loop;
  return v_out;
exception
  when others then
    return '{}'::jsonb;
end;
$$;

create or replace function public.media_replace_suggestion_links(
  p_suggestion_id uuid,
  p_links jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
  v_object jsonb;
begin
  delete from public.media_suggestion_links where media_suggestion_id = p_suggestion_id;

  for v_row in
    select * from public.media_links_json_to_rows(p_links)
    order by sort_order
  loop
    insert into public.media_suggestion_links (
      media_suggestion_id, platform, label, url, sort_order
    ) values (
      p_suggestion_id, v_row.platform, v_row.label, v_row.url, v_count
    );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'platform_links_required';
  end if;

  v_object := public.media_rows_to_platform_links_object(p_links);
  update public.media_suggestions
  set
    platform_links = v_object,
    provider = coalesce(
      (
        select platform from public.media_suggestion_links
        where media_suggestion_id = p_suggestion_id
        order by sort_order
        limit 1
      ),
      provider
    ),
    submitted_url = coalesce(
      (
        select url from public.media_suggestion_links
        where media_suggestion_id = p_suggestion_id
        order by sort_order
        limit 1
      ),
      submitted_url
    )
  where id = p_suggestion_id;

  return v_count;
end;
$$;

create or replace function public.media_replace_source_links(
  p_source_id uuid,
  p_links jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
  v_object jsonb;
  v_scalars record;
begin
  delete from public.media_source_links where media_source_id = p_source_id;

  for v_row in
    select * from public.media_links_json_to_rows(p_links)
    order by sort_order
  loop
    insert into public.media_source_links (
      media_source_id, platform, label, url, sort_order
    ) values (
      p_source_id, v_row.platform, v_row.label, v_row.url, v_count
    );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'platform_links_required';
  end if;

  v_object := public.media_rows_to_platform_links_object(p_links);
  select * into v_scalars from public.media_platform_links_to_scalars(v_object);

  update public.media_sources
  set
    platform_links = v_object,
    website_url = v_scalars.website_url,
    spotify_url = v_scalars.spotify_url,
    youtube_url = v_scalars.youtube_url,
    x_url = v_scalars.x_url,
    apple_podcast_url = v_scalars.apple_podcast_url,
    updated_at = now()
  where id = p_source_id;

  return v_count;
end;
$$;

create or replace function public.media_suggestion_links_as_json(p_suggestion_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'platform', l.platform,
        'label', l.label,
        'url', l.url,
        'sortOrder', l.sort_order
      )
      order by l.sort_order, l.created_at
    ),
    '[]'::jsonb
  )
  from public.media_suggestion_links l
  where l.media_suggestion_id = p_suggestion_id;
$$;

create or replace function public.media_source_links_as_json(p_source_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'platform', l.platform,
        'label', l.label,
        'url', l.url,
        'sortOrder', l.sort_order
      )
      order by l.sort_order, l.created_at
    ),
    '[]'::jsonb
  )
  from public.media_source_links l
  where l.media_source_id = p_source_id;
$$;

-- ---------------------------------------------------------------------------
-- Idempotent data migration from legacy fields
-- ---------------------------------------------------------------------------
do $$
declare
  v_source record;
  v_sug record;
  v_row record;
  v_order integer;
  v_skipped integer := 0;
begin
  for v_source in select * from public.media_sources
  loop
    if exists (
      select 1 from public.media_source_links where media_source_id = v_source.id
    ) then
      continue;
    end if;

    v_order := 0;
    -- Prefer jsonb platform_links, else scalar columns.
    if v_source.platform_links is not null
       and v_source.platform_links <> '{}'::jsonb then
      for v_row in
        select * from public.media_platform_links_object_to_rows(v_source.platform_links)
        order by sort_order
      loop
        begin
          insert into public.media_source_links (
            media_source_id, platform, label, url, sort_order
          ) values (
            v_source.id, v_row.platform, null, v_row.url, v_order
          );
          v_order := v_order + 1;
        exception
          when unique_violation then
            v_skipped := v_skipped + 1;
          when check_violation then
            raise notice 'media_source_links skip invalid url source=% url=%', v_source.id, v_row.url;
            v_skipped := v_skipped + 1;
        end;
      end loop;
    else
      if nullif(trim(coalesce(v_source.website_url, '')), '') is not null then
        begin
          insert into public.media_source_links (media_source_id, platform, url, sort_order)
          values (v_source.id, 'website', trim(v_source.website_url), v_order);
          v_order := v_order + 1;
        exception when others then v_skipped := v_skipped + 1;
        end;
      end if;
      if nullif(trim(coalesce(v_source.spotify_url, '')), '') is not null then
        begin
          insert into public.media_source_links (media_source_id, platform, url, sort_order)
          values (v_source.id, 'spotify', trim(v_source.spotify_url), v_order);
          v_order := v_order + 1;
        exception when others then v_skipped := v_skipped + 1;
        end;
      end if;
      if nullif(trim(coalesce(v_source.apple_podcast_url, '')), '') is not null then
        begin
          insert into public.media_source_links (media_source_id, platform, url, sort_order)
          values (v_source.id, 'apple', trim(v_source.apple_podcast_url), v_order);
          v_order := v_order + 1;
        exception when others then v_skipped := v_skipped + 1;
        end;
      end if;
      if nullif(trim(coalesce(v_source.youtube_url, '')), '') is not null then
        begin
          insert into public.media_source_links (media_source_id, platform, url, sort_order)
          values (v_source.id, 'youtube', trim(v_source.youtube_url), v_order);
          v_order := v_order + 1;
        exception when others then v_skipped := v_skipped + 1;
        end;
      end if;
      if nullif(trim(coalesce(v_source.x_url, '')), '') is not null then
        begin
          insert into public.media_source_links (media_source_id, platform, url, sort_order)
          values (v_source.id, 'x', trim(v_source.x_url), v_order);
          v_order := v_order + 1;
        exception when others then v_skipped := v_skipped + 1;
        end;
      end if;
    end if;
  end loop;

  for v_sug in select * from public.media_suggestions
  loop
    if exists (
      select 1 from public.media_suggestion_links where media_suggestion_id = v_sug.id
    ) then
      continue;
    end if;

    v_order := 0;
    if v_sug.platform_links is not null and v_sug.platform_links <> '{}'::jsonb then
      for v_row in
        select * from public.media_platform_links_object_to_rows(v_sug.platform_links)
        order by sort_order
      loop
        begin
          insert into public.media_suggestion_links (
            media_suggestion_id, platform, label, url, sort_order
          ) values (
            v_sug.id, v_row.platform, null, v_row.url, v_order
          );
          v_order := v_order + 1;
        exception
          when unique_violation then v_skipped := v_skipped + 1;
          when check_violation then
            raise notice 'media_suggestion_links skip invalid url suggestion=% url=%', v_sug.id, v_row.url;
            v_skipped := v_skipped + 1;
        end;
      end loop;
    elsif nullif(trim(coalesce(v_sug.submitted_url, '')), '') is not null
          and nullif(trim(coalesce(v_sug.provider, '')), '') is not null then
      begin
        insert into public.media_suggestion_links (
          media_suggestion_id, platform, url, sort_order
        ) values (
          v_sug.id,
          case
            when lower(v_sug.provider) in (
              'website', 'spotify', 'apple', 'youtube', 'x',
              'facebook', 'instagram', 'rss', 'other'
            ) then lower(v_sug.provider)
            else 'other'
          end,
          trim(v_sug.submitted_url),
          0
        );
      exception when others then
        raise notice 'media_suggestion_links skip legacy suggestion=%', v_sug.id;
        v_skipped := v_skipped + 1;
      end;
    end if;
  end loop;

  raise notice 'media_repeatable_links migration skipped_or_duplicate_rows=%', v_skipped;
end $$;

-- ---------------------------------------------------------------------------
-- Submit RPC — accepts p_links array; keeps p_platform_links for compat
-- ---------------------------------------------------------------------------
drop function if exists public.submit_media_suggestion(
  text, jsonb, boolean, text[], text[], jsonb, text, text
);

create or replace function public.submit_media_suggestion(
  p_name text,
  p_links jsonb default '[]'::jsonb,
  p_is_national boolean default false,
  p_conference_ids text[] default '{}',
  p_team_ids text[] default '{}',
  p_coverage_labels jsonb default '{}'::jsonb,
  p_submitter_email text default null,
  p_notes text default null,
  p_platform_links jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_email text := lower(trim(coalesce(p_submitter_email, '')));
  v_links jsonb := coalesce(p_links, '[]'::jsonb);
  v_object jsonb := '{}'::jsonb;
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
  v_scope text;
  v_primary_platform text;
  v_primary_url text;
  v_row record;
  v_idx integer := 0;
begin
  if v_name is null then
    raise exception 'name_required';
  end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'submitter_email_required';
  end if;

  -- Compat: object platform_links → array rows when p_links empty.
  if (jsonb_typeof(v_links) <> 'array' or jsonb_array_length(v_links) = 0)
     and p_platform_links is not null
     and jsonb_typeof(p_platform_links) = 'object' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'platform', r.platform,
          'label', null,
          'url', r.url,
          'sort_order', r.sort_order
        )
        order by r.sort_order
      ),
      '[]'::jsonb
    )
    into v_links
    from public.media_platform_links_object_to_rows(p_platform_links) r;
  end if;

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
  v_object := public.media_rows_to_platform_links_object(v_links);

  select r.platform, r.url
  into v_primary_platform, v_primary_url
  from public.media_links_json_to_rows(v_links) r
  order by r.sort_order
  limit 1;

  if v_primary_url is null then
    raise exception 'platform_links_required';
  end if;

  insert into public.media_suggestions (
    name,
    provider,
    submitted_url,
    platform_links,
    scope,
    is_national,
    conference_id,
    team_id,
    notes,
    status,
    submitter_email,
    coverage_labels,
    submitted_by
  ) values (
    v_name,
    coalesce(v_primary_platform, 'multi'),
    v_primary_url,
    v_object,
    v_scope,
    coalesce(p_is_national, false),
    case when coalesce(cardinality(v_conf_ids), 0) > 0 then v_conf_ids[1] else null end,
    case when coalesce(cardinality(v_team_ids), 0) > 0 then v_team_ids[1] else null end,
    nullif(trim(coalesce(p_notes, '')), ''),
    'pending',
    v_email,
    coalesce(p_coverage_labels, '{}'::jsonb),
    auth.uid()
  )
  returning id into v_id;

  v_idx := 0;
  for v_row in
    select * from public.media_links_json_to_rows(v_links)
    order by sort_order
  loop
    insert into public.media_suggestion_links (
      media_suggestion_id, platform, label, url, sort_order
    ) values (
      v_id, v_row.platform, v_row.label, v_row.url, v_idx
    );
    v_idx := v_idx + 1;
  end loop;

  if coalesce(cardinality(v_team_ids), 0) > 0 then
    insert into public.media_suggestion_teams (media_suggestion_id, team_id)
    select v_id, t from unnest(v_team_ids) as t
    on conflict do nothing;
  end if;
  if coalesce(cardinality(v_conf_ids), 0) > 0 then
    insert into public.media_suggestion_conferences (media_suggestion_id, conference_id)
    select v_id, c from unnest(v_conf_ids) as c
    on conflict do nothing;
  end if;

  return v_id;
end;
$$;

revoke all on function public.submit_media_suggestion(
  text, jsonb, boolean, text[], text[], jsonb, text, text, jsonb
) from public;
grant execute on function public.submit_media_suggestion(
  text, jsonb, boolean, text[], text[], jsonb, text, text, jsonb
) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public list includes links array
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
  conference_ids text[],
  links jsonb
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
    ) as conference_ids,
    public.media_source_links_as_json(s.id) as links
  from public.media_sources s
  where s.is_approved = true
    and coalesce(s.is_active, true) = true
  order by s.display_order asc, s.name asc;
$$;

revoke all on function public.list_approved_media_sources() from public;
grant execute on function public.list_approved_media_sources()
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admin suggestion draft / get / approve — use link rows
-- ---------------------------------------------------------------------------
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
    'links', public.media_suggestion_links_as_json(s.id),
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

create or replace function public.admin_update_media_suggestion_draft(
  p_id uuid,
  p_name text,
  p_description text default null,
  p_logo_url text default null,
  p_links jsonb default null,
  p_is_national boolean default null,
  p_team_ids text[] default null,
  p_conference_ids text[] default null,
  p_notes text default null,
  p_coverage_labels jsonb default null,
  p_platform_links jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.media_suggestions;
  v_name text;
  v_logo text;
  v_links jsonb;
  v_team text;
  v_conf text;
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
  v_scope text;
  v_link_count integer;
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

  v_logo := nullif(trim(coalesce(p_logo_url, '')), '');
  if v_logo is not null and v_logo !~* '^https?://' then
    raise exception 'invalid_logo_url';
  end if;

  if p_links is not null then
    v_links := p_links;
  elsif p_platform_links is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'platform', r.platform,
          'url', r.url,
          'sort_order', r.sort_order
        )
        order by r.sort_order
      ),
      '[]'::jsonb
    )
    into v_links
    from public.media_platform_links_object_to_rows(p_platform_links) r;
  else
    v_links := public.media_suggestion_links_as_json(p_id);
  end if;

  -- Normalize sortOrder → sort_order for helper
  v_links := coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'platform', e ->> 'platform',
          'label', e ->> 'label',
          'url', e ->> 'url',
          'sort_order', coalesce(
            (e ->> 'sort_order')::integer,
            (e ->> 'sortOrder')::integer,
            ord - 1
          )
        )
        order by ord
      )
      from jsonb_array_elements(v_links) with ordinality as t(e, ord)
    ),
    '[]'::jsonb
  );

  v_link_count := public.media_replace_suggestion_links(p_id, v_links);

  select coalesce(array_agg(distinct trim(x)), '{}')
  into v_team_ids
  from unnest(coalesce(p_team_ids, '{}')) as x
  where length(trim(x)) > 0;

  select coalesce(array_agg(distinct trim(x)), '{}')
  into v_conf_ids
  from unnest(coalesce(p_conference_ids, '{}')) as x
  where length(trim(x)) > 0;

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
    format('Saved draft changes (%s links)', v_link_count),
    jsonb_build_object(
      'name', v_name,
      'linkCount', v_link_count,
      'isNational', coalesce(p_is_national, v_row.is_national, false),
      'teamIds', to_jsonb(v_team_ids),
      'conferenceIds', to_jsonb(v_conf_ids)
    )
  );

  return public.admin_get_media_suggestion_detail(p_id);
end;
$$;

drop function if exists public.admin_update_media_suggestion_draft(
  uuid, text, text, text, jsonb, boolean, text[], text[], text, jsonb
);

revoke all on function public.admin_update_media_suggestion_draft(
  uuid, text, text, text, jsonb, boolean, text[], text[], text, jsonb, jsonb
) from public;
grant execute on function public.admin_update_media_suggestion_draft(
  uuid, text, text, text, jsonb, boolean, text[], text[], text, jsonb, jsonb
) to authenticated;

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
  v_name text;
  v_links jsonb;
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
  v_mode text;
  v_link_count integer;
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

  v_links := public.media_suggestion_links_as_json(p_id);
  -- remap sortOrder keys for helper
  v_links := coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'platform', e ->> 'platform',
          'label', e ->> 'label',
          'url', e ->> 'url',
          'sort_order', coalesce((e ->> 'sortOrder')::integer, (e ->> 'sort_order')::integer, ord - 1)
        )
        order by ord
      )
      from jsonb_array_elements(v_links) with ordinality as t(e, ord)
    ),
    '[]'::jsonb
  );

  if jsonb_array_length(v_links) = 0 then
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
      is_approved,
      is_active,
      display_order
    ) values (
      v_name,
      v_sug.description,
      v_sug.logo_url,
      'national',
      coalesce(v_sug.is_national, false),
      '{}'::jsonb,
      true,
      true,
      100
    )
    returning id into v_source_id;
  end if;

  v_link_count := public.media_replace_source_links(v_source_id, v_links);
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
    format('Approved and published (%s, %s links)', v_mode, v_link_count),
    jsonb_build_object(
      'mediaSourceId', v_source_id,
      'mode', v_mode,
      'name', v_name,
      'linkCount', v_link_count
    ),
    v_source_id
  );

  return jsonb_build_object(
    'ok', true,
    'suggestionId', p_id,
    'mediaSourceId', v_source_id,
    'mode', v_mode,
    'status', 'approved',
    'linkCount', v_link_count
  );
end;
$$;

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
    'links', public.media_source_links_as_json(s.id),
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

create or replace function public.admin_upsert_media_source(
  p_id uuid default null,
  p_name text default null,
  p_description text default null,
  p_logo_url text default null,
  p_links jsonb default null,
  p_is_national boolean default false,
  p_team_ids text[] default '{}',
  p_conference_ids text[] default '{}',
  p_is_active boolean default true,
  p_is_approved boolean default true,
  p_platform_links jsonb default null
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
  v_action text;
  v_link_count integer;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;
  if v_name is null then
    raise exception 'name_required';
  end if;

  if p_links is not null then
    v_links := p_links;
  elsif p_platform_links is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'platform', r.platform,
          'url', r.url,
          'sort_order', r.sort_order
        )
        order by r.sort_order
      ),
      '[]'::jsonb
    )
    into v_links
    from public.media_platform_links_object_to_rows(p_platform_links) r;
  else
    raise exception 'platform_links_required';
  end if;

  v_links := coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'platform', e ->> 'platform',
          'label', e ->> 'label',
          'url', e ->> 'url',
          'sort_order', coalesce(
            (e ->> 'sort_order')::integer,
            (e ->> 'sortOrder')::integer,
            ord - 1
          )
        )
        order by ord
      )
      from jsonb_array_elements(v_links) with ordinality as t(e, ord)
    ),
    '[]'::jsonb
  );

  v_logo := nullif(trim(coalesce(p_logo_url, '')), '');
  if v_logo is not null and v_logo !~* '^https?://' then
    raise exception 'invalid_logo_url';
  end if;

  if p_id is null then
    v_action := 'source_created';
    insert into public.media_sources (
      name,
      description,
      logo_url,
      scope,
      is_national,
      platform_links,
      is_approved,
      is_active
    ) values (
      v_name,
      nullif(trim(coalesce(p_description, '')), ''),
      v_logo,
      'national',
      coalesce(p_is_national, false),
      '{}'::jsonb,
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
      is_approved = coalesce(p_is_approved, is_approved),
      is_active = coalesce(p_is_active, is_active),
      updated_at = now()
    where id = v_id;
  end if;

  v_link_count := public.media_replace_source_links(v_id, v_links);
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
    case when p_id is null then format('Created media source (%s links)', v_link_count)
         else format('Updated media source (%s links)', v_link_count) end,
    jsonb_build_object(
      'name', v_name,
      'linkCount', v_link_count,
      'isNational', coalesce(p_is_national, false),
      'isActive', coalesce(p_is_active, true),
      'teamIds', to_jsonb(coalesce(p_team_ids, '{}')),
      'conferenceIds', to_jsonb(coalesce(p_conference_ids, '{}'))
    )
  );

  return public.admin_get_media_source_detail(v_id);
end;
$$;

drop function if exists public.admin_upsert_media_source(
  uuid, text, text, text, jsonb, boolean, text[], text[], boolean, boolean
);

revoke all on function public.admin_upsert_media_source(
  uuid, text, text, text, jsonb, boolean, text[], text[], boolean, boolean, jsonb
) from public;
grant execute on function public.admin_upsert_media_source(
  uuid, text, text, text, jsonb, boolean, text[], text[], boolean, boolean, jsonb
) to authenticated;

-- Queue platformCount from child table
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
            from public.media_suggestion_links l
            where l.media_suggestion_id = s.id
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

-- ---------------------------------------------------------------------------
-- Reports: list detail + apply / reject
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
          'creatorName', s.name,
          'correctionType', c.correction_type,
          'details', c.details,
          'submitterEmail', c.submitter_email,
          'status', c.status,
          'createdAt', c.created_at,
          'proposedSummary', left(coalesce(c.proposed_changes::text, ''), 180)
        )
        order by c.created_at desc
      )
      from public.media_correction_suggestions c
      left join public.media_sources s on s.id = c.media_source_id
      where (p_status is null or c.status = p_status)
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.admin_get_media_correction_detail(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.media_correction_suggestions;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;
  select * into c from public.media_correction_suggestions where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;

  return jsonb_build_object(
    'id', c.id,
    'mediaSourceId', c.media_source_id,
    'correctionType', c.correction_type,
    'proposedChanges', coalesce(c.proposed_changes, '{}'::jsonb),
    'details', c.details,
    'submitterEmail', c.submitter_email,
    'status', c.status,
    'adminNotes', c.admin_notes,
    'createdAt', c.created_at,
    'reviewedAt', c.reviewed_at,
    'source', case
      when c.media_source_id is null then null
      else public.admin_get_media_source_detail(c.media_source_id)
    end
  );
end;
$$;

revoke all on function public.admin_get_media_correction_detail(uuid) from public;
grant execute on function public.admin_get_media_correction_detail(uuid) to authenticated;

create or replace function public.admin_apply_media_correction(
  p_id uuid,
  p_links jsonb default null,
  p_is_national boolean default null,
  p_team_ids text[] default null,
  p_conference_ids text[] default null,
  p_name text default null,
  p_description text default null,
  p_logo_url text default null,
  p_is_active boolean default null,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.media_correction_suggestions;
  v_source public.media_sources;
  v_links jsonb;
  v_link_count integer;
  v_proposed jsonb;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  select * into c from public.media_correction_suggestions where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if c.status <> 'pending' then
    raise exception 'already_reviewed';
  end if;
  if c.media_source_id is null then
    raise exception 'source_not_found';
  end if;

  select * into v_source from public.media_sources where id = c.media_source_id for update;
  if not found then
    raise exception 'source_not_found';
  end if;

  v_proposed := coalesce(c.proposed_changes, '{}'::jsonb);

  if p_links is not null then
    v_links := p_links;
  elsif v_proposed ? 'links' then
    v_links := v_proposed -> 'links';
  else
    v_links := public.media_source_links_as_json(v_source.id);
  end if;

  v_links := coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'platform', e ->> 'platform',
          'label', e ->> 'label',
          'url', e ->> 'url',
          'sort_order', coalesce(
            (e ->> 'sort_order')::integer,
            (e ->> 'sortOrder')::integer,
            ord - 1
          )
        )
        order by ord
      )
      from jsonb_array_elements(v_links) with ordinality as t(e, ord)
    ),
    '[]'::jsonb
  );

  update public.media_sources
  set
    name = coalesce(nullif(trim(coalesce(p_name, v_proposed ->> 'name', '')), ''), name),
    description = case
      when p_description is not null then nullif(trim(p_description), '')
      when v_proposed ? 'description' then nullif(trim(v_proposed ->> 'description'), '')
      else description
    end,
    logo_url = case
      when p_logo_url is not null then nullif(trim(p_logo_url), '')
      when v_proposed ? 'logoUrl' then nullif(trim(v_proposed ->> 'logoUrl'), '')
      else logo_url
    end,
    is_active = coalesce(
      p_is_active,
      (v_proposed ->> 'isActive')::boolean,
      is_active
    ),
    updated_at = now()
  where id = v_source.id;

  v_link_count := public.media_replace_source_links(v_source.id, v_links);

  perform public.media_replace_source_coverage(
    v_source.id,
    coalesce(
      p_is_national,
      (v_proposed ->> 'isNational')::boolean,
      v_source.is_national,
      false
    ),
    coalesce(
      p_team_ids,
      (
        select array_agg(x)
        from jsonb_array_elements_text(coalesce(v_proposed -> 'teamIds', 'null'::jsonb)) as x
      ),
      (
        select array_agg(t.team_id)
        from public.media_source_teams t
        where t.media_source_id = v_source.id
      ),
      '{}'
    ),
    coalesce(
      p_conference_ids,
      (
        select array_agg(x)
        from jsonb_array_elements_text(coalesce(v_proposed -> 'conferenceIds', 'null'::jsonb)) as x
      ),
      (
        select array_agg(c2.conference_id)
        from public.media_source_conferences c2
        where c2.media_source_id = v_source.id
      ),
      '{}'
    )
  );

  update public.media_correction_suggestions
  set
    status = 'applied',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), '')
  where id = p_id;

  perform public.media_admin_write_audit(
    'correction_applied',
    'correction',
    p_id,
    format('Applied correction (%s links)', v_link_count),
    jsonb_build_object(
      'mediaSourceId', v_source.id,
      'correctionType', c.correction_type,
      'linkCount', v_link_count
    ),
    v_source.id
  );

  return jsonb_build_object(
    'ok', true,
    'status', 'applied',
    'mediaSourceId', v_source.id,
    'linkCount', v_link_count
  );
end;
$$;

revoke all on function public.admin_apply_media_correction(
  uuid, jsonb, boolean, text[], text[], text, text, text, boolean, text
) from public;
grant execute on function public.admin_apply_media_correction(
  uuid, jsonb, boolean, text[], text[], text, text, text, boolean, text
) to authenticated;

create or replace function public.admin_reject_media_correction(
  p_id uuid,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.media_correction_suggestions;
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  select * into c from public.media_correction_suggestions where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if c.status <> 'pending' then
    raise exception 'already_reviewed';
  end if;

  update public.media_correction_suggestions
  set
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), '')
  where id = p_id;

  perform public.media_admin_write_audit(
    'correction_rejected',
    'correction',
    p_id,
    'Rejected correction report',
    jsonb_build_object('correctionType', c.correction_type)
  );

  return jsonb_build_object('ok', true, 'status', 'rejected');
end;
$$;

revoke all on function public.admin_reject_media_correction(uuid, text) from public;
grant execute on function public.admin_reject_media_correction(uuid, text) to authenticated;
