import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  RefreshCw,
  MoreVertical,
  AlertTriangle,
} from 'lucide-react';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { useTMDbPosts, type TMDbPost } from '../contexts/TMDbPostsContext';
import { useChatInputKeyHandler } from '../contexts/KeyboardContext';
import { useSettings } from '../contexts/SettingsContext';
import { SwipeableActivityCard } from './SwipeableActivityCard';
import { useUndo } from './UndoContext';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { DatePicker } from './ui/date-picker';
import { TimePicker } from './ui/time-picker';
import {
  BottomSheet,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetBody,
  BottomSheetFooter
} from './ui/bottom-sheet';

const DASHBOARD_TMDB_ACTIVITY_TARGET_STORAGE_KEY = 'screndly_dashboard_tmdb_activity_target';
import { ChangeImageBottomSheet } from './tmdb/ChangeImageBottomSheet';
import { generateTMDbCaption as generateTMDbCaptionWithSettings, getFeedTypeFromSource } from '../utils/tmdbCaptionGenerator';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { ActivitySelectionToolbar } from './ActivitySelectionToolbar';
import { useTMDbAutoSync } from '../hooks/useTMDbAutoSync';
import { useTMDbModalStore } from '../stores/tmdbModalStore';
import { BackIconButton } from './BackIconButton';
import { TMDbLogoSurface } from './tmdb/TMDbLogoSurface';
import {
  getTMDbImageBadgeLabel,
  resolveTMDbPreviewAsset,
  type TMDbFeedImageStyle,
  type TMDbImageAssetType,
} from '../lib/tmdb/feedImageSelection';
import {
  deriveTMDbActivityStatus,
  deriveTMDbPlatformStates,
  formatTMDbPlatformLabel,
  getRetryFailedLabel,
  getRetryableTMDbPlatforms,
  getTMDbPublishSummary,
  normalizeTMDbPlatformKey,
  type TMDbActivityDerivedStatus,
  type TMDbPlatformResultRecord,
} from '../lib/tmdb/activityStatus';
import { publishTMDbPost, toTMDbPlatformNames } from '../lib/tmdb/tmdbPublish';
import { formatTMDbReasonLabel } from '../lib/tmdb/reasonLabels';

interface TMDbActivityItem {
  id: string;
  title: string;
  mediaType: 'movie' | 'tv';
  source: 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary';
  status: 'queued' | 'published' | 'failed' | 'scheduled' | 'dispatched' | 'unscheduled' | 'skipped';
  timestamp: string;
  platforms?: string[];
  platformPostIds?: Record<string, string>;
  platformResults?: TMDbPlatformResultRecord[];
  error?: string;
  errorMessage?: string;
  imageUrl?: string;
  imageUrls?: string[];
  scheduledDate?: string;
  scheduledTime?: string;
  caption?: string;
  imageType?: TMDbImageAssetType;
  imageTypes?: TMDbImageAssetType[];
  imageStyle?: TMDbFeedImageStyle;
  year?: number;
  releaseDate?: string;
  cast?: string[];
}

interface TMDbActivityViewModel {
  item: TMDbActivityItem;
  derivedStatus: TMDbActivityDerivedStatus;
  retryablePlatforms: ReturnType<typeof getRetryableTMDbPlatforms>;
  publishSummary: string | null;
  platformStates: ReturnType<typeof deriveTMDbPlatformStates>;
}

interface TMDbActivityPageProps {
  onNavigate: (page: string) => void;
  previousPage?: string | null;
}

function getActivityTimestamp(post: TMDbPost): string {
  if (post.status === 'published') {
    return post.publishedTime || post.updatedAt || post.createdAt || post.scheduledTime;
  }

  if (post.status === 'failed') {
    return post.updatedAt || post.createdAt || post.scheduledTime || post.publishedTime || new Date().toISOString();
  }

  if (post.status === 'scheduled') {
    return post.scheduledTime || post.updatedAt || post.createdAt || new Date().toISOString();
  }

  if (post.status === 'dispatched') {
    return post.dispatchedAt || post.updatedAt || post.createdAt || post.scheduledTime || new Date().toISOString();
  }

  return post.updatedAt || post.createdAt || post.scheduledTime || post.publishedTime || new Date().toISOString();
}

function formatActivityTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);

  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }

  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function TMDbActivityPage({ onNavigate, previousPage }: TMDbActivityPageProps) {
  const { posts, fetchPosts, reschedulePost, deletePost, updatePost, addPost } = useTMDbPosts();
  const { settings } = useSettings();
  const { showUndo } = useUndo();
  const openImagePreview = useTMDbModalStore(s => s.openImagePreview);
  const openPlatformSelect = useTMDbModalStore(s => s.openPlatformSelect);
  const rememberedPreviewImageIndexes = useTMDbModalStore(s => s.rememberedPreviewImageIndexes);
  const [filter, setFilter] = useState<'all' | 'failures' | 'published' | 'pending' | 'scheduled'>('all');
  const [isChangeDateOpen, setIsChangeDateOpen] = useState(false);
  const [isChangeTimeOpen, setIsChangeTimeOpen] = useState(false);
  const [isChangeDatePickerOpen, setIsChangeDatePickerOpen] = useState(false);
  const [isChangeTimePickerOpen, setIsChangeTimePickerOpen] = useState(false);
  const [isEditCaptionOpen, setIsEditCaptionOpen] = useState(false);
  const [isChangeImageOpen, setIsChangeImageOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState('');
  const [editedCaption, setEditedCaption] = useState('');
  const [openMenuItemId, setOpenMenuItemId] = useState<string | null>(null);
  const [retryingItemId, setRetryingItemId] = useState<string | null>(null);
  const pendingMenuActionRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pendingMenuActionRef.current !== null) {
        window.clearTimeout(pendingMenuActionRef.current);
      }
    };
  }, []);

  useTMDbAutoSync(fetchPosts);

  const tmdbPreferenceOverrides = useMemo(() => {
    try {
      const raw = window.localStorage.getItem('screndly_tmdb_settings');
      return raw ? JSON.parse(raw) as Record<string, any> : {};
    } catch {
      return {};
    }
  }, []);

  const retentionHours = Number(tmdbPreferenceOverrides.tmdbActivityRetention ?? settings.tmdbActivityRetention ?? 24);
  const retentionMs = retentionHours * 60 * 60 * 1000; // Convert to milliseconds
  const logLevel = String(tmdbPreferenceOverrides.tmdbLogLevel ?? settings.tmdbLogLevel ?? 'standard');
  const activityItems = useMemo<TMDbActivityItem[]>(
    () =>
      posts.map((post) => ({
        ...post,
        timestamp: getActivityTimestamp(post),
        error: formatTMDbReasonLabel(post.errorMessage || post.unscheduledReason),
        errorMessage: formatTMDbReasonLabel(post.errorMessage || post.unscheduledReason),
      })),
    [posts]
  );

  const activityViewModels = useMemo<TMDbActivityViewModel[]>(
    () =>
      activityItems.map((item) => {
        const platformStates = deriveTMDbPlatformStates(item);
        const derivedStatus = deriveTMDbActivityStatus(item, platformStates);

        return {
          item,
          derivedStatus,
          platformStates,
          retryablePlatforms: getRetryableTMDbPlatforms(platformStates),
          publishSummary: getTMDbPublishSummary(platformStates),
        };
      }),
    [activityItems]
  );

  // Helper function to check if an item should be filtered based on retention
  const shouldKeepItem = (item: TMDbActivityItem): boolean => {
    // Always keep scheduled and queued items regardless of age
    if (item.status === 'scheduled' || item.status === 'queued') {
      return true;
    }

    // For published and failed items, check retention period
    if (item.status === 'published' || item.status === 'failed') {
      try {
        const itemDate = new Date(item.timestamp);
        if (Number.isNaN(itemDate.getTime())) {
          return true;
        }

        const now = new Date();
        const ageMs = now.getTime() - itemDate.getTime();
        return ageMs <= retentionMs;
      } catch (error) {
        // If parsing fails, keep the item
        return true;
      }
    }

    return true;
  };

  const logLevelItems = activityViewModels
    .filter(({ item }) => shouldKeepItem(item))
    .filter(({ derivedStatus }) => {
      if (derivedStatus === 'publishing' || derivedStatus === 'scheduled' || derivedStatus === 'failed' || derivedStatus === 'partial_failed') {
        return true;
      }

      if (logLevel === 'minimal') return false;
      if (logLevel === 'standard') return derivedStatus === 'published';
      return true;
    });

  const visibleItems = logLevelItems;

  // Filter posts by retention period first, then by log level, then by status filter
  const filteredItems = visibleItems
    .filter(({ derivedStatus }) => {
      if (filter === 'failures') return derivedStatus === 'failed' || derivedStatus === 'partial_failed';
      if (filter === 'published') return derivedStatus === 'published';
      if (filter === 'pending') return derivedStatus === 'publishing';
      if (filter === 'scheduled') return derivedStatus === 'scheduled';
      return true;
    });

  useEffect(() => {
    const targetItemId = window.localStorage.getItem(DASHBOARD_TMDB_ACTIVITY_TARGET_STORAGE_KEY);
    if (!targetItemId || !filteredItems.some(({ item }) => item.id === targetItemId)) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const targetElement = document.getElementById(`tmdb-activity-card-${targetItemId}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      window.localStorage.removeItem(DASHBOARD_TMDB_ACTIVITY_TARGET_STORAGE_KEY);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [filteredItems]);
  const selection = useBulkSelection(filteredItems.map(({ item }) => item.id));

  const generateTmdbCaption = async (post: Pick<TMDbPost, 'title' | 'mediaType' | 'releaseDate' | 'cast' | 'year' | 'platforms' | 'source'>) => {
    const result = await generateTMDbCaptionWithSettings({
      title: post.title,
      mediaType: post.mediaType,
      releaseDate: post.releaseDate || new Date().toISOString(),
      cast: post.cast || [],
      year: post.year,
      platforms: post.platforms,
    }, getFeedTypeFromSource(post.source), { forceFresh: true });

    return result.caption;
  };

  const getStatusConfig = (status: TMDbActivityDerivedStatus) => {
    switch (status) {
      case 'publishing':
        return { icon: Clock, color: 'text-gray-700 dark:text-[#9CA3AF]', bg: 'bg-gray-200 dark:bg-[#1f1f1f]', label: 'Publishing' };
      case 'published':
        return { icon: CheckCircle, color: 'text-gray-700 dark:text-[#9CA3AF]', bg: 'bg-gray-200 dark:bg-[#1f1f1f]', label: 'Published' };
      case 'partial_failed':
        return { icon: AlertTriangle, color: 'text-[#D97706]', bg: 'bg-[#FEF3C7] dark:bg-[#78350F]', label: 'Partially Failed' };
      case 'failed':
        return { icon: XCircle, color: 'text-[#EF4444]', bg: 'bg-[#FEE2E2] dark:bg-[#991B1B]', label: 'Failed' };
      case 'scheduled':
        return { icon: Calendar, color: 'text-gray-700 dark:text-[#9CA3AF]', bg: 'bg-gray-200 dark:bg-[#1f1f1f]', label: 'Scheduled' };
      default:
        return { icon: Clock, color: 'text-gray-700 dark:text-[#9CA3AF]', bg: 'bg-gray-200 dark:bg-[#1f1f1f]', label: 'Publishing' };
    }
  };

  const getSourceLabel = (source: TMDbActivityItem['source']) => {
    switch (source) {
      case 'tmdb_today':
        return 'Today';
      case 'tmdb_weekly':
        return 'Weekly';
      case 'tmdb_monthly':
        return 'Monthly';
      case 'tmdb_anniversary':
        return 'Anniversary';
    }
  };

  const handleRetry = async (e: React.MouseEvent, item: TMDbActivityItem) => {
    e.stopPropagation();
    haptics.medium();

    const retryablePlatforms = getRetryableTMDbPlatforms(deriveTMDbPlatformStates(item)).map((platform) => platform.platform);
    if (retryablePlatforms.length === 0) {
      toast.info('No failed platforms to retry');
      return;
    }

    const retryPlatformNames = toTMDbPlatformNames(retryablePlatforms);
    const retryingAt = new Date().toISOString();
    const optimisticResults = (item.platformResults || []).map((result) => {
      const platformKey = normalizeTMDbPlatformKey(result.platform);
      if (!retryablePlatforms.includes(platformKey)) {
        return result;
      }

      return {
        ...result,
        platform: formatTMDbPlatformLabel(platformKey),
        status: 'retrying' as const,
        error: undefined,
        lastAttemptAt: retryingAt,
        retryCount: (result.retryCount || 0) + 1,
      };
    });

    setRetryingItemId(item.id);

    try {
      await updatePost(item.id, {
        status: 'queued',
        platformResults: optimisticResults,
        errorMessage: undefined,
      });

      const publishResult = await publishTMDbPost(item, retryablePlatforms);
      const mergedResultsMap = new Map(
        (item.platformResults || []).map((result) => [normalizeTMDbPlatformKey(result.platform), result] as const)
      );
      const platformPostIds: Record<string, string> = { ...(item.platformPostIds || {}) };

      publishResult.platformResults.forEach((result) => {
        const platformKey = normalizeTMDbPlatformKey(result.platform);
        const previous = mergedResultsMap.get(platformKey);

        mergedResultsMap.set(platformKey, {
          ...previous,
          ...result,
          platform: formatTMDbPlatformLabel(platformKey),
          lastAttemptAt: retryingAt,
          retryCount: (previous?.retryCount || 0) + 1,
        });

        if (result.status === 'posted' && result.id) {
          platformPostIds[platformKey] = result.id;
        }
      });

      const mergedPlatforms = Array.from(new Set([...(item.platforms || []), ...retryPlatformNames]));
      const platformResults = Array.from(mergedResultsMap.values());
      const platformStates = deriveTMDbPlatformStates({
        ...item,
        platforms: mergedPlatforms,
        platformPostIds,
        platformResults,
      });
      const derivedStatus = deriveTMDbActivityStatus(
        {
          ...item,
          platforms: mergedPlatforms,
          platformPostIds,
          platformResults,
        },
        platformStates
      );
      const latestPublishedAt = platformStates
        .filter((state) => state.status === 'posted')
        .map((state) => state.publishedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1);
      const failedStates = platformStates.filter((state) => state.status === 'failed');
      const persistedStatus: TMDbPost['status'] =
        derivedStatus === 'published'
          ? 'published'
          : derivedStatus === 'publishing'
            ? 'queued'
            : derivedStatus === 'scheduled'
              ? 'scheduled'
              : 'failed';

      await updatePost(item.id, {
        status: persistedStatus,
        platforms: mergedPlatforms,
        platformPostIds,
        platformResults,
        publishedTime: latestPublishedAt,
        errorMessage: failedStates.length > 0
          ? failedStates.map((state) => `${state.label}: ${state.errorMessage || 'Publish failed'}`).join('; ')
          : undefined,
      });
      await fetchPosts({ silent: true });

      toast.success('Retry complete', {
        description: derivedStatus === 'published'
          ? `Published "${item.title}" on ${publishResult.postedPlatforms.join(', ')}.`
          : failedStates.length > 0
            ? `Retried ${item.title}. Remaining failures: ${failedStates.map((state) => state.label).join(', ')}.`
            : `Retried "${item.title}".`,
      });
    } catch (error) {
      console.error('Failed to retry TMDb item:', error);
      toast.error('Failed to retry TMDb feed');
      await fetchPosts({ silent: true });
    } finally {
      setRetryingItemId(null);
    }
  };

  const handleOpenPublishSheet = (id: string) => {
    haptics.medium();

    const selectedPost = posts.find((post) => post.id === id);
    if (!selectedPost) {
      toast.error('TMDb post not found');
      return;
    }

    openPlatformSelect(selectedPost, 'publish');
  };

  const handleDelete = (id: string, title: string) => {
    haptics.medium();

    // Find the post to delete
    const deletedPost = posts.find(post => post.id === id);
    if (!deletedPost) return;

    // Temporarily remove from state
    deletePost(id);

    // Show undo toast
    showUndo({
      id,
      itemName: title,
      onUndo: () => {
        // Restore the post
        addPost(deletedPost);
      },
      onConfirm: () => {
        // Show final confirmation
        toast.success('Deleted', {
          description: `\"${title}\" has been removed`,
        });
      }
    });
  };

  const handleDeleteSelected = async () => {
    if (selection.selectedCount === 0) return;

    haptics.medium();
    setIsDeletingSelected(true);

    try {
      await Promise.all(selection.selectedIds.map((id) => deletePost(id)));
      toast.success(`${selection.selectedCount} TMDb activity item${selection.selectedCount === 1 ? '' : 's'} deleted`);
      selection.clearSelection();
    } catch (error) {
      console.error('Failed to bulk delete TMDb activity:', error);
      toast.error('Failed to delete selected TMDb activity');
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const handleChangeScheduleDate = (id: string, _title: string) => {
    haptics.light();
    setSelectedItemId(id);

    // Initialize with current scheduled date
    const selectedPost = posts.find(p => p.id === id);
    if (selectedPost && selectedPost.scheduledTime) {
      setSelectedDate(new Date(selectedPost.scheduledTime));
    }

    setIsChangeDateOpen(true);
  };

  const handleChangeScheduleTime = (id: string, _title: string) => {
    haptics.light();
    setSelectedItemId(id);

    // Initialize with current scheduled time
    const selectedPost = posts.find(p => p.id === id);
    if (selectedPost && selectedPost.scheduledTime) {
      const currentTime = new Date(selectedPost.scheduledTime);
      const hours = currentTime.getHours().toString().padStart(2, '0');
      const minutes = currentTime.getMinutes().toString().padStart(2, '0');
      setSelectedTime(`${hours}:${minutes}`);
    }

    setIsChangeTimeOpen(true);
  };

  const closeMenuThen = (action: () => void) => {
    setOpenMenuItemId(null);

    if (pendingMenuActionRef.current !== null) {
      window.clearTimeout(pendingMenuActionRef.current);
    }

    pendingMenuActionRef.current = window.setTimeout(() => {
      pendingMenuActionRef.current = null;
      action();
    }, 220);
  };

  const handleSaveSchedule = () => {
    if (!selectedItemId) return;

    if (selectedDate && !selectedTime) {
      // Only date changed - preserve the existing time
      const selectedPost = posts.find(p => p.id === selectedItemId);
      if (selectedPost) {
        const existingDate = new Date(selectedPost.scheduledTime);
        const hours = existingDate.getHours().toString().padStart(2, '0');
        const minutes = existingDate.getMinutes().toString().padStart(2, '0');
        const newScheduledTime = new Date(`${selectedDate.toISOString().split('T')[0]}T${hours}:${minutes}:00`).toISOString();
        reschedulePost(selectedItemId, newScheduledTime);
        toast.success('Schedule Updated');
      }
    } else if (selectedTime && selectedDate) {
      // Both date and time changed
      const newScheduledTime = new Date(`${selectedDate.toISOString().split('T')[0]}T${selectedTime}:00`).toISOString();
      reschedulePost(selectedItemId, newScheduledTime);
      toast.success('Schedule Updated');
    } else if (selectedTime) {
      // Only time changed - use the existing date
      const selectedPost = posts.find(p => p.id === selectedItemId);
      if (selectedPost) {
        const existingDate = new Date(selectedPost.scheduledTime);
        const newScheduledTime = new Date(`${existingDate.toISOString().split('T')[0]}T${selectedTime}:00`).toISOString();
        reschedulePost(selectedItemId, newScheduledTime);
        toast.success('Schedule Updated');
      }
    }

    setIsChangeDateOpen(false);
    setIsChangeTimeOpen(false);
    haptics.success();
  };

  const handleEditCaption = (id: string, _title: string) => {
    haptics.light();
    setSelectedItemId(id);
    const selectedPost = posts.find(p => p.id === id);
    if (selectedPost) {
      setEditedCaption(selectedPost.caption);
    }
    setIsEditCaptionOpen(true);
  };

  const handleSaveCaption = () => {
    if (!selectedItemId) return;
    if (editedCaption.trim().length === 0) {
      toast.error('Caption cannot be empty');
      return;
    }
    if (editedCaption.length > 200) {
      toast.error('Caption too long (max 200 characters)');
      return;
    }
    updatePost(selectedItemId, { caption: editedCaption });
    haptics.success();
    toast.success('Caption Updated');
    setIsEditCaptionOpen(false);
  };

  const handleChangeImage = (id: string, _title: string) => {
    haptics.light();
    setSelectedItemId(id);
    setIsChangeImageOpen(true);
  };

  const handleEditPlatforms = (id: string) => {
    const selectedPost = posts.find((post) => post.id === id);
    if (!selectedPost) {
      toast.error('Unable to load platform settings for this post');
      return;
    }

    haptics.light();
    openPlatformSelect(selectedPost, 'update-platforms');
  };

  const handleImagePreview = (id: string) => {
    if (selection.selectionMode) return;

    const selectedPost = posts.find((post) => post.id === id);
    if (!selectedPost?.imageUrl) return;

    haptics.light();
    openImagePreview(selectedPost, rememberedPreviewImageIndexes[id] ?? 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start gap-4 mb-4">
          <BackIconButton
            onClick={() => onNavigate(previousPage || 'tmdb')}
            className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
          />
          <div className="flex-1">
            <h1 className="text-gray-900 dark:text-white mb-2">TMDb Feeds Activity</h1>
            <p className="text-gray-600 dark:text-[#9CA3AF]">
              Track all TMDb feed processing status
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-4">
        {/* Total Posts - Full Width */}
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Total Posts</p>
          <p className="text-gray-900 dark:text-white text-2xl">{visibleItems.length}</p>
        </div>

        {/* 2x2 Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5">
            <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Published</p>
            <p className="text-gray-900 dark:text-white text-2xl">
              {visibleItems.filter(({ derivedStatus }) => derivedStatus === 'published').length}
            </p>
          </div>
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5">
            <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Scheduled</p>
            <p className="text-gray-900 dark:text-white text-2xl">
              {visibleItems.filter(({ derivedStatus }) => derivedStatus === 'scheduled').length}
            </p>
          </div>
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5">
            <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Pending</p>
            <p className="text-gray-900 dark:text-white text-2xl">
              {visibleItems.filter(({ derivedStatus }) => derivedStatus === 'publishing').length}
            </p>
          </div>
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5">
            <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Failures</p>
            <p className="text-gray-900 dark:text-white text-2xl">
              {visibleItems.filter(({ derivedStatus }) => derivedStatus === 'failed' || derivedStatus === 'partial_failed').length}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => {
              haptics.light();
              setFilter('all');
            }}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filter === 'all'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            All Activity
          </button>
          <button
            onClick={() => {
              haptics.light();
              setFilter('published');
            }}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filter === 'published'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            Published
          </button>
          <button
            onClick={() => {
              haptics.light();
              setFilter('scheduled');
            }}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filter === 'scheduled'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            Scheduled
          </button>
          <button
            onClick={() => {
              haptics.light();
              setFilter('pending');
            }}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filter === 'pending'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            Pending
          </button>
          <button
            onClick={() => {
              haptics.light();
              setFilter('failures');
            }}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filter === 'failures'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            Failures
          </button>
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-3">
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
        {filteredItems.length > 0 ? (
          filteredItems.map(({ item, derivedStatus, retryablePlatforms, publishSummary, platformStates }) => {
            const statusConfig = getStatusConfig(derivedStatus);
            const StatusIcon = statusConfig.icon;
            const imageCount = Array.isArray(item.imageUrls) && item.imageUrls.length > 0 ? item.imageUrls.length : 1;
            const previewAsset = resolveTMDbPreviewAsset(
              item.imageUrl,
              item.imageType,
              item.imageUrls,
              item.imageTypes,
              rememberedPreviewImageIndexes[item.id] ?? 0,
            );
            const cardPreviewImageUrl = previewAsset.url;
            const useSquareLogoThumbnail = previewAsset.useSquareLogoThumbnail;

            return (
              <div id={`tmdb-activity-card-${item.id}`} key={item.id}>
                <SwipeableActivityCard
                  id={item.id}
                  onDelete={(id) => handleDelete(id ?? item.id, item.title)}
                  isScheduled={derivedStatus === 'scheduled'}
                  selectionMode={selection.selectionMode}
                  selected={selection.isSelected(item.id)}
                  onEnterSelectionMode={selection.enterSelectionMode}
                  onToggleSelection={selection.toggleSelection}
                  className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200"
                >
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  {cardPreviewImageUrl && (
                    <button
                      type="button"
                      data-prevent-card-selection="true"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleImagePreview(item.id);
                      }}
                      className="relative w-20 h-28 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-[#1A1A1A] transition-opacity hover:opacity-90"
                      aria-label={`Expand ${getTMDbImageBadgeLabel(item.imageType, item.imageTypes)} for ${item.title}`}
                    >
                      {useSquareLogoThumbnail ? (
                        <TMDbLogoSurface
                          src={cardPreviewImageUrl}
                          alt={`${item.title} logo`}
                          className="border-0"
                          paddingClassName="p-2"
                        />
                      ) : (
                        <img
                          src={cardPreviewImageUrl}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <div className="absolute bottom-2 right-2 min-w-7 rounded-full bg-black/80 px-2 py-1 text-center text-xs font-medium text-white">
                        {imageCount}
                      </div>
                    </button>
                  )}

                  <div className="flex-1 min-w-0 flex flex-col">
                    {/* Header Row */}
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="mb-2 break-words text-gray-900 dark:text-white">{item.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-black dark:bg-white text-white dark:text-black">
                            {item.mediaType === 'movie' ? 'Movie' : 'TV'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#ec1e24] text-white">
                            {getSourceLabel(item.source)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-[#9CA3AF]">{formatActivityTimestamp(item.timestamp)}</span>
                      </div>

                      {/* Status Badge and Retry Button */}
                      <div className="flex flex-col gap-2 self-start sm:items-end">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusConfig.bg} flex-shrink-0`}>
                          {derivedStatus !== 'scheduled' && derivedStatus !== 'published' && <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />}
                          <span className={`text-sm ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Platforms */}
                    {derivedStatus !== 'scheduled' && publishSummary && (
                      <p className="mb-2 text-xs text-gray-500 dark:text-[#9CA3AF]">{publishSummary}</p>
                    )}
                    {!selection.selectionMode && retryablePlatforms.length > 0 && (
                      <div className="mb-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleRetry(e, item)}
                          disabled={retryingItemId === item.id}
                          className="h-auto max-w-full justify-start gap-2 whitespace-normal py-2 text-left leading-tight bg-white dark:bg-black sm:w-auto"
                        >
                          {retryingItemId === item.id ? 'Retrying...' : getRetryFailedLabel(retryablePlatforms.length)}
                        </Button>
                      </div>
                    )}
                    {derivedStatus === 'scheduled' && item.platforms && item.platforms.length > 0 ? (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex flex-wrap gap-1.5">
                          {item.platforms.map((platform) => (
                            <span
                              key={platform}
                              className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-[#1F1F1F] text-gray-700 dark:text-[#9CA3AF]"
                            >
                              {platform}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : platformStates.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex flex-wrap gap-1.5">
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
                              {platformState.label}: {platformState.status === 'posted'
                                ? 'Posted'
                                : platformState.status === 'failed'
                                  ? 'Failed'
                                  : 'Publishing'}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {(item.errorMessage || item.error) && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-[#991B1B]/20 border border-red-200 dark:border-[#991B1B] rounded-lg mb-3">
                        <XCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-[#EF4444] flex-1">{item.errorMessage || item.error}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scheduled Date & Actions - Full Width Bar */}
                {item.status === 'scheduled' && item.scheduledTime && (
                  <div className="mt-4 border-t border-gray-200 pt-4 dark:border-[#333333]">
                    <div className="flex items-end justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-gray-500 dark:text-[#8A8F98]">
                          Scheduled:{' '}
                          <span className="text-gray-900 dark:text-white">
                            {new Date(item.scheduledTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {' at '}
                            {new Date(item.scheduledTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </span>
                      </div>
                    {!selection.selectionMode && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 w-9 border border-gray-200 bg-transparent p-0 shadow-none hover:bg-gray-50 dark:border-[#333333] dark:bg-transparent dark:hover:bg-[#111111]"
                          onClick={() => {
                            haptics.light();
                            setOpenMenuItemId((current) => (current === item.id ? null : item.id));
                          }}
                        >
                          <MoreVertical className="h-[14px] w-[14px] text-gray-900 dark:text-white" />
                        </Button>

                        {/* Options BottomSheet */}
                        <BottomSheet open={openMenuItemId === item.id} onOpenChange={(open) => !open && setOpenMenuItemId(null)}>
                          <BottomSheetHeader>
                            <BottomSheetTitle>Options</BottomSheetTitle>
                          </BottomSheetHeader>
                          <BottomSheetBody>
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => {
                                  closeMenuThen(() => {
                                    haptics.medium();
                                    handleOpenPublishSheet(item.id);
                                  });
                                }}
                                className="w-full py-2 px-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                              >
                                Publish
                              </button>
                              <button
                                onClick={() => {
                                  closeMenuThen(() => {
                                    haptics.light();
                                    handleEditCaption(item.id, item.title);
                                  });
                                }}
                                className="w-full py-2 px-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                              >
                                Edit Caption
                              </button>
                              <button
                                onClick={() => {
                                  closeMenuThen(() => {
                                    haptics.light();
                                    handleChangeImage(item.id, item.title);
                                  });
                                }}
                                className="w-full py-2 px-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                              >
                                Change Image
                              </button>
                              <button
                                onClick={() => {
                                  closeMenuThen(() => {
                                    haptics.light();
                                    handleEditPlatforms(item.id);
                                  });
                                }}
                                className="w-full py-2 px-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                              >
                                Edit Platforms
                              </button>
                              <button
                                onClick={() => {
                                  closeMenuThen(() => {
                                    haptics.light();
                                    handleChangeScheduleDate(item.id, item.title);
                                  });
                                }}
                                className="w-full py-2 px-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                              >
                                Change Date
                              </button>
                              <button
                                onClick={() => {
                                  closeMenuThen(() => {
                                    haptics.light();
                                    handleChangeScheduleTime(item.id, item.title);
                                  });
                                }}
                                className="w-full py-2 px-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                              >
                                Change Time
                              </button>
                            </div>
                            <div className="my-4 -mx-6 border-t border-gray-200 dark:border-[#333333]" />
                            <button
                              onClick={() => {
                                haptics.light();
                                setOpenMenuItemId(null);
                              }}
                              className="w-full mb-2 py-2 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                            >
                              Cancel
                            </button>
                          </BottomSheetBody>
                        </BottomSheet>
                      </>
                    )}
                    </div>
                  </div>
                )}
                </SwipeableActivityCard>
              </div>
            );
          })
        ) : (
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-12 text-center">
            <h3 className="text-gray-600 dark:text-[#9CA3AF] mb-2">No TMDb activity</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              {filter === 'all'
                ? 'TMDb feed activity will appear here once posts are processed.'
                : `No ${filter} TMDb feeds found.`
              }
            </p>
          </div>
        )}
      </div>

      {/* Change Date Dialog */}
      <BottomSheet
        open={isChangeDateOpen}
        onOpenChange={setIsChangeDateOpen}
        onBackRequest={() => isChangeDatePickerOpen}
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Change Schedule Date</BottomSheetTitle>
          <BottomSheetDescription>
            Select a new date for the scheduled post
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4">
            <div>
              <Label htmlFor="scheduled-date">Date</Label>
              <div className="mt-2">
                <DatePicker
                  date={selectedDate}
                  onDateChange={setSelectedDate}
                  onOpenChange={setIsChangeDatePickerOpen}
                  placeholder="Select a date"
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]"
                />
              </div>
            </div>
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#ec1e24] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-black dark:text-white">
                  Posts are automatically spaced to prevent overlap. The system will adjust if needed.
                </p>
              </div>
            </div>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <Button
            variant="outline"
            onClick={() => {
              haptics.light();
              setIsChangeDateOpen(false);
            }}
            className="bg-white dark:bg-black border-gray-200 dark:border-[#333333]"
          >
            Cancel
          </Button>
          <Button onClick={handleSaveSchedule}>
            Save Date
          </Button>
        </BottomSheetFooter>
      </BottomSheet>

      {/* Change Time Dialog */}
      <BottomSheet
        open={isChangeTimeOpen}
        onOpenChange={setIsChangeTimeOpen}
        onBackRequest={() => isChangeTimePickerOpen}
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Change Schedule Time</BottomSheetTitle>
          <BottomSheetDescription>
            Select a new time for the scheduled post
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4">
            <div>
              <Label htmlFor="scheduled-time">Time</Label>
              <div className="mt-2">
                <TimePicker
                  value={selectedTime}
                  onChange={setSelectedTime}
                  onOpenChange={setIsChangeTimePickerOpen}
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]"
                />
              </div>
            </div>
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#ec1e24] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-black dark:text-white">
                  Posts are automatically spaced to prevent overlap. The system will adjust if needed.
                </p>
              </div>
            </div>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <Button variant="outline" onClick={() => {
            haptics.light();
            setIsChangeTimeOpen(false);
          }} className="bg-white dark:bg-black border-gray-200 dark:border-[#333333]">
            Cancel
          </Button>
          <Button onClick={() => {
            haptics.light();
            handleSaveSchedule();
          }}>
            Save Time
          </Button>
        </BottomSheetFooter>
      </BottomSheet>

      {/* Edit Caption Dialog */}
      <BottomSheet open={isEditCaptionOpen} onOpenChange={setIsEditCaptionOpen}>
        <BottomSheetHeader>
          <BottomSheetTitle>Edit Caption</BottomSheetTitle>
          <BottomSheetDescription>
            Update the caption for the post
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="caption">Caption</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!selectedItemId) return;

                    haptics.light();
                    setIsRegenerating(true);

                    try {
                      const selectedPost = posts.find(p => p.id === selectedItemId);
                      if (!selectedPost) {
                        throw new Error('Unable to find selected TMDb item');
                      }

                      const newCaption = await generateTmdbCaption(selectedPost);
                      setEditedCaption(newCaption);
                      haptics.success();
                      toast.success('Caption regenerated with AI');
                    } catch (error) {
                      console.error('Failed to regenerate TMDb caption:', error);
                      toast.error('Failed to regenerate caption');
                    } finally {
                      setIsRegenerating(false);
                    }
                  }}
                  disabled={isRegenerating}
                  className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-[#111111]"
                >
                  <RefreshCw className={`w-4 h-4 text-black dark:text-white ${isRegenerating ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <div className="mt-2">
                <Textarea
                  id="caption"
                  value={editedCaption}
                  onChange={(e) => {
                    haptics.light();
                    setEditedCaption(e.target.value);
                  }}
                  onKeyDown={useChatInputKeyHandler(handleSaveCaption)}
                  onFocus={() => haptics.light()}
                  placeholder="Enter a new caption"
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]"
                  disabled={isRegenerating}
                />
              </div>
            </div>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 sm:flex-1 w-full">
            <Button
              variant="outline"
              onClick={() => {
                haptics.light();
                setIsEditCaptionOpen(false);
              }}
              className="bg-white dark:bg-black border-gray-200 dark:border-[#333333] flex-1"
              disabled={isRegenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCaption}
              disabled={isRegenerating}
              className="flex-1"
            >
              Save Caption
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      {/* Change Image Dialog */}
      {selectedItemId && posts.find(p => p.id === selectedItemId) && (
        <ChangeImageBottomSheet
          open={isChangeImageOpen}
          onOpenChange={setIsChangeImageOpen}
          title={posts.find(p => p.id === selectedItemId)?.title || ''}
          mediaType={posts.find(p => p.id === selectedItemId)?.mediaType || 'movie'}
          tmdbId={posts.find(p => p.id === selectedItemId)?.tmdbId || 0}
          currentImageUrl={posts.find(p => p.id === selectedItemId)?.imageUrl}
          currentImageUrls={posts.find(p => p.id === selectedItemId)?.imageUrls}
          currentImageType={posts.find(p => p.id === selectedItemId)?.imageType}
          currentImageTypes={posts.find(p => p.id === selectedItemId)?.imageTypes}
          onSave={async ({ imageStyle, imageUrl, imageType, imageUrls, imageTypes }) => {
            if (selectedItemId) {
              await updatePost(selectedItemId, { imageStyle, imageUrl, imageType, imageUrls, imageTypes });
            }
          }}
        />
      )}
    </div>
  );
}
