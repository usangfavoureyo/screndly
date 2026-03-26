import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { haptics } from '../utils/haptics';
import { toast } from 'sonner';
import { useRSSFeeds, RSSActivityItem } from '../contexts/RSSFeedsContext';
import { SwipeableActivityCard } from './SwipeableActivityCard';
import { useSettings } from '../contexts/SettingsContext';
import { apiClient } from '../lib/api/client';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { ActivitySelectionToolbar } from './ActivitySelectionToolbar';
import { useUndo } from './UndoContext';
import { BackIconButton } from './BackIconButton';

interface RSSActivityPageProps {
  onNavigate: (page: string) => void;
  previousPage?: string | null;
}

const RSS_ACTIVITY_TARGET_STORAGE_KEY = 'screndly_rss_activity_target';

function formatActivityTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDistanceToNow(date, { addSuffix: true });
}

function stripHtml(value?: string): string {
  if (!value) return '';
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function RSSActivityPage({ onNavigate, previousPage }: RSSActivityPageProps) {
  const { getActivity, refreshFeed } = useRSSFeeds();
  const { settings } = useSettings();
  const { showUndo } = useUndo();
  const [filter, setFilter] = useState<'all' | 'failures' | 'published' | 'pending' | 'filtered'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [items, setItems] = useState<RSSActivityItem[]>([]);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  useEffect(() => {
    if (typeof window === 'undefined' || items.length === 0) {
      return;
    }

    const targetId = window.localStorage.getItem(RSS_ACTIVITY_TARGET_STORAGE_KEY);
    if (!targetId) {
      return;
    }

    const targetItem = items.find((item) => item.id === targetId);
    if (!targetItem) {
      return;
    }

    setFilter('published');
    setHighlightedItemId(targetId);
    window.localStorage.removeItem(RSS_ACTIVITY_TARGET_STORAGE_KEY);

    const timeoutId = window.setTimeout(() => {
      itemRefs.current[targetId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);

    const clearId = window.setTimeout(() => {
      setHighlightedItemId((current) => (current === targetId ? null : current));
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(clearId);
    };
  }, [items]);

  const retentionHours = settings.rssActivityRetention || 24;
  const retentionMs = retentionHours * 60 * 60 * 1000;
  const logLevel = settings.rssLogLevel || 'standard';

  const retainedItems = useMemo(() => {
    const cutoff = Date.now() - retentionMs;
    return items.filter((item) => {
      const timestamp = new Date(item.timestamp).getTime();
      return Number.isNaN(timestamp) || timestamp >= cutoff;
    });
  }, [items, retentionMs]);

  const logLevelItems = retainedItems.filter((item) => {
    if (logLevel === 'minimal') return item.status === 'failed';
    if (logLevel === 'standard') return item.status === 'published' || item.status === 'failed';
    return true;
  });

  const filteredItems = logLevelItems.filter((item) => {
    if (filter === 'failures') return item.status === 'failed';
    if (filter === 'published') return item.status === 'published';
    if (filter === 'pending') return item.status === 'pending';
    if (filter === 'filtered') return item.status === 'filtered';
    return true;
  });
  const selection = useBulkSelection(filteredItems.map((item) => item.id));

  const summary = {
    total: logLevelItems.length,
    published: logLevelItems.filter((item) => item.status === 'published').length,
    pending: logLevelItems.filter((item) => item.status === 'pending').length,
    failed: logLevelItems.filter((item) => item.status === 'failed').length,
    filtered: logLevelItems.filter((item) => item.status === 'filtered').length,
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
      case 'filtered':
        return {
          icon: AlertTriangle,
          color: 'text-[#D97706]',
          bg: 'bg-[#FEF3C7] dark:bg-[#78350F]',
          label: 'Filtered',
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
    const deletedItem = items.find((item) => item.id === id);
    const deletedIndex = items.findIndex((item) => item.id === id);
    if (!deletedItem || deletedIndex === -1) return;

    setItems((prev) => prev.filter((item) => item.id !== id));

    showUndo({
      id,
      itemName: deletedItem.title,
      onUndo: () => {
        setItems((prev) => {
          if (prev.some((item) => item.id === deletedItem.id)) {
            return prev;
          }
          const next = [...prev];
          next.splice(Math.min(deletedIndex, next.length), 0, deletedItem);
          return next;
        });
      },
      onConfirm: async () => {
        try {
          const response = await apiClient.delete(`/api/rss/activity/${id}`);
          if (!response.success) {
            throw new Error(response.error?.message || 'Failed to delete activity');
          }
          toast.success('Activity entry deleted');
        } catch (error) {
          console.error('Failed to delete RSS activity:', error);
          setItems((prev) => {
            if (prev.some((item) => item.id === deletedItem.id)) {
              return prev;
            }
            const next = [...prev];
            next.splice(Math.min(deletedIndex, next.length), 0, deletedItem);
            return next;
          });
          toast.error(error instanceof Error ? error.message : 'Failed to delete activity');
        }
      },
    });
  };

  const handleDeleteSelected = async () => {
    if (selection.selectedCount === 0) return;

    haptics.medium();
    setIsDeletingSelected(true);
    const selectedIdSet = new Set(selection.selectedIds);

    try {
      await Promise.all(
        selection.selectedIds.map(async (id) => {
          const response = await apiClient.delete(`/api/rss/activity/${id}`);
          if (!response.success) {
            throw new Error(response.error?.message || 'Failed to delete selected activity');
          }
        })
      );
      setItems((prev) => prev.filter((item) => !selectedIdSet.has(item.id)));
      toast.success(`${selection.selectedCount} RSS activity item${selection.selectedCount === 1 ? '' : 's'} deleted`);
      selection.clearSelection();
    } catch (error) {
      console.error('Failed to bulk delete RSS activity:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete selected activity');
      await loadActivity();
    } finally {
      setIsDeletingSelected(false);
    }
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
          <BackIconButton
            onClick={() => onNavigate(previousPage || 'rss')}
            className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
          />
          <div className="flex-1">
            <h1 className="text-gray-900 dark:text-white mb-2">RSS Feeds Activity</h1>
            <p className="text-[#6B7280] dark:text-[#9CA3AF]">
              <span className="block">Track processing, publishing, and</span>
              <span className="block">failures for your RSS feeds.</span>
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh RSS activity"
            className="h-11 w-11 p-0 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Filtered</p>
          <p className="text-gray-900 dark:text-white text-2xl">{summary.filtered}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200">
        {selection.selectionMode && (
          <ActivitySelectionToolbar
            selectedCount={selection.selectedCount}
            isDeleting={isDeletingSelected}
            allSelected={selection.allSelected}
            onSelectAll={selection.selectAll}
            onClear={selection.clearSelection}
            onDelete={handleDeleteSelected}
            itemLabel="activity items"
          />
        )}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'published', label: 'Published' },
            { value: 'pending', label: 'Pending' },
            { value: 'failures', label: 'Failures' },
            { value: 'filtered', label: 'Filtered' },
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
                <div
                  key={item.id}
                  ref={(node) => {
                    itemRefs.current[item.id] = node;
                  }}
                  className={`rounded-xl transition-all duration-300 ${
                    highlightedItemId === item.id ? 'ring-2 ring-[#ec1e24] ring-offset-2 ring-offset-white dark:ring-offset-[#000000]' : ''
                  }`}
                >
                  <SwipeableActivityCard
                    id={item.id}
                    onDelete={handleDelete}
                    selectionMode={selection.selectionMode}
                    selected={selection.isSelected(item.id)}
                    onEnterSelectionMode={selection.enterSelectionMode}
                    onToggleSelection={selection.toggleSelection}
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
                        {item.description ? (
                          <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-[#6B7280] dark:border-[#333333] dark:bg-[#050505] dark:text-[#9CA3AF]">
                            <p className="line-clamp-3">{item.description}</p>
                          </div>
                        ) : item.contentHtml ? (
                          <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-[#6B7280] dark:border-[#333333] dark:bg-[#050505] dark:text-[#9CA3AF]">
                            <p className="line-clamp-3">{stripHtml(item.contentHtml)}</p>
                          </div>
                        ) : null}
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
                          <div className={`mt-1 rounded-lg px-3 py-2 text-sm ${
                            item.status === 'filtered'
                              ? 'bg-[#FEF3C7] text-[#92400E] dark:bg-[#78350F]/40 dark:text-[#FCD34D]'
                              : 'bg-[#FEE2E2] text-[#B91C1C] dark:bg-[#991B1B]/30 dark:text-[#FCA5A5]'
                          }`}>
                            {item.error}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${statusConfig.bg} ${statusConfig.color}`}>
                          <StatusIcon className="w-4 h-4" />
                          {statusConfig.label}
                        </span>
                        {!selection.selectionMode && item.status === 'failed' && item.feedId && (
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
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
