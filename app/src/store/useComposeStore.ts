import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
      name: 'screndly-compose-store',
      partialize: (state) => ({
        items: state.items.map(sanitizeComposeItem),
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
