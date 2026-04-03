import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';
import { authenticate } from '../middleware/auth';
import { getBackblazeAuthorizedDownloadUrl, uploadBufferToBackblaze } from '../services/backblaze';
import { getComposeState, mergeComposeState } from '../services/compose.service';

const router = Router();
const execFileAsync = promisify(execFile);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 128 * 1024 * 1024,
  },
});

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

    const authorizedUrl = await getBackblazeAuthorizedDownloadUrl(rawUrl, 7 * 24 * 60 * 60);
    const previewResponse = await fetch(authorizedUrl);

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

router.get('/asset-stream', async (req, res) => {
  try {
    const rawUrl = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl) {
      return res.status(400).json({
        success: false,
        error: { message: 'Asset URL is required' },
      });
    }

    const authorizedUrl = await getBackblazeAuthorizedDownloadUrl(rawUrl, 7 * 24 * 60 * 60);
    const upstreamResponse = await fetch(authorizedUrl, {
      headers: req.headers.range ? { Range: req.headers.range } : undefined,
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
