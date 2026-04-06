import { useEffect, useMemo, useRef, useState } from 'react';
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
const FALLBACK_BACKGROUND =
  'radial-gradient(circle at 18% 88%, rgba(110, 102, 255, 0.92) 0%, rgba(110, 102, 255, 0.28) 22%, rgba(110, 102, 255, 0) 48%), radial-gradient(circle at 82% 14%, rgba(150, 118, 255, 0.32) 0%, rgba(150, 118, 255, 0) 30%), linear-gradient(180deg, #5b4f8d 0%, #463d78 24%, #2a274f 58%, #171925 100%)';

const PREVIEW_VARIANTS: Record<DesignStudioLayoutVariant, PreviewLayout> = {
  bottom_center: {
    textBox: { x: 88, y: 1042, width: 904, height: 260 },
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
    brandBox: { x: 688, y: 49, width: 341, height: 73 },
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
    brandBox: { x: 688, y: 1223, width: 341, height: 73 },
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

function resolvePreviewTextBox(
  layout: PreviewLayout,
  widthScale: number,
): PreviewLayout['textBox'] {
  const nextWidth = layout.textBox.width * widthScale;
  if (layout.alignment === 'center') {
    const centerX = layout.textBox.x + layout.textBox.width / 2;
    return {
      ...layout.textBox,
      width: nextWidth,
      x: centerX - nextWidth / 2,
    };
  }

  if (layout.alignment === 'right') {
    return {
      ...layout.textBox,
      width: nextWidth,
      x: layout.textBox.x + layout.textBox.width - nextWidth,
    };
  }

  return {
    ...layout.textBox,
    width: nextWidth,
  };
}

function fitHeadline(text: string, layout: PreviewLayout, textBox: PreviewLayout['textBox']) {
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
      if (estimateWordWidth(next, fontSize) <= textBox.width) {
        currentLine = next;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);

    const lineHeight = fontSize * 0.93;
    if (lines.length <= maxLines && lines.length * lineHeight <= textBox.height) {
      return { lines, fontSize, lineHeight };
    }
  }

  const fallbackFontSize = minFontSize;
  const fallbackLineHeight = fallbackFontSize * 0.93;
  const fallbackLines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const next = currentLine ? `${currentLine} ${word}` : word;
    if (estimateWordWidth(next, fallbackFontSize) <= textBox.width) {
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
  const [previewImageError, setPreviewImageError] = useState(false);
  const [fadeAssetError, setFadeAssetError] = useState(false);
  const [brandAssetError, setBrandAssetError] = useState(false);
  const [sourceDimensions, setSourceDimensions] = useState<{ width: number; height: number } | null>(null);

  const rawSourceUrl = templatePreviewUrl || designData?.backgroundImage || '';
  const sourceUrl = useMemo(() => buildDesignStudioMediaStreamUrl(rawSourceUrl) || rawSourceUrl, [rawSourceUrl]);
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
  const fontScale = designData?.fontScale ?? 1;
  const headlineWidthScale = designData?.headlineWidthScale ?? 1;
  const lineHeightMultiplier = designData?.lineHeightMultiplier ?? 0.93;
  const brandMode = resolveBrandMode(designData?.brandBlockMode, headerColor);
  const resolvedTextBox = resolvePreviewTextBox(variant, headlineWidthScale);
  const fittedHeadline = fitHeadline(designData?.headerText || '', variant, resolvedTextBox);
  const showPreviewImage = Boolean(sourceUrl) && !previewImageError;
  const brandAssetUrl = brandMode === 'black' ? '/design-studio/brand-block-black.png' : '/design-studio/brand-block-white.png';
  const previewImageStyle = useMemo(() => {
    if (!sourceDimensions?.width || !sourceDimensions?.height) {
      return {
        left: '50%',
        top: '50%',
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
        objectPosition: 'center center',
        transform: `translate(-50%, -50%) scale(${zoom})`,
        transformOrigin: 'center center',
      };
    }

    const canvasAspect = CANVAS_WIDTH / CANVAS_HEIGHT;
    const imageAspect = sourceDimensions.width / sourceDimensions.height;

    let baseWidth = CANVAS_WIDTH;
    let baseHeight = CANVAS_HEIGHT;

    if (imageAspect > canvasAspect) {
      baseHeight = CANVAS_HEIGHT;
      baseWidth = CANVAS_HEIGHT * imageAspect;
    } else {
      baseWidth = CANVAS_WIDTH;
      baseHeight = CANVAS_WIDTH / imageAspect;
    }

    const scaledWidth = baseWidth * zoom;
    const scaledHeight = baseHeight * zoom;
    const overflowX = Math.max(0, scaledWidth - CANVAS_WIDTH);
    const overflowY = Math.max(0, scaledHeight - CANVAS_HEIGHT);
    const offsetX = (clamp(focalPoint.x, 0, 100) - 50) / 50;
    const offsetY = (clamp(focalPoint.y, 0, 100) - 50) / 50;
    const translateX = -offsetX * (overflowX / 2);
    const translateY = -offsetY * (overflowY / 2);

    return {
      left: '50%',
      top: '50%',
      width: `${(scaledWidth / CANVAS_WIDTH) * 100}%`,
      height: `${(scaledHeight / CANVAS_HEIGHT) * 100}%`,
      objectFit: 'fill' as const,
      transform: `translate(calc(-50% + ${(translateX / CANVAS_WIDTH) * 100}%), calc(-50% + ${(translateY / CANVAS_HEIGHT) * 100}%))`,
      transformOrigin: 'center center',
    };
  }, [focalPoint.x, focalPoint.y, sourceDimensions, zoom]);

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
    setPreviewImageError(false);
    setSourceDimensions(null);
  }, [sourceUrl]);

  useEffect(() => {
    setFadeAssetError(false);
  }, [fadeEnabled]);

  useEffect(() => {
    setBrandAssetError(false);
  }, [brandAssetUrl]);

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

      <div className="absolute inset-0" style={{ background: FALLBACK_BACKGROUND }} />

      {showPreviewImage ? (
        <img
          src={sourceUrl}
          alt=""
          onLoad={(event) => {
            const target = event.currentTarget;
            setSourceDimensions({
              width: target.naturalWidth || CANVAS_WIDTH,
              height: target.naturalHeight || CANVAS_HEIGHT,
            });
          }}
          onError={() => setPreviewImageError(true)}
          className="absolute max-w-none"
          style={previewImageStyle}
        />
      ) : null}

      <div
        className="absolute inset-0"
        style={{
          zIndex: 10,
          backgroundImage: getGradient(overlayDirection, overlayColor, overlayOpacity),
        }}
      />

      {fadeEnabled ? (
        fadeAssetError ? null : (
          <img
            src="/design-studio/fade.png"
            alt=""
            onError={() => setFadeAssetError(true)}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ zIndex: 20, opacity: clamp(fadeOpacity / 100, 0, 1) }}
          />
        )
      ) : null}

      {designData?.headerText ? (
        <div
          className="absolute"
          style={{
            left: `${(resolvedTextBox.x / CANVAS_WIDTH) * 100}%`,
            top: `${(resolvedTextBox.y / CANVAS_HEIGHT) * 100}%`,
            width: `${(resolvedTextBox.width / CANVAS_WIDTH) * 100}%`,
            height: `${(resolvedTextBox.height / CANVAS_HEIGHT) * 100}%`,
            color: headerColor,
            textAlign: variant.alignment,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: variantKey.startsWith('bottom') ? 'flex-end' : 'flex-start',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '-0.03em',
            fontFamily: '"ScrendlyHeadline", "Impact", "Arial Narrow Bold", sans-serif',
            textShadow: headerColor.toLowerCase() === '#000000' ? 'none' : '0 1px 2px rgba(0,0,0,0.28)',
            zIndex: 30,
          }}
        >
          {fittedHeadline.lines.map((line, index) => (
            <div
              key={`${line}-${index}`}
              style={{
                fontSize: `${Math.max(18, fittedHeadline.fontSize * fontScale * frameScale)}px`,
                lineHeight: `${Math.max(18, fittedHeadline.fontSize * fontScale * lineHeightMultiplier * frameScale)}px`,
              }}
              className="leading-none"
            >
              {line}
            </div>
          ))}
        </div>
      ) : null}

      {brandAssetError ? (
        <div
          className="pointer-events-none absolute rounded-md"
          style={{
            zIndex: 40,
            left: `${(variant.brandBox.x / CANVAS_WIDTH) * 100}%`,
            top: `${(variant.brandBox.y / CANVAS_HEIGHT) * 100}%`,
            width: `${(variant.brandBox.width / CANVAS_WIDTH) * 100}%`,
            height: `${(variant.brandBox.height / CANVAS_HEIGHT) * 100}%`,
            background: brandMode === 'black'
              ? 'linear-gradient(90deg, #050505 0%, #050505 29%, rgba(30,30,30,0.7) 30%, rgba(30,30,30,0.7) 100%)'
              : 'linear-gradient(90deg, #ffffff 0%, #ffffff 29%, rgba(255,255,255,0.44) 30%, rgba(255,255,255,0.44) 100%)',
          }}
        />
      ) : (
        <img
          src={brandAssetUrl}
          alt=""
          onError={() => setBrandAssetError(true)}
          className="pointer-events-none absolute"
          style={{
            zIndex: 40,
            left: `${(variant.brandBox.x / CANVAS_WIDTH) * 100}%`,
            top: `${(variant.brandBox.y / CANVAS_HEIGHT) * 100}%`,
            width: `${(variant.brandBox.width / CANVAS_WIDTH) * 100}%`,
            height: `${(variant.brandBox.height / CANVAS_HEIGHT) * 100}%`,
            objectFit: 'contain',
          }}
        />
      )}
    </div>
  );
}
