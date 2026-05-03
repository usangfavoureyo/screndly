import { createHash } from 'crypto';
import sharp from 'sharp';
import { uploadBufferToBackblaze } from './backblaze';

type LogoCardIntent = 'logo' | 'brand_backdrop';
type LogoRenderPolicyInput = {
  intent: LogoCardIntent;
  canonicalEntityType?: 'movie' | 'tv' | 'person' | 'character' | 'franchise' | 'company' | 'platform' | 'unknown';
  primarySubjectName?: string;
  visualSubject?: string;
  allowAsPrimary?: boolean;
};

type RGB = { r: number; g: number; b: number };
type LogoBounds = { left: number; top: number; width: number; height: number };
export type TMDbLogoCardDiagnostics = {
  accent: RGB;
  accentHex: string;
  logoAspectRatio: number;
  contrastRatio: number;
  chosenCanvas: '1:1' | '16:9';
  dimensions: {
    width: number;
    height: number;
    maxWidth: number;
    maxHeight: number;
  };
  background: {
    start: RGB;
    end: RGB;
    startHex: string;
    endHex: string;
  };
};

const LIGHT_DEFAULT: RGB = { r: 245, g: 245, b: 242 };
const BACKGROUND_CANDIDATES: RGB[] = [
  { r: 8, g: 8, b: 10 },     // black
  { r: 14, g: 14, b: 16 },   // off-black
  { r: 34, g: 34, b: 38 },   // dark gray
  { r: 56, g: 56, b: 60 },   // gray
  { r: 228, g: 228, b: 224 }, // off-white
  { r: 245, g: 245, b: 242 }, // light
  { r: 255, g: 255, b: 255 }, // white
];
const TRANSPARENT_BACKGROUND = { r: 0, g: 0, b: 0, alpha: 0 };
const LOGO_ALPHA_BORDER_THRESHOLD = 14;
const LOGO_NEAR_WHITE_THRESHOLD = 242;
const LOGO_COLOR_VARIANCE_THRESHOLD = 20;
const LOGO_BORDER_ROW_RATIO = 0.985;
const LOGO_BORDER_COLUMN_RATIO = 0.985;
const LOGO_MAX_TRIM_RATIO = 0.35;
const LOGO_LOW_CONTRAST_RATIO = 4.0;
const LOGO_WIDE_RATIO = 1.9;
const LOGO_VISIBLE_ALPHA_THRESHOLD = 36;
const LOGO_STRONG_ALPHA_THRESHOLD = 168;
const DARK_SURFACE_CANDIDATES: RGB[] = BACKGROUND_CANDIDATES.slice(0, 4);
const LIGHT_SURFACE_CANDIDATES: RGB[] = BACKGROUND_CANDIDATES.slice(4);
const LOGO_DARK_BIAS_CONTRAST_TOLERANCE = 1.25;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mixColor(base: RGB, accent: RGB, ratio: number): RGB {
  return {
    r: Math.round(base.r + (accent.r - base.r) * ratio),
    g: Math.round(base.g + (accent.g - base.g) * ratio),
    b: Math.round(base.b + (accent.b - base.b) * ratio),
  };
}

function rgbToHex(color: RGB): string {
  return `#${[color.r, color.g, color.b]
    .map((value) => clamp(value, 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function srgbToLinear(channel: number): number {
  const normalized = clamp(channel, 0, 255) / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(color: RGB): number {
  const r = srgbToLinear(color.r);
  const g = srgbToLinear(color.g);
  const b = srgbToLinear(color.b);
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

function getContrastRatio(colorA: RGB, colorB: RGB): number {
  const lumA = getRelativeLuminance(colorA);
  const lumB = getRelativeLuminance(colorB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function getLuminance(color: RGB): number {
  return (0.2126 * color.r) + (0.7152 * color.g) + (0.0722 * color.b);
}

function rgbToHsl(color: RGB): { h: number; s: number; l: number } {
  const red = clamp(color.r, 0, 255) / 255;
  const green = clamp(color.g, 0, 255) / 255;
  const blue = clamp(color.b, 0, 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  switch (max) {
    case red:
      hue = ((green - blue) / delta) + (green < blue ? 6 : 0);
      break;
    case green:
      hue = ((blue - red) / delta) + 2;
      break;
    default:
      hue = ((red - green) / delta) + 4;
      break;
  }

  return { h: hue * 60, s: saturation, l: lightness };
}

function isDarkSurface(color: RGB): boolean {
  return getRelativeLuminance(color) < 0.22;
}

function detectLogoColorFamily(accent: RGB): 'red' | 'yellow' | 'blue_purple' | 'gray' | 'light' | 'dark' | 'other' {
  const { h, s, l } = rgbToHsl(accent);

  if (s < 0.14) {
    if (l >= 0.72) return 'light';
    if (l <= 0.24) return 'dark';
    return 'gray';
  }

  if (h <= 24 || h >= 336) {
    return 'red';
  }

  if (h >= 42 && h <= 72) {
    return 'yellow';
  }

  if (h >= 190 && h <= 285) {
    return 'blue_purple';
  }

  if (h >= 190 && h <= 245 && s <= 0.24) {
    return 'gray';
  }

  if (l >= 0.76) {
    return 'light';
  }

  if (l <= 0.22) {
    return 'dark';
  }

  return 'other';
}

function pickHighestContrastCandidate(accent: RGB, candidates: RGB[]): { color: RGB; contrast: number } {
  let best = candidates[0];
  let bestContrast = 0;

  for (const candidate of candidates) {
    const contrast = getContrastRatio(accent, candidate);
    if (contrast > bestContrast) {
      best = candidate;
      bestContrast = contrast;
    }
  }

  return { color: best, contrast: bestContrast };
}

function pickBestBackgroundColor(accent: RGB): { color: RGB; contrast: number } {
  const colorFamily = detectLogoColorFamily(accent);
  const bestDark = pickHighestContrastCandidate(accent, DARK_SURFACE_CANDIDATES);
  const bestLight = pickHighestContrastCandidate(accent, LIGHT_SURFACE_CANDIDATES);
  const { l } = rgbToHsl(accent);

  if (colorFamily === 'red' || colorFamily === 'yellow' || colorFamily === 'blue_purple' || colorFamily === 'gray') {
    if ((bestLight.contrast - bestDark.contrast) <= LOGO_DARK_BIAS_CONTRAST_TOLERANCE) {
      return bestDark;
    }
    return bestLight;
  }

  if (colorFamily === 'light') {
    return bestDark;
  }

  if (colorFamily === 'dark') {
    return bestLight;
  }

  if (l >= 0.48 && bestDark.contrast >= 3) {
    return bestDark;
  }

  return bestLight.contrast > bestDark.contrast ? bestLight : bestDark;
}

function buildLogoBackground(
  accent: RGB,
  intent: LogoCardIntent,
): { start: RGB; end: RGB; contrast: number; base: RGB } {
  const pick = pickBestBackgroundColor(accent);
  const base = pick.color;
  const prefersDark = isDarkSurface(base);
  const accentMix = prefersDark
    ? (intent === 'brand_backdrop' ? 0.18 : 0.12)
    : (intent === 'brand_backdrop' ? 0.14 : 0.08);

  return {
    start: mixColor(base, accent, accentMix),
    end: prefersDark
      ? mixColor(base, LIGHT_DEFAULT, intent === 'brand_backdrop' ? 0.08 : 0.05)
      : mixColor(base, { r: 215, g: 215, b: 210 }, intent === 'brand_backdrop' ? 0.12 : 0.08),
    contrast: pick.contrast,
    base,
  };
}

function chooseLogoCardDimensions(
  intent: LogoCardIntent,
  logoAspectRatio: number,
  contrastRatio: number,
): { width: number; height: number; maxWidth: number; maxHeight: number } {
  if (intent === 'brand_backdrop' || logoAspectRatio >= LOGO_WIDE_RATIO || contrastRatio < LOGO_LOW_CONTRAST_RATIO) {
    if (logoAspectRatio >= 3.4) {
      return { width: 1600, height: 900, maxWidth: 820, maxHeight: 190 };
    }

    if (logoAspectRatio >= 2.2) {
      return { width: 1600, height: 900, maxWidth: 780, maxHeight: 220 };
    }

    return { width: 1600, height: 900, maxWidth: 700, maxHeight: 250 };
  }

  if (logoAspectRatio >= 1.35) {
    return { width: 1200, height: 1200, maxWidth: 620, maxHeight: 300 };
  }

  return { width: 1200, height: 1200, maxWidth: 520, maxHeight: 360 };
}

function getLogoCardPadding(
  canvasWidth: number,
  canvasHeight: number,
  logoAspectRatio: number,
): { paddingX: number; paddingY: number } {
  if (canvasWidth > canvasHeight) {
    const paddingX = logoAspectRatio >= 3.4
      ? Math.round(canvasWidth * 0.18)
      : logoAspectRatio >= 2.2
        ? Math.round(canvasWidth * 0.16)
        : Math.round(canvasWidth * 0.14);
    const paddingY = logoAspectRatio >= 3.4
      ? Math.round(canvasHeight * 0.26)
      : Math.round(canvasHeight * 0.22);

    return {
      paddingX: clamp(paddingX, 180, 320),
      paddingY: clamp(paddingY, 140, 250),
    };
  }

  const paddingX = logoAspectRatio >= 1.35
    ? Math.round(canvasWidth * 0.16)
    : Math.round(canvasWidth * 0.18);
  const paddingY = logoAspectRatio >= 1.35
    ? Math.round(canvasHeight * 0.18)
    : Math.round(canvasHeight * 0.2);

  return {
    paddingX: clamp(paddingX, 150, 240),
    paddingY: clamp(paddingY, 170, 260),
  };
}

function buildBackdropLogoSurface(accent: RGB): { fill: RGB; edge: RGB; border: RGB } {
  const pick = pickBestBackgroundColor(accent);
  const darkSurface = isDarkSurface(pick.color);
  const fill = mixColor(pick.color, accent, darkSurface ? 0.12 : 0.08);
  const edge = darkSurface
    ? mixColor(pick.color, LIGHT_DEFAULT, 0.1)
    : mixColor(pick.color, { r: 220, g: 220, b: 214 }, 0.14);
  const border = darkSurface
    ? mixColor(fill, LIGHT_DEFAULT, 0.16)
    : mixColor(fill, { r: 186, g: 186, b: 180 }, 0.24);

  return { fill, edge, border };
}

async function buildTMDbLogoCardDiagnostics(
  originalBuffer: Buffer,
  intent: LogoCardIntent,
): Promise<{ trimmedBuffer: Buffer; diagnostics: TMDbLogoCardDiagnostics }> {
  const trimmedBuffer = await trimTMDbLogoOuterBorderBuffer(originalBuffer);
  const accent = await analyzeVisibleColor(trimmedBuffer);
  const logoMetadata = await sharp(trimmedBuffer, { animated: false }).metadata();
  const logoWidth = Math.max(1, logoMetadata.width ?? 1);
  const logoHeight = Math.max(1, logoMetadata.height ?? 1);
  const logoAspectRatio = logoWidth / logoHeight;
  const background = buildLogoBackground(accent, intent);
  const dimensions = chooseLogoCardDimensions(intent, logoAspectRatio, background.contrast);

  return {
    trimmedBuffer,
    diagnostics: {
      accent,
      accentHex: rgbToHex(accent),
      logoAspectRatio,
      contrastRatio: background.contrast,
      chosenCanvas: dimensions.width > dimensions.height ? '16:9' : '1:1',
      dimensions,
      background: {
        start: background.start,
        end: background.end,
        startHex: rgbToHex(background.start),
        endHex: rgbToHex(background.end),
      },
    },
  };
}

async function fetchBuffer(sourceUrl: string): Promise<Buffer> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch logo asset: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function analyzeVisibleColor(buffer: Buffer): Promise<RGB> {
  const { data, info } = await sharp(buffer, { animated: false })
    .ensureAlpha()
    .resize({ width: 160, height: 160, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let weightedR = 0;
  let weightedG = 0;
  let weightedB = 0;
  let totalWeight = 0;
  let strongWeightedR = 0;
  let strongWeightedG = 0;
  let strongWeightedB = 0;
  let strongTotalWeight = 0;

  for (let index = 0; index < data.length; index += info.channels) {
    const alpha = data[index + 3] ?? 255;
    if (alpha < LOGO_VISIBLE_ALPHA_THRESHOLD) {
      continue;
    }

    const normalizedAlpha = alpha / 255;
    const weight = normalizedAlpha * normalizedAlpha;
    weightedR += (data[index] ?? 0) * weight;
    weightedG += (data[index + 1] ?? 0) * weight;
    weightedB += (data[index + 2] ?? 0) * weight;
    totalWeight += weight;

    if (alpha >= LOGO_STRONG_ALPHA_THRESHOLD) {
      strongWeightedR += (data[index] ?? 0) * weight;
      strongWeightedG += (data[index + 1] ?? 0) * weight;
      strongWeightedB += (data[index + 2] ?? 0) * weight;
      strongTotalWeight += weight;
    }
  }

  if (strongTotalWeight > 0) {
    return {
      r: Math.round(strongWeightedR / strongTotalWeight),
      g: Math.round(strongWeightedG / strongTotalWeight),
      b: Math.round(strongWeightedB / strongTotalWeight),
    };
  }

  if (totalWeight <= 0) {
    return { ...LIGHT_DEFAULT };
  }

  return {
    r: Math.round(weightedR / totalWeight),
    g: Math.round(weightedG / totalWeight),
    b: Math.round(weightedB / totalWeight),
  };
}

async function trimLogoBuffer(originalBuffer: Buffer): Promise<Buffer> {
  const transparentlyTrimmed = await sharp(originalBuffer, { animated: false })
    .ensureAlpha()
    .trim({ background: TRANSPARENT_BACKGROUND, threshold: 8 })
    .png()
    .toBuffer();

  const transparentMetadata = await sharp(transparentlyTrimmed, { animated: false }).metadata();
  const whiteBorderTrimmed = await sharp(transparentlyTrimmed, { animated: false })
    .trim({
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      threshold: 12,
    })
    .png()
    .toBuffer();
  const whiteTrimMetadata = await sharp(whiteBorderTrimmed, { animated: false }).metadata();

  const transparentWidth = transparentMetadata.width ?? 0;
  const transparentHeight = transparentMetadata.height ?? 0;
  const whiteTrimWidth = whiteTrimMetadata.width ?? transparentWidth;
  const whiteTrimHeight = whiteTrimMetadata.height ?? transparentHeight;
  const widthDelta = transparentWidth > 0 ? (transparentWidth - whiteTrimWidth) / transparentWidth : 0;
  const heightDelta = transparentHeight > 0 ? (transparentHeight - whiteTrimHeight) / transparentHeight : 0;

  // Remove only a shallow white matte/frame so we don't cut into legitimate white logo artwork.
  if (widthDelta <= 0.12 && heightDelta <= 0.12) {
    return whiteBorderTrimmed;
  }

  return transparentlyTrimmed;
}

function isNearWhiteBorderPixel(red: number, green: number, blue: number, alpha: number): boolean {
  if (alpha <= LOGO_ALPHA_BORDER_THRESHOLD) {
    return true;
  }

  const minChannel = Math.min(red, green, blue);
  const maxChannel = Math.max(red, green, blue);
  return minChannel >= LOGO_NEAR_WHITE_THRESHOLD && (maxChannel - minChannel) <= LOGO_COLOR_VARIANCE_THRESHOLD;
}

function isBorderRow(
  data: Buffer,
  width: number,
  height: number,
  y: number,
): boolean {
  let borderPixels = 0;

  for (let x = 0; x < width; x += 1) {
    const index = ((y * width) + x) * 4;
    if (isNearWhiteBorderPixel(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0, data[index + 3] ?? 0)) {
      borderPixels += 1;
    }
  }

  return (borderPixels / Math.max(1, width)) >= LOGO_BORDER_ROW_RATIO;
}

function isBorderColumn(
  data: Buffer,
  width: number,
  height: number,
  x: number,
): boolean {
  let borderPixels = 0;

  for (let y = 0; y < height; y += 1) {
    const index = ((y * width) + x) * 4;
    if (isNearWhiteBorderPixel(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0, data[index + 3] ?? 0)) {
      borderPixels += 1;
    }
  }

  return (borderPixels / Math.max(1, height)) >= LOGO_BORDER_COLUMN_RATIO;
}

function detectLogoContentBounds(
  data: Buffer,
  width: number,
  height: number,
): LogoBounds | null {
  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  while (top < height && isBorderRow(data, width, height, top)) {
    top += 1;
  }

  while (bottom > top && isBorderRow(data, width, height, bottom)) {
    bottom -= 1;
  }

  while (left < width && isBorderColumn(data, width, height, left)) {
    left += 1;
  }

  while (right > left && isBorderColumn(data, width, height, right)) {
    right -= 1;
  }

  if (left >= right || top >= bottom) {
    return null;
  }

  const trimmedWidth = right - left + 1;
  const trimmedHeight = bottom - top + 1;
  const trimLeftRatio = left / Math.max(1, width);
  const trimRightRatio = (width - 1 - right) / Math.max(1, width);
  const trimTopRatio = top / Math.max(1, height);
  const trimBottomRatio = (height - 1 - bottom) / Math.max(1, height);

  if (
    trimLeftRatio > LOGO_MAX_TRIM_RATIO ||
    trimRightRatio > LOGO_MAX_TRIM_RATIO ||
    trimTopRatio > LOGO_MAX_TRIM_RATIO ||
    trimBottomRatio > LOGO_MAX_TRIM_RATIO
  ) {
    return null;
  }

  return {
    left,
    top,
    width: trimmedWidth,
    height: trimmedHeight,
  };
}

async function stripEdgeConnectedWhiteMatte(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer, { animated: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const enqueueIfBorderPixel = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) {
      return;
    }

    const dataIndex = pixelIndex * 4;
    if (!isNearWhiteBorderPixel(
      data[dataIndex] ?? 0,
      data[dataIndex + 1] ?? 0,
      data[dataIndex + 2] ?? 0,
      data[dataIndex + 3] ?? 0
    )) {
      return;
    }

    visited[pixelIndex] = 1;
    queue.push(pixelIndex);
  };

  for (let x = 0; x < width; x += 1) {
    enqueueIfBorderPixel(x, 0);
    enqueueIfBorderPixel(x, height - 1);
  }

  for (let y = 0; y < height; y += 1) {
    enqueueIfBorderPixel(0, y);
    enqueueIfBorderPixel(width - 1, y);
  }

  // Clear only white matte that is physically connected to the outer edge,
  // so interior white logo artwork stays intact.
  while (queue.length > 0) {
    const pixelIndex = queue.shift()!;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const dataIndex = pixelIndex * 4;
    data[dataIndex + 3] = 0;

    enqueueIfBorderPixel(x - 1, y);
    enqueueIfBorderPixel(x + 1, y);
    enqueueIfBorderPixel(x, y - 1);
    enqueueIfBorderPixel(x, y + 1);
  }

  return sharp(data, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

export async function trimTMDbLogoOuterBorderBuffer(originalBuffer: Buffer): Promise<Buffer> {
  const base = await trimLogoBuffer(originalBuffer);
  const edgeCleaned = await stripEdgeConnectedWhiteMatte(base);
  const { data, info } = await sharp(edgeCleaned, { animated: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bounds = detectLogoContentBounds(data, info.width, info.height);
  if (!bounds) {
    return edgeCleaned;
  }

  return sharp(edgeCleaned, { animated: false })
    .extract(bounds)
    .png()
    .toBuffer();
}

export async function prepareTMDbLogoAsset(sourceUrl: string): Promise<string> {
  const originalBuffer = await fetchBuffer(sourceUrl);
  const trimmedBuffer = await trimTMDbLogoOuterBorderBuffer(originalBuffer);
  const hash = createHash('sha1')
    .update(sourceUrl)
    .update('trimmed-logo')
    .digest('hex')
    .slice(0, 12);

  const uploaded = await uploadBufferToBackblaze(
    trimmedBuffer,
    `${hash}-trimmed-logo.png`,
    {
      bucketTypes: ['general', 'design'],
      prefix: 'tmdb/logo-assets',
      contentType: 'image/png',
    }
  );

  return uploaded.url;
}

function buildGradientSvg(width: number, height: number, start: RGB, end: RGB): Buffer {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${rgbToHex(start)}" />
          <stop offset="100%" stop-color="${rgbToHex(end)}" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="${Math.round(width * 0.06)}" fill="url(#bg)" />
    </svg>
  `;

  return Buffer.from(svg);
}

export async function renderTMDbLogoCard(
  sourceUrl: string,
  intent: LogoCardIntent
): Promise<string> {
  const originalBuffer = await fetchBuffer(sourceUrl);
  const { trimmedBuffer, diagnostics } = await buildTMDbLogoCardDiagnostics(originalBuffer, intent);
  const { background, dimensions } = diagnostics;
  const padding = getLogoCardPadding(
    dimensions.width,
    dimensions.height,
    diagnostics.logoAspectRatio,
  );
  const safeWidth = Math.max(1, dimensions.width - (padding.paddingX * 2));
  const safeHeight = Math.max(1, dimensions.height - (padding.paddingY * 2));

  const logoBuffer = await sharp(trimmedBuffer, { animated: false })
    .resize({
      width: Math.min(dimensions.maxWidth, safeWidth),
      height: Math.min(dimensions.maxHeight, safeHeight),
      fit: 'inside',
      withoutEnlargement: true,
      background: TRANSPARENT_BACKGROUND,
    })
    .png()
    .toBuffer();
  const resizedLogoMetadata = await sharp(logoBuffer).metadata();
  const resizedLogoWidth = resizedLogoMetadata.width ?? dimensions.maxWidth;
  const resizedLogoHeight = resizedLogoMetadata.height ?? dimensions.maxHeight;

  const composed = await sharp(buildGradientSvg(dimensions.width, dimensions.height, background.start, background.end))
    .composite([
      {
        input: logoBuffer,
        left: Math.max(0, Math.round((dimensions.width - resizedLogoWidth) / 2)),
        top: Math.max(0, Math.round((dimensions.height - resizedLogoHeight) / 2)),
      },
    ])
    .png()
    .toBuffer();

  const hash = createHash('sha1')
    .update(sourceUrl)
    .update(intent)
    .digest('hex')
    .slice(0, 12);
  const uploaded = await uploadBufferToBackblaze(
    composed,
    `${hash}-${intent}.png`,
    {
      bucketTypes: ['general', 'design'],
      prefix: 'rss/logo-cards',
      contentType: 'image/png',
    }
  );

  return uploaded.url;
}

export async function getTMDbLogoCardDiagnosticsFromBuffer(
  buffer: Buffer,
  intent: LogoCardIntent,
): Promise<TMDbLogoCardDiagnostics> {
  const { diagnostics } = await buildTMDbLogoCardDiagnostics(buffer, intent);
  return diagnostics;
}

export async function getTMDbLogoCardDiagnosticsFromSource(
  sourceUrl: string,
  intent: LogoCardIntent,
): Promise<TMDbLogoCardDiagnostics> {
  const originalBuffer = await fetchBuffer(sourceUrl);
  const { diagnostics } = await buildTMDbLogoCardDiagnostics(originalBuffer, intent);
  return diagnostics;
}

export function shouldRenderTMDbLogoCard(options: LogoRenderPolicyInput): boolean {
  if (
    options.allowAsPrimary === false &&
    (options.intent === 'logo' || options.intent === 'brand_backdrop')
  ) {
    return false;
  }

  const normalizedPrimary = options.primarySubjectName?.trim().toLowerCase() || '';
  const normalizedVisual = options.visualSubject?.trim().toLowerCase() || '';

  if (
    options.canonicalEntityType === 'person' &&
    options.intent === 'logo' &&
    normalizedPrimary &&
    normalizedVisual &&
    normalizedPrimary === normalizedVisual
  ) {
    return false;
  }

  if (
    (options.intent === 'logo' || options.intent === 'brand_backdrop') &&
    options.canonicalEntityType &&
    options.canonicalEntityType !== 'company' &&
    options.canonicalEntityType !== 'platform' &&
    options.canonicalEntityType !== 'franchise' &&
    normalizedPrimary &&
    normalizedVisual &&
    normalizedPrimary !== normalizedVisual
  ) {
    return false;
  }

  return true;
}

export async function renderTMDbBackdropLogoComposite(
  backdropUrl: string,
  logoUrl: string
): Promise<string> {
  const [backdropBuffer, logoBuffer] = await Promise.all([
    fetchBuffer(backdropUrl),
    fetchBuffer(logoUrl),
  ]);

  const trimmedLogoBuffer = await trimTMDbLogoOuterBorderBuffer(logoBuffer);
  const accent = await analyzeVisibleColor(trimmedLogoBuffer);
  const surface = buildBackdropLogoSurface(accent);
  const backdropImage = sharp(backdropBuffer, { animated: false }).rotate();
  const backdropMetadata = await backdropImage.metadata();
  const canvasWidth = Math.max(1200, backdropMetadata.width ?? 1600);
  const canvasHeight = Math.max(675, backdropMetadata.height ?? 900);

  const normalizedBackdrop = await backdropImage
    .resize(canvasWidth, canvasHeight, {
      fit: 'cover',
      position: 'attention',
      withoutEnlargement: false,
    })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  const sourceLogoMetadata = await sharp(trimmedLogoBuffer, { animated: false }).metadata();
  const sourceAspectRatio = Math.max(1, sourceLogoMetadata.width ?? 1) / Math.max(1, sourceLogoMetadata.height ?? 1);
  const maxLogoWidth = sourceAspectRatio >= 3.2
    ? Math.round(canvasWidth * 0.64)
    : sourceAspectRatio >= 2.2
      ? Math.round(canvasWidth * 0.56)
      : Math.round(canvasWidth * 0.46);
  const maxLogoHeight = sourceAspectRatio >= 3.2
    ? Math.round(canvasHeight * 0.2)
    : Math.round(canvasHeight * 0.26);
  const resizedLogo = await sharp(trimmedLogoBuffer, { animated: false })
    .resize({
      width: maxLogoWidth,
      height: maxLogoHeight,
      fit: 'inside',
      withoutEnlargement: true,
      background: TRANSPARENT_BACKGROUND,
    })
    .png()
    .toBuffer();
  const logoMetadata = await sharp(resizedLogo).metadata();
  const logoWidth = logoMetadata.width ?? maxLogoWidth;
  const logoHeight = logoMetadata.height ?? maxLogoHeight;
  const overlayPaddingX = Math.max(26, Math.round(logoWidth * 0.08));
  const overlayPaddingY = Math.max(20, Math.round(logoHeight * 0.16));
  const overlayWidth = logoWidth + (overlayPaddingX * 2);
  const overlayHeight = logoHeight + (overlayPaddingY * 2);
  const overlayLeft = Math.max(0, Math.round((canvasWidth - overlayWidth) / 2));
  const overlayTop = Math.max(0, Math.round((canvasHeight - overlayHeight) / 2));
  const logoLeft = overlayLeft + Math.round((overlayWidth - logoWidth) / 2);
  const logoTop = overlayTop + Math.round((overlayHeight - logoHeight) / 2);

  const overlaySvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${overlayWidth}" height="${overlayHeight}" viewBox="0 0 ${overlayWidth} ${overlayHeight}">
      <defs>
        <linearGradient id="surface" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${rgbToHex(surface.fill)}" stop-opacity="0.96" />
          <stop offset="100%" stop-color="${rgbToHex(surface.edge)}" stop-opacity="0.92" />
        </linearGradient>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="${Math.max(10, Math.round(overlayHeight * 0.04))}" stdDeviation="${Math.max(12, Math.round(overlayHeight * 0.05))}" flood-color="rgba(0,0,0,0.35)" />
        </filter>
      </defs>
      <rect
        x="0"
        y="0"
        width="${overlayWidth}"
        height="${overlayHeight}"
        rx="${Math.round(Math.min(overlayWidth, overlayHeight) * 0.18)}"
        fill="url(#surface)"
        stroke="${rgbToHex(surface.border)}"
        stroke-opacity="0.78"
        stroke-width="${Math.max(2, Math.round(Math.min(overlayWidth, overlayHeight) * 0.012))}"
        filter="url(#shadow)"
      />
    </svg>
  `);

  const composed = await sharp(normalizedBackdrop, { animated: false })
    .composite([
      { input: overlaySvg, left: overlayLeft, top: overlayTop },
      { input: resizedLogo, left: logoLeft, top: logoTop },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  const hash = createHash('sha1')
    .update(backdropUrl)
    .update(logoUrl)
    .update('tmdb-backdrop-logo-publish')
    .digest('hex')
    .slice(0, 12);

  const uploaded = await uploadBufferToBackblaze(
    composed,
    `${hash}-tmdb-backdrop-logo.jpg`,
    {
      bucketTypes: ['general', 'design'],
      prefix: 'tmdb/publish-composites',
      contentType: 'image/jpeg',
    }
  );

  return uploaded.url;
}
