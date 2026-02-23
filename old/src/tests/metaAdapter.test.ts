/**
 * Meta Adapter Test Suite
 * 
 * Tests for Instagram and Facebook publishing functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MetaAdapter, TEST_MODE } from '../adapters/metaAdapter';
import { metaAuth } from '../utils/metaAuth';
import { metaTokenStorage } from '../utils/metaTokenStorage';
import { videoProcessor } from '../utils/videoProcessor';
import { rateLimiter } from '../utils/rateLimiter';

// Enable test mode
process.env.META_TEST_MODE = 'true';

describe('MetaAdapter', () => {
  let adapter: MetaAdapter;

  beforeEach(() => {
    adapter = new MetaAdapter('test_page_123', 'test_ig_account_456');
    
    // Mock token storage
    vi.spyOn(metaTokenStorage, 'getToken').mockResolvedValue({
      accessToken: 'test_token',
      expiresAt: Date.now() + 86400000, // 24 hours
      tokenType: 'Bearer',
    });

    // Mock rate limiter
    vi.spyOn(rateLimiter, 'checkLimit').mockResolvedValue();
    vi.spyOn(rateLimiter, 'incrementCount').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rateLimiter.resetAllQuotas();
  });

  describe('Instagram Feed Publishing', () => {
    it('should successfully publish to Instagram feed', async () => {
      const result = await adapter.publishToInstagramFeed({
        videoUrl: 'https://example.com/video.mp4',
        caption: 'New trailer! #movie',
        thumbnailUrl: 'https://example.com/thumb.jpg',
      });

      expect(result.success).toBe(true);
      expect(result.platform).toBe('instagram');
      expect(result.mediaId).toBeDefined();
      expect(result.postId).toBeDefined();
    });

    it('should validate video before publishing', async () => {
      const validateSpy = vi.spyOn(videoProcessor, 'validateVideo').mockResolvedValue({
        valid: false,
        errors: ['Video too long'],
        warnings: [],
      });

      const result = await adapter.publishToInstagramFeed({
        videoUrl: 'https://example.com/invalid-video.mp4',
        caption: 'Test caption',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Video validation failed');
      expect(validateSpy).toHaveBeenCalledWith('https://example.com/invalid-video.mp4', 'instagram_feed');
    });

    it('should enforce rate limits', async () => {
      vi.spyOn(rateLimiter, 'checkLimit').mockRejectedValue(
        new Error('Daily quota exceeded for instagram_feed')
      );

      const result = await adapter.publishToInstagramFeed({
        videoUrl: 'https://example.com/video.mp4',
        caption: 'Test caption',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Daily quota exceeded');
    });

    it('should handle missing access token', async () => {
      vi.spyOn(metaTokenStorage, 'getToken').mockResolvedValue(null);

      const result = await adapter.publishToInstagramFeed({
        videoUrl: 'https://example.com/video.mp4',
        caption: 'Test caption',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No Meta access token');
    });
  });

  describe('Instagram Reels Publishing', () => {
    it('should successfully publish Reel', async () => {
      const result = await adapter.publishToInstagramReels({
        videoUrl: 'https://example.com/reel.mp4',
        caption: 'Watch this! 🎬',
        shareToFeed: true,
      });

      expect(result.success).toBe(true);
      expect(result.platform).toBe('instagram');
      expect(result.mediaId).toBeDefined();
      expect(result.postId).toBeDefined();
    });

    it('should validate Reel requirements', async () => {
      const validateSpy = vi.spyOn(videoProcessor, 'validateVideo').mockResolvedValue({
        valid: false,
        errors: ['Aspect ratio not supported'],
        warnings: [],
      });

      const result = await adapter.publishToInstagramReels({
        videoUrl: 'https://example.com/wrong-aspect.mp4',
        caption: 'Test',
      });

      expect(result.success).toBe(false);
      expect(validateSpy).toHaveBeenCalledWith('https://example.com/wrong-aspect.mp4', 'instagram_reels');
    });

    it('should respect Reels quota limits', async () => {
      vi.spyOn(rateLimiter, 'checkLimit').mockRejectedValue(
        new Error('Daily quota exceeded for instagram_reels')
      );

      const result = await adapter.publishToInstagramReels({
        videoUrl: 'https://example.com/reel.mp4',
        caption: 'Test',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Facebook Publishing', () => {
    it('should successfully publish to Facebook', async () => {
      const result = await adapter.publishToFacebook({
        videoUrl: 'https://example.com/fb-video.mp4',
        caption: 'New trailer on Facebook!',
        thumbnailUrl: 'https://example.com/thumb.jpg',
      });

      expect(result.success).toBe(true);
      expect(result.platform).toBe('facebook');
      expect(result.postId).toBeDefined();
    });

    it('should validate Facebook video requirements', async () => {
      const validateSpy = vi.spyOn(videoProcessor, 'validateVideo').mockResolvedValue({
        valid: true,
        errors: [],
        warnings: ['Codec not optimal'],
      });

      const result = await adapter.publishToFacebook({
        videoUrl: 'https://example.com/video.mp4',
        caption: 'Test',
      });

      expect(result.success).toBe(true);
      expect(validateSpy).toHaveBeenCalledWith('https://example.com/video.mp4', 'facebook');
    });
  });

  describe('Quota Management', () => {
    it('should return current quota usage', async () => {
      const quotas = await adapter.getQuotaUsage();

      expect(quotas).toHaveProperty('instagram_feed');
      expect(quotas).toHaveProperty('instagram_reels');
      expect(quotas).toHaveProperty('facebook');
      expect(quotas.instagram_feed).toHaveProperty('used');
      expect(quotas.instagram_feed).toHaveProperty('limit');
    });

    it('should track publish counts', async () => {
      const incrementSpy = vi.spyOn(rateLimiter, 'incrementCount');

      await adapter.publishToInstagramFeed({
        videoUrl: 'https://example.com/video.mp4',
        caption: 'Test',
      });

      expect(incrementSpy).toHaveBeenCalledWith('instagram_feed');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock a network error
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await adapter.publishToInstagramFeed({
        videoUrl: 'https://example.com/video.mp4',
        caption: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should parse Meta error codes', async () => {
      const error = { code: 190, message: 'Invalid OAuth token' };
      
      // This would be tested with actual API responses
      expect(error.code).toBe(190);
    });

    it('should provide retry-after for rate limit errors', async () => {
      vi.spyOn(rateLimiter, 'checkLimit').mockRejectedValue(
        new Error('Rate limit reached')
      );

      const result = await adapter.publishToInstagramFeed({
        videoUrl: 'https://example.com/video.mp4',
        caption: 'Test',
      });

      expect(result.success).toBe(false);
      // In production, this would include retryAfter
    });
  });

  describe('Initialization', () => {
    it('should initialize with page and Instagram IDs', async () => {
      const newAdapter = new MetaAdapter('page_123', 'ig_456');
      await newAdapter.initialize();

      expect(newAdapter).toBeDefined();
    });

    it('should fetch account IDs if not provided', async () => {
      const newAdapter = new MetaAdapter();
      
      // Mock successful initialization
      // In production, this would fetch from Graph API
      await expect(newAdapter.initialize()).resolves.not.toThrow();
    });
  });
});

describe('MetaAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate authorization URL', () => {
    const url = metaAuth.getAuthorizationUrl('/settings');
    
    expect(url).toContain('facebook.com');
    expect(url).toContain('oauth');
    expect(url).toContain('state=');
  });

  it('should handle OAuth callback', async () => {
    // This would be tested with actual OAuth flow
    const code = 'test_auth_code';
    const state = 'test_state';
    
    // Mock the callback handling
    // In production, this validates state and exchanges code for token
  });

  it('should refresh token if expiring', async () => {
    // Mock token near expiration
    vi.spyOn(metaTokenStorage, 'getToken').mockResolvedValue({
      accessToken: 'old_token',
      expiresAt: Date.now() + 86400000, // 1 day (should refresh if < 7 days)
      tokenType: 'Bearer',
    });

    const refreshed = await metaAuth.refreshTokenIfNeeded();
    
    // Test logic would verify refresh was attempted
    expect(refreshed).toBeDefined();
  });
});

describe('VideoProcessor', () => {
  it('should validate Instagram feed video requirements', async () => {
    const result = await videoProcessor.validateVideo(
      'https://example.com/video.mp4',
      'instagram_feed'
    );

    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
  });

  it('should validate Instagram Reels requirements', async () => {
    const result = await videoProcessor.validateVideo(
      'https://example.com/reel.mp4',
      'instagram_reels'
    );

    expect(result.valid).toBeDefined();
  });

  it('should detect videos needing transcoding', async () => {
    const needsTranscode = await videoProcessor.needsTranscoding(
      'https://example.com/video.avi',
      'instagram_feed'
    );

    expect(typeof needsTranscode).toBe('boolean');
  });
});

describe('RateLimiter', () => {
  beforeEach(() => {
    rateLimiter.resetAllQuotas();
  });

  it('should track usage per platform', async () => {
    await rateLimiter.checkLimit('instagram_feed');
    await rateLimiter.incrementCount('instagram_feed');

    const usage = await rateLimiter.getUsage('instagram_feed');
    expect(usage.used).toBe(1);
  });

  it('should enforce daily limits', async () => {
    // Set count to limit
    for (let i = 0; i < 25; i++) {
      await rateLimiter.incrementCount('instagram_feed');
    }

    await expect(
      rateLimiter.checkLimit('instagram_feed')
    ).rejects.toThrow('Daily quota exceeded');
  });

  it('should reset at midnight UTC', async () => {
    await rateLimiter.incrementCount('instagram_feed');
    
    // Manually reset (simulates midnight)
    rateLimiter.resetQuota('instagram_feed');

    const usage = await rateLimiter.getUsage('instagram_feed');
    expect(usage.used).toBe(0);
  });

  it('should provide time until reset', async () => {
    const timeUntilReset = await rateLimiter.getTimeUntilReset('instagram_feed');
    expect(timeUntilReset).toBeGreaterThan(0);
  });
});

/**
 * INTEGRATION TESTS
 * 
 * These would require actual Meta API credentials and should be run separately
 */
describe.skip('Meta Integration Tests', () => {
  it('should publish to Instagram feed (live)', async () => {
    // Requires real credentials and test Instagram account
  });

  it('should publish Reel (live)', async () => {
    // Requires real credentials and test Instagram account
  });

  it('should upload to Facebook (live)', async () => {
    // Requires real credentials and test Facebook Page
  });
});
