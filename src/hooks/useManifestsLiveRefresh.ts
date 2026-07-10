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
      dispatch(api.util.invalidateTags(['HawbManifest']));
    });

    return () => source.close();
  }, [accessToken, dispatch]);
}
