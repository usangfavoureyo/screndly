import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultComposeIntentResult,
  coerceComposePlaylistSelection,
} from '../services/ai.service';

test('classifies metadata-heavy input as direct post generation', () => {
  const result = buildDefaultComposeIntentResult(
    'This summer, fear takes hold. Cape Fear premieres June 5 on Apple TV+ starring Javier Bardem and Amy Adams.',
  );

  assert.equal(result.intent, 'post_generation');
  assert.equal(result.outputMode, 'post_fields');
  assert.equal(result.directFieldFillAllowed, true);
  assert.equal(result.containsMetadata, true);
});

test('classifies standalone review requests as preview-only', () => {
  const result = buildDefaultComposeIntentResult('Write me a review of The Matrix');

  assert.equal(result.intent, 'review_generation');
  assert.equal(result.outputMode, 'preview_only');
  assert.equal(result.directFieldFillAllowed, false);
  assert.equal(result.detectedTitle, 'The Matrix');
});

test('classifies short-form review requests as direct post fields', () => {
  const result = buildDefaultComposeIntentResult('Give me a review for The Matrix for 60 seconds video');

  assert.equal(result.intent, 'review_generation');
  assert.equal(result.outputMode, 'post_fields');
  assert.equal(result.format, 'short_form_video');
  assert.equal(result.durationSeconds, 60);
  assert.equal(result.directFieldFillAllowed, true);
});

test('matches exact playlist ids and falls back to titles only from real playlists', () => {
  const availablePlaylists = [
    { id: 'playlist-1', title: 'Movie Reviews' },
    { id: 'playlist-2', title: 'TV Trailers' },
  ];

  const exact = coerceComposePlaylistSelection(
    { playlistId: 'playlist-1', playlistName: 'Anything', reason: 'Exact', confidence: 0.9 },
    availablePlaylists,
  );
  assert.equal(exact.playlistId, 'playlist-1');

  const byTitle = coerceComposePlaylistSelection(
    { playlistId: null, playlistName: 'TV Trailers', reason: 'Title match', confidence: 0.7 },
    availablePlaylists,
  );
  assert.equal(byTitle.playlistId, 'playlist-2');

  const invalid = coerceComposePlaylistSelection(
    { playlistId: 'hallucinated', playlistName: 'Fake Playlist', reason: 'Bad', confidence: 0.8 },
    availablePlaylists,
  );
  assert.equal(invalid.playlistId, null);
});
