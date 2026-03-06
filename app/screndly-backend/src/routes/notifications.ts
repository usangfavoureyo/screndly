import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

function inferTmdbSource(title: string, message: string): string | null {
    const haystack = `${title} ${message}`.toLowerCase();
    if (haystack.includes('anniversary')) return 'tmdb_anniversary';
    if (haystack.includes('monthly')) return 'tmdb_monthly';
    if (haystack.includes('weekly')) return 'tmdb_weekly';
    if (haystack.includes('today')) return 'tmdb_today';
    return null;
}

function inferExpectedItemCount(message: string): number {
    const match = message.match(/(\d+)/);
    if (!match) return 10;
    const value = Number.parseInt(match[1], 10);
    if (Number.isNaN(value) || value <= 0) return 10;
    return Math.min(value, 20);
}

function mapActionTarget(actionPage?: string | null, source?: string | null) {
    if (actionPage === '/tmdb-feeds' || source === 'tmdb') {
        return { page: 'feeds', tab: 'tmdb' as const };
    }

    if (actionPage === '/rss-feeds' || source === 'rss') {
        return { page: 'feeds', tab: 'rss' as const };
    }

    if (!actionPage) return null;

    const page = actionPage.replace(/^\//, '');
    if (!page) return null;

    return { page };
}

async function buildNotificationDetail(notification: any) {
    const actionTarget = mapActionTarget(notification.actionPage, notification.source);

    if (notification.source !== 'tmdb') {
        return {
            kind: 'generic',
            actionTarget,
            relatedItems: []
        };
    }

    const source = inferTmdbSource(notification.title, notification.message);
    const take = inferExpectedItemCount(notification.message);
    const createdAt = new Date(notification.createdAt);
    const windowStart = new Date(createdAt.getTime() - 60 * 60 * 1000);
    const windowEnd = new Date(createdAt.getTime() + 60 * 60 * 1000);

    let relatedItems = await prisma.tMDbPost.findMany({
        where: {
            ...(source ? { source } : {}),
            createdAt: {
                gte: windowStart,
                lte: windowEnd
            }
        },
        orderBy: [{ createdAt: 'desc' }],
        take
    });

    if (relatedItems.length === 0 && source) {
        relatedItems = await prisma.tMDbPost.findMany({
            where: {
                source,
                createdAt: {
                    lte: createdAt
                }
            },
            orderBy: [{ createdAt: 'desc' }],
            take
        });
    }

    return {
        kind: 'tmdb_refresh',
        actionTarget,
        relatedItems: relatedItems.map((item) => ({
            id: item.id,
            title: item.title,
            mediaType: item.mediaType,
            source: item.source,
            status: item.status,
            imageUrl: item.imageUrl,
            imageType: item.imageType,
            releaseDate: item.releaseDate,
            scheduledTime: item.scheduledTime,
            createdAt: item.createdAt
        }))
    };
}

// GET /api/notifications
router.get('/', async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json({ success: true, data: notifications });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to fetch notifications' } });
    }
});

// GET /api/notifications/:id/detail
router.get('/:id/detail', async (req, res) => {
    try {
        const notification = await prisma.notification.findUnique({
            where: { id: req.params.id }
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                error: { message: 'Notification not found' }
            });
        }

        const detail = await buildNotificationDetail(notification);

        res.json({
            success: true,
            data: {
                notification,
                detail
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to fetch notification detail' } });
    }
});

// POST /api/notifications
router.post('/', async (req, res) => {
    try {
        const { type, title, message, source, actionPage } = req.body;
        const notification = await prisma.notification.create({
            data: { type, title, message, source, actionPage }
        });
        res.json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to create notification' } });
    }
});

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', async (req, res) => {
    try {
        const result = await prisma.notification.updateMany({
            where: { read: false },
            data: { read: true }
        });

        res.json({
            success: true,
            data: {
                updated: result.count
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to mark notifications as read' } });
    }
});

// PUT /api/notifications/:id
router.put('/:id', async (req, res) => {
    try {
        const notification = await prisma.notification.update({
            where: { id: req.params.id },
            data: { read: req.body.read }
        });
        res.json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to update notification' } });
    }
});

// DELETE /api/notifications
router.delete('/', async (req, res) => {
    try {
        const result = await prisma.notification.deleteMany({});
        res.json({
            success: true,
            data: {
                deleted: result.count
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to clear notifications' } });
    }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
    try {
        await prisma.notification.delete({ where: { id: req.params.id } });
        res.json({ success: true, data: { message: 'Notification deleted successfully' } });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to delete notification' } });
    }
});

export default router;
