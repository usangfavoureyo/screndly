import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/logs
router.get('/', async (req, res) => {
    try {
        const { level, service, limit } = req.query;
        const logs = await prisma.log.findMany({
            where: {
                ...(level && { level: level as string }),
                ...(service && { service: service as string })
            },
            take: limit ? parseInt(limit as string) : 100,
            orderBy: { timestamp: 'desc' }
        });
        res.json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to fetch logs' } });
    }
});


// POST /api/logs
router.post('/', async (req, res) => {
    try {
        const { level, message, service, metadata } = req.body;
        const log = await prisma.log.create({
            data: {
                level: level || 'info',
                message,
                service: service || 'client',
                metadata: metadata || {}
            }
        });
        res.json({ success: true, data: log });
    } catch (error) {
        console.error('Failed to create log:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to create log' } });
    }
});

// GET /api/logs/errors
router.get('/errors', async (req, res) => {
    try {
        const logs = await prisma.log.findMany({
            where: { level: 'error' },
            take: 100,
            orderBy: { timestamp: 'desc' }
        });
        res.json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to fetch error logs' } });
    }
});

export default router;
