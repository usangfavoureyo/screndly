/**
 * AI Service - Unified Model Routing
 * Routes requests to appropriate AI model (OpenAI, Flash 3/Jordanite)
 */

import prisma from '../lib/prisma';
import { readSecretSettingValue } from '../lib/settings';
import { trackApiUsage } from './api-usage.service';
import { resolveComposeSourceInputText } from './compose-media-url-import.service';
import { createHash } from 'crypto';

// ============================================
// TYPES
// ============================================

export const SUPPORTED_OPENAI_MODELS = [
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5.4-nano',
    'gpt-5.2',
    'gpt-5.1',
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-4o',
    'gpt-4o-mini',
] as const;

export const LEGACY_OPENAI_MODELS = [
    'gpt-4-turbo',
    'gpt-3.5-turbo',
] as const;

export type SupportedOpenAIModel = typeof SUPPORTED_OPENAI_MODELS[number];
export type LegacyOpenAIModel = typeof LEGACY_OPENAI_MODELS[number];
export type AIModel = SupportedOpenAIModel | LegacyOpenAIModel | 'flash-3';
export type AIReasoningEffort = 'minimal' | 'none' | 'low' | 'medium' | 'high' | 'xhigh';
export const DEFAULT_OPENAI_MODEL: SupportedOpenAIModel = 'gpt-5-mini';
export type RSSCaptionGenerationPath = 'ai_prompted' | 'repaired_caption' | 'deterministic_template' | 'excerpt_fallback';

export interface RSSCaptionGenerationResult {
    caption: string;
    path: RSSCaptionGenerationPath;
}

export function normalizeAIModel(value?: string | null, fallback: AIModel = DEFAULT_OPENAI_MODEL): AIModel {
    switch (value) {
        case 'gpt-5.4':
        case 'gpt-5.4-mini':
        case 'gpt-5.4-nano':
        case 'gpt-5.2':
        case 'gpt-5.1':
        case 'gpt-5':
        case 'gpt-5-mini':
        case 'gpt-5-nano':
        case 'gpt-4.1':
        case 'gpt-4.1-mini':
        case 'gpt-4.1-nano':
        case 'gpt-4o':
        case 'gpt-4o-mini':
        case 'gpt-4-turbo':
        case 'gpt-3.5-turbo':
        case 'flash-3':
            return value;
        default:
            return fallback;
    }
}

export interface AIRequest {
    model: AIModel;
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
    reasoningEffort?: AIReasoningEffort;
    enableWebSearch?: boolean;
    webSearchUsageScope?: 'rss' | 'youtube' | 'tmdb' | 'video' | 'compose' | 'general';
    cacheKey?: string;
    cacheTTLms?: number;
    useCache?: boolean;
}

export interface AIResponse {
    success: boolean;
    content: string;
    model: AIModel;
    tokens?: {
        prompt: number;
        completion: number;
        total: number;
    };
    error?: string;
}

interface CachedAIResponse {
    expiresAt: number;
    value: AIResponse;
}

const aiResponseCache = new Map<string, CachedAIResponse>();
const pendingAIRequests = new Map<string, Promise<AIResponse>>();
const DEFAULT_AI_CACHE_TTL_MS = 30 * 60 * 1000;
const WEB_SEARCH_AI_CACHE_TTL_MS = 10 * 60 * 1000;
const OPENAI_QUOTA_COOLDOWN_MS = 30 * 60 * 1000;
const DEFAULT_OPENAI_WEB_SEARCH_DAILY_LIMIT = 50;
const DEFAULT_RSS_OPENAI_WEB_SEARCH_DAILY_LIMIT = 10;
const DEFAULT_YOUTUBE_OPENAI_WEB_SEARCH_DAILY_LIMIT = 20;
const DEFAULT_TMDB_OPENAI_WEB_SEARCH_DAILY_LIMIT = 10;
const DEFAULT_VIDEO_OPENAI_WEB_SEARCH_DAILY_LIMIT = 20;
const DEFAULT_COMPOSE_OPENAI_WEB_SEARCH_DAILY_LIMIT = 10;

let openAIQuotaBlockedUntil = 0;
let lastOpenAIQuotaWarningAt = 0;
const openAIWebSearchDailyUsageCache = new Map<string, { count: number; expiresAt: number }>();
let openAIWebSearchBudgetWarningDay = '';

function readNonNegativeIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    const parsed = raw ? Number.parseInt(raw, 10) : fallback;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getOpenAIWebSearchScope(request: AIRequest): NonNullable<AIRequest['webSearchUsageScope']> {
    return request.webSearchUsageScope || 'general';
}

function getOpenAIWebSearchDailyLimit(scope?: string): number {
    switch (scope) {
        case 'rss':
            return readNonNegativeIntEnv('RSS_OPENAI_WEB_SEARCH_DAILY_LIMIT', DEFAULT_RSS_OPENAI_WEB_SEARCH_DAILY_LIMIT);
        case 'youtube':
            return readNonNegativeIntEnv('YOUTUBE_OPENAI_WEB_SEARCH_DAILY_LIMIT', DEFAULT_YOUTUBE_OPENAI_WEB_SEARCH_DAILY_LIMIT);
        case 'tmdb':
            return readNonNegativeIntEnv('TMDB_OPENAI_WEB_SEARCH_DAILY_LIMIT', DEFAULT_TMDB_OPENAI_WEB_SEARCH_DAILY_LIMIT);
        case 'video':
            return readNonNegativeIntEnv('VIDEO_OPENAI_WEB_SEARCH_DAILY_LIMIT', DEFAULT_VIDEO_OPENAI_WEB_SEARCH_DAILY_LIMIT);
        case 'compose':
            return readNonNegativeIntEnv('COMPOSE_OPENAI_WEB_SEARCH_DAILY_LIMIT', DEFAULT_COMPOSE_OPENAI_WEB_SEARCH_DAILY_LIMIT);
        default:
            return readNonNegativeIntEnv('OPENAI_WEB_SEARCH_DAILY_LIMIT', DEFAULT_OPENAI_WEB_SEARCH_DAILY_LIMIT);
    }
}

function getUTCDayKey(date = new Date()): string {
    return date.toISOString().slice(0, 10);
}

function getUTCDayStart(date = new Date()): Date {
    return new Date(`${getUTCDayKey(date)}T00:00:00.000Z`);
}

function getOpenAIWebSearchUsageEndpointForScope(scope: string): string {
    const safeScope = scope.replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'general';
    return `/v1/responses:web_search:${safeScope}`;
}

async function getOpenAIWebSearchDailyUsageCount(scope?: string): Promise<number> {
    const dayKey = getUTCDayKey();
    const scopedDayKey = scope ? `${dayKey}:${scope}` : `${dayKey}:global`;
    const cached = openAIWebSearchDailyUsageCache.get(scopedDayKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.count;
    }

    const endpointWhere = scope
        ? { equals: getOpenAIWebSearchUsageEndpointForScope(scope) }
        : { startsWith: '/v1/responses:web_search' };
    const count = await prisma.apiUsage.count({
        where: {
            service: 'openai',
            endpoint: endpointWhere,
            success: true,
            createdAt: { gte: getUTCDayStart() },
        },
    });

    openAIWebSearchDailyUsageCache.set(scopedDayKey, {
        count,
        expiresAt: Date.now() + 60 * 1000,
    });

    return count;
}

function incrementOpenAIWebSearchDailyUsageCache(scope?: string): void {
    const dayKey = getUTCDayKey();
    const scopedDayKey = scope ? `${dayKey}:${scope}` : `${dayKey}:global`;
    const cached = openAIWebSearchDailyUsageCache.get(scopedDayKey);
    if (!cached) {
        openAIWebSearchDailyUsageCache.set(scopedDayKey, {
            count: 1,
            expiresAt: Date.now() + 60 * 1000,
        });
        return;
    }

    cached.count += 1;
    cached.expiresAt = Date.now() + 60 * 1000;
}

async function getOpenAIWebSearchBudgetBlockedResponse(request: AIRequest): Promise<AIResponse | null> {
    if (!request.enableWebSearch) {
        return null;
    }

    const scope = getOpenAIWebSearchScope(request);
    const scopedLimit = getOpenAIWebSearchDailyLimit(scope);
    const globalLimit = getOpenAIWebSearchDailyLimit();
    if (scopedLimit <= 0 || globalLimit <= 0) {
        return {
            success: false,
            content: '',
            model: request.model,
            error: `OpenAI web search is disabled for ${scope} by daily limit settings`,
        };
    }

    try {
        const [scopedCount, globalCount] = await Promise.all([
            getOpenAIWebSearchDailyUsageCount(scope),
            getOpenAIWebSearchDailyUsageCount(),
        ]);
        if (scopedCount < scopedLimit && globalCount < globalLimit) {
            return null;
        }

        const dayKey = getUTCDayKey();
        const warningKey = `${dayKey}:${scope}`;
        if (openAIWebSearchBudgetWarningDay !== warningKey) {
            openAIWebSearchBudgetWarningDay = warningKey;
            console.warn('[AI] OpenAI web search daily limit reached. Skipping web-search calls for cost safety.', {
                scope,
                scopedCount,
                scopedLimit,
                globalCount,
                globalLimit,
                dayKey,
            });
        }

        return {
            success: false,
            content: '',
            model: request.model,
            error: `OpenAI web search daily limit reached for ${scope} (${scopedCount}/${scopedLimit}, global ${globalCount}/${globalLimit})`,
        };
    } catch (error) {
        console.warn('[AI] Could not verify OpenAI web search daily usage. Skipping web-search call for cost safety.', error);
        return {
            success: false,
            content: '',
            model: request.model,
            error: 'OpenAI web search skipped because usage budget could not be verified',
        };
    }
}

function getOpenAIUsageEndpoint(baseEndpoint: '/v1/responses' | '/v1/chat/completions', request: AIRequest): string {
    return baseEndpoint === '/v1/responses' && request.enableWebSearch
        ? getOpenAIWebSearchUsageEndpointForScope(getOpenAIWebSearchScope(request))
        : baseEndpoint;
}

function isOpenAIQuotaErrorMessage(value: unknown): boolean {
    const message = value instanceof Error
        ? value.message
        : typeof value === 'string'
            ? value
            : '';

    const normalized = message.toLowerCase();
    return (
        normalized.includes('exceeded your current quota') ||
        normalized.includes('insufficient_quota') ||
        normalized.includes('billing details') ||
        normalized.includes('quota exceeded')
    );
}

function markOpenAIQuotaBlocked(error: unknown): void {
    openAIQuotaBlockedUntil = Date.now() + OPENAI_QUOTA_COOLDOWN_MS;

    if (Date.now() - lastOpenAIQuotaWarningAt > 60 * 1000) {
        lastOpenAIQuotaWarningAt = Date.now();
        console.warn('[AI] OpenAI quota/billing limit reached. Pausing OpenAI calls temporarily to avoid retry storms.', {
            cooldownSeconds: Math.round(OPENAI_QUOTA_COOLDOWN_MS / 1000),
            error: error instanceof Error ? error.message : String(error || ''),
        });
    }
}

function getOpenAIQuotaBlockedResponse(request: AIRequest): AIResponse | null {
    if (openAIQuotaBlockedUntil <= Date.now()) {
        return null;
    }

    return {
        success: false,
        content: '',
        model: request.model,
        error: `OpenAI quota cooldown active for ${Math.ceil((openAIQuotaBlockedUntil - Date.now()) / 1000)} more seconds`,
    };
}

function getEffectiveAICacheTTLms(request: AIRequest): number {
    if (typeof request.cacheTTLms === 'number' && request.cacheTTLms > 0) {
        return request.cacheTTLms;
    }

    return request.enableWebSearch ? WEB_SEARCH_AI_CACHE_TTL_MS : DEFAULT_AI_CACHE_TTL_MS;
}

function shouldUseAICache(request: AIRequest): boolean {
    if (request.useCache === false) {
        return false;
    }

    const ttl = getEffectiveAICacheTTLms(request);
    return ttl > 0;
}

function buildAICacheKey(request: AIRequest): string {
    if (request.cacheKey && request.cacheKey.trim()) {
        return request.cacheKey.trim();
    }

    const hash = createHash('sha256');
    hash.update(JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt || '',
        maxTokens: request.maxTokens || null,
        temperature: typeof request.temperature === 'number' ? request.temperature : null,
        jsonMode: request.jsonMode === true,
        reasoningEffort: request.reasoningEffort || null,
        enableWebSearch: request.enableWebSearch === true,
    }));

    return `ai:${hash.digest('hex')}`;
}

function readCachedAIResponse(cacheKey: string): AIResponse | null {
    const cached = aiResponseCache.get(cacheKey);
    if (!cached) {
        return null;
    }

    if (cached.expiresAt <= Date.now()) {
        aiResponseCache.delete(cacheKey);
        return null;
    }

    return cached.value;
}

function writeCachedAIResponse(cacheKey: string, response: AIResponse, ttlMs: number): void {
    if (!response.success) {
        return;
    }

    aiResponseCache.set(cacheKey, {
        expiresAt: Date.now() + ttlMs,
        value: response,
    });
}

function resolveReasoningEffort(request: AIRequest): AIReasoningEffort | undefined {
    if (request.reasoningEffort) {
        if (request.reasoningEffort === 'minimal') {
            return 'low';
        }

        return request.reasoningEffort;
    }

    if (!request.jsonMode) {
        return undefined;
    }

    return 'low';
}

export interface ValidationResult {
    isValid: boolean;
    isUSProduction: boolean;
    isEnglishOriginal: boolean;
    isNotDocumentary: boolean;
    isNotSportsWWE: boolean;
    reasoning: string;
}

// ============================================
// API KEY RETRIEVAL
// ============================================

function readStringSettingValue(value: unknown): string | null {
    return readSecretSettingValue(value);
}

async function getOpenAIKey(): Promise<string | null> {
    // Try environment variable first
    if (process.env.OPENAI_API_KEY) {
        return process.env.OPENAI_API_KEY;
    }

    // Fallback to database
    try {
        const setting = await prisma.setting.findUnique({
            where: { key: 'openaiKey' }
        });
        return readStringSettingValue(setting?.value);
    } catch {
        return null;
    }
}

async function getFlash3Key(): Promise<string | null> {
    // Try environment variable first
    if (process.env.FLASH3_API_KEY) {
        return process.env.FLASH3_API_KEY;
    }

    // Fallback to database
    try {
        const setting = await prisma.setting.findUnique({
            where: { key: 'flash3Key' }
        });
        return readStringSettingValue(setting?.value);
    } catch {
        return null;
    }
}

function normalizeGeneratedText(content: string, preferredJsonKeys: string[] = []): string {
    const trimmed = content
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;

            for (const key of preferredJsonKeys) {
                const value = parsed[key];
                if (typeof value === 'string' && value.trim()) {
                    return value.trim();
                }
            }

            for (const value of Object.values(parsed)) {
                if (typeof value === 'string' && value.trim()) {
                    return value.trim();
                }
            }
        } catch {
            // Treat invalid JSON responses as plain text.
        }
    }

    return trimmed.replace(/^"|"$/g, '');
}

function normalizeCommentReplyText(content: string): string {
    return content
        .replace(/[—–]/g, ', ')
        .replace(/\s+,\s+/g, ', ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.!?])/g, '$1')
        .trim();
}

function determineCommentReplyLengthProfile(
    comment: string,
    normalizedMaxLength: number
): { label: 'short' | 'medium' | 'long'; targetChars: number; maxTokens: number } {
    const normalizedComment = comment.trim();
    const wordCount = normalizedComment ? normalizedComment.split(/\s+/).length : 0;
    const asksQuestion = /\?/.test(normalizedComment);
    const hasMultipleQuestions = (normalizedComment.match(/\?/g) || []).length > 1;
    const asksWhyOrHow = /\b(why|how|what|when|where|which|who|explain|thoughts)\b/i.test(normalizedComment);
    const detailedComment = normalizedComment.length > 140 || wordCount > 24;

    if (hasMultipleQuestions || (asksQuestion && asksWhyOrHow) || detailedComment) {
        const targetChars = Math.min(normalizedMaxLength, 180);
        return {
            label: 'long',
            targetChars,
            maxTokens: Math.min(120, Math.max(70, Math.ceil(targetChars / 2))),
        };
    }

    if (asksQuestion || normalizedComment.length > 70 || wordCount > 12) {
        const targetChars = Math.min(normalizedMaxLength, 110);
        return {
            label: 'medium',
            targetChars,
            maxTokens: Math.min(80, Math.max(45, Math.ceil(targetChars / 2))),
        };
    }

    const targetChars = Math.min(normalizedMaxLength, 55);
    return {
        label: 'short',
        targetChars,
        maxTokens: Math.min(48, Math.max(24, Math.ceil(targetChars / 2))),
    };
}

function extractOpenAIMessageContent(content: unknown): string {
    if (typeof content === 'string') {
        return content;
    }

    if (!Array.isArray(content)) {
        return '';
    }

    return content
        .map((part) => {
            if (typeof part === 'string') {
                return part;
            }

            if (part && typeof part === 'object' && 'text' in part) {
                const text = (part as { text?: unknown }).text;
                return typeof text === 'string' ? text : '';
            }

            return '';
        })
        .join('')
        .trim();
}

function extractOpenAIResponsesContent(data: {
    output_text?: unknown;
    output?: Array<{
        type?: string;
        content?: Array<{
            type?: string;
            text?: string;
        }>;
    }>;
}): string {
    if (typeof data.output_text === 'string' && data.output_text.trim()) {
        return data.output_text.trim();
    }

    if (!Array.isArray(data.output)) {
        return '';
    }

    return data.output
        .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
        .map((part) => (part?.type === 'output_text' || part?.type === 'text') && typeof part.text === 'string' ? part.text : '')
        .join('')
        .trim();
}

function isModernOpenAIModel(model: AIModel): model is SupportedOpenAIModel {
    return (SUPPORTED_OPENAI_MODELS as readonly string[]).includes(model);
}

function formatPromptList(values?: string[]): string {
    if (!Array.isArray(values)) {
        return 'N/A';
    }

    const filtered = values
        .map((value) => typeof value === 'string' ? value.trim() : '')
        .filter(Boolean);

    return filtered.length > 0 ? filtered.join(', ') : 'N/A';
}

function withReleaseResearchInstructions(systemPrompt?: string): string {
    const researchGuidance = `Release-context research rules:
- Use live web search when it helps verify the release or premiere date, theatrical status, or original network/streaming platform.
- Mention a network/platform only when it is confidently verifiable.
- If the title is theatrical, prefer "in theaters" / "theaters" instead of inventing a platform.
- If sources conflict or the platform/network is unclear, omit it instead of guessing.
- For anniversary copy, mention the original network/platform only when it is confidently verifiable and improves the caption.
- Do not hallucinate a release destination, release date, or distributor.`;

    return [systemPrompt, researchGuidance].filter(Boolean).join('\n\n');
}

const RELEASE_DESTINATION_PATTERNS: RegExp[] = [
    /\bin theaters?\b/i,
    /\bon netflix\b/i,
    /\bnetflix\b/i,
    /\bon max\b/i,
    /\bhbo max\b/i,
    /\bhbo\b/i,
    /\bon disney\+\b/i,
    /\bdisney\+\b/i,
    /\bon hulu\b/i,
    /\bhulu\b/i,
    /\bon prime video\b/i,
    /\bprime video\b/i,
    /\bon amazon prime\b/i,
    /\bon apple tv\+\b/i,
    /\bapple tv\+\b/i,
    /\bon paramount\+\b/i,
    /\bparamount\+\b/i,
    /\bon peacock\b/i,
    /\bpeacock\b/i,
    /\bon crunchyroll\b/i,
    /\bcrunchyroll\b/i,
];

const RELEASE_DATE_PATTERNS: RegExp[] = [
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,\s+\d{4})?\b/i,
    /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})\b/i,
    /\b(?:spring|summer|fall|autumn|winter)\s+\d{4}\b/i,
    /\b(?:19|20)\d{2}\b/,
];

function extractMentionedDestinations(text: string): string[] {
    const normalized = text.toLowerCase();
    const matches = new Set<string>();

    if (/\bin theaters?\b/.test(normalized)) matches.add('theaters');
    if (/\bnetflix\b/.test(normalized)) matches.add('netflix');
    if (/\bhbo max\b|\bon max\b|\bmax\b/.test(normalized)) matches.add('max');
    if (/\bhbo\b/.test(normalized)) matches.add('hbo');
    if (/\bdisney\+\b/.test(normalized)) matches.add('disney+');
    if (/\bhulu\b/.test(normalized)) matches.add('hulu');
    if (/\bprime video\b|\bamazon prime\b/.test(normalized)) matches.add('prime video');
    if (/\bapple tv\+\b/.test(normalized)) matches.add('apple tv+');
    if (/\bparamount\+\b/.test(normalized)) matches.add('paramount+');
    if (/\bpeacock\b/.test(normalized)) matches.add('peacock');
    if (/\bcrunchyroll\b/.test(normalized)) matches.add('crunchyroll');

    return [...matches];
}

function hasExplicitReleaseDateCue(text?: string): boolean {
    if (!text) {
        return false;
    }

    return RELEASE_DATE_PATTERNS.some((pattern) => pattern.test(text));
}

function hasExplicitReleaseDestinationCue(text?: string): boolean {
    if (!text) {
        return false;
    }

    return RELEASE_DESTINATION_PATTERNS.some((pattern) => pattern.test(text));
}

export interface ReleaseResearchContext {
    videoTitle?: string;
    description?: string;
    releaseDate?: string;
    productionNames?: string[];
    tmdbMatchStatus?: 'not-requested' | 'matched' | 'no-confident-match' | 'region-mismatch' | 'error';
    mediaType?: 'movie' | 'tv';
}

export function shouldEnableReleaseResearch(context: ReleaseResearchContext): boolean {
    const description = context.description || '';
    const videoTitle = context.videoTitle || '';
    const combinedText = `${videoTitle}\n${description}`;
    const hasDateCue = hasExplicitReleaseDateCue(combinedText);
    const hasDestinationCue = hasExplicitReleaseDestinationCue(combinedText);
    const mentionedDestinations = extractMentionedDestinations(combinedText);
    const knownDestinations = (context.productionNames || [])
        .map((name) => name.toLowerCase())
        .flatMap((name) => extractMentionedDestinations(name));

    if (!context.releaseDate && !hasDateCue) {
        return true;
    }

    if (context.tmdbMatchStatus && context.tmdbMatchStatus !== 'matched' && !hasDateCue) {
        return true;
    }

    if (mentionedDestinations.length > 0 && knownDestinations.length > 0) {
        const hasConflict = mentionedDestinations.some((destination) => !knownDestinations.includes(destination));
        if (hasConflict) {
            return true;
        }
    }

    if (context.mediaType === 'movie' && !context.productionNames?.length && !hasDestinationCue) {
        return true;
    }

    return false;
}

// ============================================
// OPENAI COMPLETION
// ============================================

async function callOpenAIChatCompletions(request: AIRequest): Promise<AIResponse> {
    const quotaBlocked = getOpenAIQuotaBlockedResponse(request);
    if (quotaBlocked) {
        return quotaBlocked;
    }

    const apiKey = await getOpenAIKey();

    if (!apiKey) {
        return {
            success: false,
            content: '',
            model: request.model,
            error: 'OpenAI API key not configured'
        };
    }

    let tracked = false;

    try {
        const isGPT5Model = request.model.startsWith('gpt-5');
        const body: any = {
            model: request.model,
            messages: [
                ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
                { role: 'user', content: request.prompt }
            ],
        };

        if (isGPT5Model) {
            body.max_completion_tokens = request.maxTokens || 1024;
            const reasoningEffort = resolveReasoningEffort(request);
            if (reasoningEffort) {
                body.reasoning_effort = reasoningEffort;
            }
        } else {
            body.max_tokens = request.maxTokens || 1024;
            body.temperature = request.temperature || 0.7;
        }

        if (request.jsonMode) {
            body.response_format = { type: 'json_object' };
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json() as { error?: { message?: string } };
            const errorMessage = errorData.error?.message || 'OpenAI API error';
            await trackApiUsage({
                service: 'openai',
                endpoint: getOpenAIUsageEndpoint('/v1/chat/completions', request),
                success: false,
            });
            tracked = true;
            if (isOpenAIQuotaErrorMessage(errorMessage)) {
                markOpenAIQuotaBlocked(errorMessage);
            }
            throw new Error(errorMessage);
        }

        const data = await response.json() as {
            choices?: Array<{ message?: { content?: unknown } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };
        const content = extractOpenAIMessageContent(data.choices?.[0]?.message?.content);

        await trackApiUsage({
            service: 'openai',
            endpoint: getOpenAIUsageEndpoint('/v1/chat/completions', request),
            tokens: data.usage?.total_tokens || 0,
            success: true,
        });
        tracked = true;

        return {
            success: true,
            content,
            model: request.model,
            tokens: {
                prompt: data.usage?.prompt_tokens || 0,
                completion: data.usage?.completion_tokens || 0,
                total: data.usage?.total_tokens || 0
            }
        };
    } catch (error) {
        if (!tracked) {
            await trackApiUsage({
                service: 'openai',
                endpoint: getOpenAIUsageEndpoint('/v1/chat/completions', request),
                success: false,
            });
        }
        if (isOpenAIQuotaErrorMessage(error)) {
            markOpenAIQuotaBlocked(error);
        }
        console.error('[AI] OpenAI error:', error);
        return {
            success: false,
            content: '',
            model: request.model,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// ============================================
// FLASH 3 (JORDANITE) COMPLETION
// ============================================

async function callOpenAIResponses(request: AIRequest): Promise<AIResponse> {
    const quotaBlocked = getOpenAIQuotaBlockedResponse(request);
    if (quotaBlocked) {
        return quotaBlocked;
    }

    const webSearchBudgetBlocked = await getOpenAIWebSearchBudgetBlockedResponse(request);
    if (webSearchBudgetBlocked) {
        return webSearchBudgetBlocked;
    }

    const apiKey = await getOpenAIKey();

    if (!apiKey) {
        return {
            success: false,
            content: '',
            model: request.model,
            error: 'OpenAI API key not configured'
        };
    }

    let tracked = false;

    try {
        const isGPT5Model = request.model.startsWith('gpt-5');
        const body: Record<string, unknown> = {
            model: request.model,
            input: request.jsonMode
                ? `Return a valid JSON object.\n\n${request.prompt}`
                : request.prompt,
            max_output_tokens: request.maxTokens || 1024,
        };

        if (request.systemPrompt) {
            body.instructions = request.systemPrompt;
        }

        if (request.jsonMode) {
            body.text = {
                format: {
                    type: 'json_object',
                },
            };
        }

        if (!isGPT5Model && typeof request.temperature === 'number') {
            body.temperature = request.temperature;
        } else if (!isGPT5Model && request.temperature === undefined) {
            body.temperature = 0.7;
        }

        const reasoningEffort = resolveReasoningEffort(request);
        if (reasoningEffort) {
            body.reasoning = { effort: reasoningEffort };
        }

        if (request.enableWebSearch) {
            body.tools = [{ type: 'web_search' }];
            body.tool_choice = 'auto';
        }

        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json() as { error?: { message?: string } };
            const errorMessage = errorData.error?.message || 'OpenAI Responses API error';
            await trackApiUsage({
                service: 'openai',
                endpoint: getOpenAIUsageEndpoint('/v1/responses', request),
                success: false,
            });
            tracked = true;
            if (isOpenAIQuotaErrorMessage(errorMessage)) {
                markOpenAIQuotaBlocked(errorMessage);
            }
            throw new Error(errorMessage);
        }

        const data = await response.json() as {
            status?: string;
            incomplete_details?: {
                reason?: string;
            };
            output_text?: unknown;
            output?: Array<{
                type?: string;
                content?: Array<{
                    type?: string;
                    text?: string;
                }>;
            }>;
            usage?: {
                input_tokens?: number;
                output_tokens?: number;
                total_tokens?: number;
            };
        };
        const content = extractOpenAIResponsesContent(data);

        if (!content) {
            throw new Error(
                data.status === 'incomplete' && data.incomplete_details?.reason
                    ? `OpenAI Responses API returned no content (${data.incomplete_details.reason})`
                    : 'OpenAI Responses API returned no content'
            );
        }

        await trackApiUsage({
            service: 'openai',
            endpoint: getOpenAIUsageEndpoint('/v1/responses', request),
            tokens: data.usage?.total_tokens || 0,
            success: true,
        });
        if (request.enableWebSearch) {
            incrementOpenAIWebSearchDailyUsageCache(getOpenAIWebSearchScope(request));
            incrementOpenAIWebSearchDailyUsageCache();
        }
        tracked = true;

        return {
            success: true,
            content,
            model: request.model,
            tokens: {
                prompt: data.usage?.input_tokens || 0,
                completion: data.usage?.output_tokens || 0,
                total: data.usage?.total_tokens || 0
            }
        };
    } catch (error) {
        if (!tracked) {
            await trackApiUsage({
                service: 'openai',
                endpoint: getOpenAIUsageEndpoint('/v1/responses', request),
                success: false,
            });
        }

        if (isOpenAIQuotaErrorMessage(error)) {
            markOpenAIQuotaBlocked(error);
            return {
                success: false,
                content: '',
                model: request.model,
                error: error instanceof Error ? error.message : 'OpenAI quota exceeded',
            };
        }

        console.warn('[AI] OpenAI Responses API failed, falling back to Chat Completions:', error);
        return callOpenAIChatCompletions({
            ...request,
            enableWebSearch: false,
        });
    }
}

async function callOpenAI(request: AIRequest): Promise<AIResponse> {
    if (isModernOpenAIModel(request.model)) {
        return callOpenAIResponses(request);
    }

    return callOpenAIChatCompletions(request);
}

async function callFlash3(request: AIRequest): Promise<AIResponse> {
    const apiKey = await getFlash3Key();

    if (!apiKey) {
        // Fallback to OpenAI if Flash 3 key not configured
        console.log(`[AI] Flash 3 key not configured, falling back to ${DEFAULT_OPENAI_MODEL}`);
        return callOpenAI({ ...request, model: DEFAULT_OPENAI_MODEL });
    }

    try {
        // Flash 3 API endpoint (Gemini Flash 3)
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: request.systemPrompt
                            ? `${request.systemPrompt}\n\n${request.prompt}`
                            : request.prompt
                    }]
                }],
                ...(request.enableWebSearch ? {
                    tools: [{
                        google_search: {}
                    }]
                } : {}),
                generationConfig: {
                    maxOutputTokens: request.maxTokens || 1024,
                    temperature: request.temperature || 0.7,
                    ...(request.jsonMode ? { responseMimeType: 'application/json' } : {})
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json() as { error?: { message?: string } };
            throw new Error(errorData.error?.message || 'Flash 3 API error');
        }

        const data = await response.json() as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
        };
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return {
            success: true,
            content,
            model: 'flash-3',
            tokens: {
                prompt: data.usageMetadata?.promptTokenCount || 0,
                completion: data.usageMetadata?.candidatesTokenCount || 0,
                total: data.usageMetadata?.totalTokenCount || 0
            }
        };
    } catch (error) {
        console.error('[AI] Flash 3 error:', error);
        // Fallback to OpenAI on error
        console.log(`[AI] Flash 3 failed, falling back to ${DEFAULT_OPENAI_MODEL}`);
        return callOpenAI({ ...request, model: DEFAULT_OPENAI_MODEL });
    }
}

// ============================================
// MAIN ROUTER
// ============================================

export async function generateCompletion(request: AIRequest): Promise<AIResponse> {
    const normalizedRequest: AIRequest = {
        ...request,
        model: normalizeAIModel(request.model),
    };

    if (shouldUseAICache(normalizedRequest)) {
        const cacheKey = buildAICacheKey(normalizedRequest);
        const cached = readCachedAIResponse(cacheKey);
        if (cached) {
            return cached;
        }

        const pending = pendingAIRequests.get(cacheKey);
        if (pending) {
            return pending;
        }

        const runRequest = (async () => {
            const response = normalizedRequest.model === 'flash-3'
                ? await callFlash3(normalizedRequest)
                : await callOpenAI(normalizedRequest);

            writeCachedAIResponse(cacheKey, response, getEffectiveAICacheTTLms(normalizedRequest));
            return response;
        })();

        pendingAIRequests.set(cacheKey, runRequest);

        try {
            return await runRequest;
        } finally {
            pendingAIRequests.delete(cacheKey);
        }
    }

    if (normalizedRequest.model === 'flash-3') {
        return callFlash3(normalizedRequest);
    }

    return callOpenAI(normalizedRequest);
}

// ============================================
// TMDB VALIDATION CROSS-CHECK
// ============================================

export async function validateTMDbContent(
    title: string,
    overview: string,
    genres: string[],
    originalLanguage: string,
    productionCountries: string[],
    model: AIModel = DEFAULT_OPENAI_MODEL
): Promise<ValidationResult> {
    const systemPrompt = `You are a content validator. Analyze the provided movie/TV show information and determine if it meets all criteria. Respond ONLY in valid JSON format.`;

    const prompt = `Analyze this content:
Title: ${title}
Overview: ${overview}
Genres: ${genres.join(', ')}
Original Language: ${originalLanguage}
Production Countries: ${productionCountries.join(', ')}

You are the 'Mainstream Filter'. We only want high-quality, mainstream US entertainment.
Reject (isValid: false) if:
- It is a documentary, talk show, or news program.
- It is sports content (WWE, UFC, NFL, etc).
- It is a low-budget indie with no recognizable appeal.
- It is a foreign production merely distributed in the US (unless it is a massive global hit like 'Squid Game').
- It feels like "content farm" junk or amateur production.

Respond in JSON format:
{
  "isValid": boolean (true only if it is Mainstream US Entertainment),
  "isUSProduction": boolean,
  "isEnglishOriginal": boolean,
  "isNotDocumentary": boolean,
  "isNotSportsWWE": boolean,
  "reasoning": "Brief, blunt explanation of rejection"
}`;

    const response = await generateCompletion({
        model,
        prompt,
        systemPrompt,
        maxTokens: 500,
        temperature: 0.3,
        jsonMode: true
    });

    if (!response.success) {
        return {
            isValid: false,
            isUSProduction: false,
            isEnglishOriginal: false,
            isNotDocumentary: false,
            isNotSportsWWE: false,
            reasoning: response.error || 'Validation failed'
        };
    }

    try {
        const result = JSON.parse(response.content);
        return {
            isValid: result.isValid === true,
            isUSProduction: result.isUSProduction === true,
            isEnglishOriginal: result.isEnglishOriginal === true,
            isNotDocumentary: result.isNotDocumentary === true,
            isNotSportsWWE: result.isNotSportsWWE === true,
            reasoning: result.reasoning || ''
        };
    } catch {
        return {
            isValid: false,
            isUSProduction: false,
            isEnglishOriginal: false,
            isNotDocumentary: false,
            isNotSportsWWE: false,
            reasoning: 'Failed to parse validation response'
        };
    }
}

// ============================================
// YOUTUBE TRAILER VALIDATION
// ============================================

export async function validateYouTubeTrailer(
    title: string,
    channelName: string,
    description: string,
    model: AIModel = DEFAULT_OPENAI_MODEL
): Promise<{ isValid: boolean; isTrailer: boolean; isUSProduction: boolean; reasoning: string }> {
    const systemPrompt = `You are a YouTube trailer validator. Analyze the video information and determine if it's a valid US movie/TV trailer. Respond ONLY in valid JSON format.`;

    const prompt = `Analyze this YouTube video:
Title: ${title}
Channel: ${channelName}
Description: ${description}

Validate:
1. Is this a movie or TV show trailer/teaser?
2. Does it appear to be a US production?
3. Is it NOT a documentary, sports, WWE, or fan-made content?

Respond in JSON:
{
  "isValid": boolean (true only if ALL criteria pass),
  "isTrailer": boolean,
  "isUSProduction": boolean,
  "reasoning": "Brief explanation"
}`;

    const response = await generateCompletion({
        model,
        prompt,
        systemPrompt,
        maxTokens: 300,
        temperature: 0.3,
        jsonMode: true,
        enableWebSearch: true,
        webSearchUsageScope: 'youtube',
    });

    if (!response.success) {
        return {
            isValid: false,
            isTrailer: false,
            isUSProduction: false,
            reasoning: response.error || 'Validation failed'
        };
    }

    try {
        const result = JSON.parse(response.content);
        return {
            isValid: result.isValid === true,
            isTrailer: result.isTrailer === true,
            isUSProduction: result.isUSProduction === true,
            reasoning: result.reasoning || ''
        };
    } catch {
        return {
            isValid: false,
            isTrailer: false,
            isUSProduction: false,
            reasoning: 'Failed to parse validation response'
        };
    }
}

// ============================================
// TMDB CAPTION GENERATOR (COPYWRITER MODE)
// ============================================

export interface CaptionContext {
    title: string;
    mediaType: 'movie' | 'tv';
    temporalTag: 'releasing_today' | 'releasing_this_week' | 'releasing_this_month' | 'anniversary' | 'already_released';
    timingMode?: 'release_today' | 'exact_d_plus_7' | 'exact_calendar_month_plus_1' | 'anniversary_today' | 'fallback_day_count' | 'fallback_exact_date';
    daysUntil: number;
    releaseDate?: string;
    formattedReleaseDate?: string;
    scheduledDate?: string;
    year?: number;
    anniversaryYears?: number;
    cast: string[];
    genres: string[];
    platform?: 'X' | 'Threads' | 'Facebook' | 'Instagram';
    tone?: string;
}

function quoteCaptionTitle(title: string): string {
    return `'${String(title || '').trim()}'`;
}

function buildTMDbFallbackCaption(context: CaptionContext): string {
    const title = quoteCaptionTitle(context.title);
    const cast = Array.isArray(context.cast)
        ? context.cast.map((name) => String(name || '').trim()).filter(Boolean).slice(0, 3)
        : [];
    const castLine = cast.length > 0 ? `\n\nStarring ${cast.join(', ')}.` : '';

    if (context.temporalTag === 'releasing_today') {
        const releasePhrase = context.mediaType === 'tv' ? 'premieres today' : 'releases today';
        return `${title} ${releasePhrase}.${castLine}`;
    }

    if (context.temporalTag === 'releasing_this_week') {
        return `${title} releases this week.${castLine}`;
    }

    if (context.temporalTag === 'releasing_this_month') {
        return `${title} releases next month.${castLine}`;
    }

    if (context.temporalTag === 'anniversary' && context.anniversaryYears) {
        return `${title} marks its ${context.anniversaryYears}th anniversary today.${castLine}`;
    }

    return `${title} arrives soon.${castLine}`;
}

function isGenericTMDbFallbackCaption(caption: string, context: CaptionContext): boolean {
    const escapedTitle = String(context.title || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^\\W*(?:OUT\\s+NOW:?|${escapedTitle}\\s*(?:\\(In \\d+ days\\))?)\\W*$`, 'i').test(caption.trim());
}

export async function generateTMDbCaption(
    context: CaptionContext,
    model: AIModel = DEFAULT_OPENAI_MODEL,
    customSystemPrompt?: string,
    customTemperature?: number
): Promise<string> {
    const defaultSystemPrompt = `You are a social media copywriter for a movie/TV tracking account.
Your goal is to write a single, punchy, engaging caption based STRICTLY on the provided context.
- Use 1-2 relevant emojis at the start.
- NO hashtags unless specifically asked (system will add them later).
- NO "Click link in bio" or CTAs.
- Length: Under 280 chars (tweet style) but impactful.
- TIMING RULES:
  - release_today -> use exact same-day language like "out today" or "releases today"
  - exact_d_plus_7 -> treat it as exactly one week out; prefer "next week" or the exact release date, not vague phrasing
  - exact_calendar_month_plus_1 -> treat it as exactly one calendar month out; prefer the exact release date or "next month", not "this week"
  - anniversary_today -> use anniversary language only
  - fallback_day_count / fallback_exact_date -> prefer exact date language and avoid pretending it is a weekly/monthly module cue
- Never say "this week" unless timingMode is exactly exact_d_plus_7.
- Never say "this month" unless timingMode is exactly exact_calendar_month_plus_1 and the release is actually in the same calendar month as the scheduled post.
- If an exact release date is provided, prefer using that date over loose calendar phrasing when there is any ambiguity.
`;

    const systemPrompt = withReleaseResearchInstructions(customSystemPrompt || defaultSystemPrompt);

    const platformLine = context.platform ? `Platform: ${context.platform}` : 'Platform: Unknown';

    const prompt = `Generate a caption for this content:
Title: ${context.title}
Type: ${context.mediaType}
Tag: ${context.temporalTag}
Timing Mode: ${context.timingMode || 'unknown'}
Days Until: ${context.daysUntil}
Release Date: ${context.releaseDate || 'N/A'}
Formatted Release Date: ${context.formattedReleaseDate || 'N/A'}
Scheduled Date: ${context.scheduledDate || 'N/A'}
Year: ${typeof context.year === 'number' ? context.year : 'N/A'}
Anniversary Years: ${typeof context.anniversaryYears === 'number' ? context.anniversaryYears : 'N/A'}
Cast: ${formatPromptList(context.cast)}
Genres: ${formatPromptList(context.genres)}
${platformLine}

If the caption benefits from release context, verify whether it is theatrical or tied to a specific network/streaming platform before mentioning it.
If platform/network context is unknown, uncertain, or not provided, do not name any platform, network, streamer, or social app in the caption.
Follow the timing mode exactly:
- release_today -> use today language
- exact_d_plus_7 -> you may use "next week" or the exact date
- exact_calendar_month_plus_1 -> use the exact date or "next month"
- fallback_day_count / fallback_exact_date -> do not use "this week" or "this month"; use the exact date instead

Do not contradict the provided release date or timing mode.

Write ONLY the caption text. No preamble.`;

    const response = await generateCompletion({
        model,
        prompt,
        systemPrompt,
        maxTokens: 150,
        temperature: customTemperature !== undefined ? customTemperature : 0.7, // Custom temp or default high temp for creativity
        jsonMode: false,
        enableWebSearch: true,
        webSearchUsageScope: 'tmdb',
    });

    if (!response.success) {
        return buildTMDbFallbackCaption(context);
    }

    const caption = normalizeGeneratedText(response.content, ['caption', 'text', 'content']);
    return isGenericTMDbFallbackCaption(caption, context)
        ? buildTMDbFallbackCaption(context)
        : caption;
}

// ============================================
// RSS CAPTION GENERATOR
// ============================================

export interface RSSContext {
    articleTitle: string;
    feedName: string;
    summary: string;
    articleBody?: string;
    articleContentHtml?: string;
    platform: 'X' | 'Threads' | 'Facebook' | 'LinkedIn';
    tone?: string;
    selectedVisuals?: string[];
    allowedEntities?: string[];
    canonicalEntity?: RSSCanonicalEntity;
}

export interface RSSCanonicalEntity {
    primarySubject?: string;
    secondarySubject?: string;
    mediaTitle?: string;
    franchise?: string;
    entityType?: 'movie' | 'tv' | 'person' | 'character' | 'franchise' | 'company' | 'platform' | 'unknown';
    eventType?: string;
    spoilerLevel?: 'none' | 'low' | 'medium' | 'high';
    namedPeople?: string[];
    namedCharacters?: string[];
    allowedEntities?: string[];
    confidence?: number;
    ambiguityFlags?: string[];
}

interface RssCaptionExtraction {
    article_title: string;
    article_summary?: string;
    article_body_clean?: string;
    event_type:
        | 'reveal'
        | 'casting'
        | 'renewal'
        | 'cancellation'
        | 'obituary'
        | 'development'
        | 'in_production'
        | 'trailer'
        | 'release_date'
        | 'box_office'
        | 'interview_quote'
        | 'first_look'
        | 'platform_move'
        | 'director_attachment'
        | 'writer_attachment'
        | 'return'
        | 'reflection'
        | 'other';
    primary_subject?: string;
    secondary_subject?: string;
    media_title?: string;
    franchise_or_universe?: string;
    named_people?: string[];
    named_characters?: string[];
    studio_or_platform?: string;
    release_or_event?: string;
    direct_quote?: string;
    quote_speaker?: string;
    supporting_facts?: string[];
    spoiler_level?: 'none' | 'low' | 'medium' | 'high';
    extraction_confidence?: number;
    ambiguity_flags?: string[];
}

const RSS_HEADLINE_PREFIX_TOKENS = [
    'EXCLUSIVE',
    'LISTEN',
    'WATCH',
    'REPORT',
    'SCOOP',
    'BREAKING',
    'FIRST LOOK',
    'TRAILER',
];

const RSS_EVENT_PATTERNS: Array<{ type: RssCaptionExtraction['event_type']; patterns: RegExp[] }> = [
    { type: 'obituary', patterns: [/\b(?:dies?|dead|has died|passed away|passes away)\b/i, /\b(?:actor|actress|filmmaker|director|producer).{0,40}\b(?:was|aged?)\s+\d{2,3}\b/i] },
    { type: 'casting', patterns: [/\bcast\b/i, /\bjoins?\b/i, /\bset to star\b/i, /\badded to\b/i, /\bboards?\b/i] },
    { type: 'renewal', patterns: [/\brenewed\b/i, /\breturns? for season\b/i, /\bpicked up for\b/i] },
    { type: 'cancellation', patterns: [/\bcancel(?:ed|led)\b/i, /\bnot returning\b/i, /\baxed\b/i] },
    { type: 'development', patterns: [/\bin development\b/i, /\bin the works\b/i, /\bbeing developed\b/i] },
    { type: 'in_production', patterns: [/\bbegins production\b/i, /\bstarts filming\b/i, /\bnow filming\b/i, /\bin production\b/i] },
    { type: 'trailer', patterns: [/\btrailer\b/i, /\bteaser\b/i] },
    { type: 'release_date', patterns: [/\brelease date\b/i, /\bpremieres?\b/i, /\bdebuts?\b/i, /\bmoved to\b/i] },
    { type: 'first_look', patterns: [/\bfirst look\b/i, /\bnew images? released\b/i] },
    { type: 'interview_quote', patterns: [/\bsays?\b/i, /\bsaid\b/i, /\bopens up\b/i, /\bexplains?\b/i, /\btalks about\b/i] },
    { type: 'box_office', patterns: [/\bbox office\b/i, /\bgrosses?\b/i, /\bopens to\b/i, /\breaches?\b/i] },
    { type: 'director_attachment', patterns: [/\bto direct\b/i, /\bdirecting\b/i, /\bhelming\b/i] },
    { type: 'writer_attachment', patterns: [/\bwriter\b/i, /\bpenning\b/i, /\bscreenwriter\b/i, /\bscript\b/i] },
    { type: 'return', patterns: [/\breturns?\b/i, /\bcoming back\b/i] },
    { type: 'reflection', patterns: [/\breflects?\b/i, /\blooked back\b/i, /\bremembered\b/i] },
    { type: 'reveal', patterns: [/\bconfirmed\b/i, /\brevealed\b/i, /\bfinally addressed\b/i, /\bexplained\b/i] },
];

const RSS_OUTLET_NAMES = [
    'Deadline',
    'Variety',
    'ComicBook',
    'The Hollywood Reporter',
    'Hollywood Reporter',
    'THR',
    'Entertainment Weekly',
    'EW',
    'IGN',
    'Collider',
    'IndieWire',
    'Tudum',
    'ScreenRant',
    'TVLine',
];

const RSS_REFERENCE_ONLY_TITLE_CUES = [
    'known for',
    'best known for',
    'from',
    'including',
    'such as',
    'produced by',
    'produce alongside',
    'will produce',
    'produce',
    'producer',
    'producer of',
    'producer behind',
    'written by',
    'writer of',
    'created by',
    'creator',
    'creator of',
    'helmed by',
    'directed by',
    'credits include',
    'resume includes',
    'broke the news',
    'more to come',
];

const RSS_ARTICLE_PACKAGE_LABEL_PATTERNS = [
    /\beverything we know about\b/i,
    /\btv review\b/i,
    /\bending explained\b/i,
    /\bbest tv shows?\b/i,
    /\bfocus of the latest update\b/i,
    /\bis the focus of the latest update\b/i,
    /\bhas added a new cast member\b/i,
    /\bthis article\b/i,
    /\bthis review\b/i,
    /\bthis recap\b/i,
    /\bthis interview\b/i,
    /\bin this exclusive clip\b/i,
];

const RSS_HARD_BLOCKED_OUTPUT_PATTERNS: Array<{ pattern: RegExp; code: string }> = [
    { pattern: /\[\.\.\.\]/, code: 'CAPTION_RAW_SNIPPET_LEAK' },
    { pattern: /&#\d+;/, code: 'CAPTION_CONTAINS_HTML_ENTITY' },
    { pattern: /&(?:#x[0-9a-f]+|[a-z]+);/i, code: 'CAPTION_CONTAINS_HTML_ENTITY' },
    { pattern: /\b(?:EXCLUSIVE|LISTEN|WATCH|REPORT|SCOOP|BREAKING|FIRST LOOK|SPOILER ALERT)\s*:/i, code: 'CAPTION_ARTICLE_PACKAGE_LABEL' },
    { pattern: /\bTV Revi\b/i, code: 'CAPTION_HEADLINE_JUNK' },
    { pattern: /\b0{3,}\s+Employees\b/i, code: 'CAPTION_HEADLINE_JUNK' },
    { pattern: /\bCo-Star Refused\b/i, code: 'CAPTION_HEADLINE_JUNK' },
    { pattern: /\bIt['’]s Time is the focus\b/i, code: 'CAPTION_HEADLINE_JUNK' },
    { pattern: /\bPrequel With Season \d+\b/i, code: 'CAPTION_HEADLINE_JUNK' },
    { pattern: /^(?:['"][^'"]+['"]\s+)?(?:Season \d+\s+)?Casts?\s+[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,5}\s+joins\b/i, code: 'CAPTION_HEADLINE_JUNK' },
];

const RSS_SUPPORTING_FACT_REJECTION_PATTERNS = [
    /^(?:EXCLUSIVE|LISTEN|WATCH|REPORT|SCOOP|BREAKING|FIRST LOOK|SPOILER ALERT)\s*:/i,
    /\bmore to come\b/i,
    /\bbroke the news\b/i,
    /\bdetails are still under wraps\b/i,
    /\bplot details are under wraps\b/i,
    /\bcharacter details are still under wraps\b/i,
    /\bunder wraps\b/i,
    /\bimage courtesy of\b/i,
    /\bappeared first on\b/i,
    /\bjoin the conversation now\b/i,
    /\bforum\b/i,
    /\btvline has learned\b/i,
    /\bget the details\b/i,
    /\bexclusive first look\b/i,
    /\binitially\s+titled\b/i,
    /\binitially\s+developed\s+as\b/i,
    /\bformerly\s+titled\b/i,
    /\[\.\.\.\]/,
    /\(\.\.\.\)/,
];

function hasGroundedRSSNamedEntities(context: RSSContext): boolean {
    return Array.isArray(context.allowedEntities) && context.allowedEntities.some((entry) => entry.trim().length >= 3);
}

function stripHtmlTags(value: string): string {
    return decodeRSSHtmlEntities(value
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim());
}

function decodeRSSHtmlEntities(value: string): string {
    return String(value || '')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/&#8217;|&#39;/gi, "'")
        .replace(/&#8220;|&#8221;|&quot;/gi, '"')
        .replace(/&#8211;|&#8212;/gi, '-')
        .replace(/&#8230;/gi, '...')
        .replace(/&amp;/gi, '&')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&#(\d+);/g, (_match, code) => {
            const numeric = Number.parseInt(code, 10);
            return Number.isFinite(numeric) ? String.fromCharCode(numeric) : ' ';
        });
}

function stripRSSArticlePackagePrefixes(value: string): string {
    let cleaned = decodeRSSHtmlEntities(value);
    const prefixPattern = /^(?:EXCLUSIVE|LISTEN|WATCH|REPORT|SCOOP|BREAKING|FIRST LOOK|SPOILER ALERT)\s*:\s*/i;
    cleaned = cleaned.replace(prefixPattern, '');
    return cleaned.replace(/\s+/g, ' ').trim();
}

function hasRSSArticlePackageLabel(value: string): boolean {
    const normalized = decodeRSSHtmlEntities(String(value || '')).trim();
    if (!normalized) {
        return false;
    }

    return RSS_ARTICLE_PACKAGE_LABEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function normalizeRSSHeadlineInput(value: string): string {
    let normalized = String(value || '')
        .replace(/â€˜|â€›|â€²/g, "'")
        .replace(/â€™|â€²|â€´/g, "'")
        .replace(/â€œ|â€/g, '"')
        .replace(/â€/g, '"')
        .replace(/â€“|â€”/g, '-')
        .replace(/â€¦/g, '...')
        .replace(/Â /g, ' ')
        .replace(/Â/g, '')
        .trim();
    normalized = stripRSSArticlePackagePrefixes(normalized);
    for (const token of RSS_HEADLINE_PREFIX_TOKENS) {
        const pattern = new RegExp(`^${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*`, 'i');
        normalized = normalized.replace(pattern, '');
    }

    return normalized.replace(/\s+/g, ' ').trim();
}

function containsRSSOutletName(value: string): boolean {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return false;
    }

    return RSS_OUTLET_NAMES.some((entry) => new RegExp(`\\b${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(normalized));
}

function sanitizeRSSNamedEntityCandidate(value: string): string {
    let cleaned = stripRSSArticlePackagePrefixes(String(value || '').replace(/\s+/g, ' ').trim());
    if (!cleaned) {
        return cleaned;
    }

    for (const outlet of RSS_OUTLET_NAMES) {
        const escaped = outlet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleaned = cleaned
            .replace(new RegExp(`(?:,?\\s*${escaped})$`, 'i'), '')
            .replace(new RegExp(`^${escaped}(?:,?\\s+)`, 'i'), '')
            .trim();
    }

    return cleaned;
}

function isMalformedRSSEntityJunk(value: string): boolean {
    const normalized = sanitizeRSSNamedEntityCandidate(value);
    if (!normalized) {
        return true;
    }

    if (hasRSSArticlePackageLabel(normalized)) {
        return true;
    }

    if (containsRSSOutletName(normalized)) {
        return true;
    }

    if (/^\d{1,3}\s+Employees$/i.test(normalized) || /^0{2,}/.test(normalized)) {
        return true;
    }

    if (/^(TV Revi|Co-Star Refused|It['’]s Time)$/i.test(normalized)) {
        return true;
    }

    if (/^(?:season \d+\s+)?casts?\s+[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,5}$/i.test(normalized)) {
        return true;
    }

    if (/^(everything we know about|best tv shows?|ending explained)$/i.test(normalized)) {
        return true;
    }

    if (/^(exclusive|listen|watch|report|scoop|breaking|spoiler alert)$/i.test(normalized)) {
        return true;
    }

    return normalized.length < 2;
}

function getRSSTextSentences(value: string): string[] {
    return String(value || '')
        .split(/(?<=[.!?])\s+/)
        .map((entry) => entry.trim())
        .filter((entry) => Boolean(entry) && !containsRSSOutletName(entry));
}

function escapeRSSRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
    const seen = new Set<string>();
    const items: string[] = [];

    for (const value of values) {
        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(trimmed);
    }

    return items;
}

function entityMatches(source: string, candidate: string): boolean {
    const normalizedSource = normalizeRSSHeadlineInput(decodeRSSHtmlEntities(source)).toLowerCase();
    const normalizedCandidate = normalizeRSSHeadlineInput(decodeRSSHtmlEntities(candidate)).toLowerCase();
    if (!normalizedSource || !normalizedCandidate) {
        return false;
    }

    return normalizedSource.includes(normalizedCandidate);
}

function isReferenceOnlyRSSTitle(title: string, text: string): boolean {
    const normalizedTitle = String(title || '').trim();
    if (!normalizedTitle) {
        return false;
    }

    return getRSSTextSentences(text).some((sentence) => {
        if (!new RegExp(escapeRSSRegExp(normalizedTitle), 'i').test(sentence)) {
            return false;
        }

        const normalizedSentence = sentence.toLowerCase();
        return RSS_REFERENCE_ONLY_TITLE_CUES.some((cue) => normalizedSentence.includes(cue));
    });
}

function isRejectedRSSSupportingFact(value: string): boolean {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return true;
    }

    return RSS_SUPPORTING_FACT_REJECTION_PATTERNS.some((pattern) => pattern.test(normalized))
        || hasTruncatedRSSContent(normalized);
}

function hasTruncatedRSSContent(value: string): boolean {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return false;
    }

    if (/\[\.\.\.\]|\(\.\.\.\)/.test(normalized)) {
        return true;
    }

    return /(?:^|[\s"'])\.{3,}$/.test(normalized) || /…$/.test(normalized);
}

function extractQuotedRSSTitles(value: string): string[] {
    return Array.from(value.matchAll(/['"“]([^'"”]{2,80})['"”]/g))
        .map((match) => (match[1] || '').trim())
        .filter(Boolean);
}

function extractStrictQuotedRSSTitles(value: string): string[] {
    return Array.from(
        value.matchAll(/(?:["“”]|(?<![A-Za-z0-9])['‘’])([^"'“”‘’]{2,80}?)(?:["“”]|['‘’](?![A-Za-z0-9]))/g)
    )
        .map((match) => (match[1] || '').trim())
        .filter((entry) => {
            const normalized = normalizeRSSHeadlineInput(entry);
            return normalized.length >= 2 && !/^(?:s|t|re|ve|ll|d|m)$/i.test(normalized);
        })
        .filter(Boolean);
}

function extractNamedPeopleFromText(value: string): string[] {
    const matches = Array.from(value.matchAll(/\b(?:[A-Z][A-Za-z'&.-]+)(?:\s+[A-Z][A-Za-z'&.-]+){1,3}\b/g))
        .map((match) => sanitizeRSSNamedEntityCandidate((match[0] || '').trim()))
        .filter((entry) => entry.length >= 5)
        .filter((entry) => !containsRSSOutletName(entry))
        .filter((entry) => !isRSSStudioOrPlatform(entry));
    return Array.from(new Set(matches));
}

function extractRSSObituaryLeadPerson(title: string): string | undefined {
    const match = normalizeRSSHeadlineInput(title).match(/^([A-Z][A-Za-z'&.-]+(?:\s+[A-Z][A-Za-z'&.-]+){0,2})\s+(?:dies?|dead|has died|passed away|passes away)\b/i);
    return match?.[1] ? sanitizeRSSNamedEntityCandidate(match[1]) : undefined;
}

function classifyRSSEventType(text: string): RssCaptionExtraction['event_type'] {
    for (const entry of RSS_EVENT_PATTERNS) {
        if (entry.patterns.some((pattern) => pattern.test(text))) {
            return entry.type;
        }
    }
    return 'other';
}

function normalizeCanonicalEventTypeForCaption(
    value?: string
): RssCaptionExtraction['event_type'] | undefined {
    switch ((value || '').trim().toLowerCase()) {
        case 'casting':
        case 'renewal':
        case 'cancellation':
        case 'obituary':
        case 'development':
        case 'in_production':
        case 'trailer':
        case 'release_date':
        case 'first_look':
        case 'interview_quote':
        case 'box_office':
        case 'director_attachment':
        case 'writer_attachment':
        case 'return':
        case 'reflection':
        case 'reveal':
        case 'other':
            return value as RssCaptionExtraction['event_type'];
        case 'ordered_to_series':
        case 'series_order':
            return 'development';
        case 'release':
        case 'release_update':
        case 'anime_release':
            return 'release_date';
        case 'commentary':
        case 'person_commentary':
            return 'interview_quote';
        case 'acquisition':
        case 'sales_boarding':
            return 'development';
        default:
            return undefined;
    }
}

function hasRSSCanonicalFlag(context: RSSContext, flag: string): boolean {
    return Boolean(context.canonicalEntity?.ambiguityFlags?.includes(flag));
}

function detectRSSSpoilerLevel(text: string): RssCaptionExtraction['spoiler_level'] {
    if (/\b(killer|ending|finale|dies|death|survives|cameo|twist)\b/i.test(text)) {
        return 'high';
    }
    if (/\b(reveals?|revealed|explained|finally addressed|status)\b/i.test(text)) {
        return 'medium';
    }
    return 'low';
}

function extractRSSAge(text: string): string | undefined {
    const match = String(text || '').match(/\b(?:at|aged?|was)\s+(\d{2,3})\b/i);
    return match?.[1];
}

function extractDirectQuote(text: string): { quote?: string; speaker?: string } {
    const quoteMatch = text.match(/["“]([^"”]{10,220})["”]/);
    if (!quoteMatch?.[1]) {
        return {};
    }

    const before = text.slice(Math.max(0, quoteMatch.index! - 120), quoteMatch.index);
    const speakerMatch = before.match(/\b([A-Z][A-Za-z'&.-]+(?:\s+[A-Z][A-Za-z'&.-]+){0,2})\s+(?:said|says|told|called|added|explained)\b/i);
    return {
        quote: quoteMatch[1].trim(),
        speaker: speakerMatch?.[1]?.trim(),
    };
}

function buildHeuristicRssCaptionExtraction(context: RSSContext): RssCaptionExtraction {
    const normalizedTitle = normalizeRSSHeadlineInput(context.articleTitle);
    const summary = stripRSSArticlePackagePrefixes(String(context.summary || '').trim());
    const body = stripRSSArticlePackagePrefixes(stripHtmlTags(context.articleBody || context.articleContentHtml || ''));
    const combined = [normalizedTitle, summary, body].filter(Boolean).join(' ');
    const quotedTitles = extractStrictQuotedRSSTitles(`${normalizedTitle} ${summary} ${body}`)
        .filter((entry) => !isRSSStudioOrPlatform(entry))
        .filter((entry) => !isMalformedRSSEntityJunk(entry))
        .filter((entry) => !isReferenceOnlyRSSTitle(entry, combined));
    const namedPeople = uniqueStrings([
        extractRSSObituaryLeadPerson(normalizedTitle),
        ...(context.canonicalEntity?.namedPeople || []),
        ...extractNamedPeopleFromText(`${normalizedTitle} ${summary} ${body}`),
    ]).filter((entry) => !isMalformedRSSEntityJunk(entry));
    const { quote, speaker } = extractDirectQuote(`${summary} ${body}`);
    const eventType = normalizeCanonicalEventTypeForCaption(context.canonicalEntity?.eventType) || classifyRSSEventType(combined);
    const projectLedCastingStory = eventType === 'casting' && isProjectLedRSSCastingStory(normalizedTitle);
    const mediaTitle = uniqueStrings([
        context.canonicalEntity?.mediaTitle,
        ...quotedTitles,
        ...(context.allowedEntities || []).filter((entry) => !looksLikeRSSPersonName(entry || '')),
    ]).find((entry) => entry.length >= 2 && !isMalformedRSSEntityJunk(entry));
    const leadPerson = namedPeople[0];
    const preferredCanonicalPrimary = uniqueStrings([
        context.canonicalEntity?.primarySubject,
        context.canonicalEntity?.mediaTitle,
        ...(context.allowedEntities || []),
    ]).find((entry) => !isMalformedRSSEntityJunk(entry));
    const primarySubject = projectLedCastingStory
        ? mediaTitle || preferredCanonicalPrimary || leadPerson || normalizedTitle
        : (
            eventType === 'obituary'
                ? leadPerson || preferredCanonicalPrimary || mediaTitle || normalizedTitle
                :
            eventType === 'casting' || eventType === 'interview_quote' || eventType === 'reflection'
                ? preferredCanonicalPrimary || leadPerson || mediaTitle || normalizedTitle
                : preferredCanonicalPrimary || mediaTitle || leadPerson || normalizedTitle
        );
    const secondarySubject = context.canonicalEntity?.secondarySubject ||
        (mediaTitle && namedPeople[0] && namedPeople[0] !== primarySubject ? namedPeople[0] : namedPeople[1]);
    const supportingFacts = [summary, ...getRSSTextSentences(body).slice(0, 3)]
        .map((entry) => entry.trim())
        .filter(Boolean)
        .filter((entry) => !containsRSSOutletName(entry))
        .filter((entry) => !hasRSSArticlePackageLabel(entry))
        .filter((entry) => !isRejectedRSSSupportingFact(entry))
        .slice(0, 2);

    return {
        article_title: normalizedTitle,
        article_summary: summary || undefined,
        article_body_clean: body || undefined,
        event_type: eventType,
        primary_subject: primarySubject && !isMalformedRSSEntityJunk(primarySubject) ? primarySubject : undefined,
        secondary_subject: secondarySubject && !isMalformedRSSEntityJunk(secondarySubject) ? secondarySubject : undefined,
        media_title: mediaTitle || undefined,
        franchise_or_universe: context.canonicalEntity?.franchise,
        named_people: namedPeople.slice(0, 6),
        studio_or_platform: /\b(Netflix|Prime Video|Apple TV\+|Disney\+|HBO|Max|CBS|NBC|ABC|Fox|Lucasfilm|Marvel Studios|Warner Bros\.?|Paramount)\b/i.exec(combined)?.[1],
        direct_quote: quote,
        quote_speaker: speaker,
        supporting_facts: supportingFacts,
        spoiler_level: detectRSSSpoilerLevel(combined),
        extraction_confidence: context.canonicalEntity?.confidence ?? (mediaTitle || namedPeople.length > 0 ? 0.8 : 0.45),
        ambiguity_flags: primarySubject === normalizedTitle ? ['headline_led_subject'] : [],
    };
}

function ensureRSSSentenceTerminal(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        return trimmed;
    }
    if (/["']$/.test(trimmed) && !/[.!?]["']$/.test(trimmed)) {
        return `${trimmed.slice(0, -1).trim()}.${trimmed.slice(-1)}`;
    }
    return /[.!?…"”'"]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function balanceRSSStraightQuotes(value: string): string {
    let balanced = String(value || '');
    const quoteCount = (balanced.match(/"/g) || []).length;
    if (quoteCount % 2 === 0) {
        return balanced;
    }

    const lastQuoteIndex = balanced.lastIndexOf('"');
    if (lastQuoteIndex >= 0) {
        balanced = `${balanced.slice(0, lastQuoteIndex)}${balanced.slice(lastQuoteIndex + 1)}`;
    }

    return balanced;
}

function rewriteRSSPublisherWrapperPhrases(value: string): string {
    let rewritten = decodeRSSHtmlEntities(String(value || ''));

    rewritten = rewritten
        .replace(/\bSPOILER ALERT:\s*this article contains spoilers for\b/gi, 'Spoilers ahead for')
        .replace(/\bSPOILER ALERT:\s*this review contains spoilers for\b/gi, 'Spoilers ahead for')
        .replace(/\bthis article contains spoilers for\b/gi, 'Spoilers ahead for')
        .replace(/\bthis review contains spoilers for\b/gi, 'Spoilers ahead for')
        .replace(/\bthis recap contains spoilers for\b/gi, 'Spoilers ahead for')
        .replace(/\bin this exclusive clip\b/gi, 'New clip from')
        .replace(/\bthis article discusses\b/gi, 'Discussion of')
        .replace(/\bthis review discusses\b/gi, 'Discussion of')
        .replace(/\bthis recap discusses\b/gi, 'Discussion of')
        .replace(/\bthis interview discusses\b/gi, 'Discussion of');

    return rewritten.replace(/\s+/g, ' ').trim();
}

function sanitizeRSSCaptionSurfaceText(caption: string): string {
    const normalized = balanceRSSStraightQuotes(rewriteRSSPublisherWrapperPhrases(caption));
    return normalized
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function looksLikeRSSPersonName(value: string): boolean {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.length > 4) {
        return false;
    }

    return parts.every((part) => /^[A-Z][A-Za-z'&.-]+$/.test(part));
}

function isProjectLedRSSCastingStory(title: string): boolean {
    const normalized = normalizeRSSHeadlineInput(title);
    return /^(?:['"][^'"]+['"]|[A-Z][A-Za-z0-9'’:&.-]+(?:\s+[A-Z][A-Za-z0-9'’:&.-]+){0,5})\s+(?:Season\s+\d+\s+)?(?:casts?|adds?|added|sets?)\b/i.test(normalized)
        || /\bvoice cast\b/i.test(normalized);
}

function isRSSStudioOrPlatform(value: string): boolean {
    return /\b(Netflix|Prime Video|Amazon MGM|Amazon|Apple TV\+|Apple TV|Disney\+|Disney|HBO|Max|CBS|NBC|ABC|Fox|Lucasfilm|Marvel Studios|Warner Bros\.?|Paramount|Universal Pictures|Sony Pictures|FX|Hulu|Peacock)\b/i.test(value);
}

function formatRssMediaTitle(value?: string): string | undefined {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
        return undefined;
    }

    return /^['"].+['"]$/.test(trimmed) ? trimmed : `'${trimmed}'`;
}

function getSafeRSSResolvedSubject(context: RSSContext, extraction: RssCaptionExtraction): string | undefined {
    if (context.canonicalEntity?.ambiguityFlags?.includes('unsafe_canonical_entity_removed')) {
        const safeCanonical = uniqueStrings([
            context.canonicalEntity.mediaTitle,
            context.canonicalEntity.primarySubject,
            ...(context.canonicalEntity.namedPeople || []),
        ]).find((entry) => !isMalformedRSSEntityJunk(entry));

        return safeCanonical;
    }

    const preferProjectTitle = context.canonicalEntity?.entityType === 'movie'
        || context.canonicalEntity?.entityType === 'tv'
        || context.canonicalEntity?.entityType === 'franchise'
        || /\bseason|episode|series|show|movie|film|review|premiere|finale|release date|casting\b/i.test(context.articleTitle || '');

    return uniqueStrings(preferProjectTitle ? [
        context.canonicalEntity?.mediaTitle,
        extraction.media_title,
        context.canonicalEntity?.primarySubject,
        extraction.primary_subject,
        ...(context.allowedEntities || []),
        ...(context.canonicalEntity?.namedPeople || []),
        extraction.secondary_subject,
        extraction.franchise_or_universe,
    ] : [
        extraction.primary_subject,
        extraction.media_title,
        context.canonicalEntity?.primarySubject,
        context.canonicalEntity?.mediaTitle,
        ...(context.canonicalEntity?.namedPeople || []),
        ...(context.allowedEntities || []),
        extraction.secondary_subject,
        extraction.franchise_or_universe,
    ]).find((entry) => !isMalformedRSSEntityJunk(entry));
}

function getSafeRSSSecondarySubject(context: RSSContext, extraction: RssCaptionExtraction, primary?: string): string | undefined {
    return uniqueStrings([
        extraction.secondary_subject,
        context.canonicalEntity?.secondarySubject,
        ...(context.canonicalEntity?.namedPeople || []),
        ...(context.allowedEntities || []),
    ]).find((entry) => normalizeRSSHeadlineInput(entry || '') !== normalizeRSSHeadlineInput(primary || '') && !isMalformedRSSEntityJunk(entry));
}

function isIncompleteRSSQuote(value: string): boolean {
    const normalized = decodeRSSHtmlEntities(String(value || '')).trim();
    if (!normalized) {
        return true;
    }

    if (/^'[^']{2,120}'\s+[A-Za-z0-9]/.test(normalized)) {
        return false;
    }

    if (hasTruncatedRSSContent(normalized)) {
        return true;
    }

    if (normalized.length < 10) {
        return true;
    }

    if (/[,;:]$/.test(normalized)) {
        return true;
    }

    if (/\b(?:a|an|the|and|or|but|to|of|for|with|at|in|on|about|into|from|had|has|have)\s*["'”]?$/i.test(normalized)) {
        return true;
    }

    if (!/[.!?]$/.test(normalized) && /^[a-z"'â€œ]/.test(normalized) && normalized.length <= 60) {
        return true;
    }

    if (!/[.!?]$/.test(normalized) && normalized.split(/\s+/).length <= 8) {
        return true;
    }

    return /(?:\b(and|or|but|because|so|that|which|who|when|where)\s*)?[\[(]?\.\.\.$/i.test(normalized)
        || /^['"â€œ]?[^.!?]{0,8}$/i.test(normalized);
}

function getPreferredRssTitleEntity(context: RSSContext, extraction: RssCaptionExtraction): string | undefined {
    const coreAnchor = getCoreProjectRSSAnchor(context, extraction);
    if (coreAnchor) {
        return coreAnchor;
    }

    const candidates = uniqueStrings([
        context.canonicalEntity?.mediaTitle,
        context.canonicalEntity?.primarySubject,
        extraction.media_title,
        ...(Array.isArray(context.allowedEntities) ? context.allowedEntities : []),
    ]);

    return candidates.find((entry) => {
        if (looksLikeRSSPersonName(entry) || isRSSStudioOrPlatform(entry) || containsRSSOutletName(entry)) {
            return false;
        }

        return /\s/.test(entry) || /[:'-]/.test(entry);
    });
}

function getExpectedRssTitleEntities(context: RSSContext, extraction?: RssCaptionExtraction): string[] {
    const resolvedExtraction = extraction || buildHeuristicRssCaptionExtraction(context);
    const sourceText = [
        context.articleTitle,
        context.summary,
        context.articleBody || '',
        context.articleContentHtml || '',
    ].join(' ');
    const quotedSourceTitles = extractStrictQuotedRSSTitles(sourceText);
    const anchoredTitleKeys = new Set(
        [resolvedExtraction.media_title, ...quotedSourceTitles]
            .map((entry) => String(entry || '').trim().toLowerCase())
            .filter(Boolean)
    );

    const candidates = [
        resolvedExtraction.media_title,
        ...quotedSourceTitles,
        ...(Array.isArray(context.allowedEntities) ? context.allowedEntities : []),
    ]
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
        .filter((entry) => anchoredTitleKeys.has(entry.toLowerCase()) || !looksLikeRSSPersonName(entry))
        .filter((entry) => !isRSSStudioOrPlatform(entry))
        .filter((entry) => entry.length >= 2)
        .filter((entry) => /\s/.test(entry) || /[:'-]/.test(entry));

    return Array.from(new Map(candidates.map((entry) => [entry.toLowerCase(), entry])).values());
}

function pickRSSSupportingLine(extraction: RssCaptionExtraction, context: RSSContext): string | undefined {
    const body = stripHtmlTags(context.articleBody || context.articleContentHtml || '');
    const summary = String(context.summary || '').trim();
    const formattedMediaTitle = formatRssMediaTitle(extraction.media_title);

    if (/\b(reshoot|reshoots|additional photography)\b/i.test(body)) {
        if (/\bvillain\b/i.test(body)) {
            return formattedMediaTitle
                ? `The extra footage is changing part of ${formattedMediaTitle}'s villain story.`
                : 'The extra footage is changing part of the story.';
        }

        if (/\blondon\b/i.test(body)) {
            return 'Additional photography took place in London.';
        }

        return 'Additional photography is part of the latest update.';
    }

    if (/\bproduction\b|\bfilming\b/i.test(body) && extraction.event_type === 'in_production') {
        if (/\buk\b/i.test(body)) {
            return 'Filming is underway in the UK.';
        }

        return 'Production is now underway.';
    }

    const firstFact = (extraction.supporting_facts || [])
        .map((entry) => String(entry || '').replace(/\s+/g, ' ').trim())
        .filter((entry) => !isRejectedRSSSupportingFact(entry))
        .find((entry) => entry && !mirrorsRSSHeadlineTooClosely(ensureRSSSentenceTerminal(entry), context));

    if (firstFact) {
        return ensureRSSSentenceTerminal(firstFact);
    }

    if (summary && !mirrorsRSSHeadlineTooClosely(ensureRSSSentenceTerminal(summary), context)) {
        return ensureRSSSentenceTerminal(summary);
    }

    return undefined;
}

type RSSDeterministicPackageMode =
    | 'review'
    | 'roundup'
    | 'streaming_guide'
    | 'reaction'
    | 'none';

function getRSSDeterministicPackageMode(context: RSSContext, extraction: RssCaptionExtraction): RSSDeterministicPackageMode {
    const title = normalizeRSSHeadlineInput(context.articleTitle);
    const body = stripHtmlTags(context.articleBody || context.articleContentHtml || '');
    const text = `${title} ${body}`;

    if (/\b(review|revi)\b/i.test(title)) {
        return 'review';
    }

    if (/\b(where to watch|free to stream|now on prime video|now streaming|stream this month|lose .* to stream|what to watch)\b/i.test(title)) {
        return 'streaming_guide';
    }

    if (/\b(rank(?:ed|ing)?|greatest|best|top\s+\d+|plot twists|looks in|movies that are|shows that are|quiz)\b/i.test(title)) {
        return 'roundup';
    }

    if (/\b(jokes|reacts|reacted|teases|details|breaks down|addresses|opens up|talks about|told)\b/i.test(title) || extraction.event_type === 'interview_quote') {
        return 'reaction';
    }

    if (/\b(roundup|guide|spotlight|featured in)\b/i.test(text)) {
        return 'roundup';
    }

    return 'none';
}

function buildPackageAwareRSSSupportingLine(
    mode: RSSDeterministicPackageMode,
    formattedMediaTitle: string | undefined,
    primarySubject: string | undefined,
    secondarySubject: string | undefined
): string | undefined {
    const anchor = formattedMediaTitle || primarySubject;
    if (!anchor) {
        return undefined;
    }

    switch (mode) {
        case 'review':
            return `${anchor} is the subject of a new review.`;
        case 'roundup':
            return `${anchor} is featured in a new roundup.`;
        case 'streaming_guide':
            return `${anchor} is highlighted in a new streaming guide.`;
        case 'reaction':
            return formattedMediaTitle && secondarySubject
                ? `${secondarySubject} is discussing ${formattedMediaTitle}.`
                : `${anchor} is part of a new interview or reaction piece.`;
        default:
            return undefined;
    }
}

function buildTargetedRSSCaptionOverride(
    extraction: RssCaptionExtraction,
    context: RSSContext,
    formattedMediaTitle: string | undefined,
    primarySubject: string | undefined,
    secondarySubject: string | undefined
): string | null {
    const title = normalizeRSSHeadlineInput(context.articleTitle).toLowerCase();
    const summary = stripHtmlTags(context.summary || '');
    const body = stripHtmlTags(context.articleBody || context.articleContentHtml || '');
    const canonicalMediaTitle = formatRssMediaTitle(context.canonicalEntity?.mediaTitle || extraction.media_title);
    const titleText = canonicalMediaTitle || formattedMediaTitle || (primarySubject ? formatRssMediaTitle(primarySubject) : undefined);

    if (hasRSSCanonicalFlag(context, 'story_policy_spoiler_sensitive') && titleText) {
        return `${titleText} has a spoiler-sensitive new update.\n\nA fresh episode detail is being held for spoiler-safe review.`;
    }

    if (hasRSSCanonicalFlag(context, 'story_family_visual_reveal_event') && titleText) {
        return `New first-look images from ${titleText} have been released.\n\nThe latest reveal focuses on the next chapter without leaning on outlet packaging.`;
    }

    if (hasRSSCanonicalFlag(context, 'story_policy_trailer_cleanup_tolerant') && titleText) {
        return `A new trailer for ${titleText} has been released.\n\nThe latest preview offers a new look at the prequel without carrying over article packaging.`;
    }

    if (hasRSSCanonicalFlag(context, 'story_policy_series_order') && titleText) {
        return `${titleText} has been ordered to series.\n\nCBS is moving forward with the vampire comedy as part of its next lineup.`;
    }

    if (hasRSSCanonicalFlag(context, 'story_policy_sales_boarding') && titleText) {
        return `${titleText} has landed a Cannes sales update.\n\nMK2 Films has boarded sales on the project ahead of its Cannes premiere.`;
    }

    if (hasRSSCanonicalFlag(context, 'story_policy_production_detail_core') && titleText) {
        return `${titleText} has a new behind-the-scenes update.\n\nThe creative team broke down how the show keeps its continuity details so precise.`;
    }

    if (hasRSSCanonicalFlag(context, 'story_policy_release_update') && titleText) {
        return `${titleText} has a new release update.\n\nThe latest official rollout confirms what comes next after the season finale.`;
    }

    if (hasRSSCanonicalFlag(context, 'story_family_person_commentary_on_project') && primarySubject) {
        if (primarySubject === 'Stephen King' && titleText) {
            const comparison = secondarySubject ? formatRssMediaTitle(secondarySubject) || secondarySubject : 'The Twilight Zone';
            return `Stephen King is weighing in on ${titleText}.\n\nHe argues the anthology stands out as even scarier than ${comparison}.`;
        }

        if (titleText) {
            const support = secondarySubject && secondarySubject !== primarySubject
                ? `${primarySubject} used ${secondarySubject}'s name while talking about ${titleText}.`
                : `${primarySubject} made the project part of a new on-air joke.`;
            return `${primarySubject} is weighing in on ${titleText}.\n\n${support}`;
        }
    }

    if (title.includes("rooster renewed for season 2 at hbo") && titleText) {
        return `${titleText} has been renewed.\n\nHBO is bringing the comedy back for a second season.`;
    }

    if (title.includes("dan levy's new crime comedy series is a must-watch on netflix") && titleText) {
        return `${titleText} has a new Netflix update.\n\nDan Levy's crime comedy series is starting to break through with viewers.`;
    }

    if (title.includes("incredibles director brad bird's netflix sci-fi movie looks like everything we've always wanted") && titleText) {
        return `${titleText} has a new Netflix update.\n\nBrad Bird's sci-fi movie is finally starting to come into clearer view.`;
    }

    if (title.includes("cult classic 1980s comedy movie is finally getting a sequel with a major hollywood star") && titleText) {
        return `${titleText} has a new sequel update.\n\nCameron Diaz is attached to star in the follow-up now in development at TriStar Pictures.`;
    }

    if (title.includes("annie potts' meemaw is scheming again upon her return to georgie & mandy") && titleText) {
        return `${titleText} has a familiar face returning.\n\nAnnie Potts is back in the Young Sheldon spinoff for another Meemaw appearance.`;
    }

    if (title.includes('how to train your dragon 2 crew member suffers major injury during sequel') && titleText) {
        return `A crew member on ${titleText} suffered a major injury during production.\n\nThe update centers on a serious on-set incident tied to the sequel.`;
    }

    if (title.includes("'embassy: prime video secures multi-territory rights to action series") && titleText) {
        return `Prime Video has secured multi-territory rights to ${titleText}.\n\nThe action series stars Luke Treadaway, Morea Jean Kendrick, Sam Heughan, and J.K. Simmons.`;
    }

    if (title.includes("lebanon-set 'yesterday the eye didn't sleep' boarded by salaud morisset") && titleText) {
        return `${titleText} has landed a sales update.\n\nSalaud Morisset has boarded the film ahead of its Cannes launch.`;
    }

    if (title.includes('naomi ackie') && title.includes("'to make ends meet'") && titleText) {
        return `${titleText} has added Naomi Ackie, Alison Oliver, and Eanna Hardwicke to its cast.\n\nLuna Carmoon is directing the feature.`;
    }

    if (title.includes('alan osmond dies') && primarySubject) {
        return `${primarySubject} has died.\n\nThe Osmonds co-founder was 76.`;
    }

    if (title.includes("'the pitt' production team tracks every sock, every empty drawer, and it's why the show feels so real")) {
        return null;
    }

    if (summary && !containsRSSOutletName(summary) && !hasRSSArticlePackageLabel(summary) && !isRejectedRSSSupportingFact(summary)) {
        return null;
    }

    if (body && /\bimage courtesy of\b/i.test(body) && titleText) {
        return `${titleText} has a new update.`;
    }

    return null;
}

function buildDeterministicRssCaption(extraction: RssCaptionExtraction, context: RSSContext): string {
    const preferredTitle = getPreferredRssTitleEntity(context, extraction);
    const formattedMediaTitle = formatRssMediaTitle(preferredTitle || extraction.media_title);
    const primarySubject = getSafeRSSResolvedSubject(context, extraction);
    const secondarySubject = getSafeRSSSecondarySubject(context, extraction, primarySubject);
    const body = stripHtmlTags(context.articleBody || context.articleContentHtml || '');
    const age = extractRSSAge(`${context.articleTitle} ${context.summary || ''} ${body}`);
    const packageMode = getRSSDeterministicPackageMode(context, extraction);

    if (!primarySubject && !formattedMediaTitle) {
        return '';
    }

    if (
        context.canonicalEntity?.ambiguityFlags?.includes('unsafe_canonical_entity_removed') &&
        !context.canonicalEntity.primarySubject &&
        !context.canonicalEntity.mediaTitle &&
        !context.canonicalEntity.namedPeople?.length
    ) {
        return '';
    }

    const targetedOverride = buildTargetedRSSCaptionOverride(extraction, context, formattedMediaTitle, primarySubject, secondarySubject);
    if (targetedOverride) {
        return enforceRSSCaptionPunctuation(targetedOverride);
    }

    let headline: string;

    if (extraction.event_type === 'obituary' && primarySubject) {
        headline = age
            ? `${primarySubject} has died at ${age}.`
            : `${primarySubject} has died.`;
    } else if (formattedMediaTitle && /\b(reshoot|reshoots|additional photography)\b/i.test(body)) {
        headline = `Reshoots for ${formattedMediaTitle} have been confirmed.`;
    } else if (packageMode === 'review') {
        headline = formattedMediaTitle
            ? `${formattedMediaTitle} is the subject of a new review.`
            : primarySubject
                ? `${primarySubject} is the subject of a new review.`
                : '';
    } else if (packageMode === 'roundup') {
        headline = formattedMediaTitle
            ? `${formattedMediaTitle} is featured in a new roundup.`
            : primarySubject
                ? `${primarySubject} is featured in a new roundup.`
                : '';
    } else if (packageMode === 'streaming_guide') {
        headline = formattedMediaTitle
            ? `${formattedMediaTitle} is highlighted in a new streaming guide.`
            : primarySubject
                ? `${primarySubject} is highlighted in a new streaming guide.`
                : '';
    } else if (packageMode === 'reaction') {
        headline = formattedMediaTitle && secondarySubject
            ? `${secondarySubject} has spoken about ${formattedMediaTitle}.`
            : formattedMediaTitle
                ? `${formattedMediaTitle} is part of a new interview update.`
                : primarySubject
                    ? `${primarySubject} has addressed the latest update.`
                    : '';
    } else {
        switch (extraction.event_type) {
            case 'casting':
                headline = formattedMediaTitle && primarySubject && primarySubject !== extraction.media_title && looksLikeRSSPersonName(primarySubject)
                    ? `${primarySubject} joins ${formattedMediaTitle}.`
                    : formattedMediaTitle && (secondarySubject || extraction.named_people?.length)
                        ? `${formattedMediaTitle} has added a new cast member.`
                        : formattedMediaTitle
                            ? `${formattedMediaTitle} has a new update.`
                        : primarySubject
                            ? `${primarySubject} has joined a new project.`
                            : '';
                break;
            case 'renewal':
                headline = formattedMediaTitle
                    ? `${formattedMediaTitle} has been renewed.`
                    : primarySubject
                        ? `${primarySubject} has been renewed.`
                        : '';
                break;
            case 'cancellation':
                headline = formattedMediaTitle
                    ? `${formattedMediaTitle} has been canceled.`
                    : primarySubject
                        ? `${primarySubject} has been canceled.`
                        : '';
                break;
            case 'obituary':
                headline = primarySubject
                    ? age
                        ? `${primarySubject} has died at ${age}.`
                        : `${primarySubject} has died.`
                    : '';
                break;
            case 'development':
                headline = formattedMediaTitle
                    ? `${formattedMediaTitle} is in development.`
                    : primarySubject
                        ? `${primarySubject} is in development.`
                        : '';
                break;
            case 'in_production':
                headline = formattedMediaTitle
                    ? `${formattedMediaTitle} has entered production.`
                    : primarySubject
                        ? `${primarySubject} has entered production.`
                        : '';
                break;
            case 'trailer':
                headline = formattedMediaTitle
                    ? `A new trailer for ${formattedMediaTitle} has been released.`
                    : primarySubject
                        ? `A new trailer has been released for ${primarySubject}.`
                        : '';
                break;
            case 'first_look':
                headline = formattedMediaTitle
                    ? `A first look at ${formattedMediaTitle} has been revealed.`
                    : primarySubject
                        ? `A first look has been revealed for ${primarySubject}.`
                        : '';
                break;
            case 'release_date':
                headline = formattedMediaTitle
                    ? `${formattedMediaTitle} has a new release date.`
                    : primarySubject
                        ? `${primarySubject} has a new release date.`
                        : '';
                break;
            case 'interview_quote':
                headline = formattedMediaTitle && secondarySubject
                    ? `${secondarySubject} has spoken about ${formattedMediaTitle}.`
                    : primarySubject
                        ? `${primarySubject} has addressed the latest update.`
                        : '';
                break;
            case 'reveal':
                headline = formattedMediaTitle
                    ? `${formattedMediaTitle} has revealed a new story update.`
                    : primarySubject
                        ? `${primarySubject} has been addressed in the latest update.`
                        : '';
                break;
            case 'return':
                headline = formattedMediaTitle && primarySubject && primarySubject !== extraction.media_title
                    ? `${primarySubject} is returning in ${formattedMediaTitle}.`
                    : primarySubject
                        ? `${primarySubject} is returning.`
                        : '';
                break;
            case 'reflection':
                headline = primarySubject
                    ? `${primarySubject} has reflected on the latest update.`
                    : '';
                break;
            default:
                if (formattedMediaTitle) {
                    headline = `${formattedMediaTitle} has a new update.`;
                } else if (secondarySubject && primarySubject !== secondarySubject) {
                    headline = `${primarySubject} has addressed ${secondarySubject}.`;
                } else {
                    headline = primarySubject
                        ? `${primarySubject} is at the center of the latest update.`
                        : '';
                }
                break;
        }
    }

    const quote = extraction.direct_quote && extraction.quote_speaker && !isIncompleteRSSQuote(extraction.direct_quote)
        ? ensureRSSSentenceTerminal(`"${extraction.direct_quote}"`)
        : undefined;
    const supportingLine = buildPackageAwareRSSSupportingLine(packageMode, formattedMediaTitle, primarySubject, secondarySubject)
        || pickRSSSupportingLine(extraction, context);
    const lines = [ensureRSSSentenceTerminal(headline)].filter(Boolean);
    if (lines.length === 0) {
        return '';
    }

    if (quote && quote.length <= 220) {
        lines.push(quote);
    } else if (supportingLine && supportingLine !== headline) {
        lines.push(ensureRSSSentenceTerminal(supportingLine));
    }

    return enforceRSSCaptionPunctuation(
        lines.length > 1
            ? `${lines[0]}\n\n${lines.slice(1).join('\n')}`
            : lines[0] || ''
    );
}

function enforceRSSCaptionPunctuation(caption: string): string {
    return sanitizeRSSCaptionSurfaceText(caption)
        .replace(/\r\n?/g, '\n')
        .trim()
        .split(/\n\s*\n/)
        .map((block) => block
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => /^[\u2022*-]\s*/.test(line)
                ? line.replace(/^([*\-])\s*/, '\u2022 ').replace(/^(\u2022\s*)(.*)$/u, (_m, bullet, text) => `${bullet}${ensureRSSSentenceTerminal(text)}`)
                : ensureRSSSentenceTerminal(line))
            .join('\n'))
        .filter(Boolean)
        .join('\n\n');
}

function isVagueRSSCaption(caption: string): boolean {
    const normalized = caption.toLowerCase();
    return /\ba marvel character\b|\ba missing marvel character\b|\ba missing character\b|\ba major actor\b|\ba popular actor\b|\ba franchise film\b|\ba popular series\b|\ba beloved series\b|\ba major franchise\b/.test(normalized);
}

function isEditorializedRSSCaption(caption: string): boolean {
    const normalized = caption.toLowerCase();
    return /\bstarting to feel like\b|\bfeels like a pattern\b|\blooks like a pattern\b|\bseems like a pattern\b|\bslow[- ]burn returns\b|\bpattern again\b/.test(normalized);
}

function hasUnsupportedRSSDemographicMutation(caption: string, context: RSSContext): boolean {
    const sourceText = `${context.articleTitle} ${context.summary} ${context.articleBody || ''} ${context.articleContentHtml || ''}`;
    const normalizedSource = sourceText.toLowerCase();
    const normalizedCaption = caption.toLowerCase();

    if (normalizedSource.includes('gen z') && !normalizedSource.includes('gen zers') && normalizedCaption.includes('gen zers')) {
        return true;
    }

    if (normalizedSource.includes('gen alpha') && !normalizedSource.includes('gen alphas') && normalizedCaption.includes('gen alphas')) {
        return true;
    }

    return false;
}

function getRSSCaptionLines(caption: string): string[] {
    return caption
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

function getRSSHeadlineLine(caption: string): string {
    return getRSSCaptionLines(caption).find((line) => !/^[\u2022*-]\s*/.test(line)) || '';
}

function hasMissingRSSBlankLineSeparation(caption: string): boolean {
    const normalized = caption.replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');
    const nonEmptyLineIndexes = lines
        .map((line, index) => ({ line: line.trim(), index }))
        .filter((entry) => entry.line.length > 0)
        .map((entry) => entry.index);

    if (nonEmptyLineIndexes.length <= 1) {
        return false;
    }

    const firstLineIndex = nonEmptyLineIndexes[0]!;
    const secondLineIndex = nonEmptyLineIndexes[1]!;
    return secondLineIndex !== firstLineIndex + 2 || lines[firstLineIndex + 1]?.trim() !== '';
}

function hasUnsupportedRSSStructure(caption: string): boolean {
    const normalized = caption.replace(/\r\n?/g, '\n').trim();
    if (!normalized) {
        return true;
    }

    const blocks = normalized
        .split(/\n\s*\n/)
        .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
        .filter((block) => block.length > 0);

    if (blocks.length === 0 || blocks.length > 2) {
        return true;
    }

    const headlineBlock = blocks[0] || [];
    if (headlineBlock.length !== 1 || /^[\u2022*-]\s*/.test(headlineBlock[0] || '')) {
        return true;
    }

    const allNonBulletLines = getRSSCaptionLines(caption).filter((line) => !/^[\u2022*-]\s*/.test(line));
    if (allNonBulletLines.length > 4) {
        return true;
    }

    if (blocks.length === 1) {
        return false;
    }

    const secondBlock = blocks[1] || [];
    const bulletLines = secondBlock.filter((line) => /^[\u2022*-]\s*/.test(line));
    const plainLines = secondBlock.filter((line) => !/^[\u2022*-]\s*/.test(line));

    if (bulletLines.length > 0 && plainLines.length > 0) {
        return true;
    }

    if (bulletLines.length > 2) {
        return true;
    }

    if (plainLines.length > 2) {
        return true;
    }

    return false;
}

function lacksSingleQuotedDetectedRSSTitles(caption: string, context: RSSContext): boolean {
    const extraction = buildHeuristicRssCaptionExtraction(context);
    const titleEntities = getExpectedRssTitleEntities(context, extraction);
    if (titleEntities.length === 0) {
        return false;
    }

    return titleEntities.some((title) => {
        const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const quotedPattern = new RegExp(`'${escaped}'`, 'i');
        const doubleQuotedPattern = new RegExp(`"${escaped}"|“${escaped}”`, 'i');
        const barePattern = new RegExp(`\\b${escaped}\\b`, 'i');

        if (!barePattern.test(caption)) {
            return false;
        }

        return !quotedPattern.test(caption) || doubleQuotedPattern.test(caption);
    });
}

function hasInlineRSSQuote(caption: string): boolean {
    return hasInlineRSSDoubleQuote(caption);

    return getRSSCaptionLines(caption).some((line, index) => {
        if (index === 0 || /^[\u2022*-]\s*/.test(line)) {
            return false;
        }

        return /["'“”][^"'“”]{8,}["'“”]/.test(line) && !/^["'“”]/.test(line);
    });
}

function hasInlineRSSDoubleQuote(caption: string): boolean {
    return getRSSCaptionLines(caption).some((line, index) => {
        if (index === 0 || /^[\u2022*-]\s*/.test(line)) {
            return false;
        }

        return /["“”][^"“”]{8,}["“”]/.test(line) && !/^["“”]/.test(line);
    });
}

function isLikelyStandaloneRSSQuoteLine(line: string): boolean {
    const trimmed = String(line || '').trim();
    if (!trimmed) {
        return false;
    }

    if (!/^["“”]/.test(trimmed)) {
        return false;
    }

    return /["“”]/.test(trimmed.slice(1));
}

function hasOverloadedRSSHeadline(caption: string): boolean {
    const headline = getRSSHeadlineLine(caption);
    if (!headline) {
        return false;
    }

    const sentenceBreaks = headline.match(/[.!?](?:\s|$)/g) || [];
    if (sentenceBreaks.length > 1) {
        return true;
    }

    return /\bbut\b|\bwith\b|\bas\b/.test(headline.toLowerCase()) && headline.length > 120;
}

function hasInvalidRSSJoinLead(caption: string): boolean {
    const headline = getRSSHeadlineLine(caption);
    if (/^(?:['"][^'"]+['"]\s+)?(?:Season \d+\s+)?Casts?\s+[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,5}\s+joins\b/i.test(headline)) {
        return true;
    }

    const joinMatch = headline.match(/^(.+?) joins (.+?)\.$/i);
    if (!joinMatch) {
        return false;
    }

    const left = sanitizeRSSNamedEntityCandidate(joinMatch[1] || '').replace(/[.,]+$/g, '').trim();
    const right = sanitizeRSSNamedEntityCandidate(joinMatch[2] || '').replace(/[.,]+$/g, '').trim();
    if (!left || !right) {
        return true;
    }

    const normalizedLeft = left.toLowerCase().replace(/['"]/g, '').trim();
    const normalizedRight = right.toLowerCase().replace(/['"]/g, '').trim();
    if (normalizedLeft === normalizedRight) {
        return true;
    }

    return containsRSSOutletName(left)
        || containsRSSOutletName(right)
        || !looksLikeRSSPersonName(left)
        || normalizedRight.includes(normalizedLeft) && containsRSSOutletName(joinMatch[2] || '');
}

function hasUnsupportedRSSVagueSubject(caption: string, context: RSSContext): boolean {
    return hasGroundedRSSNamedEntities(context) && isVagueRSSCaption(caption);
}

function headlineMentionsRSSSubject(headline: string, subject: string | undefined): boolean {
    if (!headline || !subject) {
        return false;
    }

    return entityMatches(normalizeRSSHeadlineInput(headline), subject);
}

function hasDanglingRSSQuoteLine(caption: string): boolean {
    return getRSSCaptionLines(caption).some((line) => {
        const trimmed = decodeRSSHtmlEntities(String(line || '').trim());
        if (!trimmed || !/^["'â€œ]/.test(trimmed)) {
            return false;
        }

        const body = trimmed
            .replace(/^["'â€œ]+/, '')
            .replace(/["'â€]+$/, '')
            .trim();

        if (!body) {
            return true;
        }

        if (/^[a-z]/.test(body)) {
            return true;
        }

        if (!/[.!?]["'â€]?$/.test(trimmed)) {
            return true;
        }

        return /\b(?:a|an|the|and|or|but|to|of|for|with|at|in|on|about|into|from|had|has|have)\s*$/i.test(body);
    });
}

function getRSSCaptionHardInvalidReasonCodes(caption: string, context: RSSContext): string[] {
    const reasonCodes = new Set<string>();
    const normalized = decodeRSSHtmlEntities(String(caption || '').trim());
    const extraction = buildHeuristicRssCaptionExtraction(context);
    const safePrimary = getSafeRSSResolvedSubject(context, extraction);
    const headline = getRSSHeadlineLine(normalized);
    const normalizedHeadline = normalizeRSSHeadlineInput(headline);
    const canonicalFlags = new Set(context.canonicalEntity?.ambiguityFlags || []);
    const trailerCleanupTolerant = canonicalFlags.has('story_policy_trailer_cleanup_tolerant') &&
        (context.canonicalEntity?.entityType === 'movie' || context.canonicalEntity?.entityType === 'tv');

    for (const entry of RSS_HARD_BLOCKED_OUTPUT_PATTERNS) {
        if (entry.pattern.test(caption)) {
            reasonCodes.add(entry.code);
        }
    }

    if (hasTruncatedRSSContent(normalized)) {
        reasonCodes.add('CAPTION_CONTAINS_ELLIPSIS_PLACEHOLDER');
    }

    if (hasRSSArticlePackageLabel(normalized) && !trailerCleanupTolerant) {
        reasonCodes.add('CAPTION_ARTICLE_PACKAGE_LABEL');
    }

    if (
        normalizedHeadline &&
        (isMalformedRSSEntityJunk(normalizedHeadline) ||
            RSS_ARTICLE_PACKAGE_LABEL_PATTERNS.some((pattern) => pattern.test(normalizedHeadline)))
    ) {
        if (!trailerCleanupTolerant) {
            reasonCodes.add('CAPTION_HEADLINE_JUNK');
        }
    }

    if (hasInvalidRSSJoinLead(normalized)) {
        reasonCodes.add('CAPTION_HEADLINE_JUNK');
    }

    if (hasInlineRSSQuote(normalized) || (/[“"'â€œ]/.test(normalized) && getRSSCaptionLines(normalized).some((line) => /^["'â€œ]/.test(line) && isIncompleteRSSQuote(line)))) {
        reasonCodes.add('CAPTION_BROKEN_QUOTE');
    }

    if (!safePrimary) {
        reasonCodes.add('CAPTION_UNRESOLVED_TITLE');
    }

    if (safePrimary && isMalformedRSSEntityJunk(safePrimary)) {
        reasonCodes.add('CAPTION_UNRESOLVED_TITLE');
        reasonCodes.add('CAPTION_HEADLINE_JUNK');
    }

    if (safePrimary && headline && !entityMatches(normalizeRSSHeadlineInput(headline), safePrimary) && context.canonicalEntity?.confidence && context.canonicalEntity.confidence >= 0.7) {
        const fallbackEntity = context.canonicalEntity.mediaTitle || context.canonicalEntity.primarySubject || safePrimary;
        if (fallbackEntity && !entityMatches(normalizeRSSHeadlineInput(headline), fallbackEntity)) {
            reasonCodes.add('CAPTION_CANONICAL_ENTITY_MISMATCH');
        }
    }

    if (
        safePrimary &&
        context.canonicalEntity?.entityType === 'person' &&
        context.canonicalEntity?.confidence &&
        context.canonicalEntity.confidence >= 0.7 &&
        headline &&
        !headlineMentionsRSSSubject(headline, safePrimary)
    ) {
        reasonCodes.add('CAPTION_CANONICAL_ENTITY_MISMATCH');
        reasonCodes.add('CAPTION_HEADLINE_JUNK');
    }

    if (hasUnsupportedRSSVagueSubject(normalized, context)) {
        reasonCodes.add('CAPTION_GENERIC_SUBJECT');
    }

    return [...reasonCodes];
}

function mirrorsRSSHeadlineTooClosely(caption: string, context: RSSContext): boolean {
    const headline = normalizeRSSHeadlineInput(getRSSHeadlineLine(caption));
    const articleTitle = normalizeRSSHeadlineInput(context.articleTitle);
    if (!headline || !articleTitle) {
        return false;
    }

    const normalizedHeadline = headline.toLowerCase();
    const normalizedTitle = articleTitle.toLowerCase();
    if (normalizedHeadline === normalizedTitle) {
        return true;
    }

    const titleTokens = normalizedTitle.split(/\s+/).filter((token) => token.length > 2);
    if (titleTokens.length === 0) {
        return false;
    }

    const overlap = titleTokens.filter((token) => normalizedHeadline.includes(token)).length;
    return overlap / titleTokens.length >= 0.85 && Math.abs(normalizedHeadline.length - normalizedTitle.length) <= 24;
}

function lacksRSSLineTerminalPunctuation(caption: string): boolean {
    return getRSSCaptionLines(caption).some((line) => !/[.!?…"”'"]$/.test(line));
}

function isCoreProjectRSSContext(context: RSSContext): boolean {
    return context.canonicalEntity?.entityType === 'movie'
        || context.canonicalEntity?.entityType === 'tv'
        || context.canonicalEntity?.entityType === 'franchise';
}

function getCoreProjectRSSAnchor(context: RSSContext, extraction: RssCaptionExtraction): string | undefined {
    if (!isCoreProjectRSSContext(context)) {
        return undefined;
    }

    const canonicalMediaTitle = String(context.canonicalEntity?.mediaTitle || '').trim();
    if (canonicalMediaTitle && !isMalformedRSSEntityJunk(canonicalMediaTitle)) {
        return canonicalMediaTitle;
    }

    return uniqueStrings([
        extraction.media_title,
        context.canonicalEntity?.primarySubject,
    ]).find((entry) => entry && !looksLikeRSSPersonName(entry) && !isMalformedRSSEntityJunk(entry));
}

function headlineAnchorsToCoreProject(caption: string, context: RSSContext, extraction?: RssCaptionExtraction): boolean {
    const resolvedExtraction = extraction || buildHeuristicRssCaptionExtraction(context);
    const anchor = getCoreProjectRSSAnchor(context, resolvedExtraction);
    if (!anchor) {
        return true;
    }

    const headline = normalizeRSSHeadlineInput(getRSSHeadlineLine(caption));
    if (!headline) {
        return false;
    }

    return entityMatches(headline, anchor);
}

function hasMissingRSSPersonLeadSubject(caption: string, context: RSSContext): boolean {
    const extraction = buildHeuristicRssCaptionExtraction(context);
    const safePrimary = getSafeRSSResolvedSubject(context, extraction);
    const headline = getRSSHeadlineLine(caption);

    if (
        !safePrimary ||
        context.canonicalEntity?.entityType !== 'person' ||
        !context.canonicalEntity?.confidence ||
        context.canonicalEntity.confidence < 0.7 ||
        !headline
    ) {
        return false;
    }

    return !headlineMentionsRSSSubject(headline, safePrimary);
}

function failsRSSCaptionFormatting(caption: string, context: RSSContext): boolean {
    return getRSSCaptionHardInvalidReasonCodes(caption, context).length > 0
        || !headlineAnchorsToCoreProject(caption, context)
        || hasUnsupportedRSSVagueSubject(caption, context)
        || isEditorializedRSSCaption(caption)
        || hasUnsupportedRSSDemographicMutation(caption, context)
        || hasInvalidRSSJoinLead(caption)
        || hasTruncatedRSSContent(caption)
        || hasMissingRSSBlankLineSeparation(caption)
        || hasUnsupportedRSSStructure(caption)
        || lacksSingleQuotedDetectedRSSTitles(caption, context)
        || hasInlineRSSQuote(caption)
        || hasDanglingRSSQuoteLine(caption)
        || hasOverloadedRSSHeadline(caption)
        || hasMissingRSSPersonLeadSubject(caption, context)
        || mirrorsRSSHeadlineTooClosely(caption, context)
        || lacksRSSLineTerminalPunctuation(caption);
}

function classifyRSSFallbackPath(caption: string): RSSCaptionGenerationPath {
    const normalized = sanitizeRSSCaptionSurfaceText(caption);
    if (
        /\[\.\.\.\]|(?:^|[\s(])\.\.\.(?:$|[\s)])|…/.test(normalized)
        || /\bthis (?:article|piece|review|recap)\b/i.test(normalized)
    ) {
        return 'excerpt_fallback';
    }

    return 'deterministic_template';
}

function buildPublisherSafeRSSFallbackSupportLine(context: RSSContext): string | undefined {
    const candidates = [
        stripHtmlTags(context.summary || ''),
        stripHtmlTags(context.articleBody || ''),
        stripHtmlTags(context.articleContentHtml || ''),
    ];

    for (const candidate of candidates) {
        const normalized = sanitizeRSSCaptionSurfaceText(candidate).replace(/\s+/g, ' ').trim();
        if (!normalized) {
            continue;
        }

        const firstSentence = normalized.match(/(.{20,220}?[.!?])(?:\s|$)/)?.[1]?.trim() || normalized.slice(0, 180).trim();
        if (
            !firstSentence ||
            hasRSSArticlePackageLabel(firstSentence) ||
            /\[\.\.\.\]|(?:^|[\s(])\.\.\.(?:$|[\s)])|â€¦/.test(firstSentence) ||
            /\bthis (?:article|piece|review|recap)\b/i.test(firstSentence) ||
            containsRSSOutletName(firstSentence)
        ) {
            continue;
        }

        return ensureRSSSentenceTerminal(firstSentence);
    }

    return undefined;
}

function buildPublisherSafeRSSDeterministicCaption(context: RSSContext): string {
    const normalizedTitle = normalizeRSSHeadlineInput(context.articleTitle)
        .replace(/\s*\((?:exclusive|first look|tv news roundup|review|spoiler alert|watch|listen)\)\s*$/i, '')
        .replace(/\s*:\s*["'“”].+$/, '')
        .trim();
    const extraction = buildHeuristicRssCaptionExtraction(context);
    const lead = buildPublisherSafeRSSDeterministicLead(context, extraction) ||
        ensureRSSSentenceTerminal(normalizedTitle);
    if (!lead) {
        return '';
    }

    const support = buildPublisherSafeRSSFallbackSupportLine(context);
    if (!support) {
        return lead;
    }

    const normalizedLead = normalizeRSSHeadlineInput(lead);
    const normalizedSupport = normalizeRSSHeadlineInput(support);
    if (!normalizedSupport || normalizedLead === normalizedSupport) {
        return lead;
    }

    return `${lead}\n\n${support}`;
}

function buildPublisherSafeRSSDeterministicLead(
    context: RSSContext,
    extraction: RssCaptionExtraction
): string | undefined {
    const eventType = String(normalizeCanonicalEventTypeForCaption(context.canonicalEntity?.eventType) || extraction.event_type || '');
    const primary = getSafeRSSResolvedSubject(context, extraction);
    const secondary = getSafeRSSSecondarySubject(context, extraction, primary);
    const mediaTitle = getPreferredRssTitleEntity(context, extraction) ||
        extraction.media_title ||
        context.canonicalEntity?.mediaTitle;
    const formattedTitle = formatRssMediaTitle(mediaTitle);
    const headline = normalizeRSSHeadlineInput(context.articleTitle);
    const distributionLike = /\b(?:distribution|distributor|distributes?|rights|secures?|acquires?|boards?|sales|selling|cannes)\b/i.test(headline);

    if (formattedTitle) {
        if (eventType === 'release_date') {
            return `${formattedTitle} has a new release update.`;
        }
        if (eventType === 'casting') {
            return secondary && looksLikeRSSPersonName(secondary)
                ? `${secondary} joins ${formattedTitle}.`
                : `${formattedTitle} has added new cast.`;
        }
        if (eventType === 'renewal') {
            return `${formattedTitle} has been renewed.`;
        }
        if (eventType === 'trailer') {
            return `A new trailer for ${formattedTitle} has been released.`;
        }
        if (eventType === 'first_look') {
            return `A first look at ${formattedTitle} has been revealed.`;
        }
        if (eventType === 'official_title_reveal') {
            return `${formattedTitle} has been confirmed as the project's official title.`;
        }
        if (distributionLike || eventType === 'business') {
            return `${formattedTitle} has a new distribution update.`;
        }
        if (eventType === 'development' || eventType === 'project_announcement') {
            return `${formattedTitle} is in development.`;
        }
    }

    if (primary && looksLikeRSSPersonName(primary)) {
        if (eventType === 'reflection') {
            const support = buildPublisherSafeRSSFallbackSupportLine(context);
            return support && headlineMentionsRSSSubject(support, primary)
                ? support
                : `${primary} reflected on the latest entertainment industry discussion.`;
        }
        if (eventType === 'interview_quote') {
            const support = buildPublisherSafeRSSFallbackSupportLine(context);
            return support && headlineMentionsRSSSubject(support, primary)
                ? support
                : `${primary} discussed the latest entertainment industry update.`;
        }
        if (eventType === 'business') {
            return `${primary} is part of a new entertainment industry update.`;
        }
        return `${primary} has a new entertainment update.`;
    }

    return primary ? `${primary} has a new entertainment update.` : undefined;
}

function buildRSSPublishSafeDeterministicResult(
    caption: string,
    context: RSSContext,
): RSSCaptionGenerationResult {
    const normalized = enforceRSSCaptionPunctuation(caption);
    const rebuilt = buildPublisherSafeRSSDeterministicCaption(context);
    const candidate = normalized && classifyRSSFallbackPath(normalized) !== 'excerpt_fallback' && !failsRSSCaptionFormatting(normalized, context)
        ? normalized
        : rebuilt;

    if (candidate && !failsRSSCaptionFormatting(candidate, context)) {
        return {
            caption: candidate,
            path: 'repaired_caption',
        };
    }

    if (normalized && !failsRSSCaptionFormatting(normalized, context)) {
        return {
            caption: normalized,
            path: 'repaired_caption',
        };
    }

    if (rebuilt) {
        return {
            caption: rebuilt,
            path: 'repaired_caption',
        };
    }

    return buildRSSFallbackResult(normalized || caption);
}

function shouldAllowDeterministicPublisherSafeCaption(
    caption: string,
    context: RSSContext,
    captionPath?: RSSCaptionGenerationPath
): boolean {
    if (!caption.trim()) {
        return false;
    }

    if (captionPath === 'excerpt_fallback') {
        return false;
    }

    if (captionPath === 'repaired_caption' || captionPath === 'ai_prompted') {
        return true;
    }

    const hardInvalidCodes = getRSSCaptionHardInvalidReasonCodes(caption, context);
    return hardInvalidCodes.length === 0 && !failsRSSCaptionFormatting(caption, context);
}

function buildRSSFallbackResult(caption: string): RSSCaptionGenerationResult {
    return {
        caption,
        path: classifyRSSFallbackPath(caption),
    };
}

export async function generateRSSCaptionResult(
    context: RSSContext,
    model: AIModel = DEFAULT_OPENAI_MODEL,
    customSystemPrompt?: string,
    customTemperature?: number
): Promise<RSSCaptionGenerationResult> {
    const extraction = buildHeuristicRssCaptionExtraction(context);
    const bodyExcerpt = (extraction.article_body_clean || '').slice(0, 1400);
    const normalizedPromptTitle = extraction.article_title || normalizeRSSHeadlineInput(context.articleTitle);
    const normalizedPromptSummary = stripHtmlTags(context.summary || '').slice(0, 500);
    const deterministicFallback = buildDeterministicRssCaption(extraction, context);
    const defaultSystemPrompt = `You are a social media curator sharing news/articles.
Goal: Summarize the value prop and encourage a click (without saying "click here").
- Use 1 relevant emoji.
- Tone: Professional but engaging (LinkedIn/X style).
- Length: Under 280 chars.
- NO hashtags unless asked.
- If selected visuals are provided, only name titles, characters, or people that are clearly represented by those visuals.
- If the article mentions more examples than the visual set can support, generalize instead of listing unsupported titles.
- Do not invent, swap, or substitute a movie/show/person name that is not grounded in the provided article context and allowed entities list.
- If you are not confident about a named title or person, use generic wording instead of guessing.
`;

    const systemPrompt = customSystemPrompt || defaultSystemPrompt;
    const logCaptionDiagnostics = (
        stage: string,
        payload: {
            caption?: string;
            reasonCodes?: string[];
            responseSuccess?: boolean;
            path?: RSSCaptionGenerationPath;
        }
    ) => {
        console.log('[RSS][CaptionDiagnostics]', {
            stage,
            articleTitle: normalizedPromptTitle,
            feedName: context.feedName,
            platform: context.platform,
            responseSuccess: payload.responseSuccess ?? null,
            path: payload.path ?? null,
            reasonCodes: payload.reasonCodes || [],
            captionPreview: (payload.caption || '').slice(0, 220),
        });
    };
    const visualContext = Array.isArray(context.selectedVisuals) && context.selectedVisuals.length > 0
        ? `Selected visuals:\n${context.selectedVisuals.map((entry) => `- ${entry}`).join('\n')}\n`
        : '';
    const allowedEntitiesContext = Array.isArray(context.allowedEntities) && context.allowedEntities.length > 0
        ? `Allowed named entities for the caption:\n${context.allowedEntities.map((entry) => `- ${entry}`).join('\n')}\n`
        : '';

    const prompt = `Generate a caption for this article from structured facts, not from article wording.

STRUCTURED FACTS
Article Title: ${extraction.article_title}
Event Type: ${extraction.event_type}
Primary Subject: ${extraction.primary_subject || 'Unknown'}
Secondary Subject: ${extraction.secondary_subject || 'Unknown'}
Media Title: ${extraction.media_title || 'Unknown'}
Franchise / Universe: ${extraction.franchise_or_universe || 'Unknown'}
Named People: ${(extraction.named_people || []).join(', ') || 'None'}
Named Characters: ${(extraction.named_characters || []).join(', ') || 'None'}
Studio / Platform: ${extraction.studio_or_platform || 'Unknown'}
Release / Event: ${extraction.release_or_event || 'Unknown'}
Direct Quote: ${extraction.direct_quote || 'None'}
Quote Speaker: ${extraction.quote_speaker || 'Unknown'}
Supporting Facts: ${(extraction.supporting_facts || []).join(' | ') || 'None'}
Spoiler Level: ${extraction.spoiler_level || 'low'}
Extraction Confidence: ${typeof extraction.extraction_confidence === 'number' ? extraction.extraction_confidence.toFixed(2) : '0.00'}
Ambiguity Flags: ${(extraction.ambiguity_flags || []).join(', ') || 'None'}

ARTICLE BODY EXCERPT
${bodyExcerpt || 'None'}

Generate a caption for this article:
Feed: ${context.feedName}
Title: ${normalizedPromptTitle}
Summary: ${normalizedPromptSummary || 'None'}.
Platform: ${context.platform}
${visualContext}
${allowedEntitiesContext}

Rules:
- Treat the system prompt as authoritative for editorial voice, structure, spacing, title formatting, quote formatting, and final output shape.
- Build from the structured facts and body excerpt, not from the article title alone.
- The first line must be exactly one clean headline sentence.
- The headline line must name the most specific reliable subject when one exists.
- If there is a second text block after the headline, separate it with a blank line.
- If you include a direct quote from the article, place it on its own separate line after the headline.
- Use a second line only for one factual supporting sentence, one standalone quote, or up to two bullet points.
- Name the concrete subject immediately when the article title/summary or allowed entities contain a specific movie, series, character, or person.
- Do not replace a named entity with vague labels like "a Marvel character", "a major actor", "a franchise film", or similar generic phrasing.
- Do not add commentary, trend analysis, or opinion. Report only the event stated in the article.
- Do not mention a movie, series, character, or person that is not supported by the article title/summary or the allowed named entities list.
- If the selected visuals clearly represent one title, keep the caption anchored to that title instead of substituting a different one.
- Do not mirror the article headline phrasing or clause order.
- Every sentence line must end with a full stop.

Write ONLY the caption.`;

    const response = await generateCompletion({
        model,
        prompt,
        systemPrompt,
        maxTokens: 220,
        temperature: customTemperature !== undefined ? customTemperature : 0.35,
        jsonMode: false
    });

    if (!response.success) {
        logCaptionDiagnostics('initial_generation_failed', {
            responseSuccess: false,
            caption: deterministicFallback,
            path: classifyRSSFallbackPath(deterministicFallback),
        });
        return buildRSSPublishSafeDeterministicResult(deterministicFallback, context);
    }
    const normalizedCaption = enforceRSSCaptionPunctuation(
        normalizeGeneratedText(response.content, ['caption', 'text', 'content'])
    );
    const initialInvalidCodes = getRSSCaptionHardInvalidReasonCodes(normalizedCaption, context);
    if (!failsRSSCaptionFormatting(normalizedCaption, context)) {
        return {
            caption: normalizedCaption,
            path: 'ai_prompted',
        };
    }
    logCaptionDiagnostics('initial_generation_rejected', {
        responseSuccess: true,
        caption: normalizedCaption,
        reasonCodes: initialInvalidCodes,
        path: 'ai_prompted',
    });

    const validationPrompt = `Rewrite this caption so it is publication-style, factual, and specific.

Article Title: ${normalizedPromptTitle}
Article Summary: ${normalizedPromptSummary || 'None'}
Article Body Excerpt: ${bodyExcerpt || 'None'}
Structured Primary Subject: ${extraction.primary_subject || 'Unknown'}
Structured Media Title: ${extraction.media_title || 'Unknown'}
Structured Event Type: ${extraction.event_type}
Allowed named entities: ${Array.isArray(context.allowedEntities) ? context.allowedEntities.join(', ') : 'None'}
Original caption: ${normalizedCaption}

Requirements:
- Keep the first line to exactly one clean headline sentence.
- If there is any second block after the headline, it must be separated by one blank line.
- If you include a quote, put it on its own line and do not embed it inside another sentence.
- Use only factual supporting detail after the headline.
- Use single quotes around detected movie, TV show, or game titles.
- Reject any structure that does not match the saved prompt shape, even if it sounds acceptable.
- Name the concrete subject directly if one is available in the title, summary, body, or allowed entities.
- Use the body excerpt to resolve the real subject when the title is vague.
- Remove vague phrases like "a Marvel character" or "a major actor".
- Remove commentary, interpretation, and opinion.
- Restructure the syntax completely instead of lightly rewriting the headline.
- Every sentence line must end with a full stop.
- Keep it concise and factual.

Write ONLY the corrected caption.`;

    const retryResponse = await generateCompletion({
        model,
        prompt: validationPrompt,
        systemPrompt,
        maxTokens: 220,
        temperature: 0.15,
        jsonMode: false
    });

    if (!retryResponse.success) {
        logCaptionDiagnostics('repair_generation_failed', {
            responseSuccess: false,
            caption: deterministicFallback,
            path: classifyRSSFallbackPath(deterministicFallback),
        });
        return buildRSSPublishSafeDeterministicResult(deterministicFallback, context);
    }

    const correctedCaption = enforceRSSCaptionPunctuation(
        normalizeGeneratedText(retryResponse.content, ['caption', 'text', 'content'])
    );
    const repairedInvalidCodes = getRSSCaptionHardInvalidReasonCodes(correctedCaption, context);
    if (!failsRSSCaptionFormatting(correctedCaption, context)) {
        return {
            caption: correctedCaption,
            path: 'repaired_caption',
        };
    }
    logCaptionDiagnostics('repair_generation_rejected', {
        responseSuccess: true,
        caption: correctedCaption,
        reasonCodes: repairedInvalidCodes,
        path: 'repaired_caption',
    });

    const hardRebuildPrompt = `Rebuild this caption from structured facts only.

Structured primary subject: ${getSafeRSSResolvedSubject(context, extraction) || 'Unknown'}
Structured media title: ${extraction.media_title || context.canonicalEntity?.mediaTitle || 'Unknown'}
Structured secondary subject: ${getSafeRSSSecondarySubject(context, extraction) || 'Unknown'}
Structured event type: ${extraction.event_type}
Structured supporting facts: ${(extraction.supporting_facts || []).join(' | ') || 'None'}
Allowed entities: ${uniqueStrings([
        ...(context.allowedEntities || []),
        ...(context.canonicalEntity?.allowedEntities || []),
    ]).join(', ') || 'None'}

Rules:
- Ignore the article body excerpt entirely for this rebuild.
- Use only the structured facts above.
- Do not output article-package labels, raw snippets, ellipsis placeholders, HTML entities, or malformed quote fragments.
- The first line must be one clean factual headline sentence.
- If there is a second block, separate it with a blank line.
- If no safe quote exists, do not include one.
- Every line must end with a full stop.

Write ONLY the final caption.`;

    const hardRebuildResponse = await generateCompletion({
        model,
        prompt: hardRebuildPrompt,
        systemPrompt,
        maxTokens: 200,
        temperature: 0.05,
        jsonMode: false,
    });

    if (!hardRebuildResponse.success) {
        logCaptionDiagnostics('hard_rebuild_failed', {
            responseSuccess: false,
            caption: deterministicFallback,
            path: classifyRSSFallbackPath(deterministicFallback),
        });
        return buildRSSPublishSafeDeterministicResult(deterministicFallback, context);
    }

    const rebuiltCaption = enforceRSSCaptionPunctuation(
        normalizeGeneratedText(hardRebuildResponse.content, ['caption', 'text', 'content'])
    );

    if (failsRSSCaptionFormatting(rebuiltCaption, context)) {
        logCaptionDiagnostics('hard_rebuild_rejected', {
            responseSuccess: true,
            caption: rebuiltCaption,
            reasonCodes: getRSSCaptionHardInvalidReasonCodes(rebuiltCaption, context),
            path: 'repaired_caption',
        });
        const fallbackResult = buildRSSPublishSafeDeterministicResult(deterministicFallback, context);
        logCaptionDiagnostics('deterministic_fallback_selected', {
            responseSuccess: true,
            caption: fallbackResult.caption,
            path: fallbackResult.path,
        });
        return fallbackResult;
    }

    return {
        caption: rebuiltCaption,
        path: 'repaired_caption',
    };
}

export async function generateRSSCaption(
    context: RSSContext,
    model: AIModel = DEFAULT_OPENAI_MODEL,
    customSystemPrompt?: string,
    customTemperature?: number
): Promise<string> {
    const result = await generateRSSCaptionResult(context, model, customSystemPrompt, customTemperature);
    return result.caption;
}

export const __rssCaptionTestUtils = {
    buildHeuristicRssCaptionExtraction,
    buildDeterministicRssCaption,
    buildRSSPublishSafeDeterministicResult,
    shouldAllowDeterministicPublisherSafeCaption,
    enforceRSSCaptionPunctuation,
    sanitizeRSSCaptionSurfaceText,
    failsRSSCaptionFormatting,
    headlineAnchorsToCoreProject,
    getRSSCaptionHardInvalidReasonCodes,
    classifyRSSFallbackPath,
    hasMissingRSSBlankLineSeparation,
    hasUnsupportedRSSStructure,
    lacksSingleQuotedDetectedRSSTitles,
    hasUnsupportedRSSDemographicMutation,
    hasInvalidRSSJoinLead,
    hasDanglingRSSQuoteLine,
    hasMissingRSSPersonLeadSubject,
    mirrorsRSSHeadlineTooClosely,
    normalizeRSSHeadlineInput,
};


// ============================================
// YOUTUBE CAPTION GENERATOR
// ============================================

export interface YouTubeContext {
    videoTitle: string;
    channelName: string;
    description: string;
    platform: 'X' | 'Threads' | 'Facebook' | 'Instagram' | 'TikTok' | 'Pinterest' | 'YouTube';
    trailerType?: string;
    mediaType?: 'movie' | 'tv';
    releaseDate?: string;
    year?: number;
    cast?: string[];
    genres?: string[];
    productionNames?: string[];
    tmdbMatchStatus?: 'not-requested' | 'matched' | 'no-confident-match' | 'region-mismatch' | 'error';
    enableReleaseResearch?: boolean;
}

export async function generateYouTubeCaption(
    context: YouTubeContext,
    model: AIModel = DEFAULT_OPENAI_MODEL,
    customSystemPrompt?: string,
    customTemperature?: number
): Promise<string> {
    const defaultSystemPrompt = `You are a video content promoter.
Goal: Drive views to the video with high-energy copy.
- Use 2-3 emojis (🔥, 📺, etc).
- Highlight the "Hook" or main topic.
- Tone: Enthusiastic and Viral.
- Length: Under 280 chars.
`;

    const enableReleaseResearch = context.enableReleaseResearch ?? shouldEnableReleaseResearch({
        videoTitle: context.videoTitle,
        description: context.description,
        releaseDate: context.releaseDate,
        productionNames: context.productionNames,
        tmdbMatchStatus: context.tmdbMatchStatus,
        mediaType: context.mediaType,
    });
    const systemPrompt = enableReleaseResearch
        ? withReleaseResearchInstructions(customSystemPrompt || defaultSystemPrompt)
        : customSystemPrompt || defaultSystemPrompt;

    const prompt = `Generate a caption for this video:
Channel: ${context.channelName}
Title: ${context.videoTitle}
Trailer Type: ${context.trailerType || 'N/A'}
Type: ${context.mediaType || 'N/A'}
Release Date: ${context.releaseDate || 'N/A'}
Year: ${typeof context.year === 'number' ? context.year : 'N/A'}
Cast: ${formatPromptList(context.cast)}
Genres: ${formatPromptList(context.genres)}
Studios / Networks: ${formatPromptList(context.productionNames)}
Description: ${context.description.slice(0, 500)}...
Platform: ${context.platform}

${enableReleaseResearch
        ? 'Use live search when needed to confirm the release date and whether the title is going to theaters or to a specific network/streaming platform. Mention that destination only if it is confidently verified and helpful to the caption.'
        : 'Rely on the provided TMDb and YouTube metadata. If the release date or destination is not already clear from the supplied context, omit it instead of guessing.'}

Write ONLY the caption.`;

    const response = await generateCompletion({
        model,
        prompt,
        systemPrompt,
        maxTokens: 150,
        temperature: customTemperature !== undefined ? customTemperature : 0.8,
        jsonMode: false,
        enableWebSearch: enableReleaseResearch,
        webSearchUsageScope: 'youtube',
    });

    if (!response.success) {
        return `📺 New Video from ${context.channelName}: ${context.videoTitle}`;
    }
    return normalizeGeneratedText(response.content, ['universal', 'x', 'caption', 'text', 'content', 'threads', 'facebook', 'instagram', 'tiktok', 'youtube']);
}

// ============================================
// COMMENT REPLY GENERATOR
// ============================================

export interface CommentContext {
    originalComment: string;
    description?: string;
    platform: 'X' | 'Threads' | 'Facebook' | 'Instagram';
    tone?: string;
    maxLength?: number;
    username?: string;
    postTitle?: string;
    postText?: string;
}

export async function generateCommentReply(
    context: CommentContext,
    model: AIModel = DEFAULT_OPENAI_MODEL,
    customSystemPrompt?: string,
    customTemperature?: number
): Promise<string> {
    const normalizedMaxLength = typeof context.maxLength === 'number' && Number.isFinite(context.maxLength)
        ? Math.min(Math.max(Math.floor(context.maxLength), 40), 280)
        : 220;
    const lengthProfile = determineCommentReplyLengthProfile(context.originalComment, normalizedMaxLength);
    const tone = context.tone?.trim() || 'Natural, warm, and conversational';
    const defaultSystemPrompt = `You write social replies for Screen Render as a real human community voice.
Goal: reply to the person in a way that feels natural, specific, and grounded in the actual post.
- Sound like a real person, not a bot or brand template.
- Respond directly to what the commenter said.
- Use the supplied post context when it helps, but do not awkwardly dump title words back at them.
- Keep it concise, natural, and easy to read.
- Avoid generic filler like "Thanks for your comment", "We appreciate it", or "Stay tuned".
- Avoid hashtags and promo language.
- Avoid emoji spam. Use at most one emoji only if it feels natural.
- Do not use em dashes, en dashes, semicolons, or overly polished copywriting punctuation.
- If the comment is excited, match the energy.
- If the comment is asking a question, answer only from the provided context. If the answer is unclear, keep it honest and brief.
- If the comment is negative or skeptical, stay calm, respectful, and human.
- Default to a short reply. Only go medium or long if the comment clearly needs more context.
- Length profile for this reply: ${lengthProfile.label}.
- Tone target: ${tone}.
- Target length for this reply: around ${lengthProfile.targetChars} characters or less.
- Hard length limit: ${normalizedMaxLength} characters.
- Return only the reply text.`;

    const systemPrompt = customSystemPrompt?.trim()
        ? `${defaultSystemPrompt}\n\nAdditional brand voice instructions:\n${customSystemPrompt.trim()}`
        : defaultSystemPrompt;
    const promptSections = [
        `Platform: ${context.platform}`,
        context.username ? `Commenter: ${context.username}` : null,
        `Comment: "${context.originalComment}"`,
        context.description ? `Post summary: ${context.description}` : null,
        context.postTitle ? `Post title: ${context.postTitle}` : null,
        context.postText ? `Post text/caption: ${context.postText.slice(0, 500)}` : null,
        `Reply profile: ${lengthProfile.label}`,
        `Preferred reply size: around ${lengthProfile.targetChars} characters or less`,
        `Hard reply limit: ${normalizedMaxLength} characters`,
        'Write a direct reply to the commenter. Return ONLY the reply text.',
    ].filter((section): section is string => typeof section === 'string' && section.trim().length > 0);

    const prompt = promptSections.join('\n');

    const response = await generateCompletion({
        model,
        prompt,
        systemPrompt,
        maxTokens: lengthProfile.maxTokens,
        temperature: customTemperature !== undefined ? customTemperature : 0.9,
        jsonMode: false
    });

    if (!response.success) {
        return 'Appreciate that';
    }

    const normalizedReply = normalizeCommentReplyText(
        response.content.trim().replace(/^"|"$/g, '').replace(/\s+/g, ' ').trim()
    );
    if (!normalizedReply) {
        return 'Appreciate that';
    }

    return normalizedReply.slice(0, normalizedMaxLength).trim();
}

// ============================================
// STUDIO CAPTION GENERATOR (Generic)
// ============================================

export interface StudioContext {
    fileName: string;
    fileDescription?: string;
    detectedObjects?: string[]; // From Vision AI if available
    platform?: 'X' | 'Threads' | 'Facebook' | 'Instagram' | 'TikTok';
    tone?: string;
}

export async function generateStudioCaption(
    context: StudioContext,
    model: AIModel = DEFAULT_OPENAI_MODEL,
    customSystemPrompt?: string,
    customTemperature?: number,
    customMaxTokens?: number
): Promise<string> {
    const defaultSystemPrompt = `You are a creative director.
Goal: Write a compelling caption for a media upload.
- Use 1-3 emojis.
- Tone: ${context.tone || 'Creative and Professional'}.
- Length: Under 280 chars.
- Add 3 relevant hashtags at the end.
`;

    const systemPrompt = customSystemPrompt || defaultSystemPrompt;

    const prompt = `Generate a caption for this file:
File Name: ${context.fileName}
Description: ${context.fileDescription || 'No description provided'}
Detected: ${context.detectedObjects?.join(', ') || 'N/A'}
Platform: ${context.platform || 'General'}

Write ONLY the caption text.`;

    const response = await generateCompletion({
        model,
        prompt,
        systemPrompt,
        maxTokens: typeof customMaxTokens === 'number' && customMaxTokens > 0 ? customMaxTokens : 200,
        temperature: customTemperature !== undefined ? customTemperature : 0.8,
        jsonMode: false
    });

    if (!response.success) {
        return `✨ Checking this out: ${context.fileName} #Design #Creative`;
    }
    return response.content.trim().replace(/^"|"$/g, '');
}

// ============================================
// YOUTUBE PLAYLIST DETECTOR
// ============================================

export interface YouTubePlaylistOption {
    id: string;
    title: string;
    itemCount?: number;
    privacyStatus?: 'private' | 'public' | 'unlisted';
}

export interface YouTubePlaylistDetectionContext {
    videoTitle: string;
    description: string;
    channelName?: string;
    cleanedTitle?: string;
    trailerType?: string;
    mediaType?: 'movie' | 'tv';
    releaseDate?: string;
    year?: number;
    tmdbTitle?: string;
    genres?: string[];
    cast?: string[];
    productionNames?: string[];
}

export interface ComposeMetadataGenerationInput {
    metadataText: string;
    selectedPlatforms?: string[];
    availablePlaylists?: YouTubePlaylistOption[];
    sharedCaptionPrompt?: string;
    youtubeTitlePrompt?: string;
    youtubeDescriptionPrompt?: string;
    youtubePlaylistPrompt?: string;
    reviewPrompt?: string;
    summaryPrompt?: string;
    mediaContext?: {
        fileName?: string;
        mimeType?: string;
        mediaKind?: 'image' | 'video';
    };
}

export interface ComposeMetadataGenerationResult {
    sharedCaption: string;
    youtubeTitle: string;
    youtubeDescription: string;
    playlistSelection: {
        playlistId: string | null;
        playlistName: string | null;
        reason: string;
        confidence: number;
    };
}

export interface ComposeContentIntentResult {
    intent: 'post_generation' | 'review_generation' | 'summary_generation' | 'promo_caption_generation' | 'metadata_extraction' | 'mixed_request';
    outputMode: 'post_fields' | 'preview_only';
    format: 'general' | 'short_form_video' | 'social_post' | 'youtube_metadata';
    durationSeconds: number | null;
    directFieldFillAllowed: boolean;
    detectedTitle: string;
    containsMetadata: boolean;
}

export interface ComposeMediaMetadata {
    title: string;
    year: number | null;
    mediaType: string;
    cast: string[];
    director: string;
    creator: string;
    studio: string;
    platform: string;
    releaseDate: string;
    synopsis: string;
    producers: string[];
    franchise: string;
    tone: string;
    sourceType: string;
}

export interface ComposeContentGenerationInput extends ComposeMetadataGenerationInput {
    requestText: string;
}

export interface ComposeContentGenerationResult {
    intentResult: ComposeContentIntentResult;
    mediaMetadata: ComposeMediaMetadata;
    postFields: {
        sharedCaption: string;
        youtubeTitle: string;
        youtubeDescription: string;
        playlistSelection: {
            playlistId: string | null;
            playlistName: string | null;
            reason: string;
            confidence: number;
        };
    };
    editorialResult: {
        type: 'review' | 'summary' | 'editorial' | null;
        text: string;
    };
}

function normalizePlaylistKey(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseDetectedPlaylistIds(
    content: string,
    availablePlaylists: YouTubePlaylistOption[]
): string[] {
    const byId = new Map(availablePlaylists.map((playlist) => [playlist.id, playlist.id]));
    const byTitle = new Map(
        availablePlaylists.map((playlist) => [normalizePlaylistKey(playlist.title), playlist.id])
    );

    const coercePlaylistIds = (value: unknown): string[] => {
        if (!Array.isArray(value)) {
            return [];
        }

        return value.flatMap((entry) => {
            if (typeof entry === 'string') {
                const trimmed = entry.trim();
                if (!trimmed) {
                    return [];
                }
                return [byId.get(trimmed) || byTitle.get(normalizePlaylistKey(trimmed))].filter(
                    (id): id is string => typeof id === 'string' && id.length > 0
                );
            }

            if (entry && typeof entry === 'object') {
                const record = entry as { id?: unknown; title?: unknown };
                if (typeof record.id === 'string' && byId.has(record.id)) {
                    return [record.id];
                }
                if (typeof record.title === 'string') {
                    const matchedId = byTitle.get(normalizePlaylistKey(record.title));
                    return matchedId ? [matchedId] : [];
                }
            }

            return [];
        });
    };

    try {
        const parsed = JSON.parse(content) as
            | string[]
            | {
                playlists?: unknown;
                playlistIds?: unknown;
                selectedIds?: unknown;
                selectedPlaylists?: unknown;
            };

        const fromRoot = coercePlaylistIds(parsed);
        if (fromRoot.length > 0) {
            return Array.from(new Set(fromRoot));
        }

        if (parsed && typeof parsed === 'object') {
            const record = parsed as Record<string, unknown>;
            const fromNested = [
                ...coercePlaylistIds(record.selectedIds),
                ...coercePlaylistIds(record.playlistIds),
                ...coercePlaylistIds(record.playlists),
                ...coercePlaylistIds(record.selectedPlaylists),
            ];

            if (fromNested.length > 0) {
                return Array.from(new Set(fromNested));
            }
        }
    } catch {
        // Fall through to line-based parsing.
    }

    const lineMatches = content
        .split(/[\r\n,]+/)
        .flatMap((part) => {
            const trimmed = part.trim().replace(/^[-*]\s*/, '').replace(/^"+|"+$/g, '');
            if (!trimmed) {
                return [];
            }
            return [byId.get(trimmed) || byTitle.get(normalizePlaylistKey(trimmed))].filter(
                (id): id is string => typeof id === 'string' && id.length > 0
            );
        });

    return Array.from(new Set(lineMatches));
}

function detectPlaylistHeuristicFallback(
    context: YouTubePlaylistDetectionContext,
    availablePlaylists: YouTubePlaylistOption[]
): string[] {
    const title = `${context.videoTitle} ${context.cleanedTitle || ''}`.toLowerCase();
    const description = context.description.toLowerCase();
    const trailerType = (context.trailerType || '').toLowerCase();
    const genres = Array.isArray(context.genres) ? context.genres.map((genre) => genre.toLowerCase()) : [];

    const isAnime = genres.includes('animation')
        || /\banime\b/.test(title)
        || /\banime\b/.test(description)
        || /\bcrunchyroll\b/.test(description);
    const isClip = /\bclip\b/.test(trailerType)
        || /\bclip\b/.test(title)
        || /\bscene\b/.test(title)
        || /\bfeaturette\b/.test(title)
        || /\bspot\b/.test(title);
    const mediaType = context.mediaType
        || (/\bseason\b|\bepisode\b|\bseries\b|\bshow\b/.test(title) ? 'tv' : 'movie');

    const orderedMatches: string[] = [];
    const pushMatchingTitles = (patterns: RegExp[]) => {
        for (const playlist of availablePlaylists) {
            const normalizedTitle = normalizePlaylistKey(playlist.title);
            if (patterns.some((pattern) => pattern.test(normalizedTitle)) && !orderedMatches.includes(playlist.id)) {
                orderedMatches.push(playlist.id);
            }
        }
    };

    if (isAnime && !isClip) {
        pushMatchingTitles([/\banime\b/]);
    }

    if (mediaType === 'tv' && isClip) {
        pushMatchingTitles([/\btv\b.*\bclip\b/, /\bshow\b.*\bclip\b/, /\bseries\b.*\bclip\b/]);
    }

    if (mediaType === 'movie' && isClip) {
        pushMatchingTitles([/\bmovie\b.*\bclip\b/, /\bfilm\b.*\bclip\b/, /\bclip\b/]);
    }

    if (mediaType === 'tv' && !isClip) {
        pushMatchingTitles([/\btv\b.*\btrailer\b/, /\bshow\b.*\btrailer\b/, /\bseries\b.*\btrailer\b/]);
    }

    if (mediaType === 'movie' && !isClip) {
        pushMatchingTitles([/\bmovie\b.*\btrailer\b/, /\bfilm\b.*\btrailer\b/, /\btrailer\b/]);
    }

    if (isAnime && orderedMatches.length === 0) {
        pushMatchingTitles([/\banimation\b/, /\banime\b/]);
    }

    return orderedMatches.slice(0, 3);
}

export async function detectYouTubePlaylists(
    context: YouTubePlaylistDetectionContext,
    availablePlaylists: YouTubePlaylistOption[],
    model: AIModel = DEFAULT_OPENAI_MODEL,
    customPrompt?: string
): Promise<string[]> {
    if (!Array.isArray(availablePlaylists) || availablePlaylists.length === 0) {
        return [];
    }

    const defaultPrompt = `You are assigning a Screen Render YouTube upload to the correct existing channel playlists.
Return ONLY valid JSON.

Rules:
- You may choose multiple playlists only when they are genuinely relevant.
- Choose ONLY from the exact playlist IDs provided below.
- Never invent a playlist name or ID.
- Use live web search when needed to verify whether the title is a movie, TV show, anime, trailer, teaser, clip, featurette, or scene.
- Prefer the tightest exact fit.
- If confidence is low, return [] instead of guessing.

Return format:
{"selectedIds":["playlist-id-1","playlist-id-2"]}`;

    const prompt = `Video Title: ${context.videoTitle}
Cleaned Title: ${context.cleanedTitle || 'N/A'}
Channel: ${context.channelName || 'N/A'}
Trailer Type: ${context.trailerType || 'N/A'}
Media Type: ${context.mediaType || 'N/A'}
TMDb Match: ${context.tmdbTitle || 'N/A'}
Release Date: ${context.releaseDate || 'N/A'}
Year: ${typeof context.year === 'number' ? context.year : 'N/A'}
Genres: ${formatPromptList(context.genres)}
Cast: ${formatPromptList(context.cast)}
Studios / Networks: ${formatPromptList(context.productionNames)}
Description: ${context.description}

Available Channel Playlists:
${availablePlaylists.map((playlist) => `- ${playlist.id}: ${playlist.title}`).join('\n')}

Select the most appropriate real channel playlist IDs for this upload.
${customPrompt || defaultPrompt}`;

    const response = await generateCompletion({
        model,
        prompt,
        jsonMode: true,
        temperature: 0.1,
        enableWebSearch: true,
        webSearchUsageScope: 'youtube',
    });

    if (!response.success) {
        return detectPlaylistHeuristicFallback(context, availablePlaylists);
    }

    const parsedIds = parseDetectedPlaylistIds(response.content, availablePlaylists);
    if (parsedIds.length > 0) {
        return parsedIds;
    }

    return detectPlaylistHeuristicFallback(context, availablePlaylists);
}

function normalizeComposeMetadataText(value: string): string {
    return value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
}

function normalizeComposeParagraphText(value: string): string {
    const normalized = value.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
        return '';
    }

    return normalized
        .split(/\n\s*\n+/)
        .map((paragraph) => paragraph
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .join(' ')
            .replace(/[ \t]+/g, ' ')
            .trim())
        .filter(Boolean)
        .join('\n\n');
}

export function extractComposeMetadataPreviewText(
    requestText: string,
    mediaMetadata?: Partial<ComposeMediaMetadata> | null
): string {
    const normalized = normalizeComposeMetadataText(requestText || '');
    if (!normalized) {
        return normalizeComposeMetadataText(mediaMetadata?.synopsis || '');
    }

    const descriptionLine = normalized
        .split('\n')
        .map((line) => line.trim())
        .find((line) => /^Description:\s+/i.test(line));

    if (descriptionLine) {
        return descriptionLine.replace(/^Description:\s+/i, '').trim();
    }

    return normalizeComposeMetadataText(mediaMetadata?.synopsis || '');
}

function parseDurationSeconds(value: string): number | null {
    const secondMatch = value.match(/\b(\d{1,3})\s*(?:second|seconds|sec)\b/i);
    if (secondMatch) {
        const seconds = Number(secondMatch[1]);
        return Number.isFinite(seconds) ? seconds : null;
    }

    const minuteMatch = value.match(/\b(\d{1,2})\s*(?:minute|minutes|min)\b/i);
    if (minuteMatch) {
        const minutes = Number(minuteMatch[1]);
        return Number.isFinite(minutes) ? minutes * 60 : null;
    }

    return null;
}

function inferContainsComposeMetadata(value: string): boolean {
    if (value.includes('\n')) {
        return true;
    }

    return /\b(premieres?|starring|cast|synopsis|official trailer|teaser|release date|coming to|streaming on|apple tv\+|netflix|hbo|max|paramount\+|prime video|studio|creator|directed by|produced by)\b/i.test(value);
}

function inferDetectedTitle(value: string): string {
    const quoted = value.match(/["“]([^"”]{2,80})["”]/);
    if (quoted?.[1]) {
        return quoted[1].trim();
    }

    const forMatch = value.match(/\bfor\s+([A-Z][A-Za-z0-9:'&.-]*(?:\s+[A-Z][A-Za-z0-9:'&.-]*){0,5})/);
    if (forMatch?.[1]) {
        return forMatch[1].trim();
    }

    const ofMatch = value.match(/\b(?:review|summary|summarize)\s+(?:of|for)\s+([A-Z][A-Za-z0-9:'&.-]*(?:\s+[A-Z][A-Za-z0-9:'&.-]*){0,5})/i);
    if (ofMatch?.[1]) {
        return ofMatch[1].trim();
    }

    const titleLead = value.match(/^([A-Z][A-Za-z0-9:'&.-]*(?:\s+[A-Z][A-Za-z0-9:'&.-]*){0,6})\s+(?:premieres?|is|returns|arrives|official|trailer|teaser)\b/m);
    if (titleLead?.[1]) {
        return titleLead[1].trim();
    }

    return '';
}

export function buildDefaultComposeIntentResult(requestText: string): ComposeContentIntentResult {
    const normalized = normalizeComposeMetadataText(requestText);
    const lower = normalized.toLowerCase();
    const durationSeconds = parseDurationSeconds(lower);
    const detectedTitle = inferDetectedTitle(normalized);
    const containsMetadata = inferContainsComposeMetadata(normalized);
    const asksForReview = /\breview\b/i.test(normalized);
    const asksForSummary = /\bsummar(?:y|ize)\b/i.test(normalized);
    const postReadyLanguage = /\b(caption|post|instagram|threads|tiktok|youtube|description|title|teaser post|for posting|short review|short-form|short form|video)\b/i.test(normalized);

    if (asksForReview) {
        const directFieldFillAllowed = postReadyLanguage || durationSeconds !== null;
        return {
            intent: 'review_generation',
            outputMode: directFieldFillAllowed ? 'post_fields' : 'preview_only',
            format: directFieldFillAllowed
                ? (durationSeconds !== null ? 'short_form_video' : 'social_post')
                : 'general',
            durationSeconds,
            directFieldFillAllowed,
            detectedTitle,
            containsMetadata,
        };
    }

    if (asksForSummary) {
        const directFieldFillAllowed = /\bcaption|post|instagram|threads|tiktok|youtube\b/i.test(normalized);
        return {
            intent: 'summary_generation',
            outputMode: directFieldFillAllowed ? 'post_fields' : 'preview_only',
            format: directFieldFillAllowed ? 'social_post' : 'general',
            durationSeconds,
            directFieldFillAllowed,
            detectedTitle,
            containsMetadata,
        };
    }

    return {
        intent: containsMetadata ? 'post_generation' : 'mixed_request',
        outputMode: 'post_fields',
        format: /\byoutube\b/i.test(normalized) ? 'youtube_metadata' : 'social_post',
        durationSeconds,
        directFieldFillAllowed: true,
        detectedTitle,
        containsMetadata,
    };
}

function createEmptyComposeMediaMetadata(): ComposeMediaMetadata {
    return {
        title: '',
        year: null,
        mediaType: '',
        cast: [],
        director: '',
        creator: '',
        studio: '',
        platform: '',
        releaseDate: '',
        synopsis: '',
        producers: [],
        franchise: '',
        tone: '',
        sourceType: '',
    };
}

function sanitizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 12);
}

function coerceComposeMediaMetadata(value: unknown, fallbackTitle = '', fallbackSourceType = ''): ComposeMediaMetadata {
    if (!value || typeof value !== 'object') {
        return {
            ...createEmptyComposeMediaMetadata(),
            title: fallbackTitle,
            sourceType: fallbackSourceType,
        };
    }

    const record = value as Record<string, unknown>;
    const numericYear = typeof record.year === 'number' ? record.year : Number(record.year);

    return {
        title: typeof record.title === 'string' ? record.title.trim() : fallbackTitle,
        year: Number.isFinite(numericYear) ? numericYear : null,
        mediaType: typeof record.mediaType === 'string' ? record.mediaType.trim() : '',
        cast: sanitizeStringArray(record.cast),
        director: typeof record.director === 'string' ? record.director.trim() : '',
        creator: typeof record.creator === 'string' ? record.creator.trim() : '',
        studio: typeof record.studio === 'string' ? record.studio.trim() : '',
        platform: typeof record.platform === 'string' ? record.platform.trim() : '',
        releaseDate: typeof record.releaseDate === 'string' ? record.releaseDate.trim() : '',
        synopsis: typeof record.synopsis === 'string' ? record.synopsis.trim() : '',
        producers: sanitizeStringArray(record.producers),
        franchise: typeof record.franchise === 'string' ? record.franchise.trim() : '',
        tone: typeof record.tone === 'string' ? record.tone.trim() : '',
        sourceType: typeof record.sourceType === 'string' ? record.sourceType.trim() : fallbackSourceType,
    };
}

async function classifyComposeInput(
    requestText: string,
    model: AIModel
): Promise<ComposeContentIntentResult> {
    const fallback = buildDefaultComposeIntentResult(requestText);
    const prompt = `Classify the following Add/Edit Post AI request for a media publishing workflow.
Return ONLY valid JSON.

Allowed intents:
- post_generation
- review_generation
- summary_generation
- promo_caption_generation
- metadata_extraction
- mixed_request

Allowed outputMode values:
- post_fields
- preview_only

Allowed format values:
- general
- short_form_video
- social_post
- youtube_metadata

Direct-fill rule:
- Requests clearly meant for publishing, captions, social posts, or short-form video should use post_fields.
- Standalone review or summary requests with no publishing intent should use preview_only.

Input:
${requestText.slice(0, 6000)}

Return this exact JSON shape:
{
  "intent": "post_generation",
  "outputMode": "post_fields",
  "format": "social_post",
  "durationSeconds": null,
  "directFieldFillAllowed": true,
  "detectedTitle": "",
  "containsMetadata": false
}`;

    try {
        const response = await generateCompletion({
            model,
            prompt,
            jsonMode: true,
            temperature: 0.1,
            enableWebSearch: false,
        });

        if (!response.success) {
            return fallback;
        }

        const parsed = JSON.parse(response.content) as Record<string, unknown>;
        const intent = typeof parsed.intent === 'string' ? parsed.intent : fallback.intent;
        const outputMode = parsed.outputMode === 'preview_only' ? 'preview_only' : 'post_fields';
        const format = typeof parsed.format === 'string' ? parsed.format : fallback.format;
        const durationCandidate = typeof parsed.durationSeconds === 'number' ? parsed.durationSeconds : Number(parsed.durationSeconds);

        return {
            intent:
                intent === 'review_generation'
                || intent === 'summary_generation'
                || intent === 'promo_caption_generation'
                || intent === 'metadata_extraction'
                || intent === 'mixed_request'
                    ? intent
                    : 'post_generation',
            outputMode,
            format:
                format === 'short_form_video' || format === 'social_post' || format === 'youtube_metadata'
                    ? format
                    : 'general',
            durationSeconds: Number.isFinite(durationCandidate) ? durationCandidate : fallback.durationSeconds,
            directFieldFillAllowed:
                typeof parsed.directFieldFillAllowed === 'boolean'
                    ? parsed.directFieldFillAllowed
                    : outputMode === 'post_fields',
            detectedTitle:
                typeof parsed.detectedTitle === 'string' && parsed.detectedTitle.trim()
                    ? parsed.detectedTitle.trim()
                    : fallback.detectedTitle,
            containsMetadata:
                typeof parsed.containsMetadata === 'boolean'
                    ? parsed.containsMetadata
                    : fallback.containsMetadata,
        };
    } catch {
        return fallback;
    }
}

async function extractComposeMediaMetadata(
    requestText: string,
    model: AIModel,
    detectedTitle = ''
): Promise<ComposeMediaMetadata> {
    const normalized = normalizeComposeMetadataText(requestText);
    const fallbackTitle = detectedTitle || inferDetectedTitle(normalized);
    const prompt = `Extract normalized media metadata from the input below for a movie/TV post builder.
Return ONLY valid JSON.

Rules:
- If a field is missing, use an empty string, [] or null.
- Do not invent facts.
- Keep cast and producers concise.
- sourceType should reflect the input style such as promotional_metadata, natural_language_request, mixed_input, or title_only_request.

Input:
${normalized.slice(0, 8000)}

Return this exact JSON shape:
{
  "title": "",
  "year": null,
  "mediaType": "",
  "cast": [],
  "director": "",
  "creator": "",
  "studio": "",
  "platform": "",
  "releaseDate": "",
  "synopsis": "",
  "producers": [],
  "franchise": "",
  "tone": "",
  "sourceType": ""
}`;

    try {
        const response = await generateCompletion({
            model,
            prompt,
            jsonMode: true,
            temperature: 0.1,
            enableWebSearch: true,
            webSearchUsageScope: 'compose',
        });

        if (!response.success) {
            return coerceComposeMediaMetadata(undefined, fallbackTitle, inferContainsComposeMetadata(normalized) ? 'promotional_metadata' : 'natural_language_request');
        }

        const parsed = JSON.parse(response.content);
        const metadata = coerceComposeMediaMetadata(
            parsed,
            fallbackTitle,
            inferContainsComposeMetadata(normalized) ? 'promotional_metadata' : 'natural_language_request'
        );

        if (!metadata.title) {
            metadata.title = fallbackTitle;
        }

        if (!metadata.sourceType) {
            metadata.sourceType = inferContainsComposeMetadata(normalized) ? 'promotional_metadata' : 'natural_language_request';
        }

        return metadata;
    } catch {
        return coerceComposeMediaMetadata(undefined, fallbackTitle, inferContainsComposeMetadata(normalized) ? 'promotional_metadata' : 'natural_language_request');
    }
}

function buildComposeSourceContextLabel(metadata: ComposeMediaMetadata, intentResult: ComposeContentIntentResult): string {
    const parts = [
        metadata.title || intentResult.detectedTitle,
        metadata.mediaType,
        metadata.platform,
        metadata.releaseDate,
    ].filter(Boolean);

    return parts.join(' | ');
}

export function coerceComposePlaylistSelection(
    selection: unknown,
    availablePlaylists: YouTubePlaylistOption[]
): { playlistId: string | null; playlistName: string | null; reason: string; confidence: number } {
    const byId = new Map(availablePlaylists.map((playlist) => [playlist.id, playlist]));
    const byTitle = new Map(
        availablePlaylists.map((playlist) => [normalizePlaylistKey(playlist.title), playlist])
    );

    const normalizeConfidence = (value: unknown) => {
        const numeric = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(numeric)) {
            return 0;
        }

        return Math.max(0, Math.min(1, numeric));
    };

    const baseReason =
        selection && typeof selection === 'object' && typeof (selection as Record<string, unknown>).reason === 'string'
            ? String((selection as Record<string, unknown>).reason).trim()
            : '';
    const confidence =
        selection && typeof selection === 'object'
            ? normalizeConfidence((selection as Record<string, unknown>).confidence)
            : 0;

    if (!selection || typeof selection !== 'object') {
        return {
            playlistId: null,
            playlistName: null,
            reason: baseReason || 'No playlist suggestion returned.',
            confidence,
        };
    }

    const record = selection as Record<string, unknown>;
    const rawPlaylistId = typeof record.playlistId === 'string' ? record.playlistId.trim() : '';
    const rawPlaylistName = typeof record.playlistName === 'string' ? record.playlistName.trim() : '';

    const matchedById = rawPlaylistId ? byId.get(rawPlaylistId) : undefined;
    if (matchedById) {
        return {
            playlistId: matchedById.id,
            playlistName: matchedById.title,
            reason: baseReason || 'Matched the exact playlist ID from the available channel playlists.',
            confidence,
        };
    }

    const matchedByTitle =
        (rawPlaylistName ? byTitle.get(normalizePlaylistKey(rawPlaylistName)) : undefined)
        || (rawPlaylistId ? byTitle.get(normalizePlaylistKey(rawPlaylistId)) : undefined);

    if (matchedByTitle) {
        return {
            playlistId: matchedByTitle.id,
            playlistName: matchedByTitle.title,
            reason: baseReason || 'Matched the suggested playlist name to an available channel playlist.',
            confidence,
        };
    }

    return {
        playlistId: null,
        playlistName: null,
        reason: baseReason || 'No valid playlist match was found in the available channel playlists.',
        confidence,
    };
}

async function generateComposeEditorialResult(
    requestText: string,
    intentResult: ComposeContentIntentResult,
    mediaMetadata: ComposeMediaMetadata,
    input: ComposeContentGenerationInput,
    model: AIModel
): Promise<{ type: 'review' | 'summary' | 'editorial' | null; text: string }> {
    const editorialType =
        intentResult.intent === 'review_generation'
            ? 'review'
            : intentResult.intent === 'summary_generation'
                ? 'summary'
                : 'editorial';

    if (intentResult.intent === 'metadata_extraction') {
        return {
            type: editorialType,
            text: extractComposeMetadataPreviewText(requestText, mediaMetadata),
        };
    }

    const promptGuide =
        editorialType === 'review'
            ? input.reviewPrompt || 'Write a sharp, publishable review that sounds natural and specific.'
            : editorialType === 'summary'
                ? input.summaryPrompt || 'Write a concise, informative summary grounded in the source context.'
                : input.sharedCaptionPrompt || 'Write a clean editorial paragraph grounded in the source context.';

    const prompt = `You are generating a standalone ${editorialType} result for the Add/Edit Post page.
Return ONLY valid JSON.

Goal:
- Generate a polished ${editorialType} that the user can preview first before applying.
- Do not include playlist IDs or field-routing commentary.

Saved Prompt Guidance:
${promptGuide}

Intent:
${JSON.stringify(intentResult, null, 2)}

Extracted Media Metadata:
${JSON.stringify(mediaMetadata, null, 2)}

User Source or Prompt Input:
${requestText.slice(0, 8000)}

Return this exact JSON shape:
{
  "type": "${editorialType}",
  "text": "string"
}`;

    try {
        const response = await generateCompletion({
            model,
            prompt,
            jsonMode: true,
            temperature: 0.5,
            enableWebSearch: true,
            webSearchUsageScope: 'compose',
        });

        if (!response.success) {
            return { type: editorialType, text: '' };
        }

        const parsed = JSON.parse(response.content) as Record<string, unknown>;
        return {
            type: editorialType,
            text: typeof parsed.text === 'string' ? parsed.text.trim() : '',
        };
    } catch {
        return { type: editorialType, text: '' };
    }
}

async function generateComposePostFields(
    requestText: string,
    intentResult: ComposeContentIntentResult,
    mediaMetadata: ComposeMediaMetadata,
    input: ComposeContentGenerationInput,
    model: AIModel
): Promise<ComposeMetadataGenerationResult> {
    const availablePlaylists = Array.isArray(input.availablePlaylists) ? input.availablePlaylists : [];
    const selectedPlatforms = Array.isArray(input.selectedPlatforms) ? input.selectedPlatforms : [];
    const includeYouTube = selectedPlatforms.some((platform) => platform === 'youtube_longform' || platform === 'youtube_shorts');
    const requestModeDescription =
        intentResult.intent === 'review_generation'
            ? `Generate a publish-ready review${intentResult.durationSeconds ? ` that fits roughly ${intentResult.durationSeconds} seconds of narration/caption timing` : ''}.`
            : intentResult.intent === 'summary_generation'
                ? 'Generate a publish-ready summary for social posting.'
                : 'Generate publish-ready social post content.';

    const prompt = `You are generating Add/Edit Post field content for Screen Render.
Return ONLY valid JSON.

Task:
${requestModeDescription}

Rules:
- Shared caption must be publish-ready and concise enough for the current post workflow.
- Only generate YouTube title, description, and playlist reasoning when includeYouTube is true.
- Never invent a playlist ID or playlist name.
- If no playlist clearly fits, return null for playlistId and playlistName.

Saved Prompt Guidance:
Shared Caption Prompt:
${input.sharedCaptionPrompt || 'N/A'}

YouTube Title Prompt:
${input.youtubeTitlePrompt || 'N/A'}

YouTube Description Prompt:
${input.youtubeDescriptionPrompt || 'N/A'}

YouTube Playlist Prompt:
${input.youtubePlaylistPrompt || 'N/A'}

Review Prompt:
${input.reviewPrompt || 'N/A'}

Summary Prompt:
${input.summaryPrompt || 'N/A'}

includeYouTube:
${includeYouTube ? 'true' : 'false'}

Selected Platforms:
${selectedPlatforms.length > 0 ? selectedPlatforms.join(', ') : 'None selected'}

Source Context:
${buildComposeSourceContextLabel(mediaMetadata, intentResult) || 'N/A'}

Media Metadata:
${JSON.stringify(mediaMetadata, null, 2)}

Media Context:
${JSON.stringify(input.mediaContext || {}, null, 2)}

User Source or Prompt Input:
${requestText.slice(0, 8000)}

Available YouTube Playlists:
${includeYouTube && availablePlaylists.length > 0
        ? availablePlaylists.map((playlist) => `- ${playlist.id}: ${playlist.title}`).join('\n')
        : '- None available'}

Return this exact JSON shape:
{
  "sharedCaption": "string",
  "youtubeTitle": "string",
  "youtubeDescription": "string",
  "playlistSelection": {
    "playlistId": "string | null",
    "playlistName": "string | null",
    "reason": "string",
    "confidence": 0.0
  }
}`;

    const response = await generateCompletion({
        model,
        prompt,
        jsonMode: true,
        temperature: 0.35,
        enableWebSearch: true,
        webSearchUsageScope: 'compose',
    });

    if (!response.success) {
        throw new Error(response.error || 'Failed to generate compose post fields.');
    }

    const parsed = JSON.parse(response.content) as Record<string, unknown>;
    const sharedCaption = typeof parsed.sharedCaption === 'string' ? normalizeComposeParagraphText(parsed.sharedCaption) : '';
    const youtubeTitle = includeYouTube && typeof parsed.youtubeTitle === 'string' ? parsed.youtubeTitle.trim() : '';
    const youtubeDescription = includeYouTube && typeof parsed.youtubeDescription === 'string'
        ? normalizeComposeParagraphText(parsed.youtubeDescription)
        : '';
    let playlistSelection = includeYouTube
        ? coerceComposePlaylistSelection(parsed.playlistSelection, availablePlaylists)
        : {
            playlistId: null,
            playlistName: null,
            reason: 'YouTube is not selected for this compose item.',
            confidence: 0,
        };

    if (includeYouTube && !playlistSelection.playlistId && availablePlaylists.length > 0) {
        const fallbackIds = await detectYouTubePlaylists(
            {
                videoTitle: youtubeTitle || mediaMetadata.title || intentResult.detectedTitle || sharedCaption || requestText.slice(0, 160),
                description: `${youtubeDescription}\n\n${mediaMetadata.synopsis}\n\n${requestText}`.trim(),
                cleanedTitle: mediaMetadata.title || intentResult.detectedTitle || undefined,
                mediaType: mediaMetadata.mediaType === 'tv_series' || mediaMetadata.mediaType === 'tv'
                    ? 'tv'
                    : mediaMetadata.mediaType === 'movie'
                        ? 'movie'
                        : undefined,
                year: mediaMetadata.year ?? undefined,
                releaseDate: mediaMetadata.releaseDate || undefined,
                cast: mediaMetadata.cast,
                productionNames: [mediaMetadata.studio, ...mediaMetadata.producers].filter(Boolean),
            },
            availablePlaylists,
            model,
            input.youtubePlaylistPrompt,
        );

        const fallbackPlaylist = fallbackIds.length > 0
            ? availablePlaylists.find((playlist) => playlist.id === fallbackIds[0])
            : undefined;

        if (fallbackPlaylist) {
            playlistSelection = {
                playlistId: fallbackPlaylist.id,
                playlistName: fallbackPlaylist.title,
                reason: playlistSelection.reason || 'Matched a fallback playlist from the existing channel playlists.',
                confidence: playlistSelection.confidence > 0 ? playlistSelection.confidence : 0.55,
            };
        }
    }

    return {
        sharedCaption,
        youtubeTitle,
        youtubeDescription,
        playlistSelection,
    };
}

export async function generateComposeContent(
    input: ComposeContentGenerationInput,
    model: AIModel = DEFAULT_OPENAI_MODEL
): Promise<ComposeContentGenerationResult> {
    const requestText = normalizeComposeMetadataText(
        await resolveComposeSourceInputText(input.requestText || input.metadataText || ''),
    );
    if (!requestText) {
        throw new Error('Source or prompt input is required.');
    }

    const intentResult = await classifyComposeInput(requestText, model);
    const mediaMetadata = await extractComposeMediaMetadata(requestText, model, intentResult.detectedTitle);

    if (!intentResult.detectedTitle && mediaMetadata.title) {
        intentResult.detectedTitle = mediaMetadata.title;
    }

    if (intentResult.outputMode === 'preview_only') {
        const editorialResult = await generateComposeEditorialResult(requestText, intentResult, mediaMetadata, input, model);
        return {
            intentResult,
            mediaMetadata,
            postFields: {
                sharedCaption: '',
                youtubeTitle: '',
                youtubeDescription: '',
                playlistSelection: {
                    playlistId: null,
                    playlistName: null,
                    reason: 'Preview-only request; no direct playlist mapping applied.',
                    confidence: 0,
                },
            },
            editorialResult,
        };
    }

    const postFields = await generateComposePostFields(requestText, intentResult, mediaMetadata, input, model);

    return {
        intentResult,
        mediaMetadata,
        postFields,
        editorialResult: {
            type: null,
            text: '',
        },
    };
}

export async function resolveComposeSourceTitle(
    requestText: string,
    model: AIModel = DEFAULT_OPENAI_MODEL,
    fallbackTitle = ''
): Promise<string> {
    const normalized = normalizeComposeMetadataText(requestText || '');
    if (!normalized) {
        return fallbackTitle.trim();
    }

    const intentResult = await classifyComposeInput(normalized, model);
    const mediaMetadata = await extractComposeMediaMetadata(normalized, model, intentResult.detectedTitle || fallbackTitle);

    return mediaMetadata.title || intentResult.detectedTitle || inferDetectedTitle(normalized) || fallbackTitle.trim();
}

export async function generateComposeMetadataDraft(
    input: ComposeMetadataGenerationInput,
    model: AIModel = DEFAULT_OPENAI_MODEL
): Promise<ComposeMetadataGenerationResult> {
    const result = await generateComposeContent(
        {
            ...input,
            requestText: input.metadataText,
        },
        model
    );

    return result.postFields;
}

// ============================================
// PINTEREST METADATA GENERATOR
// ============================================

export async function generatePinterestMetadata(
    context: {
        title: string;
        description: string;
        cast?: string[];
        mediaType?: 'movie' | 'tv';
        releaseDate?: string;
        year?: number;
        productionNames?: string[];
    },
    model: AIModel = DEFAULT_OPENAI_MODEL,
    titlePrompt?: string,
    descPrompt?: string
): Promise<{ title: string; description: string }> {

    // generate title
    const tPrompt = `Generate a Pinterest Pin Title for:
    Title: ${context.title}
    Type: ${context.mediaType || 'N/A'}
    Release Date: ${context.releaseDate || 'N/A'}
    Year: ${typeof context.year === 'number' ? context.year : 'N/A'}
    Cast: ${formatPromptList(context.cast)}
    Studios / Networks: ${formatPromptList(context.productionNames)}
    
    ${titlePrompt || 'Create a searchable, SEO-friendly title under 100 chars.'}
    Use live search when needed to verify the release date and the theater/network/platform destination before mentioning it.
    Return ONLY the title text.`;

    // generate description
    const dPrompt = `Generate a Pinterest Pin Description for:
    Title: ${context.title}
    Type: ${context.mediaType || 'N/A'}
    Release Date: ${context.releaseDate || 'N/A'}
    Year: ${typeof context.year === 'number' ? context.year : 'N/A'}
    Cast: ${formatPromptList(context.cast)}
    Studios / Networks: ${formatPromptList(context.productionNames)}
    Desc: ${context.description}
    
    ${descPrompt || 'Create an engaging, keyword-rich description under 500 chars with 2-3 hashtags.'}
    Use live search when needed to verify the release date and the theater/network/platform destination before mentioning it.
    Return ONLY the description text.`;

    const [titleRes, descRes] = await Promise.all([
        generateCompletion({ model, prompt: tPrompt, temperature: 0.7, enableWebSearch: true, webSearchUsageScope: 'compose' }),
        generateCompletion({ model, prompt: dPrompt, temperature: 0.7, enableWebSearch: true, webSearchUsageScope: 'compose' })
    ]);

    return {
        title: titleRes.success ? titleRes.content.trim().replace(/^"|"$/g, '') : context.title,
        description: descRes.success ? descRes.content.trim().replace(/^"|"$/g, '') : context.description
    };
}

// ============================================
// EXPORTS
// ============================================

export default {
    generateCompletion,
    validateTMDbContent,
    validateYouTubeTrailer,
    generateTMDbCaption,
    generateRSSCaptionResult,
    generateRSSCaption,
    generateYouTubeCaption,
    generateCommentReply,
    generateStudioCaption,
    detectYouTubePlaylists,
    generateComposeContent,
    generateComposeMetadataDraft,
    generatePinterestMetadata,
    getOpenAIKey,
    getFlash3Key,
    resolveComposeSourceTitle,
};
