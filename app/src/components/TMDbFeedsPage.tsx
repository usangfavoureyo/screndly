import { useState, useCallback, useMemo } from 'react';
import { ArrowDownWideNarrow, Check, Clock3, RefreshCw } from 'lucide-react';
import { TMDbStatsPanel } from './tmdb/TMDbStatsPanel';
import { TMDbFeedCard } from './tmdb/TMDbFeedCard';
import { Button } from './ui/button';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { saveSettings } from '../lib/api/settings';
import { useTMDbPosts } from '../contexts/TMDbPostsContext';
import { useUndo } from './UndoContext';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { ActivitySelectionToolbar } from './ActivitySelectionToolbar';
import { useTMDbAutoSync } from '../hooks/useTMDbAutoSync';
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetHeader,
  BottomSheetTitle,
} from './ui/bottom-sheet';

interface TMDbFeedsPageProps {
  onNavigate: (page: string, fromPage?: string | null) => void;
  previousPage?: string | null;
}

type TMDbFeedFilterType = 'all' | 'today' | 'weekly' | 'monthly' | 'anniversary';
type SortOption = 'popular-desc' | 'popular-asc' | 'recent-desc' | 'recent-asc';

const SORT_OPTION_LABELS: Record<SortOption, string> = {
  'popular-desc': 'Most Popular',
  'popular-asc': 'Least Popular',
  'recent-desc': 'Recently Added',
  'recent-asc': 'Oldest Added',
};

const TMDB_INTERVAL_OPTIONS = [1, 2, 3, 4, 5, 10, 15, 20, 30, 45, 60, 120] as const;
const TMDB_SETTINGS_STORAGE_KEY = 'screndly_tmdb_settings';

function getCurrentTMDbIntervalMinutes(): number {
  try {
    const raw = window.localStorage.getItem(TMDB_SETTINGS_STORAGE_KEY);
    if (!raw) return 60;

    const parsed = JSON.parse(raw);
    const value = Number.parseInt(String(parsed.minGapBetweenPostsMinutes ?? ''), 10);
    return Number.isFinite(value) && value > 0 ? value : 60;
  } catch {
    return 60;
  }
}

function formatTMDbIntervalLabel(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  if (minutes === 60) {
    return '1 hr';
  }

  if (minutes % 60 === 0) {
    return `${minutes / 60} hrs`;
  }

  return `${minutes} min`;
}

export function TMDbFeedsPage({ onNavigate }: TMDbFeedsPageProps) {
  const { posts, fetchPosts, refreshFromTMDb, updatePost, deletePost, restorePost } = useTMDbPosts();
  const { showUndo } = useUndo();
  const [filterType, setFilterType] = useState<TMDbFeedFilterType>('all');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [intervalSheetOpen, setIntervalSheetOpen] = useState(false);
  const [sortByTab, setSortByTab] = useState<Record<TMDbFeedFilterType, SortOption>>({
    all: 'recent-desc',
    today: 'recent-desc',
    weekly: 'recent-desc',
    monthly: 'recent-desc',
    anniversary: 'recent-desc',
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [isSavingInterval, setIsSavingInterval] = useState(false);
  const [tmdbIntervalMinutes, setTMDbIntervalMinutes] = useState<number>(() => getCurrentTMDbIntervalMinutes());

  useTMDbAutoSync(fetchPosts);

  // Keep queued and scheduled items visible here until they publish.
  const feeds = posts.filter(post => post.status === 'queued' || post.status === 'scheduled');

  const currentSort = sortByTab[filterType];
  const filteredFeeds = useMemo(() => {
    const byTab = feeds.filter((feed) => {
      if (filterType === 'all') return true;
      return feed.source === `tmdb_${filterType}`;
    });

    return [...byTab].sort((left, right) => {
      if (currentSort === 'popular-desc' || currentSort === 'popular-asc') {
        const popularityDelta = currentSort === 'popular-desc'
          ? (right.popularity || 0) - (left.popularity || 0)
          : (left.popularity || 0) - (right.popularity || 0);
        if (popularityDelta !== 0) {
          return popularityDelta;
        }
      }

      const rightDate = new Date(right.createdAt || right.updatedAt || right.releaseDate || 0).getTime();
      const leftDate = new Date(left.createdAt || left.updatedAt || left.releaseDate || 0).getTime();
      if (rightDate !== leftDate) {
        return currentSort === 'recent-asc' ? leftDate - rightDate : rightDate - leftDate;
      }

      if (currentSort === 'popular-asc') {
        return (left.popularity || 0) - (right.popularity || 0);
      }

      return (right.popularity || 0) - (left.popularity || 0);
    });
  }, [currentSort, feeds, filterType]);
  const selection = useBulkSelection(filteredFeeds.map((feed) => feed.id));

  const handleFilterChange = useCallback((filter: TMDbFeedFilterType) => {
    haptics.light();
    setFilterType(filter);
  }, []);

  const handleSortChange = useCallback((sort: SortOption) => {
    haptics.light();
    setSortByTab((current) => ({
      ...current,
      [filterType]: sort,
    }));
    setSortSheetOpen(false);
  }, [filterType]);

  const handleIntervalChange = useCallback(async (minutes: number) => {
    haptics.light();
    setTMDbIntervalMinutes(minutes);
    setIsSavingInterval(true);

    try {
      const raw = window.localStorage.getItem(TMDB_SETTINGS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const nextSettings = {
        ...parsed,
        minGapBetweenPostsMinutes: String(minutes),
      };

      window.localStorage.setItem(TMDB_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));

      const result = await saveSettings({ minGapBetweenPostsMinutes: String(minutes) } as any);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to save TMDb interval');
      }

      toast.success(`TMDb auto-post interval set to ${formatTMDbIntervalLabel(minutes)}`);
      setIntervalSheetOpen(false);
    } catch (error) {
      console.error('[TMDbFeedsPage] Failed to save TMDb interval:', error);
      toast.error('Failed to update TMDb auto-post interval');
    } finally {
      setIsSavingInterval(false);
    }
  }, []);

  // Stable callback - identity doesn't change between renders
  const handleUpdateFeed = useCallback((feedId: string, updates: any) => {
    updatePost(feedId, updates);
  }, [updatePost]);

  // Stable callback for delete with undo
  const handleDeleteFeed = useCallback((feedId: string) => {
    haptics.medium();

    // Find the post and its index to delete
    const postIndex = posts.findIndex(post => post.id === feedId);
    const deletedPost = posts.find(post => post.id === feedId);
    if (!deletedPost || postIndex === -1) return;

    // Store the original index
    const originalIndex = postIndex;

    // Temporarily remove from state
    deletePost(feedId);

    // Show undo toast
    showUndo({
      id: feedId,
      itemName: deletedPost.title,
      onUndo: () => {
        // Restore the post at its original position
        restorePost(deletedPost, originalIndex);
      },
      onConfirm: () => {
        // Show final confirmation
        toast.success('Feed deleted successfully');
      }
    });
  }, [posts, deletePost, restorePost, showUndo]);

  // Manual refresh handler (no pull-to-refresh)
  const handleManualRefresh = async () => {
    if (isRefreshing) return;

    haptics.light();
    setIsRefreshing(true);

    try {
      // Trigger backend to fetch fresh movies from TMDb API
      const result = await refreshFromTMDb();

      if (result.added > 0) {
        toast.success(`Fetched ${result.added} new TMDb titles!`);
      } else if (result.errors.length > 0) {
        toast.error(`Refresh failed: ${result.errors[0]}`);
      } else {
        toast.info('No new TMDb titles found');
      }

    } catch (error) {
      console.error('[TMDbFeedsPage] Refresh failed:', error);
      toast.error('Failed to refresh feeds from TMDb');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selection.selectedCount === 0) return;

    haptics.medium();
    setIsDeletingSelected(true);

    try {
      await Promise.all(selection.selectedIds.map((id) => deletePost(id)));
      toast.success(`${selection.selectedCount} TMDb feed card${selection.selectedCount === 1 ? '' : 's'} deleted`);
      selection.clearSelection();
    } catch (error) {
      console.error('[TMDbFeedsPage] Bulk delete failed:', error);
      toast.error('Failed to delete selected TMDb feeds');
    } finally {
      setIsDeletingSelected(false);
    }
  };

  return (
    <div className="space-y-6">
      <BottomSheet
        open={sortSheetOpen}
        onOpenChange={setSortSheetOpen}
        heightMode="auto"
        showHandle
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Sort Feeds</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody className="px-4 pb-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-[#333333] dark:bg-[#000000]">
            {(['popular-desc', 'popular-asc', 'recent-desc', 'recent-asc'] as const).map((option) => {
              const selected = currentSort === option;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSortChange(option)}
                  className={`relative flex w-full items-center gap-2 rounded-sm px-3 py-3 text-left text-sm transition-colors ${
                    selected
                      ? 'font-medium text-gray-900 dark:text-white'
                      : 'text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-[#333333]'
                  }`}
                >
                  <span className="flex-1 truncate">{SORT_OPTION_LABELS[option]}</span>
                  {selected ? <Check className="h-4 w-4 text-[#ec1e24]" /> : null}
                </button>
              );
            })}
          </div>
        </BottomSheetBody>
      </BottomSheet>

      <BottomSheet
        open={intervalSheetOpen}
        onOpenChange={setIntervalSheetOpen}
        heightMode="auto"
        showHandle
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Auto-Post Interval</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody className="px-4 pb-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-[#333333] dark:bg-[#000000]">
            {TMDB_INTERVAL_OPTIONS.map((minutes) => {
              const selected = tmdbIntervalMinutes === minutes;

              return (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => {
                    if (!isSavingInterval) {
                      void handleIntervalChange(minutes);
                    }
                  }}
                  disabled={isSavingInterval}
                  className={`relative flex w-full items-center gap-2 rounded-sm px-3 py-3 text-left text-sm transition-colors ${
                    selected
                      ? 'font-medium text-gray-900 dark:text-white'
                      : 'text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-[#333333]'
                  } ${isSavingInterval ? 'opacity-60' : ''}`}
                >
                  <span className="flex-1 truncate">{formatTMDbIntervalLabel(minutes)}</span>
                  {selected ? <Check className="h-4 w-4 text-[#ec1e24]" /> : null}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-[#9CA3AF]">
            Controls the minimum spacing between auto-posted TMDb feeds. Random spacing is not enabled yet; I kept this on fixed intervals so the scheduler stays predictable.
          </p>
        </BottomSheetBody>
      </BottomSheet>

      {/* Stats Panel */}
      <TMDbStatsPanel feeds={feeds} onFilterChange={handleFilterChange} />

      {/* Tab Filters */}
      <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filterType === 'all'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange('today')}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filterType === 'today'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            Today
          </button>
          <button
            onClick={() => handleFilterChange('weekly')}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filterType === 'weekly'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            Weekly
          </button>
          <button
            onClick={() => handleFilterChange('monthly')}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filterType === 'monthly'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            Monthly
          </button>
          <button
            onClick={() => handleFilterChange('anniversary')}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filterType === 'anniversary'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            Anniversaries
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {selection.selectionMode && (
          <ActivitySelectionToolbar
            selectedCount={selection.selectedCount}
            isDeleting={isDeletingSelected}
            allSelected={selection.allSelected}
            onSelectAll={selection.selectAll}
            onClear={selection.clearSelection}
            onDelete={handleDeleteSelected}
            itemLabel="feed cards"
          />
        )}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-900 dark:text-white">
            Feeds ({filteredFeeds.length})
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                haptics.light();
                setIntervalSheetOpen(true);
              }}
              className="h-9 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
            >
              <Clock3 size={16} className="mr-2 shrink-0" />
              {formatTMDbIntervalLabel(tmdbIntervalMinutes)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                haptics.light();
                setSortSheetOpen(true);
              }}
              className="h-9 w-9 p-0 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
              aria-label={`Sort feeds. Current: ${SORT_OPTION_LABELS[currentSort]}`}
            >
              <ArrowDownWideNarrow size={16} className="shrink-0" />
            </Button>
            {/* Manual Refresh Button - Icon Only, same height as View Activity */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="h-9 w-9 p-0 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                haptics.light();
                onNavigate('tmdb-activity', 'tmdb');
              }}
              className="h-9 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
            >
              View Activity
            </Button>
          </div>
        </div>
        {filteredFeeds.length > 0 ? (
          filteredFeeds.map((feed) => (
            <TMDbFeedCard
              key={feed.id}
              feed={feed}
              onUpdate={handleUpdateFeed}
              onDelete={handleDeleteFeed}
              selectionMode={selection.selectionMode}
              selected={selection.isSelected(feed.id)}
              onEnterSelectionMode={selection.enterSelectionMode}
              onToggleSelection={selection.toggleSelection}
            />
          ))
        ) : (
          <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-12 text-center">
            <h3 className="text-gray-500 dark:text-[#9CA3AF] mb-2">No {filterType !== 'all' ? filterType : ''} queued or scheduled posts</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              {filterType !== 'all'
                ? `${filterType.charAt(0).toUpperCase() + filterType.slice(1)} posts will appear here automatically when fetched and stay here while queued or scheduled.`
                : 'TMDb feeds will appear here automatically based on your TMDb settings.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
