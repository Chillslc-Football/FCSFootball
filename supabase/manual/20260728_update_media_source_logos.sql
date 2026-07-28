-- Populate verified logo_url values for approved media sources missing artwork.
-- Safe matching: exact source name (+ team_id for Montana State team rows).
-- Do not run with partial/ILIKE matching.
--
-- Verified 2026-07-28:
-- - HTTP 200 image responses
-- - Official RSS / Apple Podcasts / creator website sources
-- - Square (or official site square crop) artwork >= 300x300
--
-- Apply in the Supabase SQL editor (or psql) with an operator role.
-- Do not commit service-role keys into the app repo.

begin;

-- FCS Fever Podcast — official Megaphone RSS artwork (1080x1080)
update public.media_sources
set
  logo_url = 'https://megaphone.imgix.net/podcasts/d91623ec-cbe1-11ec-86fd-c35e220ce0eb/image/FCSLogoSponsor.jpg',
  updated_at = now()
where name = 'FCS Fever Podcast'
  and is_approved = true;

-- The Samuel Akem Show — official Apple Podcasts artwork (600x600)
-- Show ID 1896757840; RSS Transistor artwork also exists but Apple provides a larger stable CDN URL.
update public.media_sources
set
  logo_url = 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/a6/16/81/a6168139-544d-d07b-c9c0-cc56a56431d5/mza_9623872402944139267.jpg/600x600bb.jpg',
  updated_at = now()
where name = 'The Samuel Akem Show'
  and is_approved = true;

-- Skyline Sports (Montana) — official skylinesportsmt.com square logo (512x512)
-- NOTE: Do NOT use Apple show id 1414908785 ("Skyline Sports" Oak Lawn) — unrelated.
update public.media_sources
set
  logo_url = 'https://skylinesportsmt.com/wp-content/uploads/2017/01/cropped-Skyline_Sports_Logo_v2-1.jpg',
  updated_at = now()
where name = 'Skyline Sports'
  and team_id = '147'
  and is_approved = true;

-- Bobcat Insider Podcast — official ART19 RSS artwork (1400x1400), Apple ID 1381494746
update public.media_sources
set
  logo_url = 'https://content.production.cdn.art19.com/images/91/d5/06/ee/91d506ee-e852-4114-bd01-b7855c2d7dd8/833eb7d1a596946b816a71c7a855e6049f0a9c67058a8b350937ab0c715edb7d0f8e927e62e63b78941119e7c84db0835a2632bdb5d8516f8bdf37eb4913c3f7.jpeg',
  updated_at = now()
where name = 'Bobcat Insider Podcast'
  and team_id = '147'
  and is_approved = true;

-- Cat Griz Insider Podcast — official podcast RSS artwork (1400x1400), Apple ID 1635183341
update public.media_sources
set
  logo_url = 'https://play.cdnstream1.com/zjb/image/download/bf/63/3d/bf633dff-3bb6-45d4-8632-1b22a23dccfc_1400.jpg',
  updated_at = now()
where name = 'Cat Griz Insider Podcast'
  and team_id = '147'
  and is_approved = true;

-- Cats Pawd — official Anchor/Spotify for Podcasters RSS artwork (3000x3000), Apple ID 1708805918
update public.media_sources
set
  logo_url = 'https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/29961837/29961837-1726780717811-211375b6c65b7.jpg',
  updated_at = now()
where name = 'Cats Pawd'
  and team_id = '147'
  and is_approved = true;

-- R&R Cat Cast — official Anchor RSS artwork (3000x3000); Apple title "RnR Cat Cast"
update public.media_sources
set
  logo_url = 'https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/1055348/1055348-1691163004760-2ec19f1cba8ac.jpg',
  updated_at = now()
where name = 'R&R Cat Cast'
  and team_id = '147'
  and is_approved = true;

-- Verification helper (optional):
-- select name, team_id, logo_url
-- from public.media_sources
-- where name in (
--   'FCS Fever Podcast',
--   'The Samuel Akem Show',
--   'Skyline Sports',
--   'Bobcat Insider Podcast',
--   'Cat Griz Insider Podcast',
--   'Cats Pawd',
--   'R&R Cat Cast'
-- )
-- order by name;

commit;
