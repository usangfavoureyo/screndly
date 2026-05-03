import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTMDbPublishImages, resolveTMDbPublishImages } from '../services/tmdb-publish-image-selection';

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

test('renders logo slot into a publish-ready logo card while keeping separate TMDb assets', async () => {
  const result = await resolveTMDbPublishImages({
    imageUrl: 'https://example.com/backdrop.jpg',
    imageType: 'backdrop',
    imageUrls: ['https://example.com/backdrop.jpg', 'https://example.com/tmdb-logo.png'],
    imageTypes: ['backdrop', 'logo'],
  }, {
    renderLogoCard: async (sourceUrl) => `https://example.com/rendered?source=${encodeURIComponent(sourceUrl)}`,
  });

  assert.deepEqual(result.imageUrls, [
    'https://example.com/backdrop.jpg',
    'https://example.com/rendered?source=https%3A%2F%2Fexample.com%2Ftmdb-logo.png',
  ]);
  assert.deepEqual(result.imageTypes, ['backdrop', 'logo']);
  assert.equal(result.imageUrl, 'https://example.com/backdrop.jpg');
});

test('infers missing logo image types from prepared TMDb logo URLs', async () => {
  const result = await resolveTMDbPublishImages({
    imageUrl: 'https://example.com/backdrop.jpg',
    imageType: 'backdrop',
    imageUrls: [
      'https://example.com/backdrop.jpg',
      'https://f005.backblazeb2.com/file/Screndly/tmdb/logo-assets/example-trimmed-logo.png',
    ],
    imageTypes: ['backdrop'],
  }, {
    renderLogoCard: async (sourceUrl) => `https://example.com/rendered-logo-card.png?source=${encodeURIComponent(sourceUrl)}`,
  });

  assert.deepEqual(result.imageTypes, ['backdrop', 'logo']);
  assert.deepEqual(result.imageUrls, [
    'https://example.com/backdrop.jpg',
    'https://example.com/rendered-logo-card.png?source=https%3A%2F%2Ff005.backblazeb2.com%2Ffile%2FScrendly%2Ftmdb%2Flogo-assets%2Fexample-trimmed-logo.png',
  ]);
});

test('does not re-render an already prepared TMDb logo card asset', async () => {
  let renderCount = 0;

  const result = await resolveTMDbPublishImages({
    imageUrl: 'https://example.com/backdrop.jpg',
    imageType: 'backdrop',
    imageUrls: ['https://example.com/backdrop.jpg', 'https://cdn.example.com/rss/logo-cards/already-rendered.png'],
    imageTypes: ['backdrop', 'logo'],
  }, {
    renderLogoCard: async (sourceUrl) => {
      renderCount += 1;
      return sourceUrl;
    },
  });

  assert.equal(renderCount, 0);
  assert.deepEqual(result.imageUrls, [
    'https://example.com/backdrop.jpg',
    'https://cdn.example.com/rss/logo-cards/already-rendered.png',
  ]);
});
