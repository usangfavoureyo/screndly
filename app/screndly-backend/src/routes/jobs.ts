import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/jobs
router.get('/', async (req, res) => {
    try {
        const { status, limit } = req.query;
        const jobs = await prisma.uploadJob.findMany({
            where: status ? { status: status as string } : {},
            take: limit ? parseInt(limit as string) : 50,
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: jobs });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to fetch jobs' } });
    }
});

// GET /api/jobs/:id
router.get('/:id', async (req, res) => {
    try {
        const job = await prisma.uploadJob.findUnique({ where: { id: req.params.id } });
        if (!job) return res.status(404).json({ success: false, error: { message: 'Job not found' } });
        res.json({ success: true, data: job });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to fetch job' } });
    }
});

// POST /api/jobs
router.post('/', async (req, res) => {
    try {
        const { fileName, fileSize, sourceUrl, scheduledFor } = req.body;
        const job = await prisma.uploadJob.create({
            data: {
                fileName,
                fileSize,
                sourceUrl,
                scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
                status: 'pending',
                stage: 'queued',
                progress: 0,
                metadata: {},
                events: []
            }
        });
        res.json({ success: true, data: job });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to create job' } });
    }
});

// PUT /api/jobs/:id
router.put('/:id', async (req, res) => {
    try {
        const job = await prisma.uploadJob.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json({ success: true, data: job });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to update job' } });
    }
});

// DELETE /api/jobs/:id
router.delete('/:id', async (req, res) => {
    try {
        await prisma.uploadJob.delete({ where: { id: req.params.id } });
        res.json({ success: true, data: { message: 'Job deleted successfully' } });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to delete job' } });
    }
});

// POST /api/jobs/:id/retry
router.post('/:id/retry', async (req, res) => {
    try {
        const job = await prisma.uploadJob.update({
            where: { id: req.params.id },
            data: { status: 'pending', stage: 'queued', progress: 0, error: undefined }
        });
        res.json({ success: true, data: { message: 'Job queued for retry', job } });
    } catch (error) {
        res.status(500).json({ success: false, error: { message: 'Failed to retry job' } });
    }
});

export default router;
