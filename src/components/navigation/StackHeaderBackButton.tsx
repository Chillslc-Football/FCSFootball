import { HeaderBackButton } from '@react-navigation/elements';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';

import { colors } from '@/theme';

type HeaderBackButtonProps = ComponentProps<typeof HeaderBackButton>;

/**
 * Visible Back control that pops the root navigation history.
 * Needed for nested admin/developer stacks whose index screens otherwise
 * have no in-stack parent and hide the default back button.
 */
export function StackHeaderBackButton(props: HeaderBackButtonProps) {
  const router = useRouter();

  if (!router.canGoBack()) {
    return null;
  }

  return (
    <HeaderBackButton
      {...props}
      label="Back"
      tintColor={colors.text}
      onPress={() => router.back()}
    />
  );
}
