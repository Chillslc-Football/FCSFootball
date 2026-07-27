import * as Linking from 'expo-linking';

/** Open an external media provider URL using the project’s Linking helper. */
export async function openMediaUrl(url: string | null | undefined): Promise<boolean> {
  const trimmed = url?.trim();
  if (!trimmed) return false;

  try {
    const canOpen = await Linking.canOpenURL(trimmed);
    if (!canOpen) {
      console.warn('[openMediaUrl] cannot open URL:', trimmed);
      return false;
    }
    await Linking.openURL(trimmed);
    return true;
  } catch (error) {
    console.warn('[openMediaUrl] failed:', error);
    return false;
  }
}

export function hasMediaUrl(url: string | null | undefined): boolean {
  return Boolean(url?.trim());
}
