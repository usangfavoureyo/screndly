import { useEffect, useRef, useState } from 'react';
import type { DesignStudioBrandBlockMode, DesignStudioLayoutVariant } from '../lib/api/designStudio';
import { buildDesignStudioMediaStreamUrl } from '../lib/designStudioMedia';
import { DesignData } from './EditDesignBottomSheet';

interface LiveDesignPreviewProps {
  templatePreviewUrl: string;
  designData: DesignData | null;
}

type PreviewLayout = {
  textBox: { x: number; y: number; width: number; height: number };
  alignment: 'left' | 'center' | 'right';
  brandBox: { x: number; y: number; width: number; height: number };
};

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;

const PREVIEW_VARIANTS: Record<DesignStudioLayoutVariant, PreviewLayout> = {
  bottom_center: {
    textBox: { x: 88, y: 926, width: 904, height: 318 },
    alignment: 'center',
    brandBox: { x: 369, y: 48, width: 341, height: 73 },
  },
  bottom_left: {
    textBox: { x: 49, y: 895, width: 510, height: 372 },
    alignment: 'left',
    brandBox: { x: 49, y: 49, width: 341, height: 73 },
  },
  bottom_right: {
    textBox: { x: 541, y: 844, width: 490, height: 423 },
    alignment: 'right',
    brandBox: { x: 688, y: 1223, width: 341, height: 73 },
  },
  top_center: {
    textBox: { x: 108, y: 44, width: 864, height: 322 },
    alignment: 'center',
    brandBox: { x: 369, y: 1221, width: 341, height: 73 },
  },
  top_left: {
    textBox: { x: 46, y: 36, width: 495, height: 438 },
    alignment: 'left',
    brandBox: { x: 49, y: 1223, width: 341, height: 73 },
  },
  top_right: {
    textBox: { x: 548, y: 34, width: 486, height: 432 },
    alignment: 'right',
    brandBox: { x: 688, y: 49, width: 341, height: 73 },
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

function resolveBrandMode(requestedMode: DesignStudioBrandBlockMode | undefined, headerColor: string): 'black' | 'white' {
  if (requestedMode === 'black' || requestedMode === 'white') {
    return requestedMode;
  }

  return headerColor.trim().toLowerCase() === '#000000' ? 'black' : 'white';
}

export function LiveDesignPreview({ templatePreviewUrl, designData }: LiveDesignPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [frameScale, setFrameScale] = useState(1);

  const rawSourceUrl = designData?.backgroundImage || templatePreviewUrl || '';
  const sourceUrl = buildDesignStudioMediaStreamUrl(rawSourceUrl) || rawSourceUrl;
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
  const brandMode = resolveBrandMode(designData?.brandBlockMode, headerColor);
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

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      <style>{`
        @font-face {
          font-family: 'ScrendlyHeadline';
          src: url('/design-studio/z-PFDinTextCompPro-Bold.ttf') format('truetype');
          font-weight: 700;
          font-style: normal;
        }
      `}</style>

      {sourceUrl ? (
        <div
          className="absolute inset-0 bg-[#111111]"
          style={{
            backgroundImage: `url("${sourceUrl}")`,
            backgroundSize: `${zoom * 100}%`,
            backgroundPosition: `${focalPoint.x}% ${focalPoint.y}%`,
            backgroundRepeat: 'no-repeat',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#111111]" />
      )}

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
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
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
            fontFamily: '"ScrendlyHeadline", "Impact", "Arial Narrow Bold", sans-serif',
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
        className="pointer-events-none absolute"
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
