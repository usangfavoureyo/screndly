import { createHash } from 'crypto';
import sharp from 'sharp';
import { uploadBufferToBackblaze } from './backblaze';

type LogoCardIntent = 'logo' | 'brand_backdrop';

type RGB = { r: number; g: number; b: number };
type LogoBounds = { left: number; top: number; width: number; height: number };

const DARK_DEFAULT: RGB = { r: 14, g: 14, b: 16 };
const LIGHT_DEFAULT: RGB = { r: 245, g: 245, b: 242 };
const TRANSPARENT_BACKGROUND = { r: 0, g: 0, b: 0, alpha: 0 };
const LOGO_ALPHA_BORDER_THRESHOLD = 14;
const LOGO_NEAR_WHITE_THRESHOLD = 242;
const LOGO_COLOR_VARIANCE_THRESHOLD = 20;
const LOGO_BORDER_ROW_RATIO = 0.985;
const LOGO_BORDER_COLUMN_RATIO = 0.985;
const LOGO_MAX_TRIM_RATIO = 0.35;

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

function getLuminance(color: RGB): number {
  return (0.2126 * color.r) + (0.7152 * color.g) + (0.0722 * color.b);
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

  for (let index = 0; index < data.length; index += info.channels) {
    const alpha = data[index + 3] ?? 255;
    if (alpha < 18) {
      continue;
    }

    const weight = alpha / 255;
    weightedR += (data[index] ?? 0) * weight;
    weightedG += (data[index + 1] ?? 0) * weight;
    weightedB += (data[index + 2] ?? 0) * weight;
    totalWeight += weight;
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

function chooseBackgroundColors(accent: RGB, intent: LogoCardIntent): { start: RGB; end: RGB } {
  const luminance = getLuminance(accent);
  const prefersDark = luminance >= 132;

  if (prefersDark) {
    return {
      start: mixColor(DARK_DEFAULT, accent, intent === 'brand_backdrop' ? 0.2 : 0.12),
      end: mixColor(DARK_DEFAULT, accent, intent === 'brand_backdrop' ? 0.1 : 0.05),
    };
  }

  return {
    start: mixColor(LIGHT_DEFAULT, accent, intent === 'brand_backdrop' ? 0.15 : 0.08),
    end: mixColor(LIGHT_DEFAULT, accent, intent === 'brand_backdrop' ? 0.06 : 0.03),
  };
}

export async function renderTMDbLogoCard(
  sourceUrl: string,
  intent: LogoCardIntent
): Promise<string> {
  const originalBuffer = await fetchBuffer(sourceUrl);
  const trimmedBuffer = await trimTMDbLogoOuterBorderBuffer(originalBuffer);
  const accent = await analyzeVisibleColor(trimmedBuffer);
  const dimensions = intent === 'brand_backdrop'
    ? { width: 1600, height: 900, maxWidth: 1120, maxHeight: 360 }
    : { width: 1200, height: 1200, maxWidth: 760, maxHeight: 520 };
  const background = chooseBackgroundColors(accent, intent);

  const logoBuffer = await sharp(trimmedBuffer, { animated: false })
    .resize({
      width: dimensions.maxWidth,
      height: dimensions.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
      background: TRANSPARENT_BACKGROUND,
    })
    .png()
    .toBuffer();
  const logoMetadata = await sharp(logoBuffer).metadata();
  const logoWidth = logoMetadata.width ?? dimensions.maxWidth;
  const logoHeight = logoMetadata.height ?? dimensions.maxHeight;

  const composed = await sharp(buildGradientSvg(dimensions.width, dimensions.height, background.start, background.end))
    .composite([
      {
        input: logoBuffer,
        left: Math.max(0, Math.round((dimensions.width - logoWidth) / 2)),
        top: Math.max(0, Math.round((dimensions.height - logoHeight) / 2)),
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

export async function renderTMDbBackdropLogoComposite(
  backdropUrl: string,
  logoUrl: string
): Promise<string> {
  const [backdropBuffer, logoBuffer] = await Promise.all([
    fetchBuffer(backdropUrl),
    fetchBuffer(logoUrl),
  ]);

  const trimmedLogoBuffer = await trimTMDbLogoOuterBorderBuffer(logoBuffer);
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

  const maxLogoWidth = Math.round(canvasWidth * 0.52);
  const maxLogoHeight = Math.round(canvasHeight * 0.24);
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
      <rect
        x="0"
        y="0"
        width="${overlayWidth}"
        height="${overlayHeight}"
        rx="${Math.round(Math.min(overlayWidth, overlayHeight) * 0.18)}"
        fill="rgba(0,0,0,0.38)"
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
