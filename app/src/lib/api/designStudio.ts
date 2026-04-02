import { apiClient } from './client';

export type DesignStudioContentType = 'poster' | 'carousel' | 'story' | 'announcement' | 'general';
export type DesignStudioLayoutVariant =
  | 'top_left'
  | 'top_right'
  | 'top_center'
  | 'bottom_left'
  | 'bottom_right'
  | 'bottom_center';

export type DesignStudioAutoEditorialStatus =
  | 'draft'
  | 'queued'
  | 'scheduled'
  | 'posted'
  | 'failed';

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
  layoutVariant?: DesignStudioLayoutVariant;
  mappedLayers?: string[];
  textZone?: { horizontal: 'left' | 'center' | 'right'; vertical: 'top' | 'bottom' };
  imageAnchor?: { x: number; y: number };
  overlayDirection?: 'top' | 'bottom' | 'left' | 'right';
  overlayStrength?: number;
  safeMargin?: number;
  isValidated?: boolean;
  validationState?: 'valid' | 'warning' | 'invalid';
  isDefaultManual?: boolean;
  isDefaultAuto?: boolean;
  createdAt?: string;
  updatedAt?: string;
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

export interface DesignStudioAutoEditorialRecord {
  id: string;
  sourceFeedItemId: string;
  sourceFeedId?: string;
  sourceFeedName?: string;
  sourceTitle: string;
  sourceUrl?: string;
  matchedKeyword?: string;
  templateId: string;
  templateName?: string;
  renderedImage: string;
  headerText: string;
  subheaderText?: string;
  caption: string;
  backgroundSource?: string;
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  zoomLevel?: number;
  overlayDirection?: 'top' | 'bottom' | 'left' | 'right';
  overlayStrength?: number;
  scheduleTime?: string | null;
  targetPlatforms: string[];
  status: DesignStudioAutoEditorialStatus;
  createdAt: string;
  updatedAt: string;
  postedAt?: string | null;
  failureReason?: string | null;
}

export interface DesignStudioStateResponse {
  templates: DesignStudioTemplateRecord[];
  renderedDesigns: DesignStudioRenderedDesignRecord[];
  autoEditorials?: DesignStudioAutoEditorialRecord[];
}

export type DesignStudioActivityType =
  | 'template_uploaded'
  | 'templates_loaded'
  | 'design_rendered'
  | 'design_published'
  | 'template_deleted'
  | 'auto_editorial_generated'
  | 'auto_editorial_updated'
  | 'auto_editorial_posted'
  | 'auto_editorial_failed'
  | 'auto_editorial_deleted';

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

export async function uploadDesignStudioTemplate(file: File): Promise<{
  url: string;
  fileName: string;
  signature: string;
  width: number;
  height: number;
  layers: string[];
  detectedLayers: {
    hasHeader: boolean;
    hasSubtext: boolean;
    hasOverlay: boolean;
    hasBackground: boolean;
  };
}> {
  const response = await apiClient.uploadFile<{
    url: string;
    fileName: string;
    signature: string;
    width: number;
    height: number;
    layers: string[];
    detectedLayers: {
      hasHeader: boolean;
      hasSubtext: boolean;
      hasOverlay: boolean;
      hasBackground: boolean;
    };
  }>(
    '/api/design-studio/upload-template',
    file,
    undefined,
    undefined,
    { timeout: 120000 },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to upload Design Studio template');
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
