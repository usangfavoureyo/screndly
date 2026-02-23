/**
 * Analytics Store
 * 
 * Centralized storage for post performance metrics.
 * Uses localStorage with automatic cleanup of old data.
 * All data is internal - no UI exposure.
 */

import {
    PostAnalyticsRecord,
    PerformanceSignals,
    OptimizationConfig,
    OptimizationDecision,
    RetryCandidate,
    Platform,
    ContentSource,
    DEFAULT_OPTIMIZATION_CONFIG,
} from './types';

// Storage keys
const STORAGE_KEYS = {
    ANALYTICS_RECORDS: 'screndly_analytics_records',
    PERFORMANCE_SIGNALS: 'screndly_performance_signals',
    OPTIMIZATION_CONFIG: 'screndly_optimization_config',
    OPTIMIZATION_DECISIONS: 'screndly_optimization_decisions',
    RETRY_CANDIDATES: 'screndly_retry_candidates',
    SETTINGS_EVENTS: 'screndly_settings_events',
    LAST_CLEANUP: 'screndly_analytics_last_cleanup',
} as const;

// Maximum records to keep
const MAX_RECORDS = 2000;
const CLEANUP_INTERVAL_HOURS = 24;

/**
 * Analytics Store Class
 */
class AnalyticsStore {
    private config: OptimizationConfig;

    constructor() {
        this.config = this.loadConfig();
        this.maybeCleanup();
    }

    // ===========================================================================
    // CONFIGURATION
    // ===========================================================================

    /**
     * Load optimization config
     */
    loadConfig(): OptimizationConfig {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.OPTIMIZATION_CONFIG);
            if (stored) {
                return { ...DEFAULT_OPTIMIZATION_CONFIG, ...JSON.parse(stored) };
            }
        } catch (_e) {
            // Use defaults
        }
        return { ...DEFAULT_OPTIMIZATION_CONFIG };
    }

    /**
     * Save optimization config
     */
    saveConfig(config: Partial<OptimizationConfig>): void {
        this.config = { ...this.config, ...config };
        try {
            localStorage.setItem(STORAGE_KEYS.OPTIMIZATION_CONFIG, JSON.stringify(this.config));
            this.log('Config saved');
        } catch (_e) {
            console.error('[Optimization] Failed to save config');
        }
    }

    /**
     * Get current config
     */
    getConfig(): OptimizationConfig {
        return { ...this.config };
    }

    // ===========================================================================
    // ANALYTICS RECORDS
    // ===========================================================================

    /**
     * Save a new analytics record
     */
    saveRecord(record: PostAnalyticsRecord): void {
        const records = this.getAllRecords();

        // Check for duplicate
        const existingIndex = records.findIndex(r =>
            r.postId === record.postId && r.platform === record.platform
        );

        if (existingIndex >= 0) {
            // Update existing
            records[existingIndex] = record;
            this.log(`Updated record: ${record.postId}`);
        } else {
            // Add new
            records.push(record);
            this.log(`Added record: ${record.postId}`);
        }

        this.saveRecords(records);
    }

    /**
     * Get all analytics records
     */
    getAllRecords(): PostAnalyticsRecord[] {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.ANALYTICS_RECORDS);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (_e) {
            // Return empty
        }
        return [];
    }

    /**
     * Get records within rolling window
     */
    getRecentRecords(): PostAnalyticsRecord[] {
        const cutoff = Date.now() - (this.config.rollingWindowDays * 24 * 60 * 60 * 1000);
        return this.getAllRecords().filter(r => r.postedAt >= cutoff);
    }

    /**
     * Get records by platform
     */
    getRecordsByPlatform(platform: Platform): PostAnalyticsRecord[] {
        return this.getRecentRecords().filter(r => r.platform === platform);
    }

    /**
     * Get records by content source
     */
    getRecordsBySource(source: ContentSource): PostAnalyticsRecord[] {
        return this.getRecentRecords().filter(r => r.contentSource === source);
    }

    /**
     * Get record by post ID
     */
    getRecordByPostId(postId: string, platform: Platform): PostAnalyticsRecord | null {
        return this.getAllRecords().find(r =>
            r.postId === postId && r.platform === platform
        ) || null;
    }

    /**
     * Update metrics for a record
     */
    updateRecordMetrics(
        postId: string,
        platform: Platform,
        metrics: Partial<PostAnalyticsRecord['metrics']>
    ): void {
        const records = this.getAllRecords();
        const record = records.find(r => r.postId === postId && r.platform === platform);

        if (record) {
            record.metrics = { ...record.metrics, ...metrics };
            record.lastMetricsUpdate = Date.now();
            record.metricsUpdateCount += 1;
            this.saveRecords(records);
            this.log(`Updated metrics for: ${postId}`);
        }
    }

    /**
     * Save records array
     */
    private saveRecords(records: PostAnalyticsRecord[]): void {
        try {
            // Limit records count
            const trimmed = records.slice(-MAX_RECORDS);
            localStorage.setItem(STORAGE_KEYS.ANALYTICS_RECORDS, JSON.stringify(trimmed));
        } catch (_e) {
            console.error('[Optimization] Failed to save records');
        }
    }

    // ===========================================================================
    // PERFORMANCE SIGNALS
    // ===========================================================================

    /**
     * Save performance signals
     */
    saveSignals(signals: PerformanceSignals): void {
        try {
            localStorage.setItem(STORAGE_KEYS.PERFORMANCE_SIGNALS, JSON.stringify(signals));
            this.log('Signals saved');
        } catch (_e) {
            console.error('[Optimization] Failed to save signals');
        }
    }

    /**
     * Get performance signals
     */
    getSignals(): PerformanceSignals | null {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.PERFORMANCE_SIGNALS);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (_e) {
            // Return null
        }
        return null;
    }

    // ===========================================================================
    // OPTIMIZATION DECISIONS (for debugging/analysis)
    // ===========================================================================

    /**
     * Log an optimization decision
     */
    logDecision(decision: OptimizationDecision): void {
        const decisions = this.getDecisions();
        decisions.push(decision);

        // Keep last 500 decisions
        const trimmed = decisions.slice(-500);

        try {
            localStorage.setItem(STORAGE_KEYS.OPTIMIZATION_DECISIONS, JSON.stringify(trimmed));
        } catch (_e) {
            // Ignore
        }
    }

    /**
     * Get logged decisions
     */
    getDecisions(): OptimizationDecision[] {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.OPTIMIZATION_DECISIONS);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (_e) {
            // Return empty
        }
        return [];
    }

    // ===========================================================================
    // RETRY CANDIDATES
    // ===========================================================================

    /**
     * Add retry candidate
     */
    addRetryCandidate(candidate: RetryCandidate): void {
        const candidates = this.getRetryCandidates();

        // Check for existing
        const existingIndex = candidates.findIndex(c =>
            c.originalPostId === candidate.originalPostId
        );

        if (existingIndex >= 0) {
            candidates[existingIndex] = candidate;
        } else {
            candidates.push(candidate);
        }

        try {
            localStorage.setItem(STORAGE_KEYS.RETRY_CANDIDATES, JSON.stringify(candidates));
            this.log(`Added retry candidate: ${candidate.originalPostId}`);
        } catch (_e) {
            // Ignore
        }
    }

    /**
     * Get retry candidates
     */
    getRetryCandidates(): RetryCandidate[] {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.RETRY_CANDIDATES);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (_e) {
            // Return empty
        }
        return [];
    }

    /**
     * Remove retry candidate
     */
    removeRetryCandidate(originalPostId: string): void {
        const candidates = this.getRetryCandidates().filter(
            c => c.originalPostId !== originalPostId
        );

        try {
            localStorage.setItem(STORAGE_KEYS.RETRY_CANDIDATES, JSON.stringify(candidates));
        } catch (_e) {
            // Ignore
        }
    }

    // ===========================================================================
    // SETTINGS LOGGING
    // ===========================================================================

    /**
     * Log a setting change event
     */
    logSettingChange(event: import('./types').SettingChangeEvent): void {
        const events = this.getSettingEvents();
        events.push(event);

        // Keep last 1000 events
        const trimmed = events.slice(-1000);

        try {
            localStorage.setItem(STORAGE_KEYS.SETTINGS_EVENTS, JSON.stringify(trimmed));
            this.log(`Logged setting change: ${event.key}`);
        } catch (_e) {
            // Ignore
        }
    }

    /**
     * Get setting events
     */
    getSettingEvents(): import('./types').SettingChangeEvent[] {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS_EVENTS);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (_e) {
            // Return empty
        }
        return [];
    }

    // ===========================================================================
    // CLEANUP
    // ===========================================================================

    /**
     * Run cleanup if needed
     */
    private maybeCleanup(): void {
        try {
            const lastCleanup = localStorage.getItem(STORAGE_KEYS.LAST_CLEANUP);
            const lastCleanupTime = lastCleanup ? parseInt(lastCleanup, 10) : 0;
            const now = Date.now();

            if (now - lastCleanupTime > CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000) {
                this.cleanup();
                localStorage.setItem(STORAGE_KEYS.LAST_CLEANUP, String(now));
            }
        } catch (_e) {
            // Ignore
        }
    }

    /**
     * Clean up old records
     */
    cleanup(): void {
        const cutoff = Date.now() - (this.config.rollingWindowDays * 24 * 60 * 60 * 1000);
        const records = this.getAllRecords().filter(r => r.postedAt >= cutoff);
        this.saveRecords(records);

        // Clean up old retry candidates
        const retryCandidates = this.getRetryCandidates().filter(
            c => c.createdAt >= cutoff
        );
        try {
            localStorage.setItem(STORAGE_KEYS.RETRY_CANDIDATES, JSON.stringify(retryCandidates));
        } catch (_e) {
            // Ignore
        }

        this.log(`Cleanup complete: ${records.length} records, ${retryCandidates.length} retry candidates`);
    }

    /**
     * Clear all analytics data
     */
    clearAll(): void {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        this.log('All analytics data cleared');
    }

    // ===========================================================================
    // STATS
    // ===========================================================================

    /**
     * Get storage statistics
     */
    getStats(): {
        recordCount: number;
        recentRecordCount: number;
        oldestRecord: number | null;
        newestRecord: number | null;
        signalsAge: number | null;
        decisionCount: number;
        retryCandidateCount: number;
    } {
        const records = this.getAllRecords();
        const recentRecords = this.getRecentRecords();
        const signals = this.getSignals();
        const decisions = this.getDecisions();
        const candidates = this.getRetryCandidates();

        return {
            recordCount: records.length,
            recentRecordCount: recentRecords.length,
            oldestRecord: records.length > 0 ? Math.min(...records.map(r => r.postedAt)) : null,
            newestRecord: records.length > 0 ? Math.max(...records.map(r => r.postedAt)) : null,
            signalsAge: signals ? Date.now() - signals.lastCalculated : null,
            decisionCount: decisions.length,
            retryCandidateCount: candidates.length,
        };
    }

    // ===========================================================================
    // LOGGING
    // ===========================================================================

    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[Optimization] ${message}`);
        }
    }
}

// Export singleton instance
export const analyticsStore = new AnalyticsStore();
