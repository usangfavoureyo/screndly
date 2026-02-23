// ============================================================================
// YOUTUBE API SERVICE
// ============================================================================
// Handles all YouTube API interactions

import { apiClient } from './client';
import { 
  YouTubeVideo, 
  YouTubeUploadRequest, 
  YouTubeUploadResponse,
  YouTubeComment,
  YouTubeCommentReplyRequest,
  ApiResponse 
} from './types';

export class YouTubeApi {
  /**
   * Search for videos
   */
  async searchVideos(query: string, maxResults: number = 10): Promise<ApiResponse<YouTubeVideo[]>> {
    // Mock implementation - replace with real API
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: [
            {
              id: 'abc123',
              title: `${query} - Official Trailer`,
              description: 'Watch the official trailer...',
              thumbnailUrl: 'https://via.placeholder.com/320x180',
              channelId: 'channel1',
              channelTitle: 'Screen Render',
              publishedAt: new Date().toISOString(),
              duration: 'PT2M30S',
              viewCount: 1000000,
              likeCount: 50000,
              commentCount: 2500,
            },
          ],
        });
      }, 1000);
    });
  }

  /**
   * Upload video to YouTube
   */
  async uploadVideo(
    request: YouTubeUploadRequest,
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<YouTubeUploadResponse>> {
    if (typeof request.videoFile === 'string') {
      // URL-based upload
      return apiClient.post<YouTubeUploadResponse>('/youtube/upload', {
        ...request,
        videoUrl: request.videoFile,
      });
    } else {
      // File upload
      return apiClient.uploadFile<YouTubeUploadResponse>(
        '/youtube/upload',
        request.videoFile,
        onProgress,
        {
          title: request.title,
          description: request.description,
          tags: request.tags?.join(','),
          category: request.category,
          privacy: request.privacy || 'public',
        }
      );
    }
  }

  /**
   * Get video details
   */
  async getVideo(videoId: string): Promise<ApiResponse<YouTubeVideo>> {
    return apiClient.get<YouTubeVideo>(`/youtube/videos/${videoId}`);
  }

  /**
   * Get video comments
   */
  async getComments(videoId: string, maxResults: number = 100): Promise<ApiResponse<YouTubeComment[]>> {
    return apiClient.get<YouTubeComment[]>(`/youtube/videos/${videoId}/comments`, {
      headers: { 'X-Max-Results': String(maxResults) },
    });
  }

  /**
   * Reply to a comment
   */
  async replyToComment(request: YouTubeCommentReplyRequest): Promise<ApiResponse<YouTubeComment>> {
    return apiClient.post<YouTubeComment>('/youtube/comments/reply', request);
  }

  /**
   * Get channel analytics
   */
  async getChannelAnalytics(channelId: string, period: 'day' | 'week' | 'month' = 'week'): Promise<ApiResponse<any>> {
    return apiClient.get(`/youtube/channels/${channelId}/analytics`, {
      headers: { 'X-Period': period },
    });
  }

  /**
   * Validate URL is a YouTube video
   */
  isValidYouTubeUrl(url: string): boolean {
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]{11}/,
      /^https?:\/\/youtu\.be\/[\w-]{11}/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]{11}/,
    ];
    return patterns.some(pattern => pattern.test(url));
  }

  /**
   * Extract video ID from YouTube URL
   */
  extractVideoId(url: string): string | null {
    const patterns = [
      /youtube\.com\/watch\?v=([\w-]{11})/,
      /youtu\.be\/([\w-]{11})/,
      /youtube\.com\/embed\/([\w-]{11})/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  }
}

export const youtubeApi = new YouTubeApi();
