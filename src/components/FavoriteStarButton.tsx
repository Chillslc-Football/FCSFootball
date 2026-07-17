import { StyleSheet } from 'react-native';

import { FavoriteStar } from '@/components/FavoriteStar';
import { spacing } from '@/theme';
import type { TeamProfile } from '@/data/teams/loadTeamSeasonGames';

type FavoriteStarButtonProps = {
  profile: TeamProfile;
  routeId: string;
};

export function FavoriteStarButton({ profile, routeId }: FavoriteStarButtonProps) {
  return (
    <FavoriteStar
      teamId={profile.espnTeamId ?? routeId}
      teamName={profile.displayName}
      abbreviation={profile.abbreviation}
      logoUrl={profile.logoUrl}
      conference={profile.conference}
      rank={profile.rank}
      record={profile.record}
      size="default"
      style={styles.button}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    marginLeft: spacing.xs,
  },
});
