import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';

import { FavoriteTeamsProvider } from '@/data/favorites/FavoriteTeamsContext';
import { FollowedGamesProvider } from '@/data/notifications/FollowedGamesContext';
import { SelectedConferenceProvider } from '@/data/conferences/SelectedConferenceContext';
import { NotificationBootstrap } from '@/components/NotificationBootstrap';
import { colors } from '@/theme';

const FCSDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={FCSDarkTheme}>
      <FavoriteTeamsProvider>
        <FollowedGamesProvider>
          <SelectedConferenceProvider>
            <NotificationBootstrap />
            <StatusBar style="light" />
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="developer" options={{ headerShown: false }} />
            <Stack.Screen name="team/[teamId]" options={{ title: 'Team' }} />
          </Stack>
        </SelectedConferenceProvider>
        </FollowedGamesProvider>
      </FavoriteTeamsProvider>
    </ThemeProvider>
  );
}
