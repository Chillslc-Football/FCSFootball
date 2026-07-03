import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FeaturedGameCard } from '@/components/FeaturedGameCard';
import { Screen } from '@/components/Screen';
import { TodayGameCard } from '@/components/TodayGameCard';
import { UpsetWatchCard } from '@/components/UpsetWatchCard';
import { espnScoresProvider } from '@/data/providers/espnProvider';
import {
  filterUpsetWatchGames,
  pickFeaturedGame,
  toScoreboardGame,
} from '@/data/providers/espnTodayMapper';
import { colors, spacing, typography } from '@/theme';
import type { EspnNormalizedGame } from '@/types';

type LoadState = 'loading' | 'success' | 'error';

/** Dev-only scoreboard date presets for offseason preview. */
type TodayDateMode = 'today' | '2026-08-29' | '2026-09-05';

const TODAY_DATE_OPTIONS: { id: TodayDateMode; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '2026-08-29', label: 'Aug 29, 2026' },
  { id: '2026-09-05', label: 'Sep 5, 2026' },
];

type SectionProps = {
  title: string;
  children: ReactNode;
};

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function formatDateLabel(isoDate: string): string {
  const parsed = Date.parse(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed)) return isoDate;
  return new Date(parsed).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPreviewShortDate(isoDate: string): string {
  const parsed = Date.parse(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed)) return isoDate;
  return new Date(parsed).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getScreenHeader(dateMode: TodayDateMode): { title: string; subtitle: string } {
  if (dateMode === 'today') {
    return {
      title: 'Today',
      subtitle: 'Your FCS football snapshot for today.',
    };
  }

  return {
    title: `Today Preview: ${formatPreviewShortDate(dateMode)}`,
    subtitle: 'Developer preview — ESPN FCS scoreboard for the selected date.',
  };
}

function TodayGameList({ games }: { games: EspnNormalizedGame[] }) {
  if (games.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No games in this section.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {games.map((game) => (
        <TodayGameCard key={game.id} game={game} />
      ))}
    </View>
  );
}

type TodayDateSelectorProps = {
  selected: TodayDateMode;
  onSelect: (mode: TodayDateMode) => void;
};

function TodayDateSelector({ selected, onSelect }: TodayDateSelectorProps) {
  return (
    <View style={styles.devPanel}>
      <Text style={styles.devPanelLabel}>Dev test date</Text>
      <View style={styles.devChipRow}>
        {TODAY_DATE_OPTIONS.map((option) => {
          const isActive = selected === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => onSelect(option.id)}
              style={[styles.devChip, isActive && styles.devChipActive]}>
              <Text style={[styles.devChipText, isActive && styles.devChipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TodayScreen() {
  const [dateMode, setDateMode] = useState<TodayDateMode>('today');
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [games, setGames] = useState<EspnNormalizedGame[]>([]);
  const [dateLabel, setDateLabel] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const screenHeader = useMemo(() => getScreenHeader(dateMode), [dateMode]);
  const isPreview = dateMode !== 'today';

  useEffect(() => {
    let cancelled = false;

    async function loadTodayGames() {
      setLoadState('loading');
      setErrorMessage(null);

      try {
        const response = await espnScoresProvider.getTodayGames(
          isPreview ? { dateIso: dateMode } : undefined,
        );
        if (cancelled) return;

        setGames(response.data.games);
        setDateLabel(formatDateLabel(response.data.date));
        setLoadState('success');
      } catch (err) {
        if (cancelled) return;
        setGames([]);
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not load today\'s FCS games from ESPN.',
        );
        setLoadState('error');
      }
    }

    void loadTodayGames();

    return () => {
      cancelled = true;
    };
  }, [dateMode, isPreview]);

  const featuredSource = useMemo(() => pickFeaturedGame(games), [games]);
  const featuredGame = featuredSource ? toScoreboardGame(featuredSource) : null;
  const upsetGames = useMemo(() => filterUpsetWatchGames(games), [games]);
  const hasGames = games.length > 0;
  const emptyTitle = isPreview
    ? 'No FCS games scheduled for this date.'
    : 'No FCS games scheduled today.';
  const loadingText = isPreview
    ? 'Loading FCS games for preview date…'
    : 'Loading today\'s FCS games…';

  return (
    <Screen title={screenHeader.title} subtitle={screenHeader.subtitle}>
      {__DEV__ ? (
        <TodayDateSelector selected={dateMode} onSelect={setDateMode} />
      ) : null}

      {loadState === 'loading' ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      ) : null}

      {loadState === 'error' ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Could not load games</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {loadState === 'success' ? (
        <>
          {dateLabel ? (
            <View style={styles.dateBanner}>
              <Text style={styles.dateLabel}>{dateLabel}</Text>
              <Text style={styles.dateMeta}>
                {isPreview ? 'ESPN FCS scoreboard · dev preview' : 'ESPN FCS scoreboard'}
              </Text>
            </View>
          ) : null}

          {!hasGames ? (
            <View style={styles.emptyToday}>
              <Text style={styles.emptyTodayTitle}>{emptyTitle}</Text>
              <Text style={styles.emptyTodayText}>
                {isPreview
                  ? 'Try another dev test date if you expected games on this day.'
                  : 'Check back on game day — this is normal during the offseason.'}
              </Text>
            </View>
          ) : (
            <>
              {featuredGame ? (
                <Section title="Featured">
                  <FeaturedGameCard game={featuredGame} />
                </Section>
              ) : null}

              <Section title="Upset Watch">
                {upsetGames.length > 0 ? (
                  <View style={styles.list}>
                    {upsetGames.map((game) => (
                      <UpsetWatchCard key={game.id} game={game} />
                    ))}
                  </View>
                ) : (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>
                      No FCS vs FBS upset alerts right now.
                    </Text>
                  </View>
                )}
              </Section>
            </>
          )}

          <Section title="Ranked Games Today">
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderTitle}>Rankings not connected yet</Text>
              <Text style={styles.placeholderText}>
                Top 25 badges will appear here once NCAA poll data is connected.
                ESPN does not supply official FCS rankings.
              </Text>
            </View>
          </Section>

          <Section title="All FCS Games Today">
            {hasGames ? (
              <TodayGameList games={games} />
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{emptyTitle}</Text>
              </View>
            )}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  devPanel: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  devPanelLabel: {
    ...typography.label,
    color: colors.primary,
  },
  devChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  devChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  devChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(201, 162, 39, 0.15)',
  },
  devChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  devChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  loadingBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  errorTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.error,
    marginBottom: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
  },
  dateBanner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  dateLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  dateMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  emptyToday: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  emptyTodayTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  emptyTodayText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  placeholderBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  placeholderTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  placeholderText: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
