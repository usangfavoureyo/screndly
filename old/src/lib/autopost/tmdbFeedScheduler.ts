/**
 * TMDb Feed Scheduler
 * 
 * Automatically generates TMDb feeds and feeds them to the autopost queue.
 * Runs daily to keep feeds fresh without user intervention.
 * 
 * Flow:
 * 1. Every 24 hours (configurable)
 * 2. Generate Today/Weekly/Monthly/Anniversary feeds
 * 3. Check autopost toggles
 * 4. Feed eligible posts to autopost queue
 * 5. Log results
 */

import { feedTMDbPostsToQueue } from './tmdbFeedAdapter';
import { toast } from "sonner";

export interface TMDbFeedSchedulerConfig {
  enabled: boolean;
  refreshInterval: number; // Hours between refresh (default: 24)
  autoFeedToQueue: boolean; // If true, automatically feed to queue
}

const DEFAULT_SCHEDULER_CONFIG: TMDbFeedSchedulerConfig = {
  enabled: true,
  refreshInterval: 24, // Once per day
  autoFeedToQueue: true,
};

export class TMDbFeedScheduler {
  private config: TMDbFeedSchedulerConfig;
  private intervalId: number | null = null;
  private isRunning: boolean = false;
  private lastRefresh: Date | null = null;
  
  constructor(config?: Partial<TMDbFeedSchedulerConfig>) {
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    this.loadConfig();
    this.loadLastRefresh();
  }
  
  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('[TMDbFeedScheduler] Already running');
      return;
    }
    
    console.log('[TMDbFeedScheduler] Starting...');
    this.isRunning = true;
    
    // Check if we should run immediately (if never run or > 24hrs ago)
    const shouldRunNow = this.shouldRefreshNow();
    if (shouldRunNow) {
      console.log('[TMDbFeedScheduler] Running immediate refresh...');
      this.refresh();
    }
    
    // Schedule recurring execution
    this.intervalId = window.setInterval(
      () => this.refresh(),
      this.config.refreshInterval * 60 * 60 * 1000 // Convert hours to ms
    );
    
    console.log('[TMDbFeedScheduler] Started - will refresh every', this.config.refreshInterval, 'hours');
  }
  
  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[TMDbFeedScheduler] Not running');
      return;
    }
    
    console.log('[TMDbFeedScheduler] Stopping...');
    this.isRunning = false;
    
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  /**
   * Check if we should refresh now (never run or > 24hrs ago)
   */
  private shouldRefreshNow(): boolean {
    if (!this.lastRefresh) return true;
    
    const hoursSinceRefresh = (Date.now() - this.lastRefresh.getTime()) / (1000 * 60 * 60);
    return hoursSinceRefresh >= this.config.refreshInterval;
  }
  
  /**
   * Refresh TMDb feeds and feed to queue
   */
  async refresh(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[TMDbFeedScheduler] Disabled, skipping refresh');
      return;
    }
    
    console.log('[TMDbFeedScheduler] Starting refresh...');
    
    try {
      // Generate TMDb feeds
      const posts = await this.generateTMDbFeeds();
      
      if (posts.length === 0) {
        console.log('[TMDbFeedScheduler] No posts generated');
        return;
      }
      
      console.log(`[TMDbFeedScheduler] Generated ${posts.length} posts`);
      
      // Feed to queue if enabled
      if (this.config.autoFeedToQueue) {
        const stats = feedTMDbPostsToQueue(posts);
        
        console.log('[TMDbFeedScheduler] Queue feed stats:', stats);
        
        if (stats.added > 0) {
          toast.success(`TMDb feeds updated: ${stats.added} posts added to queue`);
        }
      }
      
      // Update last refresh time
      this.lastRefresh = new Date();
      this.saveLastRefresh();
      
    } catch (error) {
      console.error('[TMDbFeedScheduler] Refresh failed:', error);
      toast.error('Failed to refresh TMDb feeds');
    }
  }
  
  /**
   * Generate TMDb feeds (mock implementation)
   * In production, this would call TMDb API
   */
  private async generateTMDbFeeds(): Promise<any[]> {
    console.log('[TMDbFeedScheduler] Generating feeds from TMDb API...');
    
    // Get settings to check which feeds are enabled
    const settings = this.getTMDbSettings();
    const posts: any[] = [];
    
    // Generate Today feed
    if (settings?.todayEnabled) {
      const todayPosts = await this.fetchTodayReleases();
      posts.push(...todayPosts);
    }
    
    // Generate Weekly feed
    if (settings?.weeklyEnabled) {
      const weeklyPosts = await this.fetchWeeklyReleases();
      posts.push(...weeklyPosts);
    }
    
    // Generate Monthly feed
    if (settings?.monthlyEnabled) {
      const monthlyPosts = await this.fetchMonthlyPreviews();
      posts.push(...monthlyPosts);
    }
    
    // Generate Anniversary feed
    if (settings?.anniversaryEnabled) {
      const anniversaryPosts = await this.fetchAnniversaries();
      posts.push(...anniversaryPosts);
    }
    
    return posts;
  }
  
  /**
   * Fetch today's releases from TMDb
   */
  private async fetchTodayReleases(): Promise<any[]> {
    // Mock implementation - replace with actual TMDb API call
    console.log('[TMDbFeedScheduler] Fetching today releases...');
    
    const today = new Date().toISOString().split('T')[0];
    
    // In production, call TMDb API:
    // GET https://api.themoviedb.org/3/discover/movie?primary_release_date.gte=${today}&primary_release_date.lte=${today}
    
    return [
      {
        id: `tmdb-today-${Date.now()}`,
        tmdbId: 123456,
        mediaType: 'movie' as const,
        title: 'Example Movie (Today)',
        year: 2025,
        releaseDate: today,
        caption: `🎬 Releasing Today: Example Movie (2025)`,
        imageUrl: 'https://image.tmdb.org/t/p/w500/example.jpg',
        imageType: 'poster' as const,
        scheduledTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
        source: 'tmdb_today' as const,
        cast: ['Actor 1', 'Actor 2'],
        popularity: 1234.56,
        cacheHit: false,
        status: 'queued' as const,
      }
    ];
  }
  
  /**
   * Fetch weekly releases from TMDb
   */
  private async fetchWeeklyReleases(): Promise<any[]> {
    console.log('[TMDbFeedScheduler] Fetching weekly releases...');
    
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().split('T')[0];
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    
    // In production, call TMDb API:
    // GET https://api.themoviedb.org/3/discover/movie?primary_release_date.gte=${todayStr}&primary_release_date.lte=${nextWeekStr}
    
    return [
      {
        id: `tmdb-weekly-${Date.now()}`,
        tmdbId: 234567,
        mediaType: 'movie' as const,
        title: 'Example Movie (Weekly)',
        year: 2025,
        releaseDate: nextWeekStr,
        caption: `🎬 Coming This Week: Example Movie (2025)`,
        imageUrl: 'https://image.tmdb.org/t/p/w500/example2.jpg',
        imageType: 'poster' as const,
        scheduledTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        source: 'tmdb_weekly' as const,
        cast: ['Actor 3', 'Actor 4'],
        popularity: 987.65,
        cacheHit: false,
        status: 'queued' as const,
      }
    ];
  }
  
  /**
   * Fetch monthly previews from TMDb
   */
  private async fetchMonthlyPreviews(): Promise<any[]> {
    console.log('[TMDbFeedScheduler] Fetching monthly previews...');
    
    const today = new Date();
    const nextMonth = new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().split('T')[0];
    const nextMonthStr = nextMonth.toISOString().split('T')[0];
    
    return [
      {
        id: `tmdb-monthly-${Date.now()}`,
        tmdbId: 345678,
        mediaType: 'movie' as const,
        title: 'Example Movie (Monthly)',
        year: 2025,
        releaseDate: nextMonthStr,
        caption: `🎬 Coming Next Month: Example Movie (2025)`,
        imageUrl: 'https://image.tmdb.org/t/p/w500/example3.jpg',
        imageType: 'poster' as const,
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        source: 'tmdb_monthly' as const,
        cast: ['Actor 5', 'Actor 6'],
        popularity: 543.21,
        cacheHit: false,
        status: 'queued' as const,
      }
    ];
  }
  
  /**
   * Fetch anniversaries from TMDb
   */
  private async fetchAnniversaries(): Promise<any[]> {
    console.log('[TMDbFeedScheduler] Fetching anniversaries...');
    
    const today = new Date();
    const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    return [
      {
        id: `tmdb-anniversary-${Date.now()}`,
        tmdbId: 456789,
        mediaType: 'movie' as const,
        title: 'Classic Movie (Anniversary)',
        year: 2000,
        releaseDate: `2000-${monthDay}`,
        caption: `🎂 25 Years Ago Today: Classic Movie (2000)`,
        imageUrl: 'https://image.tmdb.org/t/p/w500/example4.jpg',
        imageType: 'poster' as const,
        scheduledTime: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
        source: 'tmdb_anniversary' as const,
        cast: ['Actor 7', 'Actor 8'],
        popularity: 234.56,
        cacheHit: false,
        status: 'queued' as const,
      }
    ];
  }
  
  /**
   * Get TMDb settings
   */
  private getTMDbSettings(): any {
    try {
      const settings = localStorage.getItem('screndly_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        return {
          todayEnabled: parsed.tmdbTodayEnabled ?? true,
          weeklyEnabled: parsed.tmdbWeeklyEnabled ?? true,
          monthlyEnabled: parsed.tmdbMonthlyEnabled ?? true,
          anniversaryEnabled: parsed.tmdbAnniversaryEnabled ?? true,
        };
      }
    } catch (e) {
      console.error('[TMDbFeedScheduler] Failed to load settings:', e);
    }
    return {
      todayEnabled: true,
      weeklyEnabled: true,
      monthlyEnabled: true,
      anniversaryEnabled: true,
    };
  }
  
  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    config: TMDbFeedSchedulerConfig;
    lastRefresh: Date | null;
    nextRefresh: Date | null;
  } {
    const nextRefresh = this.lastRefresh
      ? new Date(this.lastRefresh.getTime() + this.config.refreshInterval * 60 * 60 * 1000)
      : null;
    
    return {
      isRunning: this.isRunning,
      config: this.config,
      lastRefresh: this.lastRefresh,
      nextRefresh,
    };
  }
  
  /**
   * Update scheduler configuration
   */
  updateConfig(updates: Partial<TMDbFeedSchedulerConfig>): void {
    const wasRunning = this.isRunning;
    
    // Stop if running
    if (wasRunning) {
      this.stop();
    }
    
    // Update config
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    
    // Restart if was running and still enabled
    if (wasRunning && this.config.enabled) {
      this.start();
    }
    
    toast.success('TMDb feed scheduler updated');
  }
  
  /**
   * Force immediate refresh
   */
  async forceRefresh(): Promise<void> {
    console.log('[TMDbFeedScheduler] Force refresh triggered');
    await this.refresh();
  }
  
  /**
   * Save config to localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem('screndly_tmdb_scheduler_config', JSON.stringify(this.config));
    } catch (e) {
      console.error('[TMDbFeedScheduler] Failed to save config:', e);
    }
  }
  
  /**
   * Load config from localStorage
   */
  private loadConfig(): void {
    try {
      const saved = localStorage.getItem('screndly_tmdb_scheduler_config');
      if (saved) {
        this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('[TMDbFeedScheduler] Failed to load config:', e);
    }
  }
  
  /**
   * Save last refresh time
   */
  private saveLastRefresh(): void {
    try {
      if (this.lastRefresh) {
        localStorage.setItem('screndly_tmdb_last_refresh', this.lastRefresh.toISOString());
      }
    } catch (e) {
      console.error('[TMDbFeedScheduler] Failed to save last refresh:', e);
    }
  }
  
  /**
   * Load last refresh time
   */
  private loadLastRefresh(): void {
    try {
      const saved = localStorage.getItem('screndly_tmdb_last_refresh');
      if (saved) {
        this.lastRefresh = new Date(saved);
      }
    } catch (e) {
      console.error('[TMDbFeedScheduler] Failed to load last refresh:', e);
    }
  }
}

// Export singleton instance
export const tmdbFeedScheduler = new TMDbFeedScheduler();

// Auto-start on load if enabled
if (tmdbFeedScheduler.getStatus().config.enabled) {
  tmdbFeedScheduler.start();
}
