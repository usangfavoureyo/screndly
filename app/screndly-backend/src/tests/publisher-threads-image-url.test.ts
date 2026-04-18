import test from 'node:test';
import assert from 'node:assert/strict';
import { publisherService } from '../services/publisher.service';

test('threads-compatible hosted image URLs drop Backblaze Authorization query tokens', () => {
  const sanitized = (publisherService as any).toThreadsCompatibleImageUrl(
    'https://f004.backblazeb2.com/file/Screndly/social-publish/meta-images/test.jpg?Authorization=secret-token&foo=bar',
  );

  assert.equal(
    sanitized,
    'https://f004.backblazeb2.com/file/Screndly/social-publish/meta-images/test.jpg?foo=bar',
  );
});

test('threads-compatible image URLs keep non-Backblaze URLs unchanged', () => {
  const sanitized = (publisherService as any).toThreadsCompatibleImageUrl(
    'https://image.tmdb.org/t/p/original/example.jpg',
  );

  assert.equal(sanitized, 'https://image.tmdb.org/t/p/original/example.jpg');
});
