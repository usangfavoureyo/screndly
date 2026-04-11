import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import prisma from '../lib/prisma';
import { readPsdSafely } from '../lib/psd';
import { generateStudioCaption } from './ai.service';
import { uploadBufferToBackblaze, getBackblazeAuthorizedDownloadUrl } from './backblaze';
import { publisherService } from './publisher.service';
import { getRSSActivity, type RSSActivityItem } from './rss.service';
import sharp from 'sharp';
import {
  REFERENCE_BRAND_HEIGHT,
  REFERENCE_BRAND_WIDTH,
  REFERENCE_VARIANTS,
} from '../design-studio/reference-layouts';

const DESIGN_STUDIO_TEMPLATES_KEY = 'designStudioTemplates';
const DESIGN_STUDIO_RENDERED_KEY = 'designStudioRenderedDesigns';
const DESIGN_STUDIO_AUTO_EDITORIALS_KEY = 'designStudioAutoEditorials';
const DESIGN_STUDIO_RENDER_JOBS_KEY = 'designStudioRenderJobs';
const DESIGN_STUDIO_QUEUE_NAME = 'design-studio-renders';
const DESIGN_STUDIO_REMOTE_FETCH_TIMEOUT_MS = 30000;
const DESIGN_STUDIO_RENDER_TIMEOUT_MS = 180000;
const DESIGN_STUDIO_NON_NARRATIVE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(?:wwe|wrestling|pro wrestling)\b/i, reason: 'Wrestling content is out of scope' },
  { pattern: /\b(?:ufc|mma|boxing|weigh[\s-]?in|press conference|matchday|postgame|pregame|highlights?)\b/i, reason: 'Sports coverage is out of scope' },
  { pattern: /\b(?:documentary|docuseries|docu-series|true crime)\b/i, reason: 'Documentaries and docuseries are out of scope' },
  { pattern: /\b(?:reality|unscripted|competition series|dating show|game show)\b/i, reason: 'Reality and unscripted shows are out of scope' },
  { pattern: /\b(?:love island|big brother|survivor|the bachelor|the bachelorette|real housewives|kardashians?)\b/i, reason: 'Reality franchise coverage is out of scope' },
  { pattern: /\b(?:lifestyle|home renovation|makeover|cooking show|food series|travel series)\b/i, reason: 'Lifestyle programming is out of scope' },
  { pattern: /\b(?:stand[\s-]?up|comedy special|one[\s-]?hour special|roast special|live special)\b/i, reason: 'Stand-up and comedy specials are out of scope' },
  { pattern: /\b(?:talk show|late night|podcast|vodcast|interview series|daytime show)\b/i, reason: 'Talk and podcast-style coverage is out of scope' },
  { pattern: /\b(?:concert film|music video|official audio|lyric video|live performance)\b/i, reason: 'Music/performance releases are out of scope' },
];
const DESIGN_STUDIO_SCRIPTED_INDICATOR_PATTERNS = [
  /\b(?:movie|film|feature film|feature|in theaters|in cinemas|box office)\b/i,
  /\b(?:tv series|tv show|series|season|episode|finale|miniseries|limited series|showrunner)\b/i,
  /\b(?:trailer|teaser|featurette|first look|poster|casting|director|writer|actor|actress|character|spin-?off|spinoff|sequel|prequel|adaptation|renewed|renewal|canceled|cancelled|premiere)\b/i,
  /\b(?:netflix|hbo|max|apple tv\+?|prime video|disney\+|hulu|peacock|paramount\+)\b/i,
  /\b(?:marvel|dc|pixar|dreamworks|illumination|a24|searchlight|universal|warner bros|sony pictures|paramount pictures|neon)\b/i,
];
function resolveDesignStudioAssetPath(fileName: string): string {
  const candidates = [
    path.join(__dirname, '..', 'design-studio', 'assets', fileName),
    path.join(process.cwd(), 'dist', 'design-studio', 'assets', fileName),
    path.join(process.cwd(), 'src', 'design-studio', 'assets', fileName),
  ];

  const match = candidates.find((candidate) => fs.existsSync(candidate));
  return match || candidates[0];
}

const DESIGN_STUDIO_FADE_ASSET_PATH = resolveDesignStudioAssetPath('fade.png');
const DESIGN_STUDIO_BRAND_BLACK_ASSET_PATH = resolveDesignStudioAssetPath('brand-block-black.png');
const DESIGN_STUDIO_BRAND_WHITE_ASSET_PATH = resolveDesignStudioAssetPath('brand-block-white.png');
const DESIGN_STUDIO_HEADLINE_FONT_PATH = resolveDesignStudioAssetPath('z-PFDinTextCompPro-Bold.ttf');

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
  fadeDefaultEnabled?: boolean;
  fadeDefaultOpacity?: number;
  minFontSize: number;
  maxFontSize: number;
  maxLines: number;
  lineHeightMultiplier?: number;
  safeMargin?: number;
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
  contentType?: DesignStudioContentType;
  caption: string;
  captions?: Record<string, any>;
  backgroundSource?: string;
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  zoomLevel?: number;
  headerTextColor?: string;
  brandBlockMode?: 'auto' | 'black' | 'white';
  overlayColor?: string;
  overlayDirection?: string;
  overlayStrength?: number;
  fadeEnabled?: boolean;
  fadeOpacity?: number;
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
  gradientPosition?: 'top' | 'bottom' | 'left' | 'right' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
  caption?: string;
  contentType?: DesignStudioContentType;
  cropMode?: 'cover' | 'contain' | 'center' | 'face_focus';
  headerAlignment?: 'left' | 'center' | 'right';
  fontScale?: number;
  headlineWidthScale?: number;
  lineHeightMultiplier?: number;
  maxLines?: number;
  overlayType?: 'linear' | 'radial' | 'full_fade' | 'top_fade' | 'bottom_fade';
  useTemplateDefaultStyling?: boolean;
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  zoomLevel?: number;
  fadeEnabled?: boolean;
  fadeOpacity?: number;
  brandBlockMode?: 'auto' | 'black' | 'white';
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

interface MeasuredRegionStats {
  luminance: number;
  detail: number;
}

interface DesignStudioAutoRenderPlan {
  variant: DesignStudioLayoutVariant;
  overlayDirection: DesignStudioVariantRecord['overlayDirection'];
  overlayColor: string;
  overlayOpacity: number;
  fadeEnabled: boolean;
  headerTextColor: string;
  brandBlockMode: 'black' | 'white';
  score: number;
}

interface DesignStudioAutoBackgroundCandidate {
  url: string;
  reason?: string;
  source?: RSSActivityItem['imageSource'];
  score?: number;
}

interface DesignStudioAutoBackgroundSelection {
  url: string;
  reason: string;
  source?: RSSActivityItem['imageSource'];
  role: 'clean_art' | 'logo_card';
  score: number;
}

interface PsdImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
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

function imageDataToBuffer(imageData: PsdImageDataLike): Buffer {
  return Buffer.from(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);
}

async function rasterizeImageData(imageData: PsdImageDataLike): Promise<Buffer> {
  return sharp(imageDataToBuffer(imageData), {
    raw: {
      width: imageData.width,
      height: imageData.height,
      channels: 4,
    },
  }).png().toBuffer();
}

const referenceAssetBufferCache = new Map<string, Buffer>();
let cachedHeadlineFontDataUri: string | null | undefined;

function readReferenceAssetBuffer(assetPath: string): Buffer {
  const cached = referenceAssetBufferCache.get(assetPath);
  if (cached) {
    return cached;
  }
  const buffer = fs.readFileSync(assetPath);
  referenceAssetBufferCache.set(assetPath, buffer);
  return buffer;
}

function getHeadlineFontDataUri(): string | null {
  if (cachedHeadlineFontDataUri !== undefined) {
    return cachedHeadlineFontDataUri;
  }

  if (!fs.existsSync(DESIGN_STUDIO_HEADLINE_FONT_PATH)) {
    cachedHeadlineFontDataUri = null;
    return cachedHeadlineFontDataUri;
  }

  cachedHeadlineFontDataUri = `data:font/ttf;base64,${readReferenceAssetBuffer(DESIGN_STUDIO_HEADLINE_FONT_PATH).toString('base64')}`;
  return cachedHeadlineFontDataUri;
}

function getReferenceBrandAssetPath(mode: 'black' | 'white'): string {
  return mode === 'black' ? DESIGN_STUDIO_BRAND_BLACK_ASSET_PATH : DESIGN_STUDIO_BRAND_WHITE_ASSET_PATH;
}

function hexToRgba(value: string, alpha: number): string {
  const normalized = value.replace('#', '');
  const safe = normalized.length === 6 ? normalized : '000000';
  const red = Number.parseInt(safe.slice(0, 2), 16);
  const green = Number.parseInt(safe.slice(2, 4), 16);
  const blue = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1)})`;
}

function hexToRgb(value: string): { r: number; g: number; b: number } {
  const normalized = colorToHex(value, '#ffffff').replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

async function colorizeTextBuffer(
  textBuffer: Buffer,
  color: string,
  alphaScale = 1,
): Promise<Buffer> {
  const { data, info } = await sharp(textBuffer)
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const alpha = Buffer.from(data);
  if (alphaScale !== 1) {
    for (let index = 0; index < alpha.length; index += 1) {
      alpha[index] = Math.round(alpha[index] * clamp(alphaScale, 0, 1));
    }
  }

  const rgb = hexToRgb(color);
  return sharp({
    create: {
      width: info.width,
      height: info.height,
      channels: 3,
      background: rgb,
    },
  })
    .joinChannel(alpha, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 1,
      },
    })
    .png()
    .toBuffer();
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

function findPsdLayer(children: Array<any> | undefined, predicate: (layer: any) => boolean): any | undefined {
  for (const child of children || []) {
    if (predicate(child)) {
      return child;
    }
    if (Array.isArray(child?.children)) {
      const nested = findPsdLayer(child.children, predicate);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
}

function buildPathFromVectorMask(vectorMask: any): string {
  if (!Array.isArray(vectorMask?.paths)) {
    return '';
  }

  const segments: string[] = [];

  for (const path of vectorMask.paths) {
    const knots = Array.isArray(path?.knots) ? path.knots : [];
    if (!knots.length) {
      continue;
    }

    const anchor = (knot: any) => ({
      x: Number(knot?.points?.[2] ?? knot?.points?.[0] ?? 0),
      y: Number(knot?.points?.[3] ?? knot?.points?.[1] ?? 0),
    });
    const incoming = (knot: any) => ({
      x: Number(knot?.points?.[0] ?? knot?.points?.[2] ?? 0),
      y: Number(knot?.points?.[1] ?? knot?.points?.[3] ?? 0),
    });
    const outgoing = (knot: any) => ({
      x: Number(knot?.points?.[4] ?? knot?.points?.[2] ?? 0),
      y: Number(knot?.points?.[5] ?? knot?.points?.[3] ?? 0),
    });

    const firstAnchor = anchor(knots[0]);
    let command = `M ${firstAnchor.x} ${firstAnchor.y}`;
    for (let index = 0; index < knots.length; index += 1) {
      const current = knots[index];
      const next = knots[(index + 1) % knots.length];
      const currentOut = outgoing(current);
      const nextIn = incoming(next);
      const nextAnchor = anchor(next);
      command += ` C ${currentOut.x} ${currentOut.y}, ${nextIn.x} ${nextIn.y}, ${nextAnchor.x} ${nextAnchor.y}`;
      if (!path?.open && index === knots.length - 1) {
        command += ' Z';
      }
    }
    segments.push(command);
  }

  return segments.join(' ');
}

async function placeLayerImageOnCanvas(input: {
  width: number;
  height: number;
  imageData?: PsdImageDataLike;
  left: number;
  top: number;
}): Promise<Buffer | null> {
  if (!input.imageData?.data?.length || input.imageData.width <= 0 || input.imageData.height <= 0) {
    return null;
  }

  let raster = sharp(imageDataToBuffer(input.imageData), {
    raw: {
      width: input.imageData.width,
      height: input.imageData.height,
      channels: 4,
    },
  });

  const visibleLeft = Math.max(0, input.left);
  const visibleTop = Math.max(0, input.top);
  const extractLeft = Math.max(0, -input.left);
  const extractTop = Math.max(0, -input.top);
  const visibleWidth = Math.min(input.imageData.width - extractLeft, input.width - visibleLeft);
  const visibleHeight = Math.min(input.imageData.height - extractTop, input.height - visibleTop);

  if (visibleWidth <= 0 || visibleHeight <= 0) {
    return null;
  }

  const cropped = await raster.extract({
    left: extractLeft,
    top: extractTop,
    width: visibleWidth,
    height: visibleHeight,
  }).png().toBuffer();

  return sharp({
    create: {
      width: input.width,
      height: input.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: cropped, left: visibleLeft, top: visibleTop }]).png().toBuffer();
}

async function buildTemplateStaticAssetsFromPsd(input: {
  buffer: Buffer;
  fileName: string;
}): Promise<{ brandOverlayUrl?: string; fadeOverlayUrl?: string }> {
  try {
    const psd = readPsdSafely(input.buffer, {
      skipCompositeImageData: true,
      skipLayerImageData: false,
      useImageData: true,
      skipThumbnail: true,
    });

    const width = Number(psd.width || 0);
    const height = Number(psd.height || 0);
    if (!width || !height) {
      return {};
    }

    const brandRectangle = findPsdLayer(psd.children, (layer) => layer?.name === 'Rectangle 1');
    const brandNews = findPsdLayer(psd.children, (layer) => layer?.name === 'NEWS');
    const brandMonogram = findPsdLayer(psd.children, (layer) => layer?.name === 'Monogram');
    const fadeLayer = findPsdLayer(psd.children, (layer) => layer?.name === 'Fade');

    let brandOverlayUrl: string | undefined;
    let fadeOverlayUrl: string | undefined;

    const brandSvgParts: string[] = [];
    if (brandRectangle?.vectorOrigination?.keyDescriptorList?.[0]?.keyOriginShapeBoundingBox) {
      const box = brandRectangle.vectorOrigination.keyDescriptorList[0].keyOriginShapeBoundingBox;
      const radii = brandRectangle.vectorOrigination.keyDescriptorList[0].keyOriginRRectRadii || {};
      const fill = colorToHex(brandRectangle?.vectorFill?.color, '#ffffff');
      const rectOpacity = clamp(readNumber(brandRectangle?.opacity, 1), 0, 1);
      brandSvgParts.push(
        `<rect x="${box.left.value}" y="${box.top.value}" width="${box.right.value - box.left.value}" height="${box.bottom.value - box.top.value}" rx="${readNumber(radii.topLeft?.value, 0)}" ry="${readNumber(radii.topLeft?.value, 0)}" fill="${fill}" fill-opacity="${rectOpacity}" />`,
      );
    }

    const monogramPath = buildPathFromVectorMask(brandMonogram?.vectorMask);
    if (monogramPath) {
      const fill = colorToHex(brandMonogram?.vectorFill?.color, '#ffffff');
      const opacity = clamp(readNumber(brandMonogram?.opacity, 1), 0, 1);
      brandSvgParts.push(`<path d="${monogramPath}" fill="${fill}" fill-opacity="${opacity}" fill-rule="nonzero" />`);
    }

    const brandComposites: Array<{ input: Buffer; left?: number; top?: number }> = [];
    if (brandSvgParts.length) {
      brandComposites.push({
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${brandSvgParts.join('')}</svg>`,
        ),
      });
    }

    const newsOverlay = await placeLayerImageOnCanvas({
      width,
      height,
      imageData: brandNews?.imageData,
      left: Number(brandNews?.left || 0),
      top: Number(brandNews?.top || 0),
    });
    if (newsOverlay) {
      brandComposites.push({ input: newsOverlay });
    }

    if (brandComposites.length) {
      const brandBuffer = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      }).composite(brandComposites).png().toBuffer();

      const uploadedBrand = await uploadBufferToBackblaze(
        brandBuffer,
        `${input.fileName.replace(/\.psd$/i, '')}-brand-overlay.png`,
        {
          bucketTypes: ['design', 'general'],
          prefix: 'design-studio/template-assets',
          contentType: 'image/png',
        },
      );
      brandOverlayUrl = uploadedBrand.url;
    }

    const fadeOverlay = await placeLayerImageOnCanvas({
      width,
      height,
      imageData: fadeLayer?.imageData,
      left: Number(fadeLayer?.left || 0),
      top: Number(fadeLayer?.top || 0),
    });
    if (fadeOverlay) {
      const uploadedFade = await uploadBufferToBackblaze(
        fadeOverlay,
        `${input.fileName.replace(/\.psd$/i, '')}-fade-overlay.png`,
        {
          bucketTypes: ['design', 'general'],
          prefix: 'design-studio/template-assets',
          contentType: 'image/png',
        },
      );
      fadeOverlayUrl = uploadedFade.url;
    }

    return { brandOverlayUrl, fadeOverlayUrl };
  } catch (error) {
    console.error('Failed to build PSD static assets:', error);
    return {};
  }
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

function detectBaseVariant(input: {
  width: number;
  height: number;
  headerLayer?: DesignStudioLayerReference;
  brandGroup?: DesignStudioLayerReference;
}): DesignStudioLayoutVariant {
  const reference = input.headerLayer || input.brandGroup;
  if (!reference) {
    return 'bottom_center';
  }

  const centerX = reference.left + reference.width / 2;
  const centerY = reference.top + reference.height / 2;
  const horizontal = centerX < input.width * 0.35
    ? 'left'
    : centerX > input.width * 0.65
      ? 'right'
      : 'center';
  const vertical = centerY < input.height * 0.45 ? 'top' : 'bottom';

  return `${vertical}_${horizontal}` as DesignStudioLayoutVariant;
}

function buildTextBoxFromLayer(input: {
  width: number;
  height: number;
  variant: DesignStudioLayoutVariant;
  layer?: DesignStudioLayerReference;
  safeMargin: number;
}): DesignStudioVariantRecord['textBox'] | null {
  if (!input.layer || input.layer.width <= 0 || input.layer.height <= 0) {
    return null;
  }

  const sideVariant = input.variant.endsWith('left') || input.variant.endsWith('right');
  const horizontalPadding = Math.round(input.safeMargin * 0.4);
  const verticalPadding = Math.round(input.safeMargin * 0.35);
  const minWidth = Math.round(input.width * (sideVariant ? 0.42 : 0.68));
  const maxWidth = Math.round(input.width * (sideVariant ? 0.58 : 0.82));
  const minHeight = Math.round(input.height * 0.18);
  const maxHeight = Math.round(input.height * 0.34);

  const rawWidth = Math.max(input.layer.width + horizontalPadding * 2, minWidth);
  const rawHeight = Math.max(input.layer.height + verticalPadding * 2, minHeight);
  const boxWidth = clamp(rawWidth, Math.round(input.width * 0.28), maxWidth);
  const boxHeight = clamp(rawHeight, Math.round(input.height * 0.14), maxHeight);
  const centerX = input.layer.left + input.layer.width / 2;
  const x = clamp(Math.round(centerX - boxWidth / 2), input.safeMargin, input.width - input.safeMargin - boxWidth);
  const y = clamp(
    Math.round(input.layer.top - verticalPadding),
    input.safeMargin,
    input.height - input.safeMargin - boxHeight,
  );

  return { x, y, width: boxWidth, height: boxHeight };
}

function buildBrandBoxFromLayer(input: {
  width: number;
  height: number;
  layer?: DesignStudioLayerReference;
  safeMargin: number;
  fallback: DesignStudioVariantRecord['brandBox'];
}): DesignStudioVariantRecord['brandBox'] {
  if (!input.layer || input.layer.width <= 0 || input.layer.height <= 0) {
    return input.fallback;
  }

  const padding = Math.round(input.safeMargin * 0.12);
  const boxWidth = clamp(
    Math.round(input.layer.width + padding * 2),
    Math.round(input.width * 0.18),
    Math.round(input.width * 0.42),
  );
  const boxHeight = clamp(
    Math.round(input.layer.height + padding * 2),
    Math.round(input.height * 0.045),
    Math.round(input.height * 0.12),
  );
  const x = clamp(Math.round(input.layer.left - padding), input.safeMargin, input.width - input.safeMargin - boxWidth);
  const y = clamp(Math.round(input.layer.top - padding), input.safeMargin, input.height - input.safeMargin - boxHeight);

  return { x, y, width: boxWidth, height: boxHeight };
}

function deriveVariants(
  width: number,
  height: number,
  baseFontSize: number,
  master?: {
    headerLayer?: DesignStudioLayerReference;
    brandGroup?: DesignStudioLayerReference;
    baseVariant?: DesignStudioLayoutVariant;
  },
): DesignStudioVariantRecord[] {
  const safeMargin = Math.round(Math.min(width, height) * 0.1111);
  const centeredWidth = width - safeMargin * 2;
  const sideWidth = Math.round(width * 0.52);
  const topTextY = safeMargin;
  const bottomTextHeight = 300;
  const topTextHeight = 280;
  const bottomTextY = height - safeMargin - bottomTextHeight;
  const defaultBrandWidth = 300;
  const defaultBrandHeight = 90;
  const bottomBrandY = height - safeMargin - defaultBrandHeight;

  const defaults: DesignStudioVariantRecord[] = [
    {
      variant: 'bottom_center',
      textBox: { x: safeMargin, y: bottomTextY, width: centeredWidth, height: bottomTextHeight },
      alignment: 'center',
      brandBox: { x: Math.round((width - defaultBrandWidth) / 2), y: bottomBrandY, width: defaultBrandWidth, height: defaultBrandHeight },
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
      brandBox: { x: Math.round((width - defaultBrandWidth) / 2), y: bottomBrandY, width: defaultBrandWidth, height: defaultBrandHeight },
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
      brandBox: { x: safeMargin, y: bottomBrandY, width: defaultBrandWidth, height: defaultBrandHeight },
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
      brandBox: { x: width - safeMargin - defaultBrandWidth, y: bottomBrandY, width: defaultBrandWidth, height: defaultBrandHeight },
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
      brandBox: { x: safeMargin, y: bottomBrandY, width: defaultBrandWidth, height: defaultBrandHeight },
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
      brandBox: { x: width - safeMargin - defaultBrandWidth, y: bottomBrandY, width: defaultBrandWidth, height: defaultBrandHeight },
      backgroundAnchor: 'top_left',
      overlayDirection: 'bottom_right',
      minFontSize: Math.round(baseFontSize * 0.64),
      maxFontSize: Math.round(baseFontSize),
      maxLines: 4,
    },
  ];

  if (!master?.headerLayer && !master?.brandGroup) {
    return defaults;
  }

  const byVariant = new Map(defaults.map((entry) => [entry.variant, { ...entry }]));
  const baseVariant = master.baseVariant || detectBaseVariant({
    width,
    height,
    headerLayer: master.headerLayer,
    brandGroup: master.brandGroup,
  });
  const baseRecord = byVariant.get(baseVariant) || defaults[0];
  const detectedTextBox = buildTextBoxFromLayer({
    width,
    height,
    variant: baseVariant,
    layer: master.headerLayer,
    safeMargin,
  });
  const detectedBrandBox = buildBrandBoxFromLayer({
    width,
    height,
    layer: master.brandGroup,
    safeMargin,
    fallback: baseRecord.brandBox,
  });
  const actualTextBox = detectedTextBox || baseRecord.textBox;
  const textWidth = actualTextBox.width;
  const textHeight = actualTextBox.height;
  const brandWidth = detectedBrandBox.width;
  const brandHeight = detectedBrandBox.height;

  const alignments: Record<DesignStudioLayoutVariant, 'left' | 'center' | 'right'> = {
    top_left: 'left',
    top_center: 'center',
    top_right: 'right',
    bottom_left: 'left',
    bottom_center: 'center',
    bottom_right: 'right',
  };

  const brandGap = Math.round(safeMargin * 0.18);
  const topTextYResolved = detectedTextBox
    ? detectedTextBox.y
    : clamp(safeMargin + brandHeight + brandGap, safeMargin, height - safeMargin - textHeight);
  const bottomTextYResolved = detectedTextBox
    ? detectedTextBox.y
    : clamp(height - safeMargin - textHeight, safeMargin, height - safeMargin - textHeight);
  const topBrandY = master.brandGroup
    ? detectedBrandBox.y
    : clamp(topTextYResolved - brandGap - brandHeight, safeMargin, height - safeMargin - brandHeight);
  const bottomBrandYResolved = master.brandGroup
    ? detectedBrandBox.y
    : clamp(height - safeMargin - brandHeight, safeMargin, height - safeMargin - brandHeight);

  const centeredX = clamp(Math.round((width - textWidth) / 2), safeMargin, width - safeMargin - textWidth);
  const leftX = safeMargin;
  const rightX = width - safeMargin - textWidth;
  const centerBrandX = clamp(Math.round((width - brandWidth) / 2), safeMargin, width - safeMargin - brandWidth);
  const rightBrandX = width - safeMargin - brandWidth;

  const generated: DesignStudioVariantRecord[] = [
    {
      ...baseRecord,
      variant: 'top_center',
      textBox: {
        x: baseVariant === 'top_center' ? actualTextBox.x : centeredX,
        y: baseVariant === 'top_center' ? actualTextBox.y : topTextYResolved,
        width: textWidth,
        height: textHeight,
      },
      alignment: alignments.top_center,
      brandBox: {
        x: baseVariant === 'top_center' ? detectedBrandBox.x : centerBrandX,
        y: baseVariant === 'top_center' ? detectedBrandBox.y : topBrandY,
        width: brandWidth,
        height: brandHeight,
      },
      backgroundAnchor: 'bottom',
      overlayDirection: 'top',
    },
    {
      ...baseRecord,
      variant: 'top_left',
      textBox: { x: leftX, y: topTextYResolved, width: textWidth, height: textHeight },
      alignment: alignments.top_left,
      brandBox: { x: leftX, y: topBrandY, width: brandWidth, height: brandHeight },
      backgroundAnchor: 'bottom_right',
      overlayDirection: 'top_left',
    },
    {
      ...baseRecord,
      variant: 'top_right',
      textBox: { x: rightX, y: topTextYResolved, width: textWidth, height: textHeight },
      alignment: alignments.top_right,
      brandBox: { x: rightBrandX, y: topBrandY, width: brandWidth, height: brandHeight },
      backgroundAnchor: 'bottom_left',
      overlayDirection: 'top_right',
    },
    {
      ...baseRecord,
      variant: 'bottom_center',
      textBox: {
        x: baseVariant === 'bottom_center' ? actualTextBox.x : centeredX,
        y: baseVariant === 'bottom_center' ? actualTextBox.y : bottomTextYResolved,
        width: textWidth,
        height: textHeight,
      },
      alignment: alignments.bottom_center,
      brandBox: {
        x: baseVariant === 'bottom_center' ? detectedBrandBox.x : centerBrandX,
        y: baseVariant === 'bottom_center' ? detectedBrandBox.y : bottomBrandYResolved,
        width: brandWidth,
        height: brandHeight,
      },
      backgroundAnchor: 'top',
      overlayDirection: 'bottom',
    },
    {
      ...baseRecord,
      variant: 'bottom_left',
      textBox: { x: leftX, y: bottomTextYResolved, width: textWidth, height: textHeight },
      alignment: alignments.bottom_left,
      brandBox: { x: leftX, y: bottomBrandYResolved, width: brandWidth, height: brandHeight },
      backgroundAnchor: 'top_right',
      overlayDirection: 'bottom_left',
    },
    {
      ...baseRecord,
      variant: 'bottom_right',
      textBox: { x: rightX, y: bottomTextYResolved, width: textWidth, height: textHeight },
      alignment: alignments.bottom_right,
      brandBox: { x: rightBrandX, y: bottomBrandYResolved, width: brandWidth, height: brandHeight },
      backgroundAnchor: 'top_left',
      overlayDirection: 'bottom_right',
    },
  ];

  return generated.map((entry) => ({
    ...entry,
    minFontSize: Math.round(baseFontSize * 0.64),
    maxFontSize: Math.round(baseFontSize),
    maxLines: 4,
  }));
}

function getLayerReferenceFromTemplate(
  template: DesignStudioTemplateRecord,
  logicalKey: keyof NonNullable<DesignStudioTemplateRecord['mappedLayers']>,
  options: { hasText?: boolean; group?: boolean } = {},
): DesignStudioLayerReference | undefined {
  const layers = Array.isArray(template.layerReferences)
    ? (template.layerReferences as DesignStudioLayerReference[])
    : [];
  const mappedName = template.mappedLayers?.[logicalKey];
  if (mappedName) {
    const normalizedMappedName = normalizeLayerName(mappedName);
    const exactMatch = layers.find((layer) => {
      if (options.hasText !== undefined && layer.hasText !== options.hasText) {
        return false;
      }
      if (options.group !== undefined && layer.group !== options.group) {
        return false;
      }
      return layer.normalizedName === normalizedMappedName;
    });
    if (exactMatch) {
      return exactMatch;
    }
  }
  return undefined;
}

function getTemplateVariantMetadata(template: DesignStudioTemplateRecord): {
  baseVariant: DesignStudioLayoutVariant;
  variants: DesignStudioVariantRecord[];
} {
  const headerLayer = getLayerReferenceFromTemplate(template, 'header_text', { hasText: true });
  const brandGroup = getLayerReferenceFromTemplate(template, 'brand_group', { group: true });
  const baseVariant = detectBaseVariant({
    width: template.width,
    height: template.height,
    headerLayer,
    brandGroup,
  });
  const templateBaseFontSize = Math.round(template.baseFontSize || REFERENCE_VARIANTS[baseVariant].baseFontSize || 96);
  const minFontSize = Math.max(36, Math.round(templateBaseFontSize * 0.62));
  const variants = (Object.values(REFERENCE_VARIANTS) as DesignStudioVariantRecord[]).map((variant) => ({
    ...variant,
    minFontSize,
    maxFontSize: templateBaseFontSize,
    lineHeightMultiplier: variant.lineHeightMultiplier ?? template.lineHeightMultiplier ?? 0.93,
    safeMargin: variant.safeMargin ?? template.safeMargin ?? 48,
  }));

  return { baseVariant, variants };
}

async function ensureTemplateStaticAssets(template: DesignStudioTemplateRecord): Promise<{
  brandOverlayUrl?: string;
  fadeOverlayUrl?: string;
}> {
  const existing = template.psdData?.staticAssets || {};
  if (existing.brandOverlayUrl || existing.fadeOverlayUrl) {
    return existing;
  }

  const psdUrl = typeof template.psdData?.fileUrl === 'string' ? template.psdData.fileUrl : '';
  if (!psdUrl) {
    return {};
  }

  try {
    const buffer = await fetchSourceBuffer(psdUrl);
    if (!buffer) {
      return {};
    }

    const staticAssets = await buildTemplateStaticAssetsFromPsd({
      buffer,
      fileName: `${template.name}.psd`,
    });
    if (!staticAssets.brandOverlayUrl && !staticAssets.fadeOverlayUrl) {
      return {};
    }

    template.psdData = {
      ...(template.psdData || {}),
      staticAssets,
    };

    const templates = await getTemplates();
    const nextTemplates = templates.map((entry) => (entry.id === template.id ? template : entry));
    await saveTemplates(nextTemplates);

    return staticAssets;
  } catch (error) {
    console.error('Failed to ensure template static assets:', error);
    return {};
  }
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

  const baseVariant = detectBaseVariant({
    width: psd.width,
    height: psd.height,
    headerLayer,
    brandGroup,
  });
  const variants = (Object.values(REFERENCE_VARIANTS) as DesignStudioVariantRecord[]).map((variant) => ({
    ...variant,
    minFontSize: Math.max(36, Math.round(baseFontSize * 0.62)),
    maxFontSize: Math.round(baseFontSize),
  }));
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
  const { baseVariant, variants } = getTemplateVariantMetadata(template);
  return variants.find((entry) => entry.variant === (variant || template.layoutVariant || baseVariant || template.baseVariant))
    || variants.find((entry) => entry.variant === baseVariant)
    || variants[0];
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function fetchBytesFromUrl(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), DESIGN_STUDIO_REMOTE_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Timed out while fetching a remote render asset');
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }

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
  const remoteUrl = await resolveRemoteTemplateUrl(value);
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

  const lineWidth = (lineWords: string[], fontSize: number): number =>
    estimateWordWidth(lineWords.join(' '), fontSize, input.tracking);

  const buildBalancedLines = (fontSize: number): string[] => {
    const bestByEnd = new Map<string, { lines: string[][]; score: number }>();
    bestByEnd.set('0:0', { lines: [], score: 0 });

    for (let end = 1; end <= words.length; end += 1) {
      for (let lineCount = 1; lineCount <= input.maxLines; lineCount += 1) {
        let best: { lines: string[][]; score: number } | null = null;

        for (let start = lineCount - 1; start < end; start += 1) {
          const previous = bestByEnd.get(`${start}:${lineCount - 1}`);
          if (!previous) {
            continue;
          }

          const lineWords = words.slice(start, end);
          const width = lineWidth(lineWords, fontSize);
          if (width > input.boxWidth && lineWords.length > 1) {
            continue;
          }

          const lineIndex = lineCount - 1;
          const isLastLine = end === words.length;
          const singletonPenalty = words.length > 2 && lineWords.length === 1
            ? (lineIndex > 0 && !isLastLine ? 1_000_000 : 120_000)
            : 0;
          const unusedRatio = clamp((input.boxWidth - Math.min(width, input.boxWidth)) / input.boxWidth, 0, 1);
          const wordTarget = words.length / Math.min(input.maxLines, Math.max(1, Math.ceil(words.length / 2)));
          const wordBalancePenalty = Math.abs(lineWords.length - wordTarget) * 18;
          const underfilledPenalty = unusedRatio * unusedRatio * 100;
          const score = previous.score + singletonPenalty + wordBalancePenalty + underfilledPenalty;
          const candidate = { lines: [...previous.lines, lineWords], score };

          if (!best || candidate.score < best.score) {
            best = candidate;
          }
        }

        if (best) {
          bestByEnd.set(`${end}:${lineCount}`, best);
        }
      }
    }

    const candidates = Array.from({ length: input.maxLines }, (_, index) => index + 1)
      .map((lineCount) => bestByEnd.get(`${words.length}:${lineCount}`))
      .filter((candidate): candidate is { lines: string[][]; score: number } => Boolean(candidate))
      .map((candidate) => {
        const widths = candidate.lines.map((lineWords) => lineWidth(lineWords, fontSize));
        const averageWidth = widths.reduce((sum, width) => sum + width, 0) / Math.max(1, widths.length);
        const widthVariance = widths.reduce((sum, width) => sum + Math.abs(width - averageWidth), 0);
        const middleSingletons = candidate.lines.filter((lineWords, index) =>
          lineWords.length === 1 && index > 0 && index < candidate.lines.length - 1,
        ).length;
        return {
          ...candidate,
          score: candidate.score + widthVariance * 0.08 + middleSingletons * 2_000_000,
        };
      });

    return candidates
      .sort((left, right) => left.score - right.score)[0]
      ?.lines.map((lineWords) => lineWords.join(' ')) || [];
  };

  const preferredMinFontSize = Math.max(input.minFontSize, Math.round(input.maxFontSize * 0.8));
  for (let fontSize = input.maxFontSize; fontSize >= preferredMinFontSize; fontSize -= 2) {
    const lines = buildBalancedLines(fontSize);
    const lineHeight = fontSize * input.lineHeightMultiplier;
    if (lines.length > 0 && lines.length <= input.maxLines && lines.length * lineHeight <= input.boxHeight) {
      return { fontSize, lines, lineHeight };
    }
  }

  for (let fontSize = preferredMinFontSize - 2; fontSize >= input.minFontSize; fontSize -= 2) {
    const lines = buildBalancedLines(fontSize);
    const lineHeight = fontSize * input.lineHeightMultiplier;
    if (lines.length > 0 && lines.length <= input.maxLines && lines.length * lineHeight <= input.boxHeight) {
      return { fontSize, lines, lineHeight };
    }
  }

  const fontSize = Math.max(input.minFontSize, preferredMinFontSize);
  const lineHeight = fontSize * input.lineHeightMultiplier;
  const lines = buildBalancedLines(fontSize).slice(0, input.maxLines);
  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    lines[lines.length - 1] = lastLine.length > 3 ? `${lastLine.slice(0, Math.max(0, lastLine.length - 3)).trim()}...` : lastLine;
  }
  return { fontSize, lines, lineHeight };
}

export async function buildTextLayer(input: {
  width: number;
  height: number;
  variant: DesignStudioVariantRecord;
  template: DesignStudioTemplateRecord;
  payload: DesignStudioRenderPayload;
}): Promise<Buffer> {
  const alignment = input.payload.headerAlignment || input.variant.alignment;
  const fontScale = input.payload.fontScale ?? 1;
  const headlineWidthScale = input.payload.headlineWidthScale ?? 1;
  const maxLines = input.payload.maxLines || input.variant.maxLines;
  const fontColor = input.payload.useTemplateDefaultStyling
    ? (input.template.fontColor || '#ffffff')
    : (input.payload.headerTextColor || input.template.fontColor || '#ffffff');
  const scaledBoxWidth = clamp(
    Math.round(input.variant.textBox.width * headlineWidthScale),
    Math.round(input.variant.textBox.width * 0.72),
    Math.round(input.width - ((input.variant.safeMargin || 48) * 2)),
  );
  const scaledTextBoxX = alignment === 'center'
    ? Math.round(input.variant.textBox.x + (input.variant.textBox.width - scaledBoxWidth) / 2)
    : alignment === 'right'
      ? Math.round(input.variant.textBox.x + input.variant.textBox.width - scaledBoxWidth)
      : input.variant.textBox.x;
  const fit = fitTextBlock({
    text: input.payload.headerText.toUpperCase(),
    boxWidth: scaledBoxWidth,
    boxHeight: input.variant.textBox.height,
    minFontSize: Math.round(input.variant.minFontSize * fontScale),
    maxFontSize: Math.round(input.variant.maxFontSize * fontScale),
    maxLines,
    lineHeightMultiplier: input.payload.lineHeightMultiplier
      || input.variant.lineHeightMultiplier
      || input.template.lineHeightMultiplier
      || 1.05,
    tracking: input.template.tracking || 0,
  });

  const totalTextHeight = Math.max(1, Math.ceil(fit.lines.length * fit.lineHeight));
  const top = input.variant.variant.startsWith('bottom')
    ? Math.round(input.variant.textBox.y + input.variant.textBox.height - totalTextHeight)
    : input.variant.textBox.y;

  const fontFamily = (input.template.fontFamily || 'PFDinTextCompPro').trim();
  const fontSize = Math.max(1, Math.round(fit.fontSize));
  const shadowOpacity = fontColor.toLowerCase() === '#000000' ? 0 : 0.24;
  const emptyLayer = sharp({
    create: {
      width: input.width,
      height: input.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  if (fit.lines.length === 0) {
    return emptyLayer.png().toBuffer();
  }

  const fontFile = fs.existsSync(DESIGN_STUDIO_HEADLINE_FONT_PATH)
    ? DESIGN_STUDIO_HEADLINE_FONT_PATH
    : undefined;
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];

  for (const [index, line] of fit.lines.entries()) {
    const lineTop = Math.round(top + (index * fit.lineHeight));
    const { data: renderedLine, info: renderedLineInfo } = await sharp({
      text: {
        text: line,
        rgba: true,
        align: alignment,
        width: scaledBoxWidth,
        dpi: Math.max(72, Math.round(fontSize * 7)),
        font: fontFamily,
        ...(fontFile ? { fontfile: fontFile } : {}),
      },
    }).png().toBuffer({ resolveWithObject: true });

    const lineLeft = alignment === 'center'
      ? Math.round(scaledTextBoxX + ((scaledBoxWidth - renderedLineInfo.width) / 2))
      : alignment === 'right'
        ? Math.round(scaledTextBoxX + scaledBoxWidth - renderedLineInfo.width)
        : scaledTextBoxX;

    if (shadowOpacity > 0) {
      const shadowLine = await sharp(await colorizeTextBuffer(renderedLine, '#000000', shadowOpacity))
        .blur(1.1)
        .png()
        .toBuffer();
      composites.push({
        input: shadowLine,
        left: lineLeft + 1,
        top: lineTop + 2,
      });
    }

    composites.push({
      input: await colorizeTextBuffer(renderedLine, fontColor),
      left: lineLeft,
      top: lineTop,
    });
  }

  return emptyLayer.composite(composites).png().toBuffer();
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

async function measureRegionLuminance(
  background: Buffer,
  box: { x: number; y: number; width: number; height: number },
): Promise<number> {
  const region = await sharp(background)
    .extract({
      left: Math.max(0, Math.round(box.x)),
      top: Math.max(0, Math.round(box.y)),
      width: Math.max(1, Math.round(box.width)),
      height: Math.max(1, Math.round(box.height)),
    })
    .resize(1, 1, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();

  const [red = 0, green = 0, blue = 0] = [...region];
  return ((0.2126 * red) + (0.7152 * green) + (0.0722 * blue)) / 255;
}

async function measureRegionStats(
  background: Buffer,
  box: { x: number; y: number; width: number; height: number },
): Promise<MeasuredRegionStats> {
  const sample = await sharp(background)
    .extract({
      left: Math.max(0, Math.round(box.x)),
      top: Math.max(0, Math.round(box.y)),
      width: Math.max(1, Math.round(box.width)),
      height: Math.max(1, Math.round(box.height)),
    })
    .resize(24, 24, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();

  const luminanceValues: number[] = [];
  for (let index = 0; index < sample.length; index += 3) {
    const red = sample[index] ?? 0;
    const green = sample[index + 1] ?? 0;
    const blue = sample[index + 2] ?? 0;
    luminanceValues.push(((0.2126 * red) + (0.7152 * green) + (0.0722 * blue)) / 255);
  }

  if (luminanceValues.length === 0) {
    return { luminance: 0, detail: 0 };
  }

  const averageLuminance = luminanceValues.reduce((sum, value) => sum + value, 0) / luminanceValues.length;
  const variance = luminanceValues.reduce((sum, value) => sum + ((value - averageLuminance) ** 2), 0) / luminanceValues.length;

  return {
    luminance: averageLuminance,
    detail: Math.sqrt(variance),
  };
}

async function resolveBrandBlockMode(
  background: Buffer,
  variant: DesignStudioVariantRecord,
  requestedMode?: 'auto' | 'black' | 'white',
): Promise<'black' | 'white'> {
  if (requestedMode === 'black' || requestedMode === 'white') {
    return requestedMode;
  }

  const luminance = await measureRegionLuminance(background, variant.brandBox);
  return luminance >= 0.58 ? 'black' : 'white';
}

function chooseHeaderTextColor(luminance: number): '#000000' | '#FFFFFF' {
  return luminance >= 0.6 ? '#000000' : '#FFFFFF';
}

function scoreAutoVariantCandidate(input: {
  variant: DesignStudioVariantRecord;
  textStats: MeasuredRegionStats;
  brandStats: MeasuredRegionStats;
  baseVariant: DesignStudioLayoutVariant;
  backgroundProfile?: 'photo' | 'logo_card';
}): DesignStudioAutoRenderPlan {
  const headerTextColor = chooseHeaderTextColor(input.textStats.luminance);
  const brandBlockMode = input.brandStats.luminance >= 0.58 ? 'black' : 'white';
  const overlayColor = headerTextColor === '#000000' ? '#FFFFFF' : '#000000';
  const overlayOpacity = input.backgroundProfile === 'logo_card'
    ? clamp(Math.round((input.textStats.detail + input.brandStats.detail) * 100), 0, 18)
    : 72;
  const fadeEnabled = input.backgroundProfile !== 'logo_card';
  const textContrast = headerTextColor === '#000000'
    ? input.textStats.luminance
    : (1 - input.textStats.luminance);
  const brandContrast = brandBlockMode === 'black'
    ? input.brandStats.luminance
    : (1 - input.brandStats.luminance);
  const baseVariantBonus = input.variant.variant === input.baseVariant ? 0.08 : 0;
  const score = (textContrast * 3.8)
    + (brandContrast * 1.25)
    - (input.textStats.detail * 2.4)
    - (input.brandStats.detail * 0.6)
    + baseVariantBonus;

  return {
    variant: input.variant.variant,
    overlayDirection: input.variant.overlayDirection,
    overlayColor,
    overlayOpacity,
    fadeEnabled,
    headerTextColor,
    brandBlockMode,
    score,
  };
}

async function resolveAutoEditorialRenderPlan(input: {
  template: DesignStudioTemplateRecord;
  backgroundImage?: string;
  cropMode?: DesignStudioRenderPayload['cropMode'];
  imageFocalPoint?: { x: number; y: number };
  imageZoom?: number;
  backgroundProfile?: 'photo' | 'logo_card';
}): Promise<DesignStudioAutoRenderPlan> {
  const { template, backgroundImage, cropMode, imageFocalPoint, imageZoom, backgroundProfile = 'photo' } = input;
  const { baseVariant, variants } = getTemplateVariantMetadata(template);
  const previewVariant = findVariant(template, baseVariant || template.layoutVariant);
  const background = await buildBackgroundLayer({
    width: template.width,
    height: template.height,
    source: backgroundImage,
    cropMode,
    backgroundAnchor: previewVariant.backgroundAnchor,
    focalPoint: imageFocalPoint,
    zoom: imageZoom,
  });

  const scored = await Promise.all(
    variants.map(async (variant) =>
      scoreAutoVariantCandidate({
        variant,
        textStats: await measureRegionStats(background, variant.textBox),
        brandStats: await measureRegionStats(background, variant.brandBox),
        baseVariant,
        backgroundProfile,
      }),
    ),
  );

  return scored.sort((left, right) => right.score - left.score)[0]
    || {
      variant: baseVariant,
      overlayDirection: previewVariant.overlayDirection,
      overlayColor: '#000000',
      overlayOpacity: backgroundProfile === 'logo_card' ? 0 : 72,
      fadeEnabled: backgroundProfile !== 'logo_card',
      headerTextColor: '#FFFFFF',
      brandBlockMode: 'white',
      score: 0,
    };
}

async function buildBrandLayer(
  width: number,
  height: number,
  variant: DesignStudioVariantRecord,
  brandMode: 'black' | 'white',
): Promise<Buffer> {
  const asset = readReferenceAssetBuffer(getReferenceBrandAssetPath(brandMode));
  const resized = await sharp(asset)
    .resize(Math.round(variant.brandBox.width || REFERENCE_BRAND_WIDTH), Math.round(variant.brandBox.height || REFERENCE_BRAND_HEIGHT), { fit: 'contain' })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: resized,
      left: Math.round(variant.brandBox.x),
      top: Math.round(variant.brandBox.y),
    }])
    .png()
    .toBuffer();
}

async function buildFadeLayer(width: number, height: number, opacity: number): Promise<Buffer> {
  const asset = readReferenceAssetBuffer(DESIGN_STUDIO_FADE_ASSET_PATH);
  const alphaChannel = await sharp(asset)
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .extractChannel('alpha')
    .linear(clamp(opacity, 0, 1), 0)
    .png()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .joinChannel(alphaChannel)
    .png()
    .toBuffer();
}

async function measureVisibleLogoLuminance(logoBuffer: Buffer): Promise<number> {
  const { data, info } = await sharp(logoBuffer)
    .ensureAlpha()
    .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let weightedLuminance = 0;
  let alphaTotal = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    const alpha = (data[index + 3] ?? 0) / 255;
    if (alpha < 0.08) {
      continue;
    }

    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    weightedLuminance += (((0.2126 * red) + (0.7152 * green) + (0.0722 * blue)) / 255) * alpha;
    alphaTotal += alpha;
  }

  return alphaTotal > 0 ? weightedLuminance / alphaTotal : 1;
}

async function buildDesignStudioLogoCardBackground(input: {
  source: string;
  width: number;
  height: number;
}): Promise<{ buffer: Buffer; logoMode: 'light_on_dark' | 'dark_on_light' }> {
  const source = await fetchSourceBuffer(input.source);
  if (!source) {
    throw new Error('Logo card render failed: missing logo source');
  }

  const logoLuminance = await measureVisibleLogoLuminance(source);
  const logoMode = logoLuminance >= 0.58 ? 'light_on_dark' : 'dark_on_light';
  const darkBackground = { r: 8, g: 10, b: 14 };
  const lightBackground = { r: 244, g: 246, b: 248 };
  const background = logoMode === 'light_on_dark' ? darkBackground : lightBackground;
  const accent = logoMode === 'light_on_dark'
    ? { r: 28, g: 34, b: 48, alpha: 0.52 }
    : { r: 220, g: 224, b: 232, alpha: 0.66 };
  const logo = await sharp(source)
    .ensureAlpha()
    .resize({
      width: Math.round(input.width * 0.52),
      height: Math.round(input.height * 0.16),
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logo).metadata();
  const logoLeft = Math.round((input.width - (logoMeta.width || 1)) / 2);
  const logoTop = Math.round((input.height - (logoMeta.height || 1)) / 2);
  const glowSize = Math.round(Math.min(input.width, input.height) * 0.72);
  const glow = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}">
      <radialGradient id="glow" cx="50%" cy="42%" r="50%">
        <stop offset="0%" stop-color="rgba(${accent.r},${accent.g},${accent.b},${accent.alpha})" />
        <stop offset="100%" stop-color="rgba(${accent.r},${accent.g},${accent.b},0)" />
      </radialGradient>
      <rect width="${input.width}" height="${input.height}" fill="url(#glow)" />
      <circle cx="${Math.round(input.width * 0.84)}" cy="${Math.round(input.height * 0.12)}" r="${Math.round(glowSize * 0.18)}" fill="rgba(${accent.r},${accent.g},${accent.b},0.18)" />
      <circle cx="${Math.round(input.width * 0.16)}" cy="${Math.round(input.height * 0.86)}" r="${Math.round(glowSize * 0.14)}" fill="rgba(${accent.r},${accent.g},${accent.b},0.14)" />
    </svg>
  `.trim());

  const buffer = await sharp({
    create: {
      width: input.width,
      height: input.height,
      channels: 3,
      background,
    },
  })
    .composite([
      { input: await sharp(glow).png().toBuffer(), left: 0, top: 0 },
      { input: logo, left: logoLeft, top: logoTop },
    ])
    .jpeg({ quality: 94, mozjpeg: true })
    .toBuffer();

  return { buffer, logoMode };
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
    const normalizedFocalX = (clamp(input.focalPoint?.x ?? 50, 0, 100) - 50) / 50;
    const normalizedFocalY = (clamp(input.focalPoint?.y ?? 50, 0, 100) - 50) / 50;
    const centeredLeft = (input.width - targetWidth) / 2;
    const centeredTop = (input.height - targetHeight) / 2;

    if (cropMode === 'contain') {
      const containRangeX = Math.max(0, input.width - targetWidth) / 2;
      const containRangeY = Math.max(0, input.height - targetHeight) / 2;
      const containLeft = clamp(
        Math.round(centeredLeft + (normalizedFocalX * containRangeX)),
        0,
        Math.max(0, input.width - targetWidth),
      );
      const containTop = clamp(
        Math.round(centeredTop + (normalizedFocalY * containRangeY)),
        0,
        Math.max(0, input.height - targetHeight),
      );
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

    const overflowX = Math.max(0, targetWidth - input.width);
    const overflowY = Math.max(0, targetHeight - input.height);
    const coverLeft = clamp(
      Math.round(centeredLeft - (normalizedFocalX * (overflowX / 2))),
      input.width - targetWidth,
      0,
    );
    const coverTop = clamp(
      Math.round(centeredTop - (normalizedFocalY * (overflowY / 2))),
      input.height - targetHeight,
      0,
    );
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

export async function renderDesignStudioImage(
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

  const textOverlay = await buildTextLayer({ width, height, variant, template, payload });
  const overlayColor = payload.overlayColor || '#000000';
  const overlayStrength = clamp((payload.overlayOpacity ?? 72) / 100, 0, 1);
  const overlay = buildOverlaySvg({
    width,
    height,
    color: overlayColor,
    strength: overlayStrength,
    direction: payload.gradientPosition || variant.overlayDirection,
    overlayType: payload.overlayType || 'linear',
  });
  const fadeEnabled = payload.fadeEnabled ?? variant.fadeDefaultEnabled ?? true;
  const fadeOpacity = payload.fadeOpacity ?? variant.fadeDefaultOpacity ?? 0.9;
  const brandMode = await resolveBrandBlockMode(background, variant, payload.brandBlockMode);

  const composites: Array<{ input: Buffer }> = [
    { input: await sharp(overlay).resize(width, height, { fit: 'fill' }).png().toBuffer() },
  ];

  if (fadeEnabled) {
    composites.push({ input: await buildFadeLayer(width, height, fadeOpacity) });
  }

  composites.push({ input: await sharp(textOverlay).resize(width, height, { fit: 'fill' }).png().toBuffer() });
  composites.push({ input: await buildBrandLayer(width, height, variant, brandMode) });

  const { format, jpegQuality } = await getRenderExportSettings(payload.exportFormat);
  const pipeline = sharp(background).composite(composites);

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
    const [backgroundMeta, compositeMeta] = await Promise.all([
      sharp(background).metadata(),
      Promise.all(composites.map((entry) => sharp(entry.input).metadata())),
    ]);
    throw new Error(
      `Render composite failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      } | background=${backgroundMeta.width}x${backgroundMeta.height} composites=${compositeMeta.map((meta) => `${meta.width}x${meta.height}`).join(',')}`,
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

function isPosterDrivenDesignStudioStory(item: RSSActivityItem, matchedKeyword?: string): boolean {
  const haystack = [
    item.title,
    item.description || '',
    stripHtml(item.contentHtml || ''),
    matchedKeyword || '',
  ].join(' ');

  return /\b(?:poster|key art|one[-\s]?sheet|character poster|teaser poster|first look poster)\b/i.test(haystack);
}

function scoreDesignStudioCleanArtCandidate(input: {
  item: RSSActivityItem;
  candidate: DesignStudioAutoBackgroundCandidate;
  matchedKeyword?: string;
}): DesignStudioAutoBackgroundSelection | null {
  const url = input.candidate.url.trim();
  if (!url) {
    return null;
  }

  const descriptor = [
    input.candidate.reason || '',
    input.item.imageReason || '',
    url,
  ].join(' ');
  const posterDrivenStory = isPosterDrivenDesignStudioStory(input.item, input.matchedKeyword);
  const textlessPosterSignal = /\b(?:textless|no text|without text|clean poster|clean key art|art only|art-only)\b/i.test(descriptor);
  const posterSignal = /\b(?:poster|key art|one[-\s]?sheet|cover art|dvd cover|blu ray cover)\b/i.test(descriptor);
  const cleanBackdropSignal = /\b(?:backdrop|still|production still|character still|official image|official photo|tmdb backdrop|tmdb still)\b/i.test(descriptor);
  const logoSignal = /\b(?:company logo|network logo|studio logo|streaming service logo|platform logo|distributor logo)\b/i.test(descriptor);
  const textHeavySignal = /\b(?:logo card|rendered as logo card|watermark|lower third|headline|caption|subtitle|thumbnail|outlet thumbnail|publisher bug|network bug|exclusive banner|article card|social card|screengrab|screenshot)\b/i.test(descriptor);

  if (logoSignal) {
    const isTmdbLogo = input.candidate.source === 'tmdb' || /image\.tmdb\.org/i.test(url);
    if (!isTmdbLogo) {
      return null;
    }

    return {
      url,
      reason: input.candidate.reason || 'Design Studio logo-card candidate',
      source: input.candidate.source,
      role: 'logo_card',
      score: 82 + (typeof input.candidate.score === 'number' ? clamp(input.candidate.score / 10, 0, 10) : 0),
    };
  }

  if (textHeavySignal && !textlessPosterSignal) {
    return null;
  }

  if (posterSignal && !textlessPosterSignal) {
    return null;
  }

  const isTmdb = input.candidate.source === 'tmdb' || /image\.tmdb\.org/i.test(url);
  const isVerifiedCleanArt = cleanBackdropSignal || textlessPosterSignal || (isTmdb && !posterSignal);
  if (!isVerifiedCleanArt) {
    return null;
  }

  let score = 40;
  if (isTmdb) score += 22;
  if (cleanBackdropSignal) score += 28;
  if (textlessPosterSignal) score += posterDrivenStory ? 20 : 8;
  if (input.candidate.source === 'feed') score -= 18;
  if (typeof input.candidate.score === 'number') score += clamp(input.candidate.score / 8, 0, 12);

  return {
    url,
    reason: input.candidate.reason || 'Design Studio clean visual candidate',
    source: input.candidate.source,
    role: 'clean_art',
    score,
  };
}

function selectDesignStudioAutoBackgroundSource(
  item: RSSActivityItem,
  matchedKeyword?: string,
): DesignStudioAutoBackgroundSelection | null {
  const candidates: DesignStudioAutoBackgroundCandidate[] = [];
  const seen = new Set<string>();
  const addCandidate = (candidate: DesignStudioAutoBackgroundCandidate | null | undefined) => {
    const url = candidate?.url?.trim();
    if (!url || seen.has(url)) {
      return;
    }
    seen.add(url);
    candidates.push({ ...candidate, url });
  };

  for (const image of item.selectedImages || []) {
    addCandidate({
      url: image.url,
      reason: image.reason,
      source: image.source,
      score: image.score,
    });
  }

  addCandidate({
    url: item.imageUrl || '',
    reason: item.imageReason,
    source: item.imageSource,
    score: item.imageScore,
  });

  for (const url of item.imageUrls || []) {
    addCandidate({
      url,
      reason: 'Feed fallback image',
      source: 'feed',
    });
  }

  return candidates
    .map((candidate) => scoreDesignStudioCleanArtCandidate({ item, candidate, matchedKeyword }))
    .filter((candidate): candidate is DesignStudioAutoBackgroundSelection => Boolean(candidate))
    .sort((left, right) => right.score - left.score)[0] || null;
}

async function resolveDesignStudioAutoRenderBackground(input: {
  selection: DesignStudioAutoBackgroundSelection;
  template: DesignStudioTemplateRecord;
  index: number;
}): Promise<{ source: string; profile: 'photo' | 'logo_card' }> {
  if (input.selection.role !== 'logo_card') {
    return { source: input.selection.url, profile: 'photo' };
  }

  const logoCard = await buildDesignStudioLogoCardBackground({
    source: input.selection.url,
    width: input.template.width,
    height: input.template.height,
  });
  const uploaded = await uploadBufferToBackblaze(
    logoCard.buffer,
    `${input.template.name.replace(/[^a-z0-9-]+/gi, '-')}-auto-logo-card-${Date.now()}-${input.index}.jpg`,
    {
      bucketTypes: ['design', 'general'],
      prefix: 'design-studio/backgrounds',
      contentType: 'image/jpeg',
    },
  );

  return { source: uploaded.url, profile: 'logo_card' };
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function evaluateAutoEditorialNarrativeEligibility(
  item: RSSActivityItem,
  matchedKeyword?: string,
): { eligible: boolean; reason?: string } {
  const haystack = [
    item.title,
    item.description || '',
    stripHtml(item.contentHtml || ''),
    item.feedName || '',
    matchedKeyword || '',
  ].join(' ');

  for (const blocked of DESIGN_STUDIO_NON_NARRATIVE_PATTERNS) {
    if (blocked.pattern.test(haystack)) {
      return { eligible: false, reason: blocked.reason };
    }
  }

  const hasNarrativeTmdbSignal = item.imageSource === 'tmdb'
    || Boolean(item.selectedImages?.some((image) => image.source === 'tmdb'));

  if (hasNarrativeTmdbSignal) {
    return { eligible: true };
  }

  if (DESIGN_STUDIO_SCRIPTED_INDICATOR_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return { eligible: true };
  }

  return {
    eligible: false,
    reason: 'Item does not clearly match scripted narrative film or TV coverage',
  };
}

export const __designStudioAutoTestUtils = {
  evaluateAutoEditorialNarrativeEligibility,
  resolveAutoEditorialRenderPlan,
  selectDesignStudioAutoBackgroundSource,
  buildDesignStudioLogoCardBackground,
};

export const __designStudioRenderTestUtils = {
  buildBackgroundLayer,
  fitTextBlock,
};

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
    await withTimeout((async () => {
      const activeVariant = input.data.template_variant || getTemplateVariantMetadata(template).baseVariant || 'bottom_center';
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
        headerText: input.data.headerText,
        renderJobId: jobId,
        variant: renderedDesign.templateVariant,
        previewUrl: renderedDesign.previewUrl,
        outputUrl: renderedDesign.outputUrl,
        exportFormat: renderedDesign.exportFormat,
      });
    })(), DESIGN_STUDIO_RENDER_TIMEOUT_MS, 'Manual design render timed out after 3 minutes');
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
  const staticAssets = await buildTemplateStaticAssetsFromPsd({
    buffer: input.buffer,
    fileName: input.fileName,
  });
  template.psdData = {
    ...(template.psdData || {}),
    staticAssets,
  };
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
      const eligibility = evaluateAutoEditorialNarrativeEligibility(item, matchedKeyword);
      if (!eligibility.eligible) {
        return null;
      }
      const backgroundSelection = selectDesignStudioAutoBackgroundSource(item, matchedKeyword);
      if (!backgroundSelection) {
        return null;
      }
      const backgroundSource = backgroundSelection.url;
      const score = deriveEditorialScore(item.title, matchedKeyword, Boolean(backgroundSource));
      if (score < settings.minimumScoreThreshold) {
        return null;
      }
      return { item, matchedKeyword, backgroundSource, backgroundSelection, score };
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
    const contentType = getContentTypeForKeyword(candidate.matchedKeyword);
    const headerText = deriveHeaderText(candidate.item.title);
    const subtext = deriveSubtext(candidate.item.feedName, candidate.matchedKeyword);
    const captions = await buildCaptionPayload(headerText, subtext, contentType, settings);

    try {
      const renderBackground = await resolveDesignStudioAutoRenderBackground({
        selection: candidate.backgroundSelection,
        template,
        index,
      });
      const autoPlan = await resolveAutoEditorialRenderPlan({
        template,
        backgroundImage: renderBackground.source,
        cropMode: 'cover',
        backgroundProfile: renderBackground.profile,
      });

      const rendered = await renderDesignStudioImage(template, {
        template_variant: autoPlan.variant,
        headerText,
        subtext,
        backgroundImage: renderBackground.source,
        headerTextColor: autoPlan.headerTextColor,
        overlayColor: autoPlan.overlayColor,
        overlayOpacity: autoPlan.overlayOpacity,
        gradientPosition: autoPlan.overlayDirection,
        cropMode: 'cover',
        fadeEnabled: autoPlan.fadeEnabled,
        fadeOpacity: autoPlan.fadeEnabled ? 90 : 0,
        brandBlockMode: autoPlan.brandBlockMode,
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
        templateVariant: autoPlan.variant,
        renderedImage: uploaded.url,
        headerText,
        subheaderText: subtext,
        contentType,
        caption: captions.shared_caption,
        captions,
        backgroundSource: renderBackground.source,
        backgroundOffsetX: 50,
        backgroundOffsetY: 50,
        zoomLevel: 1,
        headerTextColor: autoPlan.headerTextColor,
        brandBlockMode: autoPlan.brandBlockMode,
        overlayColor: autoPlan.overlayColor,
        overlayDirection: autoPlan.overlayDirection,
        overlayStrength: autoPlan.overlayOpacity,
        fadeEnabled: autoPlan.fadeEnabled,
        fadeOpacity: autoPlan.fadeEnabled ? 90 : 0,
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
