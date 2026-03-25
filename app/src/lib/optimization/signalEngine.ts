/**
 * Signal Engine
 * 
 * Converts raw analytics metrics into actionable performance signals.
 * Calculates optimal posting times, caption effectiveness, and model performance.
 * All processing is internal - no UI exposure.
 */

import { analyticsStore } from './analyticsStore';
import {
    PostAnalyticsRecord,
    PerformanceSignals,
    PlatformSignals,
    CaptionSignals,
    SourceSignals,
    ModelSignals,
    Platform,
    ContentSource,
    CaptionModel,
} from './types';
import { DEFAULT_MODELS } from '../ai/models';

// Platforms to analyze
const ALL_PLATFORMS: Platform[] = ['x', 'facebook', 'instagram', 'threads', 'tiktok', 'youtube', 'pinterest'];

// Content sources
const ALL_SOURCES: ContentSource[] = ['rss', 'tmdb_today', 'tmdb_weekly', 'tmdb_monthly', 'tmdb_anniversary', 'youtube', 'design_studio', 'video_studio', 'manual'];

// Caption models
const ALL_MODELS: CaptionModel[] = ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'flash-3', 'gpt-5.2', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano'];

/**
 * Signal Engine Class
 */
class SignalEngine {
    private config = analyticsStore.getConfig();

    /**
     * Calculate all performance signals from recent records
     */
    calculateSignals(): PerformanceSignals {
        const records = analyticsStore.getRecentRecords();
        this.log(`Calculating signals from ${records.length} records`);

        // First, calculate scores for all records
        records.forEach(record => {
            this.calculateRecordScores(record);
        });

        const signals: PerformanceSignals = {
            platforms: {} as Record<Platform, PlatformSignals>,
            caption: this.calculateCaptionSignals(records),
            sources: {} as Record<ContentSource, SourceSignals>,
            models: {} as Record<CaptionModel, ModelSignals>,
            lastCalculated: Date.now(),
        };

        // Calculate platform signals
        ALL_PLATFORMS.forEach(platform => {
            signals.platforms[platform] = this.calculatePlatformSignals(platform, records);
        });

        // Calculate source signals
        ALL_SOURCES.forEach(source => {
            signals.sources[source] = this.calculateSourceSignals(source, records);
        });

        // Calculate model signals
        ALL_MODELS.forEach(model => {
            signals.models[model] = this.calculateModelSignals(model, records);
        });

        // Save signals
        analyticsStore.saveSignals(signals);
        this.log('Signals calculated and saved');

        return signals;
    }

    /**
     * Calculate derived scores for a record
     */
    private calculateRecordScores(record: PostAnalyticsRecord): void {
        const { metrics, scores } = record;

        // Engagement rate
        if (metrics.impressions && metrics.impressions > 0) {
            scores.engagementRate = (metrics.engagements || 0) / metrics.impressions;
            scores.clickThroughRate = (metrics.clicks || 0) / metrics.impressions;
        }

        // Virality score (shares vs total engagement)
        if (metrics.engagements && metrics.engagements > 0) {
            scores.viralityScore = (metrics.shares || 0) / metrics.engagements;
        }

        // Overall score (normalized 0-100)
        scores.overallScore = this.calculateOverallScore(record);

        // Update in store
        analyticsStore.saveRecord(record);
    }

    /**
     * Calculate overall performance score (0-100)
     */
    private calculateOverallScore(record: PostAnalyticsRecord): number {
        const { metrics } = record;

        // Weight different metrics
        const weights = {
            engagementRate: 0.3,
            ctr: 0.2,
            virality: 0.15,
            absoluteEngagements: 0.2,
            videoRetention: 0.15,
        };

        let score = 0;
        let weightSum = 0;

        // Engagement rate (normalized: 0.05 = 50 points)
        if (metrics.impressions && metrics.impressions > 0) {
            const engagementRate = (metrics.engagements || 0) / metrics.impressions;
            score += Math.min(engagementRate / 0.1, 1) * 100 * weights.engagementRate;
            weightSum += weights.engagementRate;
        }

        // CTR (normalized: 0.02 = 50 points)
        if (metrics.impressions && metrics.impressions > 0 && metrics.clicks) {
            const ctr = metrics.clicks / metrics.impressions;
            score += Math.min(ctr / 0.04, 1) * 100 * weights.ctr;
            weightSum += weights.ctr;
        }

        // Virality (normalized: 0.1 = 50 points)
        if (metrics.engagements && metrics.engagements > 0 && metrics.shares) {
            const virality = metrics.shares / metrics.engagements;
            score += Math.min(virality / 0.2, 1) * 100 * weights.virality;
            weightSum += weights.virality;
        }

        // Absolute engagements (log scale)
        if (metrics.engagements && metrics.engagements > 0) {
            // 100 engagements = 50 points, 1000 = 100 points
            const logScore = Math.log10(metrics.engagements) / 3;
            score += Math.min(logScore, 1) * 100 * weights.absoluteEngagements;
            weightSum += weights.absoluteEngagements;
        }

        // Video retention
        if (metrics.videoRetention) {
            score += metrics.videoRetention * weights.videoRetention;
            weightSum += weights.videoRetention;
        }

        return weightSum > 0 ? Math.round(score / weightSum) : 0;
    }

    /**
     * Calculate platform-specific signals
     */
    private calculatePlatformSignals(platform: Platform, allRecords: PostAnalyticsRecord[]): PlatformSignals {
        const records = allRecords.filter(r => r.platform === platform);
        const dataPoints = records.length;

        if (dataPoints === 0) {
            return this.getDefaultPlatformSignals();
        }

        // Calculate optimal hours
        const hourScores: Record<number, { total: number; count: number }> = {};
        for (let h = 0; h < 24; h++) {
            hourScores[h] = { total: 0, count: 0 };
        }

        records.forEach(r => {
            if (r.scores.overallScore !== undefined) {
                hourScores[r.postHour].total += r.scores.overallScore;
                hourScores[r.postHour].count += 1;
            }
        });

        const optimalHours: Record<number, number> = {};
        for (let h = 0; h < 24; h++) {
            optimalHours[h] = hourScores[h].count > 0
                ? Math.round(hourScores[h].total / hourScores[h].count)
                : 50; // Default to neutral
        }

        // Calculate optimal days
        const dayScores: Record<number, { total: number; count: number }> = {};
        for (let d = 0; d < 7; d++) {
            dayScores[d] = { total: 0, count: 0 };
        }

        records.forEach(r => {
            if (r.scores.overallScore !== undefined) {
                dayScores[r.postDayOfWeek].total += r.scores.overallScore;
                dayScores[r.postDayOfWeek].count += 1;
            }
        });

        const optimalDays: Record<number, number> = {};
        for (let d = 0; d < 7; d++) {
            optimalDays[d] = dayScores[d].count > 0
                ? Math.round(dayScores[d].total / dayScores[d].count)
                : 50;
        }

        // Average engagement rate
        const engagementRates = records
            .filter(r => r.scores.engagementRate !== undefined)
            .map(r => r.scores.engagementRate!);
        const avgEngagementRate = engagementRates.length > 0
            ? engagementRates.reduce((a, b) => a + b, 0) / engagementRates.length
            : 0;

        // Top sources for this platform
        const sourceScores: Record<ContentSource, { total: number; count: number }> = {} as any;
        ALL_SOURCES.forEach(s => {
            sourceScores[s] = { total: 0, count: 0 };
        });

        records.forEach(r => {
            if (r.scores.overallScore !== undefined) {
                sourceScores[r.contentSource].total += r.scores.overallScore;
                sourceScores[r.contentSource].count += 1;
            }
        });

        const topSources = Object.entries(sourceScores)
            .filter(([_, v]) => v.count > 0)
            .map(([source, v]) => ({
                source: source as ContentSource,
                avgScore: v.total / v.count,
            }))
            .sort((a, b) => b.avgScore - a.avgScore)
            .slice(0, 3)
            .map(s => s.source);

        // Confidence based on data points
        const confidence = Math.min(dataPoints * 10, 100);

        return {
            optimalHours,
            optimalDays,
            avgEngagementRate,
            topSources,
            confidence,
            dataPoints,
        };
    }

    /**
     * Get default platform signals
     */
    private getDefaultPlatformSignals(): PlatformSignals {
        const optimalHours: Record<number, number> = {};
        const optimalDays: Record<number, number> = {};

        for (let h = 0; h < 24; h++) optimalHours[h] = 50;
        for (let d = 0; d < 7; d++) optimalDays[d] = 50;

        return {
            optimalHours,
            optimalDays,
            avgEngagementRate: 0,
            topSources: [],
            confidence: 0,
            dataPoints: 0,
        };
    }

    /**
     * Calculate caption-related signals
     */
    private calculateCaptionSignals(records: PostAnalyticsRecord[]): CaptionSignals {
        // Optimal caption length per platform
        const optimalLength: Record<Platform, number> = {} as any;

        ALL_PLATFORMS.forEach(platform => {
            const platformRecords = records.filter(r => r.platform === platform);
            if (platformRecords.length === 0) {
                optimalLength[platform] = 280; // Default
                return;
            }

            // Find average length of top-performing posts
            const sorted = [...platformRecords]
                .filter(r => r.scores.overallScore !== undefined)
                .sort((a, b) => (b.scores.overallScore || 0) - (a.scores.overallScore || 0));

            const topPosts = sorted.slice(0, Math.ceil(sorted.length * 0.3));
            if (topPosts.length > 0) {
                optimalLength[platform] = Math.round(
                    topPosts.reduce((sum, r) => sum + r.captionLength, 0) / topPosts.length
                );
            } else {
                optimalLength[platform] = 280;
            }
        });

        // Top keywords
        const keywordScores: Record<string, { total: number; count: number; platform: Platform }> = {};

        records.forEach(r => {
            if (r.scores.overallScore === undefined) return;
            r.keywords.forEach(keyword => {
                const key = `${keyword}__${r.platform}`;
                if (!keywordScores[key]) {
                    keywordScores[key] = { total: 0, count: 0, platform: r.platform };
                }
                keywordScores[key].total += r.scores.overallScore;
                keywordScores[key].count += 1;
            });
        });

        const topKeywords = Object.entries(keywordScores)
            .filter(([_, v]) => v.count >= 3) // Minimum 3 uses
            .map(([key, v]) => ({
                keyword: key.split('__')[0],
                score: Math.round(v.total / v.count),
                platform: v.platform,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 50);

        // Identify low-performing patterns to avoid
        const lowPerformers = records
            .filter(r => (r.scores.overallScore || 0) < 30)
            .flatMap(r => r.keywords);

        const avoidPatterns = [...new Set(lowPerformers)]
            .filter(k => lowPerformers.filter(lp => lp === k).length >= 3)
            .slice(0, 10);

        // Optimal tone per platform
        const toneScores: Record<Platform, Record<string, { total: number; count: number }>> = {} as any;
        ALL_PLATFORMS.forEach(p => { toneScores[p] = {}; });

        records.forEach(r => {
            if (!r.captionTone || r.scores.overallScore === undefined) return;
            if (!toneScores[r.platform][r.captionTone]) {
                toneScores[r.platform][r.captionTone] = { total: 0, count: 0 };
            }
            toneScores[r.platform][r.captionTone].total += r.scores.overallScore;
            toneScores[r.platform][r.captionTone].count += 1;
        });

        const optimalTone: Record<Platform, string> = {} as any;
        ALL_PLATFORMS.forEach(platform => {
            const tones = toneScores[platform];
            const best = Object.entries(tones)
                .filter(([_, v]) => v.count >= 2)
                .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))[0];
            optimalTone[platform] = best ? best[0] : 'Engaging';
        });

        // Hashtag weight per platform (currently set to low for all - semantic over hashtags)
        const hashtagWeight: Record<Platform, number> = {
            x: 0.2,
            facebook: 0.3,
            instagram: 0.5, // Instagram still benefits from hashtags
            threads: 0.1,
            tiktok: 0.4,
            youtube: 0.3,
            pinterest: 0.4,
        };

        return {
            optimalLength,
            topKeywords,
            avoidPatterns,
            optimalTone,
            hashtagWeight,
        };
    }

    /**
     * Calculate source-specific signals
     */
    private calculateSourceSignals(source: ContentSource, allRecords: PostAnalyticsRecord[]): SourceSignals {
        const records = allRecords.filter(r => r.contentSource === source);
        const recentCount = records.length;

        if (recentCount === 0) {
            return {
                avgScore: 50,
                trend: 'stable',
                topPlatforms: [],
                recentCount: 0,
                confidence: 0,
            };
        }

        // Average score
        const scores = records
            .filter(r => r.scores.overallScore !== undefined)
            .map(r => r.scores.overallScore!);
        const avgScore = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 50;

        // Trend (compare recent half vs older half)
        const sorted = [...records].sort((a, b) => a.postedAt - b.postedAt);
        const midpoint = Math.floor(sorted.length / 2);
        const olderHalf = sorted.slice(0, midpoint);
        const newerHalf = sorted.slice(midpoint);

        const olderAvg = olderHalf.length > 0
            ? olderHalf.filter(r => r.scores.overallScore !== undefined)
                .reduce((sum, r) => sum + r.scores.overallScore!, 0) / olderHalf.length
            : 50;
        const newerAvg = newerHalf.length > 0
            ? newerHalf.filter(r => r.scores.overallScore !== undefined)
                .reduce((sum, r) => sum + r.scores.overallScore!, 0) / newerHalf.length
            : 50;

        let trend: 'improving' | 'stable' | 'declining' = 'stable';
        if (newerAvg - olderAvg > 10) trend = 'improving';
        else if (olderAvg - newerAvg > 10) trend = 'declining';

        // Top platforms for this source
        const platformScores: Record<Platform, { total: number; count: number }> = {} as any;
        ALL_PLATFORMS.forEach(p => { platformScores[p] = { total: 0, count: 0 }; });

        records.forEach(r => {
            if (r.scores.overallScore !== undefined) {
                platformScores[r.platform].total += r.scores.overallScore;
                platformScores[r.platform].count += 1;
            }
        });

        const topPlatforms = Object.entries(platformScores)
            .filter(([_, v]) => v.count > 0)
            .map(([platform, v]) => ({
                platform: platform as Platform,
                avgScore: v.total / v.count,
            }))
            .sort((a, b) => b.avgScore - a.avgScore)
            .slice(0, 3)
            .map(p => p.platform);

        const confidence = Math.min(recentCount * 10, 100);

        return {
            avgScore,
            trend,
            topPlatforms,
            recentCount,
            confidence,
        };
    }

    /**
     * Calculate model-specific signals
     */
    private calculateModelSignals(model: CaptionModel, allRecords: PostAnalyticsRecord[]): ModelSignals {
        const records = allRecords.filter(r => r.captionModel === model);
        const usageCount = records.length;

        if (usageCount === 0) {
            return {
                avgEffectiveness: 50,
                bestFor: [],
                qualityScore: 50,
                usageCount: 0,
            };
        }

        // Average effectiveness
        const scores = records
            .filter(r => r.scores.overallScore !== undefined)
            .map(r => r.scores.overallScore!);
        const avgEffectiveness = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 50;

        // Best content sources for this model
        const sourceScores: Record<ContentSource, { total: number; count: number }> = {} as any;
        ALL_SOURCES.forEach(s => { sourceScores[s] = { total: 0, count: 0 }; });

        records.forEach(r => {
            if (r.scores.overallScore !== undefined) {
                sourceScores[r.contentSource].total += r.scores.overallScore;
                sourceScores[r.contentSource].count += 1;
            }
        });

        const bestFor = Object.entries(sourceScores)
            .filter(([_, v]) => v.count >= 3)
            .map(([source, v]) => ({
                source: source as ContentSource,
                avgScore: v.total / v.count,
            }))
            .filter(s => s.avgScore >= 60)
            .sort((a, b) => b.avgScore - a.avgScore)
            .slice(0, 3)
            .map(s => s.source);

        // Quality score (based on consistency)
        const variance = scores.length > 1
            ? scores.reduce((sum, s) => sum + Math.pow(s - avgEffectiveness, 2), 0) / scores.length
            : 0;
        const qualityScore = Math.round(avgEffectiveness - Math.sqrt(variance) * 0.5);

        return {
            avgEffectiveness,
            bestFor,
            qualityScore: Math.max(0, Math.min(100, qualityScore)),
            usageCount,
        };
    }

    /**
     * Get optimal posting hour for a platform
     */
    getOptimalHour(platform: Platform): number {
        const signals = analyticsStore.getSignals();
        if (!signals || signals.platforms[platform].confidence < this.config.confidenceThreshold) {
            // Return default optimal hour
            return this.getDefaultOptimalHour(platform);
        }

        const hours = signals.platforms[platform].optimalHours;
        const bestHour = Object.entries(hours)
            .sort((a, b) => b[1] - a[1])[0];

        return parseInt(bestHour[0], 10);
    }

    /**
     * Get default optimal hour per platform
     */
    private getDefaultOptimalHour(platform: Platform): number {
        // Based on general social media best practices
        const defaults: Record<Platform, number> = {
            x: 9,        // Morning
            facebook: 13, // Lunch
            instagram: 11, // Mid-morning
            threads: 10,
            tiktok: 19,   // Evening
            youtube: 15,  // Afternoon
            pinterest: 20, // Evening
        };
        return defaults[platform] || 12;
    }

    /**
     * Get optimal model for content source
     */
    getOptimalModel(source: ContentSource): CaptionModel {
        const signals = analyticsStore.getSignals();
        if (!signals) {
            return DEFAULT_MODELS.comment;
        }

        // Find model where this source is in bestFor
        for (const [model, modelSignals] of Object.entries(signals.models)) {
            if (modelSignals.bestFor.includes(source) && modelSignals.usageCount >= this.config.minDataPoints) {
                return model as CaptionModel;
            }
        }

        // Fallback to highest quality model with enough data
        const sortedModels = Object.entries(signals.models)
            .filter(([_, m]) => m.usageCount >= this.config.minDataPoints)
            .sort((a, b) => b[1].qualityScore - a[1].qualityScore);

        return sortedModels.length > 0
            ? sortedModels[0][0] as CaptionModel
            : DEFAULT_MODELS.comment;
    }

    /**
     * Should explore (random decision) instead of optimize?
     */
    shouldExplore(): boolean {
        return Math.random() < this.config.explorationRate;
    }

    /**
     * Logging helper
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[SignalEngine] ${message}`);
        }
    }
}

// Export singleton
export const signalEngine = new SignalEngine();
