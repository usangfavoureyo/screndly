import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  fetchSettings,
  saveSettings as saveSettingsToBackend,
  deleteSettings as deleteSettingsFromBackend,
  checkBackendHealth,
  mergeSettings,
  isSensitiveSetting,
} from '../lib/api/settings';
import { toast } from "sonner";
import { analyticsIngester } from '../lib/optimization/analyticsIngester';
import {
  DEFAULT_MODELS,
  DefaultModelFeature,
  normalizeAIModelId,
  normalizeModelSettingRecord,
} from '../lib/ai/models';
import {
  dispatchThemeChange,
  persistThemePreference,
} from '../lib/theme/themeStorage';
import { settingsPromptDefaults } from '../config/cultureCravePromptDefaults';

const LOCAL_SETTINGS_KEY = 'screndlySettings';
const LEGACY_LOCAL_SETTINGS_KEY = 'screndly_settings';
const CULTURE_CRAVE_PROMPTS_MIGRATION_KEY = 'screndly_culturecrave_prompts_v1';

export interface Settings {
  videoYoutubeSelectedPlaylists?: Array<{
    id: string;
    title: string;
    itemCount?: number;
    privacyStatus?: 'private' | 'public' | 'unlisted';
  }>;

  // API Keys
  youtubeKey: string;
  openaiKey: string;
  serperKey: string;
  tmdbKey: string;
  googleVideoIntelligenceKey: string;
  shotstackKey: string;
  s3Key: string;
  backblazeKeyId: string;
  backblazeApplicationKey: string;
  backblazeBucketName: string;
  backblazeVideosKeyId: string;
  backblazeVideosApplicationKey: string;
  backblazeVideosBucketName: string;
  backblazeDesignKeyId: string;
  backblazeDesignApplicationKey: string;
  backblazeDesignBucketName: string;
  videoGoogleSearchApiKey: string;
  videoGoogleSearchCx: string;
  photopeaApiKey: string;

  // Video
  fetchInterval: string;
  postInterval?: string;
  regionFilter: string;
  advancedFilters: string;
  videoAgeGateHours?: string;
  videoBacklogMode?: string;
  videoFutureOnlySince?: string;
  excludeShorts?: boolean;
  videoOpenaiModel?: string;
  videoUniversalCaptionPrompt?: string;
  videoYoutubeTitlePrompt?: string;
  videoYoutubeDescriptionPrompt?: string;
  videoYoutubePlaylistPrompt?: string;
  videoYoutubePlaylists?: string;
  videoFilterPrompt?: string;
  videoFilterCache?: boolean;
  videoFilterTmdbValidation?: boolean;
  videoTitleCleaningRegex?: string;
  videoTmdbFallback?: string;
  videoYoutubeXThumbnailPrompt?: string;
  videoSocialThumbnailPrompt?: string;
  videoPinterestTitlePrompt?: string;
  videoPinterestDescriptionPrompt?: string;
  videoPinterestBoard?: string;
  videoPinterestLinkStrategy?: string;
  videoPinterestDefaultLink?: string;
  thumbnailConfig_youtube?: string;
  thumbnailConfig_x?: string;

  // Comment Reply
  commentRepliesActive: boolean;
  totalCommentsProcessed: number;
  repliesPosted: number;
  commentErrors: number;
  commentBlacklistUsernames: string;
  commentBlacklistKeywords: string;
  commentReplyFrequency: string;
  commentThrottle: string;
  commentReplyModel?: string;
  commentReplyTemperature?: number;
  commentReplyTone?: string;
  commentReplyMaxLength?: number;
  commentReplyPrompt?: string;
  commentUseGoogleSearch?: boolean;
  commentUseSerper?: boolean;
  commentGoogleSearchApiKey?: string;
  commentGoogleSearchCx?: string;

  // Per-platform comment settings
  xCommentBlacklist: {
    active: boolean;
    usernames: string;
    keywords: string;
    noEmojiOnly: boolean;
    noLinks: boolean;
    pauseOldPosts: boolean;
    pauseAfterHours: string;
  };
  threadsCommentBlacklist: {
    active: boolean;
    usernames: string;
    keywords: string;
    noEmojiOnly: boolean;
    noLinks: boolean;
    pauseOldPosts: boolean;
    pauseAfterHours: string;
  };
  facebookCommentBlacklist: {
    active: boolean;
    usernames: string;
    keywords: string;
    noEmojiOnly: boolean;
    noLinks: boolean;
    pauseOldPosts: boolean;
    pauseAfterHours: string;
  };
  instagramCommentBlacklist: {
    active: boolean;
    usernames: string;
    keywords: string;
    noEmojiOnly: boolean;
    noLinks: boolean;
    pauseOldPosts: boolean;
    pauseAfterHours: string;
  };
  youtubeCommentBlacklist: {
    active: boolean;
    usernames: string;
    keywords: string;
    noEmojiOnly: boolean;
    noLinks: boolean;
    pauseOldPosts: boolean;
    pauseAfterHours: string;
  };
  tiktokCommentBlacklist: {
    active: boolean;
    usernames: string;
    keywords: string;
    noEmojiOnly: boolean;
    noLinks: boolean;
    pauseOldPosts: boolean;
    pauseAfterHours: string;
  };
  pinterestCommentBlacklist: {
    active: boolean;
    usernames: string;
    keywords: string;
    noEmojiOnly: boolean;
    noLinks: boolean;
    pauseOldPosts: boolean;
    pauseAfterHours: string;
  };

  // RSS
  rssEnabled: boolean;
  globalEnabled?: boolean;
  postingInterval?: string;
  globalRSSPosting?: boolean;
  rssEventDrivenPosting?: boolean;
  rssPostingInterval?: string;
  rssImageCount: string;
  rssPlatforms: string[];
  rssFetchInterval: string;
  rssDeduplication: boolean;
  rssLogLevel: string;
  dailyQuotaX?: number;
  dailyQuotaThreads?: number;
  dailyQuotaFacebook?: number;
  dailyQuotaPinterest?: number;
  quietHoursEnabled?: boolean;
  quietHoursStart?: number;
  quietHoursEnd?: number;
  rssCaptionModel?: string;
  rssCaptionTemperature?: number;
  rssCaptionTone?: string;
  rssCaptionMaxLength?: number;
  rssCaptionPrompt?: string;
  rssPinterestTitlePrompt?: string;
  rssPinterestDescriptionPrompt?: string;
  rssPinterestBoardPrompt?: string;
  rssPinterestLinkStrategy?: string;
  rssPinterestDefaultLink?: string;
  rssActivityRetention?: number;
  videoActivityRetention?: number;

  // TMDb
  tmdbCaptionModel?: string;
  tmdbCaptionTemperature?: number;
  tmdbTodayPrompt?: string;
  tmdbWeeklyPrompt?: string;
  tmdbMonthlyPrompt?: string;
  tmdbAnniversaryPrompt?: string;
  customAnniversaryYears?: string[];
  todayPrompt?: string;
  weeklyPrompt?: string;
  monthlyPrompt?: string;
  anniversaryPrompt?: string;

  // Design Studio
  captionPosterPrompt?: string;
  captionCarouselPrompt?: string;
  captionStoryPrompt?: string;
  captionAnnouncementPrompt?: string;
  captionGeneralPrompt?: string;
  designStudioPinterestTitlePrompt?: string;
  designStudioPinterestDescriptionPrompt?: string;
  designStudioPinterestBoardPrompt?: string;
  designStudioLogLevel?: string;

  // Video Studio
  systemPrompt?: string;
  captionOpenaiModel?: string;
  captionTemperature?: number;
  captionGoogleSearchApiKey?: string;
  captionGoogleSearchCx?: string;
  captionReviewPrompt?: string;
  captionReleasesPrompt?: string;
  captionScenesPrompt?: string;
  videoStudioPinterestTitlePrompt?: string;
  videoStudioPinterestDescriptionPrompt?: string;
  videoStudioPinterestBoardPrompt?: string;
  videoStudioLogLevel?: string;

  // Video Studio - Web Search for AI Assist
  videoStudioWebSearchEnabled?: boolean;
  videoStudioWebSearchProvider?: 'serper' | 'google';
  videoStudioWebSearchMaxResults?: number;

  // PAD
  padChatModel?: string;
  padChatSystemPrompt?: string;

  // Compose
  composeActivityRetention?: number;
  composeDefaultScheduleTime?: string;

  // Activity Retention
  videoStudioActivityRetention?: number;
  designStudioActivityRetention?: number;
  tmdbActivityRetention?: number;
  tmdbLogLevel?: string;

  // Cleanup
  cleanupEnabled: boolean;
  cleanupInterval: string;
  storageRetention: string;
  videoCleanupInterval: string;
  videoStorageRetention: string;
  imageCleanupInterval: string;
  imageStorageRetention: string;
  videoStudioCleanupInterval: string;
  videoStudioStorageRetention: string;
  logsRetention: string;
  recentActivityRetention: string;

  // Appearance
  darkMode: boolean;
  hapticsEnabled: boolean;

  // Notifications
  emailNotifications: boolean;
  pushNotifications: boolean;
  desktopNotifications?: boolean;

  // Timezone
  timezone?: string;
}

interface SettingsContextType {
  settings: Settings;
  updateSetting: (key: string, value: any) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  resetSettings: () => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SECRET_STORAGE_KEYS = new Set([
  'youtubeKey',
  'openaiKey',
  'serperKey',
  'tmdbKey',
  'googleVideoIntelligenceKey',
  'shotstackKey',
  's3Key',
  'backblazeKeyId',
  'backblazeApplicationKey',
  'backblazeVideosKeyId',
  'backblazeVideosApplicationKey',
  'backblazeDesignKeyId',
  'backblazeDesignApplicationKey',
  'redisUrl',
  'databaseUrl',
  'videoGoogleSearchApiKey',
  'commentGoogleSearchApiKey',
  'captionGoogleSearchApiKey',
  'photopeaApiKey',
]);

const SETTINGS_MODEL_KEYS: Partial<Record<keyof Settings, DefaultModelFeature>> = {
  videoOpenaiModel: 'video',
  commentReplyModel: 'comment',
  rssCaptionModel: 'rss',
  tmdbCaptionModel: 'tmdb',
  captionOpenaiModel: 'videoStudio',
  padChatModel: 'pad',
};

function normalizeSettingsModels(settings: Partial<Settings>): Partial<Settings> {
  return normalizeModelSettingRecord(settings, SETTINGS_MODEL_KEYS);
}

function getDefaultSettings(): Settings {
  const hapticsEnabled = localStorage.getItem('hapticsEnabled');
  return {
    // API Keys
    youtubeKey: '••••••••••••••••',
    openaiKey: '••••••••••••••••',
    serperKey: '••••••••••••••••',
    tmdbKey: '••••••••••••••••',
    googleVideoIntelligenceKey: '••••••••••••••••',
    shotstackKey: '••••••••••••••••',
    s3Key: '••••••••••••••••',
    backblazeKeyId: '',
    backblazeApplicationKey: '',
    backblazeBucketName: '',
    backblazeVideosKeyId: '',
    backblazeVideosApplicationKey: '',
    backblazeVideosBucketName: '',
    backblazeDesignKeyId: '',
    backblazeDesignApplicationKey: '',
    backblazeDesignBucketName: '',
    redisUrl: 'redis://localhost:6379',
    databaseUrl: 'postgresql://localhost/screndly',
    videoGoogleSearchApiKey: '',
    videoGoogleSearchCx: '',
    photopeaApiKey: '',

    // Video
    fetchInterval: '10',
    postInterval: '10',
    regionFilter: 'US,UK',
    advancedFilters: 'trailer, official, teaser',
    videoAgeGateHours: '24',
    videoBacklogMode: 'process-backlog',
    videoFutureOnlySince: '',
    excludeShorts: true,
    videoOpenaiModel: DEFAULT_MODELS.video,
    videoUniversalCaptionPrompt: '',
    videoYoutubeTitlePrompt: '',
    videoYoutubeDescriptionPrompt: '',
    videoYoutubePlaylistPrompt: '',
    videoYoutubePlaylists: '',
    videoYoutubeSelectedPlaylists: [],
    videoFilterPrompt: '',
    videoFilterCache: true,
    videoFilterTmdbValidation: true,
    videoTitleCleaningRegex: '(?:\\s*[–-]\\s*(?:Official|Teaser|Trailer|HD|4K|2024|2025|2026).*$)',
    videoTmdbFallback: 'use-youtube-thumbnail',
    videoYoutubeXThumbnailPrompt: '',
    videoSocialThumbnailPrompt: '',
    videoPinterestTitlePrompt: '',
    videoPinterestDescriptionPrompt: '',
    videoPinterestBoard: '',
    videoPinterestLinkStrategy: 'youtube',
    videoPinterestDefaultLink: '',
    thumbnailConfig_youtube: '',
    thumbnailConfig_x: '',

    // Comment Reply
    commentRepliesActive: true,
    totalCommentsProcessed: 1247,
    repliesPosted: 1189,
    commentErrors: 4,
    commentBlacklistUsernames: '',
    commentBlacklistKeywords: '',
    commentReplyFrequency: 'instant',
    commentThrottle: 'low',
    commentReplyModel: DEFAULT_MODELS.comment,
    commentReplyTemperature: 0.7,
    commentReplyTone: 'Engaging',
    commentReplyMaxLength: 280,
    commentReplyPrompt: `You are a social media comment writer for Screen Render, a movie and TV trailer news platform. Create engaging, platform-optimized comments for video content.

INPUT: Video title, description, and content
OUTPUT: Engaging social media comment with emojis, hashtags, and hook

Guidelines:
- Hook in first line (7-10 words max)
- Include 3 relevant emoji and hashtags
- Add 2-3 strategically placed emojis
- Keep total under {maxLength} characters for platform compatibility
- Match the tone of the video content
- No generic "Check this out" openers
- Focus on the key news or reveal from the video
- Make it shareable and clickable`,
    commentUseGoogleSearch: false,
    commentUseSerper: false,
    commentGoogleSearchApiKey: '',
    commentGoogleSearchCx: '',

    // Per-platform comment settings
    xCommentBlacklist: {
      active: true,
      usernames: '',
      keywords: '',
      noEmojiOnly: false,
      noLinks: false,
      pauseOldPosts: true,
      pauseAfterHours: '24',
    },
    threadsCommentBlacklist: {
      active: false,
      usernames: '',
      keywords: '',
      noEmojiOnly: false,
      noLinks: false,
      pauseOldPosts: true,
      pauseAfterHours: '24',
    },
    facebookCommentBlacklist: {
      active: false,
      usernames: '',
      keywords: '',
      noEmojiOnly: false,
      noLinks: false,
      pauseOldPosts: true,
      pauseAfterHours: '24',
    },
    instagramCommentBlacklist: {
      active: true,
      usernames: '',
      keywords: '',
      noEmojiOnly: false,
      noLinks: false,
      pauseOldPosts: true,
      pauseAfterHours: '24',
    },
    youtubeCommentBlacklist: {
      active: false,
      usernames: '',
      keywords: '',
      noEmojiOnly: false,
      noLinks: false,
      pauseOldPosts: true,
      pauseAfterHours: '24',
    },
    tiktokCommentBlacklist: {
      active: false,
      usernames: '',
      keywords: '',
      noEmojiOnly: false,
      noLinks: false,
      pauseOldPosts: true,
      pauseAfterHours: '24',
    },
    pinterestCommentBlacklist: {
      active: false,
      usernames: '',
      keywords: '',
      noEmojiOnly: false,
      noLinks: false,
      pauseOldPosts: true,
      pauseAfterHours: '24',
    },

    // RSS
    rssEnabled: false,
    globalEnabled: false,
    postingInterval: '10',
    globalRSSPosting: true,
    rssEventDrivenPosting: true,
    rssPostingInterval: '10',
    rssImageCount: 'random',
    rssPlatforms: ['x', 'threads'],
    rssFetchInterval: '5',
    rssDeduplication: true,
    rssLogLevel: 'standard',
    dailyQuotaX: 50,
    dailyQuotaThreads: 100,
    dailyQuotaFacebook: 25,
    dailyQuotaPinterest: 100,
    quietHoursEnabled: true,
    quietHoursStart: 0,
    quietHoursEnd: 7,
    rssCaptionModel: DEFAULT_MODELS.rss,
    rssCaptionTemperature: 0.7,
    rssCaptionTone: 'Engaging',
    rssCaptionMaxLength: 280,
    rssActivityRetention: 24,
    videoActivityRetention: 24,
    designStudioActivityRetention: 24,
    designStudioLogLevel: 'standard',
    videoStudioActivityRetention: 24,
    videoStudioLogLevel: 'standard',
    tmdbActivityRetention: 24,
    tmdbLogLevel: 'standard',
    rssCaptionPrompt: '',
    rssPinterestTitlePrompt: '',
    rssPinterestDescriptionPrompt: '',
    rssPinterestBoardPrompt: '',
    rssPinterestLinkStrategy: 'article',
    rssPinterestDefaultLink: '',

    // TMDb
    tmdbCaptionModel: DEFAULT_MODELS.tmdb,
    tmdbCaptionTemperature: 0.7,
    todayPrompt: '',
    weeklyPrompt: '',
    monthlyPrompt: '',
    anniversaryPrompt: '',

    // Design Studio
    captionPosterPrompt: '',
    captionCarouselPrompt: '',
    captionStoryPrompt: '',
    captionAnnouncementPrompt: '',
    captionGeneralPrompt: '',
    designStudioPinterestTitlePrompt: '',
    designStudioPinterestDescriptionPrompt: '',
    designStudioPinterestBoardPrompt: '',

    // Video Studio
    systemPrompt: '',
    captionReviewPrompt: '',
    captionReleasesPrompt: '',
    captionScenesPrompt: '',
    videoStudioPinterestTitlePrompt: '',
    videoStudioPinterestDescriptionPrompt: '',
    videoStudioPinterestBoardPrompt: '',

    // PAD
    padChatModel: DEFAULT_MODELS.pad,
    padChatSystemPrompt: 'You are Screndly Post. Stay aligned to the chat context, write like a sharp entertainment and social publishing copilot, and keep replies useful and editable.',

    // Compose
    composeActivityRetention: 30,
    composeDefaultScheduleTime: '09:00',

    // Cleanup
    cleanupEnabled: true,
    cleanupInterval: 'daily',
    storageRetention: '48',
    videoCleanupInterval: 'daily',
    videoStorageRetention: '48',
    imageCleanupInterval: 'daily',
    imageStorageRetention: '48',
    videoStudioCleanupInterval: 'daily',
    videoStudioStorageRetention: '48',
    logsRetention: '168',
    recentActivityRetention: '24',

    // Appearance
    darkMode: true,
    hapticsEnabled: hapticsEnabled === null ? true : hapticsEnabled === 'true',

    // Notifications
    emailNotifications: true,
    pushNotifications: false,
    desktopNotifications: false,

    // Timezone
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...settingsPromptDefaults,
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(getDefaultSettings());
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);

  const syncThemeSetting = (value?: boolean) => {
    if (typeof value !== 'boolean') {
      return;
    }

    const theme = value ? 'dark' : 'light';
    persistThemePreference(theme, window.localStorage);
    dispatchThemeChange(theme);
  };

  // Load settings from backend + localStorage on mount
  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);

      // Check if backend is available
      const isBackendHealthy = await checkBackendHealth();
      setBackendAvailable(isBackendHealthy);

      // Load from localStorage first (fast)
      const localSettings = getLocalSettings();
      const shouldInjectCultureCravePrompts = !window.localStorage.getItem(CULTURE_CRAVE_PROMPTS_MIGRATION_KEY);

      if (isBackendHealthy) {
        try {
          // Fetch API keys from backend
          const response = await fetchSettings();

          if (response.success && response.data) {
            // Merge backend settings (API keys) with local settings (preferences)
            const mergedSettings = normalizeSettingsModels({
              ...getDefaultSettings(),
              ...mergeSettings(response.data, localSettings),
            });
            const merged = shouldInjectCultureCravePrompts
              ? { ...mergedSettings, ...settingsPromptDefaults }
              : mergedSettings;
            setSettings(merged);
            syncThemeSetting(merged.darkMode);
          } else {
            // Backend failed, use local only
            console.warn('[Settings] Failed to fetch settings, using defaults');
            const fallbackSettings = normalizeSettingsModels(
              shouldInjectCultureCravePrompts
                ? { ...getDefaultSettings(), ...localSettings, ...settingsPromptDefaults }
                : { ...getDefaultSettings(), ...localSettings },
            );
            setSettings(fallbackSettings);
            syncThemeSetting(fallbackSettings.darkMode);
          }
        } catch (err) {
          console.error('[Settings] Unexpected error fetching settings', err);
          const fallbackSettings = normalizeSettingsModels(
            shouldInjectCultureCravePrompts
              ? { ...getDefaultSettings(), ...localSettings, ...settingsPromptDefaults }
              : { ...getDefaultSettings(), ...localSettings },
          );
          setSettings(fallbackSettings);
          syncThemeSetting(fallbackSettings.darkMode);
        }
      } else {
        // Backend offline, use local only (this is normal for frontend-only PWA)
        const fallbackSettings = normalizeSettingsModels(
          shouldInjectCultureCravePrompts
            ? { ...getDefaultSettings(), ...localSettings, ...settingsPromptDefaults }
            : { ...getDefaultSettings(), ...localSettings },
        );
        setSettings(fallbackSettings);
        syncThemeSetting(fallbackSettings.darkMode);
      }

      if (shouldInjectCultureCravePrompts) {
        window.localStorage.setItem(CULTURE_CRAVE_PROMPTS_MIGRATION_KEY, 'true');
      }
      setIsLoading(false);
    }

    loadSettings();
  }, []);

  // Auto-save to backend + localStorage with debounce
  useEffect(() => {
    if (isLoading) return; // Don't save during initial load

    const timer = setTimeout(async () => {
      // Always save non-sensitive settings to localStorage
      const nonSensitiveSettings = extractNonSensitiveSettings(normalizeSettingsModels(settings));
      const serialized = JSON.stringify(nonSensitiveSettings);
      localStorage.setItem(LOCAL_SETTINGS_KEY, serialized);
      localStorage.setItem(LEGACY_LOCAL_SETTINGS_KEY, serialized);

      // Save sensitive settings to backend if available
      if (backendAvailable) {
        const result = await saveSettingsToBackend(settings);
        if (!result.success) {
          console.error('[Settings] Failed to save to backend:', result.error);
          toast.error('Failed to save settings to backend');
        }
      }
      // Note: Backend is optional for frontend-only PWA mode
    }, 1000); // Save 1 second after last change

    return () => clearTimeout(timer);
  }, [settings, isLoading, backendAvailable]);

  const updateSetting = async (key: string, value: any) => {
    // Track change for optimization
    const previousValue = settings[key as keyof Settings];
    analyticsIngester.trackSettingChange(key, value, previousValue, 'SettingsContext');

    if (key === 'darkMode' && typeof value === 'boolean') {
      syncThemeSetting(value);
    }

    setSettings(prev => normalizeSettingsModels({ ...prev, [key]: normalizeSettingValue(key, value) }) as Settings);

    // If it's a sensitive setting, try to save immediately to backend
    if (isSensitiveSetting(key) && backendAvailable) {
      const result = await saveSettingsToBackend({ [key]: normalizeSettingValue(key, value) } as Partial<Settings>);
      if (result.success) {
        toast.success(result.meta?.notificationTitle || 'Setting saved', result.meta?.notificationMessage ? {
          description: result.meta.notificationMessage,
        } : undefined);
      } else {
        toast.error('Failed to save setting');
      }
    }
  };

  const updateSettings = async (updates: Partial<Settings>) => {
    // Track changes
    Object.entries(updates).forEach(([key, value]) => {
      const previousValue = settings[key as keyof Settings];
      analyticsIngester.trackSettingChange(key, value, previousValue, 'SettingsContext');
    });

    if (typeof updates.darkMode === 'boolean') {
      syncThemeSetting(updates.darkMode);
    }

    const normalizedUpdates = Object.fromEntries(
      Object.entries(updates).map(([key, value]) => [key, normalizeSettingValue(key, value)]),
    ) as Partial<Settings>;
    setSettings(prev => normalizeSettingsModels({ ...prev, ...normalizedUpdates }) as Settings);

    // Check if any sensitive settings are being updated
    const hasSensitiveUpdates = Object.keys(updates).some(key => isSensitiveSetting(key));

    if (hasSensitiveUpdates && backendAvailable) {
      const result = await saveSettingsToBackend(normalizedUpdates);
      if (result.success) {
        toast.success(result.meta?.notificationTitle || 'Settings saved securely', result.meta?.notificationMessage ? {
          description: result.meta.notificationMessage,
        } : undefined);
      } else {
        toast.error('Failed to save some settings');
      }
    }
  };

  const resetSettings = async () => {
    const defaults = normalizeSettingsModels(getDefaultSettings()) as Settings;
    setSettings(defaults);

    // Clear from backend and localStorage
    await deleteSettingsFromBackend();
    toast.success('Settings reset to defaults');
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        updateSettings,
        resetSettings,
        isLoading,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get local settings from localStorage
 */
function getLocalSettings(): Partial<Settings> {
  try {
    const saved =
      localStorage.getItem(LOCAL_SETTINGS_KEY) ??
      localStorage.getItem(LEGACY_LOCAL_SETTINGS_KEY);
    return saved ? normalizeSettingsModels(JSON.parse(saved)) : {};
  } catch {
    return {};
  }
}

function normalizeSettingValue(key: string, value: any): any {
  const feature = SETTINGS_MODEL_KEYS[key as keyof Settings];
  if (!feature) {
    return value;
  }

  return normalizeAIModelId(value, DEFAULT_MODELS[feature]);
}

/**
 * Extract non-sensitive settings
 */
function extractNonSensitiveSettings(settings: Partial<Settings>): Partial<Settings> {
  const nonSensitive: Partial<Settings> = {};
  for (const key in settings) {
    if (!SECRET_STORAGE_KEYS.has(key)) {
      nonSensitive[key as keyof Settings] = settings[key as keyof Settings];
    }
  }
  return nonSensitive;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
