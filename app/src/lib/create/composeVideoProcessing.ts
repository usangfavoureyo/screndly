import type {
  ComposeItem,
  ComposeMediaAsset,
  ComposePlatformKey,
  ComposeProcessedVideoAsset,
} from '../../types/compose';
import { cropVideoToAspectRatio } from '../../utils/ffmpeg';
import { uploadComposeAsset } from './composeStorage';

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
    variant.uploadStatus !== 'failed'
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
    variant.focusYPercent === (settings.focusYPercent ?? 50)
  ) {
    return variant.storageUrl || variant.previewUrl;
  }

  return primaryAsset.storageUrl || primaryAsset.previewUrl;
}

export async function generateThreadsXCropVariant(
  asset: ComposeMediaAsset,
  focusYPercent: number,
  onProgress?: (progress: number, message: string) => void,
): Promise<ComposeProcessedVideoAsset> {
  const source = asset.previewUrl || asset.storageUrl;
  if (!source) {
    throw new Error('Upload the source video before generating a 3:4 crop.');
  }

  const result = await cropVideoToAspectRatio({
    input: source,
    targetAspectRatio: '3:4',
    focusYPercent,
    outputFormat: 'mp4',
    onProgress,
  });

  if (!result.success || !result.outputBlob || !result.outputUrl) {
    throw new Error(result.error || 'Failed to generate the 3:4 video crop.');
  }

  const outputFile = new File(
    [result.outputBlob],
    asset.fileName.replace(/\.[^.]+$/, '') + '-threads-x-3x4.mp4',
    { type: 'video/mp4', lastModified: Date.now() },
  );
  const uploaded = await uploadComposeAsset(outputFile);

  return {
    fileName: outputFile.name,
    mimeType: outputFile.type,
    size: outputFile.size,
    previewUrl: uploaded.previewUrl || result.outputUrl,
    storageUrl: uploaded.url,
    storageFileId: uploaded.fileId,
    uploadStatus: 'uploaded',
    sourceAssetId: asset.id,
    sourceSignature: buildComposeAssetSignature(asset),
    focusYPercent,
    aspectRatioLabel: '3:4',
  };
}
