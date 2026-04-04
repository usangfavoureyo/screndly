import { publishContent, type PlatformSelection } from '../api/platforms';
import {
  getComposeAssetPublishUrl,
  getComposeAssetPublishUrls,
  getComposeCompatibilityMap,
  getComposeThumbnailPublishUrl,
  summarizeComposeMedia,
} from './composeMedia';
import { getVideoUrlForComposePlatform } from './composeVideoProcessing';
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

function toPlatformSelection(platforms: ComposePlatformKey[]): PlatformSelection {
  return {
    x: platforms.includes('x'),
    facebookFeed: platforms.includes('facebook_feed'),
    facebookStories: platforms.includes('facebook_stories'),
    instagramFeed: platforms.includes('instagram_feed'),
    instagramReels: platforms.includes('instagram_reels'),
    instagramStories: platforms.includes('instagram_stories'),
    threads: platforms.includes('threads'),
    youtubeLongform: platforms.includes('youtube_longform'),
    youtubeShorts: platforms.includes('youtube_shorts'),
    tiktok: platforms.includes('tiktok'),
    pinterest: platforms.includes('pinterest'),
  };
}

function formatFailedResults(results: any[] = []): Array<{ platform: string; error: string }> {
  return results
    .filter((result) => result?.status !== 'posted')
    .map((result) => ({
      platform: typeof result?.platform === 'string' ? result.platform : 'Unknown',
      error:
        typeof result?.error === 'string' && result.error.trim().length > 0
          ? result.error
          : 'Publish failed',
    }));
}

function toSinglePlatformSelection(platform: ComposePlatformKey): PlatformSelection {
  return toPlatformSelection([platform]);
}

export async function publishComposeItem(item: ComposeItem, options?: ComposePublishOptions): Promise<ComposePublishOutcome> {
  const platformKeys = Array.from(new Set(item.platforms));
  if (platformKeys.length === 0) {
    throw new Error('Select at least one platform');
  }

  const mediaSummary = summarizeComposeMedia(item.mediaAssets);
  if (mediaSummary.totalAssets === 0) {
    throw new Error('Upload at least one image or video before publishing.');
  }

  const compatibilityMap = getComposeCompatibilityMap(item.mediaAssets);
  const selectedPlatformIssues = platformKeys
    .map((platform) => compatibilityMap[platform])
    .filter((entry) => !entry.supported);
  if (selectedPlatformIssues.length > 0) {
    throw new Error(selectedPlatformIssues[0]?.reason || 'One or more selected platforms do not support this media set.');
  }

  const primaryAsset = item.mediaAssets[0];
  const mediaUrls = getComposeAssetPublishUrls(item.mediaAssets);
  if (mediaUrls.length !== item.mediaAssets.length) {
    throw new Error('Upload all media to Backblaze before publishing this post.');
  }

  const sharedThumbnailUrl = getComposeThumbnailPublishUrl(item.platformFields.thumbnails?.shared);
  const youtubeThumbnailUrl = getComposeThumbnailPublishUrl(item.platformFields.thumbnails?.youtube);
  const xThumbnailUrl = getComposeThumbnailPublishUrl(item.platformFields.thumbnails?.x);

  const results: any[] = [];
  for (const platform of platformKeys) {
    if (options?.signal?.aborted) {
      throw new Error('Publish request cancelled');
    }

    if (
      mediaSummary.kind === 'single-video' &&
      primaryAsset?.kind === 'video' &&
      (platform === 'threads' || platform === 'x') &&
      item.platformFields.videoProcessing?.cropMode === 'threads_x_3_4'
    ) {
      const threadsXVideoUrl = getVideoUrlForComposePlatform(item, platform);
      if (!threadsXVideoUrl || threadsXVideoUrl.startsWith('blob:')) {
        throw new Error('Wait for the Threads/X 3:4 crop to finish uploading before publishing.');
      }
    }

    const content = {
      text: item.sharedCaption?.trim() || item.title,
      title:
        item.platformFields.youtube?.title ||
        item.platformFields.pinterest?.title ||
        item.title,
      youtubeTitle: item.platformFields.youtube?.title,
      youtubeDescription: item.platformFields.youtube?.description,
      youtubePlaylistIds: item.platformFields.youtube?.playlist
        ? [item.platformFields.youtube.playlist]
        : undefined,
      sharedThumbnailUrl: mediaSummary.kind === 'single-video' ? sharedThumbnailUrl : undefined,
      youtubeThumbnailUrl: mediaSummary.kind === 'single-video' ? youtubeThumbnailUrl : undefined,
      xThumbnailUrl: mediaSummary.kind === 'single-video' ? xThumbnailUrl : undefined,
      imageUrl: mediaSummary.kind === 'single-image' ? mediaUrls[0] : undefined,
      imageUrls: mediaSummary.kind === 'multi-image' ? mediaUrls : undefined,
      videoUrl:
        mediaSummary.kind === 'single-video'
          ? getVideoUrlForComposePlatform(item, platform) || mediaUrls[0]
          : undefined,
    };

    const response = await publishContent(toSinglePlatformSelection(platform), content, undefined, {
      timeout: 180000,
      signal: options?.signal,
    });

    if (options?.signal?.aborted) {
      throw new Error('Publish request cancelled');
    }

    if (!response.success) {
      results.push({
        platform: PLATFORM_NAME_BY_KEY[platform] ?? getComposePlatformLabel(platform),
        status: 'failed',
        error: response.error?.message || 'Failed to publish post',
      });
      continue;
    }

    results.push(...(response.data?.results || []));
  }

  const postedPlatforms = results
    .filter((result: any) => result?.status === 'posted' && typeof result?.platform === 'string')
    .map((result: any) => result.platform);
  const failedResults = formatFailedResults(results);
  const errorMessage =
    failedResults.length > 0
      ? failedResults.map((result) => `${result.platform}: ${result.error}`).join('; ')
      : undefined;

  return {
    platformKeys,
    platformNames: platformKeys.map((platform) => PLATFORM_NAME_BY_KEY[platform] ?? getComposePlatformLabel(platform)),
    postedPlatforms,
    failedResults,
    errorMessage,
  };
}
