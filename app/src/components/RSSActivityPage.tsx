import { useState } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { useRSSFeeds } from '../contexts/RSSFeedsContext';
import { SwipeableActivityCard } from './SwipeableActivityCard';
import { useUndo } from './UndoContext';
import { useSettings } from '../contexts/SettingsContext';


interface QueueItem {
  id: string;
  feedName: string;
  title: string;
  status: 'queued' | 'published' | 'failed';
  timestamp: string;
  platforms?: string[];
  error?: string;
}

interface RSSActivityPageProps {
  onNavigate: (page: string) => void;
  previousPage?: string | null;
}

export function RSSActivityPage({ onNavigate, previousPage }: RSSActivityPageProps) {
  const { feeds, deleteFeed, addFeed } = useRSSFeeds();
  const { showUndo } = useUndo();
  const { settings } = useSettings();
  const [filter, setFilter] = useState<'all' | 'failures' | 'published' | 'pending'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get retention period from settings (default 24 hours)
  const retentionHours = settings.rssActivityRetention || 24;
  const retentionMs = retentionHours * 60 * 60 * 1000; // Convert to milliseconds

  // Helper function to check if an item is within retention period
  const isWithinRetention = (timestamp: string): boolean => {
    try {
      const itemDate = new Date(timestamp);
      const now = new Date();
      const ageMs = now.getTime() - itemDate.getTime();
      return ageMs <= retentionMs;
    } catch (error) {
      // If parsing fails, keep the item
      return true;
    }
  };

  // Convert RSS feeds context to queue items format and filter by retention
  const queueItems: QueueItem[] = feeds
    .filter(feed => isWithinRetention(feed.publishedDate))
    .map(feed => {
      // Map feed status to queue item status
      let status: 'queued' | 'published' | 'failed' = 'queued';
      if (feed.status === 'published') {
        status = 'published';
      } else if (feed.status === 'failed') {
        status = 'failed';
      } else if (feed.status === 'pending' || feed.status === 'scheduled') {
        status = 'queued';
      }

      return {
        id: feed.id,
        feedName: feed.source,
        title: feed.title,
        status,
        timestamp: feed.publishedDate,
        platforms: feed.platforms,
        error: feed.errorMessage,
      };
    });

  const filteredItems = queueItems.filter((item) => {
    if (filter === 'failures') return item.status === 'failed';
    if (filter === 'published') return item.status === 'published';
    if (filter === 'pending') return item.status === 'queued';
    return true;
  });

  const getStatusConfig = (status: QueueItem['status']) => {
    switch (status) {
      case 'queued':
        return { icon: Clock, color: 'text-gray-700 dark:text-[#9CA3AF]', bg: 'bg-gray-200 dark:bg-[#1f1f1f]', label: 'Queued' };
      case 'published':
        return { icon: CheckCircle, color: 'text-gray-700 dark:text-[#9CA3AF]', bg: 'bg-gray-200 dark:bg-[#1f1f1f]', label: 'Published' };
      case 'failed':
        return { icon: XCircle, color: 'text-[#EF4444]', bg: 'bg-[#FEE2E2] dark:bg-[#991B1B]', label: 'Failed' };
    }
  };

  const handleRetry = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation(); // Prevent triggering the parent button click
    haptics.medium();
    toast.success('Retry Initiated', {
      description: `Retrying RSS feed: \"${title}\"`,
    });
    // Add logic to retry the RSS feed processing here
  };

  const handleDelete = (id: string, title: string) => {
    haptics.medium();

    // Find the feed to delete
    const deletedFeed = feeds.find(feed => feed.id === id);
    if (!deletedFeed) return;

    // Temporarily remove from state
    deleteFeed(id);

    // Show undo toast
    showUndo({
      id,
      itemName: title,
      onUndo: () => {
        // Restore the feed
        addFeed(deletedFeed);
      },
      onConfirm: () => {
        // Show final confirmation
        toast.success('Deleted', {
          description: `\"${title}\" has been removed`,
        });
      }
    });
  };

  const handleRefresh = async () => {
    haptics.light();
    toast.success('Refreshed RSS Activity');

    // Simulate refresh - replace with actual refresh logic
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (

    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start gap-4 mb-4">
          <button
            onClick={() => {
              haptics.light();
              onNavigate(previousPage || 'rss');
            }}
            className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12H2M9 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-gray-900 dark:text-white mb-2">RSS Feeds Activity</h1>
            <p className="text-[#6B7280] dark:text-[#9CA3AF]">
              Track all RSS feed processing activity and status
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Total Processed</p>
          <p className="text-gray-900 dark:text-white text-2xl">{queueItems.length}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Published</p>
          <p className="text-gray-900 dark:text-white text-2xl">
            {queueItems.filter(item => item.status === 'published').length}
          </p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Pending</p>
          <p className="text-gray-900 dark:text-white text-2xl">
            {queueItems.filter(item => item.status === 'queued').length}
          </p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Failed</p>
          <p className="text-gray-900 dark:text-white text-2xl">
            {queueItems.filter(item => item.status === 'failed').length}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'published', label: 'Published' },
            { value: 'pending', label: 'Pending' },
            { value: 'failures', label: 'Failures' },
          ].map((filterOption) => (
            <button
              key={filterOption.value}
              onClick={() => {
                haptics.light();
                setFilter(filterOption.value as any);
              }}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${filter === filterOption.value
                  ? 'bg-[#ec1e24] text-white'
                  : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-[#1F1F1F]'
                }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>

        {/* Items List */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-[#6B7280] dark:text-[#9CA3AF]">
              No items to display
            </div>
          ) : (
            filteredItems.map((item) => {
              const statusConfig = getStatusConfig(item.status);
              const StatusIcon = statusConfig.icon;

              return (
                <SwipeableActivityCard
                  key={item.id}
                  id={item.id}
                  onDelete={() => handleDelete(item.id, item.title)}
                  className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-white mb-1">{item.title}</p>
                      <div className="flex items-center gap-2 text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-2">
                        <span>{item.feedName}</span>
                        <span>•</span>
                        <span>{item.timestamp}</span>
                      </div>
                      {item.platforms && item.platforms.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2">
                          {item.platforms.map((platform) => (
                            <span
                              key={platform}
                              className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-[#1F1F1F] text-gray-700 dark:text-[#9CA3AF]"
                            >
                              {platform}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.error && (
                        <p className="text-sm text-[#EF4444] mt-1">{item.error}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${statusConfig.bg} ${statusConfig.color}`}>
                        <StatusIcon className="w-4 h-4" />
                        {statusConfig.label}
                      </span>
                      {item.status === 'failed' && (
                        <Button
                          onClick={(e) => handleRetry(e, item.id, item.title)}
                          size="sm"
                          variant="outline"
                          className="gap-2 bg-white dark:bg-black"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                </SwipeableActivityCard>
              );
            })
          )}
        </div>
      </div>
    </div>

  );
}