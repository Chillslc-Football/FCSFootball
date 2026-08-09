import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fcs_pulse.home_announcement_dismissed.v1';

export async function loadDismissedAnnouncementVersion(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const trimmed = raw?.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

export async function saveDismissedAnnouncementVersion(versionKey: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, versionKey);
}

/** Test helper */
export async function clearDismissedAnnouncementVersionForTests(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
