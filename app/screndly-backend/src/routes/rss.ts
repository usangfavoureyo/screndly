/**
 * RSS Feed Routes - Full CRUD with Extended Fields
 */

import { Router, Request, Response } from 'express';
import {
    getAllFeeds,
    getFeedById,
    createFeed,
    updateFeed,
    deleteFeed,
    refreshFeed,
    refreshAllFeeds,
    fetchRSSFeed,
    parseRSSFeed,
    RSSFeedInput
} from '../services/rss.service';
import prisma from '../lib/prisma';

const router = Router();

// ============================================
// FEED CRUD ENDPOINTS
// ============================================

/**
 * GET /api/rss/feeds - List all feeds
 */
router.get('/feeds', async (_req: Request, res: Response) => {
    try {
        const feeds = await getAllFeeds();

        // Transform for frontend compatibility
        const transformedFeeds = feeds.map(feed => ({
            id: feed.id,
            name: feed.name,
            url: feed.url,
            favicon: feed.favicon,
            enabled: feed.enabled,
            interval: feed.interval,
            imageCount: feed.imageCount,
            dedupeDays: feed.dedupeDays,
            filters: feed.filters,
            serperPriority: feed.serperPriority,
            rehostImages: feed.rehostImages,
            autoPost: feed.autoPost,
            platformsEnabled: feed.platformsEnabled,
            status: feed.status,
            lastProcessedAt: feed.lastProcessedAt?.toISOString() || null,
            nextRunAt: feed.nextRunAt?.toISOString() || null,
            errorMessage: feed.errorMessage,
            createdAt: feed.createdAt.toISOString(),
            updatedAt: feed.updatedAt.toISOString()
        }));

        res.json({ success: true, data: transformedFeeds });
    } catch (error) {
        console.error('[RSS] Error fetching feeds:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch feeds' });
    }
});

/**
 * GET /api/rss/feeds/:id - Get single feed
 */
router.get('/feeds/:id', async (req: Request, res: Response) => {
    try {
        const feed = await getFeedById(req.params.id);
        if (!feed) {
            return res.status(404).json({ success: false, error: 'Feed not found' });
        }

        res.json({
            success: true,
            data: {
                id: feed.id,
                name: feed.name,
                url: feed.url,
                favicon: feed.favicon,
                enabled: feed.enabled,
                interval: feed.interval,
                imageCount: feed.imageCount,
                dedupeDays: feed.dedupeDays,
                filters: feed.filters,
                serperPriority: feed.serperPriority,
                rehostImages: feed.rehostImages,
                autoPost: feed.autoPost,
                platformsEnabled: feed.platformsEnabled,
                status: feed.status,
                lastProcessedAt: feed.lastProcessedAt?.toISOString() || null,
                nextRunAt: feed.nextRunAt?.toISOString() || null,
                errorMessage: feed.errorMessage
            }
        });
    } catch (error) {
        console.error('[RSS] Error fetching feed:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch feed' });
    }
});

/**
 * POST /api/rss/feeds - Create new feed
 */
router.post('/feeds', async (req: Request, res: Response) => {
    try {
        const feedData: RSSFeedInput = req.body;

        if (!feedData.url) {
            return res.status(400).json({ success: false, error: 'URL is required' });
        }

        // Default name from URL if not provided
        if (!feedData.name) {
            try {
                feedData.name = new URL(feedData.url).hostname.replace('www.', '');
            } catch {
                feedData.name = 'New Feed';
            }
        }

        const feed = await createFeed(feedData);

        res.json({ success: true, data: feed });
    } catch (error) {
        console.error('[RSS] Error creating feed:', error);
        res.status(500).json({ success: false, error: 'Failed to create feed' });
    }
});

/**
 * PUT /api/rss/feeds/:id - Update feed
 */
router.put('/feeds/:id', async (req: Request, res: Response) => {
    try {
        const feed = await updateFeed(req.params.id, req.body);
        res.json({ success: true, data: feed });
    } catch (error) {
        console.error('[RSS] Error updating feed:', error);
        res.status(500).json({ success: false, error: 'Failed to update feed' });
    }
});

/**
 * DELETE /api/rss/feeds/:id - Delete feed
 */
router.delete('/feeds/:id', async (req: Request, res: Response) => {
    try {
        await deleteFeed(req.params.id);
        res.json({ success: true, message: 'Feed deleted' });
    } catch (error) {
        console.error('[RSS] Error deleting feed:', error);
        res.status(500).json({ success: false, error: 'Failed to delete feed' });
    }
});

// ============================================
// REFRESH ENDPOINTS
// ============================================

/**
 * POST /api/rss/feeds/:id/refresh - Refresh single feed
 */
router.post('/feeds/:id/refresh', async (req: Request, res: Response) => {
    try {
        const result = await refreshFeed(req.params.id);
        res.json({ success: !result.error, data: result });
    } catch (error) {
        console.error('[RSS] Error refreshing feed:', error);
        res.status(500).json({ success: false, error: 'Failed to refresh feed' });
    }
});

/**
 * POST /api/rss/refresh - Refresh all feeds
 */
router.post('/refresh', async (_req: Request, res: Response) => {
    try {
        const result = await refreshAllFeeds();
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[RSS] Error refreshing all feeds:', error);
        res.status(500).json({ success: false, error: 'Failed to refresh feeds' });
    }
});

// ============================================
// PREVIEW & TEST ENDPOINTS
// ============================================

/**
 * POST /api/rss/preview - Preview a feed URL before adding
 */
router.post('/preview', async (req: Request, res: Response) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, error: 'URL is required' });
        }

        const xml = await fetchRSSFeed(url);
        const parsed = parseRSSFeed(xml);

        // Get favicon
        let favicon: string | undefined;
        try {
            const urlObj = new URL(url);
            favicon = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
        } catch {
            favicon = undefined;
        }

        res.json({
            success: true,
            data: {
                title: parsed.title,
                description: parsed.description,
                link: parsed.link,
                favicon,
                itemCount: parsed.items.length,
                sampleItems: parsed.items.slice(0, 3).map(item => ({
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate.toISOString(),
                    imageUrl: item.imageUrl
                }))
            }
        });
    } catch (error) {
        console.error('[RSS] Error previewing feed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to preview feed'
        });
    }
});

// ============================================
// SETTINGS ENDPOINTS
// ============================================

/**
 * GET /api/rss/settings - Get RSS settings
 */
router.get('/settings', async (_req: Request, res: Response) => {
    try {
        const settings = await prisma.setting.findMany({
            where: {
                key: {
                    startsWith: 'rss'
                }
            }
        });

        const settingsMap: Record<string, any> = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });

        res.json({ success: true, data: settingsMap });
    } catch (error) {
        console.error('[RSS] Error fetching settings:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
});

/**
 * PUT /api/rss/settings - Update RSS settings
 */
router.put('/settings', async (req: Request, res: Response) => {
    try {
        const updates = req.body;
        const updatedKeys: string[] = [];

        for (const [key, value] of Object.entries(updates)) {
            if (key.startsWith('rss')) {
                await prisma.setting.upsert({
                    where: { key },
                    update: { value: value as any },
                    create: { key, value: value as any }
                });
                updatedKeys.push(key);
            }
        }

        res.json({ success: true, updated: updatedKeys });
    } catch (error) {
        console.error('[RSS] Error updating settings:', error);
        res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
});

export default router;
