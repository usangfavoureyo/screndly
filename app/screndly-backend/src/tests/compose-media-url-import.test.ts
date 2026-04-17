import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildComposeMediaDownloadOptions,
  detectComposeMediaUrlPlatform,
  normalizeComposeMediaUrlEntries,
} from '../services/compose-media-url-import.service';

test('detectComposeMediaUrlPlatform supports public YouTube URLs', () => {
  assert.equal(detectComposeMediaUrlPlatform('https://www.youtube.com/watch?v=abc123'), 'youtube');
  assert.equal(detectComposeMediaUrlPlatform('https://youtu.be/abc123'), 'youtube');
  assert.equal(detectComposeMediaUrlPlatform('https://www.youtube.com/shorts/abc123'), 'youtube');
});

test('detectComposeMediaUrlPlatform supports public Instagram URLs', () => {
  assert.equal(detectComposeMediaUrlPlatform('https://www.instagram.com/p/abc123/'), 'instagram');
  assert.equal(detectComposeMediaUrlPlatform('https://www.instagram.com/reel/abc123/'), 'instagram');
});

test('buildComposeMediaDownloadOptions caps YouTube video imports at 1080p mp4', () => {
  const options = buildComposeMediaDownloadOptions('youtube', 'video', '/tmp/asset.%(ext)s');

  assert.equal(options.output, '/tmp/asset.%(ext)s');
  assert.equal(options.mergeOutputFormat, 'mp4');
  assert.match(String(options.format), /height<=1080/);
  assert.match(String(options.format), /mp4/);
});

test('buildComposeMediaDownloadOptions uses best available Instagram media quality', () => {
  const videoOptions = buildComposeMediaDownloadOptions('instagram', 'video', '/tmp/video.%(ext)s');
  const imageOptions = buildComposeMediaDownloadOptions('instagram', 'image', '/tmp/image.%(ext)s');

  assert.equal(videoOptions.output, '/tmp/video.%(ext)s');
  assert.equal(videoOptions.format, 'best');
  assert.equal(videoOptions.mergeOutputFormat, 'mp4');
  assert.equal(imageOptions.output, '/tmp/image.%(ext)s');
  assert.equal(imageOptions.format, 'best');
});

test('normalizeComposeMediaUrlEntries expands Instagram carousel metadata into ordered media entries', () => {
  const entries = normalizeComposeMediaUrlEntries('https://www.instagram.com/p/test/', {
    title: 'Carousel',
    entries: [
      { id: 'img-1', title: 'Slide 1', ext: 'jpg', webpage_url: 'https://www.instagram.com/p/test/?img_index=1' },
      { id: 'vid-2', title: 'Slide 2', ext: 'mp4', webpage_url: 'https://www.instagram.com/p/test/?img_index=2' },
    ],
  });

  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => entry.kind), ['image', 'video']);
  assert.deepEqual(entries.map((entry) => entry.order), [0, 1]);
});
