import * as SecureStore from 'expo-secure-store';

const DEVICE_UUID_KEY = 'fcsfootball.deviceUuid.v1';

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_UUID_KEY);
    if (existing?.trim()) {
      return existing.trim();
    }
  } catch {
    // Fall through to generate a new ID.
  }

  const next = generateUuid();
  try {
    await SecureStore.setItemAsync(DEVICE_UUID_KEY, next);
  } catch {
    // Caller may still use the generated ID for this session.
  }
  return next;
}
