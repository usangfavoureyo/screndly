import type { EnrichedVideoMetadata, LoadedVideoSettings } from '../video-enrichment.service';

export type DecisionPath =
    | 'standard'
    | 'english_foreign_premium'
    | 'premium_platform_exception'
    | 'distributor_exception'
    | 'global_exception'
    | 'rejected';

export type PreLLMDecision = 'REJECT_PRELLM' | 'SEND_TO_LLM' | 'ALLOW_PRELLM';
export type PromoAssetType =
    | 'teaser'
    | 'trailer'
    | 'final_trailer'
    | 'trailer_2'
    | 'trailer_3'
    | 'featurette'
    | 'clip'
    | 'tv_spot'
    | 'announcement'
    | 'first_look'
    | 'date_announcement'
    | 'promo_unknown';

export interface PollingCandidate {
    youtubeVideoId: string;
    rawTitle: string;
    normalizedTitle: string;
    description: string;
    channelId: string;
    channelName: string;
    publishedAt: Date;
    mediaTypeGuess: 'movie' | 'tv' | 'unknown';
    extractedYear?: number;
    seasonNumber?: number;
    trailerType?: string;
    promoAssetType: PromoAssetType;
    durationSeconds?: number;
}

export interface EnrichedCandidate extends PollingCandidate {
    metadata: EnrichedVideoMetadata;
    metadataConfidence: number;
    officialTrailerConfidence: number;
    titleMatchConfidence: number;
    sourceConfidence: number;
    trustedChannel: boolean;
    dubOnlyLikelihood: number;
    catalogImportLikelihood: number;
    englishLanguageScore: number;
    franchiseConfidence: number;
    platformSignals: string[];
    distributorSignals: string[];
}

export interface DetectionSettings extends LoadedVideoSettings {
    allowedRegionsList: string[];
    approvedPlatforms: string[];
    approvedDistributors: string[];
}

export interface HardExclusionResult {
    excluded: boolean;
    reasons: string[];
}

export interface LLMClassificationResult {
    title: string;
    mediaType: 'movie' | 'tv' | 'unknown';
    isEnglishSpeaking: boolean;
    isEnglishOriginal: boolean;
    isDubOnly: boolean;
    primaryOrigin: string;
    matchesSelectedRegion: boolean;
    blockedCategory: boolean;
    blockedCategoryReason: string;
    isPremiumPlatformBacked: boolean;
    premiumPlatform: string;
    isDistributorBacked: boolean;
    distributorName: string;
    isTrustedChannelSupport: boolean;
    isGlobalException: boolean;
    globalExceptionReason: string;
    catalogImportLikelihood: number;
    dubOnlyLikelihood: number;
    confidence: number;
    recommendedDecision: 'allow' | 'reject' | 'review';
    decisionPath: DecisionPath;
    reasoningSummary: string;
}

export interface ScoreBreakdown {
    label: string;
    value: number;
    reason: string;
}

export interface DecisionScoreResult {
    totalScore: number;
    scoreBreakdown: ScoreBreakdown[];
    allowReasons: string[];
    rejectReasons: string[];
    pathUsed: DecisionPath;
}

export interface DecisionResult {
    allow: boolean;
    preLLMDecision: PreLLMDecision;
    decisionPath: DecisionPath;
    score: DecisionScoreResult;
    llmResult?: LLMClassificationResult;
    hardExclusionReasons: string[];
    reasonSummary: string;
    decisionLog: Record<string, unknown>;
}

export interface PromoFingerprint {
    canonicalTitle: string;
    mediaType: string;
    releaseYear?: number;
    seasonNumber?: number;
    promoAssetType: PromoAssetType;
    languageMarker?: string;
    ordinal?: string;
    fingerprint: string;
}

export interface DedupResult {
    duplicateStatus: 'UNIQUE' | 'DUPLICATE_SKIP' | 'DISTINCT_ASSET';
    matchedCanonicalVideoId?: string;
    matchedChannelId?: string;
    dedupFingerprint: string;
    similarityScore?: number;
    reasonSummary: string;
    sourcePriorityScore: number;
}
