// ============================================================================
// RATE LIMITER TESTS
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../../utils/rateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests within rate limit', async () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });

    for (let i = 0; i < 5; i++) {
      const canProceed = await limiter.checkLimit('test-key');
      expect(canProceed).toBe(true);
    }
  });

  it('should block requests exceeding rate limit', async () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });

    // First 3 should succeed
    for (let i = 0; i < 3; i++) {
      expect(await limiter.checkLimit('test-key')).toBe(true);
    }

    // 4th should fail
    expect(await limiter.checkLimit('test-key')).toBe(false);
  });

  it('should reset limit after time window', async () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

    // Use up the limit
    expect(await limiter.checkLimit('test-key')).toBe(true);
    expect(await limiter.checkLimit('test-key')).toBe(true);
    expect(await limiter.checkLimit('test-key')).toBe(false);

    // Fast forward past the window
    vi.advanceTimersByTime(1001);

    // Should be allowed again
    expect(await limiter.checkLimit('test-key')).toBe(true);
  });

  it('should track different keys separately', async () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

    // Use up limit for key1
    expect(await limiter.checkLimit('key1')).toBe(true);
    expect(await limiter.checkLimit('key1')).toBe(true);
    expect(await limiter.checkLimit('key1')).toBe(false);

    // key2 should still work
    expect(await limiter.checkLimit('key2')).toBe(true);
    expect(await limiter.checkLimit('key2')).toBe(true);
  });

  it('should return remaining requests', () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });

    expect(limiter.getRemaining('test-key')).toBe(5);
    
    limiter.checkLimit('test-key');
    expect(limiter.getRemaining('test-key')).toBe(4);
    
    limiter.checkLimit('test-key');
    expect(limiter.getRemaining('test-key')).toBe(3);
  });

  it('should return time until reset', async () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 5000 });

    await limiter.checkLimit('test-key');
    await limiter.checkLimit('test-key'); // This exceeds limit

    const timeUntilReset = limiter.getTimeUntilReset('test-key');
    expect(timeUntilReset).toBeGreaterThan(0);
    expect(timeUntilReset).toBeLessThanOrEqual(5000);
  });
});
