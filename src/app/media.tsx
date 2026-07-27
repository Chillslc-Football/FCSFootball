import { Stack } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMediaDirectoryController } from '@/components/media/MediaDirectoryContent';
import { colors, spacing } from '@/theme';

/** Standalone FCS Media route — reuses the same directory content as Discover. */
export default function MediaScreen() {
  const insets = useSafeAreaInsets();
  const { refreshing, onPullToRefresh, content } = useMediaDirectoryController({
    showIntroSubtitle: true,
  });

  return (
    <>
      <Stack.Screen options={{ title: 'FCS Media', headerBackTitle: 'Back' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.xxl) },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onPullToRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }>
        {content}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
});
