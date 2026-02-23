/**
 * TMDb Settings Service
 * Single source of truth for all TMDb configuration
 * All components must read settings through this service
 */

export type FeedType = 'today' | 'weekly' | 'monthly' | 'anniversary';
export type ImagePreference = 'poster' | 'backdrop' | 'random';

export interface PlatformFlags {
    x: boolean;
    threads: boolean;
    facebook: boolean;
    youtube: boolean;
    pinterest: boolean;
}

export interface TMDbSettings {
    // Caption generation
    tmdbCaptionModel: string;
    captionMaxLength: string;
    includeCast: boolean;
    includeDate: boolean;

    // Feed toggles
    enableToday: boolean;
    enableWeekly: boolean;
    enableMonthly: boolean;
    enableAnniversaries: boolean;

    // Max items per feed
    todayMaxItems: string;
    weeklyMaxItems: string;
    monthlyMaxItems: string;
    anniversaryMaxItems: string;

    // Anniversary settings
    anniversaryYears: string[];
    anniversaryStartYear: string;
    maxPerAnniversary: string;

    // Image preference
    preferredImage: ImagePreference;
    rehostImages: boolean;

    // Auto-post toggles
    todayAutoPost: boolean;
    weeklyAutoPost: boolean;
    monthlyAutoPost: boolean;
    anniversaryAutoPost: boolean;

    // Platform settings per feed
    todayPlatforms: PlatformFlags;
    weeklyPlatforms: PlatformFlags;
    monthlyPlatforms: PlatformFlags;
    anniversaryPlatforms: PlatformFlags;

    // Filtering
    selectedGenres: number[];
    movieGenres: number[];
    tvGenres: number[];
    onlyPopular: boolean;
    languageFilter: string;

    // Cache settings
    dedupeWindow: string;
    discoveryCacheTTL: string;
    creditsCacheTTL: string;
    captionCacheTTL: string;

    // Scheduling
    timezone: string;

    // Caption prompts
    todayPrompt: string;
    weeklyPrompt: string;
    monthlyPrompt: string;
    anniversaryPrompt: string;

    // Pinterest-specific settings
    todayPinterestTitlePrompt: string;
    todayPinterestDescriptionPrompt: string;
    todayPinterestBoard: string;
    todayPinterestLinkStrategy: string;
    weeklyPinterestTitlePrompt: string;
    weeklyPinterestDescriptionPrompt: string;
    weeklyPinterestBoard: string;
    weeklyPinterestLinkStrategy: string;
    monthlyPinterestTitlePrompt: string;
    monthlyPinterestDescriptionPrompt: string;
    monthlyPinterestBoard: string;
    monthlyPinterestLinkStrategy: string;
    anniversaryPinterestTitlePrompt: string;
    anniversaryPinterestDescriptionPrompt: string;
    anniversaryPinterestBoard: string;
    anniversaryPinterestLinkStrategy: string;
}

// Default settings (must match TMDbSettings.tsx defaults)
const defaultSettings: TMDbSettings = {
    tmdbCaptionModel: 'gpt-4o',
    captionMaxLength: '100',
    includeCast: true,
    includeDate: true,
    enableToday: true,
    enableWeekly: true,
    enableMonthly: true,
    enableAnniversaries: true,
    todayMaxItems: '5',
    weeklyMaxItems: '10',
    monthlyMaxItems: '30',
    anniversaryMaxItems: '5',
    anniversaryYears: ['1', '2', '3', '5', '10', '15', '20', '25'],
    anniversaryStartYear: '1995',
    maxPerAnniversary: '2',
    preferredImage: 'poster',
    rehostImages: true,
    todayAutoPost: false,
    weeklyAutoPost: false,
    monthlyAutoPost: false,
    anniversaryAutoPost: false,
    todayPlatforms: { x: true, threads: true, facebook: false, youtube: false, pinterest: false },
    weeklyPlatforms: { x: true, threads: true, facebook: false, youtube: false, pinterest: false },
    monthlyPlatforms: { x: true, threads: true, facebook: false, youtube: false, pinterest: false },
    anniversaryPlatforms: { x: true, threads: false, facebook: false, youtube: false, pinterest: false },
    selectedGenres: [],
    movieGenres: [],
    tvGenres: [],
    onlyPopular: true,
    languageFilter: 'en',
    dedupeWindow: '30',
    discoveryCacheTTL: '12',
    creditsCacheTTL: '30',
    captionCacheTTL: '30',
    timezone: 'Africa/Lagos',
    todayPrompt: '',
    weeklyPrompt: '',
    monthlyPrompt: '',
    anniversaryPrompt: '',
    todayPinterestTitlePrompt: '',
    todayPinterestDescriptionPrompt: '',
    todayPinterestBoard: 'New Releases Today',
    todayPinterestLinkStrategy: 'tmdb',
    weeklyPinterestTitlePrompt: '',
    weeklyPinterestDescriptionPrompt: '',
    weeklyPinterestBoard: 'Coming This Week',
    weeklyPinterestLinkStrategy: 'tmdb',
    monthlyPinterestTitlePrompt: '',
    monthlyPinterestDescriptionPrompt: '',
    monthlyPinterestBoard: 'Coming Next Month',
    monthlyPinterestLinkStrategy: 'tmdb',
    anniversaryPinterestTitlePrompt: '',
    anniversaryPinterestDescriptionPrompt: '',
    anniversaryPinterestBoard: 'Movie & TV Anniversaries',
    anniversaryPinterestLinkStrategy: 'tmdb',
};

const STORAGE_KEY = 'screndly_tmdb_settings';

/**
 * Get all TMDb settings from localStorage
 * Returns merged settings with defaults for any missing values
 */
export function getTMDbSettings(): TMDbSettings {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return { ...defaultSettings, ...parsed };
        }
    } catch (error) {
        console.error('[TMDbSettingsService] Error loading settings:', error);
    }
    return defaultSettings;
}

/**
 * Check if a specific feed type is enabled
 */
export function isFeedEnabled(feedType: FeedType): boolean {
    const settings = getTMDbSettings();
    switch (feedType) {
        case 'today': return settings.enableToday;
        case 'weekly': return settings.enableWeekly;
        case 'monthly': return settings.enableMonthly;
        case 'anniversary': return settings.enableAnniversaries;
        default: return false;
    }
}

/**
 * Get max items limit for a specific feed type
 */
export function getMaxItemsForFeed(feedType: FeedType): number {
    const settings = getTMDbSettings();
    switch (feedType) {
        case 'today': return parseInt(settings.todayMaxItems) || 5;
        case 'weekly': return parseInt(settings.weeklyMaxItems) || 10;
        case 'monthly': return parseInt(settings.monthlyMaxItems) || 30;
        case 'anniversary': return parseInt(settings.anniversaryMaxItems) || 5;
        default: return 5;
    }
}

/**
 * Get the global image preference setting
 */
export function getImagePreference(): ImagePreference {
    const settings = getTMDbSettings();
    return settings.preferredImage || 'poster';
}

/**
 * Check if auto-post is enabled for a specific feed type
 */
export function isAutoPostEnabled(feedType: FeedType): boolean {
    const settings = getTMDbSettings();
    switch (feedType) {
        case 'today': return settings.todayAutoPost;
        case 'weekly': return settings.weeklyAutoPost;
        case 'monthly': return settings.monthlyAutoPost;
        case 'anniversary': return settings.anniversaryAutoPost;
        default: return false;
    }
}

/**
 * Get platform flags for a specific feed type
 */
export function getPlatformsForFeed(feedType: FeedType): PlatformFlags {
    const settings = getTMDbSettings();
    switch (feedType) {
        case 'today': return settings.todayPlatforms;
        case 'weekly': return settings.weeklyPlatforms;
        case 'monthly': return settings.monthlyPlatforms;
        case 'anniversary': return settings.anniversaryPlatforms;
        default: return { x: false, threads: false, facebook: false, youtube: false, pinterest: false };
    }
}

/**
 * Get enabled platform names for a feed type
 */
export function getEnabledPlatforms(feedType: FeedType): string[] {
    const platforms = getPlatformsForFeed(feedType);
    const enabled: string[] = [];
    if (platforms.x) enabled.push('X');
    if (platforms.threads) enabled.push('Threads');
    if (platforms.facebook) enabled.push('Facebook');
    if (platforms.youtube) enabled.push('YouTube');
    if (platforms.pinterest) enabled.push('Pinterest');
    return enabled;
}

/**
 * Get caption prompt for a specific feed type
 */
export function getCaptionPrompt(feedType: FeedType): string {
    const settings = getTMDbSettings();
    switch (feedType) {
        case 'today': return settings.todayPrompt;
        case 'weekly': return settings.weeklyPrompt;
        case 'monthly': return settings.monthlyPrompt;
        case 'anniversary': return settings.anniversaryPrompt;
        default: return '';
    }
}

/**
 * Get the AI model for caption generation
 */
export function getCaptionModel(): string {
    return getTMDbSettings().tmdbCaptionModel || 'gpt-4o';
}

/**
 * Get caption max length
 */
export function getCaptionMaxLength(): number {
    return parseInt(getTMDbSettings().captionMaxLength) || 100;
}

/**
 * Get selected genres for filtering
 */
export function getSelectedGenres(): number[] {
    return getTMDbSettings().selectedGenres || [];
}

/**
 * Get language filter
 */
export function getLanguageFilter(): string {
    return getTMDbSettings().languageFilter || 'en';
}

/**
 * Check if only popular content should be shown
 */
export function isOnlyPopularEnabled(): boolean {
    return getTMDbSettings().onlyPopular !== false;
}

/**
 * Get dedupe window in days
 */
export function getDedupeWindow(): number {
    return parseInt(getTMDbSettings().dedupeWindow) || 30;
}

/**
 * Get timezone setting
 */
export function getTimezone(): string {
    return getTMDbSettings().timezone || 'Africa/Lagos';
}

/**
 * Get anniversary years to check
 */
export function getAnniversaryYears(): number[] {
    const settings = getTMDbSettings();
    return (settings.anniversaryYears || []).map(y => parseInt(y)).filter(y => !isNaN(y));
}

/**
 * Get max items per anniversary milestone
 */
export function getMaxPerAnniversary(): number {
    return parseInt(getTMDbSettings().maxPerAnniversary) || 2;
}

/**
 * Convert settings to backend-compatible format
 */
export function getSettingsForBackend(): Record<string, any> {
    const settings = getTMDbSettings();
    return {
        enableToday: settings.enableToday,
        enableWeekly: settings.enableWeekly,
        enableMonthly: settings.enableMonthly,
        enableAnniversaries: settings.enableAnniversaries,
        todayMaxItems: parseInt(settings.todayMaxItems) || 5,
        weeklyMaxItems: parseInt(settings.weeklyMaxItems) || 10,
        monthlyMaxItems: parseInt(settings.monthlyMaxItems) || 30,
        anniversaryMaxItems: parseInt(settings.anniversaryMaxItems) || 5,
        preferredImage: settings.preferredImage,
        selectedGenres: settings.selectedGenres,
        languageFilter: settings.languageFilter,
        onlyPopular: settings.onlyPopular,
        dedupeWindow: parseInt(settings.dedupeWindow) || 30,
        anniversaryYears: getAnniversaryYears(),
        maxPerAnniversary: getMaxPerAnniversary(),
    };
}
