import fs from 'fs/promises';
import { Readable } from 'stream';
import { Router } from 'express';
import multer from 'multer';
import { isPsdSupportUnavailableError, readPsdSafely } from '../lib/psd';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { getBackblazeAuthorizedDownloadUrl, listBackblazeFiles, uploadLocalFileToBackblaze } from '../services/backblaze';
import {
  generateDesignStudioAutoEditorials,
  getDesignStudioRenderJobs,
  getDesignStudioStateSnapshot,
  publishScheduledDesignStudioAutoEditorials,
  queueManualDesignStudioRender,
  registerUploadedDesignStudioTemplate,
  saveDesignStudioStateSnapshot,
} from '../services/design-studio.service';

const router = Router();
const upload = multer({ dest: 'uploads/' });

function flattenLayerNames(children: Array<any> | undefined, lines: string[] = []): string[] {
  if (!Array.isArray(children)) {
    return lines;
  }

  for (const child of children) {
    if (child?.name && typeof child.name === 'string') {
      lines.push(child.name);
    }
    if (Array.isArray(child?.children)) {
      flattenLayerNames(child.children, lines);
    }
  }

  return lines;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function detectLayerPresence(layerNames: string[]) {
  const normalizedNames = layerNames.map(normalizeName);
  const hasMatch = (patterns: string[]) => normalizedNames.some((name) => patterns.some((pattern) => name.includes(pattern)));

  return {
    hasHeader: hasMatch(['header', 'title', 'headline', 'main']),
    hasSubtext: hasMatch(['subtext', 'subtitle', 'description', 'caption', 'body']),
    hasOverlay: hasMatch(['overlay', 'gradient']),
    hasBackground: hasMatch(['background', 'image', 'photo', 'artwork', 'bg']),
  };
}

function buildPsdSignature(buffer: Buffer): string {
  return buffer.subarray(0, 4).toString('ascii');
}

async function authorizeDesignStudioMediaUrl(url?: string | null): Promise<string | undefined> {
  if (!url) {
    return undefined;
  }

  try {
    if (!/backblazeb2\.com|backblaze\.com|\/file\//i.test(url)) {
      return url;
    }
    return await getBackblazeAuthorizedDownloadUrl(url, 60 * 60);
  } catch {
    return url;
  }
}

async function authorizeDesignStudioActivity<T extends { details?: unknown }>(activity: T): Promise<T> {
  const details = activity.details && typeof activity.details === 'object' && !Array.isArray(activity.details)
    ? activity.details as Record<string, unknown>
    : {};

  return {
    ...activity,
    details: {
      ...details,
      previewUrl: await authorizeDesignStudioMediaUrl(typeof details.previewUrl === 'string' ? details.previewUrl : undefined),
      outputUrl: await authorizeDesignStudioMediaUrl(typeof details.outputUrl === 'string' ? details.outputUrl : undefined),
    },
  };
}

const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceType: z.enum(['device', 'backblaze']).optional(),
  sourceFilePath: z.string().optional(),
  previewImage: z.string().optional(),
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
  baseVariant: z.enum(['top_left', 'top_right', 'top_center', 'bottom_left', 'bottom_right', 'bottom_center']).optional(),
  mappedLayers: z.record(z.string()).optional(),
  mappedLayerNames: z.array(z.string()).optional(),
  layerReferences: z.array(z.record(z.any())).optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.string().optional(),
  fontWeight: z.number().optional(),
  baseFontSize: z.number().optional(),
  fontColor: z.string().optional(),
  lineHeightMultiplier: z.number().optional(),
  tracking: z.number().optional(),
  isPointText: z.boolean().optional(),
  variants: z.array(z.record(z.any())).optional(),
  overlayDirection: z.string().optional(),
  overlayStrength: z.number().optional(),
  safeMargin: z.number().optional(),
  isValidated: z.boolean().optional(),
  validationState: z.enum(['valid', 'warning', 'invalid']).optional(),
  validationErrors: z.array(z.string()).optional(),
  isDefaultManual: z.boolean().optional(),
  isDefaultAuto: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const renderedDesignSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  templateName: z.string(),
  mode: z.enum(['manual', 'auto']).optional(),
  templateVariant: z.enum(['top_left', 'top_right', 'top_center', 'bottom_left', 'bottom_right', 'bottom_center']).optional(),
  exportFormat: z.enum(['jpeg', 'png']).optional(),
  outputUrl: z.string(),
  previewUrl: z.string().optional(),
  data: z.record(z.any()),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  aspectRatio: z.string(),
  caption: z.string().optional(),
  captionSource: z.enum(['generated', 'manual']).optional(),
  selectedPlatforms: z.array(z.string()).optional(),
  scheduledFor: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  status: z.enum(['draft', 'rendered', 'scheduled', 'published', 'failed']).optional(),
  articleTitle: z.string().optional(),
  articleSummary: z.string().optional(),
  sourceUrl: z.string().optional(),
  captions: z.record(z.any()).optional(),
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
  templateVariant: z.enum(['top_left', 'top_right', 'top_center', 'bottom_left', 'bottom_right', 'bottom_center']).optional(),
  renderedImage: z.string(),
  headerText: z.string(),
  subheaderText: z.string().optional(),
  caption: z.string(),
  captions: z.record(z.any()).optional(),
  backgroundSource: z.string().optional(),
  backgroundOffsetX: z.number().optional(),
  backgroundOffsetY: z.number().optional(),
  zoomLevel: z.number().optional(),
  overlayDirection: z.string().optional(),
  overlayStrength: z.number().optional(),
  scheduleTime: z.string().nullable().optional(),
  targetPlatforms: z.array(z.string()),
  status: z.enum(['detected', 'rendering', 'queued', 'posted', 'failed']),
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
    'design_render_queued',
    'design_rendered',
    'design_render_failed',
    'design_scheduled',
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

const renderJobSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  templateName: z.string(),
  status: z.enum(['queued', 'rendering', 'completed', 'failed']),
  createdAt: z.string(),
  updatedAt: z.string(),
  renderedDesignId: z.string().nullable().optional(),
  outputUrl: z.string().nullable().optional(),
  failureReason: z.string().nullable().optional(),
});

const manualRenderRequestSchema = z.object({
  template: templateSchema,
  data: z.object({
    template_variant: z.enum(['top_left', 'top_right', 'top_center', 'bottom_left', 'bottom_right', 'bottom_center']).optional(),
    headerText: z.string(),
    subtext: z.string().optional(),
    headerTextColor: z.string().optional(),
    subtextColor: z.string().optional(),
    backgroundImage: z.string().optional(),
    imageFocalPoint: z.object({
      x: z.number(),
      y: z.number(),
    }).optional(),
    imageZoom: z.number().optional(),
    overlayColor: z.string().optional(),
    overlayOpacity: z.number().optional(),
    gradientPosition: z.enum(['top', 'bottom', 'left', 'right', 'top_left', 'top_right', 'bottom_left', 'bottom_right']).optional(),
    caption: z.string().optional(),
    contentType: z.enum(['poster', 'carousel', 'story', 'announcement', 'general']).optional(),
    cropMode: z.enum(['cover', 'contain', 'center', 'face_focus']).optional(),
    headerAlignment: z.enum(['left', 'center', 'right']).optional(),
    fontScale: z.number().optional(),
    headlineWidthScale: z.number().optional(),
    headlineDensity: z.number().optional(),
    lineHeightMultiplier: z.number().optional(),
    useCircleInset: z.boolean().optional(),
    circleInsetImage: z.string().optional(),
    circleX: z.number().optional(),
    circleY: z.number().optional(),
    circleSize: z.number().optional(),
    circleImageZoom: z.number().optional(),
    circleImageOffsetX: z.number().optional(),
    circleImageOffsetY: z.number().optional(),
    circleStrokeWidth: z.number().optional(),
    circleStrokeColor: z.string().optional(),
    circleImageFit: z.enum(['contain', 'cover']).optional(),
    maxLines: z.number().optional(),
    overlayType: z.enum(['linear', 'radial', 'full_fade', 'top_fade', 'bottom_fade']).optional(),
    useTemplateDefaultStyling: z.boolean().optional(),
    backgroundOffsetX: z.number().optional(),
    backgroundOffsetY: z.number().optional(),
    zoomLevel: z.number().optional(),
    fadeEnabled: z.boolean().optional(),
    fadeOpacity: z.number().optional(),
    brandBlockMode: z.enum(['auto', 'black', 'white']).optional(),
    sharedCaption: z.string().optional(),
    pinterestTitle: z.string().optional(),
    pinterestDescription: z.string().optional(),
    sourceHeadline: z.string().optional(),
    sourceSummary: z.string().optional(),
    sourceUrl: z.string().optional(),
    sourceName: z.string().optional(),
    exportFormat: z.enum(['jpeg', 'png']).optional(),
  }),
});

router.get('/state', authenticate, async (_req, res) => {
  try {
    const { templates, renderedDesigns, autoEditorials } = await getDesignStudioStateSnapshot();

    const hydratedTemplates = await Promise.all(
      (Array.isArray(templates) ? templates : []).map(async (template) => ({
        ...template,
        previewImage: await authorizeDesignStudioMediaUrl(template.previewImage),
        previewUrl: (await authorizeDesignStudioMediaUrl(template.previewUrl)) || template.previewUrl,
      })),
    );

    const hydratedRenderedDesigns = await Promise.all(
      (Array.isArray(renderedDesigns) ? renderedDesigns : []).map(async (renderedDesign) => ({
        ...renderedDesign,
        outputUrl: (await authorizeDesignStudioMediaUrl(renderedDesign.outputUrl)) || renderedDesign.outputUrl,
        previewUrl: await authorizeDesignStudioMediaUrl(renderedDesign.previewUrl || renderedDesign.outputUrl),
      })),
    );

    const hydratedAutoEditorials = await Promise.all(
      (Array.isArray(autoEditorials) ? autoEditorials : []).map(async (editorial) => ({
        ...editorial,
        renderedImage: (await authorizeDesignStudioMediaUrl(editorial.renderedImage)) || editorial.renderedImage,
      })),
    );

    const data = designStudioStateSchema.parse({
      templates: hydratedTemplates,
      renderedDesigns: hydratedRenderedDesigns,
      autoEditorials: hydratedAutoEditorials,
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

router.post('/upload-template', authenticate, upload.single('mediaFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No PSD file uploaded' } });
    }

    const fileBuffer = await fs.readFile(req.file.path);
    const signature = buildPsdSignature(fileBuffer);
    if (signature !== '8BPS') {
      return res.status(400).json({ success: false, error: { message: 'Uploaded file is not a valid PSD' } });
    }

    const psd = readPsdSafely(fileBuffer, {
      skipCompositeImageData: true,
      skipLayerImageData: true,
      skipThumbnail: true,
    });

    const layerNames = flattenLayerNames(psd.children);
    const detectedLayers = detectLayerPresence(layerNames);

    const uploadResult = await uploadLocalFileToBackblaze(req.file.path, req.file.originalname, {
      bucketTypes: ['design', 'general'],
      prefix: 'design-studio/templates',
      contentType: req.file.mimetype || 'application/vnd.adobe.photoshop',
    });

    const template = await registerUploadedDesignStudioTemplate({
      buffer: fileBuffer,
      fileName: req.file.originalname,
      sourceType: 'device',
      sourceFilePath: uploadResult.url,
      uploadedUrl: uploadResult.url,
    });

    res.status(201).json({
      success: true,
      data: {
        url: uploadResult.url,
        fileName: uploadResult.fileName,
        signature,
        width: psd.width,
        height: psd.height,
        layers: layerNames,
        detectedLayers,
        template,
      },
    });
  } catch (error) {
    console.error('Error uploading/analyzing Design Studio PSD template:', error);
    if (isPsdSupportUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        error: { message: 'Design Studio PSD uploads are unavailable because the server is missing the required canvas dependency.' },
      });
    }
    res.status(500).json({ success: false, error: { message: error instanceof Error ? error.message : 'Failed to upload PSD template' } });
  } finally {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => undefined);
    }
  }
});

router.post('/import-template', authenticate, async (req, res) => {
  try {
    const payload = z.object({
      url: z.string().url(),
      fileName: z.string().min(1),
    }).parse(req.body);

    const sourceUrl = await fetch(payload.url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch template (${response.status})`);
        }
        return Buffer.from(await response.arrayBuffer());
      });

    const signature = buildPsdSignature(sourceUrl);
    if (signature !== '8BPS') {
      return res.status(400).json({ success: false, error: { message: 'Backblaze file is not a valid PSD' } });
    }

    const template = await registerUploadedDesignStudioTemplate({
      buffer: sourceUrl,
      fileName: payload.fileName,
      sourceType: 'backblaze',
      sourceFilePath: payload.url,
      uploadedUrl: payload.url,
    });

    res.status(201).json({ success: true, data: { template } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: 'Invalid template import request', details: error.errors } });
    }
    console.error('Error importing Design Studio template from Backblaze:', error);
    res.status(500).json({ success: false, error: { message: error instanceof Error ? error.message : 'Failed to import template' } });
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
    const hydratedActivities = await Promise.all(activities.map((activity) => authorizeDesignStudioActivity(activity)));
    res.json({ success: true, data: hydratedActivities });
  } catch (error) {
    console.error('Error fetching design studio activity:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch design studio activity' } });
  }
});

router.get('/render-jobs', authenticate, async (_req, res) => {
  try {
    const jobs = await getDesignStudioRenderJobs();
    const hydratedJobs = await Promise.all(
      jobs.map(async (job) => ({
        ...job,
        outputUrl: await authorizeDesignStudioMediaUrl(job.outputUrl),
      })),
    );
    res.json({
      success: true,
      data: hydratedJobs.map((job) => renderJobSchema.parse(job)),
    });
  } catch (error) {
    console.error('Error fetching design studio render jobs:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch render jobs' } });
  }
});

router.get('/media-stream', async (req, res) => {
  try {
    const rawUrl = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl) {
      return res.status(400).json({
        success: false,
        error: { message: 'Media URL is required' },
      });
    }

    const authorizedUrl = /backblazeb2\.com|backblaze\.com|\/file\//i.test(rawUrl)
      ? await getBackblazeAuthorizedDownloadUrl(rawUrl, 60 * 60)
      : rawUrl;
    const upstreamResponse = await fetch(authorizedUrl, {
      headers: req.headers.range ? { Range: req.headers.range } : undefined,
    });

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        success: false,
        error: { message: `Failed to stream design studio media (${upstreamResponse.status})` },
      });
    }

    const contentType = upstreamResponse.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstreamResponse.headers.get('content-length');
    const contentRange = upstreamResponse.headers.get('content-range');
    const acceptRanges = upstreamResponse.headers.get('accept-ranges');

    res.status(upstreamResponse.status);
    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }
    if (acceptRanges) {
      res.setHeader('Accept-Ranges', acceptRanges);
    }
    res.setHeader('Cache-Control', 'private, max-age=300');

    if (!upstreamResponse.body) {
      return res.end();
    }

    Readable.fromWeb(upstreamResponse.body as never).pipe(res);
  } catch (error) {
    console.error('Error streaming design studio media:', error);
    return res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to stream design studio media' },
    });
  }
});

router.post('/generate-auto', authenticate, async (_req, res) => {
  try {
    const result = await generateDesignStudioAutoEditorials();
    res.status(202).json({ success: true, data: result });
  } catch (error) {
    console.error('Error generating Design Studio auto editorials:', error);
    res.status(500).json({ success: false, error: { message: error instanceof Error ? error.message : 'Failed to generate auto editorials' } });
  }
});

router.post('/publish-auto', authenticate, async (_req, res) => {
  try {
    const result = await publishScheduledDesignStudioAutoEditorials();
    res.status(202).json({ success: true, data: result });
  } catch (error) {
    console.error('Error publishing Design Studio auto editorials:', error);
    res.status(500).json({ success: false, error: { message: error instanceof Error ? error.message : 'Failed to publish auto editorials' } });
  }
});

router.post('/render-jobs', authenticate, async (req, res) => {
  try {
    const payload = manualRenderRequestSchema.parse(req.body);
    const job = await queueManualDesignStudioRender(payload);
    res.status(202).json({
      success: true,
      data: renderJobSchema.parse(job),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: 'Invalid render request', details: error.errors } });
    }

    console.error('Error queueing design studio render job:', error);
    res.status(500).json({ success: false, error: { message: error instanceof Error ? error.message : 'Failed to queue render job' } });
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

router.put('/activity/:id', authenticate, async (req, res) => {
  try {
    const payload = z.object({
      details: z.any(),
    }).parse(req.body);

    const updatedActivity = await prisma.designStudioActivity.update({
      where: { id: req.params.id },
      data: {
        details: payload.details,
      },
    });

    res.json({ success: true, data: updatedActivity });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: 'Invalid data', details: error.errors } });
    }
    console.error('Error updating design studio activity:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to update activity' } });
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
