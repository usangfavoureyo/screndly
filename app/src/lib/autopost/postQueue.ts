/**
 * Centralized Posting Queue System
 * 
 * PRINCIPLE: Feeds decide WHAT is eligible. The Autopost Engine decides WHEN to post.
 * 
 * Architecture:
 * - Single unified queue for all content sources (TMDb, RSS, YouTube)
 * - Feed-aware prioritization (Today > Weekly > Anniversary > Monthly)
 * - Global rate limiting and spacing enforcement
 * - Platform quota management
 */


export type ContentSource = 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary' | 'rss' | 'youtube';
export type PostPriority = 'P1' | 'P2' | 'P3' | 'P4';

export interface PostCandidate {
  id: string;
  source: ContentSource;
  feedType?: 'today' | 'weekly' | 'monthly' | 'anniversary';
  
  // Content
  title: string;
  caption: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  imageUrls?: string[];
  linkUrl?: string;
  imageSelectionStrategy?: string;
  imageSelectionReasons?: string[];
  imageSelectionConfidence?: number;
  
  // Temporal constraints
  earliestPostTime: Date;
  latestPostTime: Date;
  
  // Priority & scheduling
  priority: PostPriority;
  urgencyScore: number; // 0-100, calculated from temporal proximity
  
  // Platform targeting
  platforms: string[]; // ['x', 'threads', 'facebook', 'youtube']
  
  // Metadata
  tmdbId?: number;
  mediaType?: 'movie' | 'tv';
  releaseDate?: string;
  
  // State
  status: 'queued' | 'scheduled' | 'posted' | 'failed' | 'expired';
  scheduledTime?: Date;
  postedTime?: Date;
  error?: string;
  
  // Deduplication
  dedupeKey: string; // For preventing duplicates
}

/**
 * Priority assignment by feed type
 */
const PRIORITY_MAP: Record<ContentSource, PostPriority> = {
  tmdb_today: 'P1',      // Highest - time-critical
  tmdb_weekly: 'P2',     // High - near-term
  tmdb_anniversary: 'P3', // Medium - date-sensitive
  tmdb_monthly: 'P4',    // Low - awareness only
  rss: 'P2',             // High - timely news
  youtube: 'P1',         // Highest - creator content
};

/**
 * Global posting rate limits (configurable)
 */
export interface RateGovernorConfig {
  minGapBetweenPosts: number;    // Minutes between ANY posts (from UI settings)
  maxPostsPerDay: number;        // Max posts per day per platform (default: 6)
  quietHoursStart: number;       // Hour to start quiet period (default: 0 = midnight)
  quietHoursEnd: number;         // Hour to end quiet period (default: 7 = 7am)
  respectPlatformQuotas: boolean; // Check platform-specific rate limits
}

// NOTE: These are FALLBACK defaults only. Real values come from localStorage settings.
const DEFAULT_RATE_CONFIG: RateGovernorConfig = {
  minGapBetweenPosts: 10, // 10 minutes (fallback, overridden by rssPostingInterval)
  maxPostsPerDay: 6,
  quietHoursStart: 0,
  quietHoursEnd: 7,
  respectPlatformQuotas: true,
};

/**
 * Platform posting quotas (per day)
 * NOTE: These are FALLBACK defaults. Real values come from localStorage settings.
 */
const DEFAULT_PLATFORM_QUOTAS: Record<string, number> = {
  x: 50,         // X Free tier limit (fallback)
  threads: 100,  // Meta quota (fallback)
  facebook: 25,  // Meta quota (fallback)
  pinterest: 100, // Pinterest quota (fallback)
  youtube: 10,   // Community posts
};

/**
 * Post Queue Manager
 */
export class PostQueue {
  private queue: PostCandidate[] = [];
  private rateConfig: RateGovernorConfig;
  private lastPostTime: Map<string, Date> = new Map(); // platform -> last post time
  private dailyCounts: Map<string, number> = new Map(); // platform -> count today
  
  constructor(config?: Partial<RateGovernorConfig>) {
    this.rateConfig = { ...DEFAULT_RATE_CONFIG, ...config };
    this.loadState();
  }
  
  /**
   * Add candidate to queue
   */
  addCandidate(candidate: PostCandidate): void {
    // Check for duplicates
    const existing = this.queue.find(c => c.dedupeKey === candidate.dedupeKey);
    if (existing) {
      console.log(`[PostQueue] Skipping duplicate: ${candidate.title}`);
      return;
    }
    
    this.queue.push({
      ...candidate,
      status: 'queued',
      priority: PRIORITY_MAP[candidate.source] || 'P4',
    });
    
    this.sortQueue();
    this.saveState();
  }
  
  /**
   * Add multiple candidates
   */
  addCandidates(candidates: PostCandidate[]): void {
    candidates.forEach(c => this.addCandidate(c));
  }
  
  /**
   * Sort queue by priority and urgency
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // First by priority (P1 > P2 > P3 > P4)
      const priorityOrder = { P1: 0, P2: 1, P3: 2, P4: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by urgency score (higher = more urgent)
      return b.urgencyScore - a.urgencyScore;
    });
  }
  
  /**
   * Get next eligible post (respects rate limits and quiet hours)
   */
  getNextEligible(): PostCandidate | null {
    const now = new Date();
    
    // Check quiet hours
    if (this.isQuietHours(now)) {
      console.log('[PostQueue] Currently in quiet hours');
      return null;
    }
    
    // Find first eligible candidate
    for (const candidate of this.queue) {
      if (candidate.status !== 'queued') continue;
      
      // Check temporal window
      if (now < candidate.earliestPostTime) {
        console.log(`[PostQueue] Too early for: ${candidate.title}`);
        continue;
      }
      
      if (now > candidate.latestPostTime) {
        console.log(`[PostQueue] Expired: ${candidate.title}`);
        candidate.status = 'expired';
        continue;
      }
      
      // Check rate limits for ALL platforms this post targets
      const canPostToAllPlatforms = candidate.platforms.every(platform => 
        this.canPostToPlatform(platform, now)
      );
      
      if (!canPostToAllPlatforms) {
        console.log(`[PostQueue] Rate limit blocked: ${candidate.title}`);
        continue;
      }
      
      // Found eligible candidate
      return candidate;
    }
    
    return null;
  }
  
  /**
   * Check if we can post to a platform (rate limit check)
   */
  private canPostToPlatform(platform: string, now: Date): boolean {
    // Check minimum gap
    const lastPost = this.lastPostTime.get(platform);
    if (lastPost) {
      const minutesSinceLastPost = (now.getTime() - lastPost.getTime()) / (1000 * 60);
      if (minutesSinceLastPost < this.rateConfig.minGapBetweenPosts) {
        return false;
      }
    }
    
    // Check daily quota (read from localStorage settings)
    const todayCount = this.getDailyCount(platform);
    const quota = this.getPlatformQuota(platform);
    if (todayCount >= quota) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get platform quota from localStorage settings
   */
  private getPlatformQuota(platform: string): number {
    try {
      const settings = localStorage.getItem('screndly_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        
        // Map platform names to setting keys
        const quotaMap: Record<string, string> = {
          x: 'dailyQuotaX',
          threads: 'dailyQuotaThreads',
          facebook: 'dailyQuotaFacebook',
          pinterest: 'dailyQuotaPinterest',
        };
        
        const quotaKey = quotaMap[platform];
        if (quotaKey && parsed[quotaKey] !== undefined) {
          return parsed[quotaKey];
        }
      }
    } catch (e) {
      console.error('[PostQueue] Failed to read platform quota from settings:', e);
    }
    
    // Fallback to default
    return DEFAULT_PLATFORM_QUOTAS[platform] || this.rateConfig.maxPostsPerDay;
  }
  
  /**
   * Check if current time is in quiet hours
   */
  private isQuietHours(now: Date): boolean {
    // Check if quiet hours are enabled
    try {
      const settings = localStorage.getItem('screndly_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        
        // If quiet hours are disabled, return false
        if (parsed.quietHoursEnabled === false) {
          return false;
        }
        
        // Read quiet hours from settings (default to midnight-7am)
        const quietHoursStart = parsed.quietHoursStart ?? 0;
        const quietHoursEnd = parsed.quietHoursEnd ?? 7;
        
        const hour = now.getHours();
        
        // Handle wrap-around (e.g., 11 PM to 7 AM)
        if (quietHoursStart < quietHoursEnd) {
          return hour >= quietHoursStart && hour < quietHoursEnd;
        } else {
          return hour >= quietHoursStart || hour < quietHoursEnd;
        }
      }
    } catch (e) {
      console.error('[PostQueue] Failed to check quiet hours from settings:', e);
    }
    
    // Fallback to default (midnight-7am)
    const hour = now.getHours();
    return hour >= this.rateConfig.quietHoursStart && hour < this.rateConfig.quietHoursEnd;
  }
  
  /**
   * Mark candidate as posted
   */
  markPosted(candidateId: string, platforms: string[]): void {
    const candidate = this.queue.find(c => c.id === candidateId);
    if (!candidate) return;
    
    const now = new Date();
    candidate.status = 'posted';
    candidate.postedTime = now;
    
    // Update rate limiting state
    platforms.forEach(platform => {
      this.lastPostTime.set(platform, now);
      this.incrementDailyCount(platform);
    });
    
    this.saveState();
  }
  
  /**
   * Mark candidate as failed
   */
  markFailed(candidateId: string, error: string): void {
    const candidate = this.queue.find(c => c.id === candidateId);
    if (!candidate) return;
    
    candidate.status = 'failed';
    candidate.error = error;
    this.saveState();
  }
  
  /**
   * Get daily post count for platform
   */
  private getDailyCount(platform: string): number {
    const today = new Date().toDateString();
    const key = `${platform}_${today}`;
    return this.dailyCounts.get(key) || 0;
  }
  
  /**
   * Increment daily count for platform
   */
  private incrementDailyCount(platform: string): void {
    const today = new Date().toDateString();
    const key = `${platform}_${today}`;
    const current = this.dailyCounts.get(key) || 0;
    this.dailyCounts.set(key, current + 1);
  }
  
  /**
   * Clean up old entries (posted, failed, expired > 7 days)
   */
  cleanup(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    
    this.queue = this.queue.filter(c => {
      if (c.status === 'queued' || c.status === 'scheduled') return true;
      if (c.postedTime && c.postedTime > cutoff) return true;
      return false;
    });
    
    this.saveState();
  }
  
  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<PostPriority, number>;
    nextPostEligibleIn?: number; // minutes
  } {
    const stats = {
      total: this.queue.length,
      byStatus: {} as Record<string, number>,
      byPriority: { P1: 0, P2: 0, P3: 0, P4: 0 } as Record<PostPriority, number>,
    };
    
    this.queue.forEach(c => {
      stats.byStatus[c.status] = (stats.byStatus[c.status] || 0) + 1;
      stats.byPriority[c.priority]++;
    });
    
    // Calculate when next post is eligible
    const now = new Date();
    const nextEligible = this.getNextEligible();
    if (!nextEligible) {
      // Find earliest platform that can post next
      let minWaitMinutes = Infinity;
      this.lastPostTime.forEach((lastPost) => {
        const minutesSince = (now.getTime() - lastPost.getTime()) / (1000 * 60);
        const waitMinutes = Math.max(0, this.rateConfig.minGapBetweenPosts - minutesSince);
        minWaitMinutes = Math.min(minWaitMinutes, waitMinutes);
      });
      
      if (minWaitMinutes < Infinity) {
        return { ...stats, nextPostEligibleIn: Math.ceil(minWaitMinutes) };
      }
    }
    
    return stats;
  }
  
  /**
   * Get all candidates (for UI display)
   */
  getAllCandidates(): PostCandidate[] {
    return [...this.queue];
  }
  
  /**
   * Get candidates by status
   */
  getCandidatesByStatus(status: PostCandidate['status']): PostCandidate[] {
    return this.queue.filter(c => c.status === status);
  }
  
  /**
   * Remove candidate
   */
  removeCandidate(candidateId: string): void {
    this.queue = this.queue.filter(c => c.id !== candidateId);
    this.saveState();
  }
  
  /**
   * Update rate config
   */
  updateRateConfig(config: Partial<RateGovernorConfig>): void {
    this.rateConfig = { ...this.rateConfig, ...config };
    this.saveState();
  }
  
  /**
   * Reload rate config from localStorage settings (RSS posting interval)
   */
  reloadRateConfigFromSettings(): void {
    try {
      const settings = localStorage.getItem('screndly_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        
        // Read posting interval from RSS settings (in minutes as string)
        const parsedInterval = Number.parseInt(String(parsed.rssPostingInterval ?? '10'), 10);
        const rssPostingInterval = Number.isNaN(parsedInterval) ? 10 : Math.max(0, parsedInterval);
        
        // Update rate config with UI setting
        this.rateConfig.minGapBetweenPosts = rssPostingInterval;
        
        console.log(`[PostQueue] Rate config updated from settings: ${rssPostingInterval} min between posts`);
      }
    } catch (e) {
      console.error('[PostQueue] Failed to reload rate config from settings:', e);
    }
  }
  
  /**
   * Get current rate config
   */
  getRateConfig(): RateGovernorConfig {
    return { ...this.rateConfig };
  }
  
  /**
   * Persist state to localStorage
   */
  private saveState(): void {
    try {
      localStorage.setItem('screndly_post_queue', JSON.stringify({
        queue: this.queue,
        rateConfig: this.rateConfig,
        lastPostTime: Array.from(this.lastPostTime.entries()),
        dailyCounts: Array.from(this.dailyCounts.entries()),
      }));
    } catch (e) {
      console.error('[PostQueue] Failed to save state:', e);
    }
  }
  
  /**
   * Load state from localStorage
   */
  private loadState(): void {
    try {
      const saved = localStorage.getItem('screndly_post_queue');
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Restore queue with Date objects
        this.queue = (parsed.queue || []).map((c: any) => ({
          ...c,
          earliestPostTime: new Date(c.earliestPostTime),
          latestPostTime: new Date(c.latestPostTime),
          scheduledTime: c.scheduledTime ? new Date(c.scheduledTime) : undefined,
          postedTime: c.postedTime ? new Date(c.postedTime) : undefined,
        }));
        
        this.rateConfig = { ...DEFAULT_RATE_CONFIG, ...parsed.rateConfig };
        this.lastPostTime = new Map(parsed.lastPostTime?.map(([k, v]: [string, string]) => [k, new Date(v)]) || []);
        this.dailyCounts = new Map(parsed.dailyCounts || []);
      }
    } catch (e) {
      console.error('[PostQueue] Failed to load state:', e);
    }
  }
}

/**
 * Calculate urgency score based on temporal proximity
 * 100 = posting NOW, 0 = posting in distant future
 */
export function calculateUrgencyScore(earliestPostTime: Date, latestPostTime: Date): number {
  const now = new Date();
  const totalWindow = latestPostTime.getTime() - earliestPostTime.getTime();
  const remaining = latestPostTime.getTime() - now.getTime();
  
  if (remaining <= 0) return 100; // Expired = max urgency
  if (now < earliestPostTime) return 0; // Not yet eligible
  
  // Linear urgency: as time passes in window, urgency increases
  const elapsed = now.getTime() - earliestPostTime.getTime();
  return Math.min(100, Math.round((elapsed / totalWindow) * 100));
}

// Export singleton instance
export const postQueue = new PostQueue();
