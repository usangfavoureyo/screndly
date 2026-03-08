/**
 * RSS caption generation utility backed by the real AI route.
 */

import { apiClient } from '../lib/api/client';
import { DEFAULT_MODELS } from '../lib/ai/models';
import { captionOptimizer } from '../lib/optimization';

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
    model: settings.rssCaptionModel || DEFAULT_MODELS.rss,
    temperature: settings.rssCaptionTemperature || 0.7,
    tone: settings.rssCaptionTone || 'Engaging',
    maxLength: settings.rssCaptionMaxLength || 280,
    prompt:
      settings.rssCaptionPrompt ||
      'Write an engaging social caption for this RSS article without using filler language.',
  };
}

export async function generateRSSCaption(
  article: RSSArticle,
  settings: any
): Promise<{ caption: string; charCount: number; settings: CaptionGenerationOptions }> {
  const options = getRSSCaptionSettings(settings);

  try {
    const response = await apiClient.post<{ content: string }>('/api/ai/generate/rss-caption', {
      articleTitle: article.title,
      feedName: article.feedName || 'RSS Feed',
      summary: article.content || article.description,
      platform: 'X',
      model: options.model,
      customSystemPrompt: buildSystemPrompt(options),
      customTemperature: options.temperature,
    });

    if (!response.success || !response.data?.content) {
      throw new Error(response.error?.message || 'Failed to generate RSS caption');
    }

    const caption = response.data.content.trim();
    const articleId = article.link.split('/').pop() || article.title.slice(0, 20);
    captionOptimizer.recordCaptionMetadata(articleId, 'rss', options.model, {
      tone: options.tone,
      titleLength: article.title.length,
      hasContent: Boolean(article.content),
    });

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
