/**
 * Retry Engine
 * 
 * Handles re-captioning and re-posting of underperforming content.
 * Uses performance signals to identify candidates for retry.
 * All logic is internal - no UI exposure.
 */

import { analyticsStore } from './analyticsStore';
import { signalEngine } from './signalEngine';
import { optimizationGuardrails } from './optimizationGuardrails';
import { captionOptimizer } from './captionOptimizer';
import {
    Platform,
    ContentSource,
    RetryCandidate,
    PostAnalyticsRecord,
    OptimizationDecision,
} from './types';

// Thresholds for retry candidates
const LOW_VELOCITY_THRESHOLD = 30; // Score below this after 24h = low velocity
const HIGH_POTENTIAL_THRESHOLD = 50; // Content type avg is above this = high potential
const MIN_AGE_HOURS = 24; // Wait at least 24h before retrying
const MAX_AGE_DAYS = 7; // Don't retry posts older than 7 days

/**
 * Retry Engine Class
 */
class RetryEngine {
    private config = analyticsStore.getConfig();

    /**
     * Identify candidates for retry
     */
    identifyCandidates(): RetryCandidate[] {
        if (!this.config.enabled || !this.config.retrySystem) {
            return [];
        }

        const candidates: RetryCandidate[] = [];
        const records = analyticsStore.getRecentRecords();

        for (const record of records) {
            // Skip if already a retry
            if (record.isRetry) continue;

            // Skip if already at max retries
            if (!optimizationGuardrails.canRetry(record.postId)) continue;

            // Check if candidate for retry
            const candidateReason = this.evaluateForRetry(record);
            if (candidateReason) {
                const candidate = this.createRetryCandidate(record, candidateReason);
                if (candidate) {
                    candidates.push(candidate);
                }
            }
        }

        // Sort by potential impact
        candidates.sort((a, b) => {
            // Prioritize high potential over low velocity
            if (a.reason === 'high_potential' && b.reason !== 'high_potential') return -1;
            if (b.reason === 'high_potential' && a.reason !== 'high_potential') return 1;
            return 0;
        });

        // Limit to reasonable number
        return candidates.slice(0, 5);
    }

    /**
     * Evaluate if a record should be retried
     */
    private evaluateForRetry(
        record: PostAnalyticsRecord
    ): 'low_early_velocity' | 'high_potential' | null {
        const ageHours = (Date.now() - record.postedAt) / (1000 * 60 * 60);
        const ageDays = ageHours / 24;

        // Too new or too old
        if (ageHours < MIN_AGE_HOURS || ageDays > MAX_AGE_DAYS) {
            return null;
        }

        // Need a score to evaluate
        if (record.scores.overallScore === undefined) {
            return null;
        }

        // Low early velocity: low score but from high-performing source
        if (record.scores.overallScore < LOW_VELOCITY_THRESHOLD) {
            const signals = analyticsStore.getSignals();
            if (signals) {
                const sourceSignals = signals.sources[record.contentSource];
                if (sourceSignals && sourceSignals.avgScore >= HIGH_POTENTIAL_THRESHOLD) {
                    return 'low_early_velocity';
                }
            }
        }

        // High potential: good source, but this post underperformed significantly
        const signals = analyticsStore.getSignals();
        if (signals) {
            const sourceSignals = signals.sources[record.contentSource];
            if (sourceSignals && sourceSignals.avgScore >= HIGH_POTENTIAL_THRESHOLD) {
                const underperformanceGap = sourceSignals.avgScore - record.scores.overallScore;
                if (underperformanceGap > 30) {
                    return 'high_potential';
                }
            }
        }

        return null;
    }

    /**
     * Create a retry candidate from a record
     */
    private createRetryCandidate(
        record: PostAnalyticsRecord,
        reason: 'low_early_velocity' | 'high_potential'
    ): RetryCandidate | null {
        // Get optimization hints for new caption
        const hints = captionOptimizer.getOptimizationHints(
            record.platform,
            record.contentSource
        );

        // Suggest caption changes
        const suggestedChanges: string[] = [];

        if (hints.additionalInstructions) {
            suggestedChanges.push(hints.additionalInstructions);
        }

        if (hints.keywordGuidance.length > 0) {
            suggestedChanges.push(`Try keywords: ${hints.keywordGuidance.slice(0, 3).join(', ')}`);
        }

        if (hints.avoidPatterns.length > 0) {
            const usedBadPatterns = record.keywords.filter(k =>
                hints.avoidPatterns.some(p => k.toLowerCase().includes(p.toLowerCase()))
            );
            if (usedBadPatterns.length > 0) {
                suggestedChanges.push(`Remove underperforming patterns: ${usedBadPatterns.join(', ')}`);
            }
        }

        // Calculate suggested retry time
        const optimalHour = signalEngine.getOptimalHour(record.platform);
        const now = new Date();
        const suggestedTime = new Date(now);
        suggestedTime.setHours(optimalHour, 0, 0, 0);

        // If optimal hour has passed today, try tomorrow
        if (suggestedTime < now) {
            suggestedTime.setDate(suggestedTime.getDate() + 1);
        }

        return {
            originalPostId: record.postId,
            platform: record.platform,
            contentSource: record.contentSource,
            title: record.captionHash, // We don't store title, use hash as identifier
            originalCaption: '', // Caption not stored in analytics record
            mediaUrl: undefined, // Would need to retrieve from original source
            reason,
            suggestedTime: suggestedTime.getTime(),
            suggestedCaptionChanges: suggestedChanges,
            retryAttempts: record.retryCount,
            maxRetries: this.config.maxRetries,
            createdAt: Date.now(),
        };
    }

    /**
     * Execute a retry for a candidate
     * Returns instructions for the autopost engine
     */
    prepareRetry(
        candidate: RetryCandidate
    ): {
        shouldRetry: boolean;
        platform: Platform;
        scheduledTime: Date;
        captionInstructions: string;
    } | null {
        // Final check on guardrails
        if (!optimizationGuardrails.canRetry(candidate.originalPostId)) {
            this.log(`Cannot retry ${candidate.originalPostId}: max retries reached`);
            return null;
        }

        if (!optimizationGuardrails.canPostToPlatform(candidate.platform)) {
            this.log(`Cannot retry ${candidate.originalPostId}: platform quota exhausted`);
            return null;
        }

        // Record the retry attempt
        optimizationGuardrails.recordRetry(candidate.originalPostId);

        // Build caption instructions
        const instructions = candidate.suggestedCaptionChanges.join('\n');

        this.logDecision({
            type: 'retry',
            decision: `Retry ${candidate.originalPostId} to ${candidate.platform}`,
            reasoning: `Reason: ${candidate.reason}, Changes: ${candidate.suggestedCaptionChanges.length}`,
            confidence: 70,
            isExploration: false,
            timestamp: Date.now(),
            postId: candidate.originalPostId,
        });

        return {
            shouldRetry: true,
            platform: candidate.platform,
            scheduledTime: new Date(candidate.suggestedTime),
            captionInstructions: instructions,
        };
    }

    /**
     * Record a retry post was made
     */
    recordRetryPosted(
        originalPostId: string,
        newPostId: string,
        platform: Platform,
        contentSource: ContentSource
    ): void {
        // Get original record
        const originalRecord = analyticsStore.getRecordByPostId(originalPostId, platform);

        if (!originalRecord) {
            this.log(`Cannot find original record for ${originalPostId}`);
            return;
        }

        // Update original record
        originalRecord.retryCount += 1;
        analyticsStore.saveRecord(originalRecord);

        // Create new record for the retry
        const now = new Date();
        const newRecord: PostAnalyticsRecord = {
            id: `${platform}_${newPostId}_${Date.now()}`,
            postId: newPostId,
            platform,
            contentSource,
            postedAt: Date.now(),
            captionHash: '', // Will be updated when caption is generated
            captionModel: originalRecord.captionModel,
            captionTone: originalRecord.captionTone,
            keywords: [],
            captionLength: 0,
            mediaType: originalRecord.mediaType,
            tmdbId: originalRecord.tmdbId,
            feedType: originalRecord.feedType,
            postHour: now.getHours(),
            postDayOfWeek: now.getDay(),
            metrics: {},
            scores: {},
            lastMetricsUpdate: 0,
            metricsUpdateCount: 0,
            isRetry: true,
            originalPostId,
            retryCount: 0,
        };

        analyticsStore.saveRecord(newRecord);

        // Remove from retry candidates
        analyticsStore.removeRetryCandidate(originalPostId);

        this.log(`Recorded retry post: ${newPostId} (original: ${originalPostId})`);
    }

    /**
     * Get pending retry candidates
     */
    getPendingCandidates(): RetryCandidate[] {
        return analyticsStore.getRetryCandidates();
    }

    /**
     * Queue a retry candidate
     */
    queueCandidate(candidate: RetryCandidate): void {
        analyticsStore.addRetryCandidate(candidate);
        this.log(`Queued retry candidate: ${candidate.originalPostId}`);
    }

    /**
     * Remove a retry candidate
     */
    removeCandidate(originalPostId: string): void {
        analyticsStore.removeRetryCandidate(originalPostId);
        this.log(`Removed retry candidate: ${originalPostId}`);
    }

    /**
     * Get retry statistics
     */
    getStats(): {
        pendingCount: number;
        candidates: RetryCandidate[];
        retrySuccessRate: number;
    } {
        const candidates = this.getPendingCandidates();

        // Calculate success rate of past retries
        const retries = analyticsStore.getRecentRecords().filter(r => r.isRetry);
        const successfulRetries = retries.filter(r =>
            r.scores.overallScore !== undefined && r.scores.overallScore >= 50
        );

        const successRate = retries.length > 0
            ? Math.round((successfulRetries.length / retries.length) * 100)
            : 0;

        return {
            pendingCount: candidates.length,
            candidates,
            retrySuccessRate: successRate,
        };
    }

    /**
     * Log optimization decision
     */
    private logDecision(decision: OptimizationDecision): void {
        if (this.config.verbose || this.config.dryRun) {
            console.log(`[RetryEngine] ${decision.type}: ${decision.decision} (${decision.reasoning})`);
        }
        analyticsStore.logDecision(decision);
    }

    /**
     * Logging helper
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[RetryEngine] ${message}`);
        }
    }
}

// Export singleton
export const retryEngine = new RetryEngine();
