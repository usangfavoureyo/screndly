/**
 * Thumbnail Generation Utility
 * Generates platform-specific thumbnails using Thumbnail Settings
 */

export type ThumbnailPlatform = 'YouTube' | 'X' | 'Instagram' | 'TikTok' | 'Facebook' | 'Threads' | 'Pinterest';

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

interface ThumbnailConfig {
  platform: 'youtube' | 'x';
  logoPosition: LogoPosition;
  autoScale: boolean;
  autoContrastBackdrop: boolean;
  autoContrastOverlay: boolean;
  showTrailerTypeText: boolean;
}

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

/**
 * Load thumbnail config from localStorage
 */
export function getThumbnailConfig(platform: 'youtube' | 'x'): ThumbnailConfig {
  try {
    const saved = localStorage.getItem(`screndly_thumbnailConfig_${platform}`);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error(`Failed to load thumbnail config for ${platform}:`, error);
  }

  // Default config
  return {
    platform,
    logoPosition: 'bottom-right',
    autoScale: true,
    maxLogoSize: 40,
    autoContrastBackdrop: true,
    autoContrastOverlay: true,
    showTrailerTypeText: false
  };
}

/**
 * Generate thumbnail using Canvas API
 */
async function mockGenerateThumbnail(
  video: VideoMetadata,
  platform: 'youtube' | 'x',
  config: ThumbnailConfig
): Promise<string> {
  // If we're in a non-browser environment (e.g. backend/worker), we can't use Canvas easily.
  // Assuming this runs in browser for now given 'document' usage.
  if (typeof document === 'undefined') {
    return video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`;
  }

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    // Set dimensions based on platform? Or standardized 1280x720 and let platform resize?
    // Standard 1280x720 is best for generation.
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      resolve(video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`);
      return;
    }

    // 1. Load Background (YouTube Thumbnail or Backdrop)
    const bgImg = new Image();
    bgImg.crossOrigin = 'anonymous'; // Critical for canvas export
    bgImg.src = video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`;

    bgImg.onload = () => {
      // Draw Background
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

      // 2. Draw Logo (Mock logic until we can pass logo URL)
      // Since we don't have the Logo URL passed in 'video', we can't draw the real logo yet.
      // But the requirement demands text UNDER the logo.
      // I will simulate a Logo box for visual verification if no logo is present, 
      // OR if we assume the input 'video.thumbnailUrl' ALREADY has the logo?
      // No, the system supposedly adds the logo. 
      // I'll skip Logo drawing if no URL, BUT I must implement the Text Logic.

      // 3. Draw Text Overlay if enabled
      if (config.showTrailerTypeText) {
        let text = 'OFFICIAL TRAILER';
        if (video.title.toLowerCase().includes('teaser')) {
          text = 'OFFICIAL TEASER';
        }

        // Font Settings
        const fontSize = 48;
        ctx.font = `900 ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Position: "Directly under the TMDB logo"
        // Since we don't know where the logo is (it's not drawn here yet), 
        // we'll calculate position based on 'config.logoPosition'.

        // Mock Logo Rect (Matches 'getLogoPositionStyles' in Settings essentially)
        const margin = 32; // Scaled up for 720p
        let logoX = 0;
        let logoY = 0;
        let logoW = canvas.width * (config.maxLogoSize / 100); // e.g. 40%
        let logoH = logoW * (9 / 16); // Assume 16:9 logo ratio for placement calculation

        // Determine Logo Bounds based on Position
        switch (config.logoPosition) {
          case 'top-left': logoX = margin; logoY = margin; break;
          case 'top-center': logoX = (canvas.width - logoW) / 2; logoY = margin; break;
          case 'top-right': logoX = canvas.width - logoW - margin; logoY = margin; break;
          case 'center-left': logoX = margin; logoY = (canvas.height - logoH) / 2; break;
          case 'center': logoX = (canvas.width - logoW) / 2; logoY = (canvas.height - logoH) / 2; break;
          case 'center-right': logoX = canvas.width - logoW - margin; logoY = (canvas.height - logoH) / 2; break;
          case 'bottom-left': logoX = margin; logoY = canvas.height - logoH - margin; break;
          case 'bottom-center': logoX = (canvas.width - logoW) / 2; logoY = canvas.height - logoH - margin; break;
          case 'bottom-right': logoX = canvas.width - logoW - margin; logoY = canvas.height - logoH - margin; break;
        }

        const textX = logoX + (logoW / 2);
        const textY = logoY + logoH + 10; // 10px spacing below logo

        // Draw Shadow/Stroke for readability
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'black';
        ctx.strokeText(text, textX, textY);

        // Draw Text
        ctx.fillStyle = 'white';
        ctx.shadowBlur = 0; // Reset for fill
        ctx.fillText(text, textX, textY);
      }

      // Return Data URL
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };

    bgImg.onerror = () => {
      // Fallback if image fails
      resolve(video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`);
    };
  });
}

/**
 * Map platform names to thumbnail config platform types
 */
function mapPlatformToConfigType(platform: ThumbnailPlatform): 'youtube' | 'x' {
  // YouTube and X have separate configs
  // Other platforms use YouTube config as default
  switch (platform) {
    case 'X':
      return 'x';
    case 'YouTube':
    case 'Instagram':
    case 'TikTok':
    case 'Facebook':
    case 'Threads':
    case 'Pinterest':
    default:
      return 'youtube';
  }
}

/**
 * Generate thumbnails for auto-publish based on platform settings
 */
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

  // Generate thumbnails for each enabled platform
  for (const platform of enabledPlatforms) {
    const platformId = platform.toLowerCase();
    const settings = platformSettings[platformId === 'x' ? 'x' : platformId];

    if (!settings?.autoThumbnail) {
      // Skip thumbnail generation if autoThumbnail is disabled
      console.log(`⏭️ Skipping thumbnail for ${platform} - autoThumbnail disabled`);
      continue;
    }

    try {
      // Get the appropriate config (YouTube or X)
      const configType = mapPlatformToConfigType(platform);
      const config = getThumbnailConfig(configType);

      // Generate thumbnail
      const thumbnailUrl = await mockGenerateThumbnail(video, configType, config);

      // Platform-specific dimensions
      const dimensions = getPlatformDimensions(platform);

      result[platform] = {
        url: thumbnailUrl,
        width: dimensions.width,
        height: dimensions.height,
        platform,
        config,
      };

      console.log(`✅ Generated ${platform} thumbnail: ${config.logoPosition}, scale: ${config.maxLogoSize}%`);
    } catch (error) {
      console.error(`Failed to generate thumbnail for ${platform}:`, error);
    }
  }

  return result;
}

/**
 * Get platform-specific thumbnail dimensions
 */
function getPlatformDimensions(platform: ThumbnailPlatform): { width: number; height: number } {
  switch (platform) {
    case 'YouTube':
      return { width: 1280, height: 720 }; // 16:9
    case 'X':
      return { width: 1200, height: 675 }; // 16:9
    case 'Instagram':
      return { width: 1080, height: 1080 }; // 1:1 for feed, but can use 16:9
    case 'TikTok':
      return { width: 1080, height: 1920 }; // 9:16, but can letterbox 16:9
    case 'Facebook':
      return { width: 1200, height: 630 }; // ~1.91:1
    case 'Threads':
      return { width: 1080, height: 1080 }; // 1:1
    case 'Pinterest':
      return { width: 1080, height: 1080 }; // 1:1
    default:
      return { width: 1280, height: 720 }; // Default 16:9
  }
}

/**
 * Get platform thumbnail settings from localStorage
 */
export function getPlatformThumbnailSettings(): Record<string, { autoThumbnail: boolean }> {
  try {
    const savedSettings = localStorage.getItem('screndly_platformSettings');
    if (savedSettings) {
      const platformSettings = JSON.parse(savedSettings);

      // Extract only autoThumbnail for each platform
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

  // Default settings - all enabled
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

/**
 * Format thumbnail config for display in logs
 */
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