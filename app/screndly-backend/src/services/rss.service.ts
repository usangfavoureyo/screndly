/**
 * RSS Feed Service - Extended for Full Frontend Support
 * Handles fetching, parsing, and storing RSS feed data
 */

import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import aiService from './ai.service';
import { publisherService } from './publisher.service';

// ============================================
// TYPES (matching frontend Feed interface)
// ============================================

export interface RSSFeedFilters {
    scope: 'title' | 'body' | 'title_or_body' | 'title_and_body';
    required: Array<{
        text: string;
        matchType: 'contains' | 'exact';
        caseSensitive: boolean;
        active: boolean;
    }>;
    blocked: Array<{
        text: string;
        matchType: 'contains' | 'exact';
        caseSensitive: boolean;
        active: boolean;
    }>;
}

export interface PlatformsEnabled {
    x: boolean;
    threads: boolean;
    facebook: boolean;
    pinterest: boolean;
}

export interface RSSFeedInput {
    name: string;
    url: string;
    favicon?: string;
    enabled?: boolean;
    interval?: number;
    imageCount?: string;
    dedupeDays?: number;
    filters?: RSSFeedFilters;
    serperPriority?: boolean;
    rehostImages?: boolean;
    autoPost?: boolean;
    platformsEnabled?: PlatformsEnabled;
    status?: string;
}

interface RSSItem {
    title: string;
    link: string;
    description: string;
    pubDate: Date;
    imageUrl?: string;
    author?: string;
    guid?: string;
}

interface RSSFeedData {
    title: string;
    description: string;
    link: string;
    items: RSSItem[];
    lastBuildDate?: Date;
}

interface RefreshResult {
    feedId: string;
    feedName: string;
    itemsAdded: number;
    error?: string;
}

// ============================================
// FETCH & PARSE
// ============================================

/**
 * Fetch RSS feed from URL
 */
async function fetchRSSFeed(url: string): Promise<string> {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Screndly RSS Reader/1.0',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch RSS: ${response.status} ${response.statusText}`);
    }

    return response.text();
}

/**
 * Parse RSS XML to structured data
 */
function parseRSSFeed(xml: string): RSSFeedData {
    const titleMatch = xml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
    const descMatch = xml.match(/<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i);
    const linkMatch = xml.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i);

    const feedData: RSSFeedData = {
        title: titleMatch?.[1] || 'Unknown Feed',
        description: descMatch?.[1] || '',
        link: linkMatch?.[1] || '',
        items: []
    };

    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(xml)) !== null) {
        const itemXml = itemMatch[1];

        const itemTitle = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
        const itemLink = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i);
        const itemDesc = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
        const itemPubDate = itemXml.match(/<pubDate[^>]*>(.*?)<\/pubDate>/i);
        const itemGuid = itemXml.match(/<guid[^>]*>(.*?)<\/guid>/i);
        const itemAuthor = itemXml.match(/<author[^>]*>(.*?)<\/author>/i) ||
            itemXml.match(/<dc:creator[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/dc:creator>/i);

        let imageUrl: string | undefined;
        const mediaMatch = itemXml.match(/<media:content[^>]*url=["']([^"']+)["']/i);
        const enclosureMatch = itemXml.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i);
        const imgInDesc = itemXml.match(/<img[^>]*src=["']([^"']+)["']/i);

        imageUrl = mediaMatch?.[1] || enclosureMatch?.[1] || imgInDesc?.[1];

        if (itemTitle?.[1] && itemLink?.[1]) {
            feedData.items.push({
                title: itemTitle[1].trim(),
                link: itemLink[1].trim(),
                description: (itemDesc?.[1] || '').replace(/<[^>]+>/g, '').trim().slice(0, 500),
                pubDate: itemPubDate?.[1] ? new Date(itemPubDate[1]) : new Date(),
                imageUrl,
                author: itemAuthor?.[1]?.trim(),
                guid: itemGuid?.[1]?.trim()
            });
        }
    }

    return feedData;
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * Get all RSS feeds
 */
async function getAllFeeds() {
    return prisma.rSSFeed.findMany({
        orderBy: { createdAt: 'desc' }
    });
}

/**
 * Get single feed by ID
 */
async function getFeedById(id: string) {
    return prisma.rSSFeed.findUnique({
        where: { id }
    });
}

/**
 * Create new RSS feed with all fields
 */
async function createFeed(data: RSSFeedInput) {
    // Try to fetch and get favicon if not provided
    let favicon = data.favicon;
    if (!favicon) {
        try {
            const urlObj = new URL(data.url);
            favicon = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
        } catch {
            favicon = undefined;
        }
    }

    // Try to fetch feed title if creating
    let feedTitle = data.name;
    try {
        const xml = await fetchRSSFeed(data.url);
        const parsed = parseRSSFeed(xml);
        if (!feedTitle || feedTitle === 'New Feed') {
            feedTitle = parsed.title;
        }
    } catch (error) {
        console.warn('Could not fetch feed for auto-fill:', error);
    }

    return prisma.rSSFeed.create({
        data: {
            name: feedTitle || data.name,
            url: data.url,
            favicon,
            enabled: data.enabled ?? true,
            interval: data.interval ?? 10,
            imageCount: data.imageCount ?? '2',
            dedupeDays: data.dedupeDays ?? 30,
            filters: (data.filters ?? { scope: 'title_or_body', required: [], blocked: [] }) as unknown as Prisma.InputJsonValue,
            serperPriority: data.serperPriority ?? true,
            rehostImages: data.rehostImages ?? false,
            autoPost: data.autoPost ?? true,
            platformsEnabled: (data.platformsEnabled ?? { x: true, threads: true, facebook: false, pinterest: false }) as unknown as Prisma.InputJsonValue,
            status: data.status ?? 'active',
            // Legacy fields
            source: feedTitle || data.name,
        }
    });
}

/**
 * Update RSS feed with all fields
 */
async function updateFeed(id: string, data: Partial<RSSFeedInput> & {
    lastProcessedAt?: Date;
    nextRunAt?: Date;
    errorMessage?: string;
}) {
    const updateData: any = { updatedAt: new Date() };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.favicon !== undefined) updateData.favicon = data.favicon;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.interval !== undefined) updateData.interval = data.interval;
    if (data.imageCount !== undefined) updateData.imageCount = data.imageCount;
    if (data.dedupeDays !== undefined) updateData.dedupeDays = data.dedupeDays;
    if (data.filters !== undefined) updateData.filters = data.filters;
    if (data.serperPriority !== undefined) updateData.serperPriority = data.serperPriority;
    if (data.rehostImages !== undefined) updateData.rehostImages = data.rehostImages;
    if (data.autoPost !== undefined) updateData.autoPost = data.autoPost;
    if (data.platformsEnabled !== undefined) updateData.platformsEnabled = data.platformsEnabled;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.lastProcessedAt !== undefined) updateData.lastProcessedAt = data.lastProcessedAt;
    if (data.nextRunAt !== undefined) updateData.nextRunAt = data.nextRunAt;
    if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;

    return prisma.rSSFeed.update({
        where: { id },
        data: updateData
    });
}

/**
 * Delete RSS feed
 */
async function deleteFeed(id: string) {
    return prisma.rSSFeed.delete({
        where: { id }
    });
}

// Import services (add to top of file ideally, but will be resolved by tooling if smart, else I will add imports in next step)
// I will rewrite the function effectively.

/**
 * Refresh a single feed - fetch latest items and auto-post new ones
 */
/**
 * Get RSS AI Settings
 */
async function getRSSSettings() {
    const keys = ['rssCaptionModel', 'rssCaptionTemperature', 'rssCaptionPrompt'];
    const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });

    const result: any = {};
    settings.forEach(s => {
        // Parse numbers if needed, though they are stored as JSON usually or value string
        // Assuming value is direct or needing slight parsing
        result[s.key] = s.value;
    });
    return result;
}

/**
 * Refresh a single feed - fetch latest items and auto-post new ones
 */
async function refreshFeed(id: string): Promise<RefreshResult> {
    const feed = await prisma.rSSFeed.findUnique({ where: { id } });

    if (!feed) {
        return { feedId: id, feedName: 'Unknown', itemsAdded: 0, error: 'Feed not found' };
    }

    try {
        const xml = await fetchRSSFeed(feed.url);
        const parsed = parseRSSFeed(xml);

        // Fetch AI Settings (Model, Prompt, Temp)
        const aiSettings = await getRSSSettings();
        const model = aiSettings.rssCaptionModel || 'flash-3';
        const customPrompt = aiSettings.rssCaptionPrompt; // May be undefined
        const customTemp = aiSettings.rssCaptionTemperature ? parseFloat(aiSettings.rssCaptionTemperature) : undefined;

        // Calculate next run time
        const nextRun = new Date();
        nextRun.setMinutes(nextRun.getMinutes() + feed.interval);

        // Filter new items (published after lastProcessedAt)
        // If lastProcessedAt is null (first run), maybe process only latest 1? Or all? 
        // Let's safe-guard: if null, take latest 1 to avoid spam.
        const cutoffDate = feed.lastProcessedAt || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h default if null

        const newItems = parsed.items.filter(item => {
            return new Date(item.pubDate) > cutoffDate;
        }).sort((a, b) => new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime()); // Process oldest new item first

        let postedCount = 0;

        if (feed.autoPost && newItems.length > 0) {
            // Determine platforms
            const enabledPlatforms = typeof feed.platformsEnabled === 'object'
                ? feed.platformsEnabled as Record<string, boolean>
                : {};

            const platforms = Object.keys(enabledPlatforms)
                .filter(k => enabledPlatforms[k])
                .map(k => {
                    // Map keys to PublisherService platform names (Capitalized)
                    if (k === 'x') return 'X';
                    if (k === 'facebook') return 'Facebook';
                    if (k === 'threads') return 'Threads';
                    // Add others as needed
                    return k.charAt(0).toUpperCase() + k.slice(1);
                });

            if (platforms.length > 0) {
                for (const item of newItems) {
                    try {
                        // 1. Generate AI Caption
                        const context: any = { // RSSContext
                            articleTitle: item.title,
                            feedName: feed.name,
                            summary: item.description,
                            platform: 'X' // Default context
                        };

                        const caption = await aiService.generateRSSCaption(
                            context,
                            model,
                            customPrompt,
                            customTemp
                        );

                        // 2. Publish
                        await publisherService.publish(platforms, {
                            text: caption,
                            title: item.title,
                            link: item.link
                        });

                        postedCount++;
                        console.log(`[RSS] Published: ${item.title}`);

                        // Rate limit slightly?
                        await new Promise(r => setTimeout(r, 1000));

                    } catch (err) {
                        console.error(`[RSS] Failed to post item ${item.title}:`, err);
                    }
                }
            }
        }

        // Update feed metadata
        await prisma.rSSFeed.update({
            where: { id },
            data: {
                status: 'active',
                lastProcessedAt: new Date(), // Now
                nextRunAt: nextRun,
                errorMessage: null,
                updatedAt: new Date()
            }
        });

        return {
            feedId: id,
            feedName: feed.name,
            itemsAdded: postedCount // Return actually posted count
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await prisma.rSSFeed.update({
            where: { id },
            data: {
                status: 'error',
                errorMessage,
                updatedAt: new Date()
            }
        });

        return {
            feedId: id,
            feedName: feed.name,
            itemsAdded: 0,
            error: errorMessage
        };
    }
}

/**
 * Refresh all feeds
 */
/**
 * Refresh all feeds
 * @param checkSchedule If true, only refresh feeds that are due (nextRunAt <= now)
 */
async function refreshAllFeeds(checkSchedule: boolean = false): Promise<{
    total: number;
    success: number;
    failed: number;
    isScheduledRun: boolean;
    results: RefreshResult[];
}> {
    const where: any = { enabled: true };

    if (checkSchedule) {
        where.nextRunAt = {
            lte: new Date()
        };
    }

    const feeds = await prisma.rSSFeed.findMany({
        where
    });

    if (checkSchedule && feeds.length === 0) {
        return {
            total: 0,
            success: 0,
            failed: 0,
            isScheduledRun: true,
            results: []
        };
    }

    const results: RefreshResult[] = [];

    for (const feed of feeds) {
        const result = await refreshFeed(feed.id);
        results.push(result);
    }

    return {
        total: feeds.length,
        success: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length,
        isScheduledRun: checkSchedule,
        results
    };
}

// ============================================
// EXPORTS
// ============================================

export {
    fetchRSSFeed,
    parseRSSFeed,
    getAllFeeds,
    getFeedById,
    createFeed,
    updateFeed,
    deleteFeed,
    refreshFeed,
    refreshAllFeeds
};

export default {
    fetchRSSFeed,
    parseRSSFeed,
    getAllFeeds,
    getFeedById,
    createFeed,
    updateFeed,
    deleteFeed,
    refreshFeed,
    refreshAllFeeds
};
