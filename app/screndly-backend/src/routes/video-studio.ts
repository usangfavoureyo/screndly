import { Router } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';

const router = Router();

const videoStudioActivitySchema = z.object({
    type: z.enum(['review', 'monthly', 'scenes']),
    title: z.string(),
    status: z.enum(['processing', 'completed', 'failed']),
    aspectRatio: z.string().optional(),
    duration: z.string().optional(),
    downloads: z.number().default(0),
    published: z.boolean().default(false),
    platforms: z.array(z.string()).default([]),
    error: z.string().optional(),
    progress: z.number().optional(),
    sceneSource: z.string().optional(),
    sceneStart: z.string().optional(),
    sceneEnd: z.string().optional(),
    sceneSourceName: z.string().optional()
});

router.get('/activity', authenticate, async (req, res) => {
    try {
        const activities = await prisma.videoStudioActivity.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json({ success: true, data: activities });
    } catch (error) {
        console.error('Error fetching video studio activity:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch video studio activity' } });
    }
});

router.post('/activity', authenticate, async (req, res) => {
    try {
        const validatedData = videoStudioActivitySchema.parse(req.body);
        const newActivity = await prisma.videoStudioActivity.create({
            data: validatedData
        });
        res.status(201).json({ success: true, data: newActivity });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, error: { message: 'Invalid data', details: error.errors } });
        }
        console.error('Error creating video studio activity:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to create activity' } });
    }
});

router.put('/activity/:id', authenticate, async (req, res) => {
    try {
        const validatedData = videoStudioActivitySchema.partial().parse(req.body);
        const updatedActivity = await prisma.videoStudioActivity.update({
            where: { id: req.params.id },
            data: validatedData
        });
        res.json({ success: true, data: updatedActivity });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, error: { message: 'Invalid data', details: error.errors } });
        }
        console.error('Error updating video studio activity:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to update activity' } });
    }
});

router.delete('/activity/:id', authenticate, async (req, res) => {
    try {
        await prisma.videoStudioActivity.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true, message: 'Activity deleted successfully' });
    } catch (error) {
        console.error('Error deleting activity:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to delete activity' } });
    }
});

export default router;
