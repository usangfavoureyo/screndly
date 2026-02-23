/**
 * Video Studio Caption Generation Utility
 * Generates captions for video content using Video Studio Settings
 */

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

interface VideoContent {
  contentType: VideoContentType;
  transcript?: string;
  movieTitle?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
}

/**
 * Mock caption generation - simulates AI caption generation
 * In production, this would call the OpenAI API with the Video Studio caption prompt
 */
async function mockGenerateCaption(
  content: VideoContent,
  options: CaptionGenerationOptions
): Promise<string> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  const { contentType, transcript, movieTitle, startTime, endTime, duration } = content;
  let caption = '';

  // Generate caption based on content type and tone
  switch (contentType) {
    case 'scenes':
      const timeRange = startTime && endTime ? `${startTime}s - ${endTime}s` : '';
      const durationStr = duration ? `${duration}s` : '';
      
      if (options.tone === 'hype') {
        caption = options.includeEmojis
          ? `🎬 THIS SCENE THO 🔥\n\n${movieTitle ? `From ${movieTitle} ` : ''}${durationStr} of pure cinema\n\nTimestamp: ${timeRange}`
          : `THIS SCENE THO\n\n${movieTitle ? `From ${movieTitle} ` : ''}${durationStr} of pure cinema\n\nTimestamp: ${timeRange}`;
      } else if (options.tone === 'professional') {
        caption = `Scene from ${movieTitle || 'this film'}.\n\nDuration: ${durationStr} (${timeRange})\n\nA compelling moment showcasing cinematic storytelling.`;
      } else if (options.tone === 'casual') {
        caption = options.includeEmojis
          ? `Just cut this ${durationStr} scene ${movieTitle ? `from ${movieTitle} ` : ''}and it hits different 👌\n\n${timeRange}`
          : `Just cut this ${durationStr} scene ${movieTitle ? `from ${movieTitle} ` : ''}and it hits different\n\n${timeRange}`;
      } else { // engaging
        caption = options.includeEmojis
          ? `${movieTitle ? `${movieTitle}: ` : ''}This ${durationStr} moment captures everything 🎭\n\n${timeRange}\n\nWhen cinema gives you the perfect scene.`
          : `${movieTitle ? `${movieTitle}: ` : ''}This ${durationStr} moment captures everything\n\n${timeRange}\n\nWhen cinema gives you the perfect scene.`;
      }
      
      if (options.includeHashtags) {
        caption += '\n\n#MovieScenes #Cinema #FilmClips #Cinematic #MustWatch';
      }
      break;

    case 'review':
      if (options.tone === 'hype') {
        caption = options.includeEmojis
          ? "🔥 THE THRILLER OF THE YEAR IS HERE 🎬\n\nCorruption. Conspiracy. No one is safe."
          : "THE THRILLER OF THE YEAR IS HERE\n\nCorruption. Conspiracy. No one is safe.";
      } else if (options.tone === 'professional') {
        caption = "New thriller explores systemic corruption through the eyes of a determined detective. In theaters this summer.";
      } else if (options.tone === 'casual') {
        caption = options.includeEmojis
          ? "Yo this thriller looks INSANE 😱 Detective vs corruption storyline, coming this summer 🍿"
          : "Yo this thriller looks INSANE Detective vs corruption storyline, coming this summer";
      } else { // engaging
        caption = options.includeEmojis
          ? "The conspiracy runs deeper than anyone imagined 🎭\n\nA detective's search for truth becomes a fight for survival. Don't miss the thriller everyone will be talking about."
          : "The conspiracy runs deeper than anyone imagined\n\nA detective's search for truth becomes a fight for survival. Don't miss the thriller everyone will be talking about.";
      }
      
      if (options.includeHashtags) {
        caption += '\n\n#Thriller #ComingSoon #MustWatch #MoviePremiere #Cinema';
      }
      break;

    case 'releases':
      if (options.tone === 'hype') {
        caption = options.includeEmojis
          ? "🎬 MONTH'S BIGGEST RELEASES INCOMING 🚀\n\nSci-fi epics + heartwarming dramas = PURE CINEMA"
          : "MONTH'S BIGGEST RELEASES INCOMING\n\nSci-fi epics + heartwarming dramas = PURE CINEMA";
      } else if (options.tone === 'professional') {
        caption = "This month's theatrical releases feature diverse storytelling across multiple genres. From science fiction to drama.";
      } else if (options.tone === 'casual') {
        caption = options.includeEmojis
          ? "This month's lineup is stacked! 🎬 Got sci-fi, dramas, and everything in between 👌"
          : "This month's lineup is stacked Got sci-fi, dramas, and everything in between";
      } else { // engaging
        caption = options.includeEmojis
          ? "Your monthly dose of cinematic excellence is here 🎬✨\n\nFrom mind-bending sci-fi to stories that touch the heart—this month delivers."
          : "Your monthly dose of cinematic excellence is here\n\nFrom mind-bending sci-fi to stories that touch the heart—this month delivers.";
      }
      
      if (options.includeHashtags) {
        caption += '\n\n#NewReleases #Movies #MustWatch #FilmLovers #Cinema';
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
 * Get Video Studio caption generation settings from localStorage
 */
export function getVideoStudioCaptionSettings(contentType: VideoContentType): CaptionGenerationOptions {
  let settings: any = {};
  
  try {
    const saved = localStorage.getItem('screndly_video_studio_settings');
    if (saved) {
      settings = JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load Video Studio settings:', error);
  }

  // Map content type to prompt key
  const promptKeys: Record<VideoContentType, string> = {
    review: 'captionReviewPrompt',
    releases: 'captionReleasesPrompt',
    scenes: 'captionScenesPrompt',
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
function getDefaultPrompt(contentType: VideoContentType): string {
  const defaultPrompts: Record<VideoContentType, string> = {
    review: `You are a social media caption writer for Screen Render, a movie and TV trailer platform. Generate captions specifically for review-driven content about movies or TV shows.

INPUT: Voiceover transcript from a review video
OUTPUT: Review-focused caption (120-250 characters)

Guidelines:
- Use the title, cast (if mentioned), and review details from the voiceover
- Keep it short: 120-250 characters
- NO emojis
- Include a call to action to follow Screen Render for more (vary the phrasing)
- Use line breaks for readability when necessary
- Focus on the review perspective and insights
- Make it compelling and authentic`,
    
    releases: `You are a social media caption writer for Screen Render, a movie and TV trailer platform. Generate captions specifically for upcoming or newly released titles for the month.

INPUT: Voiceover transcript about monthly releases
OUTPUT: Release-focused caption (120-250 characters)

Guidelines:
- Based on the voiceover, capture the excitement of new releases
- Keep it short: 120-250 characters
- NO emojis
- Sometimes include a call to action to watch the video (vary the phrasing)
- Use line breaks for readability when necessary
- Match the tone of the release slate (blockbusters, Oscar season, holiday films, etc.)`,
    
    scenes: `You are a social media caption writer for Screen Render, a movie and TV trailer platform. Generate captions specifically for scene-based clips cut from movies or shows.

INPUT: Voiceover transcript from a specific scene
OUTPUT: Scene-focused caption (120-250 characters)

Guidelines:
- Use the title, cast (if applicable), and scene details pertaining to that scene
- Keep it short: 120-250 characters
- NO emojis
- Include a call to action to follow Screen Render for more (vary the phrasing)
- Use line breaks for readability when necessary
- Focus on what makes this particular scene compelling
- Capture the emotion, drama, or significance of the moment`
  };

  return defaultPrompts[contentType];
}

/**
 * Generate caption for video content using settings
 */
export async function generateVideoStudioCaption(
  content: VideoContent
): Promise<{ caption: string; charCount: number; settings: CaptionGenerationOptions }> {
  const options = getVideoStudioCaptionSettings(content.contentType);

  try {
    const caption = await mockGenerateCaption(content, options);
    
    return {
      caption,
      charCount: caption.length,
      settings: options,
    };
  } catch (error) {
    console.error('Failed to generate Video Studio caption:', error);
    
    // Fallback to basic caption
    const fallbackCaption = 'Check out this amazing content!';
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
export function formatVideoStudioCaptionSettingsForLog(options: CaptionGenerationOptions): string {
  const features: string[] = [];
  
  if (options.includeEmojis) features.push('emojis');
  if (options.includeHashtags) features.push('hashtags');
  
  return `${options.model} (${options.tone}, max: ${options.maxLength}${features.length > 0 ? `, ${features.join('+')}` : ''})`;
}
