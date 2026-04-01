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

export async function generateComposeThumbnail(request: {
  metadataText: string;
  thumbnailType: 'shared' | 'youtube' | 'x';
  titleHint?: string;
  sharedCaption?: string;
  youtubeTitle?: string;
}) {
  return apiClient.post<ComposeThumbnailGenerationResult>('/api/ai/generate/compose-thumbnail', request, {
    timeout: 120000,
  });
}
