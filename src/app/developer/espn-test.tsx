import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  formatEspnResponseSize,
  testEspnConnectivity,
  type EspnConnectivityResult,
} from '@/data/providers/espnConnectivity';
import { ESPN_FETCH_TIMEOUT_MS } from '@/data/providers/espnFetch';
import {
  diagnoseEspnScoreboard,
  parseEspnScoreboardNormalized,
  summarizeParsedEspnGames,
} from '@/data/providers/espnParser';
import type { EspnNormalizedGame } from '@/types';
import {
  compareEspnWeekQueryFormats,
  ESPN_FCS_SCOREBOARD_URL,
  ESPN_WEEK_QUERY_PRESETS,
  buildEspnWeekScoreboardUrl,
  type EspnFormatCompareResult,
  type EspnWeekPresetId,
} from '@/data/providers/espnWeekQuery';
import type { ProviderFetchStatus, ProviderResponse } from '@/data/providers/types';
import { colors, spacing, typography } from '@/theme';
import type { EspnTodayGamesPayload, EspnTodayGame } from '@/types';

type FetchMode = 'simulated' | 'real';

const SIMULATED_DELAY_MS = 2_000;

const WEEK_PRESET_ORDER: EspnWeekPresetId[] = [
  'week-0',
  'week-1',
  'week-2',
  'opening-slate',
];

const STATUS_LABEL: Record<ProviderFetchStatus, string> = {
  idle: 'Idle',
  loading: 'Loading',
  success: 'Success',
  error: 'Error',
};

const STATUS_COLOR: Record<ProviderFetchStatus, string> = {
  idle: colors.textMuted,
  loading: colors.primary,
  success: colors.success,
  error: colors.error,
};

const MOCK_GAMES: EspnTodayGame[] = [
  {
    id: 'sim-401635512',
    awayTeam: 'Montana State',
    homeTeam: 'Montana',
    awayScore: 21,
    homeScore: 17,
    startTime: '2026-09-06T19:00:00Z',
    status: 'final',
    broadcast: 'ESPN+',
    espnLink: 'https://www.espn.com/college-football/game/_/gameId/401635512',
  },
  {
    id: 'sim-401635520',
    awayTeam: 'North Dakota State',
    homeTeam: 'South Dakota State',
    startTime: '2026-09-06T22:00:00Z',
    status: 'scheduled',
    broadcast: 'CBSSN',
    espnLink: 'https://www.espn.com/college-football/game/_/gameId/401635520',
  },
];

function buildMockResponse(): ProviderResponse<EspnTodayGamesPayload> {
  const date = new Date().toISOString().slice(0, 10);
  return {
    providerId: 'espn-scores-simulated',
    durationMs: SIMULATED_DELAY_MS,
    timestamp: new Date().toISOString(),
    data: {
      date,
      games: MOCK_GAMES,
      endpoint: ESPN_FCS_SCOREBOARD_URL,
      raw: {
        simulated: true,
        source: 'espn-test-screen',
        endpoint: ESPN_FCS_SCOREBOARD_URL,
        date,
        events: MOCK_GAMES.map((game) => ({
          id: game.id,
          date: game.startTime,
          status: { type: { name: game.status } },
          broadcasts: game.broadcast ? [{ names: [game.broadcast] }] : [],
          competitions: [
            {
              competitors: [
                {
                  homeAway: 'away',
                  team: { displayName: game.awayTeam },
                  score: game.awayScore != null ? String(game.awayScore) : undefined,
                },
                {
                  homeAway: 'home',
                  team: { displayName: game.homeTeam },
                  score: game.homeScore != null ? String(game.homeScore) : undefined,
                },
              ],
            },
          ],
        })),
      },
    },
  };
}

function formatScore(game: EspnTodayGame): string | null {
  if (game.awayScore === undefined && game.homeScore === undefined) return null;
  return `${game.awayScore ?? '—'} – ${game.homeScore ?? '—'}`;
}

function GamePreviewRow({ game }: { game: EspnTodayGame }) {
  const scoreLine = formatScore(game);

  return (
    <View style={styles.gameRow}>
      <Text style={styles.gameMatchup} numberOfLines={2}>
        {game.awayTeam} at {game.homeTeam}
      </Text>
      {scoreLine ? <Text style={styles.gameScore}>{scoreLine}</Text> : null}
      <Text style={styles.gameMeta}>{game.status}</Text>
      <Text style={styles.gameMeta}>Start: {game.startTime}</Text>
      <Text style={styles.gameMeta}>ESPN ID: {game.id}</Text>
      {game.broadcast ? <Text style={styles.gameMeta}>TV: {game.broadcast}</Text> : null}
    </View>
  );
}

function ModeOption({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.modeOption,
        selected && styles.modeOptionSelected,
        pressed && styles.modeOptionPressed,
        disabled && styles.modeOptionDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}>
      <Text style={styles.modeRadio}>{selected ? '(•)' : '( )'}</Text>
      <Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function formatDivision(division?: EspnNormalizedGame['awayDivision']): string {
  if (!division || division === 'unknown') return '—';
  return division.toUpperCase();
}

function ParsedGameRow({ game, index }: { game: EspnNormalizedGame; index: number }) {
  const awayScore = game.awayScore != null ? String(game.awayScore) : '—';
  const homeScore = game.homeScore != null ? String(game.homeScore) : '—';

  return (
    <View style={styles.parsedGameRow}>
      <Text style={styles.parsedGameTitle}>
        #{index + 1} · {game.awayTeam} at {game.homeTeam}
      </Text>
      <Text style={styles.parsedGameMeta}>ESPN ID: {game.id}</Text>
      <Text style={styles.parsedGameMeta}>
        Score: {game.awayTeam} {awayScore} – {homeScore} {game.homeTeam}
      </Text>
      <Text style={styles.parsedGameMeta}>Status: {game.status}</Text>
      <Text style={styles.parsedGameMeta}>Start: {game.startTime}</Text>
      <Text style={styles.parsedGameMeta}>Venue: {game.venue ?? '—'}</Text>
      <Text style={styles.parsedGameMeta}>TV: {game.broadcast ?? '—'}</Text>
      <Text style={styles.parsedGameMeta} numberOfLines={2}>
        Link: {game.espnLink ?? '—'}
      </Text>
      <Text style={styles.parsedGameMeta}>
        Away division: {formatDivision(game.awayDivision)}
        {game.awayConference ? ` · ${game.awayConference}` : ''}
      </Text>
      <Text style={styles.parsedGameMeta}>
        Home division: {formatDivision(game.homeDivision)}
        {game.homeConference ? ` · ${game.homeConference}` : ''}
      </Text>
      {game.groupInfo ? (
        <Text style={styles.parsedGameMeta} numberOfLines={2}>
          Groups: {game.groupInfo}
        </Text>
      ) : null}
    </View>
  );
}

function WeekPresetButton({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.datePresetButton,
        selected && styles.datePresetButtonSelected,
        pressed && styles.datePresetButtonPressed,
        disabled && styles.datePresetButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}>
      <Text style={[styles.datePresetText, selected && styles.datePresetTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FormatComparisonPanel({
  results,
  activeQuery,
}: {
  results: EspnFormatCompareResult[];
  activeQuery: string;
}) {
  const withEvents = results.filter((r) => r.eventsLength > 0);
  const withoutEvents = results.filter((r) => r.eventsLength === 0 && !r.error);
  const showDiff = withEvents.length > 0 && withoutEvents.length > 0;

  return (
    <View style={styles.resultPanel}>
      <Text style={styles.sectionLabel}>Query Format Comparison</Text>
      {showDiff ? (
        <Text style={styles.formatDiffNote}>
          Some formats returned events and others did not — prefer week + seasontype=2
          for FCS week navigation.
        </Text>
      ) : null}
      {results.map((row) => {
        const isActive = row.label === activeQuery;
        return (
          <View
            key={row.label}
            style={[styles.formatCompareRow, isActive && styles.formatCompareRowActive]}>
            <Text style={styles.formatCompareLabel}>
              {isActive ? '▸ ' : '  '}
              {row.label}
            </Text>
            <Text style={styles.formatCompareMeta}>
              HTTP {row.httpStatus ?? '—'} · events: {row.eventsLength}
              {row.error ? ` · ${row.error}` : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ParserDiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: ReturnType<typeof diagnoseEspnScoreboard>;
}) {
  return (
    <View style={styles.resultPanel}>
      <Text style={styles.sectionLabel}>Parser Diagnostics</Text>
      <ResultRow
        label="HTTP Status"
        value={diagnostics.httpStatus != null ? String(diagnostics.httpStatus) : '—'}
      />
      <ResultRow
        label='Raw response has "events"'
        value={diagnostics.hasEventsArray ? 'Yes' : 'No'}
      />
      <ResultRow label="events.length" value={String(diagnostics.eventsLength)} />
      <ResultRow label="First event id" value={diagnostics.firstEventId ?? '—'} />
      <ResultRow label="First event name" value={diagnostics.firstEventName ?? '—'} multiline />
      <ResultRow
        label="First event shortName"
        value={diagnostics.firstEventShortName ?? '—'}
      />
      <Text style={styles.previewLabel}>Raw response (first 500 characters)</Text>
      <View style={styles.bodyPreviewBox}>
        <Text style={styles.bodyPreviewText} selectable>
          {diagnostics.bodyPreview || '(empty)'}
        </Text>
      </View>
      <View style={styles.diagnosticMessageBox}>
        <Text style={styles.diagnosticMessage}>{diagnostics.message}</Text>
      </View>
      {diagnostics.firstEventRawPreview ? (
        <>
          <Text style={styles.previewLabel}>First event raw JSON (parser failed)</Text>
          <ScrollView style={styles.jsonScroll} nestedScrollEnabled>
            <Text style={styles.jsonText} selectable>
              {diagnostics.firstEventRawPreview}
            </Text>
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

function ParsedGamesPanel({
  parseResult,
  weekPreset,
  httpStatus,
}: {
  parseResult: ReturnType<typeof parseEspnScoreboardNormalized>;
  weekPreset: (typeof ESPN_WEEK_QUERY_PRESETS)[EspnWeekPresetId];
  httpStatus: number | null;
}) {
  const previewGames = parseResult.games.slice(0, 10);
  const summary = summarizeParsedEspnGames(parseResult.games);

  return (
    <View style={styles.resultPanel}>
      <Text style={styles.sectionLabel}>Parsed Games</Text>
      <ResultRow label="Selected Week" value={weekPreset.selectedWeekLabel} />
      <ResultRow label="Query Format" value={weekPreset.queryDescription} />
      <ResultRow
        label="HTTP Status"
        value={httpStatus != null ? String(httpStatus) : '—'}
      />
      <ResultRow label="events.length" value={String(parseResult.totalEvents)} />
      <ResultRow label="Parsed Games Count" value={String(parseResult.totalParsed)} />
      <ResultRow
        label="Status Breakdown"
        value={`Scheduled ${summary.statusBreakdown.scheduled} · Live ${summary.statusBreakdown.live} · Final ${summary.statusBreakdown.final}${summary.statusBreakdown.other ? ` · Other ${summary.statusBreakdown.other}` : ''}`}
      />
      <ResultRow
        label="Date Range (returned games)"
        value={
          summary.dateRange
            ? `${summary.dateRange.min} → ${summary.dateRange.max}`
            : '—'
        }
      />

      {parseResult.totalParsed === 0 ? (
        <Text style={styles.parseEmptyText}>{parseResult.message ?? 'No parsed games.'}</Text>
      ) : (
        <>
          <Text style={styles.previewLabel}>
            First {previewGames.length} parsed games
          </Text>
          <View style={styles.parsedGamesList}>
            {previewGames.map((game, index) => (
              <ParsedGameRow key={game.id} game={game} index={index} />
            ))}
          </View>
          {parseResult.totalParsed > 10 ? (
            <Text style={styles.parseEmptyText}>
              Showing 10 of {parseResult.totalParsed} parsed games.
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

function ConnectivityResultPanel({ result }: { result: EspnConnectivityResult }) {
  return (
    <View style={styles.resultPanel}>
      <Text style={styles.sectionLabel}>Network Connectivity Result</Text>
      <ResultRow label="Request URL" value={result.url} multiline />
      <ResultRow
        label="HTTP Status Code"
        value={result.httpStatus != null ? String(result.httpStatus) : '—'}
      />
      <ResultRow label="Success / Failure" value={result.success ? 'Success' : 'Failure'} />
      <ResultRow label="Response Time" value={`${result.durationMs} ms`} />
      <ResultRow
        label="Response Size"
        value={formatEspnResponseSize(result.responseSizeBytes)}
      />
      <Text style={styles.previewLabel}>Response Body (first 500 characters)</Text>
      <View style={styles.bodyPreviewBox}>
        <Text style={styles.bodyPreviewText} selectable>
          {result.bodyPreview || '(empty)'}
        </Text>
      </View>
    </View>
  );
}

function ResultRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue} numberOfLines={multiline ? undefined : 2} selectable>
        {value}
      </Text>
    </View>
  );
}

export default function EspnTestScreen() {
  const [mode, setMode] = useState<FetchMode>('simulated');
  const [selectedWeekPreset, setSelectedWeekPreset] = useState<EspnWeekPresetId>('week-1');
  const [formatComparison, setFormatComparison] = useState<EspnFormatCompareResult[] | null>(
    null,
  );
  const [comparingFormats, setComparingFormats] = useState(false);
  const [status, setStatus] = useState<ProviderFetchStatus>('idle');
  const [loading, setLoading] = useState(false);
  const [simulatedResponse, setSimulatedResponse] =
    useState<ProviderResponse<EspnTodayGamesPayload> | null>(null);
  const [connectivityResult, setConnectivityResult] = useState<EspnConnectivityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    'Simulated mode — ready to run a 2s mock fetch.',
  );

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
    };
  }, []);

  const clearDelayTimer = useCallback(() => {
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
  }, []);

  const resetResults = useCallback(() => {
    setSimulatedResponse(null);
    setConnectivityResult(null);
    setFormatComparison(null);
    setError(null);
  }, []);

  const weekPreset = ESPN_WEEK_QUERY_PRESETS[selectedWeekPreset];
  const requestUrl = buildEspnWeekScoreboardUrl(selectedWeekPreset);

  const handleModeChange = useCallback(
    (nextMode: FetchMode) => {
      if (loading || nextMode === mode) return;
      requestIdRef.current += 1;
      clearDelayTimer();
      abortRef.current?.abort();
      abortRef.current = null;
      setMode(nextMode);
      setLoading(false);
      setStatus('idle');
      resetResults();
      setStatusMessage(
        nextMode === 'simulated'
          ? 'Simulated mode — ready to run a 2s mock fetch.'
          : `Real ESPN mode — week-based FCS scoreboard (${ESPN_FETCH_TIMEOUT_MS / 1000}s timeout).`,
      );
    },
    [clearDelayTimer, loading, mode, resetResults],
  );

  const handleCancelReset = useCallback(() => {
    console.log('[ESPN Test] fetch cancelled');
    requestIdRef.current += 1;
    clearDelayTimer();
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setStatus('idle');
    resetResults();
    setStatusMessage('Request cancelled');
  }, [clearDelayTimer, resetResults]);

  const runSimulatedFetch = useCallback(
    (requestId: number) => {
      console.log('[ESPN Test] simulated fetch started');
      setStatusMessage(`Simulated fetch in progress (${SIMULATED_DELAY_MS / 1000}s)…`);

      delayTimerRef.current = setTimeout(() => {
        delayTimerRef.current = null;

        if (!mountedRef.current || requestIdRef.current !== requestId) {
          console.log('[ESPN Test] stale simulated response ignored');
          return;
        }

        console.log('[ESPN Test] simulated fetch success');
        const result = buildMockResponse();
        setSimulatedResponse(result);
        setStatus('success');
        setLoading(false);
        setStatusMessage(
          `Simulated success — ${result.data.games.length} mock games for ${result.data.date}.`,
        );
      }, SIMULATED_DELAY_MS);
    },
    [],
  );

  const runRealFetch = useCallback(async (requestId: number) => {
    const controller = new AbortController();
    abortRef.current = controller;
    const fetchUrl = buildEspnWeekScoreboardUrl(selectedWeekPreset);

    console.log('[ESPN Test] real week fetch started', fetchUrl);
    setStatusMessage(
      `Real ESPN GET · ${weekPreset.selectedWeekLabel} (${ESPN_FETCH_TIMEOUT_MS / 1000}s timeout)…`,
    );

    try {
      const result = await testEspnConnectivity(fetchUrl, {
        signal: controller.signal,
        timeoutMs: ESPN_FETCH_TIMEOUT_MS,
      });

      if (!mountedRef.current || requestIdRef.current !== requestId) {
        console.log('[ESPN Test] stale real response ignored');
        return;
      }

      setConnectivityResult(result);

      if (result.error && !result.httpStatus) {
        setStatus('error');
        setError(result.error);
        setStatusMessage('Connectivity test failed.');
        console.log('[ESPN Test] real fetch error', result.error);
        return;
      }

      if (result.success) {
        setStatus('success');
        setError(null);
        const parseHint =
          result.rawJson != null ? ` Parsed ${parseEspnScoreboardNormalized(result.rawJson).totalParsed} games.` : '';
        setStatusMessage(
          `HTTP ${result.httpStatus} — ESPN reachable (${result.durationMs} ms).${parseHint}`,
        );
        console.log('[ESPN Test] real fetch success HTTP', result.httpStatus);
      } else {
        setStatus('error');
        setError(result.error ?? `HTTP ${result.httpStatus}`);
        setStatusMessage(`HTTP ${result.httpStatus} — request completed but not successful.`);
        console.log('[ESPN Test] real fetch HTTP error', result.httpStatus);
      }
    } catch (err) {
      if (!mountedRef.current || requestIdRef.current !== requestId) return;

      const message = err instanceof Error ? err.message : 'Unknown network error';
      setStatus('error');
      setError(message);
      setStatusMessage('Connectivity test failed.');
      console.log('[ESPN Test] real fetch error', message);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }

      if (!mountedRef.current || requestIdRef.current !== requestId) return;

      setLoading(false);
    }
  }, [selectedWeekPreset, weekPreset.selectedWeekLabel]);

  const runFormatComparison = useCallback(async () => {
    if (mode !== 'real' || loading || comparingFormats) return;

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setComparingFormats(true);
    setStatusMessage('Comparing all ESPN week query formats…');

    try {
      const results = await compareEspnWeekQueryFormats({
        signal: controller.signal,
        timeoutMs: ESPN_FETCH_TIMEOUT_MS,
      });

      if (!mountedRef.current || requestIdRef.current !== requestId) return;

      setFormatComparison(results);
      setStatusMessage('Query format comparison complete.');
    } catch (err) {
      if (!mountedRef.current || requestIdRef.current !== requestId) return;
      const message = err instanceof Error ? err.message : 'Format comparison failed';
      setError(message);
      setStatusMessage('Query format comparison failed.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (mountedRef.current && requestIdRef.current === requestId) {
        setComparingFormats(false);
      }
    }
  }, [comparingFormats, loading, mode]);

  const handleFetch = useCallback(() => {
    clearDelayTimer();
    abortRef.current?.abort();
    abortRef.current = null;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    setLoading(true);
    setStatus('loading');
    resetResults();
    setStatusMessage('Starting fetch…');

    if (mode === 'simulated') {
      runSimulatedFetch(requestId);
      return;
    }

    void runRealFetch(requestId);
  }, [clearDelayTimer, mode, resetResults, runRealFetch, runSimulatedFetch]);

  const simulatedJson = simulatedResponse
    ? JSON.stringify(simulatedResponse.data.raw, null, 2)
    : null;

  const hasResults = mode === 'simulated' ? simulatedResponse != null : connectivityResult != null;

  const scoreboardParse =
    mode === 'real' && connectivityResult?.success
      ? connectivityResult.rawJson != null
        ? parseEspnScoreboardNormalized(connectivityResult.rawJson)
        : {
            games: [],
            totalEvents: 0,
            totalParsed: 0,
            message: 'Response body was not valid JSON — cannot parse games.',
          }
      : null;

  const parserDiagnostics =
    mode === 'real' && connectivityResult
      ? diagnoseEspnScoreboard(
          connectivityResult.rawJson,
          scoreboardParse ?? {
            games: [],
            totalEvents: 0,
            totalParsed: 0,
            message: connectivityResult.rawJson == null ? 'Invalid JSON' : undefined,
          },
          {
            httpStatus: connectivityResult.httpStatus,
            bodyPreview: connectivityResult.bodyPreview,
          },
        )
      : null;

  const realJsonPreview =
    connectivityResult?.rawJson != null
      ? JSON.stringify(connectivityResult.rawJson, null, 2).slice(0, 4000)
      : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.warning}>
        Developer only — ESPN connectivity test. Not wired to production.
      </Text>

      <View style={styles.panel}>
        <Text style={styles.providerLabel}>Mode</Text>
        <View style={styles.modeRow}>
          <ModeOption
            label="Simulated"
            selected={mode === 'simulated'}
            onPress={() => handleModeChange('simulated')}
            disabled={loading}
          />
          <ModeOption
            label="Real ESPN"
            selected={mode === 'real'}
            onPress={() => handleModeChange('real')}
            disabled={loading}
          />
        </View>
        <Text style={styles.modeHint}>
          {mode === 'simulated'
            ? 'Mock 2s delay with sample parsed games — no network.'
            : 'Real HTTP GET — week-based FCS scoreboard (groups=81 + week params).'}
        </Text>
      </View>

      {mode === 'real' ? (
        <View style={styles.panel}>
          <Text style={styles.providerLabel}>Scoreboard Week</Text>
          <Text style={styles.modeHint}>
            Base: {ESPN_WEEK_QUERY_PRESETS['opening-slate'].buildUrl().split('?')[0]}
          </Text>
          <View style={styles.datePresetRow}>
            {WEEK_PRESET_ORDER.map((presetId) => (
              <WeekPresetButton
                key={presetId}
                label={ESPN_WEEK_QUERY_PRESETS[presetId].label}
                selected={selectedWeekPreset === presetId}
                onPress={() => setSelectedWeekPreset(presetId)}
                disabled={loading || comparingFormats}
              />
            ))}
          </View>
          <ResultRow label="Selected Week" value={weekPreset.selectedWeekLabel} />
          <ResultRow label="Query Format" value={weekPreset.queryDescription} />
          <Text style={styles.endpointLabel}>Request URL</Text>
          <Text style={styles.endpoint} selectable>
            {requestUrl}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.compareButton,
              pressed && styles.fetchButtonPressed,
              (loading || comparingFormats) && styles.fetchButtonDisabled,
            ]}
            onPress={() => void runFormatComparison()}
            disabled={loading || comparingFormats}>
            {comparingFormats ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.compareButtonText}>Compare All Query Formats</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.endpointLabel}>Base Endpoint</Text>
          <Text style={styles.endpoint} selectable>
            {ESPN_FCS_SCOREBOARD_URL}
          </Text>
        </View>
      )}

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Status</Text>
        <View style={[styles.statusBadge, { borderColor: STATUS_COLOR[status] }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[status] }]}>
            {STATUS_LABEL[status]}
          </Text>
        </View>
      </View>

      <Text style={styles.statusMessage}>{statusMessage}</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [
            styles.fetchButton,
            styles.fetchButtonPrimary,
            pressed && styles.fetchButtonPressed,
            loading && styles.fetchButtonDisabled,
          ]}
          onPress={handleFetch}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.fetchButtonTextPrimary}>Fetch Week Scoreboard</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.fetchButton,
            styles.resetButton,
            pressed && styles.fetchButtonPressed,
          ]}
          onPress={handleCancelReset}
          disabled={!loading && status === 'idle' && !error && !hasResults}>
          <Text style={styles.resetButtonText}>Cancel / Reset</Text>
        </Pressable>
      </View>

      {mode === 'real' && formatComparison ? (
        <FormatComparisonPanel
          results={formatComparison}
          activeQuery={weekPreset.queryDescription}
        />
      ) : null}

      {mode === 'real' && connectivityResult ? (
        <>
          <ConnectivityResultPanel result={connectivityResult} />
          {parserDiagnostics &&
          parserDiagnostics.eventsLength > 0 &&
          scoreboardParse?.totalParsed === 0 ? (
            <ParserDiagnosticsPanel diagnostics={parserDiagnostics} />
          ) : null}
          {scoreboardParse && connectivityResult.success ? (
            <ParsedGamesPanel
              parseResult={scoreboardParse}
              weekPreset={weekPreset}
              httpStatus={connectivityResult.httpStatus}
            />
          ) : null}
          {scoreboardParse?.totalParsed === 0 && parserDiagnostics?.eventsLength === 0 ? (
            <View style={styles.resultPanel}>
              <Text style={styles.parseEmptyText}>
                {parserDiagnostics?.message ?? 'ESPN returned zero events for this query'}
              </Text>
            </View>
          ) : null}
          <View style={styles.jsonContainer}>
            <Text style={styles.sectionLabel}>Raw JSON Preview</Text>
            <ScrollView style={styles.jsonScroll} nestedScrollEnabled>
              <Text style={styles.jsonText}>
                {realJsonPreview ??
                  connectivityResult.bodyPreview ??
                  'No JSON preview available.'}
              </Text>
            </ScrollView>
          </View>
        </>
      ) : null}

      {mode === 'simulated' && simulatedResponse ? (
        <>
          <Text style={styles.meta}>
            Simulated response time: {simulatedResponse.durationMs} ms
          </Text>
          <View style={styles.previewSection}>
            <Text style={styles.sectionLabel}>
              Mock Parsed Games ({simulatedResponse.data.games.length})
            </Text>
            <View style={styles.previewList}>
              {simulatedResponse.data.games.map((game) => (
                <GamePreviewRow key={game.id} game={game} />
              ))}
            </View>
          </View>
          <View style={styles.jsonContainer}>
            <Text style={styles.sectionLabel}>Mock Raw JSON Preview</Text>
            <View style={styles.jsonScroll}>
              <Text style={styles.jsonText}>{simulatedJson}</Text>
            </View>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  warning: {
    ...typography.caption,
    color: colors.primary,
    backgroundColor: 'rgba(201, 162, 39, 0.12)',
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  providerLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  modeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(201, 162, 39, 0.12)',
  },
  modeOptionPressed: {
    opacity: 0.85,
  },
  modeOptionDisabled: {
    opacity: 0.5,
  },
  modeRadio: {
    ...typography.caption,
    color: colors.text,
    fontFamily: 'monospace',
  },
  modeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modeLabelSelected: {
    color: colors.text,
  },
  modeHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  datePresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  datePresetButton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  datePresetButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(201, 162, 39, 0.12)',
  },
  datePresetButtonPressed: {
    opacity: 0.85,
  },
  datePresetButtonDisabled: {
    opacity: 0.5,
  },
  datePresetText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  datePresetTextSelected: {
    color: colors.text,
  },
  dateInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: 'monospace',
  },
  endpointLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  endpoint: {
    ...typography.caption,
    color: colors.primary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  statusBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...typography.label,
    fontSize: 11,
  },
  statusMessage: {
    ...typography.body,
    color: colors.textSecondary,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
  },
  errorTitle: {
    ...typography.label,
    color: colors.error,
    marginBottom: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
  },
  buttonRow: {
    gap: spacing.sm,
  },
  fetchButton: {
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  fetchButtonPrimary: {
    backgroundColor: colors.primary,
  },
  fetchButtonDisabled: {
    opacity: 0.9,
  },
  fetchButtonPressed: {
    opacity: 0.85,
  },
  fetchButtonTextPrimary: {
    ...typography.body,
    fontWeight: '700',
    color: colors.background,
  },
  resetButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  resultPanel: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  resultRow: {
    gap: spacing.xs,
  },
  resultLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  resultValue: {
    ...typography.caption,
    color: colors.text,
  },
  previewLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  bodyPreviewBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    maxHeight: 200,
  },
  bodyPreviewText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  parseEmptyText: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 20,
  },
  diagnosticMessageBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  diagnosticMessage: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  formatDiffNote: {
    ...typography.caption,
    color: colors.primary,
    lineHeight: 18,
  },
  formatCompareRow: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 2,
  },
  formatCompareRowActive: {
    borderColor: colors.primary,
  },
  formatCompareLabel: {
    ...typography.caption,
    color: colors.text,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  formatCompareMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  compareButton: {
    marginTop: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  compareButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  parsedGamesList: {
    gap: spacing.sm,
  },
  parsedGameRow: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 2,
  },
  parsedGameTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  parsedGameMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  previewSection: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  previewList: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  gameRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 2,
  },
  gameMatchup: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  gameScore: {
    ...typography.heading,
    fontSize: 16,
    color: colors.primary,
  },
  gameMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  jsonContainer: {
    gap: spacing.sm,
  },
  jsonScroll: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    maxHeight: 240,
  },
  jsonText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
