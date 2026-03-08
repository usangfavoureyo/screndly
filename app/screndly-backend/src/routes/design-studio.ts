import fs from 'fs/promises';
import { Router } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { listBackblazeFiles, uploadLocalFileToBackblaze } from '../services/backblaze';

const router = Router();
const upload = multer({ dest: 'uploads/' });

const DESIGN_STUDIO_TEMPLATES_KEY = 'designStudioTemplates';
const DESIGN_STUDIO_RENDERED_KEY = 'designStudioRenderedDesigns';

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

const designStudioStateSchema = z.object({
  templates: z.array(templateSchema),
  renderedDesigns: z.array(renderedDesignSchema),
});

const designStudioActivitySchema = z.object({
  type: z.enum([
    'template_uploaded',
    'templates_loaded',
    'design_rendered',
    'design_published',
    'template_deleted',
  ]),
  details: z.any(),
});

async function readJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  if (!setting) {
    return fallback;
  }

  return (setting.value as T) ?? fallback;
}

async function writeJsonSetting(key: string, value: unknown): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value: value as any },
    create: { key, value: value as any },
  });
}

router.get('/state', authenticate, async (_req, res) => {
  try {
    const [templates, renderedDesigns] = await Promise.all([
      readJsonSetting(DESIGN_STUDIO_TEMPLATES_KEY, []),
      readJsonSetting(DESIGN_STUDIO_RENDERED_KEY, []),
    ]);

    const data = designStudioStateSchema.parse({
      templates: Array.isArray(templates) ? templates : [],
      renderedDesigns: Array.isArray(renderedDesigns) ? renderedDesigns : [],
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

    await Promise.all([
      writeJsonSetting(DESIGN_STUDIO_TEMPLATES_KEY, validatedState.templates),
      writeJsonSetting(DESIGN_STUDIO_RENDERED_KEY, validatedState.renderedDesigns),
    ]);

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
