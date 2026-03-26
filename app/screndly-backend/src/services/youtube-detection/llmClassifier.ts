import aiService from '../ai.service';
import type { DetectionSettings, EnrichedCandidate, LLMClassificationResult } from './types';

function safeJsonParse(content: string): LLMClassificationResult | null {
    try {
        return JSON.parse(content) as LLMClassificationResult;
    } catch {
        return null;
    }
}

function buildTestClassification(candidate: EnrichedCandidate): LLMClassificationResult {
    const tmdbMatch = candidate.metadata.tmdbMatch;
    const originalLanguage = tmdbMatch?.originalLanguage || 'unknown';
    const isEnglishOriginal = originalLanguage === 'en';
    const isEnglishSpeaking = isEnglishOriginal || candidate.englishLanguageScore >= 0.6;
    const blockedReason = /\b(wwe|wrestling|ufc|mma|documentary|docuseries|reality|talk show|podcast)\b/i.test(candidate.rawTitle)
        ? 'other'
        : 'none';

    return {
        title: tmdbMatch?.title || candidate.normalizedTitle,
        mediaType: candidate.mediaTypeGuess,
        isEnglishSpeaking,
        isEnglishOriginal,
        isDubOnly: candidate.dubOnlyLikelihood >= 0.7,
        primaryOrigin: tmdbMatch?.originCountries?.[0] || tmdbMatch?.productionCountries?.[0] || 'Unknown',
        matchesSelectedRegion: candidate.metadata.regionAllowed,
        blockedCategory: blockedReason !== 'none',
        blockedCategoryReason: blockedReason,
        isPremiumPlatformBacked: candidate.platformSignals.length > 0,
        premiumPlatform: candidate.platformSignals[0] || 'none',
        isDistributorBacked: candidate.distributorSignals.length > 0,
        distributorName: candidate.distributorSignals[0] || '',
        isTrustedChannelSupport: candidate.trustedChannel,
        isGlobalException: !isEnglishSpeaking && (tmdbMatch?.voteCount || 0) >= 1000 && (tmdbMatch?.popularity || 0) >= 40,
        globalExceptionReason: !isEnglishSpeaking ? 'high global traction' : '',
        catalogImportLikelihood: candidate.catalogImportLikelihood,
        dubOnlyLikelihood: candidate.dubOnlyLikelihood,
        confidence: 0.92,
        recommendedDecision: blockedReason !== 'none' ? 'reject' : 'allow',
        decisionPath: !isEnglishSpeaking ? 'global_exception' : candidate.metadata.regionAllowed ? 'standard' : 'english_foreign_premium',
        reasoningSummary: 'Test-mode heuristic classification',
    };
}

export async function classifyYouTubeCandidateWithLLM(
    candidate: EnrichedCandidate,
    settings: DetectionSettings
): Promise<LLMClassificationResult | undefined> {
    if (process.env.NODE_ENV === 'test') {
        return buildTestClassification(candidate);
    }

    const tmdbMatch = candidate.metadata.tmdbMatch;
    const response = await aiService.generateCompletion({
        model: settings.videoOpenaiModel,
        maxTokens: 500,
        jsonMode: true,
        temperature: 0.1,
        enableWebSearch: false,
        prompt: `Return strict JSON only.

Never allow a title solely because Netflix, a distributor, or a trusted channel is attached.
Reject blocked categories.
Treat dub-only as a strong negative.
Treat non-English titles as rejected by default unless they clearly qualify as a rare global exception.
Prefer rejection when evidence is weak.

Evidence packet:
- rawTitle: ${candidate.rawTitle}
- normalizedTitle: ${candidate.normalizedTitle}
- extractedYear: ${candidate.extractedYear || 'unknown'}
- seasonNumber: ${candidate.seasonNumber || 'unknown'}
- channelName: ${candidate.channelName}
- trustedChannel: ${candidate.trustedChannel}
- description: ${candidate.description.slice(0, 1800)}
- mediaTypeGuess: ${candidate.mediaTypeGuess}
- originalLanguage: ${tmdbMatch?.originalLanguage || 'unknown'}
- spokenLanguages: ${(tmdbMatch?.spokenLanguages || []).join(', ') || 'unknown'}
- productionCountries: ${(tmdbMatch?.productionCountries || []).join(', ') || 'unknown'}
- originCountries: ${(tmdbMatch?.originCountries || []).join(', ') || 'unknown'}
- genres: ${(tmdbMatch?.genres || []).join(', ') || 'unknown'}
- networks: ${(tmdbMatch?.networks || []).join(', ') || 'unknown'}
- productionCompanies: ${(tmdbMatch?.productionNames || []).join(', ') || 'unknown'}
- distributors: ${(tmdbMatch?.distributors || []).join(', ') || 'unknown'}
- voteCount: ${tmdbMatch?.voteCount ?? 'unknown'}
- popularity: ${tmdbMatch?.popularity ?? 'unknown'}
- metadataConfidence: ${candidate.metadataConfidence}
- officialTrailerConfidence: ${candidate.officialTrailerConfidence}
- dubOnlyLikelihood: ${candidate.dubOnlyLikelihood}
- catalogImportLikelihood: ${candidate.catalogImportLikelihood}
- userSelectedRegions: ${settings.allowedRegionsList.join(', ') || 'none'}
- strictRegionMode: ${settings.strictRegionMode}
- allowPremiumGlobalExceptions: ${settings.allowPremiumGlobalExceptions}

Return:
{
  "title": "string",
  "mediaType": "movie | tv | unknown",
  "isEnglishSpeaking": true,
  "isEnglishOriginal": true,
  "isDubOnly": false,
  "primaryOrigin": "string",
  "matchesSelectedRegion": true,
  "blockedCategory": false,
  "blockedCategoryReason": "none | sports | documentary | reality | talk | musical | lifestyle | standup | wwe | other",
  "isPremiumPlatformBacked": false,
  "premiumPlatform": "string",
  "isDistributorBacked": false,
  "distributorName": "string",
  "isTrustedChannelSupport": false,
  "isGlobalException": false,
  "globalExceptionReason": "string",
  "catalogImportLikelihood": 0.0,
  "dubOnlyLikelihood": 0.0,
  "confidence": 0.0,
  "recommendedDecision": "allow | reject | review",
  "decisionPath": "standard | english_foreign_premium | premium_platform_exception | distributor_exception | global_exception | rejected",
  "reasoningSummary": "brief factual summary"
}`,
    });

    if (!response.success) {
        return undefined;
    }

    return safeJsonParse(response.content) || undefined;
}
