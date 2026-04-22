import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, ArrowUp, CalendarDays, Film, Image as ImageIcon, RotateCcw, Upload, X } from 'lucide-react';
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
  normalizeComposeParagraphText,
  normalizeComposeItem,
  summarizeComposeMedia,
} from '../../lib/create/composeMedia';
import {
  buildComposeAssetSignature,
  buildThreadsXCropVariant,
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
import {
  buildComposeAssetStreamUrl,
  buildComposeRenderableUrls,
  importComposeMediaUrl,
  importComposeRemoteImage,
  resolveComposeAssetAccess,
  resolveComposeAssetPreview,
  uploadComposeAsset,
} from '../../lib/create/composeStorage';
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
import {
  generateComposeContent,
  generateComposeThumbnail,
  type ComposeContentGenerationResult,
  type ComposeMediaMetadata,
} from '../../lib/api/ai';
import { useBackEntry } from '../../hooks/useBackEntry';
import { useUnsavedBackGuard } from '../../hooks/useUnsavedBackGuard';
import { useDesktopFileDrop } from '../../hooks/useDesktopFileDrop';
import { PageLoader, RedSpinner } from '../PageLoader';
import { extractVideoMetadata } from '../../utils/videoMetadata';
import { useSettings } from '../../contexts/SettingsContext';
import {
  fetchDesignStudioTMDbImages,
  searchDesignStudioTMDb,
  type DesignStudioTMDbImagePool,
  type DesignStudioTMDbSearchResult,
} from '../../lib/api/designStudio';
const undoIcon = '/icons/icons/hugeroundedicons/arrow-move-up-left-stroke-rounded.svg';
const redoIcon = '/icons/icons/hugeroundedicons/arrow-move-up-right-stroke-rounded.svg';

interface ComposeEditorPageProps {
  isCompactLayout?: boolean;
  onNavigate: (page: string, fromPage?: string) => void;
  previousPage?: string | null;
  registerCloseRequestHandler?: (handler: (() => boolean) | null) => void;
}

type FormState = {
  mediaAssets: ComposeMediaAsset[];
  sourceMetadata: string;
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

type EditableComposeField = 'sharedCaption' | 'youtubeTitle' | 'youtubeDescription' | 'youtubePlaylist';
type TmdbImageCategory = 'backdrops' | 'posters' | 'profiles' | 'logos';

type PendingGeneratedContentAction =
  | {
      kind: 'direct-fill';
      fields: Partial<Record<EditableComposeField, string>>;
      playlistReason?: string;
    }
  | {
      kind: 'editorial-apply';
      targetField: Extract<EditableComposeField, 'sharedCaption' | 'youtubeDescription'>;
      text: string;
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
    sourceMetadata: normalized?.sourceMetadata ?? '',
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

function toLocalTimeInputValue(value?: string) {
  if (!value) return '09:00';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '09:00';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatBytes(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function getTmdbResultMetaLabel(result: DesignStudioTMDbSearchResult) {
  const mediaLabel = result.mediaType.toUpperCase();
  if (!result.releaseDate) {
    return mediaLabel;
  }

  const parsedDate = new Date(result.releaseDate);
  const year = Number.isNaN(parsedDate.getTime())
    ? result.releaseDate.slice(0, 4)
    : String(parsedDate.getFullYear());

  return year ? `${mediaLabel} • ${year}` : mediaLabel;
}

function normalizeMetadataInput(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function getPlaylistLabel(value: string, playlists: YouTubePlaylist[]) {
  if (!value) return '';
  return playlists.find((playlist) => playlist.id === value)?.title || value;
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

function getIntentBadgeLabel(intentResult: ComposeContentGenerationResult['intentResult'] | null) {
  if (!intentResult) return '';

  const intentMap: Record<string, string> = {
    post_generation: 'Post generation',
    review_generation: 'Review',
    summary_generation: 'Summary',
    promo_caption_generation: 'Promo caption',
    metadata_extraction: 'Metadata extraction',
    mixed_request: 'Mixed request',
  };

  const outputLabel = intentResult.outputMode === 'preview_only' ? 'Preview' : 'Direct fill';
  return `${intentMap[intentResult.intent] || 'AI'} - ${outputLabel}`;
}

export function ComposeEditorPage({
  isCompactLayout = false,
  onNavigate,
  previousPage,
  registerCloseRequestHandler,
}: ComposeEditorPageProps) {
  const { settings } = useSettings();
  const { activeItemId, getItemById, saveItem } = useComposeStore();
  const { addNotification } = useNotifications();
  const existingItem = getItemById(activeItemId);
  const [formState, setFormState] = useState<FormState>(() => createInitialForm(existingItem));
  const historyRef = useRef<FormState[]>([]);
  const redoHistoryRef = useRef<FormState[]>([]);
  const lastHistorySignatureRef = useRef('');
  const skipHistorySignatureRef = useRef('');
  const resetHistorySignatureRef = useRef('');
  const [, setHistoryVersion] = useState(0);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<DesignStudioTMDbSearchResult[]>([]);
  const [selectedTmdbResult, setSelectedTmdbResult] = useState<DesignStudioTMDbSearchResult | null>(null);
  const [tmdbImagePool, setTmdbImagePool] = useState<DesignStudioTMDbImagePool | null>(null);
  const tmdbSearchRequestRef = useRef(0);
  const [tmdbImageCategory, setTmdbImageCategory] = useState<TmdbImageCategory>('backdrops');
  const [isSearchingTmdb, setIsSearchingTmdb] = useState(false);
  const [isLoadingTmdbImages, setIsLoadingTmdbImages] = useState(false);
  const [thumbnailTmdbSearchQuery, setThumbnailTmdbSearchQuery] = useState('');
  const [thumbnailTmdbResults, setThumbnailTmdbResults] = useState<DesignStudioTMDbSearchResult[]>([]);
  const [selectedThumbnailTmdbResult, setSelectedThumbnailTmdbResult] = useState<DesignStudioTMDbSearchResult | null>(null);
  const [thumbnailTmdbImagePool, setThumbnailTmdbImagePool] = useState<DesignStudioTMDbImagePool | null>(null);
  const thumbnailTmdbSearchRequestRef = useRef(0);
  const [thumbnailTmdbImageCategory, setThumbnailTmdbImageCategory] = useState<TmdbImageCategory>('backdrops');
  const [isSearchingThumbnailTmdb, setIsSearchingThumbnailTmdb] = useState(false);
  const [isLoadingThumbnailTmdbImages, setIsLoadingThumbnailTmdbImages] = useState(false);
  const [isGeneratingThreadsXCrop, setIsGeneratingThreadsXCrop] = useState(false);
  const [isUploadingThreadsXCrop, setIsUploadingThreadsXCrop] = useState(false);
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
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [metadataGenerationError, setMetadataGenerationError] = useState<string | null>(null);
  const [isReplaceGeneratedContentOpen, setIsReplaceGeneratedContentOpen] = useState(false);
  const [latestDetectedIntent, setLatestDetectedIntent] = useState<ComposeContentGenerationResult['intentResult'] | null>(null);
  const [latestExtractedMetadata, setLatestExtractedMetadata] = useState<ComposeMediaMetadata | null>(null);
  const [editorialPreview, setEditorialPreview] = useState<ComposeContentGenerationResult['editorialResult'] | null>(null);
  const [pendingGeneratedContentAction, setPendingGeneratedContentAction] = useState<PendingGeneratedContentAction | null>(null);
  const [fieldManualEdits, setFieldManualEdits] = useState<Record<EditableComposeField, boolean>>({
    sharedCaption: false,
    youtubeTitle: false,
    youtubeDescription: false,
    youtubePlaylist: false,
  });
  const [thumbnailGenerationState, setThumbnailGenerationState] = useState<
    Partial<Record<'sharedThumbnail' | 'youtubeThumbnail' | 'xThumbnail', boolean>>
  >({});
  const [pendingThumbnailGenerationKey, setPendingThumbnailGenerationKey] = useState<
    'sharedThumbnail' | 'youtubeThumbnail' | 'xThumbnail' | null
  >(null);
  const [isReplaceGeneratedThumbnailOpen, setIsReplaceGeneratedThumbnailOpen] = useState(false);
  const scheduleReopenLockUntilRef = useRef(0);
  const threadsXAutoGenerateTimeoutRef = useRef<number | null>(null);
  const lastThreadsXAutoGenerateKeyRef = useRef<string>('');
  const recoveringAssetIdsRef = useRef(new Set<string>());
  const previewOpenLockUntilRef = useRef(0);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(
    existingItem?.scheduledAt ? new Date(existingItem.scheduledAt) : undefined,
  );
  const [scheduleTime, setScheduleTime] = useState(
    toLocalTimeInputValue(existingItem?.scheduledAt),
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
  const hasThreadsXCropPreviewReady =
    isThreadsXCropEnabled &&
    Boolean(formState.threadsXCropVideo?.previewUrl) &&
    formState.threadsXCropVideo?.sourceAssetId === primaryVideoAsset?.id &&
    formState.threadsXCropVideo?.sourceSignature === (primaryVideoAsset ? buildComposeAssetSignature(primaryVideoAsset) : '') &&
    formState.threadsXCropVideo?.focusYPercent === formState.videoCropFocusYPercent;
  const isThreadsXCropReady =
    hasThreadsXCropPreviewReady &&
    formState.threadsXCropVideo?.uploadStatus === 'uploaded';
  const activeThreadsXCropPreviewUrl =
    hasThreadsXCropPreviewReady
      ? buildComposeAssetStreamUrl(formState.threadsXCropVideo?.previewUrl || formState.threadsXCropVideo?.storageUrl)
      : undefined;
  const isThreadsXCropBlockingActions =
    isThreadsXCropEnabled && (isGeneratingThreadsXCrop || (isUploadingThreadsXCrop && !isThreadsXCropReady));
  const hasUploadingThumbnails = [formState.sharedThumbnail, formState.youtubeThumbnail, formState.xThumbnail]
    .some((thumbnail) => thumbnail?.uploadStatus === 'uploading');
  const hasGeneratingThumbnails = Object.values(thumbnailGenerationState).some(Boolean);
  const hasFailedThumbnails = [formState.sharedThumbnail, formState.youtubeThumbnail, formState.xThumbnail]
    .some((thumbnail) => thumbnail?.uploadStatus === 'failed');
  const isYouTubeLongformSelected = formState.platforms.includes('youtube_longform');
  const isYouTubeShortsSelected = formState.platforms.includes('youtube_shorts');
  const isYouTubeSelected = isYouTubeLongformSelected || isYouTubeShortsSelected;
  const isPinterestSelected = formState.platforms.includes('pinterest');
  const shouldShowSharedThumbnailSection =
    isSingleVideo &&
    formState.platforms.some((platform) => [
      'instagram_feed',
      'facebook_feed',
      'tiktok',
    ].includes(platform));
  const shouldShowYouTubeThumbnailSection = isSingleVideo && isYouTubeSelected;
  const shouldShowVideoThumbnails =
    shouldShowSharedThumbnailSection || shouldShowYouTubeThumbnailSection;
  const hasYouTubeConnection = connectedPlatforms.has('youtube');
  const hasMatchingYouTubePlaylist = youtubePlaylists.some((playlist) => playlist.id === formState.youtubePlaylist);
  const initialFormSnapshot = useMemo(() => JSON.stringify(createInitialForm(existingItem)), [existingItem]);
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(formState) !== initialFormSnapshot,
    [formState, initialFormSnapshot],
  );
  const getAssetDisplayUrl = useCallback((asset?: ComposeMediaAsset | null) => {
    const previewUrl = getComposeAssetPreviewUrl(asset ?? undefined);
    return buildComposeRenderableUrls({
      previewUrl,
      storageUrl: asset?.storageUrl,
    })[0];
  }, []);
  const getThumbnailDisplayUrl = useCallback((thumbnail?: ComposeThumbnailAsset | null) => {
    return buildComposeRenderableUrls({
      previewUrl: thumbnail?.previewUrl,
      storageUrl: thumbnail?.storageUrl,
    })[0];
  }, []);
  const handleRenderableMediaError = useCallback((
    event: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>,
    sources: string[],
  ) => {
    const element = event.currentTarget;
    const currentIndex = Number(element.dataset.fallbackIndex || '0');
    const nextSource = sources[currentIndex + 1];
    if (!nextSource) {
      return;
    }

    element.dataset.fallbackIndex = String(currentIndex + 1);
    element.setAttribute('src', nextSource);
    if ('load' in element && typeof element.load === 'function') {
      element.load();
    }
  }, []);
  const activePreviewAssetUrl = useMemo(() => {
    if (!previewAsset) {
      return undefined;
    }

    return getAssetDisplayUrl(previewAsset);
  }, [getAssetDisplayUrl, previewAsset]);
  const isMediaPreviewOpen = Boolean(activePreviewAssetUrl || previewThumbnail);
  const isScheduleInteractionActive =
    isScheduleOpen
    || isScheduleDatePickerOpen
    || isScheduleTimePickerOpen
    || isReplaceGeneratedContentOpen
    || isReplaceGeneratedThumbnailOpen;
  const unsavedChangesGuard = useUnsavedBackGuard({
    isDirty: hasUnsavedChanges,
    title: 'Discard post changes?',
    description: 'You have unsaved changes in this post editor. Leaving now will lose them.',
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const rawGuardUntil = window.sessionStorage.getItem('screndly_compose_editor_preview_guard_until');
    const guardUntil = Number(rawGuardUntil || '0');
    if (Number.isFinite(guardUntil) && guardUntil > Date.now()) {
      previewOpenLockUntilRef.current = guardUntil;
    }
    window.sessionStorage.removeItem('screndly_compose_editor_preview_guard_until');
  }, []);

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

    if (isReplaceGeneratedContentOpen) {
      setIsReplaceGeneratedContentOpen(false);
      return true;
    }

    if (isReplaceGeneratedThumbnailOpen) {
      setIsReplaceGeneratedThumbnailOpen(false);
      setPendingThumbnailGenerationKey(null);
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
    isReplaceGeneratedContentOpen,
    isReplaceGeneratedThumbnailOpen,
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
    if (previewAsset) {
      const latestAsset = formState.mediaAssets.find((asset) => asset.id === previewAsset.id);
      if (latestAsset && latestAsset !== previewAsset) {
        setPreviewAsset(latestAsset);
      }
    }

    if (previewThumbnail) {
      const latestThumbnail = [
        formState.sharedThumbnail,
        formState.youtubeThumbnail,
        formState.xThumbnail,
      ].find((thumbnail) => thumbnail?.storageUrl === previewThumbnail.storageUrl || thumbnail?.fileName === previewThumbnail.fileName);

      if (latestThumbnail && latestThumbnail !== previewThumbnail) {
        setPreviewThumbnail(latestThumbnail);
      }
    }
  }, [
    formState.mediaAssets,
    formState.sharedThumbnail,
    formState.xThumbnail,
    formState.youtubeThumbnail,
    previewAsset,
    previewThumbnail,
  ]);

  useEffect(() => {
    const initialForm = createInitialForm(existingItem);
    resetHistorySignatureRef.current = JSON.stringify(initialForm);
    setFormState(initialForm);
    setScheduleDate(existingItem?.scheduledAt ? new Date(existingItem.scheduledAt) : undefined);
    setScheduleTime(toLocalTimeInputValue(existingItem?.scheduledAt));
    setMetadataGenerationError(null);
    setIsReplaceGeneratedContentOpen(false);
    setLatestDetectedIntent(null);
    setLatestExtractedMetadata(null);
    setEditorialPreview(null);
    setPendingGeneratedContentAction(null);
    setFieldManualEdits({
      sharedCaption: false,
      youtubeTitle: false,
      youtubeDescription: false,
      youtubePlaylist: false,
    });
    setThumbnailGenerationState({});
    setPendingThumbnailGenerationKey(null);
    setIsReplaceGeneratedThumbnailOpen(false);
    setIsUploadingThreadsXCrop(false);
  }, [activeItemId, existingItem]);

  const formStateSignature = useMemo(() => JSON.stringify(formState), [formState]);

  useEffect(() => {
    if (resetHistorySignatureRef.current === formStateSignature) {
      historyRef.current = [formState];
      redoHistoryRef.current = [];
      lastHistorySignatureRef.current = formStateSignature;
      resetHistorySignatureRef.current = '';
      skipHistorySignatureRef.current = '';
      setHistoryVersion((value) => value + 1);
      return;
    }

    if (skipHistorySignatureRef.current === formStateSignature) {
      lastHistorySignatureRef.current = formStateSignature;
      skipHistorySignatureRef.current = '';
      setHistoryVersion((value) => value + 1);
      return;
    }

    if (!lastHistorySignatureRef.current) {
      historyRef.current = [formState];
      redoHistoryRef.current = [];
      lastHistorySignatureRef.current = formStateSignature;
      setHistoryVersion((value) => value + 1);
      return;
    }

    if (lastHistorySignatureRef.current === formStateSignature) {
      return;
    }

    historyRef.current = [...historyRef.current, formState].slice(-60);
    redoHistoryRef.current = [];
    lastHistorySignatureRef.current = formStateSignature;
    setHistoryVersion((value) => value + 1);
  }, [formState, formStateSignature]);

  const canUndo = historyRef.current.length > 1;
  const canRedo = redoHistoryRef.current.length > 0;

  const handleUndo = useCallback(() => {
    if (historyRef.current.length <= 1) {
      return;
    }

    const current = historyRef.current[historyRef.current.length - 1];
    const previous = historyRef.current[historyRef.current.length - 2];
    redoHistoryRef.current = [current, ...redoHistoryRef.current].slice(0, 60);
    historyRef.current = historyRef.current.slice(0, -1);
    lastHistorySignatureRef.current = JSON.stringify(previous);
    skipHistorySignatureRef.current = JSON.stringify(previous);
    setFormState(previous);
    haptics.light();
    setHistoryVersion((value) => value + 1);
  }, []);

  const handleRedo = useCallback(() => {
    if (redoHistoryRef.current.length === 0) {
      return;
    }

    const [next, ...remaining] = redoHistoryRef.current;
    historyRef.current = [...historyRef.current, next].slice(-60);
    redoHistoryRef.current = remaining;
    lastHistorySignatureRef.current = JSON.stringify(next);
    skipHistorySignatureRef.current = JSON.stringify(next);
    setFormState(next);
    haptics.light();
    setHistoryVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!formState.youtubePlaylist || youtubePlaylists.length === 0 || hasMatchingYouTubePlaylist) {
      return;
    }

    const matchedByTitle = youtubePlaylists.find((playlist) => playlist.title === formState.youtubePlaylist);
    if (!matchedByTitle) {
      return;
    }

    setFormState((current) => ({
      ...current,
      youtubePlaylist: matchedByTitle.id,
    }));
  }, [formState.youtubePlaylist, hasMatchingYouTubePlaylist, youtubePlaylists]);

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

    if (!isThreadsXCropEnabled || !primaryVideoAsset || hasThreadsXCropPreviewReady || isGeneratingThreadsXCrop) {
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
    hasThreadsXCropPreviewReady,
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

  const appendImportedMediaAssets = useCallback((assets: Array<{
    kind: 'image' | 'video';
    url: string;
    previewUrl?: string;
    fileId: string;
    fileName: string;
    contentType: string;
    size: number;
    durationSeconds?: number;
    width?: number;
    height?: number;
    aspectRatioValue?: number;
    aspectRatioLabel?: string;
  }>) => {
    setFormState((current) => ({
      ...current,
      mediaAssets: [
        ...current.mediaAssets,
        ...assets.map((asset, index) => ({
          id: `${Date.now()}-${current.mediaAssets.length + index}-${asset.fileName}`,
          kind: asset.kind,
          fileName: asset.fileName,
          mimeType: asset.contentType,
          size: asset.size,
          order: current.mediaAssets.length + index,
          durationSeconds: asset.durationSeconds,
          width: asset.width,
          height: asset.height,
          aspectRatioValue: asset.aspectRatioValue,
          aspectRatioLabel: asset.aspectRatioLabel,
          previewUrl: asset.previewUrl || asset.url,
          storageUrl: asset.url,
          storageFileId: asset.fileId,
          uploadStatus: 'uploaded' as const,
          uploadError: undefined,
        })),
      ],
    }));
  }, []);

  const handleMediaFiles = async (files: File[]) => {
    const acceptedFiles = files.filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
    );
    if (!acceptedFiles.length) return;

    const pendingAssets = await Promise.all(
      acceptedFiles.map(async (file, index) => {
        if (!file.type.startsWith('video/')) {
          return buildComposeMediaAsset(file, formState.mediaAssets.length + index);
        }

        try {
          const metadata = await extractVideoMetadata(file);
          return buildComposeMediaAsset(file, formState.mediaAssets.length + index, {
            durationSeconds: metadata.duration,
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
        const file = acceptedFiles[index];

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

  const handleImportMediaUrl = async () => {
    const url = mediaUrlInput.trim();
    if (!url) {
      return;
    }

    setIsUploadingMedia(true);
    try {
      const importedAssets = await importComposeMediaUrl({ url });
      appendImportedMediaAssets(importedAssets);
      setMediaUrlInput('');
      toast.success(importedAssets.length > 1 ? 'Media URL imported' : 'Media imported');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import media URL';
      toast.error(message);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleMediaSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    event.target.value = '';
    await handleMediaFiles(files);
  };

  const mediaDrop = useDesktopFileDrop({
    accept: 'image/*,video/*',
    isEnabled: !isUploadingMedia,
    onFiles: (files) => {
      void handleMediaFiles(files);
    },
  });

  const activeTmdbImages = useMemo(() => {
    if (!tmdbImagePool) return [];
    if (tmdbImageCategory === 'profiles') return tmdbImagePool.profiles || [];
    if (tmdbImageCategory === 'posters') return tmdbImagePool.posters || [];
    if (tmdbImageCategory === 'logos') return tmdbImagePool.logos || [];
    return tmdbImagePool.backdrops || [];
  }, [tmdbImageCategory, tmdbImagePool]);

  const activeThumbnailTmdbImages = useMemo(() => {
    if (!thumbnailTmdbImagePool) return [];
    if (thumbnailTmdbImageCategory === 'profiles') return thumbnailTmdbImagePool.profiles || [];
    if (thumbnailTmdbImageCategory === 'posters') return thumbnailTmdbImagePool.posters || [];
    if (thumbnailTmdbImageCategory === 'logos') return thumbnailTmdbImagePool.logos || [];
    return thumbnailTmdbImagePool.backdrops || [];
  }, [thumbnailTmdbImageCategory, thumbnailTmdbImagePool]);

  const handleTmdbSearch = async () => {
    if (!tmdbSearchQuery.trim()) return;

    const requestId = ++tmdbSearchRequestRef.current;
    haptics.medium();
    setIsSearchingTmdb(true);
    setSelectedTmdbResult(null);
    setTmdbImagePool(null);

    try {
      const results = await searchDesignStudioTMDb(tmdbSearchQuery);
      if (requestId !== tmdbSearchRequestRef.current) {
        return;
      }
      setTmdbResults(results);
      if (!results.length) {
        toast('No TMDb matches found', {
          description: 'Try a more exact movie, TV show, or person name.',
        });
      }
    } catch (error) {
      if (requestId !== tmdbSearchRequestRef.current) {
        return;
      }
      console.error('TMDb search failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to search TMDb');
      setTmdbResults([]);
    } finally {
      if (requestId === tmdbSearchRequestRef.current) {
        setIsSearchingTmdb(false);
      }
    }
  };

  const handleSelectTmdbResult = async (result: DesignStudioTMDbSearchResult) => {
    const requestId = ++tmdbSearchRequestRef.current;
    haptics.light();
    setSelectedTmdbResult(result);
    setIsLoadingTmdbImages(true);

    try {
      const pool = await fetchDesignStudioTMDbImages(result.mediaType, result.id);
      if (requestId !== tmdbSearchRequestRef.current) {
        return;
      }
      setTmdbImagePool(pool);
      const nextCategory = result.mediaType === 'person'
        ? 'profiles'
        : pool.backdrops?.length
          ? 'backdrops'
          : pool.posters?.length
            ? 'posters'
            : 'logos';
      setTmdbImageCategory(nextCategory);
    } catch (error) {
      if (requestId !== tmdbSearchRequestRef.current) {
        return;
      }
      console.error('Failed to load TMDb image pool:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load TMDb images');
      setSelectedTmdbResult(null);
      setTmdbImagePool(null);
    } finally {
      if (requestId === tmdbSearchRequestRef.current) {
        setIsLoadingTmdbImages(false);
      }
    }
  };

  const handleBackToTmdbResults = () => {
    tmdbSearchRequestRef.current += 1;
    haptics.light();
    setSelectedTmdbResult(null);
    setTmdbImagePool(null);
    setIsLoadingTmdbImages(false);
  };

  const handleClearTmdbSearch = () => {
    tmdbSearchRequestRef.current += 1;
    haptics.light();
    setTmdbSearchQuery('');
    setTmdbResults([]);
    setSelectedTmdbResult(null);
    setTmdbImagePool(null);
    setIsSearchingTmdb(false);
    setIsLoadingTmdbImages(false);
  };

  const handleSelectTmdbImage = async (imageUrl: string) => {
    setIsUploadingMedia(true);

    try {
      const resultTitle = selectedTmdbResult?.title || 'tmdb-image';
      const imported = await importComposeRemoteImage({
        imageUrl,
        category: tmdbImageCategory,
        resultTitle,
      });

      setFormState((current) => ({
        ...current,
        mediaAssets: [
          ...current.mediaAssets,
          {
            id: `${Date.now()}-${current.mediaAssets.length}-${imported.fileName}`,
            kind: 'image',
            fileName: imported.fileName,
            mimeType: imported.contentType,
            size: imported.size,
            order: current.mediaAssets.length,
            previewUrl: imported.previewUrl || imported.url,
            storageUrl: imported.url,
            storageFileId: imported.fileId,
            uploadStatus: 'uploaded',
          },
        ],
      }));

      toast.success(tmdbImageCategory === 'logos' ? 'TMDb logo added to media' : 'TMDb image added to media');
    } catch (error) {
      console.error('Failed to add TMDb image:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add TMDb image');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleThumbnailTmdbSearch = async () => {
    if (!thumbnailTmdbSearchQuery.trim()) return;

    const requestId = ++thumbnailTmdbSearchRequestRef.current;
    haptics.medium();
    setIsSearchingThumbnailTmdb(true);
    setSelectedThumbnailTmdbResult(null);
    setThumbnailTmdbImagePool(null);

    try {
      const results = await searchDesignStudioTMDb(thumbnailTmdbSearchQuery);
      if (requestId !== thumbnailTmdbSearchRequestRef.current) {
        return;
      }

      setThumbnailTmdbResults(results);
      if (!results.length) {
        toast('No TMDb matches found', {
          description: 'Try a more exact movie, TV show, or person name.',
        });
      }
    } catch (error) {
      if (requestId !== thumbnailTmdbSearchRequestRef.current) {
        return;
      }

      console.error('Thumbnail TMDb search failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to search TMDb');
      setThumbnailTmdbResults([]);
    } finally {
      if (requestId === thumbnailTmdbSearchRequestRef.current) {
        setIsSearchingThumbnailTmdb(false);
      }
    }
  };

  const handleSelectThumbnailTmdbResult = async (result: DesignStudioTMDbSearchResult) => {
    const requestId = ++thumbnailTmdbSearchRequestRef.current;
    haptics.light();
    setSelectedThumbnailTmdbResult(result);
    setIsLoadingThumbnailTmdbImages(true);

    try {
      const pool = await fetchDesignStudioTMDbImages(result.mediaType, result.id);
      if (requestId !== thumbnailTmdbSearchRequestRef.current) {
        return;
      }

      setThumbnailTmdbImagePool(pool);
      const nextCategory = result.mediaType === 'person'
        ? 'profiles'
        : pool.backdrops?.length
          ? 'backdrops'
          : pool.posters?.length
            ? 'posters'
            : 'logos';
      setThumbnailTmdbImageCategory(nextCategory);
    } catch (error) {
      if (requestId !== thumbnailTmdbSearchRequestRef.current) {
        return;
      }

      console.error('Failed to load thumbnail TMDb image pool:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load TMDb images');
      setSelectedThumbnailTmdbResult(null);
      setThumbnailTmdbImagePool(null);
    } finally {
      if (requestId === thumbnailTmdbSearchRequestRef.current) {
        setIsLoadingThumbnailTmdbImages(false);
      }
    }
  };

  const handleBackToThumbnailTmdbResults = () => {
    thumbnailTmdbSearchRequestRef.current += 1;
    haptics.light();
    setSelectedThumbnailTmdbResult(null);
    setThumbnailTmdbImagePool(null);
    setIsLoadingThumbnailTmdbImages(false);
  };

  const handleClearThumbnailTmdbSearch = () => {
    thumbnailTmdbSearchRequestRef.current += 1;
    haptics.light();
    setThumbnailTmdbSearchQuery('');
    setThumbnailTmdbResults([]);
    setSelectedThumbnailTmdbResult(null);
    setThumbnailTmdbImagePool(null);
    setIsSearchingThumbnailTmdb(false);
    setIsLoadingThumbnailTmdbImages(false);
  };

  const handleSelectThumbnailTmdbImage = async (imageUrl: string) => {
    updateThumbnail('sharedThumbnail', (current) => ({
      fileName: current?.fileName || 'tmdb-thumbnail',
      mimeType: current?.mimeType || 'image/jpeg',
      size: current?.size || 0,
      previewUrl: current?.previewUrl,
      storageUrl: current?.storageUrl,
      storageFileId: current?.storageFileId,
      uploadStatus: 'uploading',
      uploadError: undefined,
    }));

    try {
      const resultTitle = selectedThumbnailTmdbResult?.title || 'tmdb-thumbnail';
      const imported = await importComposeRemoteImage({
        imageUrl,
        category: thumbnailTmdbImageCategory === 'logos' ? 'logos' : 'posters',
        resultTitle,
      });

      updateThumbnail('sharedThumbnail', () => ({
        fileName: imported.fileName,
        mimeType: imported.contentType,
        size: imported.size,
        previewUrl: imported.previewUrl || imported.url,
        storageUrl: imported.url,
        storageFileId: imported.fileId,
        uploadStatus: 'uploaded',
        uploadError: undefined,
      }));

      toast.success('TMDb image added to shared thumbnail');
    } catch (error) {
      console.error('Failed to add TMDb image to shared thumbnail:', error);
      const message = error instanceof Error ? error.message : 'Failed to add TMDb image';
      updateThumbnail('sharedThumbnail', (current) => current ? {
        ...current,
        uploadStatus: 'failed',
        uploadError: message,
      } : current);
      toast.error(message);
    }
  };

  const handleThumbnailFile = async (
    file: File,
    key: 'sharedThumbnail' | 'youtubeThumbnail' | 'xThumbnail',
  ) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Upload an image file for the thumbnail.');
      return;
    }

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

  const handleThumbnailSelected = async (
    event: ChangeEvent<HTMLInputElement>,
    key: 'sharedThumbnail' | 'youtubeThumbnail' | 'xThumbnail',
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    await handleThumbnailFile(file, key);
  };

  const sharedThumbnailDrop = useDesktopFileDrop({
    accept: 'image/*',
    onFiles: (files) => {
      if (files[0]) {
        void handleThumbnailFile(files[0], 'sharedThumbnail');
      }
    },
  });

  const youtubeThumbnailDrop = useDesktopFileDrop({
    accept: 'image/*',
    onFiles: (files) => {
      if (files[0]) {
        void handleThumbnailFile(files[0], 'youtubeThumbnail');
      }
    },
  });

  const xThumbnailDrop = useDesktopFileDrop({
    accept: 'image/*',
    onFiles: (files) => {
      if (files[0]) {
        void handleThumbnailFile(files[0], 'xThumbnail');
      }
    },
  });

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
    setIsUploadingThreadsXCrop(false);
    setFormState((current) => ({
      ...current,
      threadsXCropVideo: current.threadsXCropVideo
        ? { ...current.threadsXCropVideo, uploadStatus: 'uploading', uploadError: undefined }
        : null,
    }));

    try {
      const variant = await buildThreadsXCropVariant(asset, focusYPercent, (_, message) => {
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
        toast.success('3:4 crop is ready for Threads and X.');
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
      setIsUploadingThreadsXCrop(false);
      toast.error(message);
    } finally {
      setIsGeneratingThreadsXCrop(false);
      setIsUploadingThreadsXCrop(false);
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
    if (Date.now() < previewOpenLockUntilRef.current) {
      return;
    }
    const previewUrl = getAssetDisplayUrl(asset);
    if (!previewUrl) {
      return;
    }

    haptics.light();
    setPreviewThumbnail(null);
    setPreviewAsset(asset);
  };

  const handlePreviewThreadsXCrop = () => {
    if (Date.now() < previewOpenLockUntilRef.current) {
      return;
    }
    if (!formState.threadsXCropVideo || !primaryVideoAsset) {
      return;
    }

    const previewUrl = buildComposeAssetStreamUrl(
      formState.threadsXCropVideo.previewUrl || formState.threadsXCropVideo.storageUrl,
    );
    if (!previewUrl) {
      toast.error('Generate the 3:4 crop first so you can preview it.');
      return;
    }

    haptics.light();
    setPreviewThumbnail(null);
    setPreviewAsset({
      id: `${primaryVideoAsset.id}-threads-x-crop-preview`,
      kind: 'video',
      fileName: formState.threadsXCropVideo.fileName,
      mimeType: formState.threadsXCropVideo.mimeType,
      size: formState.threadsXCropVideo.size,
      order: primaryVideoAsset.order,
      width: primaryVideoAsset.width,
      height: primaryVideoAsset.height,
      aspectRatioLabel: '3:4',
      aspectRatioValue: 3 / 4,
      previewUrl,
      storageUrl: formState.threadsXCropVideo.storageUrl,
      storageFileId: formState.threadsXCropVideo.storageFileId,
      uploadStatus: formState.threadsXCropVideo.uploadStatus,
      uploadError: formState.threadsXCropVideo.uploadError,
    });
  };

  const handlePreviewThumbnail = (thumbnail: ComposeThumbnailAsset) => {
    if (Date.now() < previewOpenLockUntilRef.current) {
      return;
    }
    const previewUrl = getThumbnailDisplayUrl(thumbnail);
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

  const applyPendingGeneratedContentAction = useCallback((action: PendingGeneratedContentAction) => {
    if (action.kind === 'direct-fill') {
      setFormState((current) => ({
        ...current,
        ...(typeof action.fields.sharedCaption === 'string' ? { sharedCaption: normalizeComposeParagraphText(action.fields.sharedCaption) } : {}),
        ...(typeof action.fields.youtubeTitle === 'string' ? { youtubeTitle: action.fields.youtubeTitle } : {}),
        ...(typeof action.fields.youtubeDescription === 'string' ? { youtubeDescription: normalizeComposeParagraphText(action.fields.youtubeDescription) } : {}),
        ...(typeof action.fields.youtubePlaylist === 'string' ? { youtubePlaylist: action.fields.youtubePlaylist } : {}),
      }));
      setFieldManualEdits((current) => ({
        ...current,
        ...(typeof action.fields.sharedCaption === 'string' ? { sharedCaption: false } : {}),
        ...(typeof action.fields.youtubeTitle === 'string' ? { youtubeTitle: false } : {}),
        ...(typeof action.fields.youtubeDescription === 'string' ? { youtubeDescription: false } : {}),
        ...(typeof action.fields.youtubePlaylist === 'string' ? { youtubePlaylist: false } : {}),
      }));
      setEditorialPreview(null);
      setIsReplaceGeneratedContentOpen(false);
      setPendingGeneratedContentAction(null);
      setMetadataGenerationError(null);

      if (action.fields.youtubePlaylist) {
        toast.success(
          action.playlistReason
            ? `Content generated. Playlist matched: ${action.playlistReason}`
            : 'Content generated and playlist selected.',
        );
        return;
      }

      toast.success('Content generated.');
      return;
    }

    setFormState((current) => ({
      ...current,
      ...(action.targetField === 'sharedCaption'
        ? { sharedCaption: normalizeComposeParagraphText(action.text) }
        : { youtubeDescription: normalizeComposeParagraphText(action.text) }),
    }));
    setFieldManualEdits((current) => ({
      ...current,
      [action.targetField]: false,
    }));
    setIsReplaceGeneratedContentOpen(false);
    setPendingGeneratedContentAction(null);
    toast.success(
      action.targetField === 'sharedCaption'
        ? 'Preview applied to Shared Caption.'
        : 'Preview applied to YouTube Description.',
    );
  }, []);

  const queueGeneratedContentAction = useCallback((action: PendingGeneratedContentAction) => {
    const requiresConfirmation = action.kind === 'direct-fill'
      ? (
          (typeof action.fields.sharedCaption === 'string' && action.fields.sharedCaption.trim().length > 0 && formState.sharedCaption.trim().length > 0 && fieldManualEdits.sharedCaption)
          || (typeof action.fields.youtubeTitle === 'string' && action.fields.youtubeTitle.trim().length > 0 && formState.youtubeTitle.trim().length > 0 && fieldManualEdits.youtubeTitle)
          || (typeof action.fields.youtubeDescription === 'string' && action.fields.youtubeDescription.trim().length > 0 && formState.youtubeDescription.trim().length > 0 && fieldManualEdits.youtubeDescription)
          || (typeof action.fields.youtubePlaylist === 'string' && action.fields.youtubePlaylist.trim().length > 0 && formState.youtubePlaylist.trim().length > 0 && fieldManualEdits.youtubePlaylist)
        )
      : (
          action.text.trim().length > 0
          && (
            (action.targetField === 'sharedCaption' && formState.sharedCaption.trim().length > 0 && fieldManualEdits.sharedCaption)
            || (action.targetField === 'youtubeDescription' && formState.youtubeDescription.trim().length > 0 && fieldManualEdits.youtubeDescription)
          )
        );

    if (requiresConfirmation) {
      setPendingGeneratedContentAction(action);
      setIsReplaceGeneratedContentOpen(true);
      return;
    }

    applyPendingGeneratedContentAction(action);
  }, [
    applyPendingGeneratedContentAction,
    fieldManualEdits.sharedCaption,
    fieldManualEdits.youtubeDescription,
    fieldManualEdits.youtubePlaylist,
    fieldManualEdits.youtubeTitle,
    formState.sharedCaption,
    formState.youtubeDescription,
    formState.youtubePlaylist,
    formState.youtubeTitle,
  ]);

  const runMetadataGeneration = useCallback(async (forceReplace = false) => {
    const normalizedMetadata = normalizeMetadataInput(formState.sourceMetadata);
    if (!normalizedMetadata) {
      setMetadataGenerationError('Paste media metadata or type a request before generating.');
      toast.error('Paste media metadata or type a request before generating.');
      return;
    }

    setIsGeneratingMetadata(true);
    setMetadataGenerationError(null);

    const primaryAssetForContext = formState.mediaAssets[0];

    try {
      const response = await generateComposeContent({
        requestText: normalizedMetadata,
        model: settings.videoOpenaiModel || 'gpt-5-mini',
        selectedPlatforms: formState.platforms,
        availablePlaylists: youtubePlaylists,
        sharedCaptionPrompt: settings.videoUniversalCaptionPrompt || undefined,
        youtubeTitlePrompt: settings.videoYoutubeTitlePrompt || undefined,
        youtubeDescriptionPrompt: settings.videoYoutubeDescriptionPrompt || undefined,
        youtubePlaylistPrompt: settings.videoYoutubePlaylistPrompt || undefined,
        reviewPrompt: settings.videoReviewPrompt || undefined,
        summaryPrompt: settings.videoSummaryPrompt || undefined,
        mediaContext: primaryAssetForContext
          ? {
              fileName: primaryAssetForContext.fileName,
              mimeType: primaryAssetForContext.mimeType,
              mediaKind: primaryAssetForContext.kind,
            }
          : undefined,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to generate post content.');
      }

      setLatestDetectedIntent(response.data.intentResult);
      setLatestExtractedMetadata(response.data.mediaMetadata);

      if (response.data.intentResult.outputMode === 'preview_only') {
        setEditorialPreview(response.data.editorialResult);
        setPendingGeneratedContentAction(null);
        setIsReplaceGeneratedContentOpen(false);

        if (!response.data.editorialResult.text.trim()) {
          throw new Error('AI did not return preview content for this request.');
        }

        toast.success('Preview generated.');
        return;
      }

      setEditorialPreview(null);

      const generatedFields: Partial<Record<EditableComposeField, string>> = {};
      if (response.data.postFields.sharedCaption.trim()) {
        generatedFields.sharedCaption = response.data.postFields.sharedCaption;
      }
      if (response.data.postFields.youtubeTitle.trim()) {
        generatedFields.youtubeTitle = response.data.postFields.youtubeTitle;
      }
      if (response.data.postFields.youtubeDescription.trim()) {
        generatedFields.youtubeDescription = response.data.postFields.youtubeDescription;
      }
      if (response.data.postFields.playlistSelection.playlistId) {
        generatedFields.youtubePlaylist = response.data.postFields.playlistSelection.playlistId;
      }

      if (Object.keys(generatedFields).length === 0) {
        throw new Error('AI did not return any post fields for this request.');
      }

      const action: PendingGeneratedContentAction = {
        kind: 'direct-fill',
        fields: generatedFields,
        playlistReason: response.data.postFields.playlistSelection.reason || '',
      };

      if (forceReplace) {
        applyPendingGeneratedContentAction(action);
      } else {
        queueGeneratedContentAction(action);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate post content.';
      setMetadataGenerationError(message);
      toast.error(message);
    } finally {
      setIsGeneratingMetadata(false);
    }
  }, [
    applyPendingGeneratedContentAction,
    formState.mediaAssets,
    formState.platforms,
    formState.sourceMetadata,
    queueGeneratedContentAction,
    settings.videoOpenaiModel,
    settings.videoReviewPrompt,
    settings.videoSummaryPrompt,
    settings.videoUniversalCaptionPrompt,
    settings.videoYoutubeDescriptionPrompt,
    settings.videoYoutubePlaylistPrompt,
    settings.videoYoutubeTitlePrompt,
    youtubePlaylists,
  ]);

  const handleGenerateMetadata = () => {
    void runMetadataGeneration();
  };

  const runThumbnailGeneration = useCallback(async (
    key: 'sharedThumbnail' | 'youtubeThumbnail' | 'xThumbnail',
    forceReplace = false,
  ) => {
    const normalizedMetadata = normalizeMetadataInput(formState.sourceMetadata);
    if (!normalizedMetadata) {
      toast.error('Paste source metadata before generating thumbnails.');
      return;
    }

    if (formState[key] && !forceReplace) {
      setPendingThumbnailGenerationKey(key);
      setIsReplaceGeneratedThumbnailOpen(true);
      return;
    }

    setThumbnailGenerationState((current) => ({ ...current, [key]: true }));

    try {
      const response = await generateComposeThumbnail({
        metadataText: normalizedMetadata,
        model: settings.videoOpenaiModel || 'gpt-5-mini',
        thumbnailType:
          key === 'sharedThumbnail'
            ? 'shared'
            : key === 'youtubeThumbnail'
              ? 'youtube'
              : 'x',
        titleHint: formState.youtubeTitle || buildItemTitle(formState),
        sharedCaption: formState.sharedCaption,
        youtubeTitle: formState.youtubeTitle,
        thumbnailConfig:
          key === 'youtubeThumbnail'
            ? settings.thumbnailConfig_youtube
            : key === 'xThumbnail'
              ? settings.thumbnailConfig_x
              : undefined,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to generate thumbnail.');
      }

      updateThumbnail(key, () => ({
        fileName: response.data.fileName,
        mimeType: response.data.mimeType,
        size: response.data.size || 0,
        previewUrl: response.data.previewUrl,
        storageUrl: response.data.storageUrl,
        uploadStatus: 'uploaded',
        uploadError: undefined,
      }));

      setIsReplaceGeneratedThumbnailOpen(false);
      setPendingThumbnailGenerationKey(null);
      toast.success(
        key === 'sharedThumbnail'
          ? 'Shared thumbnail generated.'
          : key === 'youtubeThumbnail'
            ? 'YouTube thumbnail generated.'
            : 'X thumbnail generated.',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate thumbnail.';
      toast.error(message);
    } finally {
      setThumbnailGenerationState((current) => ({ ...current, [key]: false }));
    }
  }, [
    formState,
    settings.videoOpenaiModel,
    updateThumbnail,
  ]);

  const handleGenerateThumbnail = (key: 'sharedThumbnail' | 'youtubeThumbnail' | 'xThumbnail') => {
    void runThumbnailGeneration(key);
  };

  const recoverThumbnailPreview = useCallback(async (key: 'sharedThumbnail' | 'youtubeThumbnail' | 'xThumbnail') => {
    const currentThumbnail = formState[key];
    if (!currentThumbnail?.storageUrl || currentThumbnail.previewUrl?.startsWith('data:')) {
      return;
    }

    try {
      const resolvedPreviewUrl = await resolveComposeAssetPreview(currentThumbnail.storageUrl);
      updateThumbnail(key, (thumbnail) => {
        if (!thumbnail || thumbnail.storageUrl !== currentThumbnail.storageUrl) {
          return thumbnail;
        }

        return {
          ...thumbnail,
          previewUrl: resolvedPreviewUrl,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load thumbnail preview.';
      console.warn(`[ComposeEditorPage] ${message}`);
    }
  }, [formState, updateThumbnail]);

  const recoverAssetPreview = useCallback(async (assetId: string) => {
    if (recoveringAssetIdsRef.current.has(assetId)) {
      return;
    }

    const currentAsset = formState.mediaAssets.find((asset) => asset.id === assetId);
    if (!currentAsset?.storageUrl || currentAsset.previewUrl?.startsWith('blob:') || currentAsset.previewUrl?.startsWith('data:')) {
      return;
    }

    recoveringAssetIdsRef.current.add(assetId);

    try {
      const refreshedAccess = await resolveComposeAssetAccess(currentAsset.storageUrl);
      setFormState((current) => ({
        ...current,
        mediaAssets: current.mediaAssets.map((asset) => (
          asset.id === assetId && asset.storageUrl === currentAsset.storageUrl
            ? {
                ...asset,
                previewUrl: refreshedAccess.previewUrl || asset.previewUrl,
              }
            : asset
        )),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh asset preview.';
      console.warn(`[ComposeEditorPage] ${message}`);
    } finally {
      recoveringAssetIdsRef.current.delete(assetId);
    }
  }, [formState.mediaAssets]);

  const buildItem = (status: ComposeItem['status'], scheduledAt?: string, error?: string): ComposeItem => {
    const now = new Date().toISOString();
    return {
      id: existingItem?.id || `compose-${Date.now()}`,
      title: buildItemTitle(formState),
      status,
      mediaAssets: formState.mediaAssets,
      sourceMetadata: formState.sourceMetadata,
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
  const scheduledPreviewDate = scheduledAtPreview ? new Date(scheduledAtPreview) : null;
  const scheduledPreviewableAssets = formState.mediaAssets.filter((asset) => Boolean(getComposeAssetPreviewUrl(asset)));
  const scheduledPrimaryAsset = scheduledPreviewableAssets[0] ?? formState.mediaAssets[0];
  const scheduledPrimaryPreviewUrl = getComposeAssetPreviewUrl(scheduledPrimaryAsset);
  const scheduledCardPreviewUrl = buildComposeAssetStreamUrl(scheduledPrimaryPreviewUrl) || scheduledPrimaryPreviewUrl;
  const scheduledExtraAssetCount = Math.max(scheduledPreviewableAssets.length - 1, 0);
  const scheduledCardTitle = buildItemTitle(formState);
  const scheduledCardMeta = scheduledPreviewDate ? `Scheduled ${scheduledPreviewDate.toLocaleString()}` : '';

  const validate = (mode: 'draft' | 'scheduled' | 'published') => {
    if (isGeneratingThreadsXCrop) {
      toast.error('Wait for the Threads/X 3:4 crop to finish generating.');
      return false;
    }

    if (isThreadsXCropEnabled && isUploadingThreadsXCrop && !isThreadsXCropReady && mode !== 'draft') {
      toast.error('Wait for the Threads/X 3:4 crop to finish uploading.');
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
    scheduleReopenLockUntilRef.current = Date.now() + 450;
    setIsScheduleOpen(false);
    toast.success(existingItem?.status === 'scheduled' ? 'Schedule updated' : 'Post scheduled');
  };

  const isEditingScheduledItem = existingItem?.status === 'scheduled';
  const openScheduleSheet = () => {
    if (Date.now() < scheduleReopenLockUntilRef.current) {
      return;
    }

    setIsScheduleOpen(true);
  };

  const handlePublish = async () => {
    if (!validate('published')) return;
    setIsPublishing(true);

    const draftItem = buildItem('draft');

    try {
      const result = await publishComposeItem(draftItem);
      const nextStatus = result.postedPlatforms.length > 0 ? 'published' : 'failed';
      const nextError =
        nextStatus === 'published'
          ? undefined
          : result.failedResults.length > 0
            ? result.errorMessage || 'Some platforms failed to publish.'
            : undefined;

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

  const publishValidation = validateComposeItemAction(buildItem('published', undefined, existingItem?.error), {
    mode: 'published',
  });

  const publishBlockingMessage =
    isUploadingMedia || hasUploadingAssets
      ? 'Wait for media uploads to finish before publishing.'
      : hasUploadingThumbnails
        ? 'Wait for thumbnail uploads to finish before publishing.'
        : hasGeneratingThumbnails
          ? 'Wait for thumbnail generation to finish before publishing.'
          : isGeneratingThreadsXCrop
            ? 'Wait for the Threads/X 3:4 crop to finish generating.'
            : isThreadsXCropEnabled && isUploadingThreadsXCrop && !isThreadsXCropReady
              ? 'The 3:4 crop preview is ready, but the cropped video is still uploading before Threads/X can publish.'
              : isGeneratingMetadata
                ? 'Wait for AI content generation to finish before publishing.'
                : !publishValidation.ok
                  ? publishValidation.error
                  : undefined;

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
        <div className="relative space-y-6">
          <div className="pointer-events-none sticky top-24 z-20 -mb-16 flex justify-end pr-1">
            <div className="pointer-events-auto flex flex-col gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                aria-label="Undo post changes"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white/92 shadow-sm backdrop-blur transition hover:border-[#ec1e24]/60 hover:text-[#ec1e24] disabled:cursor-not-allowed disabled:opacity-35 dark:border-[#333333] dark:bg-black/88 dark:text-white"
              >
                <span
                  aria-hidden="true"
                  className="h-5 w-5"
                  style={{
                    display: 'inline-block',
                    backgroundColor: 'currentColor',
                    WebkitMaskImage: `url("${undoIcon}")`,
                    maskImage: `url("${undoIcon}")`,
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                  }}
                />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                aria-label="Redo post changes"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white/92 shadow-sm backdrop-blur transition hover:border-[#ec1e24]/60 hover:text-[#ec1e24] disabled:cursor-not-allowed disabled:opacity-35 dark:border-[#333333] dark:bg-black/88 dark:text-white"
              >
                <span
                  aria-hidden="true"
                  className="h-5 w-5"
                  style={{
                    display: 'inline-block',
                    backgroundColor: 'currentColor',
                    WebkitMaskImage: `url("${redoIcon}")`,
                    maskImage: `url("${redoIcon}")`,
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                  }}
                />
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
            <div className="mb-4 space-y-3">
              <div>
                <h3 className="mb-1 text-gray-900 dark:text-white">Media Upload</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  Upload images or videos. Platform cards below show what works as a single post or carousel.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="compose-media"
                  className={`cursor-pointer ${mediaDrop.isDragging ? 'rounded-lg ring-1 ring-[#ec1e24]/50' : ''}`}
                  {...mediaDrop.bind}
                >
                  <span className="sr-only">Upload media</span>
                  <div
                    className={`inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111] ${
                      mediaDrop.isDragging ? 'border-[#ec1e24] bg-[#ec1e24]/10' : ''
                    }`}
                  >
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
              <div className="flex items-center gap-2">
                <Input
                  value={mediaUrlInput}
                  onChange={(event) => setMediaUrlInput(event.target.value)}
                  placeholder="Paste a YouTube or Instagram URL..."
                  className="bg-white dark:bg-black"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleImportMediaUrl();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => void handleImportMediaUrl()}
                  disabled={isUploadingMedia || !mediaUrlInput.trim()}
                  className="shrink-0"
                >
                  {isUploadingMedia ? 'Importing...' : 'Upload'}
                </Button>
              </div>
              <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 dark:text-white">Search TMDb Images</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      Find a movie, TV show, person, network, or company, then add posters, backdrops, profiles, or logos directly to this post.
                    </p>
                  </div>
                  {(tmdbSearchQuery.trim() || tmdbResults.length || selectedTmdbResult) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleClearTmdbSearch}
                      className="h-8 min-h-8 w-8 min-w-8 shrink-0 rounded-full border border-gray-200 p-0 text-[#6B7280] hover:bg-white hover:text-[#ec1e24] dark:border-[#333333] dark:hover:bg-black"
                      aria-label="Clear TMDb search"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      value={tmdbSearchQuery}
                      onChange={(event) => setTmdbSearchQuery(event.target.value)}
                      placeholder="Search TMDb for movie, TV, person, or company..."
                      className="w-full bg-white dark:bg-black"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => void handleTmdbSearch()}
                    disabled={isSearchingTmdb || !tmdbSearchQuery.trim()}
                    className="shrink-0"
                  >
                    {isSearchingTmdb ? 'Searching...' : 'Search'}
                  </Button>
                </div>

                {selectedTmdbResult ? (
                  <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-[#333333] dark:bg-black">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleBackToTmdbResults}
                        className="inline-flex items-center text-xs text-[#6B7280] transition-colors hover:text-[#ec1e24] dark:text-[#9CA3AF]"
                        aria-label="Back to TMDb results"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs uppercase tracking-[0.24em] text-[#6B7280] dark:text-[#9CA3AF]">
                        {getTmdbResultMetaLabel(selectedTmdbResult)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white">{selectedTmdbResult.title}</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTmdbResult.mediaType !== 'person' ? (
                        <>
                          {tmdbImagePool?.backdrops?.length ? (
                            <Button
                              type="button"
                              variant={tmdbImageCategory === 'backdrops' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setTmdbImageCategory('backdrops')}
                            >
                              Backdrops
                            </Button>
                          ) : null}
                          {tmdbImagePool?.posters?.length ? (
                            <Button
                              type="button"
                              variant={tmdbImageCategory === 'posters' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setTmdbImageCategory('posters')}
                            >
                              Posters
                            </Button>
                          ) : null}
                          {tmdbImagePool?.logos?.length ? (
                            <Button
                              type="button"
                              variant={tmdbImageCategory === 'logos' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setTmdbImageCategory('logos')}
                            >
                              Logos
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      {selectedTmdbResult.mediaType === 'person' ? (
                        <Button type="button" variant="default" size="sm">
                          Profiles
                        </Button>
                      ) : null}
                    </div>
                    {isLoadingTmdbImages ? (
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Loading images...</p>
                    ) : activeTmdbImages.length ? (
                      <div className="space-y-2">
                        {tmdbImageCategory === 'logos' ? (
                          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                            Logo picks are automatically placed on a solid background before they are added to Media Upload.
                          </p>
                        ) : null}
                        <div className="grid grid-cols-2 gap-3">
                        {activeTmdbImages.map((asset, index) => (
                          <button
                            key={`${asset.url}-${index}`}
                            type="button"
                            onClick={() => void handleSelectTmdbImage(asset.url)}
                            className="overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-[#ec1e24] dark:border-[#333333] dark:bg-[#050505]"
                          >
                            <img
                              src={asset.url}
                              alt={`${selectedTmdbResult.title} ${tmdbImageCategory}`}
                              className={`w-full ${tmdbImageCategory === 'backdrops' ? 'aspect-video object-cover' : tmdbImageCategory === 'logos' ? 'aspect-square object-contain bg-[#111111] p-4' : 'aspect-[2/3] object-cover'}`}
                            />
                          </button>
                        ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">No images available for this category.</p>
                    )}
                  </div>
                ) : tmdbResults.length ? (
                  <div className="space-y-2">
                    {tmdbResults.map((result) => {
                      const thumb = result.backdrop || result.poster || result.profile || '';
                      return (
                        <button
                          key={`${result.mediaType}-${result.id}`}
                          type="button"
                          onClick={() => void handleSelectTmdbResult(result)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left transition hover:border-[#ec1e24] dark:border-[#333333] dark:bg-black"
                        >
                          <div className="h-14 w-14 overflow-hidden rounded-xl bg-[#111111]">
                            {thumb ? <img src={thumb} alt={result.title} className="h-full w-full object-cover" /> : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-gray-900 dark:text-white">{result.title}</p>
                            <p className="text-xs uppercase tracking-[0.24em] text-[#6B7280] dark:text-[#9CA3AF]">
                              {getTmdbResultMetaLabel(result)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
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
                      {getAssetDisplayUrl(asset) ? (
                        <button
                          type="button"
                          onClick={() => handlePreviewAsset(asset)}
                          className="group relative block w-full bg-black text-left"
                          aria-label={`Preview ${asset.kind} ${asset.fileName}`}
                        >
                          {asset.kind === 'video' ? (
                            <>
                              {(() => {
                                const renderUrls = buildComposeRenderableUrls({
                                  previewUrl: asset.previewUrl,
                                  storageUrl: asset.storageUrl,
                                });
                                return (
                              <video
                                src={renderUrls[0]}
                                data-fallback-index="0"
                                onError={(event) => {
                                  handleRenderableMediaError(event, renderUrls);
                                  void recoverAssetPreview(asset.id);
                                }}
                                className="pointer-events-none h-48 w-full object-contain"
                                muted
                                playsInline
                                preload="metadata"
                              />
                                );
                              })()}
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                                  <Film className="h-5 w-5" />
                                </div>
                              </div>
                            </>
                          ) : (
                            (() => {
                              const renderUrls = buildComposeRenderableUrls({
                                previewUrl: asset.previewUrl,
                                storageUrl: asset.storageUrl,
                              });
                              return (
                            <img
                              src={renderUrls[0]}
                              data-fallback-index="0"
                              onError={(event) => {
                                handleRenderableMediaError(event, renderUrls);
                                void recoverAssetPreview(asset.id);
                              }}
                              alt={asset.fileName}
                              className="pointer-events-none h-48 w-full object-cover"
                            />
                              );
                            })()
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
                <p className="mb-1 text-[#6B7280] dark:text-[#9CA3AF]">No media added yet</p>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Upload images, videos, or a mixed set to prepare platform-specific delivery.</p>
              </div>
            )}
          </div>

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
                            src={activeThreadsXCropPreviewUrl || getAssetDisplayUrl(primaryVideoAsset)}
                            className="absolute inset-0 h-full w-full object-cover"
                            style={activeThreadsXCropPreviewUrl ? undefined : { objectPosition: `50% ${formState.videoCropFocusYPercent}%` }}
                            muted
                            playsInline
                            preload="metadata"
                            controls={Boolean(activeThreadsXCropPreviewUrl)}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                        {activeThreadsXCropPreviewUrl
                          ? 'Showing the generated 3:4 crop preview. Use Generate Again after adjusting the framing.'
                          : 'Adjust the crop up or down for end-card logos and titles like the Mortal Kombat II screen you shared.'}
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
                              : isUploadingThreadsXCrop && hasThreadsXCropPreviewReady
                                ? '3:4 crop preview is ready. Uploading for Threads and X...'
                                : 'The 3:4 crop generates automatically when you enable it or change the framing.'}
                        </p>
                        <p className="mt-1 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                          {formState.threadsXCropVideo?.uploadError
                            ? formState.threadsXCropVideo.uploadError
                            : isThreadsXCropReady
                              ? `Prepared as ${formState.threadsXCropVideo?.fileName}`
                              : isUploadingThreadsXCrop && hasThreadsXCropPreviewReady
                                ? 'Preview is available now. Keep this sheet open while the cropped file uploads for publishing.'
                                : 'Wait for the auto-generated variant before scheduling or publishing with this crop enabled.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {hasThreadsXCropPreviewReady ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handlePreviewThreadsXCrop}
                          >
                            Preview 3:4 Crop
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          onClick={() => void handleGenerateThreadsXCrop()}
                          disabled={isGeneratingThreadsXCrop || isUploadingThreadsXCrop || !primaryVideoAsset}
                        >
                          {isGeneratingThreadsXCrop
                            ? 'Generating 3:4 Video...'
                            : isUploadingThreadsXCrop
                              ? 'Uploading 3:4 Video...'
                              : formState.threadsXCropVideo?.uploadError
                                ? 'Retry 3:4 Video'
                                : (isThreadsXCropReady || hasThreadsXCropPreviewReady)
                                  ? 'Regenerate 3:4 Video'
                                  : 'Generate 3:4 Video'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
            <div className="mb-4">
              <div>
                <h3 className="mb-1 text-gray-900 dark:text-white">Source or Prompt Input</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  Paste trailer, teaser, movie, or TV metadata here, or type a request like "write a review for The Matrix for 60 seconds video." AI will generate post content and, when relevant, YouTube details.
                </p>
              </div>
            </div>

            <div className="relative">
              <Textarea
                value={formState.sourceMetadata}
                onChange={(event) => {
                  setFormState((current) => ({ ...current, sourceMetadata: event.target.value }));
                  if (metadataGenerationError) {
                    setMetadataGenerationError(null);
                  }
                }}
                placeholder={'Paste metadata or type a request like "Generate a caption for this trailer" or "Write a review for The Matrix for 60 seconds video"...'}
                className="min-h-[200px] border-gray-200 bg-white pb-16 dark:border-[#333333] dark:bg-[#000000]"
              />
              <button
                type="button"
                onClick={handleGenerateMetadata}
                disabled={isGeneratingMetadata || !normalizeMetadataInput(formState.sourceMetadata)}
                aria-label={isGeneratingMetadata ? 'Generating content' : 'Generate content'}
                className="absolute bottom-3 right-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#ec1e24] text-white transition-colors hover:bg-[#d81920] disabled:cursor-not-allowed disabled:bg-[#7f1d1d] disabled:text-white/70"
              >
                {isGeneratingMetadata ? (
                  <RedSpinner size="sm" label="Generating metadata content..." />
                ) : (
                  <ArrowUp className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                  Uses the selected Video Settings model and saved prompts for caption, YouTube title, description, playlist, review, and summary generation.
                </p>
                {latestDetectedIntent ? (
                  <span className="rounded-full border border-[#333333] bg-[#111111] px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-[#9CA3AF]">
                    {getIntentBadgeLabel(latestDetectedIntent)}
                  </span>
                ) : null}
              </div>
              {metadataGenerationError ? (
                <p className="text-xs text-[#EF4444]">{metadataGenerationError}</p>
              ) : null}
            </div>

            {latestExtractedMetadata && (latestExtractedMetadata.title || latestExtractedMetadata.platform || latestExtractedMetadata.releaseDate || latestExtractedMetadata.mediaType) ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {latestExtractedMetadata.title ? (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-[#111111] dark:text-[#9CA3AF]">
                    {latestExtractedMetadata.title}
                  </span>
                ) : null}
                {latestExtractedMetadata.mediaType ? (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 capitalize dark:bg-[#111111] dark:text-[#9CA3AF]">
                    {latestExtractedMetadata.mediaType.replace(/_/g, ' ')}
                  </span>
                ) : null}
                {latestExtractedMetadata.platform ? (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-[#111111] dark:text-[#9CA3AF]">
                    {latestExtractedMetadata.platform}
                  </span>
                ) : null}
                {latestExtractedMetadata.releaseDate ? (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-[#111111] dark:text-[#9CA3AF]">
                    {latestExtractedMetadata.releaseDate}
                  </span>
                ) : null}
              </div>
            ) : null}

            {editorialPreview?.text ? (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm text-gray-900 dark:text-white">
                      {editorialPreview.type === 'review'
                        ? 'Generated Review'
                        : editorialPreview.type === 'summary'
                          ? 'Generated Summary'
                          : 'Generated Result'}
                    </h4>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      Preview-only request. Apply it only where you want it.
                    </p>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-[#E5E7EB]">{editorialPreview.text}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => queueGeneratedContentAction({
                      kind: 'editorial-apply',
                      targetField: 'sharedCaption',
                      text: editorialPreview.text,
                    })}
                  >
                    Use as Shared Caption
                  </Button>
                  {isYouTubeSelected ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => queueGeneratedContentAction({
                        kind: 'editorial-apply',
                        targetField: 'youtubeDescription',
                        text: editorialPreview.text,
                      })}
                    >
                      Use as YouTube Description
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(editorialPreview.text);
                        toast.success('Copied generated text.');
                      } catch {
                        toast.error('Failed to copy generated text.');
                      }
                    }}
                  >
                    Copy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateMetadata}
                    disabled={isGeneratingMetadata}
                  >
                    Regenerate
                  </Button>
                </div>
              </div>
            ) : null}
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
                setFieldManualEdits((current) => ({ ...current, sharedCaption: true }));
                haptics.selection();
              }}
              onBlur={() => {
                setFormState((current) => ({ ...current, sharedCaption: normalizeComposeParagraphText(current.sharedCaption) }));
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
                  <Input value={formState.youtubeTitle} onChange={(event) => {
                    setFormState((current) => ({ ...current, youtubeTitle: event.target.value }));
                    setFieldManualEdits((current) => ({ ...current, youtubeTitle: true }));
                  }} className="mt-1 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]" />
                </div>
                {isYouTubeLongformSelected ? (
                  <>
                    <div>
                      <Label className="text-gray-600 dark:text-[#9CA3AF]">Description</Label>
                      <Textarea value={formState.youtubeDescription} onChange={(event) => {
                        setFormState((current) => ({ ...current, youtubeDescription: event.target.value }));
                        setFieldManualEdits((current) => ({ ...current, youtubeDescription: true }));
                      }} onBlur={() => {
                        setFormState((current) => ({ ...current, youtubeDescription: normalizeComposeParagraphText(current.youtubeDescription) }));
                      }} className="mt-1 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]" />
                    </div>
                    <div>
                      <Label className="text-gray-600 dark:text-[#9CA3AF]">Playlist</Label>
                      <Select value={formState.youtubePlaylist} onValueChange={(value) => {
                        setFormState((current) => ({ ...current, youtubePlaylist: value }));
                        setFieldManualEdits((current) => ({ ...current, youtubePlaylist: true }));
                      }}>
                        <SelectTrigger className="mt-1 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]">
                          <SelectValue placeholder="Select a playlist" />
                        </SelectTrigger>
                        <SelectContent>
                          {formState.youtubePlaylist && !hasMatchingYouTubePlaylist && (
                            <SelectItem value={formState.youtubePlaylist}>
                              {getPlaylistLabel(formState.youtubePlaylist, youtubePlaylists)}
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
                            <SelectItem key={playlist.id} value={playlist.id}>
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

          {shouldShowVideoThumbnails ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
              <div className="mb-4">
                <h3 className="mb-1 text-gray-900 dark:text-white">Video Thumbnails</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  Add optional thumbnails for a single-video post. Shared thumbnail is used for Facebook, Instagram, and TikTok.
                </p>
              </div>

              <div className={`grid gap-4 ${isCompactLayout ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
                {[
                  shouldShowSharedThumbnailSection
                    ? {
                        key: 'sharedThumbnail' as const,
                        label: 'Shared Thumbnail',
                        description: 'Facebook, Instagram, TikTok',
                        supportsGeneration: true,
                      }
                    : null,
                  shouldShowYouTubeThumbnailSection
                    ? {
                        key: 'youtubeThumbnail' as const,
                        label: 'YouTube Thumbnail',
                        description: 'YouTube only',
                        supportsGeneration: true,
                      }
                    : null,
                ].filter(Boolean).map(({ key, label, description, supportsGeneration }) => {
                  const thumbnail = formState[key];
                  const previewUrl = getThumbnailDisplayUrl(thumbnail);
                  const isGeneratingThisThumbnail = Boolean(thumbnailGenerationState[key]);
                  const thumbnailDrop = key === 'sharedThumbnail'
                    ? sharedThumbnailDrop
                    : key === 'youtubeThumbnail'
                      ? youtubeThumbnailDrop
                      : xThumbnailDrop;

                  return (
                    <div key={key} className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {supportsGeneration ? (
                            <button
                              type="button"
                              onClick={() => handleGenerateThumbnail(key)}
                              disabled={isGeneratingThisThumbnail || !normalizeMetadataInput(formState.sourceMetadata)}
                              className="inline-flex h-10 min-h-10 w-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white p-0 text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
                              aria-label={`Generate ${label}`}
                              title={`Generate ${label}`}
                            >
                              {isGeneratingThisThumbnail ? (
                                <RedSpinner size="sm" label={`Generating ${label}...`} />
                              ) : (
                                <RotateCcw className="h-4 w-4 text-white" />
                              )}
                            </button>
                          ) : null}
                          {thumbnail ? (
                            <button
                              type="button"
                              onClick={() => removeThumbnail(key)}
                              className="flex h-10 min-h-10 w-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 p-0 text-gray-600 transition-colors hover:bg-white dark:border-[#333333] dark:text-[#9CA3AF] dark:hover:bg-[#111111]"
                              aria-label={`Remove ${label}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3">
                        <Label
                          htmlFor={`compose-thumbnail-${key}`}
                          className={`cursor-pointer ${thumbnailDrop.isDragging ? 'rounded-lg ring-1 ring-[#ec1e24]/50' : ''}`}
                          {...thumbnailDrop.bind}
                        >
                          <span className="sr-only">Upload {label}</span>
                          <div
                            className={`inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111] ${
                              thumbnailDrop.isDragging ? 'border-[#ec1e24] bg-[#ec1e24]/10' : ''
                            }`}
                          >
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
                          <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                            {supportsGeneration
                              ? 'Upload manually or generate from Source Metadata'
                              : 'PNG or JPG recommended'}
                          </p>
                        )}
                      </div>

                      {key === 'sharedThumbnail' ? (
                        <div className="mt-4 min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 dark:border-[#333333] dark:bg-black">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-gray-900 dark:text-white">Search TMDb Images</p>
                              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                                Search TMDb and add a result directly to the shared thumbnail.
                              </p>
                            </div>
                            {(thumbnailTmdbSearchQuery.trim() || thumbnailTmdbResults.length || selectedThumbnailTmdbResult) ? (
                              <button
                                type="button"
                                onClick={handleClearThumbnailTmdbSearch}
                                className="inline-flex h-8 min-h-8 w-8 min-w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 p-0 text-[#6B7280] transition-colors hover:border-[#ec1e24] hover:text-[#ec1e24] dark:border-[#333333] dark:text-[#9CA3AF]"
                                aria-label="Clear TMDb thumbnail search"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>

                          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                              <Input
                                value={thumbnailTmdbSearchQuery}
                                onChange={(event) => setThumbnailTmdbSearchQuery(event.target.value)}
                                placeholder="Search TMDb for movie, TV, person, or company..."
                                className="w-full border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]"
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void handleThumbnailTmdbSearch();
                                  }
                                }}
                              />
                            </div>
                            <Button
                              type="button"
                              onClick={() => void handleThumbnailTmdbSearch()}
                              disabled={!thumbnailTmdbSearchQuery.trim() || isSearchingThumbnailTmdb}
                              className="w-full sm:w-auto"
                            >
                              {isSearchingThumbnailTmdb ? 'Searching...' : 'Search'}
                            </Button>
                          </div>

                          {selectedThumbnailTmdbResult ? (
                            <div className="mt-3 space-y-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-[#333333] dark:bg-black">
                              <div className="flex items-center justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={handleBackToThumbnailTmdbResults}
                                  className="inline-flex items-center text-xs text-[#6B7280] transition-colors hover:text-[#ec1e24] dark:text-[#9CA3AF]"
                                  aria-label="Back to TMDb thumbnail results"
                                >
                                  <ArrowLeft className="h-3.5 w-3.5" />
                                </button>
                                <span className="text-xs uppercase tracking-[0.24em] text-[#6B7280] dark:text-[#9CA3AF]">
                                  {getTmdbResultMetaLabel(selectedThumbnailTmdbResult)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-900 dark:text-white">{selectedThumbnailTmdbResult.title}</p>
                              <div className="flex flex-wrap gap-2">
                                {selectedThumbnailTmdbResult.mediaType !== 'person' ? (
                                  <>
                                    {thumbnailTmdbImagePool?.backdrops?.length ? (
                                      <Button
                                        type="button"
                                        variant={thumbnailTmdbImageCategory === 'backdrops' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setThumbnailTmdbImageCategory('backdrops')}
                                      >
                                        Backdrops
                                      </Button>
                                    ) : null}
                                    {thumbnailTmdbImagePool?.posters?.length ? (
                                      <Button
                                        type="button"
                                        variant={thumbnailTmdbImageCategory === 'posters' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setThumbnailTmdbImageCategory('posters')}
                                      >
                                        Posters
                                      </Button>
                                    ) : null}
                                    {thumbnailTmdbImagePool?.logos?.length ? (
                                      <Button
                                        type="button"
                                        variant={thumbnailTmdbImageCategory === 'logos' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setThumbnailTmdbImageCategory('logos')}
                                      >
                                        Logos
                                      </Button>
                                    ) : null}
                                  </>
                                ) : null}
                                {selectedThumbnailTmdbResult.mediaType === 'person' ? (
                                  <Button type="button" variant="default" size="sm">
                                    Profiles
                                  </Button>
                                ) : null}
                              </div>
                              {isLoadingThumbnailTmdbImages ? (
                                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Loading images...</p>
                              ) : activeThumbnailTmdbImages.length ? (
                                <div className="grid grid-cols-2 gap-3">
                                  {activeThumbnailTmdbImages.map((asset, index) => (
                                    <button
                                      key={`${asset.url}-${index}`}
                                      type="button"
                                      onClick={() => void handleSelectThumbnailTmdbImage(asset.url)}
                                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-[#ec1e24] dark:border-[#333333] dark:bg-[#050505]"
                                    >
                                      <img
                                        src={asset.url}
                                        alt={`${selectedThumbnailTmdbResult.title} ${thumbnailTmdbImageCategory}`}
                                        className={`w-full ${
                                          thumbnailTmdbImageCategory === 'backdrops'
                                            ? 'aspect-video object-cover'
                                            : thumbnailTmdbImageCategory === 'logos'
                                              ? 'aspect-square object-contain bg-[#111111] p-4'
                                              : 'aspect-[2/3] object-cover'
                                        }`}
                                      />
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">No images available for this category.</p>
                              )}
                            </div>
                          ) : thumbnailTmdbResults.length ? (
                            <div className="mt-3 space-y-2">
                              {thumbnailTmdbResults.map((result) => {
                                const thumb = result.backdrop || result.poster || result.profile || '';
                                return (
                                  <button
                                    key={`${result.mediaType}-${result.id}`}
                                    type="button"
                                    onClick={() => void handleSelectThumbnailTmdbResult(result)}
                                    className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left transition hover:border-[#ec1e24] dark:border-[#333333] dark:bg-black"
                                  >
                                    <div className="h-14 w-14 overflow-hidden rounded-xl bg-[#111111]">
                                      {thumb ? <img src={thumb} alt={result.title} className="h-full w-full object-cover" /> : null}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm text-gray-900 dark:text-white">{result.title}</p>
                                      <p className="text-xs uppercase tracking-[0.24em] text-[#6B7280] dark:text-[#9CA3AF]">
                                        {getTmdbResultMetaLabel(result)}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

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
                              onError={() => {
                                void recoverThumbnailPreview(key);
                              }}
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
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
            <h3 className="mb-4 text-gray-900 dark:text-white">Save State</h3>
            <div className="space-y-3">
              <Button className="w-full" onClick={handleSaveDraft} disabled={hasUploadingAssets || isUploadingMedia || hasUploadingThumbnails || hasGeneratingThumbnails || isThreadsXCropBlockingActions || isGeneratingMetadata}>Save</Button>
              <Button className="w-full" onClick={handlePublish} disabled={hasUploadingAssets || isUploadingMedia || hasUploadingThumbnails || hasGeneratingThumbnails || isThreadsXCropBlockingActions || isGeneratingMetadata || isPublishing}>
                {isPublishing ? (
                  <>
                    <RedSpinner size="sm" className="mr-2" label="Publishing post..." />
                    Publish
                  </>
                ) : 'Publish'}
              </Button>
              <Button variant="outline" className="w-full" onClick={openScheduleSheet} disabled={hasUploadingAssets || isUploadingMedia || hasUploadingThumbnails || hasGeneratingThumbnails || isThreadsXCropBlockingActions || isGeneratingMetadata}>
                {isEditingScheduledItem ? 'Update Schedule' : 'Schedule'}
              </Button>
            </div>
            {publishBlockingMessage ? (
              <p className="mt-3 text-sm text-[#6B7280] dark:text-[#9CA3AF]">{publishBlockingMessage}</p>
            ) : null}

            {scheduledPreviewDate ? (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
                <div className="flex items-start gap-3">
                  {scheduledCardPreviewUrl ? (
                    <div className="relative mt-0.5 h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#ec1e24]/10 text-[#ec1e24]">
                      {scheduledPrimaryAsset?.kind === 'video' ? (
                        <>
                          <video
                            src={scheduledCardPreviewUrl}
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
                          src={scheduledCardPreviewUrl}
                          alt={scheduledPrimaryAsset?.fileName || scheduledCardTitle}
                          className="pointer-events-none h-full w-full object-cover"
                        />
                      )}
                      {scheduledExtraAssetCount > 0 ? (
                        <span className="absolute bottom-1 right-1 rounded-full bg-black/75 px-1.5 py-0.5 text-[10px] text-white">
                          +{scheduledExtraAssetCount}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="relative mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#ec1e24]/10 text-[#ec1e24]">
                      {scheduledPrimaryAsset?.kind === 'video' ? <Film className="h-5 w-5" /> : scheduledPrimaryAsset ? <ImageIcon className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="mb-1 truncate text-gray-900 dark:text-white">{scheduledCardTitle}</h4>
                      <p className="mb-2 text-sm text-[#6B7280] dark:text-[#9CA3AF]">{scheduledCardMeta}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {formState.platforms.length ? (
                          formState.platforms.map((platform) => (
                            <span
                              key={platform}
                              className="rounded bg-gray-200 px-2 py-1 text-xs uppercase text-gray-700 dark:bg-[#1F1F1F] dark:text-[#9CA3AF]"
                            >
                              {getComposePlatformLabel(platform)}
                            </span>
                          ))
                        ) : (
                          <span className="rounded bg-gray-200 px-2 py-1 text-xs uppercase text-gray-700 dark:bg-[#1F1F1F] dark:text-[#9CA3AF]">
                            No platform
                          </span>
                        )}
                        {isThreadsXCropEnabled ? (
                          <span className={`rounded px-2 py-1 text-xs ${
                            isThreadsXCropReady
                              ? 'bg-[#ec1e24]/10 text-[#ec1e24]'
                              : 'bg-[#FEF3C7] text-[#92400E] dark:bg-[#3A2A00] dark:text-[#FBBF24]'
                          }`}>
                            {isThreadsXCropReady ? 'Threads/X 3:4 Ready' : 'Threads/X 3:4 Pending'}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center rounded-lg bg-gray-200 px-3 py-1.5 text-sm text-gray-700 dark:bg-[#1f1f1f] dark:text-[#9CA3AF]">
                      Scheduled
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

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

      <BottomSheet
        open={isReplaceGeneratedContentOpen}
        onOpenChange={(open) => {
          setIsReplaceGeneratedContentOpen(open);
          if (!open) {
            setPendingGeneratedContentAction(null);
          }
        }}
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Replace Existing Content?</BottomSheetTitle>
          <BottomSheetDescription>
            {pendingGeneratedContentAction?.kind === 'editorial-apply'
              ? pendingGeneratedContentAction.targetField === 'sharedCaption'
                ? 'Applying this preview will replace the current Shared Caption.'
                : 'Applying this preview will replace the current YouTube Description.'
              : 'Generating again will replace the current manually edited fields that match this AI result.'}
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetFooter>
          <div className="flex w-full gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setIsReplaceGeneratedContentOpen(false);
                setPendingGeneratedContentAction(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                const action = pendingGeneratedContentAction;
                if (!action) {
                  setIsReplaceGeneratedContentOpen(false);
                  return;
                }

                applyPendingGeneratedContentAction(action);
              }}
            >
              {pendingGeneratedContentAction?.kind === 'editorial-apply'
                ? 'Replace Field'
                : 'Replace Generated Fields'}
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      <BottomSheet
        open={isReplaceGeneratedThumbnailOpen}
        onOpenChange={(open) => {
          setIsReplaceGeneratedThumbnailOpen(open);
          if (!open) {
            setPendingThumbnailGenerationKey(null);
          }
        }}
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Replace Current Thumbnail?</BottomSheetTitle>
          <BottomSheetDescription>
            Generating again will replace the current thumbnail in this slot.
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetFooter>
          <div className="flex w-full gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setIsReplaceGeneratedThumbnailOpen(false);
                setPendingThumbnailGenerationKey(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                const targetKey = pendingThumbnailGenerationKey;
                setIsReplaceGeneratedThumbnailOpen(false);
                setPendingThumbnailGenerationKey(null);
                if (targetKey) {
                  void runThumbnailGeneration(targetKey, true);
                }
              }}
            >
              Replace Thumbnail
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      <MediaPreviewDialog
        open={Boolean(previewAsset && activePreviewAssetUrl)}
        src={activePreviewAssetUrl}
        fallbackSources={previewAsset
          ? buildComposeRenderableUrls({
            previewUrl: previewAsset.previewUrl,
            storageUrl: previewAsset.storageUrl,
          }).slice(1)
          : []}
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
        src={getThumbnailDisplayUrl(previewThumbnail)}
        fallbackSources={previewThumbnail
          ? buildComposeRenderableUrls({
            previewUrl: previewThumbnail.previewUrl,
            storageUrl: previewThumbnail.storageUrl,
          }).slice(1)
          : []}
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
