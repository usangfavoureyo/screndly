/**
 * X (Twitter) Adapter for Screndly
 * 
 * Implements v2 API with:
 * - Chunked media upload (INIT/APPEND/FINALIZE)
 * - Processing status polling
 * - Video post creation
 * - Account tier handling (Free, Basic, Pro, Enterprise)
 * 
 * References:
 * - Media Upload: https://developer.twitter.com/en/docs/twitter-api/v1/media/upload-media/overview
 * - Tweet Creation: https://developer.twitter.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets
 * - Rate Limits: https://developer.twitter.com/en/docs/twitter-api/rate-limits
 */

import { xTokenStorage } from '../utils/xTokenStorage';
import { xVideoProcessor } from '../utils/xVideoProcessor';
import { xRateLimiter } from '../utils/xRateLimiter';

// Test mode toggle (browser-safe)
export const TEST_MODE = typeof process !== 'undefined'
  ? (process.env?.NODE_ENV === 'test' || process.env?.X_TEST_MODE === 'true')
  : false;

// X API URLs
const X_API_V2_BASE = 'https://api.twitter.com/2';
const X_UPLOAD_BASE = 'https://upload.twitter.com/1.1';

// Video Requirements by Account Tier
export const X_VIDEO_REQUIREMENTS = {
  free: {
    maxDuration: 140, // 2:20 minutes
    maxSize: 512 * 1024 * 1024, // 512 MB
    formats: ['MP4', 'MOV'],
    codecs: ['H.264'],
    aspectRatio: { min: 1 / 3, max: 3 / 1 },
    minResolution: { width: 32, height: 32 },
    maxResolution: { width: 1920, height: 1200 },
    frameRate: { max: 40 },
    bitrate: { max: 25000000 }, // 25 Mbps
  },
  basic: {
    maxDuration: 140,
    maxSize: 512 * 1024 * 1024,
    formats: ['MP4', 'MOV'],
    codecs: ['H.264'],
    aspectRatio: { min: 1 / 3, max: 3 / 1 },
    minResolution: { width: 32, height: 32 },
    maxResolution: { width: 1920, height: 1200 },
    frameRate: { max: 40 },
    bitrate: { max: 25000000 },
  },
  pro: {
    maxDuration: 600, // 10 minutes
    maxSize: 512 * 1024 * 1024,
    formats: ['MP4', 'MOV'],
    codecs: ['H.264'],
    aspectRatio: { min: 1 / 3, max: 3 / 1 },
    minResolution: { width: 32, height: 32 },
    maxResolution: { width: 1920, height: 1200 },
    frameRate: { max: 60 },
    bitrate: { max: 25000000 },
  },
  enterprise: {
    maxDuration: 600,
    maxSize: 512 * 1024 * 1024,
    formats: ['MP4', 'MOV'],
    codecs: ['H.264'],
    aspectRatio: { min: 1 / 3, max: 3 / 1 },
    minResolution: { width: 32, height: 32 },
    maxResolution: { width: 1920, height: 1200 },
    frameRate: { max: 60 },
    bitrate: { max: 25000000 },
  },
};

// Rate limits by tier (tweets per day)
export const X_RATE_LIMITS = {
  free: {
    tweetsPerDay: 50,
    tweetsPerMonth: 1500,
  },
  basic: {
    tweetsPerDay: 3000,
    tweetsPerMonth: 50000,
  },
  pro: {
    tweetsPerDay: 10000,
    tweetsPerMonth: 300000,
  },
  enterprise: {
    tweetsPerDay: 100000,
    tweetsPerMonth: 3000000,
  },
};

export type AccountTier = 'free' | 'basic' | 'pro' | 'enterprise';

interface PostOptions {
  text: string;
  videoUrl?: string;
  videoFile?: File | Blob;
  imageUrls?: Array<string | File | Blob>;
  mediaIds?: string[];
  replyTo?: string;
  quoteTweet?: string;
}

interface PostResult {
  success: boolean;
  tweetId?: string;
  mediaId?: string;
  error?: string;
  retryAfter?: number;
  processingTime?: number;
  logs: string[];
}

interface UploadStatus {
  state: 'pending' | 'in_progress' | 'succeeded' | 'failed';
  progress_percent?: number;
  check_after_secs?: number;
  error?: {
    code: number;
    name: string;
    message: string;
  };
}

interface ChunkUploadResult {
  mediaId: string;
  processingInfo?: UploadStatus;
  expiresAfterSecs: number;
}

/**
 * X (Twitter) Adapter Class
 */
export class XAdapter {
  private accountTier: AccountTier = 'free';
  private readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks
  private readonly MAX_POLL_ATTEMPTS = 60; // 5 minutes max polling

  constructor(tier?: AccountTier) {
    if (tier) {
      this.accountTier = tier;
    }
  }

  private shouldUseMockResponses(): boolean {
    const fetchFn = globalThis.fetch as any;
    const hasExplicitMockImplementation =
      fetchFn &&
      typeof fetchFn === 'function' &&
      'mock' in fetchFn &&
      typeof fetchFn.getMockImplementation === 'function' &&
      Boolean(fetchFn.getMockImplementation());

    return TEST_MODE && !hasExplicitMockImplementation;
  }

  /**
   * Initialize adapter
   */
  async initialize(): Promise<void> {
    const token = await xTokenStorage.getToken('x');
    if (!token) {
      throw new Error('No X access token found. Please authenticate first.');
    }

    if (this.shouldUseMockResponses()) {
      console.log('[X] Running in TEST_MODE');
      return;
    }

    // Verify token and get account tier
    await this.verifyCredentials();
  }

  /**
   * Post tweet with optional video
   */
  async post(options: PostOptions): Promise<PostResult> {
    const logs: string[] = [];
    const startTime = Date.now();

    try {
      logs.push('[X] Starting post creation');

      // Check rate limits
      await xRateLimiter.checkLimit(this.accountTier);
      logs.push(`[X] Rate limit OK for ${this.accountTier} tier`);

      const token = await xTokenStorage.getToken('x');
      if (!token) {
        throw new Error('No X access token');
      }

      let mediaIds: string[] = options.mediaIds || [];

      // Upload video if provided
      if (options.videoUrl || options.videoFile) {
        logs.push('[X] Video detected, starting upload');

        const uploadResult = await this.uploadVideoChunked(
          options.videoUrl || options.videoFile!,
          logs
        );

        mediaIds.push(uploadResult.mediaId);
        logs.push(`[X] Video uploaded: ${uploadResult.mediaId}`);
      }

      if (!options.videoUrl && !options.videoFile && options.imageUrls?.length) {
        logs.push(`[X] Uploading ${Math.min(options.imageUrls.length, 4)} image(s)`);
        const uploadedImageIds = await Promise.all(
          options.imageUrls.slice(0, 4).map((image) => this.uploadImage(image, logs)),
        );
        mediaIds.push(...uploadedImageIds);
      }

      if (this.shouldUseMockResponses()) {
        await xRateLimiter.incrementCount(this.accountTier);
        logs.push('[X] TEST_MODE: Returning mock response');
        return {
          success: true,
          tweetId: 'test_tweet_123456789',
          mediaId: mediaIds[0],
          processingTime: Math.max(1, Date.now() - startTime),
          logs,
        };
      }

      // Create tweet
      const tweetResult = await this.createTweet({
        text: options.text,
        mediaIds,
        replyTo: options.replyTo,
        quoteTweet: options.quoteTweet,
        accessToken: token.accessToken,
      });

      logs.push(`[X] Tweet created: ${tweetResult.id}`);
      await xRateLimiter.incrementCount(this.accountTier);

      return {
        success: true,
        tweetId: tweetResult.id,
        mediaId: mediaIds[0],
        processingTime: Math.max(1, Date.now() - startTime),
        logs,
      };
    } catch (error: any) {
      logs.push(`[X] Error: ${error.message}`);
      return this.handleError(error, logs);
    }
  }

  private async uploadImage(
    image: string | File | Blob,
    logs: string[]
  ): Promise<string> {
    const token = await xTokenStorage.getToken('x');
    if (!token) {
      throw new Error('No X access token');
    }

    let imageBlob: Blob;
    if (typeof image === 'string') {
      logs.push(`[X] Downloading image from URL: ${image}`);
      if (this.shouldUseMockResponses()) {
        imageBlob = new Blob(['test-image'], { type: 'image/jpeg' });
      } else {
        const response = await fetch(image);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.status}`);
        }
        imageBlob = await response.blob();
      }
    } else {
      imageBlob = image;
    }

    if (this.shouldUseMockResponses()) {
      return `test_image_${Math.random().toString(36).slice(2, 10)}`;
    }

    const url = `${X_UPLOAD_BASE}/media/upload.json`;
    const formData = new FormData();
    formData.append('media', imageBlob, 'image.jpg');
    formData.append('media_category', 'tweet_image');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.errors?.[0]?.message || 'Image upload failed');
    }

    const data = await response.json();
    logs.push(`[X] Image uploaded: ${data.media_id_string}`);
    return data.media_id_string;
  }

  /**
   * Upload video using chunked upload (INIT -> APPEND -> FINALIZE)
   * Reference: https://developer.twitter.com/en/docs/twitter-api/v1/media/upload-media/uploading-media/chunked-media-upload
   */
  async uploadVideoChunked(
    video: string | File | Blob,
    logs: string[]
  ): Promise<ChunkUploadResult> {
    const token = await xTokenStorage.getToken('x');
    if (!token) {
      throw new Error('No X access token');
    }

    // Validate video
    logs.push('[X] Validating video');
    const validation = await xVideoProcessor.validateVideo(video, this.accountTier);
    if (!validation.valid) {
      throw new Error(`Video validation failed: ${validation.errors.join(', ')}`);
    }
    logs.push('[X] Video validation passed');

    // Get video data
    let videoData: ArrayBuffer;
    let videoSize: number;

    if (typeof video === 'string') {
      logs.push(`[X] Downloading video from URL: ${video}`);
      if (this.shouldUseMockResponses()) {
        videoData = new ArrayBuffer(this.CHUNK_SIZE + 1024);
        videoSize = videoData.byteLength;
      } else {
        const response = await fetch(video);
        videoData = await response.arrayBuffer();
        videoSize = videoData.byteLength;
      }
    } else {
      logs.push('[X] Reading video from file');
      videoData = await video.arrayBuffer();
      videoSize = videoData.byteLength;
    }

    logs.push(`[X] Video size: ${this.formatBytes(videoSize)}`);

    // Phase 1: INIT
    logs.push('[X] Phase 1: INIT');
    const initResult = await this.uploadInit(videoSize, 'video/mp4', token.accessToken);
    const mediaId = initResult.media_id_string;
    logs.push(`[X] Media ID: ${mediaId}`);

    // Phase 2: APPEND (chunked)
    logs.push('[X] Phase 2: APPEND (uploading chunks)');
    const totalChunks = Math.ceil(videoSize / this.CHUNK_SIZE);
    logs.push(`[X] Total chunks: ${totalChunks}`);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.CHUNK_SIZE;
      const end = Math.min(start + this.CHUNK_SIZE, videoSize);
      const chunk = videoData.slice(start, end);

      await this.uploadAppend(mediaId, i, chunk, token.accessToken);

      const progress = Math.round(((i + 1) / totalChunks) * 100);
      logs.push(`[X] Uploaded chunk ${i + 1}/${totalChunks} (${progress}%)`);
    }

    // Phase 3: FINALIZE
    logs.push('[X] Phase 3: FINALIZE');
    const finalizeResult = await this.uploadFinalize(mediaId, token.accessToken);
    logs.push('[X] Upload finalized');

    // Phase 4: STATUS polling (if video requires processing)
    if (finalizeResult.processing_info) {
      logs.push('[X] Phase 4: STATUS polling');
      await this.pollProcessingStatus(mediaId, token.accessToken, logs);
      logs.push('[X] Video processing complete');
    }

    return {
      mediaId,
      processingInfo: finalizeResult.processing_info,
      expiresAfterSecs: finalizeResult.expires_after_secs || 86400,
    };
  }

  /**
   * INIT phase: Initialize chunked upload
   */
  private async uploadInit(
    totalBytes: number,
    mediaType: string,
    accessToken: string
  ): Promise<any> {
    if (this.shouldUseMockResponses()) {
      return { media_id_string: 'test_media_123' };
    }

    const url = `${X_UPLOAD_BASE}/media/upload.json`;
    const formData = new FormData();
    formData.append('command', 'INIT');
    formData.append('total_bytes', totalBytes.toString());
    formData.append('media_type', mediaType);
    formData.append('media_category', 'tweet_video');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.message || 'Upload INIT failed');
    }

    return await response.json();
  }

  /**
   * APPEND phase: Upload video chunk
   */
  private async uploadAppend(
    mediaId: string,
    segmentIndex: number,
    chunk: ArrayBuffer,
    accessToken: string
  ): Promise<void> {
    if (this.shouldUseMockResponses()) {
      return;
    }

    const url = `${X_UPLOAD_BASE}/media/upload.json`;
    const formData = new FormData();
    formData.append('command', 'APPEND');
    formData.append('media_id', mediaId);
    formData.append('segment_index', segmentIndex.toString());
    formData.append('media', new Blob([chunk]));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.message || 'Upload APPEND failed');
    }
  }

  /**
   * FINALIZE phase: Complete upload
   */
  private async uploadFinalize(
    mediaId: string,
    accessToken: string
  ): Promise<any> {
    if (this.shouldUseMockResponses()) {
      return {
        media_id_string: mediaId,
        expires_after_secs: 86400,
      };
    }

    const url = `${X_UPLOAD_BASE}/media/upload.json`;
    const formData = new FormData();
    formData.append('command', 'FINALIZE');
    formData.append('media_id', mediaId);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.message || 'Upload FINALIZE failed');
    }

    return await response.json();
  }

  /**
   * STATUS phase: Poll for video processing completion
   */
  private async pollProcessingStatus(
    mediaId: string,
    accessToken: string,
    logs: string[]
  ): Promise<void> {
    let attempts = 0;

    while (attempts < this.MAX_POLL_ATTEMPTS) {
      const status = await this.getProcessingStatus(mediaId, accessToken);

      logs.push(`[X] Processing status: ${status.state} (${status.progress_percent || 0}%)`);

      if (status.state === 'succeeded') {
        return;
      }

      if (status.state === 'failed') {
        throw new Error(
          `Video processing failed: ${status.error?.message || 'Unknown error'}`
        );
      }

      // Wait before next poll
      const waitTime = (status.check_after_secs || 5) * 1000;
      logs.push(`[X] Waiting ${status.check_after_secs || 5}s before next check`);
      await this.sleep(waitTime);

      attempts++;
    }

    throw new Error('Video processing timeout - exceeded maximum polling time');
  }

  /**
   * Get processing status
   */
  private async getProcessingStatus(
    mediaId: string,
    accessToken: string
  ): Promise<UploadStatus> {
    if (this.shouldUseMockResponses()) {
      return { state: 'succeeded', progress_percent: 100 };
    }

    const url = `${X_UPLOAD_BASE}/media/upload.json?command=STATUS&media_id=${mediaId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get processing status');
    }

    const data = await response.json();
    return data.processing_info;
  }

  /**
   * Create tweet with media
   */
  private async createTweet(params: {
    text: string;
    mediaIds?: string[];
    replyTo?: string;
    quoteTweet?: string;
    accessToken: string;
  }): Promise<{ id: string }> {
    if (this.shouldUseMockResponses()) {
      return { id: 'test_tweet_123' };
    }

    const url = `${X_API_V2_BASE}/tweets`;

    const body: any = {
      text: params.text,
    };

    if (params.mediaIds && params.mediaIds.length > 0) {
      body.media = {
        media_ids: params.mediaIds,
      };
    }

    if (params.replyTo) {
      body.reply = {
        in_reply_to_tweet_id: params.replyTo,
      };
    }

    if (params.quoteTweet) {
      body.quote_tweet_id = params.quoteTweet;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.message || 'Failed to create tweet');
    }

    const data = await response.json();
    return { id: data.data.id };
  }

  /**
   * Verify credentials and get account tier
   */
  private async verifyCredentials(): Promise<void> {
    const token = await xTokenStorage.getToken('x');
    if (!token) {
      throw new Error('No access token');
    }

    if (this.shouldUseMockResponses()) {
      return;
    }

    const url = `${X_API_V2_BASE}/users/me`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to verify credentials');
    }

    // In production, determine tier from user data or settings
    // For now, use configured tier
  }

  /**
   * Set account tier
   */
  setTier(tier: AccountTier): void {
    this.accountTier = tier;
  }

  /**
   * Get current tier
   */
  getTier(): AccountTier {
    return this.accountTier;
  }

  /**
   * Get quota usage
   */
  async getQuotaUsage(): Promise<{
    daily: { used: number; limit: number };
    monthly: { used: number; limit: number };
  }> {
    return await xRateLimiter.getUsage(this.accountTier);
  }

  /**
   * Handle errors
   */
  private handleError(error: any, logs: string[]): PostResult {
    let errorMessage = error.message || 'Unknown error';
    let retryAfter: number | undefined;

    // Parse X API errors
    if (error.code) {
      switch (error.code) {
        case 89: // Invalid or expired token
          errorMessage = 'Access token expired. Please re-authenticate.';
          break;
        case 88: // Rate limit exceeded
          errorMessage = 'Rate limit exceeded.';
          retryAfter = 900; // 15 minutes
          break;
        case 324: // Media cannot be processed
          errorMessage = 'Video cannot be processed. Check format and size.';
          break;
        case 386: // Tweet text too long
          errorMessage = 'Tweet text exceeds character limit.';
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
export const xAdapter = new XAdapter();
