/**
 * Thumbnail generation utility backed by the shared real canvas renderer.
 */

import {
  getOverlayLabelForTitle,
  getStoredThumbnailConfig,
  renderThumbnailPreviewResult,
  resolveThumbnailConfigWithSource,
  type ThumbnailConfig,
  type ThumbnailPersistedSettings,
  type BrandedOverlayAssetKey,
  type BrandedOverlayType,
  type ThumbnailPlatformConfig,
} from './thumbnailRenderer';

export type ThumbnailPlatform = 'YouTube' | 'X' | 'Instagram' | 'TikTok' | 'Facebook' | 'Threads' | 'Pinterest';

interface VideoMetadata {
  title: string;
  videoId: string;
  channelName: string;
  thumbnailUrl?: string;
}

interface GeneratedThumbnail {
  url: string;
  width: number;
  height: number;
  platform: ThumbnailPlatform;
  config: ThumbnailConfig;
  detectedOverlayType?: BrandedOverlayType;
  resolvedOverlayAssetKey?: BrandedOverlayAssetKey;
}

export interface GenerateThumbnailsOptions {
  /**
   * Persisted DB/settings snapshot. Production/server upload paths should pass this
   * so generation does not fall back to browser localStorage defaults.
   */
  persistedSettings?: ThumbnailPersistedSettings;
  /**
   * Direct resolved configs can be injected by jobs/tests that already loaded them.
   */
  thumbnailConfigs?: Partial<Record<ThumbnailPlatformConfig, ThumbnailConfig | Partial<ThumbnailConfig> | string>>;
  logConfigResolution?: boolean;
}

function mapPlatformToConfigType(platform: ThumbnailPlatform): ThumbnailPlatformConfig {
  return platform === 'X' ? 'x' : 'youtube';
}

function getPlatformDimensions(platform: ThumbnailPlatform): { width: number; height: number } {
  switch (platform) {
    case 'YouTube':
      return { width: 1280, height: 720 };
    case 'X':
      return { width: 1200, height: 675 };
    case 'Instagram':
      return { width: 1080, height: 1080 };
    case 'TikTok':
      return { width: 1080, height: 1920 };
    case 'Facebook':
      return { width: 1200, height: 630 };
    case 'Threads':
      return { width: 1080, height: 1080 };
    case 'Pinterest':
      return { width: 1080, height: 1080 };
    default:
      return { width: 1280, height: 720 };
  }
}

export function getThumbnailConfig(
  platform: ThumbnailPlatformConfig,
  persistedSettings?: ThumbnailPersistedSettings | ThumbnailConfig | Partial<ThumbnailConfig> | string
): ThumbnailConfig {
  if (persistedSettings) {
    return resolveThumbnailConfigWithSource(platform, persistedSettings).config;
  }

  return getStoredThumbnailConfig(platform);
}

function resolveConfigForGeneration(
  platform: ThumbnailPlatform,
  options: GenerateThumbnailsOptions = {}
) {
  const configType = mapPlatformToConfigType(platform);
  const providedConfig = options.thumbnailConfigs?.[configType];

  if (providedConfig) {
    return resolveThumbnailConfigWithSource(configType, providedConfig, {
      source: 'provided',
      fallbackReason: 'Provided thumbnail config was invalid',
    });
  }

  if (options.persistedSettings) {
    return resolveThumbnailConfigWithSource(configType, options.persistedSettings, {
      source: 'persisted',
      fallbackReason: `No persisted thumbnailConfig_${configType} setting found`,
    });
  }

  return {
    config: getStoredThumbnailConfig(configType),
    source: 'browser_direct' as const,
    fallbackReason: 'No persisted settings were supplied; using browser/local fallback',
  };
}

export async function generateThumbnailsForPublish(
  video: VideoMetadata,
  platformSettings: Record<string, { autoThumbnail: boolean }>,
  enabledPlatforms: ThumbnailPlatform[],
  options: GenerateThumbnailsOptions = {}
): Promise<Record<ThumbnailPlatform, GeneratedThumbnail | null>> {
  const result: Record<ThumbnailPlatform, GeneratedThumbnail | null> = {
    YouTube: null,
    X: null,
    Instagram: null,
    TikTok: null,
    Facebook: null,
    Threads: null,
    Pinterest: null,
  };

  for (const platform of enabledPlatforms) {
    const platformId = platform.toLowerCase();
    const settings = platformSettings[platformId === 'x' ? 'x' : platformId];

    if (!settings?.autoThumbnail) {
      continue;
    }

    try {
      const configResolution = resolveConfigForGeneration(platform, options);
      const config = configResolution.config;
      const dimensions = getPlatformDimensions(platform);

      if (options.logConfigResolution ?? true) {
        console.log('[ThumbnailGenerator] resolved thumbnail config', {
          platform,
          configPlatform: config.platform,
          source: configResolution.source,
          key: configResolution.key,
          logoDisplayMode: config.logoDisplayMode,
          fallbackReason: configResolution.fallbackReason,
        });
      }

      const previewResult = await renderThumbnailPreviewResult(config, {
        width: dimensions.width,
        height: dimensions.height,
        backdropUrl: video.thumbnailUrl,
        title: video.title,
        trailerLabel: getOverlayLabelForTitle(video.title),
        brandedOverlayAssets: config.brandedOverlayAssets,
        format: 'jpeg',
      });

      result[platform] = {
        url: previewResult.dataUrl,
        width: dimensions.width,
        height: dimensions.height,
        platform,
        config,
        detectedOverlayType: previewResult.detectedType,
        resolvedOverlayAssetKey: previewResult.resolvedAssetKey,
      };

      const overlaySummary = previewResult.detectedType
        ? ` using ${previewResult.detectedType}${previewResult.resolvedAssetKey ? ` (${previewResult.resolvedAssetKey})` : ''}`
        : '';
      console.log(
        `[ThumbnailGenerator] generated ${platform} thumbnail style=${config.logoDisplayMode} position=${config.logoPosition} scale=${config.maxLogoSize}%${overlaySummary}`
      );
    } catch (error) {
      console.error(`Failed to generate thumbnail for ${platform}:`, error);
    }
  }

  return result;
}

export function getPlatformThumbnailSettings(): Record<string, { autoThumbnail: boolean }> {
  try {
    const savedSettings = localStorage.getItem('screndly_platformSettings');
    if (savedSettings) {
      const platformSettings = JSON.parse(savedSettings);
      const thumbnailSettings: Record<string, { autoThumbnail: boolean }> = {};

      Object.entries(platformSettings).forEach(([id, settings]: [string, any]) => {
        thumbnailSettings[id] = {
          autoThumbnail: settings?.autoThumbnail ?? false,
        };
      });

      return thumbnailSettings;
    }
  } catch (error) {
    console.error('Failed to load platform thumbnail settings:', error);
  }

  return {
    youtube: { autoThumbnail: true },
    x: { autoThumbnail: true },
    threads: { autoThumbnail: true },
    instagram: { autoThumbnail: true },
    tiktok: { autoThumbnail: true },
    facebook: { autoThumbnail: true },
    pinterest: { autoThumbnail: true },
  };
}

export function formatThumbnailConfigForLog(config: ThumbnailConfig): string {
  const features: string[] = [];

  if (config.autoScale) {
    features.push(`${config.maxLogoSize}% scale`);
  }
  if (config.autoContrastBackdrop) {
    features.push('smart backdrop');
  }
  if (config.autoContrastOverlay) {
    features.push('overlay adjust');
  }

  return `${config.logoPosition}${features.length > 0 ? ` (${features.join(', ')})` : ''}`;
}
