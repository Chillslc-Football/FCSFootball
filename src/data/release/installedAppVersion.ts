import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  isExpoGoClientFromConstants,
  shouldEnforceReleasePolicyFromConstants,
} from '@/data/release/releasePolicyEnv';
import type { AppReleasePlatform } from '@/data/release/types';

/** Expo Go must never be compared against production FCS Pulse build policy. */
export function isExpoGoClient(): boolean {
  return isExpoGoClientFromConstants({
    appOwnership: Constants.appOwnership,
    executionEnvironment: Constants.executionEnvironment,
  });
}

/** Production store builds (and most custom clients) enforce policy; Expo Go does not. */
export function shouldEnforceReleasePolicy(): boolean {
  return shouldEnforceReleasePolicyFromConstants({
    appOwnership: Constants.appOwnership,
    executionEnvironment: Constants.executionEnvironment,
  });
}

export function resolveReleasePlatform(
  platform: string = Platform.OS,
): AppReleasePlatform | null {
  if (platform === 'ios') return 'ios';
  if (platform === 'android') return 'android';
  return null;
}

/**
 * Native store build number:
 * - iOS: CFBundleVersion (EAS remote buildNumber)
 * - Android: versionCode (EAS remote versionCode)
 */
export function readInstalledNativeBuild(): number | null {
  const raw = Application.nativeBuildVersion?.trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

export function readInstalledMarketingVersion(): string | null {
  return Application.nativeApplicationVersion?.trim() || null;
}

export function readApplicationId(): string | null {
  return Application.applicationId?.trim() || null;
}
