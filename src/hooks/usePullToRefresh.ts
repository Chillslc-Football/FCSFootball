import { useCallback, useRef, useState } from 'react';

export function usePullToRefresh(refreshFn: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef(false);

  const onPullToRefresh = useCallback(async () => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setRefreshing(true);

    try {
      await refreshFn();
    } catch (error) {
      console.warn('[usePullToRefresh] refresh failed:', error);
    } finally {
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }, [refreshFn]);

  return { refreshing, onPullToRefresh };
}
