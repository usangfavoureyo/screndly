import { useMemo, useState, type ChangeEvent } from 'react';
import { Film, Image as ImageIcon, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { BackIconButton } from '../BackIconButton';
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
  getComposeCompatibilityMap,
  normalizeComposeItem,
  summarizeComposeMedia,
} from '../../lib/create/composeMedia';
import { useComposeStore } from '../../store/useComposeStore';
import type { ComposeItem, ComposeMediaAsset, ComposePlatformKey } from '../../types/compose';
import { getConnectedPlatforms } from '../../utils/platformConnections';
import { haptics } from '../../utils/haptics';

interface ComposeEditorPageProps {
  onNavigate: (page: string, fromPage?: string) => void;
  previousPage?: string | null;
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
const YOUTUBE_PLAYLISTS = ['Upcoming Posts', 'Reviews', 'Highlights'];
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
  if (isSelected && supported) return 'border-[#ec1e24] bg-[#ec1e24]/10 text-gray-900 dark:text-white';
  if (isSelected && !supported) return 'border-[#ec1e24] bg-[#ec1e24]/5 text-gray-900 dark:text-white';
  return 'border-gray-200 bg-white text-gray-700 dark:border-[#333333] dark:bg-[#000000] dark:text-[#9CA3AF] hover:border-[#ec1e24]/60 hover:bg-gray-50 dark:hover:bg-[#111111]';
}

export function ComposeEditorPage({ onNavigate, previousPage }: ComposeEditorPageProps) {
  const { activeItemId, getItemById, saveItem } = useComposeStore();
  const existingItem = getItemById(activeItemId);
  const [formState, setFormState] = useState<FormState>(() => createInitialForm(existingItem));
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
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

  const handleMediaSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
    );
    if (!files.length) return;

    setFormState((current) => ({
      ...current,
      mediaAssets: [
        ...current.mediaAssets,
        ...files.map((file, index) => buildComposeMediaAsset(file, current.mediaAssets.length + index)),
      ],
    }));
    event.target.value = '';
  };

  const removeAsset = (assetId: string) => {
    setFormState((current) => ({
      ...current,
      mediaAssets: current.mediaAssets
        .filter((asset) => asset.id !== assetId)
        .map((asset, index) => ({ ...asset, order: index })),
    }));
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

  const persistItem = (status: ComposeItem['status'], scheduledAt?: string) => {
    const now = new Date().toISOString();
    saveItem({
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
    });
  };

  const handleSaveDraft = () => {
    if (!validate('draft')) return;
    persistItem('draft');
    toast.success(existingItem ? 'Compose draft updated' : 'Compose draft saved');
    onNavigate('create', previousPage || 'create');
  };

  const handleSchedule = () => {
    if (!validate('scheduled')) return;
    persistItem('scheduled', toIsoSchedule(scheduleDate, scheduleTime));
    setIsScheduleOpen(false);
    toast.success('Compose item scheduled');
    onNavigate('create', previousPage || 'create');
  };

  const handlePublish = () => {
    if (!validate('published')) return;
    persistItem('published');
    toast.success(existingItem ? 'Compose item published' : 'Compose item created and published');
    onNavigate('create', previousPage || 'create');
  };

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start gap-4">
        <BackIconButton
          onClick={() => onNavigate(previousPage || 'create')}
          className="mt-1 -ml-2 p-2 text-gray-900 hover:text-[#ec1e24] dark:text-white"
        />
        <div className="flex-1">
          <h1 className="mb-2 text-gray-900 dark:text-white">
            {existingItem ? 'Edit Compose Item' : 'Add Compose Content'}
          </h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">
            Build one content item with one or more media assets, platform-aware delivery, and a saved or scheduled state.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="mb-1 text-gray-900 dark:text-white">Media Upload</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  Upload one or more images and videos. The platform cards below will tell you what can publish as a single post or carousel.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {formState.mediaAssets.length > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => setFormState((current) => ({ ...current, mediaAssets: [] }))}>
                    <Trash2 className="h-4 w-4" />
                    Clear
                  </Button>
                ) : null}
                <Label htmlFor="compose-media" className="cursor-pointer">
                  <span className="sr-only">Upload media</span>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]">
                    <Upload className="h-4 w-4 text-[#ec1e24]" />
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
                      <div className="bg-black">
                        {asset.previewUrl ? (
                          asset.kind === 'video' ? (
                            <video src={asset.previewUrl} className="h-48 w-full object-contain" controls />
                          ) : (
                            <img src={asset.previewUrl} alt={asset.fileName} className="h-48 w-full object-cover" />
                          )
                        ) : (
                          <div className="flex h-48 items-center justify-center">
                            {asset.kind === 'video' ? <Film className="h-8 w-8 text-white/70" /> : <ImageIcon className="h-8 w-8 text-white/70" />}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center dark:border-[#333333]">
                <Upload className="mx-auto mb-3 h-10 w-10 text-gray-400 dark:text-[#9CA3AF]" />
                <p className="mb-1 text-gray-900 dark:text-white">No media added yet</p>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Upload images, videos, or a mixed set to prepare platform-specific delivery.</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
            <h3 className="mb-1 text-gray-900 dark:text-white">Platform Selection</h3>
            <p className="mb-4 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Each connected platform reflects whether the current media set is ready, single-only, or unsupported.
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
                    className={`rounded-2xl border p-4 text-left transition-all ${getPlatformCardTone(
                      isSelected,
                      compatibility.supported,
                      connected,
                    )}`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-900 dark:bg-[#111111] dark:text-white">
                        <Icon className={iconSizeClass} />
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] ${compatibility.supported ? 'bg-gray-200 text-gray-700 dark:bg-[#1F1F1F] dark:text-[#9CA3AF]' : 'bg-[#FEE2E2] text-[#EF4444] dark:bg-[#991B1B]'}`}>
                        {compatibility.label}
                      </span>
                    </div>
                    <div className="mb-1 text-sm text-gray-900 dark:text-white">{platform.label}</div>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      {!connected ? 'Connect this platform first' : compatibility.reason || platform.helper}
                    </p>
                  </button>
                );
              })}
            </div>

            {selectedPlatformIssues.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 dark:border-[#991B1B] dark:bg-[#1A0808]">
                <p className="mb-2 text-sm text-[#B91C1C] dark:text-[#FCA5A5]">Some selected platforms do not support this media set.</p>
                {selectedPlatformIssues.map((issue) => (
                  <p key={issue.platform} className="text-xs text-[#B91C1C] dark:text-[#FCA5A5]">
                    {issue.platform.toUpperCase()}: {issue.reason}
                  </p>
                ))}
              </div>
            ) : null}
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
                      {YOUTUBE_PLAYLISTS.map((playlist) => (
                        <SelectItem key={playlist} value={playlist}>
                          {playlist}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#333333] dark:bg-[#000000] dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
            <h3 className="mb-4 text-gray-900 dark:text-white">Save State</h3>
            <div className="space-y-3">
              <Button className="w-full" onClick={handleSaveDraft}>Save</Button>
              <Button className="w-full" onClick={handlePublish}>Publish</Button>
              <Button variant="outline" className="w-full" onClick={() => setIsScheduleOpen(true)}>Schedule</Button>
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
              <div className="space-y-2">
                {formState.platforms.length ? (
                  formState.platforms.map((platform) => {
                    const compatibility = compatibilityMap[platform];

                    return (
                      <div key={platform} className="flex items-center justify-between gap-3 text-sm">
                        <span className="uppercase text-[#6B7280] dark:text-[#9CA3AF]">{platform}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] ${compatibility.supported ? 'bg-gray-200 text-gray-700 dark:bg-[#1F1F1F] dark:text-[#9CA3AF]' : 'bg-[#FEE2E2] text-[#EF4444] dark:bg-[#991B1B]'}`}>
                          {compatibility.label}
                        </span>
                      </div>
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
          <BottomSheetTitle>Schedule Compose Item</BottomSheetTitle>
          <BottomSheetDescription>Choose when this item should move into the scheduled queue.</BottomSheetDescription>
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
    </div>
  );
}
