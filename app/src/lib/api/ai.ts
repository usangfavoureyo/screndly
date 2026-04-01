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

export async function generateComposeMetadata(request: ComposeMetadataGenerationRequest) {
  return apiClient.post<ComposeMetadataGenerationResult>('/api/ai/generate/compose-metadata', request, {
    timeout: 120000,
  });
}
