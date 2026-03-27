/**
 * TMDb Settings Service
 * Single source of truth for all TMDb configuration
 * All components must read settings through this service
 */
import { DEFAULT_MODELS, normalizeAIModelId } from '../ai/models';

export type FeedType = 'today' | 'weekly' | 'monthly' | 'anniversary';
export type LegacyImagePreference = 'poster' | 'backdrop' | 'random';
export type TMDbImagePreference = 'poster' | 'backdrop' | 'poster_backdrop' | 'backdrop_logo';
export type ImagePreference = TMDbImagePreference;

export const TMDB_IMAGE_PREFERENCE_OPTIONS: TMDbImagePreference[] = [
    'poster',
    'backdrop',
    'poster_backdrop',
    'backdrop_logo',
];

const TMDB_IMAGE_PREFERENCE_LABELS: Record<TMDbImagePreference, string> = {
    poster: 'Poster',
    backdrop: 'Backdrop',
    poster_backdrop: 'Poster + Backdrop',
    backdrop_logo: 'Backdrop + Logo',
};

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
    customAnniversaryYears?: string[];
    anniversaryStartYear: string;
    maxPerAnniversary: string;

    // Image preference
    preferredImageTypes: TMDbImagePreference[];
    preferredImage?: LegacyImagePreference;
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
    minPopularityThreshold: number;
    anniversaryMinPopularityThreshold: number;
    tmdbRegion: string;
    languageFilter: string;

    // Cache settings
    dedupeWindow: string;
    tmdbQueuedRetentionHours: string;
    discoveryCacheTTL: string;
    creditsCacheTTL: string;
    captionCacheTTL: string;

    // Scheduling
    timezone: string;
    tmdbDailyRefreshTime: string;
    postingWindowStart: string;
    postingWindowEnd: string;
    minGapBetweenPostsMinutes: string;
    preferredGapBetweenSameModuleMinutes: string;
    maxPostsPerDayOverall: string;
    maxPostsPerModulePerDay: string;
    reserveUrgentSlots: string;
    weeklyOverflowPolicy: 'DROP' | 'HOLD_FOR_REVIEW' | 'RESCHEDULE_WITH_REGEN';
    monthlyOverflowPolicy: 'DROP' | 'HOLD_FOR_REVIEW' | 'RESCHEDULE_WITH_REGEN';
    weeklyRescheduleValidityDays: string;
    monthlyRescheduleValidityDays: string;
    todayAnniversaryUrgentPriority: boolean;
    interleaveModules: boolean;
    captionRegenOnScheduleChange: boolean;

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
    tmdbCaptionModel: DEFAULT_MODELS.tmdb,
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
    customAnniversaryYears: [],
    anniversaryStartYear: '1995',
    maxPerAnniversary: '2',
    preferredImageTypes: ['poster'],
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
    minPopularityThreshold: 1,
    anniversaryMinPopularityThreshold: 1,
    tmdbRegion: 'US',
    languageFilter: 'en',
    dedupeWindow: '30',
    tmdbQueuedRetentionHours: '168',
    discoveryCacheTTL: '12',
    creditsCacheTTL: '30',
    captionCacheTTL: '30',
    timezone: 'Africa/Lagos',
    tmdbDailyRefreshTime: '07:00',
    postingWindowStart: '09:00',
    postingWindowEnd: '21:00',
    minGapBetweenPostsMinutes: '60',
    preferredGapBetweenSameModuleMinutes: '120',
    maxPostsPerDayOverall: '12',
    maxPostsPerModulePerDay: '4',
    reserveUrgentSlots: '2',
    weeklyOverflowPolicy: 'RESCHEDULE_WITH_REGEN',
    monthlyOverflowPolicy: 'RESCHEDULE_WITH_REGEN',
    weeklyRescheduleValidityDays: '2',
    monthlyRescheduleValidityDays: '7',
    todayAnniversaryUrgentPriority: true,
    interleaveModules: true,
    captionRegenOnScheduleChange: true,
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

function normalizePreferredImageTypes(
    preferredImageTypes: unknown,
    legacyPreferredImage?: unknown,
): TMDbImagePreference[] {
    const normalized = Array.isArray(preferredImageTypes)
        ? preferredImageTypes.filter((value): value is TMDbImagePreference =>
            typeof value === 'string' && TMDB_IMAGE_PREFERENCE_OPTIONS.includes(value as TMDbImagePreference)
        )
        : [];

    if (normalized.length > 0) {
        return Array.from(new Set(normalized));
    }

    if (legacyPreferredImage === 'backdrop') {
        return ['backdrop'];
    }

    if (legacyPreferredImage === 'random') {
        return ['poster', 'backdrop'];
    }

    return ['poster'];
}

function normalizeStoredSettings(settings: Partial<TMDbSettings> & Record<string, any>): TMDbSettings {
    const preferredImageTypes = normalizePreferredImageTypes(
        settings.preferredImageTypes,
        settings.preferredImage,
    );

    return {
        ...defaultSettings,
        ...settings,
        preferredImageTypes,
        preferredImage: preferredImageTypes[0] === 'backdrop' ? 'backdrop' : 'poster',
        tmdbCaptionModel: normalizeAIModelId(settings.tmdbCaptionModel, DEFAULT_MODELS.tmdb),
    };
}

/**
 * Get all TMDb settings from localStorage
 * Returns merged settings with defaults for any missing values
 */
export function getTMDbSettings(): TMDbSettings {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return normalizeStoredSettings(parsed);
        }
    } catch (error) {
        console.error('[TMDbSettingsService] Error loading settings:', error);
    }
    return normalizeStoredSettings(defaultSettings);
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
 * Get the global image preference settings
 */
export function getImagePreference(): ImagePreference {
    return getImagePreferences()[0] || 'poster';
}

export function getImagePreferences(): TMDbImagePreference[] {
    const settings = getTMDbSettings();
    return settings.preferredImageTypes.length > 0 ? settings.preferredImageTypes : ['poster'];
}

export function getTMDbImagePreferenceLabel(value: TMDbImagePreference): string {
    return TMDB_IMAGE_PREFERENCE_LABELS[value];
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
    return getTMDbSettings().tmdbCaptionModel || DEFAULT_MODELS.tmdb;
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

export function getTMDbRegion(): string {
    const region = String(getTMDbSettings().tmdbRegion || 'US').trim().toUpperCase();
    return region || 'US';
}

/**
 * Check if only popular content should be shown
 */
export function getMinPopularityThreshold(): number {
    const threshold = Number(getTMDbSettings().minPopularityThreshold);
    return Number.isFinite(threshold) && threshold > 0 ? threshold : 0;
}

export function getAnniversaryMinPopularityThreshold(): number {
    const threshold = Number(getTMDbSettings().anniversaryMinPopularityThreshold);
    return Number.isFinite(threshold) && threshold > 0 ? threshold : 0;
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
    const rawYears = [
        ...(settings.anniversaryYears || []),
        ...(settings.customAnniversaryYears || []),
    ];

    return rawYears
        .map(y => parseInt(y))
        .filter(y => !isNaN(y))
        .filter((year, index, years) => years.indexOf(year) === index);
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
        todayAutoPost: settings.todayAutoPost,
        weeklyAutoPost: settings.weeklyAutoPost,
        monthlyAutoPost: settings.monthlyAutoPost,
        anniversaryAutoPost: settings.anniversaryAutoPost,
        todayMaxItems: parseInt(settings.todayMaxItems) || 5,
        weeklyMaxItems: parseInt(settings.weeklyMaxItems) || 10,
        monthlyMaxItems: parseInt(settings.monthlyMaxItems) || 30,
        anniversaryMaxItems: parseInt(settings.anniversaryMaxItems) || 5,
        preferredImageTypes: settings.preferredImageTypes,
        rehostImages: settings.rehostImages,
        selectedGenres: settings.selectedGenres,
        movieGenres: settings.movieGenres,
        tvGenres: settings.tvGenres,
        languageFilter: settings.languageFilter,
        minPopularityThreshold: getMinPopularityThreshold(),
        anniversaryMinPopularityThreshold: getAnniversaryMinPopularityThreshold(),
        tmdbRegion: getTMDbRegion(),
        dedupeWindow: parseInt(settings.dedupeWindow) || 30,
        tmdbQueuedRetentionHours: parseInt(settings.tmdbQueuedRetentionHours) || 168,
        todayPlatforms: settings.todayPlatforms,
        weeklyPlatforms: settings.weeklyPlatforms,
        monthlyPlatforms: settings.monthlyPlatforms,
        anniversaryPlatforms: settings.anniversaryPlatforms,
        tmdbCaptionModel: settings.tmdbCaptionModel,
        todayPrompt: settings.todayPrompt,
        weeklyPrompt: settings.weeklyPrompt,
        monthlyPrompt: settings.monthlyPrompt,
        anniversaryPrompt: settings.anniversaryPrompt,
        anniversaryYears: getAnniversaryYears(),
        customAnniversaryYears: settings.customAnniversaryYears || [],
        maxPerAnniversary: getMaxPerAnniversary(),
        captionMaxLength: parseInt(settings.captionMaxLength) || 100,
        includeCast: settings.includeCast,
        includeDate: settings.includeDate,
        anniversaryStartYear: settings.anniversaryStartYear,
        discoveryCacheTTL: parseInt(settings.discoveryCacheTTL) || 12,
        creditsCacheTTL: parseInt(settings.creditsCacheTTL) || 30,
        captionCacheTTL: parseInt(settings.captionCacheTTL) || 30,
        tmdbDailyRefreshTime: settings.tmdbDailyRefreshTime,
        postingWindowStart: settings.postingWindowStart,
        postingWindowEnd: settings.postingWindowEnd,
        minGapBetweenPostsMinutes: parseInt(settings.minGapBetweenPostsMinutes) || 60,
        preferredGapBetweenSameModuleMinutes: parseInt(settings.preferredGapBetweenSameModuleMinutes) || 120,
        maxPostsPerDayOverall: parseInt(settings.maxPostsPerDayOverall) || 12,
        maxPostsPerModulePerDay: parseInt(settings.maxPostsPerModulePerDay) || 4,
        reserveUrgentSlots: parseInt(settings.reserveUrgentSlots) || 2,
        weeklyOverflowPolicy: settings.weeklyOverflowPolicy,
        monthlyOverflowPolicy: settings.monthlyOverflowPolicy,
        weeklyRescheduleValidityDays: parseInt(settings.weeklyRescheduleValidityDays) || 2,
        monthlyRescheduleValidityDays: parseInt(settings.monthlyRescheduleValidityDays) || 7,
        todayAnniversaryUrgentPriority: settings.todayAnniversaryUrgentPriority,
        interleaveModules: settings.interleaveModules,
        captionRegenOnScheduleChange: settings.captionRegenOnScheduleChange,
        todayPinterestBoard: settings.todayPinterestBoard,
        todayPinterestLinkStrategy: settings.todayPinterestLinkStrategy,
        todayPinterestTitlePrompt: settings.todayPinterestTitlePrompt,
        todayPinterestDescriptionPrompt: settings.todayPinterestDescriptionPrompt,
        weeklyPinterestBoard: settings.weeklyPinterestBoard,
        weeklyPinterestLinkStrategy: settings.weeklyPinterestLinkStrategy,
        weeklyPinterestTitlePrompt: settings.weeklyPinterestTitlePrompt,
        weeklyPinterestDescriptionPrompt: settings.weeklyPinterestDescriptionPrompt,
        monthlyPinterestBoard: settings.monthlyPinterestBoard,
        monthlyPinterestLinkStrategy: settings.monthlyPinterestLinkStrategy,
        monthlyPinterestTitlePrompt: settings.monthlyPinterestTitlePrompt,
        monthlyPinterestDescriptionPrompt: settings.monthlyPinterestDescriptionPrompt,
        anniversaryPinterestBoard: settings.anniversaryPinterestBoard,
        anniversaryPinterestLinkStrategy: settings.anniversaryPinterestLinkStrategy,
        anniversaryPinterestTitlePrompt: settings.anniversaryPinterestTitlePrompt,
        anniversaryPinterestDescriptionPrompt: settings.anniversaryPinterestDescriptionPrompt,
    };
}
