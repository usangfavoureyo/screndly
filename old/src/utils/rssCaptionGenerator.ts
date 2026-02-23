/**
 * RSS Caption Generation Utility
 * Generates captions for RSS articles using RSS Settings
 * Integrated with Analytics-Driven Optimization Layer
 */

import { captionOptimizer } from '../lib/optimization';

interface RSSArticle {
  title: string;
  description: string;
  link: string;
  content?: string;
}

interface CaptionGenerationOptions {
  model: string;
  temperature: number;
  tone: string;
  maxLength: number;
  prompt: string;
}

/**
 * Generate caption using optimization layer
 * Uses analytics-derived signals to enhance caption quality
 */
async function mockGenerateCaption(
  article: RSSArticle,
  options: CaptionGenerationOptions
): Promise<string> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 150));

  // Use captionOptimizer to enhance prompt and select model
  const enhancedPrompt = captionOptimizer.enhancePrompt(options.prompt, 'rss');
  const optimalModel = captionOptimizer.selectModel('rss');

  console.log(`[RSSCaptionGenerator] Using model: ${optimalModel}, tone: ${options.tone}`);

  // Extract movie/show title from article title
  const title = article.title;
  const description = article.description;

  // Generate caption based on tone and article content
  let caption = '';

  switch (options.tone) {
    case 'Professional':
      caption = `${title}\n\n${description}\n\n#Movies #Cinema #Entertainment`;
      break;
    case 'Casual':
      caption = `just saw this and wow 👀\n\n${title}\n\n${description}\n\n#movies #film`;
      break;
    case 'Informative':
      caption = `📰 ${title}\n\n${description}\n\nRead more: ${article.link}\n\n#FilmNews #Movies`;
      break;
    case 'Exciting':
      caption = `🔥 BREAKING: ${title} 🔥\n\n${description}\n\n#Movies #Cinema #FilmTwitter`;
      break;
    case 'Mysterious':
      caption = `Something big is coming... 👀\n\n${title}\n\n${description}\n\n#Movies #ComingSoon`;
      break;
    case 'Engaging':
    default:
      caption = `BREAKING: ${title} 🎬\n\n${description}\n\n#Movies #Cinema #FilmNews`;
      break;
  }

  // Truncate to max length if needed
  if (caption.length > options.maxLength) {
    caption = caption.substring(0, options.maxLength - 3) + '...';
  }

  // Record caption metadata for analytics
  const articleId = article.link.split('/').pop() || article.title.slice(0, 20);
  captionOptimizer.recordCaptionMetadata(articleId, 'rss', optimalModel, {
    tone: options.tone,
    titleLength: title.length,
    hasContent: !!article.content,
  });

  return caption;
}

/**
 * Get RSS caption generation settings from SettingsContext
 */
export function getRSSCaptionSettings(settings: any): CaptionGenerationOptions {
  return {
    model: settings.rssCaptionModel || 'gpt-4o',
    temperature: settings.rssCaptionTemperature || 0.7,
    tone: settings.rssCaptionTone || 'Engaging',
    maxLength: settings.rssCaptionMaxLength || 280,
    prompt: settings.rssCaptionPrompt || `You are a social media caption writer for Screen Render, a movie and TV trailer news platform. Create engaging, platform-optimized captions for RSS article content.

INPUT: RSS article title, description, and content
OUTPUT: Engaging social media caption with emojis, hashtags, and hook

Guidelines:
- Hook in first line (7-10 words max)
- Include 3 relevant emoji and hashtags
- Add 2-3 strategically placed emojis
- Keep total under {maxLength} characters for platform compatibility
- Match the tone of the article content
- No generic "Check this out" openers
- Focus on the key news or reveal from the article
- Make it shareable and clickable`,
  };
}

/**
 * Generate caption for RSS article using settings
 */
export async function generateRSSCaption(
  article: RSSArticle,
  settings: any
): Promise<{ caption: string; charCount: number; settings: CaptionGenerationOptions }> {
  const options = getRSSCaptionSettings(settings);

  try {
    const caption = await mockGenerateCaption(article, options);

    return {
      caption,
      charCount: caption.length,
      settings: options,
    };
  } catch (error) {
    console.error('Failed to generate RSS caption:', error);

    // Fallback to basic caption
    const fallbackCaption = `${article.title}\n\n${article.description}\n\n#Movies #Cinema`;
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
export function formatRSSCaptionSettingsForLog(options: CaptionGenerationOptions): string {
  return `${options.model} (${options.tone}, temp: ${options.temperature}, max: ${options.maxLength})`;
}
