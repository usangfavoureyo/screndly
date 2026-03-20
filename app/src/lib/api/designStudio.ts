import { apiClient } from './client';

export type DesignStudioContentType = 'poster' | 'carousel' | 'story' | 'announcement' | 'general';

export interface DesignStudioTemplateRecord {
  id: string;
  name: string;
  previewUrl: string;
  aspectRatio: string;
  width: number;
  height: number;
  source: 'upload' | 'backblaze';
  lastEdited: string;
  hasSubtext: boolean;
  hasCategory?: boolean;
  hasSource?: boolean;
  psdData?: Record<string, any> | null;
}

export interface DesignStudioRenderedDesignRecord {
  id: string;
  templateId: string;
  templateName: string;
  outputUrl: string;
  data: Record<string, any>;
  createdAt: string;
  aspectRatio: string;
  caption?: string;
  contentType?: DesignStudioContentType;
}

export interface DesignStudioStateResponse {
  templates: DesignStudioTemplateRecord[];
  renderedDesigns: DesignStudioRenderedDesignRecord[];
}

export type DesignStudioActivityType =
  | 'template_uploaded'
  | 'templates_loaded'
  | 'design_rendered'
  | 'design_published'
  | 'template_deleted';

export interface DesignStudioTMDbSearchResult {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  backdrop: string | null;
  poster: string | null;
  releaseDate: string | null;
}

export async function fetchDesignStudioState(): Promise<DesignStudioStateResponse> {
  const response = await apiClient.get<DesignStudioStateResponse>('/api/design-studio/state');
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to load Design Studio state');
  }

  return response.data;
}

export async function saveDesignStudioState(state: DesignStudioStateResponse): Promise<void> {
  const response = await apiClient.put<DesignStudioStateResponse>('/api/design-studio/state', state);
  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to save Design Studio state');
  }
}

export async function uploadDesignStudioAsset(file: File, folder: 'templates' | 'template-previews' | 'renders'): Promise<{ url: string; fileName: string }> {
  const response = await apiClient.uploadFile<{ url: string; fileName: string }>(
    '/api/design-studio/upload-asset',
    file,
    undefined,
    { folder }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to upload Design Studio asset');
  }

  return response.data;
}

export async function createDesignStudioActivity(type: DesignStudioActivityType, details: Record<string, any>): Promise<void> {
  const response = await apiClient.post('/api/design-studio/activity', { type, details });
  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to save Design Studio activity');
  }
}

export async function searchDesignStudioTMDb(query: string): Promise<DesignStudioTMDbSearchResult[]> {
  const response = await apiClient.get<DesignStudioTMDbSearchResult[]>(`/api/tmdb/search?query=${encodeURIComponent(query)}`);
  if (!response.success || !Array.isArray(response.data)) {
    throw new Error(response.error?.message || 'Failed to search TMDb');
  }

  return response.data;
}
