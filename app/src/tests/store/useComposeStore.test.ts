import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useComposeStore } from '../../store/useComposeStore';

function buildDraftItem() {
  return {
    id: 'draft-post',
    title: 'Draft post',
    status: 'draft' as const,
    mediaAssets: [
      {
        id: 'asset-1',
        kind: 'video' as const,
        fileName: 'clip.mp4',
        mimeType: 'video/mp4',
        size: 4096,
        order: 0,
        storageUrl: 'https://cdn.example.com/clip.mp4',
        previewUrl: 'https://authorized.example.com/clip.mp4?Authorization=expired',
        uploadStatus: 'uploaded' as const,
      },
    ],
    platforms: ['instagram_stories'],
    sharedCaption: 'Caption',
    platformFields: {},
    createdAt: '2026-04-09T10:00:00.000Z',
    updatedAt: '2026-04-09T10:00:00.000Z',
  };
}

describe('useComposeStore quota hardening', () => {
  beforeEach(() => {
    if (useComposeStore.persist?.clearStorage) {
      useComposeStore.persist.clearStorage();
    }
    window.localStorage.clear();
    useComposeStore.setState({ items: [], activeItemId: null, lastModifiedAt: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps compose actions working when browser storage is full', () => {
    const quotaError = new DOMException(
      "Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota.",
      'QuotaExceededError',
    );
    const originalSetItem = Storage.prototype.setItem;

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(key: string, value: string) {
      if (key === 'screndly-compose-store') {
        throw quotaError;
      }

      return Reflect.apply(originalSetItem, this, [key, value]);
    });

    expect(() => {
      useComposeStore.getState().setActiveItemId('draft-post');
      useComposeStore.getState().saveItem(buildDraftItem());
    }).not.toThrow();

    expect(useComposeStore.getState().activeItemId).toBe('draft-post');
    expect(useComposeStore.getState().items).toHaveLength(1);
  });
});
