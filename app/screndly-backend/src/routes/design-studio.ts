import fs from 'fs/promises';
import { Router } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { listBackblazeFiles, uploadLocalFileToBackblaze } from '../services/backblaze';
import { getDesignStudioStateSnapshot, saveDesignStudioStateSnapshot } from '../services/design-studio.service';

const router = Router();
const upload = multer({ dest: 'uploads/' });

const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  previewUrl: z.string(),
  aspectRatio: z.string(),
  width: z.number(),
  height: z.number(),
  source: z.enum(['upload', 'backblaze']),
  lastEdited: z.string(),
  hasSubtext: z.boolean(),
  hasCategory: z.boolean().optional(),
  hasSource: z.boolean().optional(),
  psdData: z.record(z.any()).optional().nullable(),
  layoutVariant: z.enum(['top_left', 'top_right', 'top_center', 'bottom_left', 'bottom_right', 'bottom_center']).optional(),
  mappedLayers: z.array(z.string()).optional(),
  textZone: z.object({
    horizontal: z.enum(['left', 'center', 'right']),
    vertical: z.enum(['top', 'bottom']),
  }).optional(),
  imageAnchor: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  overlayDirection: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  overlayStrength: z.number().optional(),
  safeMargin: z.number().optional(),
  isValidated: z.boolean().optional(),
  validationState: z.enum(['valid', 'warning', 'invalid']).optional(),
  isDefaultManual: z.boolean().optional(),
  isDefaultAuto: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const renderedDesignSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  templateName: z.string(),
  outputUrl: z.string(),
  data: z.record(z.any()),
  createdAt: z.string(),
  aspectRatio: z.string(),
  caption: z.string().optional(),
  contentType: z.enum(['poster', 'carousel', 'story', 'announcement', 'general']).optional(),
});

const autoEditorialSchema = z.object({
  id: z.string(),
  sourceFeedItemId: z.string(),
  sourceFeedId: z.string().optional(),
  sourceFeedName: z.string().optional(),
  sourceTitle: z.string(),
  sourceUrl: z.string().optional(),
  matchedKeyword: z.string().optional(),
  templateId: z.string(),
  templateName: z.string().optional(),
  renderedImage: z.string(),
  headerText: z.string(),
  subheaderText: z.string().optional(),
  caption: z.string(),
  backgroundSource: z.string().optional(),
  backgroundOffsetX: z.number().optional(),
  backgroundOffsetY: z.number().optional(),
  zoomLevel: z.number().optional(),
  overlayDirection: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  overlayStrength: z.number().optional(),
  scheduleTime: z.string().nullable().optional(),
  targetPlatforms: z.array(z.string()),
  status: z.enum(['draft', 'queued', 'scheduled', 'posted', 'failed']),
  createdAt: z.string(),
  updatedAt: z.string(),
  postedAt: z.string().nullable().optional(),
  failureReason: z.string().nullable().optional(),
});

const designStudioStateSchema = z.object({
  templates: z.array(templateSchema),
  renderedDesigns: z.array(renderedDesignSchema),
  autoEditorials: z.array(autoEditorialSchema).optional().default([]),
});

const designStudioActivitySchema = z.object({
  type: z.enum([
    'template_uploaded',
    'templates_loaded',
    'design_rendered',
    'design_published',
    'template_deleted',
    'auto_editorial_generated',
    'auto_editorial_updated',
    'auto_editorial_posted',
    'auto_editorial_failed',
    'auto_editorial_deleted',
  ]),
  details: z.any(),
});

router.get('/state', authenticate, async (_req, res) => {
  try {
    const { templates, renderedDesigns, autoEditorials } = await getDesignStudioStateSnapshot();

    const data = designStudioStateSchema.parse({
      templates: Array.isArray(templates) ? templates : [],
      renderedDesigns: Array.isArray(renderedDesigns) ? renderedDesigns : [],
      autoEditorials: Array.isArray(autoEditorials) ? autoEditorials : [],
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching Design Studio state:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch Design Studio state' } });
  }
});

router.put('/state', authenticate, async (req, res) => {
  try {
    const validatedState = designStudioStateSchema.parse(req.body);

    await saveDesignStudioStateSnapshot(validatedState);

    res.json({ success: true, data: validatedState });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: 'Invalid Design Studio state', details: error.errors } });
    }

    console.error('Error saving Design Studio state:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to save Design Studio state' } });
  }
});

router.post('/upload-asset', authenticate, upload.single('mediaFile'), async (req, res) => {
  try {
    const folder = typeof req.body.folder === 'string' ? req.body.folder.trim() : '';
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    if (!['templates', 'template-previews', 'renders'].includes(folder)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid upload folder' } });
    }

    const uploadResult = await uploadLocalFileToBackblaze(req.file.path, req.file.originalname, {
      bucketTypes: ['design', 'general'],
      prefix: `design-studio/${folder}`,
      contentType: req.file.mimetype,
    });

    res.status(201).json({
      success: true,
      data: {
        url: uploadResult.url,
        fileName: uploadResult.fileName,
      },
    });
  } catch (error) {
    console.error('Error uploading Design Studio asset:', error);
    res.status(500).json({ success: false, error: { message: error instanceof Error ? error.message : 'Failed to upload asset' } });
  } finally {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => undefined);
    }
  }
});

router.get('/backblaze/templates', authenticate, async (_req, res) => {
  try {
    const [namespacedTemplates, legacyTemplates] = await Promise.all([
      listBackblazeFiles('design', { prefix: 'design-studio/templates/', maxFileCount: 1000 }),
      listBackblazeFiles('design', { prefix: 'templates/', maxFileCount: 1000 }).catch(() => []),
    ]);

    const merged = [...namespacedTemplates, ...legacyTemplates]
      .filter(file => file.fileName.toLowerCase().endsWith('.psd'))
      .filter((file, index, files) => files.findIndex(other => other.fileId === file.fileId) === index);

    res.json({ success: true, data: merged });
  } catch (error) {
    console.error('Error listing design-studio Backblaze templates:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to list Backblaze templates' },
    });
  }
});

router.get('/activity', authenticate, async (_req, res) => {
  try {
    const activities = await prisma.designStudioActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
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
        details: validatedData.details,
      },
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
      where: { id: req.params.id },
    });
    res.json({ success: true, message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to delete activity' } });
  }
});

export default router;
