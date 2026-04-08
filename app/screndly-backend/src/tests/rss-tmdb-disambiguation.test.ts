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

test('does not treat Gen Z demographics as a TMDb title entity', () => {
  const resolved = resolveCanonicalTMDbEntity({
    primarySubject: { name: 'Gen Z', type: 'general' },
    visualSubject: 'Gen Z',
    secondarySubjects: [],
    imageIntent: 'backdrop',
    targetFormat: 'general',
    contextProject: null,
    requiredContextTerms: ['box office', 'study'],
    relevantStudios: [],
    queries: ['Gen Z box office study'],
    limit: 1,
  });

  assert.equal(resolved.tmdbQuery, '');
  assert.match(resolved.ambiguityFlags.join(','), /generic_demographic_not_a_tmdb_entity/);
});

test('allows Gen Z to remain a title candidate when series context is explicit', () => {
  const resolved = resolveCanonicalTMDbEntity({
    primarySubject: { name: 'Gen Z', type: 'tv_show' },
    visualSubject: 'Gen Z',
    secondarySubjects: [],
    imageIntent: 'backdrop',
    targetFormat: 'series',
    contextProject: 'Gen Z',
    requiredContextTerms: ['series', 'season 2', 'cast'],
    relevantStudios: ['HBO'],
    queries: ['Gen Z series season 2'],
    limit: 1,
  });

  assert.notEqual(resolved.tmdbQuery, '');
  assert.equal(/generic_demographic_not_a_tmdb_entity/.test(resolved.ambiguityFlags.join(',')), false);
});

test('allows Foundation to resolve as a TV entity when Apple TV+ series cues exist', () => {
  const resolved = resolveCanonicalTMDbEntity({
    primarySubject: { name: 'Foundation', type: 'tv_show' },
    visualSubject: 'Foundation',
    secondarySubjects: [],
    imageIntent: 'backdrop',
    targetFormat: 'series',
    contextProject: 'Foundation',
    requiredContextTerms: ['Apple TV+', 'series', 'season 3'],
    relevantStudios: ['Apple TV+'],
    queries: ['Foundation season 3 begins filming at Apple TV+'],
    limit: 1,
  });

  assert.equal(resolved.tmdbType, 'tv');
  assert.notEqual(resolved.tmdbQuery, '');
  assert.equal(/context_sensitive_term_not_a_tmdb_entity/.test(resolved.ambiguityFlags.join(',')), false);
});

test('allows Avatar to remain a movie entity in box office context', () => {
  const resolved = resolveCanonicalTMDbEntity({
    primarySubject: { name: 'Avatar', type: 'movie' },
    visualSubject: 'Avatar',
    secondarySubjects: [],
    imageIntent: 'poster',
    targetFormat: 'movie',
    contextProject: 'Avatar',
    requiredContextTerms: ['box office', 'James Cameron', 'theaters'],
    relevantStudios: ['Disney'],
    queries: ['Avatar remains a box office force in theaters'],
    limit: 1,
  });

  assert.equal(resolved.tmdbType, 'movie');
  assert.notEqual(resolved.tmdbQuery, '');
});

test('does not treat You as a TMDb title when context is ordinary language', () => {
  const resolved = resolveCanonicalTMDbEntity({
    primarySubject: { name: 'You', type: 'general' },
    visualSubject: 'You',
    secondarySubjects: [],
    imageIntent: 'backdrop',
    targetFormat: 'general',
    contextProject: null,
    requiredContextTerms: ['study', 'audience'],
    relevantStudios: [],
    queries: ['You are the audience studios want, study says'],
    limit: 1,
  });

  assert.equal(resolved.tmdbQuery, '');
  assert.match(resolved.ambiguityFlags.join(','), /context_sensitive_term_not_a_tmdb_entity/);
});
