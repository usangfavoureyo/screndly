/**
 * Optimization Guardrails
 * 
 * Safety limits and fallback mechanisms to prevent system degradation.
 * Ensures the optimization layer doesn't cause harm.
 */

import { analyticsStore } from './analyticsStore';
import { Platform, ContentSource, OptimizationConfig, DEFAULT_OPTIMIZATION_CONFIG } from './types';

// Platform rate limits (posts per day)
const PLATFORM_RATE_LIMITS: Record<Platform, number> = {
    x: 50,
    facebook: 25,
    instagram: 25,
    threads: 100,
    tiktok: 5,
    youtube: 10,
    pinterest: 100,
};

// Retry limits
const MAX_RETRIES_PER_CONTENT = 2;
const RETRY_COOLDOWN_HOURS = 24;

/**
 * Optimization Guardrails Class
 */
class OptimizationGuardrails {
    private config: OptimizationConfig;
    private retryCounts: Map<string, { count: number; lastRetry: number }> = new Map();
    private dailyPostCounts: Map<string, number> = new Map();
    private lastCountReset: number = Date.now();

    constructor() {
        this.config = analyticsStore.getConfig();
        this.loadState();
    }

    /**
     * Check if optimization should be enabled
     */
    isOptimizationEnabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Check if platform-specific optimization is enabled
     */
    isPlatformOptimizationEnabled(platform: Platform): boolean {
        const platformConfig = this.getPlatformConfig(platform);
        return this.config.enabled && platformConfig;
    }

    /**
     * Get platform config from localStorage
     */
    private getPlatformConfig(platform: Platform): boolean {
        try {
            const stored = localStorage.getItem('screndly_optimization_platforms');
            if (stored) {
                const config = JSON.parse(stored);
                return config[platform] !== false; // Default to enabled
            }
        } catch (_e) {
            // Default to enabled
        }
        return true;
    }

    /**
     * Set platform optimization enabled state
     */
    setPlatformOptimization(platform: Platform, enabled: boolean): void {
        try {
            const stored = localStorage.getItem('screndly_optimization_platforms');
            const config = stored ? JSON.parse(stored) : {};
            config[platform] = enabled;
            localStorage.setItem('screndly_optimization_platforms', JSON.stringify(config));
        } catch (_e) {
            console.error('[Guardrails] Failed to save platform config');
        }
    }

    /**
     * Check if we have enough data to make optimization decisions
     */
    hasEnoughData(platform: Platform): boolean {
        const signals = analyticsStore.getSignals();
        if (!signals) return false;

        const platformSignals = signals.platforms[platform];
        return platformSignals.dataPoints >= this.config.minDataPoints;
    }

    /**
     * Check if a retry is allowed for content
     */
    canRetry(contentId: string): boolean {
        if (!this.config.retrySystem) return false;

        const retryInfo = this.retryCounts.get(contentId);
        if (!retryInfo) return true;

        // Check count
        if (retryInfo.count >= MAX_RETRIES_PER_CONTENT) return false;

        // Check cooldown
        const hoursSinceLastRetry = (Date.now() - retryInfo.lastRetry) / (1000 * 60 * 60);
        if (hoursSinceLastRetry < RETRY_COOLDOWN_HOURS) return false;

        return true;
    }

    /**
     * Record a retry attempt
     */
    recordRetry(contentId: string): void {
        const existing = this.retryCounts.get(contentId);
        this.retryCounts.set(contentId, {
            count: (existing?.count || 0) + 1,
            lastRetry: Date.now(),
        });
        this.saveState();
    }

    /**
     * Check if we can post to a platform (rate limit check)
     */
    canPostToPlatform(platform: Platform): boolean {
        this.maybeResetDailyCounts();

        const key = this.getDailyCountKey(platform);
        const current = this.dailyPostCounts.get(key) || 0;
        const limit = PLATFORM_RATE_LIMITS[platform];

        return current < limit;
    }

    /**
     * Record a post to a platform
     */
    recordPost(platform: Platform): void {
        this.maybeResetDailyCounts();

        const key = this.getDailyCountKey(platform);
        const current = this.dailyPostCounts.get(key) || 0;
        this.dailyPostCounts.set(key, current + 1);
        this.saveState();
    }

    /**
     * Get remaining daily quota for a platform
     */
    getRemainingQuota(platform: Platform): number {
        this.maybeResetDailyCounts();

        const key = this.getDailyCountKey(platform);
        const current = this.dailyPostCounts.get(key) || 0;
        const limit = PLATFORM_RATE_LIMITS[platform];

        return Math.max(0, limit - current);
    }

    /**
     * Should we suppress a content source temporarily?
     */
    shouldSuppressSource(source: ContentSource): boolean {
        const signals = analyticsStore.getSignals();
        if (!signals) return false;

        const sourceSignals = signals.sources[source];
        if (!sourceSignals) return false;

        // Suppress if declining trend and confidence is high
        return sourceSignals.trend === 'declining' &&
            sourceSignals.confidence >= 70 &&
            sourceSignals.avgScore < 40;
    }

    /**
     * Get confidence level for optimization decisions
     */
    getConfidenceLevel(platform: Platform): 'none' | 'low' | 'medium' | 'high' {
        const signals = analyticsStore.getSignals();
        if (!signals) return 'none';

        const confidence = signals.platforms[platform].confidence;

        if (confidence < 30) return 'none';
        if (confidence < 50) return 'low';
        if (confidence < 70) return 'medium';
        return 'high';
    }

    /**
     * Should use default behavior (fallback mode)?
     */
    shouldUseFallback(platform: Platform): boolean {
        // Use fallback if:
        // 1. Optimization is disabled
        // 2. Platform optimization is disabled
        // 3. Not enough data
        // 4. Confidence is too low

        if (!this.isOptimizationEnabled()) return true;
        if (!this.isPlatformOptimizationEnabled(platform)) return true;
        if (!this.hasEnoughData(platform)) return true;

        const confidenceLevel = this.getConfidenceLevel(platform);
        return confidenceLevel === 'none' || confidenceLevel === 'low';
    }

    /**
     * Reset daily counts if past midnight
     */
    private maybeResetDailyCounts(): void {
        const now = Date.now();
        const today = new Date().toDateString();
        const lastResetDay = new Date(this.lastCountReset).toDateString();

        if (today !== lastResetDay) {
            this.dailyPostCounts.clear();
            this.lastCountReset = now;
            this.saveState();
        }
    }

    /**
     * Get daily count key
     */
    private getDailyCountKey(platform: Platform): string {
        return `${platform}_${new Date().toDateString()}`;
    }

    /**
     * Update configuration
     */
    updateConfig(updates: Partial<OptimizationConfig>): void {
        this.config = { ...this.config, ...updates };
        analyticsStore.saveConfig(this.config);
    }

    /**
     * Get current configuration
     */
    getConfig(): OptimizationConfig {
        return { ...this.config };
    }

    /**
     * Reset to defaults
     */
    resetToDefaults(): void {
        this.config = { ...DEFAULT_OPTIMIZATION_CONFIG };
        analyticsStore.saveConfig(this.config);
        this.retryCounts.clear();
        this.dailyPostCounts.clear();
        this.saveState();
    }

    /**
     * Save state to localStorage
     */
    private saveState(): void {
        try {
            localStorage.setItem('screndly_guardrails_state', JSON.stringify({
                retryCounts: Array.from(this.retryCounts.entries()),
                dailyPostCounts: Array.from(this.dailyPostCounts.entries()),
                lastCountReset: this.lastCountReset,
            }));
        } catch (_e) {
            // Ignore
        }
    }

    /**
     * Load state from localStorage
     */
    private loadState(): void {
        try {
            const stored = localStorage.getItem('screndly_guardrails_state');
            if (stored) {
                const state = JSON.parse(stored);
                this.retryCounts = new Map(state.retryCounts || []);
                this.dailyPostCounts = new Map(state.dailyPostCounts || []);
                this.lastCountReset = state.lastCountReset || Date.now();
            }
        } catch (_e) {
            // Use defaults
        }
    }

    /**
     * Get status summary
     */
    getStatus(): {
        enabled: boolean;
        platforms: Record<Platform, boolean>;
        confidenceLevels: Record<Platform, string>;
        dailyUsage: Record<Platform, { used: number; limit: number }>;
        retryQueueSize: number;
    } {
        const platforms: Record<Platform, boolean> = {} as any;
        const confidenceLevels: Record<Platform, string> = {} as any;
        const dailyUsage: Record<Platform, { used: number; limit: number }> = {} as any;

        const allPlatforms: Platform[] = ['x', 'facebook', 'instagram', 'threads', 'tiktok', 'youtube', 'pinterest'];

        allPlatforms.forEach(platform => {
            platforms[platform] = this.isPlatformOptimizationEnabled(platform);
            confidenceLevels[platform] = this.getConfidenceLevel(platform);

            const key = this.getDailyCountKey(platform);
            dailyUsage[platform] = {
                used: this.dailyPostCounts.get(key) || 0,
                limit: PLATFORM_RATE_LIMITS[platform],
            };
        });

        return {
            enabled: this.isOptimizationEnabled(),
            platforms,
            confidenceLevels,
            dailyUsage,
            retryQueueSize: this.retryCounts.size,
        };
    }
}

// Export singleton
export const optimizationGuardrails = new OptimizationGuardrails();
