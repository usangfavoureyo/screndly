import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Film, Image as ImageIcon, FileText, PencilLine } from 'lucide-react';
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
import { haptics } from '../../utils/haptics';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { getComposeAssetPreviewUrl } from '../../lib/create/composeMedia';
import { publishComposeItem } from '../../lib/create/composePublish';
import { useComposeStore } from '../../store/useComposeStore';
import type { ComposeItem } from '../../types/compose';

interface ComposeOverviewProps {
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

export function ComposeOverview({ onNavigate }: ComposeOverviewProps) {
  const { items, setActiveItemId, deleteItem, updateStatus, saveItem } = useComposeStore();
  const [scheduleItemId, setScheduleItemId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [publishingIds, setPublishingIds] = useState<string[]>([]);
  const selection = useBulkSelection(items.map((item) => item.id));

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
        toast.success(
          result.failedResults.length > 0
            ? `Published to ${result.postedPlatforms.join(', ')}.`
            : `Published to ${result.postedPlatforms.join(', ')}.`,
        );
        return;
      }

      toast.error(nextError || 'Failed to publish post');
    } catch (error) {
      saveItem({
        ...item,
        status: 'failed',
        updatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Failed to publish post',
      });
      toast.error(error instanceof Error ? error.message : 'Failed to publish post');
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
    setScheduleItemId(null);
    toast.success('Compose item scheduled');
  };

  const handleDeleteSelected = async () => {
    if (selection.selectedCount === 0) return;

    setIsDeletingSelected(true);
    selection.selectedIds.forEach((id) => deleteItem(id));
    selection.clearSelection();
    setIsDeletingSelected(false);
    toast.success('Selected compose items deleted');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Total Drafts</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.drafts}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Scheduled Posts</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.scheduled}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Published Posts</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.published}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Pending Issues</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.pending}</p>
        </div>
      </div>

      <Button
        className="w-full"
        onClick={() => {
          haptics.medium();
          handleCreate();
        }}
      >
        Add Post
      </Button>

      <div>
        <div className="flex items-center justify-between mb-3 gap-3">
          <h3 className="text-gray-900 dark:text-white">Post Items ({items.length})</h3>
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

        {items.length === 0 ? (
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-12 text-center">
            <PencilLine className="w-12 h-12 text-gray-400 dark:text-[#9CA3AF] mx-auto mb-4" />
            <h3 className="text-gray-900 dark:text-white mb-2">No post drafts yet</h3>
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
                onClear={selection.clearSelection}
                onDelete={handleDeleteSelected}
                itemLabel="content items"
              />
            )}

            {items.map((item) => {
              const LeadingIcon = getLeadingIcon(item.status);
              const primaryAsset = getPrimaryAsset(item);
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
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="relative mt-0.5 h-14 w-14 overflow-hidden rounded-xl bg-[#ec1e24]/10">
                          {getComposeAssetPreviewUrl(primaryAsset) ? (
                            primaryAsset.kind === 'video' ? (
                              <video
                                src={getComposeAssetPreviewUrl(primaryAsset)}
                                className="h-full w-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={getComposeAssetPreviewUrl(primaryAsset)}
                                alt={primaryAsset.fileName}
                                className="h-full w-full object-cover"
                              />
                            )
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[#ec1e24]">
                              {primaryAsset?.kind === 'video' ? <Film className="h-5 w-5" /> : primaryAsset ? <ImageIcon className="h-5 w-5" /> : <LeadingIcon className="h-5 w-5" />}
                            </div>
                          )}
                          {extraAssetCount > 0 ? (
                            <span className="absolute bottom-1 right-1 rounded-full bg-black/75 px-1.5 py-0.5 text-[10px] text-white">
                              +{extraAssetCount}
                            </span>
                          ) : null}
                        </div>
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
                          {!selection.selectionMode ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                disabled={publishingIds.includes(item.id)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handlePublish(item.id);
                                }}
                              >
                                {publishingIds.includes(item.id) ? 'Publishing...' : 'Publish'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
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
                                onClick={(event) => {
                                  event.stopPropagation();
                                  haptics.light();
                                  handleEdit(item.id);
                                }}
                              >
                                Edit
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm ${getStatusTone(item.status)}`}>
                        {item.status === 'scheduled'
                          ? 'Scheduled'
                          : item.status === 'published'
                            ? 'Published'
                            : item.status === 'failed'
                              ? 'Failed'
                              : 'Draft'}
                      </span>
                    </div>

                  </div>
                </SwipeableActivityCard>
              );
            })}
          </div>
        )}
      </div>

      <BottomSheet open={Boolean(scheduleItemId)} onOpenChange={(open) => !open && setScheduleItemId(null)}>
        <BottomSheetHeader>
          <BottomSheetTitle>Schedule Compose Item</BottomSheetTitle>
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
    </div>
  );
}
