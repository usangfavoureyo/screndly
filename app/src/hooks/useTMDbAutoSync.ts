import { useEffect } from 'react';

interface UseTMDbAutoSyncOptions {
  enabled?: boolean;
  intervalMs?: number;
}

interface SyncOptions {
  silent?: boolean;
}

const DEFAULT_AUTO_SYNC_INTERVAL_MS = 60_000;

export function useTMDbAutoSync(
  syncPosts: (options?: SyncOptions) => Promise<void>,
  { enabled = true, intervalMs = DEFAULT_AUTO_SYNC_INTERVAL_MS }: UseTMDbAutoSyncOptions = {},
) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    const runSync = () => {
      if (document.visibilityState !== 'visible' || navigator.onLine === false) {
        return;
      }

      void syncPosts({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runSync();
      }
    };

    runSync();

    const intervalId = window.setInterval(runSync, intervalMs);

    window.addEventListener('focus', runSync);
    window.addEventListener('online', runSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', runSync);
      window.removeEventListener('online', runSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs, syncPosts]);
}
