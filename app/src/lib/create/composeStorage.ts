import { generateFileName, isBackblazeConfigured, uploadToBackblaze } from '../../utils/backblaze';

export async function uploadComposeAsset(file: File): Promise<{ url: string; fileId: string }> {
  const preferredBucket = file.type.startsWith('video/') && isBackblazeConfigured('videos') ? 'videos' : 'general';

  if (!isBackblazeConfigured(preferredBucket)) {
    throw new Error(
      preferredBucket === 'videos'
        ? 'Backblaze videos bucket is not configured.'
        : 'Backblaze general storage is not configured.',
    );
  }

  const result = await uploadToBackblaze({
    file,
    fileName: generateFileName(file.name, `compose-${file.type.startsWith('video/') ? 'video' : 'image'}`),
    bucketType: preferredBucket,
    metadata: {
      'original-name': file.name,
      'upload-date': new Date().toISOString(),
      app: 'screndly-compose',
    },
  });

  if (!result.success || !result.url || !result.fileId) {
    throw new Error(result.error || 'Failed to upload compose asset to Backblaze.');
  }

  return {
    url: result.url,
    fileId: result.fileId,
  };
}
