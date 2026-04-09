import prisma from '../lib/prisma';
import { publisherService, type PublishContent, type PublishResult } from './publisher.service';

const COMPOSE_STATE_KEY = 'composeState.v1';
const THREADS_X_PLATFORMS = new Set(['threads', 'x']);
const STORY_PLATFORMS = new Set(['instagram_stories', 'facebook_stories']);
const STORY_MAX_ITEMS = 4;
const STORY_VIDEO_SEGMENT_SECONDS = 60;

type ComposeStateItem = Record<string, any>;

export interface ComposeStateSnapshot {
  items: ComposeStateItem[];
  updatedAt: string | null;
}

export interface ComposePublishOutcome {
  postedPlatforms: string[];
  failedResults: Array<{ platform: string; error: string }>;
  errorMessage?: string;
}

const COMPOSE_PLATFORM_TO_BACKEND: Record<string, string> = {
  instagram_feed: 'InstagramFeed',
  instagram_reels: 'InstagramReels',
  instagram_stories: 'InstagramStories',
  facebook_feed: 'FacebookFeed',
  facebook_stories: 'FacebookStories',
  tiktok: 'TikTok',
  threads: 'Threads',
  x: 'X',
  youtube_longform: 'YouTubeLongform',
  youtube_shorts: 'YouTubeShorts',
  pinterest: 'Pinterest',
};

const COMPOSE_PLATFORM_LABELS: Record<string, string> = {
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

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toTimestamp(value?: string | null): number {
  if (!value || typeof value !== 'string') return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function cloneItem<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeComposeItem(item: unknown): ComposeStateItem | null {
  if (!isRecord(item)) return null;
  if (typeof item.id !== 'string' || !item.id.trim()) return null;

  const normalized = cloneItem(item);
  normalized.id = item.id.trim();
  normalized.updatedAt =
    typeof item.updatedAt === 'string' && item.updatedAt.trim().length > 0
      ? item.updatedAt
      : new Date().toISOString();
  normalized.createdAt =
    typeof item.createdAt === 'string' && item.createdAt.trim().length > 0
      ? item.createdAt
      : normalized.updatedAt;
  normalized.platformFields = isRecord(item.platformFields) ? cloneItem(item.platformFields) : {};
  normalized.mediaAssets = Array.isArray(item.mediaAssets) ? cloneItem(item.mediaAssets) : [];
  normalized.platforms = Array.isArray(item.platforms) ? cloneItem(item.platforms) : [];

  return normalized;
}

function sortComposeItems(items: ComposeStateItem[]): ComposeStateItem[] {
  return [...items].sort((left, right) => {
    const rightTimestamp = Math.max(toTimestamp(right.updatedAt), toTimestamp(right.createdAt));
    const leftTimestamp = Math.max(toTimestamp(left.updatedAt), toTimestamp(left.createdAt));
    return rightTimestamp - leftTimestamp;
  });
}

function getComposeStateValueItems(rawValue: unknown): ComposeStateItem[] {
  if (!isRecord(rawValue)) return [];
  const items = Array.isArray(rawValue.items) ? rawValue.items : [];
  return sortComposeItems(items.map(normalizeComposeItem).filter((item): item is ComposeStateItem => Boolean(item)));
}

export async function getComposeState(): Promise<ComposeStateSnapshot> {
  const savedState = await prisma.setting.findUnique({
    where: { key: COMPOSE_STATE_KEY },
  });

  return {
    items: getComposeStateValueItems(savedState?.value),
    updatedAt: savedState?.updatedAt?.toISOString() ?? null,
  };
}

async function persistComposeState(items: ComposeStateItem[]): Promise<ComposeStateSnapshot> {
  const sortedItems = sortComposeItems(items);
  const savedState = await prisma.setting.upsert({
    where: { key: COMPOSE_STATE_KEY },
    update: {
      value: {
        version: 1,
        items: sortedItems,
      },
    },
    create: {
      key: COMPOSE_STATE_KEY,
      value: {
        version: 1,
        items: sortedItems,
      },
    },
  });

  return {
    items: sortedItems,
    updatedAt: savedState.updatedAt.toISOString(),
  };
}

export async function saveComposeState(items: ComposeStateItem[]): Promise<ComposeStateSnapshot> {
  const normalizedItems = items
    .map(normalizeComposeItem)
    .filter((item): item is ComposeStateItem => Boolean(item));

  return persistComposeState(normalizedItems);
}

export async function mergeComposeState(incomingItems: unknown[], clientUpdatedAt?: string | null): Promise<ComposeStateSnapshot> {
  const existingState = await getComposeState();
  const existingById = new Map(existingState.items.map((item) => [item.id, item]));
  const normalizedIncoming = incomingItems
    .map(normalizeComposeItem)
    .filter((item): item is ComposeStateItem => Boolean(item));

  const incomingMaxUpdatedAt = Math.max(
    toTimestamp(clientUpdatedAt ?? undefined),
    normalizedIncoming.reduce(
    (latest, item) => Math.max(latest, toTimestamp(item.updatedAt)),
    0,
    ),
  );

  const mergedById = new Map<string, ComposeStateItem>();

  for (const incomingItem of normalizedIncoming) {
    const existingItem = existingById.get(incomingItem.id);
    if (existingItem && toTimestamp(existingItem.updatedAt) > toTimestamp(incomingItem.updatedAt)) {
      mergedById.set(existingItem.id, existingItem);
      continue;
    }

    mergedById.set(incomingItem.id, incomingItem);
  }

  for (const existingItem of existingState.items) {
    if (mergedById.has(existingItem.id)) {
      continue;
    }

    if (toTimestamp(existingItem.updatedAt) > incomingMaxUpdatedAt) {
      mergedById.set(existingItem.id, existingItem);
    }
  }

  return persistComposeState(Array.from(mergedById.values()));
}

export async function mutateComposeItem(
  itemId: string,
  updater: (item: ComposeStateItem) => ComposeStateItem | null,
): Promise<ComposeStateSnapshot> {
  const state = await getComposeState();
  const nextItems = state.items
    .map((item) => {
      if (item.id !== itemId) {
        return item;
      }

      const updated = updater(cloneItem(item));
      return updated ? normalizeComposeItem(updated) : null;
    })
    .filter((item): item is ComposeStateItem => Boolean(item));

  return persistComposeState(nextItems);
}

function getPrimaryAsset(item: ComposeStateItem): Record<string, any> | null {
  const mediaAssets = Array.isArray(item.mediaAssets) ? item.mediaAssets : [];
  const firstAsset = mediaAssets[0];
  return isRecord(firstAsset) ? firstAsset : null;
}

function summarizeMediaAssets(item: ComposeStateItem) {
  const mediaAssets = Array.isArray(item.mediaAssets) ? item.mediaAssets.filter(isRecord) : [];
  const imageCount = mediaAssets.filter((asset) => asset.kind === 'image').length;
  const videoCount = mediaAssets.filter((asset) => asset.kind === 'video').length;

  let kind: 'empty' | 'single-image' | 'single-video' | 'multi-image' | 'multi-video' | 'mixed-media' = 'empty';
  if (mediaAssets.length === 1 && imageCount === 1) kind = 'single-image';
  if (mediaAssets.length === 1 && videoCount === 1) kind = 'single-video';
  if (mediaAssets.length > 1 && imageCount === mediaAssets.length) kind = 'multi-image';
  if (mediaAssets.length > 1 && videoCount === mediaAssets.length) kind = 'multi-video';
  if (mediaAssets.length > 1 && imageCount > 0 && videoCount > 0) kind = 'mixed-media';

  return {
    mediaAssets,
    totalAssets: mediaAssets.length,
    kind,
  };
}

function getAssetUrl(asset?: Record<string, any> | null): string | undefined {
  if (!asset) return undefined;
  const candidates = [asset.previewUrl, asset.storageUrl];
  return candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
}

function getAssetUrls(item: ComposeStateItem): string[] {
  const { mediaAssets } = summarizeMediaAssets(item);
  return mediaAssets
    .map((asset) => getAssetUrl(asset))
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function getAssetDurationSeconds(asset?: Record<string, any> | null): number | undefined {
  const duration = Number(asset?.durationSeconds);
  return Number.isFinite(duration) && duration > 0 ? duration : undefined;
}

function estimateStoryItemCount(mediaAssets: Array<Record<string, any>>): number {
  return mediaAssets.reduce((total, asset) => {
    if (asset.kind !== 'video') {
      return total + 1;
    }

    const durationSeconds = getAssetDurationSeconds(asset) ?? STORY_VIDEO_SEGMENT_SECONDS;
    return total + Math.max(1, Math.ceil(durationSeconds / STORY_VIDEO_SEGMENT_SECONDS));
  }, 0);
}

function buildAssetSignature(asset?: Record<string, any> | null): string {
  if (!asset) return '';
  return [
    asset.id || '',
    asset.fileName || '',
    asset.size || '',
    asset.storageFileId || '',
    asset.storageUrl || '',
    asset.previewUrl || '',
    asset.aspectRatioLabel || '',
  ].join('|');
}

function getThreadsXCropVideoUrl(item: ComposeStateItem, primaryAsset: Record<string, any>): string | undefined {
  const settings = isRecord(item.platformFields?.videoProcessing) ? item.platformFields.videoProcessing : null;
  const cropVariant = isRecord(settings?.threadsXCrop) ? settings.threadsXCrop : null;
  if (!settings || settings.cropMode !== 'threads_x_3_4' || !cropVariant) {
    return undefined;
  }

  if (
    cropVariant.sourceAssetId !== primaryAsset.id ||
    cropVariant.sourceSignature !== buildAssetSignature(primaryAsset) ||
    cropVariant.focusYPercent !== (settings.focusYPercent ?? 50) ||
    cropVariant.uploadStatus !== 'uploaded'
  ) {
    return undefined;
  }

  return getAssetUrl(cropVariant);
}

function getVideoUrlForPlatform(item: ComposeStateItem, platform: string, primaryAsset: Record<string, any>): string | undefined {
  if (THREADS_X_PLATFORMS.has(platform)) {
    const croppedUrl = getThreadsXCropVideoUrl(item, primaryAsset);
    if (croppedUrl) {
      return croppedUrl;
    }
  }

  return getAssetUrl(primaryAsset);
}

function getThumbnailUrl(item: ComposeStateItem, platform: string): string | undefined {
  const thumbnails = isRecord(item.platformFields?.thumbnails) ? item.platformFields.thumbnails : null;
  if (!thumbnails) return undefined;

  if (platform === 'x') {
    return getAssetUrl(isRecord(thumbnails.x) ? thumbnails.x : null)
      || getAssetUrl(isRecord(thumbnails.shared) ? thumbnails.shared : null);
  }

  return getAssetUrl(isRecord(thumbnails.shared) ? thumbnails.shared : null);
}

function getYouTubePlaylistIds(item: ComposeStateItem): string[] | undefined {
  const playlist = item.platformFields?.youtube?.playlist;
  return typeof playlist === 'string' && playlist.trim().length > 0 ? [playlist.trim()] : undefined;
}

function getPinterestBoardId(item: ComposeStateItem): string | undefined {
  const board = item.platformFields?.pinterest?.board;
  return typeof board === 'string' && board.trim().length > 0 ? board.trim() : undefined;
}

export function validateScheduledComposeItem(item: ComposeStateItem): string | undefined {
  const platforms = Array.isArray(item.platforms) ? item.platforms : [];
  if (platforms.length === 0) {
    return 'Select at least one platform before scheduling.';
  }

  const mediaSummary = summarizeMediaAssets(item);
  if (mediaSummary.totalAssets === 0) {
    return 'Upload one media item before scheduling.';
  }

  const assetUrls = getAssetUrls(item);
  if (assetUrls.length !== mediaSummary.totalAssets) {
    return 'Upload the media asset before scheduling.';
  }

  if (mediaSummary.kind === 'multi-image') {
    for (const platform of platforms) {
      switch (platform) {
        case 'x':
        case 'threads':
          if (mediaSummary.totalAssets > 4) {
            return 'X and Threads currently support up to 4 images in this post flow.';
          }
          break;
        case 'facebook_feed':
          if (mediaSummary.totalAssets > 3) {
            return 'Facebook Feed currently supports up to 3 images in this post flow.';
          }
          break;
        case 'instagram_stories':
        case 'facebook_stories':
          if (mediaSummary.totalAssets > STORY_MAX_ITEMS) {
            return 'Instagram Stories and Facebook Stories currently support up to 4 story items in this post flow.';
          }
          break;
        default:
          return 'Only Facebook Feed, Instagram Stories, Facebook Stories, X, and Threads support multiple images in the current scheduling flow.';
      }
    }

    return undefined;
  }

  if (mediaSummary.kind === 'mixed-media') {
    return 'Mixed image/video sets and multiple videos are not supported for scheduling in this post flow.';
  }

  if (mediaSummary.kind === 'multi-video') {
    for (const platform of platforms) {
      if (!STORY_PLATFORMS.has(platform)) {
        return 'Multiple videos are only supported for Instagram Stories and Facebook Stories in this post flow.';
      }
    }

    if (estimateStoryItemCount(mediaSummary.mediaAssets) > STORY_MAX_ITEMS) {
      return 'Instagram Stories and Facebook Stories support up to 4 story items after splitting videos longer than 60 seconds.';
    }

    return undefined;
  }

  const primaryAsset = getPrimaryAsset(item);
  if (!primaryAsset) {
    return 'Upload one media item before scheduling.';
  }

  if (primaryAsset.kind === 'video') {
    const storyPlatformsSelected = platforms.some((platform) => STORY_PLATFORMS.has(platform));
    if (storyPlatformsSelected && estimateStoryItemCount(mediaSummary.mediaAssets) > STORY_MAX_ITEMS) {
      return 'Instagram Stories and Facebook Stories support up to 4 story items after splitting videos longer than 60 seconds.';
    }
  }

  if (primaryAsset.kind === 'video') {
    for (const platform of platforms) {
      if (THREADS_X_PLATFORMS.has(platform) && !getVideoUrlForPlatform(item, platform, primaryAsset)) {
        return 'Generate the 3:4 Threads/X crop before scheduling.';
      }
    }
  }

  return undefined;
}

function buildPublishContent(item: ComposeStateItem, platform: string, primaryAsset: Record<string, any>): PublishContent {
  const mediaSummary = summarizeMediaAssets(item);
  const assetUrls = getAssetUrls(item);
  const caption = typeof item.sharedCaption === 'string' && item.sharedCaption.trim().length > 0
    ? item.sharedCaption.trim()
    : (typeof item.title === 'string' ? item.title : 'Untitled post');
  const videoUrl = mediaSummary.kind === 'single-video' ? getVideoUrlForPlatform(item, platform, primaryAsset) : undefined;
  const imageUrl =
    mediaSummary.kind === 'single-image'
      ? assetUrls[0]
      : mediaSummary.kind === 'single-video'
        ? getThumbnailUrl(item, platform)
        : undefined;

  return {
    text: caption,
    title:
      item.platformFields?.youtube?.title
      || item.platformFields?.pinterest?.title
      || (typeof item.title === 'string' ? item.title : caption),
    description:
      item.platformFields?.youtube?.description
      || caption,
    imageUrl,
    imageUrls: mediaSummary.kind === 'multi-image' ? assetUrls : undefined,
    videoUrls: mediaSummary.kind === 'multi-video' ? assetUrls : undefined,
    videoUrl,
  };
}

function formatFailedResults(results: PublishResult[] = []): Array<{ platform: string; error: string }> {
  return results
    .filter((result) => result.status !== 'posted')
    .map((result) => ({
      platform: result.platform,
      error: result.error || 'Publish failed',
    }));
}

async function publishComposeItemInternal(item: ComposeStateItem): Promise<ComposePublishOutcome> {
  const validationError = validateScheduledComposeItem(item);
  if (validationError) {
    throw new Error(validationError);
  }

  const primaryAsset = getPrimaryAsset(item);
  if (!primaryAsset) {
    throw new Error('No media asset available for publish.');
  }

  const platforms = Array.from(new Set(Array.isArray(item.platforms) ? item.platforms : []))
    .filter((platform): platform is string => typeof platform === 'string' && Boolean(COMPOSE_PLATFORM_TO_BACKEND[platform]));

  const results: PublishResult[] = [];
  for (const platform of platforms) {
    const publishContent = buildPublishContent(item, platform, primaryAsset);
    const platformResults = await publisherService.publish(
      [COMPOSE_PLATFORM_TO_BACKEND[platform]],
      publishContent,
      undefined,
      {
        youtubePlaylistIds: getYouTubePlaylistIds(item),
        pinterestBoardId: getPinterestBoardId(item),
      },
    );

    if (platformResults.length === 0) {
      results.push({
        platform: COMPOSE_PLATFORM_LABELS[platform] || platform,
        status: 'failed',
        error: 'No publish result returned',
        postedAt: new Date().toISOString(),
      });
      continue;
    }

    for (const result of platformResults) {
      results.push({
        ...result,
        platform: result.platform || COMPOSE_PLATFORM_LABELS[platform] || platform,
      });
    }
  }

  const postedPlatforms = results
    .filter((result) => result.status === 'posted')
    .map((result) => result.platform);
  const failedResults = formatFailedResults(results);
  const errorMessage = failedResults.length > 0
    ? failedResults.map((result) => `${result.platform}: ${result.error}`).join('; ')
    : undefined;

  return {
    postedPlatforms,
    failedResults,
    errorMessage,
  };
}

export async function publishComposeItemFromState(item: ComposeStateItem): Promise<ComposePublishOutcome> {
  const normalizedItem = normalizeComposeItem(item);
  if (!normalizedItem) {
    throw new Error('Invalid compose item.');
  }

  return publishComposeItemInternal(normalizedItem);
}

export async function publishComposeItemInput(item: unknown): Promise<ComposePublishOutcome> {
  const normalizedItem = normalizeComposeItem(item);
  if (!normalizedItem) {
    throw new Error('Invalid compose item payload.');
  }

  return publishComposeItemInternal(normalizedItem);
}
