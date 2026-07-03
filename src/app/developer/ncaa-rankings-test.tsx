import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  NCAA_FCS_TOP_25_URL,
  NCAA_RANKINGS_INVESTIGATION,
  ncaaRankingsProvider,
  testNcaaRankingsPageReachability,
} from '@/data/providers';
import type { NcaaRankingsReachabilityResult } from '@/data/providers/ncaaConnectivity';
import { colors, spacing, typography } from '@/theme';

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function FindingRow({ question, answer }: { question: string; answer: string }) {
  return (
    <View style={styles.findingRow}>
      <Text style={styles.findingQuestion}>{question}</Text>
      <Text style={styles.findingAnswer}>{answer}</Text>
    </View>
  );
}

export default function NcaaRankingsTestScreen() {
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<NcaaRankingsReachabilityResult | null>(null);

  useEffect(() => {
    return () => {
      setProbing(false);
    };
  }, []);

  async function runReachabilityProbe() {
    setProbing(true);
    try {
      const result = await testNcaaRankingsPageReachability();
      setProbeResult(result);
      console.log('[NCAA Rankings Test] reachability', result);
    } finally {
      setProbing(false);
    }
  }

  const investigation = NCAA_RANKINGS_INVESTIGATION;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.warning}>
        Developer only — Phase 10 investigation. Production screens remain on mock data.
      </Text>

      <View style={styles.panel}>
        <Text style={styles.label}>Official source</Text>
        <Text style={styles.title}>NCAA Stats Perform FCS Top 25</Text>
        <Text style={styles.url}>{NCAA_FCS_TOP_25_URL}</Text>
        <Text style={styles.meta}>Drupal node {investigation.drupalNodeId}</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>Provider status</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Static JSON — manual weekly updates</Text>
        </View>
        <Text style={styles.body}>
          Top 25 and Rankings screens read src/data/static/fcsTop25.json via
          ncaaRankingsProvider. This is not live NCAA data — update the file manually
          from the official poll each week.
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Investigation findings</Text>
        <FindingRow
          question="1. Underlying JSON endpoint?"
          answer="No official JSON for this poll. Probed paths returned 403, 404, or HTML."
        />
        <FindingRow
          question="2. Page calls an API?"
          answer="No. rankings.min.js only handles table UI and poll navigation."
        />
        <FindingRow
          question="3. Data embedded in HTML?"
          answer="Yes. Server-rendered Drupal table (.rankings-content table.sticky)."
        />
        <FindingRow
          question="4. Other NCAA endpoint?"
          answer="No. data.ncaa.com scoreboard JSON works; rankings paths do not."
        />
        <FindingRow
          question="5. Reliable without scraping?"
          answer="Not from the mobile app. Server-side cache required."
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Recommendation</Text>
        <Text style={styles.body}>{investigation.recommendedRetrievalSummary}</Text>
        <ResultRow label="Method" value="Server-side HTML fetch → parse → JSON cache → app" />
        <ResultRow
          label="Refresh (in season)"
          value={`Every ${investigation.refreshStrategy.inSeasonTtlMinutes} minutes; ${investigation.refreshStrategy.suggestedTrigger}`}
        />
        <ResultRow
          label="Poll schedule"
          value={`${investigation.pollSchedule.frequency}. ${investigation.pollSchedule.typicalRelease}.`}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Probed endpoints</Text>
        {investigation.probedEndpoints.map((entry) => (
          <ResultRow key={entry.url} label={entry.result} value={entry.url} />
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Scraping risks (if done client-side)</Text>
        {investigation.scrapingRisks.map((risk) => (
          <Text key={risk} style={styles.bullet}>
            • {risk}
          </Text>
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Reachability probe</Text>
        <Text style={styles.body}>
          HTTP metadata only — does not parse or scrape rankings in the app.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          disabled={probing}
          onPress={() => void runReachabilityProbe()}>
          {probing ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.buttonText}>Test NCAA page reachability</Text>
          )}
        </Pressable>
        {probeResult ? (
          <>
            <ResultRow
              label="HTTP status"
              value={probeResult.httpStatus != null ? String(probeResult.httpStatus) : '—'}
            />
            <ResultRow label="OK" value={probeResult.ok ? 'Yes' : 'No'} />
            <ResultRow label="Content-Type" value={probeResult.contentType ?? '—'} />
            <ResultRow
              label="Duration"
              value={`${probeResult.durationMs} ms`}
            />
            {probeResult.error ? (
              <ResultRow label="Error" value={probeResult.error} />
            ) : null}
          </>
        ) : null}
      </View>

      <View style={styles.whyPanel}>
        <Text style={styles.label}>Why not ESPN?</Text>
        <Text style={styles.body}>
          ESPN does not publish the official Stats Perform FCS Top 25. ESPN supplies scores,
          schedules, game status, TV info, and game IDs only.
        </Text>
      </View>

      <Text style={styles.footerNote}>
        Full report: src/data/providers/NCAA_RANKINGS_INVESTIGATION.md
      </Text>
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
    paddingBottom: spacing.xxl,
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
  whyPanel: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  url: {
    ...typography.caption,
    color: colors.primary,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  body: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  bullet: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...typography.label,
    color: colors.textMuted,
  },
  findingRow: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  findingQuestion: {
    ...typography.label,
    color: colors.textMuted,
  },
  findingAnswer: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
  },
  rowValue: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...typography.label,
    color: colors.background,
  },
  footerNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
