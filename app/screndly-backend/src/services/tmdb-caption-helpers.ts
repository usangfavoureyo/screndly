export interface TMDbCaptionContextForSanitizer {
    title: string;
    mediaType: 'movie' | 'tv';
    temporalTag: 'releasing_today' | 'releasing_this_week' | 'releasing_this_month' | 'anniversary' | 'already_released';
    timingMode?: 'release_today' | 'exact_d_plus_7' | 'exact_calendar_month_plus_1' | 'anniversary_today' | 'fallback_day_count' | 'fallback_exact_date';
    formattedReleaseDate?: string;
    anniversaryYears?: number;
    cast?: string[];
}

export interface TMDbCaptionSanitizeResult {
    caption: string;
    isValid: boolean;
    issue?: string;
}

const ORPHAN_FRAGMENT_PATTERN = /^(originally|streaming|premiering|exclusively|also|meanwhile)\.?$/i;
const VAGUE_TRAILING_LINE_PATTERN = /(?:^|\n\n?)(originally|streaming|premiering|exclusively|also|meanwhile)\.\s*$/i;

function quoteTMDbTitle(title: string): string {
    return `'${String(title || '').trim()}'`;
}

function normalizeSpacing(value: string): string {
    return value
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

function stripCaptionLinks(value: string): string {
    return value
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, '$1')
        .replace(/\(\s*\[[^\]]+\]\((?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,})[^)\s]*\)\s*/gi, ' ')
        .replace(/\[[^\]]+\]\((?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,})[^)\s]*\)/gi, ' ')
        .replace(/\[[^\]]+\]\([^)]+$/gi, ' ')
        .replace(/\((https?:\/\/[^)]+|www\.[^)]+)\)/gi, '')
        .replace(/\bhttps?:\/\/\S+/gi, '')
        .replace(/\bwww\.\S+/gi, '')
        .replace(/\(([a-z0-9-]+\.)+[a-z]{2,}[^)]*\)/gi, '')
        .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi, '')
        .replace(/[([]\s*$/g, '');
}

function getOrphanParagraphIssue(paragraphs: string[]): string | undefined {
    const lastParagraph = paragraphs[paragraphs.length - 1];
    if (!lastParagraph) {
        return 'empty_caption';
    }

    if (ORPHAN_FRAGMENT_PATTERN.test(lastParagraph)) {
        return 'orphan_fragment';
    }

    const words = lastParagraph.split(/\s+/).filter(Boolean);
    if (words.length === 1 && /[.!?]$/.test(lastParagraph)) {
        return 'single_word_paragraph';
    }

    return undefined;
}

export function sanitizeTMDbCaption(rawCaption: string): TMDbCaptionSanitizeResult {
    const normalized = normalizeSpacing(stripCaptionLinks(rawCaption || ''));
    if (!normalized) {
        return { caption: '', isValid: false, issue: 'empty_caption' };
    }

    const paragraphs = normalized
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

    if (paragraphs.length === 0) {
        return { caption: '', isValid: false, issue: 'empty_caption' };
    }

    const paragraphIssue = getOrphanParagraphIssue(paragraphs);
    if (paragraphIssue) {
        return { caption: normalized, isValid: false, issue: paragraphIssue };
    }

    if (VAGUE_TRAILING_LINE_PATTERN.test(normalized)) {
        return { caption: normalized, isValid: false, issue: 'dangling_trailing_fragment' };
    }

    return {
        caption: paragraphs.join('\n\n'),
        isValid: true,
    };
}

export function hasBrokenTMDbCaptionFragment(caption?: string | null): boolean {
    if (typeof caption !== 'string' || caption.trim().length === 0) {
        return false;
    }

    return !sanitizeTMDbCaption(caption).isValid;
}

export function buildDeterministicTMDbCaption(context: TMDbCaptionContextForSanitizer): string {
    const title = quoteTMDbTitle(context.title);
    const cast = Array.isArray(context.cast)
        ? context.cast.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 3)
        : [];
    const castLine = cast.length > 0 ? `\n\nStarring ${cast.join(', ')}.` : '';

    if (context.timingMode === 'anniversary_today' && context.anniversaryYears) {
        return `${title} premiered ${context.anniversaryYears} years ago today.${castLine}`;
    }

    if (context.temporalTag === 'releasing_today') {
        return `${title} ${context.mediaType === 'tv' ? 'premieres today' : 'releases today'}.${castLine}`;
    }

    if (context.timingMode === 'exact_d_plus_7') {
        return `${title} releases in one week.${castLine}`;
    }

    if (context.timingMode === 'exact_calendar_month_plus_1' && context.formattedReleaseDate) {
        return `${title} arrives ${context.formattedReleaseDate}.${castLine}`;
    }

    if (context.formattedReleaseDate) {
        return `${title} arrives ${context.formattedReleaseDate}.${castLine}`;
    }

    return `${title} arrives soon.${castLine}`;
}

export function buildAnniversaryPromptGuardrail(prompt?: string): string {
    const base = (prompt || '').trim();
    const guardrail = [
        'Anniversary caption rules:',
        '- Never output sentence fragments.',
        '- Never end the caption with dangling words like Originally., Streaming., Premiering., or Exclusively..',
        '- Never use Originally unless followed by grounded information that is explicitly known.',
        '- Do not invent original platform, network, distributor, or release context.',
        '- If no valid second sentence exists, return one complete sentence only.',
    ].join('\n');

    return base ? `${base}\n\n${guardrail}` : guardrail;
}
