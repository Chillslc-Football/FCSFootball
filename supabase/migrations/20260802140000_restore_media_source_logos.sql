-- Restore verified media_sources.logo_url values for approved creators.
-- Sources: mediaSourcesSeed.ts + supabase/manual/20260728_update_media_source_logos.sql
-- Idempotent: only fills null/blank logo_url; never overwrites nonblank artwork.
-- Also hardens admin upsert / approve so blank artwork no longer clears existing logos.
-- Apply with: supabase.cmd db push

-- ---------------------------------------------------------------------------
-- 1) Normalize blank strings to null
-- ---------------------------------------------------------------------------
update public.media_sources
set
  logo_url = null,
  updated_at = now()
where logo_url is not null
  and trim(logo_url) = '';

-- ---------------------------------------------------------------------------
-- 2) Fill missing logos by exact creator name (optional team_id for MTST rows)
-- ---------------------------------------------------------------------------
update public.media_sources s
set
  logo_url = v.logo_url,
  updated_at = now()
from (
  values
    -- National (seed Spotify CDN / verified Apple / Megaphone)
    (
      'FCS Fans Nation Podcast',
      null::text,
      'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f265f4b979acced72b902cb87'
    ),
    (
      'FCS Fever Podcast',
      null::text,
      'https://megaphone.imgix.net/podcasts/d91623ec-cbe1-11ec-86fd-c35e220ce0eb/image/FCSLogoSponsor.jpg'
    ),
    (
      'FCS Football Talk Network',
      null::text,
      'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f3658535277a900cc4f2b12ec'
    ),
    (
      'FCS Nation',
      null::text,
      'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f2140c37764122d36e9d82d98'
    ),
    (
      'Hack City - FBS and FCS Football',
      null::text,
      'https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1fd647eec00879e7f9927f5a12'
    ),
    (
      'MONDAK Football Show',
      null::text,
      'https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1f24281e17df640e02a8732517'
    ),
    (
      'The FCS Edge',
      null::text,
      'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1ffd6ebfa5f150b3328fe35a69'
    ),
    (
      'The Bluebloods',
      null::text,
      'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1fbd21c657bb5a0d75305946d0'
    ),
    (
      'The Deep Ball Podcast',
      null::text,
      'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1fc40e36e37f64572ed91e4c2e'
    ),
    (
      'The Samuel Akem Show',
      null::text,
      'https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/a6/16/81/a6168139-544d-d07b-c9c0-cc56a56431d5/mza_9623872402944139267.jpg/600x600bb.jpg'
    ),
    -- Montana State team rows (verified 2026-07-28 manual SQL)
    (
      'Skyline Sports',
      '147',
      'https://skylinesportsmt.com/wp-content/uploads/2017/01/cropped-Skyline_Sports_Logo_v2-1.jpg'
    ),
    (
      'Bobcat Insider Podcast',
      '147',
      'https://content.production.cdn.art19.com/images/91/d5/06/ee/91d506ee-e852-4114-bd01-b7855c2d7dd8/833eb7d1a596946b816a71c7a855e6049f0a9c67058a8b350937ab0c715edb7d0f8e927e62e63b78941119e7c84db0835a2632bdb5d8516f8bdf37eb4913c3f7.jpeg'
    ),
    (
      'Cat Griz Insider Podcast',
      '147',
      'https://play.cdnstream1.com/zjb/image/download/bf/63/3d/bf633dff-3bb6-45d4-8632-1b22a23dccfc_1400.jpg'
    ),
    (
      'Cats Pawd',
      '147',
      'https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/29961837/29961837-1726780717811-211375b6c65b7.jpg'
    ),
    (
      'R&R Cat Cast',
      '147',
      'https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/1055348/1055348-1691163004760-2ec19f1cba8ac.jpg'
    )
) as v(name, team_id, logo_url)
where s.name = v.name
  and (v.team_id is null or s.team_id = v.team_id)
  and s.is_approved = true
  and nullif(trim(coalesce(s.logo_url, '')), '') is null
  and v.logo_url ~* '^https?://';

-- Verification helper (run in SQL editor after push):
-- select name, team_id, left(logo_url, 48) as logo_prefix
-- from public.media_sources
-- where is_approved = true
-- order by name;

-- ---------------------------------------------------------------------------
-- 3) Harden admin_upsert_media_source: blank artwork preserves existing logo
-- ---------------------------------------------------------------------------
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
      -- Preserve existing artwork when admin leaves the artwork field blank.
      logo_url = coalesce(v_logo, logo_url),
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

revoke all on function public.admin_upsert_media_source(
  uuid, text, text, text, jsonb, boolean, text[], text[], boolean, boolean, jsonb
) from public;
grant execute on function public.admin_upsert_media_source(
  uuid, text, text, text, jsonb, boolean, text[], text[], boolean, boolean, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Harden approve overwrite: blank suggestion artwork preserves source logo
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
  v_name text;
  v_links jsonb;
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
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

  v_links := public.media_suggestion_links_as_json(p_id);
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
      -- Preserve existing source artwork when suggestion has no logo.
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
