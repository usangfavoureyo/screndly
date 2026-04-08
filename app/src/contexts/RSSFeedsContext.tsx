import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';
import {
  getRSSActivitySnapshot,
  getRSSFeedsSnapshot,
  saveRSSActivitySnapshot,
  saveRSSFeedsSnapshot,
} from '../utils/rssOfflineStore';

export interface FilterItem {
  text: string;
  matchType: 'contains' | 'exact';
  caseSensitive: boolean;
  active: boolean;
}

export interface FeedFilters {
  scope: 'title' | 'body' | 'title_or_body' | 'title_and_body';
  required: FilterItem[];
  blocked: FilterItem[];
  onlyFetchNewItems?: boolean;
  startFromNowAt?: string | null;
  maxItemAgeMinutes?: number | null;
}

export interface PlatformsEnabled {
  x: boolean;
  threads: boolean;
  facebook: boolean;
  pinterest: boolean;
}

export interface PlatformImageCounts {
  x?: number;
  threads?: number;
  facebook?: number;
  pinterest?: number;
}

export interface RSSFeed {
  id: string;
  name: string;
  url: string;
  favicon?: string;
  enabled: boolean;
  displayOrder?: number;
  interval: number;
  imageCount: '1' | '2' | '3' | 'random';
  platformImageCounts?: PlatformImageCounts;
  dedupeDays: number;
  filters: FeedFilters;
  serperEnabled: boolean;
  tmdbEnabled: boolean;
  serperPriority: boolean;
  openaiWebSearchEnabled?: boolean;
  imageSourcePriority?: 'tmdb_first' | 'openai_first' | 'serper_first';
  rehostImages: boolean;
  autoPost: boolean;
  platformsEnabled: PlatformsEnabled;
  trickle?: 'newest_first' | 'oldest_first';
  status: 'active' | 'paused' | 'error';
  lastProcessedAt?: string;
  nextRunAt?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RSSPreviewSampleItem {
  title: string;
  link: string;
  description?: string;
  pubDate: string;
  imageUrl?: string;
}

export interface RSSFeedPreview {
  title: string;
  description?: string;
  link?: string;
  favicon?: string;
  itemCount: number;
  sampleItems: RSSPreviewSampleItem[];
}

export interface RSSPipelinePreview {
  title: string;
  link: string;
  pubDate: string;
  snippet: string;
  images: Array<{
    url: string;
    reason: string;
  }>;
  caption: string;
  captionCharCount: number;
}

export interface RSSActivityItem {
  id: string;
  feedId?: string;
  feedName: string;
  title: string;
  link?: string;
  description?: string;
  contentHtml?: string;
  imageUrl?: string;
  imageUrls?: string[];
  imageSource?: 'tmdb' | 'serper' | 'openai_web_search' | 'feed';
  imageReason?: string;
  imageScore?: number;
  imageSelectionConfidence?: 'high' | 'medium' | 'low';
  selectedImages?: Array<{
    url: string;
    reason: string;
    source: 'tmdb' | 'serper' | 'openai_web_search' | 'feed';
    score?: number;
  }>;
  status: 'pending' | 'published' | 'failed' | 'filtered';
  timestamp: string;
  publishedAt?: string;
  platforms: string[];
  platformPostIds?: Record<string, string>;
  platformResults?: Array<{
    platform: string;
    status: 'posted' | 'failed' | 'skipped';
    error?: string;
    id?: string;
    url?: string;
    postedAt: string;
  }>;
  error?: string;
}

export interface RSSActivitySummary {
  total: number;
  published: number;
  pending: number;
  failed: number;
  filtered?: number;
}

export interface RSSActivityResponse {
  items: RSSActivityItem[];
  summary: RSSActivitySummary;
}

export interface RSSRefreshResult {
  feedId: string;
  feedName: string;
  itemsAdded: number;
  checkedCount: number;
  pendingCount: number;
  failedCount: number;
  latestItemTitle?: string;
  error?: string;
  selectionMode?: 'backlog' | 'latest_item';
}

interface RSSFeedsContextType {
  feeds: RSSFeed[];
  isLoading: boolean;
  error: string | null;
  addFeed: (feed: Partial<RSSFeed> & { url: string }) => Promise<RSSFeed | null>;
  updateFeed: (feedId: string, updates: Partial<RSSFeed>) => Promise<void>;
  deleteFeed: (feedId: string) => Promise<void>;
  removeFeedLocal: (feedId: string) => void;
  restoreFeed: (feed: RSSFeed, index?: number) => void;
  refreshFeed: (
      feedId: string,
      options?: { showToast?: boolean; manualRun?: boolean }
  ) => Promise<RSSRefreshResult | null>;
  refreshAllFeeds: () => Promise<void>;
  previewFeed: (url: string) => Promise<RSSFeedPreview | null>;
  previewFeedPipeline: (feedId: string) => Promise<RSSPipelinePreview | null>;
  getActivity: (limit?: number) => Promise<RSSActivityResponse | null>;
  retryActivity: (activityId: string) => Promise<RSSActivityItem | null>;
  deleteActivity: (activityId: string) => Promise<void>;
  toggleFeedEnabled: (feedId: string, enabled: boolean) => Promise<void>;
  togglePlatform: (feedId: string, platform: keyof PlatformsEnabled, enabled: boolean) => Promise<void>;
  reorderFeeds: (orderedIds: string[]) => Promise<void>;
  getFeedsByStatus: (status: RSSFeed['status']) => RSSFeed[];
  refetch: (options?: { silent?: boolean }) => Promise<void>;
}

const RSSFeedsContext = createContext<RSSFeedsContextType | undefined>(undefined);

function buildRefreshToastMessage(result: RSSRefreshResult): string {
  const segments: string[] = [];
  if (result.itemsAdded > 0) segments.push(`${result.itemsAdded} published`);
  if (result.pendingCount > 0) segments.push(`${result.pendingCount} pending`);
  if (result.failedCount > 0) segments.push(`${result.failedCount} failed`);

  if (result.selectionMode === 'latest_item') {
    if (result.checkedCount === 0) return `${result.feedName}: no items available to test`;
    if (segments.length === 0) return `${result.feedName}: latest item checked`;
    return `${result.feedName}: latest item ${segments.join(', ')}`;
  }

  if (segments.length === 0) return `${result.feedName}: no new items`;
  return `${result.feedName}: ${segments.join(', ')}`;
}

function normalizeFeed(feed: RSSFeed): RSSFeed {
  return {
    ...feed,
    displayOrder: typeof feed.displayOrder === 'number' ? feed.displayOrder : 0,
    serperEnabled: feed.serperEnabled ?? true,
    tmdbEnabled: feed.tmdbEnabled ?? false,
    serperPriority: feed.serperPriority ?? true,
    openaiWebSearchEnabled: feed.openaiWebSearchEnabled ?? false,
    imageSourcePriority: feed.imageSourcePriority ?? (feed.serperPriority ? 'serper_first' : 'tmdb_first'),
    rehostImages: feed.rehostImages ?? false,
  };
}

function reorderFeedCollection(collection: RSSFeed[], orderedIds: string[]): RSSFeed[] {
  if (orderedIds.length === 0) {
    return collection;
  }

  const currentById = new Map(collection.map((feed) => [feed.id, feed] as const));
  const orderedFeeds: RSSFeed[] = [];

  for (const id of orderedIds) {
    const feed = currentById.get(id);
    if (!feed) {
      return collection;
    }
    orderedFeeds.push(feed);
    currentById.delete(id);
  }

  if (currentById.size > 0) {
    orderedFeeds.push(...currentById.values());
  }

  return orderedFeeds.map((feed, index) => ({
    ...feed,
    displayOrder: index,
  }));
}

function sortFeedsByDisplayOrder(collection: RSSFeed[]): RSSFeed[] {
  return [...collection].sort((left, right) => {
    const displayOrderDelta = (left.displayOrder ?? 0) - (right.displayOrder ?? 0);
    if (displayOrderDelta !== 0) {
      return displayOrderDelta;
    }

    const leftCreatedAt = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightCreatedAt = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightCreatedAt - leftCreatedAt;
  });
}

export function RSSFeedsProvider({ children }: { children: ReactNode }) {
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeeds = useCallback(async (options: { silent?: boolean } = {}) => {
    const silent = options.silent === true;

    try {
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);

      const response = await apiClient.get<RSSFeed[]>('/api/rss/feeds');
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch RSS feeds');
      }

      const normalizedFeeds = Array.isArray(response.data) ? response.data.map((feed) => normalizeFeed(feed)) : [];
      setFeeds(sortFeedsByDisplayOrder(normalizedFeeds));
      void saveRSSFeedsSnapshot(normalizedFeeds);
    } catch (err) {
      console.error('Error fetching RSS feeds:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch feeds');
      const savedFeeds = await getRSSFeedsSnapshot<RSSFeed[]>();
      if (savedFeeds) {
        setFeeds(sortFeedsByDisplayOrder(savedFeeds.map((feed) => normalizeFeed(feed))));
      } else if (!silent) {
        setFeeds([]);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    void getRSSFeedsSnapshot<RSSFeed[]>().then((savedFeeds) => {
      if (!isActive || !savedFeeds || savedFeeds.length === 0) {
        return;
      }

      setFeeds(sortFeedsByDisplayOrder(savedFeeds.map((feed) => normalizeFeed(feed))));
      setIsLoading(false);
    });

    fetchFeeds();

    return () => {
      isActive = false;
    };
  }, [fetchFeeds]);

  useEffect(() => {
    void saveRSSFeedsSnapshot(feeds);
  }, [feeds]);

  const addFeed = async (feedData: Partial<RSSFeed> & { url: string }): Promise<RSSFeed | null> => {
    try {
      const response = await apiClient.post<RSSFeed>('/api/rss/feeds', feedData);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to add feed');
      }

      const normalizedFeed = normalizeFeed(response.data);
      setFeeds((prev) => sortFeedsByDisplayOrder([...prev, normalizedFeed]));
      toast.success('Feed added successfully');
      return normalizedFeed;
    } catch (err) {
      console.error('Error adding RSS feed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to add feed');
      return null;
    }
  };

  const previewFeedPipeline = async (feedId: string): Promise<RSSPipelinePreview | null> => {
    try {
      const response = await apiClient.get<RSSPipelinePreview>(`/api/rss/feeds/${feedId}/preview`);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to preview feed pipeline');
      }

      return response.data;
    } catch (err) {
      console.error('Error previewing RSS feed pipeline:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to preview feed pipeline');
      return null;
    }
  };

  const updateFeed = async (feedId: string, updates: Partial<RSSFeed>) => {
    try {
      const response = await apiClient.put<RSSFeed>(`/api/rss/feeds/${feedId}`, updates);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to update feed');
      }

      const normalizedFeed = normalizeFeed(response.data);
      setFeeds((prev) =>
        sortFeedsByDisplayOrder(prev.map((feed) => (feed.id === feedId ? { ...feed, ...normalizedFeed } : feed)))
      );
    } catch (err) {
      console.error('Error updating RSS feed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update feed');
    }
  };

  const deleteFeed = async (feedId: string) => {
    try {
      const response = await apiClient.delete(`/api/rss/feeds/${feedId}`);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete feed');
      }

      setFeeds((prev) => prev.filter((feed) => feed.id !== feedId));
    } catch (err) {
      console.error('Error deleting RSS feed:', err);
      const error = err instanceof Error ? err : new Error('Failed to delete feed');
      throw error;
    }
  };

  const removeFeedLocal = (feedId: string) => {
    setFeeds((prev) => prev.filter((feed) => feed.id !== feedId));
  };

  const restoreFeed = (feed: RSSFeed, index = 0) => {
    setFeeds((prev) => {
      if (prev.some((item) => item.id === feed.id)) {
        return prev;
      }

      const next = [...prev];
      const targetIndex = Math.max(0, Math.min(index, next.length));
      next.splice(targetIndex, 0, feed);
      return next;
    });
  };

  const toggleFeedEnabled = async (feedId: string, enabled: boolean) => {
    await updateFeed(feedId, {
      enabled,
      status: enabled ? 'active' : 'paused',
    });
    toast.info(enabled ? 'Feed activated' : 'Feed paused');
  };

  const togglePlatform = async (feedId: string, platform: keyof PlatformsEnabled, enabled: boolean) => {
    const feed = feeds.find((entry) => entry.id === feedId);
    if (!feed) return;

    const platformsEnabled = {
      ...feed.platformsEnabled,
      [platform]: enabled,
    };

    await updateFeed(feedId, { platformsEnabled });
  };

  const reorderFeeds = async (orderedIds: string[]) => {
    if (orderedIds.length === 0) {
      return;
    }

    const previousFeeds = feeds;
    const optimisticFeeds = reorderFeedCollection(previousFeeds, orderedIds);
    setFeeds(optimisticFeeds);

    try {
      const response = await apiClient.post<RSSFeed[]>('/api/rss/feeds/reorder', { orderedIds });
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to reorder feeds');
      }

      setFeeds(sortFeedsByDisplayOrder(response.data.map((feed) => normalizeFeed(feed))));
      toast.success('Feed order saved');
    } catch (err) {
      console.error('Error reordering RSS feeds:', err);
      setFeeds(previousFeeds);
      toast.error(err instanceof Error ? err.message : 'Failed to reorder feeds');
      throw err instanceof Error ? err : new Error('Failed to reorder feeds');
    }
  };

  const refreshFeed = async (
    feedId: string,
    options: { showToast?: boolean; manualRun?: boolean } = { showToast: true, manualRun: false }
  ): Promise<RSSRefreshResult | null> => {
    try {
      const response = await apiClient.post<RSSRefreshResult>(`/api/rss/feeds/${feedId}/refresh`, {
        manualRun: Boolean(options.manualRun),
      });
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to refresh feed');
      }

      await fetchFeeds({ silent: true });
      if (options.showToast !== false) {
        toast.success(buildRefreshToastMessage(response.data));
      }
      return response.data;
    } catch (err) {
      console.error('Error refreshing RSS feed:', err);
      if (options.showToast !== false) {
        toast.error(err instanceof Error ? err.message : 'Failed to refresh feed');
      }
      return null;
    }
  };

  const refreshAllFeeds = async () => {
    try {
      const response = await apiClient.post<{ total: number; success: number; failed: number }>('/api/rss/refresh');
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to refresh feeds');
      }

      await fetchFeeds({ silent: true });
      toast.success(`Refreshed ${response.data.success} of ${response.data.total} feeds`);
    } catch (err) {
      console.error('Error refreshing RSS feeds:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to refresh feeds');
    }
  };

  const previewFeed = async (url: string): Promise<RSSFeedPreview | null> => {
    try {
      const response = await apiClient.post<RSSFeedPreview>('/api/rss/preview', { url });
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to preview feed');
      }

      return response.data;
    } catch (err) {
      console.error('Error previewing RSS feed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to preview feed');
      return null;
    }
  };

  const getActivity = async (limit: number = 100): Promise<RSSActivityResponse | null> => {
    try {
      const response = await apiClient.get<RSSActivityResponse>(`/api/rss/activity?limit=${limit}`);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch activity');
      }

      void saveRSSActivitySnapshot(response.data);
      return response.data;
    } catch (err) {
      console.error('Error fetching RSS activity:', err);
      const savedActivity = await getRSSActivitySnapshot<RSSActivityResponse>();
      if (savedActivity) {
        toast.info('Showing cached RSS activity while offline.');
        return savedActivity;
      }

      toast.error(err instanceof Error ? err.message : 'Failed to fetch RSS activity');
      return null;
    }
  };

  const retryActivity = async (activityId: string): Promise<RSSActivityItem | null> => {
    try {
      const response = await apiClient.post<RSSActivityItem>(`/api/rss/activity/${activityId}/retry`);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to retry RSS activity item');
      }
      return response.data;
    } catch (err) {
      console.error('Error retrying RSS activity item:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to retry RSS activity item');
      return null;
    }
  };

  const deleteActivity = async (activityId: string) => {
    try {
      const response = await apiClient.delete(`/api/rss/activity/${activityId}`);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete activity');
      }

      toast.success('Activity entry deleted');
    } catch (err) {
      console.error('Error deleting RSS activity:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete activity');
    }
  };

  const getFeedsByStatus = (status: RSSFeed['status']) => feeds.filter((feed) => feed.status === status);

  return (
    <RSSFeedsContext.Provider
      value={{
        feeds,
        isLoading,
        error,
        addFeed,
        updateFeed,
        deleteFeed,
        removeFeedLocal,
        restoreFeed,
        refreshFeed,
        refreshAllFeeds,
    previewFeed,
    previewFeedPipeline,
    getActivity,
        retryActivity,
        deleteActivity,
        toggleFeedEnabled,
        togglePlatform,
        reorderFeeds,
        getFeedsByStatus,
        refetch: fetchFeeds,
      }}
    >
      {children}
    </RSSFeedsContext.Provider>
  );
}

export function useRSSFeeds() {
  const context = useContext(RSSFeedsContext);
  if (!context) {
    throw new Error('useRSSFeeds must be used within RSSFeedsProvider');
  }
  return context;
}
