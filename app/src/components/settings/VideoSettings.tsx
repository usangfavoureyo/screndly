import { useState, useEffect, useRef } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { PinterestBoardSelect } from '../ui/pinterest-board-select';
import { haptics } from '../../utils/haptics';
import { toast } from "sonner";
import { AI_MODELS, DEFAULT_MODELS, getModelDisplayName } from '../../lib/ai/models';
import { fetchYouTubePlaylists, type YouTubePlaylist } from '../../lib/api/youtube';
import { AnalyticsSelfOptimization } from './AnalyticsSelfOptimization';
import { PageLoader, RedSpinner } from '../PageLoader';

const DEFAULT_TRAILER_KEYWORDS = 'trailer, teaser, official, first look, sneak peek';
const DEFAULT_VIDEO_AGE_GATE = '24';
const VIDEO_BACKLOG_MODE_PROCESS = 'process-backlog';
const VIDEO_BACKLOG_MODE_FUTURE_ONLY = 'future-only';
const VIDEO_AGE_GATE_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index + 1));

interface VideoSettingsProps {
  settings: any;
  updateSetting: (key: string, value: any) => void;
  updateSettings: (updates: Record<string, any>) => void;
  onBack: () => void;
}

export function VideoSettings({ settings, updateSetting, updateSettings, onBack }: VideoSettingsProps) {
  const [pollInterval, setPollInterval] = useState(2);
  const [isPolling, setIsPolling] = useState(false);
  const [youtubePlaylists, setYouTubePlaylists] = useState<YouTubePlaylist[]>([]);
  const [isLoadingYouTubePlaylists, setIsLoadingYouTubePlaylists] = useState(false);
  const [youtubePlaylistsError, setYouTubePlaylistsError] = useState('');
  const migratedLegacyPlaylistsRef = useRef(false);

  const selectedYouTubePlaylists = Array.isArray(settings.videoYoutubeSelectedPlaylists)
    ? settings.videoYoutubeSelectedPlaylists.filter((playlist: any) => playlist?.id && playlist?.title)
    : [];
  const selectedPlaylistIds = new Set(selectedYouTubePlaylists.map((playlist: any) => playlist.id));
  const playlistChoices = [...youtubePlaylists];
  for (const playlist of selectedYouTubePlaylists) {
    if (!playlistChoices.some((option) => option.id === playlist.id)) {
      playlistChoices.push(playlist);
    }
  }

  useEffect(() => {
    // Get current polling state
    // NOTE: youtubePoller would be implemented in backend
    // setIsPolling(youtubePoller.getIsPolling());
    // setPollInterval(youtubePoller.getCurrentInterval());
  }, []);

  const loadYouTubePlaylists = async (showToast = false) => {
    setIsLoadingYouTubePlaylists(true);
    setYouTubePlaylistsError('');

    try {
      const playlists = await fetchYouTubePlaylists();
      setYouTubePlaylists(playlists);

      if (showToast) {
        toast.success(
          playlists.length > 0
            ? `Loaded ${playlists.length} YouTube playlist${playlists.length === 1 ? '' : 's'}`
            : 'No playlists were found on the connected YouTube channel'
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch YouTube playlists';
      setYouTubePlaylists([]);
      setYouTubePlaylistsError(message);
      if (showToast) {
        toast.error(message);
      }
    } finally {
      setIsLoadingYouTubePlaylists(false);
    }
  };

  useEffect(() => {
    void loadYouTubePlaylists();
  }, []);

  useEffect(() => {
    if (migratedLegacyPlaylistsRef.current || youtubePlaylists.length === 0 || selectedYouTubePlaylists.length > 0) {
      return;
    }

    const legacyTitles = typeof settings.videoYoutubePlaylists === 'string'
      ? settings.videoYoutubePlaylists
          .split(',')
          .map((value: string) => value.trim().toLowerCase())
          .filter(Boolean)
      : [];

    if (legacyTitles.length === 0) {
      migratedLegacyPlaylistsRef.current = true;
      return;
    }

    const matchedPlaylists = youtubePlaylists.filter((playlist) =>
      legacyTitles.includes(playlist.title.trim().toLowerCase())
    );

    migratedLegacyPlaylistsRef.current = true;

    if (matchedPlaylists.length === 0) {
      return;
    }

    updateSettings({
      videoYoutubeSelectedPlaylists: matchedPlaylists,
      videoYoutubePlaylists: matchedPlaylists.map((playlist) => playlist.title).join(', '),
    });
  }, [settings.videoYoutubePlaylists, selectedYouTubePlaylists.length, updateSettings, youtubePlaylists]);

  const handleIntervalChange = (value: string) => {
    haptics.light();
    const minutes = parseInt(value) || 2;
    updateSetting('fetchInterval', value);
    setPollInterval(minutes);

    // Update the poller
    // NOTE: youtubePoller would be implemented in backend
    // if (isPolling) {
    //   youtubePoller.stopPolling();
    //   youtubePoller.startPolling(minutes);
    //   toast.success(`Polling interval updated to ${minutes} minute(s)`);
    // }
    toast.success(`Polling interval updated to ${minutes} minute(s)`);
  };

  const handleKeywordsChange = (value: string) => {
    haptics.light();
    updateSetting('advancedFilters', value);

    // Update the poller's custom keywords
    // NOTE: youtubePoller would be implemented in backend
    // youtubePoller.setCustomKeywords(value);
    toast.success('Trailer keywords updated');
  };

  const handlePostIntervalChange = (value: string) => {
    haptics.light();
    const minutes = parseInt(value) || 10;
    updateSetting('postInterval', value);
    toast.success(`Post interval updated to ${minutes} minute(s)`);
  };

  const handleVideoAgeGateChange = (value: string) => {
    haptics.light();
    updateSetting('videoAgeGateHours', value);
    toast.success(
      value === 'off'
        ? 'Upload age gate turned off'
        : `Only videos from the last ${value} hour${value === '1' ? '' : 's'} will be considered`
    );
  };

  const handleBacklogModeChange = (value: string) => {
    haptics.light();
    updateSettings({
      videoBacklogMode: value,
      videoFutureOnlySince: value === VIDEO_BACKLOG_MODE_FUTURE_ONLY ? new Date().toISOString() : '',
    });
    toast.success(
      value === VIDEO_BACKLOG_MODE_FUTURE_ONLY
        ? 'Future-only mode enabled from now'
        : 'Backlog processing enabled'
    );
  };

  const handleYouTubePlaylistToggle = (playlist: YouTubePlaylist, checked: boolean) => {
    haptics.light();

    const nextById = new Map(
      selectedYouTubePlaylists.map((entry: any) => [
        entry.id,
        {
          id: entry.id,
          title: entry.title,
          itemCount: entry.itemCount,
          privacyStatus: entry.privacyStatus,
        },
      ])
    );

    if (checked) {
      nextById.set(playlist.id, playlist);
    } else {
      nextById.delete(playlist.id);
    }

    const ordered = playlistChoices
      .filter((entry) => nextById.has(entry.id))
      .map((entry) => nextById.get(entry.id)!);

    updateSettings({
      videoYoutubeSelectedPlaylists: ordered,
      videoYoutubePlaylists: ordered.map((entry) => entry.title).join(', '),
    });

    toast.success(
      checked
        ? `${playlist.title} added to available YouTube routing playlists`
        : `${playlist.title} removed from available YouTube routing playlists`
    );
  };

  const videoAgeGateValue =
    typeof settings.videoAgeGateHours === 'number'
      ? String(settings.videoAgeGateHours)
      : typeof settings.videoAgeGateHours === 'string' && settings.videoAgeGateHours.trim().length > 0
        ? settings.videoAgeGateHours
        : DEFAULT_VIDEO_AGE_GATE;
  const videoBacklogMode =
    settings.videoBacklogMode === VIDEO_BACKLOG_MODE_FUTURE_ONLY
      ? VIDEO_BACKLOG_MODE_FUTURE_ONLY
      : VIDEO_BACKLOG_MODE_PROCESS;
  const futureOnlySinceDate =
    videoBacklogMode === VIDEO_BACKLOG_MODE_FUTURE_ONLY && typeof settings.videoFutureOnlySince === 'string' && settings.videoFutureOnlySince
      ? new Date(settings.videoFutureOnlySince)
      : null;
  const futureOnlySinceLabel =
    futureOnlySinceDate && !Number.isNaN(futureOnlySinceDate.getTime())
      ? futureOnlySinceDate.toLocaleString()
      : '';

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 flex items-center gap-3">
        <button
          className="text-gray-900 dark:text-white p-1"
          onClick={() => {
            haptics.light();
            onBack();
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12H2M9 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-gray-900 dark:text-white text-xl">Video</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Analytics-Driven Self-Optimization */}
        <AnalyticsSelfOptimization
          storageKey="video_settings"
          description="Enable AI-powered optimization to automatically improve captions, posting times, and model selection for video content based on performance analytics."
        />

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* Polling Interval */}
        <div>
          <h3 className="text-gray-900 dark:text-white mb-3">Polling Interval</h3>
          <div>
            <Label className="text-[#9CA3AF]">Polling Interval (minutes)</Label>
            <Input
              type="number"
              min="1"
              max="60"
              value={settings.fetchInterval ?? pollInterval}
              onFocus={() => haptics.light()}
              onChange={(e) => handleIntervalChange(e.target.value)}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
        </div>

        {/* Post Interval */}
        <div>
          <h3 className="text-gray-900 dark:text-white mb-3">Post Interval</h3>
          <div>
            <Label className="text-[#9CA3AF]">Post Interval (minutes)</Label>
            <Input
              type="number"
              min="1"
              max="1440"
              value={settings.postInterval ?? 10}
              onFocus={() => haptics.light()}
              onChange={(e) => handlePostIntervalChange(e.target.value)}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
        </div>

        {/* Trailer Detection Settings */}
        <div>
          <h3 className="text-gray-900 dark:text-white mb-3">Trailer Detection</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-[#9CA3AF]">Trailer Keywords (comma-separated)</Label>
              <Input
                value={settings.advancedFilters ?? ''}
                onFocus={() => haptics.light()}
                onChange={(e) => handleKeywordsChange(e.target.value)}
                placeholder={DEFAULT_TRAILER_KEYWORDS}
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                Only saved keyword values are sent to the backend poller. Placeholder text is not treated as an active rule.
              </p>
            </div>

            <div>
              <Label className="text-[#9CA3AF]">Region Filter (optional)</Label>
              <Input
                value={settings.regionFilter ?? ''}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('regionFilter', e.target.value);
                }}
                placeholder="US,UK,CA"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
              />
            </div>

            <div>
              <Label className="text-[#9CA3AF]">Upload Age Gate</Label>
              <Select
                value={videoAgeGateValue}
                onValueChange={handleVideoAgeGateChange}
              >
                <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                  <SelectValue placeholder="Select upload age gate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  {VIDEO_AGE_GATE_OPTIONS.map((hours) => (
                    <SelectItem key={hours} value={hours}>
                      {hours} hour{hours === '1' ? '' : 's'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                Default is 24 hours. Turn it off to allow older unprocessed uploads in the recent feed scan.
              </p>
            </div>

            <div>
              <Label className="text-[#9CA3AF]">Backlog Mode</Label>
              <Select
                value={videoBacklogMode}
                onValueChange={handleBacklogModeChange}
              >
                <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                  <SelectValue placeholder="Select backlog mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={VIDEO_BACKLOG_MODE_PROCESS}>Process backlog</SelectItem>
                  <SelectItem value={VIDEO_BACKLOG_MODE_FUTURE_ONLY}>Future uploads only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                Future uploads only ignores videos already in the feed and starts from the moment you enable it.
              </p>
              {futureOnlySinceLabel ? (
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                  Current future-only cutoff: {futureOnlySinceLabel}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* Format Detection Settings */}
        <div>
          <h3 className="text-gray-900 dark:text-white mb-3">Format Detection</h3>
          <p className="text-sm text-gray-600 dark:text-[#9CA3AF] mb-3">
            Filter videos by aspect ratio and quality to ensure only 16:9 landscape trailers at 1080p or higher are processed.
          </p>
          <div className="space-y-3">
            <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Input
                    type="checkbox"
                    id="exclude-shorts"
                    checked={settings.excludeShorts !== false}
                    onChange={(e) => {
                      haptics.light();
                      updateSetting('excludeShorts', e.target.checked);
                      toast.success(e.target.checked ? 'YouTube Shorts will be excluded' : 'YouTube Shorts will be allowed');
                    }}
                    className="w-4 h-4 border-gray-300 dark:border-[#333333] accent-black dark:accent-white"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="exclude-shorts" className="text-gray-900 dark:text-white cursor-pointer">
                    Exclude YouTube Shorts (9:16 vertical videos)
                  </Label>
                  <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-1">
                    Automatically skip videos with /shorts/ URL and #shorts in title. Only process 16:9 landscape trailers with a minimum 1080p source.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4">
              <h4 className="text-sm text-gray-900 dark:text-white mb-2">Detection Criteria</h4>
              <div className="space-y-2 text-xs text-gray-600 dark:text-[#9CA3AF]">
                <div className="flex items-start gap-2">
                  <span className="text-[#ec1e24]">✓</span>
                  <span><span className="text-gray-900 dark:text-white">1080p Minimum:</span> Only landscape trailers at 1920x1080 or higher are accepted</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#ec1e24]">✗</span>
                  <span><span className="text-gray-900 dark:text-white">Below 1080p:</span> 720p, 480p, and lower resolution uploads are skipped</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#ec1e24]">✗</span>
                  <span><span className="text-gray-900 dark:text-white">URL Pattern:</span> Videos with /shorts/ in URL are skipped</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#ec1e24]">✗</span>
                  <span><span className="text-gray-900 dark:text-white">Title Indicators:</span> #shorts, #short, (shorts) in title</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4">
              <h4 className="text-sm text-gray-900 dark:text-white mb-2">Platform Upload Settings</h4>
              <div className="space-y-2 text-xs text-gray-600 dark:text-[#9CA3AF]">
                <p className="text-gray-900 dark:text-white mb-1">All platforms receive the original 1080p+ source file:</p>
                <div className="flex items-start gap-2">
                  <span className="text-[#ec1e24]">•</span>
                  <span><span className="text-gray-900 dark:text-white">YouTube:</span> Native 16:9 (1080p, 4K)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#ec1e24]">•</span>
                  <span><span className="text-gray-900 dark:text-white">TikTok:</span> Letterboxed 16:9 (users can rotate to landscape)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#ec1e24]">•</span>
                  <span><span className="text-gray-900 dark:text-white">Instagram:</span> 16:9 Feed/IGTV (landscape)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#ec1e24]">•</span>
                  <span><span className="text-gray-900 dark:text-white">Facebook/Threads/X/Bluesky:</span> Native 16:9</span>
                </div>
                <p className="text-[#ec1e24] mt-2 italic">
                  ✓ Original aspect ratio preserved • No cropping or distortion
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* Caption Generation Section */}
        <div>
          <h3 className="text-gray-900 dark:text-white mb-1">Caption Generation</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-3">
            AI-powered caption generation from video content for social publishing, with live verification for release date and theater or network or streaming destination when useful.
          </p>

          {/* OpenAI Model Selection */}
          <div>
            <Label htmlFor="video-openai-model" className="text-[#9CA3AF]">Caption AI Model</Label>
            <Select
              value={settings.videoOpenaiModel || DEFAULT_MODELS.video}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('videoOpenaiModel', value);
                toast.success(`AI Model changed to ${getModelDisplayName(value)}`);
              }}
            >
              <SelectTrigger id="video-openai-model" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              OpenAI models use the Responses API with web search, while Flash 3 uses grounded Google Search, for release-context enrichment during caption and metadata generation.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* Universal Social Media Caption Generation */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Universal Social Media Caption Generation</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              Single prompt generates optimized captions for all 5 platforms in one API call, with live release-context verification when the model needs it.
            </p>
          </div>

          {/* Universal Caption Prompt */}
          <div>
            <Label htmlFor="video-universal-caption-prompt" className="text-[#9CA3AF]">Universal Caption Generation Prompt</Label>
            <textarea
              id="video-universal-caption-prompt"
              value={settings.videoUniversalCaptionPrompt || `You are a social media caption writer for Screen Render. Generate platform-optimized captions for all 5 platforms in one response using Google Search API context.

INPUT: Movie/TV title, 1-2 major cast members, release date, synopsis, Google Search API trending data
OUTPUT: JSON object with 5 platform-specific captions

Platform Requirements:

X (Twitter) - Culture Crave Style:
- Format: "#TitleNoSpaces hits [platform/theatres] [date] — [1-2 cast] [hook]"
- Max 280 characters
- 1-2 emojis max
- Human, conversational tone
- Example: "#DunePartTwo hits theatres March 1 — Timothée Chalamet and Zendaya bring the spice again."

Facebook:
- Strong opening hook (15-20 words)
- 150-300 words total
- 4-6 emojis throughout
- Storytelling, community-building
- Include call-to-action

Instagram:
- Eye-catching opening (8-12 words)
- 150-200 words
- 150-200 words
- 5-8 emojis
- Line breaks for readability
- Visual, aesthetic language

Threads:
- Conversational opening (10-15 words)
- Under 500 characters
- Under 500 characters
- 2-4 emojis
- Discussion-starting, authentic

TikTok:
- Hook-first (5-8 words, can be lowercase)
- Under 300 characters
- Under 300 characters
- 2-3 emojis
- Gen Z, meme-friendly, viral

Output Format (JSON):
{
  "x": "Caption text here...",
  "facebook": "Caption text here...",
  "instagram": "Caption text here...",
  "threads": "Caption text here...",
  "tiktok": "Caption text here..."
}

IMPORTANT: Return ONLY valid JSON. Use Google Search data for trending context and buzz.

Tone: Platform-aware, optimized for engagement, culturally relevant`}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoUniversalCaptionPrompt', e.target.value);
              }}
              rows={38}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Generates all 5 platform captions in one API call with JSON output and optional live verification for release date and platform context.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* YouTube-Specific Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">YouTube Upload Settings</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              AI-powered title, description, and playlist detection for YouTube uploads, with live verification for release dates and theater or platform context.
            </p>
          </div>

          {/* YouTube Title Generation Prompt */}
          <div>
            <Label htmlFor="video-youtube-title-prompt" className="text-[#9CA3AF]">YouTube Title Generation Prompt</Label>
            <textarea
              id="video-youtube-title-prompt"
              value={settings.videoYoutubeTitlePrompt || `You are a YouTube SEO expert for Screen Render. Create optimized YouTube titles using Google Search API to determine content type.

INPUT: Movie/TV title, trailer type, year, Google Search API data
OUTPUT: YouTube title in strict format

REQUIRED FORMAT:
[Title] | [Trailer Type] | ([Year] [TV Show OR Movie])

Examples:
- "Mottoehead Season 1 | Official Trailer | (2025 TV Show)"
- "The Holy Trinity | Official Trailer | (2025 Movie)"
- "The Surfer | 'My Board' Movie Clip | (2025 Movie)"
- "Gladiator II | Official Trailer | (2024 Movie)"
- "House of the Dragon Season 3 | Teaser Trailer | (2026 TV Show)"

Guidelines:
- Use Google Search API to determine if content is TV Show or Movie
- For TV shows: Include "Season X" if applicable
- For movie clips: Include clip name in single quotes
- Use " | " (space-pipe-space) as separator
- Always end with year and type in parentheses
- Keep total under 70 characters
- Use title case

Tone: Professional, SEO-optimized, consistent format`}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoYoutubeTitlePrompt', e.target.value);
              }}
              rows={20}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Strict format: &quot;Title | Trailer Type | (Year TV Show/Movie)&quot; with Google Search API
            </p>
          </div>

          {/* YouTube Description Generation Prompt */}
          <div>
            <Label htmlFor="video-youtube-description-prompt" className="text-[#9CA3AF]">YouTube Description Generation Prompt</Label>
            <textarea
              id="video-youtube-description-prompt"
              value={settings.videoYoutubeDescriptionPrompt || `You are a YouTube SEO expert for Screen Render, a movie and TV trailer platform. Create optimized YouTube video descriptions for trailer uploads.

INPUT: Movie/TV title, cast, release date, synopsis, director, studio
OUTPUT: YouTube-optimized video description

Guidelines:
- First 2 lines (150 chars) are most important - front-load key info
- Include movie/show title, release date, and key cast in opening
- Add full synopsis (2-3 paragraphs)
- Include:
  * Director and key crew
  * Main cast list
  * Release date and studio
  * Relevant links (official site, tickets, etc.)
- Include:
- Include timestamps if applicable
- Add "Subscribe for more trailers" CTA
- Use proper formatting with line breaks

Structure:
[Opening hook with title and release date]

[Synopsis paragraph 1]

[Synopsis paragraph 2]

Director: [Name]
Cast: [Names]
Release Date: [Date]
Studio: [Studio]

🔔 Subscribe to Screen Render for the latest movie and TV trailers!

#MovieTitle #Trailers

Tone: Professional, informative, SEO-rich`}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoYoutubeDescriptionPrompt', e.target.value);
              }}
              rows={20}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Full SEO-optimized description with structure, metadata, and CTAs
            </p>
          </div>

          {/* YouTube Playlist Detection Prompt */}
          <div>
            <Label htmlFor="video-youtube-playlist-prompt" className="text-[#9CA3AF]">YouTube Playlist Detection Prompt</Label>
            <textarea
              id="video-youtube-playlist-prompt"
              value={settings.videoYoutubePlaylistPrompt || `You are assigning Screen Render uploads to the exact playlists that already exist on the connected YouTube channel.

INPUT: cleaned title, TMDb match, trailer type, description, release context, and the exact channel playlist IDs and titles
OUTPUT: JSON object containing ONLY exact playlist IDs from the provided list

Core Rules:
- Never invent a playlist title or ID.
- Choose only from the exact playlists provided for this channel.
- Use live search when needed to confirm whether the upload is a movie, TV show, anime, trailer, teaser, clip, featurette, or scene.
- Prefer the tightest exact fit for the primary category.
- If confidence is low, return no playlist instead of guessing.
- A video may go into more than one playlist only when that is clearly justified.

Primary routing examples:
- Movie trailer -> Movie Trailers
- TV show trailer -> TV Show Trailers
- Movie clip or featurette -> Movie Clips
- TV show clip -> TV Show Clips
- Anime trailer -> Anime Trailers

Output format:
{"selectedIds":["playlist-id-1","playlist-id-2"]}`}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoYoutubePlaylistPrompt', e.target.value);
              }}
              rows={22}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              The model can only choose from the exact playlists selected below. It cannot invent new playlist names.
            </p>
          </div>

          {/* YouTube Playlist Management */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-[#9CA3AF]">Connected YouTube Channel Playlists</Label>
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  void loadYouTubePlaylists(true);
                }}
                className="text-xs px-3 py-2 rounded-full border border-gray-200 dark:border-[#333333] text-gray-700 dark:text-[#E5E7EB]"
              >
                {isLoadingYouTubePlaylists ? (
                  <span className="inline-flex items-center gap-2">
                    <RedSpinner size="sm" label="Refreshing YouTube playlists..." />
                    Refresh Playlists
                  </span>
                ) : 'Refresh Playlists'}
              </button>
            </div>

            <div className="mt-2 rounded-2xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] p-4 space-y-3">
              {isLoadingYouTubePlaylists && playlistChoices.length === 0 ? (
                <PageLoader size="sm" className="h-auto py-2" label="Loading playlists from the connected YouTube channel..." />
              ) : null}

              {!isLoadingYouTubePlaylists && youtubePlaylistsError ? (
                <div className="rounded-xl border border-red-200 dark:border-[#5B1B1B] bg-red-50 dark:bg-[#140708] p-3">
                  <p className="text-sm text-red-700 dark:text-[#FCA5A5]">
                    {youtubePlaylistsError}
                  </p>
                  <p className="text-xs text-red-600 dark:text-[#F87171] mt-1">
                    Connect the correct YouTube account, then refresh to load the real channel playlists.
                  </p>
                </div>
              ) : null}

              {!isLoadingYouTubePlaylists && !youtubePlaylistsError && playlistChoices.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-[#9CA3AF]">
                  No playlists were found on the connected YouTube channel yet.
                </p>
              ) : null}

              {playlistChoices.length > 0 ? (
                <div className="space-y-2">
                  {playlistChoices.map((playlist) => (
                    <label
                      key={playlist.id}
                      className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-[#333333] px-3 py-3 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedPlaylistIds.has(playlist.id)}
                        onCheckedChange={(checked) => handleYouTubePlaylistToggle(playlist, checked === true)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-gray-900 dark:text-white">{playlist.title}</span>
                          {typeof playlist.itemCount === 'number' ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#111111] text-gray-500 dark:text-[#9CA3AF]">
                              {playlist.itemCount} item{playlist.itemCount === 1 ? '' : 's'}
                            </span>
                          ) : null}
                          {playlist.privacyStatus ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#111111] text-gray-500 dark:text-[#9CA3AF] capitalize">
                              {playlist.privacyStatus}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1 break-all">
                          {playlist.id}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-2">
              Only the playlists checked here are eligible for automatic YouTube routing. The upload flow will use the exact channel playlists and will no longer create missing playlists from AI guesses.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* Pinterest-Specific Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Pinterest Publishing Settings</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              Pinterest requires structured content: Title + Description + Link + Board. Configure AI generation for each field, with live verification for release date and platform context when the model needs it.
            </p>
          </div>

          {/* Pinterest Title Generation Prompt */}
          <div>
            <Label htmlFor="video-pinterest-title-prompt" className="text-[#9CA3AF]">Pinterest Title Generation Prompt</Label>
            <textarea
              id="video-pinterest-title-prompt"
              value={settings.videoPinterestTitlePrompt || `You are a Pinterest SEO expert for Screen Render. Create optimized Pinterest pin titles for movie and TV trailers.

INPUT: Movie/TV title, release date, trailer type, cast, Google Search API data
OUTPUT: Pinterest-optimized title (100 characters max)

Pinterest Title Requirements:
- Front-load the most important keywords
- Include: Title + Year + Content Type (Movie/TV Show)
- Optimize for Pinterest search discovery
- Use natural language, not hashtags
- Keep under 100 characters

Examples:
- "The Batman (2025) - Official Movie Trailer | Robert Pattinson"
- "Stranger Things Season 5 Trailer (2025) | Netflix Series"
- "Dune: Part Three Official Trailer | 2026 Sci-Fi Epic"
- "Wednesday Season 2 Teaser | 2025 Netflix Series"

Guidelines:
- Use Google Search API to confirm title, year, and type
- Include 1-2 key cast members if space allows
- Use " | " separator for clarity
- Always include year for searchability
- Prioritize search terms users would type

Tone: Clear, searchable, informative, optimized for Pinterest discovery`}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoPinterestTitlePrompt', e.target.value);
              }}
              rows={24}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Search-optimized titles under 100 characters with keywords front-loaded
            </p>
          </div>

          {/* Pinterest Description Generation Prompt */}
          <div>
            <Label htmlFor="video-pinterest-description-prompt" className="text-[#9CA3AF]">Pinterest Description Generation Prompt</Label>
            <textarea
              id="video-pinterest-description-prompt"
              value={settings.videoPinterestDescriptionPrompt || `You are a Pinterest content strategist for Screen Render. Create optimized Pinterest pin descriptions for movie and TV trailers.

INPUT: Movie/TV title, synopsis, cast, director, release date, genre, Google Search API data
OUTPUT: Pinterest-optimized description (500 characters max)

Pinterest Description Requirements:
- First 50-60 characters are critical (preview text)
- Front-load key information: Title, release date, hook
- Include relevant keywords naturally throughout
- Include relevant keywords naturally throughout
- Optimize for search and discovery
- Include a call-to-action
- Keep under 500 characters total

Structure:
1. Opening hook (50-60 chars) - Most important
2. Synopsis/context (2-3 sentences)
3. Key cast/director mention
4. Release date and platform
5. CTA (Watch now, Get tickets, etc.)

Example:
"The Batman returns in 2025! 🦇 Matt Reeves' epic sequel reunites Robert Pattinson as the Dark Knight facing his deadliest enemy yet. Colin Farrell returns as The Penguin in this darker, grittier take on Gotham. Coming to theaters Summer 2025.

Watch the trailer now! 🎬"

Guidelines:
- Use Google Search API for accurate cast, dates, platform info
- Natural keyword integration (no keyword stuffing)
- Use emojis strategically (1-2 max)
- Use emojis strategically (1-2 max)
- Make first sentence compelling and complete
- Add urgency or exclusivity when relevant

Tone: Engaging, searchable, benefit-focused, optimized for Pinterest users seeking inspiration and planning`}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoPinterestDescriptionPrompt', e.target.value);
              }}
              rows={32}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              SEO-optimized descriptions with front-loaded hooks and strategic hashtags
            </p>
          </div>

          {/* Pinterest Board Selection */}
          <div>
            <Label htmlFor="video-pinterest-board" className="text-[#9CA3AF]">Default Pinterest Board</Label>
            <PinterestBoardSelect
              id="video-pinterest-board"
              value={settings.videoPinterestBoard || 'Movie Trailers'}
              onChange={(value) => {
                updateSetting('videoPinterestBoard', value);
                toast.success('Pinterest board updated');
              }}
              placeholder="Movie Trailers"
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Board name where trailer videos will be published (must match existing Pinterest board)
            </p>
          </div>

          {/* Pinterest Link Strategy */}
          <div>
            <Label htmlFor="video-pinterest-link-strategy" className="text-[#9CA3AF]">Link Strategy</Label>
            <Select
              value={settings.videoPinterestLinkStrategy || 'youtube'}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('videoPinterestLinkStrategy', value);
                toast.success('Pinterest link strategy updated');
              }}
            >
              <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
                <SelectItem value="youtube" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  YouTube Trailer URL
                </SelectItem>
                <SelectItem value="tmdb" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  TMDb Movie/Show Page
                </SelectItem>
                <SelectItem value="screenrender" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  Screen Render Movie Page
                </SelectItem>
                <SelectItem value="custom" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  Custom URL (set per post)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Default link destination for Pinterest pins (auto-generated based on source)
            </p>
          </div>

          {/* Pinterest Custom Default Link (conditional) */}
          {settings.videoPinterestLinkStrategy === 'custom' && (
            <div>
              <Label htmlFor="video-pinterest-default-link" className="text-[#9CA3AF]">Default Custom Link</Label>
              <Input
                id="video-pinterest-default-link"
                value={settings.videoPinterestDefaultLink || ''}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('videoPinterestDefaultLink', e.target.value);
                }}
                placeholder="https://screenrender.com"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                Fallback URL when custom link is not specified per post
              </p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* Pre-Download Content Filtering */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Pre-Download Content Filtering</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              GPT-5 Nano with Google Search API filters trailers before download
            </p>
          </div>

          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4">
            <h4 className="text-sm text-gray-900 dark:text-white mb-2">Filtering Strategy</h4>
            <div className="space-y-2 text-xs text-gray-600 dark:text-[#9CA3AF]">
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24]">•</span>
                <span><span className="text-gray-900 dark:text-white">Step 1:</span> YouTube watcher detects new trailer video</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24]">•</span>
                <span><span className="text-gray-900 dark:text-white">Step 2:</span> Google Search API fetches title, country, language, genres</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24]">•</span>
                <span><span className="text-gray-900 dark:text-white">Step 3:</span> GPT-5 Nano validates if content matches criteria (YES/NO)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24]">•</span>
                <span><span className="text-gray-900 dark:text-white">Step 4:</span> Only queue video for download if GPT returns YES</span>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="video-filter-prompt" className="text-[#9CA3AF]">Content Filtering Prompt (GPT-5 Nano)</Label>
            <textarea
              id="video-filter-prompt"
              value={settings.videoFilterPrompt || `You are a content filter for Screen Render. Validate trailer titles using Google Search API data.

INPUT: Trailer title, Google Search API results (title, country, language, genres from IMDb/TMDb/Wikipedia)
OUTPUT: YES or NO

Criteria (ALL must match):
✓ Production: US or British-produced only
✓ Language: English-language only (original language must be "en")
✓ Genres: Must be ONE of: action, adventure, thriller, sci-fi, drama, fantasy, comedy, science fiction, romance
✗ Exclude: wrestling, sports, documentary, WWE, boxing, reality shows, cooking shows, foreign dubs, non-English content

Instructions:
1. Use Google Search API to fetch: title, production country, original language, genres
2. Validate against criteria above
3. Answer ONLY "YES" or "NO" (no explanation)

Examples:
Input: "Emily In Paris" (France, French, drama)
Output: NO (French-produced)

Input: "Dune: Part Two" (US, English, sci-fi/adventure)
Output: YES

Input: "WWE Monday Night RAW" (US, English, sports/wrestling)
Output: NO (wrestling/sports excluded)

Input: "Squid Game Season 2" (South Korea, Korean, thriller)
Output: NO (Korean-produced, non-English)

Tone: Binary validation, strict criteria enforcement`}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoFilterPrompt', e.target.value);
              }}
              rows={24}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              GPT-5 Nano validates US/UK English-language content only, excludes foreign/dubbed/sports
            </p>
          </div>

          <div>
            <Label className="text-[#9CA3AF]">Filtering Performance Settings</Label>
            <div className="space-y-2 mt-1">
              <div className="flex items-center gap-2">
                <Input
                  type="checkbox"
                  id="video-filter-cache"
                  checked={settings.videoFilterCache !== false}
                  onChange={(e) => {
                    haptics.light();
                    updateSetting('videoFilterCache', e.target.checked);
                  }}
                  className="w-4 h-4 border-gray-300 dark:border-[#333333] accent-black dark:accent-white"
                />
                <Label htmlFor="video-filter-cache" className="text-xs text-gray-600 dark:text-[#9CA3AF] cursor-pointer">
                  Cache filtered titles to reduce API calls
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="checkbox"
                  id="video-filter-tmdb-validation"
                  checked={settings.videoFilterTmdbValidation !== false}
                  onChange={(e) => {
                    haptics.light();
                    updateSetting('videoFilterTmdbValidation', e.target.checked);
                  }}
                  className="w-4 h-4 border-gray-300 dark:border-[#333333] accent-black dark:accent-white"
                />
                <Label htmlFor="video-filter-tmdb-validation" className="text-xs text-gray-600 dark:text-[#9CA3AF] cursor-pointer">
                  Validate with TMDb API (country code: US/GB, language: en)
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* TMDb Asset Fetching */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">TMDb Asset Fetching & Matching</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              Reliable title matching and asset fetching from TMDb API
            </p>
          </div>

          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4">
            <h4 className="text-sm text-gray-900 dark:text-white mb-2">Title Matching Pipeline</h4>
            <div className="space-y-2 text-xs text-gray-600 dark:text-[#9CA3AF]">
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24]">1.</span>
                <span><span className="text-gray-900 dark:text-white">Extract:</span> Remove &quot;Official Trailer&quot;, &quot;Teaser&quot;, &quot;2025&quot;, &quot;HD&quot; from YouTube title using regex</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24]">2.</span>
                <span><span className="text-gray-900 dark:text-white">Search TMDb:</span> GET /search/movie or /search/tv with cleaned title + year</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24]">3.</span>
                <span><span className="text-gray-900 dark:text-white">Filter:</span> Keep only original_language=en, production_countries=US/GB, matching genres</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24]">4.</span>
                <span><span className="text-gray-900 dark:text-white">Rank:</span> Exact title match, then release year match, then GPT confirmation</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24]">5.</span>
                <span><span className="text-gray-900 dark:text-white">Fetch Assets:</span> GET /movie/{`{id}`}/images for backdrop, logo, poster</span>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="video-title-cleaning-regex" className="text-[#9CA3AF]">Title Cleaning Regex</Label>
            <Input
              id="video-title-cleaning-regex"
              value={settings.videoTitleCleaningRegex || '(?:\\s*[–-]\\s*(?:Official|Teaser|Trailer|HD|4K|2024|2025|2026).*$)'}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoTitleCleaningRegex', e.target.value);
              }}
              placeholder="Regex pattern to remove trailer keywords"
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 font-mono text-xs"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Regex to strip &quot;Official Trailer&quot;, years, etc. from YouTube titles
            </p>
          </div>

          <div>
            <Label htmlFor="video-tmdb-fallback" className="text-[#9CA3AF]">TMDb Asset Fallback Behavior</Label>
            <Select
              value={settings.videoTmdbFallback || 'use-youtube-thumbnail'}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('videoTmdbFallback', value);
                toast.success(`TMDb fallback changed to ${value}`);
              }}
            >
              <SelectTrigger id="video-tmdb-fallback" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="use-youtube-thumbnail">Use YouTube Auto-Generated Thumbnail</SelectItem>
                <SelectItem value="skip-upload">Skip Upload (Manual Intervention)</SelectItem>
                <SelectItem value="backdrop-only">Use Backdrop Without Logo</SelectItem>
                <SelectItem value="poster-only">Use Poster Only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              What to do if TMDb returns no valid backdrop or logo
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* Platform-Specific Thumbnail System */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Platform-Specific Thumbnail System</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              Automated thumbnail generation using TMDb assets (poster for social, backdrop+logo for YouTube/X)
            </p>
          </div>

          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4">
            <h4 className="text-sm text-gray-900 dark:text-white mb-2">Thumbnail Strategy</h4>
            <div className="space-y-2 text-xs text-gray-600 dark:text-[#9CA3AF]">
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24]">•</span>
                <span><span className="text-gray-900 dark:text-white">Portrait (Poster):</span> Instagram, Facebook, Threads, TikTok use TMDb poster directly</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24]">•</span>
                <span><span className="text-gray-900 dark:text-white">Landscape (Backdrop + Logo):</span> YouTube (1280x720), X (1280x720) use backdrop with logo overlay</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24]">•</span>
                <span><span className="text-gray-900 dark:text-white">Processing:</span> Sharp composites backdrop + logo centered at bottom third</span>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="video-youtube-x-thumbnail-prompt" className="text-[#9CA3AF]">YouTube & X Thumbnail (Backdrop + Logo)</Label>
            <textarea
              id="video-youtube-x-thumbnail-prompt"
              value={settings.videoYoutubeXThumbnailPrompt || `You are a thumbnail designer for Screen Render. Generate YouTube and X thumbnails using TMDb backdrop + logo.

INPUT: TMDb backdrop URL, TMDb logo URL (transparent PNG), movie/TV title
OUTPUT: Thumbnail composition instructions (JSON)

Technical Specs:
- Dimensions: 1280x720px (16:9 aspect ratio)
- File size: Under 2MB
- Format: JPG or PNG
- Platforms: YouTube, X (Twitter)

Processing (using Sharp):
1. Download TMDb backdrop image
2. Resize to 1280x720px (smart crop if needed)
3. Download TMDb logo (transparent PNG)
4. Composite logo centered horizontally at bottom third of backdrop
5. If no logo: use backdrop only (no text overlay)
6. Export as JPG/PNG under 2MB

Logo Placement:
- Position: Center-bottom (horizontally centered, bottom third vertically)
- Max width: 60% of backdrop width
- Max height: 25% of backdrop height
- Maintain aspect ratio
- Add subtle drop shadow for visibility

Output Format (JSON):
{
  "backdropUrl": "https://image.tmdb.org/t/p/original/...",
  "logoUrl": "https://image.tmdb.org/t/p/original/..." or null,
  "dimensions": { "width": 1280, "height": 720 },
  "logoPlacement": {
    "position": "center-bottom",
    "maxWidthPercent": 60,
    "maxHeightPercent": 25,
    "verticalOffset": "bottom-third"
  }
}

Tone: Clean, minimal, professional`}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoYoutubeXThumbnailPrompt', e.target.value);
              }}
              rows={24}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Sharp composites TMDb backdrop + logo (centered bottom) for YouTube and X
            </p>
          </div>

          <div>
            <Label htmlFor="video-social-thumbnail-prompt" className="text-[#9CA3AF]">Instagram/Facebook/Threads/TikTok Thumbnail (Poster)</Label>
            <textarea
              id="video-social-thumbnail-prompt"
              value={settings.videoSocialThumbnailPrompt || `You are a thumbnail designer for Screen Render. Generate social media thumbnails using TMDb poster.

INPUT: TMDb poster URL, movie/TV title
OUTPUT: Thumbnail specifications (JSON)

Technical Specs:
- Source: TMDb poster (portrait 2:3 ratio)
- Platforms: Instagram, Facebook, Threads, TikTok
- File size: Under 2MB
- Format: JPG or PNG

Processing (using Sharp):
1. Download TMDb poster image
2. Use poster as-is (already optimized for portrait viewing)
3. Optional: Resize to 1080x1920 (9:16 for Reels/Stories)
4. Export as JPG/PNG under 2MB

Note: TMDb posters work perfectly for vertical platforms - no logo overlay needed

Output Format (JSON):
{
  "posterUrl": "https://image.tmdb.org/t/p/original/...",
  "targetDimensions": { "width": 1080, "height": 1920 },
  "platforms": ["instagram", "facebook", "threads", "tiktok"]
}

Tone: Clean poster presentation`}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoSocialThumbnailPrompt', e.target.value);
              }}
              rows={20}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              TMDb poster used directly for Instagram, Facebook, Threads, TikTok
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* Complete Automation Pipeline */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Complete Automation Pipeline</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              End-to-end workflow from detection to multi-platform upload
            </p>
          </div>

          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4 space-y-3">
            <div className="space-y-2 text-xs text-gray-600 dark:text-[#9CA3AF]">
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24] shrink-0 w-5">1.</span>
                <span><span className="text-gray-900 dark:text-white">Detect:</span> YouTube RSS polling finds new trailer</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24] shrink-0 w-5">2.</span>
                <span><span className="text-gray-900 dark:text-white">Filter:</span> Google Search API + GPT-5 Nano validates US/UK English content</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24] shrink-0 w-5">3.</span>
                <span><span className="text-gray-900 dark:text-white">Download:</span> yt-dlp downloads video (only if GPT returns YES)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24] shrink-0 w-5">4.</span>
                <span><span className="text-gray-900 dark:text-white">Clean Title:</span> Regex strips &quot;Official Trailer&quot;, years, keywords</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24] shrink-0 w-5">5.</span>
                <span><span className="text-gray-900 dark:text-white">TMDb Match:</span> Search TMDb with cleaned title, filter by language/country/genre</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24] shrink-0 w-5">6.</span>
                <span><span className="text-gray-900 dark:text-white">Fetch Assets:</span> Get backdrop, logo, poster, cast, release_date from TMDb</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24] shrink-0 w-5">7.</span>
                <span><span className="text-gray-900 dark:text-white">Google Context:</span> GPT-5 Nano queries Google Search for trending data</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24] shrink-0 w-5">8.</span>
                <span><span className="text-gray-900 dark:text-white">Generate Content:</span> GPT-5 Nano creates title, description, tags, captions (Culture Crave style)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24] shrink-0 w-5">9.</span>
                <span><span className="text-gray-900 dark:text-white">Thumbnails:</span> Sharp composites backdrop+logo (YouTube/X), uses poster (Instagram/Facebook/Threads/TikTok)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24] shrink-0 w-5">10.</span>
                <span><span className="text-gray-900 dark:text-white">Playlists:</span> GPT-5 Nano + Google Search determines YouTube playlists</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24] shrink-0 w-5">11.</span>
                <span><span className="text-gray-900 dark:text-white">Upload:</span> Post to all enabled platforms with platform-specific thumbnails</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#ec1e24] shrink-0 w-5">12.</span>
                <span><span className="text-gray-900 dark:text-white">Queue:</span> Respect post intervals to avoid spam limits</span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* Activity Retention Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Activity Retention</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Hide older YouTube detection items in the Video Activity page after a specified time period
            </p>
          </div>

          <div>
            <Label htmlFor="video-activity-retention" className="text-[#6B7280] dark:text-[#9CA3AF]">Activity Retention (hours)</Label>
            <Input
              id="video-activity-retention"
              type="number"
              value={settings.videoActivityRetention || 24}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoActivityRetention', parseInt(e.target.value, 10) || 24);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              Older YouTube detection items will be hidden in the Video Activity page after this time period (Default: 24 hours)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
