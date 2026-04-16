import test from 'node:test';
import assert from 'node:assert/strict';
import { __rssCaptionTestUtils } from '../services/ai.service';
import { __rssImageSelectionTestUtils } from '../services/rss-image-selection.service';
import { __rssAuditTestUtils } from '../services/rss.service';
import { __rssTmdbDisambiguationTestUtils } from '../services/rss-tmdb-image-selection.service';
import { buildDuplicateGroups, buildRssAuditReport } from '../audit/rss-audit-report';
import { buildDiagnosisAndFixes, getRssAuditImageResolverOptions, hasCanonicalTokenOverlap } from '../audit/rss-audit-runner';
import type { RssAuditResult } from '../audit/rss-audit-types';

const { getRSSCaptionHardInvalidReasonCodes, headlineAnchorsToCoreProject, failsRSSCaptionFormatting, hasDanglingRSSQuoteLine, hasMissingRSSPersonLeadSubject, buildDeterministicRssCaption } = __rssCaptionTestUtils;
const { shouldRestrictPersonLedSecondaryToPeople, getPersonLedSupportingSecondarySubject, shouldKeepSecondaryCarouselImage, shouldUseFeedFallbackImages, determineSmartImagePlan, guessPrimarySubject } = __rssImageSelectionTestUtils;
const { titleCandidateMatchesResolvedContext, isExactResolvedProjectTitle } = __rssTmdbDisambiguationTestUtils;

function projectAnalysis(overrides: Record<string, any> = {}): any {
  return {
    editorialPrimary: 'Hacks',
    primarySubject: { name: 'Hacks', type: 'tv_show' },
    canonicalEntity: {
      primarySubject: 'Hacks',
      mediaTitle: 'Hacks',
      entityType: 'tv',
      namedPeople: ['Jean Smart'],
      confidence: 0.9,
    },
    visualSubject: 'Hacks',
    imageIntent: 'still',
    secondarySubjects: ['Jean Smart'],
    relevantStudios: [],
    contextType: 'interview',
    targetFormat: 'series',
    animatedSubject: false,
    contextProject: 'Hacks',
    requiredContextTerms: ['Hacks'],
    referenceOnlySubjects: [],
    allowLogoOnly: false,
    queries: ['Hacks'],
    ...overrides,
  };
}

function auditResult(overrides: Partial<RssAuditResult>): RssAuditResult {
  return {
    caseId: overrides.caseId || 'case-1',
    scope: overrides.scope || 'screenrender_core',
    input: {
      sourceName: 'Variety',
      feedUrl: 'https://example.com/feed',
      articleUrl: 'https://example.com/article',
      articleTitle: 'Chris Hemsworth Extraction 3 Confirmed At Netflix',
      articleDescription: 'Chris Hemsworth will return for Extraction 3.',
      articleBody: '<p>Netflix is moving ahead with Extraction 3.</p>',
      publishedAt: '2026-04-10T00:00:00.000Z',
      ...overrides.input,
    },
    normalizedTitle: 'Chris Hemsworth Extraction 3 Confirmed At Netflix',
    normalizedDescription: 'Chris Hemsworth will return for Extraction 3.',
    entity: {
      canonicalEntity: 'Extraction 3',
      canonicalEntityType: 'movie',
      eventType: 'development',
      confidence: 0.9,
      ambiguityFlags: [],
      ...overrides.entity,
    },
    image: {
      mode: 'single',
      primarySubject: 'Extraction 3',
      selectedSource: 'tmdb',
      selectedImages: [],
      tmdbQueries: ['Extraction 3'],
      tmdbCandidates: [],
      failureCodes: [],
      ...overrides.image,
    },
    caption: {
      generatedCaption: "'Extraction 3' is moving forward at Netflix.",
      normalizedCaption: "'Extraction 3' is moving forward at Netflix.",
      failureCodes: [],
      hardInvalidReasons: [],
      rebuildUsed: false,
      ...overrides.caption,
    },
    publishBlocked: false,
    publishFailureCodes: [],
    diagnosis: [],
    recommendedFixes: [],
    ...overrides,
  };
}

test('canonical token overlap detects bad TMDb title matches', () => {
  assert.equal(hasCanonicalTokenOverlap('Gods of the Game', 'Gods of the Game'), true);
  assert.equal(hasCanonicalTokenOverlap('Gods of the Game', 'God Tongue: Kiss Pressure Game The Movie'), false);
  assert.equal(hasCanonicalTokenOverlap('Gods of the Game', 'Brent Forever: Live From Brooklyn Paramount'), false);
});

test('audit image resolver disables OpenAI web image search and AI subject analysis', () => {
  const options = getRssAuditImageResolverOptions(2);

  assert.equal(options.tmdbEnabled, true);
  assert.equal(options.serperEnabled, false);
  assert.equal(options.openaiWebSearchEnabled, false);
  assert.equal(options.skipAiSubjectAnalysis, true);
  assert.equal(options.imageSourcePriority, 'tmdb_first');
});

test('RSS plain text sanitization repairs mojibake quote sequences', () => {
  const repaired = __rssAuditTestUtils.sanitizeRSSPlainText("Finn Wolfhard Told â€˜Malcolm in the Middleâ€™ Creator â€œF*ck Yeahâ€ To Revival Cameo: â€œHeâ€™s Such A Big Fanâ€");

  assert.equal(
    repaired,
    "Finn Wolfhard Told 'Malcolm in the Middle' Creator \"F*ck Yeah\" To Revival Cameo: \"He's Such A Big Fan\""
  );
});

test('RSS headline normalization repairs mojibake before caption logic sees it', () => {
  const normalized = __rssCaptionTestUtils.normalizeRSSHeadlineInput("â€˜Death Of A Salesmanâ€™ Broadway Review: Nathan Lane And Laurie Metcalf Shine In Director Joe Mantelloâ€™s Stark, Blistering Revival");

  assert.equal(
    normalized,
    "'Death Of A Salesman' Broadway Review: Nathan Lane And Laurie Metcalf Shine In Director Joe Mantello's Stark, Blistering Revival"
  );
});

test('canonical entity extraction drops connector-only junk subjects', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: 'Festival do Rio Goes to Cannes: New Brazilian Directors, the Horror of Homelessness',
    description: 'New and emerging Brazilian directors to track feature at this year festival.',
    contentHtml: 'Brazilian directors and remarkable true stories.',
  });

  assert.notEqual(canonical.primarySubject, 'and');
  assert.notEqual(canonical.mediaTitle, 'and');
});

test('canonical entity extraction drops headline-fragment subjects', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Ryan Reynolds' Hit Hulu Series Officially Returning For 3 More Seasons",
    description: 'The FX documentary series has been renewed.',
    contentHtml: '',
  });

  assert.notEqual(canonical.primarySubject, 'Series Officially Returning For');
  assert.notEqual(canonical.mediaTitle, 'Series Officially Returning For');
  assert.ok(canonical.ambiguityFlags?.includes('unsafe_canonical_entity_removed'));
});

test('canonical extraction recovers project title from body markup when headline is weak', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "This Classic Cartoon Network Show's Movie Finale Is Still Perfect Over 15 Years Later",
    description: "Cartoon Network aired an official movie finale to their hit series Ed, Edd, n Eddy.",
    contentHtml: '<p>Cartoon Network aired an official movie finale to their hit series <a><strong><em>Ed, Edd, n Eddy</em></strong></a>, and it is still perfect today.</p>',
  });

  assert.equal(canonical.mediaTitle, 'Ed, Edd, n Eddy');
  assert.equal(canonical.entityType, 'tv');
  assert.ok(canonical.ambiguityFlags?.includes('story_lane_entertainment_adjacent'));
});

test('canonical extraction recovers documentary title from descriptive body', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "'All the Evil in the World' Doc Sparks Political Storm After Being Denied Government Funding",
    description: "The documentary All the Evil in the World follows the murder of an Italian student in Egypt.",
    contentHtml: '<p>The documentary <em>All the Evil in the World</em> has sparked debate.</p>',
  });

  assert.equal(canonical.mediaTitle, 'All the Evil in the World');
  assert.equal(canonical.entityType, 'unknown');
  assert.ok(canonical.ambiguityFlags?.includes('rss_family_no_tmdb_project'));
});

test('headline title recovery strips renewal packaging from quoted project titles', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "‘Welcome to Wrexham’ Lands Big Three-Season Renewal at FX",
    description: 'The series scored a three-season renewal.',
    contentHtml: '',
  });

  assert.equal(canonical.mediaTitle, 'Welcome to Wrexham');
  assert.equal(canonical.primarySubject, 'Welcome to Wrexham');
});

test('headline title recovery strips season and reveal residue from core tv titles', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "The Pitt Season 2 Confirms What's Really Going On With Dr. Al-Hashimi",
    description: 'The Pitt returns with a new episode update.',
    contentHtml: '',
  });

  assert.equal(canonical.mediaTitle, 'The Pitt');
});

test('headline title recovery strips review packaging from movie titles', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Thrash Review: Netflix's New Shark Disaster Flick Is Exactly What You Want It To Be",
    description: 'Thrash is Netflix’s latest shark thriller.',
    contentHtml: '',
  });

  assert.equal(canonical.mediaTitle, 'Thrash');
});

test('headline title recovery prefers quoted project over leading person fragment', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Finn Wolfhard Told ‘Malcolm in the Middle’ Creator “F*ck Yeah” To Revival Cameo",
    description: 'Finn Wolfhard is a big fan of Malcolm in the Middle.',
    contentHtml: '',
  });

  assert.equal(canonical.mediaTitle, 'Malcolm in the Middle');
});

test('possessive generic core headline fragments do not become canonical entities without a recovered title', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Dan Levy's New Crime Comedy Series Is A Must-Watch On Netflix",
    description: 'Netflix is debuting a new comedy series from Dan Levy.',
    contentHtml: '',
  });

  assert.notEqual(canonical.primarySubject, "Dan Levy's New Crime");
  assert.equal(canonical.mediaTitle, 'Big Mistakes');
});

test('article-family classifier routes events and shopping away from project TMDb logic', () => {
  assert.equal(__rssAuditTestUtils.classifyRSSArticleFamily({
    title: 'ATX TV Festival to Present Inaugural Creative Impact Award to Warren Littlefield',
    description: 'The festival will honor Bill Lawrence.',
    contentHtml: '',
  }), 'event_or_festival');

  const shopping = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Nike Ja 3 'Jurassic Park' Sneakers: Here's Where to Score the Signature Shoes Online",
    description: 'A shopping guide for sneakers.',
    contentHtml: '',
  });

  assert.ok(shopping.ambiguityFlags?.includes('rss_family_no_tmdb_project'));
  assert.equal(shopping.entityType, 'unknown');
});

test('business platform stories route as platform without project title extraction', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: 'YouTube Premium and YouTube Music Subscription Prices Are Going Up in the U.S.',
    description: 'YouTube is raising subscription prices.',
    contentHtml: '',
  });

  assert.ok(canonical.ambiguityFlags?.includes('article_family_business_or_platform'));
  assert.notEqual(canonical.mediaTitle, 'YouTube Premium and YouTube Music Subscription Prices');
});

test('quote leakage cannot become canonical entity', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: 'Jimmy Kimmel Airs Photo of Melania Trump and Jeffrey Epstein After First Lady Makes Public Address Denying Epstein Ties',
    description: 'Kimmel joked that the two have never been friends with Epstein.',
    contentHtml: '<p>She said she has never been friends with Epstein.</p>',
  });

  assert.notEqual(canonical.primarySubject, 'never been friends with Epstein.');
  assert.ok(canonical.ambiguityFlags?.includes('article_family_political_or_non_entertainment'));
  assert.ok(canonical.ambiguityFlags?.includes('rss_family_no_tmdb_project'));
});

test('casting headlines recover project titles instead of possessive junk fragments', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Tyler Perry Joins 'Joe Turner's Come and Gone' Broadway Producing Team",
    description: 'Tyler Perry joins the Broadway producing team for Joe Turner\'s Come and Gone.',
    contentHtml: '',
  });

  assert.notEqual(canonical.primarySubject, 's Come And Gone');
  assert.equal(canonical.mediaTitle, "Joe Turner's Come and Gone");
});

test('quote-led question headlines are marked as headline junk instead of clean canonicals', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Did Abbott Elementary Just Break Up Janine And Gregory? Quinta Brunson Details The Fallout From That Big Fight",
    description: 'Quinta Brunson discusses the fallout on Abbott Elementary.',
    contentHtml: '',
  });

  assert.notEqual(canonical.primarySubject, 'Did Abbott Elementary Just');
  assert.ok(
    canonical.ambiguityFlags?.includes('quote_led_headline_junk') ||
    canonical.ambiguityFlags?.includes('story_policy_allow_quote_led_person_commentary')
  );
});

test('joke headlines do not survive as clean canonicals when only quoted project context is safe', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Jimmy Kimmel Jokes Zendaya Is Probably the Reason No One on 'Euphoria' Knows Its Future: 'Tom Holland Can’t Be Trusted'",
    description: 'Jimmy Kimmel joked about the future of Euphoria.',
    contentHtml: '',
  });

  assert.notEqual(canonical.primarySubject, 'Jimmy Kimmel Jokes Zendaya');
  assert.ok(
    canonical.ambiguityFlags?.includes('quote_led_headline_junk') ||
    canonical.ambiguityFlags?.includes('story_policy_allow_quote_led_person_commentary')
  );
});

test('targeted person-commentary override keeps Euphoria story publishable without generic quote-junk downgrade', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Jimmy Kimmel Jokes Zendaya Is Probably the Reason No One on 'Euphoria' Knows Its Future",
    description: 'Jimmy Kimmel joked about Euphoria and Zendaya.',
    contentHtml: '<p>Jimmy Kimmel joked about Zendaya while talking about Euphoria.</p>',
  });

  assert.equal(canonical.mediaTitle, 'Euphoria');
  assert.ok(canonical.ambiguityFlags?.includes('story_family_person_commentary_on_project'));
  assert.ok(canonical.ambiguityFlags?.includes('story_policy_allow_quote_led_person_commentary'));
  assert.ok(!canonical.ambiguityFlags?.includes('quote_led_headline_junk'));
});

test('targeted non-core leaks route out of screenrender core before project/image recovery', () => {
  const starTrek = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Why Star Trek: The Next Generation's Worst-Rated Episode On IMDb Is So Hated",
    description: 'An editorial explainer looking back at an old TNG episode.',
    contentHtml: '<p>This retrospective breaks down fan reactions over time.</p>',
  });
  assert.ok(starTrek.ambiguityFlags?.includes('story_lane_entertainment_adjacent'));
  assert.ok(starTrek.ambiguityFlags?.includes('rss_family_no_tmdb_project'));

  const bafta = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "BAFTA Film Awards Review of Tourette's Fiasco Finds \"Weaknesses\" in Planning and Crisis Procedures, But No \"Malicious Intent\"",
    description: 'The report focused on governance and planning procedures.',
    contentHtml: '<p>The review covered awards-operations governance and procedures.</p>',
  });
  assert.ok(bafta.ambiguityFlags?.includes('story_lane_ignore_completely'));
  assert.ok(bafta.ambiguityFlags?.includes('rss_family_no_tmdb_project'));
});

test('TMDb title context rejects platform and studio names as project title matches', () => {
  const matches = titleCandidateMatchesResolvedContext('Netflix', {
    primarySubject: { name: 'Netflix', type: 'streaming_service' },
    visualSubject: 'Netflix',
    secondarySubjects: [],
    imageIntent: 'brand_backdrop',
    targetFormat: 'general',
    contextProject: null,
    requiredContextTerms: ['subscription prices'],
    relevantStudios: ['Netflix'],
    queries: ['Netflix prices going up'],
    limit: 1,
    canonicalEntity: {
      primarySubject: 'Netflix',
      entityType: 'platform',
      confidence: 0.8,
    },
  });

  assert.equal(matches, false);
});

test('exact title logo fallback only treats real project title matches as exact', () => {
  assert.equal(isExactResolvedProjectTitle('Hacks', {
    primarySubject: { name: 'Hacks Season 5 Premiere', type: 'tv_show' },
    visualSubject: 'Hacks',
    secondarySubjects: [],
    imageIntent: 'still',
    targetFormat: 'series',
    contextProject: 'Hacks',
    requiredContextTerms: ['Hacks', 'season 5'],
    relevantStudios: [],
    queries: ['Hacks Season 5 Premiere'],
    limit: 1,
    canonicalEntity: {
      primarySubject: 'Hacks',
      mediaTitle: 'Hacks',
      entityType: 'tv',
      confidence: 0.9,
    },
  }), true);

  assert.equal(isExactResolvedProjectTitle('Marvel Productions', {
    primarySubject: { name: 'Hacks Season 5 Premiere', type: 'tv_show' },
    visualSubject: 'Hacks',
    secondarySubjects: [],
    imageIntent: 'still',
    targetFormat: 'series',
    contextProject: 'Hacks',
    requiredContextTerms: ['Hacks', 'season 5'],
    relevantStudios: ['Max'],
    queries: ['Hacks Season 5 Premiere'],
    limit: 1,
    canonicalEntity: {
      primarySubject: 'Hacks',
      mediaTitle: 'Hacks',
      entityType: 'tv',
      confidence: 0.9,
    },
  }), false);
});

test('company logos are not primary for non-corporate editorial stories', () => {
  const resolved = __rssTmdbDisambiguationTestUtils.resolveCanonicalTMDbEntity({
    primarySubject: { name: 'Netflix', type: 'streaming_service' },
    visualSubject: 'Netflix',
    secondarySubjects: [],
    imageIntent: 'brand_backdrop',
    targetFormat: 'general',
    contextProject: null,
    requiredContextTerms: ['Dan Levy', 'crime comedy', 'series'],
    relevantStudios: ['Netflix'],
    queries: ["Dan Levy's New Crime Comedy Series Is A Must-Watch On Netflix"],
    limit: 1,
    canonicalEntity: {
      primarySubject: 'Netflix',
      entityType: 'platform',
      confidence: 0.8,
    },
  });

  assert.equal(resolved.tmdbQuery, '');
});

test('corporate stories can still use company logo resolution', () => {
  const resolved = __rssTmdbDisambiguationTestUtils.resolveCanonicalTMDbEntity({
    primarySubject: { name: 'Netflix', type: 'streaming_service' },
    visualSubject: 'Netflix',
    secondarySubjects: [],
    imageIntent: 'brand_backdrop',
    targetFormat: 'general',
    contextProject: null,
    requiredContextTerms: ['subscription prices', 'earnings'],
    relevantStudios: ['Netflix'],
    queries: ['Netflix raises subscription prices after earnings report'],
    limit: 1,
    canonicalEntity: {
      primarySubject: 'Netflix',
      entityType: 'platform',
      confidence: 0.8,
    },
  });

  assert.equal(resolved.tmdbQuery, 'Netflix');
});

test('project fallback anchors include canonical media title and seasonless variants', () => {
  const anchors = __rssImageSelectionTestUtils.getProjectFallbackAnchors({
    title: 'Hacks Season 5 Finale Could Lead To A Reboot',
    description: 'The creators discussed the Hacks series finale.',
  }, projectAnalysis({
    canonicalEntity: {
      primarySubject: 'Hacks Season 5 Finale',
      mediaTitle: 'Hacks Season 5 Finale',
      entityType: 'tv',
    },
    contextProject: null,
    primarySubject: { name: 'Hacks Season 5 Finale', type: 'tv_show' },
  }));

  assert.ok(anchors.includes('Hacks Season 5 Finale'));
  assert.ok(anchors.includes('Hacks'));
});

test('project fallback anchors include franchise parent fallbacks for sequel and prequel titles', () => {
  const anchors = __rssImageSelectionTestUtils.getProjectFallbackAnchors({
    title: 'House of the Dragon Season 3 Premiere Sets Up Another Civil War',
    description: 'The Game of Thrones prequel returns with another season premiere.',
  }, projectAnalysis({
    canonicalEntity: {
      primarySubject: 'House of the Dragon Season 3 Premiere',
      mediaTitle: 'House of the Dragon Season 3 Premiere',
      franchise: 'Game of Thrones',
      entityType: 'tv',
    },
    contextProject: 'House of the Dragon Season 3 Premiere',
    primarySubject: { name: 'House of the Dragon Season 3 Premiere', type: 'tv_show' },
  }));

  assert.ok(anchors.includes('House of the Dragon'));
  assert.ok(anchors.includes('Game of Thrones'));
});

test('safe weak TMDb fallback allows exact project posters and logos only', () => {
  const analysis = projectAnalysis();

  assert.equal(__rssImageSelectionTestUtils.isSafeWeakTMDbProjectFallback({
    url: 'https://image.tmdb.org/hacks-poster.jpg',
    reason: 'TMDb poster for Hacks',
    source: 'tmdb',
    score: 0.71,
    role: 'poster',
  }, analysis), true);

  assert.equal(__rssImageSelectionTestUtils.isSafeWeakTMDbProjectFallback({
    url: 'https://image.tmdb.org/random-logo.jpg',
    reason: 'TMDb logo for Marvel Productions',
    source: 'tmdb',
    score: 0.9,
    role: 'logo',
  }, analysis), false);
});

test('title-derived TMDb fallback rejects zero-overlap candidates', () => {
  const filtered = __rssImageSelectionTestUtils.filterTMDbImagesByAnchorOverlap([{
    url: 'https://image.tmdb.org/blank.jpg',
    reason: 'TMDb backdrop for Blank',
    source: 'tmdb',
    score: 665,
    role: 'still',
  }, {
    url: 'https://image.tmdb.org/hacks.jpg',
    reason: 'TMDb poster for Hacks',
    source: 'tmdb',
    score: 72,
    role: 'poster',
  }], 'Hacks Season 5 Finale');

  assert.equal(filtered.length, 1);
  assert.match(filtered[0].reason, /Hacks/);
});

test('person portrait fallback is available for project-led casting stories', () => {
  const person = __rssImageSelectionTestUtils.getProjectStoryPersonFallbackSubject({
    title: 'Kevin Bacon Joins Southern Bastards Adaptation',
    description: 'Kevin Bacon has joined the Southern Bastards series adaptation.',
  }, projectAnalysis({
    canonicalEntity: {
      primarySubject: 'Southern Bastards',
      mediaTitle: 'Southern Bastards',
      entityType: 'tv',
      namedPeople: ['Kevin Bacon'],
    },
    primarySubject: { name: 'Southern Bastards', type: 'tv_show' },
    contextProject: 'Southern Bastards',
    secondarySubjects: ['Kevin Bacon'],
    contextType: 'casting',
  }));

  assert.equal(person, 'Kevin Bacon');
});

test('person portrait fallback is blocked when canonical anchors are weak headline junk', () => {
  const person = __rssImageSelectionTestUtils.getProjectStoryPersonFallbackSubject({
    title: "Did Abbott Elementary Just Break Up Janine And Gregory? Quinta Brunson Details The Fallout From That Big Fight",
    description: 'Quinta Brunson discusses the fallout on Abbott Elementary.',
  }, projectAnalysis({
    canonicalEntity: {
      primarySubject: 'Did Abbott Elementary Just',
      mediaTitle: undefined,
      entityType: 'tv',
      namedPeople: ['Quinta Brunson'],
      ambiguityFlags: ['quote_led_headline_junk', 'canonical_project_weak', 'article_family_person_interview_or_reaction'],
    },
    contextProject: 'Did Abbott Elementary Just',
    primarySubject: { name: 'Did Abbott Elementary Just', type: 'tv_show' },
    contextType: 'interview',
    secondarySubjects: ['Quinta Brunson'],
  }));

  assert.equal(person, null);
});

test('deterministic RSS caption refuses unsafe unresolved canonical fragments', () => {
  const caption = __rssCaptionTestUtils.buildDeterministicRssCaption({
    article_title: "Ryan Reynolds' Hit Hulu Series Officially Returning For 3 More Seasons",
    event_type: 'return',
    primary_subject: undefined,
    media_title: undefined,
    supporting_facts: ['The FX documentary series has been renewed.'],
  } as any, {
    articleTitle: "Ryan Reynolds' Hit Hulu Series Officially Returning For 3 More Seasons",
    feedName: 'ScreenRant',
    summary: 'The FX documentary series has been renewed.',
    platform: 'X',
    canonicalEntity: {
      entityType: 'unknown',
      ambiguityFlags: ['unsafe_canonical_entity_removed'],
    },
  });

  assert.equal(caption, '');
});

test('deterministic RSS caption prefers canonical media title over dirty primary fragment for core stories', () => {
  const caption = __rssCaptionTestUtils.buildDeterministicRssCaption({
    article_title: "Thrash Review: Netflix's New Shark Disaster Flick Is Exactly What You Want It To Be",
    event_type: 'other',
    primary_subject: 'Thrash Revi',
    media_title: 'Thrash',
    supporting_facts: [],
  } as any, {
    articleTitle: "Thrash Review: Netflix's New Shark Disaster Flick Is Exactly What You Want It To Be",
    feedName: 'SlashFilm',
    summary: 'Thrash is Netflix’s latest shark thriller.',
    platform: 'X',
    canonicalEntity: {
      primarySubject: 'Thrash Revi',
      mediaTitle: 'Thrash',
      entityType: 'movie',
      confidence: 0.9,
      allowedEntities: ['Thrash'],
    },
  });

  assert.match(caption, /^'Thrash'/);
  assert.doesNotMatch(caption, /Thrash Revi/);
});

test('deterministic RSS caption uses canonical project title when extraction media title drifts', () => {
  const caption = __rssCaptionTestUtils.buildDeterministicRssCaption({
    article_title: "The Pitt Season 2 Confirms What's Really Going On With Dr. Al-Hashimi",
    event_type: 'other',
    primary_subject: "ve seen Dr. Al-Hashimi experience moments that seem atypical for her. In the season",
    media_title: "ve seen Dr. Al-Hashimi experience moments that seem atypical for her. In the season",
    supporting_facts: [],
  } as any, {
    articleTitle: "The Pitt Season 2 Confirms What's Really Going On With Dr. Al-Hashimi",
    feedName: 'SlashFilm',
    summary: 'The Pitt season 2 finally clarifies Dr. Al-Hashimi’s arc.',
    platform: 'X',
    canonicalEntity: {
      primarySubject: 'The Pitt',
      mediaTitle: 'The Pitt',
      entityType: 'tv',
      confidence: 0.9,
      allowedEntities: ['The Pitt'],
    },
  });

  assert.match(caption, /^'The Pitt'/);
  assert.doesNotMatch(caption, /ve seen Dr\. Al-Hashimi/);
});

test('core captions must anchor the headline to the canonical project title', () => {
  const context = {
    articleTitle: "Thrash Review: Netflix's New Shark Disaster Flick Is Exactly What You Want It To Be",
    feedName: 'SlashFilm',
    summary: 'Thrash is Netflix’s latest shark thriller.',
    platform: 'X',
    canonicalEntity: {
      primarySubject: 'Thrash',
      mediaTitle: 'Thrash',
      entityType: 'movie',
      confidence: 0.9,
      allowedEntities: ['Thrash'],
    },
  } as any;

  assert.equal(headlineAnchorsToCoreProject("'Thrash' has a new update.\n\nThe review is in.", context), true);
  assert.equal(headlineAnchorsToCoreProject("'Flick Is Exactly What You Want' has a new update.\n\nThe review is in.", context), false);
  assert.equal(failsRSSCaptionFormatting("'Flick Is Exactly What You Want' has a new update.\n\nThe review is in.", context), true);
});

test('deterministic RSS captions use review-aware templates for recovered project titles', () => {
  const caption = __rssCaptionTestUtils.buildDeterministicRssCaption({
    article_title: "Thrash Review: Netflix's New Shark Disaster Flick Is Exactly What You Want It To Be",
    event_type: 'casting',
    primary_subject: 'bye-bye',
    media_title: 'Thrash',
    supporting_facts: [],
  } as any, {
    articleTitle: "Thrash Review: Netflix's New Shark Disaster Flick Is Exactly What You Want It To Be",
    feedName: 'SlashFilm',
    summary: "Thrash is the subject of a new review.",
    articleBody: '',
    platform: 'X',
    canonicalEntity: {
      primarySubject: 'Thrash',
      mediaTitle: 'Thrash',
      entityType: 'movie',
      confidence: 0.9,
      allowedEntities: ['Thrash'],
    },
  });

  assert.match(caption, /^'Thrash' is the subject of a new review\./);
  assert.doesNotMatch(caption, /added a new cast member/i);
});

test('deterministic RSS captions use roundup-aware templates for recovered package stories', () => {
  const caption = __rssCaptionTestUtils.buildDeterministicRssCaption({
    article_title: '7 Anime With The Biggest Plot Twists',
    event_type: 'casting',
    primary_subject: 'Magi: The Labyrinth of Magic',
    media_title: 'Magi: The Labyrinth of Magic',
    supporting_facts: [],
  } as any, {
    articleTitle: '7 Anime With The Biggest Plot Twists',
    feedName: 'ComicBook',
    summary: 'Magi: The Labyrinth of Magic appears in the roundup.',
    articleBody: '',
    platform: 'X',
    canonicalEntity: {
      primarySubject: 'Magi: The Labyrinth of Magic',
      mediaTitle: 'Magi: The Labyrinth of Magic',
      entityType: 'tv',
      confidence: 0.9,
      allowedEntities: ['Magi: The Labyrinth of Magic'],
    },
  });

  assert.match(caption, /^'Magi: The Labyrinth of Magic' is featured in a new roundup\./);
  assert.doesNotMatch(caption, /added a new cast member/i);
});

test('teaser headlines prefer recovered body project titles over weak headline fragments', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: 'Did Abbott Elementary Just Break Up Janine And Gregory? Quinta Brunson Details The Fallout From That Big Fight',
    description: 'Quinta Brunson discusses the fallout on Abbott Elementary after that fight.',
    contentHtml: '<p>Quinta Brunson discusses the fallout on Abbott Elementary after that fight.</p>',
  });

  assert.equal(canonical.primarySubject, 'Abbott Elementary');
  assert.equal(__rssAuditTestUtils.classifyRSSHeadlineStyle('Did Abbott Elementary Just Break Up Janine And Gregory?'), 'teaser');
});

test('trailer and how-style headlines recover clean project titles for canonical extraction', () => {
  const mutiny = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Mutiny Trailer: Jason Statham Isn't Taking Any Ship From These Dudes",
    description: 'Jason Statham wrecks dudes on the high seas in the trailer for Mutiny.',
    contentHtml: '<p>Jason Statham wrecks dudes on the high seas in the trailer for Mutiny.</p>',
  });
  assert.equal(mutiny.primarySubject, 'Mutiny');

  const boys = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "How The Boys Season 5's Grotesque Love Sausage Fight Scene Was Filmed [Exclusive]",
    description: "According to The Boys' Laz Alonso, season 5's grotesque fight scene was bizarre to film.",
    contentHtml: "<p>According to The Boys' Laz Alonso, season 5's grotesque fight scene was bizarre to film.</p>",
  });
  assert.equal(boys.primarySubject, 'The Boys');
});

test('listicle and quiz headlines route to editorial listicle family', () => {
  const quiz = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: 'Test Your Knowledge With the Collider TV Quiz - April 10, 2026',
    description: 'Take the TV quiz.',
    contentHtml: '<p>Take the TV quiz.</p>',
  });
  assert.ok((quiz.ambiguityFlags || []).includes('article_family_editorial_listicle'));

  const watch = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: 'What To Watch Friday: Malcolm In The Middle Revival, Laguna Beach And Jury Duty Reunions, And More',
    description: 'Here is what to watch this weekend.',
    contentHtml: '<p>Here is what to watch this weekend.</p>',
  });
  assert.ok((watch.ambiguityFlags || []).includes('article_family_editorial_listicle'));
});

test('editorial watch guides and ratings reports are blocked at RSS intake', () => {
  const watchGuideReason = __rssAuditTestUtils.getRSSEditorialIngestionBlockReason({
    title: 'What To Watch Friday: Malcolm In The Middle Revival, Laguna Beach And Jury Duty Reunions, And More',
    description: 'Here is what to watch this weekend.',
    contentHtml: '<p>Here is what to watch this weekend.</p>',
  });
  const ratingsReason = __rssAuditTestUtils.getRSSEditorialIngestionBlockReason({
    title: 'Ratings: One Piece Hits New High In Season 2, Virgin River Returns Strong',
    description: 'A weekly viewership report.',
    contentHtml: '<p>Weekly TV ratings roundup.</p>',
  });

  assert.match(String(watchGuideReason), /watch guide/i);
  assert.match(String(ratingsReason), /ratings report/i);
});

test('editorial recap headlines are blocked at RSS intake', () => {
  const recapReason = __rssAuditTestUtils.getRSSEditorialIngestionBlockReason({
    title: 'The Last of Us Season 2 Episode 4 Recap: The Cost of Survival',
    description: 'Episode recap and ending explained.',
    contentHtml: '<p>Episode recap and ending explained.</p>',
  });

  assert.match(String(recapReason), /recap\/explainer/i);
});

test('editorial roundup and evergreen headlines are blocked at RSS intake', () => {
  const roundupReason = __rssAuditTestUtils.getRSSEditorialIngestionBlockReason({
    title: "CBS Reveals Finale Spoilers For 19 Shows - Plus, Jensen Ackles' Tracker Return Confirmed",
    description: 'A finale roundup across multiple CBS shows.',
    contentHtml: '<p>A finale roundup across multiple CBS shows.</p>',
  });
  const evergreenReason = __rssAuditTestUtils.getRSSEditorialIngestionBlockReason({
    title: 'Netflix Is About to Lose the Greatest Spy Thriller Series of All Time',
    description: 'A streaming library recommendation article.',
    contentHtml: '<p>A streaming library recommendation article.</p>',
  });

  assert.match(String(roundupReason), /editorial listicle/i);
  assert.match(String(evergreenReason), /editorial listicle/i);
});

test('reality elimination recap headlines are blocked at RSS intake', () => {
  const recapReason = __rssAuditTestUtils.getRSSEditorialIngestionBlockReason({
    title: "Survivor 50's Latest Boot Reveals What We Didn't See During That Spicy Camp Fight",
    description: 'Spoilers ahead for Episode 7 of Survivor 50.',
    contentHtml: '<p>All the former winners left the building after tribal council.</p>',
  });

  assert.match(String(recapReason), /recap\/explainer/i);
});

test('business and stage-industry headlines route away from core project extraction', () => {
  const agencyFamily = __rssAuditTestUtils.classifyRSSArticleFamily({
    title: 'Inside the Global Agency That Turns Stylists Into Stars',
    description: 'A profile of the agency business.',
    contentHtml: '<p>A profile of the agency business.</p>',
  });
  const broadwayFamily = __rssAuditTestUtils.classifyRSSArticleFamily({
    title: "Tyler Perry Joins 'Joe Turner's Come And Gone' Broadway Producing Team",
    description: 'Broadway producers expand the team.',
    contentHtml: '<p>Broadway producers expand the team.</p>',
  });

  assert.equal(agencyFamily, 'business_or_platform');
  assert.equal(broadwayFamily, 'event_or_festival');
});

test('political documentary subject stories route away from core project extraction', () => {
  const family = __rssAuditTestUtils.classifyRSSArticleFamily({
    title: "'All the Evil in the World' Doc About Murder of Leftist Italian Student in Egypt Sparks Political Storm",
    description: 'A documentary about the murder of an Italian student in Egypt and the political fallout.',
    contentHtml: '<p>The documentary explores the murder case, activism and diplomatic tensions.</p>',
  });

  assert.equal(family, 'political_or_non_entertainment');
});

test('orders-to-series headlines recover the project title', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "CBS Orders Vampire Comedy Eternally Yours To Series, Scraps Kate Walsh's The Tillbrooks",
    description: 'CBS orders the vampire comedy to series.',
    contentHtml: '<p>CBS orders the vampire comedy to series.</p>',
  });
  assert.equal(canonical.primarySubject, 'Eternally Yours');
});

test('quoted possessive headlines recover the project title instead of trailing quote residue', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "'Malcolm in the Middle's Bryan Cranston & Jane Kaczmarek On What Keeps Hal & Lois Together: \"They Have Good Sex\"",
    description: 'Bryan Cranston and Jane Kaczmarek discuss Malcolm in the Middle.',
    contentHtml: '<p>Bryan Cranston and Jane Kaczmarek discuss Malcolm in the Middle.</p>',
  });

  assert.equal(canonical.mediaTitle, 'Malcolm in the Middle');
});

test('headline recovery strips generic new and movie wrappers from core project titles', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: 'Why The New Faces Of Death Movie May Be The Most Complex Horror Movie Of 2026',
    description: 'Faces of Death returns in a new horror remake.',
    contentHtml: '<p>Faces of Death returns in a new horror remake.</p>',
  });

  assert.equal(canonical.mediaTitle, 'Faces Of Death');
});

test('return-to headlines recover the supporting project title for person-led stories', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Annie Potts' Meemaw Is Scheming Again Upon Her Return To Georgie & Mandy - And She's Not The Only Young Sheldon Vet Back",
    description: "Annie Potts returns to Georgie & Mandy's First Marriage.",
    contentHtml: "<p>Annie Potts returns to the Young Sheldon spinoff <em>Georgie & Mandy's First Marriage</em>.</p>",
  });

  assert.equal(canonical.mediaTitle, "Georgie & Mandy's First Marriage");
});

test('wrapper headlines recover body-first title for Dan Levy project stories', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Dan Levy's new crime comedy series is a must-watch on Netflix",
    description: 'Netflix has begun rolling out Big Mistakes.',
    contentHtml: '<p>Dan Levy created the crime comedy series titled "Big Mistakes" for Netflix.</p>',
  });

  assert.equal(canonical.mediaTitle, 'Big Mistakes');
});

test('wrapper headlines recover body-first title for director-led movie stories', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Brad Bird's Netflix sci-fi movie is finally moving forward",
    description: 'Ray Gunn is set up at Netflix.',
    contentHtml: '<p>Brad Bird will direct the sci-fi film called "Ray Gunn" for Netflix.</p>',
  });

  assert.equal(canonical.mediaTitle, 'Ray Gunn');
});

test('targeted final-baseline cleanup cases resolve to the expected lanes and canonicals', () => {
  const cases = [
    {
      item: {
        title: "MK2 Boards Ground-Breaking Rwandan Cannes-Selected Film 'Ben'Imana'",
        description: "MK2 Films has boarded sales on Ben'Imana ahead of Cannes.",
        contentHtml: "<p>Marie-Clementine Dusabejambo's Ben'Imana premieres in Cannes.</p>",
      },
      mediaTitle: "Ben'Imana",
      entityType: 'movie',
      eventType: 'development',
      flag: 'story_lane_core_auto_publish',
    },
    {
      item: {
        title: 'Cult Classic 1980s Comedy Movie Is Finally Getting a Sequel With a Major Hollywood Star',
        description: 'Cameron Diaz will star in the Troop Beverly Hills sequel.',
        contentHtml: '<p>Cameron Diaz is starring in a sequel to Troop Beverly Hills for TriStar Pictures.</p>',
      },
      mediaTitle: 'Troop Beverly Hills',
      entityType: 'movie',
      eventType: 'casting',
      flag: 'story_lane_core_auto_publish',
    },
    {
      item: {
        title: "Frieren: Beyond Journey's End Gets a New Release After Season 2 Finale",
        description: 'TOHO confirmed what comes next for Frieren: Beyond Journey\'s End.',
        contentHtml: '<p>The official site confirmed a new release update for Frieren: Beyond Journey\'s End.</p>',
      },
      mediaTitle: "Frieren: Beyond Journey's End",
      entityType: 'tv',
      eventType: 'release_date',
      flag: 'story_lane_core_auto_publish',
    },
    {
      item: {
        title: "Malcolm In The Middle Review: Hulu's Messy Family Reunion Struggles To Recapture The Original's Zing",
        description: 'A review of the reunion special.',
        contentHtml: '<p>This review looks at Malcolm in the Middle.</p>',
      },
      mediaTitle: 'Malcolm in the Middle',
      entityType: 'tv',
      eventType: 'other',
      flag: 'story_lane_entertainment_adjacent',
    },
    {
      item: {
        title: "Sullivan's Crossing Season 4 First Look: Liam's Arrival Brings 'Tension' For Maggie And Cal (Exclusive)",
        description: 'A first look at Sullivan\'s Crossing season 4.',
        contentHtml: '<p>New images from Sullivan\'s Crossing tease Liam arriving in town.</p>',
      },
      mediaTitle: "Sullivan's Crossing",
      entityType: 'tv',
      eventType: 'first_look',
      flag: 'story_family_visual_reveal_event',
    },
    {
      item: {
        title: 'Rooster Renewed For Season 2 At HBO',
        description: 'HBO renewed Rooster.',
        contentHtml: '<p>Rooster is coming back for season 2.</p>',
      },
      mediaTitle: 'Rooster',
      entityType: 'tv',
      eventType: 'renewal',
      flag: 'story_lane_core_auto_publish',
    },
    {
      item: {
        title: "Jimmy Kimmel Jokes Zendaya Is Probably the Reason No One on 'Euphoria' Knows Its Future",
        description: 'Jimmy Kimmel joked about Euphoria and Zendaya.',
        contentHtml: '<p>Jimmy Kimmel joked about Zendaya while talking about Euphoria.</p>',
      },
      primarySubject: 'Jimmy Kimmel',
      mediaTitle: 'Euphoria',
      entityType: 'person',
      eventType: 'interview_quote',
      flag: 'story_family_person_commentary_on_project',
    },
    {
      item: {
        title: 'Stephen King Thinks This Sci-Fi Anthology Series Is Scarier Than The Twilight Zone',
        description: 'Stephen King praised The Outer Limits.',
        contentHtml: '<p>Stephen King argued that The Outer Limits is scarier than The Twilight Zone.</p>',
      },
      primarySubject: 'Stephen King',
      mediaTitle: 'The Outer Limits',
      entityType: 'person',
      eventType: 'interview_quote',
      flag: 'story_family_person_commentary_on_project',
    },
    {
      item: {
        title: "Fox News Is Sending 'Fox & Friends' on an RV Road Trip (Exclusive)",
        description: 'Fox News is shifting Fox & Friends.',
        contentHtml: '<p>Fox News is sending Fox & Friends on the road.</p>',
      },
      entityType: 'unknown',
      eventType: 'business',
      flag: 'story_lane_ignore_completely',
    },
    {
      item: {
        title: "'Thrash' Review: Phoebe Dynevor Gives Birth in Floodwaters Teeming With Sharks",
        description: 'A review of Thrash.',
        contentHtml: '<p>This review covers Thrash.</p>',
      },
      mediaTitle: 'Thrash',
      entityType: 'movie',
      eventType: 'other',
      flag: 'story_lane_entertainment_adjacent',
    },
    {
      item: {
        title: 'Absolute Green Arrow Creators Reveal Details of "Serial Killer" Reboot',
        description: 'The comics reboot details Absolute Green Arrow.',
        contentHtml: '<p>Absolute Green Arrow gets a darker comics reboot.</p>',
      },
      mediaTitle: 'Absolute Green Arrow',
      eventType: 'other',
      flag: 'story_policy_comics_only',
    },
    {
      item: {
        title: "This Classic Cartoon Network Show's Movie Finale Is Still Perfect Over 15 Years Later",
        description: 'A retrospective on Ed, Edd, n Eddy.',
        contentHtml: '<p>The movie finale for Ed, Edd, n Eddy still holds up.</p>',
      },
      mediaTitle: 'Ed, Edd, n Eddy',
      entityType: 'tv',
      eventType: 'other',
      flag: 'story_lane_entertainment_adjacent',
    },
    {
      item: {
        title: 'God-Tier Cosmic Marvel Character Spotted in Daredevil: Born Again',
        description: 'A spoiler-sensitive Daredevil: Born Again cameo write-up.',
        contentHtml: '<p>A spoiler-heavy Daredevil: Born Again episode features a surprise Marvel character.</p>',
      },
      mediaTitle: 'Daredevil: Born Again',
      entityType: 'tv',
      eventType: 'reveal',
      flag: 'story_lane_core_manual_review_spoiler_safe',
    },
    {
      item: {
        title: "'The Pitt' Production Team Tracks Every Sock, Every Empty Drawer, and It's Why the Show Feels So Real",
        description: 'The production team explains the continuity work on The Pitt.',
        contentHtml: '<p>The Pitt production team explained how the show tracks every continuity detail.</p>',
      },
      mediaTitle: 'The Pitt',
      entityType: 'tv',
      eventType: 'other',
      flag: 'story_policy_production_detail_core',
    },
    {
      item: {
        title: "Annie Potts' Meemaw Is Scheming Again Upon Her Return To Georgie & Mandy - And She's Not The Only Young Sheldon Vet Back",
        description: "Annie Potts returns to Georgie & Mandy's First Marriage.",
        contentHtml: "<p>Annie Potts returns to the Young Sheldon spinoff Georgie & Mandy's First Marriage.</p>",
      },
      mediaTitle: "Georgie & Mandy's First Marriage",
      entityType: 'tv',
      eventType: 'return',
      flag: 'story_lane_core_auto_publish',
    },
    {
      item: {
        title: "CBS Orders Vampire Comedy Eternally Yours To Series, Scraps Kate Walsh's The Tillbrooks",
        description: 'CBS ordered Eternally Yours to series.',
        contentHtml: '<p>CBS ordered Eternally Yours to series starring Ed Weeks and Allegra Edwards.</p>',
      },
      mediaTitle: 'Eternally Yours',
      entityType: 'tv',
      eventType: 'ordered_to_series',
      flag: 'story_policy_series_order',
    },
    {
      item: {
        title: "Halle Berry Starred In A Forgotten Who's The Boss? Spin-Off For ABC",
        description: 'A trivia retrospective on a Who\'s the Boss? spinoff.',
        contentHtml: '<p>Before movie stardom, Halle Berry appeared in a Who\'s the Boss? spinoff.</p>',
      },
      entityType: 'tv',
      eventType: 'other',
      flag: 'story_lane_entertainment_adjacent',
    },
    {
      item: {
        title: 'Yes, The Boys Cast And Creators Know All About Your Homelander Memes',
        description: 'The Boys cast reacted to Homelander memes.',
        contentHtml: '<p>The Boys cast and creators know about the memes.</p>',
      },
      mediaTitle: 'The Boys',
      entityType: 'tv',
      eventType: 'other',
      flag: 'story_lane_entertainment_adjacent',
    },
    {
      item: {
        title: "Dan Levy's New Crime Comedy Series Is A Must-Watch On Netflix",
        description: 'Dan Levy created Big Mistakes for Netflix.',
        contentHtml: '<p>Dan Levy created the 2026 crime comedy series Big Mistakes for Netflix.</p>',
      },
      mediaTitle: 'Big Mistakes',
      entityType: 'tv',
      eventType: 'other',
      flag: 'story_lane_core_auto_publish',
    },
    {
      item: {
        title: "Incredibles Director Brad Bird's Netflix Sci-Fi Movie Looks Like Everything We've Always Wanted",
        description: 'Ray Gunn is finally moving forward at Netflix.',
        contentHtml: '<p>Brad Bird is directing the sci-fi movie Ray Gunn for Netflix.</p>',
      },
      mediaTitle: 'Ray Gunn',
      entityType: 'movie',
      eventType: 'development',
      flag: 'story_lane_core_auto_publish',
    },
  ];

  for (const entry of cases) {
    const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity(entry.item);
    if (entry.primarySubject) {
      assert.equal(canonical.primarySubject, entry.primarySubject, entry.item.title);
    }
    if (entry.mediaTitle) {
      assert.equal(canonical.mediaTitle, entry.mediaTitle, entry.item.title);
    }
    if (entry.entityType) {
      assert.equal(canonical.entityType, entry.entityType, entry.item.title);
    }
    assert.equal(canonical.eventType, entry.eventType, entry.item.title);
    assert.ok(canonical.ambiguityFlags?.includes(entry.flag), entry.item.title);
  }
});

test('targeted cleanup captions stay speaker-led, spoiler-safe, and package-clean', () => {
  const jimmyCaption = buildDeterministicRssCaption({
    article_title: "Jimmy Kimmel Jokes Zendaya Is Probably the Reason No One on 'Euphoria' Knows Its Future",
    event_type: 'interview_quote',
    primary_subject: 'Jimmy Kimmel',
    media_title: 'Euphoria',
    secondary_subject: 'Zendaya',
    supporting_facts: [],
  } as any, {
    articleTitle: "Jimmy Kimmel Jokes Zendaya Is Probably the Reason No One on 'Euphoria' Knows Its Future",
    feedName: 'TheWrap',
    summary: 'Jimmy Kimmel joked about Zendaya and Euphoria.',
    platform: 'X',
    canonicalEntity: {
      primarySubject: 'Jimmy Kimmel',
      mediaTitle: 'Euphoria',
      secondarySubject: 'Zendaya',
      entityType: 'person',
      confidence: 0.94,
      ambiguityFlags: ['story_family_person_commentary_on_project'],
      allowedEntities: ['Jimmy Kimmel', 'Euphoria', 'Zendaya'],
    },
  });
  assert.match(jimmyCaption, /^Jimmy Kimmel is weighing in on 'Euphoria'/);

  const spoilerCaption = buildDeterministicRssCaption({
    article_title: 'God-Tier Cosmic Marvel Character Spotted in Daredevil: Born Again',
    event_type: 'reveal',
    primary_subject: 'Daredevil: Born Again',
    media_title: 'Daredevil: Born Again',
    supporting_facts: [],
  } as any, {
    articleTitle: 'God-Tier Cosmic Marvel Character Spotted in Daredevil: Born Again',
    feedName: 'ComicBook',
    summary: 'A spoiler-heavy episode breakdown.',
    platform: 'X',
    canonicalEntity: {
      primarySubject: 'Daredevil: Born Again',
      mediaTitle: 'Daredevil: Born Again',
      entityType: 'tv',
      confidence: 0.94,
      ambiguityFlags: ['story_policy_spoiler_sensitive', 'story_lane_core_manual_review_spoiler_safe'],
      allowedEntities: ['Daredevil: Born Again'],
    },
  });
  assert.match(spoilerCaption, /spoiler-sensitive new update/i);
  assert.doesNotMatch(spoilerCaption, /god-tier|marvel character spotted/i);

  const firstLookCaption = buildDeterministicRssCaption({
    article_title: "Sullivan's Crossing Season 4 First Look: Liam's Arrival Brings 'Tension' For Maggie And Cal (Exclusive)",
    event_type: 'first_look',
    primary_subject: "Sullivan's Crossing",
    media_title: "Sullivan's Crossing",
    supporting_facts: [],
  } as any, {
    articleTitle: "Sullivan's Crossing Season 4 First Look: Liam's Arrival Brings 'Tension' For Maggie And Cal (Exclusive)",
    feedName: 'TVLine',
    summary: 'New images preview season 4.',
    platform: 'X',
    canonicalEntity: {
      primarySubject: "Sullivan's Crossing",
      mediaTitle: "Sullivan's Crossing",
      entityType: 'tv',
      confidence: 0.95,
      ambiguityFlags: ['story_family_visual_reveal_event', 'story_policy_article_image_first'],
      allowedEntities: ["Sullivan's Crossing"],
    },
  });
  assert.match(firstLookCaption, /New first-look images from 'Sullivan's Crossing'/);
  assert.doesNotMatch(firstLookCaption, /Exclusive|Tension/);
});

test('spoiler-safe manual-review lane blocks default publish validation', () => {
  const result = __rssAuditTestUtils.validateRSSFinalPublishState(
    "A spoiler-sensitive new update from 'Daredevil: Born Again' is headed to manual review.",
    [],
    {
      primarySubject: 'Daredevil: Born Again',
      mediaTitle: 'Daredevil: Born Again',
      entityType: 'tv',
      confidence: 0.94,
      ambiguityFlags: ['story_policy_spoiler_sensitive', 'story_lane_core_manual_review_spoiler_safe'],
      allowedEntities: ['Daredevil: Born Again'],
    } as any,
    {
      articleTitle: 'God-Tier Cosmic Marvel Character Spotted in Daredevil: Born Again',
      feedName: 'ComicBook',
      summary: 'A spoiler-heavy episode breakdown.',
      articleBody: 'A spoiler-heavy episode breakdown.',
      allowedEntities: ['Daredevil: Born Again'],
    }
  );

  assert.equal(result.valid, false);
  assert.ok(result.reasonCodes.includes('SPOILER_SAFE_MANUAL_REVIEW_REQUIRED'));
});

test('person-commentary stories keep the speaker as the primary visual subject', () => {
  const analysis = guessPrimarySubject({
    title: "Jimmy Kimmel Jokes Zendaya Is Probably the Reason No One on 'Euphoria' Knows Its Future",
    description: 'Jimmy Kimmel joked about Euphoria and Zendaya.',
    contentHtml: '<p>Jimmy Kimmel joked about Zendaya while talking about Euphoria.</p>',
    canonicalEntity: {
      primarySubject: 'Jimmy Kimmel',
      mediaTitle: 'Euphoria',
      secondarySubject: 'Zendaya',
      entityType: 'person',
      namedPeople: ['Jimmy Kimmel', 'Zendaya'],
      ambiguityFlags: ['story_family_person_commentary_on_project'],
    },
  } as any);

  assert.equal(analysis.primarySubject.name, 'Jimmy Kimmel');
  assert.equal(analysis.primarySubject.type, 'actor');
  assert.equal(analysis.contextType, 'interview');
  assert.ok(analysis.secondarySubjects.includes('Euphoria'));
});

test('targeted cleanup image policies prefer reveal stills and cast portraits in the expected lanes', () => {
  assert.equal(shouldUseFeedFallbackImages({
    title: "Sullivan's Crossing Season 4 First Look: Liam's Arrival Brings 'Tension' For Maggie And Cal (Exclusive)",
    description: 'First-look gallery.',
    canonicalEntity: {
      mediaTitle: "Sullivan's Crossing",
      ambiguityFlags: ['story_policy_article_image_first'],
    },
  } as any), true);

  const seriesOrderPlan = determineSmartImagePlan({
    title: "CBS Orders Vampire Comedy Eternally Yours To Series, Scraps Kate Walsh's The Tillbrooks",
    description: 'CBS ordered Eternally Yours to series.',
  } as any, projectAnalysis({
    canonicalEntity: {
      primarySubject: 'Eternally Yours',
      mediaTitle: 'Eternally Yours',
      entityType: 'tv',
      namedPeople: ['Ed Weeks', 'Allegra Edwards'],
      ambiguityFlags: ['story_policy_early_project_cast_portraits'],
    },
    primarySubject: { name: 'Eternally Yours', type: 'tv_show' },
    contextProject: 'Eternally Yours',
    secondarySubjects: ['Ed Weeks', 'Allegra Edwards', 'CBS'],
    relevantStudios: ['CBS'],
  }));
  assert.equal(seriesOrderPlan.primary.intent, 'person_portrait');
  assert.ok(seriesOrderPlan.secondary);
  assert.equal(seriesOrderPlan.secondary?.intent, 'person_portrait');
});

test('obituary stories stay person-led even when project references appear in the headline', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "John Nolan Dies: 'Dark Knight Rises' & 'Person of Interest' Actor Was 87",
    description: 'John Nolan has died at 87 after a long acting career.',
    contentHtml: '<p>John Nolan, the actor known for The Dark Knight Rises and Person of Interest, has died at 87.</p>',
  });

  assert.equal(canonical.entityType, 'person');
  assert.equal(canonical.primarySubject, 'John Nolan');
  assert.equal(canonical.eventType, 'obituary');
});

test('secondary logo assets do not invalidate a matching primary project image', () => {
  const codes = __rssAuditTestUtils.getRSSImageReasonCodes([
    {
      url: 'https://image.tmdb.org/backdrop.jpg',
      source: 'tmdb',
      reason: 'TMDb backdrop for Malcolm in the Middle',
    },
    {
      url: 'https://image.tmdb.org/logo.jpg',
      source: 'tmdb',
      reason: 'TMDb logo for Malcolm in the Middle',
    },
  ], {
    primarySubject: 'Malcolm in the Middle',
    mediaTitle: 'Malcolm in the Middle',
    entityType: 'tv',
    allowedEntities: ['Malcolm in the Middle'],
  } as any);

  assert.equal(codes.includes('IMAGE_CANONICAL_ENTITY_MISMATCH'), false);
  assert.equal(codes.includes('IMAGE_LOGO_OVERUSE'), false);
});

test('company logo misuse produces a targeted fix suggestion', () => {
  const result = auditResult({
    image: {
      mode: 'single',
      primarySubject: 'Hacks',
      selectedImages: [],
      tmdbQueries: [],
      tmdbCandidates: [],
      failureCodes: ['IMAGE_COMPANY_LOGO_MISUSED'],
    },
  });

  const diagnostics = buildDiagnosisAndFixes(result);
  assert.match(diagnostics.diagnosis.join(' '), /logo-like asset/);
  assert.ok(diagnostics.recommendedFixes.some((fix) => /Block company logos/.test(fix)));
});

test('caption HTML entity leak is mapped into audit failure taxonomy', () => {
  const codes = getRSSCaptionHardInvalidReasonCodes('Disney&#8217;s layoffs continue.', {
    articleTitle: 'Disney layoffs continue',
    feedName: 'Variety',
    summary: 'Disney layoffs continue.',
    platform: 'X',
    canonicalEntity: {
      primarySubject: 'Disney',
      entityType: 'company',
      confidence: 0.9,
      allowedEntities: ['Disney'],
    },
  });

  assert.ok(codes.includes('CAPTION_CONTAINS_HTML_ENTITY'));
});

test('caption broken quote detection remains available to the audit layer', () => {
  const codes = getRSSCaptionHardInvalidReasonCodes('Olivia Munn comments on the show.\n\n"fell in love with"', {
    articleTitle: 'Olivia Munn comments on The Drew Barrymore Show',
    feedName: 'Deadline',
    summary: 'Olivia Munn comments on the show.',
    platform: 'X',
    canonicalEntity: {
      primarySubject: 'Olivia Munn',
      entityType: 'person',
      confidence: 0.9,
      allowedEntities: ['Olivia Munn', 'The Drew Barrymore Show'],
    },
  });

  assert.ok(codes.includes('CAPTION_BROKEN_QUOTE'));
});

test('person-led captions reject dangling quote fragments and missing lead subject', () => {
  const caption = `'Hated' Eric Dane has spoken about 'Fist Fight'.\n\n"the late Eric Dane when they first met and said they almost had a"`;
  const context = {
    articleTitle: "Dax Shepard 'Hated' Eric Dane at First, Says They Almost Had a 'Fist Fight' Outside an AA Meeting",
    feedName: 'Variety',
    summary: 'Dax Shepard says he and Eric Dane nearly got into a fist fight when they first met.',
    platform: 'Facebook',
    canonicalEntity: {
      primarySubject: 'Dax Shepard',
      secondarySubject: 'Eric Dane',
      entityType: 'person',
      confidence: 0.92,
      namedPeople: ['Dax Shepard', 'Eric Dane'],
      allowedEntities: ['Dax Shepard', 'Eric Dane'],
    },
  } as any;

  assert.equal(hasDanglingRSSQuoteLine(caption), true);
  assert.equal(hasMissingRSSPersonLeadSubject(caption, context), true);
  assert.equal(failsRSSCaptionFormatting(caption, context), true);
});

test('person-led secondary images prefer supporting people over unrelated concept stills', () => {
  const analysis = projectAnalysis({
    editorialPrimary: 'Dax Shepard',
    primarySubject: { name: 'Dax Shepard', type: 'actor' },
    canonicalEntity: {
      primarySubject: 'Dax Shepard',
      secondarySubject: 'Eric Dane',
      entityType: 'person',
      namedPeople: ['Dax Shepard', 'Eric Dane'],
      confidence: 0.92,
      ambiguityFlags: ['article_family_person_interview_or_reaction'],
    },
    visualSubject: 'Dax Shepard',
    imageIntent: 'person_portrait',
    secondarySubjects: ['Eric Dane'],
    contextType: 'interview',
    contextProject: null,
  });

  assert.equal(getPersonLedSupportingSecondarySubject(analysis), 'Eric Dane');
  assert.equal(shouldRestrictPersonLedSecondaryToPeople(analysis, 'person'), true);
  assert.equal(
    shouldKeepSecondaryCarouselImage(
      { url: 'https://image.test/dax.jpg', reason: 'TMDb person profile for Dax Shepard', score: 340 },
      { url: 'https://image.test/fight.jpg', reason: 'boxing fighter in ring', score: 336 },
      { analysis, primaryRole: 'person', secondaryRole: 'still' },
    ),
    false,
  );
});

test('caption punctuation rewrite removes publisher wrapper spoiler phrasing and balances quotes', () => {
  const caption = __rssCaptionTestUtils.enforceRSSCaptionPunctuation('SPOILER ALERT: This article contains spoilers for "Malcolm in the Middle: Life\'s Still Unfair "');

  assert.equal(caption, 'Spoilers ahead for "Malcolm in the Middle: Life\'s Still Unfair."');
});

test('obituary deterministic captions lead with the person rather than a referenced project', () => {
  const context = {
    articleTitle: "John Nolan Dies: 'Dark Knight Rises' & 'Person of Interest' Actor Was 87",
    summary: 'John Nolan, the actor who starred in The Dark Knight Rises and Person of Interest, has died. He was 87.',
    articleBody: 'John Nolan has died at 87. He appeared in The Dark Knight Rises and Person of Interest.',
    feedName: 'Deadline',
    platform: 'Facebook',
    canonicalEntity: {
      primarySubject: 'John Nolan',
      secondarySubject: 'The Dark Knight Rises',
      mediaTitle: 'The Dark Knight Rises',
      entityType: 'person',
      eventType: 'obituary',
      namedPeople: ['John Nolan'],
      allowedEntities: ['John Nolan', 'The Dark Knight Rises', 'Person of Interest'],
      confidence: 0.95,
    },
  } as any;
  const extraction = __rssCaptionTestUtils.buildHeuristicRssCaptionExtraction(context);
  const caption = __rssCaptionTestUtils.buildDeterministicRssCaption(extraction, context);

  assert.match(caption, /^John Nolan has died at 87\./);
  assert.doesNotMatch(caption, /^'Dark Knight Rises' has a new update\./);
});

test('duplicate-event grouping clusters same story across sources', () => {
  const groups = buildDuplicateGroups([
    auditResult({
      caseId: 'variety',
      input: {
        sourceName: 'Variety',
        feedUrl: 'https://variety.com/feed',
        articleUrl: 'https://variety.com/extraction-3',
        articleTitle: "Chris Hemsworth's Extraction 3 Confirmed At Netflix",
        articleDescription: "Chris Hemsworth will return for Netflix's Extraction 3.",
        articleBody: '<p>Sam Hargrave will direct the sequel.</p>',
      },
    }),
    auditResult({
      caseId: 'deadline',
      input: {
        sourceName: 'Deadline',
        feedUrl: 'https://deadline.com/feed',
        articleUrl: 'https://deadline.com/extraction-3',
        articleTitle: "Chris Hemsworth is set to return for Netflix's Extraction 3",
        articleDescription: 'Sam Hargrave is returning to direct.',
        articleBody: '<p>Netflix is moving forward with Extraction 3.</p>',
      },
    }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 2);
  assert.equal(groups[0].winningSource, 'Variety');
  assert.deepEqual(groups[0].suppressedSources, ['Deadline']);
  assert.match(groups[0].duplicateEventKey, /development\|extraction 3/i);
});

test('duplicate-event decision suppresses lower-priority matching source and keeps winner metadata', () => {
  const decision = __rssAuditTestUtils.resolveRSSDuplicateEventDecision('ComicBook', {
    title: "Chris Hemsworth is set to return for Netflix's Extraction 3",
    link: 'https://comicbook.com/extraction-3',
    description: 'Sam Hargrave is returning to direct.',
    contentHtml: '<p>Netflix is moving forward with Extraction 3.</p>',
    imageUrls: [],
    pubDate: new Date('2026-04-10T12:00:00.000Z'),
    canonicalEntity: {
      primarySubject: 'Extraction 3',
      mediaTitle: 'Extraction 3',
      entityType: 'movie',
      eventType: 'development',
    } as any,
  } as any, [
    {
      feedName: 'Variety',
      title: "Chris Hemsworth's Extraction 3 Confirmed At Netflix",
      link: 'https://variety.com/extraction-3',
      timestamp: new Date('2026-04-10T09:00:00.000Z').getTime(),
      status: 'published',
      fingerprint: __rssAuditTestUtils.buildRSSNewsEventFingerprint({
        title: "Chris Hemsworth's Extraction 3 Confirmed At Netflix",
        link: 'https://variety.com/extraction-3',
        description: "Chris Hemsworth will return for Netflix's Extraction 3.",
        contentHtml: '<p>Sam Hargrave will direct the sequel.</p>',
        imageUrls: [],
        pubDate: new Date('2026-04-10T09:00:00.000Z'),
        canonicalEntity: {
          primarySubject: 'Extraction 3',
          mediaTitle: 'Extraction 3',
          entityType: 'movie',
          eventType: 'development',
        } as any,
      } as any),
    },
  ]);

  assert.ok(decision);
  assert.equal(decision?.winningSource, 'Variety');
  assert.deepEqual(decision?.suppressedSources, ['ComicBook']);
  assert.match(decision?.duplicateEventKey || '', /development\|extraction 3/i);
});

test('obituary duplicate-event decision ignores movie vs tv project tagging when the person and death event match', () => {
  const decision = __rssAuditTestUtils.resolveRSSDuplicateEventDecision('Deadline', {
    title: "John Nolan Dies: 'Dark Knight Rises' & 'Person of Interest' Actor Was 87",
    link: 'https://deadline.com/john-nolan-tv',
    description: 'John Nolan has died at 87.',
    contentHtml: '<p>John Nolan, known for Person of Interest, has died at 87.</p>',
    imageUrls: [],
    pubDate: new Date('2026-04-12T08:00:00.000Z'),
    canonicalEntity: {
      primarySubject: 'John Nolan',
      mediaTitle: 'Person of Interest',
      entityType: 'tv',
      eventType: 'obituary',
      namedPeople: ['John Nolan'],
    } as any,
  } as any, [
    {
      feedName: 'Deadline',
      title: "John Nolan Dies: 'Dark Knight Rises' Actor Was 87",
      link: 'https://deadline.com/john-nolan-movie',
      timestamp: new Date('2026-04-12T07:55:00.000Z').getTime(),
      status: 'published',
      fingerprint: __rssAuditTestUtils.buildRSSNewsEventFingerprint({
        title: "John Nolan Dies: 'Dark Knight Rises' Actor Was 87",
        link: 'https://deadline.com/john-nolan-movie',
        description: 'John Nolan has died at 87.',
        contentHtml: '<p>John Nolan, known for The Dark Knight Rises, has died at 87.</p>',
        imageUrls: [],
        pubDate: new Date('2026-04-12T07:55:00.000Z'),
        canonicalEntity: {
          primarySubject: 'John Nolan',
          mediaTitle: 'The Dark Knight Rises',
          entityType: 'movie',
          eventType: 'obituary',
          namedPeople: ['John Nolan'],
        } as any,
      } as any),
    },
  ]);

  assert.ok(decision);
  assert.match(decision?.duplicateEventKey || '', /obituary\|john nolan\|87/i);
  assert.deepEqual(decision?.suppressedSources, ['Deadline']);
});

test('report aggregation ranks failure codes and patch recommendations', () => {
  const report = buildRssAuditReport([
    auditResult({
      caseId: 'a',
      image: {
        mode: 'single',
        selectedImages: [],
        tmdbQueries: [],
        tmdbCandidates: [{
          title: 'Brent Forever: Live From Brooklyn Paramount',
          accepted: false,
          rejectionReasons: ['zero canonical token overlap'],
        }],
        failureCodes: ['IMAGE_TMBD_CANDIDATE_ZERO_TOKEN_OVERLAP'],
      },
      publishBlocked: true,
    }),
    auditResult({
      caseId: 'b',
      input: {
        sourceName: 'ComicBook',
        feedUrl: 'https://comicbook.com/feed',
        articleUrl: 'https://comicbook.com/article',
        articleTitle: 'Chris Hemsworth Extraction 3 Confirmed At Netflix',
      },
      image: {
        mode: 'single',
        selectedImages: [],
        tmdbQueries: [],
        tmdbCandidates: [],
        failureCodes: ['IMAGE_TMBD_CANDIDATE_ZERO_TOKEN_OVERLAP'],
      },
      publishBlocked: true,
    }),
  ]);

  assert.equal(report.totalArticles, 2);
  assert.equal(report.topFailureCodes[0].code, 'IMAGE_TMBD_CANDIDATE_ZERO_TOKEN_OVERLAP');
  assert.equal(report.topFailureCodes[0].count, 2);
  assert.match(report.recommendedPatches[0].recommendation, /canonical token overlap/);
});
