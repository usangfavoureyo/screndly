import { apiClient } from '../api/client';

interface UploadComposeAssetResponse {
  url: string;
  previewUrl?: string;
  fileName: string;
  fileId?: string;
  originalName: string;
  contentType: string;
  size: number;
}

const COMPOSE_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

export async function uploadComposeAsset(file: File): Promise<{ url: string; previewUrl?: string; fileId: string }> {
  if (!apiClient.isBackendAvailable()) {
    throw new Error('Backend is not available for post uploads.');
  }

  const response = await apiClient.uploadFile<UploadComposeAssetResponse>(
    '/api/create/upload-asset',
    file,
    undefined,
    undefined,
    { timeout: COMPOSE_UPLOAD_TIMEOUT_MS },
  );
  if (!response.success || !response.data?.url) {
    throw new Error(response.error?.message || 'Failed to upload post asset to Backblaze.');
  }

  return {
    url: response.data.url,
    previewUrl: response.data.previewUrl,
    fileId: response.data.fileId || response.data.fileName,
  };
}

export async function resolveComposeAssetPreview(url: string): Promise<string> {
  const response = await apiClient.post<{ url: string; previewUrl: string }>('/api/create/asset-preview', { url });

  if (!response.success || !response.data?.previewUrl) {
    throw new Error(response.error?.message || 'Failed to resolve asset preview.');
  }

  return response.data.previewUrl;
}
