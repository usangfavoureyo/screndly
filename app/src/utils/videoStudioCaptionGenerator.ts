/**
 * Video Studio caption generation utility backed by the real AI route.
 */

import { apiClient } from '../lib/api/client';
import { DEFAULT_MODELS, normalizeAIModelId } from '../lib/ai/models';
import { getCachedAIResponse } from '../lib/ai/cache';
import { videoStudioPromptDefaults } from '../config/cultureCravePromptDefaults';

export type VideoContentType = 'review' | 'releases' | 'scenes';

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

export interface VideoContent {
  contentType: VideoContentType;
  transcript?: string;
  movieTitle?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  description?: string;
  detectedObjects?: string[];
  platforms?: string[];
}

const DEFAULT_PROMPTS: Record<VideoContentType, string> = {
  review: videoStudioPromptDefaults.captionReviewPrompt,
  releases: videoStudioPromptDefaults.captionReleasesPrompt,
  scenes: videoStudioPromptDefaults.captionScenesPrompt,
};

const PLATFORM_LABELS: Record<string, string> = {
  x: 'X',
  threads: 'Threads',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
};

function parseNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildSystemPrompt(options: CaptionGenerationOptions): string {
  return [
    options.prompt,
    'Additional Constraints:',
    `- Preferred tone: ${options.tone}.`,
    `- Keep the caption under ${options.maxLength} characters.`,
    options.includeEmojis
      ? '- Emojis are allowed only when they genuinely improve the caption.'
      : '- Do not use emojis.',
    options.includeHashtags
      ? '- Add concise relevant hashtags only if they fit naturally at the end.'
      : '- Do not use hashtags.',
  ].join('\n');
}

function buildFileName(content: VideoContent): string {
  if (content.movieTitle?.trim()) {
    return content.movieTitle.trim();
  }

  switch (content.contentType) {
    case 'scenes':
      return 'Scene Clip';
    case 'releases':
      return 'Monthly Releases';
    case 'review':
    default:
      return 'Review Video';
  }
}

function buildFileDescription(content: VideoContent): string {
  const parts = [
    content.description,
    content.transcript ? `Transcript context: ${content.transcript}` : undefined,
    content.startTime && content.endTime
      ? `Clip window: ${content.startTime}s to ${content.endTime}s`
      : undefined,
    content.duration ? `Duration: ${content.duration}s` : undefined,
  ].filter(Boolean);

  return parts.join('. ');
}

function buildDetectedObjects(content: VideoContent): string[] {
  return [
    content.contentType,
    content.movieTitle,
    content.duration ? `${content.duration}s clip` : undefined,
    ...(content.detectedObjects || []),
  ].filter((value): value is string => Boolean(value && value.trim()));
}

function resolveCaptionPlatform(platforms?: string[]): string {
  if (!platforms?.length) {
    return 'X';
  }

  const match = platforms
    .map((platform) => PLATFORM_LABELS[platform.toLowerCase()] || platform)
    .find(Boolean);

  return match || 'X';
}

function getFallbackCaption(content: VideoContent): string {
  const title = buildFileName(content);

  switch (content.contentType) {
    case 'scenes':
      return `${title}\n\nA standout scene worth watching.`;
    case 'releases':
      return `${title}\n\nA new slate of titles worth keeping an eye on.`;
    case 'review':
    default:
      return `${title}\n\nA fresh take from Video Studio.`;
  }
}

export function getVideoStudioCaptionSettings(contentType: VideoContentType): CaptionGenerationOptions {
  let settings: Record<string, any> = {};

  try {
    const saved = localStorage.getItem('screndly_video_studio_settings');
    if (saved) {
      settings = JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load Video Studio settings:', error);
  }

  const promptKeys: Record<VideoContentType, string> = {
    review: 'captionReviewPrompt',
    releases: 'captionReleasesPrompt',
    scenes: 'captionScenesPrompt',
  };

  return {
    model: normalizeAIModelId(settings.captionOpenaiModel, DEFAULT_MODELS.videoStudio),
    prompt: settings[promptKeys[contentType]] || DEFAULT_PROMPTS[contentType],
    temperature: parseNumber(settings.captionTemperature, 0.7),
    maxTokens: parseNumber(settings.captionMaxTokens, 500),
    maxLength: parseNumber(settings.captionMaxLength, 280),
    tone: settings.captionTone || 'engaging',
    includeEmojis: settings.captionIncludeEmojis !== false,
    includeHashtags: settings.captionIncludeHashtags !== false,
  };
}

export async function generateVideoStudioCaption(
  content: VideoContent
): Promise<{ caption: string; charCount: number; settings: CaptionGenerationOptions }> {
  const options = getVideoStudioCaptionSettings(content.contentType);

  try {
    const requestPayload = {
      fileName: buildFileName(content),
      fileDescription: buildFileDescription(content),
      detectedObjects: buildDetectedObjects(content),
      platform: resolveCaptionPlatform(content.platforms),
      tone: options.tone,
      model: options.model,
      customSystemPrompt: buildSystemPrompt(options),
      customTemperature: options.temperature,
      customMaxTokens: options.maxTokens,
    };
    const { data: response } = await getCachedAIResponse(
      'caption:video-studio',
      requestPayload,
      () => apiClient.post<{ content: string }>('/api/ai/generate/studio-caption', requestPayload),
      {
        ttlMs: 24 * 60 * 60 * 1000,
      },
    );

    if (!response.success || !response.data?.content) {
      throw new Error(response.error?.message || 'Failed to generate Video Studio caption');
    }

    let caption = response.data.content.trim();
    if (caption.length > options.maxLength) {
      caption = `${caption.substring(0, options.maxLength - 3).trimEnd()}...`;
    }

    return {
      caption,
      charCount: caption.length,
      settings: options,
    };
  } catch (error) {
    console.error('Failed to generate Video Studio caption:', error);
    const fallbackCaption = getFallbackCaption(content);
    return {
      caption: fallbackCaption,
      charCount: fallbackCaption.length,
      settings: options,
    };
  }
}

export function formatVideoStudioCaptionSettingsForLog(options: CaptionGenerationOptions): string {
  const features: string[] = [];

  if (options.includeEmojis) features.push('emojis');
  if (options.includeHashtags) features.push('hashtags');

  return `${options.model} (${options.tone}, temp: ${options.temperature}, max: ${options.maxLength}${features.length > 0 ? `, ${features.join('+')}` : ''})`;
}
