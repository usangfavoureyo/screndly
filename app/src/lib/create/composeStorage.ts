import { apiClient } from '../api/client';
import { getApiUrl } from '../api/config';

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

interface ResolveComposeAssetAccessResponse {
  url: string;
  previewUrl?: string;
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

  const apiBaseUrl = getApiUrl();
  const normalizedBaseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  return `${normalizedBaseUrl}/api/create/asset-stream?url=${encodeURIComponent(url)}`;
}

function dedupeUrls(urls: Array<string | undefined | null>) {
  const seen = new Set<string>();
  return urls.filter((value): value is string => {
    if (typeof value !== 'string') {
      return false;
    }

    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      return false;
    }

    seen.add(trimmed);
    return true;
  });
}

export function buildComposeRenderableUrls(input: { previewUrl?: string; storageUrl?: string }): string[] {
  const { previewUrl, storageUrl } = input;

  if (previewUrl?.startsWith('blob:')) {
    return [previewUrl];
  }

  const candidates = dedupeUrls([
    previewUrl,
    buildComposeAssetStreamUrl(storageUrl),
    storageUrl,
    previewUrl && previewUrl !== storageUrl ? buildComposeAssetStreamUrl(previewUrl) : undefined,
  ]);

  return candidates;
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

export async function resolveComposeAssetAccess(
  url: string,
): Promise<{ url: string; previewUrl?: string }> {
  const response = await apiClient.post<ResolveComposeAssetAccessResponse>('/api/create/asset-access', { url });

  if (!response.success || !response.data?.url) {
    throw new Error(response.error?.message || 'Failed to refresh asset access.');
  }

  return {
    url: response.data.url,
    previewUrl: response.data.previewUrl,
  };
}
