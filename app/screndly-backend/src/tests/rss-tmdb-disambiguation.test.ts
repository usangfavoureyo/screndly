import test from 'node:test';
import assert from 'node:assert/strict';
import { __rssTmdbDisambiguationTestUtils } from '../services/rss-tmdb-image-selection.service';

const {
  buildInstallmentFallbackQueries,
  resolveCanonicalTMDbEntity,
  titleMatchesProjectContext,
  titleCandidateMatchesResolvedContext,
} = __rssTmdbDisambiguationTestUtils;

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

test('requires an explicit project match instead of accepting a studio-only TMDb title', () => {
  const input = {
    primarySubject: { name: 'Jeff Kinney', type: 'actor' as const },
    visualSubject: 'Jeff Kinney',
    secondarySubjects: [],
    imageIntent: 'still' as const,
    targetFormat: 'movie' as const,
    contextProject: 'Diary of a Wimpy Kid',
    requiredContextTerms: ['Disney', 'film'],
    relevantStudios: ['Disney'],
    queries: ['Jeff Kinney confirms Disney is making the next Diary of a Wimpy Kid film'],
    limit: 1,
  };

  assert.equal(
    titleMatchesProjectContext(
      input,
      'Walt Disney Treasures: The Chronological Donald, Volume One',
      'A Disney home video collection featuring Donald Duck shorts.'
    ),
    false
  );
});

test('rejects cross-franchise TMDb titles that do not overlap the project anchor', () => {
  const input = {
    primarySubject: { name: 'Highlander', type: 'movie' as const },
    visualSubject: 'Highlander',
    secondarySubjects: ['Henry Cavill'],
    imageIntent: 'still' as const,
    targetFormat: 'movie' as const,
    contextProject: 'Highlander',
    requiredContextTerms: ['remake', 'Henry Cavill'],
    relevantStudios: ['Amazon MGM'],
    queries: ['Highlander remake star confirms a lot of decapitations'],
    limit: 1,
  };

  assert.equal(
    titleCandidateMatchesResolvedContext(
      'The Cat in the Hat Knows a Lot About That!',
      input,
    ),
    false
  );
});

test('accepts a TMDb title when it explicitly matches the context project', () => {
  const input = {
    primarySubject: { name: 'Jeff Kinney', type: 'actor' as const },
    visualSubject: 'Jeff Kinney',
    secondarySubjects: [],
    imageIntent: 'still' as const,
    targetFormat: 'movie' as const,
    contextProject: 'Diary of a Wimpy Kid',
    requiredContextTerms: ['Disney', 'film'],
    relevantStudios: ['Disney'],
    queries: ['Jeff Kinney confirms Disney is making the next Diary of a Wimpy Kid film'],
    limit: 1,
  };

  assert.equal(
    titleMatchesProjectContext(
      input,
      'Diary of a Wimpy Kid',
      'A family comedy based on the book series.'
    ),
    true
  );
});

test('builds prior installment fallback queries for numbered sequels and seasons', () => {
  assert.deepEqual(
    buildInstallmentFallbackQueries('Extraction 3', 'movie'),
    ['Extraction 2']
  );

  assert.deepEqual(
    buildInstallmentFallbackQueries('The Last of Us Season 5', 'tv'),
    ['The Last of Us', 'The Last of Us Season 4']
  );
});

test('falls back from Man of Tomorrow sequel context to Superman prior-installment imagery', () => {
  const resolved = resolveCanonicalTMDbEntity({
    primarySubject: { name: 'James Gunn', type: 'actor' },
    visualSubject: 'James Gunn',
    secondarySubjects: ['Superman'],
    imageIntent: 'person_portrait',
    targetFormat: 'movie',
    contextProject: 'Superman',
    requiredContextTerms: ['Man of Tomorrow', 'David Corenswet', 'James Gunn', 'Nicholas Hoult'],
    relevantStudios: ['DC Studios'],
    queries: ['James Gunn debunks Man of Tomorrow casting report'],
    limit: 2,
  });

  assert.equal(resolved.specificTitle, 'Superman');
  assert.equal(resolved.tmdbType, 'movie');
  assert.equal(resolved.tmdbQuery, 'Superman 2025');
  assert.match(resolved.ambiguityFlags.join(','), /upcoming_sequel_fallback_to_prior_installment/);
});

test('rejects unrelated person-linked titles when a project casting anchor exists', () => {
  const input = {
    primarySubject: { name: 'Ray Gunn', type: 'movie' as const },
    canonicalEntity: {
      primarySubject: 'Ray Gunn',
      mediaTitle: 'Ray Gunn',
      entityType: 'movie' as const,
      eventType: 'casting',
      namedPeople: ['Scarlett Johansson', 'Sam Rockwell', 'Tom Waits'],
      namedCharacters: [],
      allowedEntities: ['Ray Gunn', 'Scarlett Johansson', 'Sam Rockwell', 'Tom Waits'],
      confidence: 0.95,
      ambiguityFlags: ['casting_project_anchor_override'],
    },
    visualSubject: 'Ray Gunn',
    secondarySubjects: ['Scarlett Johansson', 'Sam Rockwell', 'Tom Waits'],
    imageIntent: 'still' as const,
    targetFormat: 'movie' as const,
    contextProject: 'Ray Gunn',
    requiredContextTerms: ['Brad Bird', 'Skydance Animation', 'voice cast'],
    relevantStudios: ['Skydance Animation'],
    queries: ["Scarlett Johansson, Sam Rockwell and Tom Waits Join Brad Bird's Ray Gunn Voice Cast"],
    limit: 1,
  };

  assert.equal(titleCandidateMatchesResolvedContext('Chris Grace: As Scarlett Johansson', input), false);
  assert.equal(titleCandidateMatchesResolvedContext('Ray Gunn', input), true);
});
