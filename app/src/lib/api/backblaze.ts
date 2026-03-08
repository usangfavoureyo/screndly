import { apiClient } from './client';

export interface BackblazeBrowserFile {
  fileId: string;
  fileName: string;
  contentType: string;
  contentLength: number;
  uploadTimestamp: number;
  lastModified?: string;
  url: string;
}

interface UploadAssetResponse {
  url: string;
  fileName: string;
  originalName: string;
  contentType: string;
  size: number;
}

export async function listDesignTemplates(): Promise<{ success: boolean; files?: BackblazeBrowserFile[]; error?: string }> {
  const response = await apiClient.get<BackblazeBrowserFile[]>('/api/design-studio/backblaze/templates');

  if (!response.success) {
    return {
      success: false,
      error: response.error?.message || 'Failed to load templates',
    };
  }

  return {
    success: true,
    files: response.data || [],
  };
}

export async function listVideoStudioFiles(kind: 'videos' | 'subtitles'): Promise<{ success: boolean; files?: BackblazeBrowserFile[]; error?: string }> {
  const response = await apiClient.get<BackblazeBrowserFile[]>(`/api/video-studio/backblaze/${kind}`);

  if (!response.success) {
    return {
      success: false,
      error: response.error?.message || 'Failed to load files',
    };
  }

  return {
    success: true,
    files: response.data || [],
  };
}

export async function uploadVideoStudioAsset(
  file: File,
  folder: 'trailers' | 'voiceovers' | 'music'
): Promise<{ success: boolean; data?: UploadAssetResponse; error?: string }> {
  const response = await apiClient.uploadFile<UploadAssetResponse>(
    '/api/video-studio/upload-asset',
    file,
    undefined,
    { folder }
  );

  if (!response.success) {
    return {
      success: false,
      error: response.error?.message || 'Failed to upload asset',
    };
  }

  return {
    success: true,
    data: response.data,
  };
}
