import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { resolveMediaArtworkUrl } from '@/data/mediaDirectory/resolveMediaArtworkUrl';
import type { MediaSource } from '@/data/mediaDirectory/types';
import { colors, typography } from '@/theme';

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export function MediaArtwork({
  name,
  source,
  size,
}: {
  name: string;
  source: Pick<MediaSource, 'logo_url'>;
  size: number;
}) {
  const artworkUrl = resolveMediaArtworkUrl(source);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [artworkUrl]);

  const showImage = Boolean(artworkUrl) && !failed;
  const frameStyle = [styles.artworkFrame, { width: size, height: size, borderRadius: 8 }];

  if (!showImage || !artworkUrl) {
    return (
      <View style={frameStyle} accessibilityElementsHidden>
        <Text style={[styles.logoInitials, size <= 40 && styles.logoInitialsCompact]}>
          {initialsForName(name)}
        </Text>
      </View>
    );
  }

  return (
    <View style={frameStyle}>
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: artworkUrl }}
        style={{ width: size, height: size, borderRadius: 8 }}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  artworkFrame: {
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    flexShrink: 0,
  },
  logoInitials: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
    fontSize: 14,
  },
  logoInitialsCompact: {
    fontSize: 12,
  },
});
