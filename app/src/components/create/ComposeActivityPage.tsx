import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Film, Image as ImageIcon, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { BackIconButton } from '../BackIconButton';
import { SwipeableActivityCard } from '../SwipeableActivityCard';
import { ActivitySelectionToolbar } from '../ActivitySelectionToolbar';
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
import { useNotifications } from '../../contexts/NotificationsContext';
import { haptics } from '../../utils/haptics';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { useComposeStore } from '../../store/useComposeStore';
import { getComposeAssetPreviewUrl } from '../../lib/create/composeMedia';
import { publishComposeItem } from '../../lib/create/composePublish';
import {
  buildComposePublishFailureNotification,
  buildComposePublishSuccessNotification,
  buildComposeScheduledNotification,
} from '../../lib/create/composeNotifications';
import type { ComposeItem, ComposeStatus } from '../../types/compose';

interface ComposeActivityPageProps {
  onNavigate: (page: string, fromPage?: string) => void;
  previousPage?: string | null;
}

const FILTERS: Array<{ id: 'all' | ComposeStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
  { id: 'failed', label: 'Failed' },
];

function getStatusTone(status: ComposeStatus): string {
  switch (status) {
    case 'failed':
      return 'bg-[#FEE2E2] dark:bg-[#991B1B] text-[#EF4444]';
    default:
      return 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]';
  }
}

function getLeadingIcon(status: ComposeStatus) {
  if (status === 'scheduled') return CalendarClock;
  if (status === 'published') return CheckCircle2;
  if (status === 'failed') return AlertTriangle;
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

export function ComposeActivityPage({ onNavigate, previousPage }: ComposeActivityPageProps) {
  const { items, deleteItem, saveItem, setActiveItemId, updateStatus } = useComposeStore();
  const { addNotification } = useNotifications();
  const [filter, setFilter] = useState<'all' | ComposeStatus>('all');
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [scheduleItemId, setScheduleItemId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [publishingIds, setPublishingIds] = useState<string[]>([]);

  const filteredItems = useMemo(
    () => items.filter((item) => (filter === 'all' ? true : item.status === filter)),
    [filter, items],
  );
  const selection = useBulkSelection(filteredItems.map((item) => item.id));

  const stats = {
    total: items.length,
    drafts: items.filter((item) => item.status === 'draft').length,
    scheduled: items.filter((item) => item.status === 'scheduled').length,
    published: items.filter((item) => item.status === 'published').length,
    failed: items.filter((item) => item.status === 'failed').length,
  };

  const scheduleItem = useMemo(
    () => items.find((item) => item.id === scheduleItemId),
    [items, scheduleItemId],
  );

  const handleDeleteSelected = async () => {
    if (selection.selectedCount === 0) return;

    setIsDeletingSelected(true);
    selection.selectedIds.forEach((id) => deleteItem(id));
    selection.clearSelection();
    setIsDeletingSelected(false);
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
        toast.success(`Published to ${result.postedPlatforms.join(', ')}.`);
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

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start gap-4 mb-4">
          <BackIconButton onClick={() => onNavigate(previousPage || 'create')} className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1" />
          <div className="flex-1">
            <h1 className="text-gray-900 dark:text-white mb-2">Post Activity</h1>
            <p className="text-[#6B7280] dark:text-[#9CA3AF]">Review drafts, scheduled items, published posts, and failures from the Post workflow.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Total Items</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Drafts</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.drafts}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Scheduled</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.scheduled}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Published</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.published}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Failed</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.failed}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
        {selection.selectionMode && (
          <ActivitySelectionToolbar
            selectedCount={selection.selectedCount}
            isDeleting={isDeletingSelected}
            onClear={selection.clearSelection}
            onDelete={handleDeleteSelected}
            itemLabel="activity items"
          />
        )}

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                haptics.light();
                setFilter(option.id);
              }}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                filter === option.id
                  ? 'bg-[#ec1e24] text-white'
                  : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-[#1F1F1F]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 p-12 text-center dark:border-[#333333]">
            <p className="text-gray-900 dark:text-white mb-2">No post activity</p>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Items will appear here once drafts or scheduled posts are created.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
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
                          <h3 className="text-gray-900 dark:text-white mb-1 truncate">{item.title}</h3>
                          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-2">
                            {item.scheduledAt ? `Scheduled ${new Date(item.scheduledAt).toLocaleString()}` : `Updated ${new Date(item.updatedAt).toLocaleString()}`}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.platforms.map((platform) => (
                              <span key={platform} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-[#1F1F1F] text-gray-700 dark:text-[#9CA3AF] uppercase">
                                {platform}
                              </span>
                            ))}
                          </div>
                          {item.error ? <p className="mt-3 text-sm text-[#EF4444]">{item.error}</p> : null}
                        </div>
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
                        <div className="ml-[4.25rem] w-[calc(100%-4.25rem)]">
                          <div className="grid w-full max-w-[26rem] grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] gap-2">
                            <Button
                              size="sm"
                              className="h-10 whitespace-nowrap px-3 text-sm"
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
                                setActiveItemId(item.id);
                                onNavigate('compose-editor', 'create');
                              }}
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="ml-[4.25rem] w-[calc(100%-4.25rem)]">
                          <div className="max-w-[9rem]">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-10 w-full px-3 text-sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveItemId(item.id);
                                onNavigate('compose-editor', 'create');
                              }}
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                      )
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
    </div>
  );
}
