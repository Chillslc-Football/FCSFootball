export const MEDIA_SOURCE_SCOPES = ['national', 'conference', 'team'] as const;
export type MediaSourceScope = (typeof MEDIA_SOURCE_SCOPES)[number];

/** @deprecated Prefer MediaPlatformLinkKey / platformLinks */
export const MEDIA_SUGGESTION_PROVIDERS = ['spotify', 'youtube', 'x'] as const;
/** @deprecated Prefer MediaPlatformLinkKey */
export type MediaSuggestionProvider = (typeof MEDIA_SUGGESTION_PROVIDERS)[number];

export const MEDIA_SUGGESTION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type MediaSuggestionStatus = (typeof MEDIA_SUGGESTION_STATUSES)[number];

export type {
  MediaPlatformLinkKey,
  MediaPlatformLinks,
} from '@/data/mediaDirectory/mediaPlatformLinks';

export type { MediaLinkRow } from '@/data/mediaDirectory/mediaLinkRows';

export type MediaSource = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  /** @deprecated Prefer isNational / teamIds / conferenceIds */
  scope: MediaSourceScope;
  /** @deprecated Prefer conferenceIds */
  conference_id: string | null;
  /** @deprecated Prefer teamIds */
  team_id: string | null;
  logo_url: string | null;
  /** @deprecated Prefer links[] */
  spotify_url: string | null;
  /** @deprecated Prefer links[] */
  youtube_url: string | null;
  /** @deprecated Prefer links[] */
  x_url: string | null;
  /** @deprecated Prefer links[] */
  apple_podcast_url: string | null;
  is_approved: boolean;
  display_order: number;
  /** Flexible coverage: national flag */
  isNational: boolean;
  /** Flexible coverage: associated ESPN team ids */
  teamIds: string[];
  /** Flexible coverage: associated conference ids */
  conferenceIds: string[];
  /** Repeatable platform links (preferred). */
  links: import('@/data/mediaDirectory/mediaLinkRows').MediaLinkRow[];
  created_at?: string;
  updated_at?: string;
};

export type MediaSuggestion = {
  id: string;
  name: string | null;
  /** @deprecated Prefer platformLinks; kept as primary platform key */
  provider: string;
  /** @deprecated Prefer platformLinks; kept as primary URL */
  submitted_url: string;
  platformLinks: import('@/data/mediaDirectory/mediaPlatformLinks').MediaPlatformLinks;
  /** @deprecated Prefer isNational / teamIds / conferenceIds */
  scope: MediaSourceScope;
  /** @deprecated Prefer conferenceIds */
  conference_id: string | null;
  /** @deprecated Prefer teamIds */
  team_id: string | null;
  notes: string | null;
  status: MediaSuggestionStatus;
  submitted_by: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  isNational: boolean;
  teamIds: string[];
  conferenceIds: string[];
};

export type MediaSuggestionInput = {
  name: string;
  /** Repeatable links (preferred). */
  links: import('@/data/mediaDirectory/mediaLinkRows').MediaLinkRow[];
  /**
   * Legacy one-URL-per-platform map (first URL per platform).
   * Still populated for email/compat; prefer `links`.
   */
  platformLinks: import('@/data/mediaDirectory/mediaPlatformLinks').MediaPlatformLinks;
  isNational: boolean;
  conferenceIds: string[];
  teamIds: string[];
  /** Required submitter contact email (owner clarification only; not public). */
  submitterEmail: string;
  notes?: string | null;
  /** Optional display labels for owner notification email. */
  coverageLabel?: string | null;
  /** Stored display maps for teams/conferences in owner email. */
  coverageLabels?: {
    teams?: Record<string, string>;
    conferences?: Record<string, string>;
  } | null;
};

/** ESPN team id used across FCS Pulse favorites / team routes. */
export const MONTANA_STATE_ESPN_TEAM_ID = '147';
export const MONTANA_STATE_TEAM_NAME = 'Montana State';

/**
 * ESPN college-football team id for Montana (Grizzlies).
 * Same identifier scheme as Montana State (`147`); used for Cat Griz multi-team coverage.
 */
export const MONTANA_ESPN_TEAM_ID = '149';
export const MONTANA_TEAM_NAME = 'Montana';
