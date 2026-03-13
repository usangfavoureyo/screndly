import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Film, Image as ImageIcon, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { BackIconButton } from '../BackIconButton';
import { MediaPreviewDialog } from '../media/MediaPreviewDialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
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
import { InstagramIcon } from '../icons/InstagramIcon';
import { FacebookIcon } from '../icons/FacebookIcon';
import { TikTokIcon } from '../icons/TikTokIcon';
import { ThreadsIcon } from '../icons/ThreadsIcon';
import { XIcon } from '../icons/XIcon';
import { YouTubeIcon } from '../icons/YouTubeIcon';
import { PinterestIcon } from '../icons/PinterestIcon';
import { COMPOSE_PLATFORM_OPTIONS } from '../../config/create';
import {
  buildComposeItemTitleFromAssets,
  buildComposeMediaAsset,
  getComposeAssetPublishUrl,
  getComposeCompatibilityMap,
  getComposeAssetPreviewUrl,
  normalizeComposeItem,
  summarizeComposeMedia,
} from '../../lib/create/composeMedia';
import { publishComposeItem } from '../../lib/create/composePublish';
import {
  buildComposeDraftNotification,
  buildComposePublishFailureNotification,
  buildComposePublishSuccessNotification,
  buildComposeScheduledNotification,
} from '../../lib/create/composeNotifications';
import { uploadComposeAsset } from '../../lib/create/composeStorage';
import { useComposeStore } from '../../store/useComposeStore';
import type { ComposeItem, ComposeMediaAsset, ComposePlatformKey } from '../../types/compose';
import { getConnectedPlatforms } from '../../utils/platformConnections';
import { haptics } from '../../utils/haptics';
import { useNotifications } from '../../contexts/NotificationsContext';
import { fetchYouTubePlaylists, type YouTubePlaylist } from '../../lib/api/youtube';
import { useBackEntry } from '../../hooks/useBackEntry';
import { useUnsavedBackGuard } from '../../hooks/useUnsavedBackGuard';
import { PageLoader, RedSpinner } from '../PageLoader';

interface ComposeEditorPageProps {
  onNavigate: (page: string, fromPage?: string) => void;
  previousPage?: string | null;
  registerCloseRequestHandler?: (handler: (() => boolean) | null) => void;
}

type FormState = {
  mediaAssets: ComposeMediaAsset[];
  platforms: ComposePlatformKey[];
  sharedCaption: string;
  pinterestTitle: string;
  pinterestDescription: string;
  pinterestBoard: string;
  youtubeTitle: string;
  youtubeDescription: string;
  youtubePlaylist: string;
};

const PLATFORM_ICONS = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
  threads: ThreadsIcon,
  x: XIcon,
  youtube: YouTubeIcon,
  pinterest: PinterestIcon,
} as const;

const PLATFORM_ICON_SIZES: Record<ComposePlatformKey, string> = {
  instagram: 'w-5.5 h-5.5',
  facebook: 'w-5.5 h-5.5',
  tiktok: 'w-6.5 h-6.5',
  threads: 'w-5 h-5',
  x: 'w-4 h-4',
  youtube: 'w-6 h-6',
  pinterest: 'w-5.5 h-5.5',
};

const PINTEREST_BOARDS = ['Movie Picks', 'TV Roundup', 'Campaigns'];
const SHARED_CAPTION_PLATFORMS: ComposePlatformKey[] = ['instagram', 'facebook', 'threads', 'x', 'tiktok'];

function createInitialForm(item?: ComposeItem): FormState {
  const normalized = item ? normalizeComposeItem(item) : undefined;

  return {
    mediaAssets: normalized?.mediaAssets ?? [],
    platforms: normalized?.platforms ?? [],
    sharedCaption: normalized?.sharedCaption ?? '',
    pinterestTitle: normalized?.platformFields.pinterest?.title ?? '',
    pinterestDescription: normalized?.platformFields.pinterest?.description ?? '',
    pinterestBoard: normalized?.platformFields.pinterest?.board ?? '',
    youtubeTitle: normalized?.platformFields.youtube?.title ?? '',
    youtubeDescription: normalized?.platformFields.youtube?.description ?? '',
    youtubePlaylist: normalized?.platformFields.youtube?.playlist ?? '',
  };
}

function toIsoSchedule(date?: Date, time?: string) {
  if (!date || !time) return undefined;
  const [hours, minutes] = time.split(':').map(Number);
  const scheduled = new Date(date);
  scheduled.setHours(hours || 0, minutes || 0, 0, 0);
  return scheduled.toISOString();
}

function formatBytes(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function buildItemTitle(formState: FormState) {
  return (
    formState.youtubeTitle ||
    formState.pinterestTitle ||
    buildComposeItemTitleFromAssets(formState.mediaAssets, '') ||
    formState.sharedCaption.slice(0, 42) ||
    'Untitled compose item'
  );
}

function getPlatformCardTone(isSelected: boolean, supported: boolean, connected: boolean) {
  if (!connected) {
    return 'border-gray-200 bg-white text-gray-700 opacity-45 dark:border-[#333333] dark:bg-[#000000] dark:text-[#9CA3AF]';
  }
  if (isSelected && supported) return 'border-[#ec1e24] bg-[#ec1e24]/10 text-[#ec1e24] shadow-[0_0_0_1px_rgba(236,30,36,0.25)]';
  if (isSelected && !supported) return 'border-[#ec1e24] bg-[#ec1e24]/5 text-[#ec1e24] shadow-[0_0_0_1px_rgba(236,30,36,0.25)]';
  return 'border-gray-200 bg-white text-gray-700 dark:border-[#333333] dark:bg-[#000000] dark:text-white hover:border-[#ec1e24]/60 hover:text-[#ec1e24] dark:hover:bg-[#111111]';
}

export function ComposeEditorPage({
  onNavigate,
  previousPage,
  registerCloseRequestHandler,
}: ComposeEditorPageProps) {
  const { activeItemId, getItemById, saveItem } = useComposeStore();
  const { addNotification } = useNotifications();
  const existingItem = getItemById(activeItemId);
  const [formState, setFormState] = useState<FormState>(() => createInitialForm(existingItem));
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<ComposeMediaAsset | null>(null);
  const [youtubePlaylists, setYouTubePlaylists] = useState<YouTubePlaylist[]>([]);
  const [isLoadingYouTubePlaylists, setIsLoadingYouTubePlaylists] = useState(false);
  const [hasLoadedYouTubePlaylists, setHasLoadedYouTubePlaylists] = useState(false);
  const [youtubePlaylistError, setYouTubePlaylistError] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(
    existingItem?.scheduledAt ? new Date(existingItem.scheduledAt) : undefined,
  );
  const [scheduleTime, setScheduleTime] = useState(
    existingItem?.scheduledAt ? new Date(existingItem.scheduledAt).toISOString().slice(11, 16) : '09:00',
  );

  const connectedPlatforms = useMemo(
    () => new Set(getConnectedPlatforms().map((platform) => platform.toLowerCase())),
    [],
  );
  const mediaSummary = useMemo(() => summarizeComposeMedia(formState.mediaAssets), [formState.mediaAssets]);
  const compatibilityMap = useMemo(() => getComposeCompatibilityMap(formState.mediaAssets), [formState.mediaAssets]);
  const hasSharedCaptionPlatform = formState.platforms.some((platform) => SHARED_CAPTION_PLATFORMS.includes(platform));
  const selectedPlatformIssues = formState.platforms.map((platform) => compatibilityMap[platform]).filter((entry) => !entry.supported);
  const hasUploadingAssets = formState.mediaAssets.some((asset) => asset.uploadStatus === 'uploading');
  const hasFailedAssets = formState.mediaAssets.some((asset) => asset.uploadStatus === 'failed');
  const isYouTubeSelected = formState.platforms.includes('youtube');
  const hasYouTubeConnection = connectedPlatforms.has('youtube');
  const hasMatchingYouTubePlaylist = youtubePlaylists.some((playlist) => playlist.title === formState.youtubePlaylist);
  const initialFormSnapshot = useMemo(() => JSON.stringify(createInitialForm(existingItem)), [existingItem]);
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(formState) !== initialFormSnapshot,
    [formState, initialFormSnapshot],
  );
  const unsavedChangesGuard = useUnsavedBackGuard({
    isDirty: hasUnsavedChanges,
    title: 'Discard post changes?',
    description: 'You have unsaved changes in this post editor. Leaving now will lose them.',
  });

  useEffect(() => {
    if (!registerCloseRequestHandler) {
      return;
    }

    registerCloseRequestHandler(() => {
      if (!hasUnsavedChanges) {
        return false;
      }

      return unsavedChangesGuard.guardAction(() => {
        onNavigate(previousPage || 'create');
      });
    });

    return () => {
      registerCloseRequestHandler(null);
    };
  }, [hasUnsavedChanges, onNavigate, previousPage, registerCloseRequestHandler, unsavedChangesGuard]);

  useEffect(() => {
    setFormState(createInitialForm(existingItem));
    setScheduleDate(existingItem?.scheduledAt ? new Date(existingItem.scheduledAt) : undefined);
    setScheduleTime(
      existingItem?.scheduledAt ? new Date(existingItem.scheduledAt).toISOString().slice(11, 16) : '09:00',
    );
  }, [activeItemId, existingItem]);

  useBackEntry({
    enabled: hasUnsavedChanges,
    priority: 100,
    onBack: (source) => {
      if (source !== 'system') {
        return false;
      }

      return unsavedChangesGuard.guardAction(() => {
        onNavigate(previousPage || 'create');
      });
    },
  });

  useEffect(() => {
    if (!isYouTubeSelected || !hasYouTubeConnection || hasLoadedYouTubePlaylists) {
      return;
    }

    let isActive = true;
    setIsLoadingYouTubePlaylists(true);
    setYouTubePlaylistError(null);

    void fetchYouTubePlaylists()
      .then((playlists) => {
        if (!isActive) {
          return;
        }

        setYouTubePlaylists(playlists);
        setHasLoadedYouTubePlaylists(true);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Failed to load YouTube playlists';
        setYouTubePlaylistError(message);
        toast.error(message);
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingYouTubePlaylists(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [hasLoadedYouTubePlaylists, hasYouTubeConnection, isYouTubeSelected]);

  const updateAsset = (assetId: string, updater: (asset: ComposeMediaAsset) => ComposeMediaAsset) => {
    setFormState((current) => ({
      ...current,
      mediaAssets: current.mediaAssets.map((asset) => (asset.id === assetId ? updater(asset) : asset)),
    }));
  };

  const handleMediaSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
    );
    if (!files.length) return;

    event.target.value = '';
    const pendingAssets = files.map((file, index) => buildComposeMediaAsset(file, formState.mediaAssets.length + index));

    setFormState((current) => ({
      ...current,
      mediaAssets: [...current.mediaAssets, ...pendingAssets],
    }));
    setIsUploadingMedia(true);

    await Promise.all(
      pendingAssets.map(async (asset, index) => {
        const file = files[index];

        try {
          const uploaded = await uploadComposeAsset(file);
          updateAsset(asset.id, (currentAsset) => ({
            ...currentAsset,
            previewUrl: uploaded.previewUrl || currentAsset.previewUrl,
            storageUrl: uploaded.url,
            storageFileId: uploaded.fileId,
            uploadStatus: 'uploaded',
            uploadError: undefined,
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Upload failed';

          if (message.toLowerCase().includes('not configured')) {
            const localPreviewUrl = file.type.startsWith('image/') ? await readFileAsDataUrl(file) : asset.previewUrl;
            updateAsset(asset.id, (currentAsset) => ({
              ...currentAsset,
              previewUrl: localPreviewUrl || currentAsset.previewUrl,
              storageUrl: undefined,
              storageFileId: undefined,
              uploadStatus: 'idle',
              uploadError: undefined,
            }));
            return;
          }

          updateAsset(asset.id, (currentAsset) => ({
            ...currentAsset,
            uploadStatus: 'failed',
            uploadError: message,
          }));
          toast.error(message);
        }
      }),
    );

    setIsUploadingMedia(false);
  };

  const removeAsset = (assetId: string) => {
    setFormState((current) => ({
      ...current,
      mediaAssets: current.mediaAssets
        .filter((asset) => asset.id !== assetId)
        .map((asset, index) => ({ ...asset, order: index })),
    }));
  };

  const handlePreviewAsset = (asset: ComposeMediaAsset) => {
    const previewUrl = getComposeAssetPreviewUrl(asset);
    if (!previewUrl) {
      return;
    }

    haptics.light();
    setPreviewAsset(asset);
  };

  const togglePlatform = (platform: ComposePlatformKey, connected: boolean) => {
    if (!connected) return;

    const compatibility = compatibilityMap[platform];
    const isSelected = formState.platforms.includes(platform);
    if (!isSelected && !compatibility.supported) {
      toast.error(compatibility.reason || `This media set is not supported for ${platform}.`);
      return;
    }

    setFormState((current) => ({
      ...current,
      platforms: isSelected
        ? current.platforms.filter((entry) => entry !== platform)
        : [...current.platforms, platform],
    }));
  };

  const validate = (mode: 'draft' | 'scheduled' | 'published') => {
    if (!formState.platforms.length) {
      toast.error('Select at least one connected platform');
      return false;
    }
    if ((mode === 'scheduled' || mode === 'published') && mediaSummary.totalAssets === 0) {
      toast.error(`Upload at least one image or video before ${mode === 'published' ? 'publishing' : 'scheduling'}`);
      return false;
    }
    if (hasUploadingAssets) {
      toast.error('Wait for media uploads to finish before saving');
      return false;
    }
    if (hasFailedAssets) {
      toast.error('Remove or re-upload media that failed to upload to Backblaze');
      return false;
    }
    if ((mode === 'scheduled' || mode === 'published') && formState.mediaAssets.some((asset) => !getComposeAssetPublishUrl(asset))) {
      toast.error(`Upload all media to Backblaze before ${mode === 'published' ? 'publishing' : 'scheduling'}`);
      return false;
    }
    if (selectedPlatformIssues.length > 0) {
      toast.error(selectedPlatformIssues[0].reason || 'One or more selected platforms do not support this media set.');
      return false;
    }
    if (hasSharedCaptionPlatform && !formState.sharedCaption.trim()) {
      toast.error('Add a shared caption for the selected platforms');
      return false;
    }
    if (
      formState.platforms.includes('pinterest') &&
      (!formState.pinterestTitle.trim() || !formState.pinterestDescription.trim() || !formState.pinterestBoard)
    ) {
      toast.error('Complete the Pinterest fields before saving');
      return false;
    }
    if (
      formState.platforms.includes('youtube') &&
      (!formState.youtubeTitle.trim() || !formState.youtubeDescription.trim() || !formState.youtubePlaylist)
    ) {
      toast.error('Complete the YouTube fields before saving');
      return false;
    }
    if (mode === 'scheduled' && !toIsoSchedule(scheduleDate, scheduleTime)) {
      toast.error('Choose a date and time for the scheduled post');
      return false;
    }
    return true;
  };

  const buildItem = (status: ComposeItem['status'], scheduledAt?: string, error?: string): ComposeItem => {
    const now = new Date().toISOString();
    return {
      id: existingItem?.id || `compose-${Date.now()}`,
      title: buildItemTitle(formState),
      status,
      mediaAssets: formState.mediaAssets,
      platforms: formState.platforms,
      sharedCaption: formState.sharedCaption,
      platformFields: {
        pinterest: formState.platforms.includes('pinterest')
          ? {
              title: formState.pinterestTitle,
              description: formState.pinterestDescription,
              board: formState.pinterestBoard,
            }
          : undefined,
        youtube: formState.platforms.includes('youtube')
          ? {
              title: formState.youtubeTitle,
              description: formState.youtubeDescription,
              playlist: formState.youtubePlaylist,
            }
          : undefined,
      },
      createdAt: existingItem?.createdAt || now,
      updatedAt: now,
      scheduledAt,
      error,
    };
  };

  const handleSaveDraft = () => {
    if (!validate('draft')) return;
    const nextItem = buildItem('draft');
    saveItem(nextItem);
    addNotification(buildComposeDraftNotification(nextItem, existingItem ? 'updated' : 'created'));
    toast.success(existingItem ? 'Post draft updated' : 'Post draft saved');
    onNavigate('create', previousPage || 'create');
  };

  const handleSchedule = () => {
    if (!validate('scheduled')) return;
    const scheduledAt = toIsoSchedule(scheduleDate, scheduleTime);
    if (!scheduledAt) {
      toast.error('Choose a date and time for the scheduled post');
      return;
    }

    const nextItem = buildItem('scheduled', scheduledAt);
    saveItem(nextItem);
    addNotification(buildComposeScheduledNotification(nextItem, scheduledAt));
    setIsScheduleOpen(false);
    toast.success('Post scheduled');
    onNavigate('create', previousPage || 'create');
  };

  const handlePublish = async () => {
    if (!validate('published')) return;
    setIsPublishing(true);

    const draftItem = buildItem('draft');

    try {
      const result = await publishComposeItem(draftItem);
      const nextStatus = result.postedPlatforms.length > 0 ? 'published' : 'failed';
      const nextError =
        result.failedResults.length > 0 ? result.errorMessage || 'Some platforms failed to publish.' : undefined;

      const nextItem = buildItem(nextStatus, undefined, nextError);
      saveItem(nextItem);

      if (result.postedPlatforms.length > 0) {
        addNotification(buildComposePublishSuccessNotification(nextItem, result));
        toast.success(
          result.failedResults.length > 0
            ? `Published to ${result.postedPlatforms.join(', ')}.`
            : `Published to ${result.postedPlatforms.join(', ')}.`,
        );
      } else {
        addNotification(buildComposePublishFailureNotification(nextItem, nextError || 'Failed to publish post'));
        toast.error(nextError || 'Failed to publish post');
      }

      onNavigate('create', previousPage || 'create');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to publish post';
      const failedItem = buildItem('failed', undefined, message);
      saveItem(failedItem);
      addNotification(buildComposePublishFailureNotification(failedItem, message));
      toast.error(message);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start gap-4">
        <BackIconButton
          onClick={() => {
            unsavedChangesGuard.guardAction(() => {
              onNavigate(previousPage || 'create');
            });
          }}
          className="mt-1 -ml-2 p-2 text-gray-900 hover:text-[#ec1e24] dark:text-white"
        />
        <div className="flex-1">
          <h1 className="text-gray-900 dark:text-white mb-2">
            {existingItem ? 'Edit Post' : 'Add Post'}
          </h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">
            Build one post with one or more media assets, platform-aware delivery, and a saved or scheduled state.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
            <div className="mb-4 space-y-3">
              <div>
                <h3 className="mb-1 text-gray-900 dark:text-white">Media Upload</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  Upload images or videos. Platform cards below show what works as a single post or carousel.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="compose-media" className="cursor-pointer">
                  <span className="sr-only">Upload media</span>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]">
                    {isUploadingMedia ? (
                      <RedSpinner size="sm" label="Uploading media..." />
                    ) : (
                      <Upload className="h-4 w-4 text-[#ec1e24]" />
                    )}
                    Upload
                  </div>
                </Label>
                <input id="compose-media" type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaSelected} />
              </div>
            </div>
            {formState.mediaAssets.length > 0 ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                    <span className="rounded-full bg-gray-200 px-3 py-1 text-gray-700 dark:bg-[#1F1F1F] dark:text-[#9CA3AF]">
                      {mediaSummary.totalAssets} item{mediaSummary.totalAssets === 1 ? '' : 's'}
                    </span>
                    <span>{mediaSummary.imageCount} image{mediaSummary.imageCount === 1 ? '' : 's'}</span>
                    <span>{mediaSummary.videoCount} video{mediaSummary.videoCount === 1 ? '' : 's'}</span>
                    <span>
                      Delivery:{' '}
                      {mediaSummary.kind === 'multi-image' || mediaSummary.kind === 'multi-video' || mediaSummary.kind === 'mixed-media'
                        ? 'Carousel or collection'
                        : 'Single asset'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {formState.mediaAssets.map((asset) => (
                    <div key={asset.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-[#333333] dark:bg-[#050505]">
                      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-[#333333]">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-gray-900 dark:text-white">{asset.fileName}</p>
                          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                            {asset.mimeType} | {formatBytes(asset.size)}
                          </p>
                          <p
                            className={`mt-1 text-[11px] ${
                              asset.uploadStatus === 'failed'
                                ? 'text-[#EF4444]'
                                : asset.uploadStatus === 'uploaded'
                                  ? 'text-[#10B981]'
                                  : asset.uploadStatus === 'idle'
                                    ? 'text-[#6B7280] dark:text-[#9CA3AF]'
                                  : 'text-[#6B7280] dark:text-[#9CA3AF]'
                            }`}
                          >
                            {asset.uploadStatus === 'failed'
                              ? asset.uploadError || 'Backblaze upload failed'
                              : asset.uploadStatus === 'uploaded'
                                ? 'Stored in Backblaze'
                                : asset.uploadStatus === 'idle'
                                  ? 'Stored locally'
                                : (
                                  <span className="inline-flex items-center gap-2">
                                    <RedSpinner size="sm" label={`Uploading ${asset.fileName} to Backblaze...`} />
                                    Backblaze
                                  </span>
                                )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAsset(asset.id)}
                          className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-white dark:border-[#333333] dark:text-[#9CA3AF] dark:hover:bg-[#111111]"
                          aria-label={`Remove ${asset.fileName}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {getComposeAssetPreviewUrl(asset) ? (
                        <button
                          type="button"
                          onClick={() => handlePreviewAsset(asset)}
                          className="group relative block w-full bg-black text-left"
                          aria-label={`Preview ${asset.kind} ${asset.fileName}`}
                        >
                          {asset.kind === 'video' ? (
                            <>
                              <video
                                src={getComposeAssetPreviewUrl(asset)}
                                className="pointer-events-none h-48 w-full object-contain"
                                muted
                                playsInline
                                preload="metadata"
                              />
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                                  <Film className="h-5 w-5" />
                                </div>
                              </div>
                            </>
                          ) : (
                            <img
                              src={getComposeAssetPreviewUrl(asset)}
                              alt={asset.fileName}
                              className="pointer-events-none h-48 w-full object-cover"
                            />
                          )}
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-4 py-3">
                            <p className="text-xs font-medium text-white">
                              Tap to preview {asset.kind === 'video' ? 'video' : 'image'}
                            </p>
                          </div>
                        </button>
                      ) : (
                        <div className="flex h-48 items-center justify-center bg-black">
                          {asset.kind === 'video' ? <Film className="h-8 w-8 text-white/70" /> : <ImageIcon className="h-8 w-8 text-white/70" />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center dark:border-[#333333]">
                <p className="mb-1 text-gray-900 dark:text-white">No media added yet</p>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Upload images, videos, or a mixed set to prepare platform-specific delivery.</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
            <h3 className="mb-1 text-gray-900 dark:text-white">Platform Selection</h3>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {COMPOSE_PLATFORM_OPTIONS.map((platform) => {
                const Icon = PLATFORM_ICONS[platform.id];
                const iconSizeClass = PLATFORM_ICON_SIZES[platform.id];
                const compatibility = compatibilityMap[platform.id];
                const isSelected = formState.platforms.includes(platform.id);
                const connected = connectedPlatforms.has(platform.connectionKey.toLowerCase());

                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id, connected)}
                    disabled={!connected}
                    aria-label={platform.label}
                    title={platform.label}
                    className={`aspect-square rounded-2xl border transition-all ${getPlatformCardTone(
                      isSelected,
                      compatibility.supported,
                      connected,
                    )}`}
                  >
                    <div className="flex h-full w-full items-center justify-center">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
                        isSelected ? 'bg-[#ec1e24]/10 text-[#ec1e24]' : 'bg-gray-100 text-current dark:bg-[#111111]'
                      }`}>
                        <Icon className={iconSizeClass} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
            <div className="mb-4">
              <div>
                <h3 className="mb-1 text-gray-900 dark:text-white">Shared Caption</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Write the caption manually for Instagram, Facebook, Threads, X, and TikTok in this flow.</p>
              </div>
            </div>
            <Textarea
              value={formState.sharedCaption}
              onChange={(event) => {
                setFormState((current) => ({ ...current, sharedCaption: event.target.value }));
                haptics.selection();
              }}
              onFocus={() => haptics.light()}
              placeholder="Write the shared caption"
              className="min-h-[180px] border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]"
            />
          </div>

          {formState.platforms.includes('pinterest') ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
              <h3 className="mb-4 text-gray-900 dark:text-white">Pinterest Fields</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Title</Label>
                  <Input value={formState.pinterestTitle} onChange={(event) => setFormState((current) => ({ ...current, pinterestTitle: event.target.value }))} className="mt-1 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]" />
                </div>
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Description</Label>
                  <Textarea value={formState.pinterestDescription} onChange={(event) => setFormState((current) => ({ ...current, pinterestDescription: event.target.value }))} className="mt-1 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]" />
                </div>
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Board</Label>
                  <Select value={formState.pinterestBoard} onValueChange={(value) => setFormState((current) => ({ ...current, pinterestBoard: value }))}>
                    <SelectTrigger className="mt-1 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]">
                      <SelectValue placeholder="Select a board" />
                    </SelectTrigger>
                    <SelectContent>
                      {PINTEREST_BOARDS.map((board) => (
                        <SelectItem key={board} value={board}>
                          {board}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}

          {formState.platforms.includes('youtube') ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
              <h3 className="mb-4 text-gray-900 dark:text-white">YouTube Fields</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Title</Label>
                  <Input value={formState.youtubeTitle} onChange={(event) => setFormState((current) => ({ ...current, youtubeTitle: event.target.value }))} className="mt-1 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]" />
                </div>
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Description</Label>
                  <Textarea value={formState.youtubeDescription} onChange={(event) => setFormState((current) => ({ ...current, youtubeDescription: event.target.value }))} className="mt-1 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]" />
                </div>
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Playlist</Label>
                  <Select value={formState.youtubePlaylist} onValueChange={(value) => setFormState((current) => ({ ...current, youtubePlaylist: value }))}>
                    <SelectTrigger className="mt-1 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]">
                      <SelectValue placeholder="Select a playlist" />
                    </SelectTrigger>
                    <SelectContent>
                      {formState.youtubePlaylist && !hasMatchingYouTubePlaylist && (
                        <SelectItem value={formState.youtubePlaylist}>
                          {formState.youtubePlaylist}
                        </SelectItem>
                      )}
                      {isLoadingYouTubePlaylists && (
                        <SelectItem value="__youtube-playlists-loading" disabled>
                          <div className="flex w-full items-center justify-center py-1">
                            <RedSpinner size="sm" label="Loading YouTube playlists..." />
                          </div>
                        </SelectItem>
                      )}
                      {!isLoadingYouTubePlaylists && youtubePlaylists.length === 0 && (
                        <SelectItem value="__youtube-playlists-empty" disabled>
                          No channel playlists found
                        </SelectItem>
                      )}
                      {youtubePlaylists.map((playlist) => (
                        <SelectItem key={playlist.id} value={playlist.title}>
                          {playlist.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {youtubePlaylistError ? (
                    <p className="mt-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">{youtubePlaylistError}</p>
                  ) : isLoadingYouTubePlaylists ? (
                    <PageLoader size="sm" className="mt-2 h-auto justify-start py-1" label="Loading YouTube playlists..." />
                  ) : (
                    <p className="mt-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      {youtubePlaylists.length > 0
                        ? 'Showing playlists from your connected YouTube channel.'
                        : 'Connect YouTube and create channel playlists to choose from them here.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
            <h3 className="mb-4 text-gray-900 dark:text-white">Save State</h3>
            <div className="space-y-3">
              <Button className="w-full" onClick={handleSaveDraft} disabled={hasUploadingAssets || isUploadingMedia}>Save</Button>
              <Button className="w-full" onClick={handlePublish} disabled={hasUploadingAssets || isUploadingMedia || isPublishing}>
                {isPublishing ? (
                  <>
                    <RedSpinner size="sm" className="mr-2" label="Publishing post..." />
                    Publish
                  </>
                ) : 'Publish'}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setIsScheduleOpen(true)} disabled={hasUploadingAssets || isUploadingMedia}>Schedule</Button>
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
              <p className="mb-1 text-sm text-gray-900 dark:text-white">Media Set</p>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                {mediaSummary.totalAssets > 0
                  ? `${mediaSummary.totalAssets} assets selected (${mediaSummary.imageCount} image${mediaSummary.imageCount === 1 ? '' : 's'}, ${mediaSummary.videoCount} video${mediaSummary.videoCount === 1 ? '' : 's'})`
                  : 'No media selected yet'}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
              <p className="mb-1 text-sm text-gray-900 dark:text-white">Selected Platforms</p>
              <div className="flex flex-wrap gap-2">
                {formState.platforms.length ? (
                  formState.platforms.map((platform) => {
                    const Icon = PLATFORM_ICONS[platform];
                    const iconSizeClass = PLATFORM_ICON_SIZES[platform];

                    return (
                      <span
                        key={platform}
                        title={COMPOSE_PLATFORM_OPTIONS.find((option) => option.id === platform)?.label ?? platform}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#ec1e24]/30 bg-[#ec1e24]/8 text-[#ec1e24]"
                      >
                        <Icon className={iconSizeClass} />
                      </span>
                    );
                  })
                ) : (
                  <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">No platform selected yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomSheet open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <BottomSheetHeader>
          <BottomSheetTitle>Schedule Post</BottomSheetTitle>
          <BottomSheetDescription>Choose when this post should move into the scheduled queue.</BottomSheetDescription>
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
          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSchedule}>Schedule</Button>
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
      {unsavedChangesGuard.prompt}
    </div>
  );
}
