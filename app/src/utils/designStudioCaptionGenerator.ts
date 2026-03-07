/**
 * Design Studio Caption Generation Utility
 * Generates captions for design content using Design Studio Settings
 */

import { apiClient } from '../lib/api/client';

export type DesignContentType = 'poster' | 'carousel' | 'story' | 'announcement' | 'general';

interface CaptionGenerationOptions {
  model: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
  maxLength: number;
  tone: string;
  includeEmojis: boolean;
  includeHashtags: boolean;
}

interface DesignContent {
  contentType: DesignContentType;
  title?: string;
  tagline?: string;
  releaseInfo?: string;
  castInfo?: string;
  context?: string;
}

/**
 * Get Design Studio caption generation settings from localStorage
 */
export function getDesignStudioCaptionSettings(contentType: DesignContentType): CaptionGenerationOptions {
  let settings: any = {};

  try {
    const saved = localStorage.getItem('screndly_design_studio_settings');
    if (saved) {
      settings = JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load Design Studio settings:', error);
  }

  const promptKeys: Record<DesignContentType, string> = {
    poster: 'captionPosterPrompt',
    carousel: 'captionCarouselPrompt',
    story: 'captionStoryPrompt',
    announcement: 'captionAnnouncementPrompt',
    general: 'captionGeneralPrompt',
  };

  const promptKey = promptKeys[contentType];

  return {
    model: settings.captionOpenaiModel || 'gpt-4o',
    prompt: settings[promptKey] || getDefaultPrompt(contentType),
    temperature: settings.captionTemperature || 0.7,
    maxTokens: settings.captionMaxTokens || 500,
    maxLength: settings.captionMaxLength || 280,
    tone: settings.captionTone || 'engaging',
    includeEmojis: settings.captionIncludeEmojis !== false,
    includeHashtags: settings.captionIncludeHashtags !== false,
  };
}

/**
 * Get default prompt for content type
 */
function getDefaultPrompt(contentType: DesignContentType): string {
  const defaultPrompts: Record<DesignContentType, string> = {
    poster: `You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for movie/TV poster announcements and promotional graphics.

INPUT: Movie/TV title, tagline, release info, and any additional context
OUTPUT: Poster-focused caption (120-280 characters)

Guidelines:
- Create excitement around the visual/poster reveal
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Include relevant movie/show details (release date, cast, etc.)
- Use line breaks for readability when necessary
- Focus on visual appeal and announcement energy`,

    carousel: `You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for multi-image carousel posts featuring cast photos, stills, or behind-the-scenes content.

INPUT: Movie/TV title, carousel theme, and context about the images
OUTPUT: Carousel-focused caption (120-280 characters)

Guidelines:
- Encourage users to swipe through the carousel
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Use phrases like "Swipe to see", "Slide through", or variations
- Highlight what makes the carousel valuable`,

    story: `You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for Instagram/Facebook Story-style vertical graphics (9:16).

INPUT: Movie/TV title, story theme, and quick announcement details
OUTPUT: Story-focused caption (80-200 characters)

Guidelines:
- Keep it VERY short and punchy: 80-200 characters
- NO emojis unless specifically requested
- Perfect for quick announcements, quotes, or teases
- Use conversational, immediate language`,

    announcement: `You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for major announcements (cast reveals, release dates, awards, box office milestones).

INPUT: Announcement type and details (cast, date, award, milestone, etc.)
OUTPUT: Announcement-focused caption (120-280 characters)

Guidelines:
- Lead with the most important information
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Use clear, direct language for maximum impact
- Include specific details (dates, names, numbers)`,

    general: `You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions for general movie/TV content that doesn't fit other specific categories.

INPUT: Content description and context
OUTPUT: General caption (120-280 characters)

Guidelines:
- Adapt tone to match the content
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Focus on what makes the content interesting
- Clear, engaging language`,
  };

  return defaultPrompts[contentType];
}

/**
 * Generate caption for design content using backend AI route
 */
export async function generateDesignStudioCaption(
  content: DesignContent
): Promise<{ caption: string; charCount: number; settings: CaptionGenerationOptions }> {
  const options = getDesignStudioCaptionSettings(content.contentType);
  const descriptionParts = [
    content.tagline,
    content.releaseInfo,
    content.castInfo,
    content.context,
  ].filter(Boolean);

  const response = await apiClient.post<{ content: string }>('/api/ai/generate/studio-caption', {
    fileName: content.title || `${content.contentType} design`,
    fileDescription: descriptionParts.join(' | ') || 'No extra context provided',
    tone: options.tone,
    model: options.model,
    customSystemPrompt: options.prompt,
    customTemperature: options.temperature,
    customMaxTokens: options.maxTokens,
  });

  if (!response.success || !response.data?.content) {
    console.error('Failed to generate Design Studio caption:', response.error);
    throw new Error(response.error?.message || 'Failed to generate caption');
  }

  let caption = response.data.content.trim();
  if (caption.length > options.maxLength) {
    caption = `${caption.substring(0, options.maxLength - 3)}...`;
  }

  return {
    caption,
    charCount: caption.length,
    settings: options,
  };
}

/**
 * Format caption settings for display in logs
 */
export function formatDesignStudioCaptionSettingsForLog(options: CaptionGenerationOptions): string {
  const features: string[] = [];

  if (options.includeEmojis) features.push('emojis');
  if (options.includeHashtags) features.push('hashtags');

  return `${options.model} (${options.tone}, max: ${options.maxLength}${features.length > 0 ? `, ${features.join('+')}` : ''})`;
}
