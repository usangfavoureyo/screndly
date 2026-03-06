// ============================================================================
// SETTINGS API - Secure Backend Communication
// ============================================================================
// Handles API key storage and settings persistence with backend

import type { Settings } from '../../contexts/SettingsContext';

import { getApiUrl } from './config';

/**
 * Sensitive settings that should ONLY be stored on backend
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
  'rssLogLevel',
  // Platform Configuration (Auto-post toggles)
  'platformSettings',

  // TMDb Configuration (Required for Cron Jobs)
  'enableToday', 'enableWeekly', 'enableMonthly', 'enableAnniversaries',
  'todayMaxItems', 'weeklyMaxItems', 'monthlyMaxItems', 'anniversaryMaxItems',
  'preferredImage', 'languageFilter', 'onlyPopular', 'dedupeWindow', 'tmdbQueuedRetentionHours',
];

/**
 * Non-sensitive settings that can stay in localStorage
 */
const LOCAL_KEYS = [
  'darkMode',
  'hapticsEnabled',
  'timezone',
  'emailNotifications',
  'pushNotifications',
  'desktopNotifications',
];
void LOCAL_KEYS.length;

export interface SettingsApiResponse {
  success: boolean;
  data?: Settings;
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
    // Separate sensitive and non-sensitive settings
    const sensitiveSettings = extractSensitiveSettings(settings);
    const nonSensitiveSettings = extractNonSensitiveSettings(settings);

    // Save sensitive settings to backend using PUT (backend expects PUT)
    if (Object.keys(sensitiveSettings).length > 0) {
      const response = await fetch(`${getApiUrl()}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(sensitiveSettings),
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

      console.log('[Settings API] Settings saved to backend successfully');
    }

    // Save non-sensitive settings to localStorage
    if (Object.keys(nonSensitiveSettings).length > 0) {
      const existing = getLocalSettings();
      const updated = { ...existing, ...nonSensitiveSettings };
      localStorage.setItem('screndlySettings', JSON.stringify(updated));
    }

    return { success: true };
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
    localStorage.removeItem('screndlySettings');

    return { success: true };
  } catch (error: any) {
    console.error('[Settings API] Failed to delete settings:', error);
    // Even if backend fails, clear localStorage
    localStorage.removeItem('screndlySettings');
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
 * Extract sensitive settings that should go to backend
 */
function extractSensitiveSettings(settings: Partial<Settings>): Partial<Settings> {
  const sensitive: Partial<Settings> = {};
  for (const key of SENSITIVE_KEYS) {
    if (key in settings) {
      (sensitive as any)[key] = (settings as any)[key];
    }
  }
  return sensitive;
}

/**
 * Extract non-sensitive settings that can stay in localStorage
 */
function extractNonSensitiveSettings(settings: Partial<Settings>): Partial<Settings> {
  const nonSensitive: Partial<Settings> = {};
  for (const key in settings) {
    if (!SENSITIVE_KEYS.includes(key)) {
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
    const saved = localStorage.getItem('screndlySettings');
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
  // Backend settings (API keys) override local
  // Local settings (preferences) fill in gaps
  return {
    ...localSettings,
    ...backendSettings,
  } as Settings;
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
