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
  youtube: 'YouTube',
  pinterest: 'Pinterest',
};

const LEGACY_COMPOSE_PLATFORM_MAP: Record<string, ComposePlatformKey | undefined> = {
  instagram: 'instagram_feed',
  facebook: 'facebook_feed',
};

function isComposePlatformKey(value: string): value is ComposePlatformKey {
  return value in COMPOSE_PLATFORM_LABELS;
}

export function normalizeComposePlatforms(platforms: readonly string[] | null | undefined): ComposePlatformKey[] {
  if (!platforms || platforms.length === 0) {
    return [];
  }

  const normalized = platforms
    .map((platform) => {
      const trimmed = platform.trim();
      if (!trimmed) {
        return undefined;
      }

      if (isComposePlatformKey(trimmed)) {
        return trimmed;
      }

      return LEGACY_COMPOSE_PLATFORM_MAP[trimmed];
    })
    .filter((platform): platform is ComposePlatformKey => Boolean(platform));

  return Array.from(new Set(normalized));
}

export function getComposePlatformLabel(platform: ComposePlatformKey): string {
  return COMPOSE_PLATFORM_LABELS[platform];
}
