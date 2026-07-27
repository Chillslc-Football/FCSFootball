-- Manual production patch: national FCS media creators (batch 1–2 + The FCS Edge)
-- Source of truth: src/data/mediaDirectory/mediaSourcesSeed.ts
-- Mirror: supabase/seed/media_sources_seed.sql
--
-- Review in Supabase SQL Editor, then run manually.
-- Do NOT apply via migration / db push unless intentionally chosen.
-- Safe to rerun (idempotent renames + upserts by name).

begin;

-- ---------------------------------------------------------------------------
-- 1) Safe display-name renames (skip if the new name already exists)
-- ---------------------------------------------------------------------------
update public.media_sources
set name = 'FCS Football Talk Network'
where name = 'FCS Football Talk'
  and not exists (
    select 1 from public.media_sources s where s.name = 'FCS Football Talk Network'
  );

update public.media_sources
set name = 'Hack City - FBS and FCS Football'
where name = 'Hack City'
  and not exists (
    select 1 from public.media_sources s where s.name = 'Hack City - FBS and FCS Football'
  );

update public.media_sources
set name = 'The Deep Ball Podcast'
where name = 'Deep Ball Podcast'
  and not exists (
    select 1 from public.media_sources s where s.name = 'The Deep Ball Podcast'
  );

-- ---------------------------------------------------------------------------
-- 2) Update existing national creators by final display name
--     (copy + provider URLs + approval + display_order from TypeScript seed)
-- ---------------------------------------------------------------------------

-- FCS Fans Nation Podcast (seed-national-fcs-fans-nation)
update public.media_sources
set
  subtitle = 'The official podcast of FCS Fans Nation',
  description = 'Fan-driven national FCS discussion, playoff coverage, predictions, interviews, and community conversation.',
  scope = 'national',
  logo_url = null,
  spotify_url = 'https://open.spotify.com/show/2a4H7yGK9qhnEvEEtutY3b',
  youtube_url = 'https://www.youtube.com/@fansnationnetwork',
  x_url = 'https://x.com/FCSFansNation',
  apple_podcast_url = 'https://podcasts.apple.com/us/podcast/fcs-fans-nation/id1396220851',
  is_approved = true,
  display_order = 10,
  is_national = true
where name = 'FCS Fans Nation Podcast';

-- FCS Football Talk Network (seed-national-fcs-football-talk)
update public.media_sources
set
  subtitle = 'Hosted by Sam Herder',
  description = 'National FCS news, analysis, interviews, previews, and reactions hosted by HERO Sports senior FCS analyst Sam Herder.',
  scope = 'national',
  logo_url = null,
  spotify_url = 'https://open.spotify.com/show/05PMJM5ReG5q5ByFlAR6Ug',
  youtube_url = null,
  x_url = 'https://x.com/SamHerderFCS',
  apple_podcast_url = 'https://podcasts.apple.com/us/podcast/fcs-football-talk-network/id1205671649',
  is_approved = true,
  display_order = 30,
  is_national = true
where name = 'FCS Football Talk Network';

-- FCS Nation (seed-national-fcs-nation)
update public.media_sources
set
  subtitle = 'Hosted by Kevin Marshall and Stone Labanowitz',
  description = 'A national FCS podcast covering teams, conferences, storylines, and matchups from across the subdivision.',
  scope = 'national',
  logo_url = null,
  spotify_url = 'https://open.spotify.com/show/34bJPYDMpfFxKtwiWGscHn',
  youtube_url = null,
  x_url = null,
  apple_podcast_url = null,
  is_approved = true,
  display_order = 40,
  is_national = true
where name = 'FCS Nation';

-- Hack City - FBS and FCS Football (seed-national-hack-city)
update public.media_sources
set
  subtitle = 'Hosted by Joe DeLeone and Sean Anderson',
  description = 'Weekly FCS and FBS college football coverage, analysis, previews, reactions, and interviews from Joe DeLeone and Sean Anderson.',
  scope = 'national',
  logo_url = null,
  spotify_url = 'https://open.spotify.com/show/58Z0sHcTgyXTGIihrKi0j7',
  youtube_url = 'https://www.youtube.com/c/HackCityFootball',
  x_url = null,
  apple_podcast_url = 'https://podcasts.apple.com/us/podcast/hack-city-fbs-and-fcs-football/id1458677310',
  is_approved = true,
  display_order = 50,
  is_national = true
where name = 'Hack City - FBS and FCS Football';

-- MONDAK Football Show (seed-national-mondak)
update public.media_sources
set
  subtitle = 'Hosted by Sam Herder and Brad Jones',
  description = 'A syndicated FCS football show focused on Montana, North Dakota, and South Dakota, hosted by national FCS analyst Sam Herder and Brad Jones.',
  scope = 'national',
  logo_url = null,
  spotify_url = 'https://open.spotify.com/show/0MGposfqYN5iCGknVxntzN',
  youtube_url = null,
  x_url = 'https://x.com/SamHerderFCS',
  apple_podcast_url = null,
  is_approved = true,
  display_order = 60,
  is_national = true
where name = 'MONDAK Football Show';

-- FCS Delivered (seed-national-fcs-delivered) — keep historical row; hide from approved directory
update public.media_sources
set
  subtitle = 'Hosted by Craig Haley and Gary Reasons',
  description = 'National FCS analysis, rankings, predictions, interviews, and postseason coverage from Craig Haley and Gary Reasons.',
  scope = 'national',
  logo_url = null,
  spotify_url = null,
  youtube_url = null,
  x_url = null,
  apple_podcast_url = null,
  is_approved = false,
  display_order = 70,
  is_national = true
where name = 'FCS Delivered';

-- The Bluebloods (seed-national-bluebloods)
update public.media_sources
set
  subtitle = 'FCS Football Central',
  description = 'National FCS football news, interviews, conference previews, rankings, playoff coverage, and analysis hosted by Zach McKinnell.',
  scope = 'national',
  logo_url = null,
  spotify_url = 'https://open.spotify.com/show/6azBEcGCeKA5NVDx3fqv1k',
  youtube_url = null,
  x_url = 'https://x.com/The__Bluebloods',
  apple_podcast_url = 'https://podcasts.apple.com/us/podcast/the-bluebloods/id1479796246',
  is_approved = true,
  display_order = 80,
  is_national = true
where name = 'The Bluebloods';

-- The Deep Ball Podcast (seed-national-deep-ball)
update public.media_sources
set
  subtitle = 'Hosted by Samuel Akem and Keenan Curran',
  description = 'Football interviews and in-depth conversations with coaches, players, and people around the game, hosted by former Montana players Samuel Akem and Keenan Curran.',
  scope = 'national',
  logo_url = null,
  spotify_url = 'https://open.spotify.com/show/6rZfZEWBHgOSo9Qu69EbF5',
  youtube_url = 'https://www.youtube.com/@DeepBallPodcast',
  x_url = null,
  apple_podcast_url = 'https://podcasts.apple.com/us/podcast/the-deep-ball-podcast/id1869691465',
  is_approved = true,
  display_order = 90,
  is_national = true
where name = 'The Deep Ball Podcast';

-- The Samuel Akem Show (seed-national-samuel-akem)
update public.media_sources
set
  subtitle = 'Hosted by Samuel Akem',
  description = 'FCS and college football commentary, interviews, reactions, and analysis from former Montana wide receiver Samuel Akem.',
  scope = 'national',
  logo_url = null,
  spotify_url = null,
  youtube_url = 'https://www.youtube.com/channel/UCAx30nrtgXLFUdmqQhxD0GA',
  x_url = 'https://x.com/SamuelAkemShow',
  apple_podcast_url = null,
  is_approved = true,
  display_order = 100,
  is_national = true
where name = 'The Samuel Akem Show';

-- ---------------------------------------------------------------------------
-- 3) Insert The FCS Edge only when missing (seed-national-fcs-edge)
-- ---------------------------------------------------------------------------
insert into public.media_sources (
  name,
  subtitle,
  description,
  scope,
  conference_id,
  team_id,
  logo_url,
  spotify_url,
  youtube_url,
  x_url,
  apple_podcast_url,
  is_approved,
  display_order,
  is_national
)
select
  'The FCS Edge',
  'Hosted by Craig Haley',
  'National FCS football news, analysis, rankings, interviews, playoff coverage, and weekly discussion hosted by longtime FCS analyst Craig Haley.',
  'national',
  null,
  null,
  null,
  'https://open.spotify.com/show/2qKKQujG0zPfDeM1v3SOtS',
  null,
  null,
  'https://podcasts.apple.com/us/podcast/the-fcs-edge/id1699176837',
  true,
  75,
  true
where not exists (
  select 1 from public.media_sources s where s.name = 'The FCS Edge'
);

-- Keep The FCS Edge fields aligned on rerun (approved + verified URLs)
update public.media_sources
set
  subtitle = 'Hosted by Craig Haley',
  description = 'National FCS football news, analysis, rankings, interviews, playoff coverage, and weekly discussion hosted by longtime FCS analyst Craig Haley.',
  scope = 'national',
  logo_url = null,
  spotify_url = 'https://open.spotify.com/show/2qKKQujG0zPfDeM1v3SOtS',
  youtube_url = null,
  x_url = null,
  apple_podcast_url = 'https://podcasts.apple.com/us/podcast/the-fcs-edge/id1699176837',
  is_approved = true,
  display_order = 75,
  is_national = true
where name = 'The FCS Edge';

-- ---------------------------------------------------------------------------
-- 4) Validate exactly one row for each final national creator name
--     Aborts the transaction if any are missing or duplicated.
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  select count(*)::integer
  into v_count
  from public.media_sources
  where name in (
    'FCS Delivered',
    'FCS Fans Nation Podcast',
    'FCS Football Talk Network',
    'FCS Nation',
    'Hack City - FBS and FCS Football',
    'MONDAK Football Show',
    'The Bluebloods',
    'The Deep Ball Podcast',
    'The FCS Edge',
    'The Samuel Akem Show'
  );

  if v_count <> 10 then
    raise exception
      'National media patch validation failed: expected exactly 10 rows for the final creator names, found %. One or more national media sources are missing or duplicated.',
      v_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Verification (alphabetical by name)
-- ---------------------------------------------------------------------------
select
  name,
  is_approved,
  spotify_url,
  apple_podcast_url,
  youtube_url,
  x_url
from public.media_sources
where name in (
  'FCS Delivered',
  'FCS Fans Nation Podcast',
  'FCS Football Talk Network',
  'FCS Nation',
  'Hack City - FBS and FCS Football',
  'MONDAK Football Show',
  'The Bluebloods',
  'The Deep Ball Podcast',
  'The FCS Edge',
  'The Samuel Akem Show'
)
order by name asc;

commit;
