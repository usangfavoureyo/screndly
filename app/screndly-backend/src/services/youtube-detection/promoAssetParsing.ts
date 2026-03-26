import type { PollingCandidate, PromoAssetType, PromoFingerprint } from './types';

const TITLE_NOISE_PATTERNS = [
    /\bofficial\b/gi,
    /\bwatch now\b/gi,
    /\bexclusive\b/gi,
    /\bhd\b/gi,
    /\b4k\b/gi,
    /\bimax\b/gi,
    /[|:()\[\]"]/g,
];

export function parsePromoAssetType(rawTitle: string): PromoAssetType {
    const title = rawTitle.toLowerCase();

    if (/\bfinal trailer\b/.test(title)) return 'final_trailer';
    if (/\bofficial trailer 3\b|\btrailer 3\b/.test(title)) return 'trailer_3';
    if (/\bofficial trailer 2\b|\btrailer 2\b/.test(title)) return 'trailer_2';
    if (/\bteaser\b/.test(title)) return 'teaser';
    if (/\bfeaturette\b/.test(title)) return 'featurette';
    if (/\btv spot\b/.test(title)) return 'tv_spot';
    if (/\bfirst look\b/.test(title)) return 'first_look';
    if (/\bdate announcement\b/.test(title)) return 'date_announcement';
    if (/\bannouncement\b/.test(title)) return 'announcement';
    if (/\bclip\b/.test(title)) return 'clip';
    if (/\btrailer\b/.test(title)) return 'trailer';
    return 'promo_unknown';
}

export function normalizePromoTitle(rawTitle: string): string {
    let normalized = rawTitle.toLowerCase();
    for (const pattern of TITLE_NOISE_PATTERNS) {
        normalized = normalized.replace(pattern, ' ');
    }

    return normalized
        .replace(/\b(netflix|prime video|amazon mgm|apple tv\+|disney\+|hulu|max|hbo|lionsgate|warner bros\.?|sony pictures|universal pictures)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function buildPromoFingerprint(candidate: Pick<PollingCandidate, 'normalizedTitle' | 'mediaTypeGuess' | 'extractedYear' | 'seasonNumber' | 'promoAssetType' | 'rawTitle'>): PromoFingerprint {
    const canonicalTitle = normalizePromoTitle(candidate.normalizedTitle || candidate.rawTitle);
    const ordinal = /\btrailer\s+([23])\b/i.exec(candidate.rawTitle)?.[1];
    const languageMarker = /\bsubtitled\b/i.test(candidate.rawTitle)
        ? 'subtitled'
        : /\bdub(?:bed)?\b/i.test(candidate.rawTitle)
            ? 'dubbed'
            : undefined;

    const fingerprint = [
        canonicalTitle,
        candidate.mediaTypeGuess,
        candidate.extractedYear || 'na',
        candidate.seasonNumber || 'na',
        candidate.promoAssetType,
        languageMarker || 'lang-na',
        ordinal || 'ord-na',
    ].join('::');

    return {
        canonicalTitle,
        mediaType: candidate.mediaTypeGuess,
        releaseYear: candidate.extractedYear,
        seasonNumber: candidate.seasonNumber,
        promoAssetType: candidate.promoAssetType,
        languageMarker,
        ordinal,
        fingerprint,
    };
}
