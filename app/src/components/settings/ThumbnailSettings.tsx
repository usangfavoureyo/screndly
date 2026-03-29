import { useState, useEffect } from 'react';
import { ChevronDownIcon, Info } from 'lucide-react';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import { BackIconButton } from '../BackIconButton';
import { BottomSheet, BottomSheetBody, BottomSheetFooter, BottomSheetHeader, BottomSheetTitle } from '../ui/bottom-sheet';
import { MediaPreviewDialog } from '../media/MediaPreviewDialog';
import { haptics } from '../../utils/haptics';
import { toast } from "sonner";
import { uploadToBackblaze } from '../../utils/backblaze';
import { apiClient } from '../../lib/api/client';
import {
  detectOverlayType,
  getLogoFrameMetrics,
  getTrailerLabelMetrics,
  renderThumbnailPreviewResult,
  shouldUseThumbnailLogoShadow,
  type ThumbnailConfig,
  type LogoPosition,
  type BrandedOverlayAssetKey,
  type BrandedOverlayAssets,
  type BrandedOverlayAppearanceMode,
  type BrandedOverlayVariant,
} from '../../utils/thumbnailRenderer';

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

type Platform = 'youtube' | 'x';

interface ThumbnailAssetOverride {
  backdropUrl?: string;
  backdropName?: string;
  logoUrl?: string;
  logoName?: string;
  manualOverlayUrl?: string;
  manualOverlayName?: string;
  manualSavedOverlayKey?: BrandedOverlayAssetKey;
}

const BRANDED_ASSET_GROUPS: Array<{
  label: string;
  type: 'trailer' | 'teaser' | 'clip' | 'sneak_peek';
}> = [
  { label: 'Trailer', type: 'trailer' },
  { label: 'Teaser', type: 'teaser' },
  { label: 'Clip', type: 'clip' },
  { label: 'Sneak Peek', type: 'sneak_peek' },
];

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
  const [isDownloadSheetOpen, setIsDownloadSheetOpen] = useState(false);
  const [isLogoStyleSheetOpen, setIsLogoStyleSheetOpen] = useState(false);
  const [isBrandedAppearanceSheetOpen, setIsBrandedAppearanceSheetOpen] = useState(false);
  const [isExpandedPreviewOpen, setIsExpandedPreviewOpen] = useState(false);
  const [expandedPreviewSrc, setExpandedPreviewSrc] = useState<string | null>(null);
  const [isGeneratingExpandedPreview, setIsGeneratingExpandedPreview] = useState(false);
  const [shouldApplyPreviewLogoShadow, setShouldApplyPreviewLogoShadow] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('Official Trailer');
  const [previewOutput, setPreviewOutput] = useState<string | null>(null);
  const [previewDetectedType, setPreviewDetectedType] = useState<string | null>(null);
  const [previewDetectedVariant, setPreviewDetectedVariant] = useState<string | null>(null);
  const [previewResolvedAssetKey, setPreviewResolvedAssetKey] = useState<string | null>(null);
  const [brandedAssetPreviewUrls, setBrandedAssetPreviewUrls] = useState<Record<Platform, Partial<Record<BrandedOverlayAssetKey, string>>>>({
    youtube: {},
    x: {},
  });
  const [assetOverrides, setAssetOverrides] = useState<Record<Platform, ThumbnailAssetOverride>>({
    youtube: {},
    x: {},
  });

  // Default configs
  const defaultYoutubeConfig: ThumbnailConfig = {
    platform: 'youtube',
    logoPosition: 'bottom-right',
    logoDisplayMode: 'boxed',
    autoScale: true,
    maxLogoSize: 40,
    trailerTextSize: 32,
    autoContrastBackdrop: true,
    autoContrastOverlay: true,
    showTrailerTypeText: false,
    brandedOverlayAssets: {},
    brandedOverlayAppearanceMode: 'adaptive',
    brandedOverlayFixedVariant: 'white',
  };

  const defaultXConfig: ThumbnailConfig = {
    platform: 'x',
    logoPosition: 'bottom-right',
    logoDisplayMode: 'boxed',
    autoScale: true,
    maxLogoSize: 40,
    trailerTextSize: 32,
    autoContrastBackdrop: true,
    autoContrastOverlay: true,
    showTrailerTypeText: false,
    brandedOverlayAssets: {},
    brandedOverlayAppearanceMode: 'adaptive',
    brandedOverlayFixedVariant: 'white',
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
  const currentBrandedPreviewUrls = brandedAssetPreviewUrls[activePlatform] || {};
  const isBrandedStyle = currentConfig.logoDisplayMode === 'branded';
  const usesStandardLogoControls = !isBrandedStyle;
  const brandedAssetEntries = Object.entries(currentConfig.brandedOverlayAssets || {}) as Array<[BrandedOverlayAssetKey, string]>;
  const brandedAppearanceLabel = currentConfig.brandedOverlayAppearanceMode === 'fixed'
    ? `Fixed ${currentConfig.brandedOverlayFixedVariant === 'black' ? 'Black' : 'White'}`
    : 'Adaptive';
  const resolvedManualOverlayUrl = currentAssets.manualOverlayUrl
    || (currentAssets.manualSavedOverlayKey
      ? currentBrandedPreviewUrls[currentAssets.manualSavedOverlayKey] || currentConfig.brandedOverlayAssets?.[currentAssets.manualSavedOverlayKey]
      : undefined);
  const resolvedManualOverlayLabel = currentAssets.manualOverlayName
    || currentAssets.manualSavedOverlayKey
    || null;
  const fixedPreviewAssetKey = isBrandedStyle && currentConfig.brandedOverlayAppearanceMode === 'fixed'
    ? ((() => {
      const type = detectOverlayType(previewTitle);
      const preferredVariant = currentConfig.brandedOverlayFixedVariant || 'white';
      const typedKey = `${type}_${preferredVariant}` as BrandedOverlayAssetKey;
      const trailerKey = `trailer_${preferredVariant}` as BrandedOverlayAssetKey;
      if (currentConfig.brandedOverlayAssets?.[typedKey]) {
        return typedKey;
      }
      if (currentConfig.brandedOverlayAssets?.[trailerKey]) {
        return trailerKey;
      }
      return undefined;
    })())
    : undefined;
  const brandedPreviewFallbackUrl = resolvedManualOverlayUrl
    || (fixedPreviewAssetKey
      ? currentBrandedPreviewUrls[fixedPreviewAssetKey]
        || currentConfig.brandedOverlayAssets?.[fixedPreviewAssetKey]
      : undefined)
    || (previewResolvedAssetKey
      ? currentBrandedPreviewUrls[previewResolvedAssetKey as BrandedOverlayAssetKey]
        || currentConfig.brandedOverlayAssets?.[previewResolvedAssetKey as BrandedOverlayAssetKey]
      : undefined);

  const resolveAssetPreviewUrl = async (url: string): Promise<string> => {
    const response = await apiClient.post<{ url: string; previewUrl: string }>('/api/create/asset-preview', { url });
    if (!response.success || !response.data?.previewUrl) {
      throw new Error(response.error?.message || 'Failed to resolve overlay preview');
    }
    return response.data.previewUrl;
  };

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

  const updateBrandedAssets = async (nextAssets: BrandedOverlayAssets) => {
    await handleUpdate({ brandedOverlayAssets: nextAssets });
  };

  const handleManualOverlayUpload = (file?: File | null) => {
    if (!file) {
      return;
    }

    const platform = activePlatform;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : undefined;
      if (!result) {
        toast.error('Failed to load overlay');
        return;
      }

      setAssetOverrides((prev) => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          manualOverlayUrl: result,
          manualOverlayName: file.name,
          manualSavedOverlayKey: undefined,
        },
      }));
      haptics.light();
      toast.success('Manual preview overlay loaded');
    };
    reader.onerror = () => {
      toast.error('Failed to read overlay file');
    };
    reader.readAsDataURL(file);
  };

  const handleManualSavedOverlaySelect = (value: string) => {
    const platform = activePlatform;
    const nextKey = value === 'none' ? undefined : value as BrandedOverlayAssetKey;
    setAssetOverrides((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        manualSavedOverlayKey: nextKey,
        manualOverlayUrl: undefined,
        manualOverlayName: undefined,
      },
    }));
    haptics.light();
  };

  const handleBrandedAssetUpload = async (assetKey: BrandedOverlayAssetKey, file?: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Overlay must be an image');
      return;
    }

    if (!/png/i.test(file.type) && !/\.png$/i.test(file.name)) {
      toast.warning('PNG with transparency is recommended for branded overlays');
    }

    try {
      haptics.medium();
      const result = await uploadToBackblaze({ file });
      if (!result.success || !result.url) {
        toast.error(result.error || 'Failed to upload branded overlay');
        return;
      }

      const nextAssets = {
        ...(currentConfig.brandedOverlayAssets || {}),
        [assetKey]: result.url,
      };
      await updateBrandedAssets(nextAssets);
      try {
        const previewUrl = await resolveAssetPreviewUrl(result.url);
        setBrandedAssetPreviewUrls((prev) => ({
          ...prev,
          [activePlatform]: {
            ...prev[activePlatform],
            [assetKey]: previewUrl,
          },
        }));
      } catch (error) {
        console.warn(`Failed to resolve branded overlay preview for ${assetKey} immediately after upload`, error);
        if (result.previewUrl) {
          setBrandedAssetPreviewUrls((prev) => ({
            ...prev,
            [activePlatform]: {
              ...prev[activePlatform],
              [assetKey]: result.previewUrl!,
            },
          }));
        }
      }
      toast.success('Branded overlay saved');
    } catch (error) {
      console.error('Failed to upload branded overlay asset', error);
      toast.error('Failed to upload branded overlay');
    }
  };

  const handleBrandedAssetRemove = async (assetKey: BrandedOverlayAssetKey) => {
    const nextAssets = { ...(currentConfig.brandedOverlayAssets || {}) };
    delete nextAssets[assetKey];
    await updateBrandedAssets(nextAssets);
    setBrandedAssetPreviewUrls((prev) => {
      const nextPlatformPreviews = { ...(prev[activePlatform] || {}) };
      delete nextPlatformPreviews[assetKey];
      return {
        ...prev,
        [activePlatform]: nextPlatformPreviews,
      };
    });
    haptics.light();
    toast.success('Branded overlay removed');
  };

  const renderThumbnailToCanvas = async (format: 'png' | 'jpeg') => {
    const result = await renderThumbnailPreviewResult(currentConfig, {
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_HEIGHT,
      backdropUrl: currentAssets.backdropUrl,
      logoUrl: currentAssets.logoUrl,
      title: previewTitle,
      trailerLabel: null,
      brandedOverlayAssets: currentConfig.brandedOverlayAssets,
      manualOverlayUrl: resolvedManualOverlayUrl,
      format,
    });

    return result;
  };

  const handleBrandedAppearanceUpdate = async (
    mode: BrandedOverlayAppearanceMode,
    fixedVariant?: BrandedOverlayVariant
  ) => {
    await handleUpdate({
      brandedOverlayAppearanceMode: mode,
      brandedOverlayFixedVariant: fixedVariant ?? currentConfig.brandedOverlayFixedVariant ?? 'white',
    });
  };

  const openExpandedPreview = async () => {
    try {
      haptics.light();
      setIsGeneratingExpandedPreview(true);
      const previewResult = await renderThumbnailToCanvas('png');
      setExpandedPreviewSrc(previewResult.dataUrl);
      setIsExpandedPreviewOpen(true);
    } catch (error) {
      console.error('Failed to generate expanded thumbnail preview', error);
      toast.error('Failed to open expanded preview');
    } finally {
      setIsGeneratingExpandedPreview(false);
    }
  };

  const handleDownload = async () => {
    try {
      haptics.medium();
      const previewResult = await renderThumbnailToCanvas(downloadFormat);
      const anchor = document.createElement('a');
      anchor.href = previewResult.dataUrl;
      const inferredKey = previewResult.resolvedAssetKey || 'thumbnail-preview';
      anchor.download = `thumbnail-preview-${inferredKey}.${downloadFormat === 'jpeg' ? 'jpg' : 'png'}`;
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

  const getPreviewLogoBoxMetrics = (config: ThumbnailConfig) => {
    const { boxWidth, boxHeight, boxX, boxY } = getLogoFrameMetrics(config);
    return {
      boxWidth,
      boxHeight,
      left: `${(boxX / THUMBNAIL_WIDTH) * 100}%`,
      top: `${(boxY / THUMBNAIL_HEIGHT) * 100}%`,
      width: `${(boxWidth / THUMBNAIL_WIDTH) * 100}%`,
      height: `${(boxHeight / THUMBNAIL_HEIGHT) * 100}%`,
    };
  };

  const previewLogoBox = getPreviewLogoBoxMetrics(currentConfig);
  const previewLogoPadding = `${Math.max(10, currentConfig.maxLogoSize * 0.16)}% ${Math.max(8, currentConfig.maxLogoSize * 0.14)}%`;
  const shouldShowPreviewBox = currentConfig.logoDisplayMode === 'boxed';
  const previewTrailerLabel = currentConfig.showTrailerTypeText ? 'OFFICIAL TRAILER' : null;
  const previewTrailerMetrics = getTrailerLabelMetrics(currentConfig);
  const previewTextSizePx = Math.max(10, Math.round((previewTrailerMetrics.fontSize / THUMBNAIL_WIDTH) * 360));

  useEffect(() => {
    let isCancelled = false;

    if (isBrandedStyle || !currentConfig.autoContrastOverlay || shouldShowPreviewBox || !currentAssets.logoUrl) {
      setShouldApplyPreviewLogoShadow(false);
      return;
    }

    void shouldUseThumbnailLogoShadow(currentConfig, {
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_HEIGHT,
      backdropUrl: currentAssets.backdropUrl,
      logoUrl: currentAssets.logoUrl,
    }).then((nextValue) => {
      if (!isCancelled) {
        setShouldApplyPreviewLogoShadow(nextValue);
      }
    }).catch((error) => {
      console.warn('Failed to evaluate thumbnail preview contrast helper:', error);
      if (!isCancelled) {
        setShouldApplyPreviewLogoShadow(true);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    currentAssets.backdropUrl,
    currentAssets.logoUrl,
    currentConfig,
    isBrandedStyle,
    shouldShowPreviewBox,
  ]);

  useEffect(() => {
    let cancelled = false;
    const assets = currentConfig.brandedOverlayAssets || {};
    const entries = Object.entries(assets) as Array<[BrandedOverlayAssetKey, string]>;

    if (entries.length === 0) {
      setBrandedAssetPreviewUrls((prev) => ({
        ...prev,
        [activePlatform]: {},
      }));
      return;
    }

    void (async () => {
      const resolvedEntries = await Promise.all(
        entries.map(async ([assetKey, assetUrl]) => {
          try {
            const previewUrl = await resolveAssetPreviewUrl(assetUrl);
            return [assetKey, previewUrl] as const;
          } catch (error) {
            console.warn(`Failed to resolve branded asset preview for ${assetKey}`, error);
            return [assetKey, assetUrl] as const;
          }
        })
      );

      if (cancelled) {
        return;
      }

      setBrandedAssetPreviewUrls((prev) => ({
        ...prev,
        [activePlatform]: Object.fromEntries(resolvedEntries),
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [activePlatform, currentConfig.brandedOverlayAssets]);

  useEffect(() => {
    let cancelled = false;

    void renderThumbnailToCanvas('png')
      .then((result) => {
        if (cancelled) {
          return;
        }
        setPreviewOutput(result.dataUrl);
        setPreviewDetectedType(result.detectedType || null);
        setPreviewDetectedVariant(result.detectedVariant || null);
        setPreviewResolvedAssetKey(result.resolvedAssetKey || null);
      })
      .catch((error) => {
        console.error('Failed to generate thumbnail preview', error);
        if (!cancelled) {
          setPreviewOutput(null);
          setPreviewDetectedType(null);
          setPreviewDetectedVariant(null);
          setPreviewResolvedAssetKey(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activePlatform,
    currentAssets.backdropUrl,
    currentAssets.logoUrl,
    currentAssets.manualOverlayUrl,
    currentAssets.manualSavedOverlayKey,
    currentConfig,
    previewTitle,
  ]);

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 flex items-center gap-3 z-10">
        <BackIconButton
          onClick={onBack}
          className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-1"
          ariaLabel="Back to settings"
        />
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
              YouTube and X use the same thumbnail pipeline (TMDb backdrop + logo). For TV trailers, Screndly now detects season markers and prefers the matching TMDb season poster for social covers while keeping the series backdrop/logo for landscape thumbnails. Settings are saved separately per platform.
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

        <div>
          <Label className="text-gray-900 dark:text-white mb-2 block">Thumbnail Style</Label>
          <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-3">
            Choose whether the logo appears by itself or inside the overlay box.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              haptics.light();
              setIsLogoStyleSheetOpen(true);
            }}
            className="w-full justify-between border-gray-300 dark:border-[#333333] text-gray-900 dark:text-white bg-white dark:bg-[#000000]"
          >
            <span>
              {currentConfig.logoDisplayMode === 'boxed'
                ? 'Logo inside box'
                : currentConfig.logoDisplayMode === 'branded'
                  ? 'Branded'
                  : 'Logo only'}
            </span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {isBrandedStyle && (
          <>
            <div>
              <Label className="text-gray-900 dark:text-white mb-2 block">Appearance</Label>
              <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-3">
                Adaptive picks the best white or black branded asset automatically. Fixed always uses the selected variant when available.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  haptics.light();
                  setIsBrandedAppearanceSheetOpen(true);
                }}
                className="w-full justify-between border-gray-300 dark:border-[#333333] text-gray-900 dark:text-white bg-white dark:bg-[#000000]"
              >
                <span>{brandedAppearanceLabel}</span>
                <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </div>

            <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

            <div className="space-y-4">
              <div>
                <Label className="text-gray-900 dark:text-white mb-2 block">Branded Overlay Assets</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-4">
                  Upload full-frame 1280×720 overlay PNGs for each content type and contrast variant.
                </p>
              </div>

              {BRANDED_ASSET_GROUPS.map((group) => (
                <div key={group.type} className="rounded-2xl border border-gray-200 dark:border-[#333333] p-4 space-y-4">
                  <div>
                    <p className="text-gray-900 dark:text-white">{group.label}</p>
                  </div>
                  {(['white', 'black'] as const).map((variant) => {
                     const assetKey = `${group.type}_${variant}` as BrandedOverlayAssetKey;
                     const assetUrl = currentConfig.brandedOverlayAssets?.[assetKey];
                     const assetPreviewUrl = currentBrandedPreviewUrls[assetKey] || assetUrl;
                     return (
                      <div key={assetKey} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                            Upload {variant === 'white' ? 'White' : 'Black'}
                          </Label>
                          <span className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-gray-700 dark:border-[#333333] dark:text-gray-300">
                            {assetKey}
                          </span>
                        </div>
                        <Input
                          type="file"
                          accept="image/png,image/*"
                          onChange={(e) => void handleBrandedAssetUpload(assetKey, e.target.files?.[0])}
                          className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-[#6B7280]">
                          Expected file: transparent PNG, recommended 1280×720.
                        </p>
                        {assetUrl && (
                          <div className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-[#333333] p-3">
                            <img
                              src={assetPreviewUrl}
                              alt={`${assetKey} preview`}
                              className="h-16 w-28 rounded-md object-cover border border-gray-200 dark:border-[#333333]"
                            />
                            <div className="flex-1 space-y-2">
                              <p className="text-xs text-gray-700 dark:text-gray-300 break-all">{assetKey}</p>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="border-gray-300 dark:border-[#333333] text-gray-900 dark:text-white bg-white dark:bg-[#000000]"
                                  onClick={() => handleBrandedAssetRemove(assetKey)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />
          </>
        )}

        {usesStandardLogoControls && (
          <>
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

            {currentConfig.showTrailerTypeText && (
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                      Target Text Size
                    </Label>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {currentConfig.trailerTextSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="18"
                    max="56"
                    step="2"
                    value={currentConfig.trailerTextSize ?? 32}
                    onChange={(e) => {
                      handleUpdate({ trailerTextSize: parseInt(e.target.value, 10) });
                    }}
                    onFocus={() => haptics.light()}
                    className="w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ec1e24] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#ec1e24] [&::-moz-range-thumb]:border-0"
                  />
                </div>
              </div>
            )}

            <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

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
                      max="100"
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
          </>
        )}

        {/* Preview */}
        <div>
          <Label className="text-gray-900 dark:text-white mb-3 block">Live Preview</Label>
          <div className="bg-white dark:bg-[#000000] rounded-lg p-4 border border-gray-200 dark:border-[#333333]">
            <div className={`grid gap-4 mb-4 ${usesStandardLogoControls ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
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
              {usesStandardLogoControls && (
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
              )}
            </div>
            <div className={`grid gap-4 mb-4 ${isBrandedStyle ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
              <div className="space-y-2">
                <Label className="text-gray-900 dark:text-white">Preview Title</Label>
                <Input
                  value={previewTitle}
                  onChange={(e) => setPreviewTitle(e.target.value)}
                  placeholder="Official Trailer"
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
                />
              </div>
              {isBrandedStyle && (
                <div className="space-y-2">
                  <Label className="text-gray-900 dark:text-white">Manual Overlay (Preview Only)</Label>
                  <Input
                    type="file"
                    accept="image/png,image/*"
                    onChange={(e) => handleManualOverlayUpload(e.target.files?.[0])}
                    className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
                  />
                  <Select
                    value={currentAssets.manualSavedOverlayKey || 'none'}
                    onValueChange={handleManualSavedOverlaySelect}
                  >
                    <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white">
                      <SelectValue placeholder="Choose saved branded overlay" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {brandedAssetEntries.map(([assetKey]) => (
                        <SelectItem key={assetKey} value={assetKey}>
                          {assetKey}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 dark:text-[#6B7280]">
                    Choose a device file or one of the saved branded overlays. This overrides automatic selection for preview only.
                  </p>
                  {resolvedManualOverlayLabel && (
                    <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{resolvedManualOverlayLabel}</p>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void openExpandedPreview()}
              disabled={isGeneratingExpandedPreview}
              className="relative block w-full text-left disabled:cursor-wait"
              aria-label="Open expanded thumbnail preview"
            >
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <div className="absolute inset-0 overflow-hidden rounded-lg">
                {isBrandedStyle && previewOutput ? (
                  <img
                    src={previewOutput}
                    alt="Branded thumbnail preview"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : currentAssets.backdropUrl ? (
                  <img
                    src={currentAssets.backdropUrl}
                    alt="Example backdrop"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(135deg, #13243b 0%, #294b72 46%, #f18b6d 100%)',
                    }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        background: 'radial-gradient(circle at 72% 24%, rgba(255,238,196,0.78), rgba(255,211,150,0.16) 34%, transparent 62%)',
                      }}
                    />
                    <div
                      className="absolute inset-x-0 bottom-0 h-[42%]"
                      style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.08) 100%)',
                        clipPath: 'path("M0 78 C180 58 400 118 620 80 C870 34 1100 164 1280 60 L1280 420 L0 420 Z")',
                      }}
                    />
                  </div>
                )}
                {isBrandedStyle && !previewOutput && brandedPreviewFallbackUrl ? (
                  <img
                    src={brandedPreviewFallbackUrl}
                    alt="Branded overlay preview"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                {!isBrandedStyle && (
                  <div
                    style={{
                      position: 'absolute',
                      left: previewLogoBox.left,
                      top: previewLogoBox.top,
                      width: previewLogoBox.width,
                      height: previewLogoBox.height,
                    }}
                    className="pointer-events-none"
                  >
                    <div
                      className={`flex h-full w-full items-center justify-center shadow-2xl ${shouldShowPreviewBox ? 'rounded-lg border-2 border-white/80 bg-[#1a1a1a]/95 backdrop-blur-sm' : ''}`}
                      style={shouldShowPreviewBox ? { padding: previewLogoPadding } : undefined}
                    >
                      {currentAssets.logoUrl ? (
                        <img
                          src={currentAssets.logoUrl}
                          alt="Uploaded logo preview"
                          className={`object-contain ${shouldShowPreviewBox ? 'max-h-full max-w-full' : 'h-full w-full'}`}
                          style={shouldApplyPreviewLogoShadow ? { filter: 'drop-shadow(0 8px 18px rgba(0, 0, 0, 0.62))' } : undefined}
                        />
                      ) : (
                        <div className={`bg-white/[0.02] ${shouldShowPreviewBox ? 'h-full w-full rounded-[inherit] border border-white/10' : 'h-1.5 w-[70%] rounded-full border border-white/10'}`} />
                      )}
                    </div>
                  </div>
                )}
                {!isBrandedStyle && previewTrailerLabel && (
                  <div
                    className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap font-semibold tracking-[0.28em] text-white"
                    style={{
                      left: `${(previewTrailerMetrics.centerX / THUMBNAIL_WIDTH) * 100}%`,
                      top: `${(previewTrailerMetrics.top / THUMBNAIL_HEIGHT) * 100}%`,
                      fontSize: `${previewTextSizePx}px`,
                      textShadow: '0 3px 12px rgba(0, 0, 0, 0.72)',
                    }}
                  >
                    {previewTrailerLabel}
                  </div>
                )}
              </div>
            </div>
            </button>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#333333]">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-[#9CA3AF]">
                <div>
                  <span className="text-gray-500 dark:text-[#6B7280]">Backdrop:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{currentAssets.backdropName || 'Default backdrop'}</span>
                </div>
                {usesStandardLogoControls && (
                  <>
                    <div>
                      <span className="text-gray-500 dark:text-[#6B7280]">Position:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{LOGO_POSITIONS[currentConfig.logoPosition]}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-[#6B7280]">Logo:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{currentAssets.logoName || 'Default logo indicator'}</span>
                    </div>
                  </>
                )}
                {isBrandedStyle && (
                  <>
                    <div>
                      <span className="text-gray-500 dark:text-[#6B7280]">Detected type:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{previewDetectedType || 'trailer'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-[#6B7280]">Variant:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{previewDetectedVariant || 'white'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-[#6B7280]">Resolved asset:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{previewResolvedAssetKey || (resolvedManualOverlayLabel ? 'manual_overlay' : 'none')}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                haptics.light();
                setIsDownloadSheetOpen(true);
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

      <BottomSheet open={isLogoStyleSheetOpen} onOpenChange={setIsLogoStyleSheetOpen}>
        <BottomSheetHeader>
          <BottomSheetTitle>Thumbnail Style</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => {
                haptics.medium();
                void handleUpdate({ logoDisplayMode: 'logo-only' });
                setIsLogoStyleSheetOpen(false);
              }}
              className={`rounded-2xl border p-4 text-left transition-all ${currentConfig.logoDisplayMode === 'logo-only' ? 'border-[#ec1e24] bg-[#ec1e24]/10 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white'}`}
            >
              <p className="mb-1">Logo only</p>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Render the logo directly without the overlay box.</p>
            </button>
            <button
              type="button"
              onClick={() => {
                haptics.medium();
                void handleUpdate({ logoDisplayMode: 'boxed' });
                setIsLogoStyleSheetOpen(false);
              }}
              className={`rounded-2xl border p-4 text-left transition-all ${currentConfig.logoDisplayMode === 'boxed' ? 'border-[#ec1e24] bg-[#ec1e24]/10 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white'}`}
            >
              <p className="mb-1">Logo inside box</p>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Keep the logo inside the overlay frame.</p>
            </button>
            <button
              type="button"
              onClick={() => {
                haptics.medium();
                void handleUpdate({ logoDisplayMode: 'branded' });
                setIsLogoStyleSheetOpen(false);
              }}
              className={`rounded-2xl border p-4 text-left transition-all ${currentConfig.logoDisplayMode === 'branded' ? 'border-[#ec1e24] bg-[#ec1e24]/10 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white'}`}
            >
              <p className="mb-1">Branded</p>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Use a full-frame overlay asset with the logo and label already built in.</p>
            </button>
          </div>
        </BottomSheetBody>
      </BottomSheet>

      <BottomSheet open={isDownloadSheetOpen} onOpenChange={setIsDownloadSheetOpen}>
        <BottomSheetHeader>
          <BottomSheetTitle>Download Thumbnail</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                haptics.light();
                setDownloadFormat('png');
              }}
              className={`rounded-2xl border p-4 text-left transition-all ${downloadFormat === 'png' ? 'border-[#ec1e24] bg-[#ec1e24]/10 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white'}`}
            >
              <p className="mb-1">PNG</p>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Higher quality with transparency support.</p>
            </button>
            <button
              type="button"
              onClick={() => {
                haptics.light();
                setDownloadFormat('jpeg');
              }}
              className={`rounded-2xl border p-4 text-left transition-all ${downloadFormat === 'jpeg' ? 'border-[#ec1e24] bg-[#ec1e24]/10 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white'}`}
            >
              <p className="mb-1">JPEG</p>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Smaller file size for quick sharing.</p>
            </button>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsDownloadSheetOpen(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#ec1e24] text-white hover:bg-[#c81a1f]"
              onClick={() => {
                setIsDownloadSheetOpen(false);
                void handleDownload();
              }}
            >
              Download
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      <BottomSheet open={isBrandedAppearanceSheetOpen} onOpenChange={setIsBrandedAppearanceSheetOpen}>
        <BottomSheetHeader>
          <BottomSheetTitle>Appearance</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody className="space-y-4">
          <button
            type="button"
            onClick={() => {
              haptics.medium();
              void handleBrandedAppearanceUpdate('adaptive').then(() => {
                setIsBrandedAppearanceSheetOpen(false);
              });
            }}
            className={`w-full rounded-2xl border p-4 text-left transition-all ${currentConfig.brandedOverlayAppearanceMode === 'adaptive' ? 'border-[#ec1e24] bg-[#ec1e24]/10 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white'}`}
          >
            <p className="mb-1">Adaptive</p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Let the system choose the white or black branded overlay asset based on the backdrop.
            </p>
          </button>

          <div className="rounded-2xl border border-gray-200 p-4 dark:border-[#333333]">
            <p className="mb-1 text-gray-900 dark:text-white">Fixed</p>
            <p className="mb-4 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Always use a single branded overlay variant for this platform.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(['white', 'black'] as const).map((variant) => {
                const isSelected = currentConfig.brandedOverlayAppearanceMode === 'fixed'
                  && currentConfig.brandedOverlayFixedVariant === variant;
                return (
                  <button
                    key={variant}
                    type="button"
                    onClick={() => {
                      haptics.medium();
                      void handleBrandedAppearanceUpdate('fixed', variant).then(() => {
                        setIsBrandedAppearanceSheetOpen(false);
                      });
                    }}
                    className={`rounded-2xl border p-4 text-left transition-all ${isSelected ? 'border-[#ec1e24] bg-[#ec1e24]/10 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white'}`}
                  >
                    <p className="mb-1">{variant === 'white' ? 'White' : 'Black'}</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      {variant === 'white' ? 'Only use `_white` branded overlay assets.' : 'Only use `_black` branded overlay assets.'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </BottomSheetBody>
      </BottomSheet>

      <MediaPreviewDialog
        open={isExpandedPreviewOpen}
        src={expandedPreviewSrc}
        mediaType="image"
        title="Thumbnail preview"
        badgeLabel={activePlatform === 'youtube' ? 'youtube' : 'x'}
        onOpenChange={(open) => {
          setIsExpandedPreviewOpen(open);
          if (!open) {
            setExpandedPreviewSrc(null);
          }
        }}
      />
    </div>
  );
}
