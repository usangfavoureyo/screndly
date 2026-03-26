/**
 * RSS caption generation utility backed by the real AI route.
 */

import { apiClient } from '../lib/api/client';
import { DEFAULT_MODELS, normalizeAIModelId } from '../lib/ai/models';
import { getCachedAIResponse } from '../lib/ai/cache';
import { captionOptimizer } from '../lib/optimization';
import { rssPromptDefaults } from '../config/cultureCravePromptDefaults';

interface RSSArticle {
  title: string;
  description: string;
  link: string;
  content?: string;
  feedName?: string;
}

interface CaptionGenerationOptions {
  model: string;
  temperature: number;
  tone: string;
  maxLength: number;
  prompt: string;
}

function buildSystemPrompt(options: CaptionGenerationOptions): string {
  return [
    options.prompt,
    'Additional Constraints:',
    `- Preferred tone: ${options.tone}.`,
    `- Keep the caption under ${options.maxLength} characters.`,
  ].join('\n');
}

export function getRSSCaptionSettings(settings: any): CaptionGenerationOptions {
  return {
    model: normalizeAIModelId(settings.rssCaptionModel, DEFAULT_MODELS.rss),
    temperature: settings.rssCaptionTemperature || 0.7,
    tone: settings.rssCaptionTone || 'Engaging',
    maxLength: settings.rssCaptionMaxLength || 280,
    prompt:
      settings.rssCaptionPrompt ||
      rssPromptDefaults.rssCaptionPrompt,
  };
}

export async function generateRSSCaption(
  article: RSSArticle,
  settings: any
): Promise<{ caption: string; charCount: number; settings: CaptionGenerationOptions }> {
  const options = getRSSCaptionSettings(settings);

  try {
    const requestPayload = {
      articleTitle: article.title,
      feedName: article.feedName || 'RSS Feed',
      summary: article.content || article.description,
      platform: 'X',
      model: options.model,
      customSystemPrompt: buildSystemPrompt(options),
      customTemperature: options.temperature,
    };
    const { data: response } = await getCachedAIResponse(
      'caption:rss',
      requestPayload,
      () => apiClient.post<{ content: string }>('/api/ai/generate/rss-caption', requestPayload),
      {
        ttlMs: 24 * 60 * 60 * 1000,
      },
    );

    if (!response.success || !response.data?.content) {
      throw new Error(response.error?.message || 'Failed to generate RSS caption');
    }

    const caption = response.data.content.trim();
    const articleId = article.link.split('/').pop() || article.title.slice(0, 20);
    captionOptimizer.recordCaptionMetadata(
      articleId,
      'x',
      'rss',
      caption,
      options.model,
      options.tone,
    );

    return {
      caption,
      charCount: caption.length,
      settings: options,
    };
  } catch (error) {
    console.error('Failed to generate RSS caption:', error);
    const fallbackCaption = `${article.title}\n\n${article.description}`.trim();
    return {
      caption: fallbackCaption,
      charCount: fallbackCaption.length,
      settings: options,
    };
  }
}

export function formatRSSCaptionSettingsForLog(options: CaptionGenerationOptions): string {
  return `${options.model} (${options.tone}, temp: ${options.temperature}, max: ${options.maxLength})`;
}
