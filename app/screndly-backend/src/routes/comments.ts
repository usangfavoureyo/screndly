import { Router } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/comments/automation/stats
router.get('/automation/stats', authenticate, async (req, res) => {
    try {
        // Aggregate comments by platform
        const comments = await prisma.comment.findMany({
            where: {
                repliedAt: { not: null } // Only considering replied comments
            }
        });

        // Current platform requirements:
        const enabledPlatforms = ['X', 'YouTube', 'Facebook', 'Instagram'];

        const platformData = enabledPlatforms.map(platform => {
            const platformComments = comments.filter(c => c.platform === platform);

            // Filter for "today"
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const repliesToday = platformComments.filter(c => c.repliedAt && new Date(c.repliedAt) >= today).length;

            // Note: successRate and pending are mocked per platform for now
            // until we add deeper queue concepts for comments.
            return {
                platform,
                repliesToday,
                totalReplies: platformComments.length,
                pending: 0,
                successRate: 100
            };
        });

        res.json({ success: true, data: platformData });
    } catch (error) {
        console.error('Error fetching comment automation stats:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch comment stats' } });
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
