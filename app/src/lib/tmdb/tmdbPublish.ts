import { publishContent, type PlatformSelection, type PublishResult } from '../api/platforms';
import { getEnabledPlatforms } from './tmdbSettingsService';
import { getFeedTypeFromSource } from '../../utils/tmdbCaptionGenerator';

export type TMDbSource = 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary';
export type TMDbPlatformKey = 'x' | 'threads' | 'facebook' | 'youtube' | 'pinterest';

export interface TMDbPublishablePost {
    title: string;
    caption?: string;
    imageUrl?: string;
    imageUrls?: string[];
    source: TMDbSource;
    platforms?: string[];
}

export interface TMDbPublishOutcome {
    response: PublishResult;
    platformKeys: TMDbPlatformKey[];
    platformNames: string[];
    postedPlatforms: string[];
    failedResults: Array<{ platform: string; error: string }>;
    errorMessage?: string;
}

const PLATFORM_NAME_BY_KEY: Record<TMDbPlatformKey, string> = {
    x: 'X',
    threads: 'Threads',
    facebook: 'Facebook',
    youtube: 'YouTube',
    pinterest: 'Pinterest',
};

const PLATFORM_KEY_BY_NAME: Record<string, TMDbPlatformKey | undefined> = {
    X: 'x',
    Threads: 'threads',
    Facebook: 'facebook',
    YouTube: 'youtube',
    Pinterest: 'pinterest',
    x: 'x',
    threads: 'threads',
    facebook: 'facebook',
    youtube: 'youtube',
    pinterest: 'pinterest',
};

function dedupePlatformKeys(platforms: TMDbPlatformKey[]): TMDbPlatformKey[] {
    return Array.from(new Set(platforms));
}

function isPlatformKey(value: string): value is TMDbPlatformKey {
    return value in PLATFORM_NAME_BY_KEY;
}

export function toTMDbPlatformNames(platformKeys: string[]): string[] {
    const normalized = platformKeys
        .filter(isPlatformKey)
        .map((key) => PLATFORM_NAME_BY_KEY[key]);

    return Array.from(new Set(normalized));
}

export function toTMDbPlatformKeys(platformNames: string[] = []): TMDbPlatformKey[] {
    const normalized = platformNames
        .map((platform) => PLATFORM_KEY_BY_NAME[platform])
        .filter((platform): platform is TMDbPlatformKey => Boolean(platform));

    return dedupePlatformKeys(normalized);
}

export function getDefaultTMDbPlatformNames(source: TMDbSource): string[] {
    const feedType = getFeedTypeFromSource(source);
    return getEnabledPlatforms(feedType).filter((platform) => Boolean(PLATFORM_KEY_BY_NAME[platform]));
}

export function getInitialTMDbPlatformKeys(source: TMDbSource, currentPlatforms?: string[]): TMDbPlatformKey[] {
    const existing = toTMDbPlatformKeys(currentPlatforms);
    if (existing.length > 0) {
        return existing;
    }

    return toTMDbPlatformKeys(getDefaultTMDbPlatformNames(source));
}

function toPlatformSelection(platformKeys: TMDbPlatformKey[]): PlatformSelection {
    return {
        x: platformKeys.includes('x'),
        facebook: platformKeys.includes('facebook'),
        instagram: false,
        threads: platformKeys.includes('threads'),
        youtube: platformKeys.includes('youtube'),
        tiktok: false,
        pinterest: platformKeys.includes('pinterest'),
    };
}

function formatFailedResults(results: any[] = []): Array<{ platform: string; error: string }> {
    return results
        .filter((result) => result?.status !== 'posted')
        .map((result) => ({
            platform: typeof result?.platform === 'string' ? result.platform : 'Unknown',
            error: typeof result?.error === 'string' && result.error.trim().length > 0
                ? result.error
                : 'Publish failed',
        }));
}

export async function publishTMDbPost(
    post: TMDbPublishablePost,
    selectedPlatformKeys?: string[]
): Promise<TMDbPublishOutcome> {
    const platformKeys = dedupePlatformKeys(
        (selectedPlatformKeys && selectedPlatformKeys.length > 0
            ? selectedPlatformKeys.filter(isPlatformKey)
            : getInitialTMDbPlatformKeys(post.source, post.platforms))
    );

    if (platformKeys.length === 0) {
        throw new Error('Select at least one platform');
    }

    const response = await publishContent(
        toPlatformSelection(platformKeys),
        {
            text: post.caption?.trim() || post.title,
            title: post.title,
            imageUrl: post.imageUrl || undefined,
            imageUrls: Array.isArray(post.imageUrls) && post.imageUrls.length > 0 ? post.imageUrls : undefined,
        }
    );

    if (!response.success) {
        throw new Error(response.error?.message || 'Failed to publish TMDb post');
    }

    const results = response.data?.results || [];
    const postedPlatforms = results
        .filter((result: any) => result?.status === 'posted' && typeof result?.platform === 'string')
        .map((result: any) => result.platform);
    const failedResults = formatFailedResults(results);
    const errorMessage = failedResults.length > 0
        ? failedResults.map((result) => `${result.platform}: ${result.error}`).join('; ')
        : undefined;

    return {
        response,
        platformKeys,
        platformNames: toTMDbPlatformNames(platformKeys),
        postedPlatforms,
        failedResults,
        errorMessage,
    };
}
