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

interface ImportComposeRemoteImageResponse {
  url: string;
  previewUrl?: string;
  fileName: string;
  fileId?: string;
  contentType: string;
  size: number;
}

const COMPOSE_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const COMPOSE_CROP_TIMEOUT_MS = 10 * 60 * 1000;

export function buildComposeAssetStreamUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (!/^https?:\/\//i.test(url)) {
    return url;
  }

  try {
    const parsed = new URL(url);
    const isBackblazeFile = /backblazeb2\.com$/i.test(parsed.hostname) && parsed.pathname.includes('/file/');
    const hasDownloadAuthorization = parsed.searchParams.has('Authorization');

    // Authorized preview URLs are already browser-safe; only proxy raw Backblaze file URLs.
    if (!isBackblazeFile || hasDownloadAuthorization) {
      return url;
    }
  } catch {
    return url;
  }

  return `/api/create/asset-stream?url=${encodeURIComponent(url)}`;
}

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

export async function importComposeRemoteImage(payload: {
  imageUrl: string;
  category: 'backdrops' | 'posters' | 'profiles' | 'logos';
  resultTitle: string;
}): Promise<{ url: string; previewUrl?: string; fileId: string; fileName: string; contentType: string; size: number }> {
  if (!apiClient.isBackendAvailable()) {
    throw new Error('Backend is not available for TMDb imports.');
  }

  const response = await apiClient.post<ImportComposeRemoteImageResponse>(
    '/api/create/import-remote-image',
    payload,
    { timeout: COMPOSE_UPLOAD_TIMEOUT_MS },
  );

  if (!response.success || !response.data?.url) {
    throw new Error(response.error?.message || 'Failed to import the selected TMDb image.');
  }

  return {
    url: response.data.url,
    previewUrl: response.data.previewUrl,
    fileId: response.data.fileId || response.data.fileName,
    fileName: response.data.fileName,
    contentType: response.data.contentType,
    size: response.data.size,
  };
}

export async function generateThreadsXCropAsset(
  file: File,
  focusYPercent: number,
): Promise<{ url: string; previewUrl?: string; fileId: string; fileName: string; size: number }> {
  if (!apiClient.isBackendAvailable()) {
    throw new Error('Backend is not available for Threads/X crop generation.');
  }

  const response = await apiClient.uploadFile<UploadComposeAssetResponse>(
    '/api/create/generate-threads-x-crop',
    file,
    undefined,
    { focusYPercent },
    { timeout: COMPOSE_CROP_TIMEOUT_MS },
  );

  if (!response.success || !response.data?.url) {
    throw new Error(response.error?.message || 'Failed to generate the Threads/X crop.');
  }

  return {
    url: response.data.url,
    previewUrl: response.data.previewUrl,
    fileId: response.data.fileId || response.data.fileName,
    fileName: response.data.fileName,
    size: response.data.size,
  };
}

export async function resolveComposeAssetPreview(url: string): Promise<string> {
  const response = await apiClient.post<{ url: string; previewUrl: string }>('/api/create/asset-preview', { url });

  if (!response.success || !response.data?.previewUrl) {
    throw new Error(response.error?.message || 'Failed to resolve asset preview.');
  }

  return response.data.previewUrl;
}
