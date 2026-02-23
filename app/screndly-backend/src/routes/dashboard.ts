import { Router } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', authenticate, async (req, res) => {
    try {
        // Run queries in parallel for performance
        const [
            systemErrors,
            dailyFailures,
            dailySuccess,
            commentsToday,
            recentReplies,
            activeUploads,
            completedUploads,
            activePipelines,
            apiUsage
        ] = await Promise.all([
            // System Stats
            prisma.log.count({ where: { level: 'error' } }),
            prisma.log.count({
                where: {
                    level: 'error',
                    timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                }
            }),
            prisma.log.count({
                where: {
                    level: 'info',
                    message: { contains: 'Success' },
                    timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                }
            }),

            // Comment Stats
            prisma.comment.count({
                where: {
                    repliedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                }
            }),
            prisma.comment.findMany({
                where: { repliedAt: { not: null } },
                orderBy: { repliedAt: 'desc' },
                take: 5
            }),

            // Upload Stats
            prisma.uploadJob.count({
                where: { status: { in: ['pending', 'processing', 'generating_metadata'] } }
            }),
            prisma.uploadJob.count({
                where: {
                    status: 'completed',
                    completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                }
            }),
            prisma.uploadJob.findMany({
                where: { status: { in: ['pending', 'processing', 'generating_metadata'] } },
                orderBy: { createdAt: 'desc' },
                take: 5
            }),

            // Api Usage sum
            prisma.apiUsage.groupBy({
                by: ['service'],
                _sum: { tokens: true }
            })
        ]);

        // Transform api usage array into object
        const apiUsageMap = apiUsage.reduce((acc, curr) => {
            acc[curr.service] = curr._sum.tokens || 0;
            return acc;
        }, {} as Record<string, number>);

        // Construct response
        const stats = {
            system: {
                cacheHitRate: 85, // Mocked for now (no cache layer tracking)
                systemErrors,
                dailyFailures,
                dailySuccess: dailySuccess || 1 // Avoid 0 division if used in rate calc
            },
            comments: {
                repliesToday: commentsToday,
                successRate: 98, // Mocked
                recentReplies // Add recent replies from the new query
            },
            uploads: {
                activeUploads,
                completedToday: completedUploads,
                pipeline: activePipelines // Provide actual pipelines from new query
            },
            usage: {
                openai: apiUsageMap['openai'] || 0,
                serper: apiUsageMap['serper'] || 0,
                tmdb: apiUsageMap['tmdb'] || 0,
                shotstack: apiUsageMap['shotstack'] || 0,
                googleSearch: apiUsageMap['googleSearch'] || 0,
                googleVideo: apiUsageMap['googleVideo'] || 0
            }
        };

        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch dashboard stats' } });
    }
});

// GET /api/dashboard/system-stats
router.get('/system-stats', authenticate, async (req, res) => {
    try {
        const errorCount = await prisma.log.count({ where: { level: 'error' } });
        res.json({
            success: true,
            data: {
                cacheHitRate: 85,
                systemErrors: errorCount,
                dailyFailures: 0,
                dailySuccess: 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to fetch system stats' } });
    }
});

export default router;
