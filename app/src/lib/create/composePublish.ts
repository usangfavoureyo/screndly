import { publishContent, type PlatformSelection } from '../api/platforms';
import { getComposeAssetPublishUrl } from './composeMedia';
import type { ComposeItem, ComposePlatformKey } from '../../types/compose';

export interface ComposePublishOutcome {
  platformKeys: ComposePlatformKey[];
  platformNames: string[];
  postedPlatforms: string[];
  failedResults: Array<{ platform: string; error: string }>;
  errorMessage?: string;
}

const PLATFORM_NAME_BY_KEY: Record<ComposePlatformKey, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  threads: 'Threads',
  x: 'X',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
};

function toPlatformSelection(platforms: ComposePlatformKey[]): PlatformSelection {
  return {
    x: platforms.includes('x'),
    facebook: platforms.includes('facebook'),
    instagram: platforms.includes('instagram'),
    threads: platforms.includes('threads'),
    youtube: platforms.includes('youtube'),
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

export async function publishComposeItem(item: ComposeItem): Promise<ComposePublishOutcome> {
  const platformKeys = Array.from(new Set(item.platforms));
  if (platformKeys.length === 0) {
    throw new Error('Select at least one platform');
  }

  if (item.mediaAssets.length !== 1) {
    throw new Error('Live publishing from Post currently supports one media item at a time.');
  }

  const primaryAsset = item.mediaAssets[0];
  const mediaUrl = getComposeAssetPublishUrl(primaryAsset);
  if (!mediaUrl) {
    throw new Error(
      `Upload the ${primaryAsset.kind === 'video' ? 'video' : 'image'} to Backblaze before publishing this post.`,
    );
  }

  const content = {
    text: item.sharedCaption?.trim() || item.title,
    title:
      item.platformFields.youtube?.title ||
      item.platformFields.pinterest?.title ||
      item.title,
    imageUrl: primaryAsset.kind === 'image' ? mediaUrl : undefined,
    videoUrl: primaryAsset.kind === 'video' ? mediaUrl : undefined,
  };

  const response = await publishContent(toPlatformSelection(platformKeys), content);

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to publish post');
  }

  const results = response.data?.results || [];
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
    platformNames: platformKeys.map((platform) => PLATFORM_NAME_BY_KEY[platform]),
    postedPlatforms,
    failedResults,
    errorMessage,
  };
}
