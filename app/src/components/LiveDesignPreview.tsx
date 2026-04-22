import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchDesignStudioHeadlinePreview,
  type DesignStudioBrandBlockMode,
  type DesignStudioLayoutVariant,
  type DesignStudioTemplateRecord,
} from '../lib/api/designStudio';
import { buildDesignStudioMediaStreamUrl } from '../lib/designStudioMedia';
import { DesignData } from './EditDesignBottomSheet';

interface LiveDesignPreviewProps {
  templatePreviewUrl: string;
  designData: DesignData | null;
  template?: DesignStudioTemplateRecord | null;
  useBackendHeadlinePreview?: boolean;
}

type PreviewLayout = {
  textBox: { x: number; y: number; width: number; height: number };
  alignment: 'left' | 'center' | 'right';
  brandBox: { x: number; y: number; width: number; height: number };
};

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;
const PREVIEW_SAFE_MARGIN = 48;
const DEFAULT_PREVIEW_OVERLAY_OPACITY = 50;
const headlinePreviewCache = new Map<string, string>();
const FALLBACK_BACKGROUND =
  'radial-gradient(circle at 18% 88%, rgba(110, 102, 255, 0.92) 0%, rgba(110, 102, 255, 0.28) 22%, rgba(110, 102, 255, 0) 48%), radial-gradient(circle at 82% 14%, rgba(150, 118, 255, 0.32) 0%, rgba(150, 118, 255, 0) 30%), linear-gradient(180deg, #5b4f8d 0%, #463d78 24%, #2a274f 58%, #171925 100%)';

const PREVIEW_VARIANTS: Record<DesignStudioLayoutVariant, PreviewLayout> = {
  bottom_center: {
    textBox: { x: 48, y: 1042, width: 984, height: 260 },
    alignment: 'center',
    brandBox: { x: 369, y: 48, width: 341, height: 73 },
  },
  bottom_left: {
    textBox: { x: 49, y: 895, width: 982, height: 372 },
    alignment: 'left',
    brandBox: { x: 49, y: 49, width: 341, height: 73 },
  },
  bottom_right: {
    textBox: { x: 49, y: 844, width: 982, height: 423 },
    alignment: 'right',
    brandBox: { x: 688, y: 49, width: 341, height: 73 },
  },
  top_center: {
    textBox: { x: 44, y: 44, width: 992, height: 322 },
    alignment: 'center',
    brandBox: { x: 369, y: 1221, width: 341, height: 73 },
  },
  top_left: {
    textBox: { x: 46, y: 36, width: 988, height: 438 },
    alignment: 'left',
    brandBox: { x: 49, y: 1223, width: 341, height: 73 },
  },
  top_right: {
    textBox: { x: 46, y: 34, width: 988, height: 432 },
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
  densityScale: number,
): PreviewLayout['textBox'] {
  const maxWrapWidth = CANVAS_WIDTH - (PREVIEW_SAFE_MARGIN * 2);
  const nextWidth = clamp(
    layout.textBox.width * widthScale * densityScale,
    layout.textBox.width * 0.70,
    maxWrapWidth,
  );
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

function fitHeadline(
  text: string,
  layout: PreviewLayout,
  textBox: PreviewLayout['textBox'],
  targetWordsPerLine: number,
  lineHeightMultiplier: number,
  fontScale: number,
) {
  const normalizedText = text.replace(/\r\n/g, '\n');
  const hasManualBreaks = normalizedText.includes('\n');
  if (hasManualBreaks) {
    const rawLines = normalizedText.split('\n');
    while (rawLines.length > 0 && rawLines[0].trim().length === 0) rawLines.shift();
    while (rawLines.length > 0 && rawLines[rawLines.length - 1].trim().length === 0) rawLines.pop();
    const manualLines = rawLines.map((line) => line.trim()).filter((line) => line.length > 0);
    if (manualLines.length === 0) {
      return { lines: [], fontSize: 88, lineHeight: 82 };
    }
    const maxFontSize = 96;
    const minFontSize = 34;
    for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
      const scaledFontSize = fontSize * fontScale;
      const lineHeight = scaledFontSize * lineHeightMultiplier;
      const totalHeight = manualLines.length * lineHeight;
      const widestLine = Math.max(...manualLines.map((line) => estimateWordWidth(line, scaledFontSize)));
      if (widestLine <= textBox.width && totalHeight <= textBox.height) {
        return { lines: manualLines, fontSize, lineHeight: fontSize * lineHeightMultiplier };
      }
    }
    const fallbackFontSize = minFontSize;
    return { lines: manualLines, fontSize: fallbackFontSize, lineHeight: fallbackFontSize * lineHeightMultiplier };
  }

  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return { lines: [], fontSize: 88, lineHeight: 82 };
  }

  const maxFontSize = 96;
  const minFontSize = 64;
  const maxLines = layout.alignment === 'center' ? 4 : 5;

  const lineWidth = (lineWords: string[], fontSize: number) =>
    estimateWordWidth(lineWords.join(' '), fontSize * fontScale);

  const buildBalancedLines = (fontSize: number) => {
    const bestByEnd = new Map<string, { lines: string[][]; score: number }>();
    bestByEnd.set('0:0', { lines: [], score: 0 });

    for (let end = 1; end <= words.length; end += 1) {
      for (let lineCount = 1; lineCount <= maxLines; lineCount += 1) {
        let best: { lines: string[][]; score: number } | null = null;

        for (let start = lineCount - 1; start < end; start += 1) {
          const previous = bestByEnd.get(`${start}:${lineCount - 1}`);
          if (!previous) continue;

          const lineWords = words.slice(start, end);
          const width = lineWidth(lineWords, fontSize);
          if ((width > textBox.width && lineWords.length > 1) || lineWords.length > targetWordsPerLine) continue;

          const lineIndex = lineCount - 1;
          const isLastLine = end === words.length;
          const singletonPenalty = words.length > 2 && lineWords.length === 1
            ? (lineIndex > 0 && !isLastLine ? 1_000_000 : 120_000)
            : 0;
          const unusedRatio = clamp((textBox.width - Math.min(width, textBox.width)) / textBox.width, 0, 1);
          const wordTarget = targetWordsPerLine;
          const score = previous.score
            + singletonPenalty
            + Math.abs(lineWords.length - wordTarget) * 18
            + unusedRatio * unusedRatio * 100;
          const candidate = { lines: [...previous.lines, lineWords], score };

          if (!best || candidate.score < best.score) {
            best = candidate;
          }
        }

        if (best) bestByEnd.set(`${end}:${lineCount}`, best);
      }
    }

    const candidates = Array.from({ length: maxLines }, (_, index) => index + 1)
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

  const preferredMinFontSize = Math.max(minFontSize, Math.round(maxFontSize * 0.8));
  for (let fontSize = maxFontSize; fontSize >= preferredMinFontSize; fontSize -= 2) {
    const lines = buildBalancedLines(fontSize);
    const lineHeight = fontSize * fontScale * lineHeightMultiplier;
    if (lines.length > 0 && lines.length <= maxLines && lines.length * lineHeight <= textBox.height) {
      return { lines, fontSize, lineHeight: fontSize * lineHeightMultiplier };
    }
  }

  for (let fontSize = preferredMinFontSize - 2; fontSize >= minFontSize; fontSize -= 2) {
    const lines = buildBalancedLines(fontSize);
    const lineHeight = fontSize * fontScale * lineHeightMultiplier;
    if (lines.length > 0 && lines.length <= maxLines && lines.length * lineHeight <= textBox.height) {
      return { lines, fontSize, lineHeight: fontSize * lineHeightMultiplier };
    }
  }

  const fallbackFontSize = preferredMinFontSize;
  const fallbackLineHeight = fallbackFontSize * lineHeightMultiplier;
  return {
    lines: buildBalancedLines(fallbackFontSize).slice(0, maxLines),
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

function normalizePreviewFontFamily(value?: string): string {
  const normalized = typeof value === 'string' ? value.replace(/["']/g, '').trim() : '';
  if (!normalized) {
    return 'PF Din Text Comp Pro';
  }
  if (normalized.toLowerCase().includes('pfdin')) {
    return 'PF Din Text Comp Pro';
  }
  return normalized;
}

export function LiveDesignPreview({
  templatePreviewUrl,
  designData,
  template,
  useBackendHeadlinePreview = false,
}: LiveDesignPreviewProps) {
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
  const overlayOpacity = designData?.overlayOpacity ?? DEFAULT_PREVIEW_OVERLAY_OPACITY;
  const overlayDirection = designData?.gradientPosition || getDefaultOverlayDirection(variantKey);
  const fadeEnabled = designData?.fadeEnabled ?? true;
  const fadeOpacity = designData?.fadeOpacity ?? 90;
  const fontScale = designData?.fontScale ?? 1;
  const headlineWidthScale = designData?.headlineWidthScale ?? 1;
  const requestedHeadlineDensity = designData?.headlineDensity ?? 1;
  const headlineWords = (designData?.headerText || '').trim().split(/\s+/).filter(Boolean);
  const averageWordLength = headlineWords.length > 0
    ? headlineWords.reduce((sum, word) => sum + word.length, 0) / headlineWords.length
    : 0;
  const headlineDensity = clamp(
    requestedHeadlineDensity + (averageWordLength > 0 && averageWordLength < 5 ? 0.1 : 0),
    0.70,
    2.20,
  );
  const targetWordsPerLine = clamp(Math.round(2 + (headlineDensity * 2)), 2, 8);
  const lineHeightMultiplier = designData?.lineHeightMultiplier ?? 1.1;
  const previewFontFamily = normalizePreviewFontFamily(designData?.fontFamily);
  const useCircleInset = Boolean(designData?.useCircleInset);
  const rawCircleInsetSource = designData?.circleInsetImage || '';
  const circleInsetSource = useMemo(
    () => buildDesignStudioMediaStreamUrl(rawCircleInsetSource) || rawCircleInsetSource,
    [rawCircleInsetSource],
  );
  const circleX = clamp(designData?.circleX ?? 80, 0, 100);
  const circleY = clamp(designData?.circleY ?? 24, 0, 100);
  const circleSize = clamp(designData?.circleSize ?? 220, 80, 420);
  const circleImageZoom = clamp(designData?.circleImageZoom ?? 1, 0.6, 3);
  const circleImageOffsetX = clamp(designData?.circleImageOffsetX ?? 0, -100, 100);
  const circleImageOffsetY = clamp(designData?.circleImageOffsetY ?? 0, -100, 100);
  const circleStrokeWidth = clamp(designData?.circleStrokeWidth ?? 6, 0, 24);
  const circleStrokeColor = designData?.circleStrokeColor || '#FFFFFF';
  const circleImageFit = designData?.circleImageFit === 'cover' ? 'cover' : 'contain';
  const brandMode = resolveBrandMode(designData?.brandBlockMode, headerColor);
  const resolvedTextBox = resolvePreviewTextBox(variant, headlineWidthScale, headlineDensity);
  const fittedHeadline = fitHeadline(
    designData?.headerText || '',
    variant,
    resolvedTextBox,
    targetWordsPerLine,
    lineHeightMultiplier,
    fontScale,
  );
  const headlinePreviewRequestKey = useMemo(() => {
    if (!useBackendHeadlinePreview || !template || !designData?.headerText?.trim()) {
      return null;
    }

    return JSON.stringify({
      templateId: template.id,
      templateUpdatedAt: template.updatedAt,
      templateVariant: designData.templateVariant,
      headerText: designData.headerText,
      headerTextColor: designData.headerTextColor,
      fontScale: designData.fontScale,
      headlineWidthScale: designData.headlineWidthScale,
      headlineDensity: designData.headlineDensity,
      lineHeightMultiplier: designData.lineHeightMultiplier,
    });
  }, [
    designData?.fontScale,
    designData?.headerText,
    designData?.headerTextColor,
    designData?.headlineDensity,
    designData?.headlineWidthScale,
    designData?.lineHeightMultiplier,
    designData?.templateVariant,
    template,
    useBackendHeadlinePreview,
  ]);
  const [headlinePreviewLayerUrl, setHeadlinePreviewLayerUrl] = useState<string | null>(() =>
    headlinePreviewRequestKey ? headlinePreviewCache.get(headlinePreviewRequestKey) || null : null,
  );
  const [isHeadlinePreviewLoading, setIsHeadlinePreviewLoading] = useState(
    Boolean(headlinePreviewRequestKey && !headlinePreviewCache.get(headlinePreviewRequestKey)),
  );
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

  useEffect(() => {
    if (!headlinePreviewRequestKey || !template || !designData?.headerText?.trim()) {
      setIsHeadlinePreviewLoading(false);
      setHeadlinePreviewLayerUrl(null);
      return;
    }

    const cachedLayer = headlinePreviewCache.get(headlinePreviewRequestKey);
    if (cachedLayer) {
      setHeadlinePreviewLayerUrl(cachedLayer);
      setIsHeadlinePreviewLoading(false);
      return;
    }

    setHeadlinePreviewLayerUrl(null);
    setIsHeadlinePreviewLoading(true);

    let isCancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const dataUrl = await fetchDesignStudioHeadlinePreview({
          template,
          data: {
            template_variant: designData.templateVariant,
            headerText: designData.headerText,
            headerTextColor: designData.headerTextColor,
            fontScale: designData.fontScale,
            headlineWidthScale: designData.headlineWidthScale,
            headlineDensity: designData.headlineDensity,
            lineHeightMultiplier: designData.lineHeightMultiplier,
          },
        }, {
          signal: controller.signal,
          timeout: 15000,
        });

        if (!isCancelled) {
          headlinePreviewCache.set(headlinePreviewRequestKey, dataUrl);
          setHeadlinePreviewLayerUrl(dataUrl);
          setIsHeadlinePreviewLoading(false);
        }
      } catch (error) {
        if (!isCancelled && !(error instanceof Error && error.name === 'AbortError')) {
          console.error('Design Studio headline preview failed:', error);
          setHeadlinePreviewLayerUrl(null);
          setIsHeadlinePreviewLoading(false);
        }
      }
    }, 40);

    return () => {
      isCancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [designData?.headerText, headlinePreviewRequestKey, template]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      <style>{`
        @font-face {
          font-family: 'PF Din Text Comp Pro';
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

      {useCircleInset && circleInsetSource ? (
        <div
          className="absolute overflow-hidden rounded-full"
          style={{
            zIndex: 25,
            left: `${circleX}%`,
            top: `${circleY}%`,
            width: `${(circleSize / CANVAS_WIDTH) * 100}%`,
            height: `${(circleSize / CANVAS_HEIGHT) * 100}%`,
            transform: 'translate(-50%, -50%)',
            border: `${Math.max(1, circleStrokeWidth)}px solid ${circleStrokeColor}`,
          }}
        >
          <img
            src={circleInsetSource}
            alt=""
            className={`absolute h-full w-full ${circleImageFit === 'cover' ? 'object-cover' : 'object-contain'}`}
            style={{
              transform: `translate(${circleImageOffsetX}%, ${circleImageOffsetY}%) scale(${circleImageZoom})`,
              transformOrigin: 'center center',
            }}
          />
        </div>
      ) : null}

      {headlinePreviewLayerUrl ? (
        <img
          src={headlinePreviewLayerUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ zIndex: 30 }}
        />
      ) : designData?.headerText?.trim() && !useBackendHeadlinePreview ? (
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
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0',
            fontFamily: `"${previewFontFamily}", "PF Din Text Comp Pro"`,
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

      {useBackendHeadlinePreview && isHeadlinePreviewLoading ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 31 }}
        >
          <div className="rounded-full bg-black/55 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/85">
            Updating Preview
          </div>
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
