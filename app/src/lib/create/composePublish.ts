import { apiClient } from '../api/client';
import {
  getComposeCompatibilityMap,
} from './composeMedia';
import { getComposePlatformLabel } from './composePlatforms';
import type { ComposeItem, ComposePlatformKey } from '../../types/compose';

export interface ComposePublishOutcome {
  platformKeys: ComposePlatformKey[];
  platformNames: string[];
  postedPlatforms: string[];
  failedResults: Array<{ platform: string; error: string }>;
  errorMessage?: string;
}

interface ComposePublishOptions {
  signal?: AbortSignal;
}

const PLATFORM_NAME_BY_KEY: Record<ComposePlatformKey, string> = {
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

export async function publishComposeItem(item: ComposeItem, options?: ComposePublishOptions): Promise<ComposePublishOutcome> {
  const platformKeys = Array.from(new Set(item.platforms));
  if (platformKeys.length === 0) {
    throw new Error('Select at least one platform');
  }

  if (item.mediaAssets.length === 0) {
    throw new Error('Upload at least one image or video before publishing.');
  }

  const compatibilityMap = getComposeCompatibilityMap(item.mediaAssets);
  const selectedPlatformIssues = platformKeys
    .map((platform) => compatibilityMap[platform])
    .filter((entry) => !entry.supported);
  if (selectedPlatformIssues.length > 0) {
    throw new Error(selectedPlatformIssues[0]?.reason || 'One or more selected platforms do not support this media set.');
  }

  const response = await apiClient.post<{
    postedPlatforms: string[];
    failedResults: Array<{ platform: string; error: string }>;
    errorMessage?: string;
  }>(
    '/api/create/publish-item',
    { item },
    {
      timeout: 10 * 60 * 1000,
      signal: options?.signal,
    },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to publish post');
  }

  return {
    platformKeys,
    platformNames: platformKeys.map((platform) => PLATFORM_NAME_BY_KEY[platform] ?? getComposePlatformLabel(platform)),
    postedPlatforms: response.data.postedPlatforms,
    failedResults: response.data.failedResults,
    errorMessage: response.data.errorMessage,
  };
}
