import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ComposeItem, ComposeStatus } from '../types/compose';

interface ComposeStoreState {
  items: ComposeItem[];
  activeItemId: string | null;
  setActiveItemId: (itemId: string | null) => void;
  saveItem: (item: ComposeItem) => void;
  deleteItem: (itemId: string) => void;
  getItemById: (itemId: string | null) => ComposeItem | undefined;
  updateStatus: (itemId: string, status: ComposeStatus, scheduledAt?: string) => void;
}

function sanitizeItem(item: ComposeItem): ComposeItem {
  if (!item.media?.previewUrl || !item.media.previewUrl.startsWith('blob:')) {
    return item;
  }

  return {
    ...item,
    media: {
      ...item.media,
      previewUrl: undefined,
    },
  };
}

export const useComposeStore = create<ComposeStoreState>()(
  persist(
    (set, get) => ({
      items: [],
      activeItemId: null,
      setActiveItemId: (itemId) => set({ activeItemId: itemId }),
      saveItem: (item) =>
        set((state) => {
          const existingIndex = state.items.findIndex((entry) => entry.id === item.id);
          if (existingIndex === -1) {
            return { items: [item, ...state.items], activeItemId: item.id };
          }

          const nextItems = [...state.items];
          nextItems[existingIndex] = item;
          return { items: nextItems, activeItemId: item.id };
        }),
      deleteItem: (itemId) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId),
          activeItemId: state.activeItemId === itemId ? null : state.activeItemId,
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
        })),
    }),
    {
      name: 'screndly-compose-store',
      partialize: (state) => ({
        items: state.items.map(sanitizeItem),
        activeItemId: state.activeItemId,
      }),
    },
  ),
);
