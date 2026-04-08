import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RSSFeedsProvider,
  type RSSFeed,
  useRSSFeeds,
} from '../../contexts/RSSFeedsContext';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  apiClient: apiClientMock,
}));

vi.mock('sonner', () => ({
  toast: toastMock,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RSSFeedsProvider>{children}</RSSFeedsProvider>
);

function createFeed(overrides: Partial<RSSFeed> = {}): RSSFeed {
  return {
    id: overrides.id ?? 'feed-1',
    name: overrides.name ?? 'Test Feed',
    url: overrides.url ?? 'https://example.com/feed.xml',
    enabled: overrides.enabled ?? true,
    interval: overrides.interval ?? 15,
    imageCount: overrides.imageCount ?? 'random',
    dedupeDays: overrides.dedupeDays ?? 7,
    filters: overrides.filters ?? {
      scope: 'title_or_body',
      required: [],
      blocked: [],
      onlyFetchNewItems: true,
      startFromNowAt: null,
      maxItemAgeMinutes: null,
    },
    serperEnabled: overrides.serperEnabled ?? true,
    tmdbEnabled: overrides.tmdbEnabled ?? false,
    serperPriority: overrides.serperPriority ?? false,
    openaiWebSearchEnabled: overrides.openaiWebSearchEnabled ?? false,
    imageSourcePriority: overrides.imageSourcePriority ?? (overrides.serperPriority ? 'serper_first' : 'tmdb_first'),
    rehostImages: overrides.rehostImages ?? false,
    autoPost: overrides.autoPost ?? false,
    platformsEnabled: overrides.platformsEnabled ?? {
      x: true,
      threads: false,
      facebook: false,
      pinterest: false,
    },
    status: overrides.status ?? 'active',
    favicon: overrides.favicon,
    platformImageCounts: overrides.platformImageCounts,
    trickle: overrides.trickle,
    lastProcessedAt: overrides.lastProcessedAt,
    nextRunAt: overrides.nextRunAt,
    errorMessage: overrides.errorMessage,
    createdAt: overrides.createdAt ?? '2026-03-12T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-12T00:00:00.000Z',
  };
}

describe('RSSFeedsContext', () => {
  let backendFeeds: RSSFeed[];

  beforeEach(() => {
    backendFeeds = [];
    vi.clearAllMocks();

    apiClientMock.get.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/api/rss/feeds') {
        return { success: true, data: [...backendFeeds] };
      }

      return { success: true, data: null };
    });

    apiClientMock.post.mockImplementation(async (endpoint: string, payload?: Partial<RSSFeed>) => {
      if (endpoint === '/api/rss/feeds') {
        const createdFeed = createFeed({
          id: `feed-${backendFeeds.length + 1}`,
          ...payload,
        });
        backendFeeds = [createdFeed, ...backendFeeds];
        return { success: true, data: createdFeed };
      }

      if (endpoint.endsWith('/refresh')) {
        return {
          success: true,
          data: {
            feedId: backendFeeds[0]?.id ?? 'feed-1',
            feedName: backendFeeds[0]?.name ?? 'Test Feed',
            itemsAdded: 2,
            checkedCount: 3,
            pendingCount: 1,
            failedCount: 0,
          },
        };
      }

      return { success: true, data: null };
    });

    apiClientMock.put.mockImplementation(async (endpoint: string, updates: Partial<RSSFeed>) => {
      const feedId = endpoint.split('/').pop()!;
      const existingFeed = backendFeeds.find((feed) => feed.id === feedId);
      const updatedFeed = { ...existingFeed, ...updates } as RSSFeed;
      backendFeeds = backendFeeds.map((feed) => (feed.id === feedId ? updatedFeed : feed));
      return { success: true, data: updatedFeed };
    });

    apiClientMock.delete.mockImplementation(async (endpoint: string) => {
      const feedId = endpoint.split('/').pop()!;
      backendFeeds = backendFeeds.filter((feed) => feed.id !== feedId);
      return { success: true, data: null };
    });
  });

  it('loads feeds from the backend on mount', async () => {
    backendFeeds = [createFeed({ id: 'feed-loaded', name: 'Loaded Feed' })];

    const { result } = renderHook(() => useRSSFeeds(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.feeds).toHaveLength(1);
    expect(result.current.feeds[0].name).toBe('Loaded Feed');
  });

  it('adds a feed via the backend and prepends it locally', async () => {
    const { result } = renderHook(() => useRSSFeeds(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addFeed({
        name: 'Breaking Feed',
        url: 'https://example.com/breaking.xml',
        enabled: true,
        interval: 30,
      });
    });

    expect(result.current.feeds).toHaveLength(1);
    expect(result.current.feeds[0].name).toBe('Breaking Feed');
    expect(apiClientMock.post).toHaveBeenCalledWith(
      '/api/rss/feeds',
      expect.objectContaining({
        name: 'Breaking Feed',
        url: 'https://example.com/breaking.xml',
      })
    );
  });

  it('updates an existing feed from backend data', async () => {
    backendFeeds = [createFeed({ id: 'feed-update', name: 'Original Name' })];

    const { result } = renderHook(() => useRSSFeeds(), { wrapper });

    await waitFor(() => expect(result.current.feeds).toHaveLength(1));

    await act(async () => {
      await result.current.updateFeed('feed-update', {
        name: 'Updated Name',
        interval: 60,
        filters: {
          scope: 'title',
          required: [
            {
              text: 'exclusive',
              matchType: 'contains',
              caseSensitive: false,
              active: true,
            },
          ],
          blocked: [
            {
              text: 'spoiler',
              matchType: 'exact',
              caseSensitive: true,
              active: true,
            },
          ],
          onlyFetchNewItems: true,
          startFromNowAt: '2026-03-18T00:00:00.000Z',
          maxItemAgeMinutes: 120,
        },
      });
    });

    expect(result.current.feeds[0].name).toBe('Updated Name');
    expect(result.current.feeds[0].interval).toBe(60);
    expect(result.current.feeds[0].filters).toMatchObject({
      scope: 'title',
      required: [
        {
          text: 'exclusive',
          matchType: 'contains',
          caseSensitive: false,
          active: true,
        },
      ],
      blocked: [
        {
          text: 'spoiler',
          matchType: 'exact',
          caseSensitive: true,
          active: true,
        },
      ],
      onlyFetchNewItems: true,
      startFromNowAt: '2026-03-18T00:00:00.000Z',
      maxItemAgeMinutes: 120,
    });
    expect(apiClientMock.put).toHaveBeenCalledWith(
      '/api/rss/feeds/feed-update',
      expect.objectContaining({
        filters: expect.objectContaining({
          scope: 'title',
          required: expect.arrayContaining([
            expect.objectContaining({ text: 'exclusive' }),
          ]),
          blocked: expect.arrayContaining([
            expect.objectContaining({ text: 'spoiler' }),
          ]),
        }),
      })
    );
  });

  it('toggles a feed enabled state and status', async () => {
    backendFeeds = [createFeed({ id: 'feed-toggle', enabled: true, status: 'active' })];

    const { result } = renderHook(() => useRSSFeeds(), { wrapper });

    await waitFor(() => expect(result.current.feeds).toHaveLength(1));

    await act(async () => {
      await result.current.toggleFeedEnabled('feed-toggle', false);
    });

    expect(result.current.feeds[0].enabled).toBe(false);
    expect(result.current.feeds[0].status).toBe('paused');
    expect(toastMock.info).toHaveBeenCalled();
  });

  it('deletes a feed after backend confirmation', async () => {
    backendFeeds = [createFeed({ id: 'feed-delete' })];

    const { result } = renderHook(() => useRSSFeeds(), { wrapper });

    await waitFor(() => expect(result.current.feeds).toHaveLength(1));

    await act(async () => {
      await result.current.deleteFeed('feed-delete');
    });

    expect(result.current.feeds).toHaveLength(0);
    expect(apiClientMock.delete).toHaveBeenCalledWith('/api/rss/feeds/feed-delete');
  });

  it('refreshes a feed and returns backend summary data', async () => {
    backendFeeds = [createFeed({ id: 'feed-refresh', name: 'Refresh Feed' })];

    const { result } = renderHook(() => useRSSFeeds(), { wrapper });

    await waitFor(() => expect(result.current.feeds).toHaveLength(1));

    let refreshResult;
    await act(async () => {
      refreshResult = await result.current.refreshFeed('feed-refresh', { showToast: false, manualRun: true });
    });

    expect(refreshResult).toMatchObject({
      feedId: 'feed-refresh',
      feedName: 'Refresh Feed',
      itemsAdded: 2,
      checkedCount: 3,
    });
  });
});
