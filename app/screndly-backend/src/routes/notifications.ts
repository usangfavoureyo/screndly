import { Router } from 'express';
import prisma from '../lib/prisma';
import { getActiveNotificationWhere, getExpiredNotificationWhere, purgeExpiredNotifications } from '../services/notification-retention.service';
import { authenticate } from '../middleware/auth';
import { webPushService } from '../services/web-push.service';

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

router.get('/push/public-key', async (req, res) => {
    try {
        const publicKey = await webPushService.getPublicKey();
        res.json({
            success: true,
            data: {
                publicKey,
            },
        });
    } catch (error) {
        console.error('[Notifications] Failed to load web push public key:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to load web push configuration' },
        });
    }
});

router.post('/push/subscribe', authenticate, async (req, res) => {
    try {
        const subscription = req.body?.subscription ?? req.body;
        await webPushService.saveSubscription(subscription, req.get('user-agent'));
        res.json({ success: true });
    } catch (error: any) {
        console.error('[Notifications] Failed to save push subscription:', error);
        res.status(400).json({
            success: false,
            error: { message: error?.message || 'Failed to save push subscription' },
        });
    }
});

router.post('/push/unsubscribe', authenticate, async (req, res) => {
    try {
        const endpoint = String(req.body?.endpoint || '').trim();
        const deleted = await webPushService.removeSubscription(endpoint);
        res.json({
            success: true,
            data: { deleted },
        });
    } catch (error: any) {
        console.error('[Notifications] Failed to remove push subscription:', error);
        res.status(400).json({
            success: false,
            error: { message: error?.message || 'Failed to remove push subscription' },
        });
    }
});

router.post('/push/test', authenticate, async (req, res) => {
    try {
        const endpoint = String(req.body?.endpoint || '').trim() || undefined;
        const result = await webPushService.sendNotification(
            {
                title: 'Screndly Push Notifications',
                body: 'Push notifications are now fully enabled on this device.',
                url: '/',
                source: 'system',
                type: 'success',
                tag: 'screndly-push-test',
            },
            endpoint ? { endpoint } : {}
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error: any) {
        console.error('[Notifications] Failed to send test push notification:', error);
        res.status(500).json({
            success: false,
            error: { message: error?.message || 'Failed to send test push notification' },
        });
    }
});

// GET /api/notifications
router.get('/', async (req, res) => {
    try {
        await purgeExpiredNotifications();
        const activeWhere = await getActiveNotificationWhere();
        const notifications = await prisma.notification.findMany({
            where: activeWhere,
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

        const expiredWhere = await getExpiredNotificationWhere();
        const isExpired = await prisma.notification.findFirst({
            where: expiredWhere
                ? {
                    id: notification.id,
                    ...expiredWhere,
                }
                : {
                    id: '__cleanup-disabled__',
                },
            select: { id: true },
        });

        if (isExpired) {
            await prisma.notification.delete({ where: { id: notification.id } }).catch(() => undefined);
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
