/**
 * Seed / fallback media sources.
 *
 * Provider URLs are intentionally null until verified — do not invent links.
 * When Supabase has no approved rows (or is offline), the Media screen uses this list.
 */
import {
  MONTANA_ESPN_TEAM_ID,
  MONTANA_STATE_ESPN_TEAM_ID,
  type MediaSource,
} from '@/data/mediaDirectory/types';

function seedSource(
  partial: Omit<
    MediaSource,
    | 'is_approved'
    | 'spotify_url'
    | 'youtube_url'
    | 'x_url'
    | 'apple_podcast_url'
    | 'logo_url'
    | 'isNational'
    | 'teamIds'
    | 'conferenceIds'
  > & {
    logo_url?: string | null;
    spotify_url?: string | null;
    youtube_url?: string | null;
    x_url?: string | null;
    apple_podcast_url?: string | null;
    is_approved?: boolean;
    isNational?: boolean;
    teamIds?: string[];
    conferenceIds?: string[];
  },
): MediaSource {
  const teamIds = partial.teamIds ?? (partial.team_id ? [partial.team_id] : []);
  const conferenceIds =
    partial.conferenceIds ?? (partial.conference_id ? [partial.conference_id] : []);
  const isNational =
    typeof partial.isNational === 'boolean'
      ? partial.isNational
      : partial.scope === 'national';

  return {
    spotify_url: null,
    youtube_url: null,
    x_url: null,
    apple_podcast_url: null,
    logo_url: partial.logo_url ?? null,
    ...partial,
    conference_id: partial.conference_id ?? conferenceIds[0] ?? null,
    team_id: partial.team_id ?? teamIds[0] ?? null,
    isNational,
    teamIds,
    conferenceIds,
    is_approved:
      typeof partial.is_approved === 'boolean' ? partial.is_approved : true,
  };
}

/** National FCS creators / shows (provider URLs null until verified). */
export const NATIONAL_MEDIA_SOURCE_SEEDS: MediaSource[] = [
  seedSource({
    id: 'seed-national-fcs-fans-nation',
    name: 'FCS Fans Nation Podcast',
    subtitle: 'The official podcast of FCS Fans Nation',
    description:
      'Fan-driven national FCS discussion, playoff coverage, predictions, interviews, and community conversation.',
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    teamIds: [],
    conferenceIds: [],
    spotify_url: 'https://open.spotify.com/show/2a4H7yGK9qhnEvEEtutY3b',
    youtube_url: 'https://www.youtube.com/@fansnationnetwork',
    x_url: 'https://x.com/FCSFansNation',
    apple_podcast_url: 'https://podcasts.apple.com/us/podcast/fcs-fans-nation/id1396220851',
    logo_url: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f265f4b979acced72b902cb87',
    display_order: 10,
  }),
  seedSource({
    id: 'seed-national-fcs-fever',
    name: 'FCS Fever Podcast',
    subtitle: 'National FCS podcast',
    description: null,
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    display_order: 20,
  }),
  seedSource({
    id: 'seed-national-fcs-football-talk',
    name: 'FCS Football Talk Network',
    subtitle: 'Hosted by Sam Herder',
    description:
      'National FCS news, analysis, interviews, previews, and reactions hosted by HERO Sports senior FCS analyst Sam Herder.',
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    spotify_url: 'https://open.spotify.com/show/05PMJM5ReG5q5ByFlAR6Ug',
    youtube_url: null,
    x_url: 'https://x.com/SamHerderFCS',
    apple_podcast_url:
      'https://podcasts.apple.com/us/podcast/fcs-football-talk-network/id1205671649',
    logo_url: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f3658535277a900cc4f2b12ec',
    display_order: 30,
  }),
  seedSource({
    id: 'seed-national-fcs-nation',
    name: 'FCS Nation',
    subtitle: 'Hosted by Kevin Marshall and Stone Labanowitz',
    description:
      'A national FCS podcast covering teams, conferences, storylines, and matchups from across the subdivision.',
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    spotify_url: 'https://open.spotify.com/show/34bJPYDMpfFxKtwiWGscHn',
    youtube_url: null,
    x_url: null,
    apple_podcast_url: null,
    logo_url: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f2140c37764122d36e9d82d98',
    display_order: 40,
  }),
  seedSource({
    id: 'seed-national-hack-city',
    name: 'Hack City - FBS and FCS Football',
    subtitle: 'Hosted by Joe DeLeone and Sean Anderson',
    description:
      'Weekly FCS and FBS college football coverage, analysis, previews, reactions, and interviews from Joe DeLeone and Sean Anderson.',
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    spotify_url: 'https://open.spotify.com/show/58Z0sHcTgyXTGIihrKi0j7',
    youtube_url: 'https://www.youtube.com/c/HackCityFootball',
    x_url: null,
    apple_podcast_url:
      'https://podcasts.apple.com/us/podcast/hack-city-fbs-and-fcs-football/id1458677310',
    logo_url: 'https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1fd647eec00879e7f9927f5a12',
    display_order: 50,
  }),
  seedSource({
    id: 'seed-national-mondak',
    name: 'MONDAK Football Show',
    subtitle: 'Hosted by Sam Herder and Brad Jones',
    description:
      'A syndicated FCS football show focused on Montana, North Dakota, and South Dakota, hosted by national FCS analyst Sam Herder and Brad Jones.',
    scope: 'national',
    team_id: null,
    conference_id: null,
    // Keep minimal: national only until conference/team mappings are verified.
    isNational: true,
    teamIds: [],
    conferenceIds: [],
    spotify_url: 'https://open.spotify.com/show/0MGposfqYN5iCGknVxntzN',
    youtube_url: null,
    x_url: 'https://x.com/SamHerderFCS',
    apple_podcast_url: null,
    logo_url: 'https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1f24281e17df640e02a8732517',
    display_order: 60,
  }),
  seedSource({
    id: 'seed-national-fcs-delivered',
    name: 'FCS Delivered',
    subtitle: 'Hosted by Craig Haley and Gary Reasons',
    description:
      'National FCS analysis, rankings, predictions, interviews, and postseason coverage from Craig Haley and Gary Reasons.',
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    is_approved: false,
    spotify_url: null,
    youtube_url: null,
    x_url: null,
    apple_podcast_url: null,
    display_order: 70,
  }),
  seedSource({
    id: 'seed-national-fcs-edge',
    name: 'The FCS Edge',
    subtitle: 'Hosted by Craig Haley',
    description:
      'National FCS football news, analysis, rankings, interviews, playoff coverage, and weekly discussion hosted by longtime FCS analyst Craig Haley.',
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    is_approved: true,
    spotify_url: 'https://open.spotify.com/show/2qKKQujG0zPfDeM1v3SOtS',
    youtube_url: null,
    x_url: null,
    apple_podcast_url: 'https://podcasts.apple.com/us/podcast/the-fcs-edge/id1699176837',
    logo_url: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1ffd6ebfa5f150b3328fe35a69',
    display_order: 75,
  }),
  seedSource({
    id: 'seed-national-bluebloods',
    name: 'The Bluebloods',
    subtitle: 'FCS Football Central',
    description:
      'National FCS football news, interviews, conference previews, rankings, playoff coverage, and analysis hosted by Zach McKinnell.',
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    spotify_url: 'https://open.spotify.com/show/6azBEcGCeKA5NVDx3fqv1k',
    youtube_url: null,
    x_url: 'https://x.com/The__Bluebloods',
    apple_podcast_url: 'https://podcasts.apple.com/us/podcast/the-bluebloods/id1479796246',
    logo_url: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1fbd21c657bb5a0d75305946d0',
    display_order: 80,
  }),
  seedSource({
    id: 'seed-national-deep-ball',
    name: 'The Deep Ball Podcast',
    subtitle: 'Hosted by Samuel Akem and Keenan Curran',
    description:
      'Football interviews and in-depth conversations with coaches, players, and people around the game, hosted by former Montana players Samuel Akem and Keenan Curran.',
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    spotify_url: 'https://open.spotify.com/show/6rZfZEWBHgOSo9Qu69EbF5',
    youtube_url: 'https://www.youtube.com/@DeepBallPodcast',
    x_url: null,
    apple_podcast_url:
      'https://podcasts.apple.com/us/podcast/the-deep-ball-podcast/id1869691465',
    logo_url: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1fc40e36e37f64572ed91e4c2e',
    display_order: 90,
  }),
  seedSource({
    id: 'seed-national-samuel-akem',
    name: 'The Samuel Akem Show',
    subtitle: 'Hosted by Samuel Akem',
    description:
      'FCS and college football commentary, interviews, reactions, and analysis from former Montana wide receiver Samuel Akem.',
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    spotify_url: null,
    youtube_url: 'https://www.youtube.com/channel/UCAx30nrtgXLFUdmqQhxD0GA',
    x_url: 'https://x.com/SamuelAkemShow',
    apple_podcast_url: null,
    display_order: 100,
  }),
];

/**
 * Montana State–scoped creators.
 * Cat Griz Insider covers Montana State + Montana.
 */
export const MONTANA_STATE_MEDIA_SOURCE_SEEDS: MediaSource[] = [
  seedSource({
    id: 'seed-mtst-skyline',
    name: 'Skyline Sports',
    subtitle: 'Montana State and Big Sky coverage',
    description: null,
    scope: 'team',
    team_id: MONTANA_STATE_ESPN_TEAM_ID,
    conference_id: 'big-sky',
    isNational: false,
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    conferenceIds: ['big-sky'],
    display_order: 10,
  }),
  seedSource({
    id: 'seed-mtst-bobcat-insider',
    name: 'Bobcat Insider Podcast',
    subtitle: 'Montana State football',
    description: null,
    scope: 'team',
    team_id: MONTANA_STATE_ESPN_TEAM_ID,
    conference_id: 'big-sky',
    isNational: false,
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    conferenceIds: ['big-sky'],
    display_order: 20,
  }),
  seedSource({
    id: 'seed-mtst-cat-griz-insider',
    name: 'Cat Griz Insider Podcast',
    subtitle: 'Montana State and Montana coverage',
    description: null,
    scope: 'team',
    team_id: MONTANA_STATE_ESPN_TEAM_ID,
    conference_id: 'big-sky',
    isNational: false,
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID, MONTANA_ESPN_TEAM_ID],
    conferenceIds: ['big-sky'],
    display_order: 30,
  }),
  seedSource({
    id: 'seed-mtst-cats-pawd',
    name: 'Cats Pawd',
    subtitle: 'Montana State football',
    description: null,
    scope: 'team',
    team_id: MONTANA_STATE_ESPN_TEAM_ID,
    conference_id: 'big-sky',
    isNational: false,
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    conferenceIds: ['big-sky'],
    display_order: 40,
  }),
  seedSource({
    id: 'seed-mtst-rr-cat-cast',
    name: 'R&R Cat Cast',
    subtitle: 'Montana State football',
    description: null,
    scope: 'team',
    team_id: MONTANA_STATE_ESPN_TEAM_ID,
    conference_id: 'big-sky',
    isNational: false,
    teamIds: [MONTANA_STATE_ESPN_TEAM_ID],
    conferenceIds: ['big-sky'],
    display_order: 50,
  }),
];

export const MEDIA_SOURCE_SEEDS: MediaSource[] = [
  ...NATIONAL_MEDIA_SOURCE_SEEDS,
  ...MONTANA_STATE_MEDIA_SOURCE_SEEDS,
];

/** Optional SQL insert helper text for operators (URLs left null). */
export const MEDIA_SOURCES_SEED_SQL_NOTE = `
-- Optional: insert seed rows after migration (URLs null until verified).
-- Prefer editing in Supabase dashboard or a one-off SQL script.
-- Local app fallback: src/data/mediaDirectory/mediaSourcesSeed.ts
`;
