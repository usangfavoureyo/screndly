/**
 * Thumbnail generation utility backed by the shared real canvas renderer.
 */

import {
  getStoredThumbnailConfig,
  renderThumbnailDataUrl,
  type ThumbnailConfig,
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

function getTrailerTypeLabel(title: string): string {
  const normalized = title.toLowerCase();
  if (normalized.includes('teaser')) {
    return 'OFFICIAL TEASER';
  }
  if (normalized.includes('featurette')) {
    return 'OFFICIAL FEATURETTE';
  }
  if (normalized.includes('clip')) {
    return 'OFFICIAL CLIP';
  }
  return 'OFFICIAL TRAILER';
}

export function getThumbnailConfig(platform: ThumbnailPlatformConfig): ThumbnailConfig {
  return getStoredThumbnailConfig(platform);
}

export async function generateThumbnailsForPublish(
  video: VideoMetadata,
  platformSettings: Record<string, { autoThumbnail: boolean }>,
  enabledPlatforms: ThumbnailPlatform[]
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
      const configType = mapPlatformToConfigType(platform);
      const config = getThumbnailConfig(configType);
      const dimensions = getPlatformDimensions(platform);
      const thumbnailUrl = await renderThumbnailDataUrl(config, {
        width: dimensions.width,
        height: dimensions.height,
        backdropUrl: video.thumbnailUrl,
        trailerLabel: getTrailerTypeLabel(video.title),
        format: 'jpeg',
      });

      result[platform] = {
        url: thumbnailUrl,
        width: dimensions.width,
        height: dimensions.height,
        platform,
        config,
      };

      console.log(`Generated ${platform} thumbnail with ${config.logoPosition} at ${config.maxLogoSize}%`);
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
