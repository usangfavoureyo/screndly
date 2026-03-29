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

function getTemporalTag(feedType: FeedType) {
  switch (feedType) {
    case 'today':
      return 'releasing_today' as const;
    case 'weekly':
      return 'releasing_this_week' as const;
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

function buildSystemPrompt(options: CaptionGenerationOptions): string {
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
    '- Never include URLs, website names, citations, source attributions, or markdown links.',
    '- Return plain caption text only.',
  ].join('\n');
}

function stripCaptionLinks(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, '$1')
    .replace(/\((https?:\/\/[^)]+|www\.[^)]+)\)/gi, '')
    .replace(/\bhttps?:\/\/\S+/gi, '')
    .replace(/\bwww\.\S+/gi, '')
    .replace(/\(([a-z0-9-]+\.)+[a-z]{2,}[^)]*\)/gi, '');
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

function sanitizeTMDbCaption(caption: string, item: TMDbItem, options: CaptionGenerationOptions): string {
  let sanitized = stripCaptionLinks(caption)
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .trim();

  if (options.feedType === 'monthly') {
    const monthlyReplacement = getMonthlyTimingReplacement(item.releaseDate);
    if (monthlyReplacement) {
      sanitized = sanitized.replace(/\bthis month\b/gi, monthlyReplacement);
    }
  }

  sanitized = sanitized
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (sanitized.length > options.maxLength) {
    sanitized = sanitized.slice(0, options.maxLength).trimEnd();
  }

  return sanitized;
}

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
  feedType: FeedType
): Promise<{ caption: string; charCount: number; settings: CaptionGenerationOptions }> {
  const options = getTMDbCaptionSettings(feedType);

  try {
    const captionPlatform = resolveCaptionPlatform(item.platforms);
    const requestPayload = {
      title: item.title,
      mediaType: item.mediaType,
      temporalTag: getTemporalTag(feedType),
      daysUntil: getDaysUntilRelease(item.releaseDate, feedType),
      releaseDate: options.includeDate ? item.releaseDate : undefined,
      anniversaryYears:
        item.anniversaryYears ??
        (feedType === 'anniversary' && item.year ? new Date().getFullYear() - item.year : undefined),
      cast: options.includeCast ? item.cast || [] : [],
      genres: [],
      platform: captionPlatform,
      model: options.model,
      customSystemPrompt: buildSystemPrompt(options),
    };
    const { data: response } = await getCachedAIResponse(
      'caption:tmdb',
      requestPayload,
      () => apiClient.post<{ content: string }>('/api/ai/generate/tmdb-caption', requestPayload),
      {
        ttlMs: getTMDbCaptionCacheTtlMs(),
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
