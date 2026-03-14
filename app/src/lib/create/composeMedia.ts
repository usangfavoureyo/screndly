import type {
  ComposeItem,
  ComposeMedia,
  ComposeMediaAsset,
  ComposeMediaKind,
  ComposeMediaSummary,
  ComposePlatformCompatibility,
  ComposePlatformKey,
  ComposeThumbnailAsset,
} from '../../types/compose';

type PlatformCapability = {
  supportsSingleImage: boolean;
  supportsSingleVideo: boolean;
  supportsMultiImage: boolean;
  supportsMultiVideo: boolean;
  supportsMixedMedia: boolean;
  maxItems: number;
};

const PLATFORM_CAPABILITIES: Record<ComposePlatformKey, PlatformCapability> = {
  instagram: {
    supportsSingleImage: true,
    supportsSingleVideo: true,
    supportsMultiImage: true,
    supportsMultiVideo: true,
    supportsMixedMedia: true,
    maxItems: 10,
  },
  facebook: {
    supportsSingleImage: true,
    supportsSingleVideo: true,
    supportsMultiImage: true,
    supportsMultiVideo: false,
    supportsMixedMedia: false,
    maxItems: 10,
  },
  tiktok: {
    supportsSingleImage: true,
    supportsSingleVideo: true,
    supportsMultiImage: false,
    supportsMultiVideo: false,
    supportsMixedMedia: false,
    maxItems: 1,
  },
  threads: {
    supportsSingleImage: true,
    supportsSingleVideo: true,
    supportsMultiImage: false,
    supportsMultiVideo: false,
    supportsMixedMedia: false,
    maxItems: 1,
  },
  x: {
    supportsSingleImage: true,
    supportsSingleVideo: true,
    supportsMultiImage: true,
    supportsMultiVideo: false,
    supportsMixedMedia: false,
    maxItems: 4,
  },
  youtube: {
    supportsSingleImage: false,
    supportsSingleVideo: true,
    supportsMultiImage: false,
    supportsMultiVideo: false,
    supportsMixedMedia: false,
    maxItems: 1,
  },
  pinterest: {
    supportsSingleImage: true,
    supportsSingleVideo: true,
    supportsMultiImage: false,
    supportsMultiVideo: false,
    supportsMixedMedia: false,
    maxItems: 1,
  },
};

function legacyMediaToAsset(media: ComposeMedia): ComposeMediaAsset {
  const previewUrl = media.previewUrl || media.storageUrl;
  const normalizedStatus =
    media.uploadStatus === 'uploading'
      ? media.storageUrl || (previewUrl && !previewUrl.startsWith('blob:'))
        ? 'uploaded'
        : 'idle'
      : media.uploadStatus ?? (media.storageUrl || previewUrl ? 'uploaded' : 'idle');

  return {
    ...media,
    id: `legacy-${media.fileName}-${media.size}`,
    order: 0,
    previewUrl,
    storageUrl: media.storageUrl ?? (previewUrl?.startsWith('blob:') ? undefined : previewUrl),
    uploadStatus: normalizedStatus,
  };
}

export function normalizeComposeItem(item: ComposeItem): ComposeItem {
  const mediaAssets =
    item.mediaAssets && item.mediaAssets.length > 0
      ? item.mediaAssets.map((asset, index) => {
          const previewUrl = asset.previewUrl || asset.storageUrl;
          const normalizedStatus =
            asset.uploadStatus === 'uploading'
              ? asset.storageUrl || (previewUrl && !previewUrl.startsWith('blob:'))
                ? 'uploaded'
                : 'idle'
              : asset.uploadStatus ??
                (asset.storageUrl || (previewUrl && !previewUrl.startsWith('blob:')) ? 'uploaded' : 'idle');

          return {
            ...asset,
            id: asset.id || `asset-${index}-${asset.fileName}`,
            order: typeof asset.order === 'number' ? asset.order : index,
            previewUrl,
            storageUrl: asset.storageUrl || (previewUrl?.startsWith('blob:') ? undefined : previewUrl),
            uploadStatus: normalizedStatus,
          };
        })
      : item.media
        ? [legacyMediaToAsset(item.media)]
        : [];

  return {
    ...item,
    mediaAssets,
    media: undefined,
    platformFields: {
      ...item.platformFields,
      thumbnails: normalizeThumbnails(item.platformFields?.thumbnails),
    },
  };
}

export function sanitizeComposeItem(item: ComposeItem): ComposeItem {
  const normalized = normalizeComposeItem(item);

  return {
    ...normalized,
    mediaAssets: normalized.mediaAssets.map((asset) => ({
      ...asset,
      previewUrl: asset.previewUrl?.startsWith('blob:') ? asset.storageUrl : asset.previewUrl,
      storageUrl: asset.storageUrl ?? (asset.previewUrl?.startsWith('blob:') ? undefined : asset.previewUrl),
      uploadStatus:
        asset.uploadStatus ??
        (asset.storageUrl || (asset.previewUrl && !asset.previewUrl.startsWith('blob:')) ? 'uploaded' : 'idle'),
    })),
    platformFields: {
      ...normalized.platformFields,
      thumbnails: sanitizeThumbnails(normalized.platformFields?.thumbnails),
    },
  };
}

function normalizeThumbnailAsset(asset?: ComposeThumbnailAsset): ComposeThumbnailAsset | undefined {
  if (!asset) return undefined;
  const previewUrl = asset.previewUrl || asset.storageUrl;
  const normalizedStatus =
    asset.uploadStatus === 'uploading'
      ? asset.storageUrl || (previewUrl && !previewUrl.startsWith('blob:'))
        ? 'uploaded'
        : 'idle'
      : asset.uploadStatus ?? (asset.storageUrl || (previewUrl && !previewUrl.startsWith('blob:')) ? 'uploaded' : 'idle');

  return {
    ...asset,
    previewUrl,
    storageUrl: asset.storageUrl ?? (previewUrl?.startsWith('blob:') ? undefined : previewUrl),
    uploadStatus: normalizedStatus,
  };
}

function normalizeThumbnails(thumbnails?: {
  shared?: ComposeThumbnailAsset;
  youtube?: ComposeThumbnailAsset;
  x?: ComposeThumbnailAsset;
}) {
  if (!thumbnails) return undefined;
  return {
    shared: normalizeThumbnailAsset(thumbnails.shared),
    youtube: normalizeThumbnailAsset(thumbnails.youtube),
    x: normalizeThumbnailAsset(thumbnails.x),
  };
}

function sanitizeThumbnailAsset(asset?: ComposeThumbnailAsset): ComposeThumbnailAsset | undefined {
  if (!asset) return undefined;
  return {
    ...asset,
    previewUrl: asset.previewUrl?.startsWith('blob:') ? asset.storageUrl : asset.previewUrl,
    storageUrl: asset.storageUrl ?? (asset.previewUrl?.startsWith('blob:') ? undefined : asset.previewUrl),
    uploadStatus:
      asset.uploadStatus ??
      (asset.storageUrl || (asset.previewUrl && !asset.previewUrl.startsWith('blob:')) ? 'uploaded' : 'idle'),
  };
}

function sanitizeThumbnails(thumbnails?: {
  shared?: ComposeThumbnailAsset;
  youtube?: ComposeThumbnailAsset;
  x?: ComposeThumbnailAsset;
}) {
  if (!thumbnails) return undefined;
  return {
    shared: sanitizeThumbnailAsset(thumbnails.shared),
    youtube: sanitizeThumbnailAsset(thumbnails.youtube),
    x: sanitizeThumbnailAsset(thumbnails.x),
  };
}

export function buildComposeMediaAsset(file: File, order: number): ComposeMediaAsset {
  const kind: ComposeMediaKind = file.type.startsWith('video/') ? 'video' : 'image';

  return {
    id: `${Date.now()}-${order}-${file.name}`,
    kind,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    order,
    previewUrl: URL.createObjectURL(file),
    uploadStatus: 'uploading',
  };
}

export function getComposeAssetPreviewUrl(asset?: ComposeMediaAsset) {
  if (!asset) return undefined;
  return asset.previewUrl || asset.storageUrl;
}

export function getComposeAssetPublishUrl(asset?: ComposeMediaAsset) {
  if (!asset) return undefined;

  const candidates = [asset.storageUrl, asset.previewUrl];
  return candidates.find((value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim()));
}

export function getComposeThumbnailPublishUrl(thumbnail?: ComposeThumbnailAsset) {
  if (!thumbnail) return undefined;
  const candidates = [thumbnail.storageUrl, thumbnail.previewUrl];
  return candidates.find((value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim()));
}

export function summarizeComposeMedia(assets: ComposeMediaAsset[]): ComposeMediaSummary {
  const imageCount = assets.filter((asset) => asset.kind === 'image').length;
  const videoCount = assets.filter((asset) => asset.kind === 'video').length;

  let kind: ComposeMediaSummary['kind'] = 'empty';
  if (assets.length === 1 && imageCount === 1) kind = 'single-image';
  if (assets.length === 1 && videoCount === 1) kind = 'single-video';
  if (assets.length > 1 && imageCount === assets.length) kind = 'multi-image';
  if (assets.length > 1 && videoCount === assets.length) kind = 'multi-video';
  if (assets.length > 1 && imageCount > 0 && videoCount > 0) kind = 'mixed-media';

  return {
    totalAssets: assets.length,
    imageCount,
    videoCount,
    kind,
  };
}

export function getComposePlatformCompatibility(
  platform: ComposePlatformKey,
  assets: ComposeMediaAsset[],
): ComposePlatformCompatibility {
  const capability = PLATFORM_CAPABILITIES[platform];
  const summary = summarizeComposeMedia(assets);

  if (summary.kind === 'empty') {
    return {
      platform,
      supported: true,
      label: 'Ready',
    };
  }

  if (summary.totalAssets > capability.maxItems) {
    return {
      platform,
      supported: false,
      label: 'Unsupported',
      reason: `Supports up to ${capability.maxItems} item${capability.maxItems === 1 ? '' : 's'} in this flow.`,
    };
  }

  switch (summary.kind) {
    case 'single-image':
      return capability.supportsSingleImage
        ? { platform, supported: true, label: 'Single image' }
        : { platform, supported: false, label: 'Unsupported', reason: 'This platform does not accept image-only posts in this flow.' };
    case 'single-video':
      return capability.supportsSingleVideo
        ? { platform, supported: true, label: 'Single video' }
        : { platform, supported: false, label: 'Unsupported', reason: 'This platform requires a different media type in this flow.' };
    case 'multi-image':
      return capability.supportsMultiImage
        ? { platform, supported: true, label: 'Carousel' }
        : { platform, supported: false, label: 'Unsupported', reason: 'This platform only supports one image in this flow.' };
    case 'multi-video':
      return capability.supportsMultiVideo
        ? { platform, supported: true, label: 'Carousel' }
        : { platform, supported: false, label: 'Unsupported', reason: 'This platform does not support multiple videos in this flow.' };
    case 'mixed-media':
      return capability.supportsMixedMedia
        ? { platform, supported: true, label: 'Carousel' }
        : { platform, supported: false, label: 'Unsupported', reason: 'This platform does not support mixed image and video uploads in this flow.' };
    default:
      return { platform, supported: true, label: 'Ready' };
  }
}

export function getComposeCompatibilityMap(
  assets: ComposeMediaAsset[],
): Record<ComposePlatformKey, ComposePlatformCompatibility> {
  return {
    instagram: getComposePlatformCompatibility('instagram', assets),
    facebook: getComposePlatformCompatibility('facebook', assets),
    tiktok: getComposePlatformCompatibility('tiktok', assets),
    threads: getComposePlatformCompatibility('threads', assets),
    x: getComposePlatformCompatibility('x', assets),
    youtube: getComposePlatformCompatibility('youtube', assets),
    pinterest: getComposePlatformCompatibility('pinterest', assets),
  };
}

export function buildComposeItemTitleFromAssets(
  assets: ComposeMediaAsset[],
  fallbackTitle: string,
): string {
  const firstAsset = assets[0];
  if (!firstAsset) return fallbackTitle;
  if (assets.length === 1) return firstAsset.fileName;
  return `${firstAsset.fileName} +${assets.length - 1} more`;
}
