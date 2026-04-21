import { useEffect, useMemo, useRef } from 'react';
import { composeApi } from '../../lib/api/compose';
import { normalizeComposeItem, sanitizeComposeItem } from '../../lib/create/composeMedia';
import { useComposeStore } from '../../store/useComposeStore';
import type { ComposeItem } from '../../types/compose';

function toTimestamp(value?: string) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeItems(items: ComposeItem[]) {
  return items.map((item) => sanitizeComposeItem(normalizeComposeItem(item)));
}

function buildSignature(items: ComposeItem[]) {
  return JSON.stringify(normalizeItems(items));
}

function sortComposeItems(items: ComposeItem[]) {
  return [...items].sort((left, right) => {
    const rightTimestamp = Math.max(toTimestamp(right.updatedAt), toTimestamp(right.createdAt));
    const leftTimestamp = Math.max(toTimestamp(left.updatedAt), toTimestamp(left.createdAt));
    return rightTimestamp - leftTimestamp;
  });
}

function mergePublishedItem(localItem: ComposeItem, remoteItem: ComposeItem) {
  return {
    ...localItem,
    ...remoteItem,
    status: 'published' as const,
    scheduledAt: undefined,
    mediaAssets: remoteItem.mediaAssets.length > 0 ? remoteItem.mediaAssets : localItem.mediaAssets,
    platformFields:
      remoteItem.platformFields && Object.keys(remoteItem.platformFields).length > 0
        ? remoteItem.platformFields
        : localItem.platformFields,
  };
}

function mergeRemotePublishedItems(localItems: ComposeItem[], remoteItems: ComposeItem[]) {
  const localById = new Map(localItems.map((item, index) => [item.id, { item, index }]));
  const merged = [...localItems];

  for (const remoteItem of remoteItems) {
    if (remoteItem.status !== 'published') {
      continue;
    }

    const localMatch = localById.get(remoteItem.id);
    if (localMatch) {
      if (localMatch.item.status !== 'published') {
        merged[localMatch.index] = mergePublishedItem(localMatch.item, remoteItem);
      }
      continue;
    }

    merged.push(remoteItem);
  }

  return sortComposeItems(merged);
}

function getItemsUpdatedAt(items: ComposeItem[]) {
  return items.reduce((latestTimestamp, item) => {
    const itemTimestamp = Math.max(toTimestamp(item.updatedAt), toTimestamp(item.createdAt));
    return Math.max(latestTimestamp, itemTimestamp);
  }, 0);
}

export function ComposeSync() {
  const items = useComposeStore((state) => state.items);
  const replaceItems = useComposeStore((state) => state.replaceItems);
  const hydratedRef = useRef(false);
  const lastSyncedSignatureRef = useRef<string | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);

  const itemsSignature = useMemo(() => buildSignature(items), [items]);

  useEffect(() => {
    let cancelled = false;

    const pullLatestState = async () => {
      if (isRefreshingRef.current) {
        return;
      }

      isRefreshingRef.current = true;
      const { items: localStoreItems, lastModifiedAt } = useComposeStore.getState();
      const localItems = normalizeItems(localStoreItems);
      const localSignature = buildSignature(localItems);
      const localUpdatedAt = Math.max(toTimestamp(lastModifiedAt ?? undefined), getItemsUpdatedAt(localItems));

      try {
        const response = await composeApi.getState();
        if (!response.success || !response.data) {
          lastSyncedSignatureRef.current = localSignature;
          hydratedRef.current = true;
          return;
        }

        const remoteItems = sortComposeItems(normalizeItems(Array.isArray(response.data.items) ? response.data.items : []));
        const remoteSignature = buildSignature(remoteItems);
        const remoteUpdatedAt = Math.max(
          toTimestamp(response.data.updatedAt ?? undefined),
          getItemsUpdatedAt(remoteItems),
        );

        const shouldPreferRemote = localUpdatedAt === 0 || remoteUpdatedAt > localUpdatedAt;
        const nextItems = shouldPreferRemote
          ? remoteItems
          : mergeRemotePublishedItems(sortComposeItems(localItems), remoteItems);
        const nextSignature = buildSignature(nextItems);
        const nextModifiedAt = shouldPreferRemote
          ? (response.data.updatedAt ?? (remoteUpdatedAt > 0 ? new Date(remoteUpdatedAt).toISOString() : null))
          : (lastModifiedAt ?? (localUpdatedAt > 0 ? new Date(localUpdatedAt).toISOString() : null));

        if (!cancelled) {
          replaceItems(nextItems, nextModifiedAt);
          lastSyncedSignatureRef.current = nextSignature;
          hydratedRef.current = true;
        }

        if (!shouldPreferRemote && nextSignature !== remoteSignature) {
          await composeApi.saveState(nextItems);
          if (!cancelled) {
            lastSyncedSignatureRef.current = nextSignature;
          }
        }
      } catch (error) {
        console.warn('[ComposeSync] Failed to hydrate compose drafts:', error);
        lastSyncedSignatureRef.current = localSignature;
        hydratedRef.current = true;
      } finally {
        isRefreshingRef.current = false;
      }
    };

    void pullLatestState();

    const intervalId = window.setInterval(() => {
      void pullLatestState();
    }, 30000);

    const handleFocus = () => {
      void pullLatestState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void pullLatestState();
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [replaceItems]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    if (itemsSignature === lastSyncedSignatureRef.current) {
      return;
    }

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      const normalizedItems = normalizeItems(useComposeStore.getState().items);
      const nextSignature = buildSignature(normalizedItems);

      if (nextSignature === lastSyncedSignatureRef.current) {
        return;
      }

      try {
        const response = await composeApi.saveState(normalizedItems);
        if (response.success) {
          lastSyncedSignatureRef.current = nextSignature;
          return;
        }

        console.warn('[ComposeSync] Failed to persist compose drafts:', response.error?.message);
      } catch (error) {
        console.warn('[ComposeSync] Failed to persist compose drafts:', error);
      }
    }, 500);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [itemsSignature]);

  return null;
}
