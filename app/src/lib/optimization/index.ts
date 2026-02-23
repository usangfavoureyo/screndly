/**
 * Optimization Module Index
 *
 * Exports all optimization layer components.
 * Import from '@/lib/optimization' to access the self-optimization system.
 */

// Core types
export * from './types';

// Analytics storage
export { analyticsStore } from './analyticsStore';

// Signal engine
export { signalEngine } from './signalEngine';

// Caption optimization
export { captionOptimizer, hashCaption, extractKeywords } from './captionOptimizer';

// Post time optimization
export { postTimeOptimizer } from './postTimeOptimizer';

// Analytics ingestion
export { analyticsIngester } from './analyticsIngester';

// Retry system
export { retryEngine } from './retryEngine';

// Safety guardrails
export { optimizationGuardrails } from './optimizationGuardrails';

// Import for initialization functions (use ES imports, not require)
import { analyticsIngester as ingester } from './analyticsIngester';
import { analyticsStore as store } from './analyticsStore';

/**
 * Initialize the optimization layer
 * Call this on app startup to start background tasks
 */
export function initializeOptimization(): void {
    try {
        const config = store.getConfig();

        if (config.enabled) {
            ingester.start();
            console.log('[Optimization] Layer initialized');
        } else {
            console.log('[Optimization] Layer disabled');
        }
    } catch (error) {
        console.error('[Optimization] Failed to initialize:', error);
    }
}

/**
 * Shutdown the optimization layer
 * Call this on app cleanup
 */
export function shutdownOptimization(): void {
    try {
        ingester.stop();
        console.log('[Optimization] Layer shutdown');
    } catch (error) {
        console.error('[Optimization] Failed to shutdown:', error);
    }
}

/**
 * Get optimization layer status
 */
export function getOptimizationStatus(): {
    enabled: boolean;
    ingesterRunning: boolean;
    recordCount: number;
    signalsAge: number | null;
    retryCandidates: number;
    lastDecisions: number;
} {
    try {
        const config = store.getConfig();
        const stats = store.getStats();
        const ingesterStatus = ingester.getStatus();

        return {
            enabled: config.enabled,
            ingesterRunning: ingesterStatus.isRunning,
            recordCount: stats.recordCount,
            signalsAge: stats.signalsAge,
            retryCandidates: stats.retryCandidateCount,
            lastDecisions: stats.decisionCount,
        };
    } catch (error) {
        console.error('[Optimization] Failed to get status:', error);
        return {
            enabled: false,
            ingesterRunning: false,
            recordCount: 0,
            signalsAge: null,
            retryCandidates: 0,
            lastDecisions: 0,
        };
    }
}
