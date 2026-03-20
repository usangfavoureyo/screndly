/**
 * Caption generation utility backed by the real AI route.
 */

import { apiClient } from '../lib/api/client';
import { DEFAULT_MODELS } from '../lib/ai/models';

export type PlatformName = 'YouTube' | 'X' | 'Threads' | 'Instagram' | 'TikTok' | 'Facebook' | 'Pinterest';

interface VideoMetadata {
  title: string;
  channelName: string;
  videoId: string;
  description?: string;
}

interface CaptionGenerationResult {
  x: string;
  facebook: string;
  instagram: string;
  threads: string;
  tiktok: string;
  youtube?: string;
  pinterest: string;
}

interface VideoCaptionSettings {
  model: string;
  prompt: string;
}

type PlatformKey = keyof CaptionGenerationResult;

const SETTINGS_KEYS = ['screndlySettings', 'screndly_settings'] as const;

function removeHashtags(caption: string): string {
  return caption.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
}

function getStoredSettings(): Record<string, any> {
  for (const key of SETTINGS_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (error) {
      console.error(`Failed to parse ${key}:`, error);
    }
  }

  return {};
}

function getVideoCaptionSettings(): VideoCaptionSettings {
  const settings = getStoredSettings();
  return {
    model: settings.videoOpenaiModel || DEFAULT_MODELS.video,
    prompt:
      settings.videoUniversalCaptionPrompt ||
      [
        'You are writing social captions for entertainment trailer posts.',
        'Keep the copy concise, high-energy, and platform-appropriate.',
        'Avoid filler and generic clickbait.',
      ].join('\n'),
  };
}

async function generateCaptionForPlatform(
  video: VideoMetadata,
  platform: PlatformName,
  settings: VideoCaptionSettings
): Promise<string> {
  const response = await apiClient.post<{ content: string }>('/api/ai/generate/youtube-caption', {
    videoTitle: video.title,
    channelName: video.channelName,
    description: video.description || '',
    platform,
    model: settings.model,
    customSystemPrompt: settings.prompt,
  });

  if (!response.success || !response.data?.content) {
    throw new Error(response.error?.message || `Failed to generate ${platform} caption`);
  }

  return response.data.content.trim();
}

export async function generateCaptionsForPublish(
  video: VideoMetadata,
  platformSettings: Record<string, { autoCaption: boolean; autoHashtag: boolean }>
): Promise<Record<PlatformName, string>> {
  const platformMap: Record<string, { name: PlatformName; key: PlatformKey }> = {
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

  const settings = getVideoCaptionSettings();
  const generationPromises = Object.entries(platformMap)
    .filter(([id]) => platformSettings[id]?.autoCaption)
    .map(async ([id, { name, key }]) => {
      const generated = await generateCaptionForPlatform(video, name, settings);
      return { id, name, key, generated };
    });

  const settled = await Promise.allSettled(generationPromises);
  const generatedCaptions: Partial<CaptionGenerationResult> = {};

  settled.forEach((item) => {
    if (item.status === 'fulfilled') {
      generatedCaptions[item.value.key] = item.value.generated;
      return;
    }

    console.error('Failed to generate caption:', item.reason);
  });

  Object.entries(platformMap).forEach(([id, { name, key }]) => {
    const settingsForPlatform = platformSettings[id];
    const fallbackCaption = `${video.title} - From ${video.channelName}`;

    if (settingsForPlatform?.autoCaption && generatedCaptions[key]) {
      let caption = generatedCaptions[key] as string;
      if (!settingsForPlatform.autoHashtag) {
        caption = removeHashtags(caption);
      }
      result[name] = caption;
      return;
    }

    result[name] = fallbackCaption;
  });

  return result;
}

export function getPlatformCaptionSettings(): Record<string, { autoCaption: boolean; autoHashtag: boolean }> {
  try {
    const savedSettings = localStorage.getItem('screndly_platformSettings');
    if (savedSettings) {
      const platformSettings = JSON.parse(savedSettings);
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
