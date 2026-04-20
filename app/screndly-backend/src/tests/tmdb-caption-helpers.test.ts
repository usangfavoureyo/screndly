import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnniversaryPromptGuardrail,
  buildDeterministicTMDbCaption,
  hasBrokenTMDbCaptionFragment,
  sanitizeTMDbCaption,
} from '../services/tmdb-caption-helpers';

test('sanitizeTMDbCaption rejects orphan trailing fragments like Originally.', () => {
  const result = sanitizeTMDbCaption(`'Mrs. Davis' premiered 3 years ago today.\n\nOriginally.`);

  assert.equal(result.isValid, false);
  assert.equal(result.issue, 'orphan_fragment');
});

test('buildDeterministicTMDbCaption produces a one-or-two paragraph anniversary caption', () => {
  const caption = buildDeterministicTMDbCaption({
    title: 'Dead Ringers',
    mediaType: 'tv',
    temporalTag: 'anniversary',
    timingMode: 'anniversary_today',
    anniversaryYears: 3,
    cast: ['Rachel Weisz', 'Britne Oldford', 'Poppy Liu'],
  });

  assert.equal(
    caption,
    `'Dead Ringers' premiered 3 years ago today.\n\nStarring Rachel Weisz, Britne Oldford, Poppy Liu.`,
  );
});

test('hasBrokenTMDbCaptionFragment detects vague dangling single-line fragments', () => {
  assert.equal(hasBrokenTMDbCaptionFragment(`'Show' premiered 3 years ago today.\n\nStreaming.`), true);
  assert.equal(hasBrokenTMDbCaptionFragment(`'Show' premiered 3 years ago today.`), false);
});

test('buildAnniversaryPromptGuardrail appends explicit anti-fragment rules', () => {
  const prompt = buildAnniversaryPromptGuardrail('Base prompt.');

  assert.match(prompt, /Never output sentence fragments/i);
  assert.match(prompt, /Never use Originally unless followed by grounded information/i);
});
