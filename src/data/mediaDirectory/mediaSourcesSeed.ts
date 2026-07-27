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
    is_approved: true,
    logo_url: partial.logo_url ?? null,
    ...partial,
    conference_id: partial.conference_id ?? conferenceIds[0] ?? null,
    team_id: partial.team_id ?? teamIds[0] ?? null,
    isNational,
    teamIds,
    conferenceIds,
  };
}

/** National FCS creators / shows (URLs pending verification). */
export const NATIONAL_MEDIA_SOURCE_SEEDS: MediaSource[] = [
  seedSource({
    id: 'seed-national-fcs-fans-nation',
    name: 'FCS Fans Nation Podcast',
    subtitle: 'National FCS podcast',
    description: null,
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    teamIds: [],
    conferenceIds: [],
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
    name: 'FCS Football Talk',
    subtitle: 'Sam Herder',
    description: null,
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    display_order: 30,
  }),
  seedSource({
    id: 'seed-national-fcs-nation',
    name: 'FCS Nation',
    subtitle: 'National FCS coverage',
    description: null,
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    display_order: 40,
  }),
  seedSource({
    id: 'seed-national-hack-city',
    name: 'Hack City',
    subtitle: 'FBS and FCS football',
    description: null,
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    display_order: 50,
  }),
  seedSource({
    id: 'seed-national-mondak',
    name: 'MONDAK Football Show',
    subtitle: 'Montana and Dakota football',
    description: null,
    scope: 'national',
    team_id: null,
    conference_id: null,
    // Keep minimal: national only until conference/team mappings are verified.
    isNational: true,
    teamIds: [],
    conferenceIds: [],
    display_order: 60,
  }),
  seedSource({
    id: 'seed-national-fcs-delivered',
    name: 'FCS Delivered',
    subtitle: 'Gary Reasons and Craig Haley',
    description: null,
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    display_order: 70,
  }),
  seedSource({
    id: 'seed-national-bluebloods',
    name: 'The Bluebloods',
    subtitle: 'College football coverage',
    description: null,
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    display_order: 80,
  }),
  seedSource({
    id: 'seed-national-deep-ball',
    name: 'Deep Ball Podcast',
    subtitle: 'College football podcast',
    description: null,
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
    display_order: 90,
  }),
  seedSource({
    id: 'seed-national-samuel-akem',
    name: 'The Samuel Akem Show',
    subtitle: 'FCS football and interviews',
    description: null,
    scope: 'national',
    team_id: null,
    conference_id: null,
    isNational: true,
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
