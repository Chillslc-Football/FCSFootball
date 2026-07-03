import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/theme';

export type TeamLogoSize = 'list' | 'featured' | 'poll';

const SIZE_PX: Record<TeamLogoSize, number> = {
  list: 28,
  featured: 48,
  poll: 40,
};

type TeamLogoProps = {
  name: string;
  abbreviation?: string;
  logoUrl?: string;
  size?: TeamLogoSize | number;
};

function getTeamInitials(name: string, abbreviation?: string): string {
  if (abbreviation) {
    return abbreviation.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  }

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function resolveSize(size: TeamLogoSize | number): number {
  return typeof size === 'number' ? size : SIZE_PX[size];
}

export function TeamLogo({ name, abbreviation, logoUrl, size = 'list' }: TeamLogoProps) {
  const [failed, setFailed] = useState(false);
  const dimension = resolveSize(size);
  const initials = getTeamInitials(name, abbreviation);
  const showImage = Boolean(logoUrl) && !failed;

  return (
    <View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
        },
      ]}>
      {showImage ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: logoUrl }}
          style={{ width: dimension, height: dimension, borderRadius: dimension / 2 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          style={[
            styles.initials,
            { fontSize: dimension <= 28 ? 9 : dimension <= 40 ? 10 : 12 },
          ]}
          numberOfLines={1}>
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
