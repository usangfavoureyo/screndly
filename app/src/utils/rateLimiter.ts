/**
 * Rate Limiter and Quota Management
 *
 * Enforces Meta platform publishing limits:
 * - Instagram Feed: 25 posts/day
 * - Instagram Reels: 50 posts/day
 * - Facebook: 200 posts/day
 */

import { DAILY_QUOTAS } from '../adapters/metaAdapter';

interface QuotaData {
  count: number;
  resetAt: number;
  lastUpdate: number;
}

type PlatformKey = 'instagram_feed' | 'instagram_reels' | 'facebook';

interface RequestLimitWindow {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, RequestLimitWindow>();

  constructor(private readonly options: RateLimiterOptions) {}

  async checkLimit(key: string): Promise<boolean> {
    const window = this.getOrCreateWindow(key);

    if (Date.now() >= window.resetAt) {
      window.count = 0;
      window.resetAt = Date.now() + this.options.windowMs;
    }

    if (window.count >= this.options.maxRequests) {
      return false;
    }

    window.count += 1;
    return true;
  }

  getRemaining(key: string): number {
    const window = this.getOrCreateWindow(key);

    if (Date.now() >= window.resetAt) {
      window.count = 0;
      window.resetAt = Date.now() + this.options.windowMs;
    }

    return Math.max(0, this.options.maxRequests - window.count);
  }

  getTimeUntilReset(key: string): number {
    const window = this.getOrCreateWindow(key);
    return Math.max(0, window.resetAt - Date.now());
  }

  private getOrCreateWindow(key: string): RequestLimitWindow {
    let window = this.windows.get(key);

    if (!window) {
      window = {
        count: 0,
        resetAt: Date.now() + this.options.windowMs,
      };
      this.windows.set(key, window);
    }

    return window;
  }
}

class PlatformQuotaRateLimiter {
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

  private getNextMidnightUTC(): number {
    const now = new Date();
    const tomorrow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
    );
    return tomorrow.getTime();
  }

  private loadQuotas(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const data = JSON.parse(stored);
      this.quotas = new Map(Object.entries(data)) as Map<PlatformKey, QuotaData>;
    } catch (error) {
      console.error('Failed to load rate limits:', error);
    }
  }

  private saveQuotas(): void {
    const data = Object.fromEntries(this.quotas.entries());
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

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

  async getAllQuotas(): Promise<Record<PlatformKey, { used: number; limit: number; resetAt: number }>> {
    const result: Record<PlatformKey, { used: number; limit: number; resetAt: number }> = {
      instagram_feed: { used: 0, limit: DAILY_QUOTAS.instagram.feed, resetAt: 0 },
      instagram_reels: { used: 0, limit: DAILY_QUOTAS.instagram.reels, resetAt: 0 },
      facebook: { used: 0, limit: DAILY_QUOTAS.facebook, resetAt: 0 },
    };

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

export const rateLimiter = new PlatformQuotaRateLimiter();
