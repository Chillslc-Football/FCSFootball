-- Public "Update Your Creator Page" submit path.
-- Reuses media_correction_suggestions (does NOT write media_sources until admin apply).
-- Apply with: supabase db push

-- ---------------------------------------------------------------------------
-- Schema: creator_update type + owner notify idempotency
-- ---------------------------------------------------------------------------
alter table public.media_correction_suggestions
  drop constraint if exists media_correction_suggestions_correction_type_check;

alter table public.media_correction_suggestions
  add constraint media_correction_suggestions_correction_type_check
  check (
    correction_type in (
      'wrong_tag',
      'broken_link',
      'updated_artwork',
      'incorrect_description',
      'inactive_creator',
      'creator_update',
      'other'
    )
  );

alter table public.media_correction_suggestions
  add column if not exists owner_notified_at timestamptz;

comment on column public.media_correction_suggestions.owner_notified_at is
  'Set when the FCS Pulse owner notification email was sent for this correction.';

-- ---------------------------------------------------------------------------
-- Public submit RPC (security definer; no direct table grants for anon)
-- ---------------------------------------------------------------------------
create or replace function public.submit_media_creator_update(
  p_media_source_id uuid,
  p_description text default null,
  p_links jsonb default '[]'::jsonb,
  p_is_national boolean default false,
  p_conference_ids text[] default '{}',
  p_team_ids text[] default '{}',
  p_submitter_email text default null,
  p_notes text default null,
  p_represents_creator boolean default false,
  p_coverage_labels jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.media_sources;
  v_id uuid;
  v_email text := lower(trim(coalesce(p_submitter_email, '')));
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_links jsonb := coalesce(p_links, '[]'::jsonb);
  v_team_ids text[] := '{}';
  v_conf_ids text[] := '{}';
  v_is_national boolean := false;
  v_proposed jsonb;
begin
  if p_media_source_id is null then
    raise exception 'media_source_required';
  end if;

  select * into v_source
  from public.media_sources
  where id = p_media_source_id
    and coalesce(is_approved, false) = true
    and coalesce(is_active, true) = true;

  if not found then
    raise exception 'media_source_not_found';
  end if;

  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'submitter_email_required';
  end if;

  if coalesce(p_represents_creator, false) is not true then
    raise exception 'represents_creator_required';
  end if;

  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}')
  into v_team_ids
  from unnest(coalesce(p_team_ids, '{}')) as x
  where length(trim(x)) > 0;

  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}')
  into v_conf_ids
  from unnest(coalesce(p_conference_ids, '{}')) as x
  where length(trim(x)) > 0;

  -- Validate + normalize link coverage; does not write to media_sources.
  v_links := public.media_prepare_links_with_coverage(
    v_links,
    coalesce(p_is_national, false),
    v_team_ids,
    v_conf_ids,
    true
  );

  -- Parent union from prepared per-link coverage (compat fields for admin apply).
  select coalesce(bool_or(coalesce((item ->> 'is_national')::boolean, false)), false)
  into v_is_national
  from jsonb_array_elements(v_links) as item;

  select coalesce(
    (
      select array_agg(distinct trim(t) order by trim(t))
      from jsonb_array_elements(v_links) link,
           jsonb_array_elements_text(coalesce(link -> 'team_ids', '[]'::jsonb)) as t
      where length(trim(t)) > 0
    ),
    '{}'::text[]
  )
  into v_team_ids;

  select coalesce(
    (
      select array_agg(distinct trim(c) order by trim(c))
      from jsonb_array_elements(v_links) link,
           jsonb_array_elements_text(
             coalesce(link -> 'conference_ids', '[]'::jsonb)
           ) as c
      where length(trim(c)) > 0
    ),
    '{}'::text[]
  )
  into v_conf_ids;

  v_proposed := jsonb_build_object(
    'description', v_description,
    'links', v_links,
    'isNational', v_is_national,
    'teamIds', to_jsonb(v_team_ids),
    'conferenceIds', to_jsonb(v_conf_ids),
    'representsCreator', true,
    'coverageLabels', coalesce(p_coverage_labels, '{}'::jsonb)
  );

  insert into public.media_correction_suggestions (
    media_source_id,
    correction_type,
    proposed_changes,
    details,
    submitter_email,
    status
  ) values (
    v_source.id,
    'creator_update',
    v_proposed,
    v_notes,
    v_email,
    'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_media_creator_update(
  uuid, text, jsonb, boolean, text[], text[], text, text, boolean, jsonb
) from public;
grant execute on function public.submit_media_creator_update(
  uuid, text, jsonb, boolean, text[], text[], text, text, boolean, jsonb
) to anon, authenticated, service_role;

comment on function public.submit_media_creator_update(
  uuid, text, jsonb, boolean, text[], text[], text, text, boolean, jsonb
) is
  'Public creator-page update request. Queues media_correction_suggestions only; live media_sources unchanged until admin_apply_media_correction.';
