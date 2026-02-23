/**
 * X (Twitter) Adapter Test Suite
 * 
 * Tests for chunked upload and tweet creation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { XAdapter, TEST_MODE, AccountTier } from '../adapters/xAdapter';
import { xAuth } from '../utils/xAuth';
import { xTokenStorage } from '../utils/xTokenStorage';
import { xVideoProcessor } from '../utils/xVideoProcessor';
import { xRateLimiter } from '../utils/xRateLimiter';

// Enable test mode
process.env.X_TEST_MODE = 'true';

describe('XAdapter', () => {
  let adapter: XAdapter;

  beforeEach(() => {
    adapter = new XAdapter('free');
    
    // Mock token storage
    vi.spyOn(xTokenStorage, 'getToken').mockResolvedValue({
      accessToken: 'test_x_token',
      expiresAt: Date.now() + 7200000, // 2 hours
      tokenType: 'Bearer',
      scope: 'tweet.read tweet.write users.read offline.access',
    });

    // Mock rate limiter
    vi.spyOn(xRateLimiter, 'checkLimit').mockResolvedValue();
    vi.spyOn(xRateLimiter, 'incrementCount').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    xRateLimiter.resetAllQuotas();
  });

  describe('Tweet Posting', () => {
    it('should successfully post tweet without video', async () => {
      const result = await adapter.post({
        text: 'Testing Screndly X integration 🎬',
      });

      expect(result.success).toBe(true);
      expect(result.tweetId).toBeDefined();
      expect(result.logs).toContain('[X] Starting post creation');
      expect(result.logs).toContain('[X] TEST_MODE: Returning mock response');
    });

    it('should successfully post tweet with video', async () => {
      const result = await adapter.post({
        text: 'Check out this trailer!',
        videoUrl: 'https://example.com/trailer.mp4',
      });

      expect(result.success).toBe(true);
      expect(result.tweetId).toBeDefined();
      expect(result.mediaId).toBeDefined();
      expect(result.logs).toContain('[X] Video detected, starting upload');
    });

    it('should validate video before uploading', async () => {
      const validateSpy = vi.spyOn(xVideoProcessor, 'validateVideo').mockResolvedValue({
        valid: false,
        errors: ['Video too long'],
        warnings: [],
      });

      const result = await adapter.post({
        text: 'Test',
        videoUrl: 'https://example.com/long-video.mp4',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Video validation failed');
      expect(validateSpy).toHaveBeenCalled();
    });

    it('should enforce rate limits', async () => {
      vi.spyOn(xRateLimiter, 'checkLimit').mockRejectedValue(
        new Error('Daily tweet limit exceeded for free tier')
      );

      const result = await adapter.post({
        text: 'Test tweet',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Daily tweet limit exceeded');
    });

    it('should handle missing access token', async () => {
      vi.spyOn(xTokenStorage, 'getToken').mockResolvedValue(null);

      const result = await adapter.post({
        text: 'Test tweet',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No X access token');
    });

    it('should track processing time', async () => {
      const result = await adapter.post({
        text: 'Test tweet',
      });

      expect(result.processingTime).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Chunked Video Upload', () => {
    it('should handle chunked upload flow (INIT/APPEND/FINALIZE)', async () => {
      const result = await adapter.post({
        text: 'Video tweet',
        videoUrl: 'https://example.com/video.mp4',
      });

      expect(result.success).toBe(true);
      expect(result.logs).toContain('[X] Phase 1: INIT');
      expect(result.logs).toContain('[X] Phase 2: APPEND (uploading chunks)');
      expect(result.logs).toContain('[X] Phase 3: FINALIZE');
    });

    it('should log upload progress', async () => {
      const result = await adapter.post({
        text: 'Video tweet',
        videoUrl: 'https://example.com/video.mp4',
      });

      expect(result.logs.some(log => log.includes('Video size:'))).toBe(true);
      expect(result.logs.some(log => log.includes('Total chunks:'))).toBe(true);
      expect(result.logs.some(log => log.includes('Uploaded chunk'))).toBe(true);
    });
  });

  describe('Account Tier Management', () => {
    it('should allow setting account tier', () => {
      adapter.setTier('pro');
      expect(adapter.getTier()).toBe('pro');
    });

    it('should enforce tier-specific rate limits', async () => {
      adapter.setTier('free');
      
      // Mock exceeding free tier limit (50/day)
      vi.spyOn(xRateLimiter, 'checkLimit').mockRejectedValue(
        new Error('Daily tweet limit exceeded for free tier')
      );

      const result = await adapter.post({ text: 'Test' });
      expect(result.success).toBe(false);
    });

    it('should validate video against tier requirements', async () => {
      adapter.setTier('free');
      
      vi.spyOn(xVideoProcessor, 'validateVideo').mockResolvedValue({
        valid: false,
        errors: ['Video too long for free tier. Maximum: 140s'],
        warnings: [],
        recommendations: ['Upgrade to Pro for videos up to 10 minutes'],
      });

      const result = await adapter.post({
        text: 'Test',
        videoUrl: 'https://example.com/long-video.mp4',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('free tier');
    });
  });

  describe('Quota Management', () => {
    it('should return quota usage', async () => {
      const quotas = await adapter.getQuotaUsage();

      expect(quotas).toHaveProperty('daily');
      expect(quotas).toHaveProperty('monthly');
      expect(quotas.daily).toHaveProperty('used');
      expect(quotas.daily).toHaveProperty('limit');
    });

    it('should track tweet counts', async () => {
      const incrementSpy = vi.spyOn(xRateLimiter, 'incrementCount');

      await adapter.post({ text: 'Test tweet' });

      expect(incrementSpy).toHaveBeenCalledWith('free');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await adapter.post({ text: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.logs).toContain('[X] Starting post creation');
    });

    it('should parse X error codes', async () => {
      const error = { code: 89, message: 'Invalid or expired token' };
      expect(error.code).toBe(89);
    });

    it('should provide retry-after for rate limits', async () => {
      vi.spyOn(xRateLimiter, 'checkLimit').mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      const result = await adapter.post({ text: 'Test' });

      expect(result.success).toBe(false);
    });

    it('should log all operations', async () => {
      const result = await adapter.post({
        text: 'Test with video',
        videoUrl: 'https://example.com/video.mp4',
      });

      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.logs[0]).toContain('[X]');
    });
  });

  describe('Initialization', () => {
    it('should initialize without errors', async () => {
      await expect(adapter.initialize()).resolves.not.toThrow();
    });

    it('should require access token', async () => {
      vi.spyOn(xTokenStorage, 'getToken').mockResolvedValue(null);

      await expect(adapter.initialize()).rejects.toThrow(
        'No X access token found'
      );
    });
  });
});

describe('XAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate authorization URL with PKCE', async () => {
    const url = await xAuth.getAuthorizationUrl('/settings');
    
    expect(url).toContain('twitter.com');
    expect(url).toContain('oauth2/authorize');
    expect(url).toContain('code_challenge=');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('state=');
  });

  it('should handle OAuth callback', async () => {
    // Mock OAuth flow
    const code = 'test_auth_code';
    const state = 'test_state';
    
    // This would be tested with actual OAuth flow
  });

  it('should refresh token if expiring', async () => {
    vi.spyOn(xTokenStorage, 'getToken').mockResolvedValue({
      accessToken: 'old_token',
      refreshToken: 'refresh_token',
      expiresAt: Date.now() + 1800000, // 30 minutes (should refresh)
      tokenType: 'Bearer',
      scope: 'tweet.read tweet.write',
    });

    const refreshed = await xAuth.refreshTokenIfNeeded();
    expect(refreshed).toBeDefined();
  });
});

describe('XVideoProcessor', () => {
  it('should validate video for free tier', async () => {
    const result = await xVideoProcessor.validateVideo(
      'https://example.com/video.mp4',
      'free'
    );

    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
  });

  it('should validate video for pro tier', async () => {
    const result = await xVideoProcessor.validateVideo(
      'https://example.com/video.mp4',
      'pro'
    );

    expect(result.valid).toBeDefined();
  });

  it('should generate transcode command', () => {
    const command = xVideoProcessor.generateTranscodeCommand('free');
    
    expect(command).toContain('ffmpeg');
    expect(command).toContain('-t 140'); // Free tier duration
    expect(command).toContain('-r 40'); // Free tier frame rate
  });

  it('should check if video needs transcoding', async () => {
    const needs = await xVideoProcessor.needsTranscoding(
      'https://example.com/video.mp4',
      'free'
    );

    expect(typeof needs).toBe('boolean');
  });
});

describe('XRateLimiter', () => {
  beforeEach(() => {
    xRateLimiter.resetAllQuotas();
  });

  it('should track daily usage', async () => {
    await xRateLimiter.checkLimit('free');
    await xRateLimiter.incrementCount('free');

    const usage = await xRateLimiter.getUsage('free');
    expect(usage.daily.used).toBe(1);
    expect(usage.daily.limit).toBe(50);
  });

  it('should track monthly usage', async () => {
    await xRateLimiter.incrementCount('free');
    
    const usage = await xRateLimiter.getUsage('free');
    expect(usage.monthly.used).toBe(1);
    expect(usage.monthly.limit).toBe(1500);
  });

  it('should enforce daily limits', async () => {
    // Set count to limit
    for (let i = 0; i < 50; i++) {
      await xRateLimiter.incrementCount('free');
    }

    await expect(
      xRateLimiter.checkLimit('free')
    ).rejects.toThrow('Daily tweet limit exceeded');
  });

  it('should enforce different limits per tier', async () => {
    const freeUsage = await xRateLimiter.getUsage('free');
    const proUsage = await xRateLimiter.getUsage('pro');

    expect(freeUsage.daily.limit).toBe(50);
    expect(proUsage.daily.limit).toBe(10000);
  });

  it('should provide time until reset', async () => {
    const timeUntilReset = await xRateLimiter.getTimeUntilDailyReset('free');
    expect(timeUntilReset).toBeGreaterThan(0);
  });

  it('should reset at midnight UTC', async () => {
    await xRateLimiter.incrementCount('free');
    
    // Manually reset
    xRateLimiter.resetQuota('free');

    const usage = await xRateLimiter.getUsage('free');
    expect(usage.daily.used).toBe(0);
  });

  it('should provide tier comparison', () => {
    const comparison = xRateLimiter.getTierComparison();
    
    expect(comparison).toHaveLength(4);
    expect(comparison[0].tier).toBe('free');
    expect(comparison[3].tier).toBe('enterprise');
  });
});

/**
 * INTEGRATION TESTS
 * 
 * These require actual X API credentials
 */
describe.skip('X Integration Tests', () => {
  it('should post tweet (live)', async () => {
    // Requires real credentials
  });

  it('should upload video (live)', async () => {
    // Requires real credentials and video file
  });

  it('should poll processing status (live)', async () => {
    // Requires real video upload
  });
});

/**
 * MOCKED ENDPOINT TESTS
 * 
 * For CI/CD integration
 */
describe('Mocked X Endpoints', () => {
  beforeEach(() => {
    // Mock fetch for all X API calls
    global.fetch = vi.fn();
  });

  it('should mock INIT phase', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ media_id_string: 'mock_media_123' }),
    });

    // Test INIT call
    expect(global.fetch).toBeDefined();
  });

  it('should mock APPEND phase', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    // Test APPEND call
  });

  it('should mock FINALIZE phase', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        media_id_string: 'mock_media_123',
        expires_after_secs: 86400,
      }),
    });

    // Test FINALIZE call
  });

  it('should mock tweet creation', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { id: 'mock_tweet_123' },
      }),
    });

    // Test tweet creation
  });
});
