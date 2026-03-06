import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { haptics } from '../utils/haptics';
import { toast } from 'sonner';
import { useRSSFeeds, RSSActivityItem } from '../contexts/RSSFeedsContext';
import { SwipeableActivityCard } from './SwipeableActivityCard';
import { useSettings } from '../contexts/SettingsContext';

interface RSSActivityPageProps {
  onNavigate: (page: string) => void;
  previousPage?: string | null;
}

function formatActivityTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDistanceToNow(date, { addSuffix: true });
}

export function RSSActivityPage({ onNavigate, previousPage }: RSSActivityPageProps) {
  const { getActivity, deleteActivity, refreshFeed } = useRSSFeeds();
  const { settings } = useSettings();
  const [filter, setFilter] = useState<'all' | 'failures' | 'published' | 'pending'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [items, setItems] = useState<RSSActivityItem[]>([]);

  const loadActivity = async () => {
    setIsRefreshing(true);
    const response = await getActivity(200);
    if (response) {
      setItems(response.items);
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadActivity();
  }, []);

  const retentionHours = settings.rssActivityRetention || 24;
  const retentionMs = retentionHours * 60 * 60 * 1000;

  const retainedItems = useMemo(() => {
    const cutoff = Date.now() - retentionMs;
    return items.filter((item) => {
      const timestamp = new Date(item.timestamp).getTime();
      return Number.isNaN(timestamp) || timestamp >= cutoff;
    });
  }, [items, retentionMs]);

  const filteredItems = retainedItems.filter((item) => {
    if (filter === 'failures') return item.status === 'failed';
    if (filter === 'published') return item.status === 'published';
    if (filter === 'pending') return item.status === 'pending';
    return true;
  });

  const summary = {
    total: retainedItems.length,
    published: retainedItems.filter((item) => item.status === 'published').length,
    pending: retainedItems.filter((item) => item.status === 'pending').length,
    failed: retainedItems.filter((item) => item.status === 'failed').length,
  };

  const getStatusConfig = (status: RSSActivityItem['status']) => {
    switch (status) {
      case 'pending':
        return {
          icon: Clock,
          color: 'text-gray-700 dark:text-[#9CA3AF]',
          bg: 'bg-gray-200 dark:bg-[#1f1f1f]',
          label: 'Pending',
        };
      case 'published':
        return {
          icon: CheckCircle,
          color: 'text-gray-700 dark:text-[#9CA3AF]',
          bg: 'bg-gray-200 dark:bg-[#1f1f1f]',
          label: 'Published',
        };
      case 'failed':
        return {
          icon: XCircle,
          color: 'text-[#EF4444]',
          bg: 'bg-[#FEE2E2] dark:bg-[#991B1B]',
          label: 'Failed',
        };
    }
  };

  const handleRetry = async (event: React.MouseEvent, item: RSSActivityItem) => {
    event.stopPropagation();
    if (!item.feedId) {
      toast.error('This activity entry is missing its feed reference');
      return;
    }

    haptics.medium();
    await refreshFeed(item.feedId);
    await loadActivity();
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    haptics.medium();
    await deleteActivity(id);
    await loadActivity();
  };

  const handleRefresh = async () => {
    haptics.light();
    await loadActivity();
    toast.success('RSS activity refreshed');
  };

  return (
    <div className="space-y-6">
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
              Track processing, publishing, and failures for your RSS feeds.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="!bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Total Processed</p>
          <p className="text-gray-900 dark:text-white text-2xl">{summary.total}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Published</p>
          <p className="text-gray-900 dark:text-white text-2xl">{summary.published}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Pending</p>
          <p className="text-gray-900 dark:text-white text-2xl">{summary.pending}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Failed</p>
          <p className="text-gray-900 dark:text-white text-2xl">{summary.failed}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'published', label: 'Published' },
            { value: 'pending', label: 'Pending' },
            { value: 'failures', label: 'Failures' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => {
                haptics.light();
                setFilter(option.value as typeof filter);
              }}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${filter === option.value
                ? 'bg-[#ec1e24] text-white'
                : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-[#1F1F1F]'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-[#6B7280] dark:text-[#9CA3AF]">
              No RSS activity within the configured retention window.
            </div>
          ) : (
            filteredItems.map((item) => {
              const statusConfig = getStatusConfig(item.status);
              const StatusIcon = statusConfig.icon;

              return (
                <SwipeableActivityCard
                  key={item.id}
                  id={item.id}
                  onDelete={handleDelete}
                  className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] transition-all duration-200"
                  deleteLabel="Delete"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-white mb-1">{item.title}</p>
                      <div className="flex items-center gap-2 text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-2 flex-wrap">
                        <span>{item.feedName}</span>
                        <span>&bull;</span>
                        <span>{formatActivityTimestamp(item.timestamp)}</span>
                      </div>
                      {item.platforms.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
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
                      {item.status === 'failed' && item.feedId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => handleRetry(event, item)}
                          className="!bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
                        >
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
