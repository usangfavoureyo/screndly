/**
 * TMDb caption generation utility backed by the real AI route.
 */

import { apiClient } from '../lib/api/client';
import { captionOptimizer } from '../lib/optimization';
import { getDaysUntilCalendarDate } from './calendarDate';

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
  today: 'Write a punchy social caption for a title releasing today.',
  weekly: 'Write a punchy social caption for a title releasing this week.',
  monthly: 'Write a punchy social caption for a title releasing this month.',
  anniversary: 'Write a punchy nostalgic social caption for a title celebrating an anniversary.',
};

function resolveCaptionPlatform(platforms?: string[]): 'X' | 'Threads' | 'Facebook' | 'Instagram' {
  const supportedPlatforms = ['X', 'Threads', 'Facebook', 'Instagram'] as const;
  const match = supportedPlatforms.find((platform) => platforms?.includes(platform));
  return match || 'X';
}

function getTemporalTag(feedType: FeedType) {
  switch (feedType) {
    case 'today':
      return 'releasing_today' as const;
    case 'weekly':
      return 'releasing_this_week' as const;
    case 'monthly':
      return 'releasing_this_month' as const;
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
  ].join('\n');
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
    model: settings.tmdbCaptionModel || 'gpt-4o',
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
    const response = await apiClient.post<{ content: string }>('/api/ai/generate/tmdb-caption', {
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
      platform: resolveCaptionPlatform(item.platforms),
      model: options.model,
      customSystemPrompt: buildSystemPrompt(options),
    });

    if (!response.success || !response.data?.content) {
      throw new Error(response.error?.message || 'Failed to generate TMDb caption');
    }

    const caption = response.data.content.trim();
    const itemId = `tmdb_${item.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`;
    captionOptimizer.recordCaptionMetadata(itemId, 'tmdb', options.model, {
      feedType: options.feedType,
      mediaType: item.mediaType,
      hasCast: Boolean(item.cast?.length),
      titleLength: item.title.length,
    });

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
