import { useEffect, useState } from 'react';
import { cn } from '../ui/utils';

type RGB = { r: number; g: number; b: number };

const BACKGROUND_CANDIDATES: RGB[] = [
  { r: 8, g: 8, b: 10 },
  { r: 14, g: 14, b: 16 },
  { r: 34, g: 34, b: 38 },
  { r: 56, g: 56, b: 60 },
  { r: 228, g: 228, b: 224 },
  { r: 245, g: 245, b: 242 },
  { r: 255, g: 255, b: 255 },
];

const DEFAULT_SURFACE = {
  start: { r: 16, g: 16, b: 18 },
  end: { r: 34, g: 34, b: 38 },
  border: { r: 72, g: 72, b: 78 },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function mixColor(base: RGB, accent: RGB, ratio: number): RGB {
  return {
    r: Math.round(base.r + (accent.r - base.r) * ratio),
    g: Math.round(base.g + (accent.g - base.g) * ratio),
    b: Math.round(base.b + (accent.b - base.b) * ratio),
  };
}

function rgbToCss(color: RGB) {
  return `rgb(${clamp(color.r, 0, 255)}, ${clamp(color.g, 0, 255)}, ${clamp(color.b, 0, 255)})`;
}

function srgbToLinear(channel: number): number {
  const normalized = clamp(channel, 0, 255) / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(color: RGB): number {
  return (
    (0.2126 * srgbToLinear(color.r)) +
    (0.7152 * srgbToLinear(color.g)) +
    (0.0722 * srgbToLinear(color.b))
  );
}

function getContrastRatio(colorA: RGB, colorB: RGB): number {
  const luminanceA = getRelativeLuminance(colorA);
  const luminanceB = getRelativeLuminance(colorB);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

function isDarkSurface(color: RGB) {
  return getRelativeLuminance(color) < 0.22;
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

function pickBestBackgroundColor(accent: RGB) {
  const { h, s, l } = rgbToHsl(accent);
  const prefersDarkBias =
    s < 0.14 ||
    l >= 0.72 ||
    h <= 70 ||
    h >= 320 ||
    (h >= 70 && h <= 160);

  let best = BACKGROUND_CANDIDATES[0];
  let bestScore = -Infinity;

  for (const candidate of BACKGROUND_CANDIDATES) {
    const contrast = getContrastRatio(accent, candidate);
    const darkBonus = isDarkSurface(candidate) && prefersDarkBias ? 0.28 : 0;
    const lightBonus = !isDarkSurface(candidate) && !prefersDarkBias && l < 0.35 ? 0.18 : 0;
    const score = contrast + darkBonus + lightBonus;

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function buildSurface(accent: RGB) {
  const base = pickBestBackgroundColor(accent);
  const dark = isDarkSurface(base);
  const start = mixColor(base, accent, dark ? 0.12 : 0.08);
  const end = dark
    ? mixColor(base, { r: 245, g: 245, b: 242 }, 0.1)
    : mixColor(base, { r: 220, g: 220, b: 214 }, 0.14);
  const border = dark
    ? mixColor(start, { r: 245, g: 245, b: 242 }, 0.16)
    : mixColor(start, { r: 186, g: 186, b: 180 }, 0.24);

  return { start, end, border };
}

async function analyzeVisibleColor(src: string): Promise<RGB> {
  const image = new Image();
  image.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to load logo image'));
    image.src = src;
  });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas context unavailable');
  }

  const width = Math.max(1, Math.min(160, image.naturalWidth || image.width || 160));
  const height = Math.max(1, Math.min(160, image.naturalHeight || image.height || 160));
  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  let weightedR = 0;
  let weightedG = 0;
  let weightedB = 0;
  let totalWeight = 0;

  for (let index = 0; index < data.length; index += 4) {
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
    return { r: 245, g: 245, b: 242 };
  }

  return {
    r: Math.round(weightedR / totalWeight),
    g: Math.round(weightedG / totalWeight),
    b: Math.round(weightedB / totalWeight),
  };
}

interface TMDbLogoSurfaceProps {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  paddingClassName?: string;
}

export function TMDbLogoSurface({
  src,
  alt,
  className,
  imageClassName,
  paddingClassName = 'p-3',
}: TMDbLogoSurfaceProps) {
  const [surface, setSurface] = useState(DEFAULT_SURFACE);

  useEffect(() => {
    let cancelled = false;

    void analyzeVisibleColor(src)
      .then((accent) => {
        if (!cancelled) {
          setSurface(buildSurface(accent));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSurface(DEFAULT_SURFACE);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div
      className={cn('flex h-full w-full items-center justify-center', paddingClassName, className)}
      style={{
        backgroundImage: `linear-gradient(135deg, ${rgbToCss(surface.start)} 0%, ${rgbToCss(surface.end)} 100%)`,
        border: `1px solid ${rgbToCss(surface.border)}`,
      }}
    >
      <img
        src={src}
        alt={alt}
        className={cn('h-full w-full object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)]', imageClassName)}
      />
    </div>
  );
}
