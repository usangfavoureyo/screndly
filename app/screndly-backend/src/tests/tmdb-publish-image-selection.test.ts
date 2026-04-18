import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTMDbPublishImages } from '../services/tmdb-publish-image-selection';

test('preserves separate backdrop and logo assets for TMDb publish payloads', () => {
  const result = normalizeTMDbPublishImages({
    imageUrl: 'https://example.com/backdrop.jpg',
    imageType: 'backdrop',
    imageUrls: ['https://example.com/backdrop.jpg', 'https://example.com/logo.png'],
    imageTypes: ['backdrop', 'logo'],
  });

  assert.deepEqual(result.imageUrls, [
    'https://example.com/backdrop.jpg',
    'https://example.com/logo.png',
  ]);
  assert.deepEqual(result.imageTypes, ['backdrop', 'logo']);
  assert.equal(result.imageUrl, 'https://example.com/backdrop.jpg');
  assert.equal(result.imageType, 'backdrop');
});

test('falls back to single image payload when only imageUrl exists', () => {
  const result = normalizeTMDbPublishImages({
    imageUrl: 'https://example.com/poster.jpg',
    imageType: 'poster',
  });

  assert.deepEqual(result.imageUrls, ['https://example.com/poster.jpg']);
  assert.deepEqual(result.imageTypes, ['poster']);
  assert.equal(result.imageUrl, 'https://example.com/poster.jpg');
  assert.equal(result.imageType, 'poster');
});
