import type {
  AppUpdateDecision,
  ResolveAppUpdateStateInput,
} from '@/data/release/types';

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/**
 * Pure update decision for a single platform.
 * Malformed / missing build values → fail open (`current`).
 */
export function resolveAppUpdateState(input: ResolveAppUpdateStateInput): AppUpdateDecision {
  const { installedBuild, latestBuild, minimumSupportedBuild } = input;

  if (!isPositiveInt(installedBuild)) {
    return { state: 'current', failOpen: true, reason: 'invalid_installed_build' };
  }
  if (!isPositiveInt(latestBuild)) {
    return { state: 'current', failOpen: true, reason: 'invalid_latest_build' };
  }
  if (!isPositiveInt(minimumSupportedBuild)) {
    return { state: 'current', failOpen: true, reason: 'invalid_minimum_build' };
  }
  if (minimumSupportedBuild > latestBuild) {
    return { state: 'current', failOpen: true, reason: 'minimum_above_latest' };
  }

  if (installedBuild < minimumSupportedBuild) {
    return { state: 'required_update', failOpen: false };
  }
  if (installedBuild < latestBuild) {
    return { state: 'optional_update', failOpen: false };
  }
  return { state: 'current', failOpen: false };
}
