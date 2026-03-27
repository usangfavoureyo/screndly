import type { ComposeItem, ComposePlatformKey, ComposeThumbnailAsset } from '../../types/compose';
import { getComposeAssetPublishUrl, getComposeCompatibilityMap, summarizeComposeMedia } from './composeMedia';
import { isThreadsXCropVariantReady, shouldOfferThreadsXCrop } from './composeVideoProcessing';

export type ComposeValidationMode = 'draft' | 'scheduled' | 'published';

export const SHARED_CAPTION_REQUIRED_PLATFORMS: ComposePlatformKey[] = [
  'instagram_feed',
  'instagram_reels',
  'facebook_feed',
  'threads',
  'x',
  'tiktok',
  'youtube_longform',
  'youtube_shorts',
];

interface ComposeValidationOptions {
  mode: ComposeValidationMode;
  scheduledAt?: string;
}

export interface ComposeValidationResult {
  ok: boolean;
  error?: string;
}

function hasThumbnailStatus(
  thumbnails: ComposeItem['platformFields']['thumbnails'] | undefined,
  status: ComposeThumbnailAsset['uploadStatus'],
) {
  return [thumbnails?.shared, thumbnails?.youtube, thumbnails?.x].some((thumbnail) => thumbnail?.uploadStatus === status);
}

export function getComposeValidationError(
  item: ComposeItem,
  { mode, scheduledAt }: ComposeValidationOptions,
): string | undefined {
  if (!item.platforms.length) {
    return 'Select at least one connected platform';
  }

  const mediaSummary = summarizeComposeMedia(item.mediaAssets);
  const requiresReadyMedia = mode === 'scheduled' || mode === 'published';
  if (requiresReadyMedia && mediaSummary.totalAssets === 0) {
    return `Upload at least one image or video before ${mode === 'published' ? 'publishing' : 'scheduling'}`;
  }

  const selectedCaptionRequiredPlatforms = item.platforms.filter((platform) =>
    SHARED_CAPTION_REQUIRED_PLATFORMS.includes(platform),
  );
  if (requiresReadyMedia && selectedCaptionRequiredPlatforms.length > 0 && !item.sharedCaption.trim()) {
    return 'Enter a caption before scheduling or publishing to the selected platforms';
  }

  if (item.mediaAssets.some((asset) => asset.uploadStatus === 'uploading')) {
    return 'Wait for media uploads to finish before saving';
  }

  if (hasThumbnailStatus(item.platformFields.thumbnails, 'uploading')) {
    return 'Wait for thumbnail uploads to finish before saving';
  }

  if (item.mediaAssets.some((asset) => asset.uploadStatus === 'failed')) {
    return 'Remove or re-upload media that failed to upload to Backblaze';
  }

  if (hasThumbnailStatus(item.platformFields.thumbnails, 'failed')) {
    return 'Remove or re-upload thumbnails that failed to upload';
  }

  if (requiresReadyMedia && item.mediaAssets.some((asset) => !getComposeAssetPublishUrl(asset))) {
    return `Upload all media to Backblaze before ${mode === 'published' ? 'publishing' : 'scheduling'}`;
  }

  const compatibilityMap = getComposeCompatibilityMap(item.mediaAssets);
  const selectedPlatformIssues = item.platforms
    .map((platform) => compatibilityMap[platform])
    .filter((entry) => !entry.supported);
  if (selectedPlatformIssues.length > 0) {
    return selectedPlatformIssues[0]?.reason || 'One or more selected platforms do not support this media set.';
  }

  const primaryVideoAsset =
    mediaSummary.kind === 'single-video' && item.mediaAssets[0]?.kind === 'video' ? item.mediaAssets[0] : undefined;
  const isThreadsXCropEnabled =
    shouldOfferThreadsXCrop(primaryVideoAsset, item.platforms) &&
    item.platformFields.videoProcessing?.cropMode === 'threads_x_3_4';
  if (requiresReadyMedia && isThreadsXCropEnabled && !isThreadsXCropVariantReady(item, primaryVideoAsset)) {
    return `Generate the 3:4 Threads/X crop before ${mode === 'published' ? 'publishing' : 'scheduling'}.`;
  }

  const isPinterestSelected = item.platforms.includes('pinterest');
  if (
    isPinterestSelected &&
    (
      !item.platformFields.pinterest?.title.trim() ||
      !item.platformFields.pinterest?.description.trim() ||
      !item.platformFields.pinterest?.board.trim()
    )
  ) {
    return 'Complete the Pinterest fields before saving';
  }

  const isYouTubeLongformSelected = item.platforms.includes('youtube_longform');
  const isYouTubeShortsSelected = item.platforms.includes('youtube_shorts');
  if (
    (isYouTubeLongformSelected || isYouTubeShortsSelected) &&
    (
      !item.platformFields.youtube?.title.trim() ||
      (isYouTubeLongformSelected && !item.platformFields.youtube?.description.trim()) ||
      (isYouTubeLongformSelected && !item.platformFields.youtube?.playlist.trim())
    )
  ) {
    return 'Complete the YouTube fields before saving';
  }

  if (mode === 'scheduled' && !scheduledAt) {
    return 'Choose a date and time for the scheduled post';
  }

  return undefined;
}

export function validateComposeItemAction(
  item: ComposeItem,
  options: ComposeValidationOptions,
): ComposeValidationResult {
  const error = getComposeValidationError(item, options);
  return error ? { ok: false, error } : { ok: true };
}
