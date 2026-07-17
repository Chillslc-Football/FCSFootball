import type { ConferenceStandingEntry } from '@/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function parseLogoUrl(team: Record<string, unknown>): string | undefined {
  const logos = team.logos;
  if (!Array.isArray(logos)) return undefined;

  for (const logo of logos) {
    if (!isRecord(logo)) continue;
    const href = asString(logo.href);
    if (href) return href;
  }

  return undefined;
}

function findStatSummary(
  stats: unknown[],
  type: string,
): { summary?: string; displayValue?: string; value?: number } | undefined {
  for (const stat of stats) {
    if (!isRecord(stat)) continue;
    if (asString(stat.type) !== type) continue;

    return {
      summary: asString(stat.summary),
      displayValue: asString(stat.displayValue),
      value: asNumber(stat.value),
    };
  }

  return undefined;
}

export function parseWinLossRecord(value: string | undefined): { wins: number; losses: number } {
  if (!value?.trim()) return { wins: 0, losses: 0 };

  const match = /^(\d+)\s*-\s*(\d+)/.exec(value.trim());
  if (!match) return { wins: 0, losses: 0 };

  return {
    wins: Number(match[1]) || 0,
    losses: Number(match[2]) || 0,
  };
}

function pickRecordDisplay(
  stat: { summary?: string; displayValue?: string } | undefined,
): string {
  const summary = stat?.summary?.trim();
  if (summary && summary !== '-') return summary;

  const displayValue = stat?.displayValue?.trim();
  if (displayValue && displayValue !== '-') return displayValue;

  return '—';
}

function parseStandingEntry(
  entry: Record<string, unknown>,
  espnOrder: number,
): ConferenceStandingEntry | null {
  const team = isRecord(entry.team) ? entry.team : undefined;
  if (!team) return null;

  const teamId = asString(team.id);
  const displayName = asString(team.displayName) ?? asString(team.name);
  if (!displayName) return null;

  const stats = Array.isArray(entry.stats) ? entry.stats : [];
  const conferenceStat = findStatSummary(stats, 'vsconf');
  const overallStat = findStatSummary(stats, 'total');
  const leagueWinPctStat = findStatSummary(stats, 'vsconf_leaguewinpercent');

  const conferenceRecord = pickRecordDisplay(conferenceStat);
  const overallRecord = pickRecordDisplay(overallStat);
  const conferenceParsed = parseWinLossRecord(conferenceRecord);
  const overallParsed = parseWinLossRecord(overallRecord);

  const conferenceWinPct =
    leagueWinPctStat?.value ??
    (conferenceParsed.wins + conferenceParsed.losses > 0
      ? conferenceParsed.wins / (conferenceParsed.wins + conferenceParsed.losses)
      : 0);

  const overallWinPct =
    overallParsed.wins + overallParsed.losses > 0
      ? overallParsed.wins / (overallParsed.wins + overallParsed.losses)
      : 0;

  return {
    teamId,
    displayName,
    shortDisplayName: asString(team.shortDisplayName) ?? displayName,
    abbreviation: asString(team.abbreviation),
    logoUrl: parseLogoUrl(team),
    conferenceRecord,
    overallRecord,
    conferenceWins: conferenceParsed.wins,
    conferenceLosses: conferenceParsed.losses,
    conferenceWinPct,
    overallWinPct,
    espnOrder,
  };
}

export type EspnStandingsParseResult = {
  entries: ConferenceStandingEntry[];
  conferenceName?: string;
};

export function parseEspnConferenceStandings(raw: unknown): EspnStandingsParseResult {
  if (!isRecord(raw)) {
    return { entries: [] };
  }

  const standingsRoot = isRecord(raw.standings) ? raw.standings : undefined;
  const entriesRaw = standingsRoot?.entries;
  if (!Array.isArray(entriesRaw)) {
    return { entries: [], conferenceName: asString(raw.name) };
  }

  const entries = entriesRaw
    .map((entry, index) => (isRecord(entry) ? parseStandingEntry(entry, index) : null))
    .filter((entry): entry is ConferenceStandingEntry => entry != null);

  return {
    entries,
    conferenceName: asString(raw.name),
  };
}

export function sortConferenceStandings(
  entries: ConferenceStandingEntry[],
): ConferenceStandingEntry[] {
  const hasEspnOrder = entries.some((entry) => entry.espnOrder >= 0);
  if (hasEspnOrder) {
    return [...entries].sort((a, b) => a.espnOrder - b.espnOrder);
  }

  return [...entries].sort((a, b) => {
    if (b.conferenceWinPct !== a.conferenceWinPct) {
      return b.conferenceWinPct - a.conferenceWinPct;
    }
    if (b.conferenceWins !== a.conferenceWins) {
      return b.conferenceWins - a.conferenceWins;
    }
    return b.overallWinPct - a.overallWinPct;
  });
}
