/**
 * Pure helpers for Expo Go / enforcement decisions.
 * Accept injected ownership/environment so Node tests need no react-native.
 */

export function isExpoGoClientFromConstants(input: {
  appOwnership?: string | null;
  executionEnvironment?: string | null;
}): boolean {
  if (input.appOwnership === 'expo') return true;
  if (input.executionEnvironment === 'storeClient') return true;
  return false;
}

export function shouldEnforceReleasePolicyFromConstants(input: {
  appOwnership?: string | null;
  executionEnvironment?: string | null;
}): boolean {
  return !isExpoGoClientFromConstants(input);
}
