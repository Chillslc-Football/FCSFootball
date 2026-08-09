import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Versioned welcome completion flags.
 * Use a new key for future onboarding (e.g. fcs_pulse_welcome_v2_complete).
 */
export const WELCOME_V1_COMPLETE_KEY = 'fcs_pulse_welcome_v1_complete';

type WelcomeResetListener = () => void;

const resetListeners = new Set<WelcomeResetListener>();

function isAsyncStorageReady(): boolean {
  return (
    typeof AsyncStorage?.getItem === 'function' &&
    typeof AsyncStorage?.setItem === 'function' &&
    typeof AsyncStorage?.removeItem === 'function'
  );
}

/** Parse stored welcome completion value (exported for tests). */
export function parseWelcomeCompleteFlag(raw: string | null | undefined): boolean {
  return raw === '1' || raw === 'true';
}

/** True when Version 1 welcome has been completed on this device. */
export async function isWelcomeV1Complete(): Promise<boolean> {
  if (!isAsyncStorageReady()) {
    console.warn('[welcomeStorage] AsyncStorage unavailable; treating welcome as incomplete');
    return false;
  }

  try {
    const raw = await AsyncStorage.getItem(WELCOME_V1_COMPLETE_KEY);
    return parseWelcomeCompleteFlag(raw);
  } catch (error) {
    console.warn('[welcomeStorage] read failed:', error);
    return false;
  }
}

export async function markWelcomeV1Complete(): Promise<void> {
  if (!isAsyncStorageReady()) {
    console.warn('[welcomeStorage] AsyncStorage unavailable; welcome completion not persisted');
    return;
  }

  try {
    await AsyncStorage.setItem(WELCOME_V1_COMPLETE_KEY, '1');
  } catch (error) {
    console.warn('[welcomeStorage] write failed:', error);
  }
}

/** Developer-only reset — clears V1 flag and notifies mounted gate. */
export async function resetWelcomeV1Complete(): Promise<void> {
  if (isAsyncStorageReady()) {
    try {
      await AsyncStorage.removeItem(WELCOME_V1_COMPLETE_KEY);
    } catch (error) {
      console.warn('[welcomeStorage] reset failed:', error);
    }
  }

  for (const listener of resetListeners) {
    try {
      listener();
    } catch (error) {
      console.warn('[welcomeStorage] reset listener failed:', error);
    }
  }
}

export function subscribeWelcomeV1Reset(listener: WelcomeResetListener): () => void {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}
