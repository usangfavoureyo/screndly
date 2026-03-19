import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import { haptics } from '../../utils/haptics';
import { toast } from "sonner";

interface ThumbnailSettingsProps {
  settings: Record<string, any> | Array<{ key: string; value: unknown }>;
  updateSetting: (key: string, value: any) => Promise<void>;
  onBack: () => void;
}

// Helper to safely find a setting
const findSetting = (settings: ThumbnailSettingsProps['settings'], key: string) => {
  if (Array.isArray(settings)) {
    return settings.find(s => s.key === key)?.value;
  }

  if (settings && typeof settings === 'object') {
    return settings[key];
  }

  return undefined;
};

type LogoPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

type Platform = 'youtube' | 'x';

interface ThumbnailConfig {
  platform: Platform;
  logoPosition: LogoPosition;
  autoScale: boolean;
  maxLogoSize: number;
  autoContrastBackdrop: boolean;
  autoContrastOverlay: boolean;
  showTrailerTypeText: boolean;
}

interface ThumbnailAssetOverride {
  backdropUrl?: string;
  backdropName?: string;
  logoUrl?: string;
  logoName?: string;
}

const LOGO_POSITIONS: Record<LogoPosition, string> = {
  'top-left': 'Top Left',
  'top-center': 'Top Center',
  'top-right': 'Top Right',
  'center-left': 'Center Left',
  'center': 'Center',
  'center-right': 'Center Right',
  'bottom-left': 'Bottom Left',
  'bottom-center': 'Bottom Center',
  'bottom-right': 'Bottom Right'
};

const THUMBNAIL_WIDTH = 1280;
const THUMBNAIL_HEIGHT = 720;

export function ThumbnailSettings({ settings, updateSetting, onBack }: ThumbnailSettingsProps) {
  const [activePlatform, setActivePlatform] = useState<Platform>('youtube');
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpeg'>('png');
  const [assetOverrides, setAssetOverrides] = useState<Record<Platform, ThumbnailAssetOverride>>({
    youtube: {},
    x: {},
  });

  // Default configs
  const defaultYoutubeConfig: ThumbnailConfig = {
    platform: 'youtube',
    logoPosition: 'bottom-right',
    autoScale: true,
    maxLogoSize: 40,
    autoContrastBackdrop: true,
    autoContrastOverlay: true,
    showTrailerTypeText: false
  };

  const defaultXConfig: ThumbnailConfig = {
    platform: 'x',
    logoPosition: 'bottom-right',
    autoScale: true,
    maxLogoSize: 40,
    autoContrastBackdrop: true,
    autoContrastOverlay: true,
    showTrailerTypeText: false
  };

  const [youtubeConfig, setYoutubeConfig] = useState<ThumbnailConfig>(defaultYoutubeConfig);
  const [xConfig, setXConfig] = useState<ThumbnailConfig>(defaultXConfig);

  // Load from DB settings on mount
  useEffect(() => {
    const ytSetting = findSetting(settings, 'thumbnailConfig_youtube');
    if (ytSetting) {
      try {
        const parsed = typeof ytSetting === 'string' ? JSON.parse(ytSetting) : ytSetting;
        if (parsed && typeof parsed === 'object') {
          setYoutubeConfig(prev => ({ ...prev, ...parsed }));
        }
      } catch (e) {
        console.warn('Failed to parse YouTube thumbnail config, using defaults', e);
      }
    }

    const xSetting = findSetting(settings, 'thumbnailConfig_x');
    if (xSetting) {
      try {
        const parsed = typeof xSetting === 'string' ? JSON.parse(xSetting) : xSetting;
        if (parsed && typeof parsed === 'object') {
          setXConfig(prev => ({ ...prev, ...parsed }));
        }
      } catch (e) {
        console.warn('Failed to parse X thumbnail config, using defaults', e);
      }
    }
  }, [settings]);

  // Current active config state
  const currentConfig = activePlatform === 'youtube' ? youtubeConfig : xConfig;
  const currentAssets = assetOverrides[activePlatform];

  const clearActiveAssets = () => {
    setAssetOverrides((prev) => ({
      ...prev,
      [activePlatform]: {},
    }));
  };

  const handleAssetUpload = (field: 'backdropUrl' | 'logoUrl', file?: File | null) => {
    if (!file) {
      return;
    }

    const platform = activePlatform;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : undefined;
      if (!result) {
        toast.error('Failed to load image');
        return;
      }

      setAssetOverrides((prev) => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          [field]: result,
          [field === 'backdropUrl' ? 'backdropName' : 'logoName']: file.name,
        },
      }));
      haptics.light();
      toast.success(`${field === 'backdropUrl' ? 'Backdrop' : 'Logo'} uploaded for ${platform === 'youtube' ? 'YouTube' : 'X'}`);
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });

  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  };

  const drawCoverImage = (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    width: number,
    height: number
  ) => {
    const ratio = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * ratio;
    const drawHeight = image.height * ratio;
    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
  };

  const drawContainImage = (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    const ratio = Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * ratio;
    const drawHeight = image.height * ratio;
    const dx = x + (width - drawWidth) / 2;
    const dy = y + (height - drawHeight) / 2;
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
  };

  const drawDefaultBackdrop = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
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
  };

  const renderThumbnailToCanvas = async (format: 'png' | 'jpeg') => {
    if (typeof document === 'undefined') {
      throw new Error('Thumbnail export is only available in the browser');
    }

    const canvas = document.createElement('canvas');
    canvas.width = THUMBNAIL_WIDTH;
    canvas.height = THUMBNAIL_HEIGHT;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas rendering is unavailable');
    }

    if (currentAssets.backdropUrl) {
      const backdropImage = await loadImage(currentAssets.backdropUrl);
      drawCoverImage(ctx, backdropImage, canvas.width, canvas.height);
    } else {
      drawDefaultBackdrop(ctx, canvas.width, canvas.height);
    }

    if (currentConfig.autoContrastOverlay) {
      ctx.fillStyle = activePlatform === 'youtube' ? 'rgba(0, 0, 0, 0.35)' : 'rgba(12, 12, 12, 0.28)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const boxWidth = Math.min(canvas.width * (currentConfig.maxLogoSize / 100), canvas.width * 0.6);
    const boxHeight = Math.min(canvas.height * 0.25, Math.max(90, boxWidth * 0.28));
    const boxX = currentConfig.logoPosition.includes('left')
      ? 48
      : currentConfig.logoPosition.includes('right')
        ? canvas.width - boxWidth - 48
        : (canvas.width - boxWidth) / 2;
    const boxY = currentConfig.logoPosition.startsWith('top')
      ? 48
      : currentConfig.logoPosition.startsWith('center')
        ? (canvas.height - boxHeight) / 2
        : canvas.height - boxHeight - 64;

    drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 24);
    ctx.fillStyle = 'rgba(18, 18, 18, 0.88)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();

    if (currentAssets.logoUrl) {
      const logoImage = await loadImage(currentAssets.logoUrl);
      drawContainImage(ctx, logoImage, boxX + 20, boxY + 18, boxWidth - 40, boxHeight - 36);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOGO', boxX + boxWidth / 2, boxY + boxHeight / 2 - 8);
    }

    if (currentConfig.showTrailerTypeText) {
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 32px Arial, sans-serif';
      ctx.fillText('OFFICIAL TRAILER', canvas.width / 2, boxY + boxHeight + 24);
    }

    return canvas.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png', format === 'jpeg' ? 0.92 : undefined);
  };

  const handleDownload = async () => {
    try {
      haptics.medium();
      const url = await renderThumbnailToCanvas(downloadFormat);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `thumbnail-${activePlatform}.${downloadFormat === 'jpeg' ? 'jpg' : 'png'}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      toast.success(`Downloaded ${downloadFormat.toUpperCase()} thumbnail`);
    } catch (error) {
      console.error('Failed to export thumbnail', error);
      toast.error('Failed to export thumbnail');
    }
  };

  const handleUpdate = async (updates: Partial<ThumbnailConfig>) => {
    const newConfig = { ...currentConfig, ...updates };
    const key = `thumbnailConfig_${activePlatform}`;

    // Optimistic Update
    if (activePlatform === 'youtube') {
      setYoutubeConfig(newConfig as ThumbnailConfig);
    } else {
      setXConfig(newConfig as ThumbnailConfig);
    }

    haptics.light();

    // Persist to DB
    try {
      await updateSetting(key, JSON.stringify(newConfig));
      toast.success('Settings Saved', {
        description: `${activePlatform === 'youtube' ? 'YouTube' : 'X'} thumbnail settings updated`
      });
    } catch (error) {
      toast.error('Failed to save settings');
      // Revert/Reload could happen here if needed via re-fetch
    }
  };

  const getLogoPositionStyles = (position: LogoPosition): React.CSSProperties => {
    const styles: React.CSSProperties = {
      position: 'absolute',
      width: `${Math.min(currentConfig.maxLogoSize, 60)}%`,
      maxWidth: '60%',
      maxHeight: '40%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.75rem'
    };

    const margin = 16;

    switch (position) {
      case 'top-left': return { ...styles, top: margin, left: margin };
      case 'top-center': return { ...styles, top: margin, left: '50%', transform: 'translateX(-50%)' };
      case 'top-right': return { ...styles, top: margin, right: margin };
      case 'center-left': return { ...styles, top: '50%', left: margin, transform: 'translateY(-50%)' };
      case 'center': return { ...styles, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      case 'center-right': return { ...styles, top: '50%', right: margin, transform: 'translateY(-50%)' };
      case 'bottom-left': return { ...styles, bottom: margin, left: margin };
      case 'bottom-center': return { ...styles, bottom: margin, left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-right': return { ...styles, bottom: margin, right: margin };
      default: return styles;
    }
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 flex items-center gap-3 z-10">
        <button
          className="text-gray-900 dark:text-white p-1"
          onClick={() => {
            haptics.light();
            setAssetOverrides({ youtube: {}, x: {} });
            onBack();
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12H2M9 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-gray-900 dark:text-white text-xl">Thumbnail Overlay</h2>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Info Banner */}
        <div className="bg-white dark:bg-black border border-border rounded-lg p-4 flex gap-3">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ec1e24' }} />
          <div>
            <p className="text-sm text-muted-foreground">
              YouTube and X use the same thumbnail (backdrop + logo). Settings are saved separately per platform.
            </p>
          </div>
        </div>

        {/* Platform Selector */}
        <div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                haptics.light();
                setActivePlatform('youtube');
              }}
              className={`px-4 py-3 rounded-lg transition-all ${activePlatform === 'youtube'
                ? 'bg-[#ec1e24] text-white'
                : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#222222]'
                }`}
            >
              YouTube
            </button>
            <button
              onClick={() => {
                haptics.light();
                setActivePlatform('x');
              }}
              className={`px-4 py-3 rounded-lg transition-all ${activePlatform === 'x'
                ? 'bg-[#ec1e24] text-white'
                : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#222222]'
                }`}
            >
              X (Twitter)
            </button>
          </div>
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Logo Position */}
        <div>
          <Label className="text-gray-900 dark:text-white mb-2 block">Logo Position</Label>
          <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-3">
            Where the movie/TV logo will be placed on the backdrop
          </p>
          <Select
            value={currentConfig.logoPosition}
            onValueChange={(value) => {
              handleUpdate({ logoPosition: value as LogoPosition });
            }}
          >
            <SelectTrigger
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
              onFocus={() => haptics.light()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
              {Object.entries(LOGO_POSITIONS).map(([key, label]) => (
                <SelectItem
                  key={key}
                  value={key}
                  className="text-gray-900 dark:text-white focus:bg-gray-100 dark:focus:bg-[#1A1A1A]"
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Auto Contrast Settings */}
        <div className="space-y-4">
          <div>
            <Label className="text-gray-900 dark:text-white mb-2 block">Smart Contrast</Label>
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-4">
              Automatically ensure logo visibility on any backdrop
            </p>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-gray-900 dark:text-white">Smart Backdrop Selection</Label>
              <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-1">
                When TMDb provides multiple backdrops, automatically select the one with the best contrast for your logo
              </p>
            </div>
            <Switch
              checked={currentConfig.autoContrastBackdrop}
              onCheckedChange={(checked) => {
                haptics.medium();
                handleUpdate({ autoContrastBackdrop: checked });
              }}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-gray-900 dark:text-white">Smart Overlay Adjustment</Label>
              <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-1">
                If the backdrop doesn't have good contrast, apply a subtle dark/light overlay behind the logo area
              </p>
            </div>
            <Switch
              checked={currentConfig.autoContrastOverlay}
              onCheckedChange={(checked) => {
                haptics.medium();
                handleUpdate({ autoContrastOverlay: checked });
              }}
            />
          </div>
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Text Overlay Settings */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label className="text-gray-900 dark:text-white">Show trailer type text under logo</Label>
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-1">
              Automatically adds "OFFICIAL TRAILER" or "OFFICIAL TEASER" text below the logo based on the video title
            </p>
          </div>
          <Switch
            checked={currentConfig.showTrailerTypeText}
            onCheckedChange={(checked) => {
              haptics.medium();
              handleUpdate({ showTrailerTypeText: checked });
            }}
          />
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Auto-Scale Logo */}
        <div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <Label className="text-gray-900 dark:text-white">Auto-Scale Logo</Label>
              <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-1">
                Automatically normalize all logos to the same size. Small logos will be scaled up, large logos will be scaled down to match the target size.
              </p>
            </div>
            <Switch
              checked={currentConfig.autoScale}
              onCheckedChange={(checked) => {
                haptics.medium();
                handleUpdate({ autoScale: checked });
              }}
            />
          </div>

          {currentConfig.autoScale && (
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                    Target Logo Size
                  </Label>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {currentConfig.maxLogoSize}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="5"
                  value={currentConfig.maxLogoSize}
                  onChange={(e) => {
                    handleUpdate({ maxLogoSize: parseInt(e.target.value) });
                  }}
                  onFocus={() => haptics.light()}
                  className="w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ec1e24] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#ec1e24] [&::-moz-range-thumb]:border-0"
                />
              </div>
            </div>
          )}
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Preview */}
        <div>
          <Label className="text-gray-900 dark:text-white mb-3 block">Live Preview</Label>
          <div className="bg-white dark:bg-[#000000] rounded-lg p-4 border border-gray-200 dark:border-[#333333]">
            <div className="grid gap-4 md:grid-cols-2 mb-4">
              <div className="space-y-2">
                <Label className="text-gray-900 dark:text-white">Backdrop Image</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleAssetUpload('backdropUrl', e.target.files?.[0])}
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-[#6B7280]">
                  Optional and local to this page only.
                </p>
                {currentAssets.backdropName && (
                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{currentAssets.backdropName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-gray-900 dark:text-white">Transparent PNG Logo</Label>
                <Input
                  type="file"
                  accept="image/png,image/*"
                  onChange={(e) => handleAssetUpload('logoUrl', e.target.files?.[0])}
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-[#6B7280]">
                  Best results come from a PNG with transparent background.
                </p>
                {currentAssets.logoName && (
                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{currentAssets.logoName}</p>
                )}
              </div>
            </div>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              {currentAssets.backdropUrl ? (
                <img
                  src={currentAssets.backdropUrl}
                  alt="Example backdrop"
                  className="absolute inset-0 w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background: 'linear-gradient(135deg, #13243b 0%, #294b72 46%, #f18b6d 100%)',
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: 'radial-gradient(circle at 72% 24%, rgba(255,238,196,0.78), rgba(255,211,150,0.16) 34%, transparent 62%)',
                    }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-[42%] rounded-b-lg"
                    style={{
                      background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.08) 100%)',
                      clipPath: 'path("M0 78 C180 58 400 118 620 80 C870 34 1100 164 1280 60 L1280 420 L0 420 Z")',
                    }}
                  />
                </div>
              )}
              {currentConfig.autoContrastOverlay && (
                <div className="absolute inset-0 rounded-lg bg-black/25" />
              )}
              <div
                style={getLogoPositionStyles(currentConfig.logoPosition)}
                className="pointer-events-none"
              >
                <div className="w-full rounded-lg border-2 border-white/80 bg-[#1a1a1a]/95 p-3 shadow-2xl backdrop-blur-sm aspect-[16/5] flex items-center justify-center">
                  {currentAssets.logoUrl ? (
                    <img
                      src={currentAssets.logoUrl}
                      alt="Uploaded logo preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-center px-3">
                      <div className="text-white text-xl font-semibold tracking-[0.35em]">LOGO</div>
                      <div className="text-white/70 text-[10px] uppercase mt-2">Transparent PNG</div>
                    </div>
                  )}
                </div>
                {currentConfig.showTrailerTypeText && (
                  <div className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold tracking-[0.28em] text-white shadow-lg">
                    OFFICIAL TRAILER
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#333333]">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-[#9CA3AF]">
                <div>
                  <span className="text-gray-500 dark:text-[#6B7280]">Position:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{LOGO_POSITIONS[currentConfig.logoPosition]}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-[#6B7280]">Backdrop:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{currentAssets.backdropName || 'Default backdrop'}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-[#6B7280]">Logo:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{currentAssets.logoName || 'Default logo indicator'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Label className="text-gray-900 dark:text-white">Export Format</Label>
            <Select value={downloadFormat} onValueChange={(value) => setDownloadFormat(value as 'png' | 'jpeg')}>
              <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="jpeg">JPEG</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                haptics.light();
                clearActiveAssets();
              }}
              className="border-gray-300 dark:border-[#333333] text-gray-900 dark:text-white bg-white dark:bg-[#000000]"
            >
              Clear Uploads
            </Button>
            <Button
              onClick={() => {
                void handleDownload();
              }}
              className="bg-[#ec1e24] text-white hover:bg-[#c81a1f]"
            >
              Download Thumbnail
            </Button>
          </div>
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Reset to Defaults */}
        <Button
          variant="outline"
          onClick={() => {
            haptics.medium();
            clearActiveAssets();
            if (activePlatform === 'youtube') {
              handleUpdate(defaultYoutubeConfig);
            } else {
              handleUpdate(defaultXConfig);
            }
          }}
          className="w-full border-gray-300 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#1A1A1A] bg-white dark:bg-[#000000]"
        >
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
