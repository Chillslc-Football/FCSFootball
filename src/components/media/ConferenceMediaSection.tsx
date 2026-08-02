import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ContextualMediaPreview } from '@/components/media/ContextualMediaPreview';
import {
  CONTEXTUAL_MEDIA_INLINE_LIMIT,
  buildSuggestMediaHref,
  isKnownMediaConferenceId,
  selectConferenceContextualMedia,
} from '@/data/mediaDirectory/contextualMedia';
import { prepareDiscoverConferenceMediaNavigation } from '@/data/mediaDirectory/discoverMediaNavigation';
import { loadApprovedMediaSources } from '@/data/mediaDirectory/mediaSourcesApi';
import type { MediaSource } from '@/data/mediaDirectory/types';

export function ConferenceMediaSection({
  conferenceId,
  conferenceName,
}: {
  conferenceId: string;
  conferenceName: string;
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
      selectConferenceContextualMedia(sources, {
        conferenceId,
      }),
    [conferenceId, sources],
  );

  const label = conferenceName.trim() || 'Conference';
  const heading = `${label} Media`;
  const suggestHref = buildSuggestMediaHref({
    conferenceId,
    conferenceName: label,
  });

  if (!loaded || !isKnownMediaConferenceId(conferenceId)) {
    return null;
  }

  return (
    <ContextualMediaPreview
      title={heading}
      sources={matching}
      emptyMessage="No media listed for this conference yet."
      limit={CONTEXTUAL_MEDIA_INLINE_LIMIT}
      onViewAll={() =>
        router.push(prepareDiscoverConferenceMediaNavigation(conferenceId, label))
      }
      onSuggest={() => router.push(suggestHref)}
    />
  );
}
