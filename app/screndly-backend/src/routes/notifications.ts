import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

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
