/**
 * X (Twitter) Rate Limiter and Quota Management
 * 
 * Enforces tier-based posting limits:
 * - Free: 50/day, 1,500/month
 * - Basic: 3,000/day, 50,000/month
 * - Pro: 10,000/day, 300,000/month
 * - Enterprise: 100,000/day, 3,000,000/month
 */

import { X_RATE_LIMITS, AccountTier } from '../adapters/xAdapter';

interface QuotaData {
  dailyCount: number;
  monthlyCount: number;
  dailyResetAt: number;
  monthlyResetAt: number;
  lastUpdate: number;
}

class XRateLimiter {
  private readonly STORAGE_KEY = 'screndly_x_rate_limits';
  private quotas: Map<AccountTier, QuotaData> = new Map();

  constructor() {
    this.loadQuotas();
  }

  /**
   * Check if posting is allowed (under quota)
   */
  async checkLimit(tier: AccountTier): Promise<void> {
    const quota = this.getOrCreateQuota(tier);

    // Reset daily if past midnight UTC
    if (Date.now() >= quota.dailyResetAt) {
      quota.dailyCount = 0;
      quota.dailyResetAt = this.getNextMidnightUTC();
    }

    // Reset monthly if past month boundary
    if (Date.now() >= quota.monthlyResetAt) {
      quota.monthlyCount = 0;
      quota.monthlyResetAt = this.getNextMonthStart();
    }

    const limits = X_RATE_LIMITS[tier];

    // Check daily limit
    if (quota.dailyCount >= limits.tweetsPerDay) {
      const resetIn = Math.ceil((quota.dailyResetAt - Date.now()) / 1000);
      throw new Error(
        `Daily tweet limit exceeded for ${tier} tier. ` +
        `Limit: ${limits.tweetsPerDay} tweets/day. ` +
        `Resets in ${this.formatSeconds(resetIn)}.`
      );
    }

    // Check monthly limit
    if (quota.monthlyCount >= limits.tweetsPerMonth) {
      const resetIn = Math.ceil((quota.monthlyResetAt - Date.now()) / 1000);
      throw new Error(
        `Monthly tweet limit exceeded for ${tier} tier. ` +
        `Limit: ${limits.tweetsPerMonth} tweets/month. ` +
        `Resets in ${this.formatSeconds(resetIn)}.`
      );
    }
  }

  /**
   * Increment usage count after successful post
   */
  async incrementCount(tier: AccountTier): Promise<void> {
    const quota = this.getOrCreateQuota(tier);
    quota.dailyCount++;
    quota.monthlyCount++;
    quota.lastUpdate = Date.now();
    this.saveQuotas();
  }

  /**
   * Get current quota usage
   */
  async getUsage(tier: AccountTier): Promise<{
    daily: { used: number; limit: number; resetAt: number };
    monthly: { used: number; limit: number; resetAt: number };
  }> {
    const quota = this.getOrCreateQuota(tier);
    const limits = X_RATE_LIMITS[tier];

    // Reset if needed
    if (Date.now() >= quota.dailyResetAt) {
      quota.dailyCount = 0;
      quota.dailyResetAt = this.getNextMidnightUTC();
    }

    if (Date.now() >= quota.monthlyResetAt) {
      quota.monthlyCount = 0;
      quota.monthlyResetAt = this.getNextMonthStart();
    }

    return {
      daily: {
        used: quota.dailyCount,
        limit: limits.tweetsPerDay,
        resetAt: quota.dailyResetAt,
      },
      monthly: {
        used: quota.monthlyCount,
        limit: limits.tweetsPerMonth,
        resetAt: quota.monthlyResetAt,
      },
    };
  }

  /**
   * Get time until daily reset
   */
  async getTimeUntilDailyReset(tier: AccountTier): Promise<number> {
    const quota = this.getOrCreateQuota(tier);
    return Math.max(0, quota.dailyResetAt - Date.now());
  }

  /**
   * Get time until monthly reset
   */
  async getTimeUntilMonthlyReset(tier: AccountTier): Promise<number> {
    const quota = this.getOrCreateQuota(tier);
    return Math.max(0, quota.monthlyResetAt - Date.now());
  }

  /**
   * Manually reset quota (for testing)
   */
  resetQuota(tier: AccountTier): void {
    const quota = this.getOrCreateQuota(tier);
    quota.dailyCount = 0;
    quota.monthlyCount = 0;
    quota.dailyResetAt = this.getNextMidnightUTC();
    quota.monthlyResetAt = this.getNextMonthStart();
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
   * Get or create quota data for tier
   */
  private getOrCreateQuota(tier: AccountTier): QuotaData {
    let quota = this.quotas.get(tier);

    if (!quota) {
      quota = {
        dailyCount: 0,
        monthlyCount: 0,
        dailyResetAt: this.getNextMidnightUTC(),
        monthlyResetAt: this.getNextMonthStart(),
        lastUpdate: Date.now(),
      };
      this.quotas.set(tier, quota);
      this.saveQuotas();
    }

    return quota;
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
   * Get next month start timestamp
   */
  private getNextMonthStart(): number {
    const now = new Date();
    const nextMonth = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      1, 0, 0, 0, 0
    ));
    return nextMonth.getTime();
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
      this.quotas = new Map(Object.entries(data)) as Map<AccountTier, QuotaData>;
    } catch (error) {
      console.error('Failed to load X rate limits:', error);
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
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Get tier comparison for upgrade suggestions
   */
  getTierComparison(): Array<{
    tier: AccountTier;
    dailyLimit: number;
    monthlyLimit: number;
    videoDuration: number;
  }> {
    return [
      {
        tier: 'free',
        dailyLimit: X_RATE_LIMITS.free.tweetsPerDay,
        monthlyLimit: X_RATE_LIMITS.free.tweetsPerMonth,
        videoDuration: 140, // 2:20
      },
      {
        tier: 'basic',
        dailyLimit: X_RATE_LIMITS.basic.tweetsPerDay,
        monthlyLimit: X_RATE_LIMITS.basic.tweetsPerMonth,
        videoDuration: 140,
      },
      {
        tier: 'pro',
        dailyLimit: X_RATE_LIMITS.pro.tweetsPerDay,
        monthlyLimit: X_RATE_LIMITS.pro.tweetsPerMonth,
        videoDuration: 600, // 10 min
      },
      {
        tier: 'enterprise',
        dailyLimit: X_RATE_LIMITS.enterprise.tweetsPerDay,
        monthlyLimit: X_RATE_LIMITS.enterprise.tweetsPerMonth,
        videoDuration: 600,
      },
    ];
  }
}

export const xRateLimiter = new XRateLimiter();

/**
 * ACCOUNT TIER INFORMATION:
 * 
 * Free:
 * - 50 tweets per day
 * - 1,500 tweets per month
 * - 2:20 video duration
 * - Basic features
 * 
 * Basic ($100/month):
 * - 3,000 tweets per day
 * - 50,000 tweets per month
 * - 2:20 video duration
 * - Higher rate limits
 * 
 * Pro ($5,000/month):
 * - 10,000 tweets per day
 * - 300,000 tweets per month
 * - 10 minute video duration
 * - 60 fps support
 * - Advanced features
 * 
 * Enterprise (Custom pricing):
 * - 100,000 tweets per day
 * - 3,000,000 tweets per month
 * - 10 minute video duration
 * - Dedicated support
 * - Custom integrations
 * 
 * Reference: https://developer.twitter.com/en/docs/twitter-api/getting-started/about-twitter-api
 */
