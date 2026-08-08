-- Allow mobile Suggest form to save public creator description on submit.
-- Column media_suggestions.description already exists; approval already copies it
-- to media_sources.description. This only adds p_description to submit RPC.
-- Apply with: supabase db push

drop function if exists public.submit_media_suggestion(
  text, jsonb, boolean, text[], text[], jsonb, text, text, jsonb
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
  p_platform_links jsonb default null,
  p_description text default null
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
  v_description text := nullif(trim(coalesce(p_description, '')), '');
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
    description,
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
    v_description,
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
  text, jsonb, boolean, text[], text[], jsonb, text, text, jsonb, text
) from public;
grant execute on function public.submit_media_suggestion(
  text, jsonb, boolean, text[], text[], jsonb, text, text, jsonb, text
) to anon, authenticated, service_role;
