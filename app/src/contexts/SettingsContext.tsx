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

export interface Settings {
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
  regionFilter: string;
  advancedFilters: string;

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

  // TMDb
  tmdbCaptionModel?: string;
  tmdbCaptionTemperature?: number;
  tmdbTodayPrompt?: string;
  tmdbWeeklyPrompt?: string;
  tmdbMonthlyPrompt?: string;
  tmdbAnniversaryPrompt?: string;

  // Video Studio
  captionOpenaiModel?: string;
  captionTemperature?: number;
  captionGoogleSearchApiKey?: string;
  captionGoogleSearchCx?: string;

  // Video Studio - Web Search for AI Assist
  videoStudioWebSearchEnabled?: boolean;
  videoStudioWebSearchProvider?: 'serper' | 'google';
  videoStudioWebSearchMaxResults?: number;

  // Activity Retention
  videoStudioActivityRetention?: number;
  designStudioActivityRetention?: number;
  tmdbActivityRetention?: number;

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
    regionFilter: 'US,UK',
    advancedFilters: 'trailer, official, teaser',

    // Comment Reply
    commentRepliesActive: true,
    totalCommentsProcessed: 1247,
    repliesPosted: 1189,
    commentErrors: 4,
    commentBlacklistUsernames: '',
    commentBlacklistKeywords: '',
    commentReplyFrequency: 'instant',
    commentThrottle: 'low',
    commentReplyModel: 'gpt-4o',
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
    rssCaptionModel: 'gpt-4o',
    rssCaptionTemperature: 0.7,
    rssCaptionTone: 'Engaging',
    rssCaptionMaxLength: 280,
    rssActivityRetention: 24,
    rssCaptionPrompt: `You are a social media caption writer for Screen Render, a movie and TV trailer news platform. Create engaging, platform-optimized captions for RSS article content.

INPUT: RSS article title, description, and content
OUTPUT: Engaging social media caption with emojis, hashtags, and hook

Guidelines:
- Hook in first line (7-10 words max)
- Include 3 relevant emoji and hashtags
- Add 2-3 strategically placed emojis
- Keep total under {maxLength} characters for platform compatibility
- Match the tone of the article content
- No generic "Check this out" openers
- Focus on the key news or reveal from the article
- Make it shareable and clickable`,
    rssPinterestTitlePrompt: '',
    rssPinterestDescriptionPrompt: '',
    rssPinterestBoardPrompt: '',
    rssPinterestLinkStrategy: 'article',
    rssPinterestDefaultLink: '',

    // TMDb
    tmdbCaptionModel: 'gpt-4o',
    tmdbCaptionTemperature: 0.7,

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

    // Appearance
    darkMode: true,
    hapticsEnabled: hapticsEnabled === null ? true : hapticsEnabled === 'true',

    // Notifications
    emailNotifications: true,
    pushNotifications: false,
    desktopNotifications: false,

    // Timezone
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(getDefaultSettings());
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Load settings from backend + localStorage on mount
  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);

      // Check if backend is available
      const isBackendHealthy = await checkBackendHealth();
      setBackendAvailable(isBackendHealthy);

      // Load from localStorage first (fast)
      const localSettings = getLocalSettings();

      if (isBackendHealthy) {
        try {
          // Fetch API keys from backend
          const response = await fetchSettings();

          if (response.success && response.data) {
            // Merge backend settings (API keys) with local settings (preferences)
            const merged = mergeSettings(response.data, localSettings);
            setSettings(merged);
          } else {
            // Backend failed, use local only
            console.warn('[Settings] Failed to fetch settings, using defaults');
            setSettings({ ...getDefaultSettings(), ...localSettings });
          }
        } catch (err) {
          console.error('[Settings] Unexpected error fetching settings', err);
          setSettings({ ...getDefaultSettings(), ...localSettings });
        }
      } else {
        // Backend offline, use local only (this is normal for frontend-only PWA)
        setSettings({ ...getDefaultSettings(), ...localSettings });
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
      const nonSensitiveSettings = extractNonSensitiveSettings(settings);
      localStorage.setItem('screndlySettings', JSON.stringify(nonSensitiveSettings));

      // Save sensitive settings to backend if available
      if (backendAvailable) {
        const result = await saveSettingsToBackend(settings);
        if (!result.success) {
          console.error('[Settings] Failed to save to backend:', result.error);
          toast.error('Failed to save API keys to backend');
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

    setSettings(prev => ({ ...prev, [key]: value }));

    // If it's a sensitive setting, try to save immediately to backend
    if (isSensitiveSetting(key) && backendAvailable) {
      const result = await saveSettingsToBackend({ [key]: value } as Partial<Settings>);
      if (result.success) {
        toast.success('API key saved securely');
      } else {
        toast.error('Failed to save API key');
      }
    }
  };

  const updateSettings = async (updates: Partial<Settings>) => {
    // Track changes
    Object.entries(updates).forEach(([key, value]) => {
      const previousValue = settings[key as keyof Settings];
      analyticsIngester.trackSettingChange(key, value, previousValue, 'SettingsContext');
    });

    setSettings(prev => ({ ...prev, ...updates }));

    // Check if any sensitive settings are being updated
    const hasSensitiveUpdates = Object.keys(updates).some(key => isSensitiveSetting(key));

    if (hasSensitiveUpdates && backendAvailable) {
      const result = await saveSettingsToBackend(updates);
      if (result.success) {
        toast.success('Settings saved securely');
      } else {
        toast.error('Failed to save some settings');
      }
    }
  };

  const resetSettings = async () => {
    const defaults = getDefaultSettings();
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
    const saved = localStorage.getItem('screndlySettings');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

/**
 * Extract non-sensitive settings
 */
function extractNonSensitiveSettings(settings: Partial<Settings>): Partial<Settings> {
  const nonSensitive: Partial<Settings> = {};
  for (const key in settings) {
    if (!isSensitiveSetting(key)) {
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
