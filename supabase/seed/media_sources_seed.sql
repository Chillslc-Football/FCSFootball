-- Optional seed for public.media_sources (flexible coverage)
-- URLs intentionally NULL until verified. Do not invent links.
-- Montana State ESPN team id: 147
-- Montana ESPN team id: 149
--
-- Run after migrations (including media_source_coverage).
-- Local app fallback: src/data/mediaDirectory/mediaSourcesSeed.ts

insert into public.media_sources (
  name, subtitle, description, scope, conference_id, team_id,
  logo_url, spotify_url, youtube_url, x_url, apple_podcast_url,
  is_approved, display_order, is_national
)
select
  v.name, v.subtitle, v.description, v.scope, v.conference_id, v.team_id,
  null, null, null, null, null, true, v.display_order, v.is_national
from (
  values
    ('FCS Fans Nation Podcast', 'National FCS podcast'::text, null::text, 'national', null::text, null::text, 10, true),
    ('FCS Fever Podcast', 'National FCS podcast', null, 'national', null, null, 20, true),
    ('FCS Football Talk', 'Sam Herder', null, 'national', null, null, 30, true),
    ('FCS Nation', 'National FCS coverage', null, 'national', null, null, 40, true),
    ('Hack City', 'FBS and FCS football', null, 'national', null, null, 50, true),
    ('MONDAK Football Show', 'Montana and Dakota football', null, 'national', null, null, 60, true),
    ('FCS Delivered', 'Gary Reasons and Craig Haley', null, 'national', null, null, 70, true),
    ('The Bluebloods', 'College football coverage', null, 'national', null, null, 80, true),
    ('Deep Ball Podcast', 'College football podcast', null, 'national', null, null, 90, true),
    ('The Samuel Akem Show', 'FCS football and interviews', null, 'national', null, null, 100, true),
    ('Skyline Sports', 'Montana State and Big Sky coverage', null, 'team', 'big-sky', '147', 10, false),
    ('Bobcat Insider Podcast', 'Montana State football', null, 'team', 'big-sky', '147', 20, false),
    ('Cat Griz Insider Podcast', 'Montana State and Montana coverage', null, 'team', 'big-sky', '147', 30, false),
    ('Cats Pawd', 'Montana State football', null, 'team', 'big-sky', '147', 40, false),
    ('R&R Cat Cast', 'Montana State football', null, 'team', 'big-sky', '147', 50, false)
) as v(name, subtitle, description, scope, conference_id, team_id, display_order, is_national)
where not exists (
  select 1 from public.media_sources s where s.name = v.name
);

-- Refresh subtitles / is_national for existing seed rows
update public.media_sources s
set
  subtitle = v.subtitle,
  is_national = v.is_national
from (
  values
    ('FCS Fans Nation Podcast', 'National FCS podcast', true),
    ('FCS Fever Podcast', 'National FCS podcast', true),
    ('FCS Football Talk', 'Sam Herder', true),
    ('FCS Nation', 'National FCS coverage', true),
    ('Hack City', 'FBS and FCS football', true),
    ('MONDAK Football Show', 'Montana and Dakota football', true),
    ('FCS Delivered', 'Gary Reasons and Craig Haley', true),
    ('The Bluebloods', 'College football coverage', true),
    ('Deep Ball Podcast', 'College football podcast', true),
    ('The Samuel Akem Show', 'FCS football and interviews', true),
    ('Skyline Sports', 'Montana State and Big Sky coverage', false),
    ('Bobcat Insider Podcast', 'Montana State football', false),
    ('Cat Griz Insider Podcast', 'Montana State and Montana coverage', false),
    ('Cats Pawd', 'Montana State football', false),
    ('R&R Cat Cast', 'Montana State football', false)
) as v(name, subtitle, is_national)
where s.name = v.name;

-- Team associations
insert into public.media_source_teams (media_source_id, team_id)
select s.id, v.team_id
from public.media_sources s
join (
  values
    ('Skyline Sports', '147'),
    ('Bobcat Insider Podcast', '147'),
    ('Cat Griz Insider Podcast', '147'),
    ('Cat Griz Insider Podcast', '149'),
    ('Cats Pawd', '147'),
    ('R&R Cat Cast', '147')
) as v(name, team_id) on s.name = v.name
on conflict do nothing;

-- Conference associations for team-local outlets that carry Big Sky metadata
insert into public.media_source_conferences (media_source_id, conference_id)
select s.id, 'big-sky'
from public.media_sources s
where s.name in (
  'Skyline Sports',
  'Bobcat Insider Podcast',
  'Cat Griz Insider Podcast',
  'Cats Pawd',
  'R&R Cat Cast'
)
on conflict do nothing;
