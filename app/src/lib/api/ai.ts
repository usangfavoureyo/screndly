import { apiClient } from './client';
import type { YouTubePlaylist } from './youtube';

export interface ComposeMetadataGenerationResult {
  sharedCaption: string;
  youtubeTitle: string;
  youtubeDescription: string;
  playlistSelection: {
    playlistId: string | null;
    playlistName: string | null;
    reason: string;
    confidence: number;
  };
}

export interface ComposeMetadataGenerationRequest {
  metadataText: string;
  model: string;
  selectedPlatforms: string[];
  availablePlaylists: YouTubePlaylist[];
  sharedCaptionPrompt?: string;
  youtubeTitlePrompt?: string;
  youtubeDescriptionPrompt?: string;
  youtubePlaylistPrompt?: string;
  mediaContext?: {
    fileName?: string;
    mimeType?: string;
    mediaKind?: 'image' | 'video';
  };
}

export interface ComposeContentIntentResult {
  intent: 'post_generation' | 'review_generation' | 'summary_generation' | 'promo_caption_generation' | 'metadata_extraction' | 'mixed_request';
  outputMode: 'post_fields' | 'preview_only';
  format: 'general' | 'short_form_video' | 'social_post' | 'youtube_metadata';
  durationSeconds: number | null;
  directFieldFillAllowed: boolean;
  detectedTitle: string;
  containsMetadata: boolean;
}

export interface ComposeMediaMetadata {
  title: string;
  year: number | null;
  mediaType: string;
  cast: string[];
  director: string;
  creator: string;
  studio: string;
  platform: string;
  releaseDate: string;
  synopsis: string;
  producers: string[];
  franchise: string;
  tone: string;
  sourceType: string;
}

export interface ComposeContentGenerationRequest extends Omit<ComposeMetadataGenerationRequest, 'metadataText'> {
  requestText: string;
  reviewPrompt?: string;
  summaryPrompt?: string;
}

export interface ComposeContentGenerationResult {
  intentResult: ComposeContentIntentResult;
  mediaMetadata: ComposeMediaMetadata;
  postFields: ComposeMetadataGenerationResult;
  editorialResult: {
    type: 'review' | 'summary' | 'editorial' | null;
    text: string;
  };
}

export interface ComposeThumbnailGenerationResult {
  fileName: string;
  mimeType: string;
  size: number;
  previewUrl: string;
  storageUrl: string;
  uploadStatus: 'uploaded';
  strategy?: string;
  resolvedTitle?: string;
}

export async function generateComposeMetadata(request: ComposeMetadataGenerationRequest) {
  return apiClient.post<ComposeMetadataGenerationResult>('/api/ai/generate/compose-metadata', request, {
    timeout: 120000,
  });
}

export async function generateComposeContent(request: ComposeContentGenerationRequest) {
  return apiClient.post<ComposeContentGenerationResult>('/api/ai/generate/compose-content', request, {
    timeout: 120000,
  });
}

export async function generateComposeThumbnail(request: {
  metadataText: string;
  model?: string;
  thumbnailType: 'shared' | 'youtube' | 'x';
  titleHint?: string;
  sharedCaption?: string;
  youtubeTitle?: string;
  thumbnailConfig?: unknown;
}) {
  return apiClient.post<ComposeThumbnailGenerationResult>('/api/ai/generate/compose-thumbnail', request, {
    timeout: 120000,
  });
}
