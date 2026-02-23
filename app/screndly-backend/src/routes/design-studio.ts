import { Router } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';

const router = Router();

// Validation schema
const designStudioActivitySchema = z.object({
    type: z.enum(['template_uploaded', 'design_rendered', 'design_published']),
    details: z.any()
});

router.get('/activity', authenticate, async (req, res) => {
    try {
        const activities = await prisma.designStudioActivity.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json({ success: true, data: activities });
    } catch (error) {
        console.error('Error fetching design studio activity:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch design studio activity' } });
    }
});

router.post('/activity', authenticate, async (req, res) => {
    try {
        const validatedData = designStudioActivitySchema.parse(req.body);
        const newActivity = await prisma.designStudioActivity.create({
            data: {
                type: validatedData.type,
                details: validatedData.details
            }
        });
        res.status(201).json({ success: true, data: newActivity });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, error: { message: 'Invalid data', details: error.errors } });
        }
        console.error('Error creating design studio activity:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to create activity' } });
    }
});

router.delete('/activity/:id', authenticate, async (req, res) => {
    try {
        await prisma.designStudioActivity.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true, message: 'Activity deleted successfully' });
    } catch (error) {
        console.error('Error deleting activity:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to delete activity' } });
    }
});

export default router;
