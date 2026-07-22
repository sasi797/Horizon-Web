'use client';

import { useEffect } from 'react';
import { api } from '@/services/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

// Subscribes to /api/manifests-stream (SSE) and invalidates the manifests list cache
// whenever the backend reports a change, so the page refetches without the user
// having to hit refresh.
export function useManifestsLiveRefresh() {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector(state => state.auth.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    const source = new EventSource(`/api/manifests-stream?token=${encodeURIComponent(accessToken)}`);

    source.addEventListener('manifests-updated', () => {
      // A manifest-list change always comes from the same background email-ingestion
      // batch that may also create/resolve HawbJobPendingUpdate rows (duplicates,
      // blind companions) — refresh both together so the auto-apply effect on the
      // manifest detail page sees new pending updates without a manual page reload.
      dispatch(api.util.invalidateTags(['HawbManifest', 'HawbJobPendingUpdate']));
    });

    return () => source.close();
  }, [accessToken, dispatch]);
}
