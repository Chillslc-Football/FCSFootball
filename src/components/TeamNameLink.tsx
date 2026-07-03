import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { colors, typography } from '@/theme';
import { buildTeamHref } from '@/utils/teamId';

type TeamNameLinkProps = {
  /** Full team name used for navigation and accessibility */
  name: string;
  /** Compact label shown in UI; defaults to name */
  label?: string;
  teamId?: string;
  record?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** When true, uses winner/highlight weight without changing link color. */
  emphasized?: boolean;
};

export function TeamNameLink({
  name,
  label,
  teamId,
  record,
  style,
  numberOfLines = 1,
  emphasized = false,
}: TeamNameLinkProps) {
  const router = useRouter();
  const displayName = label ?? name;
  const trimmedRecord = record?.trim();

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={
          trimmedRecord ? `View ${name} team page, record ${trimmedRecord}` : `View ${name} team page`
        }
        onPress={() => router.push(buildTeamHref({ teamId, name }))}
        style={styles.pressable}>
        <Text
          style={[styles.link, emphasized && styles.linkEmphasized, style]}
          numberOfLines={numberOfLines}
          ellipsizeMode="tail">
          {displayName}
        </Text>
      </Pressable>
      {trimmedRecord ? (
        <Text style={[styles.record, emphasized && styles.linkEmphasized, style]} numberOfLines={1}>
          {' '}({trimmedRecord})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  pressable: {
    flexShrink: 1,
    minWidth: 0,
  },
  link: {
    ...typography.body,
    color: colors.text,
  },
  record: {
    ...typography.body,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  linkEmphasized: {
    fontWeight: '700',
  },
});
