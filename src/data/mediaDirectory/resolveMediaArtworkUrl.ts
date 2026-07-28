import { isValidHttpUrl } from '@/data/mediaDirectory/mediaSourceValidation';
import type { MediaSource } from '@/data/mediaDirectory/types';

/**
 * Resolve display artwork for a media source card.
 *
 * Preferred order (schema-limited today):
 * 1. Explicitly stored `logo_url` (only artwork field on MediaSource)
 * 2. Spotify / RSS / Apple / YouTube metadata — not stored as separate fields;
 *    the app does not fetch provider artwork at runtime
 * 3. Caller shows the neutral initials placeholder when this returns null
 *
 * Note: Some local seeds store Spotify CDN image URLs in `logo_url`. That is
 * still case (1) — a stored URL — not a live Spotify API lookup.
 */
export function resolveMediaArtworkUrl(
  source: Pick<MediaSource, 'logo_url'>,
): string | null {
  const logo = source.logo_url?.trim();
  if (!logo) return null;
  if (!isValidHttpUrl(logo)) return null;
  return logo;
}
