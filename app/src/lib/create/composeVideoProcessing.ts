import type {
  ComposeItem,
  ComposeMediaAsset,
  ComposePlatformKey,
  ComposeProcessedVideoAsset,
} from '../../types/compose';
import { generateThreadsXCropAsset } from './composeStorage';

const THREADS_X_PLATFORMS: ComposePlatformKey[] = ['threads', 'x'];
const NINE_BY_SIXTEEN_RATIO = 9 / 16;
const RATIO_TOLERANCE = 0.03;

export function buildComposeAssetSignature(asset: ComposeMediaAsset): string {
  return [
    asset.id,
    asset.fileName,
    asset.size,
    asset.storageFileId || '',
    asset.storageUrl || '',
    asset.previewUrl || '',
    asset.aspectRatioLabel || '',
  ].join('|');
}

export function isNineBySixteenAsset(asset?: ComposeMediaAsset | null): boolean {
  if (!asset || asset.kind !== 'video') return false;
  if (asset.aspectRatioLabel === '9:16') return true;
  if (typeof asset.aspectRatioValue === 'number' && asset.aspectRatioValue > 0) {
    return Math.abs(asset.aspectRatioValue - NINE_BY_SIXTEEN_RATIO) <= RATIO_TOLERANCE;
  }
  return false;
}

export function hasThreadsXSelection(platforms: ComposePlatformKey[]): boolean {
  return platforms.some((platform) => THREADS_X_PLATFORMS.includes(platform));
}

export function shouldOfferThreadsXCrop(asset: ComposeMediaAsset | undefined, platforms: ComposePlatformKey[]): boolean {
  return isNineBySixteenAsset(asset) && hasThreadsXSelection(platforms);
}

export function isThreadsXCropVariantReady(item: ComposeItem, asset: ComposeMediaAsset | undefined): boolean {
  if (!asset) return false;
  const settings = item.platformFields.videoProcessing;
  if (settings?.cropMode !== 'threads_x_3_4') return false;
  const variant = settings.threadsXCrop;
  if (!variant) return false;

  return (
    variant.sourceAssetId === asset.id &&
    variant.sourceSignature === buildComposeAssetSignature(asset) &&
    variant.focusYPercent === (settings.focusYPercent ?? 50) &&
    Boolean(variant.storageUrl || variant.previewUrl) &&
    variant.uploadStatus === 'uploaded'
  );
}

export function getVideoUrlForComposePlatform(item: ComposeItem, platform: ComposePlatformKey): string | undefined {
  const primaryAsset = item.mediaAssets[0];
  if (!primaryAsset || primaryAsset.kind !== 'video') return undefined;

  const settings = item.platformFields.videoProcessing;
  const variant = settings?.threadsXCrop;
  if (
    settings?.cropMode === 'threads_x_3_4' &&
    THREADS_X_PLATFORMS.includes(platform) &&
    variant &&
    variant.sourceAssetId === primaryAsset.id &&
    variant.sourceSignature === buildComposeAssetSignature(primaryAsset) &&
    variant.focusYPercent === (settings.focusYPercent ?? 50) &&
    variant.uploadStatus === 'uploaded'
  ) {
    return variant.storageUrl || (variant.previewUrl && !variant.previewUrl.startsWith('blob:') ? variant.previewUrl : undefined);
  }

  return primaryAsset.previewUrl || primaryAsset.storageUrl;
}

export function getThreadsXCropSourceUrl(asset: ComposeMediaAsset): string | undefined {
  const localPreviewUrl = typeof asset.previewUrl === 'string' && asset.previewUrl.trim().length > 0 && !/^https?:\/\//i.test(asset.previewUrl.trim())
    ? asset.previewUrl
    : undefined;
  if (localPreviewUrl) {
    return localPreviewUrl;
  }

  const localStorageUrl = typeof asset.storageUrl === 'string' && asset.storageUrl.trim().length > 0 && !/^https?:\/\//i.test(asset.storageUrl.trim())
    ? asset.storageUrl
    : undefined;
  if (localStorageUrl) {
    return localStorageUrl;
  }

  const publishedPreviewUrl = typeof asset.previewUrl === 'string' && /^https?:\/\//i.test(asset.previewUrl.trim())
    ? asset.previewUrl
    : undefined;
  if (publishedPreviewUrl) {
    return publishedPreviewUrl;
  }

  const publishedStorageUrl = typeof asset.storageUrl === 'string' && /^https?:\/\//i.test(asset.storageUrl.trim())
    ? asset.storageUrl
    : undefined;
  if (publishedStorageUrl) {
    return publishedStorageUrl;
  }

  return asset.previewUrl || asset.storageUrl;
}

export async function buildThreadsXCropVariant(
  asset: ComposeMediaAsset,
  focusYPercent: number,
  onProgress?: (progress: number, message: string) => void,
): Promise<ComposeProcessedVideoAsset> {
  const source = getThreadsXCropSourceUrl(asset);
  if (!source) {
    throw new Error('Upload the source video before generating a 3:4 crop.');
  }

  onProgress?.(10, 'Preparing the source video for the 3:4 crop...');
  const sourceResponse = await fetch(source);
  if (!sourceResponse.ok) {
    throw new Error(`Failed to load the source video (${sourceResponse.status}).`);
  }

  const sourceBlob = await sourceResponse.blob();
  const sourceFile = new File(
    [sourceBlob],
    asset.fileName,
    {
      type: asset.mimeType || sourceBlob.type || 'video/mp4',
      lastModified: Date.now(),
    },
  );
  onProgress?.(35, 'Generating the 3:4 crop on the server...');
  const generated = await generateThreadsXCropAsset(sourceFile, focusYPercent);
  onProgress?.(100, '3:4 crop ready.');

  return {
    fileName: generated.fileName,
    mimeType: 'video/mp4',
    size: generated.size,
    previewUrl: generated.previewUrl,
    storageUrl: generated.url,
    storageFileId: generated.fileId,
    uploadStatus: 'uploaded',
    sourceAssetId: asset.id,
    sourceSignature: buildComposeAssetSignature(asset),
    focusYPercent,
    aspectRatioLabel: '3:4',
  };
}
