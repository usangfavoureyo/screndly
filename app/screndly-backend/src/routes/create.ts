import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';
import sharp from 'sharp';
import { authenticate } from '../middleware/auth';
import { getBackblazeAuthorizedDownloadRequest, getBackblazeAuthorizedDownloadUrl, uploadBufferToBackblaze } from '../services/backblaze';
import { getComposeState, mergeComposeState, publishComposeItemInput } from '../services/compose.service';
import { trimTMDbLogoOuterBorderBuffer } from '../services/rss-logo-render.service';

const router = Router();
const execFileAsync = promisify(execFile);
const REMOTE_IMAGE_IMPORT_TIMEOUT_MS = 60_000;
const LOGO_IMPORT_OUTPUT_SIZE = 1600;
const LOGO_IMPORT_PADDING = Math.round(LOGO_IMPORT_OUTPUT_SIZE * 0.16);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 128 * 1024 * 1024,
  },
});

type RemoteTmdbImageCategory = 'backdrops' | 'posters' | 'profiles' | 'logos';

function slugifyAssetName(value: string): string {
  return value
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'tmdb-image';
}

function inferExtensionFromContentType(contentType: string): string {
  const normalized = contentType.split(';')[0].trim().toLowerCase();

  switch (normalized) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    case 'image/avif':
      return 'avif';
    default:
      return 'jpg';
  }
}

function chooseLogoBackground(stats: sharp.Stats): string {
  const averageRed = stats.channels[0]?.mean ?? 255;
  const averageGreen = stats.channels[1]?.mean ?? 255;
  const averageBlue = stats.channels[2]?.mean ?? 255;
  const averageBrightness = (averageRed + averageGreen + averageBlue) / 3;
  const averageChroma = (
    Math.abs(averageRed - averageGreen) +
    Math.abs(averageGreen - averageBlue) +
    Math.abs(averageRed - averageBlue)
  ) / 3;
  const isMostlyMonochrome = averageChroma < 18;

  if (isMostlyMonochrome) {
    return averageBrightness < 110 ? '#FFFFFF' : '#101010';
  }

  return averageBrightness > 170 ? '#111111' : '#FFFFFF';
}

async function fetchRemoteImageBuffer(sourceUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_IMAGE_IMPORT_TIMEOUT_MS);

  try {
    const response = await fetch(sourceUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch selected TMDb image (${response.status})`);
    }

    const contentType = (response.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) {
      throw new Error(`TMDb returned unsupported content type: ${contentType || 'unknown'}`);
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function normalizeImportedTmdbImage(
  buffer: Buffer,
  contentType: string,
  category: RemoteTmdbImageCategory,
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  if (category === 'logos') {
    const trimmedBuffer = await trimTMDbLogoOuterBorderBuffer(buffer);
    const resizedLogo = await sharp(trimmedBuffer, { animated: false })
      .resize({
        width: LOGO_IMPORT_OUTPUT_SIZE - (LOGO_IMPORT_PADDING * 2),
        height: LOGO_IMPORT_OUTPUT_SIZE - (LOGO_IMPORT_PADDING * 2),
        fit: 'inside',
        withoutEnlargement: false,
      })
      .png()
      .toBuffer();
    const stats = await sharp(resizedLogo, { animated: false }).stats();
    const background = chooseLogoBackground(stats);
    const outputBuffer = await sharp({
      create: {
        width: LOGO_IMPORT_OUTPUT_SIZE,
        height: LOGO_IMPORT_OUTPUT_SIZE,
        channels: 4,
        background,
      },
    })
      .composite([{ input: resizedLogo, gravity: 'center' }])
      .png()
      .toBuffer();

    return {
      buffer: outputBuffer,
      contentType: 'image/png',
      extension: 'png',
    };
  }

  if (contentType === 'image/svg+xml') {
    return {
      buffer: await sharp(buffer, { animated: false }).png().toBuffer(),
      contentType: 'image/png',
      extension: 'png',
    };
  }

  return {
    buffer,
    contentType,
    extension: inferExtensionFromContentType(contentType),
  };
}

function even(value: number) {
  return Math.max(2, Math.floor(value / 2) * 2);
}

async function probeVideoDimensions(filePath: string): Promise<{ width: number; height: number; duration?: number }> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height:format=duration',
    '-of',
    'json',
    filePath,
  ]);

  const parsed = JSON.parse(stdout) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const stream = Array.isArray(parsed.streams) ? parsed.streams[0] : undefined;
  const width = Number(stream?.width || 0);
  const height = Number(stream?.height || 0);

  if (!width || !height) {
    throw new Error('Failed to read video dimensions for the 3:4 crop.');
  }

  const duration = Number.parseFloat(parsed.format?.duration || '0') || undefined;
  return { width, height, duration };
}

async function cropVideoToThreeByFour(inputPath: string, outputPath: string, focusYPercent: number) {
  const metadata = await probeVideoDimensions(inputPath);
  const targetRatio = 3 / 4;
  const cropWidth = even(metadata.width);
  const cropHeight = even(Math.min(metadata.height, Math.floor(cropWidth / targetRatio)));
  const maxYOffset = Math.max(metadata.height - cropHeight, 0);
  const cropY = even((maxYOffset * Math.max(0, Math.min(focusYPercent, 100))) / 100);
  const filter = `crop=${cropWidth}:${cropHeight}:0:${cropY},setsar=1`;

  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-vf',
    filter,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '22',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    outputPath,
  ], {
    timeout: 180000,
    maxBuffer: 10 * 1024 * 1024,
  });
}

router.get('/state', authenticate, async (_req, res) => {
  try {
    const state = await getComposeState();

    res.json({
      success: true,
      data: {
        items: state.items,
        updatedAt: state.updatedAt,
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

    const lastModifiedAt = typeof req.body?.lastModifiedAt === 'string' ? req.body.lastModifiedAt : null;
    const savedState = await mergeComposeState(items, lastModifiedAt);

    res.json({
      success: true,
      data: {
        items: savedState.items,
        updatedAt: savedState.updatedAt,
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

router.post('/publish-item', authenticate, async (req, res) => {
  try {
    const outcome = await publishComposeItemInput(req.body?.item);

    return res.json({
      success: true,
      data: outcome,
    });
  } catch (error) {
    console.error('Error publishing compose item:', error);
    return res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to publish compose item' },
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

router.post('/import-remote-image', authenticate, async (req, res) => {
  try {
    const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() as RemoteTmdbImageCategory : 'posters';
    const resultTitle = typeof req.body?.resultTitle === 'string' ? req.body.resultTitle.trim() : 'tmdb-image';

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: { message: 'TMDb image URL is required.' },
      });
    }

    if (!['backdrops', 'posters', 'profiles', 'logos'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Unsupported TMDb image category.' },
      });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return res.status(400).json({
        success: false,
        error: { message: 'TMDb image URL is invalid.' },
      });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({
        success: false,
        error: { message: 'TMDb image URL must use http or https.' },
      });
    }

    const safeName = slugifyAssetName(resultTitle);
    const fetched = await fetchRemoteImageBuffer(imageUrl);
    const normalized = await normalizeImportedTmdbImage(fetched.buffer, fetched.contentType, category);
    const fileName = `${safeName}-${category}.${normalized.extension}`;
    const uploadResult = await uploadBufferToBackblaze(normalized.buffer, fileName, {
      bucketTypes: ['general', 'videos'],
      prefix: 'compose/images',
      contentType: normalized.contentType,
    });
    const previewUrl = await getBackblazeAuthorizedDownloadUrl(uploadResult.url, 7 * 24 * 60 * 60);

    return res.status(201).json({
      success: true,
      data: {
        url: uploadResult.url,
        previewUrl,
        fileName: uploadResult.fileName,
        fileId: uploadResult.fileName,
        contentType: normalized.contentType,
        size: normalized.buffer.length,
      },
    });
  } catch (error) {
    console.error('Error importing remote TMDb image:', error);
    return res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to import TMDb image' },
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

    const authorizedRequest = await getBackblazeAuthorizedDownloadRequest(rawUrl, 7 * 24 * 60 * 60);
    const previewResponse = await fetch(authorizedRequest.url, {
      headers: authorizedRequest.headers,
    });

    if (!previewResponse.ok) {
      return res.status(502).json({
        success: false,
        error: { message: `Failed to fetch asset preview (${previewResponse.status})` },
      });
    }

    const contentType = previewResponse.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await previewResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const previewUrl = `data:${contentType};base64,${buffer.toString('base64')}`;

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

router.post('/asset-access', authenticate, async (req, res) => {
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
    console.error('Error refreshing asset access URL:', error);
    return res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to refresh asset access URL' },
    });
  }
});

router.get('/asset-stream', async (req, res) => {
  try {
    const rawUrl = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl) {
      return res.status(400).json({
        success: false,
        error: { message: 'Asset URL is required' },
      });
    }

    const authorizedRequest = await getBackblazeAuthorizedDownloadRequest(rawUrl, 7 * 24 * 60 * 60);
    const upstreamResponse = await fetch(authorizedRequest.url, {
      headers: {
        ...(authorizedRequest.headers || {}),
        ...(req.headers.range ? { Range: req.headers.range } : {}),
      },
    });

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        success: false,
        error: { message: `Failed to stream asset (${upstreamResponse.status})` },
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
    console.error('Error streaming compose asset:', error);
    return res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to stream asset' },
    });
  }
});

router.post('/generate-threads-x-crop', authenticate, upload.single('mediaFile'), async (req, res) => {
  const uploadedFile = req.file;
  const tempInputPath = uploadedFile
    ? path.join(os.tmpdir(), `compose-crop-input-${Date.now()}-${uploadedFile.originalname}`)
    : null;
  const tempOutputPath = path.join(os.tmpdir(), `compose-crop-output-${Date.now()}.mp4`);

  try {
    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        error: { message: 'A source video is required to generate the Threads/X crop.' },
      });
    }

    const focusYPercent = Number.parseFloat(String(req.body?.focusYPercent ?? '50'));
    const normalizedFocusYPercent = Number.isFinite(focusYPercent) ? focusYPercent : 50;
    await fs.writeFile(tempInputPath!, uploadedFile.buffer);
    await cropVideoToThreeByFour(tempInputPath!, tempOutputPath, normalizedFocusYPercent);

    const croppedBuffer = await fs.readFile(tempOutputPath);
    const originalBaseName = uploadedFile.originalname.replace(/\.[^.]+$/, '');
    const croppedFileName = `${originalBaseName}-threads-x-3x4.mp4`;
    const uploadResult = await uploadBufferToBackblaze(croppedBuffer, croppedFileName, {
      bucketTypes: ['videos', 'general'],
      prefix: 'compose/videos',
      contentType: 'video/mp4',
    });
    const previewUrl = await getBackblazeAuthorizedDownloadUrl(uploadResult.url, 7 * 24 * 60 * 60);

    return res.status(201).json({
      success: true,
      data: {
        url: uploadResult.url,
        previewUrl,
        fileName: uploadResult.fileName,
        fileId: uploadResult.fileName,
        originalName: uploadedFile.originalname,
        contentType: 'video/mp4',
        size: croppedBuffer.byteLength,
      },
    });
  } catch (error) {
    console.error('Error generating Threads/X crop:', error);
    return res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to generate Threads/X crop' },
    });
  } finally {
    await Promise.allSettled([
      tempInputPath ? fs.unlink(tempInputPath) : Promise.resolve(),
      fs.unlink(tempOutputPath),
    ]);
  }
});

export default router;
