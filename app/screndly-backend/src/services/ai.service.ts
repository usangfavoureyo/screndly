/**
 * AI Service - Unified Model Routing
 * Routes requests to appropriate AI model (OpenAI, Flash 3/Jordanite)
 */

import prisma from '../lib/prisma';
import { readSecretSettingValue } from '../lib/settings';
import { trackApiUsage } from './api-usage.service';
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
            await trackApiUsage({
                service: 'openai',
                endpoint: '/v1/chat/completions',
                success: false,
            });
            tracked = true;
            throw new Error(errorData.error?.message || 'OpenAI API error');
        }

        const data = await response.json() as {
            choices?: Array<{ message?: { content?: unknown } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };
        const content = extractOpenAIMessageContent(data.choices?.[0]?.message?.content);

        await trackApiUsage({
            service: 'openai',
            endpoint: '/v1/chat/completions',
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
                endpoint: '/v1/chat/completions',
                success: false,
            });
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
            await trackApiUsage({
                service: 'openai',
                endpoint: '/v1/responses',
                success: false,
            });
            tracked = true;
            throw new Error(errorData.error?.message || 'OpenAI Responses API error');
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
            endpoint: '/v1/responses',
            tokens: data.usage?.total_tokens || 0,
            success: true,
        });
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
                endpoint: '/v1/responses',
                success: false,
            });
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
        enableWebSearch: true
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
    daysUntil: number;
    releaseDate?: string;
    year?: number;
    anniversaryYears?: number;
    cast: string[];
    genres: string[];
    platform?: 'X' | 'Threads' | 'Facebook' | 'Instagram';
    tone?: string;
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
- TENSE RULES:
  - releasing_today -> PRESENT Tense ("Out now", "Streaming today")
  - releasing_this_week -> ANTICIPATORY ("Coming this week", "Just X days left")
  - releasing_this_month -> PREVIEW ("Look ahead", "Mark your calendars")
  - anniversary -> NOSTALGIC ("Released X years ago", "A classic turns X")
`;

    const systemPrompt = withReleaseResearchInstructions(customSystemPrompt || defaultSystemPrompt);

    const platformLine = context.platform ? `Platform: ${context.platform}` : 'Platform: Unknown';

    const prompt = `Generate a caption for this content:
Title: ${context.title}
Type: ${context.mediaType}
Tag: ${context.temporalTag}
Days Until: ${context.daysUntil}
Release Date: ${context.releaseDate || 'N/A'}
Year: ${typeof context.year === 'number' ? context.year : 'N/A'}
Anniversary Years: ${typeof context.anniversaryYears === 'number' ? context.anniversaryYears : 'N/A'}
Cast: ${formatPromptList(context.cast)}
Genres: ${formatPromptList(context.genres)}
${platformLine}

If the caption benefits from release context, verify whether it is theatrical or tied to a specific network/streaming platform before mentioning it.
If platform/network context is unknown, uncertain, or not provided, do not name any platform, network, streamer, or social app in the caption.
Use neutral phrasing like "releases this week" or "premieres this month" instead.

Write ONLY the caption text. No preamble.`;

    const response = await generateCompletion({
        model,
        prompt,
        systemPrompt,
        maxTokens: 150,
        temperature: customTemperature !== undefined ? customTemperature : 0.7, // Custom temp or default high temp for creativity
        jsonMode: false,
        enableWebSearch: true,
    });

    if (!response.success) {
        // Fallback to basic template if AI fails
        return `${context.temporalTag === 'releasing_today' ? '🚨 OUT NOW:' : '🎬'} ${context.title} ${context.daysUntil > 0 ? `(In ${context.daysUntil} days)` : ''}`;
    }

    return normalizeGeneratedText(response.content, ['caption', 'text', 'content']);
}

// ============================================
// RSS CAPTION GENERATOR
// ============================================

export interface RSSContext {
    articleTitle: string;
    feedName: string;
    summary: string;
    platform: 'X' | 'Threads' | 'Facebook' | 'LinkedIn';
    tone?: string;
    selectedVisuals?: string[];
    allowedEntities?: string[];
}

export async function generateRSSCaption(
    context: RSSContext,
    model: AIModel = DEFAULT_OPENAI_MODEL,
    customSystemPrompt?: string,
    customTemperature?: number
): Promise<string> {
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
    const visualContext = Array.isArray(context.selectedVisuals) && context.selectedVisuals.length > 0
        ? `Selected visuals:\n${context.selectedVisuals.map((entry) => `- ${entry}`).join('\n')}\n`
        : '';
    const allowedEntitiesContext = Array.isArray(context.allowedEntities) && context.allowedEntities.length > 0
        ? `Allowed named entities for the caption:\n${context.allowedEntities.map((entry) => `- ${entry}`).join('\n')}\n`
        : '';

    const prompt = `Generate a caption for this article:
Feed: ${context.feedName}
Title: ${context.articleTitle}
Summary: ${context.summary.slice(0, 500)}...
Platform: ${context.platform}
${visualContext}
${allowedEntitiesContext}

Rules:
- Do not mention a movie, series, character, or person that is not supported by the article title/summary or the allowed named entities list.
- If the selected visuals clearly represent one title, keep the caption anchored to that title instead of substituting a different one.

Write ONLY the caption.`;

    const response = await generateCompletion({
        model,
        prompt,
        systemPrompt,
        maxTokens: 150,
        temperature: customTemperature !== undefined ? customTemperature : 0.6,
        jsonMode: false
    });

    if (!response.success) {
        return `📰 ${context.articleTitle}`;
    }
    return normalizeGeneratedText(response.content, ['caption', 'text', 'content']);
}


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
    });

    if (!response.success) {
        throw new Error(response.error || 'Failed to generate compose post fields.');
    }

    const parsed = JSON.parse(response.content) as Record<string, unknown>;
    const sharedCaption = typeof parsed.sharedCaption === 'string' ? parsed.sharedCaption.trim() : '';
    const youtubeTitle = includeYouTube && typeof parsed.youtubeTitle === 'string' ? parsed.youtubeTitle.trim() : '';
    const youtubeDescription = includeYouTube && typeof parsed.youtubeDescription === 'string' ? parsed.youtubeDescription.trim() : '';
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
    const requestText = normalizeComposeMetadataText(input.requestText || input.metadataText || '');
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
        generateCompletion({ model, prompt: tPrompt, temperature: 0.7, enableWebSearch: true }),
        generateCompletion({ model, prompt: dPrompt, temperature: 0.7, enableWebSearch: true })
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
