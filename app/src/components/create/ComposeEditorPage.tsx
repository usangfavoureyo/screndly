import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Film, Image as ImageIcon, RotateCcw, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { BackIconButton } from '../BackIconButton';
import { MediaPreviewDialog } from '../media/MediaPreviewDialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
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
import { COMPOSE_META_PLATFORM_GROUPS, COMPOSE_PLATFORM_OPTIONS } from '../../config/create';
import {
  buildComposeItemTitleFromAssets,
  buildComposeMediaAsset,
  getComposeCompatibilityMap,
  getComposeAssetPreviewUrl,
  normalizeComposeItem,
  summarizeComposeMedia,
} from '../../lib/create/composeMedia';
import {
  buildComposeAssetSignature,
  generateThreadsXCropVariant,
  shouldOfferThreadsXCrop,
} from '../../lib/create/composeVideoProcessing';
import { getComposePlatformLabel } from '../../lib/create/composePlatforms';
import { publishComposeItem } from '../../lib/create/composePublish';
import { validateComposeItemAction } from '../../lib/create/composeValidation';
import {
  buildComposeDraftNotification,
  buildComposePublishFailureNotification,
  buildComposePublishSuccessNotification,
  buildComposeScheduledNotification,
} from '../../lib/create/composeNotifications';
import { uploadComposeAsset } from '../../lib/create/composeStorage';
import { useComposeStore } from '../../store/useComposeStore';
import type {
  ComposeItem,
  ComposeMediaAsset,
  ComposePlatformKey,
  ComposeProcessedVideoAsset,
  ComposeThumbnailAsset,
} from '../../types/compose';
import { getConnectedPlatforms } from '../../utils/platformConnections';
import { haptics } from '../../utils/haptics';
import { useNotifications } from '../../contexts/NotificationsContext';
import { fetchYouTubePlaylists, type YouTubePlaylist } from '../../lib/api/youtube';
import { useBackEntry } from '../../hooks/useBackEntry';
import { useUnsavedBackGuard } from '../../hooks/useUnsavedBackGuard';
import { PageLoader, RedSpinner } from '../PageLoader';
import { extractVideoMetadata } from '../../utils/videoMetadata';

interface ComposeEditorPageProps {
  isCompactLayout?: boolean;
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
  sharedThumbnail: ComposeThumbnailAsset | null;
  youtubeThumbnail: ComposeThumbnailAsset | null;
  xThumbnail: ComposeThumbnailAsset | null;
  videoCropMode: 'original' | 'threads_x_3_4';
  videoCropFocusYPercent: number;
  threadsXCropVideo: ComposeProcessedVideoAsset | null;
};

const PLATFORM_ICONS = {
  instagram_feed: InstagramIcon,
  instagram_reels: InstagramIcon,
  instagram_stories: InstagramIcon,
  facebook_feed: FacebookIcon,
  facebook_stories: FacebookIcon,
  tiktok: TikTokIcon,
  threads: ThreadsIcon,
  x: XIcon,
  youtube_longform: YouTubeIcon,
  youtube_shorts: YouTubeIcon,
  pinterest: PinterestIcon,
} as const;

const PLATFORM_ICON_SIZES: Record<ComposePlatformKey, string> = {
  instagram_feed: 'w-5.5 h-5.5',
  instagram_reels: 'w-5.5 h-5.5',
  instagram_stories: 'w-5.5 h-5.5',
  facebook_feed: 'w-5.5 h-5.5',
  facebook_stories: 'w-5.5 h-5.5',
  tiktok: 'w-6.5 h-6.5',
  threads: 'w-5 h-5',
  x: 'w-4 h-4',
  youtube_longform: 'w-6 h-6',
  youtube_shorts: 'w-6 h-6',
  pinterest: 'w-5.5 h-5.5',
};

const PINTEREST_BOARDS = ['Movie Picks', 'TV Roundup', 'Campaigns'];

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
    sharedThumbnail: normalized?.platformFields.thumbnails?.shared ?? null,
    youtubeThumbnail: normalized?.platformFields.thumbnails?.youtube ?? null,
    xThumbnail: normalized?.platformFields.thumbnails?.x ?? null,
    videoCropMode: normalized?.platformFields.videoProcessing?.cropMode ?? 'original',
    videoCropFocusYPercent: normalized?.platformFields.videoProcessing?.focusYPercent ?? 50,
    threadsXCropVideo: normalized?.platformFields.videoProcessing?.threadsXCrop ?? null,
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

async function rebuildFileForRetry(asset: ComposeMediaAsset): Promise<File> {
  const previewUrl = asset.previewUrl;
  if (!previewUrl) {
    throw new Error('Retry is unavailable for this media item. Re-upload the file from your device.');
  }

  const response = await fetch(previewUrl);
  if (!response.ok) {
    throw new Error('Retry is unavailable for this media item. Re-upload the file from your device.');
  }

  const blob = await response.blob();
  return new File([blob], asset.fileName, {
    type: asset.mimeType || blob.type || 'application/octet-stream',
    lastModified: Date.now(),
  });
}

function buildItemTitle(formState: FormState) {
  return (
    formState.youtubeTitle ||
    formState.pinterestTitle ||
    buildComposeItemTitleFromAssets(formState.mediaAssets, '') ||
    formState.sharedCaption.slice(0, 42) ||
    'Untitled post'
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
  isCompactLayout = false,
  onNavigate,
  previousPage,
  registerCloseRequestHandler,
}: ComposeEditorPageProps) {
  const { activeItemId, getItemById, saveItem } = useComposeStore();
  const { addNotification } = useNotifications();
  const existingItem = getItemById(activeItemId);
  const [formState, setFormState] = useState<FormState>(() => createInitialForm(existingItem));
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isGeneratingThreadsXCrop, setIsGeneratingThreadsXCrop] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isScheduleDatePickerOpen, setIsScheduleDatePickerOpen] = useState(false);
  const [isScheduleTimePickerOpen, setIsScheduleTimePickerOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<ComposeMediaAsset | null>(null);
  const [previewThumbnail, setPreviewThumbnail] = useState<ComposeThumbnailAsset | null>(null);
  const [youtubePlaylists, setYouTubePlaylists] = useState<YouTubePlaylist[]>([]);
  const [isLoadingYouTubePlaylists, setIsLoadingYouTubePlaylists] = useState(false);
  const [hasLoadedYouTubePlaylists, setHasLoadedYouTubePlaylists] = useState(false);
  const [youtubePlaylistError, setYouTubePlaylistError] = useState<string | null>(null);
  const threadsXAutoGenerateTimeoutRef = useRef<number | null>(null);
  const lastThreadsXAutoGenerateKeyRef = useRef<string>('');
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
  const selectedPlatformIssues = formState.platforms.map((platform) => compatibilityMap[platform]).filter((entry) => !entry.supported);
  const hasUploadingAssets = formState.mediaAssets.some((asset) => asset.uploadStatus === 'uploading');
  const hasFailedAssets = formState.mediaAssets.some((asset) => asset.uploadStatus === 'failed');
  const isSingleVideo = mediaSummary.kind === 'single-video' && formState.mediaAssets[0]?.kind === 'video';
  const primaryVideoAsset = isSingleVideo ? formState.mediaAssets[0] : undefined;
  const canOfferThreadsXCrop = shouldOfferThreadsXCrop(primaryVideoAsset, formState.platforms);
  const isThreadsXCropEnabled = canOfferThreadsXCrop && formState.videoCropMode === 'threads_x_3_4';
  const isThreadsXCropReady =
    isThreadsXCropEnabled &&
    Boolean(formState.threadsXCropVideo) &&
    formState.threadsXCropVideo?.sourceAssetId === primaryVideoAsset?.id &&
    formState.threadsXCropVideo?.sourceSignature === (primaryVideoAsset ? buildComposeAssetSignature(primaryVideoAsset) : '') &&
    formState.threadsXCropVideo?.focusYPercent === formState.videoCropFocusYPercent &&
    formState.threadsXCropVideo?.uploadStatus === 'uploaded';
  const hasUploadingThumbnails = [formState.sharedThumbnail, formState.youtubeThumbnail, formState.xThumbnail]
    .some((thumbnail) => thumbnail?.uploadStatus === 'uploading');
  const hasFailedThumbnails = [formState.sharedThumbnail, formState.youtubeThumbnail, formState.xThumbnail]
    .some((thumbnail) => thumbnail?.uploadStatus === 'failed');
  const isYouTubeLongformSelected = formState.platforms.includes('youtube_longform');
  const isYouTubeShortsSelected = formState.platforms.includes('youtube_shorts');
  const isYouTubeSelected = isYouTubeLongformSelected || isYouTubeShortsSelected;
  const isPinterestSelected = formState.platforms.includes('pinterest');
  const hasYouTubeConnection = connectedPlatforms.has('youtube');
  const hasMatchingYouTubePlaylist = youtubePlaylists.some((playlist) => playlist.title === formState.youtubePlaylist);
  const initialFormSnapshot = useMemo(() => JSON.stringify(createInitialForm(existingItem)), [existingItem]);
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(formState) !== initialFormSnapshot,
    [formState, initialFormSnapshot],
  );
  const activePreviewAssetUrl = useMemo(() => {
    if (!previewAsset) {
      return undefined;
    }

    return getComposeAssetPreviewUrl(previewAsset);
  }, [previewAsset]);
  const isMediaPreviewOpen = Boolean(activePreviewAssetUrl || previewThumbnail);
  const isScheduleInteractionActive = isScheduleOpen || isScheduleDatePickerOpen || isScheduleTimePickerOpen;
  const unsavedChangesGuard = useUnsavedBackGuard({
    isDirty: hasUnsavedChanges,
    title: 'Discard post changes?',
    description: 'You have unsaved changes in this post editor. Leaving now will lose them.',
  });

  const handleEditorCloseRequest = useCallback(() => {
    if (previewAsset) {
      setPreviewAsset(null);
      return true;
    }

    if (previewThumbnail) {
      setPreviewThumbnail(null);
      return true;
    }

    if (unsavedChangesGuard.isPromptOpen) {
      return true;
    }

    if (isScheduleDatePickerOpen || isScheduleTimePickerOpen) {
      return true;
    }

    if (isScheduleOpen) {
      setIsScheduleOpen(false);
      return true;
    }

    return unsavedChangesGuard.guardAction(() => {
      onNavigate(previousPage || 'create');
    });
  }, [
    isScheduleDatePickerOpen,
    isScheduleOpen,
    isScheduleTimePickerOpen,
    onNavigate,
    previousPage,
    previewAsset,
    previewThumbnail,
    unsavedChangesGuard,
  ]);

  const handleScheduleSheetOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && (isScheduleDatePickerOpen || isScheduleTimePickerOpen)) {
      return;
    }

    setIsScheduleOpen(nextOpen);
  }, [isScheduleDatePickerOpen, isScheduleTimePickerOpen]);

  useEffect(() => {
    if (!registerCloseRequestHandler) {
      return;
    }

    registerCloseRequestHandler(handleEditorCloseRequest);

    return () => {
      registerCloseRequestHandler(null);
    };
  }, [
    handleEditorCloseRequest,
    registerCloseRequestHandler,
  ]);

  useEffect(() => {
    setFormState(createInitialForm(existingItem));
    setScheduleDate(existingItem?.scheduledAt ? new Date(existingItem.scheduledAt) : undefined);
    setScheduleTime(
      existingItem?.scheduledAt ? new Date(existingItem.scheduledAt).toISOString().slice(11, 16) : '09:00',
    );
  }, [activeItemId, existingItem]);

  useEffect(() => {
    if (canOfferThreadsXCrop || formState.videoCropMode === 'original') {
      return;
    }

    setFormState((current) => ({
      ...current,
      videoCropMode: 'original',
    }));
  }, [canOfferThreadsXCrop, formState.videoCropMode]);

  useEffect(() => {
    if (isThreadsXCropEnabled) {
      return;
    }

    lastThreadsXAutoGenerateKeyRef.current = '';
    if (threadsXAutoGenerateTimeoutRef.current) {
      window.clearTimeout(threadsXAutoGenerateTimeoutRef.current);
      threadsXAutoGenerateTimeoutRef.current = null;
    }
  }, [isThreadsXCropEnabled]);

  useEffect(() => {
    if (threadsXAutoGenerateTimeoutRef.current) {
      window.clearTimeout(threadsXAutoGenerateTimeoutRef.current);
      threadsXAutoGenerateTimeoutRef.current = null;
    }

    if (!isThreadsXCropEnabled || !primaryVideoAsset || isThreadsXCropReady || isGeneratingThreadsXCrop) {
      return;
    }

    const generationKey = [
      primaryVideoAsset.id,
      buildComposeAssetSignature(primaryVideoAsset),
      formState.videoCropFocusYPercent,
      formState.videoCropMode,
    ].join('|');

    if (lastThreadsXAutoGenerateKeyRef.current === generationKey) {
      return;
    }

    threadsXAutoGenerateTimeoutRef.current = window.setTimeout(() => {
      lastThreadsXAutoGenerateKeyRef.current = generationKey;
      void runThreadsXCropGeneration(primaryVideoAsset, formState.videoCropFocusYPercent, { silent: true });
    }, 600);

    return () => {
      if (threadsXAutoGenerateTimeoutRef.current) {
        window.clearTimeout(threadsXAutoGenerateTimeoutRef.current);
        threadsXAutoGenerateTimeoutRef.current = null;
      }
    };
  }, [
    formState.videoCropFocusYPercent,
    formState.videoCropMode,
    isGeneratingThreadsXCrop,
    isThreadsXCropEnabled,
    isThreadsXCropReady,
    primaryVideoAsset,
  ]);

  useBackEntry({
    enabled: (hasUnsavedChanges || isScheduleInteractionActive || isMediaPreviewOpen) && !unsavedChangesGuard.isPromptOpen,
    priority: 100,
    onBack: () => handleEditorCloseRequest(),
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

  const updateThumbnail = (
    key: 'sharedThumbnail' | 'youtubeThumbnail' | 'xThumbnail',
    updater: (thumbnail: ComposeThumbnailAsset | null) => ComposeThumbnailAsset | null,
  ) => {
    setFormState((current) => ({
      ...current,
      [key]: updater(current[key]),
    }));
  };

  const handleMediaSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
    );
    if (!files.length) return;

    event.target.value = '';
    const pendingAssets = await Promise.all(
      files.map(async (file, index) => {
        if (!file.type.startsWith('video/')) {
          return buildComposeMediaAsset(file, formState.mediaAssets.length + index);
        }

        try {
          const metadata = await extractVideoMetadata(file);
          return buildComposeMediaAsset(file, formState.mediaAssets.length + index, {
            width: metadata.width,
            height: metadata.height,
            aspectRatioValue: metadata.aspectRatioValue,
            aspectRatioLabel: metadata.aspectRatioLabel,
          });
        } catch {
          return buildComposeMediaAsset(file, formState.mediaAssets.length + index);
        }
      }),
    );

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

  const handleThumbnailSelected = async (
    event: ChangeEvent<HTMLInputElement>,
    key: 'sharedThumbnail' | 'youtubeThumbnail' | 'xThumbnail',
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Upload an image file for the thumbnail.');
      event.target.value = '';
      return;
    }

    event.target.value = '';
    let previewUrl: string | undefined;
    try {
      previewUrl = await readFileAsDataUrl(file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to read thumbnail.');
    }

    updateThumbnail(key, () => ({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      previewUrl,
      uploadStatus: 'uploading',
    }));

    try {
      const uploaded = await uploadComposeAsset(file);
      updateThumbnail(key, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          previewUrl: uploaded.previewUrl || current.previewUrl,
          storageUrl: uploaded.url,
          storageFileId: uploaded.fileId,
          uploadStatus: 'uploaded',
          uploadError: undefined,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';

      if (message.toLowerCase().includes('not configured')) {
        updateThumbnail(key, (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            storageUrl: undefined,
            storageFileId: undefined,
            uploadStatus: 'idle',
            uploadError: undefined,
          };
        });
        return;
      }

      updateThumbnail(key, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          uploadStatus: 'failed',
          uploadError: message,
        };
      });
      toast.error(message);
    }
  };

  const removeThumbnail = (key: 'sharedThumbnail' | 'youtubeThumbnail' | 'xThumbnail') => {
    updateThumbnail(key, () => null);
  };

  const removeAsset = (assetId: string) => {
    setFormState((current) => ({
      ...current,
      mediaAssets: current.mediaAssets
        .filter((asset) => asset.id !== assetId)
        .map((asset, index) => ({ ...asset, order: index })),
      threadsXCropVideo:
        current.threadsXCropVideo?.sourceAssetId === assetId ? null : current.threadsXCropVideo,
    }));
  };

  const retryAssetUpload = async (asset: ComposeMediaAsset) => {
    updateAsset(asset.id, (currentAsset) => ({
      ...currentAsset,
      uploadStatus: 'uploading',
      uploadError: undefined,
    }));

    try {
      const file = await rebuildFileForRetry(asset);
      const uploaded = await uploadComposeAsset(file);
      updateAsset(asset.id, (currentAsset) => ({
        ...currentAsset,
        previewUrl: uploaded.previewUrl || currentAsset.previewUrl,
        storageUrl: uploaded.url,
        storageFileId: uploaded.fileId,
        uploadStatus: 'uploaded',
        uploadError: undefined,
      }));
      toast.success(`Retried ${asset.fileName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      updateAsset(asset.id, (currentAsset) => ({
        ...currentAsset,
        uploadStatus: 'failed',
        uploadError: message,
      }));
      toast.error(message);
    }
  };

  const runThreadsXCropGeneration = async (
    asset: ComposeMediaAsset,
    focusYPercent: number,
    options?: { silent?: boolean },
  ) => {
    setIsGeneratingThreadsXCrop(true);
    setFormState((current) => ({
      ...current,
      threadsXCropVideo: current.threadsXCropVideo
        ? { ...current.threadsXCropVideo, uploadStatus: 'uploading', uploadError: undefined }
        : null,
    }));

    try {
      const variant = await generateThreadsXCropVariant(asset, focusYPercent, (_, message) => {
        if (message && !options?.silent) {
          toast.dismiss('threads-x-crop-progress');
          toast.loading(message, { id: 'threads-x-crop-progress' });
        }
      });

      toast.dismiss('threads-x-crop-progress');
      setFormState((current) => ({
        ...current,
        threadsXCropVideo: variant,
      }));

      if (!options?.silent) {
        toast.success('3:4 video prepared for Threads and X.');
      }
    } catch (error) {
      toast.dismiss('threads-x-crop-progress');
      const message = error instanceof Error ? error.message : 'Failed to generate the 3:4 crop.';
      setFormState((current) => ({
        ...current,
        threadsXCropVideo: current.threadsXCropVideo
          ? { ...current.threadsXCropVideo, uploadStatus: 'failed', uploadError: message }
          : null,
      }));
      toast.error(message);
    } finally {
      setIsGeneratingThreadsXCrop(false);
    }
  };

  const handleGenerateThreadsXCrop = async () => {
    if (!primaryVideoAsset) {
      toast.error('Upload a single 9:16 video before generating a 3:4 crop.');
      return;
    }

    await runThreadsXCropGeneration(primaryVideoAsset, formState.videoCropFocusYPercent);
  };

  const handlePreviewAsset = (asset: ComposeMediaAsset) => {
    const previewUrl = getComposeAssetPreviewUrl(asset);
    if (!previewUrl) {
      return;
    }

    haptics.light();
    setPreviewThumbnail(null);
    setPreviewAsset(asset);
  };

  const handlePreviewThumbnail = (thumbnail: ComposeThumbnailAsset) => {
    const previewUrl = thumbnail.previewUrl || thumbnail.storageUrl;
    if (!previewUrl) {
      return;
    }

    haptics.light();
    setPreviewAsset(null);
    setPreviewThumbnail({ ...thumbnail });
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
        pinterest: isPinterestSelected
          ? {
              title: formState.pinterestTitle,
              description: formState.pinterestDescription,
              board: formState.pinterestBoard,
            }
          : undefined,
        youtube: isYouTubeSelected
          ? {
              title: formState.youtubeTitle,
              description: formState.youtubeDescription,
              playlist: formState.youtubePlaylist,
            }
          : undefined,
        thumbnails: {
          shared: formState.sharedThumbnail ?? undefined,
          youtube: formState.youtubeThumbnail ?? undefined,
          x: formState.xThumbnail ?? undefined,
        },
        videoProcessing: isSingleVideo
          ? {
              cropMode: formState.videoCropMode,
              focusYPercent: formState.videoCropFocusYPercent,
              threadsXCrop: formState.threadsXCropVideo ?? undefined,
            }
          : undefined,
      },
      createdAt: existingItem?.createdAt || now,
      updatedAt: now,
      scheduledAt,
      error,
    };
  };

  const scheduledAtPreview = toIsoSchedule(scheduleDate, scheduleTime);
  const scheduleValidation = validateComposeItemAction(
    buildItem('scheduled', scheduledAtPreview, existingItem?.error),
    {
      mode: 'scheduled',
      scheduledAt: scheduledAtPreview,
    },
  );

  const validate = (mode: 'draft' | 'scheduled' | 'published') => {
    if (isGeneratingThreadsXCrop) {
      toast.error('Wait for the Threads/X 3:4 crop to finish generating.');
      return false;
    }

    const scheduledAt = mode === 'scheduled' ? scheduledAtPreview : undefined;
    const validation = mode === 'scheduled'
      ? scheduleValidation
      : validateComposeItemAction(buildItem(mode, scheduledAt, existingItem?.error), {
          mode,
          scheduledAt,
        });
    if (!validation.ok) {
      toast.error(validation.error);
      return false;
    }

    return true;
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
    toast.success(existingItem?.status === 'scheduled' ? 'Schedule updated' : 'Post scheduled');
    onNavigate('create', previousPage || 'create');
  };

  const isEditingScheduledItem = existingItem?.status === 'scheduled';

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
          onClick={handleEditorCloseRequest}
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

      <div className={`grid grid-cols-1 gap-6 ${isCompactLayout ? '' : 'xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]'}`}>
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

                <div className={`grid grid-cols-1 gap-3 ${isCompactLayout ? '' : 'md:grid-cols-2'}`}>
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
                        <div className="flex items-center gap-2">
                          {asset.uploadStatus === 'failed' ? (
                            <button
                              type="button"
                              onClick={() => void retryAssetUpload(asset)}
                              className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-white dark:border-[#333333] dark:text-[#9CA3AF] dark:hover:bg-[#111111]"
                              aria-label={`Retry upload for ${asset.fileName}`}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => removeAsset(asset.id)}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-white dark:border-[#333333] dark:text-[#9CA3AF] dark:hover:bg-[#111111]"
                            aria-label={`Remove ${asset.fileName}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
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

          {isSingleVideo ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
              <div className="mb-4">
                <h3 className="mb-1 text-gray-900 dark:text-white">Video Thumbnails</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  Add optional thumbnails for a single-video post. Shared thumbnail is used for Facebook, Instagram, Threads, and TikTok.
                </p>
              </div>

              <div className={`grid gap-4 ${isCompactLayout ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
                {[
                  {
                    key: 'sharedThumbnail' as const,
                    label: 'Shared Thumbnail',
                    description: 'Facebook, Instagram, Threads, TikTok',
                  },
                  {
                    key: 'youtubeThumbnail' as const,
                    label: 'YouTube Thumbnail',
                    description: 'YouTube only',
                  },
                  {
                    key: 'xThumbnail' as const,
                    label: 'X Thumbnail',
                    description: 'X only',
                  },
                ].map(({ key, label, description }) => {
                  const thumbnail = formState[key];
                  const previewUrl = thumbnail?.previewUrl || thumbnail?.storageUrl;

                  return (
                    <div key={key} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{description}</p>
                        </div>
                        {thumbnail ? (
                          <button
                            type="button"
                            onClick={() => removeThumbnail(key)}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-white dark:border-[#333333] dark:text-[#9CA3AF] dark:hover:bg-[#111111]"
                            aria-label={`Remove ${label}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <Label htmlFor={`compose-thumbnail-${key}`} className="cursor-pointer">
                          <span className="sr-only">Upload {label}</span>
                          <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]">
                            {thumbnail?.uploadStatus === 'uploading' ? (
                              <RedSpinner size="sm" label="Uploading thumbnail..." />
                            ) : (
                              <Upload className="h-3.5 w-3.5 text-[#ec1e24]" />
                            )}
                            Upload
                          </div>
                        </Label>
                        <input
                          id={`compose-thumbnail-${key}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => handleThumbnailSelected(event, key)}
                        />
                        {thumbnail ? (
                          <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                            {thumbnail.uploadStatus === 'failed'
                              ? thumbnail.uploadError || 'Upload failed'
                              : thumbnail.uploadStatus === 'uploaded'
                                ? 'Stored in Backblaze'
                                : thumbnail.uploadStatus === 'idle'
                                  ? 'Stored locally'
                                  : 'Uploading...'}
                          </p>
                        ) : (
                          <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">PNG or JPG recommended</p>
                        )}
                      </div>

                      <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-black/90 dark:border-[#333333]">
                        {previewUrl ? (
                          <button
                            type="button"
                            onClick={() => handlePreviewThumbnail(thumbnail)}
                            className="group relative block w-full text-left"
                            aria-label={`Preview ${label}`}
                          >
                            <img
                              src={previewUrl}
                              alt={thumbnail?.fileName || label}
                              className="h-36 w-full object-cover"
                            />
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                                <ImageIcon className="h-4 w-4" />
                              </div>
                            </div>
                          </button>
                        ) : (
                          <div className="flex h-36 items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-white/70" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {canOfferThreadsXCrop ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
              <div className="mb-4">
                <h3 className="mb-1 text-gray-900 dark:text-white">Threads and X Video Crop</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  X currently accepts `3:4`, so a vertical `9:16` upload can use a cropped `3:4` version for Threads and X while the original file stays available for other platforms.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant={formState.videoCropMode === 'original' ? 'default' : 'outline'}
                    onClick={() => setFormState((current) => ({ ...current, videoCropMode: 'original' }))}
                  >
                    Keep Original 9:16
                  </Button>
                  <Button
                    type="button"
                    variant={formState.videoCropMode === 'threads_x_3_4' ? 'default' : 'outline'}
                    onClick={() => setFormState((current) => ({ ...current, videoCropMode: 'threads_x_3_4' }))}
                  >
                    Crop to 3:4 for Threads and X
                  </Button>
                </div>

                {isThreadsXCropEnabled ? (
                  <div className={`grid gap-5 ${isCompactLayout ? 'grid-cols-1' : 'md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]'}`}>
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-black dark:border-[#333333]">
                        <div className="relative aspect-[3/4] w-full overflow-hidden">
                          <video
                            src={getComposeAssetPreviewUrl(primaryVideoAsset)}
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{ objectPosition: `50% ${formState.videoCropFocusYPercent}%` }}
                            muted
                            playsInline
                            preload="metadata"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                        Adjust the crop up or down for end-card logos and titles like the Mortal Kombat II screen you shared.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <Label className="text-gray-600 dark:text-[#9CA3AF]">Vertical Focus</Label>
                          <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                            {formState.videoCropFocusYPercent < 45
                              ? 'Shifted up'
                              : formState.videoCropFocusYPercent > 55
                                ? 'Shifted down'
                                : 'Centered'}
                          </span>
                        </div>
                        <Slider
                          value={[formState.videoCropFocusYPercent]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(values) => {
                            const nextValue = values[0] ?? 50;
                            setFormState((current) => ({
                              ...current,
                              videoCropFocusYPercent: nextValue,
                            }));
                          }}
                        />
                        <div className="mt-2 flex items-center justify-between text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                          <span>Top</span>
                          <span>Center</span>
                          <span>Bottom</span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
                        <p className="text-sm text-gray-900 dark:text-white">
                          {isGeneratingThreadsXCrop
                            ? 'Generating the 3:4 crop for Threads and X...'
                            : isThreadsXCropReady
                              ? '3:4 crop is ready for Threads and X.'
                              : 'The 3:4 crop generates automatically when you enable it or change the framing.'}
                        </p>
                        <p className="mt-1 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                          {formState.threadsXCropVideo?.uploadError
                            ? formState.threadsXCropVideo.uploadError
                            : isThreadsXCropReady
                              ? `Prepared as ${formState.threadsXCropVideo?.fileName}`
                              : 'Wait for the auto-generated variant before scheduling or publishing with this crop enabled.'}
                        </p>
                      </div>

                      <Button
                        type="button"
                        onClick={() => void handleGenerateThreadsXCrop()}
                        disabled={isGeneratingThreadsXCrop || !primaryVideoAsset}
                      >
                        {isGeneratingThreadsXCrop ? 'Generating 3:4 Video...' : isThreadsXCropReady ? 'Regenerate 3:4 Video' : 'Generate Again'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
            <h3 className="mb-1 text-gray-900 dark:text-white">Platform Selection</h3>
            <div className="mt-4 space-y-4">
              {COMPOSE_META_PLATFORM_GROUPS.map((group) => {
                const GroupIcon =
                  group.id === 'instagram'
                    ? InstagramIcon
                    : group.id === 'facebook'
                      ? FacebookIcon
                      : YouTubeIcon;
                const connected = connectedPlatforms.has(group.connectionKey.toLowerCase());

                return (
                  <div
                    key={group.id}
                    className={`rounded-2xl border p-4 transition-all ${
                      connected
                        ? 'border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]'
                        : 'border-gray-200 bg-white/60 opacity-45 dark:border-[#333333] dark:bg-[#000000]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-gray-900 dark:bg-[#111111] dark:text-white">
                          <GroupIcon className="h-5.5 w-5.5" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-900 dark:text-white">{group.label}</p>
                          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{group.helper}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {group.options.map((option) => {
                        const compatibility = compatibilityMap[option.id];
                        const isSelected = formState.platforms.includes(option.id);
                        const optionTone = !connected
                          ? 'border-gray-200 bg-white text-gray-700 opacity-45 dark:border-[#333333] dark:bg-[#000000] dark:text-[#9CA3AF]'
                          : isSelected
                            ? 'border-[#ec1e24] bg-[#ec1e24]/10 text-[#ec1e24] shadow-[0_0_0_1px_rgba(236,30,36,0.25)]'
                            : compatibility.supported
                              ? 'border-gray-200 bg-white text-gray-700 dark:border-[#333333] dark:bg-[#000000] dark:text-white hover:border-[#ec1e24]/60 hover:text-[#ec1e24] dark:hover:bg-[#111111]'
                              : 'border-gray-200 bg-white text-white/90 dark:border-[#333333] dark:bg-[#000000] dark:text-white';

                        return (
                          <button
                            key={option.id}
                            type="button"
                            disabled={!connected}
                            onClick={() => togglePlatform(option.id, connected)}
                            className={`h-11 rounded-xl border px-4 text-sm transition-all ${optionTone}`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="grid grid-cols-3 gap-3">
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
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
            <div className="mb-4">
              <div>
                <h3 className="mb-1 text-gray-900 dark:text-white">Shared Caption</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Used for Instagram feed/reels, Facebook feed, Threads, X, TikTok, and YouTube. Stories ignore this caption.</p>
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

          {isPinterestSelected ? (
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

          {isYouTubeSelected ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
              <h3 className="mb-4 text-gray-900 dark:text-white">YouTube Fields</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Title</Label>
                  <Input value={formState.youtubeTitle} onChange={(event) => setFormState((current) => ({ ...current, youtubeTitle: event.target.value }))} className="mt-1 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]" />
                </div>
                {isYouTubeLongformSelected ? (
                  <>
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
                            <div className="px-3 py-2">
                              <div className="flex w-full items-center justify-center py-1">
                                <RedSpinner size="sm" label="Loading YouTube playlists..." />
                              </div>
                            </div>
                          )}
                          {!isLoadingYouTubePlaylists && youtubePlaylists.length === 0 && (
                            <div className="px-3 py-2 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                              No channel playlists found
                            </div>
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
                  </>
                ) : (
                  <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                    Shorts use the video and can fall back to the shared caption if no YouTube description is provided.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
            <h3 className="mb-4 text-gray-900 dark:text-white">Save State</h3>
            <div className="space-y-3">
              <Button className="w-full" onClick={handleSaveDraft} disabled={hasUploadingAssets || isUploadingMedia || hasUploadingThumbnails || isGeneratingThreadsXCrop}>Save</Button>
              <Button className="w-full" onClick={handlePublish} disabled={hasUploadingAssets || isUploadingMedia || hasUploadingThumbnails || isGeneratingThreadsXCrop || isPublishing}>
                {isPublishing ? (
                  <>
                    <RedSpinner size="sm" className="mr-2" label="Publishing post..." />
                    Publish
                  </>
                ) : 'Publish'}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setIsScheduleOpen(true)} disabled={hasUploadingAssets || isUploadingMedia || hasUploadingThumbnails || isGeneratingThreadsXCrop}>
                {isEditingScheduledItem ? 'Update Schedule' : 'Schedule'}
              </Button>
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
                        title={getComposePlatformLabel(platform)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#ec1e24]/30 bg-[#ec1e24]/8 px-3 py-2 text-[#ec1e24]"
                      >
                        <Icon className={iconSizeClass} />
                        <span className="text-xs">{getComposePlatformLabel(platform)}</span>
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

      <BottomSheet
        open={isScheduleOpen}
        onOpenChange={handleScheduleSheetOpenChange}
        disableBackdropClose={isScheduleDatePickerOpen || isScheduleTimePickerOpen}
        disableSwipe={isScheduleDatePickerOpen || isScheduleTimePickerOpen}
      >
        <BottomSheetHeader>
          <BottomSheetTitle>{isEditingScheduledItem ? 'Update Schedule' : 'Schedule Post'}</BottomSheetTitle>
          <BottomSheetDescription>
            {isEditingScheduledItem
              ? 'Change the scheduled date or time for this post.'
              : 'Choose when this post should move into the scheduled queue.'}
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-600 dark:text-[#9CA3AF]">Date</Label>
              <div className="mt-2">
                <DatePicker
                  date={scheduleDate}
                  onDateChange={setScheduleDate}
                  onOpenChange={setIsScheduleDatePickerOpen}
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-600 dark:text-[#9CA3AF]">Time</Label>
              <div className="mt-2">
                <TimePicker
                  value={scheduleTime}
                  onChange={setScheduleTime}
                  onOpenChange={setIsScheduleTimePickerOpen}
                />
              </div>
            </div>
            {!scheduleValidation.ok ? (
              <p className="text-sm text-[#EF4444]">{scheduleValidation.error}</p>
            ) : null}
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSchedule} disabled={!scheduleValidation.ok}>
              {isEditingScheduledItem ? 'Update Schedule' : 'Schedule'}
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      <MediaPreviewDialog
        open={Boolean(previewAsset && activePreviewAssetUrl)}
        src={activePreviewAssetUrl}
        mediaType={previewAsset?.kind ?? 'image'}
        title={previewAsset?.fileName}
        badgeLabel={previewAsset?.kind}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAsset(null);
          }
        }}
      />
      <MediaPreviewDialog
        open={Boolean(previewThumbnail)}
        src={previewThumbnail?.previewUrl || previewThumbnail?.storageUrl}
        mediaType="image"
        title={previewThumbnail?.fileName}
        badgeLabel="Thumbnail"
        onOpenChange={(open) => {
          if (!open) {
            setPreviewThumbnail(null);
          }
        }}
      />
      {unsavedChangesGuard.prompt}
    </div>
  );
}
