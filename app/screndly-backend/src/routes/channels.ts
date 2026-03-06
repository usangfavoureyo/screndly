import { Router } from 'express';
import prisma from '../lib/prisma';
import { resolveYouTubeChannel } from '../services/youtube-channel-resolver';
import { youtubePollerService } from '../services/youtube-poller.service';

const router = Router();

function getStatusFromBody(body: any): string | undefined {
    if (typeof body?.status === 'string') {
        return body.status;
    }

    if (typeof body?.active === 'boolean') {
        return body.active ? 'active' : 'inactive';
    }

    return undefined;
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
        const items = await prisma.feedItem.findMany({
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

        const videos = await prisma.feedItem.findMany({
            where: { channelId: channel.channelId },
            take: 20,
            orderBy: { publishedAt: 'desc' }
        });

        res.json({ success: true, data: videos });
    } catch (error) {
        console.error('Failed to fetch channel videos:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch channel videos' } });
    }
});

export default router;
