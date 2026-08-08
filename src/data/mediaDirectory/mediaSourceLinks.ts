import {
  platformLinksToMediaLinkRows,
  type MediaLinkRow,
} from '@/data/mediaDirectory/mediaLinkRows';
import { hasMediaUrl } from '@/data/mediaDirectory/openMediaUrl';
import type { MediaSource } from '@/data/mediaDirectory/types';

/** Actionable platform links for a source, preserving sortOrder. */
export function getMediaSourceActionLinks(source: MediaSource): MediaLinkRow[] {
  if (source.links?.length) {
    return source.links
      .filter((link) => hasMediaUrl(link.url))
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return platformLinksToMediaLinkRows({
    spotify: source.spotify_url ?? undefined,
    youtube: source.youtube_url ?? undefined,
    x: source.x_url ?? undefined,
    apple: source.apple_podcast_url ?? undefined,
  }).filter((link) => hasMediaUrl(link.url));
}
