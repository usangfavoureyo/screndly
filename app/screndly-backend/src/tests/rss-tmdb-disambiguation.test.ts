import test from 'node:test';
import assert from 'node:assert/strict';
import { __rssTmdbDisambiguationTestUtils } from '../services/rss-tmdb-image-selection.service';

const { resolveCanonicalTMDbEntity } = __rssTmdbDisambiguationTestUtils;

test('disambiguates Harry Potter HBO series from films and books', () => {
  const resolved = resolveCanonicalTMDbEntity({
    primarySubject: { name: 'Harry Potter', type: 'franchise' },
    visualSubject: 'Harry Potter',
    secondarySubjects: ['HBO', 'Warner Bros'],
    imageIntent: 'backdrop',
    targetFormat: 'series',
    contextProject: 'Harry Potter',
    requiredContextTerms: ['HBO', 'series'],
    relevantStudios: ['HBO', 'Warner Bros'],
    queries: ['Harry Potter HBO series'],
    limit: 1,
  });

  assert.equal(resolved.specificTitle, 'Harry Potter');
  assert.equal(resolved.mediaType, 'tv');
  assert.equal(resolved.tmdbType, 'tv');
  assert.equal(resolved.tmdbQuery, 'Harry Potter HBO series');
});

test('disambiguates Daredevil MCU context to Born Again', () => {
  const resolved = resolveCanonicalTMDbEntity({
    primarySubject: { name: 'Daredevil', type: 'franchise' },
    visualSubject: 'Daredevil',
    secondarySubjects: ['Bullseye'],
    imageIntent: 'backdrop',
    targetFormat: 'series',
    contextProject: 'Daredevil',
    requiredContextTerms: ['MCU', 'Disney+', 'Born Again'],
    relevantStudios: ['Marvel Studios', 'Disney+'],
    queries: ['Daredevil returns in the MCU'],
    limit: 1,
  });

  assert.equal(resolved.specificTitle, 'Daredevil: Born Again');
  assert.equal(resolved.tmdbQuery, 'Daredevil Born Again');
  assert.equal(resolved.tmdbType, 'tv');
});

test('disambiguates Matrix article to Resurrections when recent-film clues exist', () => {
  const resolved = resolveCanonicalTMDbEntity({
    primarySubject: { name: 'The Matrix', type: 'franchise' },
    visualSubject: 'The Matrix',
    secondarySubjects: ['Keanu Reeves'],
    imageIntent: 'still',
    targetFormat: 'movie',
    contextProject: 'The Matrix',
    requiredContextTerms: ['Keanu Reeves', 'Lana Wachowski', 'recent film'],
    relevantStudios: ['Warner Bros'],
    queries: ['Keanu Reeves addresses return to The Matrix Resurrections'],
    limit: 1,
  });

  assert.equal(resolved.specificTitle, 'The Matrix Resurrections');
  assert.equal(resolved.tmdbType, 'movie');
});

test('disambiguates Wolverine return to Deadpool & Wolverine with project clues', () => {
  const resolved = resolveCanonicalTMDbEntity({
    primarySubject: { name: 'Wolverine', type: 'character' },
    visualSubject: 'Wolverine',
    secondarySubjects: ['Hugh Jackman'],
    imageIntent: 'character_still',
    targetFormat: 'movie',
    contextProject: 'Wolverine',
    requiredContextTerms: ['Hugh Jackman', 'Deadpool & Wolverine', '2024'],
    relevantStudios: ['Marvel Studios'],
    queries: ['Hugh Jackman returns as Wolverine in Deadpool & Wolverine'],
    limit: 1,
  });

  assert.equal(resolved.specificTitle, 'Deadpool & Wolverine');
  assert.equal(resolved.tmdbQuery, 'Deadpool & Wolverine');
  assert.equal(resolved.tmdbType, 'movie');
});

test('falls back to franchise-level query when exact Matrix project is unresolved', () => {
  const resolved = resolveCanonicalTMDbEntity({
    primarySubject: { name: 'The Matrix', type: 'franchise' },
    visualSubject: 'The Matrix',
    secondarySubjects: [],
    imageIntent: 'backdrop',
    targetFormat: 'general',
    contextProject: null,
    requiredContextTerms: ['new film in development'],
    relevantStudios: ['Warner Bros'],
    queries: ['New Matrix film in development'],
    limit: 1,
  });

  assert.equal(resolved.mediaType, 'franchise');
  assert.equal(resolved.tmdbQuery, 'The Matrix franchise');
});

