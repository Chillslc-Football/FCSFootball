/** Authenticated Media Admin site URLs (not the legacy token review page). */

export const MEDIA_ADMIN_SITE_ORIGIN = 'https://admin.fcspulse.com';

export function buildMediaAdminSuggestionUrl(input: {
  siteOrigin?: string;
  suggestionId: string;
}): string {
  const origin = (input.siteOrigin ?? MEDIA_ADMIN_SITE_ORIGIN).replace(/\/$/, '');
  return `${origin}/suggestions/${encodeURIComponent(input.suggestionId)}`;
}

export function buildMediaAdminSourcesUrl(siteOrigin?: string): string {
  const origin = (siteOrigin ?? MEDIA_ADMIN_SITE_ORIGIN).replace(/\/$/, '');
  return `${origin}/sources`;
}
