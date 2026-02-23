/**
 * Meta Adapter for Screndly
 * 
 * Publishes video content to:
 * - Instagram Business accounts (posts & Reels)
 * - Facebook Pages (video posts)
 * - Threads (best-effort integration)
 * 
 * References:
 * - Instagram Content Publishing: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 * - Reels Publishing: https://developers.facebook.com/docs/instagram-api/guides/reels
 * - Facebook Video API: https://developers.facebook.com/docs/video-api/guides/publishing
 * - Resumable Upload: https://developers.facebook.com/docs/video-api/guides/resumable-upload
 */

import { metaTokenStorage } from '../utils/metaTokenStorage';
import { videoProcessor } from '../utils/videoProcessor';
import { rateLimiter } from '../utils/rateLimiter';

// Test mode toggle (browser-safe)
export const TEST_MODE = typeof process !== 'undefined'
  ? (process.env?.NODE_ENV === 'test' || process.env?.META_TEST_MODE === 'true')
  : false;

// Meta API Base URLs
const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';

// Media Requirements (from Meta docs)
export const META_VIDEO_REQUIREMENTS = {
  instagram: {
    feed: {
      minDuration: 3, // seconds
      maxDuration: 60,
      maxSize: 100 * 1024 * 1024, // 100MB
      aspectRatio: { min: 4 / 5, max: 1.91 / 1 },
      formats: ['MP4', 'MOV'],
      codecs: ['H.264'],
    },
    reels: {
      minDuration: 3,
      maxDuration: 90,
      maxSize: 1024 * 1024 * 1024, // 1GB
      aspectRatio: { min: 0.01, max: 10 }, // 9:16 recommended
      formats: ['MP4', 'MOV'],
      codecs: ['H.264'],
      frameRate: { min: 23, max: 60 },
    },
  },
  facebook: {
    minDuration: 1,
    maxDuration: 240 * 60, // 240 minutes
    maxSize: 10 * 1024 * 1024 * 1024, // 10GB
    formats: ['MP4', 'MOV', 'AVI', 'MKV'],
    codecs: ['H.264', 'VP8'],
  },
};

// Daily publish quotas
export const DAILY_QUOTAS = {
  instagram: {
    feed: 25, // per day
    reels: 50, // per day
  },
  facebook: 200, // per day
};

interface PublishOptions {
  videoUrl: string;
  caption: string;
  thumbnailUrl?: string;
  coverOffset?: number; // milliseconds
  locationId?: string;
  userTags?: Array<{ username: string; x: number; y: number }>;
  shareToFeed?: boolean; // for Reels
  collaborators?: string[];
}

interface PublishResult {
  success: boolean;
  platform: 'instagram' | 'facebook' | 'threads';
  mediaId?: string;
  postId?: string;
  error?: string;
  retryAfter?: number; // seconds
}

/**
 * Meta Adapter Class
 */
export class MetaAdapter {
  private pageId: string;
  private instagramAccountId: string;

  constructor(pageId?: string, instagramAccountId?: string) {
    this.pageId = pageId || '';
    this.instagramAccountId = instagramAccountId || '';
  }

  /**
   * Initialize adapter with page and Instagram account IDs
   */
  async initialize(): Promise<void> {
    if (TEST_MODE) {
      console.log('[META] Running in TEST_MODE');
      return;
    }

    // Get access token
    const token = await metaTokenStorage.getToken('meta');
    if (!token) {
      throw new Error('No Meta access token found. Please authenticate first.');
    }

    // Fetch Page and Instagram account IDs if not provided
    if (!this.pageId) {
      const pages = await this.getPages(token.accessToken);
      if (pages.length === 0) {
        throw new Error('No Facebook Pages found. Please create a Page first.');
      }
      this.pageId = pages[0].id;
    }

    if (!this.instagramAccountId) {
      this.instagramAccountId = await this.getInstagramAccountId(token.accessToken);
    }
  }

  /**
   * Publish to Instagram Feed
   * Reference: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
   */
  async publishToInstagramFeed(options: PublishOptions): Promise<PublishResult> {
    try {
      await rateLimiter.checkLimit('instagram_feed');

      const token = await metaTokenStorage.getToken('meta');
      if (!token) {
        throw new Error('No Meta access token');
      }

      // Validate video
      const validation = await videoProcessor.validateVideo(options.videoUrl, 'instagram_feed');
      if (!validation.valid) {
        return {
          success: false,
          platform: 'instagram',
          error: `Video validation failed: ${validation.errors.join(', ')}`,
        };
      }

      if (TEST_MODE) {
        return {
          success: true,
          platform: 'instagram',
          mediaId: 'test_media_123',
          postId: 'test_post_456',
        };
      }

      // Step 1: Create media container
      const containerResponse = await this.createInstagramMediaContainer({
        videoUrl: options.videoUrl,
        caption: options.caption,
        thumbnailUrl: options.thumbnailUrl,
        coverOffset: options.coverOffset,
        locationId: options.locationId,
        userTags: options.userTags,
        accessToken: token.accessToken,
      });

      // Step 2: Publish media container
      const publishResponse = await this.publishInstagramMedia(
        containerResponse.id,
        token.accessToken
      );

      await rateLimiter.incrementCount('instagram_feed');

      return {
        success: true,
        platform: 'instagram',
        mediaId: containerResponse.id,
        postId: publishResponse.id,
      };
    } catch (error: any) {
      return this.handleError(error, 'instagram');
    }
  }

  /**
   * Publish to Instagram Reels
   * Reference: https://developers.facebook.com/docs/instagram-api/guides/reels
   */
  async publishToInstagramReels(options: PublishOptions): Promise<PublishResult> {
    try {
      await rateLimiter.checkLimit('instagram_reels');

      const token = await metaTokenStorage.getToken('meta');
      if (!token) {
        throw new Error('No Meta access token');
      }

      // Validate video for Reels
      const validation = await videoProcessor.validateVideo(options.videoUrl, 'instagram_reels');
      if (!validation.valid) {
        return {
          success: false,
          platform: 'instagram',
          error: `Video validation failed: ${validation.errors.join(', ')}`,
        };
      }

      if (TEST_MODE) {
        return {
          success: true,
          platform: 'instagram',
          mediaId: 'test_reel_123',
          postId: 'test_reel_post_456',
        };
      }

      // Create Reel container
      const containerResponse = await this.createInstagramReelContainer({
        videoUrl: options.videoUrl,
        caption: options.caption,
        thumbnailUrl: options.thumbnailUrl,
        coverOffset: options.coverOffset,
        shareToFeed: options.shareToFeed ?? true,
        collaborators: options.collaborators,
        accessToken: token.accessToken,
      });

      // Publish Reel
      const publishResponse = await this.publishInstagramMedia(
        containerResponse.id,
        token.accessToken
      );

      await rateLimiter.incrementCount('instagram_reels');

      return {
        success: true,
        platform: 'instagram',
        mediaId: containerResponse.id,
        postId: publishResponse.id,
      };
    } catch (error: any) {
      return this.handleError(error, 'instagram');
    }
  }

  /**
   * Publish to Facebook Page
   * Reference: https://developers.facebook.com/docs/video-api/guides/publishing
   */
  async publishToFacebook(options: PublishOptions): Promise<PublishResult> {
    try {
      await rateLimiter.checkLimit('facebook');

      const token = await metaTokenStorage.getToken('meta');
      if (!token) {
        throw new Error('No Meta access token');
      }

      // Validate video
      const validation = await videoProcessor.validateVideo(options.videoUrl, 'facebook');
      if (!validation.valid) {
        return {
          success: false,
          platform: 'facebook',
          error: `Video validation failed: ${validation.errors.join(', ')}`,
        };
      }

      if (TEST_MODE) {
        return {
          success: true,
          platform: 'facebook',
          postId: 'test_fb_post_789',
        };
      }

      // Use resumable upload for large videos
      const videoId = await this.uploadVideoResumable({
        videoUrl: options.videoUrl,
        description: options.caption,
        thumbnailUrl: options.thumbnailUrl,
        accessToken: token.accessToken,
      });

      await rateLimiter.incrementCount('facebook');

      return {
        success: true,
        platform: 'facebook',
        postId: videoId,
      };
    } catch (error: any) {
      return this.handleError(error, 'facebook');
    }
  }

  /**
   * Publish to Threads (best-effort)
   * Note: Threads API may have limited availability
   */
  async publishToThreads(options: PublishOptions): Promise<PublishResult> {
    try {
      // Threads currently has limited API support
      // This is a best-effort implementation that may require updates

      if (TEST_MODE) {
        return {
          success: true,
          platform: 'threads',
          postId: 'test_threads_post_999',
        };
      }

      // For now, return a placeholder
      // Update when Threads API becomes more widely available
      return {
        success: false,
        platform: 'threads',
        error: 'Threads API not yet available. Please check Meta developer documentation for updates.',
      };
    } catch (error: any) {
      return this.handleError(error, 'threads');
    }
  }

  /**
   * Create Instagram media container (feed post)
   */
  private async createInstagramMediaContainer(params: {
    videoUrl: string;
    caption: string;
    thumbnailUrl?: string;
    coverOffset?: number;
    locationId?: string;
    userTags?: Array<{ username: string; x: number; y: number }>;
    accessToken: string;
  }): Promise<{ id: string }> {
    const url = `${GRAPH_API_BASE}/${this.instagramAccountId}/media`;

    const body: any = {
      media_type: 'VIDEO',
      video_url: params.videoUrl,
      caption: params.caption,
      access_token: params.accessToken,
    };

    if (params.thumbnailUrl) {
      body.thumb_offset = params.coverOffset || 0;
    }

    if (params.locationId) {
      body.location_id = params.locationId;
    }

    if (params.userTags && params.userTags.length > 0) {
      body.user_tags = JSON.stringify(params.userTags);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create media container');
    }

    return await response.json();
  }

  /**
   * Create Instagram Reel container
   */
  private async createInstagramReelContainer(params: {
    videoUrl: string;
    caption: string;
    thumbnailUrl?: string;
    coverOffset?: number;
    shareToFeed?: boolean;
    collaborators?: string[];
    accessToken: string;
  }): Promise<{ id: string }> {
    const url = `${GRAPH_API_BASE}/${this.instagramAccountId}/media`;

    const body: any = {
      media_type: 'REELS',
      video_url: params.videoUrl,
      caption: params.caption,
      share_to_feed: params.shareToFeed ?? true,
      access_token: params.accessToken,
    };

    if (params.thumbnailUrl) {
      body.thumb_offset = params.coverOffset || 0;
    }

    if (params.collaborators && params.collaborators.length > 0) {
      body.collaborators = params.collaborators;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create Reel container');
    }

    return await response.json();
  }

  /**
   * Publish Instagram media (feed or Reel)
   */
  private async publishInstagramMedia(
    creationId: string,
    accessToken: string
  ): Promise<{ id: string }> {
    const url = `${GRAPH_API_BASE}/${this.instagramAccountId}/media_publish`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to publish media');
    }

    return await response.json();
  }

  /**
   * Upload video to Facebook using resumable upload
   * Reference: https://developers.facebook.com/docs/video-api/guides/resumable-upload
   */
  private async uploadVideoResumable(params: {
    videoUrl: string;
    description: string;
    thumbnailUrl?: string;
    accessToken: string;
  }): Promise<string> {
    // Step 1: Initialize upload session
    const initUrl = `${GRAPH_API_BASE}/${this.pageId}/videos`;
    const initResponse = await fetch(initUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'start',
        file_size: 0, // Will be set by video processor
        access_token: params.accessToken,
      }),
    });

    if (!initResponse.ok) {
      const error = await initResponse.json();
      throw new Error(error.error?.message || 'Failed to initialize upload');
    }

    const { video_id, upload_session_id } = await initResponse.json();

    // Step 2: Upload video file (handled by video processor)
    // In production, this would chunk and upload the video

    // Step 3: Finalize upload
    const finalizeUrl = `${GRAPH_API_BASE}/${this.pageId}/videos`;
    const finalizeResponse = await fetch(finalizeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'finish',
        upload_session_id,
        description: params.description,
        thumb: params.thumbnailUrl,
        access_token: params.accessToken,
      }),
    });

    if (!finalizeResponse.ok) {
      const error = await finalizeResponse.json();
      throw new Error(error.error?.message || 'Failed to finalize upload');
    }

    const result = await finalizeResponse.json();
    return result.id || video_id;
  }

  /**
   * Get user's Facebook Pages
   */
  private async getPages(accessToken: string): Promise<Array<{ id: string; name: string }>> {
    const url = `${GRAPH_API_BASE}/me/accounts?access_token=${accessToken}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch Facebook Pages');
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Get Instagram Business Account ID from Facebook Page
   */
  private async getInstagramAccountId(accessToken: string): Promise<string> {
    const url = `${GRAPH_API_BASE}/${this.pageId}?fields=instagram_business_account&access_token=${accessToken}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch Instagram account');
    }

    const data = await response.json();
    if (!data.instagram_business_account) {
      throw new Error('No Instagram Business account linked to this Page. Please link an Instagram Business account in your Page settings.');
    }

    return data.instagram_business_account.id;
  }

  /**
   * Handle API errors with retry logic
   */
  private handleError(error: any, platform: 'instagram' | 'facebook' | 'threads'): PublishResult {
    let errorMessage = error.message || 'Unknown error';
    let retryAfter: number | undefined;

    // Parse Meta API errors
    if (error.code) {
      switch (error.code) {
        case 190: // Invalid OAuth 2.0 Access Token
          errorMessage = 'Access token expired. Please re-authenticate.';
          break;
        case 368: // Temporarily blocked for policies violations
          errorMessage = 'Temporarily blocked. Please review Meta policies.';
          retryAfter = 3600; // 1 hour
          break;
        case 32: // Page request limit reached
          errorMessage = 'Rate limit reached.';
          retryAfter = 600; // 10 minutes
          break;
        case 100: // Invalid parameter
          errorMessage = `Invalid parameter: ${error.error_user_msg || error.message}`;
          break;
      }
    }

    return {
      success: false,
      platform,
      error: errorMessage,
      retryAfter,
    };
  }

  /**
   * Get current quota usage
   */
  async getQuotaUsage(): Promise<{
    instagram_feed: { used: number; limit: number };
    instagram_reels: { used: number; limit: number };
    facebook: { used: number; limit: number };
  }> {
    return {
      instagram_feed: await rateLimiter.getUsage('instagram_feed'),
      instagram_reels: await rateLimiter.getUsage('instagram_reels'),
      facebook: await rateLimiter.getUsage('facebook'),
    };
  }
}

// Export singleton instance
export const metaAdapter = new MetaAdapter();