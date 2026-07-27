-- Optional seed for public.media_sources (flexible coverage)
-- Provider URLs null until verified. Do not invent links.
-- Montana State ESPN team id: 147
-- Montana ESPN team id: 149
--
-- Run after migrations (including media_source_coverage).
-- Local app fallback: src/data/mediaDirectory/mediaSourcesSeed.ts

-- Preserve stable rows when renaming display names (SQL matches by name; app seeds use fixed ids).
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

insert into public.media_sources (
  name, subtitle, description, scope, conference_id, team_id,
  logo_url, spotify_url, youtube_url, x_url, apple_podcast_url,
  is_approved, display_order, is_national
)
select
  v.name, v.subtitle, v.description, v.scope, v.conference_id, v.team_id,
  v.logo_url, v.spotify_url, v.youtube_url, v.x_url, v.apple_podcast_url,
  v.is_approved, v.display_order, v.is_national
from (
  values
    (
      'FCS Fans Nation Podcast',
      'The official podcast of FCS Fans Nation'::text,
      'Fan-driven national FCS discussion, playoff coverage, predictions, interviews, and community conversation.'::text,
      'national',
      null::text,
      null::text,
      null::text,
      'https://open.spotify.com/show/2a4H7yGK9qhnEvEEtutY3b'::text,
      'https://www.youtube.com/@fansnationnetwork'::text,
      'https://x.com/FCSFansNation'::text,
      'https://podcasts.apple.com/us/podcast/fcs-fans-nation/id1396220851'::text,
      10,
      true,
      true
    ),
    (
      'FCS Fever Podcast',
      'National FCS podcast',
      null,
      'national',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      20,
      true,
      true
    ),
    (
      'FCS Football Talk Network',
      'Hosted by Sam Herder',
      'National FCS news, analysis, interviews, previews, and reactions hosted by HERO Sports senior FCS analyst Sam Herder.',
      'national',
      null,
      null,
      null,
      'https://open.spotify.com/show/05PMJM5ReG5q5ByFlAR6Ug',
      null,
      'https://x.com/SamHerderFCS',
      'https://podcasts.apple.com/us/podcast/fcs-football-talk-network/id1205671649',
      30,
      true,
      true
    ),
    (
      'FCS Nation',
      'Hosted by Kevin Marshall and Stone Labanowitz',
      'A national FCS podcast covering teams, conferences, storylines, and matchups from across the subdivision.',
      'national',
      null,
      null,
      null,
      'https://open.spotify.com/show/34bJPYDMpfFxKtwiWGscHn',
      null,
      null,
      null,
      40,
      true,
      true
    ),
    (
      'Hack City - FBS and FCS Football',
      'Hosted by Joe DeLeone and Sean Anderson',
      'Weekly FCS and FBS college football coverage, analysis, previews, reactions, and interviews from Joe DeLeone and Sean Anderson.',
      'national',
      null,
      null,
      null,
      'https://open.spotify.com/show/58Z0sHcTgyXTGIihrKi0j7',
      'https://www.youtube.com/c/HackCityFootball',
      null,
      'https://podcasts.apple.com/us/podcast/hack-city-fbs-and-fcs-football/id1458677310',
      50,
      true,
      true
    ),
    (
      'MONDAK Football Show',
      'Hosted by Sam Herder and Brad Jones',
      'A syndicated FCS football show focused on Montana, North Dakota, and South Dakota, hosted by national FCS analyst Sam Herder and Brad Jones.',
      'national',
      null,
      null,
      null,
      'https://open.spotify.com/show/0MGposfqYN5iCGknVxntzN',
      null,
      'https://x.com/SamHerderFCS',
      null,
      60,
      true,
      true
    ),
    (
      'FCS Delivered',
      'Hosted by Craig Haley and Gary Reasons',
      'National FCS analysis, rankings, predictions, interviews, and postseason coverage from Craig Haley and Gary Reasons.',
      'national',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      70,
      false,
      true
    ),
    (
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
      75,
      true,
      true
    ),
    (
      'The Bluebloods',
      'FCS Football Central',
      'National FCS football news, interviews, conference previews, rankings, playoff coverage, and analysis hosted by Zach McKinnell.',
      'national',
      null,
      null,
      null,
      'https://open.spotify.com/show/6azBEcGCeKA5NVDx3fqv1k',
      null,
      'https://x.com/The__Bluebloods',
      'https://podcasts.apple.com/us/podcast/the-bluebloods/id1479796246',
      80,
      true,
      true
    ),
    (
      'The Deep Ball Podcast',
      'Hosted by Samuel Akem and Keenan Curran',
      'Football interviews and in-depth conversations with coaches, players, and people around the game, hosted by former Montana players Samuel Akem and Keenan Curran.',
      'national',
      null,
      null,
      null,
      'https://open.spotify.com/show/6rZfZEWBHgOSo9Qu69EbF5',
      'https://www.youtube.com/@DeepBallPodcast',
      null,
      'https://podcasts.apple.com/us/podcast/the-deep-ball-podcast/id1869691465',
      90,
      true,
      true
    ),
    (
      'The Samuel Akem Show',
      'Hosted by Samuel Akem',
      'FCS and college football commentary, interviews, reactions, and analysis from former Montana wide receiver Samuel Akem.',
      'national',
      null,
      null,
      null,
      null,
      'https://www.youtube.com/channel/UCAx30nrtgXLFUdmqQhxD0GA',
      'https://x.com/SamuelAkemShow',
      null,
      100,
      true,
      true
    ),
    (
      'Skyline Sports',
      'Montana State and Big Sky coverage',
      null,
      'team',
      'big-sky',
      '147',
      null,
      null,
      null,
      null,
      null,
      10,
      true,
      false
    ),
    (
      'Bobcat Insider Podcast',
      'Montana State football',
      null,
      'team',
      'big-sky',
      '147',
      null,
      null,
      null,
      null,
      null,
      20,
      true,
      false
    ),
    (
      'Cat Griz Insider Podcast',
      'Montana State and Montana coverage',
      null,
      'team',
      'big-sky',
      '147',
      null,
      null,
      null,
      null,
      null,
      30,
      true,
      false
    ),
    (
      'Cats Pawd',
      'Montana State football',
      null,
      'team',
      'big-sky',
      '147',
      null,
      null,
      null,
      null,
      null,
      40,
      true,
      false
    ),
    (
      'R&R Cat Cast',
      'Montana State football',
      null,
      'team',
      'big-sky',
      '147',
      null,
      null,
      null,
      null,
      null,
      50,
      true,
      false
    )
) as v(
  name, subtitle, description, scope, conference_id, team_id,
  logo_url, spotify_url, youtube_url, x_url, apple_podcast_url,
  display_order, is_approved, is_national
)
where not exists (
  select 1 from public.media_sources s where s.name = v.name
);

-- Refresh copy / provider URLs / approval / is_national for existing seed rows
update public.media_sources s
set
  subtitle = v.subtitle,
  description = v.description,
  spotify_url = v.spotify_url,
  youtube_url = v.youtube_url,
  x_url = v.x_url,
  apple_podcast_url = v.apple_podcast_url,
  is_approved = v.is_approved,
  is_national = v.is_national
from (
  values
    (
      'FCS Fans Nation Podcast',
      'The official podcast of FCS Fans Nation'::text,
      'Fan-driven national FCS discussion, playoff coverage, predictions, interviews, and community conversation.'::text,
      'https://open.spotify.com/show/2a4H7yGK9qhnEvEEtutY3b'::text,
      'https://www.youtube.com/@fansnationnetwork'::text,
      'https://x.com/FCSFansNation'::text,
      'https://podcasts.apple.com/us/podcast/fcs-fans-nation/id1396220851'::text,
      true,
      true
    ),
    (
      'FCS Fever Podcast',
      'National FCS podcast',
      null,
      null,
      null,
      null,
      null,
      true,
      true
    ),
    (
      'FCS Football Talk Network',
      'Hosted by Sam Herder',
      'National FCS news, analysis, interviews, previews, and reactions hosted by HERO Sports senior FCS analyst Sam Herder.',
      'https://open.spotify.com/show/05PMJM5ReG5q5ByFlAR6Ug',
      null,
      'https://x.com/SamHerderFCS',
      'https://podcasts.apple.com/us/podcast/fcs-football-talk-network/id1205671649',
      true,
      true
    ),
    (
      'FCS Nation',
      'Hosted by Kevin Marshall and Stone Labanowitz',
      'A national FCS podcast covering teams, conferences, storylines, and matchups from across the subdivision.',
      'https://open.spotify.com/show/34bJPYDMpfFxKtwiWGscHn',
      null,
      null,
      null,
      true,
      true
    ),
    (
      'Hack City - FBS and FCS Football',
      'Hosted by Joe DeLeone and Sean Anderson',
      'Weekly FCS and FBS college football coverage, analysis, previews, reactions, and interviews from Joe DeLeone and Sean Anderson.',
      'https://open.spotify.com/show/58Z0sHcTgyXTGIihrKi0j7',
      'https://www.youtube.com/c/HackCityFootball',
      null,
      'https://podcasts.apple.com/us/podcast/hack-city-fbs-and-fcs-football/id1458677310',
      true,
      true
    ),
    (
      'MONDAK Football Show',
      'Hosted by Sam Herder and Brad Jones',
      'A syndicated FCS football show focused on Montana, North Dakota, and South Dakota, hosted by national FCS analyst Sam Herder and Brad Jones.',
      'https://open.spotify.com/show/0MGposfqYN5iCGknVxntzN',
      null,
      'https://x.com/SamHerderFCS',
      null,
      true,
      true
    ),
    (
      'FCS Delivered',
      'Hosted by Craig Haley and Gary Reasons',
      'National FCS analysis, rankings, predictions, interviews, and postseason coverage from Craig Haley and Gary Reasons.',
      null,
      null,
      null,
      null,
      false,
      true
    ),
    (
      'The FCS Edge',
      'Hosted by Craig Haley',
      'National FCS football news, analysis, rankings, interviews, playoff coverage, and weekly discussion hosted by longtime FCS analyst Craig Haley.',
      'https://open.spotify.com/show/2qKKQujG0zPfDeM1v3SOtS',
      null,
      null,
      'https://podcasts.apple.com/us/podcast/the-fcs-edge/id1699176837',
      true,
      true
    ),
    (
      'The Bluebloods',
      'FCS Football Central',
      'National FCS football news, interviews, conference previews, rankings, playoff coverage, and analysis hosted by Zach McKinnell.',
      'https://open.spotify.com/show/6azBEcGCeKA5NVDx3fqv1k',
      null,
      'https://x.com/The__Bluebloods',
      'https://podcasts.apple.com/us/podcast/the-bluebloods/id1479796246',
      true,
      true
    ),
    (
      'The Deep Ball Podcast',
      'Hosted by Samuel Akem and Keenan Curran',
      'Football interviews and in-depth conversations with coaches, players, and people around the game, hosted by former Montana players Samuel Akem and Keenan Curran.',
      'https://open.spotify.com/show/6rZfZEWBHgOSo9Qu69EbF5',
      'https://www.youtube.com/@DeepBallPodcast',
      null,
      'https://podcasts.apple.com/us/podcast/the-deep-ball-podcast/id1869691465',
      true,
      true
    ),
    (
      'The Samuel Akem Show',
      'Hosted by Samuel Akem',
      'FCS and college football commentary, interviews, reactions, and analysis from former Montana wide receiver Samuel Akem.',
      null,
      'https://www.youtube.com/channel/UCAx30nrtgXLFUdmqQhxD0GA',
      'https://x.com/SamuelAkemShow',
      null,
      true,
      true
    ),
    (
      'Skyline Sports',
      'Montana State and Big Sky coverage',
      null,
      null,
      null,
      null,
      null,
      true,
      false
    ),
    (
      'Bobcat Insider Podcast',
      'Montana State football',
      null,
      null,
      null,
      null,
      null,
      true,
      false
    ),
    (
      'Cat Griz Insider Podcast',
      'Montana State and Montana coverage',
      null,
      null,
      null,
      null,
      null,
      true,
      false
    ),
    (
      'Cats Pawd',
      'Montana State football',
      null,
      null,
      null,
      null,
      null,
      true,
      false
    ),
    (
      'R&R Cat Cast',
      'Montana State football',
      null,
      null,
      null,
      null,
      null,
      true,
      false
    )
) as v(
  name, subtitle, description,
  spotify_url, youtube_url, x_url, apple_podcast_url,
  is_approved, is_national
)
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
