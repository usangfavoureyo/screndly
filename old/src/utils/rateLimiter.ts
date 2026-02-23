/**
 * Rate Limiter and Quota Management
 * 
 * Enforces Meta platform publishing limits:
 * - Instagram Feed: 25 posts/day
 * - Instagram Reels: 50 posts/day
 * - Facebook: 200 posts/day
 * 
 * Implements:
 * - Daily quota tracking
 * - Rate limit enforcement
 * - Automatic reset at midnight UTC
 * - Retry-after handling
 */

import { DAILY_QUOTAS } from '../adapters/metaAdapter';

interface QuotaData {
  count: number;
  resetAt: number; // Unix timestamp
  lastUpdate: number;
}

type PlatformKey = 'instagram_feed' | 'instagram_reels' | 'facebook';

class RateLimiter {
  private readonly STORAGE_KEY = 'screndly_rate_limits';
  private quotas: Map<PlatformKey, QuotaData> = new Map();

  constructor() {
    this.loadQuotas();
  }

  /**
   * Check if posting is allowed (under quota)
   */
  async checkLimit(platform: PlatformKey): Promise<void> {
    const quota = this.getOrCreateQuota(platform);
    
    // Reset if past midnight UTC
    if (Date.now() >= quota.resetAt) {
      this.resetQuota(platform);
      quota.count = 0;
    }

    const limit = this.getLimit(platform);
    if (quota.count >= limit) {
      const resetIn = Math.ceil((quota.resetAt - Date.now()) / 1000);
      throw new Error(
        `Daily quota exceeded for ${platform}. ` +
        `Limit: ${limit} posts/day. ` +
        `Resets in ${this.formatSeconds(resetIn)}.`
      );
    }
  }

  /**
   * Increment usage count after successful post
   */
  async incrementCount(platform: PlatformKey): Promise<void> {
    const quota = this.getOrCreateQuota(platform);
    quota.count++;
    quota.lastUpdate = Date.now();
    this.saveQuotas();
  }

  /**
   * Get current quota usage
   */
  async getUsage(platform: PlatformKey): Promise<{ used: number; limit: number }> {
    const quota = this.getOrCreateQuota(platform);
    
    // Reset if past midnight UTC
    if (Date.now() >= quota.resetAt) {
      this.resetQuota(platform);
      quota.count = 0;
    }

    return {
      used: quota.count,
      limit: this.getLimit(platform),
    };
  }

  /**
   * Get time until quota resets
   */
  async getTimeUntilReset(platform: PlatformKey): Promise<number> {
    const quota = this.getOrCreateQuota(platform);
    return Math.max(0, quota.resetAt - Date.now());
  }

  /**
   * Manually reset quota (for testing)
   */
  resetQuota(platform: PlatformKey): void {
    const quota = this.getOrCreateQuota(platform);
    quota.count = 0;
    quota.resetAt = this.getNextMidnightUTC();
    quota.lastUpdate = Date.now();
    this.saveQuotas();
  }

  /**
   * Reset all quotas
   */
  resetAllQuotas(): void {
    this.quotas.clear();
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Get or create quota data for platform
   */
  private getOrCreateQuota(platform: PlatformKey): QuotaData {
    let quota = this.quotas.get(platform);
    
    if (!quota) {
      quota = {
        count: 0,
        resetAt: this.getNextMidnightUTC(),
        lastUpdate: Date.now(),
      };
      this.quotas.set(platform, quota);
      this.saveQuotas();
    }

    return quota;
  }

  /**
   * Get quota limit for platform
   */
  private getLimit(platform: PlatformKey): number {
    switch (platform) {
      case 'instagram_feed':
        return DAILY_QUOTAS.instagram.feed;
      case 'instagram_reels':
        return DAILY_QUOTAS.instagram.reels;
      case 'facebook':
        return DAILY_QUOTAS.facebook;
      default:
        return 0;
    }
  }

  /**
   * Get next midnight UTC timestamp
   */
  private getNextMidnightUTC(): number {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    return tomorrow.getTime();
  }

  /**
   * Load quotas from localStorage
   */
  private loadQuotas(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const data = JSON.parse(stored);
      this.quotas = new Map(Object.entries(data));
    } catch (error) {
      console.error('Failed to load rate limits:', error);
    }
  }

  /**
   * Save quotas to localStorage
   */
  private saveQuotas(): void {
    const data = Object.fromEntries(this.quotas.entries());
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  /**
   * Format seconds to human-readable string
   */
  private formatSeconds(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Get all quotas (for dashboard display)
   */
  async getAllQuotas(): Promise<Record<PlatformKey, { used: number; limit: number; resetAt: number }>> {
    const result: any = {};
    
    for (const platform of ['instagram_feed', 'instagram_reels', 'facebook'] as PlatformKey[]) {
      const usage = await this.getUsage(platform);
      const quota = this.getOrCreateQuota(platform);
      
      result[platform] = {
        used: usage.used,
        limit: usage.limit,
        resetAt: quota.resetAt,
      };
    }

    return result;
  }
}

export const rateLimiter = new RateLimiter();

/**
 * PRODUCTION NOTES:
 * 
 * Backend Rate Limiting:
 * - Move rate limiting to backend for multi-user scenarios
 * - Use Redis for distributed rate limiting
 * - Implement user-specific quotas
 * 
 * Example Redis Implementation:
 * ```javascript
 * import Redis from 'ioredis';
 * const redis = new Redis();
 * 
 * async function checkLimit(userId: string, platform: string): Promise<boolean> {
 *   const key = `quota:${userId}:${platform}:${getCurrentDate()}`;
 *   const count = await redis.incr(key);
 *   
 *   if (count === 1) {
 *     // Set expiry at midnight UTC
 *     const secondsUntilMidnight = getSecondsUntilMidnight();
 *     await redis.expire(key, secondsUntilMidnight);
 *   }
 *   
 *   return count <= getLimit(platform);
 * }
 * ```
 * 
 * Monitoring:
 * - Track quota usage per user/account
 * - Alert when approaching limits
 * - Log all rate limit hits
 * - Display quota usage in dashboard
 */
