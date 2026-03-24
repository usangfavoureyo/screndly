import type { ComposePlatformKey } from '../../types/compose';

export const COMPOSE_PLATFORM_LABELS: Record<ComposePlatformKey, string> = {
  instagram_feed: 'Instagram Feed',
  instagram_reels: 'Instagram Reels',
  instagram_stories: 'Instagram Stories',
  facebook_feed: 'Facebook Feed',
  facebook_stories: 'Facebook Stories',
  tiktok: 'TikTok',
  threads: 'Threads',
  x: 'X',
  youtube_longform: 'YouTube Long-form',
  youtube_shorts: 'YouTube Shorts',
  pinterest: 'Pinterest',
};

const LEGACY_COMPOSE_PLATFORM_MAP: Record<string, ComposePlatformKey | undefined> = {
  instagram: 'instagram_feed',
  facebook: 'facebook_feed',
  youtube: 'youtube_longform',
};

function isComposePlatformKey(value: string): value is ComposePlatformKey {
  return value in COMPOSE_PLATFORM_LABELS;
}

export function normalizeComposePlatforms(platforms: readonly string[] | null | undefined): ComposePlatformKey[] {
  if (!platforms || platforms.length === 0) {
    return [];
  }

  const trimmedPlatforms = platforms
    .map((platform) => platform.trim())
    .filter((platform) => platform.length > 0);

  const hasExplicitInstagramDestination = trimmedPlatforms.some((platform) => platform.startsWith('instagram_'));
  const hasExplicitFacebookDestination = trimmedPlatforms.some((platform) => platform.startsWith('facebook_'));
  const hasExplicitYouTubeDestination = trimmedPlatforms.some((platform) => platform.startsWith('youtube_'));

  const normalized = trimmedPlatforms
    .map((platform) => {
      if (platform === 'instagram' && hasExplicitInstagramDestination) {
        return undefined;
      }

      if (platform === 'facebook' && hasExplicitFacebookDestination) {
        return undefined;
      }

      if (platform === 'youtube' && hasExplicitYouTubeDestination) {
        return undefined;
      }

      if (isComposePlatformKey(platform)) {
        return platform;
      }

      return LEGACY_COMPOSE_PLATFORM_MAP[platform];
    })
    .filter((platform): platform is ComposePlatformKey => Boolean(platform));

  return Array.from(new Set(normalized));
}

export function getComposePlatformLabel(platform: ComposePlatformKey): string {
  return COMPOSE_PLATFORM_LABELS[platform];
}
