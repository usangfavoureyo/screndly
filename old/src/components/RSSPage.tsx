import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { FeedCard, Feed } from './rss/FeedCard';
import { FeedEditor } from './rss/FeedEditor';
import { FeedPreview } from './rss/FeedPreview';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { useSettings } from '../contexts/SettingsContext';
import { enrichArticleWithImages } from '../lib/rss/image-enrichment';
import { useUndo } from './UndoContext';
import { generateRSSCaption } from '../utils/rssCaptionGenerator';
import { useRSSFeeds, RSSFeed } from '../contexts/RSSFeedsContext';

interface RSSPageProps {
  onNavigate?: (page: string) => void;
}

export function RSSPage({ onNavigate }: RSSPageProps) {
  const { settings, updateSetting } = useSettings();
  const { showUndo } = useUndo();
  const { feeds, isLoading, addFeed, updateFeed, deleteFeed: contextDeleteFeed, toggleFeedEnabled, togglePlatform, refreshFeed } = useRSSFeeds();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Transform RSSFeed from context to Feed for FeedCard
  const transformedFeeds: Feed[] = feeds.map(f => ({
    id: f.id,
    name: f.name,
    url: f.url,
    enabled: f.enabled,
    interval: f.interval,
    imageCount: f.imageCount as '1' | '2' | '3' | 'random',
    dedupeDays: f.dedupeDays,
    filters: f.filters,
    serperPriority: f.serperPriority,
    rehostImages: f.rehostImages,
    autoPost: f.autoPost,
    platformsEnabled: f.platformsEnabled,
    status: f.status,
    lastProcessedAt: f.lastProcessedAt || undefined,
    nextRunAt: f.nextRunAt || undefined,
    favicon: f.favicon || undefined,
  }));

  const [queueItems] = useState([
    {
      id: 'queue-1',
      feedName: 'Variety',
      title: 'Dune: Part Three - Official Announcement',
      status: 'published' as const,
      timestamp: '2 min ago',
      platforms: ['X', 'Threads'],
    },
    {
      id: 'queue-2',
      feedName: 'The Hollywood Reporter',
      title: 'Marvel Announces New Phase 6 Projects',
      status: 'captioned' as const,
      timestamp: '5 min ago',
    },
    {
      id: 'queue-3',
      feedName: 'Deadline',
      title: 'Christopher Nolan Next Film Details',
      status: 'enriched' as const,
      timestamp: '10 min ago',
    },
    {
      id: 'queue-4',
      feedName: 'IndieWire',
      title: 'Sundance 2025 Lineup Revealed',
      status: 'failed' as const,
      timestamp: '15 min ago',
      error: 'Failed to fetch images from Serper API',
    },
    {
      id: 'queue-5',
      feedName: 'Variety',
      title: 'Avatar 3 Gets New Release Date',
      status: 'queued' as const,
      timestamp: '20 min ago',
    },
    {
      id: 'queue-6',
      feedName: 'The Hollywood Reporter',
      title: 'Netflix Drops First Look at The Witcher Season 4',
      status: 'published' as const,
      timestamp: '25 min ago',
      platforms: ['X', 'Facebook'],
    },
  ]);

  const filteredFeeds = transformedFeeds.filter((feed) =>
    feed.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    feed.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddFeed = () => {
    haptics.medium();
    setSelectedFeed(null);
    setIsEditorOpen(true);
  };

  const handleEditFeed = (id: string) => {
    const feed = transformedFeeds.find((f) => f.id === id);
    if (feed) {
      setSelectedFeed(feed);
      setIsEditorOpen(true);
    }
  };

  const handleDeleteFeed = async (id: string) => {
    haptics.medium();
    const deletedFeed = transformedFeeds.find((f) => f.id === id);
    if (!deletedFeed) return;

    try {
      await contextDeleteFeed(id);
    } catch {
      toast.error('Failed to delete feed');
    }
  };

  const handleSaveFeed = async (feed: Feed) => {
    try {
      if (feed.id && transformedFeeds.find((f) => f.id === feed.id)) {
        // Update existing feed
        await updateFeed(feed.id, feed);
        toast.success('Feed updated successfully');
      } else {
        // Add new feed
        await addFeed(feed);
      }
      setIsEditorOpen(false);
    } catch {
      toast.error('Failed to save feed');
    }
  };

  const handlePreview = async (id: string) => {
    const feed = transformedFeeds.find(f => f.id === id);
    if (!feed) return;

    // Show loading toast
    const loadingToast = toast.loading('Fetching and enriching preview article...');

    try {
      // Fetch real RSS data using rss2json to avoid CORS and XML parsing issues client-side
      const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`);
      const data = await response.json();

      if (data.status !== 'ok') {
        throw new Error('Failed to fetch RSS feed');
      }

      const latestItem = data.items[0];

      if (!latestItem) {
        throw new Error('No items found in feed');
      }

      const mockArticle = {
        title: latestItem.title,
        description: latestItem.description || latestItem.content || '',
        link: latestItem.link,
        pubDate: latestItem.pubDate
      };

      // Use smart image selection
      const enrichmentResult = await enrichArticleWithImages(
        mockArticle,
        settings,
        parseInt(feed.imageCount) || 2
      );

      toast.dismiss(loadingToast);

      if (!enrichmentResult.success) {
        toast.error(enrichmentResult.error || 'Failed to enrich article with images');
        return;
      }

      // Show confidence level
      if (enrichmentResult.confidenceLevel === 'high') {
        toast.success(`High confidence match (${enrichmentResult.confidence}%) - Perfect images found!`);
      } else if (enrichmentResult.confidenceLevel === 'medium') {
        toast.info(`Medium confidence (${enrichmentResult.confidence}%) - Good match`);
      } else {
        toast.warning(`Low confidence (${enrichmentResult.confidence}%) - Using fallback images`);
      }

      // Generate caption using RSS Settings
      const captionResult = await generateRSSCaption(
        {
          title: mockArticle.title,
          description: mockArticle.description,
          link: mockArticle.link,
        },
        settings
      );

      setPreviewData({
        title: mockArticle.title,
        link: mockArticle.link,
        pubDate: mockArticle.pubDate,
        snippet: mockArticle.description,
        images: enrichmentResult.images.map(img => ({
          url: img.url,
          reason: img.reason
        })),
        caption: captionResult.caption,
        captionCharCount: captionResult.charCount,
        analysis: enrichmentResult.analysis,
        confidence: enrichmentResult.confidence,
        confidenceLevel: enrichmentResult.confidenceLevel,
        captionSettings: captionResult.settings,
      });

      setIsPreviewOpen(true);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : 'Failed to generate preview');
      console.error('Preview error:', error);
    }
  };

  const handleTest = async (id: string) => {
    // Real test via backend refresh
    try {
      await refreshFeed(id);
      // Verify success by checking if the feed updated? 
      // refreshFeed already shows a toast on success/failure
    } catch (error) {
      console.error('Test failed:', error);
      // Toast already handled by refreshFeed
    }
  };

  const handleTogglePlatform = async (feedId: string, platform: string, enabled: boolean) => {
    await togglePlatform(feedId, platform as keyof typeof feeds[0]['platformsEnabled'], enabled);
  };

  const handleToggleEnabled = async (feedId: string, enabled: boolean) => {
    await toggleFeedEnabled(feedId, enabled);
  };

  const handleRunNow = (feedId: string) => {
    const feed = feeds.find((f) => f.id === feedId);
    if (feed) {
      toast.success(`Running ${feed.name} now...`);
    }
  };

  const handleQueueItemClick = (id: string) => {
    // Navigate to logs page with filter
    if (onNavigate) {
      onNavigate('logs');
    }
  };

  const handleNavigateToLogs = () => {
    if (onNavigate) {
      onNavigate('logs');
    }
  };

  const activeFeeds = feeds.filter((f) => f.status === 'active').length;
  const totalItems = queueItems.length;
  const publishedToday = queueItems.filter((i) => i.status === 'published').length;
  const failedItems = queueItems.filter((i) => i.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Total Feeds</p>
          <p className="text-gray-900 dark:text-white text-2xl">{feeds.length}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Active</p>
          <p className="text-gray-900 dark:text-white text-2xl">{activeFeeds}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Published Today</p>
          <p className="text-gray-900 dark:text-white text-2xl">{publishedToday}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Errors</p>
          <p className="text-gray-900 dark:text-white text-2xl">{failedItems}</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feeds Section */}
        <div className="lg:col-span-3 space-y-4">
          {/* Add Feed Section */}
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
              {/* Global RSS Posting */}
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

              {/* Event-Driven Posting Mode */}
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

              {/* Minimum Gap */}
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
                    <SelectItem value="5">5 min</SelectItem>
                    <SelectItem value="10">10 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Deduplication */}
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

          {/* Feeds List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-900 dark:text-white">
                Feeds ({feeds.length})
              </h3>
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
            {feeds.length === 0 ? (
              <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-12 text-center">
                <p className="text-[#6B7280] dark:text-[#9CA3AF]">
                  No feeds configured yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {feeds.map((feed) => (
                  <FeedCard
                    key={feed.id}
                    feed={feed}
                    onEdit={handleEditFeed}
                    onDelete={handleDeleteFeed}
                    onPreview={handlePreview}
                    onTest={handleTest}
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

      {/* Feed Editor */}
      <FeedEditor
        feed={selectedFeed}
        onSave={handleSaveFeed}
        onDelete={handleDeleteFeed}
        onClose={() => setIsEditorOpen(false)}
        isOpen={isEditorOpen}
      />

      {/* Feed Preview */}
      <FeedPreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        preview={previewData}
        onRunPipeline={() => {
          toast.success('Pipeline test started. Check the queue for results.');
          setIsPreviewOpen(false);
        }}
      />
    </div>
  );
}