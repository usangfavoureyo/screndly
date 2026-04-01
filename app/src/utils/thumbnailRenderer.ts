export type ThumbnailPlatformConfig = 'youtube' | 'x';
export type BrandedOverlayType = string;
export type BrandedOverlayVariant = 'white' | 'black';
export type BrandedOverlayAssetKey = `${string}_${BrandedOverlayVariant}`;

export type BrandedOverlayAssets = Partial<Record<BrandedOverlayAssetKey, string>>;
export type ThumbnailLogoDisplayMode = 'boxed' | 'logo-only' | 'branded';
export type BrandedOverlayAppearanceMode = 'adaptive' | 'fixed';
export const STANDARD_BRANDED_OVERLAY_TYPES = ['trailer', 'teaser', 'clip', 'sneak_peek'] as const;

export type LogoPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ThumbnailConfig {
  platform: ThumbnailPlatformConfig;
  logoPosition: LogoPosition;
  autoScale: boolean;
  logoDisplayMode: ThumbnailLogoDisplayMode;
  maxLogoSize: number;
  trailerTextSize: number;
  autoContrastBackdrop: boolean;
  autoContrastOverlay: boolean;
  showTrailerTypeText: boolean;
  brandedOverlayAssets?: BrandedOverlayAssets;
  brandedOverlayCustomTypes?: string[];
  brandedOverlayAppearanceMode?: BrandedOverlayAppearanceMode;
  brandedOverlayFixedVariant?: BrandedOverlayVariant;
}

export interface ThumbnailRenderOptions {
  width?: number;
  height?: number;
  backdropUrl?: string;
  logoUrl?: string;
  trailerLabel?: string | null;
  title?: string;
  brandedOverlayAssets?: BrandedOverlayAssets;
  manualOverlayUrl?: string;
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface ThumbnailRenderResult {
  dataUrl: string;
  detectedType?: BrandedOverlayType;
  detectedVariant?: BrandedOverlayVariant;
  resolvedAssetKey?: BrandedOverlayAssetKey;
}

export const DEFAULT_THUMBNAIL_CONFIG: Record<ThumbnailPlatformConfig, ThumbnailConfig> = {
  youtube: {
    platform: 'youtube',
    logoPosition: 'bottom-right',
    autoScale: true,
    logoDisplayMode: 'boxed',
    maxLogoSize: 40,
    trailerTextSize: 32,
    autoContrastBackdrop: true,
    autoContrastOverlay: true,
    showTrailerTypeText: false,
    brandedOverlayCustomTypes: [],
    brandedOverlayAppearanceMode: 'adaptive',
    brandedOverlayFixedVariant: 'white',
  },
  x: {
    platform: 'x',
    logoPosition: 'bottom-right',
    autoScale: true,
    logoDisplayMode: 'boxed',
    maxLogoSize: 40,
    trailerTextSize: 32,
    autoContrastBackdrop: true,
    autoContrastOverlay: true,
    showTrailerTypeText: false,
    brandedOverlayCustomTypes: [],
    brandedOverlayAppearanceMode: 'adaptive',
    brandedOverlayFixedVariant: 'white',
  },
};

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const CONTRAST_RATIO_THRESHOLD = 2.6;
const THUMBNAIL_CONFIG_STORAGE_PREFIX = 'screndly_thumbnailConfig_';
const LOCAL_SETTINGS_KEY = 'screndlySettings';
const LEGACY_LOCAL_SETTINGS_KEY = 'screndly_settings';
const BRANDED_TEXT_REGION = {
  x: 0.04,
  y: 0.58,
  width: 0.42,
  height: 0.24,
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number
) {
  const ratio = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function drawContainImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const ratio = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function getContainImageMetrics(
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const ratio = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;

  return {
    x: x + (width - drawWidth) / 2,
    y: y + (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  };
}

function srgbToLinear(value: number) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(r: number, g: number, b: number) {
  const red = srgbToLinear(r);
  const green = srgbToLinear(g);
  const blue = srgbToLinear(b);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function getContrastRatio(a: number, b: number) {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

async function shouldApplyLogoContrastShadow(
  ctx: CanvasRenderingContext2D,
  config: ThumbnailConfig,
  options: ThumbnailRenderOptions,
  width: number,
  height: number
) {
  if (
    typeof document === 'undefined' ||
    !options.logoUrl ||
    !config.autoContrastOverlay ||
    config.logoDisplayMode === 'boxed'
  ) {
    return false;
  }

  try {
    const logoImage = await loadImage(options.logoUrl);
    const { boxWidth, boxHeight, boxX, boxY } = getLogoFrameMetrics(config, width, height);
    const logoMetrics = getContainImageMetrics(logoImage, boxX, boxY, boxWidth, boxHeight);
    const sampleWidth = Math.max(1, Math.round(logoMetrics.width));
    const sampleHeight = Math.max(1, Math.round(logoMetrics.height));
    const sampleX = Math.max(0, Math.min(width - sampleWidth, Math.round(logoMetrics.x)));
    const sampleY = Math.max(0, Math.min(height - sampleHeight, Math.round(logoMetrics.y)));

    const backdropPixels = ctx.getImageData(sampleX, sampleY, sampleWidth, sampleHeight).data;
    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = sampleWidth;
    logoCanvas.height = sampleHeight;
    const logoCtx = logoCanvas.getContext('2d');

    if (!logoCtx) {
      return false;
    }

    logoCtx.clearRect(0, 0, sampleWidth, sampleHeight);
    logoCtx.drawImage(logoImage, 0, 0, sampleWidth, sampleHeight);
    const logoPixels = logoCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;

    let weightedLogoLuminance = 0;
    let weightedBackdropLuminance = 0;
    let alphaWeight = 0;

    for (let index = 0; index < logoPixels.length; index += 4) {
      const alpha = logoPixels[index + 3] / 255;
      if (alpha < 0.08) {
        continue;
      }

      const logoLuminance = getRelativeLuminance(
        logoPixels[index],
        logoPixels[index + 1],
        logoPixels[index + 2]
      );
      const backdropLuminance = getRelativeLuminance(
        backdropPixels[index],
        backdropPixels[index + 1],
        backdropPixels[index + 2]
      );

      weightedLogoLuminance += logoLuminance * alpha;
      weightedBackdropLuminance += backdropLuminance * alpha;
      alphaWeight += alpha;
    }

    if (alphaWeight === 0) {
      return false;
    }

    const averageLogoLuminance = weightedLogoLuminance / alphaWeight;
    const averageBackdropLuminance = weightedBackdropLuminance / alphaWeight;
    const contrastRatio = getContrastRatio(averageLogoLuminance, averageBackdropLuminance);

    return contrastRatio < CONTRAST_RATIO_THRESHOLD;
  } catch (error) {
    console.warn('Failed to analyze thumbnail contrast, applying fallback behavior:', error);
    return true;
  }
}

function drawDefaultBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#13243b');
  gradient.addColorStop(0.45, '#294b72');
  gradient.addColorStop(1, '#f18b6d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.72, height * 0.25, 40, width * 0.72, height * 0.25, width * 0.5);
  glow.addColorStop(0, 'rgba(255, 238, 196, 0.78)');
  glow.addColorStop(0.4, 'rgba(255, 211, 150, 0.34)');
  glow.addColorStop(1, 'rgba(255, 211, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.78);
  ctx.quadraticCurveTo(width * 0.25, height * 0.68, width * 0.45, height * 0.8);
  ctx.quadraticCurveTo(width * 0.7, height * 0.94, width, height * 0.7);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
}

export function getLogoFrameMetrics(
  config: ThumbnailConfig,
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT
) {
  const isLogoOnly = config.logoDisplayMode === 'logo-only';
  const maxWidthRatio = isLogoOnly ? 0.74 : 0.52;
  const maxHeightRatio = isLogoOnly ? 0.34 : 0.22;
  const minHeight = isLogoOnly ? 96 : 84;
  const heightScale = isLogoOnly ? 0.36 : 0.28;
  const boxWidth = Math.min(width * (config.maxLogoSize / 100), width * maxWidthRatio);
  const boxHeight = Math.min(height * maxHeightRatio, Math.max(minHeight, boxWidth * heightScale));
  const marginX = 48;
  const marginTop = 48;
  const marginBottom = isLogoOnly ? 48 : 64;
  const maxLeft = width - marginX - boxWidth;
  const maxTop = height - marginBottom - boxHeight;

  const rawBoxX = config.logoPosition.includes('left')
    ? marginX
    : config.logoPosition.includes('right')
      ? width - boxWidth - marginX
      : (width - boxWidth) / 2;
  const rawBoxY = config.logoPosition.startsWith('top')
    ? marginTop
    : config.logoPosition.startsWith('center')
      ? (height - boxHeight) / 2
      : height - boxHeight - marginBottom;

  const boxX = Math.max(marginX, Math.min(rawBoxX, maxLeft));
  const boxY = Math.max(marginTop, Math.min(rawBoxY, maxTop));

  return { boxWidth, boxHeight, boxX, boxY };
}

export function getTrailerLabelMetrics(
  config: ThumbnailConfig,
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT
) {
  const { boxWidth, boxHeight, boxX, boxY } = getLogoFrameMetrics(config, width, height);
  const fontSize = Math.max(18, config.trailerTextSize || 32);
  const gap = Math.max(18, fontSize * 0.6);
  const bottomSafeMargin = 24;
  const topSafeMargin = 24;
  const prefersBelow = boxY + boxHeight + gap + fontSize <= height - bottomSafeMargin;
  const textTop = prefersBelow
    ? boxY + boxHeight + gap
    : Math.max(topSafeMargin, boxY - gap - fontSize);

  return {
    centerX: boxX + boxWidth / 2,
    top: textTop,
    fontSize,
  };
}

function normalizeOverlayTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBrandedOverlayType(type: string): string {
  return type
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]+/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getOverlayTypeFromAssetKey(key: string): string | null {
  if (key.endsWith('_white')) {
    return key.slice(0, -'_white'.length);
  }
  if (key.endsWith('_black')) {
    return key.slice(0, -'_black'.length);
  }
  return null;
}

function getCustomOverlayTypes(
  customTypes: string[] | undefined,
  assets: BrandedOverlayAssets | undefined
): string[] {
  const derivedTypes = Object.keys(assets || {})
    .map((key) => getOverlayTypeFromAssetKey(key))
    .filter((value): value is string => Boolean(value));
  const merged = [...(customTypes || []), ...derivedTypes]
    .map((value) => normalizeBrandedOverlayType(value))
    .filter(Boolean);

  return [...new Set(merged)].filter(
    (value) => !(STANDARD_BRANDED_OVERLAY_TYPES as readonly string[]).includes(value)
  );
}

export function sanitizeBrandedOverlayTypeLabel(label: string): string {
  return normalizeBrandedOverlayType(label);
}

export function formatBrandedOverlayTypeLabel(type: string): string {
  const normalized = normalizeBrandedOverlayType(type);
  if (!normalized) {
    return '';
  }

  return normalized
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function detectOverlayType(
  title: string,
  assets?: BrandedOverlayAssets,
  customTypes?: string[]
): BrandedOverlayType {
  const normalized = normalizeOverlayTitle(title);
  const matchingCustomType = getCustomOverlayTypes(customTypes, assets)
    .sort((left, right) => right.length - left.length)
    .find((type) => normalized.includes(type.replace(/_/g, ' ')));

  if (matchingCustomType) {
    return matchingCustomType;
  }
  if (normalized.includes('sneak peek')) {
    return 'sneak_peek';
  }
  if (normalized.includes('teaser')) {
    return 'teaser';
  }
  if (normalized.includes('clip')) {
    return 'clip';
  }
  if (normalized.includes('trailer')) {
    return 'trailer';
  }
  return 'trailer';
}

export function getOverlayLabelForTitle(title: string): string {
  const normalized = normalizeOverlayTitle(title);
  if (normalized.includes('featurette')) {
    return 'OFFICIAL FEATURETTE';
  }

  const overlayType = detectOverlayType(title);
  if (overlayType === 'sneak_peek') {
    return 'SNEAK PEEK';
  }
  if (overlayType === 'teaser') {
    return 'OFFICIAL TEASER';
  }
  if (overlayType === 'clip') {
    return 'OFFICIAL CLIP';
  }
  return 'OFFICIAL TRAILER';
}

function parseThumbnailConfig(
  value: unknown,
  platform: ThumbnailPlatformConfig
): ThumbnailConfig | null {
  if (!value) {
    return null;
  }

  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  return {
    ...DEFAULT_THUMBNAIL_CONFIG[platform],
    ...parsed,
    platform,
  };
}

function getThumbnailConfigFromSettingsSnapshot(
  snapshot: string | null,
  platform: ThumbnailPlatformConfig
): ThumbnailConfig | null {
  if (!snapshot) {
    return null;
  }

  const parsed = JSON.parse(snapshot) as Record<string, unknown>;
  return parseThumbnailConfig(parsed?.[`thumbnailConfig_${platform}`], platform);
}

function getBrandedAssetKey(
  type: BrandedOverlayType,
  variant: BrandedOverlayVariant
): BrandedOverlayAssetKey {
  return `${type}_${variant}` as BrandedOverlayAssetKey;
}

async function detectOverlayContrast(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): Promise<BrandedOverlayVariant> {
  const sampleX = Math.max(0, Math.floor(width * BRANDED_TEXT_REGION.x));
  const sampleY = Math.max(0, Math.floor(height * BRANDED_TEXT_REGION.y));
  const sampleWidth = Math.max(1, Math.floor(width * BRANDED_TEXT_REGION.width));
  const sampleHeight = Math.max(1, Math.floor(height * BRANDED_TEXT_REGION.height));
  const imageData = ctx.getImageData(sampleX, sampleY, sampleWidth, sampleHeight).data;

  let weightedLuminance = 0;
  let totalWeight = 0;

  for (let index = 0; index < imageData.length; index += 4) {
    const alpha = imageData[index + 3] / 255;
    if (alpha <= 0.05) {
      continue;
    }

    const luminance =
      0.2126 * imageData[index]
      + 0.7152 * imageData[index + 1]
      + 0.0722 * imageData[index + 2];

    weightedLuminance += luminance * alpha;
    totalWeight += alpha;
  }

  const averageLuminance = totalWeight > 0 ? weightedLuminance / totalWeight : 0;
  return averageLuminance < 160 ? 'white' : 'black';
}

function resolveOverlayAsset(
  assets: BrandedOverlayAssets | undefined,
  type: BrandedOverlayType,
  variant: BrandedOverlayVariant,
  options: { allowOppositeVariantFallback?: boolean } = {}
): { key?: BrandedOverlayAssetKey; src?: string; variant?: BrandedOverlayVariant } {
  if (!assets) {
    return {};
  }

  const allowOppositeVariantFallback = options.allowOppositeVariantFallback ?? true;
  const oppositeVariant: BrandedOverlayVariant = variant === 'white' ? 'black' : 'white';
  const candidates: BrandedOverlayAssetKey[] = [getBrandedAssetKey(type, variant)];

  if (allowOppositeVariantFallback) {
    candidates.push(getBrandedAssetKey(type, oppositeVariant));
  }

  if (type !== 'trailer') {
    candidates.push(getBrandedAssetKey('trailer', variant));

    if (allowOppositeVariantFallback) {
      candidates.push(getBrandedAssetKey('trailer', oppositeVariant));
    }
  }

  for (const key of candidates) {
    const src = assets[key];
    if (src) {
      return {
        key,
        src,
        variant: key.endsWith('_black') ? 'black' : 'white',
      };
    }
  }

  return {};
}

export function getStoredThumbnailConfig(platform: ThumbnailPlatformConfig): ThumbnailConfig {
  const fallback = DEFAULT_THUMBNAIL_CONFIG[platform];

  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return fallback;
  }

  try {
    const directConfig = parseThumbnailConfig(
      localStorage.getItem(`${THUMBNAIL_CONFIG_STORAGE_PREFIX}${platform}`),
      platform
    );
    if (directConfig) {
      return directConfig;
    }

    const embeddedConfig = getThumbnailConfigFromSettingsSnapshot(
      localStorage.getItem(LOCAL_SETTINGS_KEY) ?? localStorage.getItem(LEGACY_LOCAL_SETTINGS_KEY),
      platform
    );
    if (embeddedConfig) {
      return embeddedConfig;
    }
  } catch (error) {
    console.error(`Failed to load thumbnail config for ${platform}:`, error);
  }

  return fallback;
}
export async function shouldUseThumbnailLogoShadow(
  config: ThumbnailConfig,
  options: Pick<ThumbnailRenderOptions, 'backdropUrl' | 'logoUrl'> & {
    width?: number;
    height?: number;
  } = {}
) {
  if (
    typeof document === 'undefined' ||
    !options.logoUrl ||
    !config.autoContrastOverlay ||
    config.logoDisplayMode === 'boxed'
  ) {
    return false;
  }

  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return false;
  }

  if (options.backdropUrl) {
    try {
      const backdropImage = await loadImage(options.backdropUrl);
      drawCoverImage(ctx, backdropImage, width, height);
    } catch (error) {
      console.warn('Failed to load provided backdrop for contrast analysis, using default gradient instead:', error);
      drawDefaultBackdrop(ctx, width, height);
    }
  } else {
    drawDefaultBackdrop(ctx, width, height);
  }

  return shouldApplyLogoContrastShadow(ctx, config, options, width, height);
}

export async function renderThumbnailPreviewResult(
  config: ThumbnailConfig,
  options: ThumbnailRenderOptions = {}
): Promise<ThumbnailRenderResult> {
  if (typeof document === 'undefined') {
    return { dataUrl: options.backdropUrl || '' };
  }

  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  const format = options.format || 'jpeg';
  const quality = typeof options.quality === 'number' ? options.quality : 0.92;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas rendering is unavailable');
  }

  if (options.backdropUrl) {
    try {
      const backdropImage = await loadImage(options.backdropUrl);
      drawCoverImage(ctx, backdropImage, width, height);
    } catch (error) {
      console.warn('Failed to load provided backdrop, using default gradient instead:', error);
      drawDefaultBackdrop(ctx, width, height);
    }
  } else {
    drawDefaultBackdrop(ctx, width, height);
  }

  const brandedAssets = options.brandedOverlayAssets || config.brandedOverlayAssets;
  if (config.logoDisplayMode === 'branded') {
    const detectedType = detectOverlayType(
      options.title || options.trailerLabel || '',
      brandedAssets,
      config.brandedOverlayCustomTypes
    );
    const adaptiveVariant = await detectOverlayContrast(ctx, width, height);
    const preferredVariant = config.brandedOverlayAppearanceMode === 'fixed'
      ? (config.brandedOverlayFixedVariant || 'white')
      : adaptiveVariant;
    const manualOverlayUrl = options.manualOverlayUrl;
    const resolvedOverlay = manualOverlayUrl
      ? { key: undefined, src: manualOverlayUrl, variant: preferredVariant }
      : resolveOverlayAsset(brandedAssets, detectedType, preferredVariant, {
        allowOppositeVariantFallback: config.brandedOverlayAppearanceMode !== 'fixed',
      });

    if (resolvedOverlay.src) {
      try {
        const overlayImage = await loadImage(resolvedOverlay.src);
        drawCoverImage(ctx, overlayImage, width, height);
      } catch (error) {
        console.warn('Failed to load branded overlay asset:', error);
      }
    }

    return {
      dataUrl: canvas.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png', format === 'jpeg' ? quality : undefined),
      detectedType,
      detectedVariant: manualOverlayUrl ? preferredVariant : (resolvedOverlay.variant || preferredVariant),
      resolvedAssetKey: resolvedOverlay.key,
    };
  }

  const { boxWidth, boxHeight, boxX, boxY } = getLogoFrameMetrics(config, width, height);
  const shouldRenderBox = config.logoDisplayMode === 'boxed';
  const shouldApplyLogoShadow = await shouldApplyLogoContrastShadow(ctx, config, options, width, height);

  if (shouldRenderBox) {
    drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 24);
    ctx.fillStyle = 'rgba(18, 18, 18, 0.88)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();
  }

  if (options.logoUrl) {
    try {
      const logoImage = await loadImage(options.logoUrl);
      if (shouldApplyLogoShadow) {
        ctx.save();
        ctx.shadowColor =
          config.platform === 'youtube' ? 'rgba(0, 0, 0, 0.72)' : 'rgba(12, 12, 12, 0.68)';
        ctx.shadowBlur = Math.max(18, boxHeight * 0.34);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = Math.max(6, boxHeight * 0.06);
      }
      if (shouldRenderBox) {
        drawContainImage(ctx, logoImage, boxX + 20, boxY + 18, boxWidth - 40, boxHeight - 36);
      } else {
        drawContainImage(ctx, logoImage, boxX, boxY, boxWidth, boxHeight);
      }
      if (shouldApplyLogoShadow) {
        ctx.restore();
      }
    } catch (error) {
      console.warn('Failed to load provided logo, using default indicator instead:', error);
    }
  }

  if (!options.logoUrl) {
    if (shouldRenderBox) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(boxX + boxWidth * 0.12, boxY + boxHeight / 2);
      ctx.lineTo(boxX + boxWidth * 0.88, boxY + boxHeight / 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(boxX + boxWidth * 0.16, boxY + boxHeight / 2);
      ctx.lineTo(boxX + boxWidth * 0.84, boxY + boxHeight / 2);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  if (config.showTrailerTypeText) {
    const trailerLabel = options.trailerLabel || getOverlayLabelForTitle(options.title || '');
    const trailerLabelMetrics = getTrailerLabelMetrics(config, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `700 ${trailerLabelMetrics.fontSize}px Arial, sans-serif`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = Math.max(12, trailerLabelMetrics.fontSize * 0.45);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(2, trailerLabelMetrics.fontSize * 0.12);
    ctx.fillText(trailerLabel, trailerLabelMetrics.centerX, trailerLabelMetrics.top);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  return {
    dataUrl: canvas.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png', format === 'jpeg' ? quality : undefined),
  };
}

export async function renderThumbnailDataUrl(
  config: ThumbnailConfig,
  options: ThumbnailRenderOptions = {}
): Promise<string> {
  const result = await renderThumbnailPreviewResult(config, options);
  return result.dataUrl;
}
