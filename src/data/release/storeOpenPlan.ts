import type { AppReleasePlatform } from '@/data/release/types';

export const ANDROID_PACKAGE_ID = 'com.chillslc.fcsfootball';

export type StoreOpenPlan = {
  platform: AppReleasePlatform;
  /** Preferred native store scheme when available. */
  nativeUrl: string | null;
  /** HTTPS fallback. */
  httpsUrl: string | null;
};

export function extractAppleAppId(storeUrl: string): string | null {
  const match = /\/id(\d+)/i.exec(storeUrl) || /[?&]id=(\d+)/i.exec(storeUrl);
  return match?.[1] ?? null;
}

/**
 * Build open plan from remote store_url + known package / App Store id.
 * Does not invent an App Store numeric id when missing.
 * Pure — safe for Node tests (no react-native import).
 */
export function resolveStoreOpenPlan(input: {
  platform: AppReleasePlatform;
  storeUrl?: string | null;
  applicationId?: string | null;
}): StoreOpenPlan {
  const httpsUrl = input.storeUrl?.trim() || null;

  if (input.platform === 'android') {
    const packageId = input.applicationId?.trim() || ANDROID_PACKAGE_ID;
    return {
      platform: 'android',
      nativeUrl: `market://details?id=${packageId}`,
      httpsUrl:
        httpsUrl || `https://play.google.com/store/apps/details?id=${packageId}`,
    };
  }

  const appleId = httpsUrl ? extractAppleAppId(httpsUrl) : null;
  return {
    platform: 'ios',
    nativeUrl: appleId ? `itms-apps://itunes.apple.com/app/id${appleId}` : null,
    httpsUrl,
  };
}
