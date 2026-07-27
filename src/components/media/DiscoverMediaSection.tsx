import * as Linking from 'expo-linking';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { groupPublicMediaCreators } from '@/data/media/mediaValidation';
import { listPublicMediaCreators } from '@/data/media/mediaPublicApi';
import {
  MEDIA_RESOURCE_TYPE_LABELS,
  type PublicMediaCreator,
  type PublicMediaLink,
} from '@/data/media/types';
import { colors, spacing, typography } from '@/theme';

export function DiscoverMediaSection() {
  const [creators, setCreators] = useState<PublicMediaCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listPublicMediaCreators();
      setCreators(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => groupPublicMediaCreators(creators), [creators]);

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (creators.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>
          Approved creators and outlets will appear here. Suggest media to get started.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {grouped.national.length > 0 ? (
        <CreatorGroup
          title="National"
          creators={grouped.national}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
        />
      ) : null}
      {grouped.team.length > 0 ? (
        <CreatorGroup
          title="Teams"
          creators={grouped.team}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
        />
      ) : null}
    </View>
  );
}

function CreatorGroup({
  title,
  creators,
  expandedId,
  onToggle,
}: {
  title: string;
  creators: PublicMediaCreator[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {creators.map((creator) => (
        <CreatorCard
          key={creator.id}
          creator={creator}
          expanded={expandedId === creator.id}
          onPress={() => onToggle(creator.id)}
        />
      ))}
    </View>
  );
}

function CreatorCard({
  creator,
  expanded,
  onPress,
}: {
  creator: PublicMediaCreator;
  expanded: boolean;
  onPress: () => void;
}) {
  const typeSummary = summarizeLinkTypes(creator.links);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <Text style={styles.creatorName}>{creator.name}</Text>
      {creator.description ? (
        <Text style={styles.creatorDescription} numberOfLines={expanded ? undefined : 2}>
          {creator.description}
        </Text>
      ) : null}
      {creator.scope === 'team' && creator.team_name ? (
        <Text style={styles.teamLabel}>{creator.team_name}</Text>
      ) : null}
      <Text style={styles.typeSummary}>{typeSummary}</Text>

      {expanded ? (
        <View style={styles.linkList}>
          {creator.links.length === 0 ? (
            <Text style={styles.emptyText}>No active links yet.</Text>
          ) : (
            creator.links.map((link) => <LinkRow key={link.id} link={link} />)
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

function LinkRow({ link }: { link: PublicMediaLink }) {
  const typeLabel = MEDIA_RESOURCE_TYPE_LABELS[link.resource_type] ?? 'Link';
  const title = link.label?.trim() || typeLabel;

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(link.url)}
      style={({ pressed }) => [styles.linkRow, pressed && styles.cardPressed]}>
      <Text style={styles.linkType}>{typeLabel}</Text>
      <Text style={styles.linkLabel} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

function summarizeLinkTypes(links: PublicMediaLink[]): string {
  if (!links.length) return 'No links yet';
  const labels = [...new Set(links.map((link) => MEDIA_RESOURCE_TYPE_LABELS[link.resource_type]))];
  return labels.join(' · ');
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  loadingBox: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  emptyText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  group: { gap: spacing.sm },
  groupTitle: {
    ...typography.label,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardPressed: { opacity: 0.88 },
  creatorName: { ...typography.body, fontWeight: '700', color: colors.text },
  creatorDescription: { ...typography.caption, color: colors.textSecondary },
  teamLabel: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  typeSummary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  linkList: { marginTop: spacing.sm, gap: spacing.xs },
  linkRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: 2,
  },
  linkType: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  linkLabel: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
