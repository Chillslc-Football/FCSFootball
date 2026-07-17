import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fcsfootball.gameNotificationManualPrefs.v1';

let memoryFallback: Record<string, boolean> = {};

export async function loadGameNotificationManualPrefs(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...memoryFallback };

    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ...memoryFallback };
    }

    const prefs: Record<string, boolean> = {};
    for (const [eventId, enabled] of Object.entries(parsed)) {
      if (typeof eventId === 'string' && eventId.trim() && typeof enabled === 'boolean') {
        prefs[eventId] = enabled;
      }
    }

    memoryFallback = prefs;
    return { ...prefs };
  } catch {
    return { ...memoryFallback };
  }
}

export async function saveGameNotificationManualPrefs(
  prefs: Record<string, boolean>,
): Promise<void> {
  memoryFallback = prefs;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // In-memory fallback already updated.
  }
}

export async function setGameNotificationManualPref(
  eventId: string,
  enabled: boolean,
): Promise<Record<string, boolean>> {
  const prefs = await loadGameNotificationManualPrefs();
  const next = { ...prefs, [eventId]: enabled };
  await saveGameNotificationManualPrefs(next);
  return next;
}

/** Manual preference wins; otherwise use favorite-team default. */
export function resolveGameAlertsEnabled(
  eventId: string,
  favoriteDefaultEnabled: boolean,
  manualPrefs: Record<string, boolean>,
): boolean {
  if (Object.prototype.hasOwnProperty.call(manualPrefs, eventId)) {
    return manualPrefs[eventId] === true;
  }
  return favoriteDefaultEnabled;
}
