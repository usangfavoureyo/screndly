import prisma from '../../lib/prisma';
import { buildPromoFingerprint } from './promoAssetParsing';
import { getSourcePriorityScore } from './sourcePriority';
import type { DedupResult, PollingCandidate } from './types';

const promoDedupIndex = (prisma as any).promoDedupIndex as any;

function normalizedSimilarity(left: string, right: string): number {
    if (!left || !right) return 0;
    if (left === right) return 1;

    const leftTokens = new Set(left.split(/\s+/));
    const rightTokens = new Set(right.split(/\s+/));
    const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
    const union = new Set([...leftTokens, ...rightTokens]).size;
    return union > 0 ? intersection / union : 0;
}

export async function checkPromoDuplicate(
    candidate: PollingCandidate,
    trustedChannel: boolean,
    matchedMetadataId?: string
): Promise<DedupResult> {
    const fingerprint = buildPromoFingerprint(candidate);
    const sourcePriorityScore = getSourcePriorityScore(candidate.channelName, trustedChannel);
    const existingIndex = await promoDedupIndex.findFirst({
        where: {
            OR: [
                { canonicalFingerprint: fingerprint.fingerprint },
                ...(matchedMetadataId ? [{ matchedMetadataId }] : []),
            ],
        },
        orderBy: { updatedAt: 'desc' },
    });

    if (!existingIndex) {
        return {
            duplicateStatus: 'UNIQUE',
            dedupFingerprint: fingerprint.fingerprint,
            reasonSummary: 'No existing promo asset fingerprint matched',
            sourcePriorityScore,
        };
    }

    const titleSimilarity = normalizedSimilarity(existingIndex.normalizedTitle, fingerprint.canonicalTitle);
    const sameAssetType = existingIndex.promoAssetType === fingerprint.promoAssetType;
    const sameSeason = (existingIndex.seasonNumber || null) === (fingerprint.seasonNumber || null);
    const sameYear = (existingIndex.releaseYear || null) === (fingerprint.releaseYear || null);
    const sameMediaType = existingIndex.mediaType === fingerprint.mediaType;

    if (sameAssetType && sameSeason && sameYear && sameMediaType && titleSimilarity >= 0.82) {
        return {
            duplicateStatus: 'DUPLICATE_SKIP',
            matchedCanonicalVideoId: existingIndex.chosenCanonicalVideoId,
            matchedChannelId: existingIndex.chosenCanonicalChannelId,
            dedupFingerprint: fingerprint.fingerprint,
            similarityScore: titleSimilarity,
            reasonSummary: 'Matched existing canonical promo asset',
            sourcePriorityScore,
        };
    }

    return {
        duplicateStatus: 'DISTINCT_ASSET',
        matchedCanonicalVideoId: existingIndex.chosenCanonicalVideoId,
        matchedChannelId: existingIndex.chosenCanonicalChannelId,
        dedupFingerprint: fingerprint.fingerprint,
        similarityScore: titleSimilarity,
        reasonSummary: 'Nearby match exists but asset type or context differs',
        sourcePriorityScore,
    };
}

export async function recordAcceptedPromoFingerprint(
    candidate: PollingCandidate,
    dedupFingerprint: string,
    sourcePriorityScore: number,
    matchedMetadataId?: string
): Promise<void> {
    const normalizedTitle = buildPromoFingerprint(candidate).canonicalTitle;
    const existing = await promoDedupIndex.findUnique({
        where: { canonicalFingerprint: dedupFingerprint },
    });

    if (existing) {
        await promoDedupIndex.update({
            where: { canonicalFingerprint: dedupFingerprint },
            data: {
                matchedMetadataId,
                normalizedTitle,
                mediaType: candidate.mediaTypeGuess,
                seasonNumber: candidate.seasonNumber,
                releaseYear: candidate.extractedYear,
                promoAssetType: candidate.promoAssetType,
                lastSeenAt: new Date(),
            },
        });
        return;
    }

    await promoDedupIndex.create({
        data: {
            canonicalFingerprint: dedupFingerprint,
            matchedMetadataId,
            normalizedTitle,
            mediaType: candidate.mediaTypeGuess,
            seasonNumber: candidate.seasonNumber,
            releaseYear: candidate.extractedYear,
            promoAssetType: candidate.promoAssetType,
            chosenCanonicalVideoId: candidate.youtubeVideoId,
            chosenCanonicalChannelId: candidate.channelId,
            sourcePriorityScore,
            duplicateVideoIds: [],
        },
    });
}

export async function recordDuplicateRelationship(
    dedupFingerprint: string,
    duplicateVideoId: string
): Promise<void> {
    const existing = await promoDedupIndex.findUnique({
        where: { canonicalFingerprint: dedupFingerprint },
    });

    if (!existing) {
        return;
    }

    const nextDuplicateIds = Array.from(new Set([...(existing.duplicateVideoIds || []), duplicateVideoId]));
    await promoDedupIndex.update({
        where: { canonicalFingerprint: dedupFingerprint },
        data: {
            duplicateCount: nextDuplicateIds.length,
            duplicateVideoIds: nextDuplicateIds,
            lastSeenAt: new Date(),
        },
    });
}
