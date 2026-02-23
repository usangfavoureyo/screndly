/**
 * TMDb Caption Generation Utility
 * Generates captions for TMDb feed posts using TMDb Settings
 * Integrated with Analytics-Driven Optimization Layer
 */

import { captionOptimizer } from '../lib/optimization';

export type FeedType = 'today' | 'weekly' | 'monthly' | 'anniversary';

interface TMDbItem {
  title: string;
  mediaType: 'movie' | 'tv';
  releaseDate: string;
  cast?: string[];
  year?: number;
  anniversaryYears?: number;
}

interface CaptionGenerationOptions {
  model: string;
  prompt: string;
  maxLength: number;
  includeCast: boolean;
  includeDate: boolean;
  feedType: FeedType;
}

/**
 * Generate caption using optimization layer
 * Uses analytics-derived signals to enhance caption quality
 */
async function mockGenerateCaption(
  item: TMDbItem,
  options: CaptionGenerationOptions
): Promise<string> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 150));

  // Use captionOptimizer to enhance prompt and select model
  const enhancedPrompt = captionOptimizer.enhancePrompt(options.prompt, 'tmdb');
  const optimalModel = captionOptimizer.selectModel('tmdb');

  console.log(`[TMDbCaptionGenerator] Using model: ${optimalModel}, feed: ${options.feedType}`);

  const { title, mediaType, releaseDate, cast, year, anniversaryYears } = item;
  const castNames = cast?.slice(0, 2).join(' and ') || '';

  // Generate caption based on feed type
  let caption = '';

  switch (options.feedType) {
    case 'today':
      if (options.includeCast && castNames) {
        caption = `${castNames} ${castNames.includes('and') ? 'star' : 'stars'} in #${title.replace(/[:\s]/g, '')} releasing today.`;
      } else {
        caption = `#${title.replace(/[:\s]/g, '')} ${mediaType === 'tv' ? 'premieres' : 'releases'} today.`;
      }
      break;

    case 'weekly':
      if (options.includeCast && castNames) {
        caption = `${castNames} return in #${title.replace(/[:\s]/g, '')} next week.`;
      } else {
        caption = `#${title.replace(/[:\s]/g, '')} ${mediaType === 'tv' ? 'premieres' : 'releases'} next week.`;
      }
      break;

    case 'monthly':
      if (options.includeCast && castNames) {
        caption = `${castNames} star in #${title.replace(/[:\s]/g, '')} next month.`;
      } else {
        caption = `#${title.replace(/[:\s]/g, '')} coming next month${options.includeDate && releaseDate ? ` on ${new Date(releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}.`;
      }
      break;

    case 'anniversary':
      if (anniversaryYears) {
        if (options.includeCast && castNames) {
          caption = `${castNames} created an unforgettable moment in #${title.replace(/[:\s]/g, '')} ${anniversaryYears} years ago today.`;
        } else {
          caption = `#${title.replace(/[:\s]/g, '')} ${mediaType === 'tv' ? 'premiered' : 'released'} ${anniversaryYears} years ago today.`;
        }
      } else {
        caption = `#${title.replace(/[:\s]/g, '')} anniversary today.`;
      }
      break;

    default:
      caption = `#${title.replace(/[:\s]/g, '')}`;
  }

  // Add release date if requested and not already included
  if (options.includeDate && releaseDate && !caption.includes(releaseDate) && options.feedType !== 'monthly') {
    const date = new Date(releaseDate);
    const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric' });

    // Don't add year for today releases (redundant)
    if (options.feedType !== 'today') {
      caption = caption.replace('.', ` (${formattedDate}).`);
    }
  }

  // Truncate to max length if needed
  if (caption.length > options.maxLength) {
    caption = caption.substring(0, options.maxLength - 3) + '...';
  }

  // Record caption metadata for analytics
  const itemId = `tmdb_${title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`;
  captionOptimizer.recordCaptionMetadata(itemId, 'tmdb', optimalModel, {
    feedType: options.feedType,
    mediaType,
    hasCast: !!cast?.length,
    titleLength: title.length,
  }, undefined, undefined);

  return caption;
}

/**
 * Get TMDb caption generation settings from localStorage
 */
export function getTMDbCaptionSettings(feedType: FeedType): CaptionGenerationOptions {
  let settings: any = {};

  try {
    const saved = localStorage.getItem('screndly_tmdb_settings');
    if (saved) {
      settings = JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load TMDb settings:', error);
  }

  // Default prompts by feed type
  const defaultPrompts: Record<FeedType, string> = {
    today: `You are a concise caption generator for short social posts. Output must be under 100 characters and use at most 50 tokens. Insert the title as a hashtag somewhere in the sentence. Occasionally include top 1–2 cast names and/or the release date. Tone: punchy, newsy, minimal. No extra hashtags. No CTAs. No quotes. No markdown. End with a period.

User prompt template:
Title: {title}
Type: {movie|tv}
ReleaseDate: {YYYY-MM-DD}
CastTop2: {Actor One, Actor Two}
Context: today_release
Constraints: Max 100 characters. Use title as hashtag #Title inside the sentence. Keep short.

Examples:
1) #InsideOut2 releases today.
2) #TheLastOfUs S2 premieres today.
3) Keanu Reeves stars in #JohnWick4 releasing today.

Instruction: Produce a single-line caption following the constraints.`,
    weekly: `You are a concise caption generator for short social posts. Output must be under 100 characters and use at most 50 tokens. Insert the title as a hashtag somewhere in the sentence. Occasionally include top 1–2 cast names and/or the release date. Tone: punchy, newsy, minimal. No extra hashtags. No CTAs. No quotes. No markdown. End with a period.

User prompt template:
Title: {title}
Type: {movie|tv}
ReleaseDate: {YYYY-MM-DD}
CastTop2: {Actor One, Actor Two}
Context: week_release
Constraints: Max 100 characters. Use title as hashtag #Title inside the sentence. Keep short.

Examples:
1) #InsideOut2 releases next week.
2) #TheLastOfUs S2 premieres this week on HBO.
3) Keanu Reeves and Laurence Fishburne return in #TheMatrix next week.

Instruction: Produce a single-line caption following the constraints.`,
    monthly: `You are a concise caption generator for short social posts. Output must be under 100 characters and use at most 50 tokens. Insert the title as a hashtag somewhere in the sentence. Occasionally include top 1–2 cast names and/or the release date. Tone: punchy, newsy, minimal. No extra hashtags. No CTAs. No quotes. No markdown. End with a period.

User prompt template:
Title: {title}
Type: {movie|tv}
ReleaseDate: {YYYY-MM-DD}
CastTop2: {Actor One, Actor Two}
Context: month_notice
Constraints: Max 100 characters. Use title as hashtag #Title inside the sentence. Keep short.

Examples:
1) #InsideOut2 releases next month.
2) #TheLastOfUs S2 coming next month to HBO.
3) Keanu Reeves stars in #JohnWick5 next month.

Instruction: Produce a single-line caption following the constraints.`,
    anniversary: `You are a concise caption generator for short social posts. Output must be under 100 characters and use at most 50 tokens. Insert the title as a hashtag somewhere in the sentence. Occasionally include top 1–2 cast names and/or the release date. Tone: punchy, newsy, minimal. No extra hashtags. No CTAs. No quotes. No markdown. End with a period.

User prompt template:
Title: {title}
Type: {movie|tv}
ReleaseDate: {YYYY-MM-DD}
CastTop2: {Actor One, Actor Two}
Context: anniversary_N_years
Constraints: Max 100 characters. Use title as hashtag #Title inside the sentence. Keep short.

Examples:
1) #InsideOut released 10 years ago today.
2) #TheLastOfUs S1 premiered two years ago today.
3) Keanu Reeves and Laurence Fishburne created an unforgettable moment in the #Matrix 25 years ago today.

Instruction: Produce a single-line caption following the constraints.`
  };

  return {
    model: settings.tmdbCaptionModel || 'gpt-4o',
    prompt: settings[`${feedType}Prompt`] || defaultPrompts[feedType],
    maxLength: parseInt(settings.captionMaxLength) || 100,
    includeCast: settings.includeCast !== false, // Default true
    includeDate: settings.includeDate !== false, // Default true
    feedType,
  };
}

/**
 * Generate caption for TMDb item using settings
 */
export async function generateTMDbCaption(
  item: TMDbItem,
  feedType: FeedType
): Promise<{ caption: string; charCount: number; settings: CaptionGenerationOptions }> {
  const options = getTMDbCaptionSettings(feedType);

  try {
    const caption = await mockGenerateCaption(item, options);

    return {
      caption,
      charCount: caption.length,
      settings: options,
    };
  } catch (error) {
    console.error('Failed to generate TMDb caption:', error);

    // Fallback to basic caption
    const fallbackCaption = `#${item.title.replace(/[:\s]/g, '')}`;
    return {
      caption: fallbackCaption,
      charCount: fallbackCaption.length,
      settings: options,
    };
  }
}

/**
 * Format caption settings for display in logs
 */
export function formatTMDbCaptionSettingsForLog(options: CaptionGenerationOptions): string {
  const features: string[] = [];

  if (options.includeCast) features.push('cast');
  if (options.includeDate) features.push('date');

  return `${options.model} (${options.feedType}, max: ${options.maxLength}${features.length > 0 ? `, ${features.join('+')}` : ''})`;
}

/**
 * Determine feed type from source string
 */
export function getFeedTypeFromSource(source: string): FeedType {
  if (source.includes('today')) return 'today';
  if (source.includes('weekly')) return 'weekly';
  if (source.includes('monthly')) return 'monthly';
  if (source.includes('anniversary')) return 'anniversary';
  return 'today'; // Default fallback
}
