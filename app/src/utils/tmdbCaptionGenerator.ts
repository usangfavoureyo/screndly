/**
 * TMDb caption generation utility backed by the real AI route.
 */

import { apiClient } from '../lib/api/client';
import { captionOptimizer } from '../lib/optimization';
import { DEFAULT_MODELS, normalizeAIModelId } from '../lib/ai/models';
import { getCachedAIResponse } from '../lib/ai/cache';
import { getDaysUntilCalendarDate, parseCalendarDate } from './calendarDate';
import { tmdbPromptDefaults } from '../config/cultureCravePromptDefaults';

export type FeedType = 'today' | 'weekly' | 'monthly' | 'anniversary';

interface TMDbItem {
  title: string;
  mediaType: 'movie' | 'tv';
  releaseDate: string;
  cast?: string[];
  year?: number;
  anniversaryYears?: number;
  platforms?: string[];
}

interface CaptionGenerationOptions {
  model: string;
  prompt: string;
  maxLength: number;
  includeCast: boolean;
  includeDate: boolean;
  feedType: FeedType;
}

interface TMDbCaptionRequestOptions {
  forceFresh?: boolean;
}

const DEFAULT_PROMPTS: Record<FeedType, string> = {
  today: tmdbPromptDefaults.todayPrompt,
  weekly: tmdbPromptDefaults.weeklyPrompt,
  monthly: tmdbPromptDefaults.monthlyPrompt,
  anniversary: tmdbPromptDefaults.anniversaryPrompt,
};

function resolveCaptionPlatform(platforms?: string[]): 'X' | 'Threads' | 'Facebook' | 'Instagram' | undefined {
  const supportedPlatforms = ['X', 'Threads', 'Facebook', 'Instagram'] as const;
  const match = supportedPlatforms.find((platform) => platforms?.includes(platform));
  return match;
}

function getStartOfWeek(date: Date, weekStartsOn = 1): Date {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = normalized.getDay();
  const delta = (day - weekStartsOn + 7) % 7;
  normalized.setDate(normalized.getDate() - delta);
  return normalized;
}

function getWeeklyTimingReplacement(releaseDate: string, referenceDate = new Date()): string | null {
  const target = parseCalendarDate(releaseDate);
  if (!target) {
    return null;
  }

  const referenceWeekStart = getStartOfWeek(referenceDate);
  const targetWeekStart = getStartOfWeek(target);
  const weekDelta = Math.round(
    (targetWeekStart.getTime() - referenceWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  if (weekDelta === 0) {
    return 'this week';
  }

  if (weekDelta === 1) {
    return 'next week';
  }

  if (weekDelta > 1) {
    return `in ${weekDelta} weeks`;
  }

  return null;
}

function getTemporalTag(feedType: FeedType, releaseDate?: string) {
  switch (feedType) {
    case 'today':
      return 'releasing_today' as const;
    case 'weekly':
      return getWeeklyTimingReplacement(releaseDate || '') === 'next week'
        ? 'releasing_next_week' as const
        : 'releasing_this_week' as const;
    case 'monthly':
      return 'releasing_next_month' as const;
    case 'anniversary':
      return 'anniversary' as const;
    default:
      return 'already_released' as const;
  }
}

function getDaysUntilRelease(releaseDate: string, feedType: FeedType): number {
  if (feedType === 'anniversary') {
    return 0;
  }

  return getDaysUntilCalendarDate(releaseDate);
}

function formatReleaseDateWithWeekday(releaseDate: string): string | null {
  const target = parseCalendarDate(releaseDate);
  if (!target) {
    return null;
  }

  return target.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function buildTemporalGuidance(item: TMDbItem, options: CaptionGenerationOptions): string[] {
  if (!item.releaseDate || options.feedType === 'today' || options.feedType === 'anniversary') {
    return [];
  }

  const formattedDate = formatReleaseDateWithWeekday(item.releaseDate);
  if (!formattedDate) {
    return [];
  }

  if (options.feedType === 'weekly') {
    const weeklyTiming = getWeeklyTimingReplacement(item.releaseDate);
    if (!weeklyTiming) {
      return [];
    }

    return [
      `- The release date falls ${weeklyTiming} on ${formattedDate}.`,
      options.includeDate
        ? '- When helpful, prefer timing phrasing like "next Friday, April 10" or "Friday, April 10" instead of a vague week reference.'
        : '- Even without the full date, keep the week reference accurate to the actual calendar week.',
    ];
  }

  if (options.feedType === 'monthly') {
    const monthlyTiming = getMonthlyTimingReplacement(item.releaseDate);
    if (!monthlyTiming) {
      return [];
    }

    return [
      `- The release date falls ${monthlyTiming} on ${formattedDate}.`,
      options.includeDate
        ? '- When helpful, you may mention the weekday and date, such as "Friday, May 1", while keeping the month reference accurate.'
        : '- Keep the month reference accurate to the actual calendar month of the release.',
    ];
  }

  return [];
}

function buildSystemPrompt(item: TMDbItem, options: CaptionGenerationOptions): string {
  return [
    options.prompt,
    'Additional Constraints:',
    `- Keep the caption under ${options.maxLength} characters.`,
    options.includeCast
      ? '- Mention cast only when it improves the caption.'
      : '- Do not mention cast members.',
    options.includeDate
      ? '- You may mention the release date or year when helpful.'
      : '- Do not mention the exact release date or year unless absolutely necessary.',
    ...buildTemporalGuidance(item, options),
    '- Paragraphing is allowed when it improves readability.',
    '- Use at most 2 short paragraphs.',
    '- If the first sentence is the release/premiere hook and the next sentence begins with cast context like "Starring", put that cast sentence in a new paragraph.',
    '- Do not force paragraph breaks when the caption reads better as one compact paragraph.',
    '- Never include URLs, website names, citations, source attributions, or markdown links.',
    '- Return plain caption text only.',
  ].join('\n');
}

function splitCaptionSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isReleaseLeadSentence(sentence: string, feedType: FeedType): boolean {
  const normalized = sentence.toLowerCase();

  if (feedType === 'today' && /\b(today|premieres today|releases today|arrives today|drops today|debuts today)\b/.test(normalized)) {
    return true;
  }

  if (feedType === 'weekly' && /\b(this week|next week|premieres this week|premieres next week|releases this week|releases next week)\b/.test(normalized)) {
    return true;
  }

  if (feedType === 'monthly' && /\b(this month|next month|in [a-z]+(?: \d{4})?)\b/.test(normalized)) {
    return true;
  }

  return /\b(premieres|releases|debuts|arrives|lands|hits theaters|in theaters)\b/.test(normalized);
}

function startsCastLead(sentence: string): boolean {
  return /^(starring|stars|featuring|with)\b/i.test(sentence.trim());
}

function applyEditorialParagraphing(value: string, options: CaptionGenerationOptions): string {
  if (value.includes('\n')) {
    return value;
  }

  const sentences = splitCaptionSentences(value);
  if (sentences.length < 2) {
    return value;
  }

  const [firstSentence, secondSentence, ...rest] = sentences;
  if (!isReleaseLeadSentence(firstSentence, options.feedType) || !startsCastLead(secondSentence)) {
    return value;
  }

  const secondParagraph = [secondSentence, ...rest].join(' ').trim();
  if (!secondParagraph) {
    return value;
  }

  return `${firstSentence.trim()}\n\n${secondParagraph}`;
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

function quoteTMDbCaptionTitle(title: string): string {
  return `'${String(title || '').trim()}'`;
}

function buildPromptAlignedFallbackCaption(item: TMDbItem, options: CaptionGenerationOptions): string {
  const title = quoteTMDbCaptionTitle(item.title);
  const cast = Array.isArray(item.cast)
    ? item.cast.map((name) => String(name || '').trim()).filter(Boolean).slice(0, 3)
    : [];
  const castLine = options.includeCast && cast.length > 0 ? `\n\nStarring ${cast.join(', ')}.` : '';

  if (options.feedType === 'today') {
    const releasePhrase = item.mediaType === 'tv' ? 'premieres today' : 'releases today';
    return `${title} ${releasePhrase}.${castLine}`;
  }

  if (options.feedType === 'weekly') {
    return `${title} releases this week.${castLine}`;
  }

  if (options.feedType === 'monthly') {
    return `${title} releases next month.${castLine}`;
  }

  if (options.feedType === 'anniversary' && item.anniversaryYears) {
    return `${title} marks its ${item.anniversaryYears}th anniversary today.${castLine}`;
  }

  return `${title} arrives soon.${castLine}`;
}

function isGenericOutNowCaption(value: string, item: TMDbItem): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  const escapedTitle = String(item.title || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\W*OUT\\s+NOW:\\s*${escapedTitle}\\W*$`, 'i').test(normalized);
}

function getMonthlyTimingReplacement(releaseDate: string, referenceDate = new Date()): string | null {
  const target = parseCalendarDate(releaseDate);
  if (!target) {
    return null;
  }

  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth();
  const targetYear = target.getFullYear();
  const targetMonth = target.getMonth();
  const monthDelta = (targetYear - referenceYear) * 12 + (targetMonth - referenceMonth);

  if (monthDelta === 1) {
    return 'next month';
  }

  if (monthDelta > 1 && targetYear === referenceYear) {
    return `in ${target.toLocaleString('en-US', { month: 'long' })}`;
  }

  if (monthDelta > 1) {
    return `in ${target.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;
  }

  return null;
}

function removeAnniversaryDateDuplication(value: string): string {
  if (!/\bago today\b/i.test(value)) {
    return value;
  }

  return value
    .replace(/([,;]\s*)(premiered|released)\s+[A-Z][a-z]{2,9}\s+\d{1,2},\s+\d{4}\b/gi, '')
    .replace(/\b(premiered|released)\s+[A-Z][a-z]{2,9}\s+\d{1,2},\s+\d{4}\b/gi, '')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/[^\S\n]+([,.!?;:])/g, '$1')
    .trim();
}

function sanitizeTMDbCaption(caption: string, item: TMDbItem, options: CaptionGenerationOptions): string {
  let sanitized = stripCaptionLinks(caption)
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/[^\S\n]+([,.!?])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .trim();

  if (isGenericOutNowCaption(sanitized, item)) {
    sanitized = buildPromptAlignedFallbackCaption(item, options);
  }

  if (options.feedType === 'weekly') {
    const weeklyReplacement = getWeeklyTimingReplacement(item.releaseDate);
    if (weeklyReplacement && weeklyReplacement !== 'this week') {
      sanitized = sanitized.replace(/\bthis week\b/gi, weeklyReplacement);
    }
  }

  if (options.feedType === 'monthly') {
    const monthlyReplacement = getMonthlyTimingReplacement(item.releaseDate);
    if (monthlyReplacement) {
      sanitized = sanitized.replace(/\bthis month\b/gi, monthlyReplacement);
    }
  }

  if (options.feedType === 'anniversary') {
    sanitized = removeAnniversaryDateDuplication(sanitized);
  }

  sanitized = sanitized
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+([)\]])/g, '$1')
    .replace(/([([])[^\S\n]+/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[([]\s*$/g, '')
    .trim();

  sanitized = applyEditorialParagraphing(sanitized, options);

  if (sanitized.length > options.maxLength) {
    sanitized = sanitized.slice(0, options.maxLength).trimEnd();
  }

  return sanitized;
}

export const __tmdbCaptionSanitizer = {
  stripCaptionLinks,
  sanitizeTMDbCaption,
  buildTemporalGuidance,
  buildPromptAlignedFallbackCaption,
};

function getTMDbCaptionCacheTtlMs(): number {
  try {
    const saved = localStorage.getItem('screndly_tmdb_settings');
    if (!saved) {
      return 24 * 60 * 60 * 1000;
    }

    const parsed = JSON.parse(saved);
    const days = Number(parsed.captionCacheTTL);
    if (!Number.isFinite(days) || days <= 0) {
      return 24 * 60 * 60 * 1000;
    }

    return days * 24 * 60 * 60 * 1000;
  } catch {
    return 24 * 60 * 60 * 1000;
  }
}

export function getTMDbCaptionSettings(feedType: FeedType): CaptionGenerationOptions {
  let settings: Record<string, any> = {};

  try {
    const saved = localStorage.getItem('screndly_tmdb_settings');
    if (saved) {
      settings = JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load TMDb settings:', error);
  }

  return {
    model: normalizeAIModelId(settings.tmdbCaptionModel, DEFAULT_MODELS.tmdb),
    prompt: settings[`${feedType}Prompt`] || DEFAULT_PROMPTS[feedType],
    maxLength: parseInt(settings.captionMaxLength, 10) || 100,
    includeCast: settings.includeCast !== false,
    includeDate: settings.includeDate !== false,
    feedType,
  };
}

export async function generateTMDbCaption(
  item: TMDbItem,
  feedType: FeedType,
  requestOptions: TMDbCaptionRequestOptions = {},
): Promise<{ caption: string; charCount: number; settings: CaptionGenerationOptions }> {
  const options = getTMDbCaptionSettings(feedType);

  try {
    const captionPlatform = resolveCaptionPlatform(item.platforms);
    const requestPayload = {
      title: item.title,
      mediaType: item.mediaType,
      temporalTag: getTemporalTag(feedType, item.releaseDate),
      daysUntil: getDaysUntilRelease(item.releaseDate, feedType),
      releaseDate: options.includeDate ? item.releaseDate : undefined,
      anniversaryYears:
        item.anniversaryYears ??
        (feedType === 'anniversary' && item.year ? new Date().getFullYear() - item.year : undefined),
      cast: options.includeCast ? item.cast || [] : [],
      genres: [],
      platform: captionPlatform,
      model: options.model,
      customSystemPrompt: buildSystemPrompt(item, options),
    };
    const { data: response } = await getCachedAIResponse(
      'caption:tmdb',
      requestPayload,
      () => apiClient.post<{ content: string }>('/api/ai/generate/tmdb-caption', requestPayload),
      {
        ttlMs: getTMDbCaptionCacheTtlMs(),
        forceFresh: requestOptions.forceFresh,
      },
    );

    if (!response.success || !response.data?.content) {
      throw new Error(response.error?.message || 'Failed to generate TMDb caption');
    }

    const caption = sanitizeTMDbCaption(response.data.content.trim(), item, options);
    const itemId = `tmdb_${item.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`;
    captionOptimizer.recordCaptionMetadata(
      itemId,
      'x',
      `tmdb_${options.feedType}`,
      caption,
      options.model,
      undefined,
    );

    return {
      caption,
      charCount: caption.length,
      settings: options,
    };
  } catch (error) {
    console.error('Failed to generate TMDb caption:', error);
    const fallbackCaption = `#${item.title.replace(/[:\s]/g, '')}`;
    return {
      caption: fallbackCaption,
      charCount: fallbackCaption.length,
      settings: options,
    };
  }
}

export function formatTMDbCaptionSettingsForLog(options: CaptionGenerationOptions): string {
  const features: string[] = [];

  if (options.includeCast) features.push('cast');
  if (options.includeDate) features.push('date');

  return `${options.model} (${options.feedType}, max: ${options.maxLength}${features.length > 0 ? `, ${features.join('+')}` : ''})`;
}

export function getFeedTypeFromSource(source: string): FeedType {
  if (source.includes('today')) return 'today';
  if (source.includes('weekly')) return 'weekly';
  if (source.includes('monthly')) return 'monthly';
  if (source.includes('anniversary')) return 'anniversary';
  return 'today';
}
