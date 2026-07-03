import { Linking } from 'react-native';

import type { EspnLinkCandidate, EspnNormalizedGame } from '@/types';

const ESPN_COLLEGE_FOOTBALL_GAME_WEB =
  'https://www.espn.com/college-football/game/_/gameId';

export type EspnWatchResolution = {
  gameId: string;
  espnUid?: string;
  apiUrls: EspnLinkCandidate[];
  deepLinkCandidates: string[];
  webUrl: string | null;
  appDeepLink: string | null;
  enabled: boolean;
  disabledReason?: string;
  /** URL the Watch button will try first (app) or fall back to (web) */
  preferredUrl: string | null;
  openedUrl?: string;
  notes: string[];
};

function isAppDeepLink(href: string): boolean {
  return /^(sportscenter|espnapp|espnsportscenter):\/\//i.test(href);
}

/** Constructed Sportscenter game page deep link from ESPN event uid. */
export function buildSportscenterGameDeepLink(uid: string): string {
  return `sportscenter://x-callback-url/showGame?uid=${encodeURIComponent(uid)}`;
}

/** Minimal web gamecast URL when ESPN only supplies a game id. */
export function buildEspnWebGameUrl(gameId: string): string {
  return `${ESPN_COLLEGE_FOOTBALL_GAME_WEB}/${gameId}`;
}

function collectApiDeepLinks(candidates: EspnLinkCandidate[]): string[] {
  const urls: string[] = [];
  for (const candidate of candidates) {
    if (isAppDeepLink(candidate.href)) {
      urls.push(candidate.href);
    }
  }
  return urls;
}

function pickWebUrl(game: EspnNormalizedGame): { url: string | null; source: string } {
  if (game.espnLink?.startsWith('http')) {
    return { url: game.espnLink, source: 'espn_api_primary_link' };
  }

  for (const candidate of game.espnLinkCandidates ?? []) {
    if (!candidate.href.startsWith('http')) continue;
    const isEventLink = candidate.rel.some(
      (rel) => rel === 'event' || rel === 'summary' || rel === 'boxscore',
    );
    if (isEventLink && candidate.href.includes('espn.com')) {
      return { url: candidate.href, source: 'espn_api_event_link' };
    }
  }

  for (const candidate of game.espnLinkCandidates ?? []) {
    if (candidate.href.startsWith('http') && candidate.href.includes('espn.com')) {
      return { url: candidate.href, source: 'espn_api_any_web_link' };
    }
  }

  if (game.id) {
    return { url: buildEspnWebGameUrl(game.id), source: 'constructed_from_game_id' };
  }

  return { url: null, source: 'none' };
}

/**
 * ESPN web game summary / gamecast URL for a normalized game.
 * Prefers espnLink and event/summary/boxscore links — not mobile streaming deep links.
 */
export function resolveEspnGameSummaryUrl(game: EspnNormalizedGame): string | null {
  return pickWebUrl(game).url;
}

export async function openEspnGameSummary(game: EspnNormalizedGame): Promise<boolean> {
  const url = resolveEspnGameSummaryUrl(game);
  if (!url) return false;

  try {
    await Linking.openURL(url);
    return true;
  } catch (err) {
    console.warn('[ESPN Game Summary] open failed', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Resolve Watch on ESPN targets for a normalized game.
 *
 * ESPN FCS scoreboard events expose a desktop gamecast web URL and event uid.
 * Mobile sportscenter:// links are not included on events — we construct showGame from uid.
 * Live video playID deep links are not present on the scoreboard payload.
 */
export function resolveEspnWatchTargets(game: EspnNormalizedGame): EspnWatchResolution {
  const apiUrls = game.espnLinkCandidates ?? [];
  const deepLinkCandidates = collectApiDeepLinks(apiUrls);
  const notes: string[] = [];

  if (game.espnUid) {
    const constructed = buildSportscenterGameDeepLink(game.espnUid);
    if (!deepLinkCandidates.includes(constructed)) {
      deepLinkCandidates.push(constructed);
      notes.push(
        'No sportscenter:// link in ESPN event.links — constructed showGame deep link from espnUid.',
      );
    }
  } else {
    notes.push('ESPN event uid missing — cannot construct Sportscenter showGame deep link.');
  }

  if (deepLinkCandidates.length === 0) {
    notes.push(
      'Scoreboard API does not include mobile event links for FCS games (only desktop Gamecast).',
    );
  }

  const { url: webUrl, source: webSource } = pickWebUrl(game);
  if (webSource === 'constructed_from_game_id') {
    notes.push('Web URL constructed from game id — slug not included.');
  }

  const appDeepLink = deepLinkCandidates[0] ?? null;
  const enabled = Boolean(webUrl || appDeepLink);

  let disabledReason: string | undefined;
  if (!enabled) {
    disabledReason = 'No ESPN game id or URLs available for this game.';
  }

  const preferredUrl = appDeepLink ?? webUrl;

  return {
    gameId: game.id,
    espnUid: game.espnUid,
    apiUrls,
    deepLinkCandidates,
    webUrl,
    appDeepLink,
    enabled,
    disabledReason,
    preferredUrl,
    notes,
  };
}

export async function openWatchOnEspn(game: EspnNormalizedGame): Promise<EspnWatchResolution> {
  const resolution = resolveEspnWatchTargets(game);

  if (!resolution.enabled) {
    console.log('[Watch ESPN] disabled', {
      gameId: resolution.gameId,
      reason: resolution.disabledReason,
      espnUid: resolution.espnUid,
      apiUrls: resolution.apiUrls,
      deepLinkCandidates: resolution.deepLinkCandidates,
    });
    return resolution;
  }

  try {
    if (resolution.appDeepLink) {
      const canOpenApp = await Linking.canOpenURL(resolution.appDeepLink);
      if (canOpenApp) {
        await Linking.openURL(resolution.appDeepLink);
        resolution.openedUrl = resolution.appDeepLink;
        console.log('[Watch ESPN] opened app deep link', resolution.appDeepLink);
        return resolution;
      }
      console.log(
        '[Watch ESPN] app deep link not available — falling back to web',
        resolution.appDeepLink,
      );
    }

    if (resolution.webUrl) {
      await Linking.openURL(resolution.webUrl);
      resolution.openedUrl = resolution.webUrl;
      console.log('[Watch ESPN] opened web URL', resolution.webUrl);
      return resolution;
    }
  } catch (err) {
    console.log('[Watch ESPN] open failed', err instanceof Error ? err.message : err);
  }

  return resolution;
}
