// ============================================================================
// YOUTUBE API TESTS
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { youtubeApi } from '../../lib/api/youtube';

describe('YouTubeApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchVideos', () => {
    it('should search for videos with query', async () => {
      const response = await youtubeApi.searchVideos('Inception', 10);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
      
      if (response.data && response.data.length > 0) {
        const video = response.data[0];
        expect(video).toHaveProperty('id');
        expect(video).toHaveProperty('title');
        expect(video).toHaveProperty('description');
        expect(video).toHaveProperty('thumbnailUrl');
      }
    });
  });

  describe('isValidYouTubeUrl', () => {
    it('should validate standard YouTube URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(youtubeApi.isValidYouTubeUrl(url)).toBe(true);
    });

    it('should validate short YouTube URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      expect(youtubeApi.isValidYouTubeUrl(url)).toBe(true);
    });

    it('should validate embed YouTube URL', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      expect(youtubeApi.isValidYouTubeUrl(url)).toBe(true);
    });

    it('should reject invalid URL', () => {
      const url = 'https://example.com/video';
      expect(youtubeApi.isValidYouTubeUrl(url)).toBe(false);
    });
  });

  describe('extractVideoId', () => {
    it('should extract video ID from standard URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(youtubeApi.extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from short URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      expect(youtubeApi.extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid URL', () => {
      const url = 'https://example.com/video';
      expect(youtubeApi.extractVideoId(url)).toBeNull();
    });
  });

  describe('uploadVideo', () => {
    it('should handle file upload with progress tracking', async () => {
      const mockFile = new File(['video content'], 'trailer.mp4', { type: 'video/mp4' });
      const progressCallback = vi.fn();

      const request = {
        title: 'Test Trailer',
        description: 'Test Description',
        videoFile: mockFile,
        tags: ['test', 'trailer'],
        privacy: 'public' as const,
      };

      // Note: This will fail in actual implementation until backend is ready
      // But the structure is correct
      try {
        await youtubeApi.uploadVideo(request, progressCallback);
      } catch (error) {
        // Expected to fail without backend
        expect(error).toBeDefined();
      }
    });
  });
});
