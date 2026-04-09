import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __rssImageSelectionTestUtils,
  type RSSImageSelectionArticle,
} from '../services/rss-image-selection.service';

const { validateImageCandidate, guessPrimarySubject, isUnanchoredGeneralStory } = __rssImageSelectionTestUtils;
const { determineSmartImagePlan } = __rssImageSelectionTestUtils;

function buildAnalysis(article: RSSImageSelectionArticle) {
  return guessPrimarySubject(article);
}

test('rejects fan art from untrusted domains', () => {
  const analysis = buildAnalysis({
    title: "'House of the Dragon' Season 3 begins filming in the UK",
    description: "Production is underway on the HBO fantasy series.",
  });

  const result = validateImageCandidate({
    title: 'House of the Dragon fan art wallpaper by DeviantArt',
    imageUrl: 'https://images.deviantart.com/house-of-the-dragon-fanart.jpg',
    imageWidth: 1920,
    imageHeight: 1080,
    domain: 'deviantart.com',
    link: 'https://deviantart.com/example',
    source: 'openai_web_search',
  }, analysis);

  assert.equal(result.approved, false);
  assert.match(result.reason || '', /untrusted|fan|illustration/i);
});

test('rejects AI-generated imagery even when entity text matches', () => {
  const analysis = buildAnalysis({
    title: "Ryan Gosling joins Shawn Levy's upcoming Star Wars film",
    description: 'Ryan Gosling is attached to star in a new Star Wars project directed by Shawn Levy.',
  });

  const result = validateImageCandidate({
    title: 'Ryan Gosling AI generated Star Wars concept portrait',
    imageUrl: 'https://example.com/ryan-gosling-ai.jpg',
    imageWidth: 1600,
    imageHeight: 2000,
    domain: 'variety.com',
    link: 'https://variety.com/fake',
    source: 'openai_web_search',
  }, analysis);

  assert.equal(result.approved, false);
  assert.match(result.reason || '', /ai-generated/i);
});

test('rejects franchise-mismatched imagery for a specific show subject', () => {
  const analysis = buildAnalysis({
    title: "'House of the Dragon' Season 3 begins filming in the UK",
    description: 'The HBO series is now in production.',
  });

  const result = validateImageCandidate({
    title: 'Game of Thrones Season 1 official still',
    imageUrl: 'https://www.hbo.com/game-of-thrones/still.jpg',
    imageWidth: 1920,
    imageHeight: 1080,
    domain: 'hbo.com',
    link: 'https://www.hbo.com/game-of-thrones',
    source: 'serper',
  }, analysis);

  assert.equal(result.approved, false);
  assert.match(result.reason || '', /subject/i);
});

test('allows official animated promotional art for animated subjects', () => {
  const analysis = buildAnalysis({
    title: "First trailer released for Pixar's 'Toy Story 5'",
    description: 'Disney and Pixar have revealed the first trailer for the animated sequel.',
  });

  const result = validateImageCandidate({
    title: 'Toy Story 5 official promo art by Disney and Pixar',
    imageUrl: 'https://www.pixar.com/toy-story-5-official-art.jpg',
    imageWidth: 1800,
    imageHeight: 1012,
    domain: 'pixar.com',
    link: 'https://www.pixar.com/toy-story-5',
    source: 'openai_web_search',
  }, analysis);

  assert.equal(result.approved, true);
});

test('rejects illustrative art for non-animated live-action stories', () => {
  const analysis = buildAnalysis({
    title: "'The Last of Us' renewed for Season 3 by HBO",
    description: 'The live-action drama will return for another season.',
  });

  const result = validateImageCandidate({
    title: 'The Last of Us digital painting concept art official look',
    imageUrl: 'https://www.hbo.com/the-last-of-us-concept-art.jpg',
    imageWidth: 1800,
    imageHeight: 1012,
    domain: 'hbo.com',
    link: 'https://www.hbo.com/the-last-of-us',
    source: 'serper',
  }, analysis);

  assert.equal(result.approved, false);
  assert.match(result.reason || '', /illustration/i);
});

test('rejects title art for unanchored generic box office or industry stories', () => {
  const analysis = buildAnalysis({
    title: 'Gen Z Goes to the Movies! Younger Audiences Are Driving the Box Office, Study Shows',
    description: 'A new study tied to the box office says Gen Z is now the most active moviegoing demographic.',
  });

  assert.equal(isUnanchoredGeneralStory(analysis), true);

  const result = validateImageCandidate({
    title: 'Bei gen zong de xiao nu official poster',
    imageUrl: 'https://image.tmdb.org/t/p/w1280/example.jpg',
    imageWidth: 1280,
    imageHeight: 720,
    domain: 'themoviedb.org',
    link: 'https://www.themoviedb.org/movie/example',
    source: 'serper',
  }, analysis);

  assert.equal(result.approved, false);
  assert.match(result.reason || '', /generic industry story/i);
});

test('treats Foundation as a project when explicit TV-series context exists', () => {
  const analysis = buildAnalysis({
    title: "'Foundation' Season 3 begins filming at Apple TV+",
    description: 'Production is underway on the Apple TV+ sci-fi series.',
  });

  assert.equal(analysis.primarySubject.name, 'Foundation');
  assert.equal(analysis.primarySubject.type, 'tv_show');
  assert.equal(isUnanchoredGeneralStory(analysis), false);
});

test('treats The Bear as a project when renewal context is explicit', () => {
  const analysis = buildAnalysis({
    title: "'The Bear' renewed for Season 5 by FX",
    description: 'The FX series will return for another season.',
  });

  assert.equal(analysis.primarySubject.name, 'The Bear');
  assert.equal(analysis.primarySubject.type, 'tv_show');
  assert.equal(isUnanchoredGeneralStory(analysis), false);
});

test('prefers actor portrait plus project logo for casting stories with a strong person and title anchor', () => {
  const article = {
    title: "'Bridgerton' adds Tega Alexander as Christopher, Lord Anderson's son, for Season 5",
    description:
      "Per Netflix's Tudum, the Shonda Rhimes-produced period drama also cast Jacqueline Boatswain as Helen.",
  } satisfies RSSImageSelectionArticle;

  const analysis = buildAnalysis(article);
  const plan = determineSmartImagePlan(article, analysis);

  assert.equal(analysis.contextType, 'casting');
  assert.equal(plan.mode, 'dual');
  assert.equal(plan.useTwoImages, true);
  assert.equal(plan.primary.subject, 'Tega Alexander');
  assert.equal(plan.primary.intent, 'person_portrait');
  assert.deepEqual(plan.primaryAssetPreferences, ['profile', 'logo', 'backdrop']);
  assert.equal(plan.secondary?.subject, 'Bridgerton');
  assert.equal(plan.secondary?.intent, 'logo');
  assert.deepEqual(plan.secondaryAssetPreferences, ['logo', 'backdrop']);
});

test('treats executive departure stories as person-led and pairs portrait with company logo', () => {
  const article = {
    title: "Jeff Shell Officially Out as Paramount's President",
    description:
      'Company says exec is stepping down to focus on lawsuit filed against him. Jeff Shell is officially departing his role as president of Paramount Skydance.',
  } satisfies RSSImageSelectionArticle;

  const analysis = buildAnalysis(article);
  const plan = determineSmartImagePlan(article, analysis);

  assert.equal(analysis.primarySubject.name, 'Jeff Shell');
  assert.equal(analysis.primarySubject.type, 'actor');
  assert.equal(analysis.contextType, 'industry');
  assert.equal(plan.useTwoImages, true);
  assert.equal(plan.primary.subject, 'Jeff Shell');
  assert.equal(plan.primary.intent, 'person_portrait');
  assert.equal(plan.secondary?.intent, 'logo');
  assert.match(plan.secondary?.subject || '', /Paramount/i);
});

test('treats corporate merger stories as industry/company context instead of title-led project context', () => {
  const article = {
    title: "Leading Shareholder Advisor ISS Backs WBD-Paramount Merger But Slams David Zaslav's 'Windfall' Payout",
    description:
      'Institutional Shareholder Services backed the WBD-Paramount merger while criticizing David Zaslav compensation.',
  } satisfies RSSImageSelectionArticle;

  const analysis = buildAnalysis(article);
  const plan = determineSmartImagePlan(article, analysis);

  assert.equal(analysis.contextType, 'industry');
  assert.notEqual(analysis.primarySubject.type, 'movie');
  assert.notEqual(analysis.primarySubject.type, 'tv_show');
  assert.notEqual(plan.primary.intent, 'poster');
});

test('rejects unrelated title posters for corporate Paramount merger stories', () => {
  const analysis = buildAnalysis({
    title: "Leading Shareholder Advisor ISS Backs WBD-Paramount Merger But Slams David Zaslav's 'Windfall' Payout",
    description:
      'Institutional Shareholder Services backed the merger while criticizing David Zaslav compensation.',
  });

  const result = validateImageCandidate({
    title: 'Paramount Motel official poster',
    imageUrl: 'https://image.tmdb.org/t/p/w1280/paramount-motel.jpg',
    imageWidth: 1280,
    imageHeight: 720,
    domain: 'themoviedb.org',
    link: 'https://www.themoviedb.org/movie/paramount-motel',
    source: 'tmdb',
  }, analysis);

  assert.equal(result.approved, false);
  assert.match(result.reasonCode || '', /IMAGE_CANONICAL_ENTITY_MISMATCH/);
});

test('person-led interview stories keep the speaking subject as the primary image', () => {
  const article = {
    title: "Olivia Munn says a male co-star refused to film a scene on 'The Drew Barrymore Show'",
    description:
      "Olivia Munn discussed the production incident during an appearance on 'The Drew Barrymore Show'.",
  } satisfies RSSImageSelectionArticle;

  const analysis = buildAnalysis(article);
  const plan = determineSmartImagePlan(article, analysis);

  assert.equal(analysis.primarySubject.name, 'Olivia Munn');
  assert.equal(plan.mode, 'dual');
  assert.equal(plan.primary.subject, 'Olivia Munn');
  assert.equal(plan.primary.intent, 'person_portrait');
  assert.deepEqual(plan.primaryAssetPreferences, ['profile', 'logo', 'backdrop']);
  assert.equal(plan.secondary?.subject, 'The Drew Barrymore Show');
});

test('single-subject reaction stories stay in single-image mode', () => {
  const article = {
    title: 'James Gunn reacts to fan theories about the DCU',
    description: 'James Gunn addressed DCU speculation in a new post.',
  } satisfies RSSImageSelectionArticle;

  const analysis = buildAnalysis(article);
  const plan = determineSmartImagePlan(article, analysis);

  assert.equal(plan.mode, 'single');
  assert.equal(plan.useTwoImages, false);
  assert.equal(plan.primary.subject, 'James Gunn');
  assert.equal(plan.primary.intent, 'person_portrait');
  assert.equal(plan.secondary, null);
});

test('rejects show-event art as the primary image for a person-led story', () => {
  const analysis = buildAnalysis({
    title: "Jenna Ortega says she nearly quit acting before landing Ellie Alves in Netflix's 'You'",
    description: "Jenna Ortega discussed the role during an appearance tied to Netflix's Tudum event.",
  });

  const result = validateImageCandidate({
    title: 'Netflix Tudum 2025 official event key art',
    imageUrl: 'https://www.netflix.com/tudum-2025.jpg',
    imageWidth: 1600,
    imageHeight: 900,
    domain: 'netflix.com',
    link: 'https://www.netflix.com/tudum',
    source: 'serper',
  }, analysis);

  assert.equal(result.approved, false);
  assert.match(result.reasonCode || '', /IMAGE_PERSON_PRIORITY_FAIL/);
});

test('rejects anime-style image candidates for live-action Sam Asghari project stories', () => {
  const analysis = buildAnalysis({
    title: "Sam Asghari wraps starring role in action thriller short 'The Good American'",
    description: 'He plays Ben, an Iranian refugee and rideshare driver in Los Angeles.',
  });

  const result = validateImageCandidate({
    title: 'The Good American anime classroom scene',
    imageUrl: 'https://example.com/anime-classroom.jpg',
    imageWidth: 1600,
    imageHeight: 900,
    domain: 'deadline.com',
    link: 'https://deadline.com/example',
    source: 'openai_web_search',
  }, analysis);

  assert.equal(result.approved, false);
  assert.match(result.reasonCode || '', /IMAGE_MEDIA_TYPE_MISMATCH/);
});

test('ignores producer credit titles when resolving a sequel story subject', () => {
  const analysis = buildAnalysis({
    title: "Cameron Diaz to star in 'Troop Beverly Hills' sequel",
    description: 'Laurence Mark ("The Greatest Showman," "Dreamgirls") will produce alongside Diaz.',
  });

  assert.notEqual(analysis.primarySubject.name, 'The Greatest Showman');
  assert.notEqual(analysis.contextProject, 'The Greatest Showman');
});

test('keeps casting analysis anchored to the actual project instead of outlet or creator credits', () => {
  const analysis = buildAnalysis({
    title: "Peter Dinklage joins 'Alien: Earth' Season 2",
    description: "The Game of Thrones Emmy winner will be a series regular on the sci-fi series from 'Fargo' creator Noah Hawley. Deadline broke the news. More to come.",
  });

  assert.equal(analysis.primarySubject.name, 'Alien: Earth');
  assert.equal(analysis.visualSubject, 'Alien: Earth');
  assert.doesNotMatch(`${analysis.primarySubject.name} ${analysis.visualSubject} ${analysis.contextProject || ''}`, /Deadline|Noah Hawley, Deadline|Fargo/i);
});

test('treats James Gunn debunk story as person-led with Superman sequel fallback context', () => {
  const article = {
    title: 'James Gunn Debunks Major Man of Tomorrow Casting Report, "Bullsh-t" (But Confirms 1 Character Left to Cast)',
    description:
      'Things are moving fast for the upcoming Superman sequel film, officially titled Man of Tomorrow, which will not only bring back David Corenswet as the Kryptonian superhero but also Nicholas Hoult as Lex Luthor.',
  } satisfies RSSImageSelectionArticle;

  const analysis = buildAnalysis(article);
  const plan = determineSmartImagePlan(article, analysis);

  assert.equal(analysis.primarySubject.name, 'James Gunn');
  assert.equal(analysis.primarySubject.type, 'actor');
  assert.equal(analysis.contextProject, 'Superman');
  assert.equal(plan.useTwoImages, true);
  assert.equal(plan.primary.subject, 'James Gunn');
  assert.equal(plan.primary.intent, 'person_portrait');
  assert.equal(plan.secondary?.subject, 'Superman');
  assert.equal(plan.secondary?.intent, 'logo');
});

test('project-led sequel stories do not promote supporting characters to the primary visual slot', () => {
  const article = {
    title: "'Superman' sequel 'Man of Tomorrow' is in casting as James Gunn narrows his search for Maxima",
    description:
      "Maxima is an alien queen in the film's storyline, with Adria Arjona, Eva De Dominici, Sydney Chandler, and Grace Van Patten among the finalists.",
  } satisfies RSSImageSelectionArticle;

  const analysis = buildAnalysis(article);
  const plan = determineSmartImagePlan(article, analysis);

  assert.notEqual(plan.primary.subject, 'Maxima');
  assert.notEqual(plan.primary.intent, 'character_still');
  assert.match(plan.primary.subject, /Superman|Man of Tomorrow/i);
});

test('review headlines stay anchored to the reviewed project instead of the lead actor name', () => {
  const article = {
    title: "'Outcome' Review: Keanu Reeves Gets To Play A Movie Star About To Get Canceled In Jonah Hill's Uneven Dark Hollywood Satire",
    description: 'A review of Outcome starring Keanu Reeves and directed by Jonah Hill.',
  } satisfies RSSImageSelectionArticle;

  const analysis = buildAnalysis(article);

  assert.equal(analysis.primarySubject.name, 'Outcome');
  assert.equal(analysis.primarySubject.type, 'movie');
});

test('quoted project headlines beat platform branding for upcoming series announcements', () => {
  const article = {
    title: "Apple TV Assembles 'The Husbands': Joe Alwyn, Richard Gadd, Kingsley Ben-Adir, Joel Kinnaman, Daniel Ings, Bob Morley & Fehinti Balogun To Star In Upcoming A24 Series With Juno Temple",
    description: "Apple TV+ is backing the A24 adaptation of 'The Husbands'.",
  } satisfies RSSImageSelectionArticle;

  const analysis = buildAnalysis(article);

  assert.equal(analysis.primarySubject.name, 'The Husbands');
  assert.notEqual(analysis.primarySubject.type, 'streaming_service');
  assert.notEqual(analysis.primarySubject.type, 'studio');
});

test('project-led animated voice-cast stories keep the project as the primary visual anchor', () => {
  const article = {
    title: "Scarlett Johansson, Sam Rockwell and Tom Waits Join Brad Bird's 'Ray Gunn' Voice Cast",
    description:
      "Johansson, Rockwell and Waits join Brad Bird's Skydance Animation feature 'Ray Gunn' in the voice cast.",
    canonicalEntity: {
      primarySubject: 'Ray Gunn',
      mediaTitle: 'Ray Gunn',
      entityType: 'movie',
      eventType: 'casting',
      namedPeople: ['Scarlett Johansson', 'Sam Rockwell', 'Tom Waits', 'Brad Bird'],
      allowedEntities: ['Ray Gunn', 'Scarlett Johansson', 'Sam Rockwell', 'Tom Waits', 'Brad Bird'],
      confidence: 0.95,
      ambiguityFlags: ['casting_project_anchor_override'],
    },
  } satisfies RSSImageSelectionArticle;

  const analysis = buildAnalysis(article);
  const plan = determineSmartImagePlan(article, analysis);

  assert.equal(analysis.primarySubject.name, 'Ray Gunn');
  assert.equal(analysis.primarySubject.type, 'movie');
  assert.equal(analysis.contextType, 'casting');
  assert.equal(plan.primary.subject, 'Ray Gunn');
  assert.equal(plan.primary.intent, 'still');
  assert.match(plan.mode, /dual|ensemble/);
  assert.equal(plan.secondary?.intent, 'person_portrait');
});

test('rejects text-dominant person-linked poster traps for project-led casting stories', () => {
  const analysis = buildAnalysis({
    title: "Scarlett Johansson, Sam Rockwell and Tom Waits Join Brad Bird's 'Ray Gunn' Voice Cast",
    description:
      "Johansson, Rockwell and Waits join Brad Bird's Skydance Animation feature 'Ray Gunn' in the voice cast.",
    canonicalEntity: {
      primarySubject: 'Ray Gunn',
      mediaTitle: 'Ray Gunn',
      entityType: 'movie',
      eventType: 'casting',
      namedPeople: ['Scarlett Johansson', 'Sam Rockwell', 'Tom Waits', 'Brad Bird'],
      allowedEntities: ['Ray Gunn', 'Scarlett Johansson', 'Sam Rockwell', 'Tom Waits', 'Brad Bird'],
      confidence: 0.95,
      ambiguityFlags: ['casting_project_anchor_override'],
    },
  });

  const result = validateImageCandidate({
    title: 'Chris Grace: As Scarlett Johansson poster',
    imageUrl: 'https://image.tmdb.org/t/p/w1280/chris-grace-poster.jpg',
    imageWidth: 1280,
    imageHeight: 720,
    domain: 'themoviedb.org',
    link: 'https://www.themoviedb.org/movie/chris-grace-as-scarlett-johansson',
    source: 'tmdb',
  }, analysis);

  assert.equal(result.approved, false);
  assert.match(result.reasonCode || '', /IMAGE_LOGO_OVERUSE/);
});
