import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComposeScheduler } from '../../components/create/ComposeScheduler';
import { useComposeStore } from '../../store/useComposeStore';

const publishComposeItemMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/create/composePublish', () => ({
  publishComposeItem: publishComposeItemMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ComposeScheduler', () => {
  beforeEach(() => {
    if (useComposeStore.persist?.clearStorage) {
      useComposeStore.persist.clearStorage();
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    useComposeStore.setState({ items: [], activeItemId: null, lastModifiedAt: null });
    publishComposeItemMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishes a due scheduled post once and clears scheduledAt', async () => {
    const originalSaveItem = useComposeStore.getState().saveItem;
    const saveItemSpy = vi.fn((item) => originalSaveItem(item));
    useComposeStore.setState({ saveItem: saveItemSpy });
    useComposeStore.setState({
      items: [
        {
          id: 'scheduled-post',
          title: 'Scheduled post',
          status: 'scheduled',
          mediaAssets: [
            {
              id: 'asset-1',
              kind: 'image',
              fileName: 'poster.jpg',
              mimeType: 'image/jpeg',
              size: 1024,
              order: 0,
              storageUrl: 'https://cdn.example.com/poster.jpg',
              uploadStatus: 'uploaded',
            },
          ],
          platforms: ['x'],
          sharedCaption: 'Launch caption',
          platformFields: {},
          createdAt: '2026-03-27T09:00:00.000Z',
          updatedAt: '2026-03-27T09:00:00.000Z',
          scheduledAt: new Date(Date.now() - 1000).toISOString(),
        },
      ],
      activeItemId: null,
      lastModifiedAt: '2026-03-27T09:00:00.000Z',
    });

    publishComposeItemMock.mockResolvedValue({
      platformKeys: ['x'],
      platformNames: ['X'],
      postedPlatforms: ['X'],
      failedResults: [],
    });

    const { unmount } = render(<ComposeScheduler />);

    await Promise.resolve();

    const publishPromise = publishComposeItemMock.mock.results[0]?.value as Promise<unknown> | undefined;
    if (publishPromise) {
      await publishPromise;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(publishComposeItemMock).toHaveBeenCalledTimes(1);
    expect(saveItemSpy).toHaveBeenCalled();
    const publishedCall = saveItemSpy.mock.calls.find((call) => call[0]?.status === 'published');
    expect(publishedCall?.[0]?.scheduledAt).toBeUndefined();

    unmount();
  });

  it('aborts an in-flight scheduled publish when the item is deleted', async () => {
    publishComposeItemMock.mockImplementation((_item, options?: { signal?: AbortSignal }) => (
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('Publish request cancelled')), { once: true });
      })
    ));

    const { unmount } = render(<ComposeScheduler />);

    useComposeStore.setState({
      items: [
        {
          id: 'scheduled-post',
          title: 'Scheduled post',
          status: 'scheduled',
          mediaAssets: [
            {
              id: 'asset-1',
              kind: 'image',
              fileName: 'poster.jpg',
              mimeType: 'image/jpeg',
              size: 1024,
              order: 0,
              storageUrl: 'https://cdn.example.com/poster.jpg',
              uploadStatus: 'uploaded',
            },
          ],
          platforms: ['x'],
          sharedCaption: 'Launch caption',
          platformFields: {},
          createdAt: '2026-03-27T09:00:00.000Z',
          updatedAt: '2026-03-27T09:00:00.000Z',
          scheduledAt: new Date(Date.now() - 1000).toISOString(),
        },
      ],
      activeItemId: null,
      lastModifiedAt: '2026-03-27T09:00:00.000Z',
    });

    await waitFor(() => {
      expect(publishComposeItemMock).toHaveBeenCalledTimes(1);
    });

    useComposeStore.getState().deleteItem('scheduled-post');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useComposeStore.getState().items).toHaveLength(0);

    unmount();
  });
});
