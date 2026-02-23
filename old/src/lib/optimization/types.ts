/**
 * Analytics Optimization Layer - Core Types
 * 
 * Defines interfaces for the self-optimizing analytics system.
 * All types are internal - no UI exposure.
 */

// =============================================================================
// PLATFORM TYPES
// =============================================================================

export type Platform = 'x' | 'facebook' | 'instagram' | 'threads' | 'tiktok' | 'youtube' | 'pinterest';

export type ContentSource = 'rss' | 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary' | 'youtube' | 'design_studio' | 'video_studio' | 'manual';

export type CaptionModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'flash-3';

// =============================================================================
// POST ANALYTICS RECORD
// =============================================================================

export interface PostAnalyticsRecord {
    // Identifiers
    id: string;                      // Unique record ID
    postId: string;                  // Platform-specific post ID
    platform: Platform;
    contentSource: ContentSource;

    // Post metadata
    postedAt: number;                // Timestamp
    captionHash: string;             // Hash of caption for pattern matching
    captionModel: CaptionModel;
    captionTone?: string;            // Tone used (if applicable)
    keywords: string[];              // Keywords/hashtags used
    captionLength: number;

    // Content metadata
    mediaType: 'video' | 'image' | 'text';
    tmdbId?: number;
    feedType?: 'today' | 'weekly' | 'monthly' | 'anniversary';

    // Timing
    postHour: number;                // 0-23
    postDayOfWeek: number;           // 0-6 (Sun-Sat)

    // Raw metrics (populated via analytics ingestion)
    metrics: {
        impressions?: number;
        reach?: number;
        engagements?: number;          // Total: likes + comments + shares
        likes?: number;
        comments?: number;
        shares?: number;
        clicks?: number;               // Link/profile clicks
        saves?: number;
        videoViews?: number;
        videoWatchTime?: number;       // Seconds
        videoRetention?: number;       // Percentage 0-100
    };

    // Derived scores (calculated by signal engine)
    scores: {
        engagementRate?: number;       // engagements / impressions
        clickThroughRate?: number;     // clicks / impressions
        viralityScore?: number;        // shares / engagements
        captionEffectiveness?: number; // Normalized 0-100
        overallScore?: number;         // Composite score 0-100
    };

    // Analytics tracking
    lastMetricsUpdate: number;       // Timestamp
    metricsUpdateCount: number;      // How many times we've pulled metrics

    // Retry tracking
    isRetry: boolean;
    originalPostId?: string;         // If this is a retry, link to original
    retryCount: number;
}

// =============================================================================
// PERFORMANCE SIGNALS
// =============================================================================

export interface PerformanceSignals {
    // Per-platform signals
    platforms: Record<Platform, PlatformSignals>;

    // Caption-related signals
    caption: CaptionSignals;

    // Content source signals
    sources: Record<ContentSource, SourceSignals>;

    // Model performance
    models: Record<CaptionModel, ModelSignals>;

    // Last calculated timestamp
    lastCalculated: number;
}

export interface PlatformSignals {
    // Optimal posting time heatmap (hour -> score)
    optimalHours: Record<number, number>;

    // Day-of-week performance (0-6 -> score)
    optimalDays: Record<number, number>;

    // Average engagement rate (rolling 14 days)
    avgEngagementRate: number;

    // Best performing content sources
    topSources: ContentSource[];

    // Data confidence (0-100)
    confidence: number;
    dataPoints: number;
}

export interface CaptionSignals {
    // Optimal caption length per platform
    optimalLength: Record<Platform, number>;

    // High-performing keywords (sorted by effectiveness)
    topKeywords: Array<{ keyword: string; score: number; platform: Platform }>;

    // Low-performing patterns to avoid
    avoidPatterns: string[];

    // Optimal tone per platform
    optimalTone: Record<Platform, string>;

    // Hashtag vs keyword preference per platform
    hashtagWeight: Record<Platform, number>; // 0-1, 0 = no hashtags, 1 = all hashtags
}

export interface SourceSignals {
    // Average performance score
    avgScore: number;

    // Trend: improving, stable, declining
    trend: 'improving' | 'stable' | 'declining';

    // Best platforms for this source
    topPlatforms: Platform[];

    // Recent post count
    recentCount: number;

    // Confidence level
    confidence: number;
}

export interface ModelSignals {
    // Average caption effectiveness
    avgEffectiveness: number;

    // Best use cases
    bestFor: ContentSource[];

    // Response quality score
    qualityScore: number;

    // Usage count
    usageCount: number;
}

// =============================================================================
// OPTIMIZATION CONFIGURATION
// =============================================================================

export interface OptimizationConfig {
    // Feature flags
    enabled: boolean;
    captionOptimization: boolean;
    postTimeOptimization: boolean;
    modelSelection: boolean;
    retrySystem: boolean;

    // Guardrails
    explorationRate: number;         // 0-1, percentage of posts to not optimize
    minDataPoints: number;           // Minimum data points before using signals
    confidenceThreshold: number;     // Minimum confidence to apply optimization
    maxRetries: number;              // Max retries per piece of content

    // Time windows
    rollingWindowDays: number;       // Days of data to use for signals
    metricsPollingHours: number;     // How often to pull analytics

    // Posting adjustments
    maxTimeShiftMinutes: number;     // Max minutes to shift auto-post timing

    // Logging
    verbose: boolean;
    dryRun: boolean;
}

export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
    enabled: true,
    captionOptimization: true,
    postTimeOptimization: true,
    modelSelection: true,
    retrySystem: true,

    explorationRate: 0.15,           // 15% exploration
    minDataPoints: 10,
    confidenceThreshold: 60,
    maxRetries: 2,

    rollingWindowDays: 30,
    metricsPollingHours: 4,

    maxTimeShiftMinutes: 120,        // ±2 hours

    verbose: false,
    dryRun: false,
};

// =============================================================================
// OPTIMIZATION DECISION
// =============================================================================

export interface OptimizationDecision {
    // What was decided
    type: 'caption' | 'timing' | 'model' | 'retry' | 'suppress';

    // Decision details
    decision: string;

    // Why this decision was made
    reasoning: string;

    // Confidence in this decision
    confidence: number;

    // Was this an exploration (random) decision?
    isExploration: boolean;

    // Timestamp
    timestamp: number;

    // Related post ID
    postId?: string;
}

// =============================================================================
// RETRY CANDIDATE
// =============================================================================

export interface RetryCandidate {
    originalPostId: string;
    platform: Platform;
    contentSource: ContentSource;
    title: string;
    originalCaption: string;
    mediaUrl?: string;

    // Why it's a retry candidate
    reason: 'low_early_velocity' | 'high_potential' | 'trending_topic';

    // Retry parameters
    suggestedTime: number;
    suggestedCaptionChanges: string[];

    // Attempt tracking
    retryAttempts: number;
    maxRetries: number;

    // Created timestamp
    createdAt: number;
}

// =============================================================================
// SETTING CHANGE EVENT
// =============================================================================

export interface SettingChangeEvent {
    type: 'setting_change' | 'optimization_toggle';
    key: string;
    newValue: any;
    previousValue?: any;
    context: string; // e.g., 'VideoSettings', 'Global'
    timestamp: number;
    userId?: string; // Optional if available
}
