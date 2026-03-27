import { randomUUID } from 'crypto';
import { env } from '../lib/env';
import prisma from '../lib/prisma';
import { getSecretSetting } from '../lib/settings';
import { trackApiUsage } from './api-usage.service';
import aiService, { generateTMDbCaption, type CaptionContext as AICaptionContext } from './ai.service';
import {
    addCalendarDays,
    addCalendarMonths,
    endOfLocalDay,
    getLocalDateIso,
    parseReleaseDate,
    startOfLocalDay,
} from '../lib/tmdb-date';
import {
    buildCaptionContext,
    evaluateCandidateEligibility,
    getCanonicalKey,
    getCycleKey,
    getLocalAnniversaryMilestone,
    getModuleSource,
    hashCaptionContext,
    mapModuleToTemporalTag,
    scheduleCandidates,
    type CaptionContext,
    type SchedulerSettings,
    type ScheduledCandidate,
    type TMDbCandidate,
    type TMDbModuleType,
    type TMDbOverflowPolicy,
    type TMDbPostStatus,
} from './tmdb-feed.domain';
import { renderTMDbLogoCard } from './rss-logo-render.service';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';
const TMDB_DISCOVER_MAX_PAGES = 3;
const TMDB_DISCOVER_POOL_MULTIPLIER = 3;
const TMDB_DISCOVER_MIN_POOL_SIZE = 8;
const TMDB_THEATRICAL_RELEASE_TYPES = [3, 2] as const;
const NON_NARRATIVE_GENRE_IDS = new Set([99, 10763, 10764, 10767]);
const NON_NARRATIVE_TITLE_PATTERN = /\b(wwe|wrestlemania|smackdown|monday night raw|royal rumble|nxt|ufc|fight night|boxing|stand-up|standup|comedy special|docuseries|docu-series|behind the scenes|aftershow|after show|reunion special)\b/i;

type MediaType = 'movie' | 'tv';
type TMDbImageMode = 'poster' | 'backdrop' | 'poster_backdrop' | 'backdrop_logo';
type TMDbImageAssetType = 'poster' | 'backdrop' | 'logo';

interface TMDbMovie {
    id: number;
    title?: string;
    name?: string;
    release_date?: string;
    first_air_date?: string;
    poster_path: string | null;
    backdrop_path: string | null;
    overview: string;
    popularity: number;
    vote_average: number;
    vote_count: number;
    original_language: string;
    media_type?: string;
}

interface TMDbCredits {
    cast: Array<{ name: string; character: string; order: number }>;
}

interface TMDbDiscoverResponse {
    results: TMDbMovie[];
    page?: number;
    total_pages?: number;
}

interface TMDbDetails {
    production_countries?: Array<{ iso_3166_1: string; name: string }>;
    origin_country?: string[];
    original_language?: string;
    vote_count?: number;
    popularity?: number;
    genres?: Array<{ id: number; name: string }>;
    release_date?: string;
    first_air_date?: string;
}

interface TMDbImagesResponse {
    logos?: Array<{
        file_path?: string | null;
        iso_639_1?: string | null;
        vote_average?: number;
        width?: number;
        height?: number;
    }>;
}

interface TMDbMovieReleaseDatesResponse {
    results?: Array<{
        iso_3166_1: string;
        release_dates?: Array<{
            certification?: string;
            iso_639_1?: string;
            note?: string;
            release_date: string;
            type?: number;
        }>;
    }>;
}

interface SaveTMDbPostResult {
    action: 'created' | 'updated' | 'skipped';
    postId?: string;
}

interface PlatformFlags {
    x?: boolean;
    threads?: boolean;
    facebook?: boolean;
    youtube?: boolean;
    pinterest?: boolean;
}

export interface RefreshSettings {
    enableToday?: boolean;
    enableWeekly?: boolean;
    enableMonthly?: boolean;
    enableAnniversaries?: boolean;
    todayAutoPost?: boolean;
    weeklyAutoPost?: boolean;
    monthlyAutoPost?: boolean;
    anniversaryAutoPost?: boolean;
    todayMaxItems?: number;
    weeklyMaxItems?: number;
    monthlyMaxItems?: number;
    anniversaryMaxItems?: number;
    preferredImage?: 'poster' | 'backdrop' | 'random';
    preferredImageTypes?: TMDbImageMode[];
    selectedGenres?: number[];
    movieGenres?: number[];
    tvGenres?: number[];
    languageFilter?: string;
    tmdbRegion?: string;
    minPopularityThreshold?: number;
    anniversaryMinPopularityThreshold?: number;
    onlyPopular?: boolean;
    dedupeWindow?: number;
    tmdbQueuedRetentionHours?: number;
    anniversaryYears?: Array<string | number>;
    maxPerAnniversary?: number;
    anniversaryStartYear?: string | number;
    captionMaxLength?: number;
    includeCast?: boolean;
    includeDate?: boolean;
    rehostImages?: boolean;
    discoveryCacheTTL?: number;
    creditsCacheTTL?: number;
    captionCacheTTL?: number;
    timezone?: string;
    todayPlatforms?: PlatformFlags;
    weeklyPlatforms?: PlatformFlags;
    monthlyPlatforms?: PlatformFlags;
    anniversaryPlatforms?: PlatformFlags;
    tmdbCaptionModel?: string;
    todayPrompt?: string;
    weeklyPrompt?: string;
    monthlyPrompt?: string;
    anniversaryPrompt?: string;
    todayPinterestTitlePrompt?: string;
    todayPinterestDescriptionPrompt?: string;
    todayPinterestBoard?: string;
    todayPinterestLinkStrategy?: string;
    weeklyPinterestTitlePrompt?: string;
    weeklyPinterestDescriptionPrompt?: string;
    weeklyPinterestBoard?: string;
    weeklyPinterestLinkStrategy?: string;
    monthlyPinterestTitlePrompt?: string;
    monthlyPinterestDescriptionPrompt?: string;
    monthlyPinterestBoard?: string;
    monthlyPinterestLinkStrategy?: string;
    anniversaryPinterestTitlePrompt?: string;
    anniversaryPinterestDescriptionPrompt?: string;
    anniversaryPinterestBoard?: string;
    anniversaryPinterestLinkStrategy?: string;
    tmdbDailyRefreshTime?: string;
    postingWindowStart?: string;
    postingWindowEnd?: string;
    minGapBetweenPostsMinutes?: number;
    preferredGapBetweenSameModuleMinutes?: number;
    maxPostsPerDayOverall?: number;
    maxPostsPerModulePerDay?: number;
    reserveUrgentSlots?: number;
    weeklyOverflowPolicy?: TMDbOverflowPolicy;
    monthlyOverflowPolicy?: TMDbOverflowPolicy;
    weeklyRescheduleValidityDays?: number;
    monthlyRescheduleValidityDays?: number;
    todayAnniversaryUrgentPriority?: boolean;
    interleaveModules?: boolean;
    captionRegenOnScheduleChange?: boolean;
}

const defaultRefreshSettings: RefreshSettings = {
    enableToday: true,
    enableWeekly: true,
    enableMonthly: true,
    enableAnniversaries: true,
    todayAutoPost: false,
    weeklyAutoPost: false,
    monthlyAutoPost: false,
    anniversaryAutoPost: false,
    todayMaxItems: 5,
    weeklyMaxItems: 10,
    monthlyMaxItems: 30,
    anniversaryMaxItems: 5,
    preferredImage: 'poster',
    preferredImageTypes: ['poster'],
    selectedGenres: [],
    movieGenres: [],
    tvGenres: [],
    languageFilter: 'en',
    tmdbRegion: 'US',
    minPopularityThreshold: 1,
    anniversaryMinPopularityThreshold: 1,
    onlyPopular: true,
    dedupeWindow: 30,
    tmdbQueuedRetentionHours: 168,
    timezone: 'Africa/Lagos',
    todayPlatforms: { x: true, threads: true, facebook: false, youtube: false, pinterest: false },
    weeklyPlatforms: { x: true, threads: true, facebook: false, youtube: false, pinterest: false },
    monthlyPlatforms: { x: true, threads: true, facebook: false, youtube: false, pinterest: false },
    anniversaryPlatforms: { x: true, threads: false, facebook: false, youtube: false, pinterest: false },
    tmdbDailyRefreshTime: '07:00',
    postingWindowStart: '09:00',
    postingWindowEnd: '21:00',
    minGapBetweenPostsMinutes: 60,
    preferredGapBetweenSameModuleMinutes: 120,
    maxPostsPerDayOverall: 12,
    maxPostsPerModulePerDay: 4,
    reserveUrgentSlots: 2,
    weeklyOverflowPolicy: 'RESCHEDULE_WITH_REGEN',
    monthlyOverflowPolicy: 'RESCHEDULE_WITH_REGEN',
    weeklyRescheduleValidityDays: 2,
    monthlyRescheduleValidityDays: 7,
    todayAnniversaryUrgentPriority: true,
    interleaveModules: true,
    captionRegenOnScheduleChange: true,
};

const UNIFIED_GENRE_MAP: Record<number, { movieId: number | null; tvId: number | null }> = {
    28: { movieId: 28, tvId: 10759 },
    12: { movieId: 12, tvId: 10759 },
    16: { movieId: 16, tvId: 16 },
    35: { movieId: 35, tvId: 35 },
    80: { movieId: 80, tvId: 80 },
    99: { movieId: 99, tvId: 99 },
    18: { movieId: 18, tvId: 18 },
    10751: { movieId: 10751, tvId: 10751 },
    14: { movieId: 14, tvId: 10765 },
    36: { movieId: 36, tvId: null },
    27: { movieId: 27, tvId: null },
    10762: { movieId: null, tvId: 10762 },
    10402: { movieId: 10402, tvId: null },
    9648: { movieId: 9648, tvId: 9648 },
    10763: { movieId: null, tvId: 10763 },
    10764: { movieId: null, tvId: 10764 },
    10749: { movieId: 10749, tvId: null },
    878: { movieId: 878, tvId: 10765 },
    10766: { movieId: null, tvId: 10766 },
    10767: { movieId: null, tvId: 10767 },
    53: { movieId: 53, tvId: null },
    10770: { movieId: 10770, tvId: null },
    10752: { movieId: 10752, tvId: 10768 },
    37: { movieId: 37, tvId: 37 },
};

function uniqueNumbers(values: Array<number | null | undefined>): number[] {
    return [...new Set(values.filter((value): value is number => typeof value === 'number' && !Number.isNaN(value)))];
}

function getTimezone(config: RefreshSettings): string {
    return config.timezone || defaultRefreshSettings.timezone || 'Africa/Lagos';
}

function getRequestedItemCount(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(1, Math.floor(value));
}

function getCandidatePoolSize(targetCount: number): number {
    return Math.max(TMDB_DISCOVER_MIN_POOL_SIZE, targetCount * TMDB_DISCOVER_POOL_MULTIPLIER);
}

function getLanguageFilter(config: RefreshSettings): string | undefined {
    const value = config.languageFilter?.trim().toLowerCase();
    if (!value || value === 'all') {
        return undefined;
    }

    return value;
}

function getRegionFilter(config: RefreshSettings): string | undefined {
    const value = config.tmdbRegion?.trim().toUpperCase();
    if (!value || value === 'ALL') {
        return undefined;
    }

    return value;
}

function getGenreIdsForMedia(config: RefreshSettings, mediaType: MediaType): number[] {
    const explicitGenres = mediaType === 'movie' ? (config.movieGenres || []) : (config.tvGenres || []);
    const mappedUnifiedGenres = (config.selectedGenres || []).map((genreId) => {
        const mapping = UNIFIED_GENRE_MAP[genreId];
        if (!mapping) {
            return genreId;
        }

        return mediaType === 'movie' ? mapping.movieId : mapping.tvId;
    });

    return uniqueNumbers([...explicitGenres, ...mappedUnifiedGenres]);
}

function applyCommonDiscoverFilters(params: Record<string, string>, mediaType: MediaType, config: RefreshSettings) {
    const language = getLanguageFilter(config);
    if (language) {
        params.with_original_language = language;
    }

    const genreIds = getGenreIdsForMedia(config, mediaType);
    if (genreIds.length > 0) {
        params.with_genres = genreIds.join(',');
    }

    if (config.onlyPopular !== false) {
        params['vote_count.gte'] = '10';
    }
}

export async function getTmdbApiKey(): Promise<string | null> {
    if (env.TMDB_API_KEY) {
        return env.TMDB_API_KEY;
    }

    const modernKey = await getSecretSetting('tmdbKey');
    if (modernKey) {
        return modernKey;
    }

    return getSecretSetting('tmdbApiKey');
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const apiKey = await getTmdbApiKey();
    if (!apiKey) {
        throw new Error('TMDb API key not configured');
    }

    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', apiKey);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });

    let tracked = false;

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            await trackApiUsage({ service: 'tmdb', endpoint, success: false });
            tracked = true;
            throw new Error(`TMDb API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as T;
        await trackApiUsage({ service: 'tmdb', endpoint, success: true });
        tracked = true;
        return data;
    } catch (error) {
        if (!tracked) {
            await trackApiUsage({ service: 'tmdb', endpoint, success: false });
        }

        throw error;
    }
}

export async function fetchTrendingMovies(timeWindow: 'day' | 'week' = 'day'): Promise<TMDbMovie[]> {
    const data = await tmdbFetch<{ results: TMDbMovie[] }>(`/trending/movie/${timeWindow}`);
    return data.results.slice(0, 10);
}

export async function fetchTrendingTV(timeWindow: 'day' | 'week' = 'day'): Promise<TMDbMovie[]> {
    const data = await tmdbFetch<{ results: TMDbMovie[] }>(`/trending/tv/${timeWindow}`);
    return data.results.slice(0, 10);
}

export async function fetchUpcomingMovies(): Promise<TMDbMovie[]> {
    const data = await tmdbFetch<{ results: TMDbMovie[] }>('/movie/upcoming', { region: 'US' });
    return data.results.slice(0, 10);
}

async function fetchMovieCredits(movieId: number): Promise<string[]> {
    try {
        const data = await tmdbFetch<TMDbCredits>(`/movie/${movieId}/credits`);
        return data.cast.slice(0, 5).map((castMember) => castMember.name);
    } catch {
        return [];
    }
}

async function fetchTVCredits(tvId: number): Promise<string[]> {
    try {
        const data = await tmdbFetch<TMDbCredits>(`/tv/${tvId}/credits`);
        return data.cast.slice(0, 5).map((castMember) => castMember.name);
    } catch {
        return [];
    }
}

async function fetchMovieDetails(id: number): Promise<TMDbDetails | null> {
    try {
        return await tmdbFetch<TMDbDetails>(`/movie/${id}`);
    } catch {
        return null;
    }
}

async function fetchTVDetails(id: number): Promise<TMDbDetails | null> {
    try {
        return await tmdbFetch<TMDbDetails>(`/tv/${id}`);
    } catch {
        return null;
    }
}

async function fetchMovieReleaseDates(id: number): Promise<TMDbMovieReleaseDatesResponse | null> {
    try {
        return await tmdbFetch<TMDbMovieReleaseDatesResponse>(`/movie/${id}/release_dates`);
    } catch {
        return null;
    }
}

function getMovieReleaseDateForRegion(
    payload: TMDbMovieReleaseDatesResponse | null,
    region: string,
    preferredTypes: readonly number[] = TMDB_THEATRICAL_RELEASE_TYPES,
): string | null {
    if (!payload?.results) {
        return null;
    }

    const match = payload.results.find((entry) => entry.iso_3166_1 === region);
    if (!match?.release_dates?.length) {
        return null;
    }

    const datedEntries = match.release_dates
        .filter((entry) => !preferredTypes.length || preferredTypes.includes(entry.type || 0))
        .map((entry) => entry.release_date)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());

    return datedEntries[0] || null;
}

function appendUniqueCandidates(target: TMDbMovie[], candidates: TMDbMovie[], limit?: number) {
    const seenIds = new Set(target.map((item) => item.id));

    for (const candidate of candidates) {
        if (seenIds.has(candidate.id)) {
            continue;
        }

        target.push(candidate);
        seenIds.add(candidate.id);

        if (limit && target.length >= limit) {
            break;
        }
    }
}

async function fetchDiscoverCandidatePool(
    endpoint: string,
    params: Record<string, string>,
    targetCount: number,
): Promise<TMDbMovie[]> {
    const candidates: TMDbMovie[] = [];
    const poolSize = getCandidatePoolSize(targetCount);
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= TMDB_DISCOVER_MAX_PAGES && candidates.length < poolSize) {
        const data = await tmdbFetch<TMDbDiscoverResponse>(endpoint, {
            ...params,
            page: String(page),
        });

        totalPages = Math.max(1, data.total_pages || 1);
        appendUniqueCandidates(candidates, data.results || [], poolSize);
        page += 1;
    }

    return candidates;
}

function buildExactDateParams(dateIso: string, mediaType: MediaType, config: RefreshSettings): Record<string, string> {
    const region = mediaType === 'movie' ? getRegionFilter(config) : undefined;

    const params: Record<string, string> = mediaType === 'movie'
        ? region
            ? {
                region,
                with_release_type: TMDB_THEATRICAL_RELEASE_TYPES.join('|'),
                'release_date.gte': dateIso,
                'release_date.lte': dateIso,
                sort_by: 'popularity.desc',
            }
            : {
                'primary_release_date.gte': dateIso,
                'primary_release_date.lte': dateIso,
                sort_by: 'popularity.desc',
            }
        : {
            'first_air_date.gte': dateIso,
            'first_air_date.lte': dateIso,
            sort_by: 'popularity.desc',
        };

    applyCommonDiscoverFilters(params, mediaType, config);
    return params;
}

async function fetchModuleCandidates(moduleType: TMDbModuleType, mediaType: MediaType, config: RefreshSettings, now: Date): Promise<TMDbMovie[]> {
    const timezone = getTimezone(config);
    const targetDate = moduleType === 'today'
        ? now
        : moduleType === 'weekly'
            ? addCalendarDays(now, 7, timezone)
            : addCalendarMonths(now, 1, timezone);

    const targetDateIso = getLocalDateIso(targetDate, timezone);
    const targetCount = getRequestedItemCount(
        moduleType === 'today'
            ? config.todayMaxItems
            : moduleType === 'weekly'
                ? config.weeklyMaxItems
                : config.monthlyMaxItems,
        moduleType === 'today' ? 5 : moduleType === 'weekly' ? 10 : 30,
    );

    return fetchDiscoverCandidatePool(
        mediaType === 'movie' ? '/discover/movie' : '/discover/tv',
        buildExactDateParams(targetDateIso, mediaType, config),
        targetCount,
    );
}

async function fetchAnniversaryCandidates(mediaType: MediaType, config: RefreshSettings, now: Date): Promise<TMDbMovie[]> {
    const timezone = getTimezone(config);
    const todayIso = getLocalDateIso(now, timezone);
    const [, currentMonth, currentDay] = todayIso.split('-');
    const milestones = (config.anniversaryYears || [10, 20, 25, 30, 40, 50])
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isFinite(value) && value > 0);
    const targetCount = getRequestedItemCount(config.anniversaryMaxItems, 5);
    const perYearTarget = getRequestedItemCount(config.maxPerAnniversary, 2);
    const overallPoolLimit = getCandidatePoolSize(targetCount);
    const candidates: TMDbMovie[] = [];

    for (const years of milestones) {
        const targetYear = Number(todayIso.slice(0, 4)) - years;
        const exactDate = `${targetYear}-${currentMonth}-${currentDay}`;
        const params: Record<string, string> = mediaType === 'movie'
            ? {
                'primary_release_date.gte': exactDate,
                'primary_release_date.lte': exactDate,
                sort_by: 'popularity.desc',
            }
            : {
                'first_air_date.gte': exactDate,
                'first_air_date.lte': exactDate,
                sort_by: 'popularity.desc',
            };

        applyCommonDiscoverFilters(params, mediaType, config);
        const yearCandidates = await fetchDiscoverCandidatePool(
            mediaType === 'movie' ? '/discover/movie' : '/discover/tv',
            params,
            perYearTarget,
        );

        appendUniqueCandidates(candidates, yearCandidates, overallPoolLimit);
        if (candidates.length >= overallPoolLimit) {
            break;
        }
    }

    return candidates;
}

function getPopularityThreshold(config: RefreshSettings, moduleType: TMDbModuleType): number | null {
    const configuredThreshold = moduleType === 'anniversary'
        ? config.anniversaryMinPopularityThreshold
        : config.minPopularityThreshold;

    if (typeof configuredThreshold === 'number' && Number.isFinite(configuredThreshold)) {
        return configuredThreshold > 0 ? configuredThreshold : null;
    }

    if (config.onlyPopular === false) {
        return null;
    }

    return 1;
}

async function validateCandidate(
    candidate: TMDbMovie,
    mediaType: MediaType,
    moduleType: TMDbModuleType,
    config: RefreshSettings,
    now: Date,
): Promise<{ valid: boolean; reason?: string; releaseDate?: Date; originalReleaseDate?: Date | null; details?: TMDbDetails; genres?: string[] }> {
    const title = candidate.title || candidate.name || 'Unknown';
    const requiredLanguage = getLanguageFilter(config);
    if (requiredLanguage && candidate.original_language !== requiredLanguage) {
        return { valid: false, reason: `REJECT_LANGUAGE (${candidate.original_language})` };
    }

    const popularityThreshold = getPopularityThreshold(config, moduleType);
    if (popularityThreshold !== null && candidate.popularity < popularityThreshold) {
        return { valid: false, reason: `REJECT_POPULARITY (${candidate.popularity.toFixed(1)} < ${popularityThreshold})` };
    }

    const details = mediaType === 'movie' ? await fetchMovieDetails(candidate.id) : await fetchTVDetails(candidate.id);
    if (!details) {
        return { valid: false, reason: 'REJECT_FETCH_ERROR' };
    }

    const region = getRegionFilter(config);
    let releaseDateValue = details.release_date || candidate.release_date || details.first_air_date || candidate.first_air_date;
    if (mediaType === 'movie' && region) {
        const releaseDates = await fetchMovieReleaseDates(candidate.id);
        const regionalReleaseDate = getMovieReleaseDateForRegion(releaseDates, region);
        if (!regionalReleaseDate) {
            return { valid: false, reason: `REJECT_REGION_RELEASE_DATE (${region})` };
        }

        releaseDateValue = regionalReleaseDate;
    }

    const releaseDate = parseReleaseDate(releaseDateValue);
    if (!releaseDate) {
        return { valid: false, reason: 'REJECT_RELEASE_DATE' };
    }

    const eligibility = evaluateCandidateEligibility(
        moduleType,
        releaseDate,
        now,
        getTimezone(config),
        (config.anniversaryYears || []).map((value) => Number.parseInt(String(value), 10)).filter((value) => Number.isFinite(value)),
    );

    if (!eligibility.eligible) {
        return { valid: false, reason: eligibility.reason };
    }

    const countryCodes = new Set<string>();
    (details.production_countries || []).forEach((country) => {
        if (country.iso_3166_1) countryCodes.add(country.iso_3166_1);
    });
    (details.origin_country || []).forEach((country) => {
        if (country) countryCodes.add(country);
    });

    if (region && countryCodes.size > 0 && !countryCodes.has(region)) {
        return { valid: false, reason: `REJECT_COUNTRY (${region})` };
    }

    const genres = (details.genres || []).map((genre) => genre.name);
    const genreIds = new Set((details.genres || []).map((genre) => genre.id));
    const blockedGenres = Array.from(genreIds).filter((genreId) => NON_NARRATIVE_GENRE_IDS.has(genreId));
    if (blockedGenres.length > 0) {
        return { valid: false, reason: `REJECT_NON_NARRATIVE_GENRE (${blockedGenres.join(', ')})` };
    }

    const narrativeText = `${title}\n${candidate.overview || ''}`;
    if (NON_NARRATIVE_TITLE_PATTERN.test(narrativeText)) {
        return { valid: false, reason: 'REJECT_NON_NARRATIVE_TITLE' };
    }

    try {
        const aiResult = await aiService.validateTMDbContent(
            title,
            candidate.overview,
            genres,
            details.original_language || candidate.original_language,
            (details.production_countries || []).map((country) => country.name),
            'flash-3',
        );

        if (!aiResult.isValid) {
            return { valid: false, reason: `REJECT_AI_VETO (${aiResult.reasoning})` };
        }
    } catch {
        // Fail open if AI validation is unavailable.
    }

    return {
        valid: true,
        releaseDate,
        originalReleaseDate: releaseDate,
        details,
        genres,
    };
}

function getPlatformsForModule(moduleType: TMDbModuleType, config: RefreshSettings): string[] {
    const platformConfig = moduleType === 'today'
        ? config.todayPlatforms
        : moduleType === 'weekly'
            ? config.weeklyPlatforms
            : moduleType === 'monthly'
                ? config.monthlyPlatforms
                : config.anniversaryPlatforms;

    if (!platformConfig) {
        return [];
    }

    const platforms: string[] = [];
    if (platformConfig.x) platforms.push('X');
    if (platformConfig.threads) platforms.push('Threads');
    if (platformConfig.facebook) platforms.push('Facebook');
    if (platformConfig.youtube) platforms.push('YouTube');
    if (platformConfig.pinterest) platforms.push('Pinterest');
    return platforms;
}

function normalizePreferredImageModes(config: RefreshSettings): TMDbImageMode[] {
    const preferredImageTypes = Array.isArray(config.preferredImageTypes)
        ? config.preferredImageTypes.filter((value): value is TMDbImageMode =>
            value === 'poster' ||
            value === 'backdrop' ||
            value === 'poster_backdrop' ||
            value === 'backdrop_logo'
        )
        : [];

    if (preferredImageTypes.length > 0) {
        return [...new Set(preferredImageTypes)];
    }

    if (config.preferredImage === 'backdrop') {
        return ['backdrop'];
    }

    if (config.preferredImage === 'random') {
        return ['poster', 'backdrop'];
    }

    return ['poster'];
}

function buildTMDbImageUrl(path: string | null | undefined): string {
    return path ? `${TMDB_IMAGE_BASE}${path}` : '';
}

async function fetchBestLogoUrl(mediaType: MediaType, tmdbId: number): Promise<string> {
    try {
        const details = await tmdbFetch<TMDbImagesResponse>(
            `/${mediaType === 'movie' ? 'movie' : 'tv'}/${tmdbId}/images`,
            { include_image_language: 'en,null' },
        );
        const logos = (details.logos || []).filter((logo) => typeof logo.file_path === 'string' && logo.file_path.length > 0);
        if (logos.length === 0) {
            return '';
        }

        logos.sort((left, right) => {
            const leftLanguage = left.iso_639_1 === 'en' ? 1 : left.iso_639_1 === null ? 0.5 : 0;
            const rightLanguage = right.iso_639_1 === 'en' ? 1 : right.iso_639_1 === null ? 0.5 : 0;
            if (leftLanguage !== rightLanguage) {
                return rightLanguage - leftLanguage;
            }

            const leftScore = (left.vote_average || 0) + (((left.width || 0) * (left.height || 0)) / 1_000_000);
            const rightScore = (right.vote_average || 0) + (((right.width || 0) * (right.height || 0)) / 1_000_000);
            return rightScore - leftScore;
        });

        return buildTMDbImageUrl(logos[0]?.file_path);
    } catch (error) {
        console.warn(`[TMDb] Failed to fetch logo for ${mediaType}:${tmdbId}`, error);
        return '';
    }
}

async function selectImages(candidate: TMDbCandidate, config: RefreshSettings) {
    const poster = candidate.posterPath ? `${TMDB_IMAGE_BASE}${candidate.posterPath}` : '';
    const backdrop = candidate.backdropPath ? `${TMDB_IMAGE_BASE}${candidate.backdropPath}` : '';
    const selectedModes = normalizePreferredImageModes(config);
    const selectedMode = selectedModes[Math.floor(Math.random() * selectedModes.length)] || 'poster';

    const makeSelection = (images: Array<{ imageUrl: string; imageType: TMDbImageAssetType }>) => {
        const filtered = images.filter((image) => Boolean(image.imageUrl));
        const primary = filtered[0] || { imageUrl: '', imageType: 'poster' as const };
        return {
            selectedMode,
            imageUrl: primary.imageUrl,
            imageType: primary.imageType,
            imageUrls: filtered.map((image) => image.imageUrl),
            imageTypes: filtered.map((image) => image.imageType),
        };
    };

    if (selectedMode === 'backdrop') {
        return makeSelection([
            { imageUrl: backdrop || poster, imageType: backdrop ? 'backdrop' : 'poster' },
        ]);
    }

    if (selectedMode === 'poster_backdrop') {
        return makeSelection([
            { imageUrl: poster || backdrop, imageType: poster ? 'poster' : 'backdrop' },
            ...(poster && backdrop ? [{ imageUrl: backdrop, imageType: 'backdrop' as const }] : []),
        ]);
    }

    if (selectedMode === 'backdrop_logo') {
        const logoUrl = await fetchBestLogoUrl(candidate.mediaType, candidate.tmdbId);
        let renderedLogoUrl = '';

        if (logoUrl) {
            try {
                renderedLogoUrl = await renderTMDbLogoCard(logoUrl, 'brand_backdrop');
            } catch (error) {
                console.warn(`[TMDb] Failed to render logo card for ${candidate.mediaType}:${candidate.tmdbId}`, error);
            }
        }

        return makeSelection([
            { imageUrl: backdrop || poster, imageType: backdrop ? 'backdrop' : 'poster' },
            ...(renderedLogoUrl ? [{ imageUrl: renderedLogoUrl, imageType: 'logo' as const }] : []),
        ]);
    }

    return makeSelection([
        { imageUrl: poster || backdrop, imageType: poster ? 'poster' : 'backdrop' },
    ]);
}

function buildAICaptionContext(candidate: TMDbCandidate, context: CaptionContext, config: RefreshSettings): AICaptionContext {
    return {
        title: candidate.title,
        mediaType: candidate.mediaType,
        temporalTag: mapModuleToTemporalTag(context),
        daysUntil: context.exactDayDelta,
        releaseDate: config.includeDate === false ? undefined : context.releaseDate,
        year: candidate.releaseDate.getUTCFullYear(),
        anniversaryYears: candidate.anniversaryMilestone || undefined,
        cast: config.includeCast === false ? [] : candidate.cast.slice(0, 3),
        genres: candidate.genres,
        tone: 'mainstream_hype',
    };
}

function buildPromptForModule(moduleType: TMDbModuleType, config: RefreshSettings): string | undefined {
    switch (moduleType) {
        case 'today':
            return config.todayPrompt;
        case 'weekly':
            return config.weeklyPrompt;
        case 'monthly':
            return config.monthlyPrompt;
        case 'anniversary':
            return config.anniversaryPrompt;
    }
}

async function generateCaptionForCandidate(
    candidate: TMDbCandidate,
    context: CaptionContext,
    config: RefreshSettings,
): Promise<string> {
    try {
        return await generateTMDbCaption(
            buildAICaptionContext(candidate, context, config),
            (config.tmdbCaptionModel || 'gpt-5-mini') as any,
            buildPromptForModule(candidate.moduleType, config),
        );
    } catch {
        if (context.timingMode === 'release_today') {
            return `${candidate.title} releases today.`;
        }

        if (context.timingMode === 'exact_d_plus_7') {
            return `${candidate.title} releases in one week.`;
        }

        if (context.timingMode === 'exact_calendar_month_plus_1') {
            return `${candidate.title} arrives ${context.formattedReleaseDate}.`;
        }

        if (context.timingMode === 'anniversary_today' && candidate.anniversaryMilestone) {
            return `${candidate.title} celebrates its ${candidate.anniversaryMilestone}th anniversary today.`;
        }

        if (context.exactDayDelta > 0) {
            return `${candidate.title} arrives in ${context.exactDayDelta} days.`;
        }

        return `${candidate.title} arrives ${context.formattedReleaseDate}.`;
    }
}

async function upsertFeedHistory(
    candidate: TMDbCandidate,
    runId: string,
    status: 'fetched' | 'scheduled' | 'dispatched' | 'published' | 'skipped' | 'unscheduled',
    reason: string | null,
    timezone: string,
    scheduledAt?: Date | null,
    dispatchedAt?: Date | null,
    publishedAt?: Date | null,
) {
    const canonicalKey = getCanonicalKey(candidate.mediaType, candidate.tmdbId);
    const cycleKey = getCycleKey(candidate, timezone);

    return prisma.releaseFeedHistory.upsert({
        where: { cycleKey },
        create: {
            provider: 'tmdb',
            moduleType: candidate.moduleType,
            mediaType: candidate.mediaType,
            tmdbId: candidate.tmdbId,
            canonicalKey,
            cycleKey,
            title: candidate.title,
            releaseDate: candidate.releaseDate,
            originalReleaseDate: candidate.originalReleaseDate || null,
            anniversaryMilestone: candidate.anniversaryMilestone || null,
            firstFetchedAt: new Date(),
            lastSeenAt: new Date(),
            scheduledAt: scheduledAt || null,
            dispatchedAt: dispatchedAt || null,
            publishedAt: publishedAt || null,
            status,
            skipReason: reason,
            runId,
        },
        update: {
            title: candidate.title,
            lastSeenAt: new Date(),
            scheduledAt: scheduledAt || undefined,
            dispatchedAt: dispatchedAt || undefined,
            publishedAt: publishedAt || undefined,
            status,
            skipReason: reason,
            runId,
        },
    });
}

async function loadConsumedCycleKeys(candidates: TMDbCandidate[], timezone: string) {
    const cycleKeys = candidates.map((candidate) => getCycleKey(candidate, timezone));
    const existing = await prisma.releaseFeedHistory.findMany({
        where: {
            cycleKey: { in: cycleKeys },
            status: { in: ['fetched', 'scheduled', 'dispatched', 'published', 'skipped', 'unscheduled'] },
        },
        select: { cycleKey: true },
    });

    return new Set(existing.map((item) => item.cycleKey));
}

async function getExistingScheduledTimes(dayStart: Date, dayEnd: Date) {
    const scheduledPosts = await prisma.tMDbPost.findMany({
        where: {
            status: { in: ['scheduled', 'dispatched'] },
            scheduledTime: {
                gte: dayStart,
                lte: dayEnd,
            },
        },
        select: { scheduledTime: true },
        orderBy: { scheduledTime: 'asc' },
    });

    return scheduledPosts.map((post) => post.scheduledTime);
}

async function saveTMDbPost(
    scheduled: ScheduledCandidate,
    config: RefreshSettings,
    runId: string,
    timezone: string,
    autoPost: boolean,
): Promise<SaveTMDbPostResult> {
    const { candidate, captionContext } = scheduled;
    const { imageUrl, imageType, imageUrls, imageTypes } = await selectImages(candidate, config);
    const existing = await prisma.tMDbPost.findFirst({
        where: {
            tmdbId: candidate.tmdbId,
            mediaType: candidate.mediaType,
            moduleType: candidate.moduleType,
            releaseDate: candidate.releaseDate,
        },
        orderBy: { createdAt: 'desc' },
    });

    const scheduledTime = scheduled.scheduledAt || new Date();
    const caption = captionContext ? await generateCaptionForCandidate(candidate, captionContext, config) : `${candidate.title} arrives soon.`;
    const payload = {
        tmdbId: candidate.tmdbId,
        mediaType: candidate.mediaType,
        moduleType: candidate.moduleType,
        title: candidate.title,
        year: candidate.releaseDate.getUTCFullYear(),
        releaseDate: candidate.releaseDate,
        caption,
        imageUrl,
        imageType,
        imageUrls,
        imageTypes,
        scheduledTime,
        source: candidate.source,
        cast: candidate.cast,
        popularity: candidate.popularity || 0,
        platforms: candidate.platforms,
        status: (scheduled.status === 'scheduled' && !autoPost ? 'queued' : scheduled.status) as TMDbPostStatus,
        runId,
        captionContextHash: scheduled.captionContextHash || null,
        overflowPolicy: scheduled.overflowPolicy || null,
        overflowExpiresAt: scheduled.overflowExpiresAt || null,
        unscheduledReason: scheduled.status === 'unscheduled' ? scheduled.reason : null,
        errorMessage: scheduled.status === 'unscheduled' ? scheduled.reason : null,
    };

    if (existing) {
        await prisma.tMDbPost.update({
            where: { id: existing.id },
            data: payload,
        });
        return { action: 'updated', postId: existing.id };
    }

    const created = await prisma.tMDbPost.create({ data: payload });
    return { action: 'created', postId: created.id };
}

function getSchedulerSettings(config: RefreshSettings): SchedulerSettings {
    return {
        postingWindowStart: config.postingWindowStart || defaultRefreshSettings.postingWindowStart || '09:00',
        postingWindowEnd: config.postingWindowEnd || defaultRefreshSettings.postingWindowEnd || '21:00',
        minGapBetweenPostsMinutes: config.minGapBetweenPostsMinutes || defaultRefreshSettings.minGapBetweenPostsMinutes || 60,
        preferredGapBetweenSameModuleMinutes: config.preferredGapBetweenSameModuleMinutes || defaultRefreshSettings.preferredGapBetweenSameModuleMinutes || 120,
        maxPostsPerDayOverall: config.maxPostsPerDayOverall || defaultRefreshSettings.maxPostsPerDayOverall || 12,
        maxPostsPerModulePerDay: config.maxPostsPerModulePerDay || defaultRefreshSettings.maxPostsPerModulePerDay || 4,
        reserveUrgentSlots: config.reserveUrgentSlots || defaultRefreshSettings.reserveUrgentSlots || 2,
        weeklyOverflowPolicy: config.weeklyOverflowPolicy || defaultRefreshSettings.weeklyOverflowPolicy || 'RESCHEDULE_WITH_REGEN',
        monthlyOverflowPolicy: config.monthlyOverflowPolicy || defaultRefreshSettings.monthlyOverflowPolicy || 'RESCHEDULE_WITH_REGEN',
        weeklyRescheduleValidityDays: config.weeklyRescheduleValidityDays || defaultRefreshSettings.weeklyRescheduleValidityDays || 2,
        monthlyRescheduleValidityDays: config.monthlyRescheduleValidityDays || defaultRefreshSettings.monthlyRescheduleValidityDays || 7,
        interleaveModules: config.interleaveModules ?? defaultRefreshSettings.interleaveModules ?? true,
    };
}

async function collectCandidates(config: RefreshSettings, now: Date): Promise<TMDbCandidate[]> {
    const candidates: TMDbCandidate[] = [];
    const modules: TMDbModuleType[] = [];
    if (config.enableToday) modules.push('today');
    if (config.enableWeekly) modules.push('weekly');
    if (config.enableMonthly) modules.push('monthly');
    if (config.enableAnniversaries) modules.push('anniversary');

    for (const moduleType of modules) {
        for (const mediaType of ['movie', 'tv'] as const) {
            const rawCandidates = moduleType === 'anniversary'
                ? await fetchAnniversaryCandidates(mediaType, config, now)
                : await fetchModuleCandidates(moduleType, mediaType, config, now);

            for (const raw of rawCandidates) {
                const validation = await validateCandidate(raw, mediaType, moduleType, config, now);
                if (!validation.valid || !validation.releaseDate) {
                    continue;
                }

                const cast = mediaType === 'movie'
                    ? await fetchMovieCredits(raw.id)
                    : await fetchTVCredits(raw.id);

                candidates.push({
                    provider: 'tmdb',
                    moduleType,
                    mediaType,
                    tmdbId: raw.id,
                    title: raw.title || raw.name || 'Unknown',
                    releaseDate: validation.releaseDate,
                    originalReleaseDate: validation.originalReleaseDate || validation.releaseDate,
                    anniversaryMilestone: moduleType === 'anniversary'
                        ? getLocalAnniversaryMilestone(validation.releaseDate, now, getTimezone(config))
                        : null,
                    source: getModuleSource(moduleType),
                    overview: raw.overview,
                    originalLanguage: raw.original_language,
                    popularity: raw.popularity,
                    posterPath: raw.poster_path,
                    backdropPath: raw.backdrop_path,
                    cast,
                    genres: validation.genres || [],
                    platforms: getPlatformsForModule(moduleType, config),
                });
            }
        }
    }

    return candidates;
}

export async function refreshTMDbContent(settings?: RefreshSettings): Promise<{ added: number; errors: string[]; addedTitles: string[]; runId: string }> {
    const config = { ...defaultRefreshSettings, ...settings };
    const errors: string[] = [];
    const addedTitles: string[] = [];
    const timezone = getTimezone(config);
    const now = new Date();
    const runId = randomUUID();

    await prisma.log.create({
        data: {
            level: 'info',
            service: 'tmdb',
            message: 'Starting TMDb master refresh run',
            metadata: { runId, timezone },
        },
    });

    const allCandidates = await collectCandidates(config, now);
    const consumedCycleKeys = await loadConsumedCycleKeys(allCandidates, timezone);
    const dedupedCandidates: TMDbCandidate[] = [];

    for (const candidate of allCandidates) {
        const cycleKey = getCycleKey(candidate, timezone);
        if (consumedCycleKeys.has(cycleKey)) {
            await upsertFeedHistory(candidate, runId, 'skipped', 'already_consumed_in_module_cycle', timezone);
            await prisma.log.create({
                data: {
                    level: 'info',
                    service: 'tmdb',
                    message: 'TMDb candidate skipped by module-cycle dedupe',
                    metadata: {
                        runId,
                        title: candidate.title,
                        tmdbId: candidate.tmdbId,
                        mediaType: candidate.mediaType,
                        moduleType: candidate.moduleType,
                        reason: 'already_consumed_in_module_cycle',
                    },
                },
            });
            continue;
        }

        dedupedCandidates.push(candidate);
        await upsertFeedHistory(candidate, runId, 'fetched', null, timezone);
    }

    const dayStart = startOfLocalDay(now, timezone);
    const dayEnd = endOfLocalDay(now, timezone);
    const existingScheduledTimes = await getExistingScheduledTimes(dayStart, dayEnd);
    const scheduledResults = scheduleCandidates(
        dedupedCandidates,
        existingScheduledTimes,
        now,
        timezone,
        getSchedulerSettings(config),
    );

    let added = 0;
    for (const result of scheduledResults) {
        const autoPost = result.candidate.moduleType === 'today'
            ? !!config.todayAutoPost
            : result.candidate.moduleType === 'weekly'
                ? !!config.weeklyAutoPost
                : result.candidate.moduleType === 'monthly'
                    ? !!config.monthlyAutoPost
                    : !!config.anniversaryAutoPost;

        try {
            await upsertFeedHistory(
                result.candidate,
                runId,
                result.status === 'scheduled' && autoPost ? 'scheduled' : result.status === 'scheduled' ? 'fetched' : result.status === 'unscheduled' ? 'unscheduled' : 'skipped',
                result.reason,
                timezone,
                result.scheduledAt,
            );

            const saveResult = await saveTMDbPost(result, config, runId, timezone, autoPost);
            if (saveResult.action !== 'skipped') {
                added += 1;
                addedTitles.push(result.candidate.title);
            }

            await prisma.log.create({
                data: {
                    level: 'info',
                    service: 'tmdb',
                    message: 'TMDb candidate processed',
                    metadata: {
                        runId,
                        title: result.candidate.title,
                        tmdbId: result.candidate.tmdbId,
                        mediaType: result.candidate.mediaType,
                        moduleType: result.candidate.moduleType,
                        releaseDate: result.candidate.releaseDate.toISOString(),
                        scheduled: !!result.scheduledAt,
                        scheduledTime: result.scheduledAt?.toISOString() || null,
                        status: result.status,
                        reason: result.reason,
                    },
                },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(message);
        }
    }

    await prisma.log.create({
        data: {
            level: 'info',
            service: 'tmdb',
            message: 'TMDb master refresh run complete',
            metadata: {
                runId,
                totalCandidates: allCandidates.length,
                dedupedCandidates: dedupedCandidates.length,
                processed: scheduledResults.length,
                added,
                errors: errors.length,
                countsByModule: scheduledResults.reduce<Record<string, number>>((acc, item) => {
                    acc[item.candidate.moduleType] = (acc[item.candidate.moduleType] || 0) + 1;
                    return acc;
                }, {}),
                countsByStatus: scheduledResults.reduce<Record<string, number>>((acc, item) => {
                    acc[item.status] = (acc[item.status] || 0) + 1;
                    return acc;
                }, {}),
            },
        },
    });

    return { added, errors, addedTitles, runId };
}

export async function regenerateCaptionForTMDbPost(postId: string, scheduledTime?: Date): Promise<{ caption: string; captionContextHash: string }> {
    const post = await prisma.tMDbPost.findUnique({ where: { id: postId } });
    if (!post) {
        throw new Error('TMDb post not found');
    }

    const timezone = getTimezone(defaultRefreshSettings);
    const moduleType = (post.moduleType || post.source.replace('tmdb_', '')) as TMDbModuleType;
    const resolvedImageUrls = Array.isArray(post.imageUrls) && post.imageUrls.length > 0
        ? post.imageUrls
        : [post.imageUrl].filter(Boolean);
    const resolvedImageTypes = Array.isArray(post.imageTypes) && post.imageTypes.length === resolvedImageUrls.length
        ? post.imageTypes
        : [post.imageType, ...new Array(Math.max(0, resolvedImageUrls.length - 1)).fill('backdrop')];
    const posterUrl = resolvedImageUrls.find((_, index) => resolvedImageTypes[index] === 'poster') || (post.imageType === 'poster' ? post.imageUrl : null);
    const backdropUrl = resolvedImageUrls.find((_, index) => resolvedImageTypes[index] === 'backdrop') || (post.imageType === 'backdrop' ? post.imageUrl : null);
    const candidate: TMDbCandidate = {
        provider: 'tmdb',
        moduleType,
        mediaType: post.mediaType as MediaType,
        tmdbId: post.tmdbId,
        title: post.title,
        releaseDate: post.releaseDate,
        originalReleaseDate: post.releaseDate,
        anniversaryMilestone: moduleType === 'anniversary' ? getLocalAnniversaryMilestone(post.releaseDate, new Date(), timezone) : null,
        source: post.source as TMDbCandidate['source'],
        overview: '',
        originalLanguage: 'en',
        popularity: post.popularity,
        posterPath: posterUrl ? posterUrl.replace(TMDB_IMAGE_BASE, '') : null,
        backdropPath: backdropUrl ? backdropUrl.replace(TMDB_IMAGE_BASE, '') : null,
        cast: post.cast,
        genres: [],
        platforms: post.platforms,
    };

    const config = await getTMDbSettings();
    const context = buildCaptionContext(candidate, scheduledTime || post.scheduledTime, new Date(), getTimezone(config));
    const caption = await generateCaptionForCandidate(candidate, context, config);
    return {
        caption,
        captionContextHash: hashCaptionContext(context),
    };
}

export async function updateTMDbPost(postId: string, updates: Record<string, any>) {
    const current = await prisma.tMDbPost.findUnique({ where: { id: postId } });
    if (!current) {
        throw new Error('TMDb post not found');
    }

    const data: Record<string, any> = { ...updates };
    const scheduleChanged = data.scheduledTime && new Date(data.scheduledTime).toISOString() !== current.scheduledTime.toISOString();
    const releaseChanged = data.releaseDate && new Date(data.releaseDate).toISOString() !== current.releaseDate.toISOString();
    const moduleChanged = data.moduleType && data.moduleType !== current.moduleType;
    const overflowChanged = Object.prototype.hasOwnProperty.call(data, 'overflowPolicy') && data.overflowPolicy !== current.overflowPolicy;

    if (scheduleChanged || releaseChanged || moduleChanged || overflowChanged) {
        const captionResult = await regenerateCaptionForTMDbPost(
            postId,
            data.scheduledTime ? new Date(data.scheduledTime) : current.scheduledTime,
        );
        data.caption = captionResult.caption;
        data.captionContextHash = captionResult.captionContextHash;
    }

    const updated = await prisma.tMDbPost.update({
        where: { id: postId },
        data,
    });

    if (updated.moduleType) {
        const timezone = getTimezone(defaultRefreshSettings);
        const statusMap: Record<string, 'fetched' | 'scheduled' | 'dispatched' | 'published' | 'skipped' | 'unscheduled'> = {
            queued: 'fetched',
            scheduled: 'scheduled',
            dispatched: 'dispatched',
            published: 'published',
            skipped: 'skipped',
            unscheduled: 'unscheduled',
            failed: 'unscheduled',
        };

        await prisma.releaseFeedHistory.updateMany({
            where: {
                cycleKey: getCycleKey({
                    provider: 'tmdb',
                    moduleType: updated.moduleType as TMDbModuleType,
                    mediaType: updated.mediaType as MediaType,
                    tmdbId: updated.tmdbId,
                    releaseDate: updated.releaseDate,
                    originalReleaseDate: updated.releaseDate,
                    anniversaryMilestone: updated.moduleType === 'anniversary'
                        ? getLocalAnniversaryMilestone(updated.releaseDate, new Date(), timezone)
                        : null,
                } as TMDbCandidate, timezone),
            },
            data: {
                scheduledAt: updated.scheduledTime,
                dispatchedAt: updated.dispatchedAt,
                publishedAt: updated.publishedTime,
                status: statusMap[updated.status] || 'fetched',
                skipReason: updated.unscheduledReason || updated.errorMessage || null,
            },
        });
    }

    return updated;
}

export async function isTMDbConfigured(): Promise<boolean> {
    const apiKey = await getTmdbApiKey();
    return !!apiKey;
}

export async function getTMDbSettings(): Promise<RefreshSettings> {
    const keys = [
        'enableToday', 'enableWeekly', 'enableMonthly', 'enableAnniversaries',
        'todayAutoPost', 'weeklyAutoPost', 'monthlyAutoPost', 'anniversaryAutoPost',
        'todayMaxItems', 'weeklyMaxItems', 'monthlyMaxItems', 'anniversaryMaxItems',
        'preferredImage', 'preferredImageTypes', 'languageFilter', 'tmdbRegion', 'minPopularityThreshold', 'anniversaryMinPopularityThreshold', 'onlyPopular', 'dedupeWindow', 'tmdbQueuedRetentionHours',
        'selectedGenres', 'movieGenres', 'tvGenres', 'anniversaryYears', 'maxPerAnniversary', 'anniversaryStartYear',
        'captionMaxLength', 'includeCast', 'includeDate', 'rehostImages',
        'discoveryCacheTTL', 'creditsCacheTTL', 'captionCacheTTL', 'timezone',
        'todayPlatforms', 'weeklyPlatforms', 'monthlyPlatforms', 'anniversaryPlatforms',
        'tmdbCaptionModel', 'todayPrompt', 'weeklyPrompt', 'monthlyPrompt', 'anniversaryPrompt',
        'todayPinterestTitlePrompt', 'todayPinterestDescriptionPrompt', 'todayPinterestBoard', 'todayPinterestLinkStrategy',
        'weeklyPinterestTitlePrompt', 'weeklyPinterestDescriptionPrompt', 'weeklyPinterestBoard', 'weeklyPinterestLinkStrategy',
        'monthlyPinterestTitlePrompt', 'monthlyPinterestDescriptionPrompt', 'monthlyPinterestBoard', 'monthlyPinterestLinkStrategy',
        'anniversaryPinterestTitlePrompt', 'anniversaryPinterestDescriptionPrompt', 'anniversaryPinterestBoard', 'anniversaryPinterestLinkStrategy',
        'tmdbDailyRefreshTime', 'postingWindowStart', 'postingWindowEnd', 'minGapBetweenPostsMinutes', 'preferredGapBetweenSameModuleMinutes',
        'maxPostsPerDayOverall', 'maxPostsPerModulePerDay', 'reserveUrgentSlots', 'weeklyOverflowPolicy', 'monthlyOverflowPolicy',
        'weeklyRescheduleValidityDays', 'monthlyRescheduleValidityDays', 'todayAnniversaryUrgentPriority', 'interleaveModules', 'captionRegenOnScheduleChange',
    ];

    const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });
    const result: Record<string, any> = {};
    const structuredKeys = new Set([
        'selectedGenres', 'movieGenres', 'tvGenres', 'anniversaryYears',
        'preferredImageTypes',
        'todayPlatforms', 'weeklyPlatforms', 'monthlyPlatforms', 'anniversaryPlatforms',
    ]);

    settings.forEach((setting) => {
        if (setting.value === 'true' || setting.value === true) result[setting.key] = true;
        else if (setting.value === 'false' || setting.value === false) result[setting.key] = false;
        else if (typeof setting.value === 'string' && structuredKeys.has(setting.key)) {
            try {
                result[setting.key] = JSON.parse(setting.value);
            } catch {
                result[setting.key] = setting.key.endsWith('Platforms') ? {} : [];
            }
        } else if (typeof setting.value === 'string' && !Number.isNaN(Number(setting.value))) {
            result[setting.key] = Number(setting.value);
        } else {
            result[setting.key] = setting.value;
        }
    });

    return {
        ...defaultRefreshSettings,
        ...result,
        preferredImageTypes: normalizePreferredImageModes({
            ...defaultRefreshSettings,
            ...result,
        }),
    };
}

export async function cleanupQueuedTMDbPosts(retentionHours: number): Promise<number> {
    const safeRetentionHours = Number.isFinite(retentionHours) && retentionHours > 0
        ? Math.max(1, Math.floor(retentionHours))
        : defaultRefreshSettings.tmdbQueuedRetentionHours || 168;

    const cutoff = new Date(Date.now() - safeRetentionHours * 60 * 60 * 1000);
    const result = await prisma.tMDbPost.deleteMany({
        where: {
            status: { in: ['queued', 'unscheduled', 'skipped'] },
            createdAt: { lt: cutoff },
        },
    });

    return result.count;
}

export async function clearAllPosts(): Promise<{ deleted: number }> {
    const result = await prisma.tMDbPost.deleteMany({});
    return { deleted: result.count };
}
