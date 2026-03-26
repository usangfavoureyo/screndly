import { Router } from 'express';
import prisma from '../lib/prisma';
import { getActiveNotificationWhere, getExpiredNotificationWhere, purgeExpiredNotifications } from '../services/notification-retention.service';
import { authenticate } from '../middleware/auth';
import { webPushService } from '../services/web-push.service';
import { getRSSActivity } from '../services/rss.service';

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

function extractQuotedTitle(value: string): string | null {
    const smartQuoteMatch = value.match(/[“"]([^”"]+)[”"]/);
    if (smartQuoteMatch?.[1]) {
        return smartQuoteMatch[1].trim();
    }

    return null;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferRssFeedName(title: string): string | null {
    const match = title.match(/^RSS:\s*(.+)$/i);
    return match?.[1]?.trim() || null;
}

function normalizeNotificationText(value: string): string {
    return String(value || '')
        .toLowerCase()
        .replace(/['"`\u2018\u2019\u201c\u201d]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function titleTokenOverlapScore(left: string, right: string): number {
    const leftTokens = new Set(normalizeNotificationText(left).split(' ').filter((token) => token.length >= 4));
    const rightTokens = new Set(normalizeNotificationText(right).split(' ').filter((token) => token.length >= 4));

    if (leftTokens.size === 0 || rightTokens.size === 0) {
        return 0;
    }

    let overlap = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) {
            overlap += 1;
        }
    }

    return overlap / Math.max(Math.min(leftTokens.size, rightTokens.size), 1);
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
    const defaultActionTarget = mapActionTarget(notification.actionPage, notification.source);

    if (notification.source === 'rss') {
        const feedName = inferRssFeedName(notification.title || '');
        const quotedTitle = extractQuotedTitle(notification.message || '');
        const createdAt = new Date(notification.createdAt);
        const windowStart = new Date(createdAt.getTime() - 2 * 60 * 60 * 1000);
        const windowEnd = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
        const activity = await getRSSActivity(250);
        const normalizedQuotedTitle = normalizeNotificationText(quotedTitle || '');

        const publishedCandidates = activity.items.filter((item) => {
            if (item.status !== 'published') {
                return false;
            }

            const itemTime = new Date(item.timestamp).getTime();
            if (Number.isFinite(itemTime) && (itemTime < windowStart.getTime() || itemTime > windowEnd.getTime())) {
                return false;
            }

            if (feedName && item.feedName !== feedName) {
                return false;
            }

            if (quotedTitle) {
                const normalizedItemTitle = normalizeNotificationText(item.title || '');
                if (!normalizedItemTitle) {
                    return false;
                }

                if (
                    normalizedItemTitle === normalizedQuotedTitle ||
                    normalizedItemTitle.includes(normalizedQuotedTitle) ||
                    normalizedQuotedTitle.includes(normalizedItemTitle)
                ) {
                    return true;
                }

                return titleTokenOverlapScore(item.title || '', quotedTitle) >= 0.7;
            }

            return true;
        });
        const relatedItems = [...publishedCandidates]
            .sort((left, right) => {
                const leftDistance = Math.abs(new Date(left.timestamp).getTime() - createdAt.getTime());
                const rightDistance = Math.abs(new Date(right.timestamp).getTime() - createdAt.getTime());
                return leftDistance - rightDistance;
            })
            .slice(0, 10);

        return {
            kind: 'generic',
            actionTarget: relatedItems.length > 0
                ? { page: 'rss-activity', itemId: relatedItems[0].id }
                : defaultActionTarget,
            relatedItems: relatedItems.map((item) => ({
                id: item.id,
                title: item.title,
                link: item.link,
                source: item.feedName,
                status: item.status,
                imageUrl: item.imageUrl,
                createdAt: item.timestamp,
            }))
        };
    }

    if (notification.source !== 'tmdb') {
        return {
            kind: 'generic',
            actionTarget: defaultActionTarget,
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
        actionTarget: defaultActionTarget,
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
