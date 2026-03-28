/**
 * RSS Feed Routes - CRUD, preview, refresh, activity, and settings
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
  previewFeedPipeline,
  getRSSActivity,
  retryRSSActivity,
  deleteRSSActivity,
  reorderFeeds,
  RSSFeedInput,
} from '../services/rss.service';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/feeds', async (_req: Request, res: Response) => {
  try {
    const feeds = await getAllFeeds();

    const transformedFeeds = feeds.map((feed) => ({
      id: feed.id,
      name: feed.name,
      url: feed.url,
      favicon: feed.favicon,
      enabled: feed.enabled,
      displayOrder: feed.displayOrder,
      interval: feed.interval,
      imageCount: feed.imageCount,
      platformImageCounts: feed.platformImageCounts,
      dedupeDays: feed.dedupeDays,
      filters: feed.filters,
      serperEnabled: feed.serperEnabled,
      tmdbEnabled: feed.tmdbEnabled,
      serperPriority: feed.serperPriority,
      rehostImages: feed.rehostImages,
      autoPost: feed.autoPost,
      platformsEnabled: feed.platformsEnabled,
      trickle: feed.trickle,
      status: feed.status,
      lastProcessedAt: feed.lastProcessedAt?.toISOString() || null,
      nextRunAt: feed.nextRunAt?.toISOString() || null,
      errorMessage: feed.errorMessage,
      createdAt: feed.createdAt.toISOString(),
      updatedAt: feed.updatedAt.toISOString(),
    }));

    res.json({ success: true, data: transformedFeeds });
  } catch (error) {
    console.error('[RSS] Error fetching feeds:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feeds' });
  }
});

router.get('/feeds/:id', async (req: Request, res: Response) => {
  try {
    const feed = await getFeedById(req.params.id);
    if (!feed) {
      return res.status(404).json({ success: false, error: { message: 'Feed not found' } });
    }

    res.json({
      success: true,
      data: {
        id: feed.id,
        name: feed.name,
        url: feed.url,
        favicon: feed.favicon,
        enabled: feed.enabled,
        displayOrder: feed.displayOrder,
        interval: feed.interval,
        imageCount: feed.imageCount,
        platformImageCounts: feed.platformImageCounts,
        dedupeDays: feed.dedupeDays,
        filters: feed.filters,
        serperEnabled: feed.serperEnabled,
        tmdbEnabled: feed.tmdbEnabled,
        serperPriority: feed.serperPriority,
        rehostImages: feed.rehostImages,
        autoPost: feed.autoPost,
        platformsEnabled: feed.platformsEnabled,
        trickle: feed.trickle,
        status: feed.status,
        lastProcessedAt: feed.lastProcessedAt?.toISOString() || null,
        nextRunAt: feed.nextRunAt?.toISOString() || null,
        errorMessage: feed.errorMessage,
      },
    });
  } catch (error) {
    console.error('[RSS] Error fetching feed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feed' });
  }
});

router.post('/feeds', async (req: Request, res: Response) => {
  try {
    const feedData: RSSFeedInput = req.body;

    if (!feedData.url) {
      return res.status(400).json({ success: false, error: { message: 'URL is required' } });
    }

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
    res.status(500).json({ success: false, error: { message: 'Failed to create feed' } });
  }
});

router.put('/feeds/:id', async (req: Request, res: Response) => {
  try {
    const feed = await updateFeed(req.params.id, req.body);
    res.json({ success: true, data: feed });
  } catch (error) {
    console.error('[RSS] Error updating feed:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to update feed' } });
  }
});

router.delete('/feeds/:id', async (req: Request, res: Response) => {
  try {
    await deleteFeed(req.params.id);
    res.json({ success: true, message: 'Feed deleted' });
  } catch (error) {
    console.error('[RSS] Error deleting feed:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to delete feed' } });
  }
});

router.post('/feeds/:id/refresh', async (req: Request, res: Response) => {
  try {
    const result = await refreshFeed(req.params.id, {
      manualRun: Boolean(req.body?.manualRun),
    });
    const statusCode = result.error ? 500 : 200;
    res.status(statusCode).json({
      success: !result.error,
      data: result,
      error: result.error ? { message: result.error } : undefined,
    });
  } catch (error) {
    console.error('[RSS] Error refreshing feed:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to refresh feed' } });
  }
});

router.get('/feeds/:id/preview', async (req: Request, res: Response) => {
  try {
    const preview = await previewFeedPipeline(req.params.id);
    res.json({ success: true, data: preview });
  } catch (error) {
    console.error('[RSS] Error generating feed pipeline preview:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to generate feed preview' },
    });
  }
});

router.post('/refresh', async (_req: Request, res: Response) => {
  try {
    const result = await refreshAllFeeds();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[RSS] Error refreshing all feeds:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to refresh feeds' } });
  }
});

router.get('/activity', async (req: Request, res: Response) => {
  try {
    const limit = Number.parseInt(String(req.query.limit || '100'), 10);
    const activity = await getRSSActivity(Number.isFinite(limit) ? limit : 100);
    res.json({ success: true, data: activity });
  } catch (error) {
    console.error('[RSS] Error fetching activity:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch RSS activity' } });
  }
});

router.delete('/activity/:id', async (req: Request, res: Response) => {
  try {
    await deleteRSSActivity(req.params.id);
    res.json({ success: true, message: 'RSS activity deleted' });
  } catch (error) {
    console.error('[RSS] Error deleting activity:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to delete RSS activity' } });
  }
});

router.post('/feeds/reorder', async (req: Request, res: Response) => {
  try {
    const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : [];
    const feeds = await reorderFeeds(orderedIds);
    res.json({ success: true, data: feeds });
  } catch (error) {
    console.error('[RSS] Error reordering feeds:', error);
    res.status(400).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to reorder feeds' },
    });
  }
});

router.post('/activity/:id/retry', async (req: Request, res: Response) => {
  try {
    const activityItem = await retryRSSActivity(req.params.id);
    res.json({ success: true, data: activityItem });
  } catch (error) {
    console.error('[RSS] Error retrying activity item:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to retry RSS activity item' },
    });
  }
});

router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: { message: 'URL is required' } });
    }

    const xml = await fetchRSSFeed(url);
    const parsed = await parseRSSFeed(xml);

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
        sampleItems: parsed.items.slice(0, 3).map((item) => ({
          title: item.title,
          link: item.link,
          description: item.description,
          pubDate: item.pubDate.toISOString(),
          imageUrl: item.imageUrl,
        })),
      },
    });
  } catch (error) {
    console.error('[RSS] Error previewing feed:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to preview feed' },
    });
  }
});

router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          startsWith: 'rss',
        },
      },
    });

    const settingsMap: Record<string, unknown> = {};
    settings.forEach((setting) => {
      settingsMap[setting.key] = setting.value;
    });

    res.json({ success: true, data: settingsMap });
  } catch (error) {
    console.error('[RSS] Error fetching settings:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch RSS settings' } });
  }
});

router.put('/settings', async (req: Request, res: Response) => {
  try {
    const entries = Object.entries(req.body || {});
    await Promise.all(entries.map(([key, value]) => prisma.setting.upsert({
      where: { key },
      update: { value: value as any },
      create: { key, value: value as any },
    })));

    res.json({ success: true });
  } catch (error) {
    console.error('[RSS] Error saving settings:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to save RSS settings' } });
  }
});

export default router;
