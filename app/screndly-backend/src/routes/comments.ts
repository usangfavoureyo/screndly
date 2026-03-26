import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { findPlatformConnection } from '../lib/platformConnections';
import { hasUsablePlatformAccessToken } from '../services/platforms/connectionAuth';
import { commentsService } from '../services/comments.service';

const router = Router();

const COMMENT_PLATFORM_SETTING_KEYS = {
    X: 'xCommentBlacklist',
    Instagram: 'instagramCommentBlacklist',
    Facebook: 'facebookCommentBlacklist',
    Threads: 'threadsCommentBlacklist',
    YouTube: 'youtubeCommentBlacklist',
    TikTok: 'tiktokCommentBlacklist',
    Pinterest: 'pinterestCommentBlacklist',
} as const;

const COMMENT_AUTOMATION_PLATFORMS = ['X', 'Instagram', 'Facebook', 'Threads'] as const;

function parseSettingValue(value: unknown): Record<string, any> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, any>;
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, any>;
            }
        } catch {
            return {};
        }
    }

    return {};
}

// GET /api/comments/automation/stats
router.get('/automation/stats', authenticate, async (req, res) => {
    try {
        const [comments, settings] = await Promise.all([
            prisma.comment.findMany({
                orderBy: { updatedAt: 'desc' }
            }),
            prisma.setting.findMany({
                where: {
                    key: {
                        in: Object.values(COMMENT_PLATFORM_SETTING_KEYS),
                    }
                }
            })
        ]);

        const allPlatforms = ['X', 'Instagram', 'TikTok', 'Facebook', 'YouTube', 'Threads', 'Pinterest'];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const settingsMap = new Map(settings.map((setting) => [setting.key, parseSettingValue(setting.value)]));

        const platformData = allPlatforms.map(platform => {
            const platformComments = comments.filter(c => c.platform === platform);
            const repliesToday = platformComments.filter(c => c.repliedAt && new Date(c.repliedAt) >= today).length;
            const successfulReplies = platformComments.filter(c => !!c.reply).length;
            const pending = platformComments.filter(c => !c.processed && !c.blacklisted).length;
            const successRate = platformComments.length > 0
                ? Math.round((successfulReplies / platformComments.length) * 100)
                : 0;
            const settingKey = COMMENT_PLATFORM_SETTING_KEYS[platform as keyof typeof COMMENT_PLATFORM_SETTING_KEYS];
            const config = settingKey ? settingsMap.get(settingKey) || {} : {};

            return {
                platform,
                repliesToday,
                totalReplies: platformComments.length,
                pending,
                successRate,
                enabled: Boolean(config.active),
                recentReplies: platformComments
                    .filter((comment) => comment.repliedAt && comment.reply)
                    .slice(0, 5)
                    .map(comment => ({
                    comment: comment.content,
                    reply: comment.reply || '',
                    time: comment.repliedAt?.toISOString() || comment.updatedAt.toISOString()
                }))
            };
        });

        res.json({ success: true, data: platformData });
    } catch (error) {
        console.error('Error fetching comment automation stats:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch comment automation stats' } });
    }
});

// For viewing recent comment reply logs
router.get('/automation/recent', authenticate, async (req, res) => {
    try {
        const recentComments = await prisma.comment.findMany({
            where: { repliedAt: { not: null } },
            orderBy: { repliedAt: 'desc' },
            take: 20
        });
        res.json({ success: true, data: recentComments });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to fetch recent comments' } });
    }
});

router.get('/automation/readiness', authenticate, async (_req, res) => {
    try {
        const data = await commentsService.getAutomationReadiness();

        res.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('Error fetching comment automation readiness:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to fetch comment automation readiness' },
        });
    }
});

export default router;
