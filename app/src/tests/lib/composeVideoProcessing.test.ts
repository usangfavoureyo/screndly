import { describe, expect, it } from 'vitest';
import {
  buildComposeAssetSignature,
  getThreadsXCropSourceUrl,
  getVideoUrlForComposePlatform,
  isThreadsXCropVariantReady,
  shouldOfferThreadsXCrop,
} from '../../lib/create/composeVideoProcessing';
import type { ComposeItem, ComposeMediaAsset } from '../../types/compose';

function buildVideoAsset(overrides: Partial<ComposeMediaAsset> = {}): ComposeMediaAsset {
  return {
    id: 'video-1',
    kind: 'video',
    fileName: 'trailer.mp4',
    mimeType: 'video/mp4',
    size: 1024,
    order: 0,
    storageUrl: 'https://cdn.example.com/trailer.mp4',
    previewUrl: 'https://cdn.example.com/trailer-preview.mp4',
    aspectRatioValue: 9 / 16,
    aspectRatioLabel: '9:16',
    ...overrides,
  };
}

function buildItem(asset: ComposeMediaAsset, focusYPercent = 50): ComposeItem {
  return {
    id: 'post-1',
    title: 'Trailer',
    status: 'draft',
    mediaAssets: [asset],
    platforms: ['threads', 'x'],
    sharedCaption: '',
    platformFields: {
      videoProcessing: {
        cropMode: 'threads_x_3_4',
        focusYPercent,
        threadsXCrop: {
          fileName: 'trailer-3x4.mp4',
          mimeType: 'video/mp4',
          size: 2048,
          storageUrl: 'https://cdn.example.com/trailer-3x4.mp4',
          sourceAssetId: asset.id,
          sourceSignature: buildComposeAssetSignature(asset),
          focusYPercent,
          aspectRatioLabel: '3:4',
          uploadStatus: 'uploaded',
        },
      },
    },
    createdAt: '2026-03-26T09:00:00.000Z',
    updatedAt: '2026-03-26T09:00:00.000Z',
  };
}

describe('composeVideoProcessing', () => {
  it('offers the Threads/X crop only for 9:16 single-video targets', () => {
    expect(shouldOfferThreadsXCrop(buildVideoAsset(), ['threads'])).toBe(true);
    expect(shouldOfferThreadsXCrop(buildVideoAsset({ aspectRatioLabel: '16:9', aspectRatioValue: 16 / 9 }), ['threads'])).toBe(false);
    expect(shouldOfferThreadsXCrop(buildVideoAsset(), ['facebook_feed'])).toBe(false);
  });

  it('marks the crop variant stale when the focus changes', () => {
    const asset = buildVideoAsset();
    const item = buildItem(asset, 55);

    expect(isThreadsXCropVariantReady(item, asset)).toBe(true);

    const staleItem: ComposeItem = {
      ...item,
      platformFields: {
        ...item.platformFields,
        videoProcessing: {
          ...item.platformFields.videoProcessing,
          focusYPercent: 35,
          threadsXCrop: item.platformFields.videoProcessing?.threadsXCrop,
        },
      },
    };

    expect(isThreadsXCropVariantReady(staleItem, asset)).toBe(false);
  });

  it('uses the 3:4 variant only for Threads and X', () => {
    const asset = buildVideoAsset();
    const item = buildItem(asset);

    expect(getVideoUrlForComposePlatform(item, 'threads')).toBe('https://cdn.example.com/trailer-3x4.mp4');
    expect(getVideoUrlForComposePlatform(item, 'x')).toBe('https://cdn.example.com/trailer-3x4.mp4');
    expect(getVideoUrlForComposePlatform(item, 'facebook_feed')).toBe('https://cdn.example.com/trailer-preview.mp4');
  });

  it('prefers the browser-safe preview url over the raw storage url for crop generation', () => {
    const asset = buildVideoAsset({
      storageUrl: 'https://cdn.example.com/trailer.mp4',
      previewUrl: 'https://cdn.example.com/trailer-authorized.mp4?token=abc123',
    });

    expect(getThreadsXCropSourceUrl(asset)).toBe('https://cdn.example.com/trailer-authorized.mp4?token=abc123');
  });

  it('prefers the local preview url when it is still available in the browser', () => {
    const asset = buildVideoAsset({
      storageUrl: 'https://cdn.example.com/trailer.mp4',
      previewUrl: 'blob:https://app.example.com/local-preview',
    });

    expect(getThreadsXCropSourceUrl(asset)).toBe('blob:https://app.example.com/local-preview');
  });

  it('falls back to preview url when no uploaded source video exists yet', () => {
    const asset = buildVideoAsset({
      storageUrl: undefined,
      previewUrl: 'blob:https://app.example.com/local-preview',
    });

    expect(getThreadsXCropSourceUrl(asset)).toBe('blob:https://app.example.com/local-preview');
  });

  it('does not treat an in-flight crop upload as ready', () => {
    const asset = buildVideoAsset();
    const item: ComposeItem = {
      ...buildItem(asset),
      platformFields: {
        videoProcessing: {
          cropMode: 'threads_x_3_4',
          focusYPercent: 50,
          threadsXCrop: {
            fileName: 'trailer-3x4.mp4',
            mimeType: 'video/mp4',
            size: 2048,
            storageUrl: 'https://cdn.example.com/trailer-3x4.mp4',
            sourceAssetId: asset.id,
            sourceSignature: buildComposeAssetSignature(asset),
            focusYPercent: 50,
            aspectRatioLabel: '3:4',
            uploadStatus: 'uploading',
          },
        },
      },
    };

    expect(isThreadsXCropVariantReady(item, asset)).toBe(false);
  });
});
