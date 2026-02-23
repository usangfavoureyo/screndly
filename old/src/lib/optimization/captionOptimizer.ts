/**
 * Caption Optimizer
 * 
 * Middleware that wraps caption generation with optimization logic.
 * Uses performance signals to improve prompts, select models, and optimize keywords.
 * All logic is internal - no UI exposure.
 */

import { analyticsStore } from './analyticsStore';
import { signalEngine } from './signalEngine';
import {
    Platform,
    ContentSource,
    CaptionModel,
    OptimizationDecision,
} from './types';

// Hash function for captions (for pattern matching)
function hashCaption(caption: string): string {
    let hash = 0;
    for (let i = 0; i < caption.length; i++) {
        const char = caption.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

// Extract keywords from caption
function extractKeywords(caption: string): string[] {
    // Extract hashtags
    const hashtags = caption.match(/#\w+/g) || [];

    // Extract title case words (likely proper nouns)
    const titleCase = caption.match(/\b[A-Z][a-z]+\b/g) || [];

    // Combine and dedupe
    const keywords = [...new Set([...hashtags, ...titleCase])];
    return keywords.slice(0, 10); // Limit to 10
}

/**
 * Caption Optimizer Class
 */
class CaptionOptimizer {
    private config = analyticsStore.getConfig();

    /**
     * Get optimization hints for caption generation
     */
    getOptimizationHints(
        platform: Platform,
        contentSource: ContentSource
    ): {
        model: CaptionModel;
        tone: string;
        maxLength: number;
        keywordGuidance: string[];
        avoidPatterns: string[];
        additionalInstructions: string;
    } {
        if (!this.config.enabled || !this.config.captionOptimization) {
            return this.getDefaultHints(platform);
        }

        // Check for exploration mode
        if (signalEngine.shouldExplore()) {
            this.logDecision({
                type: 'caption',
                decision: 'Using default hints (exploration mode)',
                reasoning: 'Random exploration to gather diverse data',
                confidence: 0,
                isExploration: true,
                timestamp: Date.now(),
            });
            return this.getDefaultHints(platform);
        }

        const signals = analyticsStore.getSignals();
        if (!signals) {
            return this.getDefaultHints(platform);
        }

        // Get optimal model
        const model = this.config.modelSelection
            ? signalEngine.getOptimalModel(contentSource)
            : 'gpt-4o-mini';

        // Get platform-specific optimization
        const platformSignals = signals.platforms[platform];
        const captionSignals = signals.caption;

        // Optimal tone
        const tone = captionSignals.optimalTone[platform] || 'Engaging';

        // Optimal length
        const maxLength = captionSignals.optimalLength[platform] || 280;

        // Top keywords that work on this platform
        const topKeywordsForPlatform = captionSignals.topKeywords
            .filter(k => k.platform === platform)
            .slice(0, 5)
            .map(k => k.keyword);

        // Patterns to avoid
        const avoidPatterns = captionSignals.avoidPatterns;

        // Build additional instructions based on signals
        let additionalInstructions = '';

        // Hashtag guidance
        const hashtagWeight = captionSignals.hashtagWeight[platform];
        if (hashtagWeight < 0.3) {
            additionalInstructions += 'Focus on semantic keywords rather than hashtags. ';
        } else if (hashtagWeight > 0.6) {
            additionalInstructions += 'Include relevant hashtags for discovery. ';
        }

        // Source-specific guidance
        const sourceSignals = signals.sources[contentSource];
        if (sourceSignals && sourceSignals.trend === 'declining') {
            additionalInstructions += 'Try a fresh approach - recent performance has declined. ';
        } else if (sourceSignals && sourceSignals.trend === 'improving') {
            additionalInstructions += 'Continue current style - it\'s working well. ';
        }

        // Confidence-based adjustments
        if (platformSignals.confidence < 50) {
            additionalInstructions += 'Data is limited, prioritize engagement hooks. ';
        }

        this.logDecision({
            type: 'caption',
            decision: `Model: ${model}, Tone: ${tone}, Length: ${maxLength}`,
            reasoning: `Platform confidence: ${platformSignals.confidence}%, Source trend: ${sourceSignals?.trend || 'unknown'}`,
            confidence: platformSignals.confidence,
            isExploration: false,
            timestamp: Date.now(),
        });

        return {
            model,
            tone,
            maxLength,
            keywordGuidance: topKeywordsForPlatform,
            avoidPatterns,
            additionalInstructions: additionalInstructions.trim(),
        };
    }

    /**
     * Get default hints (no optimization)
     */
    private getDefaultHints(platform: Platform): {
        model: CaptionModel;
        tone: string;
        maxLength: number;
        keywordGuidance: string[];
        avoidPatterns: string[];
        additionalInstructions: string;
    } {
        const lengthDefaults: Record<Platform, number> = {
            x: 280,
            facebook: 500,
            instagram: 2200,
            threads: 500,
            tiktok: 150,
            youtube: 100, // Community posts
            pinterest: 500,
        };

        return {
            model: 'gpt-4o-mini',
            tone: 'Engaging',
            maxLength: lengthDefaults[platform] || 280,
            keywordGuidance: [],
            avoidPatterns: [],
            additionalInstructions: '',
        };
    }

    /**
     * Enhance a prompt with optimization signals
     */
    enhancePrompt(
        basePrompt: string,
        platform: Platform,
        contentSource: ContentSource
    ): string {
        if (!this.config.enabled || !this.config.captionOptimization) {
            return basePrompt;
        }

        const hints = this.getOptimizationHints(platform, contentSource);

        let enhanced = basePrompt;

        // Add keyword guidance
        if (hints.keywordGuidance.length > 0) {
            enhanced += `\n\nConsider incorporating these high-performing keywords naturally: ${hints.keywordGuidance.join(', ')}`;
        }

        // Add avoidance patterns
        if (hints.avoidPatterns.length > 0) {
            enhanced += `\n\nAvoid these patterns that have underperformed: ${hints.avoidPatterns.join(', ')}`;
        }

        // Add additional instructions
        if (hints.additionalInstructions) {
            enhanced += `\n\n${hints.additionalInstructions}`;
        }

        // Add length constraint
        enhanced += `\n\nKeep the caption under ${hints.maxLength} characters for optimal engagement on ${platform}.`;

        return enhanced;
    }

    /**
     * Select optimal model for a given context
     */
    selectModel(contentSource: ContentSource): CaptionModel {
        if (!this.config.enabled || !this.config.modelSelection) {
            return 'gpt-4o-mini';
        }

        if (signalEngine.shouldExplore()) {
            // Random model selection for exploration
            const models: CaptionModel[] = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
            const randomModel = models[Math.floor(Math.random() * models.length)];

            this.logDecision({
                type: 'model',
                decision: `Selected ${randomModel} (exploration)`,
                reasoning: 'Random exploration',
                confidence: 0,
                isExploration: true,
                timestamp: Date.now(),
            });

            return randomModel;
        }

        const optimalModel = signalEngine.getOptimalModel(contentSource);

        this.logDecision({
            type: 'model',
            decision: `Selected ${optimalModel}`,
            reasoning: `Best performing model for ${contentSource}`,
            confidence: 80,
            isExploration: false,
            timestamp: Date.now(),
        });

        return optimalModel;
    }

    /**
     * Post-process caption with optimization
     */
    postProcessCaption(
        caption: string,
        platform: Platform
    ): string {
        if (!this.config.enabled) {
            return caption;
        }

        const signals = analyticsStore.getSignals();
        if (!signals) {
            return caption;
        }

        let processed = caption;

        // Adjust hashtag density
        const hashtagWeight = signals.caption.hashtagWeight[platform];
        const currentHashtags = (caption.match(/#\w+/g) || []).length;
        const captionLength = caption.length;
        const targetHashtags = Math.round((captionLength / 100) * hashtagWeight * 3);

        // Too many hashtags? Remove some
        if (currentHashtags > targetHashtags + 2) {
            const hashtags = caption.match(/#\w+/g) || [];
            const toRemove = hashtags.slice(targetHashtags);
            toRemove.forEach(tag => {
                processed = processed.replace(new RegExp(`\\s*${tag}`, 'g'), '');
            });
            processed = processed.replace(/\s+/g, ' ').trim();
        }

        return processed;
    }

    /**
     * Record caption metadata for future analysis
     */
    recordCaptionMetadata(
        postId: string,
        platform: Platform,
        contentSource: ContentSource,
        caption: string,
        model: CaptionModel,
        tone?: string
    ): void {
        const record = analyticsStore.getRecordByPostId(postId, platform);

        if (record) {
            record.captionHash = hashCaption(caption);
            record.captionModel = model;
            record.captionTone = tone;
            record.keywords = extractKeywords(caption);
            record.captionLength = caption.length;
            analyticsStore.saveRecord(record);
        }
    }

    /**
     * Log optimization decision
     */
    private logDecision(decision: OptimizationDecision): void {
        if (this.config.verbose || this.config.dryRun) {
            console.log(`[CaptionOptimizer] ${decision.type}: ${decision.decision} (${decision.reasoning})`);
        }
        analyticsStore.logDecision(decision);
    }
}

// Export singleton
export const captionOptimizer = new CaptionOptimizer();

// Export utility functions
export { hashCaption, extractKeywords };
