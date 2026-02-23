/**
 * TikTok Rate Limiter and Quota Management
 * 
 * TikTok recommends:
 * - Maximum 5 posts per day
 * - Maximum 1 post per hour
 * - Avoid spam detection
 */

import { TIKTOK_RATE_LIMITS } from '../adapters/tiktokAdapter';

interface QuotaData {
  dailyPostCount: number;
  hourlyPostCount: number;
  dailyResetAt: number;
  hourlyResetAt: number;
  lastPostAt: number;
}

type QuotaType = 'posts' | 'uploads';

class TikTokRateLimiter {
  private readonly STORAGE_KEY = 'screndly_tiktok_rate_limits';
  private quotas: Map<QuotaType, QuotaData> = new Map();

  constructor() {
    this.loadQuotas();
  }

  /**
   * Check if posting is allowed
   */
  async checkLimit(type: QuotaType): Promise<void> {
    const quota = this.getOrCreateQuota(type);
    
    // Reset daily if past midnight UTC
    if (Date.now() >= quota.dailyResetAt) {
      quota.dailyPostCount = 0;
      quota.dailyResetAt = this.getNextMidnightUTC();
    }

    // Reset hourly
    if (Date.now() >= quota.hourlyResetAt) {
      quota.hourlyPostCount = 0;
      quota.hourlyResetAt = this.getNextHourStart();
    }

    const limits = TIKTOK_RATE_LIMITS;

    // Check daily limit
    if (quota.dailyPostCount >= limits.postsPerDay) {
      const resetIn = Math.ceil((quota.dailyResetAt - Date.now()) / 1000);
      throw new Error(
        `TikTok daily post limit exceeded. ` +
        `Limit: ${limits.postsPerDay} posts/day. ` +
        `Resets in ${this.formatSeconds(resetIn)}. ` +
        `TikTok recommends no more than 5 posts per day to avoid spam detection.`
      );
    }

    // Check hourly limit
    if (quota.hourlyPostCount >= limits.postsPerHour) {
      const resetIn = Math.ceil((quota.hourlyResetAt - Date.now()) / 1000);
      throw new Error(
        `TikTok hourly post limit exceeded. ` +
        `Limit: ${limits.postsPerHour} post/hour. ` +
        `Resets in ${this.formatSeconds(resetIn)}. ` +
        `Please wait before posting again.`
      );
    }

    // Check minimum time between posts (1 hour)
    if (quota.lastPostAt > 0) {
      const timeSinceLastPost = Date.now() - quota.lastPostAt;
      const oneHour = 60 * 60 * 1000;
      
      if (timeSinceLastPost < oneHour) {
        const waitTime = Math.ceil((oneHour - timeSinceLastPost) / 1000);
        throw new Error(
          `Please wait ${this.formatSeconds(waitTime)} before posting again. ` +
          `TikTok recommends at least 1 hour between posts.`
        );
      }
    }
  }

  /**
   * Increment usage count after successful post
   */
  async incrementCount(type: QuotaType): Promise<void> {
    const quota = this.getOrCreateQuota(type);
    quota.dailyPostCount++;
    quota.hourlyPostCount++;
    quota.lastPostAt = Date.now();
    this.saveQuotas();
  }

  /**
   * Get current quota usage
   */
  async getUsage(): Promise<{
    daily: { used: number; limit: number; resetAt: number };
    hourly: { used: number; limit: number; resetAt: number };
    nextPostAllowed: number;
  }> {
    const quota = this.getOrCreateQuota('posts');
    const limits = TIKTOK_RATE_LIMITS;
    
    // Reset if needed
    if (Date.now() >= quota.dailyResetAt) {
      quota.dailyPostCount = 0;
      quota.dailyResetAt = this.getNextMidnightUTC();
    }

    if (Date.now() >= quota.hourlyResetAt) {
      quota.hourlyPostCount = 0;
      quota.hourlyResetAt = this.getNextHourStart();
    }

    // Calculate next allowed post time
    let nextPostAllowed = Date.now();
    if (quota.lastPostAt > 0) {
      const oneHour = 60 * 60 * 1000;
      nextPostAllowed = Math.max(nextPostAllowed, quota.lastPostAt + oneHour);
    }

    return {
      daily: {
        used: quota.dailyPostCount,
        limit: limits.postsPerDay,
        resetAt: quota.dailyResetAt,
      },
      hourly: {
        used: quota.hourlyPostCount,
        limit: limits.postsPerHour,
        resetAt: quota.hourlyResetAt,
      },
      nextPostAllowed,
    };
  }

  /**
   * Get time until next post allowed
   */
  async getTimeUntilNextPost(): Promise<number> {
    const quota = this.getOrCreateQuota('posts');
    
    if (quota.lastPostAt === 0) {
      return 0; // Can post now
    }

    const oneHour = 60 * 60 * 1000;
    const nextAllowed = quota.lastPostAt + oneHour;
    
    return Math.max(0, nextAllowed - Date.now());
  }

  /**
   * Can post now?
   */
  async canPostNow(): Promise<boolean> {
    try {
      await this.checkLimit('posts');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Manually reset quota (for testing)
   */
  resetQuota(type: QuotaType): void {
    const quota = this.getOrCreateQuota(type);
    quota.dailyPostCount = 0;
    quota.hourlyPostCount = 0;
    quota.dailyResetAt = this.getNextMidnightUTC();
    quota.hourlyResetAt = this.getNextHourStart();
    quota.lastPostAt = 0;
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
   * Get or create quota data
   */
  private getOrCreateQuota(type: QuotaType): QuotaData {
    let quota = this.quotas.get(type);
    
    if (!quota) {
      quota = {
        dailyPostCount: 0,
        hourlyPostCount: 0,
        dailyResetAt: this.getNextMidnightUTC(),
        hourlyResetAt: this.getNextHourStart(),
        lastPostAt: 0,
      };
      this.quotas.set(type, quota);
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
   * Get next hour start timestamp
   */
  private getNextHourStart(): number {
    const now = new Date();
    const nextHour = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours() + 1,
      0, 0, 0
    );
    return nextHour.getTime();
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
      console.error('Failed to load TikTok rate limits:', error);
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
   * Get posting schedule recommendations
   */
  getPostingRecommendations(): string[] {
    return [
      'Post maximum 5 videos per day',
      'Wait at least 1 hour between posts',
      'Best times: 6-10 AM and 7-11 PM (user\'s timezone)',
      'Avoid posting more than 3 days in a row',
      'Give videos 24-48 hours to gain traction',
      'Consistency is key - post regularly but not excessively',
    ];
  }
}

export const tiktokRateLimiter = new TikTokRateLimiter();

/**
 * TIKTOK POSTING BEST PRACTICES:
 * 
 * Daily Limits:
 * - Maximum: 5 posts per day
 * - Recommended: 1-3 posts per day
 * - Avoid: Posting all 5 at once
 * 
 * Timing:
 * - Wait 1 hour minimum between posts
 * - Best times: Early morning (6-10 AM) or evening (7-11 PM)
 * - Consider user timezone
 * 
 * Spam Prevention:
 * - Don't post same content repeatedly
 * - Vary captions and hashtags
 * - Mix up video types
 * - Monitor engagement before posting more
 * 
 * Algorithm Tips:
 * - TikTok favors consistent posting schedule
 * - Quality over quantity
 * - Give videos time to be distributed (24-48 hours)
 * - Engagement in first hour is critical
 * 
 * Account Health:
 * - New accounts: Start with 1-2 posts/day
 * - Established accounts: 2-3 posts/day
 * - Avoid sudden increases in posting frequency
 */
