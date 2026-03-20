import { Router } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/comments/automation/stats
router.get('/automation/stats', authenticate, async (req, res) => {
    try {
        const comments = await prisma.comment.findMany({
            where: {
                repliedAt: { not: null }
            },
            orderBy: { repliedAt: 'desc' }
        });

        const allPlatforms = ['X', 'Instagram', 'TikTok', 'Facebook', 'YouTube', 'Threads', 'Pinterest'];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const platformData = allPlatforms.map(platform => {
            const platformComments = comments.filter(c => c.platform === platform);
            const repliesToday = platformComments.filter(c => c.repliedAt && new Date(c.repliedAt) >= today).length;
            const successfulReplies = platformComments.filter(c => !!c.reply).length;
            const successRate = platformComments.length > 0
                ? Math.round((successfulReplies / platformComments.length) * 100)
                : 0;

            return {
                platform,
                repliesToday,
                totalReplies: platformComments.length,
                pending: 0,
                successRate,
                recentReplies: platformComments.slice(0, 5).map(comment => ({
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

export default router;
