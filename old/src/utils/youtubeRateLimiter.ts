/**
 * YouTube Quota Management
 * 
 * YouTube Data API v3 uses a quota system where each operation costs "units"
 * Default quota: 10,000 units per day
 * 
 * Common operations:
 * - Upload video: 1,600 units (~6 uploads per day)
 * - Update video: 50 units
 * - List videos: 1 unit
 * - Insert into playlist: 50 units
 * - Delete video: 50 units
 * 
 * Quota resets daily at midnight Pacific Time (PT)
 */

import { YOUTUBE_DAILY_QUOTA } from '../adapters/youtubeAdapter';

interface QuotaData {
  used: number;
  resetAt: number;
}

class YouTubeRateLimiter {
  private readonly STORAGE_KEY = 'screndly_youtube_quota';
  private quota: QuotaData | null = null;

  constructor() {
    this.loadQuota();
  }

  /**
   * Check if operation is allowed
   */
  async checkQuota(cost: number): Promise<void> {
    const quota = this.getOrCreateQuota();
    
    // Reset if past midnight PT
    if (Date.now() >= quota.resetAt) {
      quota.used = 0;
      quota.resetAt = this.getNextMidnightPT();
      this.saveQuota();
    }

    // Check if operation would exceed quota
    if (quota.used + cost > YOUTUBE_DAILY_QUOTA) {
      const resetIn = Math.ceil((quota.resetAt - Date.now()) / 1000);
      throw new Error(
        `YouTube API quota exceeded. ` +
        `Used: ${quota.used}/${YOUTUBE_DAILY_QUOTA} units. ` +
        `This operation requires ${cost} units. ` +
        `Quota resets in ${this.formatSeconds(resetIn)} at midnight Pacific Time.`
      );
    }
  }

  /**
   * Increment quota usage after successful operation
   */
  async incrementUsage(cost: number): Promise<void> {
    const quota = this.getOrCreateQuota();
    quota.used += cost;
    this.saveQuota();
  }

  /**
   * Get current quota usage
   */
  async getUsage(): Promise<{
    used: number;
    limit: number;
    remaining: number;
    resetAt: number;
    percentUsed: number;
  }> {
    const quota = this.getOrCreateQuota();
    
    // Reset if needed
    if (Date.now() >= quota.resetAt) {
      quota.used = 0;
      quota.resetAt = this.getNextMidnightPT();
      this.saveQuota();
    }

    const remaining = Math.max(0, YOUTUBE_DAILY_QUOTA - quota.used);
    const percentUsed = (quota.used / YOUTUBE_DAILY_QUOTA) * 100;

    return {
      used: quota.used,
      limit: YOUTUBE_DAILY_QUOTA,
      remaining,
      resetAt: quota.resetAt,
      percentUsed,
    };
  }

  /**
   * Calculate how many videos can be uploaded with remaining quota
   */
  async getRemainingUploads(): Promise<number> {
    const usage = await this.getUsage();
    const uploadCost = 1600; // Cost per video upload
    return Math.floor(usage.remaining / uploadCost);
  }

  /**
   * Get quota cost for various operations
   */
  getOperationCosts(): {
    [key: string]: { cost: number; description: string };
  } {
    return {
      upload: {
        cost: 1600,
        description: 'Upload video',
      },
      update: {
        cost: 50,
        description: 'Update video metadata',
      },
      list: {
        cost: 1,
        description: 'List videos',
      },
      playlistInsert: {
        cost: 50,
        description: 'Add video to playlist',
      },
      delete: {
        cost: 50,
        description: 'Delete video',
      },
      thumbnailSet: {
        cost: 50,
        description: 'Set custom thumbnail',
      },
      commentInsert: {
        cost: 50,
        description: 'Post comment',
      },
    };
  }

  /**
   * Reset quota (for testing)
   */
  resetQuota(): void {
    this.quota = {
      used: 0,
      resetAt: this.getNextMidnightPT(),
    };
    this.saveQuota();
  }

  /**
   * Get or create quota data
   */
  private getOrCreateQuota(): QuotaData {
    if (!this.quota) {
      this.quota = {
        used: 0,
        resetAt: this.getNextMidnightPT(),
      };
      this.saveQuota();
    }

    return this.quota;
  }

  /**
   * Get next midnight Pacific Time timestamp
   */
  private getNextMidnightPT(): number {
    const now = new Date();
    
    // Convert current time to Pacific Time
    const ptOffset = -8 * 60; // PST is UTC-8 (PDT is UTC-7 during daylight saving)
    const nowPT = new Date(now.getTime() + (now.getTimezoneOffset() + ptOffset) * 60000);
    
    // Set to next midnight PT
    const midnightPT = new Date(nowPT);
    midnightPT.setHours(24, 0, 0, 0);
    
    // Convert back to local time
    const midnightLocal = new Date(midnightPT.getTime() - (now.getTimezoneOffset() + ptOffset) * 60000);
    
    return midnightLocal.getTime();
  }

  /**
   * Load quota from localStorage
   */
  private loadQuota(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      this.quota = JSON.parse(stored);
    } catch (error) {
      console.error('Failed to load YouTube quota:', error);
    }
  }

  /**
   * Save quota to localStorage
   */
  private saveQuota(): void {
    if (!this.quota) {
      return;
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.quota));
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
   * Get quota management tips
   */
  getQuotaTips(): string[] {
    return [
      'Default quota: 10,000 units per day',
      'Each video upload costs 1,600 units (~6 uploads/day)',
      'Quota resets daily at midnight Pacific Time',
      'Request quota increase for higher limits',
      'Use batch operations to save quota',
      'Cache video lists instead of frequent API calls',
      'Monitor quota usage in dashboard',
      'Plan uploads during off-peak hours',
    ];
  }

  /**
   * Get quota increase information
   */
  getQuotaIncreaseInfo(): {
    defaultQuota: number;
    uploadLimit: number;
    howToIncrease: string[];
    considerations: string[];
  } {
    return {
      defaultQuota: 10000,
      uploadLimit: 6, // videos per day at default quota
      howToIncrease: [
        'Go to Google Cloud Console',
        'Navigate to YouTube Data API v3',
        'Click "Quotas & System Limits"',
        'Click "Request quota increase"',
        'Explain your use case and expected volume',
        'Provide business justification',
        'Submit request for review',
        'Wait 2-3 business days for response',
      ],
      considerations: [
        'Quota increases require justification',
        'May need to verify business legitimacy',
        'Higher quotas may incur costs',
        'Approval not guaranteed',
        'Review time varies',
      ],
    };
  }
}

export const youtubeRateLimiter = new YouTubeRateLimiter();

/**
 * YOUTUBE API QUOTA REFERENCE:
 * 
 * Daily Quota: 10,000 units (default)
 * 
 * Operation Costs:
 * - videos.insert (upload): 1,600 units
 * - videos.update: 50 units
 * - videos.list: 1 unit
 * - videos.delete: 50 units
 * - playlistItems.insert: 50 units
 * - thumbnails.set: 50 units
 * - commentThreads.insert: 50 units
 * - search.list: 100 units
 * - channels.list: 1 unit
 * 
 * Quota Calculation Examples:
 * 
 * Upload 1 video with custom thumbnail and add to playlist:
 * - videos.insert: 1,600 units
 * - thumbnails.set: 50 units
 * - playlistItems.insert: 50 units
 * - Total: 1,700 units
 * 
 * Daily upload capacity (10,000 quota):
 * - Simple uploads: 6 videos
 * - With thumbnail + playlist: 5 videos
 * 
 * Quota Reset:
 * - Daily at midnight Pacific Time (PT)
 * - PST: UTC-8
 * - PDT: UTC-7 (during daylight saving)
 * 
 * Requesting Quota Increase:
 * - Go to: https://console.cloud.google.com/
 * - Navigate to: APIs & Services → YouTube Data API v3 → Quotas
 * - Click: "Request quota increase"
 * - Provide: Use case, expected volume, business details
 * - Wait: 2-3 business days for review
 * 
 * Tips for Quota Management:
 * - Batch operations when possible
 * - Cache frequently accessed data
 * - Use partial responses to reduce data transfer
 * - Monitor quota usage regularly
 * - Plan uploads strategically
 * - Consider multiple API projects for high volume
 * 
 * Reference: https://developers.google.com/youtube/v3/getting-started#quota
 */
