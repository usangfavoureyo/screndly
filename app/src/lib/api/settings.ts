// ============================================================================
// SETTINGS API - Secure Backend Communication
// ============================================================================
// Handles API key storage and settings persistence with backend

import type { Settings } from '../../contexts/SettingsContext';

import { getApiUrl } from './config';

const LOCAL_SETTINGS_KEY = 'screndlySettings';
const LEGACY_LOCAL_SETTINGS_KEY = 'screndly_settings';

/**
 * Sensitive settings that should ONLY be stored on backend
 * and should never be returned to the client unmasked.
 */
const SENSITIVE_KEYS = [
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
  // Video / YouTube Polling Settings (Required for Backend Poller)
  'fetchInterval',
  'postInterval',
  'advancedFilters',
  'regionFilter',
  'excludeShorts',
  'videoOpenaiModel',
  'videoUniversalCaptionPrompt',
  'videoYoutubeTitlePrompt',
  'videoYoutubeDescriptionPrompt',
  'videoYoutubePlaylistPrompt',
  'videoYoutubePlaylists',
  'videoPinterestTitlePrompt',
  'videoPinterestDescriptionPrompt',
  'videoPinterestBoard',
  'videoPinterestLinkStrategy',
  'videoPinterestDefaultLink',
  'videoFilterPrompt',
  // RSS Settings
  'globalRSSPosting',
  'rssEventDrivenPosting',
  'rssPostingInterval',
  'rssCaptionModel',
  'rssCaptionTemperature',
  'rssCaptionTone',
  'rssCaptionMaxLength',
  'rssCaptionPrompt',
  'rssDailyLimit',
  'rssStartHour',
  'rssEndHour',
  'rssDefaultInterval',
  'dailyQuotaX',
  'dailyQuotaThreads',
  'dailyQuotaFacebook',
  'dailyQuotaPinterest',
  'quietHoursEnabled',
  'quietHoursStart',
  'quietHoursEnd',
  'rssPinterestBoard',
  'rssPinterestTitlePrompt',
  'rssPinterestDescriptionPrompt',
  'rssPinterestBoardPrompt',
  'rssPinterestLinkStrategy',
  'rssPinterestDefaultLink',
  'rssActivityRetention',
  'videoActivityRetention',
  'rssLogLevel',
  'designStudioActivityRetention',
  'designStudioLogLevel',
  'videoStudioActivityRetention',
  'videoStudioLogLevel',
  'tmdbActivityRetention',
  'tmdbLogLevel',
  // Platform Configuration (Auto-post toggles)
  'platformSettings',

];

const VIDEO_BACKEND_KEYS = [
  'videoAgeGateHours',
  'videoBacklogMode',
  'videoFutureOnlySince',
  'allowedRegions',
  'strictRegionMode',
  'allowPremiumGlobalExceptions',
  'excludeDubOnlyImports',
  'trustedSupportingChannels',
  'videoFilterCache',
  'videoFilterTmdbValidation',
  'videoYoutubeSelectedPlaylists',
  'videoTitleCleaningRegex',
  'videoTmdbFallback',
  'videoYoutubeXThumbnailPrompt',
  'videoSocialThumbnailPrompt',
] as const;

const DESIGN_STUDIO_BACKEND_KEYS = [
  'captionPosterPrompt',
  'captionCarouselPrompt',
  'captionStoryPrompt',
  'captionAnnouncementPrompt',
  'captionGeneralPrompt',
  'designStudioPinterestTitlePrompt',
  'designStudioPinterestDescriptionPrompt',
  'designStudioPinterestBoardPrompt',
] as const;

const VIDEO_STUDIO_BACKEND_KEYS = [
  'systemPrompt',
  'captionReviewPrompt',
  'captionReleasesPrompt',
  'captionScenesPrompt',
  'videoStudioPinterestTitlePrompt',
  'videoStudioPinterestDescriptionPrompt',
  'videoStudioPinterestBoardPrompt',
] as const;

const THUMBNAIL_BACKEND_KEYS = [
  'thumbnailConfig_youtube',
  'thumbnailConfig_x',
] as const;

const CLEANUP_BACKEND_KEYS = [
  'cleanupEnabled',
  'cleanupInterval',
  'storageRetention',
  'videoCleanupInterval',
  'videoStorageRetention',
  'imageCleanupInterval',
  'imageStorageRetention',
  'videoStudioCleanupInterval',
  'videoStudioStorageRetention',
  'logsRetention',
  'recentActivityRetention',
] as const;

/**
 * TMDb settings that are not secret, but still need backend persistence
 * so refresh jobs, scheduling, and publishing use the user's actual config.
 */
const TMDB_BACKEND_KEYS = [
  'openaiModel',
  'enableToday',
  'enableWeekly',
  'enableMonthly',
  'enableAnniversaries',
  'anniversaryYears',
  'customAnniversaryYears',
  'anniversaryStartYear',
  'maxPerAnniversary',
  'todayMaxItems',
  'weeklyMaxItems',
  'monthlyMaxItems',
  'anniversaryMaxItems',
  'captionMaxLength',
  'includeCast',
  'includeDate',
  'preferredImage',
  'rehostImages',
  'dedupeWindow',
  'tmdbQueuedRetentionHours',
  'tmdbActivityRetention',
  'tmdbLogLevel',
  'discoveryCacheTTL',
  'creditsCacheTTL',
  'captionCacheTTL',
  'timezone',
  'tmdbDailyRefreshTime',
  'postingWindowStart',
  'postingWindowEnd',
  'minGapBetweenPostsMinutes',
  'preferredGapBetweenSameModuleMinutes',
  'maxPostsPerDayOverall',
  'maxPostsPerModulePerDay',
  'reserveUrgentSlots',
  'weeklyOverflowPolicy',
  'monthlyOverflowPolicy',
  'weeklyRescheduleValidityDays',
  'monthlyRescheduleValidityDays',
  'todayAnniversaryUrgentPriority',
  'interleaveModules',
  'captionRegenOnScheduleChange',
  'movieGenres',
  'tvGenres',
  'selectedGenres',
  'minPopularityThreshold',
  'tmdbRegion',
  'onlyPopular',
  'languageFilter',
  'todayAutoPost',
  'weeklyAutoPost',
  'monthlyAutoPost',
  'anniversaryAutoPost',
  'todayPlatforms',
  'weeklyPlatforms',
  'monthlyPlatforms',
  'anniversaryPlatforms',
  'tmdbCaptionModel',
  'todayPrompt',
  'weeklyPrompt',
  'monthlyPrompt',
  'anniversaryPrompt',
  'todayPinterestTitlePrompt',
  'todayPinterestDescriptionPrompt',
  'todayPinterestBoard',
  'todayPinterestLinkStrategy',
  'weeklyPinterestTitlePrompt',
  'weeklyPinterestDescriptionPrompt',
  'weeklyPinterestBoard',
  'weeklyPinterestLinkStrategy',
  'monthlyPinterestTitlePrompt',
  'monthlyPinterestDescriptionPrompt',
  'monthlyPinterestBoard',
  'monthlyPinterestLinkStrategy',
  'anniversaryPinterestTitlePrompt',
  'anniversaryPinterestDescriptionPrompt',
  'anniversaryPinterestBoard',
  'anniversaryPinterestLinkStrategy',
] as const;

const BACKEND_PERSISTED_KEYS = [
  ...new Set([
    ...SENSITIVE_KEYS,
    ...VIDEO_BACKEND_KEYS,
    ...DESIGN_STUDIO_BACKEND_KEYS,
    ...VIDEO_STUDIO_BACKEND_KEYS,
    ...THUMBNAIL_BACKEND_KEYS,
    ...CLEANUP_BACKEND_KEYS,
    ...TMDB_BACKEND_KEYS,
  ]),
];

/**
 * Non-sensitive settings that can stay in localStorage
 */
const LOCAL_PREFERENCE_KEYS = [
  'darkMode',
  'hapticsEnabled',
  'emailNotifications',
  'pushNotifications',
  'desktopNotifications',
] as const;

export interface SettingsApiResponse {
  success: boolean;
  data?: Settings;
  meta?: {
    changedKeys?: string[];
    notificationTitle?: string;
    notificationMessage?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Fetch all settings from backend
 */
export async function fetchSettings(): Promise<SettingsApiResponse> {
  try {
    const response = await fetch(`${getApiUrl()}/api/settings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      // If backend is offline or returns error, return empty object
      console.warn('[Settings API] Backend unavailable, using local settings');
      return {
        success: false,
        error: {
          code: 'BACKEND_UNAVAILABLE',
          message: 'Backend is not available. Using local settings.',
        },
      };
    }

    const json = await response.json();

    // Backend returns { success: true, data: { ... } }
    if (json.success && json.data) {
      return { success: true, data: json.data };
    }

    // Fallback for direct data response
    return { success: true, data: json };
  } catch (error: any) {
    console.error('[Settings API] Failed to fetch settings:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Failed to connect to backend',
      },
    };
  }
}

/**
 * Save settings to backend
 */
export async function saveSettings(settings: Partial<Settings>): Promise<SettingsApiResponse> {
  try {
    // Separate backend-persisted settings from purely local preferences.
    const backendPersistedSettings = extractBackendPersistedSettings(settings);
    const nonSensitiveSettings = extractNonSensitiveSettings(settings);
    let backendResponseMeta: SettingsApiResponse['meta'];
    let backendResponseData: SettingsApiResponse['data'];

    // Save backend-persisted settings using PUT (backend expects PUT)
    if (Object.keys(backendPersistedSettings).length > 0) {
      const response = await fetch(`${getApiUrl()}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(backendPersistedSettings),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('[Settings API] Failed to save settings:', errorData);
        return {
          success: false,
          error: {
            code: 'SAVE_ERROR',
            message: errorData.message || 'Failed to save settings to backend',
          },
        };
      }

      const json = await response.json().catch(() => ({ success: true }));
      console.log('[Settings API] Settings saved to backend successfully');

      backendResponseData = json.data;
      backendResponseMeta = json.meta;
    }

    // Save non-sensitive settings to localStorage
    if (Object.keys(nonSensitiveSettings).length > 0) {
      const existing = getLocalSettings();
      const updated = { ...existing, ...nonSensitiveSettings };
      const serialized = JSON.stringify(updated);
      localStorage.setItem(LOCAL_SETTINGS_KEY, serialized);
      localStorage.setItem(LEGACY_LOCAL_SETTINGS_KEY, serialized);
    }

    return {
      success: true,
      data: backendResponseData,
      meta: backendResponseMeta,
    };
  } catch (error: any) {
    console.error('[Settings API] Failed to save settings:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Failed to connect to backend',
      },
    };
  }
}

/**
 * Update a single setting
 */
export async function updateSetting(key: string, value: any): Promise<SettingsApiResponse> {
  return saveSettings({ [key]: value } as Partial<Settings>);
}

/**
 * Delete settings (logout/reset)
 */
export async function deleteSettings(): Promise<SettingsApiResponse> {
  try {
    const response = await fetch(`${getApiUrl()}/api/settings`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      console.warn('[Settings API] Failed to delete backend settings');
    }

    // Always clear localStorage
    localStorage.removeItem(LOCAL_SETTINGS_KEY);
    localStorage.removeItem(LEGACY_LOCAL_SETTINGS_KEY);

    return { success: true };
  } catch (error: any) {
    console.error('[Settings API] Failed to delete settings:', error);
    // Even if backend fails, clear localStorage
    localStorage.removeItem(LOCAL_SETTINGS_KEY);
    localStorage.removeItem(LEGACY_LOCAL_SETTINGS_KEY);
    return { success: true };
  }
}

/**
 * Check if backend is available
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiUrl()}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract backend-persisted settings that should go to backend
 */
function extractBackendPersistedSettings(settings: Partial<Settings>): Partial<Settings> {
  const persisted: Partial<Settings> = {};
  for (const key of BACKEND_PERSISTED_KEYS) {
    if (key in settings) {
      (persisted as any)[key] = (settings as any)[key];
    }
  }
  return persisted;
}

/**
 * Extract non-sensitive settings that can stay in localStorage
 */
function extractNonSensitiveSettings(settings: Partial<Settings>): Partial<Settings> {
  const nonSensitive: Partial<Settings> = {};
  for (const key in settings) {
    if (!BACKEND_PERSISTED_KEYS.includes(key)) {
      (nonSensitive as any)[key] = (settings as any)[key];
    }
  }
  return nonSensitive;
}

/**
 * Get local settings from localStorage
 */
function getLocalSettings(): Partial<Settings> {
  try {
    const saved =
      localStorage.getItem(LOCAL_SETTINGS_KEY) ??
      localStorage.getItem(LEGACY_LOCAL_SETTINGS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

import { getAuthHeaders as getStandardAuthHeaders } from './authToken';

/**
 * Get authentication headers for backend API
 */
export function getAuthHeaders(): Record<string, string> {
  return getStandardAuthHeaders();
}

/**
 * Merge backend settings with local settings
 */
export function mergeSettings(
  backendSettings: Partial<Settings>,
  localSettings: Partial<Settings>
): Settings {
  const merged = {
    ...localSettings,
    ...backendSettings,
  } as Partial<Settings>;

  // If the backend copy is blank but the browser still has a real value, prefer
  // the local value so the next save cycle can repopulate backend storage.
  for (const [key, localValue] of Object.entries(localSettings)) {
    const backendValue = backendSettings[key as keyof Settings];
    if (hasMeaningfulValue(localValue) && !hasMeaningfulValue(backendValue)) {
      merged[key as keyof Settings] = localValue as Settings[keyof Settings];
    }
  }

  // Device-local preferences must win over any stale backend copies.
  for (const key of LOCAL_PREFERENCE_KEYS) {
    if (key in localSettings) {
      merged[key] = localSettings[key];
    }
  }

  return merged as Settings;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return true;
}

/**
 * Check if a setting is sensitive
 */
export function isSensitiveSetting(key: string): boolean {
  return SENSITIVE_KEYS.includes(key);
}

/**
 * Mask sensitive value for display
 */
export function maskSensitiveValue(value: string): string {
  if (!value || value === '••••••••••••••••') {
    return '••••••••••••••••';
  }
  // Show first 4 and last 4 characters
  if (value.length > 8) {
    return `${value.slice(0, 4)}••••${value.slice(-4)}`;
  }
  return '••••••••••••••••';
}
