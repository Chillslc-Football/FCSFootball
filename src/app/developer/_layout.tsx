import { Stack } from 'expo-router';

import { StackHeaderBackButton } from '@/components/navigation/StackHeaderBackButton';
import { colors } from '@/theme';

export default function DeveloperLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.header },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: colors.background },
        headerLeft: (props) => <StackHeaderBackButton {...props} />,
      }}>
      <Stack.Screen name="index" options={{ title: 'Developer' }} />
      <Stack.Screen name="data-test" options={{ title: 'Data Test' }} />
      <Stack.Screen name="espn-test" options={{ title: 'ESPN Data Test' }} />
      <Stack.Screen name="ncaa-rankings-test" options={{ title: 'NCAA Rankings Test' }} />
      <Stack.Screen name="notification-test" options={{ title: 'Notification Test' }} />
      <Stack.Screen
        name="notification-diagnostics"
        options={{ title: 'Notification Diagnostics' }}
      />
      <Stack.Screen name="live-game-simulator" options={{ title: 'Live Game Simulator' }} />
    </Stack>
  );
}
