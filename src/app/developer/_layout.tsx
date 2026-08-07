import { Stack } from 'expo-router';

import { StackBackButton } from '@/components/StackBackButton';
import { colors } from '@/theme';

export default function DeveloperLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Admin',
          headerLeft: () => <StackBackButton fallbackHref="/(tabs)/settings" />,
        }}
      />
      <Stack.Screen name="data-test" options={{ title: 'Data Test' }} />
      <Stack.Screen name="espn-test" options={{ title: 'ESPN Data Test' }} />
      <Stack.Screen name="ncaa-rankings-test" options={{ title: 'NCAA Rankings Test' }} />
      <Stack.Screen name="notification-test" options={{ title: 'Notification Test' }} />
      <Stack.Screen name="media-suggestions" options={{ title: 'Media Suggestions' }} />
    </Stack>
  );
}
