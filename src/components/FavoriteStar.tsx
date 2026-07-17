import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { favoriteTeamFromEspnSide } from '@/data/favorites/favoriteTeamsStorage';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import { colors, spacing } from '@/theme';

export type FavoriteStarProps = {
  teamId?: string;
  teamName: string;
  /** When provided, controls display instead of re-querying favorites (use on game cards). */
  isFavorite?: boolean;
  abbreviation?: string;
  logoUrl?: string;
  conference?: string;
  rank?: number;
  record?: string;
  size?: 'compact' | 'default';
  style?: StyleProp<ViewStyle>;
};

export function FavoriteStar({
  teamId,
  teamName,
  isFavorite: isFavoriteProp,
  abbreviation,
  logoUrl,
  conference,
  rank,
  record,
  size = 'compact',
  style,
}: FavoriteStarProps) {
  const { isFavorite: lookupFavorite, toggleFavorite } = useFavoriteTeams();
  const favorited =
    isFavoriteProp ?? lookupFavorite(teamId, teamName, abbreviation);
  const iconSize = size === 'default' ? 22 : 14;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        favorited ? `Remove ${teamName} from favorites` : `Add ${teamName} to favorites`
      }
      accessibilityState={{ selected: favorited }}
      hitSlop={size === 'default' ? 8 : 6}
      onPress={(event) => {
        event.stopPropagation?.();
        void toggleFavorite(
          favoriteTeamFromEspnSide({
            teamId,
            teamName,
            abbreviation,
            logoUrl,
            conference,
            rank,
            record,
          }),
        );
      }}
      style={({ pressed }) => [
        size === 'default' ? styles.buttonDefault : styles.buttonCompact,
        pressed && styles.buttonPressed,
        style,
      ]}>
      <Ionicons
        name={favorited ? 'star' : 'star-outline'}
        size={iconSize}
        color={favorited ? colors.primary : colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  buttonCompact: {
    padding: 2,
    flexShrink: 0,
  },
  buttonDefault: {
    padding: spacing.xs,
    flexShrink: 0,
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
