import { Stack } from 'expo-router';

import { StackBackButton } from '@/components/StackBackButton';
import { colors } from '@/theme';

export default function AdminLayout() {
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
          title: 'Media Admin',
          headerLeft: () => <StackBackButton fallbackHref="/developer" />,
        }}
      />
      <Stack.Screen name="[id]" options={{ title: 'Review submission' }} />
    </Stack>
  );
}
