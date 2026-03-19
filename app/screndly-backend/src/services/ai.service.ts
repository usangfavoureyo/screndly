/**
 * AI Service - Unified Model Routing
 * Routes requests to appropriate AI model (OpenAI, Flash 3/Jordanite)
 */

import prisma from '../lib/prisma';
import { readSecretSettingValue } from '../lib/settings';
import { trackApiUsage } from './api-usage.service';

// ============================================
// TYPES
// ============================================

export const SUPPORTED_OPENAI_MODELS = [
    'gpt-5.4',
    'gpt-5.4-mini',
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

function resolveReasoningEffort(request: AIRequest): AIReasoningEffort | undefined {
    if (request.reasoningEffort) {
        if (request.model.startsWith('gpt-5') && request.reasoningEffort === 'minimal') {
            return 'low';
        }

        return request.reasoningEffort;
    }

    if (!request.jsonMode) {
        return undefined;
    }

    return request.model.startsWith('gpt-5') ? 'low' : 'minimal';
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
    platform: 'X' | 'Threads' | 'Facebook' | 'Instagram';
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
Platform: ${context.platform}

If the caption benefits from release context, verify whether it is theatrical or tied to a specific network/streaming platform before mentioning it. If that context is unnecessary or uncertain, leave it out.

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
`;

    const systemPrompt = customSystemPrompt || defaultSystemPrompt;

    const prompt = `Generate a caption for this article:
Feed: ${context.feedName}
Title: ${context.articleTitle}
Summary: ${context.summary.slice(0, 500)}...
Platform: ${context.platform}

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
    platform: 'X' | 'Threads' | 'Facebook';
    trailerType?: string;
    mediaType?: 'movie' | 'tv';
    releaseDate?: string;
    year?: number;
    cast?: string[];
    genres?: string[];
    productionNames?: string[];
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

    const systemPrompt = withReleaseResearchInstructions(customSystemPrompt || defaultSystemPrompt);

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

Use live search when needed to confirm the release date and whether the title is going to theaters or to a specific network/streaming platform. Mention that destination only if it is confidently verified and helpful to the caption.

Write ONLY the caption.`;

    const response = await generateCompletion({
        model,
        prompt,
        systemPrompt,
        maxTokens: 150,
        temperature: customTemperature !== undefined ? customTemperature : 0.8,
        jsonMode: false,
        enableWebSearch: true,
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
    description?: string; // Metadata about the item being thanked/replied to
    platform: 'X' | 'Threads' | 'Facebook' | 'Instagram';
    tone?: string;
}

export async function generateCommentReply(
    context: CommentContext,
    model: AIModel = DEFAULT_OPENAI_MODEL,
    customSystemPrompt?: string,
    customTemperature?: number
): Promise<string> {
    const defaultSystemPrompt = `You are a social media manager.
Goal: Write a friendly, engaging reply to a user comment.
- Tone: Helpful, positive, slightly informal.
- Length: Under 140 chars.
- NO hashtags.
- If the comment is negative, be polite and professional.
`;

    const systemPrompt = customSystemPrompt || defaultSystemPrompt;

    const prompt = `Generate a reply to this comment:
Platform: ${context.platform}
Comment: "${context.originalComment}"
Context: ${context.description || 'General post'}

Write ONLY the reply text.`;

    const response = await generateCompletion({
        model,
        prompt,
        systemPrompt,
        maxTokens: 100,
        temperature: customTemperature !== undefined ? customTemperature : 0.7,
        jsonMode: false
    });

    if (!response.success) {
        return `Thanks for your comment! 🙌`;
    }
    return response.content.trim().replace(/^"|"$/g, '');
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
    generatePinterestMetadata,
    getOpenAIKey,
    getFlash3Key
};
