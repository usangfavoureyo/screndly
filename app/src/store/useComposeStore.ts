import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { ComposeItem, ComposeStatus } from '../types/compose';
import { normalizeComposeItem, sanitizeComposeItem } from '../lib/create/composeMedia';

interface ComposeStoreState {
  items: ComposeItem[];
  activeItemId: string | null;
  lastModifiedAt: string | null;
  setActiveItemId: (itemId: string | null) => void;
  replaceItems: (items: ComposeItem[], lastModifiedAt?: string | null) => void;
  saveItem: (item: ComposeItem) => void;
  deleteItem: (itemId: string) => void;
  getItemById: (itemId: string | null) => ComposeItem | undefined;
  updateStatus: (itemId: string, status: ComposeStatus, scheduledAt?: string) => void;
}

const COMPOSE_STORAGE_KEY = 'screndly-compose-store';
const COMPOSE_PERSISTED_PUBLISHED_LIMIT = 8;

type PersistedComposeState = {
  state?: {
    items?: ComposeItem[];
    activeItemId?: string | null;
    lastModifiedAt?: string | null;
  };
  version?: number;
};

function isStorageQuotaError(error: unknown) {
  return error instanceof DOMException
    && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
}

function stripRedundantRemotePreviewUrl<T extends { previewUrl?: string; storageUrl?: string }>(asset: T): T {
  if (!asset.previewUrl || !asset.storageUrl) {
    return asset;
  }

  if (asset.previewUrl.startsWith('blob:') || asset.previewUrl === asset.storageUrl) {
    return asset;
  }

  return {
    ...asset,
    previewUrl: undefined,
  };
}

function compactComposeItemForPersistence(item: ComposeItem, preservePreviewUrls: boolean) {
  const sanitizedItem = sanitizeComposeItem(item);
  if (preservePreviewUrls) {
    return sanitizedItem;
  }

  return {
    ...sanitizedItem,
    mediaAssets: sanitizedItem.mediaAssets.map((asset) => stripRedundantRemotePreviewUrl(asset)),
    platformFields: {
      ...sanitizedItem.platformFields,
      thumbnails: sanitizedItem.platformFields.thumbnails
        ? {
            shared: sanitizedItem.platformFields.thumbnails.shared
              ? stripRedundantRemotePreviewUrl(sanitizedItem.platformFields.thumbnails.shared)
              : undefined,
            youtube: sanitizedItem.platformFields.thumbnails.youtube
              ? stripRedundantRemotePreviewUrl(sanitizedItem.platformFields.thumbnails.youtube)
              : undefined,
            x: sanitizedItem.platformFields.thumbnails.x
              ? stripRedundantRemotePreviewUrl(sanitizedItem.platformFields.thumbnails.x)
              : undefined,
          }
        : undefined,
      videoProcessing: sanitizedItem.platformFields.videoProcessing
        ? {
            ...sanitizedItem.platformFields.videoProcessing,
            threadsXCrop: sanitizedItem.platformFields.videoProcessing.threadsXCrop
              ? stripRedundantRemotePreviewUrl(sanitizedItem.platformFields.videoProcessing.threadsXCrop)
              : undefined,
          }
        : undefined,
    },
  };
}

export function compactComposeItemsForPersistence(items: ComposeItem[]) {
  const nonPublishedItems = items
    .filter((item) => item.status !== 'published')
    .map((item) => compactComposeItemForPersistence(item, true));
  const recentPublishedItems = items
    .filter((item) => item.status === 'published')
    .slice(0, COMPOSE_PERSISTED_PUBLISHED_LIMIT)
    .map((item) => compactComposeItemForPersistence(item, false));

  return [...nonPublishedItems, ...recentPublishedItems].map((item) => ({
    ...item,
    sourceMetadata:
      typeof item.sourceMetadata === 'string' && item.sourceMetadata.length > 2000
        ? item.sourceMetadata.slice(0, 2000)
        : item.sourceMetadata,
    error:
      typeof item.error === 'string' && item.error.length > 600
        ? item.error.slice(0, 600)
        : item.error,
  }));
}

function compactPersistedComposeValue(rawValue: string) {
  const parsed = JSON.parse(rawValue) as PersistedComposeState;
  const items = Array.isArray(parsed?.state?.items) ? parsed.state.items : [];

  return JSON.stringify({
    ...parsed,
    state: {
      ...parsed.state,
      items: compactComposeItemsForPersistence(items),
    },
  });
}

const composeStateStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem(name);
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(name, value);
      return;
    } catch (error) {
      if (name !== COMPOSE_STORAGE_KEY || !isStorageQuotaError(error)) {
        throw error;
      }
    }

    try {
      window.localStorage.setItem(name, compactPersistedComposeValue(value));
    } catch (fallbackError) {
      if (name !== COMPOSE_STORAGE_KEY || !isStorageQuotaError(fallbackError)) {
        throw fallbackError;
      }

      console.warn('[ComposeStore] Local storage quota exceeded. Falling back to a minimal persisted compose snapshot.');
      const parsed = JSON.parse(value) as PersistedComposeState;
      const items = Array.isArray(parsed?.state?.items) ? parsed.state.items : [];
      const activeItemId = parsed?.state?.activeItemId ?? null;
      const minimalItems = compactComposeItemsForPersistence(items).filter(
        (item) => item.status !== 'published' || item.id === activeItemId,
      );

      window.localStorage.setItem(name, JSON.stringify({
        ...parsed,
        state: {
          ...parsed.state,
          items: minimalItems,
        },
      }));
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(name);
  },
};

export const useComposeStore = create<ComposeStoreState>()(
  persist(
    (set, get) => ({
      items: [],
      activeItemId: null,
      lastModifiedAt: null,
      setActiveItemId: (itemId) => set({ activeItemId: itemId }),
      replaceItems: (items, lastModifiedAt) =>
        set(() => ({
          items: items.map(normalizeComposeItem),
          lastModifiedAt: lastModifiedAt ?? new Date().toISOString(),
        })),
      saveItem: (item) =>
        set((state) => {
          const modifiedAt = new Date().toISOString();
          const normalizedItem = normalizeComposeItem(item);
          const existingIndex = state.items.findIndex((entry) => entry.id === normalizedItem.id);
          if (existingIndex === -1) {
            return {
              items: [normalizedItem, ...state.items],
              activeItemId: normalizedItem.id,
              lastModifiedAt: modifiedAt,
            };
          }

          const nextItems = [...state.items];
          nextItems[existingIndex] = normalizedItem;
          return {
            items: nextItems,
            activeItemId: normalizedItem.id,
            lastModifiedAt: modifiedAt,
          };
        }),
      deleteItem: (itemId) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId),
          activeItemId: state.activeItemId === itemId ? null : state.activeItemId,
          lastModifiedAt: new Date().toISOString(),
        })),
      getItemById: (itemId) => get().items.find((item) => item.id === itemId),
      updateStatus: (itemId, status, scheduledAt) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status,
                  scheduledAt: scheduledAt ?? item.scheduledAt,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
          lastModifiedAt: new Date().toISOString(),
        })),
    }),
    {
      name: COMPOSE_STORAGE_KEY,
      storage: createJSONStorage(() => composeStateStorage),
      partialize: (state) => ({
        items: compactComposeItemsForPersistence(state.items),
        activeItemId: state.activeItemId,
        lastModifiedAt: state.lastModifiedAt,
      }),
      merge: (persistedState, currentState) => {
        const typedPersistedState = persistedState as Partial<ComposeStoreState> | undefined;

        return {
          ...currentState,
          ...typedPersistedState,
          items: (typedPersistedState?.items ?? currentState.items).map(normalizeComposeItem),
          lastModifiedAt: typedPersistedState?.lastModifiedAt ?? currentState.lastModifiedAt,
        };
      },
    },
  ),
);
