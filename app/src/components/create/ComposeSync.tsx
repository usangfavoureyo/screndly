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

function mergeComposeItems(localItems: ComposeItem[], remoteItems: ComposeItem[]) {
  const merged = new Map<string, ComposeItem>();

  for (const item of [...remoteItems, ...localItems]) {
    const normalizedItem = sanitizeComposeItem(normalizeComposeItem(item));
    const existing = merged.get(normalizedItem.id);

    if (!existing) {
      merged.set(normalizedItem.id, normalizedItem);
      continue;
    }

    const existingTimestamp = Math.max(toTimestamp(existing.updatedAt), toTimestamp(existing.createdAt));
    const nextTimestamp = Math.max(toTimestamp(normalizedItem.updatedAt), toTimestamp(normalizedItem.createdAt));
    merged.set(normalizedItem.id, nextTimestamp >= existingTimestamp ? normalizedItem : existing);
  }

  return Array.from(merged.values()).sort((left, right) => {
    const rightTimestamp = Math.max(toTimestamp(right.updatedAt), toTimestamp(right.createdAt));
    const leftTimestamp = Math.max(toTimestamp(left.updatedAt), toTimestamp(left.createdAt));
    return rightTimestamp - leftTimestamp;
  });
}

export function ComposeSync() {
  const items = useComposeStore((state) => state.items);
  const replaceItems = useComposeStore((state) => state.replaceItems);
  const hydratedRef = useRef(false);
  const lastSyncedSignatureRef = useRef<string | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const itemsSignature = useMemo(() => buildSignature(items), [items]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const localItems = normalizeItems(useComposeStore.getState().items);

      try {
        const response = await composeApi.getState();
        if (!response.success || !response.data) {
          lastSyncedSignatureRef.current = buildSignature(localItems);
          hydratedRef.current = true;
          return;
        }

        const remoteItems = normalizeItems(Array.isArray(response.data.items) ? response.data.items : []);
        const mergedItems = mergeComposeItems(localItems, remoteItems);
        const mergedSignature = buildSignature(mergedItems);
        const remoteSignature = buildSignature(remoteItems);

        if (!cancelled) {
          replaceItems(mergedItems);
          lastSyncedSignatureRef.current = mergedSignature;
          hydratedRef.current = true;
        }

        if (mergedSignature !== remoteSignature) {
          await composeApi.saveState(mergedItems);
          if (!cancelled) {
            lastSyncedSignatureRef.current = mergedSignature;
          }
        }
      } catch (error) {
        console.warn('[ComposeSync] Failed to hydrate compose drafts:', error);
        lastSyncedSignatureRef.current = buildSignature(localItems);
        hydratedRef.current = true;
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
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
