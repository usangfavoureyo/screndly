/**
 * Design Studio Caption Generation Utility
 * Generates captions for design content using Design Studio Settings
 */

import type { Settings } from '../contexts/SettingsContext';
import { apiClient } from '../lib/api/client';
import { DEFAULT_MODELS, normalizeAIModelId } from '../lib/ai/models';
import { getCachedAIResponse } from '../lib/ai/cache';
import { designStudioPromptDefaults } from '../config/cultureCravePromptDefaults';

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
 * Get Design Studio caption generation settings from the shared settings snapshot
 * when available, with localStorage as a fallback for legacy page-local state.
 */
export function getDesignStudioCaptionSettings(
  contentType: DesignContentType,
  persistedSettings?: Partial<Settings>,
): CaptionGenerationOptions {
  let settings: Partial<Settings> = persistedSettings ?? {};

  if (!persistedSettings) {
    try {
      const saved = localStorage.getItem('screndly_design_studio_settings');
      if (saved) {
        settings = JSON.parse(saved) as Partial<Settings>;
      }
    } catch (error) {
      console.error('Failed to load Design Studio settings:', error);
    }
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
    model: normalizeAIModelId(settings.captionOpenaiModel, DEFAULT_MODELS.designStudio),
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
    poster: designStudioPromptDefaults.captionPosterPrompt,
    carousel: designStudioPromptDefaults.captionCarouselPrompt,
    story: designStudioPromptDefaults.captionStoryPrompt,
    announcement: designStudioPromptDefaults.captionAnnouncementPrompt,
    general: designStudioPromptDefaults.captionGeneralPrompt,
  };

  return defaultPrompts[contentType];
}

/**
 * Generate caption for design content using backend AI route
 */
export async function generateDesignStudioCaption(
  content: DesignContent,
  persistedSettings?: Partial<Settings>,
): Promise<{ caption: string; charCount: number; settings: CaptionGenerationOptions }> {
  const options = getDesignStudioCaptionSettings(content.contentType, persistedSettings);
  const descriptionParts = [
    content.tagline,
    content.releaseInfo,
    content.castInfo,
    content.context,
  ].filter(Boolean);

  const requestPayload = {
    fileName: content.title || `${content.contentType} design`,
    fileDescription: descriptionParts.join(' | ') || 'No extra context provided',
    tone: options.tone,
    model: options.model,
    customSystemPrompt: options.prompt,
    customTemperature: options.temperature,
    customMaxTokens: options.maxTokens,
  };
  const { data: response } = await getCachedAIResponse(
    'caption:design-studio',
    requestPayload,
    () => apiClient.post<{ content: string }>('/api/ai/generate/studio-caption', requestPayload),
    {
      ttlMs: 24 * 60 * 60 * 1000,
    },
  );

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
