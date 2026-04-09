import test from 'node:test';
import assert from 'node:assert/strict';
import { validateScheduledComposeItem } from '../services/compose.service';

function buildBaseItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'compose-story-item',
    title: 'Story post',
    status: 'scheduled',
    sharedCaption: 'Story caption',
    platformFields: {},
    createdAt: '2026-04-09T10:00:00.000Z',
    updatedAt: '2026-04-09T10:00:00.000Z',
    platforms: ['instagram_stories'],
    mediaAssets: [],
    ...overrides,
  };
}

function buildVideoAsset(id: string, durationSeconds: number) {
  return {
    id,
    kind: 'video',
    fileName: `${id}.mp4`,
    mimeType: 'video/mp4',
    size: 1024,
    order: 0,
    durationSeconds,
    storageUrl: `https://cdn.example.com/${id}.mp4`,
    uploadStatus: 'uploaded',
  };
}

function buildImageAsset(id: string) {
  return {
    id,
    kind: 'image',
    fileName: `${id}.jpg`,
    mimeType: 'image/jpeg',
    size: 1024,
    order: 0,
    storageUrl: `https://cdn.example.com/${id}.jpg`,
    uploadStatus: 'uploaded',
  };
}

test('allows multi-video story scheduling when split clips stay within four items', () => {
  const item = buildBaseItem({
    platforms: ['instagram_stories', 'facebook_stories'],
    mediaAssets: [
      buildVideoAsset('video-1', 120),
      buildVideoAsset('video-2', 30),
    ],
  });

  assert.equal(validateScheduledComposeItem(item), undefined);
});

test('blocks story scheduling when splitting would exceed four items', () => {
  const item = buildBaseItem({
    platforms: ['instagram_stories'],
    mediaAssets: [buildVideoAsset('video-1', 301)],
  });

  assert.equal(
    validateScheduledComposeItem(item),
    'Instagram Stories and Facebook Stories support up to 4 story items after splitting videos longer than 60 seconds.',
  );
});

test('allows multiple story images for Instagram Stories and Facebook Stories', () => {
  const item = buildBaseItem({
    platforms: ['instagram_stories', 'facebook_stories'],
    mediaAssets: [
      buildImageAsset('image-1'),
      buildImageAsset('image-2'),
      buildImageAsset('image-3'),
    ],
  });

  assert.equal(validateScheduledComposeItem(item), undefined);
});
