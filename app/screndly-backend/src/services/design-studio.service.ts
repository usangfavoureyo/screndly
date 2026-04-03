import { randomUUID } from 'crypto';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import prisma from '../lib/prisma';
import { readPsdSafely } from '../lib/psd';
import { generateStudioCaption } from './ai.service';
import { uploadBufferToBackblaze, getBackblazeAuthorizedDownloadUrl } from './backblaze';
import { publisherService } from './publisher.service';
import { getRSSActivity } from './rss.service';
import sharp from 'sharp';

const DESIGN_STUDIO_TEMPLATES_KEY = 'designStudioTemplates';
const DESIGN_STUDIO_RENDERED_KEY = 'designStudioRenderedDesigns';
const DESIGN_STUDIO_AUTO_EDITORIALS_KEY = 'designStudioAutoEditorials';
const DESIGN_STUDIO_RENDER_JOBS_KEY = 'designStudioRenderJobs';
const DESIGN_STUDIO_QUEUE_NAME = 'design-studio-renders';

const DEFAULT_TRIGGER_KEYWORDS = [
  'renewed',
  'renewal',
  'canceled',
  'cancelled',
  'confirmed',
  'release date',
  'releasing',
  'premiere',
  'premieres',
  'in development',
];

const DEFAULT_TARGET_PLATFORMS = ['x', 'threads'];

export type DesignStudioLayoutVariant =
  | 'top_left'
  | 'top_center'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_center'
  | 'bottom_right';

export type DesignStudioAutoEditorialStatus =
  | 'detected'
  | 'rendering'
  | 'queued'
  | 'posted'
  | 'failed';

export type DesignStudioContentType =
  | 'poster'
  | 'carousel'
  | 'story'
  | 'announcement'
  | 'general';

export type DesignStudioExportFormat = 'jpeg' | 'png';

export type DesignStudioManualRenderJobStatus =
  | 'queued'
  | 'rendering'
  | 'completed'
  | 'failed';

export interface DesignStudioLayerReference {
  id: string;
  originalName: string;
  normalizedName: string;
  path: string[];
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  hasText: boolean;
  group: boolean;
}

export interface DesignStudioVariantRecord {
  variant: DesignStudioLayoutVariant;
  textBox: { x: number; y: number; width: number; height: number };
  alignment: 'left' | 'center' | 'right';
  brandBox: { x: number; y: number; width: number; height: number };
  backgroundAnchor: 'top' | 'bottom' | 'left' | 'right' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
  overlayDirection: 'top' | 'bottom' | 'left' | 'right' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
  minFontSize: number;
  maxFontSize: number;
  maxLines: number;
}

export interface DesignStudioTemplateRecord {
  id: string;
  name: string;
  sourceType?: 'device' | 'backblaze';
  sourceFilePath?: string;
  previewImage?: string;
  previewUrl?: string;
  width: number;
  height: number;
  aspectRatio: string;
  baseVariant?: DesignStudioLayoutVariant;
  layoutVariant?: DesignStudioLayoutVariant;
  mappedLayers?: Record<string, string>;
  mappedLayerNames?: string[];
  layerReferences?: Array<Record<string, any>>;
  fontFamily?: string;
  fontStyle?: string;
  fontWeight?: number;
  baseFontSize?: number;
  fontColor?: string;
  lineHeightMultiplier?: number;
  tracking?: number;
  isPointText?: boolean;
  isValidated?: boolean;
  validationState?: 'valid' | 'warning' | 'invalid';
  validationErrors?: string[];
  safeMargin?: number;
  variants?: Array<Record<string, any>>;
  source: 'upload' | 'backblaze';
  psdData?: Record<string, any> | null;
  hasHeader?: boolean;
  hasBackground?: boolean;
  hasSubtext: boolean;
  hasOverlay?: boolean;
  hasCategory?: boolean;
  hasSource?: boolean;
  isDefaultManual?: boolean;
  isDefaultAuto?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastEdited?: string;
}

export interface DesignStudioCaptionPayload {
  shared_caption: string;
  pinterest_title: string;
  pinterest_description: string;
}

export interface DesignStudioRenderedDesignRecord {
  id: string;
  templateId: string;
  templateName: string;
  templateVariant?: DesignStudioLayoutVariant;
  exportFormat?: DesignStudioExportFormat;
  outputUrl: string;
  previewUrl?: string;
  data: Record<string, any>;
  createdAt: string;
  aspectRatio: string;
  caption?: string;
  captions?: Record<string, any>;
  contentType?: DesignStudioContentType;
}

export interface DesignStudioManualRenderJob {
  id: string;
  templateId: string;
  templateName: string;
  status: DesignStudioManualRenderJobStatus;
  createdAt: string;
  updatedAt: string;
  renderedDesignId?: string | null;
  outputUrl?: string | null;
  failureReason?: string | null;
}

export interface DesignStudioAutoEditorialRecord {
  id: string;
  sourceFeedItemId: string;
  sourceFeedId?: string;
  sourceFeedName?: string;
  sourceTitle: string;
  sourceUrl?: string;
  matchedKeyword?: string;
  templateId: string;
  templateName?: string;
  templateVariant?: DesignStudioLayoutVariant;
  renderedImage: string;
  headerText: string;
  subheaderText?: string;
  caption: string;
  captions?: Record<string, any>;
  backgroundSource?: string;
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  zoomLevel?: number;
  overlayDirection?: string;
  overlayStrength?: number;
  scheduleTime?: string | null;
  targetPlatforms: string[];
  status: DesignStudioAutoEditorialStatus;
  createdAt: string;
  updatedAt: string;
  postedAt?: string | null;
  failureReason?: string | null;
}

interface DesignStudioAutoSettings {
  enabled: boolean;
  autoPost: boolean;
  defaultTemplateId: string | null;
  templatePool: string[];
  templateRotationStrategy: 'sequential' | 'random' | 'weighted';
  postingInterval: number;
  triggerKeywords: string[];
  selectedRssFeedIds: string[];
  maxEditorialsPerRun: number;
  captionLengthMode: 'short' | 'medium';
  minimumScoreThreshold: number;
  targetPlatforms: string[];
  model: string;
  promptGeneral: string;
  promptAnnouncement: string;
  captionTemperature: number;
  captionMaxTokens: number;
  captionTone: string;
}

interface DesignStudioRunResult {
  generated: number;
  published: number;
  failed: number;
}

interface DesignStudioRenderPayload {
  template_id?: string;
  template_variant?: DesignStudioLayoutVariant;
  headerText: string;
  subtext?: string;
  headerTextColor?: string;
  subtextColor?: string;
  backgroundImage?: string;
  imageFocalPoint?: { x: number; y: number };
  imageZoom?: number;
  overlayColor?: string;
  overlayOpacity?: number;
  gradientPosition?: 'top' | 'bottom' | 'left' | 'right';
  caption?: string;
  contentType?: DesignStudioContentType;
  cropMode?: 'cover' | 'contain' | 'center' | 'face_focus';
  headerAlignment?: 'left' | 'center' | 'right';
  fontScale?: number;
  maxLines?: number;
  overlayType?: 'linear' | 'radial' | 'full_fade' | 'top_fade' | 'bottom_fade';
  useTemplateDefaultStyling?: boolean;
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  zoomLevel?: number;
  sharedCaption?: string;
  pinterestTitle?: string;
  pinterestDescription?: string;
  exportFormat?: DesignStudioExportFormat;
}

interface QueueManualRenderInput {
  template: DesignStudioTemplateRecord;
  data: DesignStudioRenderPayload;
}

interface TextFitResult {
  fontSize: number;
  lines: string[];
  lineHeight: number;
}

interface ResolvedRenderOutput {
  buffer: Buffer;
  format: DesignStudioExportFormat;
  extension: 'jpg' | 'png';
  contentType: 'image/jpeg' | 'image/png';
}

let queue: Queue<QueueManualRenderInput> | null = null;
let worker: Worker<QueueManualRenderInput> | null = null;
let redisConnection: Redis | null = null;
let workerBootstrapped = false;

function normalizeKeyword(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function aspectRatioFromDimensions(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function readNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeLayerName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function colorToHex(value: unknown, fallback = '#ffffff'): string {
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())) {
    return value.trim().toLowerCase();
  }
  if (value && typeof value === 'object') {
    const source = value as { r?: number; g?: number; b?: number };
    if ([source.r, source.g, source.b].every((entry) => typeof entry === 'number')) {
      return `#${[source.r, source.g, source.b]
        .map((channel) => clamp(Math.round(channel as number), 0, 255).toString(16).padStart(2, '0'))
        .join('')}`;
    }
  }
  return fallback;
}

function hexToRgba(value: string, alpha: number): string {
  const normalized = value.replace('#', '');
  const safe = normalized.length === 6 ? normalized : '000000';
  const red = Number.parseInt(safe.slice(0, 2), 16);
  const green = Number.parseInt(safe.slice(2, 4), 16);
  const blue = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1)})`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPreviewPlaceholder(name: string, width: number, height: number): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#131313" />
          <stop offset="100%" stop-color="#050505" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="28" fill="none" stroke="#ec1e24" stroke-opacity="0.45" stroke-width="4"/>
      <text x="${width / 2}" y="${height / 2 - 28}" text-anchor="middle" fill="#ffffff" font-size="48" font-family="Arial">PSD Template</text>
      <text x="${width / 2}" y="${height / 2 + 40}" text-anchor="middle" fill="#9ca3af" font-size="24" font-family="Arial">${escapeXml(name)}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function generateTemplatePreviewUrl(input: {
  buffer: Buffer;
  fileName: string;
  fallbackName: string;
  width: number;
  height: number;
}): Promise<string> {
  try {
    const previewPsd = readPsdSafely(input.buffer, {
      skipLayerImageData: true,
      skipThumbnail: false,
    });

    const compositeCanvas = (previewPsd as any)?.canvas;
    if (compositeCanvas && typeof compositeCanvas.toBuffer === 'function') {
      const previewBuffer = await sharp(compositeCanvas.toBuffer('image/png'))
        .resize({
          width: 1200,
          height: 1200,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();

      const uploadedPreview = await uploadBufferToBackblaze(
        previewBuffer,
        `${input.fileName.replace(/\.psd$/i, '')}-preview.png`,
        {
          bucketTypes: ['design', 'general'],
          prefix: 'design-studio/template-previews',
          contentType: 'image/png',
        },
      );

      return uploadedPreview.url;
    }
  } catch (error) {
    console.error('Failed to generate PSD composite preview:', error);
  }

  return buildPreviewPlaceholder(input.fallbackName, input.width, input.height);
}

function flattenLayerReferences(
  children: Array<any> | undefined,
  path: string[] = [],
  layers: DesignStudioLayerReference[] = [],
): DesignStudioLayerReference[] {
  for (const child of children || []) {
    const originalName = typeof child?.name === 'string' && child.name.trim().length > 0 ? child.name.trim() : 'Untitled';
    const nextPath = [...path, originalName];
    layers.push({
      id: nextPath.join(' > '),
      originalName,
      normalizedName: normalizeLayerName(originalName),
      path: nextPath,
      left: Number(child?.left || 0),
      top: Number(child?.top || 0),
      right: Number(child?.right || 0),
      bottom: Number(child?.bottom || 0),
      width: Math.max(0, Number(child?.right || 0) - Number(child?.left || 0)),
      height: Math.max(0, Number(child?.bottom || 0) - Number(child?.top || 0)),
      hasText: Boolean(child?.text),
      group: Array.isArray(child?.children) && child.children.length > 0,
    });
    if (Array.isArray(child?.children)) {
      flattenLayerReferences(child.children, nextPath, layers);
    }
  }
  return layers;
}

function findLayerByPatterns(
  layers: DesignStudioLayerReference[],
  patterns: string[],
  options: { hasText?: boolean; group?: boolean } = {},
): DesignStudioLayerReference | undefined {
  return layers.find((layer) => {
    if (options.hasText !== undefined && layer.hasText !== options.hasText) {
      return false;
    }
    if (options.group !== undefined && layer.group !== options.group) {
      return false;
    }
    return patterns.some((pattern) => layer.normalizedName.includes(pattern));
  });
}

function deriveVariants(width: number, height: number, baseFontSize: number): DesignStudioVariantRecord[] {
  const safeMargin = Math.round(Math.min(width, height) * 0.1111);
  const centeredWidth = width - safeMargin * 2;
  const sideWidth = Math.round(width * 0.52);
  const topTextY = safeMargin;
  const bottomTextHeight = 300;
  const topTextHeight = 280;
  const bottomTextY = height - safeMargin - bottomTextHeight;
  const brandWidth = 300;
  const brandHeight = 90;
  const bottomBrandY = height - safeMargin - brandHeight;

  return [
    {
      variant: 'bottom_center',
      textBox: { x: safeMargin, y: bottomTextY, width: centeredWidth, height: bottomTextHeight },
      alignment: 'center',
      brandBox: { x: Math.round((width - brandWidth) / 2), y: bottomBrandY, width: brandWidth, height: brandHeight },
      backgroundAnchor: 'top',
      overlayDirection: 'bottom',
      minFontSize: Math.round(baseFontSize * 0.64),
      maxFontSize: Math.round(baseFontSize),
      maxLines: 4,
    },
    {
      variant: 'top_center',
      textBox: { x: safeMargin, y: topTextY, width: centeredWidth, height: topTextHeight },
      alignment: 'center',
      brandBox: { x: Math.round((width - brandWidth) / 2), y: bottomBrandY, width: brandWidth, height: brandHeight },
      backgroundAnchor: 'bottom',
      overlayDirection: 'top',
      minFontSize: Math.round(baseFontSize * 0.64),
      maxFontSize: Math.round(baseFontSize),
      maxLines: 4,
    },
    {
      variant: 'top_left',
      textBox: { x: safeMargin, y: topTextY, width: sideWidth, height: topTextHeight },
      alignment: 'left',
      brandBox: { x: safeMargin, y: bottomBrandY, width: brandWidth, height: brandHeight },
      backgroundAnchor: 'bottom_right',
      overlayDirection: 'top_left',
      minFontSize: Math.round(baseFontSize * 0.64),
      maxFontSize: Math.round(baseFontSize),
      maxLines: 4,
    },
    {
      variant: 'top_right',
      textBox: { x: width - safeMargin - sideWidth, y: topTextY, width: sideWidth, height: topTextHeight },
      alignment: 'right',
      brandBox: { x: width - safeMargin - brandWidth, y: bottomBrandY, width: brandWidth, height: brandHeight },
      backgroundAnchor: 'bottom_left',
      overlayDirection: 'top_right',
      minFontSize: Math.round(baseFontSize * 0.64),
      maxFontSize: Math.round(baseFontSize),
      maxLines: 4,
    },
    {
      variant: 'bottom_left',
      textBox: { x: safeMargin, y: bottomTextY, width: sideWidth, height: bottomTextHeight },
      alignment: 'left',
      brandBox: { x: safeMargin, y: bottomBrandY, width: brandWidth, height: brandHeight },
      backgroundAnchor: 'top_right',
      overlayDirection: 'bottom_left',
      minFontSize: Math.round(baseFontSize * 0.64),
      maxFontSize: Math.round(baseFontSize),
      maxLines: 4,
    },
    {
      variant: 'bottom_right',
      textBox: { x: width - safeMargin - sideWidth, y: bottomTextY, width: sideWidth, height: bottomTextHeight },
      alignment: 'right',
      brandBox: { x: width - safeMargin - brandWidth, y: bottomBrandY, width: brandWidth, height: brandHeight },
      backgroundAnchor: 'top_left',
      overlayDirection: 'bottom_right',
      minFontSize: Math.round(baseFontSize * 0.64),
      maxFontSize: Math.round(baseFontSize),
      maxLines: 4,
    },
  ];
}

function buildTemplateFromPsdBuffer(input: {
  buffer: Buffer;
  fileName: string;
  sourceType: 'device' | 'backblaze';
  sourceFilePath: string;
  uploadedUrl: string;
}): DesignStudioTemplateRecord {
  const psd = readPsdSafely(input.buffer, {
    skipCompositeImageData: true,
    skipLayerImageData: true,
    skipThumbnail: true,
  });

  const layerReferences = flattenLayerReferences(psd.children);
  const backgroundLayer = findLayerByPatterns(layerReferences, ['background', 'bg', 'image', 'photo']);
  const overlayLayer = findLayerByPatterns(layerReferences, ['overlay']);
  const headerLayer = findLayerByPatterns(layerReferences, ['header', 'headline', 'title'], { hasText: true });
  const brandGroup = findLayerByPatterns(layerReferences, ['logo', 'brand'], { group: true });
  const fadeLayer = findLayerByPatterns(layerReferences, ['fade', 'gradient']);

  const headerSource = (function resolveHeader(children: Array<any> | undefined): any | undefined {
    for (const child of children || []) {
      if (child?.name === headerLayer?.originalName && child?.text) {
        return child;
      }
      if (Array.isArray(child?.children)) {
        const nested = resolveHeader(child.children);
        if (nested) {
          return nested;
        }
      }
    }
    return undefined;
  })(psd.children);

  const headerStyle = headerSource?.text?.style || {};
  const paragraphStyle = headerSource?.text?.paragraphStyle || {};
  const fontFamily = headerStyle?.font?.name || 'Arial';
  const fontStyle = headerStyle?.fauxItalic ? 'italic' : 'normal';
  const fontWeight = headerStyle?.fauxBold ? 700 : 700;
  const baseFontSize = readNumber(headerStyle?.fontSize, 96);
  const lineHeightMultiplier = Math.max(1.02, Math.min(1.2, readNumber(headerStyle?.leading, baseFontSize * 1.05) / Math.max(baseFontSize, 1)));
  const tracking = readNumber(headerStyle?.tracking, 0);
  const mappedLayers = {
    background_image: backgroundLayer?.originalName || '',
    header_text: headerLayer?.originalName || '',
    overlay_color: overlayLayer?.originalName || '',
    overlay_strength: overlayLayer?.originalName || '',
    brand_group: brandGroup?.originalName || '',
    gradient_fade: fadeLayer?.originalName || '',
  };

  const validationErrors: string[] = [];
  if (!backgroundLayer) validationErrors.push('Missing background layer');
  if (!headerLayer) validationErrors.push('Missing header layer');
  if (!overlayLayer) validationErrors.push('Missing overlay layer');

  const baseVariant: DesignStudioLayoutVariant = 'bottom_center';
  const variants = deriveVariants(psd.width, psd.height, baseFontSize);
  const now = new Date().toISOString();

  return {
    id: `design-template-${randomUUID()}`,
    name: input.fileName.replace(/\.psd$/i, ''),
    sourceType: input.sourceType,
    sourceFilePath: input.sourceFilePath,
    previewImage: buildPreviewPlaceholder(input.fileName.replace(/\.psd$/i, ''), psd.width, psd.height),
    previewUrl: buildPreviewPlaceholder(input.fileName.replace(/\.psd$/i, ''), psd.width, psd.height),
    width: psd.width,
    height: psd.height,
    aspectRatio: aspectRatioFromDimensions(psd.width, psd.height),
    baseVariant,
    layoutVariant: baseVariant,
    mappedLayers,
    mappedLayerNames: Object.values(mappedLayers).filter(Boolean),
    layerReferences,
    fontFamily,
    fontStyle,
    fontWeight,
    baseFontSize,
    fontColor: colorToHex(headerStyle?.fillColor, '#ffffff'),
    lineHeightMultiplier,
    tracking,
    isPointText: !('bounds' in (headerSource?.text || {})),
    isValidated: validationErrors.length === 0,
    validationState: validationErrors.length === 0 ? 'valid' : backgroundLayer && headerLayer ? 'warning' : 'invalid',
    validationErrors,
    safeMargin: Math.round(Math.min(psd.width, psd.height) * 0.1111),
    variants,
    source: input.sourceType === 'backblaze' ? 'backblaze' : 'upload',
    psdData: {
      sourceType: input.sourceType,
      fileUrl: input.uploadedUrl,
      fileName: input.fileName,
      fileSignature: input.buffer.subarray(0, 4).toString('ascii'),
      headerStyle: {
        fontFamily,
        fontStyle,
        fontWeight,
        baseFontSize,
        fontColor: colorToHex(headerStyle?.fillColor, '#ffffff'),
        paragraphAlignment: paragraphStyle?.justification || 'center',
        lineHeightMultiplier,
        tracking,
      },
      layerMap: mappedLayers,
    },
    hasHeader: Boolean(headerLayer),
    hasBackground: Boolean(backgroundLayer),
    hasSubtext: false,
    hasOverlay: Boolean(overlayLayer),
    createdAt: now,
    updatedAt: now,
    lastEdited: now,
  };
}

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

async function createDesignStudioActivity(type: string, details: Record<string, any>): Promise<void> {
  await prisma.designStudioActivity.create({
    data: {
      type,
      details,
    },
  });
}

async function getTemplates(): Promise<DesignStudioTemplateRecord[]> {
  const templates = await readJsonSetting<DesignStudioTemplateRecord[]>(DESIGN_STUDIO_TEMPLATES_KEY, []);
  return Array.isArray(templates) ? templates : [];
}

async function saveTemplates(templates: DesignStudioTemplateRecord[]): Promise<void> {
  await writeJsonSetting(DESIGN_STUDIO_TEMPLATES_KEY, templates);
}

async function getRenderedDesigns(): Promise<DesignStudioRenderedDesignRecord[]> {
  const rendered = await readJsonSetting<DesignStudioRenderedDesignRecord[]>(DESIGN_STUDIO_RENDERED_KEY, []);
  return Array.isArray(rendered) ? rendered : [];
}

async function saveRenderedDesigns(renderedDesigns: DesignStudioRenderedDesignRecord[]): Promise<void> {
  await writeJsonSetting(DESIGN_STUDIO_RENDERED_KEY, renderedDesigns);
}

async function getAutoEditorials(): Promise<DesignStudioAutoEditorialRecord[]> {
  const editorials = await readJsonSetting<DesignStudioAutoEditorialRecord[]>(DESIGN_STUDIO_AUTO_EDITORIALS_KEY, []);
  return Array.isArray(editorials) ? editorials : [];
}

async function saveAutoEditorials(editorials: DesignStudioAutoEditorialRecord[]): Promise<void> {
  await writeJsonSetting(DESIGN_STUDIO_AUTO_EDITORIALS_KEY, editorials);
}

export async function getDesignStudioRenderJobs(): Promise<DesignStudioManualRenderJob[]> {
  const jobs = await readJsonSetting<DesignStudioManualRenderJob[]>(DESIGN_STUDIO_RENDER_JOBS_KEY, []);
  return Array.isArray(jobs) ? jobs : [];
}

async function saveDesignStudioRenderJobs(jobs: DesignStudioManualRenderJob[]): Promise<void> {
  await writeJsonSetting(DESIGN_STUDIO_RENDER_JOBS_KEY, jobs);
}

async function updateManualRenderJob(
  jobId: string,
  patch: Partial<DesignStudioManualRenderJob>,
): Promise<DesignStudioManualRenderJob | null> {
  const jobs = await getDesignStudioRenderJobs();
  let updated: DesignStudioManualRenderJob | null = null;
  const next = jobs.map((job) => {
    if (job.id !== jobId) {
      return job;
    }
    updated = {
      ...job,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });
  await saveDesignStudioRenderJobs(next);
  return updated;
}

async function claimManualRenderJob(jobId: string): Promise<DesignStudioManualRenderJob | null> {
  const jobs = await getDesignStudioRenderJobs();
  let claimed: DesignStudioManualRenderJob | null = null;
  const next = jobs.map((job) => {
    if (job.id !== jobId || job.status !== 'queued') {
      return job;
    }

    claimed = {
      ...job,
      status: 'rendering',
      failureReason: null,
      updatedAt: new Date().toISOString(),
    };
    return claimed;
  });

  if (!claimed) {
    return null;
  }

  await saveDesignStudioRenderJobs(next);
  return claimed;
}

function getRedisUrl(): string | null {
  const value = process.env.REDIS_URL?.trim() || process.env.UPSTASH_REDIS_URL?.trim();
  return value || null;
}

function getRedisConnection(): Redis | null {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    return null;
  }
  if (!redisConnection) {
    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return redisConnection;
}

function ensureRenderQueue(): Queue<QueueManualRenderInput> | null {
  if (queue) {
    return queue;
  }
  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }
  queue = new Queue<QueueManualRenderInput>(DESIGN_STUDIO_QUEUE_NAME, { connection });
  return queue;
}

function ensureRenderWorker(): void {
  if (workerBootstrapped) {
    return;
  }
  workerBootstrapped = true;
  const connection = getRedisConnection();
  if (!connection) {
    return;
  }

  worker = new Worker<QueueManualRenderInput>(
    DESIGN_STUDIO_QUEUE_NAME,
    async (job) => processManualRenderJob(String(job.id), job.data),
    { connection },
  );
}

function findVariant(
  template: DesignStudioTemplateRecord,
  variant?: DesignStudioLayoutVariant,
): DesignStudioVariantRecord {
  const variants = (template.variants as DesignStudioVariantRecord[] | undefined)
    || deriveVariants(template.width, template.height, template.baseFontSize || 96);
  return variants.find((entry) => entry.variant === (variant || template.layoutVariant || template.baseVariant))
    || variants.find((entry) => entry.variant === template.baseVariant)
    || variants[0];
}

async function fetchBytesFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch remote asset (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function resolveRemoteTemplateUrl(url: string): Promise<string> {
  return getBackblazeAuthorizedDownloadUrl(url, 7 * 24 * 60 * 60);
}

async function fetchSourceBuffer(value?: string): Promise<Buffer | null> {
  if (!value) {
    return null;
  }
  if (value.startsWith('data:')) {
    const [, content] = value.split(',');
    return Buffer.from(content, 'base64');
  }
  const remoteUrl = value.startsWith('http') ? value : await resolveRemoteTemplateUrl(value);
  return fetchBytesFromUrl(remoteUrl);
}

function estimateWordWidth(word: string, fontSize: number, tracking: number): number {
  const base = [...word].reduce((sum, char) => {
    if ('MW@#%&'.includes(char)) return sum + 0.95;
    if ('ilI1'.includes(char)) return sum + 0.35;
    if (' .,:;!|'.includes(char)) return sum + 0.22;
    return sum + 0.62;
  }, 0);
  return base * fontSize + Math.max(0, word.length - 1) * tracking * 0.08;
}

function fitTextBlock(input: {
  text: string;
  boxWidth: number;
  boxHeight: number;
  minFontSize: number;
  maxFontSize: number;
  maxLines: number;
  lineHeightMultiplier: number;
  tracking: number;
}): TextFitResult {
  const normalized = input.text.replace(/\s+/g, ' ').trim();
  const words = normalized.split(' ').filter(Boolean);

  const buildLines = (fontSize: number): string[] => {
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const trial = current ? `${current} ${word}` : word;
      const trialWidth = estimateWordWidth(trial, fontSize, input.tracking);
      if (trialWidth <= input.boxWidth || !current) {
        current = trial;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) {
      lines.push(current);
    }
    return lines;
  };

  for (let fontSize = input.maxFontSize; fontSize >= input.minFontSize; fontSize -= 2) {
    const lines = buildLines(fontSize);
    const lineHeight = fontSize * input.lineHeightMultiplier;
    if (lines.length <= input.maxLines && lines.length * lineHeight <= input.boxHeight) {
      return { fontSize, lines, lineHeight };
    }
  }

  const fontSize = input.minFontSize;
  const lineHeight = fontSize * input.lineHeightMultiplier;
  const lines = buildLines(fontSize).slice(0, input.maxLines);
  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    lines[lines.length - 1] = lastLine.length > 3 ? `${lastLine.slice(0, Math.max(0, lastLine.length - 3)).trim()}...` : lastLine;
  }
  return { fontSize, lines, lineHeight };
}

function buildTextSvg(input: {
  width: number;
  height: number;
  variant: DesignStudioVariantRecord;
  template: DesignStudioTemplateRecord;
  payload: DesignStudioRenderPayload;
}): Buffer {
  const alignment = input.payload.headerAlignment || input.variant.alignment;
  const fontScale = input.payload.fontScale ?? 1;
  const maxLines = input.payload.maxLines || input.variant.maxLines;
  const fontColor = input.payload.useTemplateDefaultStyling
    ? (input.template.fontColor || '#ffffff')
    : (input.payload.headerTextColor || input.template.fontColor || '#ffffff');
  const fit = fitTextBlock({
    text: input.payload.headerText,
    boxWidth: input.variant.textBox.width,
    boxHeight: input.variant.textBox.height,
    minFontSize: Math.round(input.variant.minFontSize * fontScale),
    maxFontSize: Math.round(input.variant.maxFontSize * fontScale),
    maxLines,
    lineHeightMultiplier: input.template.lineHeightMultiplier || 1.05,
    tracking: input.template.tracking || 0,
  });

  const anchor = alignment === 'center' ? 'middle' : alignment === 'right' ? 'end' : 'start';
  const x = alignment === 'center'
    ? input.variant.textBox.x + input.variant.textBox.width / 2
    : alignment === 'right'
      ? input.variant.textBox.x + input.variant.textBox.width
      : input.variant.textBox.x;
  const firstLineY = input.variant.textBox.y + fit.fontSize;
  const trackingEm = ((input.template.tracking || 0) / 1000).toFixed(3);
  const linesSvg = fit.lines.map((line, index) => `
      <text
        x="${x}"
        y="${firstLineY + index * fit.lineHeight}"
        text-anchor="${anchor}"
        fill="${fontColor}"
        font-family="${escapeXml(input.template.fontFamily || 'Arial')}"
        font-size="${fit.fontSize}"
        font-style="${input.template.fontStyle || 'normal'}"
        font-weight="${input.template.fontWeight || 700}"
        letter-spacing="${trackingEm}em"
      >${escapeXml(line)}</text>
    `).join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}">
      ${linesSvg}
    </svg>
  `.trim();
  return Buffer.from(svg);
}

function buildBrandSvg(width: number, height: number, variant: DesignStudioVariantRecord): Buffer {
  const { x, y, width: boxWidth, height: boxHeight } = variant.brandBox;
  const redWidth = Math.round(boxWidth * 0.22);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <g>
        <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="12" fill="#0a0a0a" />
        <rect x="${x}" y="${y}" width="${redWidth}" height="${boxHeight}" rx="12" fill="#ec1e24" />
        <text x="${x + redWidth + 22}" y="${y + boxHeight / 2 + 10}" fill="#ffffff" font-family="Arial" font-size="34" font-weight="700" letter-spacing="0.3em">NEWS</text>
      </g>
    </svg>
  `.trim();
  return Buffer.from(svg);
}

function buildOverlaySvg(input: {
  width: number;
  height: number;
  color: string;
  strength: number;
  direction: string;
  overlayType: string;
}): Buffer {
  const alpha = clamp(input.strength, 0, 1);
  const opaque = hexToRgba(input.color, alpha);
  const transparent = hexToRgba(input.color, 0);
  const directionMap: Record<string, { x1: string; y1: string; x2: string; y2: string }> = {
    top: { x1: '0%', y1: '0%', x2: '0%', y2: '100%' },
    bottom: { x1: '0%', y1: '100%', x2: '0%', y2: '0%' },
    left: { x1: '0%', y1: '0%', x2: '100%', y2: '0%' },
    right: { x1: '100%', y1: '0%', x2: '0%', y2: '0%' },
    top_left: { x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
    top_right: { x1: '100%', y1: '0%', x2: '0%', y2: '100%' },
    bottom_left: { x1: '0%', y1: '100%', x2: '100%', y2: '0%' },
    bottom_right: { x1: '100%', y1: '100%', x2: '0%', y2: '0%' },
  };
  const gradient = directionMap[input.direction] || directionMap.bottom;

  let body = `<rect width="${input.width}" height="${input.height}" fill="url(#overlay)" />`;
  let defs = `
    <linearGradient id="overlay" x1="${gradient.x1}" y1="${gradient.y1}" x2="${gradient.x2}" y2="${gradient.y2}">
      <stop offset="0%" stop-color="${opaque}" />
      <stop offset="62%" stop-color="${transparent}" />
    </linearGradient>
  `;

  if (input.overlayType === 'radial') {
    defs = `
      <radialGradient id="overlay" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stop-color="${transparent}" />
        <stop offset="100%" stop-color="${opaque}" />
      </radialGradient>
    `;
  } else if (input.overlayType === 'full_fade') {
    body = `<rect width="${input.width}" height="${input.height}" fill="${opaque}" />`;
    defs = '';
  } else if (input.overlayType === 'top_fade') {
    defs = `
      <linearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${opaque}" />
        <stop offset="72%" stop-color="${transparent}" />
      </linearGradient>
    `;
  } else if (input.overlayType === 'bottom_fade') {
    defs = `
      <linearGradient id="overlay" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="${opaque}" />
        <stop offset="72%" stop-color="${transparent}" />
      </linearGradient>
    `;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}">
      <defs>${defs}</defs>
      ${body}
    </svg>
  `.trim();
  return Buffer.from(svg);
}

async function buildBackgroundLayer(input: {
  width: number;
  height: number;
  source?: string;
  cropMode?: DesignStudioRenderPayload['cropMode'];
  backgroundAnchor: DesignStudioVariantRecord['backgroundAnchor'];
  focalPoint?: { x: number; y: number };
  zoom?: number;
}): Promise<Buffer> {
  try {
    const source = input.source ? await fetchSourceBuffer(input.source) : null;
    if (!source) {
      return sharp({
        create: {
          width: input.width,
          height: input.height,
          channels: 3,
          background: { r: 18, g: 18, b: 18 },
        },
      }).png().toBuffer();
    }

    const zoom = clamp(input.zoom || 1, 0.8, 2);
    const cropMode = input.cropMode || 'cover';
    const meta = await sharp(source).metadata();
    const srcWidth = meta.width || input.width;
    const srcHeight = meta.height || input.height;
    let targetWidth = input.width;
    let targetHeight = input.height;
    if (cropMode === 'contain') {
      const ratio = Math.min(input.width / srcWidth, input.height / srcHeight) * zoom;
      targetWidth = Math.max(1, Math.round(srcWidth * ratio));
      targetHeight = Math.max(1, Math.round(srcHeight * ratio));
    } else {
      const ratio = Math.max(input.width / srcWidth, input.height / srcHeight) * zoom;
      targetWidth = Math.max(1, Math.round(srcWidth * ratio));
      targetHeight = Math.max(1, Math.round(srcHeight * ratio));
    }

    const resized = await sharp(source).resize(targetWidth, targetHeight).toBuffer();
    const leftBase = (() => {
      switch (input.backgroundAnchor) {
        case 'top_right':
        case 'bottom_right':
        case 'right':
          return input.width - targetWidth;
        case 'top_left':
        case 'bottom_left':
        case 'left':
          return 0;
        default:
          return Math.round((input.width - targetWidth) / 2);
      }
    })();
    const topBase = (() => {
      switch (input.backgroundAnchor) {
        case 'bottom':
        case 'bottom_left':
        case 'bottom_right':
          return input.height - targetHeight;
        case 'top':
        case 'top_left':
        case 'top_right':
          return 0;
        default:
          return Math.round((input.height - targetHeight) / 2);
      }
    })();
    const left = Math.round(leftBase + ((input.focalPoint?.x ?? 50) - 50) * 2.2);
    const top = Math.round(topBase + ((input.focalPoint?.y ?? 50) - 50) * 2.2);

    if (cropMode === 'contain') {
      const containLeft = clamp(left, 0, Math.max(0, input.width - targetWidth));
      const containTop = clamp(top, 0, Math.max(0, input.height - targetHeight));
      return sharp({
        create: {
          width: input.width,
          height: input.height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 1 },
        },
      })
        .composite([{ input: resized, left: Math.round(containLeft), top: Math.round(containTop) }])
        .png()
        .toBuffer();
    }

    const coverLeft = clamp(left, input.width - targetWidth, 0);
    const coverTop = clamp(top, input.height - targetHeight, 0);
    const extractLeft = Math.max(0, Math.round(-coverLeft));
    const extractTop = Math.max(0, Math.round(-coverTop));

    return sharp(resized)
      .extract({
        left: extractLeft,
        top: extractTop,
        width: Math.min(input.width, targetWidth - extractLeft),
        height: Math.min(input.height, targetHeight - extractTop),
      })
      .resize(input.width, input.height, { fit: 'fill' })
      .png()
      .toBuffer();
  } catch (error) {
    throw new Error(
      `Background render failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      } | source=${input.source || 'none'} anchor=${input.backgroundAnchor} cropMode=${input.cropMode || 'cover'} zoom=${input.zoom || 1}`,
    );
  }

}

async function getRenderExportSettings(preferredFormat?: DesignStudioExportFormat): Promise<{
  format: DesignStudioExportFormat;
  jpegQuality: number;
}> {
  const settingKeys = ['exportFormat', 'jpegQuality'];
  const settings = await prisma.setting.findMany({
    where: { key: { in: settingKeys } },
    select: { key: true, value: true },
  });
  const map = new Map(settings.map((entry) => [entry.key, entry.value]));
  const storedFormat = String(map.get('exportFormat') || 'jpeg').toLowerCase();
  const format = preferredFormat || (storedFormat === 'png' ? 'png' : 'jpeg');
  const jpegQuality = clamp(readNumber(map.get('jpegQuality'), 90), 1, 100);
  return { format, jpegQuality };
}

async function renderDesignStudioImage(
  template: DesignStudioTemplateRecord,
  payload: DesignStudioRenderPayload,
): Promise<ResolvedRenderOutput> {
  const variant = findVariant(template, payload.template_variant);
  const width = template.width;
  const height = template.height;
  const background = await buildBackgroundLayer({
    width,
    height,
    source: payload.backgroundImage,
    cropMode: payload.cropMode,
    backgroundAnchor: variant.backgroundAnchor,
    focalPoint: payload.imageFocalPoint || (
      payload.backgroundOffsetX !== undefined || payload.backgroundOffsetY !== undefined
        ? { x: payload.backgroundOffsetX ?? 50, y: payload.backgroundOffsetY ?? 50 }
        : undefined
    ),
    zoom: payload.zoomLevel || payload.imageZoom,
  });

  const overlayColor = payload.useTemplateDefaultStyling ? '#000000' : (payload.overlayColor || '#000000');
  const overlayStrength = payload.useTemplateDefaultStyling
    ? 0.72
    : clamp((payload.overlayOpacity ?? 72) / 100, 0, 1);
  const overlay = buildOverlaySvg({
    width,
    height,
    color: overlayColor,
    strength: overlayStrength,
    direction: payload.gradientPosition || variant.overlayDirection,
    overlayType: payload.overlayType || 'linear',
  });
  const textOverlay = buildTextSvg({ width, height, variant, template, payload });
  const brandOverlay = buildBrandSvg(width, height, variant);
  const [overlayRaster, textRaster, brandRaster] = await Promise.all([
    sharp(overlay).resize(width, height, { fit: 'fill' }).png().toBuffer(),
    sharp(textOverlay).resize(width, height, { fit: 'fill' }).png().toBuffer(),
    sharp(brandOverlay).resize(width, height, { fit: 'fill' }).png().toBuffer(),
  ]);
  const { format, jpegQuality } = await getRenderExportSettings(payload.exportFormat);
  const pipeline = sharp(background).composite([
    { input: overlayRaster },
    { input: textRaster },
    { input: brandRaster },
  ]);

  try {
    if (format === 'png') {
      return {
        buffer: await pipeline.png().toBuffer(),
        format,
        extension: 'png',
        contentType: 'image/png',
      };
    }

    return {
      buffer: await pipeline.jpeg({ quality: jpegQuality }).toBuffer(),
      format: 'jpeg',
      extension: 'jpg',
      contentType: 'image/jpeg',
    };
  } catch (error) {
    const [backgroundMeta, overlayMeta, textMeta, brandMeta] = await Promise.all([
      sharp(background).metadata(),
      sharp(overlayRaster).metadata(),
      sharp(textRaster).metadata(),
      sharp(brandRaster).metadata(),
    ]);
    throw new Error(
      `Render composite failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      } | background=${backgroundMeta.width}x${backgroundMeta.height} overlay=${overlayMeta.width}x${overlayMeta.height} text=${textMeta.width}x${textMeta.height} brand=${brandMeta.width}x${brandMeta.height}`,
    );
  }
}

function findMatchedKeyword(title: string, keywords: string[]): string | undefined {
  const normalizedTitle = normalizeKeyword(title);
  return keywords.find((keyword) => normalizedTitle.includes(normalizeKeyword(keyword)));
}

function deriveEditorialScore(title: string, matchedKeyword: string, hasImage: boolean): number {
  let score = 48;
  score += matchedKeyword.includes(' ') ? 15 : 10;
  if (title.length >= 30 && title.length <= 110) {
    score += 14;
  }
  if (hasImage) {
    score += 12;
  }
  return Math.min(100, score);
}

function deriveHeaderText(title: string): string {
  return title.trim().length <= 120 ? title.trim() : `${title.trim().slice(0, 117).trim()}...`;
}

function deriveSubtext(feedName?: string, matchedKeyword?: string): string {
  if (!feedName && !matchedKeyword) return '';
  if (feedName && matchedKeyword) return `${feedName} | ${matchedKeyword}`;
  return feedName || matchedKeyword || '';
}

function getContentTypeForKeyword(keyword?: string): DesignStudioContentType {
  const normalized = normalizeKeyword(keyword || '');
  if (['release date', 'premiere', 'renew', 'cancel', 'confirm', 'development'].some((entry) => normalized.includes(entry))) {
    return 'announcement';
  }
  return 'general';
}

function getCaptionMaxLength(lengthMode: 'short' | 'medium'): number {
  return lengthMode === 'short' ? 160 : 240;
}

function truncateText(value: string, maxLength: number): string {
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

async function buildCaptionPayload(
  title: string,
  subtext: string,
  contentType: DesignStudioContentType,
  settings: DesignStudioAutoSettings,
): Promise<DesignStudioCaptionPayload> {
  const prompt = contentType === 'announcement' ? settings.promptAnnouncement : settings.promptGeneral;
  const shared = truncateText(
    await generateStudioCaption(
      {
        fileName: title,
        fileDescription: subtext || title,
        tone: settings.captionTone,
      },
      settings.model as any,
      prompt,
      settings.captionTemperature,
      settings.captionMaxTokens,
    ),
    getCaptionMaxLength(settings.captionLengthMode),
  );

  return {
    shared_caption: shared,
    pinterest_title: truncateText(title, 100),
    pinterest_description: truncateText(`${title}. ${subtext || 'Latest entertainment news update.'}`, 500),
  };
}

async function getAutoSettings(): Promise<DesignStudioAutoSettings> {
  const keys = [
    'designStudioAutoEnabled',
    'designStudioAutoPost',
    'designStudioDefaultAutoTemplateId',
    'designStudioTemplatePool',
    'designStudioTemplateRotationStrategy',
    'designStudioPostingInterval',
    'designStudioTriggerKeywords',
    'designStudioSelectedRssFeedIds',
    'designStudioMaxEditorialsPerRun',
    'designStudioCaptionLengthMode',
    'designStudioMinimumScoreThreshold',
    'designStudioTargetPlatforms',
    'captionOpenaiModel',
    'captionAnnouncementPrompt',
    'captionGeneralPrompt',
    'captionTemperature',
    'captionMaxTokens',
    'captionTone',
  ];

  const settings = await prisma.setting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });
  const map = new Map(settings.map((entry) => [entry.key, entry.value]));
  const triggerKeywords = asStringArray(map.get('designStudioTriggerKeywords'));
  const templatePool = asStringArray(map.get('designStudioTemplatePool'));
  const rotation = String(map.get('designStudioTemplateRotationStrategy') || 'sequential').toLowerCase();

  return {
    enabled: parseBoolean(map.get('designStudioAutoEnabled'), false),
    autoPost: parseBoolean(map.get('designStudioAutoPost'), false),
    defaultTemplateId: typeof map.get('designStudioDefaultAutoTemplateId') === 'string'
      ? String(map.get('designStudioDefaultAutoTemplateId'))
      : null,
    templatePool,
    templateRotationStrategy: ['random', 'weighted', 'sequential'].includes(rotation)
      ? rotation as DesignStudioAutoSettings['templateRotationStrategy']
      : 'sequential',
    postingInterval: Math.max(1, readNumber(map.get('designStudioPostingInterval'), 5)),
    triggerKeywords: triggerKeywords.length > 0 ? triggerKeywords : DEFAULT_TRIGGER_KEYWORDS,
    selectedRssFeedIds: asStringArray(map.get('designStudioSelectedRssFeedIds')),
    maxEditorialsPerRun: Math.max(1, readNumber(map.get('designStudioMaxEditorialsPerRun'), 5)),
    captionLengthMode: String(map.get('designStudioCaptionLengthMode') || 'medium') === 'short' ? 'short' : 'medium',
    minimumScoreThreshold: clamp(readNumber(map.get('designStudioMinimumScoreThreshold'), 55), 0, 100),
    targetPlatforms: asStringArray(map.get('designStudioTargetPlatforms')).length > 0
      ? asStringArray(map.get('designStudioTargetPlatforms'))
      : DEFAULT_TARGET_PLATFORMS,
    model: String(map.get('captionOpenaiModel') || 'gpt-4o-mini'),
    promptGeneral: String(map.get('captionGeneralPrompt') || 'Write a concise entertainment-news caption.'),
    promptAnnouncement: String(map.get('captionAnnouncementPrompt') || 'Write a concise entertainment announcement caption.'),
    captionTemperature: readNumber(map.get('captionTemperature'), 0.7),
    captionMaxTokens: Math.max(100, readNumber(map.get('captionMaxTokens'), 500)),
    captionTone: String(map.get('captionTone') || 'engaging'),
  };
}

function getAutoTemplatePool(
  templates: DesignStudioTemplateRecord[],
  settings: DesignStudioAutoSettings,
): DesignStudioTemplateRecord[] {
  const validTemplates = templates.filter((template) => template.isValidated);
  const poolIds = settings.templatePool.length > 0 ? settings.templatePool : (settings.defaultTemplateId ? [settings.defaultTemplateId] : []);
  const pool = poolIds.length > 0
    ? validTemplates.filter((template) => poolIds.includes(template.id))
    : validTemplates.filter((template) => template.isDefaultAuto || template.id === settings.defaultTemplateId);
  return pool.length > 0 ? pool : validTemplates.slice(0, 1);
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildScheduledTime(
  index: number,
  postingInterval: number,
  existingEditorials: DesignStudioAutoEditorialRecord[],
): string {
  const futureScheduleTimes = existingEditorials
    .map((item) => item.scheduleTime)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value) && value > Date.now());

  const base = futureScheduleTimes.length > 0 ? Math.max(...futureScheduleTimes) : Date.now();
  return new Date(base + (postingInterval * (index + 1) * 60 * 1000)).toISOString();
}

async function processManualRenderJob(
  jobId: string,
  input: QueueManualRenderInput,
): Promise<void> {
  const template = input.template;
  const claimedJob = await claimManualRenderJob(jobId);
  if (!claimedJob) {
    return;
  }

  try {
    const activeVariant = input.data.template_variant || template.baseVariant || 'bottom_center';
    const rendered = await renderDesignStudioImage(template, {
      ...input.data,
      template_variant: activeVariant,
    });

    const uploaded = await uploadBufferToBackblaze(
      rendered.buffer,
      `${template.name.replace(/[^a-z0-9-]+/gi, '-')}-${Date.now()}.${rendered.extension}`,
      {
        bucketTypes: ['design', 'general'],
        prefix: 'design-studio/renders',
        contentType: rendered.contentType,
      },
    );

    const captions: DesignStudioCaptionPayload = {
      shared_caption: input.data.sharedCaption || input.data.caption || '',
      pinterest_title: input.data.pinterestTitle || truncateText(input.data.headerText, 100),
      pinterest_description: input.data.pinterestDescription || truncateText(input.data.subtext || input.data.headerText, 500),
    };

    const renderedDesign: DesignStudioRenderedDesignRecord = {
      id: `design-render-${randomUUID()}`,
      templateId: template.id,
      templateName: template.name,
      templateVariant: activeVariant,
      exportFormat: rendered.format,
      outputUrl: uploaded.url,
      previewUrl: uploaded.url,
      data: input.data,
      createdAt: new Date().toISOString(),
      aspectRatio: template.aspectRatio,
      caption: captions.shared_caption,
      captions,
      contentType: input.data.contentType,
    };

    const renderedDesigns = await getRenderedDesigns();
    await saveRenderedDesigns([renderedDesign, ...renderedDesigns].slice(0, 200));

    await updateManualRenderJob(jobId, {
      status: 'completed',
      renderedDesignId: renderedDesign.id,
      outputUrl: renderedDesign.outputUrl,
      failureReason: null,
    });

    await createDesignStudioActivity('design_rendered', {
      templateId: template.id,
      templateName: template.name,
      renderJobId: jobId,
      variant: renderedDesign.templateVariant,
      previewUrl: renderedDesign.previewUrl,
      outputUrl: renderedDesign.outputUrl,
      exportFormat: renderedDesign.exportFormat,
    });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : 'Failed to render design';
    await updateManualRenderJob(jobId, {
      status: 'failed',
      failureReason,
    });
    await createDesignStudioActivity('design_render_failed', {
      templateId: template.id,
      templateName: template.name,
      renderJobId: jobId,
      failureReason,
    });
  }
}

export async function registerUploadedDesignStudioTemplate(input: {
  buffer: Buffer;
  fileName: string;
  sourceType: 'device' | 'backblaze';
  sourceFilePath: string;
  uploadedUrl: string;
}): Promise<DesignStudioTemplateRecord> {
  const template = buildTemplateFromPsdBuffer(input);
  const previewUrl = await generateTemplatePreviewUrl({
    buffer: input.buffer,
    fileName: input.fileName,
    fallbackName: input.fileName.replace(/\.psd$/i, ''),
    width: template.width,
    height: template.height,
  });
  template.previewImage = previewUrl;
  template.previewUrl = previewUrl;
  const templates = await getTemplates();
  const nextTemplates = [template, ...templates.filter((entry) => entry.sourceFilePath !== template.sourceFilePath)].slice(0, 200);
  await saveTemplates(nextTemplates);
  await createDesignStudioActivity('template_uploaded', {
    templateId: template.id,
    templateName: template.name,
    sourceType: template.sourceType,
    isValidated: template.isValidated,
  });
  return template;
}

export async function queueManualDesignStudioRender(input: QueueManualRenderInput): Promise<DesignStudioManualRenderJob> {
  ensureRenderWorker();
  const now = new Date().toISOString();
  const job: DesignStudioManualRenderJob = {
    id: `manual-render-${randomUUID()}`,
    templateId: input.template.id,
    templateName: input.template.name,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    renderedDesignId: null,
    outputUrl: null,
    failureReason: null,
  };

  const jobs = await getDesignStudioRenderJobs();
  await saveDesignStudioRenderJobs([job, ...jobs].slice(0, 200));
  await createDesignStudioActivity('design_render_queued', {
    templateName: input.template.name,
    templateId: input.template.id,
    renderJobId: job.id,
  });

  const renderQueue = ensureRenderQueue();
  if (renderQueue) {
    await renderQueue.add(job.id, { ...input, data: { ...input.data, template_id: input.template.id } }, {
      jobId: job.id,
      removeOnComplete: 50,
      removeOnFail: 50,
    });
  }

  // Safety net: if the shared queue worker does not pick this up quickly,
  // process it in-process so the UI does not remain stuck in "queued".
  setTimeout(() => {
    void processManualRenderJob(job.id, input);
  }, renderQueue ? 3000 : 0);

  return job;
}

export async function generateDesignStudioAutoEditorials(): Promise<DesignStudioRunResult> {
  const settings = await getAutoSettings();
  if (!settings.enabled || settings.selectedRssFeedIds.length === 0 || settings.triggerKeywords.length === 0) {
    return { generated: 0, published: 0, failed: 0 };
  }

  const [templates, existingEditorials, activity] = await Promise.all([
    getTemplates(),
    getAutoEditorials(),
    getRSSActivity(250),
  ]);

  const templatePool = getAutoTemplatePool(templates, settings);
  if (templatePool.length === 0) {
    return { generated: 0, published: 0, failed: 0 };
  }

  const selectedFeedIds = new Set(settings.selectedRssFeedIds);
  const existingSourceIds = new Set(existingEditorials.map((item) => item.sourceFeedItemId));
  const seenTitles = new Set<string>();

  const candidates = activity.items
    .filter((item) => item.feedId && selectedFeedIds.has(item.feedId))
    .map((item) => {
      const matchedKeyword = findMatchedKeyword(item.title, settings.triggerKeywords);
      if (!matchedKeyword) {
        return null;
      }
      const normalizedTitle = normalizeKeyword(item.title);
      if (existingSourceIds.has(item.id) || seenTitles.has(normalizedTitle)) {
        return null;
      }
      seenTitles.add(normalizedTitle);
      const backgroundSource = item.imageUrl || item.imageUrls?.[0];
      const score = deriveEditorialScore(item.title, matchedKeyword, Boolean(backgroundSource));
      if (score < settings.minimumScoreThreshold) {
        return null;
      }
      return { item, matchedKeyword, backgroundSource, score };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((left, right) => right.score - left.score)
    .slice(0, settings.maxEditorialsPerRun);

  if (candidates.length === 0) {
    return { generated: 0, published: 0, failed: 0 };
  }

  const nextEditorials: DesignStudioAutoEditorialRecord[] = [];
  let failed = 0;

  for (const [index, candidate] of candidates.entries()) {
    const template = settings.templateRotationStrategy === 'random'
      ? templatePool[Math.floor(Math.random() * templatePool.length)]
      : templatePool[index % templatePool.length];
    const activeVariant = template.baseVariant || template.layoutVariant || 'bottom_center';
    const contentType = getContentTypeForKeyword(candidate.matchedKeyword);
    const headerText = deriveHeaderText(candidate.item.title);
    const subtext = deriveSubtext(candidate.item.feedName, candidate.matchedKeyword);
    const captions = await buildCaptionPayload(headerText, subtext, contentType, settings);

    try {
      const rendered = await renderDesignStudioImage(template, {
        template_variant: activeVariant,
        headerText,
        subtext,
        backgroundImage: candidate.backgroundSource,
        overlayColor: '#000000',
        overlayOpacity: 72,
        gradientPosition: activeVariant.startsWith('top') ? 'top' : 'bottom',
        cropMode: 'cover',
        sharedCaption: captions.shared_caption,
        pinterestTitle: captions.pinterest_title,
        pinterestDescription: captions.pinterest_description,
      });

      const uploaded = await uploadBufferToBackblaze(
        rendered.buffer,
        `${template.name.replace(/[^a-z0-9-]+/gi, '-')}-auto-${Date.now()}-${index}.${rendered.extension}`,
        {
          bucketTypes: ['design', 'general'],
          prefix: 'design-studio/renders',
          contentType: rendered.contentType,
        },
      );

      const now = new Date().toISOString();
      nextEditorials.push({
        id: `auto-editorial-${randomUUID()}`,
        sourceFeedItemId: candidate.item.id,
        sourceFeedId: candidate.item.feedId,
        sourceFeedName: candidate.item.feedName,
        sourceTitle: candidate.item.title,
        sourceUrl: candidate.item.link,
        matchedKeyword: candidate.matchedKeyword,
        templateId: template.id,
        templateName: template.name,
        templateVariant: activeVariant,
        renderedImage: uploaded.url,
        headerText,
        subheaderText: subtext,
        caption: captions.shared_caption,
        captions,
        backgroundSource: candidate.backgroundSource,
        backgroundOffsetX: 50,
        backgroundOffsetY: 50,
        zoomLevel: 1,
        overlayDirection: findVariant(template, activeVariant).overlayDirection,
        overlayStrength: 72,
        scheduleTime: settings.autoPost ? buildScheduledTime(index, settings.postingInterval, existingEditorials) : null,
        targetPlatforms: settings.targetPlatforms,
        status: settings.autoPost ? 'queued' : 'detected',
        createdAt: now,
        updatedAt: now,
        postedAt: null,
        failureReason: null,
      });
    } catch (error) {
      failed += 1;
      await createDesignStudioActivity('auto_editorial_failed', {
        sourceTitle: candidate.item.title,
        failureReason: error instanceof Error ? error.message : 'Failed to render auto editorial',
      });
    }
  }

  if (nextEditorials.length > 0) {
    await saveAutoEditorials([...nextEditorials, ...existingEditorials].slice(0, 300));
    await Promise.all(nextEditorials.map((editorial) => createDesignStudioActivity('auto_editorial_generated', {
      sourceTitle: editorial.sourceTitle,
      templateName: editorial.templateName,
      variant: editorial.templateVariant,
      status: editorial.status,
      previewUrl: editorial.renderedImage,
      outputUrl: editorial.renderedImage,
      matchedKeyword: editorial.matchedKeyword,
    })));
  }

  return { generated: nextEditorials.length, published: 0, failed };
}

export async function publishScheduledDesignStudioAutoEditorials(): Promise<DesignStudioRunResult> {
  const settings = await getAutoSettings();
  if (!settings.enabled || !settings.autoPost) {
    return { generated: 0, published: 0, failed: 0 };
  }

  const editorials = await getAutoEditorials();
  const dueItems = editorials
    .filter((item) =>
      item.status === 'queued'
      && typeof item.scheduleTime === 'string'
      && new Date(item.scheduleTime).getTime() <= Date.now(),
    )
    .sort((left, right) => toTimestamp(left.scheduleTime) - toTimestamp(right.scheduleTime))
    .slice(0, 5);

  if (dueItems.length === 0) {
    return { generated: 0, published: 0, failed: 0 };
  }

  let published = 0;
  let failed = 0;
  const editorialMap = new Map(editorials.map((entry) => [entry.id, { ...entry }]));

  for (const editorial of dueItems) {
    const target = editorialMap.get(editorial.id);
    if (!target) {
      continue;
    }

    try {
      const results = await publisherService.publish(target.targetPlatforms, {
        text: target.caption,
        title: target.headerText,
        imageUrl: target.renderedImage,
      });
      const success = results.some((result) => result.status === 'posted');
      const failureMessage = results
        .filter((result) => result.status !== 'posted')
        .map((result) => `${result.platform}: ${result.error || 'Publish failed'}`)
        .join(', ');

      target.status = success ? 'posted' : 'failed';
      target.updatedAt = new Date().toISOString();
      target.postedAt = success ? new Date().toISOString() : null;
      target.failureReason = success ? (failureMessage || null) : (failureMessage || 'Failed to publish auto editorial');

      if (success) {
        published += 1;
        await createDesignStudioActivity('auto_editorial_posted', {
          sourceTitle: target.sourceTitle,
          templateName: target.templateName,
          targetPlatforms: target.targetPlatforms,
          previewUrl: target.renderedImage,
          outputUrl: target.renderedImage,
        });
      } else {
        failed += 1;
        await createDesignStudioActivity('auto_editorial_failed', {
          sourceTitle: target.sourceTitle,
          failureReason: target.failureReason,
          previewUrl: target.renderedImage,
        });
      }
    } catch (error) {
      target.status = 'failed';
      target.updatedAt = new Date().toISOString();
      target.failureReason = error instanceof Error ? error.message : 'Failed to publish auto editorial';
      failed += 1;
      await createDesignStudioActivity('auto_editorial_failed', {
        sourceTitle: target.sourceTitle,
        failureReason: target.failureReason,
        previewUrl: target.renderedImage,
      });
    }
  }

  await saveAutoEditorials(Array.from(editorialMap.values()));
  return { generated: 0, published, failed };
}

export async function getDesignStudioStateSnapshot() {
  const [templates, renderedDesigns, autoEditorials] = await Promise.all([
    getTemplates(),
    getRenderedDesigns(),
    getAutoEditorials(),
  ]);

  return { templates, renderedDesigns, autoEditorials };
}

export async function saveDesignStudioStateSnapshot(state: {
  templates: DesignStudioTemplateRecord[];
  renderedDesigns: DesignStudioRenderedDesignRecord[];
  autoEditorials?: DesignStudioAutoEditorialRecord[];
}): Promise<void> {
  await Promise.all([
    saveTemplates(state.templates || []),
    saveRenderedDesigns(state.renderedDesigns || []),
    saveAutoEditorials(state.autoEditorials || []),
  ]);
}
