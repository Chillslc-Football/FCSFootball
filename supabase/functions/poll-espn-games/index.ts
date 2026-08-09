// Supabase Edge Function: poll ESPN for favorite/followed games and send Expo pushes.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const ESPN_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard';
const ESPN_SUMMARY =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary';

const FETCH_TIMEOUT_MS = 8_000;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type DeviceRow = {
  id: string;
  expo_push_token: string | null;
  notifications_enabled: boolean;
};

type PreferenceRow = {
  device_id: string;
  game_start_enabled: boolean;
  score_enabled: boolean;
  quarter_end_enabled: boolean;
  halftime_enabled: boolean;
  close_game_enabled: boolean;
  final_enabled: boolean;
  favorite_games_enabled: boolean;
};

type FavoriteRow = {
  device_id: string;
  espn_team_id: string;
};

type FollowedRow = {
  device_id: string;
  event_id: string;
};

type MonitoredGameRow = {
  event_id: string;
  away_team_id: string | null;
  home_team_id: string | null;
  kickoff_at: string | null;
  state: string | null;
  status_name: string | null;
  period: number | null;
  display_clock: string | null;
  away_score: number | null;
  home_score: number | null;
  espn_close_game_active: boolean | null;
};

type EspnEvent = {
  id: string;
  date?: string;
  status?: {
    period?: number;
    displayClock?: string;
    type?: {
      state?: string;
      name?: string;
      description?: string;
    };
  };
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: string;
      score?: string;
      team?: { id?: string; displayName?: string };
    }>;
  }>;
};

type ScoringPlay = {
  id?: string;
  text?: string;
  awayScore?: number;
  homeScore?: number;
  period?: { number?: number };
  clock?: { displayValue?: string };
  team?: { id?: string; displayName?: string };
  type?: { text?: string };
  scoringType?: { displayName?: string };
};

type PendingNotification = {
  deviceId: string;
  pushToken: string;
  eventId: string;
  dedupeKey: string;
  notificationType: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

function log(message: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({ message, ...extra }));
}

type BackendKeyResolution = {
  key: string;
  source: 'SUPABASE_SECRET_KEYS.default' | 'SUPABASE_SECRET_KEYS.fallback' | 'SUPABASE_SERVICE_ROLE_KEY';
  keyKind: 'sb_secret' | 'legacy_jwt' | 'unknown';
};

type AdminClientDiagnostics = {
  hasSupabaseSecretKeys: boolean;
  hasSupabaseServiceRoleKey: boolean;
  selectedSource: BackendKeyResolution['source'] | null;
  keyKind: BackendKeyResolution['keyKind'] | null;
};

let lastAdminClientDiagnostics: AdminClientDiagnostics = {
  hasSupabaseSecretKeys: false,
  hasSupabaseServiceRoleKey: false,
  selectedSource: null,
  keyKind: null,
};

function describeKeyKind(key: string): BackendKeyResolution['keyKind'] {
  if (key.startsWith('sb_secret_')) return 'sb_secret';
  if (key.startsWith('eyJ')) return 'legacy_jwt';
  return 'unknown';
}

/** Prefer SUPABASE_SECRET_KEYS JSON default; fall back to SUPABASE_SERVICE_ROLE_KEY. Never log the key. */
function resolveBackendSecretKey(): BackendKeyResolution | null {
  const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS')?.trim();
  if (secretKeysRaw) {
    try {
      const parsed = JSON.parse(secretKeysRaw) as Record<string, unknown>;
      const defaultKey = parsed.default;
      if (typeof defaultKey === 'string' && defaultKey.trim()) {
        const key = defaultKey.trim();
        return {
          key,
          source: 'SUPABASE_SECRET_KEYS.default',
          keyKind: describeKeyKind(key),
        };
      }

      for (const value of Object.values(parsed)) {
        if (typeof value === 'string' && value.trim()) {
          const key = value.trim();
          return {
            key,
            source: 'SUPABASE_SECRET_KEYS.fallback',
            keyKind: describeKeyKind(key),
          };
        }
      }
    } catch (error) {
      log('backend_secret_keys_parse_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (serviceRoleKey) {
    return {
      key: serviceRoleKey,
      source: 'SUPABASE_SERVICE_ROLE_KEY',
      keyKind: describeKeyKind(serviceRoleKey),
    };
  }

  return null;
}

function logBackendKeyDiagnostics(resolution: BackendKeyResolution | null): AdminClientDiagnostics {
  const diagnostics: AdminClientDiagnostics = {
    hasSupabaseSecretKeys: Boolean(Deno.env.get('SUPABASE_SECRET_KEYS')?.trim()),
    hasSupabaseServiceRoleKey: Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()),
    selectedSource: resolution?.source ?? null,
    keyKind: resolution?.keyKind ?? null,
  };
  lastAdminClientDiagnostics = diagnostics;
  log('admin_client_key_diagnostics', diagnostics);
  return diagnostics;
}

function createAdminSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const resolution = resolveBackendSecretKey();
  logBackendKeyDiagnostics(resolution);

  if (!supabaseUrl || !resolution) {
    throw new Error(
      'Missing backend Supabase credentials. Set SUPABASE_URL and SUPABASE_SECRET_KEYS (or SUPABASE_SERVICE_ROLE_KEY).',
    );
  }

  return createClient(supabaseUrl, resolution.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FCSFootball-Poll/1.0',
      },
    });
    if (!response.ok) {
      log('espn_fetch_failed', { url, status: response.status });
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    log('espn_fetch_error', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseEvent(event: EspnEvent) {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const away = competitors.find((c) => c.homeAway === 'away');
  const home = competitors.find((c) => c.homeAway === 'home');
  const status = event.status;
  const state = status?.type?.state ?? null;
  const statusName = status?.type?.name ?? null;

  return {
    eventId: String(event.id),
    awayTeamId: away?.team?.id ? String(away.team.id) : null,
    homeTeamId: home?.team?.id ? String(home.team.id) : null,
    awayTeamName: away?.team?.displayName ?? 'Away',
    homeTeamName: home?.team?.displayName ?? 'Home',
    awayScore: away?.score != null ? Number(away.score) : null,
    homeScore: home?.score != null ? Number(home.score) : null,
    kickoffAt: event.date ?? null,
    state,
    statusName,
    statusDescription: status?.type?.description ?? null,
    period: status?.period ?? null,
    displayClock: status?.displayClock ?? null,
  };
}

function scoreLine(
  awayName: string,
  awayScore: number | null,
  homeName: string,
  homeScore: number | null,
): string {
  return `${awayName} ${awayScore ?? 0}, ${homeName} ${homeScore ?? 0}`;
}

function periodClockSuffix(period: number | null, clock: string | null): string {
  if (!period) return '';
  const clockText = clock && clock !== '0:00' ? ` · ${clock}` : '';
  return ` · Q${period}${clockText}`;
}

function scoringFallbackId(play: ScoringPlay): string {
  const parts = [
    play.period?.number ?? '',
    play.clock?.displayValue ?? '',
    play.team?.id ?? '',
    play.awayScore ?? '',
    play.homeScore ?? '',
    play.text ?? '',
  ];
  return parts.join('|');
}

function preferenceAllows(type: string, prefs: PreferenceRow | undefined): boolean {
  if (!prefs) return true;
  switch (type) {
    case 'game_start':
      return prefs.game_start_enabled;
    case 'score':
      return prefs.score_enabled;
    case 'quarter_end':
      return prefs.quarter_end_enabled;
    case 'halftime':
      return prefs.halftime_enabled;
    case 'close_game':
      return prefs.close_game_enabled;
    case 'final':
      return prefs.final_enabled;
    default:
      return true;
  }
}

async function sendExpoPush(messages: Array<Record<string, unknown>>) {
  if (messages.length === 0) return [];

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    log('expo_push_failed', { status: response.status });
    return [];
  }

  const payload = await response.json();
  return Array.isArray(payload.data) ? payload.data : [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  let supabase: SupabaseClient;
  try {
    supabase = createAdminSupabaseClient();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Missing backend Supabase credentials.';
    log('admin_client_init_failed', {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseSecretKeys: Boolean(Deno.env.get('SUPABASE_SECRET_KEYS')?.trim()),
      hasSupabaseServiceRoleKey: Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()),
    });
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }

  const pending: PendingNotification[] = [];

  const { data: devices, error: devicesError } = await supabase
    .from('devices')
    .select('id, expo_push_token, notifications_enabled')
    .eq('notifications_enabled', true)
    .not('expo_push_token', 'is', null);

  if (devicesError) {
    log('devices_load_failed', { error: devicesError.message });
    return new Response(
      JSON.stringify({
        error: devicesError.message,
        diagnostics: lastAdminClientDiagnostics,
      }),
      { status: 500 },
    );
  }

  const activeDevices = (devices ?? []) as DeviceRow[];
  if (activeDevices.length === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        message: 'No active devices',
        diagnostics: lastAdminClientDiagnostics,
      }),
      { status: 200 },
    );
  }

  const deviceIds = activeDevices.map((d) => d.id);
  const tokenByDevice = new Map(activeDevices.map((d) => [d.id, d.expo_push_token!]));

  const [{ data: favorites }, { data: followed }, { data: preferences }, { data: priorStates }] =
    await Promise.all([
      supabase.from('device_favorites').select('device_id, espn_team_id').in('device_id', deviceIds),
      supabase
        .from('device_followed_games')
        .select('device_id, event_id')
        .in('device_id', deviceIds)
        .eq('notifications_enabled', true),
      supabase.from('notification_preferences').select('*').in('device_id', deviceIds),
      supabase.from('monitored_games').select('*'),
    ]);

  const prefsByDevice = new Map<string, PreferenceRow>();
  for (const row of (preferences ?? []) as PreferenceRow[]) {
    prefsByDevice.set(row.device_id, row);
  }

  const devicesByEvent = new Map<string, Set<string>>();

  for (const fav of (favorites ?? []) as FavoriteRow[]) {
    const prefs = prefsByDevice.get(fav.device_id);
    if (prefs && !prefs.favorite_games_enabled) continue;
    // Favorite team matching happens after scoreboard fetch by team id.
    void fav;
  }

  for (const follow of (followed ?? []) as FollowedRow[]) {
    if (!devicesByEvent.has(follow.event_id)) {
      devicesByEvent.set(follow.event_id, new Set());
    }
    devicesByEvent.get(follow.event_id)!.add(follow.device_id);
  }

  const favoriteTeamsByDevice = new Map<string, Set<string>>();
  for (const fav of (favorites ?? []) as FavoriteRow[]) {
    const prefs = prefsByDevice.get(fav.device_id);
    if (prefs && !prefs.favorite_games_enabled) continue;
    if (!favoriteTeamsByDevice.has(fav.device_id)) {
      favoriteTeamsByDevice.set(fav.device_id, new Set());
    }
    favoriteTeamsByDevice.get(fav.device_id)!.add(fav.espn_team_id);
  }

  const priorByEvent = new Map<string, MonitoredGameRow>();
  for (const row of (priorStates ?? []) as MonitoredGameRow[]) {
    priorByEvent.set(row.event_id, row);
  }

  const scoreboard = await fetchJson<{ events?: EspnEvent[] }>(`${ESPN_SCOREBOARD}?groups=81`);
  const scoreboardFbs = await fetchJson<{ events?: EspnEvent[] }>(`${ESPN_SCOREBOARD}?groups=80`);
  const events = [...(scoreboard?.events ?? []), ...(scoreboardFbs?.events ?? [])];

  const parsedEvents = events.map(parseEvent);

  for (const game of parsedEvents) {
    const favoriteDevices = new Set<string>();
    for (const [deviceId, teamIds] of favoriteTeamsByDevice.entries()) {
      if (
        (game.awayTeamId && teamIds.has(game.awayTeamId)) ||
        (game.homeTeamId && teamIds.has(game.homeTeamId))
      ) {
        favoriteDevices.add(deviceId);
      }
    }

    const manualDevices = devicesByEvent.get(game.eventId) ?? new Set<string>();
    const targetDevices = new Set<string>([...favoriteDevices, ...manualDevices]);
    if (targetDevices.size === 0) continue;

    const prior = priorByEvent.get(game.eventId);
    const priorState = prior?.state ?? null;
    const priorPeriod = prior?.period ?? null;
    const priorStatusName = prior?.status_name ?? null;

    for (const deviceId of targetDevices) {
      const pushToken = tokenByDevice.get(deviceId);
      if (!pushToken) continue;
      const prefs = prefsByDevice.get(deviceId);

      const payloadBase = {
        eventId: game.eventId,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        period: game.period,
        clock: game.displayClock,
      };

      if (priorState !== 'in' && game.state === 'in' && preferenceAllows('game_start', prefs)) {
        pending.push({
          deviceId,
          pushToken,
          eventId: game.eventId,
          dedupeKey: `${game.eventId}:start`,
          notificationType: 'game_start',
          title: `${game.awayTeamName} vs ${game.homeTeamName} is underway`,
          body: `Kickoff`,
          data: { ...payloadBase, notificationType: 'game_start' },
        });
      }

      if (
        preferenceAllows('quarter_end', prefs) &&
        priorPeriod === 1 &&
        game.period === 2 &&
        priorStatusName !== 'STATUS_HALFTIME' &&
        game.statusName !== 'STATUS_HALFTIME'
      ) {
        pending.push({
          deviceId,
          pushToken,
          eventId: game.eventId,
          dedupeKey: `${game.eventId}:period:1:end`,
          notificationType: 'quarter_end',
          title: 'End of 1st Quarter',
          body: scoreLine(game.awayTeamName, game.awayScore, game.homeTeamName, game.homeScore),
          data: { ...payloadBase, notificationType: 'quarter_end' },
        });
      }

      if (
        preferenceAllows('halftime', prefs) &&
        game.statusName === 'STATUS_HALFTIME' &&
        priorStatusName !== 'STATUS_HALFTIME'
      ) {
        pending.push({
          deviceId,
          pushToken,
          eventId: game.eventId,
          dedupeKey: `${game.eventId}:halftime`,
          notificationType: 'halftime',
          title: 'Halftime',
          body: scoreLine(game.awayTeamName, game.awayScore, game.homeTeamName, game.homeScore),
          data: { ...payloadBase, notificationType: 'halftime' },
        });
      }

      if (
        preferenceAllows('quarter_end', prefs) &&
        priorPeriod === 3 &&
        game.period === 4
      ) {
        pending.push({
          deviceId,
          pushToken,
          eventId: game.eventId,
          dedupeKey: `${game.eventId}:period:3:end`,
          notificationType: 'quarter_end',
          title: 'End of 3rd Quarter',
          body: scoreLine(game.awayTeamName, game.awayScore, game.homeTeamName, game.homeScore),
          data: { ...payloadBase, notificationType: 'quarter_end' },
        });
      }

      // ESPN often uses state=post for postponed/cancelled — do not treat those as Final.
      const statusNameUpper = (game.statusName ?? '').toUpperCase();
      const isCompletedFinal =
        game.state === 'post' &&
        !statusNameUpper.includes('POSTPONED') &&
        !statusNameUpper.includes('CANCELED') &&
        !statusNameUpper.includes('CANCELLED') &&
        !statusNameUpper.includes('SUSPENDED');

      if (preferenceAllows('final', prefs) && priorState !== 'post' && isCompletedFinal) {
        pending.push({
          deviceId,
          pushToken,
          eventId: game.eventId,
          dedupeKey: `${game.eventId}:final`,
          notificationType: 'final',
          title: 'Final',
          body: scoreLine(game.awayTeamName, game.awayScore, game.homeTeamName, game.homeScore),
          data: { ...payloadBase, notificationType: 'final' },
        });
      }

      // Close-game alert deferred — no verified ESPN close-game field (see docs/ESPN_CLOSE_GAME_INVESTIGATION.md)
    }

    await supabase.from('monitored_games').upsert({
      event_id: game.eventId,
      away_team_id: game.awayTeamId,
      home_team_id: game.homeTeamId,
      kickoff_at: game.kickoffAt,
      state: game.state,
      status_name: game.statusName,
      period: game.period,
      display_clock: game.displayClock,
      away_score: game.awayScore,
      home_score: game.homeScore,
      espn_close_game_active: false,
      last_polled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const liveEventIds = parsedEvents
    .filter((g) => g.state === 'in' && (devicesByEvent.has(g.eventId) || true))
    .map((g) => g.eventId);

  const monitoredLiveIds = new Set<string>();
  for (const game of parsedEvents) {
    const favoriteDevices = new Set<string>();
    for (const [deviceId, teamIds] of favoriteTeamsByDevice.entries()) {
      if (
        (game.awayTeamId && teamIds.has(game.awayTeamId)) ||
        (game.homeTeamId && teamIds.has(game.homeTeamId))
      ) {
        favoriteDevices.add(deviceId);
      }
    }
    const manualDevices = devicesByEvent.get(game.eventId) ?? new Set<string>();
    if ((favoriteDevices.size > 0 || manualDevices.size > 0) && game.state === 'in') {
      monitoredLiveIds.add(game.eventId);
    }
  }

  for (const eventId of monitoredLiveIds) {
    const game = parsedEvents.find((g) => g.eventId === eventId);
    if (!game) continue;

    const summary = await fetchJson<{ scoringPlays?: ScoringPlay[] }>(
      `${ESPN_SUMMARY}?event=${eventId}`,
    );
    const scoringPlays = summary?.scoringPlays ?? [];

    const favoriteDevices = new Set<string>();
    for (const [deviceId, teamIds] of favoriteTeamsByDevice.entries()) {
      if (
        (game.awayTeamId && teamIds.has(game.awayTeamId)) ||
        (game.homeTeamId && teamIds.has(game.homeTeamId))
      ) {
        favoriteDevices.add(deviceId);
      }
    }
    const manualDevices = devicesByEvent.get(eventId) ?? new Set<string>();
    const targetDevices = new Set<string>([...favoriteDevices, ...manualDevices]);

    for (const play of scoringPlays) {
      const playId = play.id ?? scoringFallbackId(play);
      const dedupeKey = `${eventId}:score:${playId}`;
      const scoringLabel =
        play.scoringType?.displayName ?? play.type?.text ?? 'Score';
      const teamName = play.team?.displayName ?? 'Team';
      const title = `${scoringLabel} ${teamName}`;
      const body = `${(play.text ?? '').trim()}\n${scoreLine(
        game.awayTeamName,
        play.awayScore ?? game.awayScore,
        game.homeTeamName,
        play.homeScore ?? game.homeScore,
      )}${periodClockSuffix(play.period?.number ?? game.period, play.clock?.displayValue ?? game.displayClock)}`;

      for (const deviceId of targetDevices) {
        const pushToken = tokenByDevice.get(deviceId);
        if (!pushToken) continue;
        const prefs = prefsByDevice.get(deviceId);
        if (!preferenceAllows('score', prefs)) continue;

        pending.push({
          deviceId,
          pushToken,
          eventId,
          dedupeKey,
          notificationType: 'score',
          title,
          body,
          data: {
            eventId,
            notificationType: 'score',
            homeTeamId: game.homeTeamId,
            awayTeamId: game.awayTeamId,
            period: play.period?.number ?? game.period,
            clock: play.clock?.displayValue ?? game.displayClock,
            scoringPlayId: playId,
          },
        });
      }
    }
  }

  const uniquePending = pending;
  let sentCount = 0;
  const invalidTokens: string[] = [];

  for (const item of uniquePending) {
    const { data: existing } = await supabase
      .from('sent_notification_events')
      .select('id')
      .eq('device_id', item.deviceId)
      .eq('event_id', item.eventId)
      .eq('dedupe_key', item.dedupeKey)
      .maybeSingle();

    if (existing) continue;

    const insertResult = await supabase.from('sent_notification_events').insert({
      device_id: item.deviceId,
      event_id: item.eventId,
      dedupe_key: item.dedupeKey,
      notification_type: item.notificationType,
      payload_json: item.data,
    });

    if (insertResult.error) {
      if (insertResult.error.code === '23505') continue;
      log('dedupe_insert_failed', { error: insertResult.error.message, dedupeKey: item.dedupeKey });
      continue;
    }

    const pushMessages = [
      {
        to: item.pushToken,
        sound: 'default',
        title: item.title,
        body: item.body,
        data: item.data,
        channelId: 'game-alerts',
      },
    ];

    const receipts = await sendExpoPush(pushMessages);
    sentCount += 1;
    log('push_sent', {
      eventId: item.eventId,
      dedupeKey: item.dedupeKey,
      notificationType: item.notificationType,
      devices: 1,
    });

    for (const receipt of receipts) {
      if (receipt?.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
        invalidTokens.push(item.pushToken);
      }
    }
  }

  if (invalidTokens.length > 0) {
    await supabase
      .from('devices')
      .update({ expo_push_token: null, notifications_enabled: false })
      .in('expo_push_token', invalidTokens);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      devices: activeDevices.length,
      eventsScanned: parsedEvents.length,
      notificationsSent: sentCount,
      invalidTokens: invalidTokens.length,
      closeGameImplemented: false,
      diagnostics: lastAdminClientDiagnostics,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
