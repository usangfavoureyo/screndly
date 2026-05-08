import { Router } from 'express';
import prisma from '../lib/prisma';
import { hasFeedItemStatusColumn } from '../lib/feedItemStatus';
import { env } from '../lib/env';
import { resolveYouTubeChannel } from '../services/youtube-channel-resolver';
import { getYouTubePollingPauseStatus, pauseYouTubePolling, resumeYouTubePolling } from '../services/cron';
import { youtubePollerService } from '../services/youtube-poller.service';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const VISIBLE_FEED_ITEM_STATUSES = ['accepted', 'failed', 'queued'] as const;

function getStatusFromBody(body: any): string | undefined {
    if (typeof body?.status === 'string') {
        return body.status;
    }

    if (typeof body?.active === 'boolean') {
        return body.active ? 'active' : 'inactive';
    }

    return undefined;
}

function hasAdminSecret(req: Parameters<typeof authenticate>[0]): boolean {
    const authHeader = req.headers.authorization;
    if (!authHeader || !env.ADMIN_SECRET) {
        return false;
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    return token === env.ADMIN_SECRET;
}

// GET /api/channels
router.get('/', async (_req, res) => {
    try {
        const channels = await prisma.channel.findMany({
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, data: channels });
    } catch (error) {
        console.error('Failed to fetch channels:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch channels' } });
    }
});

// GET /api/channels/activity
router.get('/activity', async (_req, res) => {
    try {
        const feedItemWhere = (await hasFeedItemStatusColumn())
            ? { status: { in: [...VISIBLE_FEED_ITEM_STATUSES] } }
            : {};
        const items = await prisma.feedItem.findMany({
            where: feedItemWhere,
            take: 25,
            orderBy: { publishedAt: 'desc' },
            include: {
                channel: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        res.json({ success: true, data: items });
    } catch (error) {
        console.error('Failed to fetch channel activity:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch channel activity' } });
    }
});

// GET /api/channels/poll-status
router.get('/poll-status', async (_req, res) => {
    try {
        res.json({
            success: true,
            data: {
                ...youtubePollerService.getPollStatus(),
                pause: getYouTubePollingPauseStatus(),
            }
        });
    } catch (error) {
        console.error('Failed to fetch poll status:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch poll status' } });
    }
});

// POST /api/channels/poll
router.post('/poll', async (req, res) => {
    try {
        const summary = await youtubePollerService.pollChannels({
            force: true,
            channelDbId: req.body?.channelId
        });

        res.json({ success: true, data: summary });
    } catch (error: any) {
        console.error('Failed to poll channels:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to poll channels' } });
    }
});

// POST /api/channels/:id/scan-now
router.post('/:id/scan-now', async (req, res) => {
    try {
        const channel = await prisma.channel.findUnique({
            where: { id: req.params.id }
        });

        if (!channel) {
            return res.status(404).json({ success: false, error: { message: 'Channel not found' } });
        }

        if (channel.status !== 'active') {
            return res.status(409).json({ success: false, error: { message: 'Channel must be active before scanning' } });
        }

        const scan = youtubePollerService.startManualChannelScan(channel);

        res.status(scan.status === 'queued' ? 202 : 200).json({
            success: true,
            data: {
                status: scan.status,
                message: scan.message,
            }
        });
    } catch (error: any) {
        console.error('Failed to scan channel now:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to scan channel now' } });
    }
});

// POST /api/channels/poll/targeted
router.post('/poll/targeted', async (req, res) => {
    if (!hasAdminSecret(req)) {
        return res.status(403).json({ success: false, error: { message: 'Admin secret required for targeted polling' } });
    }

    const channelId = typeof req.body?.channelId === 'string' ? req.body.channelId.trim() : '';
    if (!channelId) {
        return res.status(400).json({ success: false, error: { message: 'channelId is required' } });
    }

    const currentStatus = youtubePollerService.getPollStatus();
    if (currentStatus.isPolling) {
        return res.status(409).json({
            success: false,
            error: { message: 'Polling already in progress' },
            data: {
                ...currentStatus,
                pause: getYouTubePollingPauseStatus(),
            }
        });
    }

    const requestedPauseMinutes = Number.parseInt(String(req.body?.pauseMinutes || '10'), 10);
    const pauseMinutes = Number.isFinite(requestedPauseMinutes) && requestedPauseMinutes > 0
        ? Math.min(requestedPauseMinutes, 30)
        : 10;
    const requestedAgeGateOverrideHours = Number.parseFloat(String(req.body?.ageGateOverrideHours || '6'));
    const ageGateOverrideHours = Number.isFinite(requestedAgeGateOverrideHours) && requestedAgeGateOverrideHours > 0
        ? Math.min(requestedAgeGateOverrideHours, 24)
        : 6;
    const pausedUntil = pauseYouTubePolling(pauseMinutes, `manual targeted poll for ${channelId}`);

    try {
        const summary = await youtubePollerService.pollChannels({
            force: true,
            channelDbId: channelId,
            ageGateOverrideHours,
        });

        res.json({
            success: true,
            data: {
                summary,
                pause: {
                    paused: true,
                    pausedUntil: pausedUntil.toISOString(),
                }
            }
        });
    } catch (error: any) {
        console.error('Failed to run targeted channel poll:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to run targeted channel poll' } });
    } finally {
        resumeYouTubePolling();
    }
});

// POST /api/channels
router.post('/', async (req, res) => {
    try {
        const input = String(req.body?.channelId || '').trim();
        const preferredName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

        if (!input) {
            return res.status(400).json({ success: false, error: { message: 'Channel URL, ID, handle, or name is required' } });
        }

        const resolved = await resolveYouTubeChannel(input, preferredName);

        const existing = await prisma.channel.findUnique({
            where: { channelId: resolved.channelId }
        });

        if (existing) {
            const updated = await prisma.channel.update({
                where: { id: existing.id },
                data: {
                    name: preferredName || resolved.name,
                    subscriberCount: resolved.subscriberCount ?? existing.subscriberCount,
                    videoCount: resolved.videoCount ?? existing.videoCount,
                    status: existing.status === 'inactive' ? 'active' : existing.status
                }
            });

            return res.json({ success: true, data: updated });
        }

        const channel = await prisma.channel.create({
            data: {
                channelId: resolved.channelId,
                name: preferredName || resolved.name,
                subscriberCount: resolved.subscriberCount || 0,
                videoCount: resolved.videoCount || 0,
                status: 'active'
            }
        });

        res.json({ success: true, data: channel });
    } catch (error: any) {
        console.error('Failed to add channel:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to add channel' } });
    }
});

// PATCH /api/channels/:id
router.patch('/:id', async (req, res) => {
    try {
        const existing = await prisma.channel.findUnique({
            where: { id: req.params.id }
        });

        if (!existing) {
            return res.status(404).json({ success: false, error: { message: 'Channel not found' } });
        }

        const data: Record<string, any> = {};
        const status = getStatusFromBody(req.body);

        if (status) {
            data.status = status;
        }

        const input = typeof req.body?.channelId === 'string' ? req.body.channelId.trim() : '';
        const preferredName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

        if (input) {
            const resolved = await resolveYouTubeChannel(input, preferredName || existing.name);
            data.channelId = resolved.channelId;
            data.name = preferredName || resolved.name;
            data.subscriberCount = resolved.subscriberCount ?? existing.subscriberCount;
            data.videoCount = resolved.videoCount ?? existing.videoCount;
        } else if (preferredName) {
            data.name = preferredName;
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ success: false, error: { message: 'No valid channel updates provided' } });
        }

        const channel = await prisma.channel.update({
            where: { id: req.params.id },
            data
        });

        res.json({ success: true, data: channel });
    } catch (error: any) {
        console.error('Failed to update channel:', error);
        res.status(500).json({ success: false, error: { message: error.message || 'Failed to update channel' } });
    }
});

// DELETE /api/channels/:id
router.delete('/:id', async (req, res) => {
    try {
        await prisma.channel.delete({ where: { id: req.params.id } });
        res.json({ success: true, data: { message: 'Channel removed successfully' } });
    } catch (error) {
        console.error('Failed to delete channel:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to delete channel' } });
    }
});

// GET /api/channels/:id/videos
router.get('/:id/videos', async (req, res) => {
    try {
        const channel = await prisma.channel.findUnique({
            where: { id: req.params.id }
        });

        if (!channel) {
            return res.status(404).json({ success: false, error: { message: 'Channel not found' } });
        }

        const feedItemWhere = (await hasFeedItemStatusColumn())
            ? { status: { in: [...VISIBLE_FEED_ITEM_STATUSES] } }
            : {};
        const videos = await prisma.feedItem.findMany({
            where: {
                channelId: channel.channelId,
                ...feedItemWhere,
            },
            take: 20,
            orderBy: { publishedAt: 'desc' }
        });

        res.json({ success: true, data: videos });
    } catch (error) {
        console.error('Failed to fetch channel videos:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch channel videos' } });
    }
});

// GET /api/channels/:id/discovery-preview
router.get('/:id/discovery-preview', async (req, res) => {
    try {
        const limit = Number.parseInt(String(req.query.limit || '10'), 10);
        const data = await youtubePollerService.previewChannelDiscovery(
            req.params.id,
            Number.isFinite(limit) && limit > 0 ? Math.min(limit, 20) : 10
        );

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Failed to preview channel discovery:', error);
        res.status(error?.message === 'Channel not found' ? 404 : 500).json({
            success: false,
            error: { message: error?.message || 'Failed to preview channel discovery' },
        });
    }
});

export default router;
