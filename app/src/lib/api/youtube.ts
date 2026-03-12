import { apiClient } from './client';

export interface YouTubePlaylist {
  id: string;
  title: string;
  itemCount?: number;
  privacyStatus?: 'private' | 'public' | 'unlisted';
}

function normalizePlaylist(playlist: any): YouTubePlaylist | null {
  if (!playlist?.id || !playlist?.title) {
    return null;
  }

  return {
    id: String(playlist.id),
    title: String(playlist.title),
    itemCount: typeof playlist.itemCount === 'number' ? playlist.itemCount : undefined,
    privacyStatus:
      typeof playlist.privacyStatus === 'string'
        ? (playlist.privacyStatus as YouTubePlaylist['privacyStatus'])
        : undefined,
  };
}

export async function fetchYouTubePlaylists(): Promise<YouTubePlaylist[]> {
  const response = await apiClient.get<any[]>('/api/platforms/youtube/playlists');

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to fetch YouTube playlists');
  }

  if (!Array.isArray(response.data)) {
    return [];
  }

  return response.data
    .map(normalizePlaylist)
    .filter((playlist): playlist is YouTubePlaylist => !!playlist);
}
