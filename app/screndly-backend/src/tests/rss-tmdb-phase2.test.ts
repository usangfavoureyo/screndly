import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTMDbSearchPasses,
  buildTmdbLookupCandidateFromInput,
  normalizeTMDbLookupTitle,
  type StructuredRSSTMDbSelectionInput,
} from '../services/rss-tmdb-image-selection.service';

function makeInput(overrides: Partial<StructuredRSSTMDbSelectionInput> = {}): StructuredRSSTMDbSelectionInput {
  return {
    primarySubject: {
      name: 'The Matrix Resurrections',
      type: 'movie',
    },
    visualSubject: 'The Matrix Resurrections',
    imageIntent: 'backdrop',
    targetFormat: 'movie',
    contextProject: 'The Matrix Resurrections',
    requiredContextTerms: ['Warner Bros.'],
    relevantStudios: ['Warner Bros.'],
    queries: ["First trailer released for 'The Matrix Resurrections'"],
    limit: 1,
    ...overrides,
  };
}

test('RSS TMDb Phase 2: title normalization strips editorial noise', () => {
  const normalized = normalizeTMDbLookupTitle("EXCLUSIVE: First look trailer for 'The Matrix Resurrections' major update");

  assert.equal(normalized, "'The Matrix Resurrections'");
});

test('RSS TMDb Phase 2: lookup candidate prefers cleaned project title over noisy query text', () => {
  const candidate = buildTmdbLookupCandidateFromInput(makeInput({
    primarySubject: {
      name: 'movie',
      type: 'general',
    },
    contextProject: "Marvel finally confirms what happened to a missing character after seven years",
    visualSubject: 'Daredevil: Born Again',
    queries: ['Marvel finally confirms what happened to a missing character after seven years', 'Daredevil: Born Again'],
    requiredContextTerms: ['Bullseye', 'MCU'],
    targetFormat: 'series',
  }));

  assert.equal(candidate.media_type_hint, 'tv');
  assert.equal(candidate.primary_title, 'Daredevil: Born Again');
  assert.ok(candidate.alternate_titles?.includes('Marvel what happened to a missing character after seven years'));
});

test('RSS TMDb Phase 2: search passes include exact, year, stripped, and cross-check stages', () => {
  const passes = buildTMDbSearchPasses({
    media_type_hint: 'tv',
    primary_title: 'House of the Dragon: Season 3',
    alternate_titles: ['HOTD'],
    release_year: 2026,
  });

  assert.deepEqual(passes.map((pass) => pass.label), [
    'exact_title',
    'title_with_year',
    'stripped_title',
    'media_type_cross_check',
    'alternate_title',
  ]);
  assert.equal(passes[1]?.query, 'House of the Dragon: Season 3 2026');
  assert.deepEqual(passes[3]?.mediaTypes, ['tv', 'movie']);
  assert.equal(passes[4]?.query, 'HOTD');
});
