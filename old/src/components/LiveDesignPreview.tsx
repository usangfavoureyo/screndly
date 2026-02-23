import { DesignData } from './EditDesignBottomSheet';

interface LiveDesignPreviewProps {
  templatePreviewUrl: string;
  designData: DesignData | null;
  aspectRatio: string;
}

export function LiveDesignPreview({ templatePreviewUrl, designData, aspectRatio }: LiveDesignPreviewProps) {
  if (!designData) {
    // Show original template preview
    return (
      <img
        src={templatePreviewUrl}
        alt="Template preview"
        className="w-full h-full object-cover"
      />
    );
  }

  const {
    backgroundImage,
    imageFocalPoint = { x: 50, y: 50 },
    imageZoom = 1.0,
    overlayColor = '#000000',
    overlayOpacity = 70,
    gradientPosition = 'top',
    headerText = '',
    subtext = '',
  } = designData;

  // Calculate background position based on focal point
  const bgPosX = imageFocalPoint.x;
  const bgPosY = imageFocalPoint.y;
  const bgSize = `${imageZoom * 100}%`;

  // Convert opacity 0-100 to hex alpha channel (00-FF)
  const alphaHex = Math.round(overlayOpacity * 2.55).toString(16).padStart(2, '0');

  // Map gradient position to CSS linear-gradient direction
  const gradientDirectionMap: Record<string, string> = {
    top: 'to bottom',
    bottom: 'to top',
    left: 'to right',
    right: 'to left',
  };

  const gradientDirection = gradientDirectionMap[gradientPosition] || 'to bottom';

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Background Image Layer */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : `url(${templatePreviewUrl})`,
          backgroundSize: bgSize,
          backgroundPosition: `${bgPosX}% ${bgPosY}%`,
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Gradient Overlay Layer (simulating solid color adjustment layer with gradient mask) */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(${gradientDirection}, ${overlayColor}${alphaHex} 0%, transparent 100%)`,
        }}
      />

      {/* Text Content Layer */}
      <div className="absolute inset-0 flex flex-col justify-start items-center p-6 pt-12">
        {headerText && (
          <h2
            className="text-white text-center mb-2"
            style={{
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              fontSize: aspectRatio === '9:16' ? '1.5rem' : '1.25rem',
              lineHeight: '1.2',
            }}
          >
            {headerText}
          </h2>
        )}
        {subtext && (
          <p
            className="text-white/90 text-center text-sm"
            style={{
              textShadow: '0 2px 4px rgba(0,0,0,0.4)',
            }}
          >
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}