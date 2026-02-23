import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';

// ============================================
// TYPES (matching backend and frontend needs)
// ============================================

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
}

export interface PlatformsEnabled {
  x: boolean;
  threads: boolean;
  facebook: boolean;
  pinterest: boolean;
}

export interface RSSFeed {
  id: string;
  name: string;
  url: string;
  favicon?: string;
  enabled: boolean;
  interval: number;
  imageCount: '1' | '2' | '3' | 'random';
  dedupeDays: number;
  filters: FeedFilters;
  serperPriority: boolean;
  rehostImages: boolean;
  autoPost: boolean;
  platformsEnabled: PlatformsEnabled;
  status: 'active' | 'paused' | 'error';
  lastProcessedAt?: string;
  nextRunAt?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface RSSFeedsContextType {
  feeds: RSSFeed[];
  isLoading: boolean;
  error: string | null;
  addFeed: (feed: Partial<RSSFeed> & { url: string }) => Promise<RSSFeed | null>;
  updateFeed: (feedId: string, updates: Partial<RSSFeed>) => Promise<void>;
  deleteFeed: (feedId: string) => Promise<void>;
  refreshFeed: (feedId: string) => Promise<void>;
  refreshAllFeeds: () => Promise<void>;
  toggleFeedEnabled: (feedId: string, enabled: boolean) => Promise<void>;
  togglePlatform: (feedId: string, platform: keyof PlatformsEnabled, enabled: boolean) => Promise<void>;
  getFeedsByStatus: (status: RSSFeed['status']) => RSSFeed[];
  refetch: () => Promise<void>;
}

const RSSFeedsContext = createContext<RSSFeedsContextType | undefined>(undefined);

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? 'https://screndly-production.up.railway.app' : 'http://localhost:3001');

export function RSSFeedsProvider({ children }: { children: ReactNode }) {
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch feeds from backend
  const fetchFeeds = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${BACKEND_URL}/api/rss/feeds`);

      if (!response.ok) {
        throw new Error('Failed to fetch RSS feeds');
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setFeeds(data.data);
      } else {
        setFeeds([]);
      }
    } catch (err) {
      console.error('Error fetching RSS feeds:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch feeds');
      setFeeds([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load feeds on mount
  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  // Add a new feed
  const addFeed = async (feedData: Partial<RSSFeed> & { url: string }): Promise<RSSFeed | null> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/rss/feeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedData),
      });

      if (!response.ok) throw new Error('Failed to add feed');

      const data = await response.json();
      if (data.success && data.data) {
        setFeeds(prev => [data.data, ...prev]);
        toast.success('Feed added successfully');
        return data.data;
      }
      return null;
    } catch (err) {
      console.error('Error adding feed:', err);
      toast.error('Failed to add feed');
      return null;
    }
  };

  // Update a feed
  const updateFeed = async (feedId: string, updates: Partial<RSSFeed>) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/rss/feeds/${feedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update feed');

      const data = await response.json();
      if (data.success && data.data) {
        setFeeds(prev => prev.map(f => f.id === feedId ? { ...f, ...data.data } : f));
      }
    } catch (err) {
      console.error('Error updating feed:', err);
      toast.error('Failed to update feed');
    }
  };

  // Delete a feed
  const deleteFeed = async (feedId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/rss/feeds/${feedId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete feed');

      setFeeds(prev => prev.filter(f => f.id !== feedId));
      toast.success('Feed deleted');
    } catch (err) {
      console.error('Error deleting feed:', err);
      toast.error('Failed to delete feed');
    }
  };

  // Toggle feed enabled/disabled
  const toggleFeedEnabled = async (feedId: string, enabled: boolean) => {
    await updateFeed(feedId, {
      enabled,
      status: enabled ? 'active' : 'paused'
    });
    toast.info(enabled ? 'Feed activated' : 'Feed paused');
  };

  // Toggle platform
  const togglePlatform = async (feedId: string, platform: keyof PlatformsEnabled, enabled: boolean) => {
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) return;

    const newPlatformsEnabled = {
      ...feed.platformsEnabled,
      [platform]: enabled
    };

    await updateFeed(feedId, { platformsEnabled: newPlatformsEnabled });
  };

  // Refresh a single feed
  const refreshFeed = async (feedId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/rss/feeds/${feedId}/refresh`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to refresh feed');

      const data = await response.json();
      if (data.success) {
        toast.success(`Refreshed: ${data.data.feedName}`);
        await fetchFeeds();
      }
    } catch (err) {
      console.error('Error refreshing feed:', err);
      toast.error('Failed to refresh feed');
    }
  };

  // Refresh all feeds
  const refreshAllFeeds = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/rss/refresh`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to refresh feeds');

      const data = await response.json();
      if (data.success) {
        toast.success(`Refreshed ${data.data.success} of ${data.data.total} feeds`);
        await fetchFeeds();
      }
    } catch (err) {
      console.error('Error refreshing feeds:', err);
      toast.error('Failed to refresh feeds');
    }
  };

  // Filter helpers
  const getFeedsByStatus = (status: RSSFeed['status']) => {
    return feeds.filter(feed => feed.status === status);
  };

  return (
    <RSSFeedsContext.Provider
      value={{
        feeds,
        isLoading,
        error,
        addFeed,
        updateFeed,
        deleteFeed,
        refreshFeed,
        refreshAllFeeds,
        toggleFeedEnabled,
        togglePlatform,
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
  if (context === undefined) {
    throw new Error('useRSSFeeds must be used within a RSSFeedsProvider');
  }
  return context;
}