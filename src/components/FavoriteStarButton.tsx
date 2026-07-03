import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { favoriteTeamFromProfile } from '@/data/favorites/favoriteTeamsStorage';
import { useFavoriteTeams } from '@/data/favorites/FavoriteTeamsContext';
import { colors, spacing } from '@/theme';
import type { TeamProfile } from '@/data/teams/loadTeamSeasonGames';

type FavoriteStarButtonProps = {
  profile: TeamProfile;
  routeId: string;
};

export function FavoriteStarButton({ profile, routeId }: FavoriteStarButtonProps) {
  const { isFavorite, toggleFavorite } = useFavoriteTeams();
  const teamKey = profile.espnTeamId ?? routeId;
  const favorited = isFavorite(teamKey, profile.displayName);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        favorited
          ? `Remove ${profile.displayName} from favorites`
          : `Add ${profile.displayName} to favorites`
      }
      accessibilityState={{ selected: favorited }}
      hitSlop={8}
      onPress={() => void toggleFavorite(favoriteTeamFromProfile(profile, routeId))}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
      <Ionicons
        name={favorited ? 'star' : 'star-outline'}
        size={22}
        color={favorited ? colors.primary : colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
