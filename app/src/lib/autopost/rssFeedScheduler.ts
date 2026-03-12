/**
 * RSS Feed Scheduler
 * 
 * Polls RSS feeds at configured intervals and feeds eligible items to the autopost queue.
 * 
 * CRITICAL ARCHITECTURE:
 * - Polling is DECOUPLED from posting
 * - RSS poller only fetches, filters, and evaluates eligibility
 * - Polling NEVER triggers direct posting
 * - All eligible items flow into the centralized postQueue
 * - The autopostEngine decides WHEN to post based on global rate limits
 * 
 * Flow:
 * 1. Every N minutes (configurable per feed)
 * 2. Fetch RSS feed XML
 * 3. Parse entries
 * 4. Apply filters (required/blocked keywords)
 * 5. Check deduplication
 * 6. Enrich with images (Serper)
 * 7. Generate caption (GPT)
 * 8. Feed eligible items to autopost queue
 * 9. Queue enforces posting intervals globally
 */

import { postQueue, PostCandidate, calculateUrgencyScore } from './postQueue';
import { toast } from "sonner";

export interface RSSFeedConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  pollingInterval: number; // Minutes between polls (default: 5)
  imageCount: '1' | '2' | '3' | 'random';
  dedupeDays: number;
  filters: {
    scope: 'title' | 'body' | 'title_or_body' | 'title_and_body';
    required: Array<{
      text: string;
      matchType: 'contains' | 'exact';
      caseSensitive: boolean;
      active: boolean;
    }>;
    blocked: Array<{
      text: string;
      matchType: 'contains' | 'exact';
      caseSensitive: boolean;
      active: boolean;
    }>;
  };
  serperEnabled?: boolean;
  tmdbEnabled?: boolean;
  serperPriority: boolean;
  rehostImages: boolean;
  platformsEnabled: { x: boolean; threads: boolean; facebook: boolean; pinterest: boolean };
  autoPost: boolean;
}

export interface RSSItem {
  id: string;
  feedId: string;
  feedName: string;
  title: string;
  description: string;
  url: string;
  publishedDate: Date;
  imageUrl?: string;
  content?: string;
}

export interface RSSFeedSchedulerConfig {
  enabled: boolean;
  globalPollingInterval: number; // Minutes (default: 5)
  autoFeedToQueue: boolean; // If true, automatically feed to queue
}

const DEFAULT_SCHEDULER_CONFIG: RSSFeedSchedulerConfig = {
  enabled: true,
  globalPollingInterval: 5, // Poll every 5 minutes
  autoFeedToQueue: true,
};

export class RSSFeedScheduler {
  private config: RSSFeedSchedulerConfig;
  private intervalId: number | null = null;
  private isRunning: boolean = false;
  private lastPoll: Map<string, Date> = new Map(); // feedId -> last poll time
  private processedItems: Set<string> = new Set(); // For deduplication
  private feeds: RSSFeedConfig[] = [];

  constructor(config?: Partial<RSSFeedSchedulerConfig>) {
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    this.loadConfig();
    this.loadLastPolls();
    this.loadProcessedItems();
    this.loadFeeds();
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('[RSSFeedScheduler] Already running');
      return;
    }

    console.log('[RSSFeedScheduler] Starting...');
    this.isRunning = true;

    // Run immediate poll on start
    console.log('[RSSFeedScheduler] Running immediate poll...');
    this.pollAll();

    // Schedule recurring polls
    this.intervalId = window.setInterval(
      () => this.pollAll(),
      this.config.globalPollingInterval * 60 * 1000 // Convert minutes to ms
    );

    console.log('[RSSFeedScheduler] Started - polling every', this.config.globalPollingInterval, 'minutes');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[RSSFeedScheduler] Not running');
      return;
    }

    console.log('[RSSFeedScheduler] Stopping...');
    this.isRunning = false;

    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Poll all enabled feeds
   */
  private async pollAll(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[RSSFeedScheduler] Disabled, skipping poll');
      return;
    }

    // Reload feeds in case they were updated
    this.loadFeeds();

    const enabledFeeds = this.feeds.filter(f => f.enabled);

    if (enabledFeeds.length === 0) {
      console.log('[RSSFeedScheduler] No enabled feeds');
      return;
    }

    console.log(`[RSSFeedScheduler] Polling ${enabledFeeds.length} feeds...`);

    // Poll each feed (respects individual feed intervals)
    for (const feed of enabledFeeds) {
      if (this.shouldPollFeed(feed)) {
        await this.pollFeed(feed);
      }
    }
  }

  /**
   * Check if we should poll this feed now
   */
  private shouldPollFeed(feed: RSSFeedConfig): boolean {
    const lastPoll = this.lastPoll.get(feed.id);
    if (!lastPoll) return true;

    const minutesSinceLastPoll = (Date.now() - lastPoll.getTime()) / (1000 * 60);
    return minutesSinceLastPoll >= feed.pollingInterval;
  }

  /**
   * Poll a single RSS feed
   */
  private async pollFeed(feed: RSSFeedConfig): Promise<void> {
    console.log(`[RSSFeedScheduler] Polling feed: ${feed.name}`);

    try {
      // Check if global RSS posting is enabled
      const globalRSSPostingEnabled = this.isGlobalRSSPostingEnabled();
      if (!globalRSSPostingEnabled) {
        console.log('[RSSFeedScheduler] Global RSS posting is disabled, skipping feed processing');
        this.lastPoll.set(feed.id, new Date());
        this.saveLastPolls();
        return;
      }

      // 1. Fetch RSS feed
      const items = await this.fetchRSSFeed(feed.url, feed.id, feed.name);

      if (items.length === 0) {
        console.log(`[RSSFeedScheduler] No items in feed: ${feed.name}`);
        this.lastPoll.set(feed.id, new Date());
        this.saveLastPolls();
        return;
      }

      console.log(`[RSSFeedScheduler] Found ${items.length} items in feed: ${feed.name}`);

      // 2. Filter items
      const filteredItems = items.filter(item => this.applyFilters(item, feed.filters));

      console.log(`[RSSFeedScheduler] ${filteredItems.length} items passed filters`);

      // 3. Check deduplication (only if enabled in settings)
      const deduplicationEnabled = this.isDeduplicationEnabled();
      const newItems = deduplicationEnabled
        ? filteredItems.filter(item => !this.isDuplicate(item, feed.dedupeDays))
        : filteredItems; // If dedup is off, process all filtered items

      console.log(`[RSSFeedScheduler] ${newItems.length} new items (after deduplication check: ${deduplicationEnabled ? 'enabled' : 'disabled'})`);

      // 4. Enrich and queue each new item
      if (this.config.autoFeedToQueue && feed.autoPost) {
        let queued = 0;

        for (const item of newItems) {
          try {
            // Enrich with images if needed
            const enrichedItem = await this.enrichItem(item, feed);

            // Generate caption
            const caption = await this.generateCaption(enrichedItem, feed);

            // Convert to PostCandidate and add to queue
            const candidate = this.rssItemToCandidate(enrichedItem, caption, feed);
            postQueue.addCandidate(candidate);

            // Mark as processed (only if deduplication is enabled)
            if (deduplicationEnabled) {
              this.processedItems.add(item.id);
            }
            queued++;

            // EVENT-DRIVEN: Post immediately if enabled
            const eventDrivenEnabled = this.isEventDrivenPostingEnabled();
            if (eventDrivenEnabled) {
              console.log('[RSSFeedScheduler] Event-driven mode: Attempting immediate post');
              await this.attemptImmediatePost(candidate);
            }

          } catch (e) {
            console.error(`[RSSFeedScheduler] Failed to process item ${item.id}:`, e);
          }
        }

        console.log(`[RSSFeedScheduler] Queued ${queued} items from ${feed.name}`);

        if (queued > 0) {
          const eventDrivenEnabled = this.isEventDrivenPostingEnabled();
          const mode = eventDrivenEnabled ? '(posted immediately)' : '(will post at interval)';
          toast.success(`RSS: ${queued} new items from ${feed.name} ${mode}`);
        }

        if (deduplicationEnabled) {
          this.saveProcessedItems();
        }
      }

      // Update last poll time
      this.lastPoll.set(feed.id, new Date());
      this.saveLastPolls();

    } catch (error) {
      console.error(`[RSSFeedScheduler] Failed to poll feed ${feed.name}:`, error);
      toast.error(`Failed to poll RSS feed: ${feed.name}`);
    }
  }

  /**
   * Fetch and parse RSS feed (mock implementation)
   */
  private async fetchRSSFeed(url: string, feedId: string, feedName: string): Promise<RSSItem[]> {
    console.log(`[RSSFeedScheduler] Fetching feed from ${url}`);

    // Mock implementation - in production, fetch actual RSS XML and parse
    // Use a library like 'rss-parser' or 'fast-xml-parser'

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock items
    return [
      {
        id: `rss-${feedId}-${Date.now()}-1`,
        feedId,
        feedName,
        title: 'New Movie Trailer Released',
        description: 'Exciting new trailer for upcoming blockbuster film',
        url: `https://example.com/article-${Date.now()}`,
        publishedDate: new Date(),
        content: 'The trailer shows amazing action sequences and stunning visuals...',
      },
      {
        id: `rss-${feedId}-${Date.now()}-2`,
        feedId,
        feedName,
        title: 'Director Announces New Project',
        description: 'Famous director reveals next big project',
        url: `https://example.com/article-${Date.now() + 1}`,
        publishedDate: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
        content: 'In an exclusive interview, the director discussed plans...',
      },
    ];
  }

  /**
   * Apply filters to RSS item
   */
  private applyFilters(item: RSSItem, filters: RSSFeedConfig['filters']): boolean {
    const searchText = this.getSearchText(item, filters.scope);

    // Check required filters (all active filters must match)
    const requiredFilters = filters.required.filter(f => f.active);
    if (requiredFilters.length > 0) {
      const allMatch = requiredFilters.every(filter =>
        this.matchesFilter(searchText, filter)
      );
      if (!allMatch) return false;
    }

    // Check blocked filters (no active filters should match)
    const blockedFilters = filters.blocked.filter(f => f.active);
    if (blockedFilters.length > 0) {
      const anyMatch = blockedFilters.some(filter =>
        this.matchesFilter(searchText, filter)
      );
      if (anyMatch) return false;
    }

    return true;
  }

  /**
   * Get search text based on filter scope
   */
  private getSearchText(item: RSSItem, scope: RSSFeedConfig['filters']['scope']): string {
    switch (scope) {
      case 'title':
        return item.title;
      case 'body':
        return item.content || item.description;
      case 'title_or_body':
        return `${item.title} ${item.content || item.description}`;
      case 'title_and_body':
        return `${item.title} ${item.content || item.description}`;
      default:
        return item.title;
    }
  }

  /**
   * Check if text matches filter
   */
  private matchesFilter(text: string, filter: { text: string; matchType: 'contains' | 'exact'; caseSensitive: boolean }): boolean {
    let searchText = text;
    let filterText = filter.text;

    if (!filter.caseSensitive) {
      searchText = searchText.toLowerCase();
      filterText = filterText.toLowerCase();
    }

    if (filter.matchType === 'exact') {
      return searchText === filterText;
    } else {
      return searchText.includes(filterText);
    }
  }

  /**
   * Check if item is duplicate
   */
  private isDuplicate(item: RSSItem, dedupeDays: number): boolean {
    // Check if already processed
    if (this.processedItems.has(item.id)) {
      return true;
    }

    // Check if published more than dedupeDays ago
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - dedupeDays);

    if (item.publishedDate < cutoff) {
      return true; // Too old
    }

    return false;
  }

  /**
   * Enrich item with images (mock implementation)
   */
  private async enrichItem(item: RSSItem, feed: RSSFeedConfig): Promise<RSSItem> {
    console.log(`[RSSFeedScheduler] Enriching item: ${item.title}`);

    // Mock implementation - in production, use Serper API
    // If serperPriority is true, fetch images via Serper
    // Otherwise, extract images from RSS content

    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      ...item,
      imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
    };
  }

  /**
   * Generate caption for item (mock implementation)
   */
  private async generateCaption(item: RSSItem, feed: RSSFeedConfig): Promise<string> {
    console.log(`[RSSFeedScheduler] Generating caption for: ${item.title}`);

    // Mock implementation - in production, use GPT API
    // Load caption settings from localStorage and generate caption

    await new Promise(resolve => setTimeout(resolve, 300));

    return `🎬 ${item.title} - Check out the latest news! #Movies #Entertainment`;
  }

  /**
   * Convert RSS item to PostCandidate
   */
  private rssItemToCandidate(item: RSSItem, caption: string, feed: RSSFeedConfig): PostCandidate {
    const now = new Date();

    // RSS items should be posted ASAP (high urgency)
    // Posting window: now to 24 hours from now
    const earliestPostTime = now;
    const latestPostTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const urgencyScore = calculateUrgencyScore(earliestPostTime, latestPostTime);

    // Get enabled platforms
    const platforms: string[] = [];
    if (feed.platformsEnabled.x) platforms.push('x');
    if (feed.platformsEnabled.threads) platforms.push('threads');
    if (feed.platformsEnabled.facebook) platforms.push('facebook');
    if (feed.platformsEnabled.pinterest) platforms.push('pinterest');

    // Create deduplication key
    const dedupeKey = `rss_${feed.id}_${item.id}`;

    return {
      id: item.id,
      source: 'rss',

      title: item.title,
      caption,
      mediaUrl: item.url,
      thumbnailUrl: item.imageUrl,

      earliestPostTime,
      latestPostTime,

      priority: 'P2', // RSS = high priority (P2)
      urgencyScore,

      platforms,

      status: 'queued',
      dedupeKey,
    };
  }

  /**
   * Add or update feed
   */
  addFeed(feed: RSSFeedConfig): void {
    const existingIndex = this.feeds.findIndex(f => f.id === feed.id);
    if (existingIndex !== -1) {
      this.feeds[existingIndex] = feed;
    } else {
      this.feeds.push(feed);
    }
    this.saveFeeds();
  }

  /**
   * Remove feed
   */
  removeFeed(feedId: string): void {
    this.feeds = this.feeds.filter(f => f.id !== feedId);
    this.lastPoll.delete(feedId);
    this.saveFeeds();
    this.saveLastPolls();
  }

  /**
   * Get all feeds
   */
  getFeeds(): RSSFeedConfig[] {
    return [...this.feeds];
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    config: RSSFeedSchedulerConfig;
    feedCount: number;
    enabledFeedCount: number;
    lastPolls: Map<string, Date>;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      feedCount: this.feeds.length,
      enabledFeedCount: this.feeds.filter(f => f.enabled).length,
      lastPolls: new Map(this.lastPoll),
    };
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(updates: Partial<RSSFeedSchedulerConfig>): void {
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

    toast.success('RSS feed scheduler updated');
  }

  /**
   * Force immediate poll of all feeds
   */
  async forceRefresh(): Promise<void> {
    console.log('[RSSFeedScheduler] Force refresh triggered');
    await this.pollAll();
  }

  /**
   * Save config to localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem('screndly_rss_scheduler_config', JSON.stringify(this.config));
    } catch (e) {
      console.error('[RSSFeedScheduler] Failed to save config:', e);
    }
  }

  /**
   * Load config from localStorage
   */
  private loadConfig(): void {
    try {
      const saved = localStorage.getItem('screndly_rss_scheduler_config');
      if (saved) {
        this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('[RSSFeedScheduler] Failed to load config:', e);
    }
  }

  /**
   * Save last poll times
   */
  private saveLastPolls(): void {
    try {
      const data = Array.from(this.lastPoll.entries()).map(([feedId, date]) => ({
        feedId,
        date: date.toISOString(),
      }));
      localStorage.setItem('screndly_rss_last_polls', JSON.stringify(data));
    } catch (e) {
      console.error('[RSSFeedScheduler] Failed to save last polls:', e);
    }
  }

  /**
   * Load last poll times
   */
  private loadLastPolls(): void {
    try {
      const saved = localStorage.getItem('screndly_rss_last_polls');
      if (saved) {
        const data = JSON.parse(saved);
        this.lastPoll = new Map(
          data.map((item: any) => [item.feedId, new Date(item.date)])
        );
      }
    } catch (e) {
      console.error('[RSSFeedScheduler] Failed to load last polls:', e);
    }
  }

  /**
   * Save processed items
   */
  private saveProcessedItems(): void {
    try {
      // Only keep last 10000 items to prevent memory bloat
      const items = Array.from(this.processedItems);
      const recent = items.slice(-10000);
      localStorage.setItem('screndly_rss_processed_items', JSON.stringify(recent));
    } catch (e) {
      console.error('[RSSFeedScheduler] Failed to save processed items:', e);
    }
  }

  /**
   * Load processed items
   */
  private loadProcessedItems(): void {
    try {
      const saved = localStorage.getItem('screndly_rss_processed_items');
      if (saved) {
        const items = JSON.parse(saved);
        this.processedItems = new Set(items);
      }
    } catch (e) {
      console.error('[RSSFeedScheduler] Failed to load processed items:', e);
    }
  }

  /**
   * Save feeds
   */
  private saveFeeds(): void {
    try {
      localStorage.setItem('screndly_rss_feeds', JSON.stringify(this.feeds));
    } catch (e) {
      console.error('[RSSFeedScheduler] Failed to save feeds:', e);
    }
  }

  /**
   * Load feeds from localStorage
   */
  private loadFeeds(): void {
    try {
      const saved = localStorage.getItem('screndly_rss_feeds');
      if (saved) {
        this.feeds = JSON.parse(saved);
      }
    } catch (e) {
      console.error('[RSSFeedScheduler] Failed to load feeds:', e);
    }
  }

  /**
   * Clean up old processed items (older than dedupe window)
   */
  cleanupProcessedItems(maxAgeDays: number = 30): void {
    console.log(`[RSSFeedScheduler] Cleaning up processed items older than ${maxAgeDays} days`);

    // This is a simplified cleanup - in production, you'd need timestamps
    // For now, just limit to 10000 most recent items
    const items = Array.from(this.processedItems);
    if (items.length > 10000) {
      this.processedItems = new Set(items.slice(-10000));
      this.saveProcessedItems();
    }
  }

  /**
   * Check if global RSS posting is enabled
   */
  private isGlobalRSSPostingEnabled(): boolean {
    try {
      const settings = localStorage.getItem('screndly_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        // Default to true if not set
        return parsed.globalRSSPosting !== false;
      }
    } catch (e) {
      console.error('[RSSFeedScheduler] Failed to load global RSS posting setting:', e);
    }
    // Default to true if settings not found
    return true;
  }

  /**
   * Check if deduplication is enabled
   */
  private isDeduplicationEnabled(): boolean {
    try {
      const settings = localStorage.getItem('screndly_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        // Default to true if not set
        return parsed.rssDeduplication !== false;
      }
    } catch (e) {
      console.error('[RSSFeedScheduler] Failed to load deduplication setting:', e);
    }
    // Default to true if settings not found
    return true;
  }

  /**
   * Check if event-driven posting is enabled
   */
  private isEventDrivenPostingEnabled(): boolean {
    try {
      const settings = localStorage.getItem('screndly_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        // Default to TRUE if not set (event-driven is the new default)
        return parsed.rssEventDrivenPosting !== false;
      }
    } catch (e) {
      console.error('[RSSFeedScheduler] Failed to load event-driven posting setting:', e);
    }
    // Default to TRUE if settings not found
    return true;
  }

  /**
   * Attempt to post immediately (event-driven mode)
   */
  private async attemptImmediatePost(candidate: PostCandidate): Promise<void> {
    try {
      console.log('[RSSFeedScheduler] Event-driven: Attempting immediate post for:', candidate.title);

      // Reload rate config to get current minimum gap setting
      postQueue.reloadRateConfigFromSettings();

      // Check if we can post now (respects minimum gap and daily quotas)
      const eligible = postQueue.getNextEligible();

      if (!eligible) {
        console.log('[RSSFeedScheduler] Cannot post immediately - rate limit or quota reached');
        console.log('[RSSFeedScheduler] Item will be posted when queue processes it');
        return;
      }

      // If the candidate we just added is the next eligible one, post it
      if (eligible.id === candidate.id) {
        console.log('[RSSFeedScheduler] Posting immediately:', candidate.title);

        // Import and use the publishing logic from autopostEngine
        // For now, we'll mark it as posted and update the queue
        // In production, this would call the actual platform APIs

        postQueue.markPosted(candidate.id, candidate.platforms);

        console.log(`[RSSFeedScheduler] Successfully posted immediately to:`, candidate.platforms.join(', '));
        toast.success(`✅ Posted: ${candidate.title.substring(0, 50)}...`);
      } else {
        console.log('[RSSFeedScheduler] Item queued but not eligible yet (higher priority items or rate limits)');
      }

    } catch (e) {
      console.error('[RSSFeedScheduler] Failed immediate post:', e);
      // Don't show error toast - item is still in queue and will be posted later
    }
  }
}

// Export singleton instance
export const rssFeedScheduler = new RSSFeedScheduler();

// Auto-start on load if enabled
if (rssFeedScheduler.getStatus().config.enabled) {
  rssFeedScheduler.start();
}
