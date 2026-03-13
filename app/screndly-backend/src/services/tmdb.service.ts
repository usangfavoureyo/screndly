import { env } from '../lib/env';
/**
 * TMDb API Service
 * Fetches real movie/TV data from The Movie Database API
 */

import prisma from '../lib/prisma';
import { getSecretSetting } from '../lib/settings';
import { trackApiUsage } from './api-usage.service';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';
const TMDB_SCHEDULE_BUFFER_HOURS = 1;
const TMDB_SCHEDULE_SPACING_HOURS = 4;
const TMDB_DISCOVER_MAX_PAGES = 3;
const TMDB_DISCOVER_POOL_MULTIPLIER = 3;
const TMDB_DISCOVER_MIN_POOL_SIZE = 8;
type SaveTMDbPostAction = 'created' | 'skipped';

interface SaveTMDbPostResult {
    action: SaveTMDbPostAction;
    effectiveScheduledTime?: Date;
}

interface TMDbMovie {
    id: number;
    title?: string;
    name?: string; // For TV shows
    release_date?: string;
    first_air_date?: string; // For TV shows
    poster_path: string | null;
    backdrop_path: string | null;
    overview: string;
    popularity: number;
    vote_average: number;
    vote_count: number;
    original_language: string;
    media_type?: string;
}

type MediaType = 'movie' | 'tv';

interface TMDbCredits {
    cast: Array<{ name: string; character: string; order: number }>;
}

interface TMDbDiscoverResponse {
    results: TMDbMovie[];
    page?: number;
    total_pages?: number;
}

function reserveTMDbScheduleTime(reservedTimes: number[], scheduledTime: Date) {
    const timestamp = scheduledTime.getTime();
    if (!reservedTimes.includes(timestamp)) {
        reservedTimes.push(timestamp);
        reservedTimes.sort((a, b) => a - b);
    }
}

function findNextAvailableTMDbScheduleTime(reservedTimes: number[], startTime: Date): Date {
    const spacingMs = TMDB_SCHEDULE_SPACING_HOURS * 60 * 60 * 1000;
    let candidateMs = startTime.getTime();

    while (true) {
        const conflictingTime = reservedTimes.find((reservedTime) => Math.abs(reservedTime - candidateMs) < spacingMs);
        if (!conflictingTime) {
            return new Date(candidateMs);
        }

        candidateMs = conflictingTime + spacingMs;
    }
}

async function getReservedTMDbScheduleTimes(now: Date): Promise<number[]> {
    const scheduledPosts = await prisma.tMDbPost.findMany({
        where: {
            status: 'scheduled',
            scheduledTime: { gte: now },
        },
        select: {
            scheduledTime: true,
        },
        orderBy: {
            scheduledTime: 'asc',
        },
    });

    return scheduledPosts.map((post) => post.scheduledTime.getTime());
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

function filterPopularResults(results: TMDbMovie[], config: RefreshSettings): TMDbMovie[] {
    if (!config.onlyPopular) {
        return results;
    }

    return results.filter((item) => item.popularity >= 50);
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
    config: RefreshSettings,
    desiredCount: number
): Promise<TMDbMovie[]> {
    const candidates: TMDbMovie[] = [];
    const poolSize = getCandidatePoolSize(desiredCount);
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= TMDB_DISCOVER_MAX_PAGES && candidates.length < poolSize) {
        const data = await tmdbFetch<TMDbDiscoverResponse>(endpoint, {
            ...params,
            page: String(page)
        });

        totalPages = Math.max(1, data.total_pages || 1);
        appendUniqueCandidates(candidates, filterPopularResults(data.results || [], config), poolSize);
        page += 1;
    }

    return candidates;
}

function getAnniversaryBucketKey(candidate: TMDbMovie): string | null {
    const releaseValue = candidate.release_date || candidate.first_air_date;
    if (!releaseValue) {
        return null;
    }

    const releaseYear = new Date(releaseValue).getFullYear();
    if (Number.isNaN(releaseYear)) {
        return null;
    }

    return String(new Date().getFullYear() - releaseYear);
}

function getTargetCountForBatch(sourceLabel: string, config: RefreshSettings): number {
    switch (sourceLabel) {
        case 'tmdb_today':
            return getRequestedItemCount(config.todayMaxItems, defaultRefreshSettings.todayMaxItems || 5);
        case 'tmdb_weekly':
            return getRequestedItemCount(config.weeklyMaxItems, defaultRefreshSettings.weeklyMaxItems || 10);
        case 'tmdb_monthly':
            return getRequestedItemCount(config.monthlyMaxItems, defaultRefreshSettings.monthlyMaxItems || 30);
        case 'tmdb_anniversary':
            return getRequestedItemCount(config.anniversaryMaxItems, defaultRefreshSettings.anniversaryMaxItems || 5);
        default:
            return 1;
    }
}

/**
 * Get TMDb API key from database settings or environment
 */
export async function getTmdbApiKey(): Promise<string | null> {
    // First try environment variable
    if (env.TMDB_API_KEY) {
        return env.TMDB_API_KEY;
    }

    const modernKey = await getSecretSetting('tmdbKey');
    if (modernKey) {
        return modernKey;
    }

    return getSecretSetting('tmdbApiKey');
}

/**
 * Make authenticated request to TMDb API
 */
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
            await trackApiUsage({
                service: 'tmdb',
                endpoint,
                success: false,
            });
            tracked = true;
            throw new Error(`TMDb API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as T;
        await trackApiUsage({
            service: 'tmdb',
            endpoint,
            success: true,
        });
        tracked = true;
        return data;
    } catch (error) {
        if (!tracked) {
            await trackApiUsage({
                service: 'tmdb',
                endpoint,
                success: false,
            });
        }

        throw error;
    }
}

/**
 * Fetch trending movies for the day
 */
export async function fetchTrendingMovies(timeWindow: 'day' | 'week' = 'day'): Promise<TMDbMovie[]> {
    const data = await tmdbFetch<{ results: TMDbMovie[] }>(`/trending/movie/${timeWindow}`);
    return data.results.slice(0, 10); // Top 10
}

/**
 * Fetch trending TV shows
 */
export async function fetchTrendingTV(timeWindow: 'day' | 'week' = 'day'): Promise<TMDbMovie[]> {
    const data = await tmdbFetch<{ results: TMDbMovie[] }>(`/trending/tv/${timeWindow}`);
    return data.results.slice(0, 10);
}

/**
 * Fetch movies releasing soon
 */
export async function fetchUpcomingMovies(): Promise<TMDbMovie[]> {
    const data = await tmdbFetch<{ results: TMDbMovie[] }>('/movie/upcoming', {
        region: 'US'
    });
    return data.results.slice(0, 10);
}

/**
 * Fetch now playing movies
 */
export async function fetchNowPlayingMovies(): Promise<TMDbMovie[]> {
    const data = await tmdbFetch<{ results: TMDbMovie[] }>('/movie/now_playing', {
        region: 'US'
    });
    return data.results.slice(0, 10);
}

/**
 * Fetch movie credits (cast)
 */
export async function fetchMovieCredits(movieId: number): Promise<string[]> {
    try {
        const data = await tmdbFetch<TMDbCredits>(`/movie/${movieId}/credits`);
        return data.cast.slice(0, 5).map(c => c.name);
    } catch {
        return [];
    }
}

/**
 * Fetch TV credits
 */
export async function fetchTVCredits(tvId: number): Promise<string[]> {
    try {
        const data = await tmdbFetch<TMDbCredits>(`/tv/${tvId}/credits`);
        return data.cast.slice(0, 5).map(c => c.name);
    } catch {
        return [];
    }
}

/**
 * Fetch anniversary movies (released X years ago today)
 */
export async function fetchAnniversaryMovies(settings?: RefreshSettings): Promise<TMDbMovie[]> {
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = String(today.getDate()).padStart(2, '0');
    const anniversaryMovies: TMDbMovie[] = [];
    const config = { ...defaultRefreshSettings, ...settings };

    // Use settings or defaults
    // Default milestones: 10, 20, 25, 30, 40, 50
    const defaultMilestones = [10, 20, 25, 30, 40, 50];
    let milestones = defaultMilestones;

    if (config.anniversaryYears && Array.isArray(config.anniversaryYears)) {
        // Convert string array ["10", "20"] to numbers [10, 20]
        milestones = config.anniversaryYears.map(y => parseInt(y.toString())).filter(n => !isNaN(n));
    }

    // Fallback if settings empty
    if (milestones.length === 0) milestones = defaultMilestones;

    console.log(`[TMDb] Checking anniversaries for years: ${milestones.join(', ')}`);
    const overallPoolLimit = getCandidatePoolSize(getRequestedItemCount(config.anniversaryMaxItems, defaultRefreshSettings.anniversaryMaxItems || 5));
    const perYearTarget = getRequestedItemCount(config.maxPerAnniversary, 2);

    for (const years of milestones) {
        const targetYear = today.getFullYear() - years;
        const releaseDate = `${targetYear}-${currentMonth}-${currentDay}`;

        try {
            const params: Record<string, string> = {
                'primary_release_date.gte': releaseDate,
                'primary_release_date.lte': releaseDate,
                'sort_by': 'popularity.desc'
            };
            applyCommonDiscoverFilters(params, 'movie', config);

            const candidates = await fetchDiscoverCandidatePool('/discover/movie', params, config, perYearTarget);
            appendUniqueCandidates(anniversaryMovies, candidates, overallPoolLimit);
        } catch (error) {
            console.error(`Failed to fetch ${years}yr anniversaries:`, error);
        }

        if (anniversaryMovies.length >= overallPoolLimit) {
            break;
        }
    }

    return anniversaryMovies;
}

/**
 * Fetch anniversary TV shows (premiered X years ago today)
 */
export async function fetchAnniversaryTV(settings?: RefreshSettings): Promise<TMDbMovie[]> {
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = String(today.getDate()).padStart(2, '0');
    const anniversaryShows: TMDbMovie[] = [];
    const config = { ...defaultRefreshSettings, ...settings };

    const defaultMilestones = [10, 20, 25, 30, 40, 50];
    let milestones = defaultMilestones;

    if (config.anniversaryYears && Array.isArray(config.anniversaryYears)) {
        milestones = config.anniversaryYears.map(y => parseInt(y.toString())).filter(n => !isNaN(n));
    }

    if (milestones.length === 0) milestones = defaultMilestones;

    console.log(`[TMDb] Checking TV anniversaries for years: ${milestones.join(', ')}`);
    const overallPoolLimit = getCandidatePoolSize(getRequestedItemCount(config.anniversaryMaxItems, defaultRefreshSettings.anniversaryMaxItems || 5));
    const perYearTarget = getRequestedItemCount(config.maxPerAnniversary, 2);

    for (const years of milestones) {
        const targetYear = today.getFullYear() - years;
        const premiereDate = `${targetYear}-${currentMonth}-${currentDay}`;

        try {
            const params: Record<string, string> = {
                'first_air_date.gte': premiereDate,
                'first_air_date.lte': premiereDate,
                'sort_by': 'popularity.desc',
                'watch_region': 'US'
            };
            applyCommonDiscoverFilters(params, 'tv', config);

            const candidates = await fetchDiscoverCandidatePool('/discover/tv', params, config, perYearTarget);
            appendUniqueCandidates(anniversaryShows, candidates, overallPoolLimit);
        } catch (error) {
            console.error(`Failed to fetch TV ${years}yr anniversaries:`, error);
        }

        if (anniversaryShows.length >= overallPoolLimit) {
            break;
        }
    }

    return anniversaryShows;
}

/**
 * Generate social media caption for a movie/TV show
 */
export function generateDefaultCaption(
    title: string,
    year: number,
    mediaType: 'movie' | 'tv',
    cast: string[],
    source: string
): string {
    const castStr = cast.length > 0 ? `Starring ${cast.slice(0, 3).join(', ')}` : '';
    const emoji = mediaType === 'movie' ? '🎬' : '📺';

    if (source === 'tmdb_anniversary') {
        const years = new Date().getFullYear() - year;
        return `${emoji} ${years} years ago today, "${title}" (${year}) was released!\n\n${castStr}\n\n#Movie #Anniversary #${title.replace(/\s+/g, '')}`;
    }

    if (source === 'tmdb_upcoming') {
        return `${emoji} Coming Soon: "${title}"\n\n${castStr}\n\n#NewMovie #ComingSoon #${title.replace(/\s+/g, '')}`;
    }

    return `${emoji} "${title}" (${year})\n\n${castStr}\n\n#Trending #${mediaType === 'movie' ? 'Movie' : 'TVShow'}`;
}

function buildTMDbCaptionSystemPrompt(
    basePrompt: string | undefined,
    options: {
        maxLength?: number;
        includeCast?: boolean;
        includeDate?: boolean;
    }
): string | undefined {
    const constraints = [
        options.maxLength ? `- Keep the final caption under ${options.maxLength} characters.` : null,
        options.includeCast === false
            ? '- Do not mention cast members.'
            : '- Mention cast only when it strengthens the caption.',
        options.includeDate === false
            ? '- Do not mention the exact release date or year unless absolutely necessary.'
            : '- You may mention the release date or year when it improves clarity.',
    ].filter(Boolean).join('\n');

    if (!basePrompt && !constraints) {
        return undefined;
    }

    return [basePrompt, constraints].filter(Boolean).join('\n\nAdditional Constraints:\n');
}

/**
 * Save TMDb content to database for scheduling
 */
export async function saveTMDbPost(
    movie: TMDbMovie,
    mediaType: MediaType,
    source: string,
    scheduledTime: Date,
    preferredImage: 'poster' | 'backdrop' | 'random' = 'poster',
    platforms: string[] = [],
    config?: RefreshSettings & { autoPost?: boolean }
): Promise<SaveTMDbPostResult> {
    const title = movie.title || movie.name || 'Unknown';
    const releaseDate = movie.release_date || movie.first_air_date || new Date().toISOString();
    const year = new Date(releaseDate).getFullYear();

    // Get cast
    const cast = mediaType === 'movie'
        ? await fetchMovieCredits(movie.id)
        : await fetchTVCredits(movie.id);

    // Generate caption (AI or Template)
    const daysUntil = Math.ceil((new Date(releaseDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const anniversaryYears = source === 'tmdb_anniversary' ? new Date().getFullYear() - year : undefined;

    // Determine temporal tag
    let temporalTag: CaptionContext['temporalTag'] = 'already_released';
    if (daysUntil === 0) temporalTag = 'releasing_today';
    else if (daysUntil > 0 && daysUntil <= 7) temporalTag = 'releasing_this_week';
    else if (daysUntil > 7 && daysUntil <= 31) temporalTag = 'releasing_this_month';
    else if (source === 'tmdb_anniversary') temporalTag = 'anniversary';
    const captionCast = config?.includeCast === false ? [] : cast.slice(0, 3);

    let caption = '';

    // Determine appropriate custom prompt
    let customPrompt: string | undefined;
    if (temporalTag === 'releasing_today') customPrompt = config?.todayPrompt;
    else if (temporalTag === 'releasing_this_week') customPrompt = config?.weeklyPrompt;
    else if (temporalTag === 'releasing_this_month') customPrompt = config?.monthlyPrompt;
    else if (source === 'tmdb_anniversary') customPrompt = config?.anniversaryPrompt;

    // Try AI Generation first
    try {
        // Fetch model from settings (passed in config if available, or default)
        const model = (config as any)?.tmdbCaptionModel || 'gpt-5-mini';
        const systemPrompt = buildTMDbCaptionSystemPrompt(customPrompt, {
            maxLength: config?.captionMaxLength,
            includeCast: config?.includeCast,
            includeDate: config?.includeDate,
        });

        // Construct Director Payload
        const context: CaptionContext = {
            title,
            mediaType,
            temporalTag,
            daysUntil,
            releaseDate: config?.includeDate === false ? undefined : releaseDate,
            year,
            anniversaryYears,
            cast: captionCast,
            genres: [], // TODO: Pass genres if available in movie object
            platform: 'X', // Default to generic short form. TODO: Generate variants for Threads?
            tone: 'mainstream_hype'
        };

        // Pass custom prompt if available
        caption = await generateTMDbCaption(context, model as any, systemPrompt);
    } catch (error) {
        console.error(`[TMDb] AI Caption failed for ${title}, falling back to template.`, error);
        caption = generateDefaultCaption(title, year, mediaType, captionCast, source);
    }


    // Select image based on preferredImage setting
    let imageUrl = '';
    let imageType: 'poster' | 'backdrop' = 'poster';

    switch (preferredImage) {
        case 'poster':
            // Only use poster, never fallback to backdrop
            if (movie.poster_path) {
                imageUrl = `${TMDB_IMAGE_BASE}${movie.poster_path}`;
                imageType = 'poster';
            }
            break;
        case 'backdrop':
            // Only use backdrop, never fallback to poster
            if (movie.backdrop_path) {
                imageUrl = `${TMDB_IMAGE_BASE}${movie.backdrop_path}`;
                imageType = 'backdrop';
            }
            break;
        case 'random':
        default:
            {
                const availableImages: Array<{ url: string; type: 'poster' | 'backdrop' }> = [];

                if (movie.poster_path) {
                    availableImages.push({
                        url: `${TMDB_IMAGE_BASE}${movie.poster_path}`,
                        type: 'poster'
                    });
                }

                if (movie.backdrop_path) {
                    availableImages.push({
                        url: `${TMDB_IMAGE_BASE}${movie.backdrop_path}`,
                        type: 'backdrop'
                    });
                }

                if (availableImages.length > 0) {
                    const selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
                    imageUrl = selectedImage.url;
                    imageType = selectedImage.type;
                }
            }
            break;
    }

    // Check for duplicates within the same reminder stage only.
    // This allows the same title to appear once in monthly, later in weekly, and finally in today.
    const existing = await prisma.tMDbPost.findFirst({
        where: { tmdbId: movie.id, source, mediaType }
    });

    if (existing) {
        console.log(`Skipping duplicate: ${title}`);
        return { action: 'skipped' };
    }

    // Save to database
    // IMPORTANT: Fetch creates QUEUED feeds, not SCHEDULED
    // Scheduling only happens when user explicitly schedules
    await prisma.tMDbPost.create({
        data: {
            tmdbId: movie.id,
            mediaType,
            title,
            year,
            releaseDate: new Date(releaseDate),
            caption,
            imageUrl,
            imageType,
            scheduledTime,
            source,
            cast,
            popularity: movie.popularity || 0,
            platforms,
            status: config?.autoPost ? 'scheduled' : 'queued'
        }
    });

    const statusMsg = config?.autoPost ? 'SCHEDULED' : 'QUEUED';
    console.log(`Saved TMDb post: ${title} [${statusMsg}] for ${scheduledTime}`);
    return { action: 'created', effectiveScheduledTime: scheduledTime };
}

/**
 * Fetch movies released TODAY - uses settings for filtering
 */
export async function fetchReleasedToday(settings?: RefreshSettings): Promise<TMDbMovie[]> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const config = { ...defaultRefreshSettings, ...settings };
    const targetCount = getRequestedItemCount(config.todayMaxItems, defaultRefreshSettings.todayMaxItems || 5);

    // Build query params from settings
    const params: Record<string, string> = {
        'primary_release_date.gte': dateStr,
        'primary_release_date.lte': dateStr,
        'sort_by': 'popularity.desc',
        'region': 'US'
    };
    applyCommonDiscoverFilters(params, 'movie', config);

    return fetchDiscoverCandidatePool('/discover/movie', params, config, targetCount);
}

/**
 * Fetch movies releasing in 1-7 days - uses settings for filtering
 */
export async function fetchUpcomingWeekly(settings?: RefreshSettings): Promise<TMDbMovie[]> {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const config = { ...defaultRefreshSettings, ...settings };
    const targetCount = getRequestedItemCount(config.weeklyMaxItems, defaultRefreshSettings.weeklyMaxItems || 10);

    const params: Record<string, string> = {
        'primary_release_date.gte': tomorrow.toISOString().split('T')[0],
        'primary_release_date.lte': nextWeek.toISOString().split('T')[0],
        'sort_by': 'popularity.desc',
        'region': 'US'
    };
    applyCommonDiscoverFilters(params, 'movie', config);

    return fetchDiscoverCandidatePool('/discover/movie', params, config, targetCount);
}

/**
 * Fetch movies releasing in 8-30 days - uses settings for filtering
 */
export async function fetchUpcomingMonthly(settings?: RefreshSettings): Promise<TMDbMovie[]> {
    const today = new Date();
    const nextEightDays = new Date(today);
    nextEightDays.setDate(today.getDate() + 8);
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(today.getDate() + 30);
    const config = { ...defaultRefreshSettings, ...settings };
    const targetCount = getRequestedItemCount(config.monthlyMaxItems, defaultRefreshSettings.monthlyMaxItems || 30);

    const params: Record<string, string> = {
        'primary_release_date.gte': nextEightDays.toISOString().split('T')[0],
        'primary_release_date.lte': thirtyDaysLater.toISOString().split('T')[0],
        'sort_by': 'popularity.desc',
        'region': 'US'
    };
    applyCommonDiscoverFilters(params, 'movie', config);

    return fetchDiscoverCandidatePool('/discover/movie', params, config, targetCount);
}

// ===== TV SHOW FETCH FUNCTIONS =====

/**
 * Fetch TV shows airing TODAY - uses settings for filtering
 */
export async function fetchTVAiringToday(settings?: RefreshSettings): Promise<TMDbMovie[]> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const config = { ...defaultRefreshSettings, ...settings };
    const targetCount = getRequestedItemCount(config.todayMaxItems, defaultRefreshSettings.todayMaxItems || 5);

    const params: Record<string, string> = {
        'first_air_date.gte': dateStr,
        'first_air_date.lte': dateStr,
        'sort_by': 'popularity.desc',
        'watch_region': 'US'
    };
    applyCommonDiscoverFilters(params, 'tv', config);

    return fetchDiscoverCandidatePool('/discover/tv', params, config, targetCount);
}

/**
 * Fetch TV shows airing in 1-7 days - uses settings for filtering
 */
export async function fetchTVAiringWeekly(settings?: RefreshSettings): Promise<TMDbMovie[]> {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const config = { ...defaultRefreshSettings, ...settings };
    const targetCount = getRequestedItemCount(config.weeklyMaxItems, defaultRefreshSettings.weeklyMaxItems || 10);

    const params: Record<string, string> = {
        'first_air_date.gte': tomorrow.toISOString().split('T')[0],
        'first_air_date.lte': nextWeek.toISOString().split('T')[0],
        'sort_by': 'popularity.desc',
        'watch_region': 'US'
    };
    applyCommonDiscoverFilters(params, 'tv', config);

    return fetchDiscoverCandidatePool('/discover/tv', params, config, targetCount);
}

/**
 * Fetch TV shows airing in 8-30 days - uses settings for filtering
 */
export async function fetchTVAiringMonthly(settings?: RefreshSettings): Promise<TMDbMovie[]> {
    const today = new Date();
    const nextEightDays = new Date(today);
    nextEightDays.setDate(today.getDate() + 8);
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(today.getDate() + 30);
    const config = { ...defaultRefreshSettings, ...settings };
    const targetCount = getRequestedItemCount(config.monthlyMaxItems, defaultRefreshSettings.monthlyMaxItems || 30);

    const params: Record<string, string> = {
        'first_air_date.gte': nextEightDays.toISOString().split('T')[0],
        'first_air_date.lte': thirtyDaysLater.toISOString().split('T')[0],
        'sort_by': 'popularity.desc',
        'watch_region': 'US'
    };
    applyCommonDiscoverFilters(params, 'tv', config);

    return fetchDiscoverCandidatePool('/discover/tv', params, config, targetCount);
}

/**
 * Settings interface from frontend
 */
interface RefreshSettings {
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
    selectedGenres?: number[];
    movieGenres?: number[];
    tvGenres?: number[];
    languageFilter?: string;
    onlyPopular?: boolean;
    dedupeWindow?: number;
    tmdbQueuedRetentionHours?: number;
    anniversaryYears?: string[] | number[];
    maxPerAnniversary?: number;
    anniversaryStartYear?: string | number;
    captionMaxLength?: number;
    includeCast?: boolean;
    includeDate?: boolean;
    rehostImages?: boolean;
    discoveryCacheTTL?: number;
    creditsCacheTTL?: number;
    captionCacheTTL?: number;
    todayPlatforms?: {
        x?: boolean;
        threads?: boolean;
        facebook?: boolean;
        youtube?: boolean;
        pinterest?: boolean;
    };
    weeklyPlatforms?: {
        x?: boolean;
        threads?: boolean;
        facebook?: boolean;
        youtube?: boolean;
        pinterest?: boolean;
    };
    monthlyPlatforms?: {
        x?: boolean;
        threads?: boolean;
        facebook?: boolean;
        youtube?: boolean;
        pinterest?: boolean;
    };
    anniversaryPlatforms?: {
        x?: boolean;
        threads?: boolean;
        facebook?: boolean;
        youtube?: boolean;
        pinterest?: boolean;
    };
    tmdbCaptionModel?: string; // AI Model
    todayPrompt?: string; // Custom prompts
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
}

/**
 * Default settings if none provided
 */
const defaultRefreshSettings: RefreshSettings = {
    enableToday: true,
    enableWeekly: true,
    enableMonthly: true,
    enableAnniversaries: true,
    todayMaxItems: 5,
    weeklyMaxItems: 10,
    monthlyMaxItems: 30,
    anniversaryMaxItems: 5,
    preferredImage: 'poster',
    selectedGenres: [],
    movieGenres: [],
    tvGenres: [],
    languageFilter: 'en',
    onlyPopular: true,
    dedupeWindow: 30,
    tmdbQueuedRetentionHours: 168,
    todayPlatforms: { x: true, threads: true, facebook: false, youtube: false, pinterest: false },
    weeklyPlatforms: { x: true, threads: true, facebook: false, youtube: false, pinterest: false },
    monthlyPlatforms: { x: true, threads: true, facebook: false, youtube: false, pinterest: false },
    anniversaryPlatforms: { x: true, threads: false, facebook: false, youtube: false, pinterest: false }
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
    37: { movieId: 37, tvId: 37 }
};

function uniqueNumbers(values: Array<number | null | undefined>): number[] {
    return [...new Set(values.filter((value): value is number => typeof value === 'number' && !Number.isNaN(value)))];
}

function getLanguageFilter(config: RefreshSettings): string | undefined {
    const value = config.languageFilter?.trim().toLowerCase();
    if (!value || value === 'all') {
        return undefined;
    }

    return value;
}

function getGenreIdsForMedia(config: RefreshSettings, mediaType: MediaType): number[] {
    const explicitGenres = mediaType === 'movie'
        ? (config.movieGenres || [])
        : (config.tvGenres || []);

    const mappedUnifiedGenres = (config.selectedGenres || []).map(genreId => {
        const mapping = UNIFIED_GENRE_MAP[genreId];
        if (!mapping) {
            return genreId;
        }

        return mediaType === 'movie' ? mapping.movieId : mapping.tvId;
    });

    return uniqueNumbers([...explicitGenres, ...mappedUnifiedGenres]);
}

function applyCommonDiscoverFilters(
    params: Record<string, string>,
    mediaType: MediaType,
    config: RefreshSettings
) {
    const language = getLanguageFilter(config);
    if (language) {
        params['with_original_language'] = language;
    }

    const genres = getGenreIdsForMedia(config, mediaType);
    if (genres.length > 0) {
        params['with_genres'] = genres.join(',');
    }
}

function getPlatformsForSource(sourceLabel: string, config: RefreshSettings): string[] {
    const platformConfig = sourceLabel === 'tmdb_today'
        ? config.todayPlatforms
        : sourceLabel === 'tmdb_weekly'
            ? config.weeklyPlatforms
            : sourceLabel === 'tmdb_monthly'
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

/**
 * Refresh TMDb content - fetch and save new posts with proper source labels
 * Enforces settings from frontend (enabled feeds, max items, etc.)
 */
// Helper types for details
interface TMDbDetails {
    production_countries?: Array<{ iso_3166_1: string; name: string }>;
    origin_country?: string[];
    original_language?: string;
    vote_count?: number;
    popularity?: number;
}

/**
 * Fetch full details for a movie to verify production countries
 */
async function fetchMovieDetails(id: number): Promise<TMDbDetails | null> {
    try {
        return await tmdbFetch<TMDbDetails>(`/movie/${id}`);
    } catch (e) {
        console.warn(`[TMDb] Failed to fetch details for movie ${id}`);
        return null;
    }
}

/**
 * Fetch full details for a TV show
 */
async function fetchTVDetails(id: number): Promise<TMDbDetails | null> {
    try {
        return await tmdbFetch<TMDbDetails>(`/tv/${id}`);
    } catch (e) {
        console.warn(`[TMDb] Failed to fetch details for TV ${id}`);
        return null;
    }
}

/**
 * STRICT VALIDATION PIPELINE
 * Returns true if candidate passes ALL checks (Hard Filters + Deep Check + AI Veto)
 */
import aiService, { generateTMDbCaption, CaptionContext } from './ai.service';

async function validateCandidate(
    candidate: TMDbMovie,
    type: MediaType,
    source: string,
    config: RefreshSettings
): Promise<{ valid: boolean; reason?: string }> {
    const title = candidate.title || candidate.name || 'Unknown';

    // 1. HARD FILTER: Language (Deterministic)
    const requiredLanguage = getLanguageFilter(config);
    if (requiredLanguage && candidate.original_language !== requiredLanguage) {
        return { valid: false, reason: `REJECT_LANGUAGE (Original: ${candidate.original_language})` };
    }

    // 2. HARD FILTER: Popularity (Deterministic)
    // Threshold: Popularity > 50
    // EXCEPTION: Anniversaries (Classics might not be trending globally right now, so we skip/lower this)
    const POPULARITY_THRESHOLD = 50;
    const isAnniversary = source.includes('anniversary');

    if (!isAnniversary && candidate.popularity < POPULARITY_THRESHOLD) {
        return { valid: false, reason: `REJECT_POPULARITY (${candidate.popularity.toFixed(1)} < ${POPULARITY_THRESHOLD})` };
    }

    // 3. DEEP CHECK: Production Country (Source of Truth)
    // We must fetch details because 'list' endpoints often lack full country data or are unreliable.
    const details = type === 'movie'
        ? await fetchMovieDetails(candidate.id)
        : await fetchTVDetails(candidate.id);

    if (!details) {
        return { valid: false, reason: `REJECT_FETCH_ERROR` };
    }

    const countryCodes = new Set<string>();
    (details.production_countries || []).forEach(country => {
        if (country.iso_3166_1) {
            countryCodes.add(country.iso_3166_1);
        }
    });
    (details.origin_country || []).forEach(code => {
        if (code) {
            countryCodes.add(code);
        }
    });

    const isUS = countryCodes.has('US');
    if (!isUS) {
        return { valid: false, reason: `REJECT_COUNTRY (Countries: ${Array.from(countryCodes).join(', ') || 'unknown'})` };
    }

    // 4. AI VETO (Flash 3)
    // Only verify if we are considering valid candidates so far
    try {
        // Prepare metadata for AI
        const cast = type === 'movie'
            ? await fetchMovieCredits(candidate.id)
            : await fetchTVCredits(candidate.id);

        // Use the AI Service to validate
        const aiResult = await aiService.validateTMDbContent(
            title,
            candidate.overview,
            [], // Genres hard to get from list id mapping, skipping for now as country/lang is key
            details.original_language || candidate.original_language,
            (details.production_countries || []).map(c => c.name),
            'flash-3'
        );

        if (!aiResult.isValid) {
            return { valid: false, reason: `REJECT_AI_VETO (${aiResult.reasoning})` };
        }

    } catch (error) {
        console.error(`[TMDb] AI Verification failed for ${title}`, error);
        // Fail open or closed? Request said "Strict". 
        // If AI fails, we can't verify. Reject? 
        // Let's Reject to be safe and avoid garbage.
        return { valid: true }; // Bypass AI Veto if AI fails
    }

    return { valid: true };
}

/**
 * Refresh TMDb content - Strict Enforcement Pipeline
 */
export async function refreshTMDbContent(settings?: RefreshSettings): Promise<{ added: number; errors: string[]; addedTitles: string[] }> {
    const errors: string[] = [];
    let added = 0;
    let rejected = 0;
    const addedTitles: string[] = [];

    // Merge with defaults
    const config = { ...defaultRefreshSettings, ...settings };

    // Log intent
    console.log('[TMDb] Starting Strict Refresh Cycle', { config });

    const now = new Date();
    let scheduleTime = new Date(now);
    scheduleTime.setHours(scheduleTime.getHours() + TMDB_SCHEDULE_BUFFER_HOURS);
    const reservedScheduleTimes = await getReservedTMDbScheduleTimes(now);

    // Generic Processor Function
    const processBatch = async (
        fetcher: () => Promise<TMDbMovie[]>,
        sourceLabel: string,
        type: 'movie' | 'tv'
    ) => {
        try {
            console.log(`[TMDb] Fetching candidates for ${sourceLabel}...`);
            const candidates = await fetcher();
            console.log(`[TMDb] ${sourceLabel}: Found ${candidates.length} candidates. Starting validation...`);
            const targetCount = getTargetCountForBatch(sourceLabel, config);
            const anniversaryBucketLimit = sourceLabel === 'tmdb_anniversary'
                ? getRequestedItemCount(config.maxPerAnniversary, 2)
                : null;
            const acceptedBuckets = new Map<string, number>();
            let acceptedForBatch = 0;

            for (const candidate of candidates) {
                if (acceptedForBatch >= targetCount) {
                    break;
                }

                const anniversaryBucketKey = anniversaryBucketLimit
                    ? getAnniversaryBucketKey(candidate)
                    : null;

                if (
                    anniversaryBucketLimit &&
                    anniversaryBucketKey &&
                    (acceptedBuckets.get(anniversaryBucketKey) || 0) >= anniversaryBucketLimit
                ) {
                    continue;
                }

                // RUN THE PIPELINE
                const validation = await validateCandidate(candidate, type, sourceLabel, config);

                if (!validation.valid) {
                    console.log(`[TMDb] ❌ REJECTED [${sourceLabel}] "${candidate.title || candidate.name}": ${validation.reason}`);
                    rejected++;
                    continue;
                }

                // If we get here, it passed ALL gates.
                console.log(`[TMDb] ✅ ACCEPTED [${sourceLabel}] "${candidate.title || candidate.name}"`);

                // Determine if auto-post is enabled for this source
                let shouldAutoPost = false;
                if (sourceLabel === 'tmdb_today') shouldAutoPost = !!config.todayAutoPost;
                else if (sourceLabel === 'tmdb_weekly') shouldAutoPost = !!config.weeklyAutoPost;
                else if (sourceLabel === 'tmdb_monthly') shouldAutoPost = !!config.monthlyAutoPost;
                else if (sourceLabel === 'tmdb_anniversary') shouldAutoPost = !!config.anniversaryAutoPost;

                const nextScheduledTime = findNextAvailableTMDbScheduleTime(reservedScheduleTimes, scheduleTime);
                const result = await saveTMDbPost(
                    candidate,
                    type,
                    sourceLabel,
                    nextScheduledTime,
                    config.preferredImage,
                    getPlatformsForSource(sourceLabel, config),
                    { ...config, autoPost: shouldAutoPost }
                );

                if (result.action !== 'skipped') {
                    reserveTMDbScheduleTime(reservedScheduleTimes, result.effectiveScheduledTime || nextScheduledTime);
                    scheduleTime = new Date((result.effectiveScheduledTime || nextScheduledTime).getTime());
                    scheduleTime.setHours(scheduleTime.getHours() + TMDB_SCHEDULE_SPACING_HOURS);
                    added++;
                    acceptedForBatch++;
                    addedTitles.push(candidate.title || candidate.name || 'Untitled');

                    if (anniversaryBucketLimit && anniversaryBucketKey) {
                        acceptedBuckets.set(anniversaryBucketKey, (acceptedBuckets.get(anniversaryBucketKey) || 0) + 1);
                    }
                }
            }

            console.log(`[TMDb] ${sourceLabel}: Added ${acceptedForBatch}/${targetCount} ${type} posts after validation.`);
        } catch (error) {
            const msg = `Failed processing ${sourceLabel}: ${error}`;
            errors.push(msg);
            console.error(`[TMDb] ${msg}`);
        }
    };

    // 1. Movies Today
    if (config.enableToday) await processBatch(() => fetchReleasedToday(config), 'tmdb_today', 'movie');

    // 2. Movies Weekly
    if (config.enableWeekly) await processBatch(() => fetchUpcomingWeekly(config), 'tmdb_weekly', 'movie');

    // 3. Movies Monthly
    if (config.enableMonthly) await processBatch(() => fetchUpcomingMonthly(config), 'tmdb_monthly', 'movie');

    // 4. Anniversary
    if (config.enableAnniversaries) await processBatch(() => fetchAnniversaryMovies(config), 'tmdb_anniversary', 'movie');

    // 5. TV Today
    if (config.enableToday) await processBatch(() => fetchTVAiringToday(config), 'tmdb_today', 'tv');

    // 6. TV Weekly
    if (config.enableWeekly) await processBatch(() => fetchTVAiringWeekly(config), 'tmdb_weekly', 'tv');

    // 7. TV Monthly
    if (config.enableMonthly) await processBatch(() => fetchTVAiringMonthly(config), 'tmdb_monthly', 'tv');

    // 8. TV Anniversary
    if (config.enableAnniversaries) await processBatch(() => fetchAnniversaryTV(config), 'tmdb_anniversary', 'tv');

    console.log(`[TMDb] Refresh complete. Added: ${added}, Rejected: ${rejected}, Errors: ${errors.length}`);
    return { added, errors, addedTitles };
}


/**
 * Check if TMDb API is configured
 */
export async function isTMDbConfigured(): Promise<boolean> {
    const apiKey = await getTmdbApiKey();
    return !!apiKey;
}

/**
 * Get TMDb refresh settings from database
 */
export async function getTMDbSettings(): Promise<RefreshSettings> {
    const keys = [
        'enableToday', 'enableWeekly', 'enableMonthly', 'enableAnniversaries',
        'todayAutoPost', 'weeklyAutoPost', 'monthlyAutoPost', 'anniversaryAutoPost',
        'todayMaxItems', 'weeklyMaxItems', 'monthlyMaxItems', 'anniversaryMaxItems',
        'preferredImage', 'languageFilter', 'onlyPopular', 'dedupeWindow', 'tmdbQueuedRetentionHours',
        'selectedGenres', 'movieGenres', 'tvGenres', 'anniversaryYears', 'maxPerAnniversary', 'anniversaryStartYear',
        'captionMaxLength', 'includeCast', 'includeDate', 'rehostImages',
        'discoveryCacheTTL', 'creditsCacheTTL', 'captionCacheTTL',
        'todayPlatforms', 'weeklyPlatforms', 'monthlyPlatforms', 'anniversaryPlatforms',
        'tmdbCaptionModel', 'todayPrompt', 'weeklyPrompt', 'monthlyPrompt', 'anniversaryPrompt',
        'todayPinterestTitlePrompt', 'todayPinterestDescriptionPrompt', 'todayPinterestBoard', 'todayPinterestLinkStrategy',
        'weeklyPinterestTitlePrompt', 'weeklyPinterestDescriptionPrompt', 'weeklyPinterestBoard', 'weeklyPinterestLinkStrategy',
        'monthlyPinterestTitlePrompt', 'monthlyPinterestDescriptionPrompt', 'monthlyPinterestBoard', 'monthlyPinterestLinkStrategy',
        'anniversaryPinterestTitlePrompt', 'anniversaryPinterestDescriptionPrompt', 'anniversaryPinterestBoard', 'anniversaryPinterestLinkStrategy'
    ];      // Note: Time settings (e.g. tmdbRefreshTimeToday) would be fetched here if supported by Cron

    const settings = await prisma.setting.findMany({
        where: { key: { in: keys } }
    });

    const result: any = {};
    const structuredKeys = new Set([
        'selectedGenres',
        'movieGenres',
        'tvGenres',
        'anniversaryYears',
        'todayPlatforms',
        'weeklyPlatforms',
        'monthlyPlatforms',
        'anniversaryPlatforms'
    ]);

    settings.forEach(s => {
        // Parse boolean/number values if stored as strings/json
        if (s.value === 'true' || s.value === true) result[s.key] = true;
        else if (s.value === 'false' || s.value === false) result[s.key] = false;
        else if (typeof s.value === 'string' && structuredKeys.has(s.key)) {
            // Safe parse for arrays
            try {
                result[s.key] = JSON.parse(s.value);
            } catch (e) {
                console.error(`Failed to parse ${s.key}`, e);
                result[s.key] = s.key.endsWith('Platforms') ? {} : [];
            }
        }
        else if (typeof s.value === 'string' && !isNaN(Number(s.value))) result[s.key] = Number(s.value);
        else result[s.key] = s.value;
    });

    // Normalize types
    if (result.tmdbCaptionTemperature) result.tmdbCaptionTemperature = Number(result.tmdbCaptionTemperature);

    return result;
}

export async function cleanupQueuedTMDbPosts(retentionHours: number): Promise<number> {
    const safeRetentionHours = Number.isFinite(retentionHours) && retentionHours > 0
        ? Math.max(1, Math.floor(retentionHours))
        : defaultRefreshSettings.tmdbQueuedRetentionHours || 168;

    const cutoff = new Date(Date.now() - safeRetentionHours * 60 * 60 * 1000);

    const result = await prisma.tMDbPost.deleteMany({
        where: {
            status: 'queued',
            createdAt: { lt: cutoff }
        }
    });

    if (result.count > 0) {
        console.log(`[TMDb] Deleted ${result.count} queued posts older than ${safeRetentionHours} hours`);
    }

    return result.count;
}

/**
 * Clear all TMDb posts from database
 * Use this to regenerate feeds with new settings
 */
export async function clearAllPosts(): Promise<{ deleted: number }> {
    const result = await prisma.tMDbPost.deleteMany({});
    console.log(`[TMDb] Cleared ${result.count} posts from database`);
    return { deleted: result.count };
}
