import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { haptics } from '../utils/haptics';
import { toast } from 'sonner';
import { useRSSFeeds, RSSActivityItem, type RSSEditorialBrainReviewOutcome } from '../contexts/RSSFeedsContext';
import { SwipeableActivityCard } from './SwipeableActivityCard';
import { useSettings } from '../contexts/SettingsContext';
import { apiClient } from '../lib/api/client';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { ActivitySelectionToolbar } from './ActivitySelectionToolbar';
import { useUndo } from './UndoContext';
import { BackIconButton } from './BackIconButton';
import { OptimizedImage } from './ui/optimized-image';
import { saveRSSActivitySnapshot } from '../utils/rssOfflineStore';
import { RSSEditorialBrainReviewPanel } from './rss/RSSEditorialBrainReviewPanel';
import {
  buildEditorialBrainCalibrationSummary,
  buildEditorialBrainPromotionSummary,
  buildEditorialBrainReviewExportRows,
  compareEditorialBrainReviewPriority,
  matchesEditorialBrainReviewFilters,
  type EditorialBrainReviewFilters,
} from '../lib/rss/editorialBrainReview';
import {
  deriveRSSActivityStatus,
  deriveRSSPlatformStates,
  getRetryableRSSPlatforms,
  getRetryFailedLabel,
  getRSSPublishSummary,
  type RSSActivityDerivedStatus,
  type RSSDerivedPlatformState,
} from '../lib/rss/activityStatus';

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

function formatImageSource(value?: RSSActivityItem['imageSource']): string | null {
  if (!value) return null;
  switch (value) {
    case 'tmdb':
      return 'TMDb';
    case 'serper':
      return 'Serper';
    case 'feed':
      return 'Feed';
    default:
      return null;
  }
}

function formatSelectionConfidence(value?: RSSActivityItem['imageSelectionConfidence']): string | null {
  if (!value) return null;
  switch (value) {
    case 'high':
      return 'High confidence';
    case 'medium':
      return 'Medium confidence';
    case 'low':
      return 'Low confidence';
    default:
      return null;
  }
}

function buildActivitySummary(items: RSSActivityItem[]) {
  return {
    total: items.length,
    published: items.filter((item) => deriveRSSActivityStatus(item, deriveRSSPlatformStates(item)) === 'published').length,
    pending: items.filter((item) => deriveRSSActivityStatus(item, deriveRSSPlatformStates(item)) === 'publishing').length,
    failed: items.filter((item) => {
      const status = deriveRSSActivityStatus(item, deriveRSSPlatformStates(item));
      return status === 'failed' || status === 'partial_failed';
    }).length,
    filtered: items.filter((item) => item.status === 'filtered').length,
  };
}

function downloadFile(contents: string, filename: string, type: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([contents], { type });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

interface RSSActivityViewModel {
  item: RSSActivityItem;
  derivedStatus: RSSActivityDerivedStatus;
  platformStates: RSSDerivedPlatformState[];
  retryablePlatforms: RSSDerivedPlatformState[];
  publishSummary: string | null;
}

export function RSSActivityPage({ onNavigate, previousPage }: RSSActivityPageProps) {
  const { getActivity, retryActivity, saveEditorialBrainReview } = useRSSFeeds();
  const { settings } = useSettings();
  const { showUndo } = useUndo();
  const [filter, setFilter] = useState<'all' | 'failures' | 'published' | 'pending'>('all');
  const [editorialFilters, setEditorialFilters] = useState<EditorialBrainReviewFilters>({
    source: 'all',
    disagreement: 'all',
    reviewed: 'all',
    confidence: 'all',
    publishOutcome: 'all',
    promotion: 'all',
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryingItemId, setRetryingItemId] = useState<string | null>(null);
  const [savingReviewItemId, setSavingReviewItemId] = useState<string | null>(null);
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

  const activityViewModels = useMemo<RSSActivityViewModel[]>(() => (
    retainedItems.map((item) => {
      const platformStates = deriveRSSPlatformStates(item);
      const derivedStatus = deriveRSSActivityStatus(item, platformStates);
      const retryablePlatforms = getRetryableRSSPlatforms(platformStates);

      return {
        item,
        derivedStatus,
        platformStates,
        retryablePlatforms,
        publishSummary: getRSSPublishSummary(platformStates),
      };
    })
  ), [retainedItems]);

  const logLevelItems = activityViewModels.filter(({ derivedStatus }) => {
    if (logLevel === 'minimal') return derivedStatus === 'failed' || derivedStatus === 'partial_failed';
    if (logLevel === 'standard') return derivedStatus === 'published' || derivedStatus === 'failed' || derivedStatus === 'partial_failed';
    return true;
  });

  const editorialBrainItems = useMemo(
    () => retainedItems.filter((item) => Boolean(item.editorialBrain)),
    [retainedItems]
  );
  const editorialCalibrationSummary = useMemo(
    () => buildEditorialBrainCalibrationSummary(editorialBrainItems),
    [editorialBrainItems]
  );
  const editorialPromotionSummary = useMemo(
    () => buildEditorialBrainPromotionSummary(editorialBrainItems),
    [editorialBrainItems]
  );
  const editorialSourceOptions = useMemo(
    () => Array.from(new Set(editorialBrainItems.map((item) => item.feedName))).sort((left, right) => left.localeCompare(right)),
    [editorialBrainItems]
  );

  const filteredItems = logLevelItems.filter(({ derivedStatus }) => {
    if (filter === 'failures') return derivedStatus === 'failed' || derivedStatus === 'partial_failed';
    if (filter === 'published') return derivedStatus === 'published';
    if (filter === 'pending') return derivedStatus === 'publishing' || derivedStatus === 'scheduled';
    return true;
  }).filter(({ item }) => matchesEditorialBrainReviewFilters(item, {
    ...editorialFilters,
    publishOutcome: editorialFilters.publishOutcome === 'all' ? 'all' : editorialFilters.publishOutcome,
  })).sort((left, right) => compareEditorialBrainReviewPriority(left.item, right.item));
  const selection = useBulkSelection(filteredItems.map(({ item }) => item.id));

  const summary = {
    total: logLevelItems.length,
    published: logLevelItems.filter((entry) => entry.derivedStatus === 'published').length,
    pending: logLevelItems.filter((entry) => entry.derivedStatus === 'publishing' || entry.derivedStatus === 'scheduled').length,
    failed: logLevelItems.filter((entry) => entry.derivedStatus === 'failed' || entry.derivedStatus === 'partial_failed').length,
  };

  const getStatusConfig = (status: RSSActivityDerivedStatus) => {
    switch (status) {
      case 'scheduled':
      case 'publishing':
        return {
          icon: Clock,
          color: 'text-gray-700 dark:text-[#9CA3AF]',
          bg: 'bg-gray-200 dark:bg-[#1f1f1f]',
          label: 'Publishing',
        };
      case 'published':
        return {
          icon: CheckCircle,
          color: 'text-gray-700 dark:text-[#9CA3AF]',
          bg: 'bg-gray-200 dark:bg-[#1f1f1f]',
          label: 'Published',
        };
      case 'partial_failed':
        return {
          icon: AlertTriangle,
          color: 'text-[#D97706]',
          bg: 'bg-[#FEF3C7] dark:bg-[#78350F]',
          label: 'Partially Failed',
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
    if (!item.id) {
      toast.error('This activity entry is missing its retry reference');
      return;
    }

    haptics.medium();
    setRetryingItemId(item.id);
    try {
      const retriedItem = await retryActivity(item.id);
      if (retriedItem) {
        await loadActivity();
        if (retriedItem.status === 'published') {
          toast.success('RSS item published on retry');
        } else if (retriedItem.status === 'pending') {
          toast.info(retriedItem.error || 'RSS item retried. Remaining platforms are still pending.');
        } else {
          toast.error(retriedItem.error || 'RSS item retry failed');
        }
      }
    } finally {
      setRetryingItemId(null);
    }
  };

  const handleEditorialReview = async (item: RSSActivityItem, outcome: RSSEditorialBrainReviewOutcome) => {
    if (!item.editorialBrain) {
      return;
    }

    setSavingReviewItemId(item.id);
    try {
      const updated = await saveEditorialBrainReview(item.id, { outcome });
      if (updated) {
        setItems((prev) => {
          const next = prev.map((entry) => (entry.id === updated.id ? updated : entry));
          void saveRSSActivitySnapshot({ items: next, summary: buildActivitySummary(next) });
          return next;
        });
        toast.success('Editorial brain review saved');
      }
    } finally {
      setSavingReviewItemId(null);
    }
  };

  const exportEditorialRows = (format: 'json' | 'csv') => {
    const rows = buildEditorialBrainReviewExportRows(filteredItems.map(({ item }) => item));
    if (rows.length === 0) {
      toast.info('No editorial brain activity matches the current filters.');
      return;
    }

    if (format === 'json') {
      downloadFile(JSON.stringify(rows, null, 2), 'rss-editorial-brain-review.json', 'application/json');
      return;
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => {
        const value = String(row[header as keyof typeof row] ?? '');
        return `"${value.replace(/"/g, '""')}"`;
      }).join(',')),
    ].join('\n');
    downloadFile(csv, 'rss-editorial-brain-review.csv', 'text/csv;charset=utf-8');
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    haptics.medium();
    const deletedItem = items.find((item) => item.id === id);
    const deletedIndex = items.findIndex((item) => item.id === id);
    if (!deletedItem || deletedIndex === -1) return;

    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      void saveRSSActivitySnapshot({ items: next, summary: buildActivitySummary(next) });
      return next;
    });

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
          void saveRSSActivitySnapshot({ items: next, summary: buildActivitySummary(next) });
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
            void saveRSSActivitySnapshot({ items: next, summary: buildActivitySummary(next) });
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
      setItems((prev) => {
        const next = prev.filter((item) => !selectedIdSet.has(item.id));
        void saveRSSActivitySnapshot({ items: next, summary: buildActivitySummary(next) });
        return next;
      });
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
              <span className="block">Track processing, publishing,</span>
              <span className="block">and failures for your RSS feeds.</span>
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

      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-gray-900 dark:text-white text-lg">Editorial Brain Monitoring</h2>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Review shadow disagreements and compare promoted vs non-promoted image/caption decisions.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportEditorialRows('json')}
              className="h-9 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
            >
              Export JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportEditorialRows('csv')}
              className="h-9 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
            >
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            { label: 'Shadow Items', value: editorialCalibrationSummary.overview.shadowItems },
            { label: 'Reviewed', value: editorialCalibrationSummary.overview.reviewedItems },
            { label: 'Brain Better', value: editorialCalibrationSummary.overview.brainBetter },
            { label: 'Promoted', value: editorialPromotionSummary.overview.promotedItems },
            { label: 'Image Promoted', value: editorialPromotionSummary.overview.imagePromotedItems },
            { label: 'Caption Promoted', value: editorialPromotionSummary.overview.captionPromotedItems },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]"
            >
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{card.label}</p>
              <p className="mt-1 text-xl text-gray-900 dark:text-white">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Source
            <select
              value={editorialFilters.source || 'all'}
              onChange={(event) => setEditorialFilters((current) => ({ ...current, source: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-[#333333] dark:bg-[#050505] dark:text-white"
            >
              <option value="all">All sources</option>
              {editorialSourceOptions.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Disagreement
            <select
              value={editorialFilters.disagreement || 'all'}
              onChange={(event) => setEditorialFilters((current) => ({ ...current, disagreement: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-[#333333] dark:bg-[#050505] dark:text-white"
            >
              <option value="all">All buckets</option>
              <option value="canonical_disagreement">Canonical</option>
              <option value="lane_disagreement">Lane</option>
              <option value="image_strategy_disagreement">Image strategy</option>
              <option value="caption_strategy_disagreement">Caption strategy</option>
              <option value="spoiler_risk_disagreement">Spoiler risk</option>
              <option value="event_disagreement">Event</option>
            </select>
          </label>
          <label className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Reviewed
            <select
              value={editorialFilters.reviewed || 'all'}
              onChange={(event) => setEditorialFilters((current) => ({ ...current, reviewed: event.target.value as EditorialBrainReviewFilters['reviewed'] }))}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-[#333333] dark:bg-[#050505] dark:text-white"
            >
              <option value="all">All</option>
              <option value="reviewed">Reviewed</option>
              <option value="unreviewed">Unreviewed</option>
            </select>
          </label>
          <label className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Confidence
            <select
              value={editorialFilters.confidence || 'all'}
              onChange={(event) => setEditorialFilters((current) => ({ ...current, confidence: event.target.value as EditorialBrainReviewFilters['confidence'] }))}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-[#333333] dark:bg-[#050505] dark:text-white"
            >
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Promotion
            <select
              value={editorialFilters.promotion || 'all'}
              onChange={(event) => setEditorialFilters((current) => ({ ...current, promotion: event.target.value as EditorialBrainReviewFilters['promotion'] }))}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-[#333333] dark:bg-[#050505] dark:text-white"
            >
              <option value="all">All</option>
              <option value="promoted">Any promoted</option>
              <option value="unpromoted">Unpromoted</option>
              <option value="image">Image promoted</option>
              <option value="caption">Caption promoted</option>
              <option value="both">Both promoted</option>
            </select>
          </label>
          <label className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Outcome
            <select
              value={editorialFilters.publishOutcome || 'all'}
              onChange={(event) => setEditorialFilters((current) => ({ ...current, publishOutcome: event.target.value as EditorialBrainReviewFilters['publishOutcome'] }))}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-[#333333] dark:bg-[#050505] dark:text-white"
            >
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="filtered">Filtered</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
            <p className="mb-2 text-sm text-gray-900 dark:text-white">Top promoted sources</p>
            <div className="space-y-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              {editorialPromotionSummary.bySource.slice(0, 5).map((entry) => (
                <div key={entry.source} className="flex items-center justify-between gap-3">
                  <span className="truncate">{entry.source}</span>
                  <span>{entry.promotedItems} promoted</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
            <p className="mb-2 text-sm text-gray-900 dark:text-white">Top disagreement buckets</p>
            <div className="space-y-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              {editorialCalibrationSummary.byBucket.slice(0, 5).map((entry) => (
                <div key={entry.disagreement} className="flex items-center justify-between gap-3">
                  <span className="truncate">{entry.disagreement.replace(/_/g, ' ')}</span>
                  <span>{entry.shadowItems}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
            <p className="mb-2 text-sm text-gray-900 dark:text-white">Promoted confidence</p>
            <div className="space-y-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              {editorialPromotionSummary.byConfidence.map((entry) => (
                <div key={entry.confidence} className="flex items-center justify-between gap-3">
                  <span className="capitalize">{entry.confidence}</span>
                  <span>{entry.promotedItems}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
            <p className="mb-2 text-sm text-gray-900 dark:text-white">Promoted failure codes</p>
            <div className="space-y-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              {editorialPromotionSummary.byFailureCode.slice(0, 5).map((entry) => (
                <div key={entry.failureCode} className="flex items-center justify-between gap-3">
                  <span className="truncate">{entry.failureCode}</span>
                  <span>{entry.count}</span>
                </div>
              ))}
              {editorialPromotionSummary.byFailureCode.length === 0 && <p>No promoted failures recorded yet.</p>}
            </div>
          </div>
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
            filteredItems.map(({ item, derivedStatus, platformStates, retryablePlatforms, publishSummary }) => {
              const statusConfig = getStatusConfig(derivedStatus);
              const StatusIcon = statusConfig.icon;
              const finalImageUrls = Array.isArray(item.imageUrls) && item.imageUrls.length > 0
                ? item.imageUrls
                : (item.imageUrl ? [item.imageUrl] : []);
              const primaryImageUrl = finalImageUrls[0];
              const imageSourceLabel = formatImageSource(item.imageSource);
              const selectionConfidenceLabel = formatSelectionConfidence(item.imageSelectionConfidence);
              const selectedImagesByUrl = new Map((item.selectedImages || []).map((image) => [image.url, image]));
              const publishedAdditionalImages = finalImageUrls
                .slice(1)
                .map((url) => selectedImagesByUrl.get(url) || {
                  url,
                  reason: 'Additional selected image',
                  source: item.imageSource || 'feed',
                  score: undefined,
                });
              const unusedAlternateImages = (item.selectedImages || []).filter((image) => !finalImageUrls.includes(image.url));

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
                    className="w-full text-left p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] transition-all duration-200"
                    deleteLabel="Delete"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-gray-900 dark:text-white mb-1 text-[15px] leading-6 sm:text-base">{item.title}</p>
                          <div className="flex items-center gap-2 text-sm text-[#6B7280] dark:text-[#9CA3AF] flex-wrap">
                            <span className="truncate max-w-[180px] sm:max-w-none">{item.feedName}</span>
                            <span>&bull;</span>
                            <span>{formatActivityTimestamp(item.timestamp)}</span>
                            {publishSummary && (
                              <>
                                <span>&bull;</span>
                                <span>{publishSummary}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-start">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${statusConfig.bg} ${statusConfig.color}`}>
                            <StatusIcon className="w-4 h-4" />
                            {statusConfig.label}
                          </span>
                          {!selection.selectionMode && retryablePlatforms.length > 0 && item.feedId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(event) => handleRetry(event, item)}
                              disabled={retryingItemId === item.id}
                              className="h-9 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
                            >
                              {retryingItemId === item.id ? 'Retrying...' : getRetryFailedLabel(retryablePlatforms.length)}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0">
                        {primaryImageUrl && (
                          <div className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-[#333333] dark:bg-[#050505]">
                            <OptimizedImage
                              src={primaryImageUrl}
                              alt={item.title}
                              className="h-48 w-full sm:h-44"
                            />
                          </div>
                        )}
                        {(imageSourceLabel || item.imageReason || selectionConfidenceLabel || typeof item.imageScore === 'number' || finalImageUrls.length > 1) && (
                          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                            {imageSourceLabel && (
                              <span className="rounded bg-gray-200 px-2 py-1 text-gray-700 dark:bg-[#1F1F1F] dark:text-[#D1D5DB]">
                                {imageSourceLabel}
                              </span>
                            )}
                            {selectionConfidenceLabel && (
                              <span className="rounded bg-gray-200 px-2 py-1 text-gray-700 dark:bg-[#1F1F1F] dark:text-[#D1D5DB]">
                                {selectionConfidenceLabel}
                              </span>
                            )}
                            {typeof item.imageScore === 'number' && (
                              <span className="rounded bg-gray-200 px-2 py-1 text-gray-700 dark:bg-[#1F1F1F] dark:text-[#D1D5DB]">
                                Score {Math.round(item.imageScore)}
                              </span>
                            )}
                            {finalImageUrls.length > 1 && (
                              <span className="rounded bg-gray-200 px-2 py-1 text-gray-700 dark:bg-[#1F1F1F] dark:text-[#D1D5DB]">
                                {finalImageUrls.length}-image post
                              </span>
                            )}
                            {item.imageReason && <span>{item.imageReason}</span>}
                          </div>
                        )}
                        {publishedAdditionalImages.length > 0 && (
                          <div className="mb-3">
                            <p className="mb-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">Additional selected images</p>
                            <div className="grid grid-cols-2 gap-2">
                              {publishedAdditionalImages.slice(0, 2).map((image) => (
                                <div
                                  key={image.url}
                                  className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-[#333333] dark:bg-[#050505]"
                                >
                                  <OptimizedImage
                                    src={image.url}
                                    alt={image.reason}
                                    className="h-24 w-full"
                                  />
                                  <div className="p-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                                    <p className="line-clamp-2">{image.reason}</p>
                                    {typeof image.score === 'number' && (
                                      <p className="mt-1">Score {Math.round(image.score)}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {publishedAdditionalImages.length === 0 && unusedAlternateImages.length > 0 && (
                          <div className="mb-3">
                            <p className="mb-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">Unused alternates</p>
                            <div className="grid grid-cols-2 gap-2">
                              {unusedAlternateImages.slice(0, 2).map((image) => (
                                <div
                                  key={image.url}
                                  className="overflow-hidden rounded-lg border border-dashed border-gray-200 bg-gray-50 opacity-80 dark:border-[#333333] dark:bg-[#050505]"
                                >
                                  <OptimizedImage
                                    src={image.url}
                                    alt={image.reason}
                                    className="h-24 w-full"
                                  />
                                  <div className="p-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                                    <p className="line-clamp-2">{image.reason}</p>
                                    {typeof image.score === 'number' && (
                                      <p className="mt-1">Score {Math.round(image.score)}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {item.description ? (
                          <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-[#6B7280] dark:border-[#333333] dark:bg-[#050505] dark:text-[#9CA3AF]">
                            <p className="line-clamp-3">{item.description}</p>
                          </div>
                        ) : item.contentHtml ? (
                          <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-[#6B7280] dark:border-[#333333] dark:bg-[#050505] dark:text-[#9CA3AF]">
                            <p className="line-clamp-3">{stripHtml(item.contentHtml)}</p>
                          </div>
                        ) : null}
                        {platformStates.length > 0 && (
                          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            {platformStates.map((platformState) => (
                              <a
                                key={platformState.platform}
                                href={platformState.url}
                                target={platformState.url ? '_blank' : undefined}
                                rel={platformState.url ? 'noopener noreferrer' : undefined}
                                className={`text-xs px-2 py-1 rounded ${
                                  platformState.status === 'posted'
                                    ? 'bg-gray-200 dark:bg-[#1F1F1F] text-gray-700 dark:text-[#D1D5DB]'
                                    : platformState.status === 'failed'
                                      ? 'bg-[#FEE2E2] text-[#B91C1C] dark:bg-[#991B1B]/30 dark:text-[#FCA5A5]'
                                      : 'bg-gray-200 dark:bg-[#1F1F1F] text-gray-700 dark:text-[#9CA3AF]'
                                } ${platformState.url ? 'underline decoration-transparent hover:decoration-current underline-offset-2' : ''}`}
                                onClick={(event) => {
                                  if (!platformState.url) {
                                    event.preventDefault();
                                  }
                                }}
                              >
                                {platformState.status === 'posted'
                                  ? platformState.label
                                  : platformState.status === 'failed'
                                    ? `${platformState.label} failed`
                                    : `${platformState.label} publishing`}
                              </a>
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
                        {item.editorialBrain && (
                          <RSSEditorialBrainReviewPanel
                            item={item}
                            isSaving={savingReviewItemId === item.id}
                            onReview={(outcome) => handleEditorialReview(item, outcome)}
                          />
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
