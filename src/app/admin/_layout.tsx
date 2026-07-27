import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="index" options={{ title: 'Media admin' }} />
      <Stack.Screen name="[id]" options={{ title: 'Review submission' }} />
    </Stack>
  );
}
