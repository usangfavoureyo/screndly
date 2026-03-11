import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import prisma from '../lib/prisma';
import sharp from 'sharp';
import aiService, { type AIModel, DEFAULT_OPENAI_MODEL, normalizeAIModel } from './ai.service';
import { uploadBufferToBackblaze } from './backblaze';
import { getTmdbApiKey } from './tmdb.service';

type LandscapePlatform = 'youtube' | 'x';

type LogoPosition =
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'center-left'
    | 'center'
    | 'center-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';

type TMDbFallbackMode =
    | 'use-youtube-thumbnail'
    | 'skip-upload'
    | 'backdrop-only'
    | 'poster-only';

interface PlatformSettingsValue {
    autoPost?: boolean;
    autoThumbnail?: boolean;
    autoCaption?: boolean;
    autoHashtag?: boolean;
    commentAutomation?: boolean;
}

interface TMDbSearchResult {
    id: number;
    media_type: 'movie' | 'tv';
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string;
    first_air_date?: string;
    popularity?: number;
}

interface TMDbImageAsset {
    file_path?: string | null;
    iso_639_1?: string | null;
    vote_average?: number;
    vote_count?: number;
    width?: number;
    height?: number;
    aspect_ratio?: number;
    file_type?: string | null;
}

interface TMDbCreditsPerson {
    name?: string;
    job?: string;
    department?: string;
}

interface TMDbProductionEntity {
    name?: string;
    origin_country?: string;
}

interface TMDbImageCollection {
    logos?: TMDbImageAsset[];
    posters?: TMDbImageAsset[];
    backdrops?: TMDbImageAsset[];
}

interface TMDbMovieDetails {
    id: number;
    title?: string;
    original_title?: string;
    overview?: string;
    release_date?: string;
    backdrop_path?: string | null;
    poster_path?: string | null;
    genres?: Array<{ id: number; name: string }>;
    production_companies?: TMDbProductionEntity[];
    production_countries?: Array<{ iso_3166_1: string; name?: string }>;
    release_dates?: {
        results?: Array<{
            iso_3166_1?: string;
        }>;
    };
    images?: TMDbImageCollection;
    credits?: {
        cast?: TMDbCreditsPerson[];
        crew?: TMDbCreditsPerson[];
    };
}

interface TMDbTVDetails {
    id: number;
    name?: string;
    original_name?: string;
    overview?: string;
    first_air_date?: string;
    backdrop_path?: string | null;
    poster_path?: string | null;
    genres?: Array<{ id: number; name: string }>;
    production_companies?: TMDbProductionEntity[];
    networks?: TMDbProductionEntity[];
    origin_country?: string[];
    production_countries?: Array<{ iso_3166_1: string; name?: string }>;
    content_ratings?: {
        results?: Array<{
            iso_3166_1?: string;
        }>;
    };
    images?: TMDbImageCollection;
    aggregate_credits?: {
        cast?: TMDbCreditsPerson[];
        crew?: TMDbCreditsPerson[];
    };
}

interface ThumbnailConfig {
    platform: LandscapePlatform;
    logoPosition: LogoPosition;
    autoScale: boolean;
    maxLogoSize: number;
    autoContrastBackdrop: boolean;
    autoContrastOverlay: boolean;
    showTrailerTypeText: boolean;
}

export interface LoadedVideoSettings {
    fetchInterval: number;
    postInterval: number;
    advancedFilters?: string;
    regionFilter?: string;
    excludeShorts: boolean;
    videoOpenaiModel: AIModel;
    videoUniversalCaptionPrompt?: string;
    videoYoutubeTitlePrompt?: string;
    videoYoutubeDescriptionPrompt?: string;
    videoYoutubePlaylistPrompt?: string;
    videoYoutubePlaylists?: string;
    videoFilterPrompt?: string;
    videoFilterCache: boolean;
    videoFilterTmdbValidation: boolean;
    videoTitleCleaningRegex?: string;
    videoTmdbFallback: TMDbFallbackMode;
    videoYoutubeXThumbnailPrompt?: string;
    videoSocialThumbnailPrompt?: string;
    videoPinterestTitlePrompt?: string;
    videoPinterestDescriptionPrompt?: string;
    videoPinterestBoard?: string;
    videoPinterestLinkStrategy?: string;
    videoPinterestDefaultLink?: string;
    platformSettings: Record<string, PlatformSettingsValue>;
    thumbnailConfigYoutube: ThumbnailConfig;
    thumbnailConfigX: ThumbnailConfig;
}

interface ResolvedTMDbMatch {
    tmdbId: number;
    mediaType: 'movie' | 'tv';
    title: string;
    aliases: string[];
    overview: string;
    releaseDate?: string;
    year?: number;
    genres: string[];
    allowedRegions: string[];
    castNames: string[];
    productionNames: string[];
    backdropUrl?: string;
    posterUrl?: string;
    logoUrl?: string;
}

export interface EnrichedVideoMetadata {
    cleanedTitle: string;
    trailerType?: string;
    tmdbMatch?: ResolvedTMDbMatch;
    regionAllowed: boolean;
    regionReason?: string;
}

export interface PlatformThumbnailAsset {
    localPath?: string;
    publicUrl?: string;
    sourceUrl?: string;
    strategy: string;
}

export interface PublishMetadata {
    title: string;
    description: string;
}

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';
const LANDSCAPE_DEFAULT_DIMENSIONS = { width: 1280, height: 720 };
const SOCIAL_DEFAULT_DIMENSIONS = { width: 1080, height: 1920 };
const METADATA_CACHE_TTL_MS = 60 * 60 * 1000;
const TITLE_STOPWORDS = new Set(['a', 'an', 'the']);
const TITLE_CUE_PATTERNS = [
    /\b(official|new|main|special|exclusive|international|red band|green band)\s+(trailer|teaser|clip|featurette|first look|inside look|special look|tv spot|character reveal|announcement)\b/i,
    /\b(final trailer|official trailer|official teaser|official clip|official featurette|official first look|official inside look|first look|inside look|special look|character reveal|announcement|teaser trailer|trailer|teaser|clip|featurette|tv spot)\b/i,
];
const MEDIA_TYPE_HINT_PATTERNS = {
    movie: /\b(movie|film|only in theaters|only in cinemas|in theaters|in cinemas)\b/i,
    tv: /\b(series|season|episode|streaming on|streaming this|premieres on|premiering on)\b/i,
};
const MIN_CONFIDENT_TMDB_SCORE = 420;
const MIN_CONFIDENT_TITLE_SIMILARITY = 0.72;
const MIN_TMBD_SCORE_GAP = 55;

const VIDEO_SETTINGS_KEYS = [
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
    'videoFilterPrompt',
    'videoFilterCache',
    'videoFilterTmdbValidation',
    'videoTitleCleaningRegex',
    'videoTmdbFallback',
    'videoYoutubeXThumbnailPrompt',
    'videoSocialThumbnailPrompt',
    'videoPinterestTitlePrompt',
    'videoPinterestDescriptionPrompt',
    'videoPinterestBoard',
    'videoPinterestLinkStrategy',
    'videoPinterestDefaultLink',
    'platformSettings',
    'thumbnailConfig_youtube',
    'thumbnailConfig_x',
] as const;

const DEFAULT_THUMBNAIL_CONFIG: Record<LandscapePlatform, ThumbnailConfig> = {
    youtube: {
        platform: 'youtube',
        logoPosition: 'bottom-right',
        autoScale: true,
        maxLogoSize: 40,
        autoContrastBackdrop: true,
        autoContrastOverlay: true,
        showTrailerTypeText: false,
    },
    x: {
        platform: 'x',
        logoPosition: 'bottom-right',
        autoScale: true,
        maxLogoSize: 40,
        autoContrastBackdrop: true,
        autoContrastOverlay: true,
        showTrailerTypeText: false,
    },
};

const videoMetadataCache = new Map<string, { expiresAt: number; value: EnrichedVideoMetadata }>();

function asString(value: unknown): string | undefined {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
    }

    return undefined;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        if (value === 'true') return true;
        if (value === 'false') return false;
    }
    if (typeof value === 'number') return value !== 0;
    return fallback;
}

function asNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

function parseJsonValue<T>(value: unknown): T | null {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }

    if (typeof value === 'object') {
        return value as T;
    }

    return null;
}

function parsePlatformSettings(value: unknown): Record<string, PlatformSettingsValue> {
    return parseJsonValue<Record<string, PlatformSettingsValue>>(value) || {};
}

function parseThumbnailConfig(platform: LandscapePlatform, value: unknown): ThumbnailConfig {
    const parsed = parseJsonValue<Partial<ThumbnailConfig>>(value);
    return {
        ...DEFAULT_THUMBNAIL_CONFIG[platform],
        ...(parsed || {}),
        platform,
    };
}

function normalizeText(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function sanitizeFileName(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'asset';
}

function extractYear(value?: string): number | undefined {
    if (!value) return undefined;
    const match = value.match(/\b(19|20)\d{2}\b/);
    if (!match) return undefined;
    const parsed = Number.parseInt(match[0], 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function trimDecorativeSeparators(value: string): string {
    return value
        .replace(/^[\s|:;\-\u2013\u2014\u2022]+/g, '')
        .replace(/[\s|:;\-\u2013\u2014\u2022]+$/g, '')
        .trim();
}

function buildSearchQueries(cleanedTitle: string): string[] {
    const variants = [
        cleanedTitle,
        cleanedTitle.replace(/\(\s*(19|20)\d{2}\s*\)/g, ' ').replace(/\b(19|20)\d{2}\b/g, ' ').replace(/\s+/g, ' ').trim(),
        cleanedTitle.replace(/^['"\u201c\u201d\u2018\u2019]+|['"\u201c\u201d\u2018\u2019]+$/g, '').trim(),
    ];

    const seen = new Set<string>();
    const queries: string[] = [];
    for (const variant of variants) {
        const normalized = normalizeText(variant);
        if (!normalized || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        queries.push(variant);
    }

    return queries;
}

function tokenizeTitle(value: string): string[] {
    return normalizeText(value)
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token && !TITLE_STOPWORDS.has(token));
}

function computeTitleSimilarity(left: string, right: string): {
    exact: boolean;
    prefix: boolean;
    coverage: number;
    precision: number;
    jaccard: number;
} {
    const leftNormalized = normalizeText(left);
    const rightNormalized = normalizeText(right);
    const leftTokens = tokenizeTitle(left);
    const rightTokens = tokenizeTitle(right);
    if (!leftTokens.length || !rightTokens.length) {
        return {
            exact: leftNormalized === rightNormalized && Boolean(leftNormalized),
            prefix: leftNormalized.startsWith(rightNormalized) || rightNormalized.startsWith(leftNormalized),
            coverage: 0,
            precision: 0,
            jaccard: 0,
        };
    }

    const leftSet = new Set(leftTokens);
    const rightSet = new Set(rightTokens);
    const intersection = leftTokens.filter((token) => rightSet.has(token));
    const union = new Set([...leftTokens, ...rightTokens]);

    return {
        exact: leftNormalized === rightNormalized,
        prefix: leftNormalized.startsWith(rightNormalized) || rightNormalized.startsWith(leftNormalized),
        coverage: intersection.length / leftSet.size,
        precision: intersection.length / rightSet.size,
        jaccard: intersection.length / union.size,
    };
}

function getBestAliasSimilarity(aliases: string[], targetTitle: string) {
    return aliases.reduce((best, alias) => {
        const similarity = computeTitleSimilarity(alias, targetTitle);
        const score = (similarity.exact ? 1000 : 0)
            + (similarity.prefix ? 150 : 0)
            + similarity.coverage * 260
            + similarity.precision * 180
            + similarity.jaccard * 140;
        if (!best || score > best.score) {
            return { alias, similarity, score };
        }
        return best;
    }, null as null | {
        alias: string;
        similarity: ReturnType<typeof computeTitleSimilarity>;
        score: number;
    });
}

function countNamedOverlap(names: string[], haystack: string): number {
    const normalizedHaystack = normalizeText(haystack);
    const seen = new Set<string>();

    return names.reduce((count, name) => {
        const normalized = normalizeText(name);
        if (!normalized || normalized.split(' ').length < 2 || seen.has(normalized)) {
            return count;
        }
        seen.add(normalized);
        return normalizedHaystack.includes(normalized) ? count + 1 : count;
    }, 0);
}

function detectMediaTypeHint(title: string, description: string): 'movie' | 'tv' | undefined {
    const haystack = `${title}\n${description}`;
    if (MEDIA_TYPE_HINT_PATTERNS.tv.test(haystack)) {
        return 'tv';
    }
    if (MEDIA_TYPE_HINT_PATTERNS.movie.test(haystack)) {
        return 'movie';
    }
    return undefined;
}

function selectBestImageAsset(
    primaryPath: string | null | undefined,
    assets: TMDbImageAsset[] | undefined,
    preferredLanguages: Array<string | null>
): string | undefined {
    if (primaryPath) {
        return `${TMDB_IMAGE_BASE_URL}${primaryPath}`;
    }

    if (!Array.isArray(assets) || assets.length === 0) {
        return undefined;
    }

    const ranked = [...assets]
        .filter((asset) => asset.file_path)
        .sort((left, right) => {
            const leftLanguageRank = preferredLanguages.indexOf(left.iso_639_1 ?? null);
            const rightLanguageRank = preferredLanguages.indexOf(right.iso_639_1 ?? null);
            const leftScore = (leftLanguageRank === -1 ? 0 : 200 - leftLanguageRank * 50)
                + (left.vote_average || 0) * 10
                + (left.vote_count || 0)
                + ((left.width || 0) * (left.height || 0)) / 100000;
            const rightScore = (rightLanguageRank === -1 ? 0 : 200 - rightLanguageRank * 50)
                + (right.vote_average || 0) * 10
                + (right.vote_count || 0)
                + ((right.width || 0) * (right.height || 0)) / 100000;
            return rightScore - leftScore;
        });

    const best = ranked[0];
    return best?.file_path ? `${TMDB_IMAGE_BASE_URL}${best.file_path}` : undefined;
}

function selectLogo(logos?: TMDbImageAsset[]): string | undefined {
    return selectBestImageAsset(undefined, logos, ['en', null]);
}

function scoreSearchCandidate(candidate: TMDbSearchResult, cleanedTitle: string, targetYear?: number): number {
    const aliases = [
        candidate.title,
        candidate.name,
        candidate.original_title,
        candidate.original_name,
    ].filter((value): value is string => Boolean(value));
    const bestAlias = getBestAliasSimilarity(aliases, cleanedTitle);
    let score = bestAlias?.score || 0;

    const candidateYear = extractYear(candidate.release_date || candidate.first_air_date);
    if (targetYear && candidateYear) {
        const difference = Math.abs(candidateYear - targetYear);
        if (difference === 0) {
            score += 220;
        } else if (difference === 1) {
            score += 150;
        } else if (difference === 2) {
            score += 90;
        } else if (difference === 3) {
            score += 30;
        } else {
            score -= Math.min(220, (difference - 3) * 35);
        }
    }

    score += Math.min(candidate.popularity || 0, 80) / 2;
    return score;
}

function detectTrailerType(title: string): string | undefined {
    const normalized = title.toLowerCase();
    if (normalized.includes('teaser')) return 'Teaser';
    if (normalized.includes('first look')) return 'First Look';
    if (normalized.includes('final trailer')) return 'Final Trailer';
    if (normalized.includes('clip')) return 'Clip';
    if (normalized.includes('trailer')) return 'Trailer';
    return undefined;
}

export function cleanVideoTitle(title: string, regexPattern?: string): string {
    let cleaned = title;

    if (regexPattern) {
        try {
            cleaned = cleaned.replace(new RegExp(regexPattern, 'i'), '');
        } catch (error) {
            console.warn('[VideoEnrichment] Invalid title cleaning regex:', error);
        }
    }

    let earliestCueIndex = -1;
    for (const pattern of TITLE_CUE_PATTERNS) {
        const match = pattern.exec(cleaned);
        if (match && match.index > 0 && (earliestCueIndex === -1 || match.index < earliestCueIndex)) {
            earliestCueIndex = match.index;
        }
    }

    if (earliestCueIndex > 0) {
        cleaned = cleaned.slice(0, earliestCueIndex);
    }

    return trimDecorativeSeparators(
        cleaned
        .replace(/\[[^\]]+\]/g, ' ')
        .replace(/\((official|trailer|teaser|clip|featurette|first look|inside look|tv spot)[^)]*\)/gi, ' ')
        .replace(/\[[^\]]+\]/g, ' ')
        .replace(/\([^)]*(4k|hd|uhd|imax)[^)]*\)/gi, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^['"\u201c\u201d\u2018\u2019]+|['"\u201c\u201d\u2018\u2019]+$/g, '')
        .trim()
    );
}

function parseDimensionOverride(prompt: string | undefined, fallback: { width: number; height: number }) {
    if (!prompt) return fallback;

    const match = prompt.match(/(\d{3,4})\s*x\s*(\d{3,4})/i);
    if (!match) {
        return fallback;
    }

    const width = Number.parseInt(match[1], 10);
    const height = Number.parseInt(match[2], 10);
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
        return fallback;
    }

    return { width, height };
}

function escapeSvg(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function writeTempFile(fileName: string, buffer: Buffer): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'screndly-video-'));
    const filePath = path.join(tempDir, fileName);
    await fs.writeFile(filePath, buffer);
    return filePath;
}

async function fetchBuffer(sourceUrl: string): Promise<Buffer> {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch remote asset: ${response.status} ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const apiKey = await getTmdbApiKey();
    if (!apiKey) {
        throw new Error('TMDb API key not configured');
    }

    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', apiKey);
    Object.entries(params).forEach(([key, value]) => {
        if (value) {
            url.searchParams.set(key, value);
        }
    });

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`TMDb request failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
}

async function fetchResolvedMatch(candidate: TMDbSearchResult): Promise<ResolvedTMDbMatch | null> {
    if (candidate.media_type === 'movie') {
        const details = await tmdbFetch<TMDbMovieDetails>(`/movie/${candidate.id}`, {
            append_to_response: 'images,release_dates,credits',
            include_image_language: 'en,null',
        });

        return {
            tmdbId: details.id,
            mediaType: 'movie',
            title: details.title || candidate.title || 'Unknown title',
            aliases: [
                details.title,
                details.original_title,
                candidate.title,
                candidate.original_title,
            ].filter((value): value is string => Boolean(asString(value))),
            overview: details.overview || candidate.overview || '',
            releaseDate: details.release_date || candidate.release_date,
            year: extractYear(details.release_date || candidate.release_date),
            genres: (details.genres || []).map((genre) => genre.name),
            allowedRegions: [
                ...(details.production_countries || []).map((country) => country.iso_3166_1).filter(Boolean),
                ...((details.release_dates?.results || []).map((entry) => entry.iso_3166_1).filter(Boolean) as string[]),
            ],
            castNames: (details.credits?.cast || [])
                .map((person) => asString(person.name))
                .filter((value): value is string => Boolean(value))
                .slice(0, 8),
            productionNames: (details.production_companies || [])
                .map((company) => asString(company.name))
                .filter((value): value is string => Boolean(value)),
            backdropUrl: selectBestImageAsset(details.backdrop_path, details.images?.backdrops, [null, 'en']),
            posterUrl: selectBestImageAsset(details.poster_path, details.images?.posters, ['en', null]),
            logoUrl: selectLogo(details.images?.logos),
        };
    }

    const details = await tmdbFetch<TMDbTVDetails>(`/tv/${candidate.id}`, {
        append_to_response: 'images,content_ratings,aggregate_credits',
        include_image_language: 'en,null',
    });

    return {
        tmdbId: details.id,
        mediaType: 'tv',
        title: details.name || candidate.name || 'Unknown title',
        aliases: [
            details.name,
            details.original_name,
            candidate.name,
            candidate.original_name,
        ].filter((value): value is string => Boolean(asString(value))),
        overview: details.overview || candidate.overview || '',
        releaseDate: details.first_air_date || candidate.first_air_date,
        year: extractYear(details.first_air_date || candidate.first_air_date),
        genres: (details.genres || []).map((genre) => genre.name),
        allowedRegions: [
            ...(details.origin_country || []).filter(Boolean),
            ...(details.production_countries || []).map((country) => country.iso_3166_1).filter(Boolean),
            ...((details.content_ratings?.results || []).map((entry) => entry.iso_3166_1).filter(Boolean) as string[]),
        ],
        castNames: (details.aggregate_credits?.cast || [])
            .map((person) => asString(person.name))
            .filter((value): value is string => Boolean(value))
            .slice(0, 8),
        productionNames: [
            ...(details.production_companies || []).map((company) => asString(company.name)),
            ...(details.networks || []).map((network) => asString(network.name)),
        ].filter((value): value is string => Boolean(value)),
        backdropUrl: selectBestImageAsset(details.backdrop_path, details.images?.backdrops, [null, 'en']),
        posterUrl: selectBestImageAsset(details.poster_path, details.images?.posters, ['en', null]),
        logoUrl: selectLogo(details.images?.logos),
    };
}

function parseRegionFilter(value?: string): string[] {
    if (!value) return [];

    return value
        .split(',')
        .map((entry) => entry.trim().toUpperCase())
        .filter(Boolean);
}

function isRegionMatch(match: ResolvedTMDbMatch | undefined, allowedRegions: string[]): boolean {
    if (allowedRegions.length === 0) {
        return true;
    }

    if (!match) {
        return false;
    }

    const regions = match.allowedRegions.map((entry) => entry.toUpperCase());
    return allowedRegions.some((region) => regions.includes(region));
}

function buildMetadataCacheKey(videoId: string, title: string, settings: LoadedVideoSettings): string {
    return [
        videoId,
        normalizeText(title),
        settings.regionFilter || '',
        settings.videoTitleCleaningRegex || '',
        settings.videoFilterTmdbValidation ? 'tmdb-on' : 'tmdb-off',
    ].join('::');
}

function scoreResolvedMatch(
    match: ResolvedTMDbMatch,
    searchCandidate: TMDbSearchResult,
    context: {
        cleanedTitle: string;
        haystack: string;
        targetYear?: number;
        mediaTypeHint?: 'movie' | 'tv';
        allowedRegions: string[];
    }
): { score: number; titleSimilarity: number } {
    const aliasMatch = getBestAliasSimilarity(match.aliases, context.cleanedTitle);
    const similarity = aliasMatch
        ? Math.max(aliasMatch.similarity.coverage, aliasMatch.similarity.precision, aliasMatch.similarity.jaccard)
        : 0;
    let score = aliasMatch?.score || 0;

    if (context.targetYear && match.year) {
        const difference = Math.abs(context.targetYear - match.year);
        if (difference === 0) {
            score += 220;
        } else if (difference === 1) {
            score += 150;
        } else if (difference === 2) {
            score += 90;
        } else if (difference === 3) {
            score += 30;
        } else {
            score -= Math.min(220, (difference - 3) * 35);
        }
    }

    if (context.mediaTypeHint) {
        score += context.mediaTypeHint === match.mediaType ? 80 : -35;
    }

    const castOverlap = countNamedOverlap(match.castNames, context.haystack);
    const productionOverlap = countNamedOverlap(match.productionNames, context.haystack);
    score += castOverlap * 70;
    score += productionOverlap * 55;

    if (match.posterUrl) score += 20;
    if (match.backdropUrl) score += 20;
    if (match.logoUrl) score += 15;

    if (context.allowedRegions.length > 0) {
        score += isRegionMatch(match, context.allowedRegions) ? 40 : -25;
    }

    score += Math.min(searchCandidate.popularity || 0, 80) / 2;

    if (similarity < 0.5) {
        score -= 220;
    } else if (similarity < 0.65) {
        score -= 80;
    }

    return {
        score,
        titleSimilarity: similarity,
    };
}

function normalizeGeneratedText(content: string): string {
    const trimmed = content
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            for (const value of Object.values(parsed)) {
                if (typeof value === 'string' && value.trim()) {
                    return value.trim();
                }
            }
        } catch {
            // Treat as plain text.
        }
    }

    return trimmed.replace(/^"|"$/g, '');
}

function buildContextBlock(
    originalTitle: string,
    cleanedTitle: string,
    description: string,
    trailerType: string | undefined,
    tmdbMatch?: ResolvedTMDbMatch
): string {
    return [
        `Original YouTube Title: ${originalTitle}`,
        `Cleaned Title: ${cleanedTitle}`,
        `Trailer Type: ${trailerType || 'Unknown'}`,
        `YouTube Description: ${description.slice(0, 2000) || 'N/A'}`,
        tmdbMatch ? `TMDb Title: ${tmdbMatch.title}` : 'TMDb Title: N/A',
        tmdbMatch?.mediaType ? `TMDb Media Type: ${tmdbMatch.mediaType}` : 'TMDb Media Type: Unknown',
        tmdbMatch?.releaseDate ? `Release Date: ${tmdbMatch.releaseDate}` : 'Release Date: Unknown',
        tmdbMatch?.overview ? `TMDb Overview: ${tmdbMatch.overview.slice(0, 1500)}` : 'TMDb Overview: N/A',
        tmdbMatch?.genres?.length ? `Genres: ${tmdbMatch.genres.join(', ')}` : 'Genres: Unknown',
    ].join('\n');
}

function getLogoPlacement(
    position: LogoPosition,
    overlayWidth: number,
    overlayHeight: number,
    canvasWidth: number,
    canvasHeight: number
): { left: number; top: number } {
    const margin = 36;
    const centerX = Math.round((canvasWidth - overlayWidth) / 2);
    const centerY = Math.round((canvasHeight - overlayHeight) / 2);

    switch (position) {
        case 'top-left':
            return { left: margin, top: margin };
        case 'top-center':
            return { left: centerX, top: margin };
        case 'top-right':
            return { left: canvasWidth - overlayWidth - margin, top: margin };
        case 'center-left':
            return { left: margin, top: centerY };
        case 'center':
            return { left: centerX, top: centerY };
        case 'center-right':
            return { left: canvasWidth - overlayWidth - margin, top: centerY };
        case 'bottom-left':
            return { left: margin, top: canvasHeight - overlayHeight - margin };
        case 'bottom-center':
            return { left: centerX, top: canvasHeight - overlayHeight - margin };
        case 'bottom-right':
        default:
            return { left: canvasWidth - overlayWidth - margin, top: canvasHeight - overlayHeight - margin };
    }
}

function buildTrailerTypeOverlay(
    trailerType: string,
    canvasWidth: number
): Buffer {
    const text = escapeSvg(trailerType.toUpperCase());
    const svg = `
        <svg width="${canvasWidth}" height="120" xmlns="http://www.w3.org/2000/svg">
          <rect x="36" y="24" rx="18" ry="18" width="${Math.max(220, trailerType.length * 22)}" height="56" fill="rgba(0,0,0,0.72)" />
          <text x="64" y="61" fill="#ffffff" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="700">${text}</text>
        </svg>
    `;

    return Buffer.from(svg);
}

function buildOverlayBackdrop(
    canvasWidth: number,
    canvasHeight: number,
    top: number,
    left: number,
    boxWidth: number,
    boxHeight: number
): Buffer {
    const svg = `
        <svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect x="${left}" y="${top}" rx="24" ry="24" width="${boxWidth}" height="${boxHeight}" fill="rgba(0,0,0,0.45)" />
        </svg>
    `;

    return Buffer.from(svg);
}

async function uploadGeneratedAsset(buffer: Buffer, name: string, prefix: string): Promise<string | undefined> {
    try {
        const uploaded = await uploadBufferToBackblaze(buffer, name, {
            bucketTypes: ['design', 'general'],
            prefix,
            contentType: 'image/jpeg',
        });
        return uploaded.url;
    } catch (error) {
        console.warn('[VideoEnrichment] Failed to upload generated asset:', error);
        return undefined;
    }
}

function shouldUseTMDb(settings: LoadedVideoSettings): boolean {
    return Boolean(
        settings.regionFilter
        || settings.videoFilterTmdbValidation
        || settings.videoYoutubeTitlePrompt
        || settings.videoYoutubeDescriptionPrompt
        || settings.videoYoutubeXThumbnailPrompt
        || settings.videoSocialThumbnailPrompt
        || settings.videoTmdbFallback
    );
}

export async function getYouTubeRuntimeSettings(): Promise<LoadedVideoSettings> {
    const settings = await prisma.setting.findMany({
        where: { key: { in: [...VIDEO_SETTINGS_KEYS] } },
    });

    const map = new Map(settings.map((entry) => [entry.key, entry.value]));

    return {
        fetchInterval: Math.max(1, asNumber(map.get('fetchInterval'), 10)),
        postInterval: Math.max(1, asNumber(map.get('postInterval'), 10)),
        advancedFilters: asString(map.get('advancedFilters')),
        regionFilter: asString(map.get('regionFilter')),
        excludeShorts: asBoolean(map.get('excludeShorts'), true),
    videoOpenaiModel: normalizeAIModel(asString(map.get('videoOpenaiModel'))),
        videoUniversalCaptionPrompt: asString(map.get('videoUniversalCaptionPrompt')),
        videoYoutubeTitlePrompt: asString(map.get('videoYoutubeTitlePrompt')),
        videoYoutubeDescriptionPrompt: asString(map.get('videoYoutubeDescriptionPrompt')),
        videoYoutubePlaylistPrompt: asString(map.get('videoYoutubePlaylistPrompt')),
        videoYoutubePlaylists: asString(map.get('videoYoutubePlaylists')),
        videoFilterPrompt: asString(map.get('videoFilterPrompt')),
        videoFilterCache: asBoolean(map.get('videoFilterCache'), true),
        videoFilterTmdbValidation: asBoolean(map.get('videoFilterTmdbValidation'), true),
        videoTitleCleaningRegex: asString(map.get('videoTitleCleaningRegex')),
        videoTmdbFallback: (asString(map.get('videoTmdbFallback')) as TMDbFallbackMode) || 'use-youtube-thumbnail',
        videoYoutubeXThumbnailPrompt: asString(map.get('videoYoutubeXThumbnailPrompt')),
        videoSocialThumbnailPrompt: asString(map.get('videoSocialThumbnailPrompt')),
        videoPinterestTitlePrompt: asString(map.get('videoPinterestTitlePrompt')),
        videoPinterestDescriptionPrompt: asString(map.get('videoPinterestDescriptionPrompt')),
        videoPinterestBoard: asString(map.get('videoPinterestBoard')),
        videoPinterestLinkStrategy: asString(map.get('videoPinterestLinkStrategy')),
        videoPinterestDefaultLink: asString(map.get('videoPinterestDefaultLink')),
        platformSettings: parsePlatformSettings(map.get('platformSettings')),
        thumbnailConfigYoutube: parseThumbnailConfig('youtube', map.get('thumbnailConfig_youtube')),
        thumbnailConfigX: parseThumbnailConfig('x', map.get('thumbnailConfig_x')),
    };
}

export async function enrichYouTubeVideoMetadata(
    videoId: string,
    title: string,
    description: string,
    settings: LoadedVideoSettings,
    channelName?: string
): Promise<EnrichedVideoMetadata> {
    const cleanedTitle = cleanVideoTitle(title, settings.videoTitleCleaningRegex);
    const trailerType = detectTrailerType(title);
    const allowedRegions = parseRegionFilter(settings.regionFilter);
    const cacheKey = buildMetadataCacheKey(videoId, title, settings);

    if (settings.videoFilterCache) {
        const cached = videoMetadataCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }
    }

    const defaultResult: EnrichedVideoMetadata = {
        cleanedTitle,
        trailerType,
        regionAllowed: allowedRegions.length === 0,
        regionReason: allowedRegions.length === 0 ? undefined : 'TMDb metadata not resolved for region filter.',
    };

    if (!shouldUseTMDb(settings)) {
        return defaultResult;
    }

    try {
        const targetYear = extractYear(title) || extractYear(description);
        const mediaTypeHint = detectMediaTypeHint(title, description);
        const queries = buildSearchQueries(cleanedTitle);
        const searchResponses = await Promise.all(
            queries.map((query) => tmdbFetch<{ results?: TMDbSearchResult[] }>('/search/multi', {
                query,
                language: 'en-US',
                include_adult: 'false',
                page: '1',
            }))
        );

        const dedupedCandidates = new Map<string, TMDbSearchResult>();
        for (const response of searchResponses) {
            for (const candidate of response.results || []) {
                if (candidate.media_type !== 'movie' && candidate.media_type !== 'tv') {
                    continue;
                }

                const key = `${candidate.media_type}:${candidate.id}`;
                const existing = dedupedCandidates.get(key);
                if (!existing || scoreSearchCandidate(candidate, cleanedTitle, targetYear) > scoreSearchCandidate(existing, cleanedTitle, targetYear)) {
                    dedupedCandidates.set(key, candidate);
                }
            }
        }

        const candidates = [...dedupedCandidates.values()]
            .sort((left, right) => scoreSearchCandidate(right, cleanedTitle, targetYear) - scoreSearchCandidate(left, cleanedTitle, targetYear))
            .slice(0, 8);

        const haystack = [title, description, channelName].filter(Boolean).join('\n');
        const resolvedCandidates = await Promise.all(
            candidates.map(async (candidate) => {
                const resolved = await fetchResolvedMatch(candidate);
                if (!resolved) {
                    return null;
                }

                const scored = scoreResolvedMatch(resolved, candidate, {
                    cleanedTitle,
                    haystack,
                    targetYear,
                    mediaTypeHint,
                    allowedRegions,
                });

                return {
                    match: resolved,
                    score: scored.score,
                    titleSimilarity: scored.titleSimilarity,
                    regionMatched: isRegionMatch(resolved, allowedRegions),
                };
            })
        );

        const rankedMatches = resolvedCandidates
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
            .sort((left, right) => right.score - left.score);

        const topMatch = rankedMatches[0];
        const runnerUp = rankedMatches[1];
        const matched = topMatch
            && topMatch.score >= MIN_CONFIDENT_TMDB_SCORE
            && topMatch.titleSimilarity >= MIN_CONFIDENT_TITLE_SIMILARITY
            && (
                !runnerUp
                || topMatch.score - runnerUp.score >= MIN_TMBD_SCORE_GAP
                || topMatch.titleSimilarity >= 0.95
            )
                ? topMatch.match
                : undefined;

        const enriched: EnrichedVideoMetadata = {
            cleanedTitle,
            trailerType,
            tmdbMatch: matched,
            regionAllowed: isRegionMatch(matched, allowedRegions),
            regionReason: allowedRegions.length > 0 && !isRegionMatch(matched, allowedRegions)
                ? `TMDb regions ${matched?.allowedRegions.join(', ') || 'unknown'} do not match ${allowedRegions.join(', ')}.`
                : undefined,
        };

        if (settings.videoFilterCache) {
            videoMetadataCache.set(cacheKey, {
                expiresAt: Date.now() + METADATA_CACHE_TTL_MS,
                value: enriched,
            });
        }

        return enriched;
    } catch (error) {
        console.error('[VideoEnrichment] Failed to resolve TMDb metadata:', error);
        return defaultResult;
    }
}

export async function generateYouTubePublishMetadata(
    originalTitle: string,
    description: string,
    metadata: EnrichedVideoMetadata,
    settings: LoadedVideoSettings
): Promise<PublishMetadata> {
    const context = buildContextBlock(
        originalTitle,
        metadata.cleanedTitle,
        description,
        metadata.trailerType,
        metadata.tmdbMatch
    );

    const model = settings.videoOpenaiModel || DEFAULT_OPENAI_MODEL;

    const [titleResponse, descriptionResponse] = await Promise.all([
        aiService.generateCompletion({
            model,
            systemPrompt: settings.videoYoutubeTitlePrompt,
            prompt: `${context}\n\nGenerate the final YouTube upload title only.`,
            maxTokens: 120,
            temperature: 0.4,
        }),
        aiService.generateCompletion({
            model,
            systemPrompt: settings.videoYoutubeDescriptionPrompt,
            prompt: `${context}\n\nGenerate the final YouTube upload description only.`,
            maxTokens: 500,
            temperature: 0.6,
        }),
    ]);

    return {
        title: titleResponse.success ? normalizeGeneratedText(titleResponse.content) : (metadata.tmdbMatch?.title || originalTitle),
        description: descriptionResponse.success
            ? normalizeGeneratedText(descriptionResponse.content)
            : [metadata.tmdbMatch?.overview, description].filter(Boolean).join('\n\n').trim() || originalTitle,
    };
}

export async function generateLandscapeThumbnail(
    platform: LandscapePlatform,
    originalTitle: string,
    metadata: EnrichedVideoMetadata,
    sourceThumbnailUrl: string | undefined,
    settings: LoadedVideoSettings
): Promise<PlatformThumbnailAsset | null> {
    try {
        const dimensions = parseDimensionOverride(settings.videoYoutubeXThumbnailPrompt, LANDSCAPE_DEFAULT_DIMENSIONS);
        const config = platform === 'youtube' ? settings.thumbnailConfigYoutube : settings.thumbnailConfigX;
        const match = metadata.tmdbMatch;

        let baseUrl = match?.backdropUrl;
        let logoUrl = match?.logoUrl;

        if (!baseUrl) {
            switch (settings.videoTmdbFallback) {
                case 'poster-only':
                    baseUrl = match?.posterUrl;
                    logoUrl = undefined;
                    break;
                case 'use-youtube-thumbnail':
                    baseUrl = sourceThumbnailUrl;
                    logoUrl = undefined;
                    break;
                case 'backdrop-only':
                    baseUrl = match?.backdropUrl;
                    logoUrl = undefined;
                    break;
                case 'skip-upload':
                    return null;
            }
        } else if (!logoUrl && settings.videoTmdbFallback === 'poster-only' && match?.posterUrl) {
            baseUrl = match.posterUrl;
        }

        if (!baseUrl) {
            return null;
        }

        const baseBuffer = await fetchBuffer(baseUrl);
        let image = sharp(baseBuffer).resize(dimensions.width, dimensions.height, {
            fit: 'cover',
            position: 'centre',
        });

        const composites: sharp.OverlayOptions[] = [];

        if (config.autoContrastBackdrop) {
            const gradientSvg = Buffer.from(`
            <svg width="${dimensions.width}" height="${dimensions.height}" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="rgba(0,0,0,0.05)" />
                  <stop offset="100%" stop-color="rgba(0,0,0,0.35)" />
                </linearGradient>
              </defs>
              <rect width="${dimensions.width}" height="${dimensions.height}" fill="url(#g)" />
            </svg>
        `);
            composites.push({ input: gradientSvg, top: 0, left: 0 });
        }

        if (logoUrl) {
            try {
                const logoBuffer = await fetchBuffer(logoUrl);
                const logoImage = sharp(logoBuffer);
                const logoMetadata = await logoImage.metadata();

                if (logoMetadata.width && logoMetadata.height) {
                    const maxWidth = Math.round(dimensions.width * (Math.max(10, config.maxLogoSize) / 100));
                    const maxHeight = Math.round(dimensions.height * 0.25);
                    const resizedLogo = await logoImage
                        .resize({
                            width: Math.max(120, maxWidth),
                            height: Math.max(80, maxHeight),
                            fit: config.autoScale ? 'inside' : 'contain',
                            withoutEnlargement: !config.autoScale,
                        })
                        .png()
                        .toBuffer();

                    const resizedMetadata = await sharp(resizedLogo).metadata();
                    const overlayWidth = resizedMetadata.width || maxWidth;
                    const overlayHeight = resizedMetadata.height || maxHeight;
                    const placement = getLogoPlacement(
                        config.logoPosition,
                        overlayWidth,
                        overlayHeight,
                        dimensions.width,
                        dimensions.height
                    );

                    if (config.autoContrastOverlay) {
                        composites.push({
                            input: buildOverlayBackdrop(
                                dimensions.width,
                                dimensions.height,
                                Math.max(0, placement.top - 18),
                                Math.max(0, placement.left - 18),
                                overlayWidth + 36,
                                overlayHeight + 36
                            ),
                            top: 0,
                            left: 0,
                        });
                    }

                    composites.push({
                        input: resizedLogo,
                        top: placement.top,
                        left: placement.left,
                    });
                }
            } catch (error) {
                console.warn('[VideoEnrichment] Failed to apply TMDb logo overlay:', error);
            }
        }

        if (config.showTrailerTypeText && metadata.trailerType) {
            composites.push({
                input: buildTrailerTypeOverlay(metadata.trailerType, dimensions.width),
                top: 0,
                left: 0,
            });
        }

        if (composites.length > 0) {
            image = image.composite(composites);
        }

        const finalBuffer = await image.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
        const fileName = `${sanitizeFileName(originalTitle)}-${platform}.jpg`;
        const localPath = await writeTempFile(fileName, finalBuffer);
        const publicUrl = await uploadGeneratedAsset(finalBuffer, fileName, 'generated-thumbnails/video');

        return {
            localPath,
            publicUrl,
            sourceUrl: baseUrl,
            strategy: logoUrl ? 'tmdb_backdrop_logo' : 'fallback_base_only',
        };
    } catch (error) {
        console.error(`[VideoEnrichment] Failed to generate ${platform} thumbnail:`, error);
        return null;
    }
}

export async function generateSocialPosterThumbnail(
    originalTitle: string,
    metadata: EnrichedVideoMetadata,
    sourceThumbnailUrl: string | undefined,
    settings: LoadedVideoSettings
): Promise<PlatformThumbnailAsset | null> {
    try {
        const dimensions = parseDimensionOverride(settings.videoSocialThumbnailPrompt, SOCIAL_DEFAULT_DIMENSIONS);
        const posterUrl = metadata.tmdbMatch?.posterUrl
            || (settings.videoTmdbFallback === 'use-youtube-thumbnail' ? sourceThumbnailUrl : undefined);

        if (!posterUrl) {
            return null;
        }

        const posterBuffer = await fetchBuffer(posterUrl);
        const finalBuffer = await sharp(posterBuffer)
            .resize(dimensions.width, dimensions.height, {
                fit: 'cover',
                position: 'centre',
            })
            .jpeg({ quality: 88, mozjpeg: true })
            .toBuffer();

        const fileName = `${sanitizeFileName(originalTitle)}-social.jpg`;
        const localPath = await writeTempFile(fileName, finalBuffer);
        const publicUrl = await uploadGeneratedAsset(finalBuffer, fileName, 'generated-thumbnails/social');

        return {
            localPath,
            publicUrl: publicUrl || posterUrl,
            sourceUrl: posterUrl,
            strategy: metadata.tmdbMatch?.posterUrl ? 'tmdb_poster' : 'youtube_fallback',
        };
    } catch (error) {
        console.error('[VideoEnrichment] Failed to generate social poster thumbnail:', error);
        return null;
    }
}
