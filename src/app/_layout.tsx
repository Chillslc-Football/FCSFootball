import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';

import { FavoriteTeamsProvider } from '@/data/favorites/FavoriteTeamsContext';
import { FollowedGamesProvider } from '@/data/notifications/FollowedGamesContext';
import { SelectedConferenceProvider } from '@/data/conferences/SelectedConferenceContext';
import { AppUpdateGate } from '@/components/AppUpdateGate';
import { NotificationBootstrap } from '@/components/NotificationBootstrap';
import { WelcomeV1Gate } from '@/components/WelcomeV1Gate';
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
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.header },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: '600' },
                headerBackTitle: 'Back',
                contentStyle: { backgroundColor: colors.background },
              }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="developer" options={{ headerShown: false }} />
              <Stack.Screen name="admin" options={{ headerShown: false }} />
              <Stack.Screen name="media" options={{ title: 'FCS Media' }} />
              <Stack.Screen name="creator/[id]" options={{ title: 'Creator' }} />
              <Stack.Screen name="update-creator/[id]" options={{ title: 'Update Creator' }} />
              <Stack.Screen name="suggest-fcs-media" options={{ title: 'Suggest FCS Media' }} />
              <Stack.Screen name="suggest-media" options={{ title: 'Suggest media' }} />
              <Stack.Screen name="feedback" options={{ title: 'Send Feedback' }} />
              <Stack.Screen name="about" options={{ title: 'About FCS Pulse' }} />
              <Stack.Screen name="team/[teamId]" options={{ title: 'Team' }} />
            </Stack>
            {/* Overlays (not Stack routes): preserve deep-link destinations underneath. */}
            <WelcomeV1Gate />
            <AppUpdateGate />
          </SelectedConferenceProvider>
        </FollowedGamesProvider>
      </FavoriteTeamsProvider>
    </ThemeProvider>
  );
}
