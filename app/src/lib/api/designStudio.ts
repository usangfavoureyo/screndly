import { apiClient } from './client';

export type DesignStudioContentType = 'poster' | 'carousel' | 'story' | 'announcement' | 'general';
export type DesignStudioLayoutVariant =
  | 'top_left'
  | 'top_right'
  | 'top_center'
  | 'bottom_left'
  | 'bottom_right'
  | 'bottom_center';

export type DesignStudioExportFormat = 'jpeg' | 'png';
export type DesignStudioBrandBlockMode = 'auto' | 'black' | 'white';

export type DesignStudioAutoEditorialStatus =
  | 'detected'
  | 'rendering'
  | 'queued'
  | 'posted'
  | 'failed';

export interface DesignStudioTemplateRecord {
  id: string;
  name: string;
  sourceType?: 'device' | 'backblaze';
  sourceFilePath?: string;
  previewImage?: string;
  previewUrl: string;
  aspectRatio: string;
  width: number;
  height: number;
  source: 'upload' | 'backblaze';
  lastEdited: string;
  hasHeader?: boolean;
  hasBackground?: boolean;
  hasSubtext: boolean;
  hasOverlay?: boolean;
  hasCategory?: boolean;
  hasSource?: boolean;
  psdData?: Record<string, any> | null;
  baseVariant?: DesignStudioLayoutVariant;
  layoutVariant?: DesignStudioLayoutVariant;
  mappedLayers?: Record<string, string>;
  mappedLayerNames?: string[];
  layerReferences?: Array<Record<string, any>>;
  fontFamily?: string;
  fontStyle?: string;
  fontWeight?: number;
  baseFontSize?: number;
  fontColor?: string;
  lineHeightMultiplier?: number;
  tracking?: number;
  isPointText?: boolean;
  variants?: Array<Record<string, any>>;
  overlayDirection?: string;
  overlayStrength?: number;
  safeMargin?: number;
  isValidated?: boolean;
  validationState?: 'valid' | 'warning' | 'invalid';
  validationErrors?: string[];
  isDefaultManual?: boolean;
  isDefaultAuto?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DesignStudioRenderedDesignRecord {
  id: string;
  templateId: string;
  templateName: string;
  templateVariant?: DesignStudioLayoutVariant;
  exportFormat?: DesignStudioExportFormat;
  outputUrl: string;
  previewUrl?: string;
  data: Record<string, any>;
  createdAt: string;
  aspectRatio: string;
  caption?: string;
  captions?: {
    shared_caption: string;
    pinterest_title: string;
    pinterest_description: string;
  };
  contentType?: DesignStudioContentType;
}

export type DesignStudioManualRenderJobStatus =
  | 'queued'
  | 'rendering'
  | 'completed'
  | 'failed';

export interface DesignStudioManualRenderJob {
  id: string;
  templateId: string;
  templateName: string;
  status: DesignStudioManualRenderJobStatus;
  createdAt: string;
  updatedAt: string;
  renderedDesignId?: string | null;
  outputUrl?: string | null;
  failureReason?: string | null;
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
  templateVariant?: DesignStudioLayoutVariant;
  renderedImage: string;
  headerText: string;
  subheaderText?: string;
  caption: string;
  captions?: {
    shared_caption: string;
    pinterest_title: string;
    pinterest_description: string;
  };
  backgroundSource?: string;
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  zoomLevel?: number;
  overlayDirection?: string;
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
  | 'design_render_queued'
  | 'design_rendered'
  | 'design_render_failed'
  | 'design_scheduled'
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

export async function uploadDesignStudioTemplate(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{
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
  template: DesignStudioTemplateRecord;
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
    template: DesignStudioTemplateRecord;
  }>(
    '/api/design-studio/upload-template',
    file,
    onProgress,
    undefined,
    { timeout: 120000 },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to upload Design Studio template');
  }

  return response.data;
}

export async function importDesignStudioTemplate(payload: {
  url: string;
  fileName: string;
}): Promise<{ template: DesignStudioTemplateRecord }> {
  const response = await apiClient.post<{ template: DesignStudioTemplateRecord }>(
    '/api/design-studio/import-template',
    payload,
  );

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to import Design Studio template');
  }

  return response.data;
}

export async function fetchDesignStudioRenderJobs(): Promise<DesignStudioManualRenderJob[]> {
  const response = await apiClient.get<DesignStudioManualRenderJob[]>('/api/design-studio/render-jobs');
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to load Design Studio render jobs');
  }

  return response.data;
}

export async function triggerDesignStudioAutoGeneration(): Promise<{ generated: number; published: number; failed: number }> {
  const response = await apiClient.post<{ generated: number; published: number; failed: number }>(
    '/api/design-studio/generate-auto',
    {},
  );
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to generate auto editorials');
  }
  return response.data;
}

export async function startDesignStudioManualRender(payload: {
  template: DesignStudioTemplateRecord;
  data: {
    template_variant?: DesignStudioLayoutVariant;
    headerText: string;
    subtext?: string;
    headerTextColor?: string;
    subtextColor?: string;
    backgroundImage?: string;
    imageFocalPoint?: { x: number; y: number };
    imageZoom?: number;
    overlayColor?: string;
    overlayOpacity?: number;
    gradientPosition?: 'top' | 'bottom' | 'left' | 'right';
    caption?: string;
    contentType?: DesignStudioContentType;
    cropMode?: 'cover' | 'contain' | 'center' | 'face_focus';
    headerAlignment?: 'left' | 'center' | 'right';
    fontScale?: number;
    lineHeightMultiplier?: number;
    maxLines?: number;
    overlayType?: 'linear' | 'radial' | 'full_fade' | 'top_fade' | 'bottom_fade';
    useTemplateDefaultStyling?: boolean;
    backgroundOffsetX?: number;
    backgroundOffsetY?: number;
    zoomLevel?: number;
    fadeEnabled?: boolean;
    fadeOpacity?: number;
    brandBlockMode?: DesignStudioBrandBlockMode;
    sharedCaption?: string;
    pinterestTitle?: string;
    pinterestDescription?: string;
    exportFormat?: DesignStudioExportFormat;
  };
}): Promise<DesignStudioManualRenderJob> {
  const response = await apiClient.post<DesignStudioManualRenderJob>(
    '/api/design-studio/render-jobs',
    payload,
    { timeout: 15000 },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to queue Design Studio render');
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
