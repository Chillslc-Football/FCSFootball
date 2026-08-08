-- Phase 2: per-link coverage write paths (authoritative) + parent union cache.
-- Additive / replace-function only. Does not change Phase 1 schema migration.
-- Does not change mobile UI. Discovery continues to read parent coverage fields.
-- Apply with: supabase db push

-- ===========================================================================
-- Helpers
-- ===========================================================================

create or replace function public.media_json_text_ids(p_value jsonb)
returns text[]
language sql
immutable
as $$
  select case
    when p_value is null or jsonb_typeof(p_value) <> 'array' then '{}'::text[]
    else coalesce(
      (
        select array_agg(distinct trimmed order by trimmed)
        from (
          select trim(value) as trimmed
          from jsonb_array_elements_text(p_value) as value
          where length(trim(value)) > 0
        ) q
      ),
      '{}'::text[]
    )
  end;
$$;

create or replace function public.media_link_coverage_is_nonempty(
  p_is_national boolean,
  p_team_ids text[],
  p_conference_ids text[]
)
returns boolean
language sql
immutable
as $$
  select coalesce(p_is_national, false)
    or coalesce(cardinality(p_team_ids), 0) > 0
    or coalesce(cardinality(p_conference_ids), 0) > 0;
$$;

create or replace function public.media_link_json_has_nonempty_coverage(p_item jsonb)
returns boolean
language sql
immutable
as $$
  select public.media_link_coverage_is_nonempty(
    coalesce(
      (p_item ->> 'is_national')::boolean,
      (p_item ->> 'isNational')::boolean,
      false
    ),
    public.media_json_text_ids(coalesce(p_item -> 'team_ids', p_item -> 'teamIds')),
    public.media_json_text_ids(
      coalesce(p_item -> 'conference_ids', p_item -> 'conferenceIds')
    )
  );
$$;

create or replace function public.media_links_json_any_has_nonempty_coverage(p_links jsonb)
returns boolean
language sql
immutable
as $$
  select case
    when p_links is null or jsonb_typeof(p_links) <> 'array' then false
    else coalesce(
      (
        select bool_or(public.media_link_json_has_nonempty_coverage(value))
        from jsonb_array_elements(p_links) as value
      ),
      false
    )
  end;
$$;

create or replace function public.media_normalize_links_json(p_links jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_item jsonb;
  v_ord integer := 0;
  v_platform text;
  v_url text;
  v_label text;
  v_sort integer;
  v_is_national boolean;
  v_team_ids text[];
  v_conf_ids text[];
begin
  if p_links is null or jsonb_typeof(p_links) <> 'array' then
    return '[]'::jsonb;
  end if;

  for v_item in select value from jsonb_array_elements(p_links)
  loop
    v_platform := lower(trim(coalesce(v_item ->> 'platform', '')));
    v_url := trim(coalesce(v_item ->> 'url', ''));
    v_label := nullif(trim(coalesce(v_item ->> 'label', '')), '');
    v_sort := coalesce(
      (v_item ->> 'sort_order')::integer,
      (v_item ->> 'sortOrder')::integer,
      v_ord
    );
    v_is_national := coalesce(
      (v_item ->> 'is_national')::boolean,
      (v_item ->> 'isNational')::boolean,
      false
    );
    v_team_ids := public.media_json_text_ids(
      coalesce(v_item -> 'team_ids', v_item -> 'teamIds')
    );
    v_conf_ids := public.media_json_text_ids(
      coalesce(v_item -> 'conference_ids', v_item -> 'conferenceIds')
    );

    if v_platform = '' and v_url = '' and v_label is null then
      continue;
    end if;

    v_out := v_out || jsonb_build_array(
      jsonb_build_object(
        'platform', v_platform,
        'label', v_label,
        'url', v_url,
        'sort_order', v_sort,
        'is_national', v_is_national,
        'team_ids', to_jsonb(v_team_ids),
        'conference_ids', to_jsonb(v_conf_ids)
      )
    );
    v_ord := v_ord + 1;
  end loop;

  return v_out;
end;
$$;

create or replace function public.media_fanout_coverage_onto_links(
  p_links jsonb,
  p_is_national boolean,
  p_team_ids text[],
  p_conference_ids text[]
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_links jsonb := public.media_normalize_links_json(p_links);
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
  v_out jsonb := '[]'::jsonb;
  v_item jsonb;
  v_ord integer := 0;
begin
  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}')
  into v_team_ids
  from unnest(coalesce(p_team_ids, '{}')) as x
  where length(trim(x)) > 0;

  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}')
  into v_conf_ids
  from unnest(coalesce(p_conference_ids, '{}')) as x
  where length(trim(x)) > 0;

  for v_item in select value from jsonb_array_elements(v_links)
  loop
    v_out := v_out || jsonb_build_array(
      jsonb_build_object(
        'platform', v_item ->> 'platform',
        'label', nullif(trim(coalesce(v_item ->> 'label', '')), ''),
        'url', v_item ->> 'url',
        'sort_order', coalesce((v_item ->> 'sort_order')::integer, v_ord),
        'is_national', coalesce(p_is_national, false),
        'team_ids', to_jsonb(v_team_ids),
        'conference_ids', to_jsonb(v_conf_ids)
      )
    );
    v_ord := v_ord + 1;
  end loop;

  return v_out;
end;
$$;

create or replace function public.media_prepare_links_with_coverage(
  p_links jsonb,
  p_fallback_is_national boolean default false,
  p_fallback_team_ids text[] default '{}',
  p_fallback_conference_ids text[] default '{}',
  p_require_coverage boolean default true
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_links jsonb := public.media_normalize_links_json(p_links);
  v_item jsonb;
  v_is_national boolean;
  v_team_ids text[];
  v_conf_ids text[];
begin
  if jsonb_typeof(v_links) <> 'array' or jsonb_array_length(v_links) = 0 then
    raise exception 'platform_links_required';
  end if;

  -- Fan-out when no link has nonempty coverage (old clients / empty as_json keys).
  if not public.media_links_json_any_has_nonempty_coverage(v_links) then
    if p_require_coverage
       and not public.media_link_coverage_is_nonempty(
         p_fallback_is_national,
         p_fallback_team_ids,
         p_fallback_conference_ids
       ) then
      raise exception 'coverage requires national, a conference, or a team';
    end if;
    v_links := public.media_fanout_coverage_onto_links(
      v_links,
      p_fallback_is_national,
      p_fallback_team_ids,
      p_fallback_conference_ids
    );
  elsif p_require_coverage then
    for v_item in select value from jsonb_array_elements(v_links)
    loop
      v_is_national := coalesce((v_item ->> 'is_national')::boolean, false);
      v_team_ids := public.media_json_text_ids(v_item -> 'team_ids');
      v_conf_ids := public.media_json_text_ids(v_item -> 'conference_ids');
      if not public.media_link_coverage_is_nonempty(
        v_is_national, v_team_ids, v_conf_ids
      ) then
        raise exception 'each link requires national, a conference, or a team';
      end if;
    end loop;
  end if;

  return public.media_normalize_links_json(v_links);
end;
$$;

create or replace function public.media_links_json_to_rows_with_coverage(p_links jsonb)
returns table (
  platform text,
  label text,
  url text,
  sort_order integer,
  is_national boolean,
  team_ids text[],
  conference_ids text[]
)
language plpgsql
immutable
as $$
declare
  v_links jsonb := public.media_normalize_links_json(p_links);
  v_item jsonb;
  v_seen text[] := '{}';
  v_key text;
  v_idx integer := 0;
begin
  if jsonb_typeof(v_links) <> 'array' then
    return;
  end if;

  for v_item in
    select value
    from jsonb_array_elements(v_links)
    order by coalesce((value ->> 'sort_order')::integer, 0)
  loop
    platform := lower(trim(coalesce(v_item ->> 'platform', '')));
    url := trim(coalesce(v_item ->> 'url', ''));
    label := case
      when v_item ->> 'label' is null then null
      when jsonb_typeof(v_item -> 'label') = 'null' then null
      else nullif(trim(v_item ->> 'label'), '')
    end;
    if platform not in (
      'website', 'spotify', 'apple', 'youtube', 'x',
      'facebook', 'instagram', 'rss', 'other'
    ) then
      raise exception 'invalid_platform';
    end if;
    if url is null or url !~* '^https?://' then
      raise exception 'invalid_link_url';
    end if;
    v_key := public.media_normalize_link_url_key(url);
    if v_key = any (v_seen) then
      raise exception 'duplicate_link_url';
    end if;
    v_seen := array_append(v_seen, v_key);

    sort_order := coalesce((v_item ->> 'sort_order')::integer, v_idx);
    is_national := coalesce((v_item ->> 'is_national')::boolean, false);
    team_ids := public.media_json_text_ids(v_item -> 'team_ids');
    conference_ids := public.media_json_text_ids(v_item -> 'conference_ids');
    v_idx := v_idx + 1;
    return next;
  end loop;
end;
$$;

create or replace function public.media_write_suggestion_link_coverage(
  p_link_id uuid,
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
begin
  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}')
  into v_team_ids
  from unnest(coalesce(p_team_ids, '{}')) as x
  where length(trim(x)) > 0;

  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}')
  into v_conf_ids
  from unnest(coalesce(p_conference_ids, '{}')) as x
  where length(trim(x)) > 0;

  update public.media_suggestion_links
  set is_national = coalesce(p_is_national, false),
      updated_at = now()
  where id = p_link_id;

  delete from public.media_suggestion_link_teams
  where media_suggestion_link_id = p_link_id;
  delete from public.media_suggestion_link_conferences
  where media_suggestion_link_id = p_link_id;

  foreach v_team in array v_team_ids loop
    insert into public.media_suggestion_link_teams (
      media_suggestion_link_id, team_id
    ) values (p_link_id, v_team)
    on conflict do nothing;
  end loop;

  foreach v_conf in array v_conf_ids loop
    insert into public.media_suggestion_link_conferences (
      media_suggestion_link_id, conference_id
    ) values (p_link_id, v_conf)
    on conflict do nothing;
  end loop;
end;
$$;

create or replace function public.media_write_source_link_coverage(
  p_link_id uuid,
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
begin
  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}')
  into v_team_ids
  from unnest(coalesce(p_team_ids, '{}')) as x
  where length(trim(x)) > 0;

  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}')
  into v_conf_ids
  from unnest(coalesce(p_conference_ids, '{}')) as x
  where length(trim(x)) > 0;

  update public.media_source_links
  set is_national = coalesce(p_is_national, false),
      updated_at = now()
  where id = p_link_id;

  delete from public.media_source_link_teams
  where media_source_link_id = p_link_id;
  delete from public.media_source_link_conferences
  where media_source_link_id = p_link_id;

  foreach v_team in array v_team_ids loop
    insert into public.media_source_link_teams (
      media_source_link_id, team_id
    ) values (p_link_id, v_team)
    on conflict do nothing;
  end loop;

  foreach v_conf in array v_conf_ids loop
    insert into public.media_source_link_conferences (
      media_source_link_id, conference_id
    ) values (p_link_id, v_conf)
    on conflict do nothing;
  end loop;
end;
$$;

create or replace function public.media_recompute_suggestion_coverage_union(
  p_suggestion_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_national boolean := false;
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
  v_scope text;
  v_team text;
  v_conf text;
begin
  select coalesce(bool_or(l.is_national), false)
  into v_is_national
  from public.media_suggestion_links l
  where l.media_suggestion_id = p_suggestion_id;

  select coalesce(array_agg(distinct lt.team_id order by lt.team_id), '{}')
  into v_team_ids
  from public.media_suggestion_link_teams lt
  join public.media_suggestion_links l on l.id = lt.media_suggestion_link_id
  where l.media_suggestion_id = p_suggestion_id;

  select coalesce(array_agg(distinct lc.conference_id order by lc.conference_id), '{}')
  into v_conf_ids
  from public.media_suggestion_link_conferences lc
  join public.media_suggestion_links l on l.id = lc.media_suggestion_link_id
  where l.media_suggestion_id = p_suggestion_id;

  if not public.media_link_coverage_is_nonempty(
    v_is_national, v_team_ids, v_conf_ids
  ) then
    raise exception 'coverage requires national, a conference, or a team';
  end if;

  v_scope := public.media_derive_scope(v_is_national, v_team_ids, v_conf_ids);

  delete from public.media_suggestion_teams
  where media_suggestion_id = p_suggestion_id;
  delete from public.media_suggestion_conferences
  where media_suggestion_id = p_suggestion_id;

  foreach v_team in array v_team_ids loop
    insert into public.media_suggestion_teams (media_suggestion_id, team_id)
    values (p_suggestion_id, v_team)
    on conflict do nothing;
  end loop;

  foreach v_conf in array v_conf_ids loop
    insert into public.media_suggestion_conferences (
      media_suggestion_id, conference_id
    ) values (p_suggestion_id, v_conf)
    on conflict do nothing;
  end loop;

  update public.media_suggestions
  set
    is_national = v_is_national,
    scope = v_scope,
    team_id = case
      when coalesce(cardinality(v_team_ids), 0) > 0 then v_team_ids[1]
      else null
    end,
    conference_id = case
      when coalesce(cardinality(v_conf_ids), 0) > 0 then v_conf_ids[1]
      else null
    end
  where id = p_suggestion_id;
end;
$$;

create or replace function public.media_recompute_source_coverage_union(
  p_source_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_national boolean := false;
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
begin
  select coalesce(bool_or(l.is_national), false)
  into v_is_national
  from public.media_source_links l
  where l.media_source_id = p_source_id;

  select coalesce(array_agg(distinct lt.team_id order by lt.team_id), '{}')
  into v_team_ids
  from public.media_source_link_teams lt
  join public.media_source_links l on l.id = lt.media_source_link_id
  where l.media_source_id = p_source_id;

  select coalesce(array_agg(distinct lc.conference_id order by lc.conference_id), '{}')
  into v_conf_ids
  from public.media_source_link_conferences lc
  join public.media_source_links l on l.id = lc.media_source_link_id
  where l.media_source_id = p_source_id;

  perform public.media_replace_source_coverage(
    p_source_id,
    v_is_national,
    v_team_ids,
    v_conf_ids
  );
end;
$$;

-- ===========================================================================
-- Link JSON readers (include per-link coverage for round-trips)
-- ===========================================================================

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
        'sortOrder', l.sort_order,
        'sort_order', l.sort_order,
        'isNational', coalesce(l.is_national, false),
        'is_national', coalesce(l.is_national, false),
        'teamIds', coalesce(
          (
            select jsonb_agg(t.team_id order by t.team_id)
            from public.media_suggestion_link_teams t
            where t.media_suggestion_link_id = l.id
          ),
          '[]'::jsonb
        ),
        'team_ids', coalesce(
          (
            select jsonb_agg(t.team_id order by t.team_id)
            from public.media_suggestion_link_teams t
            where t.media_suggestion_link_id = l.id
          ),
          '[]'::jsonb
        ),
        'conferenceIds', coalesce(
          (
            select jsonb_agg(c.conference_id order by c.conference_id)
            from public.media_suggestion_link_conferences c
            where c.media_suggestion_link_id = l.id
          ),
          '[]'::jsonb
        ),
        'conference_ids', coalesce(
          (
            select jsonb_agg(c.conference_id order by c.conference_id)
            from public.media_suggestion_link_conferences c
            where c.media_suggestion_link_id = l.id
          ),
          '[]'::jsonb
        )
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
        'sortOrder', l.sort_order,
        'sort_order', l.sort_order,
        'isNational', coalesce(l.is_national, false),
        'is_national', coalesce(l.is_national, false),
        'teamIds', coalesce(
          (
            select jsonb_agg(t.team_id order by t.team_id)
            from public.media_source_link_teams t
            where t.media_source_link_id = l.id
          ),
          '[]'::jsonb
        ),
        'team_ids', coalesce(
          (
            select jsonb_agg(t.team_id order by t.team_id)
            from public.media_source_link_teams t
            where t.media_source_link_id = l.id
          ),
          '[]'::jsonb
        ),
        'conferenceIds', coalesce(
          (
            select jsonb_agg(c.conference_id order by c.conference_id)
            from public.media_source_link_conferences c
            where c.media_source_link_id = l.id
          ),
          '[]'::jsonb
        ),
        'conference_ids', coalesce(
          (
            select jsonb_agg(c.conference_id order by c.conference_id)
            from public.media_source_link_conferences c
            where c.media_source_link_id = l.id
          ),
          '[]'::jsonb
        )
      )
      order by l.sort_order, l.created_at
    ),
    '[]'::jsonb
  )
  from public.media_source_links l
  where l.media_source_id = p_source_id;
$$;

-- ===========================================================================
-- Replace helpers (delete/reinsert links + write coverage on new IDs + union)
-- ===========================================================================

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
  v_link_id uuid;
  v_links jsonb := public.media_normalize_links_json(p_links);
begin
  -- Deleting links cascades per-link coverage junctions (Phase 1 FKs).
  delete from public.media_suggestion_links
  where media_suggestion_id = p_suggestion_id;

  for v_row in
    select * from public.media_links_json_to_rows_with_coverage(v_links)
    order by sort_order
  loop
    insert into public.media_suggestion_links (
      media_suggestion_id, platform, label, url, sort_order, is_national
    ) values (
      p_suggestion_id,
      v_row.platform,
      v_row.label,
      v_row.url,
      v_count,
      coalesce(v_row.is_national, false)
    )
    returning id into v_link_id;

    perform public.media_write_suggestion_link_coverage(
      v_link_id,
      v_row.is_national,
      v_row.team_ids,
      v_row.conference_ids
    );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'platform_links_required';
  end if;

  v_object := public.media_rows_to_platform_links_object(v_links);
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

  perform public.media_recompute_suggestion_coverage_union(p_suggestion_id);
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
  v_link_id uuid;
  v_links jsonb := public.media_normalize_links_json(p_links);
begin
  delete from public.media_source_links where media_source_id = p_source_id;

  for v_row in
    select * from public.media_links_json_to_rows_with_coverage(v_links)
    order by sort_order
  loop
    insert into public.media_source_links (
      media_source_id, platform, label, url, sort_order, is_national
    ) values (
      p_source_id,
      v_row.platform,
      v_row.label,
      v_row.url,
      v_count,
      coalesce(v_row.is_national, false)
    )
    returning id into v_link_id;

    perform public.media_write_source_link_coverage(
      v_link_id,
      v_row.is_national,
      v_row.team_ids,
      v_row.conference_ids
    );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'platform_links_required';
  end if;

  v_object := public.media_rows_to_platform_links_object(v_links);
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

  perform public.media_recompute_source_coverage_union(p_source_id);
  return v_count;
end;
$$;

-- ===========================================================================
-- submit_media_suggestion — per-link coverage + top-level fan-out compat
-- ===========================================================================

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
  v_link_count integer;
begin
  if v_name is null then
    raise exception 'name_required';
  end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'submitter_email_required';
  end if;

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

  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}')
  into v_team_ids
  from unnest(coalesce(p_team_ids, '{}')) as x
  where length(trim(x)) > 0;

  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}')
  into v_conf_ids
  from unnest(coalesce(p_conference_ids, '{}')) as x
  where length(trim(x)) > 0;

  v_links := public.media_prepare_links_with_coverage(
    v_links,
    coalesce(p_is_national, false),
    v_team_ids,
    v_conf_ids,
    true
  );

  v_object := public.media_rows_to_platform_links_object(v_links);

  select r.platform, r.url
  into v_primary_platform, v_primary_url
  from public.media_links_json_to_rows_with_coverage(v_links) r
  order by r.sort_order
  limit 1;

  if v_primary_url is null then
    raise exception 'platform_links_required';
  end if;

  -- Temporary parent coverage; replaced by union after link write.
  v_scope := public.media_derive_scope(
    coalesce(p_is_national, false),
    v_team_ids,
    v_conf_ids
  );

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
    coalesce(nullif(v_scope, ''), 'national'),
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

  v_link_count := public.media_replace_suggestion_links(v_id, v_links);
  if v_link_count < 1 then
    raise exception 'platform_links_required';
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

-- ===========================================================================
-- Admin draft / upsert / approve / merge / correction apply
-- ===========================================================================

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
  p_platform_links jsonb default null,
  p_admin_notes text default null
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
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
  v_link_count integer;
  v_fallback_national boolean;
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

  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}')
  into v_team_ids
  from unnest(coalesce(p_team_ids, '{}')) as x
  where length(trim(x)) > 0;

  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}')
  into v_conf_ids
  from unnest(coalesce(p_conference_ids, '{}')) as x
  where length(trim(x)) > 0;

  if p_team_ids is null then
    select coalesce(array_agg(t.team_id order by t.team_id), '{}')
    into v_team_ids
    from public.media_suggestion_teams t
    where t.media_suggestion_id = p_id;
  end if;
  if p_conference_ids is null then
    select coalesce(array_agg(c.conference_id order by c.conference_id), '{}')
    into v_conf_ids
    from public.media_suggestion_conferences c
    where c.media_suggestion_id = p_id;
  end if;

  v_fallback_national := coalesce(p_is_national, v_row.is_national, false);

  -- If payload links lack coverage fields, fan out top-level / existing coverage.
  v_links := public.media_prepare_links_with_coverage(
    v_links,
    v_fallback_national,
    v_team_ids,
    v_conf_ids,
    true
  );

  v_link_count := public.media_replace_suggestion_links(p_id, v_links);

  update public.media_suggestions
  set
    name = v_name,
    description = nullif(trim(coalesce(p_description, '')), ''),
    logo_url = v_logo,
    notes = case when p_notes is null then notes else nullif(trim(p_notes), '') end,
    admin_notes = case
      when p_admin_notes is null then admin_notes
      else nullif(trim(p_admin_notes), '')
    end,
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
      'adminNotesUpdated', p_admin_notes is not null
    )
  );

  return public.admin_get_media_suggestion_detail(p_id);
end;
$$;

revoke all on function public.admin_update_media_suggestion_draft(
  uuid, text, text, text, jsonb, boolean, text[], text[], text, jsonb, jsonb, text
) from public;
grant execute on function public.admin_update_media_suggestion_draft(
  uuid, text, text, text, jsonb, boolean, text[], text[], text, jsonb, jsonb, text
) to authenticated;

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
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
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

  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}')
  into v_team_ids
  from unnest(coalesce(p_team_ids, '{}')) as x
  where length(trim(x)) > 0;

  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}')
  into v_conf_ids
  from unnest(coalesce(p_conference_ids, '{}')) as x
  where length(trim(x)) > 0;

  v_links := public.media_prepare_links_with_coverage(
    v_links,
    coalesce(p_is_national, false),
    v_team_ids,
    v_conf_ids,
    true
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
      logo_url = coalesce(v_logo, logo_url),
      is_approved = coalesce(p_is_approved, is_approved),
      is_active = coalesce(p_is_active, is_active),
      updated_at = now()
    where id = v_id;
  end if;

  -- Writes per-link coverage and recomputes parent union.
  v_link_count := public.media_replace_source_links(v_id, v_links);

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

revoke all on function public.admin_upsert_media_source(
  uuid, text, text, text, jsonb, boolean, text[], text[], boolean, boolean, jsonb
) from public;
grant execute on function public.admin_upsert_media_source(
  uuid, text, text, text, jsonb, boolean, text[], text[], boolean, boolean, jsonb
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
  v_mode text;
  v_link_count integer;
  v_logo text;
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

  v_logo := nullif(trim(coalesce(v_sug.logo_url, '')), '');

  -- Includes each suggestion link's own coverage (not a flattened parent set).
  v_links := public.media_suggestion_links_as_json(p_id);
  if jsonb_typeof(v_links) <> 'array' or jsonb_array_length(v_links) = 0 then
    raise exception 'platform_links_required';
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
      logo_url = coalesce(v_logo, logo_url),
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
      v_logo,
      'national',
      coalesce(v_sug.is_national, false),
      '{}'::jsonb,
      true,
      true,
      100
    )
    returning id into v_source_id;
  end if;

  -- Per-link coverage copied via JSON; parent union recomputed inside replace.
  v_link_count := public.media_replace_source_links(v_source_id, v_links);

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
    'status', 'approved'
  );
end;
$$;

revoke all on function public.admin_approve_and_publish_media_suggestion(
  uuid, uuid, boolean
) from public;
grant execute on function public.admin_approve_and_publish_media_suggestion(
  uuid, uuid, boolean
) to authenticated;

create or replace function public.admin_merge_media_suggestion(
  p_id uuid,
  p_existing_source_id uuid,
  p_copy_links boolean default true,
  p_copy_artwork boolean default false,
  p_copy_description boolean default false,
  p_copy_teams boolean default false,
  p_copy_conferences boolean default false,
  p_copy_national boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sug public.media_suggestions;
  v_source public.media_sources;
  v_existing_links jsonb;
  v_suggestion_links jsonb;
  v_merged_links jsonb := '[]'::jsonb;
  v_seen text[] := '{}';
  v_item jsonb;
  v_key text;
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
  v_link_count integer := 0;
  v_added_links integer := 0;
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

  select * into v_source from public.media_sources where id = p_existing_source_id for update;
  if not found then
    raise exception 'source_not_found';
  end if;

  if p_copy_links then
    v_existing_links := public.media_source_links_as_json(v_source.id);
    v_suggestion_links := public.media_suggestion_links_as_json(p_id);

    for v_item in select value from jsonb_array_elements(v_existing_links)
    loop
      v_key := public.media_normalize_link_url_key(v_item ->> 'url');
      if v_key = '' or v_key = any (v_seen) then
        continue;
      end if;
      v_seen := array_append(v_seen, v_key);
      -- Preserve each existing link's own coverage (do not flatten).
      v_merged_links := v_merged_links || jsonb_build_array(v_item);
      v_link_count := v_link_count + 1;
    end loop;

    for v_item in select value from jsonb_array_elements(v_suggestion_links)
    loop
      v_key := public.media_normalize_link_url_key(v_item ->> 'url');
      if v_key = '' or v_key = any (v_seen) then
        continue;
      end if;
      v_seen := array_append(v_seen, v_key);
      -- Preserve each incoming suggestion link's own coverage.
      v_merged_links := v_merged_links || jsonb_build_array(v_item);
      v_link_count := v_link_count + 1;
      v_added_links := v_added_links + 1;
    end loop;

    if v_link_count > 0 then
      perform public.media_replace_source_links(v_source.id, v_merged_links);
    end if;
  elsif p_copy_teams or p_copy_conferences or p_copy_national then
    -- Compat: parent-only coverage merge when links are not copied.
    select coalesce(array_agg(t.team_id), '{}')
    into v_team_ids
    from public.media_source_teams t
    where t.media_source_id = v_source.id;

    select coalesce(array_agg(c.conference_id), '{}')
    into v_conf_ids
    from public.media_source_conferences c
    where c.media_source_id = v_source.id;

    if p_copy_teams then
      select coalesce(array_agg(distinct x), '{}')
      into v_team_ids
      from (
        select unnest(v_team_ids) as x
        union
        select t.team_id
        from public.media_suggestion_teams t
        where t.media_suggestion_id = p_id
      ) u;
    end if;

    if p_copy_conferences then
      select coalesce(array_agg(distinct x), '{}')
      into v_conf_ids
      from (
        select unnest(v_conf_ids) as x
        union
        select c.conference_id
        from public.media_suggestion_conferences c
        where c.media_suggestion_id = p_id
      ) u;
    end if;

    perform public.media_replace_source_coverage(
      v_source.id,
      case
        when p_copy_national
          then coalesce(v_sug.is_national, false)
            or coalesce(v_source.is_national, false)
        else coalesce(v_source.is_national, false)
      end,
      v_team_ids,
      v_conf_ids
    );
  end if;

  update public.media_sources
  set
    logo_url = case
      when p_copy_artwork and nullif(trim(coalesce(v_sug.logo_url, '')), '') is not null
        then v_sug.logo_url
      else logo_url
    end,
    description = case
      when p_copy_description and nullif(trim(coalesce(v_sug.description, '')), '') is not null
        then v_sug.description
      else description
    end,
    is_approved = true,
    is_active = true,
    updated_at = now()
  where id = v_source.id;

  update public.media_suggestions
  set
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    published_media_source_id = v_source.id,
    review_action_token_hash = null,
    review_action_expires_at = null
  where id = p_id;

  perform public.media_admin_write_audit(
    'suggestion_merged',
    'suggestion',
    p_id,
    format('Merged suggestion into existing source (+%s links)', v_added_links),
    jsonb_build_object(
      'mediaSourceId', v_source.id,
      'copyLinks', p_copy_links,
      'copyArtwork', p_copy_artwork,
      'copyDescription', p_copy_description,
      'copyTeams', p_copy_teams,
      'copyConferences', p_copy_conferences,
      'copyNational', p_copy_national,
      'addedLinks', v_added_links
    ),
    v_source.id
  );

  return jsonb_build_object(
    'ok', true,
    'suggestionId', p_id,
    'mediaSourceId', v_source.id,
    'mode', 'merge',
    'status', 'approved',
    'addedLinks', v_added_links
  );
end;
$$;

revoke all on function public.admin_merge_media_suggestion(
  uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean
) from public;
grant execute on function public.admin_merge_media_suggestion(
  uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean
) to authenticated;

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
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
  v_is_national boolean;
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

  v_is_national := coalesce(
    p_is_national,
    (v_proposed ->> 'isNational')::boolean,
    v_source.is_national,
    false
  );

  select coalesce(array_agg(x), '{}')
  into v_team_ids
  from (
    select unnest(
      coalesce(
        p_team_ids,
        (
          select array_agg(x)
          from jsonb_array_elements_text(
            coalesce(v_proposed -> 'teamIds', 'null'::jsonb)
          ) as x
        ),
        (
          select array_agg(t.team_id)
          from public.media_source_teams t
          where t.media_source_id = v_source.id
        ),
        '{}'::text[]
      )
    ) as x
  ) q;

  select coalesce(array_agg(x), '{}')
  into v_conf_ids
  from (
    select unnest(
      coalesce(
        p_conference_ids,
        (
          select array_agg(x)
          from jsonb_array_elements_text(
            coalesce(v_proposed -> 'conferenceIds', 'null'::jsonb)
          ) as x
        ),
        (
          select array_agg(c2.conference_id)
          from public.media_source_conferences c2
          where c2.media_source_id = v_source.id
        ),
        '{}'::text[]
      )
    ) as x
  ) q;

  v_links := public.media_prepare_links_with_coverage(
    v_links,
    v_is_national,
    v_team_ids,
    v_conf_ids,
    true
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
      'linkCount', v_link_count
    ),
    v_source.id
  );

  return public.admin_get_media_correction_detail(p_id);
end;
$$;

revoke all on function public.admin_apply_media_correction(
  uuid, jsonb, boolean, text[], text[], text, text, text, boolean, text
) from public;
grant execute on function public.admin_apply_media_correction(
  uuid, jsonb, boolean, text[], text[], text, text, text, boolean, text
) to authenticated;

-- ===========================================================================
-- Verification self-test (creates disposable rows, asserts A–G, cleans up)
-- ===========================================================================

create or replace function public.media_link_coverage_phase2_selftest()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_id uuid;
  v_source_b uuid;
  v_sug_id uuid;
  v_sug_merge_id uuid;
  v_published_id uuid;
  v_link_a uuid;
  v_link_b uuid;
  v_url_a text := 'https://phase2-test.example/link-a-' || gen_random_uuid()::text;
  v_url_b text := 'https://phase2-test.example/link-b-' || gen_random_uuid()::text;
  v_url_c text := 'https://phase2-test.example/link-c-' || gen_random_uuid()::text;
  v_url_d text := 'https://phase2-test.example/link-d-' || gen_random_uuid()::text;
  v_url_e text := 'https://phase2-test.example/link-e-' || gen_random_uuid()::text;
  v_url_f text := 'https://phase2-test.example/link-f-' || gen_random_uuid()::text;
  v_teams text[];
  v_confs text[];
  v_is_national boolean;
  v_count integer;
begin
  -- A/B: distinct per-link coverage + parent union
  insert into public.media_sources (
    name, scope, is_national, is_approved, is_active, platform_links
  ) values (
    'Phase2 Selftest Source', 'national', false, true, true, '{}'::jsonb
  ) returning id into v_source_id;

  perform public.media_replace_source_links(
    v_source_id,
    jsonb_build_array(
      jsonb_build_object(
        'platform', 'youtube',
        'url', v_url_a,
        'sort_order', 0,
        'is_national', true,
        'team_ids', jsonb_build_array('275'),
        'conference_ids', jsonb_build_array('big-sky')
      ),
      jsonb_build_object(
        'platform', 'spotify',
        'url', v_url_b,
        'sort_order', 1,
        'is_national', false,
        'team_ids', jsonb_build_array('70'),
        'conference_ids', jsonb_build_array('big-sky')
      )
    )
  );

  select l.id into v_link_a
  from public.media_source_links l
  where l.media_source_id = v_source_id and l.url = v_url_a;

  select l.id into v_link_b
  from public.media_source_links l
  where l.media_source_id = v_source_id and l.url = v_url_b;

  if not exists (
    select 1 from public.media_source_links
    where id = v_link_a and is_national = true
  ) then
    raise exception 'selftest A failed: link A national';
  end if;
  if not exists (
    select 1 from public.media_source_link_teams
    where media_source_link_id = v_link_a and team_id = '275'
  ) then
    raise exception 'selftest A failed: link A team';
  end if;
  if not exists (
    select 1 from public.media_source_link_conferences
    where media_source_link_id = v_link_a and conference_id = 'big-sky'
  ) then
    raise exception 'selftest A failed: link A conference';
  end if;
  if exists (
    select 1 from public.media_source_link_teams
    where media_source_link_id = v_link_b and team_id = '275'
  ) then
    raise exception 'selftest A failed: link B should not have Montana State';
  end if;
  if not exists (
    select 1 from public.media_source_link_teams
    where media_source_link_id = v_link_b and team_id = '70'
  ) then
    raise exception 'selftest A failed: link B Idaho';
  end if;

  select s.is_national into v_is_national
  from public.media_sources s where s.id = v_source_id;
  if v_is_national is not true then
    raise exception 'selftest B failed: parent national';
  end if;

  select coalesce(array_agg(t.team_id order by t.team_id), '{}')
  into v_teams
  from public.media_source_teams t where t.media_source_id = v_source_id;
  if cardinality(v_teams) <> 2
     or not ('275' = any (v_teams))
     or not ('70' = any (v_teams)) then
    raise exception 'selftest B failed: parent teams %', v_teams;
  end if;

  select coalesce(array_agg(c.conference_id order by c.conference_id), '{}')
  into v_confs
  from public.media_source_conferences c where c.media_source_id = v_source_id;
  if v_confs is distinct from array['big-sky']::text[] then
    raise exception 'selftest B failed: parent conferences %', v_confs;
  end if;

  -- C: replace preserves per-link coverage on new IDs
  perform public.media_replace_source_links(
    v_source_id,
    jsonb_build_array(
      jsonb_build_object(
        'platform', 'youtube',
        'url', v_url_a,
        'sort_order', 0,
        'is_national', true,
        'team_ids', jsonb_build_array('275'),
        'conference_ids', jsonb_build_array('big-sky')
      ),
      jsonb_build_object(
        'platform', 'spotify',
        'url', v_url_b,
        'sort_order', 1,
        'is_national', false,
        'team_ids', jsonb_build_array('70'),
        'conference_ids', jsonb_build_array('big-sky')
      )
    )
  );

  select count(*) into v_count
  from public.media_source_links where media_source_id = v_source_id;
  if v_count <> 2 then
    raise exception 'selftest C failed: link count %', v_count;
  end if;

  select l.id into v_link_a
  from public.media_source_links l
  where l.media_source_id = v_source_id and l.url = v_url_a;
  if not exists (
    select 1 from public.media_source_link_teams
    where media_source_link_id = v_link_a and team_id = '275'
  ) then
    raise exception 'selftest C failed: coverage lost after replace';
  end if;

  -- D: removing Link A recomputes parent union
  perform public.media_replace_source_links(
    v_source_id,
    jsonb_build_array(
      jsonb_build_object(
        'platform', 'spotify',
        'url', v_url_b,
        'sort_order', 0,
        'is_national', false,
        'team_ids', jsonb_build_array('70'),
        'conference_ids', jsonb_build_array('big-sky')
      )
    )
  );

  select s.is_national into v_is_national
  from public.media_sources s where s.id = v_source_id;
  if v_is_national is not false then
    raise exception 'selftest D failed: national should clear';
  end if;
  if exists (
    select 1 from public.media_source_teams
    where media_source_id = v_source_id and team_id = '275'
  ) then
    raise exception 'selftest D failed: Montana State should be removed';
  end if;
  if not exists (
    select 1 from public.media_source_teams
    where media_source_id = v_source_id and team_id = '70'
  ) then
    raise exception 'selftest D failed: Idaho should remain';
  end if;

  -- E: older suggestion payload (top-level only) fans out to every link
  v_sug_id := public.submit_media_suggestion(
    'Phase2 Selftest Suggestion Fanout',
    jsonb_build_array(
      jsonb_build_object('platform', 'website', 'url', v_url_c, 'sort_order', 0),
      jsonb_build_object('platform', 'youtube', 'url', v_url_d, 'sort_order', 1)
    ),
    true,
    array['big-sky']::text[],
    array['275']::text[],
    '{}'::jsonb,
    'phase2-selftest@example.com',
    null,
    null
  );

  select count(*) into v_count
  from public.media_suggestion_links l
  join public.media_suggestion_link_teams t
    on t.media_suggestion_link_id = l.id and t.team_id = '275'
  where l.media_suggestion_id = v_sug_id;
  if v_count <> 2 then
    raise exception 'selftest E failed: fan-out teams count %', v_count;
  end if;
  select count(*) into v_count
  from public.media_suggestion_links
  where media_suggestion_id = v_sug_id and is_national = true;
  if v_count <> 2 then
    raise exception 'selftest E failed: fan-out national count %', v_count;
  end if;

  -- F: approval preserves distinct per-link coverage
  update public.media_suggestions
  set submitter_email = 'phase2-selftest@example.com'
  where id = v_sug_id;

  -- Rebuild suggestion with distinct per-link coverage for approve path
  perform public.media_replace_suggestion_links(
    v_sug_id,
    jsonb_build_array(
      jsonb_build_object(
        'platform', 'website',
        'url', v_url_c,
        'sort_order', 0,
        'is_national', true,
        'team_ids', jsonb_build_array('275'),
        'conference_ids', jsonb_build_array('big-sky')
      ),
      jsonb_build_object(
        'platform', 'youtube',
        'url', v_url_d,
        'sort_order', 1,
        'is_national', false,
        'team_ids', jsonb_build_array('70'),
        'conference_ids', jsonb_build_array('big-sky')
      )
    )
  );

  -- Bypass admin check for selftest by calling replace path used by approve.
  insert into public.media_sources (
    name, scope, is_national, is_approved, is_active, platform_links
  ) values (
    'Phase2 Selftest Published', 'national', false, true, true, '{}'::jsonb
  ) returning id into v_published_id;

  perform public.media_replace_source_links(
    v_published_id,
    public.media_suggestion_links_as_json(v_sug_id)
  );

  select count(*) into v_count
  from public.media_source_links l
  join public.media_source_link_teams t
    on t.media_source_link_id = l.id
  where l.media_source_id = v_published_id
    and l.url = v_url_c
    and t.team_id = '275';
  if v_count <> 1 then
    raise exception 'selftest F failed: published link C coverage';
  end if;
  if exists (
    select 1
    from public.media_source_links l
    join public.media_source_link_teams t
      on t.media_source_link_id = l.id
    where l.media_source_id = v_published_id
      and l.url = v_url_d
      and t.team_id = '275'
  ) then
    raise exception 'selftest F failed: published link D flattened incorrectly';
  end if;

  -- G: merge preserves distinct per-link coverage
  insert into public.media_sources (
    name, scope, is_national, is_approved, is_active, platform_links
  ) values (
    'Phase2 Selftest Merge Target', 'team', false, true, true, '{}'::jsonb
  ) returning id into v_source_b;

  perform public.media_replace_source_links(
    v_source_b,
    jsonb_build_array(
      jsonb_build_object(
        'platform', 'x',
        'url', v_url_e,
        'sort_order', 0,
        'is_national', false,
        'team_ids', jsonb_build_array('275'),
        'conference_ids', '[]'::jsonb
      )
    )
  );

  insert into public.media_suggestions (
    name, provider, submitted_url, platform_links, scope, is_national,
    status, submitter_email
  ) values (
    'Phase2 Selftest Merge Sug',
    'spotify',
    v_url_f,
    '{}'::jsonb,
    'conference',
    false,
    'pending',
    'phase2-selftest@example.com'
  ) returning id into v_sug_merge_id;

  perform public.media_replace_suggestion_links(
    v_sug_merge_id,
    jsonb_build_array(
      jsonb_build_object(
        'platform', 'spotify',
        'url', v_url_f,
        'sort_order', 0,
        'is_national', false,
        'team_ids', '[]'::jsonb,
        'conference_ids', jsonb_build_array('mvfc')
      )
    )
  );

  -- Simulate merge link combine (same as admin_merge copy_links path)
  perform public.media_replace_source_links(
    v_source_b,
    (
      select coalesce(jsonb_agg(item), '[]'::jsonb)
      from (
        select value as item
        from jsonb_array_elements(public.media_source_links_as_json(v_source_b))
        union all
        select value as item
        from jsonb_array_elements(public.media_suggestion_links_as_json(v_sug_merge_id))
      ) q
    )
  );

  if not exists (
    select 1
    from public.media_source_links l
    join public.media_source_link_teams t on t.media_source_link_id = l.id
    where l.media_source_id = v_source_b and l.url = v_url_e and t.team_id = '275'
  ) then
    raise exception 'selftest G failed: existing link coverage lost';
  end if;
  if not exists (
    select 1
    from public.media_source_links l
    join public.media_source_link_conferences c on c.media_source_link_id = l.id
    where l.media_source_id = v_source_b and l.url = v_url_f and c.conference_id = 'mvfc'
  ) then
    raise exception 'selftest G failed: merged link coverage lost';
  end if;
  if exists (
    select 1
    from public.media_source_links l
    join public.media_source_link_conferences c on c.media_source_link_id = l.id
    where l.media_source_id = v_source_b and l.url = v_url_e and c.conference_id = 'mvfc'
  ) then
    raise exception 'selftest G failed: coverage flattened onto existing link';
  end if;

  -- Cleanup disposable rows
  delete from public.media_suggestions where id in (v_sug_id, v_sug_merge_id);
  delete from public.media_sources
  where id in (v_source_id, v_source_b, v_published_id);

  return 'media_link_coverage_phase2_selftest OK';
exception
  when others then
    delete from public.media_suggestions
    where submitter_email = 'phase2-selftest@example.com'
       or name like 'Phase2 Selftest%';
    delete from public.media_sources where name like 'Phase2 Selftest%';
    raise;
end;
$$;

revoke all on function public.media_link_coverage_phase2_selftest() from public;
grant execute on function public.media_link_coverage_phase2_selftest() to service_role;

do $$
declare
  v_msg text;
begin
  v_msg := public.media_link_coverage_phase2_selftest();
  raise notice '%', v_msg;
end;
$$;

-- Manual verification reminders (self-test above covers A–G):
-- A/B distinct per-link coverage + parent union
-- C replace preserves coverage on new link IDs
-- D remove link recomputes parent union
-- E top-level-only submit fans out to every link
-- F approve/publish path copies per-link coverage (via links_as_json → replace)
-- G merge preserves distinct per-link coverage (no flatten)
