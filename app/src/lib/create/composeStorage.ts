import { apiClient } from '../api/client';

interface UploadComposeAssetResponse {
  url: string;
  fileName: string;
  fileId?: string;
  originalName: string;
  contentType: string;
  size: number;
}

export async function uploadComposeAsset(file: File): Promise<{ url: string; fileId: string }> {
  if (!apiClient.isBackendAvailable()) {
    throw new Error('Backend is not available for post uploads.');
  }

  const response = await apiClient.uploadFile<UploadComposeAssetResponse>('/api/create/upload-asset', file);
  if (!response.success || !response.data?.url) {
    throw new Error(response.error?.message || 'Failed to upload post asset to Backblaze.');
  }

  return {
    url: response.data.url,
    fileId: response.data.fileId || response.data.fileName,
  };
}
