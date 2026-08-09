import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ContextualMediaPreview } from '@/components/media/ContextualMediaPreview';
import {
  CONTEXTUAL_MEDIA_INLINE_LIMIT,
  TEAM_CONTEXTUAL_MEDIA_EMPTY_MESSAGE,
  TEAM_CONTEXTUAL_MEDIA_EMPTY_SUPPORTING,
  buildSuggestMediaHref,
  selectTeamContextualMedia,
} from '@/data/mediaDirectory/contextualMedia';
import { prepareDiscoverTeamMediaNavigation } from '@/data/mediaDirectory/discoverMediaNavigation';
import { loadApprovedMediaSources } from '@/data/mediaDirectory/mediaSourcesApi';
import type { MediaSource } from '@/data/mediaDirectory/types';

export function TeamMediaSection({
  espnTeamId,
  teamName,
  conferenceId,
  conferenceName,
}: {
  espnTeamId: string;
  teamName: string;
  conferenceId?: string | null;
  conferenceName?: string | null;
}) {
  const router = useRouter();
  const [sources, setSources] = useState<MediaSource[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const result = await loadApprovedMediaSources();
    setSources(result.sources);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const matching = useMemo(
    () =>
      selectTeamContextualMedia(sources, {
        teamId: espnTeamId,
        conferenceId,
      }),
    [conferenceId, espnTeamId, sources],
  );

  const heading = `Media covering ${teamName.trim() || 'this team'}`;
  const suggestHref = buildSuggestMediaHref({
    teamId: espnTeamId,
    teamName,
    conferenceId,
    conferenceName,
  });

  if (!loaded) {
    return null;
  }

  return (
    <ContextualMediaPreview
      title={heading}
      sources={matching}
      emptyMessage={TEAM_CONTEXTUAL_MEDIA_EMPTY_MESSAGE}
      emptySupportingMessage={TEAM_CONTEXTUAL_MEDIA_EMPTY_SUPPORTING}
      limit={CONTEXTUAL_MEDIA_INLINE_LIMIT}
      compact
      onViewAll={() => router.push(prepareDiscoverTeamMediaNavigation(espnTeamId, teamName))}
      onSuggest={() => router.push(suggestHref)}
      onPressSource={(source) =>
        router.push(`/creator/${encodeURIComponent(source.id)}` as Href)
      }
    />
  );
}
