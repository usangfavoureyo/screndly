import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { DragEndEvent } from '@dnd-kit/core';
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { FeedCard, Feed } from './rss/FeedCard';
import { FeedEditor } from './rss/FeedEditor';
import { FeedPreview } from './rss/FeedPreview';
import { haptics } from '../utils/haptics';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { useRSSFeeds, RSSActivityItem, RSSActivitySummary, PlatformsEnabled } from '../contexts/RSSFeedsContext';
import { useUndo } from './UndoContext';
import { PageLoader } from './PageLoader';
import { getPublishedTodayCount } from '../utils/rssActivityStats';
import reorderIcon from '../public/icons/icons/hugeroundedicons/arrow-all-direction-stroke-rounded.svg';

const DASHBOARD_RSS_FEED_TARGET_STORAGE_KEY = 'screndly_dashboard_rss_feed_target';

interface RSSPageProps {
  onNavigate?: (page: string, fromPage?: string | null) => void;
}

export function RSSPage({ onNavigate }: RSSPageProps) {
  const { settings, updateSetting } = useSettings();
  const {
    feeds,
    isLoading,
    addFeed,
    updateFeed,
    deleteFeed: deleteFeedFromContext,
    toggleFeedEnabled,
    togglePlatform,
    refreshFeed,
    refreshAllFeeds,
    previewFeedPipeline,
    getActivity,
    reorderFeeds,
    refetch,
  } = useRSSFeeds();

  const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFeedId, setPreviewFeedId] = useState<string | null>(null);
  const [activityItems, setActivityItems] = useState<RSSActivityItem[]>([]);
  const [activitySummary, setActivitySummary] = useState<RSSActivitySummary | null>(null);
  const [isActivityLoading, setIsActivityLoading] = useState(true);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const { showUndo } = useUndo();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    })
  );

  const transformedFeeds: Feed[] = feeds.map((feed) => ({
    id: feed.id,
    name: feed.name,
    url: feed.url,
    enabled: feed.enabled,
    displayOrder: feed.displayOrder,
    interval: feed.interval,
    imageCount: feed.imageCount as '1' | '2' | '3' | 'random',
    platformImageCounts: feed.platformImageCounts,
    dedupeDays: feed.dedupeDays,
    filters: feed.filters,
    serperEnabled: feed.serperEnabled,
    tmdbEnabled: feed.tmdbEnabled,
    serperPriority: feed.serperPriority,
    openaiWebSearchEnabled: feed.openaiWebSearchEnabled ?? false,
    imageSourcePriority: feed.imageSourcePriority,
    rehostImages: feed.rehostImages,
    autoPost: feed.autoPost,
    platformsEnabled: feed.platformsEnabled,
    trickle: feed.trickle,
    status: feed.status,
    lastProcessedAt: feed.lastProcessedAt || undefined,
    nextRunAt: feed.nextRunAt || undefined,
    favicon: feed.favicon || undefined,
  }));

  useEffect(() => {
    const targetFeedId = window.localStorage.getItem(DASHBOARD_RSS_FEED_TARGET_STORAGE_KEY);
    if (!targetFeedId || !feeds.some((feed) => feed.id === targetFeedId)) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const targetElement = document.getElementById(`rss-feed-card-${targetFeedId}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      window.localStorage.removeItem(DASHBOARD_RSS_FEED_TARGET_STORAGE_KEY);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [feeds]);

  const loadActivity = async () => {
    setIsActivityLoading(true);
    const response = await getActivity(200);
    if (response) {
      setActivityItems(response.items);
      setActivitySummary(response.summary);
    }
    setIsActivityLoading(false);
  };

  useEffect(() => {
    loadActivity();
  }, []);

  useEffect(() => {
    if (isReorderMode) {
      return;
    }

    const interval = window.setInterval(() => {
      void refetch({ silent: true });
      void loadActivity();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isReorderMode, refetch]);

  const stats = useMemo(() => {
    return {
      totalFeeds: feeds.length,
      activeFeeds: feeds.filter((feed) => feed.status === 'active').length,
      publishedToday: getPublishedTodayCount(activityItems),
      failedItems: activitySummary?.failed ?? 0,
    };
  }, [activityItems, activitySummary, feeds]);

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

  const buildFeedCreatePayload = (feed: Feed, name: string = feed.name) => ({
    name,
    url: feed.url,
    favicon: feed.favicon,
    enabled: feed.enabled,
    interval: feed.interval,
    imageCount: feed.imageCount,
    platformImageCounts: feed.platformImageCounts ? { ...feed.platformImageCounts } : undefined,
    dedupeDays: feed.dedupeDays,
    filters: {
      ...feed.filters,
      required: feed.filters.required.map((keyword) => ({ ...keyword })),
      blocked: feed.filters.blocked.map((keyword) => ({ ...keyword })),
    },
    serperEnabled: feed.serperEnabled,
    tmdbEnabled: feed.tmdbEnabled,
    serperPriority: feed.serperPriority,
    openaiWebSearchEnabled: feed.openaiWebSearchEnabled ?? false,
    imageSourcePriority: feed.imageSourcePriority,
    rehostImages: feed.rehostImages,
    autoPost: feed.autoPost,
    platformsEnabled: feed.platformsEnabled ? { ...feed.platformsEnabled } : undefined,
    trickle: feed.trickle,
  });

  const handleDeleteFeed = async (id: string) => {
    haptics.medium();
    const feed = transformedFeeds.find((entry) => entry.id === id);
    if (!feed) return;

    try {
      await deleteFeedFromContext(id);
      await loadActivity();

      showUndo({
        id: `rss-feed-${id}`,
        itemName: feed.name,
        onUndo: async () => {
          const restoredFeed = await addFeed(buildFeedCreatePayload(feed));
          if (!restoredFeed) {
            toast.error('Failed to restore feed');
            return;
          }

          await loadActivity();
          toast.success('Feed restored');
        },
      });

      toast.success('Feed deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete feed');
    }
  };

  const handleDuplicateFeed = async (id: string) => {
    haptics.medium();
    const sourceFeed = transformedFeeds.find((entry) => entry.id === id);
    if (!sourceFeed) {
      toast.error('Feed not found');
      return;
    }

    const duplicateCount = transformedFeeds.filter(
      (entry) => entry.name === `${sourceFeed.name} (Copy)` || entry.name.startsWith(`${sourceFeed.name} (Copy `)
    ).length;
    const duplicateName = duplicateCount === 0
      ? `${sourceFeed.name} (Copy)`
      : `${sourceFeed.name} (Copy ${duplicateCount + 1})`;

    try {
      const duplicatedFeed = await addFeed(buildFeedCreatePayload(sourceFeed, duplicateName));

      if (!duplicatedFeed) {
        throw new Error('Failed to duplicate feed');
      }

      await loadActivity();
      toast.success('Feed duplicated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to duplicate feed');
    }
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

  const handleRefreshAllFeeds = async () => {
    if (isRefreshingAll) {
      return;
    }

    haptics.light();
    setIsRefreshingAll(true);
    const loadingToast = toast.loading('Refreshing RSS feeds...');

    try {
      await refreshAllFeeds();
      await loadActivity();
    } finally {
      toast.dismiss(loadingToast);
      setIsRefreshingAll(false);
    }
  };

  const handleToggleReorderMode = () => {
    haptics.light();
    setIsReorderMode((current) => !current);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = transformedFeeds.findIndex((feed) => feed.id === active.id);
    const newIndex = transformedFeeds.findIndex((feed) => feed.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    haptics.light();
    const nextOrder = arrayMove(transformedFeeds, oldIndex, newIndex).map((feed) => feed.id);

    try {
      await reorderFeeds(nextOrder);
    } catch {
      // Toast/rollback handled in context.
    }
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
                {feeds.length > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleReorderMode}
                    aria-label={isReorderMode ? 'Finish reordering RSS feeds' : 'Reorder RSS feeds'}
                    className={`h-9 w-9 p-0 border-gray-300 dark:border-[#333333] ${
                      isReorderMode
                        ? '!bg-[#ec1e24] border-[#ec1e24] hover:!bg-[#d01a20]'
                        : '!bg-white dark:!bg-[#000000]'
                    }`}
                  >
                    <img
                      src={reorderIcon}
                      alt=""
                      className={`h-4 w-4 ${isReorderMode ? 'brightness-0 invert' : 'dark:invert'}`}
                    />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshAllFeeds}
                  disabled={isRefreshingAll}
                  aria-label="Refresh all RSS feeds"
                  className="h-9 w-9 p-0 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshingAll ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    haptics.light();
                    if (onNavigate) {
                      onNavigate('rss-activity', 'rss');
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
              <div className="space-y-3">
                {isReorderMode ? (
                  <div className="rounded-2xl border border-dashed border-[#ec1e24]/30 bg-[#ec1e24]/5 px-4 py-3 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                    Drag any feed card into place and release to save the new order automatically.
                  </div>
                ) : null}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={transformedFeeds.map((feed) => feed.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {transformedFeeds.map((feed) => (
                        <SortableFeedCard
                          key={feed.id}
                          feed={feed}
                          isReorderMode={isReorderMode}
                          onEdit={handleEditFeed}
                          onDelete={handleDeleteFeed}
                          onDuplicate={handleDuplicateFeed}
                          onPreview={handlePreview}
                          onTogglePlatform={handleTogglePlatform}
                          onToggleEnabled={handleToggleEnabled}
                          onRunNow={handleRunNow}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
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

interface SortableFeedCardProps {
  feed: Feed;
  isReorderMode: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onPreview: (id: string) => void;
  onTogglePlatform: (feedId: string, platform: string, enabled: boolean) => void;
  onToggleEnabled: (feedId: string, enabled: boolean) => void;
  onRunNow: (feedId: string) => Promise<void>;
}

function SortableFeedCard({
  feed,
  isReorderMode,
  onEdit,
  onDelete,
  onDuplicate,
  onPreview,
  onTogglePlatform,
  onToggleEnabled,
  onRunNow,
}: SortableFeedCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: feed.id,
    disabled: !isReorderMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      id={`rss-feed-card-${feed.id}`}
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'z-20 scale-[1.01] opacity-90' : ''} ${isReorderMode ? 'cursor-grab active:cursor-grabbing' : ''}`.trim()}
      {...(isReorderMode ? { ...attributes, ...listeners } : {})}
    >
      <FeedCard
        feed={feed}
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onPreview={onPreview}
        onTogglePlatform={onTogglePlatform}
        onToggleEnabled={onToggleEnabled}
        onRunNow={onRunNow}
        touchSwipeEnabled={!isReorderMode}
        isReorderMode={isReorderMode}
      />
    </div>
  );
}
