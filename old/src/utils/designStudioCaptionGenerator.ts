/**
 * Design Studio Caption Generation Utility
 * Generates captions for design content using Design Studio Settings
 */

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
 * Mock caption generation - simulates AI caption generation
 * In production, this would call the OpenAI API with the Design Studio caption prompt
 */
async function mockGenerateCaption(
  content: DesignContent,
  options: CaptionGenerationOptions
): Promise<string> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1200));

  const { contentType, title, tagline, releaseInfo, castInfo, context } = content;
  let caption = '';

  // Generate caption based on content type
  switch (contentType) {
    case 'poster':
      if (options.tone === 'hype') {
        caption = options.includeEmojis
          ? `🎬 NEW POSTER ALERT 🔥\n\n${title || 'This film'} ${releaseInfo || 'coming soon'}`
          : `NEW POSTER ALERT\n\n${title || 'This film'} ${releaseInfo || 'coming soon'}`;
      } else if (options.tone === 'professional') {
        caption = `First look at ${title || 'the upcoming film'}. ${releaseInfo || 'Release date TBA'}.`;
      } else if (options.tone === 'casual') {
        caption = options.includeEmojis
          ? `First look at ${title || 'this one'} 👀 ${releaseInfo || 'dropping soon'}`
          : `First look at ${title || 'this one'} ${releaseInfo || 'dropping soon'}`;
      } else { // engaging
        caption = `${title || 'The film'} ${releaseInfo || 'arrives soon'}. ${tagline || 'This is going to be incredible.'}`;
      }
      
      if (castInfo) {
        caption += `\n\nStarring ${castInfo}`;
      }
      
      if (options.includeHashtags) {
        caption += '\n\n#MoviePoster #FilmArt #ComingSoon #Cinema';
      }
      break;

    case 'carousel':
      if (options.tone === 'hype') {
        caption = options.includeEmojis
          ? `🔥 SWIPE FOR THE FULL ${title || 'LINEUP'} 🔥\n\n${context || 'Every single one is incredible'}`
          : `SWIPE FOR THE FULL ${title || 'LINEUP'}\n\n${context || 'Every single one is incredible'}`;
      } else if (options.tone === 'professional') {
        caption = `${title || 'Content'} collection. ${context || 'Slide through to see all images.'} ${releaseInfo || ''}`;
      } else if (options.tone === 'casual') {
        caption = options.includeEmojis
          ? `Swipe to see ${title || 'everything'} 👉 ${context || 'So good'}`
          : `Swipe to see ${title || 'everything'} ${context || 'Worth checking out'}`;
      } else { // engaging
        caption = `Swipe through for ${title || 'the complete collection'}. ${context || 'Each image tells a story.'}`;
      }
      
      if (options.includeHashtags) {
        caption += '\n\n#Carousel #FilmContent #MoviePost #Cinema';
      }
      break;

    case 'story':
      // Stories need to be shorter
      if (options.tone === 'hype') {
        caption = options.includeEmojis
          ? `${title || 'THIS'} IS FINALLY HERE 🔥`
          : `${title || 'THIS'} IS FINALLY HERE`;
      } else if (options.tone === 'professional') {
        caption = `${title || 'Content'} ${releaseInfo || 'now available'}`;
      } else if (options.tone === 'casual') {
        caption = options.includeEmojis
          ? `${title || 'This'} just dropped 👀`
          : `${title || 'This'} just dropped`;
      } else { // engaging
        caption = options.includeEmojis
          ? `${title || 'This'} hits different 🎭`
          : `${title || 'This'} hits different`;
      }
      
      if (options.includeHashtags) {
        caption += '\n\n#Stories #Movies';
      }
      break;

    case 'announcement':
      if (options.tone === 'hype') {
        caption = options.includeEmojis
          ? `🚨 BREAKING NEWS 🚨\n\n${context || 'Major announcement'}\n\n${title || ''}${releaseInfo ? ` ${releaseInfo}` : ''}`
          : `BREAKING NEWS\n\n${context || 'Major announcement'}\n\n${title || ''}${releaseInfo ? ` ${releaseInfo}` : ''}`;
      } else if (options.tone === 'professional') {
        caption = `ANNOUNCEMENT: ${context || title || 'Major update'}. ${releaseInfo || ''}${castInfo ? ` Starring ${castInfo}.` : ''}`;
      } else if (options.tone === 'casual') {
        caption = options.includeEmojis
          ? `Big news: ${context || title || 'something major just happened'} 👀 ${releaseInfo || ''}`
          : `Big news: ${context || title || 'something major'} ${releaseInfo || ''}`;
      } else { // engaging
        caption = `${context || `Important ${title || 'announcement'}`}. ${releaseInfo || ''}${castInfo ? `\n\nFeaturing ${castInfo}` : ''}`;
      }
      
      if (options.includeHashtags) {
        caption += '\n\n#Announcement #Breaking #FilmNews #Cinema';
      }
      break;

    case 'general':
    default:
      if (options.tone === 'hype') {
        caption = options.includeEmojis
          ? `🎬 ${title || 'MUST SEE'} 🔥\n\n${context || tagline || 'This is everything'}`
          : `${title || 'MUST SEE'}\n\n${context || tagline || 'This is everything'}`;
      } else if (options.tone === 'professional') {
        caption = `${title || 'Content'}. ${context || tagline || ''}${releaseInfo ? ` ${releaseInfo}` : ''}`;
      } else if (options.tone === 'casual') {
        caption = options.includeEmojis
          ? `${title || 'Check this out'} ${context || tagline || 'looks amazing'} 🎬`
          : `${title || 'Check this out'} ${context || tagline || 'looks great'}`;
      } else { // engaging
        caption = `${title || 'Explore this'}. ${context || tagline || 'A visual journey through cinema.'}${releaseInfo ? `\n\n${releaseInfo}` : ''}`;
      }
      
      if (options.includeHashtags) {
        caption += '\n\n#Movies #Cinema #FilmContent';
      }
      break;
  }

  // Truncate to max length if needed
  if (caption.length > options.maxLength) {
    caption = caption.substring(0, options.maxLength - 3) + '...';
  }

  return caption;
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

  // Map content type to prompt key
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
    includeEmojis: settings.captionIncludeEmojis !== false, // Default true
    includeHashtags: settings.captionIncludeHashtags !== false, // Default true
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
- Clear, engaging language`
  };

  return defaultPrompts[contentType];
}

/**
 * Generate caption for design content using settings
 */
export async function generateDesignStudioCaption(
  content: DesignContent
): Promise<{ caption: string; charCount: number; settings: CaptionGenerationOptions }> {
  const options = getDesignStudioCaptionSettings(content.contentType);

  try {
    const caption = await mockGenerateCaption(content, options);
    
    return {
      caption,
      charCount: caption.length,
      settings: options,
    };
  } catch (error) {
    console.error('Failed to generate Design Studio caption:', error);
    
    // Fallback to basic caption
    const fallbackCaption = content.title || 'Check out this design!';
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
export function formatDesignStudioCaptionSettingsForLog(options: CaptionGenerationOptions): string {
  const features: string[] = [];
  
  if (options.includeEmojis) features.push('emojis');
  if (options.includeHashtags) features.push('hashtags');
  
  return `${options.model} (${options.tone}, max: ${options.maxLength}${features.length > 0 ? `, ${features.join('+')}` : ''})`;
}
