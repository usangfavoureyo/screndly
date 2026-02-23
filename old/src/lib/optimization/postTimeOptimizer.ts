/**
 * Post Time Optimizer
 * 
 * Calculates and recommends optimal posting times based on historical performance.
 * Can shift auto-post timing within allowed windows.
 * All logic is internal - no UI exposure.
 */

import { analyticsStore } from './analyticsStore';
import { signalEngine } from './signalEngine';
import { Platform, OptimizationDecision } from './types';

/**
 * Post Time Optimizer Class
 */
class PostTimeOptimizer {
    private config = analyticsStore.getConfig();

    /**
     * Get optimal posting time for a platform
     * Returns a Date object for the recommended post time
     */
    getOptimalPostTime(
        platform: Platform,
        earliestTime: Date = new Date(),
        latestTime?: Date
    ): Date {
        if (!this.config.enabled || !this.config.postTimeOptimization) {
            return earliestTime;
        }

        // Check for exploration mode
        if (signalEngine.shouldExplore()) {
            this.logDecision({
                type: 'timing',
                decision: `Using earliest time (exploration mode)`,
                reasoning: 'Random exploration to gather diverse data',
                confidence: 0,
                isExploration: true,
                timestamp: Date.now(),
            });
            return earliestTime;
        }

        const signals = analyticsStore.getSignals();
        if (!signals || signals.platforms[platform].confidence < this.config.confidenceThreshold) {
            return earliestTime;
        }

        const platformSignals = signals.platforms[platform];
        const optimalHour = this.findBestHourInRange(
            platformSignals.optimalHours,
            earliestTime,
            latestTime
        );

        // Create optimal date
        const optimal = new Date(earliestTime);
        optimal.setHours(optimalHour, 0, 0, 0);

        // If optimal is before earliest, try next day
        if (optimal < earliestTime) {
            optimal.setDate(optimal.getDate() + 1);
        }

        // If optimal is after latest, use latest
        if (latestTime && optimal > latestTime) {
            return this.findClosestToOptimalInRange(optimalHour, earliestTime, latestTime);
        }

        this.logDecision({
            type: 'timing',
            decision: `Optimal time: ${optimal.toLocaleTimeString()}`,
            reasoning: `Hour ${optimalHour} has score ${platformSignals.optimalHours[optimalHour]}`,
            confidence: platformSignals.confidence,
            isExploration: false,
            timestamp: Date.now(),
        });

        return optimal;
    }

    /**
     * Find best hour within a time range
     */
    private findBestHourInRange(
        hourScores: Record<number, number>,
        earliest: Date,
        latest?: Date
    ): number {
        const earliestHour = earliest.getHours();
        const latestHour = latest ? latest.getHours() : 23;

        // If same day, only consider hours in range
        const sameDay = !latest ||
            (earliest.toDateString() === latest.toDateString());

        let bestHour = earliestHour;
        let bestScore = 0;

        for (let h = 0; h < 24; h++) {
            // Check if hour is in valid range
            if (sameDay) {
                if (h < earliestHour || h > latestHour) continue;
            }

            if (hourScores[h] > bestScore) {
                bestScore = hourScores[h];
                bestHour = h;
            }
        }

        return bestHour;
    }

    /**
     * Find time closest to optimal hour within range
     */
    private findClosestToOptimalInRange(
        optimalHour: number,
        earliest: Date,
        latest: Date
    ): Date {
        const result = new Date(earliest);

        // Try the optimal hour
        result.setHours(optimalHour, 0, 0, 0);

        if (result >= earliest && result <= latest) {
            return result;
        }

        // Try next day's optimal hour
        result.setDate(result.getDate() + 1);
        if (result >= earliest && result <= latest) {
            return result;
        }

        // Fall back to latest allowed time
        return latest;
    }

    /**
     * Should shift post time for auto-posts?
     */
    shouldShiftTime(
        platform: Platform,
        scheduledTime: Date,
        allowedWindow: { earliest: Date; latest: Date }
    ): { shift: boolean; newTime: Date } {
        if (!this.config.enabled || !this.config.postTimeOptimization) {
            return { shift: false, newTime: scheduledTime };
        }

        const signals = analyticsStore.getSignals();
        if (!signals || signals.platforms[platform].confidence < this.config.confidenceThreshold) {
            return { shift: false, newTime: scheduledTime };
        }

        const optimalTime = this.getOptimalPostTime(
            platform,
            allowedWindow.earliest,
            allowedWindow.latest
        );

        // Calculate shift in minutes
        const shiftMinutes = Math.abs(optimalTime.getTime() - scheduledTime.getTime()) / 60000;

        // Only shift if within allowed range and meaningful
        if (shiftMinutes <= this.config.maxTimeShiftMinutes && shiftMinutes >= 30) {
            return { shift: true, newTime: optimalTime };
        }

        return { shift: false, newTime: scheduledTime };
    }

    /**
     * Get posting time heatmap for a platform (for internal analysis)
     */
    getHeatmap(platform: Platform): {
        hours: Record<number, number>;
        days: Record<number, number>;
        confidence: number;
    } {
        const signals = analyticsStore.getSignals();

        if (!signals) {
            return {
                hours: Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i, 50])),
                days: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, 50])),
                confidence: 0,
            };
        }

        const platformSignals = signals.platforms[platform];
        return {
            hours: { ...platformSignals.optimalHours },
            days: { ...platformSignals.optimalDays },
            confidence: platformSignals.confidence,
        };
    }

    /**
     * Get recommended posting windows for a platform
     */
    getRecommendedWindows(platform: Platform): Array<{ start: number; end: number; score: number }> {
        const signals = analyticsStore.getSignals();
        if (!signals) return [];

        const hourScores = signals.platforms[platform].optimalHours;
        const windows: Array<{ start: number; end: number; score: number }> = [];

        // Find contiguous high-performing windows
        let windowStart: number | null = null;
        let windowScore = 0;
        let windowCount = 0;

        for (let h = 0; h < 24; h++) {
            const score = hourScores[h];

            if (score >= 60) { // Above average
                if (windowStart === null) {
                    windowStart = h;
                }
                windowScore += score;
                windowCount += 1;
            } else if (windowStart !== null) {
                // End of window
                windows.push({
                    start: windowStart,
                    end: h - 1,
                    score: Math.round(windowScore / windowCount),
                });
                windowStart = null;
                windowScore = 0;
                windowCount = 0;
            }
        }

        // Handle window that extends past midnight
        if (windowStart !== null) {
            windows.push({
                start: windowStart,
                end: 23,
                score: Math.round(windowScore / windowCount),
            });
        }

        return windows.sort((a, b) => b.score - a.score);
    }

    /**
     * Log optimization decision
     */
    private logDecision(decision: OptimizationDecision): void {
        if (this.config.verbose || this.config.dryRun) {
            console.log(`[PostTimeOptimizer] ${decision.type}: ${decision.decision} (${decision.reasoning})`);
        }
        analyticsStore.logDecision(decision);
    }
}

// Export singleton
export const postTimeOptimizer = new PostTimeOptimizer();
