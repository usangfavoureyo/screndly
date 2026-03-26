import type { EnrichedVideoMetadata, LoadedVideoSettings } from '../video-enrichment.service';
import { classifyYouTubeCandidateWithLLM } from './llmClassifier';
import type {
    DecisionResult,
    DecisionScoreResult,
    DetectionSettings,
    EnrichedCandidate,
    HardExclusionResult,
    PollingCandidate,
    ScoreBreakdown,
} from './types';

const APPROVED_PLATFORMS = ['Netflix', 'Prime Video', 'Amazon MGM', 'Apple TV+', 'Disney+', 'Hulu', 'Max', 'HBO'];
const APPROVED_DISTRIBUTORS = ['Lionsgate', 'A24', 'Neon', 'Sony Pictures', 'Universal Pictures', 'Warner Bros.', 'Paramount', '20th Century Studios', 'Well Go USA', 'Amazon MGM Studios', 'Apple Studios', 'Netflix', 'Disney', 'Focus Features', 'Bleecker Street', 'Roadside Attractions'];
const BLOCKED_GENRES = new Set(['documentary', 'reality', 'talk', 'news', 'war & politics']);

export function buildDetectionSettings(settings: LoadedVideoSettings): DetectionSettings {
    const allowedRegionsList = (settings.allowedRegions || settings.regionFilter || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    return {
        ...settings,
        allowedRegionsList,
        approvedPlatforms: APPROVED_PLATFORMS,
        approvedDistributors: APPROVED_DISTRIBUTORS,
    };
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function hasEnglishEvidence(metadata: EnrichedVideoMetadata): boolean {
    const match = metadata.tmdbMatch;
    if (!match) {
        return false;
    }

    return match.originalLanguage === 'en'
        || match.spokenLanguages.some((language) => language.toLowerCase().includes('en'))
        || match.originCountries.some((country) => ['US', 'UK', 'CA', 'AU', 'NZ'].includes(country.toUpperCase()));
}

export function getDubOnlyLikelihood(metadata: EnrichedVideoMetadata, rawTitle: string, description: string): number {
    const match = metadata.tmdbMatch;
    let score = 0;

    if (/\benglish dub(?:bed)?\b/i.test(`${rawTitle}\n${description}`)) score += 0.75;
    if (match?.originalLanguage && match.originalLanguage !== 'en') score += 0.35;
    if (match?.spokenLanguages.some((language) => language.toLowerCase().includes('en'))) score += 0.15;
    if (!hasEnglishEvidence(metadata)) score += 0.2;

    return clamp01(score);
}

export function getCatalogImportLikelihood(metadata: EnrichedVideoMetadata): number {
    const match = metadata.tmdbMatch;
    if (!match) {
        return 0.5;
    }

    let score = 0;
    if (match.originalLanguage && match.originalLanguage !== 'en') score += 0.2;
    if ((match.voteCount || 0) < 100) score += 0.2;
    if ((match.popularity || 0) < 15) score += 0.2;
    if (!match.distributors.length && !match.networks.length) score += 0.15;
    if ((match.releaseStatus || '').toLowerCase().includes('released')) score += 0.1;

    return clamp01(score);
}

export function isHardExcluded(candidate: PollingCandidate, metadata: EnrichedVideoMetadata): HardExclusionResult {
    const reasons: string[] = [];
    const haystack = `${candidate.rawTitle}\n${candidate.description}`.toLowerCase();

    if (/\b(wwe|wrestling|ufc|mma|boxing|highlights?|matchday|pregame|postgame)\b/.test(haystack)) reasons.push('sports_or_wwe');
    if (/\b(documentary|docuseries|true crime)\b/.test(haystack)) reasons.push('documentary');
    if (/\b(reality|unscripted|talk show|late night|podcast)\b/.test(haystack)) reasons.push('reality_or_talk');
    if (/\b(music video|lyric video|concert film|live performance)\b/.test(haystack)) reasons.push('musical_or_performance');
    if (/\b(stand-up|comedy special|roast special)\b/.test(haystack)) reasons.push('standup');
    if (/\b(recapped|ending explained|full movie|fan edit)\b/.test(haystack)) reasons.push('unrelated_or_fan_edit');

    const genreHits = (metadata.tmdbMatch?.genres || [])
        .map((genre) => genre.toLowerCase())
        .filter((genre) => BLOCKED_GENRES.has(genre));
    reasons.push(...genreHits);

    return {
        excluded: reasons.length > 0,
        reasons: [...new Set(reasons)],
    };
}

function computeMetadataConfidence(candidate: PollingCandidate, metadata: EnrichedVideoMetadata): number {
    const match = metadata.tmdbMatch;
    let score = 0.2;

    if (match) score += 0.35;
    if (metadata.tmdbMatchStatus === 'matched') score += 0.2;
    if (candidate.extractedYear && match?.year && candidate.extractedYear === match.year) score += 0.1;
    if (candidate.seasonNumber && match?.seasonNumber && candidate.seasonNumber === match.seasonNumber) score += 0.1;
    if (match?.overview) score += 0.05;

    return clamp01(score);
}

function computeOfficialTrailerConfidence(candidate: PollingCandidate): number {
    let score = 0.2;
    if (candidate.promoAssetType === 'trailer' || candidate.promoAssetType === 'teaser') score += 0.4;
    if (/\bofficial\b/i.test(candidate.rawTitle)) score += 0.2;
    if (/\btrailer|teaser\b/i.test(candidate.rawTitle)) score += 0.1;
    return clamp01(score);
}

function computeFranchiseConfidence(candidate: PollingCandidate): number {
    return /\b(devil may cry|castlevania|tomb raider|cyberpunk|squid game)\b/i.test(candidate.rawTitle) ? 0.8 : 0;
}

function getPlatformSignals(metadata: EnrichedVideoMetadata, channelName: string, settings: DetectionSettings): string[] {
    const haystack = [
        channelName,
        ...(metadata.tmdbMatch?.productionNames || []),
        ...(metadata.tmdbMatch?.networks || []),
    ].join('\n');

    return settings.approvedPlatforms.filter((platform) => haystack.toLowerCase().includes(platform.toLowerCase()));
}

function getDistributorSignals(metadata: EnrichedVideoMetadata, channelName: string, settings: DetectionSettings): string[] {
    const haystack = [
        channelName,
        ...(metadata.tmdbMatch?.productionNames || []),
        ...(metadata.tmdbMatch?.distributors || []),
    ].join('\n');

    return settings.approvedDistributors.filter((distributor) => haystack.toLowerCase().includes(distributor.toLowerCase()));
}

function buildScoreResult(candidate: EnrichedCandidate, settings: DetectionSettings, llmDecisionPath?: DecisionScoreResult['pathUsed']): DecisionScoreResult {
    const breakdown: ScoreBreakdown[] = [];
    const add = (label: string, value: number, reason: string) => breakdown.push({ label, value, reason });
    const match = candidate.metadata.tmdbMatch;

    if (match?.originalLanguage === 'en') add('english_original', 35, 'TMDb original language is English');
    else if (candidate.englishLanguageScore >= 0.6) add('english_speaking', 25, 'English-speaking evidence is strong');

    if (candidate.metadata.regionAllowed) add('region_match', 15, 'Matches allowed region set');
    if (candidate.officialTrailerConfidence >= 0.7) add('official_trailer_confidence', 10, 'Looks like an official promo asset');
    if (candidate.metadataConfidence >= 0.7) add('metadata_confidence', 10, 'Metadata match is strong');
    else if (candidate.metadataConfidence >= 0.5) add('metadata_confidence', 5, 'Metadata match is usable');
    if (candidate.platformSignals.length > 0) add('approved_platform', 8, candidate.platformSignals.join(', '));
    if (candidate.distributorSignals.length > 0) add('approved_distributor', 8, candidate.distributorSignals.join(', '));
    if (candidate.trustedChannel) add('trusted_channel', 5, 'Channel is a trusted supporting signal');
    if (candidate.franchiseConfidence >= 0.6) add('franchise_confidence', 6, 'Recognized franchise/IP');
    if ((match?.popularity || 0) > 10 || (match?.voteCount || 0) > 100) add('light_popularity_support', 3, 'Metadata shows some traction');
    if (candidate.dubOnlyLikelihood >= 0.5) add('dub_only_penalty', -25, 'English signal likely comes from dubbing');
    if (candidate.catalogImportLikelihood >= 0.5) add('catalog_import_penalty', -20, 'Looks like a low-value catalog import');

    const totalScore = breakdown.reduce((sum, item) => sum + item.value, 0);
    const allowReasons = breakdown.filter((item) => item.value > 0).map((item) => item.reason);
    const rejectReasons = breakdown.filter((item) => item.value < 0).map((item) => item.reason);

    return {
        totalScore,
        scoreBreakdown: breakdown,
        allowReasons,
        rejectReasons,
        pathUsed: llmDecisionPath || 'rejected',
    };
}

function buildCandidate(base: PollingCandidate, metadata: EnrichedVideoMetadata, settings: DetectionSettings): EnrichedCandidate {
    return {
        ...base,
        metadata,
        metadataConfidence: computeMetadataConfidence(base, metadata),
        officialTrailerConfidence: computeOfficialTrailerConfidence(base),
        titleMatchConfidence: metadata.tmdbMatch ? 0.7 : 0.2,
        sourceConfidence: 0.6,
        trustedChannel: settings.trustedSupportingChannels.includes(base.channelId),
        dubOnlyLikelihood: getDubOnlyLikelihood(metadata, base.rawTitle, base.description),
        catalogImportLikelihood: getCatalogImportLikelihood(metadata),
        englishLanguageScore: hasEnglishEvidence(metadata) ? 0.8 : 0.2,
        franchiseConfidence: computeFranchiseConfidence(base),
        platformSignals: getPlatformSignals(metadata, base.channelName, settings),
        distributorSignals: getDistributorSignals(metadata, base.channelName, settings),
    };
}

export async function decideYouTubeCandidate(
    base: PollingCandidate,
    metadata: EnrichedVideoMetadata,
    settings: LoadedVideoSettings
): Promise<DecisionResult> {
    const detectionSettings = buildDetectionSettings(settings);
    const candidate = buildCandidate(base, metadata, detectionSettings);
    const hardExclusion = isHardExcluded(base, metadata);

    if (hardExclusion.excluded) {
        return {
            allow: false,
            preLLMDecision: 'REJECT_PRELLM',
            decisionPath: 'rejected',
            score: {
                totalScore: -100,
                scoreBreakdown: [],
                allowReasons: [],
                rejectReasons: hardExclusion.reasons,
                pathUsed: 'rejected',
            },
            hardExclusionReasons: hardExclusion.reasons,
            reasonSummary: `Hard excluded: ${hardExclusion.reasons.join(', ')}`,
            decisionLog: {
                hardExclusionReasons: hardExclusion.reasons,
                dubOnlyLikelihood: candidate.dubOnlyLikelihood,
                catalogImportLikelihood: candidate.catalogImportLikelihood,
            },
        };
    }

    const englishEligible = candidate.metadata.tmdbMatch?.originalLanguage === 'en'
        || candidate.englishLanguageScore >= 0.6;
    const standardEligible = englishEligible
        && (!detectionSettings.excludeDubOnlyImports || candidate.dubOnlyLikelihood < 0.7)
        && candidate.metadata.regionAllowed
        && candidate.metadataConfidence >= 0.45;
    const needsGlobalException = !englishEligible;
    const clearReject = (!englishEligible && !detectionSettings.allowPremiumGlobalExceptions)
        || candidate.metadataConfidence < 0.25
        || (detectionSettings.excludeDubOnlyImports && candidate.dubOnlyLikelihood >= 0.7);

    if (clearReject) {
        const score = buildScoreResult(candidate, detectionSettings);
        return {
            allow: false,
            preLLMDecision: 'REJECT_PRELLM',
            decisionPath: 'rejected',
            score,
            hardExclusionReasons: [],
            reasonSummary: 'Rejected by deterministic language, dub-only, or metadata-confidence rules',
            decisionLog: {
                metadataConfidence: candidate.metadataConfidence,
                dubOnlyLikelihood: candidate.dubOnlyLikelihood,
                catalogImportLikelihood: candidate.catalogImportLikelihood,
            },
        };
    }

    let preLLMDecision: DecisionResult['preLLMDecision'] = 'SEND_TO_LLM';
    if (standardEligible && candidate.officialTrailerConfidence >= 0.7 && candidate.metadataConfidence >= 0.6) {
        preLLMDecision = 'ALLOW_PRELLM';
    }

    const llmResult = preLLMDecision === 'SEND_TO_LLM'
        ? await classifyYouTubeCandidateWithLLM(candidate, detectionSettings)
        : undefined;

    const score = buildScoreResult(candidate, detectionSettings, llmResult?.decisionPath || (standardEligible ? 'standard' : 'rejected'));
    const scoreTotal = score.totalScore;
    const strongSupportCount = [
        candidate.platformSignals.length > 0,
        candidate.distributorSignals.length > 0,
        candidate.trustedChannel,
        candidate.franchiseConfidence >= 0.6,
    ].filter(Boolean).length;

    const standardPass = standardEligible && scoreTotal >= 45;
    const foreignPremiumPass = !candidate.metadata.regionAllowed
        && englishEligible
        && candidate.dubOnlyLikelihood < 0.7
        && candidate.metadataConfidence >= 0.55
        && strongSupportCount >= 2
        && scoreTotal >= 50;
    const exceptionEnabled = detectionSettings.allowPremiumGlobalExceptions && !detectionSettings.strictRegionMode;
    const premiumPass = exceptionEnabled && foreignPremiumPass && candidate.platformSignals.length > 0;
    const distributorPass = exceptionEnabled && foreignPremiumPass && candidate.distributorSignals.length > 0;
    const globalExceptionPass = exceptionEnabled
        && needsGlobalException
        && (candidate.metadata.tmdbMatch?.voteCount || 0) >= 1000
        && (candidate.metadata.tmdbMatch?.popularity || 0) >= 40
        && candidate.metadataConfidence >= 0.7
        && (llmResult?.isGlobalException === true)
        && (llmResult?.confidence || 0) >= 0.9
        && candidate.catalogImportLikelihood < 0.65;

    let allow = false;
    let decisionPath: DecisionResult['decisionPath'] = 'rejected';
    let reasonSummary = 'Rejected after final backend merge';

    if (detectionSettings.strictRegionMode) {
        if (standardPass) {
            allow = true;
            decisionPath = 'standard';
            reasonSummary = 'Allowed through strict standard route';
        }
    } else if (standardPass) {
        allow = true;
        decisionPath = 'standard';
        reasonSummary = 'Allowed through standard route';
    } else if (premiumPass) {
        allow = true;
        decisionPath = 'premium_platform_exception';
        reasonSummary = 'Allowed through premium platform exception';
    } else if (distributorPass) {
        allow = true;
        decisionPath = 'distributor_exception';
        reasonSummary = 'Allowed through distributor-backed English-speaking exception';
    } else if (foreignPremiumPass) {
        allow = true;
        decisionPath = 'english_foreign_premium';
        reasonSummary = 'Allowed through English-speaking foreign premium path';
    } else if (globalExceptionPass) {
        allow = true;
        decisionPath = 'global_exception';
        reasonSummary = 'Allowed through strict global-exception path';
    }

    score.pathUsed = decisionPath;

    return {
        allow,
        preLLMDecision,
        decisionPath,
        score,
        llmResult,
        hardExclusionReasons: [],
        reasonSummary,
        decisionLog: {
            metadataConfidence: candidate.metadataConfidence,
            officialTrailerConfidence: candidate.officialTrailerConfidence,
            dubOnlyLikelihood: candidate.dubOnlyLikelihood,
            catalogImportLikelihood: candidate.catalogImportLikelihood,
            trustedChannel: candidate.trustedChannel,
            platformSignals: candidate.platformSignals,
            distributorSignals: candidate.distributorSignals,
            scoreBreakdown: score.scoreBreakdown,
            preLLMDecision,
            llmResult,
        },
    };
}
