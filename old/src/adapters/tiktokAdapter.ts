/**
 * TikTok Adapter for Screndly
 * 
 * Implements TikTok Content Posting API with:
 * - OAuth 2.0 authorization
 * - Direct video upload
 * - Creator marketplace integration
 * - Auto-publish and draft support
 * 
 * References:
 * - TikTok for Developers: https://developers.tiktok.com/
 * - Content Posting API: https://developers.tiktok.com/doc/content-posting-api-get-started
 * - Video Upload: https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
 */

import { tiktokTokenStorage } from '../utils/tiktokTokenStorage';
import { tiktokVideoProcessor } from '../utils/tiktokVideoProcessor';
import { tiktokRateLimiter } from '../utils/tiktokRateLimiter';

// Test mode toggle
export const TEST_MODE = process.env.NODE_ENV === 'test' || process.env.TIKTOK_TEST_MODE === 'true';

// TikTok API URLs
const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

// Video Requirements
export const TIKTOK_VIDEO_REQUIREMENTS = {
  maxDuration: 600, // 10 minutes
  minDuration: 3, // 3 seconds
  maxSize: 4 * 1024 * 1024 * 1024, // 4 GB
  formats: ['MP4', 'MOV', 'WEBM'],
  codecs: ['H.264', 'H.265'],
  aspectRatios: ['9:16', '1:1', '16:9'], // Vertical, Square, Horizontal
  minResolution: { width: 360, height: 640 }, // 360p vertical
  maxResolution: { width: 4096, height: 4096 },
  frameRate: { min: 23, max: 60 },
  bitrate: { max: 64000000 }, // 64 Mbps
  audioCodec: 'AAC',
  audioBitrate: { max: 320000 }, // 320 kbps
};

// Rate Limits (per day)
export const TIKTOK_RATE_LIMITS = {
  postsPerDay: 5, // TikTok recommends max 5 posts per day
  postsPerHour: 1, // Max 1 post per hour to avoid spam detection
  videosPerDay: 10, // Video uploads
};

// Privacy Levels
export type PrivacyLevel = 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';

// Video Disclosure
export type ContentDisclosure = 'BRAND_CONTENT' | 'BRAND_ORGANIC_CONTENT' | 'YOUR_BRAND';

interface PostOptions {
  videoUrl?: string;
  videoFile?: File | Blob;
  title?: string; // Max 150 characters
  privacyLevel?: PrivacyLevel;
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
  brandContentToggle?: boolean;
  brandOrganicToggle?: boolean;
  videoCoverTimestamp?: number; // Timestamp for cover image (ms)
  postMode?: 'DIRECT_POST' | 'CREATOR_POST'; // Direct or draft
}

interface PostResult {
  success: boolean;
  publishId?: string;
  shareUrl?: string;
  error?: string;
  retryAfter?: number;
  processingTime?: number;
  logs: string[];
}

interface UploadResult {
  uploadUrl: string;
  publishId: string;
}

/**
 * TikTok Adapter Class
 */
export class TikTokAdapter {
  private readonly MAX_TITLE_LENGTH = 150;
  private readonly MAX_UPLOAD_TIMEOUT = 300000; // 5 minutes

  constructor() { }

  /**
   * Initialize adapter
   */
  async initialize(): Promise<void> {
    if (TEST_MODE) {
      console.log('[TikTok] Running in TEST_MODE');
      return;
    }

    // Get access token
    const token = await tiktokTokenStorage.getToken('tiktok');
    if (!token) {
      throw new Error('No TikTok access token found. Please authenticate first.');
    }

    // Verify token is valid
    await this.verifyCredentials();
  }

  /**
   * Post video to TikTok
   */
  async post(options: PostOptions): Promise<PostResult> {
    const logs: string[] = [];
    const startTime = Date.now();

    try {
      logs.push('[TikTok] Starting post creation');

      // Check rate limits
      await tiktokRateLimiter.checkLimit('posts');
      logs.push('[TikTok] Rate limit OK');

      const token = await tiktokTokenStorage.getToken('tiktok');
      if (!token) {
        throw new Error('No TikTok access token');
      }

      // Validate video
      if (!options.videoUrl && !options.videoFile) {
        throw new Error('Video is required for TikTok posts');
      }

      logs.push('[TikTok] Validating video');
      const validation = await tiktokVideoProcessor.validateVideo(
        options.videoUrl || options.videoFile!
      );

      if (!validation.valid) {
        throw new Error(`Video validation failed: ${validation.errors.join(', ')}`);
      }
      logs.push('[TikTok] Video validation passed');

      // Validate title
      const title = options.title || '';
      if (title.length > this.MAX_TITLE_LENGTH) {
        throw new Error(`Title too long. Max ${this.MAX_TITLE_LENGTH} characters, got ${title.length}`);
      }

      if (TEST_MODE) {
        logs.push('[TikTok] TEST_MODE: Returning mock response');
        return {
          success: true,
          publishId: 'test_publish_123',
          shareUrl: 'https://tiktok.com/@user/video/123',
          processingTime: Date.now() - startTime,
          logs,
        };
      }

      // Step 1: Initialize upload
      logs.push('[TikTok] Step 1: Initializing upload');
      const uploadInit = await this.initializeUpload(token.accessToken, logs);
      logs.push(`[TikTok] Upload URL received: ${uploadInit.publishId}`);

      // Step 2: Upload video
      logs.push('[TikTok] Step 2: Uploading video');
      await this.uploadVideo(
        uploadInit.uploadUrl,
        options.videoUrl || options.videoFile!,
        logs
      );
      logs.push('[TikTok] Video uploaded successfully');

      // Step 3: Publish post
      logs.push('[TikTok] Step 3: Publishing post');
      const publishResult = await this.publishPost({
        publishId: uploadInit.publishId,
        title,
        privacyLevel: options.privacyLevel || 'PUBLIC_TO_EVERYONE',
        disableComment: options.disableComment,
        disableDuet: options.disableDuet,
        disableStitch: options.disableStitch,
        brandContentToggle: options.brandContentToggle,
        brandOrganicToggle: options.brandOrganicToggle,
        videoCoverTimestamp: options.videoCoverTimestamp,
        accessToken: token.accessToken,
      });

      logs.push(`[TikTok] Post published: ${publishResult.publishId}`);
      await tiktokRateLimiter.incrementCount('posts');

      return {
        success: true,
        publishId: publishResult.publishId,
        shareUrl: publishResult.shareUrl,
        processingTime: Date.now() - startTime,
        logs,
      };
    } catch (error: any) {
      logs.push(`[TikTok] Error: ${error.message}`);
      return this.handleError(error, logs);
    }
  }

  /**
   * Initialize video upload
   * Reference: https://developers.tiktok.com/doc/content-posting-api-reference-post-video-init
   */
  private async initializeUpload(
    accessToken: string,
    logs: string[]
  ): Promise<UploadResult> {
    if (TEST_MODE) {
      return {
        uploadUrl: 'https://test-upload.tiktok.com/upload',
        publishId: 'test_publish_123',
      };
    }

    const url = `${TIKTOK_API_BASE}/post/publish/video/init/`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: 0, // Will be calculated during upload
          chunk_size: 10000000, // 10 MB chunks
          total_chunk_count: 1,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to initialize upload');
    }

    const data = await response.json();

    if (data.error?.code !== 'ok') {
      throw new Error(data.error?.message || 'Upload initialization failed');
    }

    return {
      uploadUrl: data.data.upload_url,
      publishId: data.data.publish_id,
    };
  }

  /**
   * Upload video to TikTok servers
   * Uses PUT request to upload URL
   */
  private async uploadVideo(
    uploadUrl: string,
    video: string | File | Blob,
    logs: string[]
  ): Promise<void> {
    if (TEST_MODE) {
      logs.push('[TikTok] TEST_MODE: Skipping actual upload');
      return;
    }

    // Get video data
    let videoData: ArrayBuffer;
    let videoSize: number;

    if (typeof video === 'string') {
      logs.push(`[TikTok] Downloading video from URL`);
      const response = await fetch(video);
      videoData = await response.arrayBuffer();
      videoSize = videoData.byteLength;
    } else {
      logs.push('[TikTok] Reading video from file');
      videoData = await video.arrayBuffer();
      videoSize = videoData.byteLength;
    }

    logs.push(`[TikTok] Video size: ${this.formatBytes(videoSize)}`);

    // Upload video
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoSize.toString(),
      },
      body: videoData,
    });

    if (!response.ok) {
      throw new Error(`Video upload failed: ${response.statusText}`);
    }

    logs.push('[TikTok] Upload complete');
  }

  /**
   * Publish post
   * Reference: https://developers.tiktok.com/doc/content-posting-api-reference-post-publish
   */
  private async publishPost(params: {
    publishId: string;
    title?: string;
    privacyLevel: PrivacyLevel;
    disableComment?: boolean;
    disableDuet?: boolean;
    disableStitch?: boolean;
    brandContentToggle?: boolean;
    brandOrganicToggle?: boolean;
    videoCoverTimestamp?: number;
    accessToken: string;
  }): Promise<{ publishId: string; shareUrl?: string }> {
    if (TEST_MODE) {
      return {
        publishId: params.publishId,
        shareUrl: 'https://tiktok.com/@test/video/123',
      };
    }

    const url = `${TIKTOK_API_BASE}/post/publish/status/fetch/`;

    const body: any = {
      publish_id: params.publishId,
    };

    // Add optional fields
    if (params.title) {
      body.post_info = {
        title: params.title,
        privacy_level: params.privacyLevel,
        disable_comment: params.disableComment || false,
        disable_duet: params.disableDuet || false,
        disable_stitch: params.disableStitch || false,
        video_cover_timestamp_ms: params.videoCoverTimestamp || 0,
      };
    }

    if (params.brandContentToggle || params.brandOrganicToggle) {
      body.post_info = body.post_info || {};
      body.post_info.brand_content_toggle = params.brandContentToggle || false;
      body.post_info.brand_organic_toggle = params.brandOrganicToggle || false;
    }

    // First, publish the video
    const publishUrl = `${TIKTOK_API_BASE}/post/publish/video/init/`;
    const publishResponse = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!publishResponse.ok) {
      const error = await publishResponse.json();
      throw new Error(error.error?.message || 'Failed to publish post');
    }

    const publishData = await publishResponse.json();

    if (publishData.error?.code !== 'ok') {
      throw new Error(publishData.error?.message || 'Publish failed');
    }

    // Poll for publish status
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publish_id: params.publishId,
        }),
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();

        if (statusData.data?.status === 'PUBLISH_COMPLETE') {
          return {
            publishId: params.publishId,
            shareUrl: statusData.data.publicaly_available_post_id
              ? `https://tiktok.com/@/video/${statusData.data.publicaly_available_post_id}`
              : undefined,
          };
        }

        if (statusData.data?.status === 'FAILED') {
          throw new Error('Publish failed: ' + (statusData.data.fail_reason || 'Unknown error'));
        }
      }

      // Wait 10 seconds before next check
      await this.sleep(10000);
      attempts++;
    }

    throw new Error('Publish timeout - video may still be processing');
  }

  /**
   * Get user info
   */
  async getUserInfo(): Promise<any> {
    const token = await tiktokTokenStorage.getToken('tiktok');
    if (!token) {
      throw new Error('No access token');
    }

    if (TEST_MODE) {
      return {
        open_id: 'test_user_123',
        union_id: 'test_union_123',
        avatar_url: 'https://example.com/avatar.jpg',
        display_name: 'Test User',
      };
    }

    const url = `${TIKTOK_API_BASE}/user/info/?fields=open_id,union_id,avatar_url,display_name`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    const data = await response.json();
    return data.data?.user;
  }

  /**
   * Verify credentials
   */
  private async verifyCredentials(): Promise<void> {
    const token = await tiktokTokenStorage.getToken('tiktok');
    if (!token) {
      throw new Error('No access token');
    }

    if (TEST_MODE) {
      return;
    }

    await this.getUserInfo();
  }

  /**
   * Get quota usage
   */
  async getQuotaUsage(): Promise<{
    daily: { used: number; limit: number };
    hourly: { used: number; limit: number };
  }> {
    return await tiktokRateLimiter.getUsage();
  }

  /**
   * Handle errors
   */
  private handleError(error: any, logs: string[]): PostResult {
    let errorMessage = error.message || 'Unknown error';
    let retryAfter: number | undefined;

    // Parse TikTok API errors
    if (error.code) {
      switch (error.code) {
        case 'access_token_invalid':
          errorMessage = 'Access token expired. Please re-authenticate.';
          break;
        case 'rate_limit_exceeded':
          errorMessage = 'Rate limit exceeded.';
          retryAfter = 3600; // 1 hour
          break;
        case 'spam_risk_too_many_posts':
          errorMessage = 'Too many posts. TikTok recommends max 5 posts per day.';
          retryAfter = 86400; // 24 hours
          break;
        case 'video_format_invalid':
          errorMessage = 'Video format not supported. Use MP4, MOV, or WEBM.';
          break;
        case 'video_too_long':
          errorMessage = 'Video exceeds 10 minute limit.';
          break;
        case 'video_too_short':
          errorMessage = 'Video must be at least 3 seconds.';
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
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
export const tiktokAdapter = new TikTokAdapter();
