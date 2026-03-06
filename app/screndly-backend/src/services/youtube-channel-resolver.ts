import prisma from '../lib/prisma';
import { decrypt } from '../lib/encryption';
import { env } from '../lib/env';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface ResolvedYouTubeChannel {
    channelId: string;
    name: string;
    handle?: string | null;
    subscriberCount?: number;
    videoCount?: number;
    canonicalUrl: string;
    source: 'channel_id' | 'handle' | 'url' | 'search';
}

function normalizeInput(input: string): string {
    return input.trim();
}

function extractDirectChannelId(input: string): string | null {
    const normalized = normalizeInput(input);
    const directMatch = normalized.match(/^(UC[a-zA-Z0-9_-]{22})$/);
    if (directMatch) {
        return directMatch[1];
    }

    try {
        const url = new URL(normalized);
        const pathMatch = url.pathname.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
        return pathMatch?.[1] || null;
    } catch {
        return null;
    }
}

function extractHandle(input: string): string | null {
    const normalized = normalizeInput(input);

    if (normalized.startsWith('@')) {
        return normalized.slice(1).replace(/\/+$/, '');
    }

    try {
        const url = new URL(normalized);
        const handleMatch = url.pathname.match(/\/@([^/?#]+)/);
        if (handleMatch?.[1]) {
            return handleMatch[1];
        }

        const legacyMatch = url.pathname.match(/\/(c|user)\/([^/?#]+)/);
        if (legacyMatch?.[2]) {
            return legacyMatch[2];
        }
    } catch {
        return null;
    }

    return null;
}

async function getYouTubeApiKey(): Promise<string | null> {
    if (env.GOOGLE_API_KEY) {
        return env.GOOGLE_API_KEY;
    }

    try {
        const setting = await prisma.setting.findUnique({
            where: { key: 'youtubeKey' }
        });

        if (!setting?.value || typeof setting.value !== 'string') {
            return null;
        }

        return decrypt(setting.value);
    } catch (error) {
        console.error('[YouTubeResolver] Failed to load YouTube API key:', error);
        return null;
    }
}

async function fetchJson<T>(url: string): Promise<T | null> {
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Screndly/1.0'
            }
        });

        if (!response.ok) {
            return null;
        }

        return await response.json() as T;
    } catch (error) {
        console.error('[YouTubeResolver] Request failed:', error);
        return null;
    }
}

async function fetchText(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml',
                'User-Agent': 'Screndly/1.0'
            }
        });

        if (!response.ok) {
            return null;
        }

        return await response.text();
    } catch (error) {
        console.error('[YouTubeResolver] HTML fetch failed:', error);
        return null;
    }
}

async function fetchChannelById(channelId: string): Promise<ResolvedYouTubeChannel | null> {
    const apiKey = await getYouTubeApiKey();

    if (apiKey) {
        const data = await fetchJson<any>(
            `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`
        );

        const item = data?.items?.[0];
        if (item) {
            return {
                channelId,
                name: item.snippet?.title || channelId,
                handle: item.snippet?.customUrl || null,
                subscriberCount: Number(item.statistics?.subscriberCount || 0),
                videoCount: Number(item.statistics?.videoCount || 0),
                canonicalUrl: `https://www.youtube.com/channel/${channelId}`,
                source: 'channel_id'
            };
        }
    }

    const page = await fetchText(`https://www.youtube.com/channel/${channelId}`);
    if (!page) {
        return null;
    }

    const titleMatch = page.match(/<meta property="og:title" content="([^"]+)"/i)
        || page.match(/<meta itemprop="name" content="([^"]+)"/i);
    const handleMatch = page.match(/"canonicalBaseUrl":"\\\/@([^"]+)"/i);

    return {
        channelId,
        name: titleMatch?.[1] || channelId,
        handle: handleMatch?.[1] ? `@${handleMatch[1]}` : null,
        canonicalUrl: `https://www.youtube.com/channel/${channelId}`,
        source: 'channel_id'
    };
}

async function resolveHandleFromPage(handle: string): Promise<ResolvedYouTubeChannel | null> {
    const page = await fetchText(`https://www.youtube.com/@${encodeURIComponent(handle)}`);
    if (!page) {
        return null;
    }

    const channelIdMatch = page.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/)
        || page.match(/<meta itemprop="channelId" content="(UC[a-zA-Z0-9_-]{22})"/i)
        || page.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);

    if (!channelIdMatch?.[1]) {
        return null;
    }

    const titleMatch = page.match(/<meta property="og:title" content="([^"]+)"/i)
        || page.match(/<meta itemprop="name" content="([^"]+)"/i);

    return {
        channelId: channelIdMatch[1],
        name: titleMatch?.[1] || handle,
        handle: `@${handle}`,
        canonicalUrl: `https://www.youtube.com/channel/${channelIdMatch[1]}`,
        source: 'handle'
    };
}

async function searchChannel(query: string): Promise<ResolvedYouTubeChannel | null> {
    const apiKey = await getYouTubeApiKey();

    if (apiKey) {
        const search = await fetchJson<any>(
            `${YOUTUBE_API_BASE}/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`
        );

        const item = search?.items?.[0];
        const channelId = item?.snippet?.channelId || item?.id?.channelId;
        if (channelId) {
            const channel = await fetchChannelById(channelId);
            if (channel) {
                return { ...channel, source: 'search' };
            }
        }
    }

    const searchPage = await fetchText(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
    if (!searchPage) {
        return null;
    }

    const channelIdMatch = searchPage.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
    if (!channelIdMatch?.[1]) {
        return null;
    }

    const channel = await fetchChannelById(channelIdMatch[1]);
    if (channel) {
        return { ...channel, source: 'search' };
    }

    return {
        channelId: channelIdMatch[1],
        name: query,
        canonicalUrl: `https://www.youtube.com/channel/${channelIdMatch[1]}`,
        source: 'search'
    };
}

export async function resolveYouTubeChannel(input: string, preferredName?: string): Promise<ResolvedYouTubeChannel> {
    const normalized = normalizeInput(input);

    if (!normalized) {
        throw new Error('Channel input is required');
    }

    const directChannelId = extractDirectChannelId(normalized);
    if (directChannelId) {
        const resolved = await fetchChannelById(directChannelId);
        if (resolved) {
            return {
                ...resolved,
                name: preferredName?.trim() || resolved.name,
                source: normalized.includes('http') ? 'url' : 'channel_id'
            };
        }

        return {
            channelId: directChannelId,
            name: preferredName?.trim() || directChannelId,
            canonicalUrl: `https://www.youtube.com/channel/${directChannelId}`,
            source: normalized.includes('http') ? 'url' : 'channel_id'
        };
    }

    const handle = extractHandle(normalized);
    if (handle) {
        const fromHandlePage = await resolveHandleFromPage(handle);
        if (fromHandlePage) {
            return {
                ...fromHandlePage,
                name: preferredName?.trim() || fromHandlePage.name,
                source: normalized.includes('http') ? 'url' : 'handle'
            };
        }
    }

    const searched = await searchChannel(normalized);
    if (searched) {
        return {
            ...searched,
            name: preferredName?.trim() || searched.name
        };
    }

    throw new Error('Unable to resolve YouTube channel. Use a valid channel URL, @handle, channel ID, or searchable name.');
}
