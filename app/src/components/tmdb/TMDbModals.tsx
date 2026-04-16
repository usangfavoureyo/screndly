import { useState, useEffect } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { toast } from "sonner";
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { DatePicker } from '../ui/date-picker';
import { TimePicker } from '../ui/time-picker';
import { haptics } from '../../utils/haptics';
import { useUndo } from '../UndoContext';
import { useTMDbModalStore } from '../../stores/tmdbModalStore';
import { useTMDbPosts, type TMDbPost } from '../../contexts/TMDbPostsContext';
import { XIcon } from '../icons/XIcon';
import { ThreadsIcon } from '../icons/ThreadsIcon';
import { FacebookIcon } from '../icons/FacebookIcon';
import { YouTubeIcon } from '../icons/YouTubeIcon';
import { PinterestIcon } from '../icons/PinterestIcon';
import { generateTMDbCaption, getFeedTypeFromSource } from '../../utils/tmdbCaptionGenerator';
import { logFeedUpdate, logFeedDeletion } from '../../utils/tmdbLogger';
import { getInitialTMDbPlatformKeys, publishTMDbPost, toTMDbPlatformNames } from '../../lib/tmdb/tmdbPublish';
import {
    deriveTMDbActivityStatus,
    deriveTMDbPlatformStates,
    formatTMDbPlatformLabel,
    normalizeTMDbPlatformKey,
    type TMDbPlatformResultRecord,
} from '../../lib/tmdb/activityStatus';
import { ChangeImageBottomSheet } from './ChangeImageBottomSheet';
import { TMDbImagePreviewDialog } from './TMDbImagePreviewDialog';
import {
    BottomSheet,
    BottomSheetHeader,
    BottomSheetTitle,
    BottomSheetDescription,
    BottomSheetBody,
    BottomSheetFooter
} from '../ui/bottom-sheet';
import { RedSpinner } from '../PageLoader';

/**
 * TMDbModals - Portal Rendered Modals
 * 
 * CRITICAL ARCHITECTURE:
 * - This component renders ALL TMDb modals at the app level
 * - Modals mount ONCE and never unmount during session
 * - Feed card state changes do NOT affect these modals
 * - Opening/closing is controlled by Zustand store
 * 
 * This prevents:
 * - Flicker when opening modals
 * - Black frames during image change
 * - Re-renders cascading to feed cards
 */
export function TMDbModals() {
    const { posts, fetchPosts, updatePost, deletePost, schedulePost, restorePost } = useTMDbPosts();
    const { showUndo } = useUndo();

    // Modal states from store
    const editCaptionModal = useTMDbModalStore(s => s.editCaptionModal);
    const changeImageModal = useTMDbModalStore(s => s.changeImageModal);
    const rescheduleModal = useTMDbModalStore(s => s.rescheduleModal);
    const deleteModal = useTMDbModalStore(s => s.deleteModal);
    const platformSelectModal = useTMDbModalStore(s => s.platformSelectModal);
    const imagePreviewModal = useTMDbModalStore(s => s.imagePreviewModal);
    const setRememberedPreviewImageIndex = useTMDbModalStore(s => s.setRememberedPreviewImageIndex);

    // Modal actions
    const closeEditCaption = useTMDbModalStore(s => s.closeEditCaption);
    const closeChangeImage = useTMDbModalStore(s => s.closeChangeImage);
    const closeReschedule = useTMDbModalStore(s => s.closeReschedule);
    const closeDelete = useTMDbModalStore(s => s.closeDelete);
    const closePlatformSelect = useTMDbModalStore(s => s.closePlatformSelect);
    const closeImagePreview = useTMDbModalStore(s => s.closeImagePreview);

    // Local state for form inputs (only for active modal)
    const [editedCaption, setEditedCaption] = useState('');
    const [isSaving, setIsSaving] = useState(false); // New saving state for schedule/publish
    const [isSavingCaption, setIsSavingCaption] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
    const [scheduledTime, setScheduledTime] = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

    const mergePublishResults = (
        feed: NonNullable<typeof platformSelectModal.feed>,
        selectedPlatformNames: string[],
        publishResult: Awaited<ReturnType<typeof publishTMDbPost>>,
    ) => {
        const existingResults = new Map(
            (feed.platformResults || []).map((result) => [normalizeTMDbPlatformKey(result.platform), result] as const)
        );
        const platformPostIds: Record<string, string> = { ...(feed.platformPostIds || {}) };
        const attemptedAt = new Date().toISOString();

        selectedPlatformNames.forEach((platformName) => {
            const platformKey = normalizeTMDbPlatformKey(platformName);
            const previous = existingResults.get(platformKey);
            const nextResult = publishResult.platformResults.find(
                (result) => normalizeTMDbPlatformKey(result.platform) === platformKey
            );

            if (nextResult) {
                existingResults.set(platformKey, {
                    ...previous,
                    ...nextResult,
                    platform: formatTMDbPlatformLabel(platformKey),
                    lastAttemptAt: attemptedAt,
                    retryCount: (previous?.retryCount || 0) + 1,
                });

                if (nextResult.status === 'posted' && nextResult.id) {
                    platformPostIds[platformKey] = nextResult.id;
                }
            }
        });

        const platformResults = Array.from(existingResults.values()) as TMDbPlatformResultRecord[];
        const platformStates = deriveTMDbPlatformStates({
            status: feed.status,
            platforms: selectedPlatformNames,
            platformPostIds,
            platformResults,
            publishedTime: feed.publishedTime,
            errorMessage: feed.errorMessage,
        });
        const derivedStatus = deriveTMDbActivityStatus(
            {
                status: feed.status,
                platforms: selectedPlatformNames,
                platformPostIds,
                platformResults,
                publishedTime: feed.publishedTime,
                errorMessage: feed.errorMessage,
            },
            platformStates,
        );
        const publishedAt = platformStates
            .filter((state) => state.status === 'posted')
            .map((state) => state.publishedAt)
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1);
        const failedStates = platformStates.filter((state) => state.status === 'failed');
        const persistedStatus: TMDbPost['status'] =
            derivedStatus === 'failed' ? 'failed' : derivedStatus === 'publishing' ? 'queued' : 'published';

        return {
            platforms: selectedPlatformNames,
            platformPostIds,
            platformResults,
            status: persistedStatus,
            publishedTime: publishedAt,
            errorMessage: failedStates.length > 0
                ? failedStates.map((state) => `${state.label}: ${state.errorMessage || 'Publish failed'}`).join('; ')
                : undefined,
        };
    };

    // Sync form state when modal opens
    useEffect(() => {
        if (editCaptionModal.open && editCaptionModal.feed) {
            setEditedCaption(editCaptionModal.feed.caption);
        }
    }, [editCaptionModal.open, editCaptionModal.feed]);

    useEffect(() => {
        if (rescheduleModal.open && rescheduleModal.feed) {
            const date = new Date(rescheduleModal.feed.scheduledTime);
            setScheduledDate(date);
            setScheduledTime(date.toTimeString().slice(0, 5));
            setSelectedPlatforms(getInitialTMDbPlatformKeys(rescheduleModal.feed.source, rescheduleModal.feed.platforms));
        }
    }, [rescheduleModal.open, rescheduleModal.feed]);
    useEffect(() => {
        if (platformSelectModal.open && platformSelectModal.feed) {
            setSelectedPlatforms(getInitialTMDbPlatformKeys(platformSelectModal.feed.source, platformSelectModal.feed.platforms));
        } else if (!platformSelectModal.open) {
            setSelectedPlatforms([]);
        }
    }, [platformSelectModal.open, platformSelectModal.feed]);

    const handleCloseImagePreview = () => {
        closeImagePreview();
    };

    // === EDIT CAPTION HANDLERS ===
    const handleSaveCaption = async () => {
        if (isSavingCaption) return;
        if (!editCaptionModal.feed) return;
        if (editedCaption.trim().length === 0) {
            toast.error('Caption cannot be empty');
            return;
        }
        if (editedCaption.length > 200) {
            toast.error('Caption too long (max 200 characters)');
            return;
        }

        setIsSavingCaption(true);

        try {
            await updatePost(editCaptionModal.feed.id, { caption: editedCaption });
            haptics.success();
            toast.success('Caption updated');
            closeEditCaption();
        } catch (error) {
            console.error('Failed to save caption', error);
            toast.error('Failed to save caption');
        } finally {
            setIsSavingCaption(false);
        }
    };

    const handleRegenerateCaption = async () => {
        haptics.light(); // Haptic on refresh
        if (!editCaptionModal.feed) return;
        setIsRegenerating(true);

        try {
            const feedType = getFeedTypeFromSource(editCaptionModal.feed.source);
            const result = await generateTMDbCaption(
                {
                    title: editCaptionModal.feed.title,
                    mediaType: editCaptionModal.feed.mediaType,
                    releaseDate: editCaptionModal.feed.releaseDate,
                    cast: editCaptionModal.feed.cast,
                    year: editCaptionModal.feed.year,
                    platforms: editCaptionModal.feed.platforms,
                },
                feedType,
                { forceFresh: true }
            );
            setEditedCaption(result.caption);
            toast.success('Caption regenerated');
        } catch (error) {
            toast.error('Failed to regenerate caption');
        } finally {
            setIsRegenerating(false);
        }
    };

    // === CHANGE IMAGE HANDLERS ===
    // Handled by ChangeImageBottomSheet component directly



    // === RESCHEDULE HANDLERS ===
    const handleSaveSchedule = async () => {
        if (!rescheduleModal.feed || !scheduledDate || !scheduledTime) {
            toast.error('Please select date and time');
            return;
        }

        if (selectedPlatforms.length === 0) {
            toast.error('Select at least one platform');
            return;
        }

        setIsSaving(true);

        try {
            const [hours, minutes] = scheduledTime.split(':').map(Number);
            const newDate = new Date(scheduledDate);
            newDate.setHours(hours, minutes, 0, 0);

            const platformNames = toTMDbPlatformNames(selectedPlatforms);

            await schedulePost({
                ...rescheduleModal.feed,
                scheduledTime: newDate.toISOString(),
                status: 'scheduled',
                platforms: platformNames,
                publishedTime: undefined,
                errorMessage: undefined,
            });

            haptics.success();
            closeReschedule();
            toast.success('Post scheduled');
            logFeedUpdate(
                rescheduleModal.feed.id,
                rescheduleModal.feed.title,
                'scheduled',
                'System',
                { platforms: platformNames, scheduledTime: newDate.toISOString() }
            );
        } catch (error) {
            console.error('Failed to save schedule', error);
            toast.error('Failed to save schedule');
        } finally {
            setIsSaving(false);
        }
    };

    // === DELETE HANDLERS ===
    const handleConfirmDelete = () => {
        haptics.success(); // Haptic on delete
        if (!deleteModal.feed) return;

        // Store feed data and original index for undo
        const deletedFeed = { ...deleteModal.feed };
        const feedId = deleteModal.feed.id;
        const originalIndex = posts.findIndex(post => post.id === feedId);

        deletePost(feedId);

        // Show undo toast using existing UndoContext
        showUndo({
            id: feedId,
            itemName: deletedFeed.title,
            onUndo: () => {
                haptics.light();
                // Restore to original position
                restorePost(
                    {
                        ...deletedFeed,
                        status: deletedFeed.status ?? 'scheduled',
                    },
                    originalIndex
                );
            },
            onConfirm: () => {
                // Log final deletion
            }
        });

        logFeedDeletion(
            deleteModal.feed.id,
            deleteModal.feed.title,
            'System',
            { tmdbId: deleteModal.feed.tmdbId }
        );

        closeDelete();
    };

    // === PLATFORM SELECT HANDLERS ===
    const togglePlatform = (platform: string) => {
        haptics.light(); // Haptic on toggle
        setSelectedPlatforms(prev =>
            prev.includes(platform)
                ? prev.filter(p => p !== platform)
                : [...prev, platform]
        );
    };

    const handleSchedulePost = async () => {
        if (!platformSelectModal.feed) return;

        if (selectedPlatforms.length === 0) {
            toast.error('Select at least one platform');
            return;
        }

        const mode = platformSelectModal.mode;
        const isPublishNow = mode === 'publish';
        const platformNames = toTMDbPlatformNames(selectedPlatforms);

        setIsSaving(true);

        try {
            if (isPublishNow) {
                const publishResult = await publishTMDbPost(platformSelectModal.feed, selectedPlatforms);
                const mergedState = mergePublishResults(platformSelectModal.feed, publishResult.platformNames, publishResult);

                if (publishResult.postedPlatforms.length === 0) {
                    await updatePost(platformSelectModal.feed.id, mergedState);
                    throw new Error(publishResult.errorMessage || 'Failed to publish TMDb post');
                }

                await updatePost(platformSelectModal.feed.id, mergedState);
                await fetchPosts({ silent: true });

                haptics.success();
                closePlatformSelect();
                logFeedUpdate(
                    platformSelectModal.feed.id,
                    platformSelectModal.feed.title,
                    'published',
                    'System',
                    { platforms: publishResult.platformNames }
                );

                const failedPlatforms = publishResult.failedResults.map((result) => result.platform);
                toast.success(
                    failedPlatforms.length > 0
                        ? `Published to ${publishResult.postedPlatforms.join(', ')}. Failed on ${failedPlatforms.join(', ')}.`
                        : `Published to ${publishResult.postedPlatforms.join(', ')}.`
                );
                return;
            }

            await schedulePost({
                ...platformSelectModal.feed,
                status: 'scheduled',
                platforms: platformNames,
                scheduledTime: platformSelectModal.feed.scheduledTime,
                publishedTime: undefined,
                errorMessage: undefined,
            });

            haptics.success();
            closePlatformSelect();
            toast.success(mode === 'update-platforms' ? 'Platforms updated' : 'Post scheduled');
            logFeedUpdate(
                platformSelectModal.feed.id,
                platformSelectModal.feed.title,
                'scheduled',
                'System',
                { platforms: platformNames, action: mode === 'update-platforms' ? 'platforms-updated' : 'scheduled' }
            );
        } catch (error) {
            console.error('Failed to publish/schedule post', error);
            const message = error instanceof Error
                ? error.message
                : (isPublishNow ? 'Failed to publish post' : mode === 'update-platforms' ? 'Failed to update platforms' : 'Failed to schedule post');
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const platformSelectTitle =
        platformSelectModal.mode === 'publish'
            ? 'Select Platforms'
            : platformSelectModal.mode === 'update-platforms'
                ? 'Edit Platforms'
                : 'Select Platforms';

    const platformSelectDescription =
        platformSelectModal.mode === 'publish'
            ? 'Choose platforms to post on'
            : platformSelectModal.mode === 'update-platforms'
                ? 'Update the platforms for this scheduled post'
                : 'Choose platforms to schedule';

    const platformSelectActionLabel =
        platformSelectModal.mode === 'publish'
            ? 'Publish'
            : platformSelectModal.mode === 'update-platforms'
                ? 'Save Platforms'
                : 'Schedule';

    return (
        <>
            {/* Image Preview Modal */}
            <TMDbImagePreviewDialog
                open={imagePreviewModal.open}
                onOpenChange={(open) => !open && handleCloseImagePreview()}
                onClose={handleCloseImagePreview}
                imageUrl={imagePreviewModal.feed?.imageUrl}
                imageUrls={imagePreviewModal.feed?.imageUrls}
                title={imagePreviewModal.feed?.title}
                imageType={imagePreviewModal.feed?.imageType}
                imageTypes={imagePreviewModal.feed?.imageTypes}
                initialIndex={imagePreviewModal.initialIndex}
                onImageIndexChange={(index) => {
                    const feedId = imagePreviewModal.feed?.id;
                    if (feedId) {
                        setRememberedPreviewImageIndex(feedId, index);
                    }
                }}
            />

            {/* Edit Caption Modal */}
            <BottomSheet
                open={editCaptionModal.open}
                onOpenChange={(open) => !open && !isSavingCaption && closeEditCaption()}
                heightMode="half"
                className="h-[50svh] max-h-[50svh]"
                disableSwipe
                disableAnimations
            >
                <BottomSheetHeader>
                    <BottomSheetTitle>Edit Caption</BottomSheetTitle>
                    <BottomSheetDescription>Customize the caption for this post</BottomSheetDescription>
                </BottomSheetHeader>
                <BottomSheetBody>
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label htmlFor="caption">Caption</Label>
                                <button
                                    onClick={handleRegenerateCaption}
                                    disabled={isRegenerating}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-4 h-4 text-black dark:text-white ${isRegenerating ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            <textarea
                                id="caption"
                                value={editedCaption}
                                onChange={(e) => setEditedCaption(e.target.value)}
                                rows={5}
                                enterKeyHint="enter"
                                className="w-full min-h-[120px] px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#292929] dark:focus:ring-[#292929] resize-none"
                                maxLength={200}
                                onFocus={() => haptics.light()}
                                onTouchStart={(e) => e.stopPropagation()}
                                autoFocus
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="sentences"
                                spellCheck={false}
                                disabled={isSavingCaption || isRegenerating}
                            />
                            <p className="text-xs text-gray-500 mt-1">{editedCaption.length}/200</p>
                        </div>
                    </div>
                </BottomSheetBody>
                <BottomSheetFooter>
                    <Button variant="outline" onClick={() => { haptics.light(); closeEditCaption(); }} disabled={isSavingCaption}>
                        Cancel
                    </Button>
                    <Button onClick={() => void handleSaveCaption()} disabled={isSavingCaption || isRegenerating}>
                        {isSavingCaption ? (
                            <>
                                <RedSpinner size="sm" className="mr-2" label="Saving caption..." />
                                Save
                            </>
                        ) : 'Save'}
                    </Button>
                </BottomSheetFooter>
            </BottomSheet>

            {/* Change Image Modal */}
            {changeImageModal.feed && (
                <ChangeImageBottomSheet
                    open={changeImageModal.open}
                    onOpenChange={(open) => !open && closeChangeImage()}
                    title={changeImageModal.feed.title}
                    mediaType={changeImageModal.feed.mediaType}
                    tmdbId={changeImageModal.feed.tmdbId}
                    currentImageUrl={changeImageModal.feed.imageUrl}
                    currentImageUrls={changeImageModal.feed.imageUrls}
                    currentImageType={changeImageModal.feed.imageType}
                    currentImageTypes={changeImageModal.feed.imageTypes}
                    onSave={async ({ imageStyle, imageUrl, imageType, imageUrls, imageTypes }) => {
                        if (changeImageModal.feed) {
                            await updatePost(changeImageModal.feed.id, {
                                imageStyle,
                                imageUrl,
                                imageType,
                                imageUrls,
                                imageTypes,
                            });
                        }
                    }}
                />
            )}

            {/* Reschedule Modal */}
            <BottomSheet open={rescheduleModal.open} onOpenChange={(open) => !open && closeReschedule()}>
                <BottomSheetHeader>
                    <BottomSheetTitle>Schedule Post</BottomSheetTitle>
                    <BottomSheetDescription>Set date and time for publishing</BottomSheetDescription>
                </BottomSheetHeader>
                <BottomSheetBody>
                    <div className="space-y-4">
                        {/* Platform Selection - same 3-column grid as Publish modal */}
                        <div>
                            <Label>Platforms</Label>
                            <div className="py-4 flex justify-center">
                                <div className="grid grid-cols-3 gap-3">
                                    {['x', 'threads', 'facebook', 'youtube', 'pinterest'].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => togglePlatform(p)}
                                            className={`w-14 h-14 rounded-lg flex items-center justify-center transition-all ${selectedPlatforms.includes(p)
                                                ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                                                : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                                                }`}
                                        >
                                            {p === 'x' && <XIcon className="w-4 h-4" />}
                                            {p === 'threads' && <ThreadsIcon className="w-5 h-5" />}
                                            {p === 'facebook' && <FacebookIcon className="w-5 h-5" />}
                                            {p === 'youtube' && <YouTubeIcon className="w-6 h-6" />}
                                            {p === 'pinterest' && <PinterestIcon className="w-5 h-5" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div>
                            <Label>Date</Label>
                            <DatePicker date={scheduledDate} onDateChange={(d) => { if (d) haptics.light(); setScheduledDate(d); }} className="mt-2" />
                        </div>
                        <div>
                            <Label>Time</Label>
                            <TimePicker value={scheduledTime} onChange={(t) => { haptics.light(); setScheduledTime(t); }} className="mt-2" />
                        </div>
                        <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-lg p-3">
                            <div className="flex items-start gap-2">
                                <Clock className="w-4 h-4 text-[#ec1e24] mt-0.5" />
                                <p className="text-xs">Posts are spaced automatically to prevent overlap.</p>
                            </div>
                        </div>
                    </div>
                </BottomSheetBody>
                <BottomSheetFooter>
                    <Button variant="outline" onClick={() => { haptics.light(); closeReschedule(); }}>Cancel</Button>
                    <Button onClick={handleSaveSchedule} disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <RedSpinner size="sm" className="mr-2" label="Saving schedule..." />
                                Schedule
                            </>
                        ) : 'Schedule'}
                    </Button>
                </BottomSheetFooter>
            </BottomSheet>

            {/* Delete Confirmation Modal */}
            <BottomSheet open={deleteModal.open} onOpenChange={(open) => !open && closeDelete()}>
                <BottomSheetHeader>
                    <BottomSheetTitle>Delete Feed</BottomSheetTitle>
                    <BottomSheetDescription>This action cannot be undone.</BottomSheetDescription>
                </BottomSheetHeader>
                <BottomSheetBody>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                haptics.light();
                                closeDelete();
                            }}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleConfirmDelete();
                            }}
                            className="flex-1 bg-red-500 hover:bg-red-600"
                        >
                            Delete
                        </Button>
                    </div>
                </BottomSheetBody>
            </BottomSheet>

            {/* Platform Select Modal */}
            <BottomSheet open={platformSelectModal.open} onOpenChange={(open) => !open && closePlatformSelect()}>
                <BottomSheetHeader>
                    <BottomSheetTitle>{platformSelectTitle}</BottomSheetTitle>
                    <BottomSheetDescription>{platformSelectDescription}</BottomSheetDescription>
                </BottomSheetHeader>
                <BottomSheetBody>
                    <div className="py-4 flex justify-center">
                        <div className="grid grid-cols-3 gap-3">
                            {['x', 'threads', 'facebook', 'youtube', 'pinterest'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => togglePlatform(p)}
                                    className={`w-14 h-14 rounded-lg flex items-center justify-center transition-all ${selectedPlatforms.includes(p)
                                        ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                                        : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                                        }`}
                                >
                                    {p === 'x' && <XIcon className="w-4 h-4" />}
                                    {p === 'threads' && <ThreadsIcon className="w-5 h-5" />}
                                    {p === 'facebook' && <FacebookIcon className="w-5 h-5" />}
                                    {p === 'youtube' && <YouTubeIcon className="w-6 h-6" />}
                                    {p === 'pinterest' && <PinterestIcon className="w-5 h-5" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </BottomSheetBody>
                <BottomSheetFooter>
                    <Button variant="outline" onClick={() => { haptics.light(); closePlatformSelect(); }} className="flex-1">
                        Cancel
                    </Button>
                    <Button onClick={handleSchedulePost} className="flex-1 bg-[#ec1e24]" disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <RedSpinner
                                    size="sm"
                                    className="mr-2"
                                    label={
                                        platformSelectModal.mode === 'publish'
                                            ? 'Publishing TMDb post...'
                                            : platformSelectModal.mode === 'update-platforms'
                                                ? 'Saving TMDb platforms...'
                                                : 'Scheduling TMDb post...'
                                    }
                                />
                                {platformSelectActionLabel}
                            </>
                        ) : (
                            platformSelectActionLabel
                        )}
                    </Button>
                </BottomSheetFooter>
            </BottomSheet>
        </>
    );
}
