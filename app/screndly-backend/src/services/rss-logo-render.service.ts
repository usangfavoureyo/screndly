import { createHash } from 'crypto';
import sharp from 'sharp';
import { uploadBufferToBackblaze } from './backblaze';

type LogoCardIntent = 'logo' | 'brand_backdrop';

type RGB = { r: number; g: number; b: number };

const DARK_DEFAULT: RGB = { r: 14, g: 14, b: 16 };
const LIGHT_DEFAULT: RGB = { r: 245, g: 245, b: 242 };

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
  const trimmedBuffer = await sharp(originalBuffer, { animated: false })
    .trim()
    .png()
    .toBuffer();
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
