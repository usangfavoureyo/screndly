import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Film, Image as ImageIcon, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { DatePicker } from '../ui/date-picker';
import { TimePicker } from '../ui/time-picker';
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from '../ui/bottom-sheet';
import { ActivitySelectionToolbar } from '../ActivitySelectionToolbar';
import { SwipeableActivityCard } from '../SwipeableActivityCard';
import { MediaPreviewDialog } from '../media/MediaPreviewDialog';
import { useNotifications } from '../../contexts/NotificationsContext';
import { haptics } from '../../utils/haptics';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { getComposeAssetPreviewUrl } from '../../lib/create/composeMedia';
import { publishComposeItem } from '../../lib/create/composePublish';
import {
  buildComposePublishFailureNotification,
  buildComposePublishSuccessNotification,
  buildComposeScheduledNotification,
} from '../../lib/create/composeNotifications';
import { useComposeStore } from '../../store/useComposeStore';
import type { ComposeItem, ComposeMediaAsset } from '../../types/compose';
import { RedSpinner } from '../PageLoader';

interface ComposeOverviewProps {
  isCompactLayout?: boolean;
  onNavigate: (page: string, fromPage?: string) => void;
}

function formatItemMeta(item: ComposeItem): string {
  if (item.scheduledAt) {
    return `Scheduled ${new Date(item.scheduledAt).toLocaleString()}`;
  }

  return `Updated ${new Date(item.updatedAt).toLocaleString()}`;
}

function getStatusTone(status: ComposeItem['status']): string {
  switch (status) {
    case 'scheduled':
      return 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]';
    case 'published':
      return 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]';
    case 'failed':
      return 'bg-[#FEE2E2] dark:bg-[#991B1B] text-[#EF4444]';
    case 'draft':
    default:
      return 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]';
  }
}

function getLeadingIcon(status: ComposeItem['status']) {
  if (status === 'failed') return AlertTriangle;
  if (status === 'published') return CheckCircle2;
  if (status === 'scheduled') return CalendarDays;
  return FileText;
}

function getPrimaryAsset(item: ComposeItem) {
  return item.mediaAssets?.[0] ?? item.media;
}

function toIsoSchedule(date?: Date, time?: string) {
  if (!date || !time) return undefined;
  const [hours, minutes] = time.split(':').map(Number);
  const scheduled = new Date(date);
  scheduled.setHours(hours || 0, minutes || 0, 0, 0);
  return scheduled.toISOString();
}

export function ComposeOverview({ onNavigate, isCompactLayout = false }: ComposeOverviewProps) {
  const { items, setActiveItemId, deleteItem, updateStatus, saveItem } = useComposeStore();
  const { addNotification } = useNotifications();
  const ignoreNextAddPostClickRef = useRef(false);
  const addPostNavigationLockRef = useRef(0);
  const [scheduleItemId, setScheduleItemId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [previewAsset, setPreviewAsset] = useState<ComposeMediaAsset | null>(null);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [publishingIds, setPublishingIds] = useState<string[]>([]);
  const draftItems = useMemo(
    () => items.filter((item) => item.status === 'draft'),
    [items],
  );
  const selection = useBulkSelection(draftItems.map((item) => item.id));

  const stats = {
    drafts: items.filter((item) => item.status === 'draft').length,
    scheduled: items.filter((item) => item.status === 'scheduled').length,
    published: items.filter((item) => item.status === 'published').length,
    pending: items.filter((item) => item.status === 'failed').length,
  };

  const scheduleItem = useMemo(
    () => items.find((item) => item.id === scheduleItemId),
    [items, scheduleItemId],
  );

  const handleCreate = () => {
    setActiveItemId(null);
    onNavigate('compose-editor', 'create');
  };

  const triggerCreateNavigation = () => {
    const now = Date.now();
    if (now < addPostNavigationLockRef.current) {
      return;
    }

    addPostNavigationLockRef.current = now + 400;
    haptics.medium();
    handleCreate();
  };

  const handleEdit = (itemId: string) => {
    setActiveItemId(itemId);
    onNavigate('compose-editor', 'create');
  };

  const handlePublish = async (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;

    setPublishingIds((current) => [...current, itemId]);
    haptics.medium();
    try {
      const result = await publishComposeItem(item);
      const nextStatus = result.postedPlatforms.length > 0 ? 'published' : 'failed';
      const nextError =
        result.failedResults.length > 0 ? result.errorMessage || 'Some platforms failed to publish.' : undefined;

      saveItem({
        ...item,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
        error: nextError,
      });

      if (result.postedPlatforms.length > 0) {
        addNotification(
          buildComposePublishSuccessNotification(
            {
              ...item,
              status: nextStatus,
              updatedAt: new Date().toISOString(),
              error: nextError,
            },
            result,
          ),
        );
        toast.success(
          result.failedResults.length > 0
            ? `Published to ${result.postedPlatforms.join(', ')}.`
            : `Published to ${result.postedPlatforms.join(', ')}.`,
        );
        return;
      }

      addNotification(
        buildComposePublishFailureNotification(
          {
            ...item,
            status: 'failed',
            updatedAt: new Date().toISOString(),
            error: nextError,
          },
          nextError || 'Failed to publish post',
        ),
      );
      toast.error(nextError || 'Failed to publish post');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to publish post';
      saveItem({
        ...item,
        status: 'failed',
        updatedAt: new Date().toISOString(),
        error: message,
      });
      addNotification(
        buildComposePublishFailureNotification(
          {
            ...item,
            status: 'failed',
            updatedAt: new Date().toISOString(),
            error: message,
          },
          message,
        ),
      );
      toast.error(message);
    } finally {
      setPublishingIds((current) => current.filter((id) => id !== itemId));
    }
  };

  const handleOpenSchedule = (item: ComposeItem) => {
    haptics.light();
    setScheduleItemId(item.id);
    setScheduleDate(item.scheduledAt ? new Date(item.scheduledAt) : new Date());
    setScheduleTime(item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(11, 16) : '09:00');
  };

  const handleConfirmSchedule = () => {
    if (!scheduleItemId) return;
    const scheduledAt = toIsoSchedule(scheduleDate, scheduleTime);
    if (!scheduledAt) {
      toast.error('Select a schedule date and time');
      return;
    }

    haptics.medium();
    updateStatus(scheduleItemId, 'scheduled', scheduledAt);
    if (scheduleItem) {
      addNotification(
        buildComposeScheduledNotification(
          {
            ...scheduleItem,
            status: 'scheduled',
            scheduledAt,
            updatedAt: new Date().toISOString(),
          },
          scheduledAt,
        ),
      );
    }
    setScheduleItemId(null);
    toast.success('Post scheduled');
  };

  const handleDeleteSelected = async () => {
    if (selection.selectedCount === 0) return;

    setIsDeletingSelected(true);
    selection.selectedIds.forEach((id) => deleteItem(id));
    selection.clearSelection();
    setIsDeletingSelected(false);
    toast.success('Selected post items deleted');
  };

  const handlePreviewAsset = (asset?: ComposeMediaAsset) => {
    const previewUrl = getComposeAssetPreviewUrl(asset);
    if (!asset || !previewUrl) {
      return;
    }

    haptics.light();
    setPreviewAsset(asset);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gray-900 dark:text-white mb-2">Post</h1>
        <p className="text-[#6B7280] dark:text-[#9CA3AF]">
          Manage drafts, schedules, and publishing from the post flow.
        </p>
      </div>
      <div className={`grid gap-4 ${isCompactLayout ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 transition-all duration-200">
          <p className="mb-1 text-sm leading-snug text-[#6B7280] dark:text-[#9CA3AF]">Total Drafts</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.drafts}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 transition-all duration-200">
          <p className="mb-1 text-sm leading-snug text-[#6B7280] dark:text-[#9CA3AF]">Scheduled Posts</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.scheduled}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 transition-all duration-200">
          <p className="mb-1 text-sm leading-snug text-[#6B7280] dark:text-[#9CA3AF]">Published Posts</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.published}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 transition-all duration-200">
          <p className="mb-1 text-sm leading-snug text-[#6B7280] dark:text-[#9CA3AF]">Pending Issues</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.pending}</p>
        </div>
      </div>

      <Button
        type="button"
        className="w-full touch-manipulation"
        onPointerUp={(event) => {
          if (event.pointerType === 'mouse') {
            return;
          }

          ignoreNextAddPostClickRef.current = true;
          event.preventDefault();
          event.stopPropagation();
          triggerCreateNavigation();
        }}
        onClick={() => {
          if (ignoreNextAddPostClickRef.current) {
            ignoreNextAddPostClickRef.current = false;
            return;
          }

          triggerCreateNavigation();
        }}
      >
        Add Post
      </Button>

      <div>
        <div className="flex items-center justify-between mb-3 gap-3">
          <h3 className="text-gray-900 dark:text-white">Post Items ({draftItems.length})</h3>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 px-4"
            onClick={() => {
              haptics.light();
              onNavigate('compose-activity', 'create');
            }}
          >
            View Activity
          </Button>
        </div>

        {draftItems.length === 0 ? (
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-12 text-center">
            <h3 className="text-gray-500 dark:text-[#9CA3AF] mb-2">No post drafts yet</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              Add a post to prepare media, captions, and schedules in one place.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {selection.selectionMode && (
              <ActivitySelectionToolbar
                selectedCount={selection.selectedCount}
                isDeleting={isDeletingSelected}
                allSelected={selection.allSelected}
                onSelectAll={selection.selectAll}
                onClear={selection.clearSelection}
                onDelete={handleDeleteSelected}
                itemLabel="content items"
                mobilePortalClassName="z-[90]"
              />
            )}

            {draftItems.map((item) => {
              const LeadingIcon = getLeadingIcon(item.status);
              const primaryAsset = getPrimaryAsset(item);
              const primaryPreviewUrl = getComposeAssetPreviewUrl(primaryAsset);
              const extraAssetCount = Math.max((item.mediaAssets?.length ?? (item.media ? 1 : 0)) - 1, 0);

              return (
                <SwipeableActivityCard
                  key={item.id}
                  id={item.id}
                  onDelete={(id) => {
                    if (!id) return;
                    deleteItem(id);
                  }}
                  selectionMode={selection.selectionMode}
                  selected={selection.isSelected(item.id)}
                  onEnterSelectionMode={selection.enterSelectionMode}
                  onToggleSelection={selection.toggleSelection}
                  className="w-full text-left p-5 rounded-2xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] transition-all duration-200"
                >
                  <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-4">
                    {primaryPreviewUrl && primaryAsset ? (
                      <button
                        type="button"
                        data-prevent-card-selection="true"
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePreviewAsset(primaryAsset);
                        }}
                        className="relative mt-0.5 h-14 w-14 overflow-hidden rounded-xl bg-[#ec1e24]/10 transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#ec1e24]/60"
                        aria-label={`Preview ${primaryAsset.kind} ${primaryAsset.fileName}`}
                      >
                        {primaryAsset.kind === 'video' ? (
                          <>
                            <video
                              src={primaryPreviewUrl}
                              className="pointer-events-none h-full w-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                              <Film className="h-4 w-4 text-white" />
                            </div>
                          </>
                        ) : (
                          <img
                            src={primaryPreviewUrl}
                            alt={primaryAsset.fileName}
                            className="pointer-events-none h-full w-full object-cover"
                          />
                        )}
                        {extraAssetCount > 0 ? (
                          <span className="absolute bottom-1 right-1 rounded-full bg-black/75 px-1.5 py-0.5 text-[10px] text-white">
                            +{extraAssetCount}
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      <div className="relative mt-0.5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-[#ec1e24]/10 text-[#ec1e24]">
                        {primaryAsset?.kind === 'video' ? <Film className="h-5 w-5" /> : primaryAsset ? <ImageIcon className="h-5 w-5" /> : <LeadingIcon className="h-5 w-5" />}
                      </div>
                    )}
                    <div className="flex min-w-0 items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h4 className="text-gray-900 dark:text-white mb-1 truncate">{item.title}</h4>
                        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-2">
                          {formatItemMeta(item)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {item.platforms.map((platform) => (
                            <span
                              key={platform}
                              className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-[#1F1F1F] text-gray-700 dark:text-[#9CA3AF] uppercase"
                            >
                              {platform}
                            </span>
                          ))}
                        </div>
                        {item.error ? (
                          <p className="mt-3 text-sm text-[#EF4444]">{item.error}</p>
                        ) : null}
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded-lg px-3 py-1.5 text-sm ${getStatusTone(item.status)}`}>
                        {item.status === 'scheduled'
                          ? 'Scheduled'
                          : item.status === 'published'
                            ? 'Published'
                            : item.status === 'failed'
                            ? 'Failed'
                              : 'Draft'}
                      </span>
                    </div>
                    {!selection.selectionMode ? (
                      item.status === 'draft' ? (
                        <div className="col-start-2">
                          <div className={`grid w-full gap-2 ${isCompactLayout ? 'grid-cols-1' : 'max-w-[26rem] grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]'}`}>
                            <Button
                              size="sm"
                              className="h-10 whitespace-nowrap px-3 text-sm"
                              disabled={publishingIds.includes(item.id)}
                              onClick={(event) => {
                                event.stopPropagation();
                                handlePublish(item.id);
                              }}
                            >
                              {publishingIds.includes(item.id) ? (
                                <>
                                  <RedSpinner size="sm" className="mr-2" label="Publishing post..." />
                                  Publish
                                </>
                              ) : 'Publish'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-10 whitespace-nowrap px-3 text-sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenSchedule(item);
                              }}
                            >
                              Schedule
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-10 whitespace-nowrap px-3 text-sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                haptics.light();
                                handleEdit(item.id);
                              }}
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                      ) : item.status !== 'published' ? (
                        <div className="col-start-2">
                          <div className={isCompactLayout ? 'w-full' : 'max-w-[9rem]'}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-10 w-full px-3 text-sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                haptics.light();
                                handleEdit(item.id);
                              }}
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                      ) : null
                    ) : null}
                  </div>
                </SwipeableActivityCard>
              );
            })}
          </div>
        )}
      </div>

      <BottomSheet open={Boolean(scheduleItemId)} onOpenChange={(open) => !open && setScheduleItemId(null)}>
        <BottomSheetHeader>
          <BottomSheetTitle>Schedule Post</BottomSheetTitle>
          <BottomSheetDescription>
            {scheduleItem ? `Choose when "${scheduleItem.title}" should move into the scheduled queue.` : 'Choose a schedule.'}
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-600 dark:text-[#9CA3AF]">Date</Label>
              <div className="mt-2">
                <DatePicker date={scheduleDate} onDateChange={setScheduleDate} />
              </div>
            </div>
            <div>
              <Label className="text-gray-600 dark:text-[#9CA3AF]">Time</Label>
              <div className="mt-2">
                <TimePicker value={scheduleTime} onChange={setScheduleTime} />
              </div>
            </div>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={() => setScheduleItemId(null)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleConfirmSchedule}>
              Schedule
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      <MediaPreviewDialog
        open={Boolean(previewAsset && getComposeAssetPreviewUrl(previewAsset))}
        src={getComposeAssetPreviewUrl(previewAsset)}
        mediaType={previewAsset?.kind ?? 'image'}
        title={previewAsset?.fileName}
        badgeLabel={previewAsset?.kind}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAsset(null);
          }
        }}
      />
    </div>
  );
}
