import test from 'node:test';
import assert from 'node:assert/strict';
import { publisherService } from '../services/publisher.service';

test('threads-compatible hosted image URLs preserve Backblaze Authorization query tokens', () => {
  const sanitized = (publisherService as any).toThreadsCompatibleImageUrl(
    'https://f004.backblazeb2.com/file/Screndly/social-publish/meta-images/test.jpg?Authorization=secret-token&foo=bar',
  );

  assert.equal(
    sanitized,
    'https://f004.backblazeb2.com/file/Screndly/social-publish/meta-images/test.jpg?Authorization=secret-token&foo=bar',
  );
});

test('threads-compatible image URLs keep non-Backblaze URLs unchanged', () => {
  const sanitized = (publisherService as any).toThreadsCompatibleImageUrl(
    'https://image.tmdb.org/t/p/original/example.jpg',
  );

  assert.equal(sanitized, 'https://image.tmdb.org/t/p/original/example.jpg');
});

test('threads media failure formatter uses specific fetch diagnosis when Meta exposes media download failure', () => {
  const formatted = (publisherService as any).formatThreadsPublishFailureMessage({
    errorCode: 'THREADS_MEDIA_FETCH_FAILED',
    errorUserTitle: 'Media download failed',
    errorUserMessage: 'The media URI does not meet our requirements.',
    error: 'An unknown error occurred (code 1, subcode 2207052)',
  });

  assert.match(formatted, /Meta could not fetch the image/i);
  assert.match(formatted, /Media download failed/i);
  assert.match(formatted, /media URI does not meet our requirements/i);
});

test('threads media preflight formatter includes content-type failures', () => {
  const formatted = (publisherService as any).formatThreadsPublishFailureMessage({
    errorCode: 'THREADS_MEDIA_INVALID_CONTENT_TYPE',
    error: 'Threads media URL returned non-image content.',
    errorDetails: {
      contentType: 'text/html',
      httpStatus: 200,
    },
  });

  assert.match(formatted, /Content-Type text\/html/i);
  assert.match(formatted, /HTTP status 200/i);
});

test('threads media preflight formatter includes public reachability failures', () => {
  const formatted = (publisherService as any).formatThreadsPublishFailureMessage({
    errorCode: 'THREADS_MEDIA_URL_NOT_PUBLIC',
    error: 'preflight fetch failed (403)',
    errorDetails: {
      httpStatus: 403,
    },
  });

  assert.match(formatted, /not publicly reachable/i);
  assert.match(formatted, /HTTP status 403/i);
});

test('instagram failure formatter includes Meta diagnostics for generic failures', () => {
  const formatted = (publisherService as any).formatInstagramPublishFailureMessage({
    error: 'Meta API request failed',
    errorCode: '190',
    errorSubcode: '463',
    errorUserTitle: 'Session expired',
    errorUserMessage: 'Please re-authenticate your account.',
    fbtraceId: 'ABC123TRACE',
  });

  assert.match(formatted, /code 190/i);
  assert.match(formatted, /subcode 463/i);
  assert.match(formatted, /Session expired/i);
  assert.match(formatted, /re-authenticate/i);
  assert.match(formatted, /trace ABC123TRACE/i);
});

test('instagram failure formatter preserves specific non-generic message as-is', () => {
  const formatted = (publisherService as any).formatInstagramPublishFailureMessage({
    error: 'Instagram media processing timed out',
    errorCode: '2',
  });

  assert.equal(formatted, 'Instagram media processing timed out');
});
