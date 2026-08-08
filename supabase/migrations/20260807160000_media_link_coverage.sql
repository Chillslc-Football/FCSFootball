-- Phase 1: normalized per-link media coverage (schema + inherit backfill).
-- Additive only: does not change creator/suggestion-level coverage tables,
-- RPCs, or link replace helpers. Discovery continues to use parent coverage.
-- Idempotent. Apply with: supabase db push

-- ---------------------------------------------------------------------------
-- Pre-backfill counts (for verification; no data mutation)
-- ---------------------------------------------------------------------------
do $$
declare
  v_source_link_count bigint;
  v_suggestion_link_count bigint;
  v_source_team_count bigint;
  v_source_conf_count bigint;
  v_source_national_count bigint;
  v_sug_team_count bigint;
  v_sug_conf_count bigint;
  v_sug_national_count bigint;
begin
  select count(*) into v_source_link_count from public.media_source_links;
  select count(*) into v_suggestion_link_count from public.media_suggestion_links;
  select count(*) into v_source_team_count from public.media_source_teams;
  select count(*) into v_source_conf_count from public.media_source_conferences;
  select count(*) into v_source_national_count
  from public.media_sources where coalesce(is_national, false);
  select count(*) into v_sug_team_count from public.media_suggestion_teams;
  select count(*) into v_sug_conf_count from public.media_suggestion_conferences;
  select count(*) into v_sug_national_count
  from public.media_suggestions where coalesce(is_national, false);

  -- is_local=true: visible for the rest of this migration transaction only
  perform set_config('media_link_coverage.source_link_count', v_source_link_count::text, true);
  perform set_config('media_link_coverage.suggestion_link_count', v_suggestion_link_count::text, true);
  perform set_config('media_link_coverage.source_team_count', v_source_team_count::text, true);
  perform set_config('media_link_coverage.source_conf_count', v_source_conf_count::text, true);
  perform set_config('media_link_coverage.source_national_count', v_source_national_count::text, true);
  perform set_config('media_link_coverage.sug_team_count', v_sug_team_count::text, true);
  perform set_config('media_link_coverage.sug_conf_count', v_sug_conf_count::text, true);
  perform set_config('media_link_coverage.sug_national_count', v_sug_national_count::text, true);

  raise notice
    'media_link_coverage pre: source_links=%, suggestion_links=%, source_teams=%, source_conferences=%, source_national=%, suggestion_teams=%, suggestion_conferences=%, suggestion_national=%',
    v_source_link_count,
    v_suggestion_link_count,
    v_source_team_count,
    v_source_conf_count,
    v_source_national_count,
    v_sug_team_count,
    v_sug_conf_count,
    v_sug_national_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Columns: is_national on link rows
-- ---------------------------------------------------------------------------
alter table public.media_source_links
  add column if not exists is_national boolean not null default false;

alter table public.media_suggestion_links
  add column if not exists is_national boolean not null default false;

-- ---------------------------------------------------------------------------
-- Junction tables (normalized per-link coverage)
-- ---------------------------------------------------------------------------
create table if not exists public.media_source_link_teams (
  media_source_link_id uuid not null
    references public.media_source_links(id) on delete cascade,
  team_id text not null,
  created_at timestamptz not null default now(),
  primary key (media_source_link_id, team_id)
);

create table if not exists public.media_source_link_conferences (
  media_source_link_id uuid not null
    references public.media_source_links(id) on delete cascade,
  conference_id text not null,
  created_at timestamptz not null default now(),
  primary key (media_source_link_id, conference_id)
);

create table if not exists public.media_suggestion_link_teams (
  media_suggestion_link_id uuid not null
    references public.media_suggestion_links(id) on delete cascade,
  team_id text not null,
  created_at timestamptz not null default now(),
  primary key (media_suggestion_link_id, team_id)
);

create table if not exists public.media_suggestion_link_conferences (
  media_suggestion_link_id uuid not null
    references public.media_suggestion_links(id) on delete cascade,
  conference_id text not null,
  created_at timestamptz not null default now(),
  primary key (media_suggestion_link_id, conference_id)
);

create index if not exists media_source_link_teams_team_id_idx
  on public.media_source_link_teams (team_id);
create index if not exists media_source_link_conferences_conference_id_idx
  on public.media_source_link_conferences (conference_id);
create index if not exists media_suggestion_link_teams_team_id_idx
  on public.media_suggestion_link_teams (team_id);
create index if not exists media_suggestion_link_conferences_conference_id_idx
  on public.media_suggestion_link_conferences (conference_id);

-- Composite PKs already support lookups by link id; keep explicit link indexes
-- for coverage fan-out / delete-path clarity.
create index if not exists media_source_link_teams_link_id_idx
  on public.media_source_link_teams (media_source_link_id);
create index if not exists media_source_link_conferences_link_id_idx
  on public.media_source_link_conferences (media_source_link_id);
create index if not exists media_suggestion_link_teams_link_id_idx
  on public.media_suggestion_link_teams (media_suggestion_link_id);
create index if not exists media_suggestion_link_conferences_link_id_idx
  on public.media_suggestion_link_conferences (media_suggestion_link_id);

-- ---------------------------------------------------------------------------
-- RLS / grants (match media_*_links + media_*_teams/conferences style)
-- ---------------------------------------------------------------------------
alter table public.media_source_link_teams enable row level security;
alter table public.media_source_link_conferences enable row level security;
alter table public.media_suggestion_link_teams enable row level security;
alter table public.media_suggestion_link_conferences enable row level security;

revoke all on table public.media_source_link_teams from anon, authenticated;
revoke all on table public.media_source_link_conferences from anon, authenticated;
revoke all on table public.media_suggestion_link_teams from anon, authenticated;
revoke all on table public.media_suggestion_link_conferences from anon, authenticated;

grant select on table public.media_source_link_teams to anon, authenticated;
grant select on table public.media_source_link_conferences to anon, authenticated;
grant select, insert, update, delete on table public.media_source_link_teams to authenticated;
grant select, insert, update, delete on table public.media_source_link_conferences to authenticated;
grant all on table public.media_source_link_teams to service_role;
grant all on table public.media_source_link_conferences to service_role;

grant select, insert, update, delete on table public.media_suggestion_link_teams to authenticated;
grant select, insert, update, delete on table public.media_suggestion_link_conferences to authenticated;
grant all on table public.media_suggestion_link_teams to service_role;
grant all on table public.media_suggestion_link_conferences to service_role;

drop policy if exists media_source_link_teams_public_select on public.media_source_link_teams;
create policy media_source_link_teams_public_select on public.media_source_link_teams
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.media_source_links l
      join public.media_sources s on s.id = l.media_source_id
      where l.id = media_source_link_id
        and (
          (s.is_approved = true and coalesce(s.is_active, true) = true)
          or public.is_app_admin()
        )
    )
  );

drop policy if exists media_source_link_teams_admin_write on public.media_source_link_teams;
create policy media_source_link_teams_admin_write on public.media_source_link_teams
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists media_source_link_conferences_public_select
  on public.media_source_link_conferences;
create policy media_source_link_conferences_public_select
  on public.media_source_link_conferences
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.media_source_links l
      join public.media_sources s on s.id = l.media_source_id
      where l.id = media_source_link_id
        and (
          (s.is_approved = true and coalesce(s.is_active, true) = true)
          or public.is_app_admin()
        )
    )
  );

drop policy if exists media_source_link_conferences_admin_write
  on public.media_source_link_conferences;
create policy media_source_link_conferences_admin_write
  on public.media_source_link_conferences
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists media_suggestion_link_teams_admin_all
  on public.media_suggestion_link_teams;
create policy media_suggestion_link_teams_admin_all
  on public.media_suggestion_link_teams
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists media_suggestion_link_conferences_admin_all
  on public.media_suggestion_link_conferences;
create policy media_suggestion_link_conferences_admin_all
  on public.media_suggestion_link_conferences
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- Backfill: every existing link inherits parent creator/suggestion coverage
-- ---------------------------------------------------------------------------

-- Approved source links: national flag
update public.media_source_links l
set is_national = coalesce(s.is_national, false)
from public.media_sources s
where s.id = l.media_source_id
  and l.is_national is distinct from coalesce(s.is_national, false);

-- Approved source links: teams (duplicate-safe)
insert into public.media_source_link_teams (media_source_link_id, team_id)
select l.id, t.team_id
from public.media_source_links l
join public.media_source_teams t on t.media_source_id = l.media_source_id
on conflict do nothing;

-- Approved source links: conferences (duplicate-safe)
insert into public.media_source_link_conferences (media_source_link_id, conference_id)
select l.id, c.conference_id
from public.media_source_links l
join public.media_source_conferences c on c.media_source_id = l.media_source_id
on conflict do nothing;

-- Suggestion links: national flag
update public.media_suggestion_links l
set is_national = coalesce(s.is_national, false)
from public.media_suggestions s
where s.id = l.media_suggestion_id
  and l.is_national is distinct from coalesce(s.is_national, false);

-- Suggestion links: teams (duplicate-safe)
insert into public.media_suggestion_link_teams (media_suggestion_link_id, team_id)
select l.id, t.team_id
from public.media_suggestion_links l
join public.media_suggestion_teams t on t.media_suggestion_id = l.media_suggestion_id
on conflict do nothing;

-- Suggestion links: conferences (duplicate-safe)
insert into public.media_suggestion_link_conferences (media_suggestion_link_id, conference_id)
select l.id, c.conference_id
from public.media_suggestion_links l
join public.media_suggestion_conferences c on c.media_suggestion_id = l.media_suggestion_id
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Verification (fails migration if inherit backfill is incomplete)
-- ---------------------------------------------------------------------------
do $$
declare
  v_source_link_before bigint :=
    nullif(current_setting('media_link_coverage.source_link_count', true), '')::bigint;
  v_suggestion_link_before bigint :=
    nullif(current_setting('media_link_coverage.suggestion_link_count', true), '')::bigint;
  v_source_team_before bigint :=
    nullif(current_setting('media_link_coverage.source_team_count', true), '')::bigint;
  v_source_conf_before bigint :=
    nullif(current_setting('media_link_coverage.source_conf_count', true), '')::bigint;
  v_source_national_before bigint :=
    nullif(current_setting('media_link_coverage.source_national_count', true), '')::bigint;
  v_sug_team_before bigint :=
    nullif(current_setting('media_link_coverage.sug_team_count', true), '')::bigint;
  v_sug_conf_before bigint :=
    nullif(current_setting('media_link_coverage.sug_conf_count', true), '')::bigint;
  v_sug_national_before bigint :=
    nullif(current_setting('media_link_coverage.sug_national_count', true), '')::bigint;

  v_source_link_after bigint;
  v_suggestion_link_after bigint;
  v_source_team_after bigint;
  v_source_conf_after bigint;
  v_source_national_after bigint;
  v_sug_team_after bigint;
  v_sug_conf_after bigint;
  v_sug_national_after bigint;

  v_bad_source_national bigint;
  v_bad_source_teams bigint;
  v_bad_source_conferences bigint;
  v_bad_sug_national bigint;
  v_bad_sug_teams bigint;
  v_bad_sug_conferences bigint;
  v_source_link_team_count bigint;
  v_source_link_conf_count bigint;
  v_sug_link_team_count bigint;
  v_sug_link_conf_count bigint;
begin
  select count(*) into v_source_link_after from public.media_source_links;
  select count(*) into v_suggestion_link_after from public.media_suggestion_links;
  select count(*) into v_source_team_after from public.media_source_teams;
  select count(*) into v_source_conf_after from public.media_source_conferences;
  select count(*) into v_source_national_after
  from public.media_sources where coalesce(is_national, false);
  select count(*) into v_sug_team_after from public.media_suggestion_teams;
  select count(*) into v_sug_conf_after from public.media_suggestion_conferences;
  select count(*) into v_sug_national_after
  from public.media_suggestions where coalesce(is_national, false);
  select count(*) into v_source_link_team_count from public.media_source_link_teams;
  select count(*) into v_source_link_conf_count from public.media_source_link_conferences;
  select count(*) into v_sug_link_team_count from public.media_suggestion_link_teams;
  select count(*) into v_sug_link_conf_count from public.media_suggestion_link_conferences;

  -- A / B: link row counts unchanged
  if v_source_link_before is distinct from v_source_link_after then
    raise exception
      'media_link_coverage verify A failed: source link count changed (% -> %)',
      v_source_link_before, v_source_link_after;
  end if;
  if v_suggestion_link_before is distinct from v_suggestion_link_after then
    raise exception
      'media_link_coverage verify B failed: suggestion link count changed (% -> %)',
      v_suggestion_link_before, v_suggestion_link_after;
  end if;

  -- G: creator/suggestion-level coverage untouched
  if v_source_team_before is distinct from v_source_team_after
     or v_source_conf_before is distinct from v_source_conf_after
     or v_source_national_before is distinct from v_source_national_after
     or v_sug_team_before is distinct from v_sug_team_after
     or v_sug_conf_before is distinct from v_sug_conf_after
     or v_sug_national_before is distinct from v_sug_national_after then
    raise exception
      'media_link_coverage verify G failed: parent coverage counts changed (source_teams %->%, source_conferences %->%, source_national %->%, suggestion_teams %->%, suggestion_conferences %->%, suggestion_national %->%)',
      v_source_team_before, v_source_team_after,
      v_source_conf_before, v_source_conf_after,
      v_source_national_before, v_source_national_after,
      v_sug_team_before, v_sug_team_after,
      v_sug_conf_before, v_sug_conf_after,
      v_sug_national_before, v_sug_national_after;
  end if;

  -- C: every source link national flag matches parent
  select count(*) into v_bad_source_national
  from public.media_source_links l
  join public.media_sources s on s.id = l.media_source_id
  where l.is_national is distinct from coalesce(s.is_national, false);
  if v_bad_source_national > 0 then
    raise exception
      'media_link_coverage verify C failed: % source links have mismatched is_national',
      v_bad_source_national;
  end if;

  -- D: every source link inherited all parent teams (no missing pairs)
  select count(*) into v_bad_source_teams
  from public.media_source_links l
  join public.media_source_teams t on t.media_source_id = l.media_source_id
  where not exists (
    select 1
    from public.media_source_link_teams lt
    where lt.media_source_link_id = l.id
      and lt.team_id = t.team_id
  );
  if v_bad_source_teams > 0 then
    raise exception
      'media_link_coverage verify D failed: % missing source-link team inherit rows',
      v_bad_source_teams;
  end if;

  -- E: every source link inherited all parent conferences
  select count(*) into v_bad_source_conferences
  from public.media_source_links l
  join public.media_source_conferences c on c.media_source_id = l.media_source_id
  where not exists (
    select 1
    from public.media_source_link_conferences lc
    where lc.media_source_link_id = l.id
      and lc.conference_id = c.conference_id
  );
  if v_bad_source_conferences > 0 then
    raise exception
      'media_link_coverage verify E failed: % missing source-link conference inherit rows',
      v_bad_source_conferences;
  end if;

  -- F: suggestion links national / teams / conferences
  select count(*) into v_bad_sug_national
  from public.media_suggestion_links l
  join public.media_suggestions s on s.id = l.media_suggestion_id
  where l.is_national is distinct from coalesce(s.is_national, false);
  if v_bad_sug_national > 0 then
    raise exception
      'media_link_coverage verify F failed: % suggestion links have mismatched is_national',
      v_bad_sug_national;
  end if;

  select count(*) into v_bad_sug_teams
  from public.media_suggestion_links l
  join public.media_suggestion_teams t on t.media_suggestion_id = l.media_suggestion_id
  where not exists (
    select 1
    from public.media_suggestion_link_teams lt
    where lt.media_suggestion_link_id = l.id
      and lt.team_id = t.team_id
  );
  if v_bad_sug_teams > 0 then
    raise exception
      'media_link_coverage verify F failed: % missing suggestion-link team inherit rows',
      v_bad_sug_teams;
  end if;

  select count(*) into v_bad_sug_conferences
  from public.media_suggestion_links l
  join public.media_suggestion_conferences c on c.media_suggestion_id = l.media_suggestion_id
  where not exists (
    select 1
    from public.media_suggestion_link_conferences lc
    where lc.media_suggestion_link_id = l.id
      and lc.conference_id = c.conference_id
  );
  if v_bad_sug_conferences > 0 then
    raise exception
      'media_link_coverage verify F failed: % missing suggestion-link conference inherit rows',
      v_bad_sug_conferences;
  end if;

  raise notice
    'media_link_coverage verify OK: source_links=%, suggestion_links=%, source_link_teams=%, source_link_conferences=%, suggestion_link_teams=%, suggestion_link_conferences=%',
    v_source_link_after,
    v_suggestion_link_after,
    v_source_link_team_count,
    v_source_link_conf_count,
    v_sug_link_team_count,
    v_sug_link_conf_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Manual verification queries (optional; migration already enforces A–G above)
-- ---------------------------------------------------------------------------
-- A/B link counts:
--   select count(*) from public.media_source_links;
--   select count(*) from public.media_suggestion_links;
--
-- C source national inherit:
--   select count(*) from public.media_source_links l
--   join public.media_sources s on s.id = l.media_source_id
--   where l.is_national is distinct from coalesce(s.is_national, false);
--   -- expect 0
--
-- D source team inherit:
--   select count(*) from public.media_source_links l
--   join public.media_source_teams t on t.media_source_id = l.media_source_id
--   where not exists (
--     select 1 from public.media_source_link_teams lt
--     where lt.media_source_link_id = l.id and lt.team_id = t.team_id
--   );
--   -- expect 0
--
-- E source conference inherit:
--   select count(*) from public.media_source_links l
--   join public.media_source_conferences c on c.media_source_id = l.media_source_id
--   where not exists (
--     select 1 from public.media_source_link_conferences lc
--     where lc.media_source_link_id = l.id and lc.conference_id = c.conference_id
--   );
--   -- expect 0
--
-- F suggestion inherit (national / teams / conferences): same pattern on
--   media_suggestion_links + media_suggestion_{teams,conferences} +
--   media_suggestion_link_{teams,conferences}
--
-- G parent coverage untouched:
--   select count(*) from public.media_source_teams;
--   select count(*) from public.media_source_conferences;
--   select count(*) from public.media_sources where coalesce(is_national, false);
--   select count(*) from public.media_suggestion_teams;
--   select count(*) from public.media_suggestion_conferences;
--   select count(*) from public.media_suggestions where coalesce(is_national, false);
--
-- Expected cardinality after backfill:
--   source_link_teams ≈ (# source links per source) × (# teams on that source)
--   i.e. select
--     (select count(*) from media_source_links l
--      join media_source_teams t on t.media_source_id = l.media_source_id)
--     = (select count(*) from media_source_link_teams);
