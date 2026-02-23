import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/channels
router.get('/', async (req, res) => {
    try {
        const channels = await prisma.channel.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: channels });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to fetch channels' } });
    }
});

// POST /api/channels
router.post('/', async (req, res) => {
    try {
        const { channelId, name } = req.body;
        const channel = await prisma.channel.create({
            data: {
                channelId,
                name: name || 'New Channel',
                status: 'active'
            }
        });
        res.json({ success: true, data: channel });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to add channel' } });
    }
});

// PATCH /api/channels/:id
router.patch('/:id', async (req, res) => {
    try {
        const { status, active } = req.body;
        // Support both status string and active boolean (legacy)
        let newStatus = status;
        if (active !== undefined) {
            newStatus = active ? 'active' : 'inactive';
        }

        const channel = await prisma.channel.update({
            where: { id: req.params.id },
            data: { status: newStatus }
        });
        res.json({ success: true, data: channel });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to update channel' } });
    }
});

// DELETE /api/channels/:id
router.delete('/:id', async (req, res) => {
    try {
        await prisma.channel.delete({ where: { id: req.params.id } });
        res.json({ success: true, data: { message: 'Channel removed successfully' } });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to delete channel' } });
    }
});

// GET /api/channels/:id/videos (placeholder - would need YouTube API)
router.get('/:id/videos', async (req, res) => {
    res.json({ success: true, data: [] }); // Placeholder
});

export default router;
