import { describe, expect, it } from 'vitest';
import {
  COMPOSE_STORY_VIDEO_SEGMENT_SECONDS,
  estimateComposeStoryItemCount,
  getComposePlatformCompatibility,
  getComposeCompatibilityMap,
  sanitizeComposeItem,
} from '../../lib/create/composeMedia';
import type { ComposeItem } from '../../types/compose';
import type { ComposeMediaAsset } from '../../types/compose';

function buildImageAsset(id: string): ComposeMediaAsset {
  return {
    id,
    kind: 'image',
    fileName: `${id}.jpg`,
    mimeType: 'image/jpeg',
    size: 1024,
    order: Number(id.replace(/\D/g, '')) || 0,
    storageUrl: `https://cdn.example.com/${id}.jpg`,
    uploadStatus: 'uploaded',
  };
}

function buildVideoAsset(id: string, durationSeconds: number): ComposeMediaAsset {
  return {
    id,
    kind: 'video',
    fileName: `${id}.mp4`,
    mimeType: 'video/mp4',
    size: 4096,
    order: Number(id.replace(/\D/g, '')) || 0,
    storageUrl: `https://cdn.example.com/${id}.mp4`,
    uploadStatus: 'uploaded',
    durationSeconds,
  };
}

describe('composeMedia story compatibility', () => {
  it('allows multi-image story posts for Instagram Stories and Facebook Stories', () => {
    const assets = [
      buildImageAsset('asset-1'),
      buildImageAsset('asset-2'),
      buildImageAsset('asset-3'),
    ];

    const instagramStories = getComposePlatformCompatibility('instagram_stories', assets);
    const facebookStories = getComposePlatformCompatibility('facebook_stories', assets);

    expect(instagramStories).toMatchObject({
      platform: 'instagram_stories',
      supported: true,
      label: 'Carousel',
    });
    expect(facebookStories).toMatchObject({
      platform: 'facebook_stories',
      supported: true,
      label: 'Carousel',
    });
  });

  it('caps story multi-image posts at four assets in this flow', () => {
    const assets = [
      buildImageAsset('asset-1'),
      buildImageAsset('asset-2'),
      buildImageAsset('asset-3'),
      buildImageAsset('asset-4'),
      buildImageAsset('asset-5'),
    ];

    const compatibilityMap = getComposeCompatibilityMap(assets);

    expect(compatibilityMap.instagram_stories.supported).toBe(false);
    expect(compatibilityMap.instagram_stories.reason).toContain('Supports up to 4 story items');
    expect(compatibilityMap.facebook_stories.supported).toBe(false);
    expect(compatibilityMap.facebook_stories.reason).toContain('Supports up to 4 story items');
  });

  it('allows multiple story videos when the split queue stays within the story limit', () => {
    const assets = [
      buildVideoAsset('video-1', COMPOSE_STORY_VIDEO_SEGMENT_SECONDS * 2),
      buildVideoAsset('video-2', 30),
    ];

    expect(estimateComposeStoryItemCount(assets)).toBe(3);
    expect(getComposePlatformCompatibility('instagram_stories', assets)).toMatchObject({
      platform: 'instagram_stories',
      supported: true,
      label: 'Carousel',
    });
    expect(getComposePlatformCompatibility('facebook_stories', assets)).toMatchObject({
      platform: 'facebook_stories',
      supported: true,
      label: 'Carousel',
    });
  });

  it('blocks story posts when video splitting would exceed four story items', () => {
    const assets = [buildVideoAsset('video-1', COMPOSE_STORY_VIDEO_SEGMENT_SECONDS * 5)];

    expect(estimateComposeStoryItemCount(assets)).toBe(5);

    const instagramStories = getComposePlatformCompatibility('instagram_stories', assets);
    const facebookStories = getComposePlatformCompatibility('facebook_stories', assets);

    expect(instagramStories.supported).toBe(false);
    expect(instagramStories.reason).toContain('story items after splitting videos longer than 60 seconds');
    expect(facebookStories.supported).toBe(false);
    expect(facebookStories.reason).toContain('story items after splitting videos longer than 60 seconds');
  });

  it('drops duplicate remote preview URLs from persisted compose items', () => {
    const item: ComposeItem = {
      id: 'persisted-item',
      title: 'Persisted item',
      status: 'draft',
      mediaAssets: [
        {
          ...buildImageAsset('asset-persisted'),
          previewUrl: 'https://authorized.example.com/asset-persisted.jpg?Authorization=abc123',
          storageUrl: 'https://cdn.example.com/asset-persisted.jpg',
        },
      ],
      platforms: ['instagram_stories'],
      sharedCaption: 'Caption',
      platformFields: {},
      createdAt: '2026-04-09T10:00:00.000Z',
      updatedAt: '2026-04-09T10:00:00.000Z',
    };

    const sanitized = sanitizeComposeItem(item);

    expect(sanitized.mediaAssets[0]?.previewUrl).toBe('https://cdn.example.com/asset-persisted.jpg');
    expect(sanitized.mediaAssets[0]?.storageUrl).toBe('https://cdn.example.com/asset-persisted.jpg');
  });
});
