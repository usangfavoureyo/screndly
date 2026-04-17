import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ytDlp from '../lib/yt-dlp';

const execFileAsync = promisify(execFile);

export type ComposeMediaUrlPlatform = 'youtube' | 'instagram';
export type ComposeImportedMediaKind = 'image' | 'video';

export interface NormalizedComposeMediaUrlEntry {
  id: string;
  sourceUrl: string;
  title: string;
  kind: ComposeImportedMediaKind;
  order: number;
}

export interface ImportedComposeMediaItem {
  kind: ComposeImportedMediaKind;
  fileName: string;
  contentType: string;
  size: number;
  buffer: Buffer;
  width?: number;
  height?: number;
  durationSeconds?: number;
  aspectRatioValue?: number;
  aspectRatioLabel?: string;
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif']);

function slugifyAssetName(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'media';
}

function inferKindFromEntry(entry: Record<string, unknown>): ComposeImportedMediaKind {
  const ext = String(entry.ext || '').trim().toLowerCase();
  const mimeType = String(entry.mime_type || entry.mimeType || '').trim().toLowerCase();

  if (mimeType.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) {
    return 'image';
  }

  return 'video';
}

function inferContentTypeFromPath(filePath: string, kind: ComposeImportedMediaKind): string {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  if (kind === 'video') {
    if (extension === 'webm') return 'video/webm';
    if (extension === 'mov') return 'video/quicktime';
    return 'video/mp4';
  }

  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'avif') return 'image/avif';
  return 'image/jpeg';
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function buildAspectRatio(width?: number, height?: number): { aspectRatioValue?: number; aspectRatioLabel?: string } {
  if (!width || !height) {
    return {};
  }

  const divisor = gcd(width, height);
  return {
    aspectRatioValue: width / height,
    aspectRatioLabel: `${Math.round(width / divisor)}:${Math.round(height / divisor)}`,
  };
}

async function probeVideoMetadata(filePath: string): Promise<{
  width?: number;
  height?: number;
  durationSeconds?: number;
}> {
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
  const width = Number(stream?.width || 0) || undefined;
  const height = Number(stream?.height || 0) || undefined;
  const durationSeconds = Number.parseFloat(parsed.format?.duration || '0') || undefined;

  return { width, height, durationSeconds };
}

async function probeImageMetadata(filePath: string): Promise<{ width?: number; height?: number }> {
  const metadata = await sharp(filePath, { animated: false }).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
  };
}

async function readSingleDownloadedFile(directoryPath: string): Promise<string> {
  const fileNames = await fs.readdir(directoryPath);
  const candidateNames = fileNames.filter((name) => {
    const normalized = name.toLowerCase();
    return !normalized.endsWith('.part')
      && !normalized.endsWith('.ytdl')
      && !normalized.endsWith('.json')
      && !normalized.endsWith('.description');
  });

  if (!candidateNames.length) {
    throw new Error('Media import did not produce a downloadable file.');
  }

  const stats = await Promise.all(candidateNames.map(async (name) => ({
    name,
    stat: await fs.stat(path.join(directoryPath, name)),
  })));
  stats.sort((left, right) => right.stat.size - left.stat.size);
  return path.join(directoryPath, stats[0].name);
}

export function detectComposeMediaUrlPlatform(url: string): ComposeMediaUrlPlatform | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'youtu.be' || hostname.endsWith('youtube.com')) {
    return 'youtube';
  }

  if (hostname.endsWith('instagram.com')) {
    return 'instagram';
  }

  return null;
}

export function normalizeComposeMediaUrlEntries(
  originalUrl: string,
  metadata: Record<string, any>,
): NormalizedComposeMediaUrlEntry[] {
  const rawEntries = Array.isArray(metadata?.entries) && metadata.entries.length
    ? metadata.entries
    : [metadata];

  return rawEntries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, index) => ({
      id: String(entry.id || `${index + 1}`),
      sourceUrl: String(entry.webpage_url || entry.original_url || entry.url || originalUrl),
      title: String(entry.title || metadata?.title || `media-${index + 1}`),
      kind: inferKindFromEntry(entry),
      order: index,
    }))
    .filter((entry) => Boolean(entry.sourceUrl));
}

export function buildComposeMediaDownloadOptions(
  platform: ComposeMediaUrlPlatform,
  kind: ComposeImportedMediaKind,
  outputTemplate: string,
): Record<string, unknown> {
  const baseOptions: Record<string, unknown> = {
    output: outputTemplate,
    noProgress: true,
    noWarnings: true,
    quiet: true,
    yesPlaylist: false,
  };

  if (kind === 'video') {
    if (platform === 'youtube') {
      return {
        ...baseOptions,
        format: 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]',
        mergeOutputFormat: 'mp4',
      };
    }

    return {
      ...baseOptions,
      format: 'best',
      mergeOutputFormat: 'mp4',
    };
  }

  return {
    ...baseOptions,
    format: 'best',
  };
}

export async function importComposeMediaFromUrl(url: string): Promise<ImportedComposeMediaItem[]> {
  const platform = detectComposeMediaUrlPlatform(url);
  if (!platform) {
    throw new Error('Only public YouTube and Instagram URLs are supported.');
  }

  const metadata = await ytDlp(url, {
    dumpSingleJson: true,
    skipDownload: true,
    noWarnings: true,
    quiet: true,
  } as any);

  const entries = normalizeComposeMediaUrlEntries(url, metadata as Record<string, any>);
  if (!entries.length) {
    throw new Error('No importable media was found at that URL.');
  }

  const importedItems: ImportedComposeMediaItem[] = [];

  for (const entry of entries) {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'screndly-compose-url-'));
    try {
      const outputTemplate = path.join(tempDirectory, 'asset.%(ext)s');
      await ytDlp(entry.sourceUrl, buildComposeMediaDownloadOptions(platform, entry.kind, outputTemplate) as any);

      const downloadedFilePath = await readSingleDownloadedFile(tempDirectory);
      const fileBuffer = await fs.readFile(downloadedFilePath);
      const fileStats = await fs.stat(downloadedFilePath);
      const extension = path.extname(downloadedFilePath).slice(1).toLowerCase() || (entry.kind === 'video' ? 'mp4' : 'jpg');
      const safeTitle = slugifyAssetName(entry.title);
      const fileName = `${safeTitle}-${entry.order + 1}.${extension}`;

      const mediaMetadata = entry.kind === 'video'
        ? await probeVideoMetadata(downloadedFilePath)
        : await probeImageMetadata(downloadedFilePath);
      const durationSeconds = entry.kind === 'video'
        ? (mediaMetadata as { durationSeconds?: number }).durationSeconds
        : undefined;
      const aspectRatio = buildAspectRatio(mediaMetadata.width, mediaMetadata.height);

      importedItems.push({
        kind: entry.kind,
        fileName,
        contentType: inferContentTypeFromPath(downloadedFilePath, entry.kind),
        size: fileStats.size,
        buffer: fileBuffer,
        width: mediaMetadata.width,
        height: mediaMetadata.height,
        durationSeconds,
        aspectRatioValue: aspectRatio.aspectRatioValue,
        aspectRatioLabel: aspectRatio.aspectRatioLabel,
      });
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  return importedItems;
}
