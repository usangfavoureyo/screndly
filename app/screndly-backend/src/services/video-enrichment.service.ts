import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import prisma from '../lib/prisma';
import sharp from 'sharp';
import aiService, { type AIModel } from './ai.service';
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
    width?: number;
    height?: number;
}

interface TMDbMovieDetails {
    id: number;
    title?: string;
    overview?: string;
    release_date?: string;
    backdrop_path?: string | null;
    poster_path?: string | null;
    genres?: Array<{ id: number; name: string }>;
    production_countries?: Array<{ iso_3166_1: string; name?: string }>;
    release_dates?: {
        results?: Array<{
            iso_3166_1?: string;
        }>;
    };
    images?: {
        logos?: TMDbImageAsset[];
    };
}

interface TMDbTVDetails {
    id: number;
    name?: string;
    overview?: string;
    first_air_date?: string;
    backdrop_path?: string | null;
    poster_path?: string | null;
    genres?: Array<{ id: number; name: string }>;
    origin_country?: string[];
    production_countries?: Array<{ iso_3166_1: string; name?: string }>;
    content_ratings?: {
        results?: Array<{
            iso_3166_1?: string;
        }>;
    };
    images?: {
        logos?: TMDbImageAsset[];
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
    overview: string;
    releaseDate?: string;
    year?: number;
    genres: string[];
    allowedRegions: string[];
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

function toAIModel(value?: string): AIModel {
    switch (value) {
        case 'gpt-4o':
        case 'gpt-4o-mini':
        case 'gpt-4-turbo':
        case 'gpt-3.5-turbo':
        case 'flash-3':
            return value;
        default:
            return 'gpt-4o';
    }
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

    return cleaned
        .replace(/\[[^\]]+\]/g, ' ')
        .replace(/\([^)]*(official|trailer|teaser|4k|hd)[^)]*\)/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
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

function scoreCandidate(candidate: TMDbSearchResult, cleanedTitle: string, targetYear?: number): number {
    const candidateTitle = candidate.title || candidate.name || candidate.original_title || candidate.original_name || '';
    const normalizedCandidate = normalizeText(candidateTitle);
    const normalizedTarget = normalizeText(cleanedTitle);

    let score = candidate.popularity || 0;

    if (normalizedCandidate === normalizedTarget) {
        score += 1000;
    } else if (normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate)) {
        score += 250;
    }

    const candidateYear = extractYear(candidate.release_date || candidate.first_air_date);
    if (targetYear && candidateYear) {
        score += Math.max(0, 40 - Math.abs(candidateYear - targetYear) * 10);
    }

    return score;
}

function selectLogo(logos?: TMDbImageAsset[]): string | undefined {
    if (!Array.isArray(logos) || logos.length === 0) {
        return undefined;
    }

    const ranked = [...logos].sort((left, right) => {
        const leftScore = (left.iso_639_1 === 'en' ? 100 : left.iso_639_1 == null ? 50 : 0) + (left.vote_average || 0);
        const rightScore = (right.iso_639_1 === 'en' ? 100 : right.iso_639_1 == null ? 50 : 0) + (right.vote_average || 0);
        return rightScore - leftScore;
    });

    const best = ranked.find((entry) => entry.file_path) || ranked[0];
    return best?.file_path ? `${TMDB_IMAGE_BASE_URL}${best.file_path}` : undefined;
}

async function fetchResolvedMatch(candidate: TMDbSearchResult): Promise<ResolvedTMDbMatch | null> {
    if (candidate.media_type === 'movie') {
        const details = await tmdbFetch<TMDbMovieDetails>(`/movie/${candidate.id}`, {
            append_to_response: 'images,release_dates',
            include_image_language: 'en,null',
        });

        return {
            tmdbId: details.id,
            mediaType: 'movie',
            title: details.title || candidate.title || 'Unknown title',
            overview: details.overview || candidate.overview || '',
            releaseDate: details.release_date || candidate.release_date,
            year: extractYear(details.release_date || candidate.release_date),
            genres: (details.genres || []).map((genre) => genre.name),
            allowedRegions: [
                ...(details.production_countries || []).map((country) => country.iso_3166_1).filter(Boolean),
                ...((details.release_dates?.results || []).map((entry) => entry.iso_3166_1).filter(Boolean) as string[]),
            ],
            backdropUrl: details.backdrop_path ? `${TMDB_IMAGE_BASE_URL}${details.backdrop_path}` : undefined,
            posterUrl: details.poster_path ? `${TMDB_IMAGE_BASE_URL}${details.poster_path}` : undefined,
            logoUrl: selectLogo(details.images?.logos),
        };
    }

    const details = await tmdbFetch<TMDbTVDetails>(`/tv/${candidate.id}`, {
        append_to_response: 'images,content_ratings',
        include_image_language: 'en,null',
    });

    return {
        tmdbId: details.id,
        mediaType: 'tv',
        title: details.name || candidate.name || 'Unknown title',
        overview: details.overview || candidate.overview || '',
        releaseDate: details.first_air_date || candidate.first_air_date,
        year: extractYear(details.first_air_date || candidate.first_air_date),
        genres: (details.genres || []).map((genre) => genre.name),
        allowedRegions: [
            ...(details.origin_country || []).filter(Boolean),
            ...(details.production_countries || []).map((country) => country.iso_3166_1).filter(Boolean),
            ...((details.content_ratings?.results || []).map((entry) => entry.iso_3166_1).filter(Boolean) as string[]),
        ],
        backdropUrl: details.backdrop_path ? `${TMDB_IMAGE_BASE_URL}${details.backdrop_path}` : undefined,
        posterUrl: details.poster_path ? `${TMDB_IMAGE_BASE_URL}${details.poster_path}` : undefined,
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
        videoOpenaiModel: toAIModel(asString(map.get('videoOpenaiModel'))),
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
    settings: LoadedVideoSettings
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
        const searchResponse = await tmdbFetch<{ results?: TMDbSearchResult[] }>('/search/multi', {
            query: cleanedTitle,
            language: 'en-US',
            include_adult: 'false',
            page: '1',
        });

        const candidates = (searchResponse.results || [])
            .filter((candidate) => candidate.media_type === 'movie' || candidate.media_type === 'tv')
            .sort((left, right) => scoreCandidate(right, cleanedTitle, targetYear) - scoreCandidate(left, cleanedTitle, targetYear))
            .slice(0, 5);

        let matched: ResolvedTMDbMatch | undefined;
        for (const candidate of candidates) {
            const resolved = await fetchResolvedMatch(candidate);
            if (!resolved) continue;

            if (allowedRegions.length === 0 || isRegionMatch(resolved, allowedRegions)) {
                matched = resolved;
                break;
            }

            if (!matched) {
                matched = resolved;
            }
        }

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

    const model = settings.videoOpenaiModel || 'gpt-4o';

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
