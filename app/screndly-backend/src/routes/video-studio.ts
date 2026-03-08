import { Router } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { getSecretSetting } from '../lib/settings';
import { env } from '../lib/env';
import { listBackblazeFiles, uploadBufferToBackblaze } from '../services/backblaze';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 64 * 1024 * 1024,
  },
});

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
  sceneSourceName: z.string().optional(),
});

const uploadFolderSchema = z.enum(['trailers', 'voiceovers', 'music']);

type TimeOffset = string | { seconds?: string | number; nanos?: number };

function parseTimeOffset(value: TimeOffset | undefined): number {
  if (!value) {
    return 0;
  }

  if (typeof value === 'string') {
    const numeric = Number.parseFloat(value.replace(/s$/, ''));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const seconds = typeof value.seconds === 'string'
    ? Number.parseFloat(value.seconds)
    : typeof value.seconds === 'number'
      ? value.seconds
      : 0;
  const nanos = typeof value.nanos === 'number' ? value.nanos : 0;

  return seconds + (nanos / 1_000_000_000);
}

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGoogleVideoIntelligence(
  apiKey: string,
  endpoint: string,
  body?: unknown
): Promise<Response> {
  const url = `https://videointelligence.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(apiKey)}`;
  return fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : {
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function parseGoogleResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

router.get('/activity', authenticate, async (_req, res) => {
  try {
    const activities = await prisma.videoStudioActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: activities });
  } catch (error) {
    console.error('Error fetching video studio activity:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch video studio activity' } });
  }
});

router.get('/backblaze/videos', authenticate, async (_req, res) => {
  try {
    const files = await listBackblazeFiles('videos', { maxFileCount: 1000 });
    const videoFiles = files.filter(file =>
      file.contentType.startsWith('video/') ||
      /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(file.fileName)
    );

    res.json({ success: true, data: videoFiles });
  } catch (error) {
    console.error('Error listing video-studio Backblaze videos:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to list Backblaze videos' },
    });
  }
});

router.get('/backblaze/subtitles', authenticate, async (_req, res) => {
  try {
    const files = await listBackblazeFiles('videos', { maxFileCount: 1000 });
    const subtitleFiles = files.filter(file => /\.(srt|vtt|sub)$/i.test(file.fileName));

    res.json({ success: true, data: subtitleFiles });
  } catch (error) {
    console.error('Error listing video-studio Backblaze subtitles:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to list Backblaze subtitle files' },
    });
  }
});

router.post('/upload-asset', authenticate, upload.single('mediaFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    const folder = uploadFolderSchema.safeParse(req.body.folder);
    if (!folder.success) {
      return res.status(400).json({ success: false, error: { message: 'Invalid upload folder' } });
    }

    const uploadResult = await uploadBufferToBackblaze(req.file.buffer, req.file.originalname, {
      bucketTypes: ['videos', 'general'],
      prefix: `video-studio/${folder.data}`,
      contentType: req.file.mimetype,
    });

    res.status(201).json({
      success: true,
      data: {
        url: uploadResult.url,
        fileName: uploadResult.fileName,
        originalName: req.file.originalname,
        contentType: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (error) {
    console.error('Error uploading video studio asset:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to upload asset' },
    });
  }
});

router.post('/analyze-trailer', authenticate, upload.single('mediaFile'), async (req, res) => {
  const apiKey = await getSecretSetting('googleVideoIntelligenceKey') || env.GOOGLE_API_KEY || null;
  if (!apiKey) {
    return res.status(400).json({ success: false, error: { message: 'Google Video Intelligence API key not configured' } });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, error: { message: 'No video file uploaded' } });
  }

  try {
    const annotateResponse = await fetchGoogleVideoIntelligence(apiKey, 'videos:annotate', {
      inputContent: req.file.buffer.toString('base64'),
      features: ['SHOT_CHANGE_DETECTION', 'TEXT_DETECTION'],
      videoContext: {
        textDetectionConfig: {
          languageHints: ['en'],
        },
      },
    });

    const annotateData = await parseGoogleResponse(annotateResponse);
    if (!annotateResponse.ok) {
      return res.status(annotateResponse.status).json({
        success: false,
        error: {
          message: annotateData?.error?.message || annotateData?.message || 'Google Video Intelligence API call failed',
          details: annotateData,
        },
      });
    }

    const operationName = annotateData?.name;
    if (!operationName) {
      return res.status(502).json({
        success: false,
        error: { message: 'Google Video Intelligence did not return an operation name' },
      });
    }

    let operationData: any = null;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await sleep(attempt === 0 ? 500 : 2000);
      const operationResponse = await fetchGoogleVideoIntelligence(apiKey, operationName);
      operationData = await parseGoogleResponse(operationResponse);

      if (!operationResponse.ok) {
        return res.status(operationResponse.status).json({
          success: false,
          error: {
            message: operationData?.error?.message || operationData?.message || 'Google Video Intelligence operation polling failed',
            details: operationData,
          },
        });
      }

      if (operationData?.done) {
        break;
      }
    }

    if (!operationData?.done) {
      return res.status(504).json({
        success: false,
        error: { message: 'Google Video Intelligence analysis timed out' },
      });
    }

    if (operationData.error) {
      return res.status(502).json({
        success: false,
        error: {
          message: operationData.error.message || 'Google Video Intelligence analysis failed',
          details: operationData.error,
        },
      });
    }

    const annotationResult = operationData?.response?.annotationResults?.[0];
    const shotAnnotations = Array.isArray(annotationResult?.shotAnnotations) ? annotationResult.shotAnnotations : [];
    const textAnnotations = Array.isArray(annotationResult?.textAnnotations) ? annotationResult.textAnnotations : [];

    const textSegments = textAnnotations.flatMap((annotation: any) =>
      Array.isArray(annotation?.segments)
        ? annotation.segments.map((segment: any) => ({
            text: annotation.text || '',
            confidence: typeof segment.confidence === 'number' ? segment.confidence : 0,
            startTime: parseTimeOffset(segment.segment?.startTimeOffset),
            endTime: parseTimeOffset(segment.segment?.endTimeOffset),
          }))
        : []
    );

    const shots = shotAnnotations.map((shot: any) => ({
      startTime: parseTimeOffset(shot.startTimeOffset),
      endTime: parseTimeOffset(shot.endTimeOffset),
    }));

    const shotsWithoutText = shots.filter((shot: { startTime: number; endTime: number }) =>
      !textSegments.some((segment: { startTime: number; endTime: number; confidence: number }) =>
        segment.confidence >= 0.6 &&
        intervalsOverlap(shot.startTime, shot.endTime, segment.startTime, segment.endTime)
      )
    );

    res.json({
      success: true,
      data: {
        shots,
        filteredShots: shotsWithoutText,
        textSegments,
        rawOperation: operationData.response,
      },
    });
  } catch (error) {
    console.error('Error analyzing trailer with Google Video Intelligence:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to analyze trailer' },
    });
  }
});

router.post('/activity', authenticate, async (req, res) => {
  try {
    const validatedData = videoStudioActivitySchema.parse(req.body);
    const newActivity = await prisma.videoStudioActivity.create({
      data: validatedData,
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
      data: validatedData,
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
      where: { id: req.params.id },
    });
    res.json({ success: true, message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to delete activity' } });
  }
});

export default router;
