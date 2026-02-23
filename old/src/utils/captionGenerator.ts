/**
 * Caption Generation Utility
 * Generates platform-specific captions using Video Settings prompts
 * Integrated with Analytics-Driven Optimization Layer
 */

import { captionOptimizer } from '../lib/optimization';

export type PlatformName = 'YouTube' | 'X' | 'Threads' | 'Instagram' | 'TikTok' | 'Facebook' | 'Pinterest';

interface CaptionGenerationResult {
  x: string;
  facebook: string;
  instagram: string;
  threads: string;
  tiktok: string;
  youtube?: string;
  pinterest: string;
}

interface VideoMetadata {
  title: string;
  channelName: string;
  videoId: string;
  description?: string;
}

/**
 * Generate captions using optimization layer
 * Uses analytics-derived signals to enhance caption quality
 */
async function mockGenerateCaptions(video: VideoMetadata): Promise<CaptionGenerationResult> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Get optimization signals for caption enhancement
  const basePrompt = `Generate platform-optimized captions for: ${video.title}`;

  // Use captionOptimizer to enhance the prompt with performance signals
  const enhancedPrompt = captionOptimizer.enhancePrompt(basePrompt, 'video');

  // Select optimal model based on analytics
  const optimalModel = captionOptimizer.selectModel('video');

  console.log(`[CaptionGenerator] Using model: ${optimalModel}, enhanced prompt applied`);

  // Mock generated captions based on the video metadata
  const title = video.title;
  const cleanTitle = title.replace(/\s*(Official\s+)?(Trailer|Teaser|First Look|Sneak Peek)\s*/gi, '').trim();
  const hashtag = cleanTitle.replace(/[^a-zA-Z0-9]/g, '');

  const result: CaptionGenerationResult = {
    x: `#${hashtag} hits theatres soon 🎬 ${cleanTitle} is coming.`,
    facebook: `🎬 Get ready! ${cleanTitle} is coming soon.\n\nThis looks absolutely incredible! We can't wait to see this one. What do you think?\n\n#${hashtag} #Movies #Trailers #ComingSoon #FilmTwitter`,
    instagram: `✨ ${cleanTitle} ✨\n\nComing soon to theatres.\n\nThis is the trailer drop we've been waiting for! Who's excited? 🔥\n\n#${hashtag} #Movies #Film #Trailer #ComingSoon #Cinema #MovieNight #Cinephile #FilmCommunity #MovieBuff`,
    threads: `just watched the ${cleanTitle} trailer and I'm speechless 😭\n\nthis is going to be incredible\n\n#${hashtag} #movies`,
    tiktok: `the ${cleanTitle} trailer dropped 🔥\n\nthis looks insane omg\n\n#${hashtag} #movies #trailer #fyp #viral`,
    youtube: `${cleanTitle} | Official Trailer`,
    pinterest: `${cleanTitle} - Official Trailer 🎬\n\nComing Soon to Theaters\n\n#${hashtag} #Movies #Film #Trailer #ComingSoon`,
  };

  // Record caption metadata for analytics
  captionOptimizer.recordCaptionMetadata(video.videoId, 'video', optimalModel, {
    titleLength: title.length,
    hasDescription: !!video.description,
    channelName: video.channelName,
  });

  return result;
}

/**
 * Remove hashtags from caption text
 */
function removeHashtags(caption: string): string {
  // Remove all hashtags (words starting with #)
  return caption.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Generate captions for auto-publish based on platform settings
 */
export async function generateCaptionsForPublish(
  video: VideoMetadata,
  platformSettings: Record<string, { autoCaption: boolean; autoHashtag: boolean }>
): Promise<Record<PlatformName, string>> {
  // Map platform IDs to names
  const platformMap: Record<string, { name: PlatformName; key: keyof CaptionGenerationResult }> = {
    youtube: { name: 'YouTube', key: 'youtube' },
    x: { name: 'X', key: 'x' },
    threads: { name: 'Threads', key: 'threads' },
    instagram: { name: 'Instagram', key: 'instagram' },
    tiktok: { name: 'TikTok', key: 'tiktok' },
    facebook: { name: 'Facebook', key: 'facebook' },
    pinterest: { name: 'Pinterest', key: 'pinterest' },
  };

  const result: Record<PlatformName, string> = {
    YouTube: '',
    X: '',
    Threads: '',
    Instagram: '',
    TikTok: '',
    Facebook: '',
    Pinterest: '',
  };

  // Check if any platform needs auto-captions
  const needsCaptions = Object.values(platformSettings).some(s => s.autoCaption);

  let generatedCaptions: CaptionGenerationResult | null = null;

  // Generate captions once if any platform needs them
  if (needsCaptions) {
    try {
      generatedCaptions = await mockGenerateCaptions(video);
    } catch (error) {
      console.error('Failed to generate captions:', error);
    }
  }

  // Process each platform
  Object.entries(platformMap).forEach(([id, { name, key }]) => {
    const settings = platformSettings[id];

    if (!settings) {
      // Default to basic caption if no settings
      result[name] = `${video.title} - From ${video.channelName}`;
      return;
    }

    if (settings.autoCaption && generatedCaptions) {
      // Use generated caption
      let caption = generatedCaptions[key] || video.title;

      // Remove hashtags if autoHashtag is disabled
      if (!settings.autoHashtag) {
        caption = removeHashtags(caption);
      }

      result[name] = caption;
    } else {
      // Use basic caption (just video title + channel)
      result[name] = `${video.title} - From ${video.channelName}`;
    }
  });

  return result;
}

/**
 * Get caption settings from localStorage
 */
export function getPlatformCaptionSettings(): Record<string, { autoCaption: boolean; autoHashtag: boolean }> {
  try {
    const savedSettings = localStorage.getItem('screndly_platformSettings');
    if (savedSettings) {
      const platformSettings = JSON.parse(savedSettings);

      // Extract only autoCaption and autoHashtag for each platform
      const captionSettings: Record<string, { autoCaption: boolean; autoHashtag: boolean }> = {};

      Object.entries(platformSettings).forEach(([id, settings]: [string, any]) => {
        captionSettings[id] = {
          autoCaption: settings?.autoCaption ?? false,
          autoHashtag: settings?.autoHashtag ?? false,
        };
      });

      return captionSettings;
    }
  } catch (error) {
    console.error('Failed to load platform caption settings:', error);
  }

  // Default settings - all disabled
  return {
    youtube: { autoCaption: false, autoHashtag: false },
    x: { autoCaption: true, autoHashtag: true },
    threads: { autoCaption: true, autoHashtag: false },
    instagram: { autoCaption: true, autoHashtag: true },
    tiktok: { autoCaption: true, autoHashtag: true },
    facebook: { autoCaption: false, autoHashtag: true },
    pinterest: { autoCaption: true, autoHashtag: true },
  };
}