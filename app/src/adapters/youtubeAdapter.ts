/**
 * YouTube Adapter for Screndly
 * 
 * Implements YouTube Data API v3 with:
 * - OAuth 2.0 authorization
 * - Resumable video upload
 * - Playlist management
 * - Quota tracking
 * 
 * References:
 * - YouTube Data API: https://developers.google.com/youtube/v3
 * - Video Upload: https://developers.google.com/youtube/v3/guides/uploading_a_video
 * - Resumable Upload: https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
 */

import { youtubeTokenStorage } from '../utils/youtubeTokenStorage';
import { youtubeVideoProcessor } from '../utils/youtubeVideoProcessor';
import { youtubeRateLimiter } from '../utils/youtubeRateLimiter';

// Test mode toggle (browser-safe)
export const TEST_MODE = typeof process !== 'undefined'
  ? (process.env?.NODE_ENV === 'test' || process.env?.YOUTUBE_TEST_MODE === 'true')
  : false;

// YouTube API URLs
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3';

// Video Requirements
export const YOUTUBE_VIDEO_REQUIREMENTS = {
  maxDuration: 12 * 60 * 60, // 12 hours (verified accounts), 15 minutes (unverified)
  minDuration: 1, // 1 second
  maxSize: 256 * 1024 * 1024 * 1024, // 256 GB
  maxSizeUnverified: 128 * 1024 * 1024 * 1024, // 128 GB for unverified accounts
  formats: [
    'MP4', 'MOV', 'AVI', 'WMV', 'FLV', 'WEBM', 'MPEG4', '3GPP', 'MKV'
  ],
  codecs: ['H.264', 'H.265', 'VP9', 'AV1'],
  aspectRatios: ['16:9', '4:3', '1:1', '9:16'], // Standard, Classic, Square, Vertical
  maxResolution: { width: 7680, height: 4320 }, // 8K
  recommendedResolution: { width: 1920, height: 1080 }, // 1080p
  frameRate: { min: 24, max: 60 },
  audioCodec: 'AAC',
  audioBitrate: { min: 128000, recommended: 384000 }, // 128-384 kbps
};

// Quota Costs (per operation)
export const YOUTUBE_QUOTA_COSTS = {
  upload: 1600, // Video upload
  update: 50, // Update video metadata
  list: 1, // List videos
  insert: 50, // Insert into playlist
  delete: 50, // Delete video
};

// Daily quota limit (default for new projects)
export const YOUTUBE_DAILY_QUOTA = 10000;

// Privacy Status
export type PrivacyStatus = 'public' | 'private' | 'unlisted';

// Video Category IDs (common ones)
export const VIDEO_CATEGORIES = {
  FILM_ANIMATION: '1',
  AUTOS_VEHICLES: '2',
  MUSIC: '10',
  PETS_ANIMALS: '15',
  SPORTS: '17',
  TRAVEL_EVENTS: '19',
  GAMING: '20',
  PEOPLE_BLOGS: '22',
  COMEDY: '23',
  ENTERTAINMENT: '24',
  NEWS_POLITICS: '25',
  HOWTO_STYLE: '26',
  EDUCATION: '27',
  SCIENCE_TECH: '28',
  NONPROFITS: '29',
};

interface UploadOptions {
  videoUrl?: string;
  videoFile?: File | Blob;
  title: string; // Max 100 characters
  description?: string; // Max 5000 characters
  tags?: string[]; // Max 500 characters total
  categoryId?: string;
  privacyStatus?: PrivacyStatus;
  madeForKids?: boolean;
  playlistId?: string;
  thumbnailUrl?: string;
  publishAt?: string; // ISO 8601 format for scheduled publish
  notifySubscribers?: boolean;
}

interface UploadResult {
  success: boolean;
  videoId?: string;
  videoUrl?: string;
  error?: string;
  quotaUsed?: number;
  retryAfter?: number;
  processingTime?: number;
  logs: string[];
}

/**
 * YouTube Adapter Class
 */
export class YouTubeAdapter {
  private readonly MAX_TITLE_LENGTH = 100;
  private readonly MAX_DESCRIPTION_LENGTH = 5000;
  private readonly MAX_TAGS_LENGTH = 500;
  private readonly CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB chunks for resumable upload

  constructor() { }

  /**
   * Initialize adapter
   */
  async initialize(): Promise<void> {
    if (TEST_MODE) {
      console.log('[YouTube] Running in TEST_MODE');
      return;
    }

    // Get access token
    const token = await youtubeTokenStorage.getToken('youtube');
    if (!token) {
      throw new Error('No YouTube access token found. Please authenticate first.');
    }

    // Verify token is valid
    await this.verifyCredentials();
  }

  /**
   * Upload video to YouTube
   */
  async upload(options: UploadOptions): Promise<UploadResult> {
    const logs: string[] = [];
    const startTime = Date.now();

    try {
      logs.push('[YouTube] Starting video upload');

      // Check quota
      await youtubeRateLimiter.checkQuota(YOUTUBE_QUOTA_COSTS.upload);
      logs.push('[YouTube] Quota check passed');

      const token = await youtubeTokenStorage.getToken('youtube');
      if (!token) {
        throw new Error('No YouTube access token');
      }

      // Validate video
      if (!options.videoUrl && !options.videoFile) {
        throw new Error('Video is required for YouTube uploads');
      }

      logs.push('[YouTube] Validating video');
      const validation = await youtubeVideoProcessor.validateVideo(
        options.videoUrl || options.videoFile!
      );

      if (!validation.valid) {
        throw new Error(`Video validation failed: ${validation.errors.join(', ')}`);
      }
      logs.push('[YouTube] Video validation passed');

      // Validate metadata
      this.validateMetadata(options);
      logs.push('[YouTube] Metadata validation passed');

      if (TEST_MODE) {
        logs.push('[YouTube] TEST_MODE: Returning mock response');
        await youtubeRateLimiter.incrementUsage(YOUTUBE_QUOTA_COSTS.upload);
        return {
          success: true,
          videoId: 'dQw4w9WgXcQ',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          quotaUsed: YOUTUBE_QUOTA_COSTS.upload,
          processingTime: Date.now() - startTime,
          logs,
        };
      }

      // Upload video using resumable upload
      logs.push('[YouTube] Starting resumable upload');
      const videoId = await this.uploadVideoResumable(
        options.videoUrl || options.videoFile!,
        options,
        token.accessToken,
        logs
      );
      logs.push(`[YouTube] Upload complete: ${videoId}`);

      // Add to playlist if specified
      if (options.playlistId) {
        logs.push(`[YouTube] Adding to playlist: ${options.playlistId}`);
        await this.addToPlaylist(videoId, options.playlistId, token.accessToken);
        await youtubeRateLimiter.incrementUsage(YOUTUBE_QUOTA_COSTS.insert);
      }

      // Upload custom thumbnail if provided
      if (options.thumbnailUrl) {
        logs.push('[YouTube] Uploading custom thumbnail');
        await this.uploadThumbnail(videoId, options.thumbnailUrl, token.accessToken);
      }

      await youtubeRateLimiter.incrementUsage(YOUTUBE_QUOTA_COSTS.upload);

      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      logs.push(`[YouTube] Video published: ${videoUrl}`);

      return {
        success: true,
        videoId,
        videoUrl,
        quotaUsed: YOUTUBE_QUOTA_COSTS.upload,
        processingTime: Date.now() - startTime,
        logs,
      };
    } catch (error: any) {
      logs.push(`[YouTube] Error: ${error.message}`);
      return this.handleError(error, logs);
    }
  }

  /**
   * Upload video using resumable upload protocol
   */
  private async uploadVideoResumable(
    video: string | File | Blob,
    options: UploadOptions,
    accessToken: string,
    logs: string[]
  ): Promise<string> {
    // Get video data
    let videoData: ArrayBuffer;
    let videoSize: number;

    if (typeof video === 'string') {
      logs.push(`[YouTube] Downloading video from URL`);
      const response = await fetch(video);
      videoData = await response.arrayBuffer();
      videoSize = videoData.byteLength;
    } else {
      logs.push('[YouTube] Reading video from file');
      videoData = await video.arrayBuffer();
      videoSize = videoData.byteLength;
    }

    logs.push(`[YouTube] Video size: ${this.formatBytes(videoSize)}`);

    // Step 1: Initialize resumable upload session
    const metadata = {
      snippet: {
        title: options.title,
        description: options.description || '',
        tags: options.tags || [],
        categoryId: options.categoryId || VIDEO_CATEGORIES.ENTERTAINMENT,
      },
      status: {
        privacyStatus: options.privacyStatus || 'private',
        selfDeclaredMadeForKids: options.madeForKids || false,
        publishAt: options.publishAt,
      },
    };

    const initUrl = `${YOUTUBE_UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`;

    const initResponse = await fetch(initUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Length': videoSize.toString(),
        'X-Upload-Content-Type': 'video/*',
      },
      body: JSON.stringify(metadata),
    });

    if (!initResponse.ok) {
      const error = await initResponse.json();
      throw new Error(error.error?.message || 'Failed to initialize upload');
    }

    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('No upload URL returned');
    }

    logs.push('[YouTube] Upload session initialized');

    // Step 2: Upload video in chunks
    let uploadedBytes = 0;
    const chunks = Math.ceil(videoSize / this.CHUNK_SIZE);

    logs.push(`[YouTube] Uploading in ${chunks} chunks`);

    while (uploadedBytes < videoSize) {
      const chunkStart = uploadedBytes;
      const chunkEnd = Math.min(uploadedBytes + this.CHUNK_SIZE, videoSize);
      const chunk = videoData.slice(chunkStart, chunkEnd);

      const chunkResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': chunk.byteLength.toString(),
          'Content-Range': `bytes ${chunkStart}-${chunkEnd - 1}/${videoSize}`,
        },
        body: chunk,
      });

      if (chunkResponse.status === 308) {
        // Resume incomplete
        uploadedBytes = chunkEnd;
        const progress = Math.round((uploadedBytes / videoSize) * 100);
        logs.push(`[YouTube] Upload progress: ${progress}%`);
      } else if (chunkResponse.ok) {
        // Upload complete
        const result = await chunkResponse.json();
        logs.push('[YouTube] Upload complete');
        return result.id;
      } else {
        throw new Error(`Upload failed: ${chunkResponse.statusText}`);
      }
    }

    throw new Error('Upload completed but no video ID returned');
  }

  /**
   * Add video to playlist
   */
  private async addToPlaylist(
    videoId: string,
    playlistId: string,
    accessToken: string
  ): Promise<void> {
    const url = `${YOUTUBE_API_BASE}/playlistItems?part=snippet`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to add video to playlist');
    }
  }

  /**
   * Upload custom thumbnail
   */
  private async uploadThumbnail(
    videoId: string,
    thumbnailUrl: string,
    accessToken: string
  ): Promise<void> {
    // Download thumbnail
    const response = await fetch(thumbnailUrl);
    const thumbnailData = await response.arrayBuffer();

    const url = `${YOUTUBE_UPLOAD_BASE}/thumbnails/set?videoId=${videoId}`;

    const uploadResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg',
      },
      body: thumbnailData,
    });

    if (!uploadResponse.ok) {
      console.warn('Failed to upload thumbnail:', await uploadResponse.text());
    }
  }

  /**
   * Get channel info
   */
  async getChannelInfo(): Promise<any> {
    const token = await youtubeTokenStorage.getToken('youtube');
    if (!token) {
      throw new Error('No access token');
    }

    if (TEST_MODE) {
      return {
        id: 'UC_test_channel',
        snippet: {
          title: 'Test Channel',
          customUrl: '@testchannel',
          thumbnails: {
            default: { url: 'https://example.com/avatar.jpg' },
          },
        },
        statistics: {
          subscriberCount: '1000',
          videoCount: '50',
        },
      };
    }

    const url = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&mine=true`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get channel info');
    }

    const data = await response.json();
    return data.items?.[0];
  }

  /**
   * Verify credentials
   */
  private async verifyCredentials(): Promise<void> {
    const token = await youtubeTokenStorage.getToken('youtube');
    if (!token) {
      throw new Error('No access token');
    }

    if (TEST_MODE) {
      return;
    }

    await this.getChannelInfo();
  }

  /**
   * Get quota usage
   */
  async getQuotaUsage(): Promise<{
    used: number;
    limit: number;
    remaining: number;
    resetAt: number;
  }> {
    return await youtubeRateLimiter.getUsage();
  }

  /**
   * Validate metadata
   */
  private validateMetadata(options: UploadOptions): void {
    // Title
    if (!options.title || options.title.trim().length === 0) {
      throw new Error('Title is required');
    }
    if (options.title.length > this.MAX_TITLE_LENGTH) {
      throw new Error(
        `Title too long. Max ${this.MAX_TITLE_LENGTH} characters, got ${options.title.length}`
      );
    }

    // Description
    if (options.description && options.description.length > this.MAX_DESCRIPTION_LENGTH) {
      throw new Error(
        `Description too long. Max ${this.MAX_DESCRIPTION_LENGTH} characters, got ${options.description.length}`
      );
    }

    // Tags
    if (options.tags) {
      const tagsLength = options.tags.join(',').length;
      if (tagsLength > this.MAX_TAGS_LENGTH) {
        throw new Error(
          `Tags too long. Max ${this.MAX_TAGS_LENGTH} characters total, got ${tagsLength}`
        );
      }
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: any, logs: string[]): UploadResult {
    let errorMessage = error.message || 'Unknown error';
    let retryAfter: number | undefined;

    // Parse YouTube API errors
    if (error.code) {
      switch (error.code) {
        case 401:
          errorMessage = 'Access token expired. Please re-authenticate.';
          break;
        case 403:
          if (error.message?.includes('quota')) {
            errorMessage = 'Daily quota exceeded. Quota resets at midnight Pacific Time.';
            retryAfter = this.getSecondsUntilMidnightPST();
          } else {
            errorMessage = 'Permission denied. Check your OAuth scopes.';
          }
          break;
        case 400:
          errorMessage = `Invalid request: ${error.message}`;
          break;
      }
    }

    return {
      success: false,
      error: errorMessage,
      retryAfter,
      logs,
    };
  }

  /**
   * Get seconds until midnight PST (YouTube quota reset time)
   */
  private getSecondsUntilMidnightPST(): number {
    const now = new Date();
    const pstOffset = -8 * 60; // PST is UTC-8
    const nowPST = new Date(now.getTime() + (now.getTimezoneOffset() + pstOffset) * 60000);

    const midnightPST = new Date(nowPST);
    midnightPST.setHours(24, 0, 0, 0);

    return Math.floor((midnightPST.getTime() - nowPST.getTime()) / 1000);
  }

  /**
   * Format bytes
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Export singleton instance
export const youtubeAdapter = new YouTubeAdapter();