import { describe, expect, it } from 'vitest';
import {
  COMPOSE_STORY_VIDEO_SEGMENT_SECONDS,
  estimateComposeStoryItemCount,
  getComposePlatformCompatibility,
  getComposeCompatibilityMap,
  getComposeAssetPreviewUrl,
  normalizeComposeItem,
  sanitizeComposeItem,
} from '../../lib/create/composeMedia';
import { compactComposeItemsForPersistence } from '../../store/useComposeStore';
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

  it('preserves authorized remote preview URLs on sanitized actionable items', () => {
    const item: ComposeItem = {
      id: 'persisted-item',
      title: 'Persisted item',
      status: 'failed',
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

    expect(sanitized.mediaAssets[0]?.previewUrl).toBe('https://authorized.example.com/asset-persisted.jpg?Authorization=abc123');
    expect(sanitized.mediaAssets[0]?.storageUrl).toBe('https://cdn.example.com/asset-persisted.jpg');
  });

  it('keeps authorized preview URLs for actionable items and recent published items', () => {
    const failedItem: ComposeItem = {
      id: 'failed-item',
      title: 'Failed item',
      status: 'failed',
      mediaAssets: [
        {
          ...buildVideoAsset('video-failed', 95),
          previewUrl: 'https://authorized.example.com/video-failed.mp4?Authorization=abc123',
          storageUrl: 'https://cdn.example.com/video-failed.mp4',
        },
      ],
      platforms: ['facebook_stories'],
      sharedCaption: 'Caption',
      platformFields: {},
      createdAt: '2026-04-09T10:00:00.000Z',
      updatedAt: '2026-04-09T10:00:00.000Z',
      error: 'Video failed',
    };
    const publishedItem: ComposeItem = {
      ...failedItem,
      id: 'published-item',
      title: 'Published item',
      status: 'published',
      error: undefined,
    };

    const compacted = compactComposeItemsForPersistence([failedItem, publishedItem]);
    const compactedFailed = compacted.find((item) => item.id === 'failed-item');
    const compactedPublished = compacted.find((item) => item.id === 'published-item');

    expect(compactedFailed?.mediaAssets[0]?.previewUrl).toBe('https://authorized.example.com/video-failed.mp4?Authorization=abc123');
    expect(compactedFailed?.mediaAssets[0]?.storageUrl).toBe('https://cdn.example.com/video-failed.mp4');
    expect(compactedPublished?.mediaAssets[0]?.previewUrl).toBe('https://authorized.example.com/video-failed.mp4?Authorization=abc123');
    expect(compactedPublished?.mediaAssets[0]?.storageUrl).toBe('https://cdn.example.com/video-failed.mp4');
  });

  it('prefers stable storage URLs over expiring authorized preview URLs for rendered previews', () => {
    const asset: ComposeMediaAsset = {
      ...buildVideoAsset('video-rendered', 95),
      previewUrl: 'https://authorized.example.com/video-rendered.mp4?Authorization=expired-token',
      storageUrl: 'https://cdn.example.com/video-rendered.mp4',
    };

    expect(getComposeAssetPreviewUrl(asset)).toBe('https://cdn.example.com/video-rendered.mp4');
  });

  it('rehydrates legacy Backblaze preview-only assets with a stable raw storage URL', () => {
    const authorizedBackblazeUrl = 'https://f005.backblazeb2.com/file/screndly-bucket/compose/videos/video-old.mp4?Authorization=expired-token';

    const normalized = normalizeComposeItem({
      id: 'legacy-video',
      title: 'Legacy video',
      status: 'failed',
      mediaAssets: [
        {
          ...buildVideoAsset('video-old', 90),
          previewUrl: authorizedBackblazeUrl,
          storageUrl: authorizedBackblazeUrl,
        },
      ],
      platforms: ['facebook_feed'],
      sharedCaption: 'Caption',
      platformFields: {},
      createdAt: '2026-04-09T10:00:00.000Z',
      updatedAt: '2026-04-09T10:00:00.000Z',
    });

    expect(normalized.mediaAssets[0]?.storageUrl).toBe(
      'https://f005.backblazeb2.com/file/screndly-bucket/compose/videos/video-old.mp4',
    );
    expect(getComposeAssetPreviewUrl(normalized.mediaAssets[0])).toBe(
      'https://f005.backblazeb2.com/file/screndly-bucket/compose/videos/video-old.mp4',
    );
  });
});
