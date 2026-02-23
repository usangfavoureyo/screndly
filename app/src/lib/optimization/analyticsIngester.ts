/**
 * Analytics Ingester
 * 
 * Background job that pulls performance metrics from platform APIs.
 * Stores metrics in the analytics store for signal calculation.
 * All data collection is internal - no UI exposure.
 */

import { analyticsStore } from './analyticsStore';
import { signalEngine } from './signalEngine';
import {
    Platform,
    PostAnalyticsRecord,
    ContentSource,
    CaptionModel,
} from './types';

// Polling intervals (in milliseconds)
const POLL_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const INITIAL_DELAY_MS = 5 * 60 * 1000; // 5 minutes after start
const METRICS_UPDATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Analytics Ingester Class
 */
class AnalyticsIngester {
    private config = analyticsStore.getConfig();
    private intervalId: number | null = null;
    private isRunning = false;

    /**
     * Start the analytics ingester
     */
    start(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.log('Analytics ingester starting...');

        // Initial delayed run
        setTimeout(() => {
            if (this.isRunning) {
                this.poll();
            }
        }, INITIAL_DELAY_MS);

        // Set up recurring poll
        this.intervalId = window.setInterval(() => {
            this.poll();
        }, POLL_INTERVAL_MS);

        this.log('Analytics ingester started');
    }

    /**
     * Stop the analytics ingester
     */
    stop(): void {
        if (this.intervalId) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        this.log('Analytics ingester stopped');
    }

    /**
     * Run a single polling cycle
     */
    async poll(): Promise<void> {
        if (!this.config.enabled) {
            this.log('Optimization disabled, skipping poll');
            return;
        }

        this.log('Starting metrics poll...');

        try {
            // Get records that need metrics updates
            const records = this.getRecordsNeedingUpdate();
            this.log(`Found ${records.length} records needing metrics update`);

            // Group by platform for efficient API calls
            const byPlatform = this.groupByPlatform(records);

            // Fetch metrics for each platform
            const platforms: Platform[] = ['x', 'facebook', 'instagram', 'threads', 'tiktok', 'youtube', 'pinterest'];

            for (const platform of platforms) {
                const platformRecords = byPlatform.get(platform) || [];
                if (platformRecords.length > 0) {
                    await this.fetchPlatformMetrics(platform, platformRecords);
                }
            }

            // Recalculate signals after new data
            signalEngine.calculateSignals();

            this.log('Metrics poll complete');
        } catch (error) {
            console.error('[AnalyticsIngester] Poll failed:', error);
        }
    }

    /**
     * Get records that haven't been updated recently
     */
    private getRecordsNeedingUpdate(): PostAnalyticsRecord[] {
        const allRecords = analyticsStore.getAllRecords();
        const now = Date.now();

        return allRecords.filter(record => {
            // Only update records from last 7 days
            if (now - record.postedAt > METRICS_UPDATE_WINDOW_MS) {
                return false;
            }

            // Need update if:
            // 1. Never updated (metricsUpdateCount === 0)
            // 2. Updated more than polling interval ago
            // 3. Less than 5 updates total (get more frequent early updates)

            if (record.metricsUpdateCount === 0) return true;
            if (record.metricsUpdateCount < 5) return true;
            if (now - record.lastMetricsUpdate > POLL_INTERVAL_MS) return true;

            return false;
        });
    }

    /**
     * Group records by platform
     */
    private groupByPlatform(records: PostAnalyticsRecord[]): Map<Platform, PostAnalyticsRecord[]> {
        const grouped = new Map<Platform, PostAnalyticsRecord[]>();

        records.forEach(record => {
            const existing = grouped.get(record.platform) || [];
            existing.push(record);
            grouped.set(record.platform, existing);
        });

        return grouped;
    }

    /**
     * Fetch metrics for a platform's posts
     * This is where platform-specific API integration would go
     */
    private async fetchPlatformMetrics(
        platform: Platform,
        records: PostAnalyticsRecord[]
    ): Promise<void> {
        this.log(`Fetching metrics for ${platform}: ${records.length} records`);

        // In production, these would be actual API calls
        // For now, we simulate metric collection

        for (const record of records) {
            try {
                const metrics = await this.fetchMetricsFromAPI(platform, record.postId);

                if (metrics) {
                    analyticsStore.updateRecordMetrics(record.postId, platform, metrics);
                    this.log(`Updated metrics for ${platform}:${record.postId}`);
                }
            } catch (_error) {
                // Silently skip failed fetches
                this.log(`Failed to fetch metrics for ${platform}:${record.postId}`);
            }
        }
    }

    /**
     * Fetch metrics from platform API
     * This is a placeholder for actual API integration
     */
    private async fetchMetricsFromAPI(
        platform: Platform,
        postId: string
    ): Promise<Partial<PostAnalyticsRecord['metrics']> | null> {
        // Check if we have stored access tokens for this platform
        const hasApiAccess = this.checkApiAccess(platform);

        if (!hasApiAccess) {
            // No API access - simulate metrics based on age and existing data
            return this.simulateMetrics(platform, postId);
        }

        // In production, implement actual API calls here:
        // - Meta Graph API: GET /{post-id}/insights
        // - X Analytics API: GET /tweets/{id}/metrics
        // - YouTube API: GET /videos?id={id}&part=statistics
        // - TikTok: Creator API analytics
        // - Pinterest: Analytics API

        // For now, simulate metrics
        return this.simulateMetrics(platform, postId);
    }

    /**
     * Check if we have API access for a platform
     */
    private checkApiAccess(platform: Platform): boolean {
        // Check for stored tokens
        const tokenKeys: Record<Platform, string> = {
            x: 'x_access_token',
            facebook: 'meta_access_token',
            instagram: 'meta_access_token',
            threads: 'meta_access_token',
            tiktok: 'tiktok_access_token',
            youtube: 'youtube_access_token',
            pinterest: 'pinterest_access_token',
        };

        const token = localStorage.getItem(tokenKeys[platform]);
        return !!token;
    }

    /**
     * Simulate metrics for development/testing
     * Replace with actual API calls in production
     */
    private async simulateMetrics(
        _platform: Platform,
        _postId: string
    ): Promise<Partial<PostAnalyticsRecord['metrics']> | null> {
        // Simulate some random metrics for testing signal calculation
        // In production, remove this and use real API data

        const record = analyticsStore.getAllRecords().find(
            r => r.postId === _postId && r.platform === _platform
        );

        if (!record) return null;

        // Base metrics on age (newer posts have fewer but grow)
        const ageHours = (Date.now() - record.postedAt) / (1000 * 60 * 60);
        const growthFactor = Math.log10(ageHours + 1) + 1;

        // Create slightly random but realistic metrics
        const baseImpressions = Math.floor(100 * growthFactor * (0.5 + Math.random()));
        const engagementRate = 0.02 + Math.random() * 0.08; // 2-10%

        return {
            impressions: baseImpressions,
            reach: Math.floor(baseImpressions * 0.8),
            engagements: Math.floor(baseImpressions * engagementRate),
            likes: Math.floor(baseImpressions * engagementRate * 0.7),
            comments: Math.floor(baseImpressions * engagementRate * 0.15),
            shares: Math.floor(baseImpressions * engagementRate * 0.1),
            clicks: Math.floor(baseImpressions * 0.02),
            saves: Math.floor(baseImpressions * 0.01),
        };
    }

    /**
     * Record a new post for analytics tracking
     */
    recordNewPost(
        postId: string,
        platform: Platform,
        contentSource: ContentSource,
        caption: string,
        captionModel: CaptionModel = 'gpt-4o-mini',
        mediaType: 'video' | 'image' | 'text' = 'video',
        additionalData?: {
            tmdbId?: number;
            feedType?: 'today' | 'weekly' | 'monthly' | 'anniversary';
            captionTone?: string;
        }
    ): void {
        const now = new Date();

        const record: PostAnalyticsRecord = {
            id: `${platform}_${postId}_${Date.now()}`,
            postId,
            platform,
            contentSource,
            postedAt: Date.now(),
            captionHash: this.hashCaption(caption),
            captionModel,
            captionTone: additionalData?.captionTone,
            keywords: this.extractKeywords(caption),
            captionLength: caption.length,
            mediaType,
            tmdbId: additionalData?.tmdbId,
            feedType: additionalData?.feedType,
            postHour: now.getHours(),
            postDayOfWeek: now.getDay(),
            metrics: {},
            scores: {},
            lastMetricsUpdate: 0,
            metricsUpdateCount: 0,
            isRetry: false,
            retryCount: 0,
        };

        analyticsStore.saveRecord(record);
        this.log(`Recorded new post: ${platform}:${postId}`);
    }

    /**
     * Track a setting change event
     */
    trackSettingChange(
        key: string,
        newValue: any,
        previousValue?: any,
        context: string = 'Settings'
    ): void {
        const event: import('./types').SettingChangeEvent = {
            type: 'setting_change',
            key,
            newValue,
            previousValue,
            context,
            timestamp: Date.now(),
        };

        analyticsStore.logSettingChange(event);
        this.log(`Tracked setting change: ${key}`);
    }

    /**
     * Simple hash function for captions
     */
    private hashCaption(caption: string): string {
        let hash = 0;
        for (let i = 0; i < caption.length; i++) {
            const char = caption.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Extract keywords from caption
     */
    private extractKeywords(caption: string): string[] {
        const hashtags = caption.match(/#\w+/g) || [];
        const titleCase = caption.match(/\b[A-Z][a-z]+\b/g) || [];
        return [...new Set([...hashtags, ...titleCase])].slice(0, 10);
    }

    /**
     * Get ingester status
     */
    getStatus(): {
        isRunning: boolean;
        recordsCount: number;
        lastPollTime: number | null;
        nextPollTime: number | null;
    } {
        const stats = analyticsStore.getStats();

        return {
            isRunning: this.isRunning,
            recordsCount: stats.recordCount,
            lastPollTime: stats.newestRecord,
            nextPollTime: this.isRunning ? Date.now() + POLL_INTERVAL_MS : null,
        };
    }

    /**
     * Force immediate poll
     */
    async forcePoll(): Promise<void> {
        await this.poll();
    }

    /**
     * Logging helper
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[AnalyticsIngester] ${message}`);
        }
    }
}

// Export singleton
export const analyticsIngester = new AnalyticsIngester();
