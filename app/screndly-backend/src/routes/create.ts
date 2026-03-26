import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { getBackblazeAuthorizedDownloadUrl, uploadBufferToBackblaze } from '../services/backblaze';
import prisma from '../lib/prisma';

const router = Router();
const COMPOSE_STATE_KEY = 'composeState.v1';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 128 * 1024 * 1024,
  },
});

router.get('/state', authenticate, async (_req, res) => {
  try {
    const savedState = await prisma.setting.findUnique({
      where: { key: COMPOSE_STATE_KEY },
    });

    const rawValue = savedState?.value as { items?: unknown } | null | undefined;
    const items = Array.isArray(rawValue?.items) ? rawValue.items : [];

    res.json({
      success: true,
      data: {
        items,
        updatedAt: savedState?.updatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('Error loading compose state:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to load compose state' },
    });
  }
});

router.put('/state', authenticate, async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items) {
      return res.status(400).json({
        success: false,
        error: { message: 'Compose state items must be an array' },
      });
    }

    const savedState = await prisma.setting.upsert({
      where: { key: COMPOSE_STATE_KEY },
      update: {
        value: {
          version: 1,
          items,
        },
      },
      create: {
        key: COMPOSE_STATE_KEY,
        value: {
          version: 1,
          items,
        },
      },
    });

    res.json({
      success: true,
      data: {
        items,
        updatedAt: savedState.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error saving compose state:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to save compose state' },
    });
  }
});

router.post('/upload-asset', authenticate, upload.single('mediaFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'No file uploaded' },
      });
    }

    const isVideo = req.file.mimetype.startsWith('video/');
    const uploadResult = await uploadBufferToBackblaze(req.file.buffer, req.file.originalname, {
      bucketTypes: isVideo ? ['videos', 'general'] : ['general', 'videos'],
      prefix: isVideo ? 'compose/videos' : 'compose/images',
      contentType: req.file.mimetype,
    });
    const previewUrl = await getBackblazeAuthorizedDownloadUrl(uploadResult.url, 7 * 24 * 60 * 60);

    res.status(201).json({
      success: true,
      data: {
        url: uploadResult.url,
        previewUrl,
        fileName: uploadResult.fileName,
        fileId: uploadResult.fileName,
        originalName: req.file.originalname,
        contentType: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (error) {
    console.error('Error uploading compose asset:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to upload asset' },
    });
  }
});

router.post('/asset-preview', authenticate, async (req, res) => {
  try {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!rawUrl) {
      return res.status(400).json({
        success: false,
        error: { message: 'Asset URL is required' },
      });
    }

    const previewUrl = await getBackblazeAuthorizedDownloadUrl(rawUrl, 7 * 24 * 60 * 60);
    return res.json({
      success: true,
      data: {
        url: rawUrl,
        previewUrl,
      },
    });
  } catch (error) {
    console.error('Error resolving asset preview URL:', error);
    return res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to resolve asset preview URL' },
    });
  }
});

export default router;
