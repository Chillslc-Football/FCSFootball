import { Stack } from 'expo-router';

import { StackHeaderBackButton } from '@/components/navigation/StackHeaderBackButton';
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
        headerLeft: (props) => <StackHeaderBackButton {...props} />,
      }}>
      <Stack.Screen name="index" options={{ title: 'Admin' }} />
      <Stack.Screen name="media-submissions" options={{ title: 'Media submissions' }} />
      <Stack.Screen name="[id]" options={{ title: 'Review submission' }} />
    </Stack>
  );
}
