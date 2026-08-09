import { Linking, Platform } from 'react-native';

import { readApplicationId } from '@/data/release/installedAppVersion';
import {
  resolveStoreOpenPlan,
  type StoreOpenPlan,
} from '@/data/release/storeOpenPlan';
import type { AppReleasePlatform } from '@/data/release/types';

export type { StoreOpenPlan };
export { resolveStoreOpenPlan } from '@/data/release/storeOpenPlan';

/** Open native store scheme first, then HTTPS. Returns false if nothing could open. */
export async function openStoreListing(input: {
  platform: AppReleasePlatform;
  storeUrl?: string | null;
}): Promise<{ opened: boolean; openedUrl?: string; error?: string }> {
  const applicationId =
    input.platform === 'android' && Platform.OS === 'android'
      ? readApplicationId()
      : null;

  const plan = resolveStoreOpenPlan({
    platform: input.platform,
    storeUrl: input.storeUrl,
    applicationId,
  });

  const candidates = [plan.nativeUrl, plan.httpsUrl].filter(
    (url): url is string => Boolean(url),
  );

  if (candidates.length === 0) {
    return {
      opened: false,
      error:
        'Store listing URL is not configured yet. Add store_url for this platform in app_release_policy.',
    };
  }

  for (const url of candidates) {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen && !url.startsWith('http')) {
        continue;
      }
      await Linking.openURL(url);
      return { opened: true, openedUrl: url };
    } catch {
      // try next candidate
    }
  }

  return { opened: false, error: 'Could not open the store listing.' };
}
