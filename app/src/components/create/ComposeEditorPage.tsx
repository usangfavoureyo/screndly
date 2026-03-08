import { useMemo, useState, type ChangeEvent } from 'react';
import { Upload, Image as ImageIcon, Film, Sparkles } from 'lucide-react';
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
import { getConnectedPlatforms } from '../../utils/platformConnections';
import { useComposeStore } from '../../store/useComposeStore';
import { COMPOSE_PLATFORM_OPTIONS } from '../../config/create';
import { generateComposeCaption } from '../../lib/create/generation';
import type { ComposeItem, ComposeMedia, ComposePlatformKey } from '../../types/compose';

interface ComposeEditorPageProps {
  onNavigate: (page: string, fromPage?: string) => void;
  previousPage?: string | null;
}

type FormState = {
  media?: ComposeMedia;
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

const PINTEREST_BOARDS = ['Movie Picks', 'TV Roundup', 'Campaigns'];
const YOUTUBE_PLAYLISTS = ['Upcoming Posts', 'Reviews', 'Highlights'];
const SHARED_CAPTION_PLATFORMS: ComposePlatformKey[] = ['instagram', 'facebook', 'threads', 'x', 'tiktok'];

function createInitialForm(item?: ComposeItem): FormState {
  return {
    media: item?.media,
    platforms: item?.platforms ?? [],
    sharedCaption: item?.sharedCaption ?? '',
    pinterestTitle: item?.platformFields.pinterest?.title ?? '',
    pinterestDescription: item?.platformFields.pinterest?.description ?? '',
    pinterestBoard: item?.platformFields.pinterest?.board ?? '',
    youtubeTitle: item?.platformFields.youtube?.title ?? '',
    youtubeDescription: item?.platformFields.youtube?.description ?? '',
    youtubePlaylist: item?.platformFields.youtube?.playlist ?? '',
  };
}

function toIsoSchedule(date?: Date, time?: string) {
  if (!date || !time) return undefined;
  const [hours, minutes] = time.split(':').map(Number);
  const scheduled = new Date(date);
  scheduled.setHours(hours || 0, minutes || 0, 0, 0);
  return scheduled.toISOString();
}

function buildItemTitle(formState: FormState) {
  return (
    formState.youtubeTitle ||
    formState.pinterestTitle ||
    formState.media?.fileName ||
    formState.sharedCaption.slice(0, 42) ||
    'Untitled compose item'
  );
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
    existingItem?.scheduledAt
      ? new Date(existingItem.scheduledAt).toISOString().slice(11, 16)
      : '09:00',
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const connectedPlatforms = useMemo(
    () => new Set(getConnectedPlatforms().map((platform) => platform.toLowerCase())),
    [],
  );

  const hasSharedCaptionPlatform = formState.platforms.some((platform) => SHARED_CAPTION_PLATFORMS.includes(platform));

  const handleMediaSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const previewUrl = URL.createObjectURL(file);

    setFormState((current) => ({
      ...current,
      media: {
        kind: isVideo ? 'video' : 'image',
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        previewUrl,
      },
    }));
  };

  const togglePlatform = (platform: ComposePlatformKey, isConnected: boolean) => {
    if (!isConnected) return;

    setFormState((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((entry) => entry !== platform)
        : [...current.platforms, platform],
    }));
  };

  const validate = (mode: 'draft' | 'scheduled') => {
    if (formState.platforms.length === 0) {
      toast.error('Select at least one connected platform');
      return false;
    }

    if (mode === 'scheduled' && !formState.media) {
      toast.error('Upload an image or video before scheduling');
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
    const item: ComposeItem = {
      id: existingItem?.id || `compose-${Date.now()}`,
      title: buildItemTitle(formState),
      status,
      media: formState.media,
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
    };

    saveItem(item);
  };

  const handleSaveDraft = () => {
    if (!validate('draft')) return;
    persistItem('draft');
    toast.success(existingItem ? 'Compose draft updated' : 'Compose draft saved');
    onNavigate('create', previousPage || 'create');
  };

  const handleSchedule = () => {
    if (!validate('scheduled')) return;
    const scheduledAt = toIsoSchedule(scheduleDate, scheduleTime);
    persistItem('scheduled', scheduledAt);
    setIsScheduleOpen(false);
    toast.success('Compose item scheduled');
    onNavigate('create', previousPage || 'create');
  };

  const handleGenerateCaption = async () => {
    if (!formState.platforms.length) {
      toast.error('Select at least one platform before generating');
      return;
    }

    setIsGenerating(true);
    try {
      const generated = await generateComposeCaption({
        platforms: formState.platforms,
        prompt: `Media: ${formState.media?.fileName || 'Untitled asset'}\nCaption intent: entertainment and social publishing.`,
      });
      setFormState((current) => ({ ...current, sharedCaption: generated }));
      toast.success('Caption generated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate caption');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start gap-4 mb-4">
          <BackIconButton onClick={() => onNavigate(previousPage || 'create')} className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1" />
          <div className="flex-1">
            <h1 className="text-gray-900 dark:text-white mb-2">
              {existingItem ? 'Edit Compose Item' : 'Add Compose Content'}
            </h1>
            <p className="text-[#6B7280] dark:text-[#9CA3AF]">
              Build one content item with media, captions, platform details, and a saved or scheduled state.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6">
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-gray-900 dark:text-white mb-1">Media Upload</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Upload one image or video for this v1 flow.</p>
              </div>
              <Label htmlFor="compose-media" className="cursor-pointer">
                <span className="sr-only">Upload media</span>
                <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]">
                  <Upload className="h-4 w-4 text-[#ec1e24]" />
                  Upload
                </div>
              </Label>
              <input id="compose-media" type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaSelected} />
            </div>

            {formState.media ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#ec1e24] dark:bg-[#111111]">
                    {formState.media.kind === 'video' ? <Film className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-white truncate">{formState.media.fileName}</p>
                    <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{formState.media.mimeType}</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                      {(formState.media.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                {formState.media.previewUrl ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-black dark:border-[#333333]">
                    {formState.media.kind === 'video' ? (
                      <video src={formState.media.previewUrl} className="max-h-72 w-full object-contain" controls />
                    ) : (
                      <img src={formState.media.previewUrl} alt={formState.media.fileName} className="max-h-72 w-full object-contain" />
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center dark:border-[#333333]">
                <Upload className="h-10 w-10 text-gray-400 dark:text-[#9CA3AF] mx-auto mb-3" />
                <p className="text-gray-900 dark:text-white mb-1">No media added yet</p>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Upload an image or video to start this compose item.</p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
            <h3 className="text-gray-900 dark:text-white mb-1">Platform Selection</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4">Connected channels are available to include in this item.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {COMPOSE_PLATFORM_OPTIONS.map((platform) => {
                const Icon = PLATFORM_ICONS[platform.id];
                const isSelected = formState.platforms.includes(platform.id);
                const isConnected = connectedPlatforms.has(platform.connectionKey.toLowerCase());

                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id, isConnected)}
                    disabled={!isConnected}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-[#ec1e24] bg-[#ec1e24]/10 text-gray-900 dark:text-white'
                        : 'border-gray-200 bg-white text-gray-700 dark:border-[#333333] dark:bg-[#000000] dark:text-[#9CA3AF]'
                    } ${!isConnected ? 'opacity-45' : 'hover:border-[#ec1e24]/60 hover:bg-gray-50 dark:hover:bg-[#111111]'}`}
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-900 dark:bg-[#111111] dark:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-sm text-gray-900 dark:text-white mb-1">{platform.label}</div>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      {isConnected ? platform.helper : 'Connect this platform first'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-gray-900 dark:text-white mb-1">Shared Caption</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Used by Instagram, Facebook, Threads, X, and TikTok in this v1 flow.</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleGenerateCaption} disabled={isGenerating}>
                <Sparkles className="h-4 w-4 text-[#ec1e24]" />
                {isGenerating ? 'Generating' : 'Generate'}
              </Button>
            </div>
            <Textarea
              value={formState.sharedCaption}
              onChange={(event) => setFormState((current) => ({ ...current, sharedCaption: event.target.value }))}
              placeholder="Write or generate a shared caption"
              className="min-h-[180px] bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]"
            />
          </div>

          {formState.platforms.includes('pinterest') ? (
            <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
              <h3 className="text-gray-900 dark:text-white mb-4">Pinterest Fields</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Title</Label>
                  <Input value={formState.pinterestTitle} onChange={(event) => setFormState((current) => ({ ...current, pinterestTitle: event.target.value }))} className="mt-1 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]" />
                </div>
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Description</Label>
                  <Textarea value={formState.pinterestDescription} onChange={(event) => setFormState((current) => ({ ...current, pinterestDescription: event.target.value }))} className="mt-1 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]" />
                </div>
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Board</Label>
                  <Select value={formState.pinterestBoard} onValueChange={(value) => setFormState((current) => ({ ...current, pinterestBoard: value }))}>
                    <SelectTrigger className="mt-1 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
                      <SelectValue placeholder="Select a board" />
                    </SelectTrigger>
                    <SelectContent>
                      {PINTEREST_BOARDS.map((board) => (
                        <SelectItem key={board} value={board}>{board}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}

          {formState.platforms.includes('youtube') ? (
            <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
              <h3 className="text-gray-900 dark:text-white mb-4">YouTube Fields</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Title</Label>
                  <Input value={formState.youtubeTitle} onChange={(event) => setFormState((current) => ({ ...current, youtubeTitle: event.target.value }))} className="mt-1 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]" />
                </div>
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Description</Label>
                  <Textarea value={formState.youtubeDescription} onChange={(event) => setFormState((current) => ({ ...current, youtubeDescription: event.target.value }))} className="mt-1 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]" />
                </div>
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Playlist</Label>
                  <Select value={formState.youtubePlaylist} onValueChange={(value) => setFormState((current) => ({ ...current, youtubePlaylist: value }))}>
                    <SelectTrigger className="mt-1 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
                      <SelectValue placeholder="Select a playlist" />
                    </SelectTrigger>
                    <SelectContent>
                      {YOUTUBE_PLAYLISTS.map((playlist) => (
                        <SelectItem key={playlist} value={playlist}>{playlist}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
            <h3 className="text-gray-900 dark:text-white mb-4">Save State</h3>
            <div className="space-y-3">
              <Button className="w-full" onClick={handleSaveDraft}>Save</Button>
              <Button variant="outline" className="w-full" onClick={() => setIsScheduleOpen(true)}>
                Schedule
              </Button>
            </div>
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333333] dark:bg-[#050505]">
              <p className="text-sm text-gray-900 dark:text-white mb-1">Selected Platforms</p>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                {formState.platforms.length ? formState.platforms.join(', ') : 'No platform selected yet'}
              </p>
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
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSchedule}>Schedule</Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>
    </div>
  );
}
