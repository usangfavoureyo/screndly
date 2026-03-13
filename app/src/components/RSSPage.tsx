import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { FeedCard, Feed } from './rss/FeedCard';
import { FeedEditor } from './rss/FeedEditor';
import { FeedPreview } from './rss/FeedPreview';
import { haptics } from '../utils/haptics';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { useRSSFeeds, RSSActivityItem, PlatformsEnabled } from '../contexts/RSSFeedsContext';
import { useUndo } from './UndoContext';
import { PageLoader } from './PageLoader';

interface RSSPageProps {
  onNavigate?: (page: string) => void;
}

export function RSSPage({ onNavigate }: RSSPageProps) {
  const { settings, updateSetting } = useSettings();
  const {
    feeds,
    isLoading,
    addFeed,
    updateFeed,
    deleteFeed: deleteFeedFromContext,
    removeFeedLocal,
    restoreFeed,
    toggleFeedEnabled,
    togglePlatform,
    refreshFeed,
    refreshAllFeeds,
    previewFeedPipeline,
    getActivity,
    refetch,
  } = useRSSFeeds();

  const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFeedId, setPreviewFeedId] = useState<string | null>(null);
  const [activityItems, setActivityItems] = useState<RSSActivityItem[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(true);
  const { showUndo } = useUndo();

  const transformedFeeds: Feed[] = feeds.map((feed) => ({
    id: feed.id,
    name: feed.name,
    url: feed.url,
    enabled: feed.enabled,
    interval: feed.interval,
    imageCount: feed.imageCount as '1' | '2' | '3' | 'random',
    platformImageCounts: feed.platformImageCounts,
    dedupeDays: feed.dedupeDays,
    filters: feed.filters,
    serperEnabled: feed.serperEnabled,
    tmdbEnabled: feed.tmdbEnabled,
    serperPriority: feed.serperPriority,
    rehostImages: feed.rehostImages,
    autoPost: feed.autoPost,
    platformsEnabled: feed.platformsEnabled,
    trickle: feed.trickle,
    status: feed.status,
    lastProcessedAt: feed.lastProcessedAt || undefined,
    nextRunAt: feed.nextRunAt || undefined,
    favicon: feed.favicon || undefined,
  }));

  const loadActivity = async () => {
    setIsActivityLoading(true);
    const response = await getActivity(200);
    if (response) {
      setActivityItems(response.items);
    }
    setIsActivityLoading(false);
  };

  useEffect(() => {
    loadActivity();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refetch({ silent: true });
      void loadActivity();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [refetch]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      totalFeeds: feeds.length,
      activeFeeds: feeds.filter((feed) => feed.status === 'active').length,
      publishedToday: activityItems.filter((item) => item.status === 'published' && new Date(item.timestamp) >= today).length,
      failedItems: activityItems.filter((item) => item.status === 'failed').length,
    };
  }, [feeds, activityItems]);

  const handleAddFeed = () => {
    haptics.medium();
    setSelectedFeed(null);
    setIsEditorOpen(true);
  };

  const handleEditFeed = (id: string) => {
    const feed = transformedFeeds.find((entry) => entry.id === id);
    if (!feed) return;
    setSelectedFeed(feed);
    setIsEditorOpen(true);
  };

  const handleDeleteFeed = async (id: string) => {
    haptics.medium();
    const feedIndex = feeds.findIndex((feed) => feed.id === id);
    const feed = feedIndex >= 0 ? feeds[feedIndex] : null;
    if (!feed) return;

    removeFeedLocal(id);

    showUndo({
      id: `rss-feed-${id}`,
      itemName: feed.name,
      onUndo: () => {
        restoreFeed(feed, feedIndex);
      },
      onConfirm: async () => {
        try {
          await deleteFeedFromContext(id);
          await loadActivity();
          toast.success('Feed deleted');
        } catch (error) {
          restoreFeed(feed, feedIndex);
          toast.error(error instanceof Error ? error.message : 'Failed to delete feed');
        }
      }
    });
  };

  const handleSaveFeed = async (feed: Feed) => {
    try {
      if (transformedFeeds.some((entry) => entry.id === feed.id)) {
        await updateFeed(feed.id, feed);
        toast.success('Feed updated successfully');
      } else {
        await addFeed(feed);
      }
      setIsEditorOpen(false);
      await loadActivity();
    } catch {
      toast.error('Failed to save feed');
    }
  };

  const handlePreview = async (id: string) => {
    const feed = transformedFeeds.find((entry) => entry.id === id);
    if (!feed) return;

    const loadingToast = toast.loading('Generating feed preview...');

    try {
      const preview = await previewFeedPipeline(feed.id);
      if (!preview) {
        throw new Error('No items found in feed preview');
      }

      toast.dismiss(loadingToast);
      setPreviewFeedId(feed.id);
      setPreviewData(preview);
      setIsPreviewOpen(true);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : 'Failed to generate preview');
      console.error('RSS preview error:', error);
    }
  };

  const handleTogglePlatform = async (feedId: string, platform: string, enabled: boolean) => {
    await togglePlatform(feedId, platform as keyof PlatformsEnabled, enabled);
  };

  const handleToggleEnabled = async (feedId: string, enabled: boolean) => {
    await toggleFeedEnabled(feedId, enabled);
  };

  const handleRunPipeline = async () => {
    if (!previewFeedId) return;
    setIsPreviewOpen(false);
    await refreshFeed(previewFeedId);
    await loadActivity();
  };

  const handleRunNow = async (feedId: string) => {
    haptics.light();
    await refreshFeed(feedId, { manualRun: true });
    await loadActivity();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Total Feeds</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.totalFeeds}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Active</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.activeFeeds}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Published Today</p>
          <p className="text-gray-900 dark:text-white text-2xl">{isActivityLoading ? '...' : stats.publishedToday}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Errors</p>
          <p className="text-gray-900 dark:text-white text-2xl">{isActivityLoading ? '...' : stats.failedItems}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
            <Button
              onClick={() => {
                haptics.medium();
                handleAddFeed();
              }}
              className="w-full bg-[#ec1e24] hover:bg-[#d01a20] text-white mb-4 shadow-none hover:shadow-none active:shadow-none focus:shadow-none hover:scale-100 active:scale-100"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Feed
            </Button>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-900 dark:text-white">Global RSS Posting</span>
                <Switch
                  checked={settings.globalRSSPosting ?? true}
                  onCheckedChange={(checked) => {
                    haptics.light();
                    updateSetting('globalRSSPosting', checked);
                    toast.info(checked ? 'Global RSS posting enabled' : 'Global RSS posting disabled');
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-900 dark:text-white">Event-Driven Posting</span>
                <Switch
                  checked={settings.rssEventDrivenPosting ?? true}
                  onCheckedChange={(checked) => {
                    haptics.light();
                    updateSetting('rssEventDrivenPosting', checked);
                    toast.info(checked ? 'Event-driven posting enabled' : 'Event-driven posting disabled');
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-900 dark:text-white">Minimum Gap</span>
                <Select
                  value={settings.rssPostingInterval || '10'}
                  onValueChange={(value) => {
                    haptics.light();
                    updateSetting('rssPostingInterval', value);
                  }}
                >
                  <SelectTrigger className="w-32 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Off</SelectItem>
                    <SelectItem value="1">1 min</SelectItem>
                    <SelectItem value="2">2 min</SelectItem>
                    <SelectItem value="3">3 min</SelectItem>
                    <SelectItem value="4">4 min</SelectItem>
                    <SelectItem value="5">5 min</SelectItem>
                    <SelectItem value="10">10 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-900 dark:text-white">Deduplication</span>
                <Switch
                  checked={settings.rssDeduplication ?? true}
                  onCheckedChange={(checked) => {
                    haptics.light();
                    updateSetting('rssDeduplication', checked);
                    toast.info(checked ? 'Deduplication enabled' : 'Deduplication disabled');
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 gap-3">
              <h3 className="text-gray-900 dark:text-white">Feeds ({feeds.length})</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    haptics.light();
                    await refreshAllFeeds();
                    await loadActivity();
                  }}
                  className="h-9 w-9 p-0 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    haptics.light();
                    if (onNavigate) {
                      onNavigate('rss-activity');
                    }
                  }}
                  className="!bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
                >
                  View Activity
                </Button>
              </div>
            </div>
            {isLoading && feeds.length === 0 ? (
              <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-12">
                <PageLoader size="md" className="h-auto py-2" label="Loading RSS feeds..." />
              </div>
            ) : feeds.length === 0 ? (
              <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-12 text-center">
                <p className="text-[#6B7280] dark:text-[#9CA3AF]">No feeds configured yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {feeds.map((feed) => (
                  <FeedCard
                    key={feed.id}
                    feed={feed as Feed}
                    onEdit={handleEditFeed}
                    onDelete={handleDeleteFeed}
                    onPreview={handlePreview}
                    onTogglePlatform={handleTogglePlatform}
                    onToggleEnabled={handleToggleEnabled}
                    onRunNow={handleRunNow}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <FeedEditor
        feed={selectedFeed}
        onSave={handleSaveFeed}
        onDelete={handleDeleteFeed}
        onClose={() => setIsEditorOpen(false)}
        isOpen={isEditorOpen}
      />

      <FeedPreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        preview={previewData}
        onRunPipeline={handleRunPipeline}
      />
    </div>
  );
}
