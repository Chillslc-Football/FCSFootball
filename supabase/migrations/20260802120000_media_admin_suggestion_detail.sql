-- Media Admin suggestion detail: admin notes on draft, richer matches, merge flow.
-- Apply with: supabase db push

-- ---------------------------------------------------------------------------
-- Draft save: persist private admin_notes without requiring notes rewrite
-- ---------------------------------------------------------------------------
drop function if exists public.admin_update_media_suggestion_draft(
  uuid, text, text, text, jsonb, boolean, text[], text[], text, jsonb, jsonb
);

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
    -- Preserve original submitter notes unless explicitly provided.
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
      'isNational', coalesce(p_is_national, v_row.is_national, false),
      'teamIds', to_jsonb(v_team_ids),
      'conferenceIds', to_jsonb(v_conf_ids),
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

-- ---------------------------------------------------------------------------
-- Richer duplicate candidates for suggestion detail
-- ---------------------------------------------------------------------------
create or replace function public.admin_find_media_source_matches(
  p_name text default null,
  p_urls text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := lower(trim(coalesce(p_name, '')));
  v_urls text[] := '{}';
begin
  if not public.is_app_admin() then
    raise exception 'not_authorized';
  end if;

  select coalesce(array_agg(distinct public.media_normalize_link_url_key(x)), '{}')
  into v_urls
  from unnest(coalesce(p_urls, '{}')) as x
  where length(trim(x)) > 0;

  return coalesce(
    (
      select jsonb_agg(row_data order by (row_data ->> 'score')::int desc, (row_data ->> 'name'))
      from (
        select jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'logoUrl', s.logo_url,
          'isActive', coalesce(s.is_active, true),
          'isApproved', s.is_approved,
          'isNational', coalesce(s.is_national, false),
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
          'links', public.media_source_links_as_json(s.id),
          'score',
            (case when v_name <> '' and lower(s.name) = v_name then 100 else 0 end)
            + (case when v_name <> '' and lower(s.name) like '%' || v_name || '%' then 40 else 0 end)
            + (
              select count(*)::int * 80
              from public.media_source_links l
              where l.media_source_id = s.id
                and public.media_normalize_link_url_key(l.url) = any (v_urls)
            ),
          'reasons',
            coalesce(
              (
                select jsonb_agg(reason)
                from (
                  select 'exact_name' as reason
                  where v_name <> '' and lower(s.name) = v_name
                  union all
                  select 'similar_name'
                  where v_name <> ''
                    and lower(s.name) <> v_name
                    and lower(s.name) like '%' || v_name || '%'
                  union all
                  select 'url_overlap'
                  where exists (
                    select 1
                    from public.media_source_links l
                    where l.media_source_id = s.id
                      and public.media_normalize_link_url_key(l.url) = any (v_urls)
                  )
                ) r
              ),
              '[]'::jsonb
            )
        ) as row_data
        from public.media_sources s
        where
          (
            v_name <> ''
            and (
              lower(s.name) = v_name
              or lower(s.name) like '%' || v_name || '%'
            )
          )
          or (
            coalesce(cardinality(v_urls), 0) > 0
            and exists (
              select 1
              from public.media_source_links l
              where l.media_source_id = s.id
                and public.media_normalize_link_url_key(l.url) = any (v_urls)
            )
          )
        limit 20
      ) q
      where (row_data ->> 'score')::int > 0
      limit 5
    ),
    '[]'::jsonb
  );
end;
$$;

drop function if exists public.admin_find_media_source_matches(text);
revoke all on function public.admin_find_media_source_matches(text, text[]) from public;
grant execute on function public.admin_find_media_source_matches(text, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Merge suggestion into an existing source (explicit field selection)
-- ---------------------------------------------------------------------------
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

    for v_item in
      select value
      from jsonb_array_elements(v_existing_links)
    loop
      v_key := public.media_normalize_link_url_key(v_item ->> 'url');
      if v_key = '' or v_key = any (v_seen) then
        continue;
      end if;
      v_seen := array_append(v_seen, v_key);
      v_merged_links := v_merged_links || jsonb_build_array(
        jsonb_build_object(
          'platform', v_item ->> 'platform',
          'label', v_item ->> 'label',
          'url', v_item ->> 'url',
          'sort_order', v_link_count
        )
      );
      v_link_count := v_link_count + 1;
    end loop;

    for v_item in
      select value
      from jsonb_array_elements(v_suggestion_links)
    loop
      v_key := public.media_normalize_link_url_key(v_item ->> 'url');
      if v_key = '' or v_key = any (v_seen) then
        continue;
      end if;
      v_seen := array_append(v_seen, v_key);
      v_merged_links := v_merged_links || jsonb_build_array(
        jsonb_build_object(
          'platform', v_item ->> 'platform',
          'label', v_item ->> 'label',
          'url', v_item ->> 'url',
          'sort_order', v_link_count
        )
      );
      v_link_count := v_link_count + 1;
      v_added_links := v_added_links + 1;
    end loop;

    if v_link_count > 0 then
      perform public.media_replace_source_links(v_source.id, v_merged_links);
    end if;
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
      when p_copy_national then coalesce(v_sug.is_national, false) or coalesce(v_source.is_national, false)
      else coalesce(v_source.is_national, false)
    end,
    v_team_ids,
    v_conf_ids
  );

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
