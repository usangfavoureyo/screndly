import { useEffect, useRef, useState } from 'react';
import type { DesignStudioBrandBlockMode, DesignStudioLayoutVariant } from '../lib/api/designStudio';
import { DesignData } from './EditDesignBottomSheet';

interface LiveDesignPreviewProps {
  templatePreviewUrl: string;
  designData: DesignData | null;
}

type PreviewLayout = {
  textBox: { x: number; y: number; width: number; height: number };
  alignment: 'left' | 'center' | 'right';
  brandBox: { x: number; y: number; width: number; height: number };
  backgroundAnchor: 'top' | 'bottom' | 'left' | 'right' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
};

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;

const PREVIEW_VARIANTS: Record<DesignStudioLayoutVariant, PreviewLayout> = {
  bottom_center: {
    textBox: { x: 88, y: 926, width: 904, height: 318 },
    alignment: 'center',
    brandBox: { x: 369, y: 48, width: 341, height: 73 },
    backgroundAnchor: 'top',
  },
  bottom_left: {
    textBox: { x: 49, y: 895, width: 510, height: 372 },
    alignment: 'left',
    brandBox: { x: 49, y: 49, width: 341, height: 73 },
    backgroundAnchor: 'top_right',
  },
  bottom_right: {
    textBox: { x: 541, y: 844, width: 490, height: 423 },
    alignment: 'right',
    brandBox: { x: 688, y: 1223, width: 341, height: 73 },
    backgroundAnchor: 'top_left',
  },
  top_center: {
    textBox: { x: 108, y: 44, width: 864, height: 322 },
    alignment: 'center',
    brandBox: { x: 369, y: 1221, width: 341, height: 73 },
    backgroundAnchor: 'bottom',
  },
  top_left: {
    textBox: { x: 46, y: 36, width: 495, height: 438 },
    alignment: 'left',
    brandBox: { x: 49, y: 1223, width: 341, height: 73 },
    backgroundAnchor: 'bottom_right',
  },
  top_right: {
    textBox: { x: 548, y: 34, width: 486, height: 432 },
    alignment: 'right',
    brandBox: { x: 688, y: 49, width: 341, height: 73 },
    backgroundAnchor: 'bottom_left',
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgba(value: string, alpha: number) {
  const normalized = value.replace('#', '');
  const safe = normalized.length === 6 ? normalized : '000000';
  const red = Number.parseInt(safe.slice(0, 2), 16);
  const green = Number.parseInt(safe.slice(2, 4), 16);
  const blue = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1)})`;
}

function estimateWordWidth(word: string, fontSize: number) {
  const widthUnits = [...word].reduce((sum, char) => {
    if ('MW@#%&'.includes(char)) return sum + 0.95;
    if ('ilI1'.includes(char)) return sum + 0.35;
    if (' .,:;!|'.includes(char)) return sum + 0.22;
    return sum + 0.62;
  }, 0);
  return widthUnits * fontSize;
}

function fitHeadline(text: string, layout: PreviewLayout) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return { lines: [], fontSize: 88, lineHeight: 82 };
  }

  const maxFontSize = layout.alignment === 'center' ? 100 : 88;
  const minFontSize = 56;
  const maxLines = layout.alignment === 'center' ? 4 : 5;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const next = currentLine ? `${currentLine} ${word}` : word;
      if (estimateWordWidth(next, fontSize) <= layout.textBox.width) {
        currentLine = next;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);

    const lineHeight = fontSize * 0.93;
    if (lines.length <= maxLines && lines.length * lineHeight <= layout.textBox.height) {
      return { lines, fontSize, lineHeight };
    }
  }

  const fallbackFontSize = minFontSize;
  const fallbackLineHeight = fallbackFontSize * 0.93;
  const fallbackLines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const next = currentLine ? `${currentLine} ${word}` : word;
    if (estimateWordWidth(next, fallbackFontSize) <= layout.textBox.width) {
      currentLine = next;
    } else {
      if (currentLine) fallbackLines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) fallbackLines.push(currentLine);

  return {
    lines: fallbackLines.slice(0, maxLines),
    fontSize: fallbackFontSize,
    lineHeight: fallbackLineHeight,
  };
}

function getDefaultOverlayDirection(variant: DesignStudioLayoutVariant): 'top' | 'bottom' | 'left' | 'right' {
  switch (variant) {
    case 'top_center':
      return 'top';
    case 'bottom_center':
      return 'bottom';
    case 'top_left':
    case 'bottom_left':
      return 'left';
    case 'top_right':
    case 'bottom_right':
      return 'right';
    default:
      return 'bottom';
  }
}

function getGradient(direction: 'top' | 'bottom' | 'left' | 'right', color: string, opacity: number) {
  const alpha = clamp(opacity / 100, 0, 1);
  const opaque = hexToRgba(color, alpha);
  const transparent = hexToRgba(color, 0);
  switch (direction) {
    case 'top':
      return `linear-gradient(to bottom, ${opaque} 0%, ${transparent} 72%)`;
    case 'bottom':
      return `linear-gradient(to top, ${opaque} 0%, ${transparent} 72%)`;
    case 'left':
      return `linear-gradient(to right, ${opaque} 0%, ${transparent} 72%)`;
    case 'right':
      return `linear-gradient(to left, ${opaque} 0%, ${transparent} 72%)`;
    default:
      return `linear-gradient(to top, ${opaque} 0%, ${transparent} 72%)`;
  }
}

function resolveAnchorPosition(anchor: PreviewLayout['backgroundAnchor'], width: number, height: number) {
  const leftBase = (() => {
    switch (anchor) {
      case 'top_right':
      case 'bottom_right':
      case 'right':
        return CANVAS_WIDTH - width;
      case 'top_left':
      case 'bottom_left':
      case 'left':
        return 0;
      default:
        return Math.round((CANVAS_WIDTH - width) / 2);
    }
  })();

  const topBase = (() => {
    switch (anchor) {
      case 'bottom':
      case 'bottom_left':
      case 'bottom_right':
        return CANVAS_HEIGHT - height;
      case 'top':
      case 'top_left':
      case 'top_right':
        return 0;
      default:
        return Math.round((CANVAS_HEIGHT - height) / 2);
    }
  })();

  return { leftBase, topBase };
}

function drawBackground(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  anchor: PreviewLayout['backgroundAnchor'],
  focalPoint: { x: number; y: number },
  zoom: number,
) {
  const ratio = Math.max(CANVAS_WIDTH / image.naturalWidth, CANVAS_HEIGHT / image.naturalHeight) * zoom;
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * ratio));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * ratio));
  const { leftBase, topBase } = resolveAnchorPosition(anchor, targetWidth, targetHeight);
  const left = Math.round(leftBase + ((focalPoint.x ?? 50) - 50) * 2.2);
  const top = Math.round(topBase + ((focalPoint.y ?? 50) - 50) * 2.2);

  context.drawImage(image, left, top, targetWidth, targetHeight);
}

function useAutoBrandMode(
  sourceUrl: string,
  variant: PreviewLayout,
  focalPoint: { x: number; y: number },
  zoom: number,
  requestedMode: DesignStudioBrandBlockMode,
) {
  const [brandMode, setBrandMode] = useState<'black' | 'white'>(requestedMode === 'white' ? 'white' : 'black');

  useEffect(() => {
    if (requestedMode === 'black' || requestedMode === 'white') {
      setBrandMode(requestedMode);
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (cancelled) return;

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const context = canvas.getContext('2d');
      if (!context) {
        setBrandMode('white');
        return;
      }

      context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawBackground(context, image, variant.backgroundAnchor, focalPoint, zoom);

      try {
        const imageData = context.getImageData(
          Math.round(variant.brandBox.x),
          Math.round(variant.brandBox.y),
          Math.round(variant.brandBox.width),
          Math.round(variant.brandBox.height),
        ).data;

        let total = 0;
        const samples = imageData.length / 4;
        for (let index = 0; index < imageData.length; index += 4) {
          total += ((0.2126 * imageData[index]) + (0.7152 * imageData[index + 1]) + (0.0722 * imageData[index + 2])) / 255;
        }
        const luminance = samples > 0 ? total / samples : 0.5;
        setBrandMode(luminance >= 0.58 ? 'black' : 'white');
      } catch {
        setBrandMode('white');
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        setBrandMode('white');
      }
    };
    image.src = sourceUrl;

    return () => {
      cancelled = true;
    };
  }, [sourceUrl, variant, focalPoint, zoom, requestedMode]);

  return brandMode;
}

export function LiveDesignPreview({ templatePreviewUrl, designData }: LiveDesignPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frameScale, setFrameScale] = useState(1);
  const sourceUrl = designData?.backgroundImage || templatePreviewUrl;
  const variantKey = designData?.templateVariant || 'bottom_center';
  const variant = PREVIEW_VARIANTS[variantKey];
  const focalPoint = designData?.imageFocalPoint || { x: 50, y: 50 };
  const zoom = designData?.imageZoom || 1;
  const headerColor = designData?.headerTextColor || '#ffffff';
  const overlayColor = designData?.overlayColor || '#000000';
  const overlayOpacity = designData?.overlayOpacity ?? 70;
  const overlayDirection = designData?.gradientPosition || getDefaultOverlayDirection(variantKey);
  const fadeEnabled = designData?.fadeEnabled ?? true;
  const fadeOpacity = designData?.fadeOpacity ?? 90;
  const brandMode = useAutoBrandMode(sourceUrl, variant, focalPoint, zoom, designData?.brandBlockMode || 'auto');
  const fittedHeadline = fitHeadline(designData?.headerText || '', variant);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const updateScale = () => {
      const { clientWidth, clientHeight } = container;
      if (!clientWidth || !clientHeight) return;
      setFrameScale(Math.min(clientWidth / CANVAS_WIDTH, clientHeight / CANVAS_HEIGHT));
    };

    updateScale();

    const observer = new ResizeObserver(() => updateScale());
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const draw = canvas.getContext('2d');
      if (!draw) return;
      draw.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawBackground(draw, image, variant.backgroundAnchor, focalPoint, zoom);
    };
    image.onerror = () => {
      context.fillStyle = '#111111';
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    };
    image.src = sourceUrl;
  }, [sourceUrl, variant, focalPoint, zoom]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: getGradient(overlayDirection, overlayColor, overlayOpacity),
        }}
      />

      {fadeEnabled ? (
        <img
          src="/design-studio/fade.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          style={{ opacity: clamp(fadeOpacity / 100, 0, 1) }}
        />
      ) : null}

      {designData?.headerText ? (
        <div
          className="absolute"
          style={{
            left: `${(variant.textBox.x / CANVAS_WIDTH) * 100}%`,
            top: `${(variant.textBox.y / CANVAS_HEIGHT) * 100}%`,
            width: `${(variant.textBox.width / CANVAS_WIDTH) * 100}%`,
            height: `${(variant.textBox.height / CANVAS_HEIGHT) * 100}%`,
            color: headerColor,
            textAlign: variant.alignment,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: variantKey.startsWith('bottom') ? 'flex-end' : 'flex-start',
            fontWeight: 800,
            textTransform: 'uppercase',
            lineHeight: 0.93,
            letterSpacing: '-0.03em',
            fontFamily: '"Impact", "Arial Narrow Bold", sans-serif',
            textShadow: headerColor.toLowerCase() === '#000000' ? 'none' : '0 1px 2px rgba(0,0,0,0.28)',
          }}
        >
          {fittedHeadline.lines.map((line, index) => (
            <div
              key={`${line}-${index}`}
              style={{
                fontSize: `${Math.max(18, fittedHeadline.fontSize * frameScale)}px`,
                lineHeight: `${Math.max(18, fittedHeadline.lineHeight * frameScale)}px`,
              }}
              className="leading-none"
            >
              {line}
            </div>
          ))}
        </div>
      ) : null}

      <img
        src={brandMode === 'black' ? '/design-studio/brand-block-black.png' : '/design-studio/brand-block-white.png'}
        alt=""
        className="absolute pointer-events-none"
        style={{
          left: `${(variant.brandBox.x / CANVAS_WIDTH) * 100}%`,
          top: `${(variant.brandBox.y / CANVAS_HEIGHT) * 100}%`,
          width: `${(variant.brandBox.width / CANVAS_WIDTH) * 100}%`,
          height: `${(variant.brandBox.height / CANVAS_HEIGHT) * 100}%`,
        }}
      />
    </div>
  );
}
