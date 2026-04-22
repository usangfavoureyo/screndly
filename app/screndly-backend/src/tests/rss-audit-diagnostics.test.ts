import test from 'node:test';
import assert from 'node:assert/strict';
import { __rssCaptionTestUtils } from '../services/ai.service';
import { __rssImageSelectionTestUtils } from '../services/rss-image-selection.service';
import { __rssAuditTestUtils } from '../services/rss.service';
import { __rssEditorialBrainTestUtils } from '../services/rss-editorial-brain.service';
import { __rssTmdbDisambiguationTestUtils } from '../services/rss-tmdb-image-selection.service';
import { buildDuplicateGroups, buildRssAuditReport } from '../audit/rss-audit-report';
import { analyzeRssAuditCase, buildDiagnosisAndFixes, getRssAuditImageResolverOptions, hasCanonicalTokenOverlap } from '../audit/rss-audit-runner';
import type { RssAuditResult } from '../audit/rss-audit-types';

const { getRSSCaptionHardInvalidReasonCodes, headlineAnchorsToCoreProject, failsRSSCaptionFormatting, hasDanglingRSSQuoteLine, hasMissingRSSPersonLeadSubject, buildDeterministicRssCaption, buildRSSPublishSafeDeterministicResult, classifyRSSFallbackPath } = __rssCaptionTestUtils;
const { validateImageCandidate, shouldRestrictPersonLedSecondaryToPeople, getPersonLedSupportingSecondarySubject, shouldKeepSecondaryCarouselImage, shouldUseFeedFallbackImages, determineSmartImagePlan, guessPrimarySubject, canUseExplicitFeedFallback } = __rssImageSelectionTestUtils;
const { titleCandidateMatchesResolvedContext, isExactResolvedProjectTitle } = __rssTmdbDisambiguationTestUtils;
const { computeRssEditorialBrainDisagreements, normalizeRssEditorialBrainDecision, buildRssEditorialBrainContentHash } = __rssEditorialBrainTestUtils;
const {
  buildCompressedRssEditorialBrainEvidencePacket,
  planRssEditorialBrainInvocation,
  buildRSSEditorialBrainImageStrategyCalibration,
  selectRSSEditorialBrainPromotedImageStrategy,
  applyRSSEditorialBrainImageStrategyPromotion,
  buildRSSEditorialBrainCaptionStrategyCalibration,
  selectRSSEditorialBrainPromotedCaptionStrategy,
  applyRSSRuntimeDiagnosticsToItem,
  buildRSSActivityItemFromFeedRecord,
  parseRSSActivityLog,
} = __rssAuditTestUtils;

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
    undefined,
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

test('final RSS caption sanitizer removes excerpt markers and clips at sentence boundaries', () => {
  const sanitized = __rssAuditTestUtils.sanitizeRSSCaptionText(
    "Spoilers ahead for 'Rooster' Episode 6 as Greg Russo's story takes a complicated turn, while Steve Carell's Greg Russo connects the dots of who her son is, Danielle Deadwyler's [...]",
    170
  );

  assert.doesNotMatch(sanitized, /\[\.\.\.\]|…|\.\.\./);
  assert.match(sanitized, /[.!?]$/);
  assert.ok(sanitized.length <= 170);
});

test('publish validation blocks non-publisher fallback captions', () => {
  const result = __rssAuditTestUtils.validateRSSFinalPublishState(
    "'Euphoria' has a new release date. The Season 3 premiere of the show had tribute screen reads [...]",
    [],
    {
      primarySubject: 'Euphoria',
      mediaTitle: 'Euphoria',
      entityType: 'tv',
      confidence: 0.95,
      ambiguityFlags: [],
      allowedEntities: ['Euphoria', 'Angus Cloud', 'Eric Dane', 'Kevin Turen'],
    } as any,
    'excerpt_fallback',
    {
      articleTitle: "'Euphoria' Season 3 Paid Tribute to Angus Cloud, Eric Dane and Kevin Turen",
      feedName: 'The Wrap',
      summary: "The premiere includes tribute cards for Angus Cloud, Eric Dane, and Kevin Turen.",
      articleBody: "The premiere includes tribute cards for Angus Cloud, Eric Dane, and Kevin Turen.",
      allowedEntities: ['Euphoria', 'Angus Cloud', 'Eric Dane', 'Kevin Turen'],
    }
  );

  assert.equal(result.valid, false);
  assert.ok(result.reasonCodes.includes('CAPTION_NON_PUBLISHER_FALLBACK'));
});

test('publish validation allows deterministic captions that are already publisher-safe for early-project casting stories', () => {
  const result = __rssAuditTestUtils.validateRSSFinalPublishState(
    "'Paradise' Season 3 has added Julianna Margulies.\n\nProduction is now underway.",
    [
      {
        url: 'https://example.com/julianna.jpg',
        reason: 'Primary cast portrait for Julianna Margulies',
        source: 'tmdb',
      },
    ] as any,
    {
      primarySubject: 'Paradise',
      mediaTitle: 'Paradise',
      secondarySubject: 'Julianna Margulies',
      entityType: 'tv',
      confidence: 0.95,
      ambiguityFlags: ['story_policy_early_project_cast_portraits'],
      allowedEntities: ['Paradise', 'Julianna Margulies'],
    } as any,
    'deterministic_template',
    {
      articleTitle: "'Paradise' Season 3 Casts Julianna Margulies",
      feedName: 'Variety',
      summary: 'Julianna Margulies has joined the cast of Paradise Season 3.',
      articleBody: 'Julianna Margulies has joined the cast of Paradise Season 3. Production is now underway.',
      allowedEntities: ['Paradise', 'Julianna Margulies'],
    }
  );

  assert.equal(result.reasonCodes.includes('CAPTION_NON_PUBLISHER_FALLBACK'), false);
});

test('RSS fallback path classifier detects excerpt-style leakage', () => {
  assert.equal(
    classifyRSSFallbackPath("This piece contains spoilers for 'Rooster' Episode 6. [...]"),
    'excerpt_fallback'
  );
  assert.equal(
    classifyRSSFallbackPath("'Rooster' returns for Season 2 at HBO."),
    'deterministic_template'
  );
});

test('publisher-safe deterministic captions are promoted out of fallback mode when they satisfy caption rules', () => {
  const context = {
    articleTitle: 'Amazon Prime Video Sets Clarkson’s Farm Season 5 Premiere Date',
    feedName: 'Deadline',
    summary: 'Clarkson’s Farm will return for a fifth season on Prime Video.',
    articleBody: 'Prime Video confirmed Clarkson’s Farm will return for Season 5.',
    platform: 'Facebook',
    canonicalEntity: {
      primarySubject: "Clarkson's Farm",
      mediaTitle: "Clarkson's Farm",
      entityType: 'tv',
      eventType: 'release_date',
      confidence: 0.94,
      allowedEntities: ["Clarkson's Farm", 'Prime Video'],
      ambiguityFlags: [],
    },
    allowedEntities: ["Clarkson's Farm", 'Prime Video'],
  } as any;

  const deterministic = "'Clarkson's Farm' has a new premiere update.\n\nPrime Video has confirmed the Season 5 return.";
  const promoted = buildRSSPublishSafeDeterministicResult(deterministic, context);

  assert.equal(promoted.path, 'repaired_caption');
  assert.doesNotMatch(promoted.caption, /\[\.\.\.\]|This article|This piece/i);
});

test('RSS caption system prompt preserves saved settings prompt as the authoritative instruction block', () => {
  const systemPrompt = __rssAuditTestUtils.buildRSSCaptionSystemPrompt(
    'CUSTOM CULTURE CRAVE PROMPT',
    {
      tone: 'Engaging',
      maxLength: 800,
      speculationAssessment: null,
    }
  );

  assert.match(systemPrompt || '', /CUSTOM CULTURE CRAVE PROMPT/);
  assert.match(systemPrompt || '', /saved RSS caption prompt above is authoritative/i);
  assert.match(systemPrompt || '', /Keep the final caption under 800 characters/i);
});

test('newly announced renamed TV projects recover current canonical title and allow cast-led image fallback', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: 'Jonathan Pryce & Penelope Wilton Starring In ITV Drama About Mavis Eccleston, Who Survived A Joint Suicide Pact With Her Husband & Was Accused Of His Murder',
    description: 'EXCLUSIVE: Oscar-nominee Jonathan Pryce and Penelope Wilton are teaming on an ITV drama.',
    contentHtml: `
      <p><strong>Mavis Eccleston</strong> is based on the real-life story of the titular character, who will be played by Wilton.</p>
      <p>Jonathan Pryce also stars in the ITV drama.</p>
      <p>Britney first met Eccleston and bought the story rights after the project was initially titled <em>Goodnight Darling</em>.</p>
    `,
  });

  assert.equal(canonical.mediaTitle, 'Mavis Eccleston');
  assert.equal(canonical.primarySubject, 'Mavis Eccleston');
  assert.equal(canonical.entityType, 'tv');
  assert.equal(canonical.eventType, 'casting');
  assert.ok(canonical.namedPeople?.includes('Jonathan Pryce'));
  assert.ok(canonical.namedPeople?.includes('Penelope Wilton'));
  assert.ok(canonical.ambiguityFlags?.includes('story_policy_early_project_cast_portraits'));

  const article = {
    title: 'Jonathan Pryce & Penelope Wilton Starring In ITV Drama About Mavis Eccleston, Who Survived A Joint Suicide Pact With Her Husband & Was Accused Of His Murder',
    description: 'EXCLUSIVE: Oscar-nominee Jonathan Pryce and Penelope Wilton are teaming on an ITV drama.',
    contentHtml: `
      <p><strong>Mavis Eccleston</strong> is based on the real-life story of the titular character, who will be played by Wilton.</p>
      <p>Jonathan Pryce also stars in the ITV drama.</p>
      <p>The project was initially titled <em>Goodnight Darling</em>.</p>
    `,
    canonicalEntity: canonical,
    fallbackImages: [
      'https://example.com/jonathan-penelope-deadline.jpg',
    ],
  } as any;

  const analysis = guessPrimarySubject(article);
  const plan = determineSmartImagePlan(article, analysis);

  assert.equal(plan.primary.intent, 'person_portrait');
  assert.ok(plan.secondary);
  assert.equal(plan.primary.subject, 'Jonathan Pryce');
  assert.equal(canUseExplicitFeedFallback(analysis, plan.primary), true);
});

test('single-person early project announcements still enable cast-led image fallback', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "'Good Boy's Ben Leonberg To Direct Horror Film 'Ankle Snatcher' For Sony Pictures",
    description: 'EXCLUSIVE: Ben Leonberg has inked a deal to direct Ankle Snatcher for Sony Pictures.',
    contentHtml: `
      <p>Ben Leonberg will direct the horror film <em>Ankle Snatcher</em> for Sony Pictures.</p>
      <p>The project is in development with Leonberg attached to direct.</p>
    `,
  });

  assert.equal(canonical.mediaTitle, 'Ankle Snatcher');
  assert.ok(canonical.namedPeople?.includes('Ben Leonberg'));
  assert.ok(canonical.ambiguityFlags?.includes('story_policy_early_project_cast_portraits'));
});

test('person-led moviemaking commentary canonicals promote the speaker instead of quoted junk fragments', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Shawn Levy Says AI Will Become an 'Essential Tool' for Moviemaking but He Hasn't 'Incorporated' It in 'Any Meaningful Way' Yet",
    description: "Director Shawn Levy has wrapped and is in post-production on 'Star Wars: Starfighter.'",
    contentHtml: '<p>Director Shawn Levy has wrapped and is in post-production on Star Wars: Starfighter. He said AI will become an essential tool for moviemaking but has not incorporated it in any meaningful way yet.</p>',
  });

  assert.equal(canonical.primarySubject, 'Shawn Levy');
  assert.equal(canonical.entityType, 'person');
  assert.ok(canonical.ambiguityFlags?.includes('story_family_person_commentary_on_project'));
  assert.notEqual(canonical.secondarySubject, 'Will Become');
});

test('overall-deal stories are not misclassified as shopping and keep a person-led business lane', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Rachel Shukert Strikes Overall Deal With UCP; 'Listen For The Lie' & 'Summer Sisters' Adaptations In The Works At Peacock",
    description: 'Rachel Shukert is staying in business with UCP.',
    contentHtml: "<p>EXCLUSIVE: Rachel Shukert, fresh from writing and exec producing Peacock's The Burbs, is staying in business with UCP under a new overall deal.</p>",
  });

  assert.equal(canonical.primarySubject, 'Rachel Shukert');
  assert.ok(canonical.ambiguityFlags?.includes('article_family_business_or_platform'));
  assert.ok(canonical.ambiguityFlags?.includes('story_policy_entertainment_business_person_first'));
  assert.ok(!canonical.ambiguityFlags?.includes('article_family_shopping_or_product'));
});

test('quoted early-project casting headlines recover the project title instead of leaving the canonical weak', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Melissa McCarthy In Talks To Star In Thriller 'Turpentine' From Director Craig Zobel; T-Street & ShivHans Pictures Producing",
    description: 'Melissa McCarthy is in talks to star in Turpentine, a new thriller.',
    contentHtml: '<p>EXCLUSIVE: Melissa McCarthy is in talks to star in Turpentine, a new thriller from director Craig Zobel.</p>',
  });

  assert.equal(canonical.primarySubject, 'Turpentine');
  assert.equal(canonical.mediaTitle, 'Turpentine');
  assert.ok(canonical.ambiguityFlags?.includes('story_policy_early_project_cast_portraits'));
});

test('media-business and event-only live articles route out before core image resolution', () => {
  const samAltman = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: 'OpenAI CEO Sam Altman Says AI in Hollywood Will Get People to “Care More About Human Creators, Not Less”',
    description: 'The OpenAI CEO spoke about AI and creators in Hollywood.',
    contentHtml: '<p>Sam Altman discussed AI in Hollywood and creator economics.</p>',
  });
  assert.ok(samAltman.ambiguityFlags?.includes('story_lane_ignore_completely'));

  const marvelSdcc = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: 'Marvel Officially Returning To San Diego Comic-Con After Shocking 2025 Absence',
    description: 'Marvel Studios is heading back to Comic-Con this summer.',
    contentHtml: '<p>The studio confirmed its return to San Diego Comic-Con.</p>',
  });
  assert.ok(marvelSdcc.ambiguityFlags?.includes('story_lane_entertainment_adjacent'));
});

test('fresh live hygiene routes festival lineup and speculative crossover items out before project image resolution', () => {
  const tribeca = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Tribeca Festival Announces 2026 TV and Podcast Lineup, Spotlighting 'Survivor 50' Panel",
    description: 'The 2026 Tribeca Festival unveiled its television and podcast lineup.',
    contentHtml: '<p>Tribeca announced a lineup featuring Survivor 50.</p>',
  });
  assert.ok(tribeca.ambiguityFlags?.includes('story_lane_entertainment_adjacent'));
  assert.ok(tribeca.ambiguityFlags?.includes('rss_family_no_tmdb_project'));

  const wednesday = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: 'New Look at Wednesday Season 3 Reveals Major Change & Sparks Calls for a Wild Netflix Crossover',
    description: 'Things are changing for Jenna Ortega’s Wednesday Addams.',
    contentHtml: '<p>The new images sparked crossover speculation.</p>',
  });
  assert.ok(wednesday.ambiguityFlags?.includes('story_lane_entertainment_adjacent'));
});

test('targeted live hygiene keeps valid casting and sales stories publishable with clean deterministic captions', () => {
  const naomiCaption = buildDeterministicRssCaption({
    article_title: "Naomi Ackie, Alison Oliver and Eanna Hardwicke to Star in Luna Carmoon's 'To Make Ends Meet'",
    event_type: 'casting',
    primary_subject: 'To Make Ends Meet',
    media_title: 'To Make Ends Meet',
    named_people: ['Naomi Ackie', 'Alison Oliver', 'Eanna Hardwicke', 'Luna Carmoon'],
  } as any, {
    articleTitle: "Naomi Ackie, Alison Oliver and Eanna Hardwicke to Star in Luna Carmoon's 'To Make Ends Meet'",
    feedName: 'Variety',
    summary: 'Naomi Ackie, Alison Oliver and Eanna Hardwicke will star in the feature.',
    platform: 'Facebook',
    canonicalEntity: {
      primarySubject: 'To Make Ends Meet',
      mediaTitle: 'To Make Ends Meet',
      entityType: 'movie',
      confidence: 0.95,
      namedPeople: ['Naomi Ackie', 'Alison Oliver', 'Eanna Hardwicke', 'Luna Carmoon'],
      allowedEntities: ['To Make Ends Meet', 'Naomi Ackie', 'Alison Oliver', 'Eanna Hardwicke', 'Luna Carmoon'],
      ambiguityFlags: ['story_policy_early_project_cast_portraits'],
    },
    allowedEntities: ['To Make Ends Meet', 'Naomi Ackie', 'Alison Oliver', 'Eanna Hardwicke', 'Luna Carmoon'],
  } as any);
  assert.doesNotMatch(naomiCaption, /EXCLUSIVE|This article|This piece/i);
  assert.match(naomiCaption, /'To Make Ends Meet'/);
  assert.doesNotMatch(naomiCaption, /\[\.\.\.\]|EXCLUSIVE|This article|This piece/i);
});

test('obituary targeted overrides keep the person as canonical subject', () => {
  const alan = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: 'Alan Osmond Dies: Co-Founder Of Hit-Making Vocal Group The Osmonds Was 76',
    description: 'Alan Osmond, oldest brother of the famed singing and dancing sibling group The Osmonds, died Monday.',
    contentHtml: '<p>Alan Osmond died at 76.</p>',
  });

  assert.equal(alan.primarySubject, 'Alan Osmond');
  assert.equal(alan.mediaTitle, 'Alan Osmond');
  assert.equal(alan.entityType, 'person');
  assert.equal(alan.eventType, 'obituary');
});

test('casting caption templates stay project-led and do not leak the development alias', () => {
  const caption = buildDeterministicRssCaption({
    article_title: 'Jonathan Pryce & Penelope Wilton Starring In ITV Drama About Mavis Eccleston',
    event_type: 'casting',
    primary_subject: 'Mavis Eccleston',
    media_title: 'Mavis Eccleston',
    named_people: ['Jonathan Pryce', 'Penelope Wilton'],
    studio_or_platform: 'ITV',
    supporting_facts: ['Initially developed as Goodnight Darling'],
  } as any, {
    articleTitle: 'Jonathan Pryce & Penelope Wilton Starring In ITV Drama About Mavis Eccleston',
    feedName: 'Deadline',
    summary: 'Jonathan Pryce and Penelope Wilton will star in ITV drama Mavis Eccleston.',
    platform: 'X',
    canonicalEntity: {
      primarySubject: 'Mavis Eccleston',
      mediaTitle: 'Mavis Eccleston',
      entityType: 'tv',
      confidence: 0.94,
      namedPeople: ['Jonathan Pryce', 'Penelope Wilton'],
      allowedEntities: ['Mavis Eccleston', 'Jonathan Pryce', 'Penelope Wilton', 'ITV'],
      ambiguityFlags: ['story_policy_early_project_cast_portraits'],
    },
  } as any);

  assert.match(caption, /'Mavis Eccleston'/);
  assert.doesNotMatch(caption, /Goodnight Darling/);
  assert.doesNotMatch(caption, /EXCLUSIVE/i);
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

test('person-commentary image validation does not block speaker-led two-image commentary stories', () => {
  const codes = __rssAuditTestUtils.getRSSImageReasonCodes([
    {
      url: 'https://example.com/luca.jpg',
      reason: 'Primary speaker portrait for Luca Guadagnino',
      source: 'tmdb',
    },
    {
      url: 'https://example.com/timothee.jpg',
      reason: 'Supporting referenced person portrait for Timothee Chalamet',
      source: 'tmdb',
    },
  ] as any, {
    primarySubject: 'Luca Guadagnino',
    mediaTitle: 'Call Me by Your Name',
    secondarySubject: 'Timothee Chalamet',
    entityType: 'person',
    confidence: 0.95,
    ambiguityFlags: ['story_family_person_commentary_on_project'],
    allowedEntities: ['Luca Guadagnino', 'Timothee Chalamet', 'Call Me by Your Name'],
  } as any);

  assert.doesNotMatch(codes.join(','), /IMAGE_CANONICAL_ENTITY_MISMATCH/);
});

test('person-commentary image validation allows project fallback when the speaker portrait is unavailable', () => {
  const analysis = guessPrimarySubject({
    title: 'Ciara Miller Says Summer House Kind Of Has Left Her At A Loss For Words',
    description: 'Ciara Miller reflected on Summer House.',
    contentHtml: '<p>Ciara Miller reflected on Summer House and where things stand.</p>',
    canonicalEntity: {
      primarySubject: 'Ciara Miller',
      mediaTitle: 'Summer House',
      secondarySubject: 'Summer House',
      entityType: 'person',
      namedPeople: ['Ciara Miller'],
      ambiguityFlags: ['story_family_person_commentary_on_project'],
      allowedEntities: ['Ciara Miller', 'Summer House'],
    },
  } as any);

  const result = validateImageCandidate({
    imageUrl: 'https://image.tmdb.org/t/p/original/summer-house-backdrop.jpg',
    domain: 'www.themoviedb.org',
    title: 'Summer House official backdrop',
    source: 'TMDb',
    imageWidth: 1920,
    imageHeight: 1080,
  } as any, analysis);

  assert.equal(result.approved, true);
});

test('charlize theron ai commentary routes out of core with person-led image planning', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Charlize Theron Says 'In 10 Years, AI Is Going To Be Able To Do' Timothee Chalamet's Job, But It Will Not Be Able To Replace Live Performance Like Ballet",
    description: 'Charlize Theron discussed AI and live performance while mentioning Timothee Chalamet.',
    contentHtml: '<p>Charlize Theron reflected on AI, Timothee Chalamet and live performance.</p>',
  });

  assert.ok(canonical.ambiguityFlags?.includes('story_lane_entertainment_adjacent'));
  assert.ok(canonical.ambiguityFlags?.includes('editorial_brain_image_strategy_person_first'));

  const plan = determineSmartImagePlan({
    title: "Charlize Theron Says 'In 10 Years, AI Is Going To Be Able To Do' Timothee Chalamet's Job, But It Will Not Be Able To Replace Live Performance Like Ballet",
    description: 'Charlize Theron discussed AI and live performance while mentioning Timothee Chalamet.',
    contentHtml: '<p>Charlize Theron reflected on AI, Timothee Chalamet and live performance.</p>',
    canonicalEntity: canonical,
  } as any, guessPrimarySubject({
    title: "Charlize Theron Says 'In 10 Years, AI Is Going To Be Able To Do' Timothee Chalamet's Job, But It Will Not Be Able To Replace Live Performance Like Ballet",
    description: 'Charlize Theron discussed AI and live performance while mentioning Timothee Chalamet.',
    contentHtml: '<p>Charlize Theron reflected on AI, Timothee Chalamet and live performance.</p>',
    canonicalEntity: canonical,
  } as any));

  assert.equal(plan.primary.intent, 'person_portrait');
  assert.equal(plan.primary.subject, 'Charlize Theron');
});

test('nathalie baye obituary stays person-led and allows obituary feed fallback imagery', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Nathalie Baye Dies: French Actress Who Appeared In 'Catch Me If You Can' & 'Downton Abbey: A New Era' Was 77",
    description: 'Nathalie Baye has died at 77.',
    contentHtml: '<p>Nathalie Baye, the French actress known for Catch Me If You Can and Downton Abbey: A New Era, has died at 77.</p>',
  });

  assert.equal(canonical.entityType, 'person');
  assert.equal(canonical.primarySubject, 'Nathalie Baye');
  assert.equal(canonical.eventType, 'obituary');
  assert.ok(canonical.ambiguityFlags?.includes('story_policy_memorial_feed_fallback'));
});

test('the batman part ii charles dance casting story resolves as core with early project image fallback', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "'The Batman Part II': Charles Dance Joins Robert Pattinson In DC Studios Sequel",
    description: 'Charles Dance has joined the cast of The Batman Part II.',
    contentHtml: '<p>Charles Dance has joined Robert Pattinson in The Batman Part II.</p>',
  });

  assert.equal(canonical.mediaTitle, 'The Batman Part II');
  assert.equal(canonical.primarySubject, 'The Batman Part II');
  assert.equal(canonical.entityType, 'movie');
  assert.equal(canonical.eventType, 'casting');
  assert.ok(canonical.namedPeople?.includes('Charles Dance'));
  assert.ok(canonical.ambiguityFlags?.includes('story_policy_force_project_first_image'));
});

test('first-look reveal stories stay article-image-first even when project art is missing', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Jordan Firstman's Buzzy Cannes Debut 'Club Kid' Boarded By UTA Independent Film Group And Charades, Unveils First Look (EXCLUSIVE)",
    description: "Jordan Firstman's directorial debut starring a Cannes ensemble reveals its first look.",
    contentHtml: '<p>Variety unveils the first-look image for <em>Club Kid</em>.</p>',
  });

  assert.equal(canonical.mediaTitle, 'Club Kid');
  assert.equal(canonical.eventType, 'first_look');
  assert.ok(canonical.ambiguityFlags?.includes('story_family_visual_reveal_event'));
  assert.ok(canonical.ambiguityFlags?.includes('story_policy_article_image_first'));
});

test('clean trailer captions are not blocked by package-label residue once project resolution is correct', () => {
  const codes = getRSSCaptionHardInvalidReasonCodes(
    "A new trailer for 'The Hunger Games: Sunrise on the Reaping' has been released.\n\nThe latest preview offers a new look at the prequel.",
    {
      articleTitle: "'The Hunger Games: Sunrise on the Reaping' Trailer Reveals New Look At Prequel",
      feedName: 'ComicBook',
      summary: 'Ahead of its release later this year, The Hunger Games: Sunrise on the Reaping gives a new teaser.',
      articleBody: 'Ahead of its release later this year, the movie gets a new trailer.',
      platform: 'X',
      canonicalEntity: {
        primarySubject: 'The Hunger Games: Sunrise on the Reaping',
        mediaTitle: 'The Hunger Games: Sunrise on the Reaping',
        entityType: 'movie',
        confidence: 0.95,
        ambiguityFlags: ['story_policy_trailer_cleanup_tolerant'],
        allowedEntities: ['The Hunger Games: Sunrise on the Reaping', 'The Hunger Games'],
      },
      allowedEntities: ['The Hunger Games: Sunrise on the Reaping', 'The Hunger Games'],
    } as any
  );

  assert.doesNotMatch(codes.join(','), /CAPTION_ARTICLE_PACKAGE_LABEL|CAPTION_HEADLINE_JUNK/);
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
      entity: {
        canonicalEntity: 'Extraction 3',
        canonicalEntityType: 'movie',
        eventType: 'development',
        confidence: 0.9,
        ambiguityFlags: [],
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
      entity: {
        canonicalEntity: 'Extraction 3',
        canonicalEntityType: 'movie',
        eventType: 'development',
        confidence: 0.9,
        ambiguityFlags: [],
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
    canonicalEntityVersion: '2026-04-17-runtime-parity-1',
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
        canonicalEntityVersion: '2026-04-17-runtime-parity-1',
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

test('person-led commentary duplicate-event fingerprints collapse movie-vs-tv interpretation drift', () => {
  const movieFingerprint = __rssAuditTestUtils.buildRSSNewsEventFingerprint({
    title: "Shawn Levy Says AI Will Become an 'Essential Tool' for Moviemaking but He Hasn't 'Incorporated' It in 'Any Meaningful Way' Yet",
    link: 'https://variety.com/shawn-levy-ai-movie',
    description: "Director Shawn Levy has wrapped and is in post-production on 'Star Wars: Starfighter.'",
    contentHtml: '<p>Director Shawn Levy has wrapped and is in post-production on Star Wars: Starfighter.</p>',
    imageUrls: [],
    pubDate: new Date('2026-04-21T10:00:00.000Z'),
    canonicalEntity: {
      primarySubject: 'Shawn Levy',
      mediaTitle: 'Star Wars: Starfighter',
      entityType: 'movie',
      eventType: 'interview_quote',
      namedPeople: ['Shawn Levy'],
      ambiguityFlags: ['story_family_person_commentary_on_project'],
    } as any,
  } as any);

  const tvFingerprint = __rssAuditTestUtils.buildRSSNewsEventFingerprint({
    title: "Shawn Levy Says AI Will Become an 'Essential Tool' for Moviemaking but He Hasn't 'Incorporated' It in 'Any Meaningful Way' Yet",
    link: 'https://variety.com/shawn-levy-ai-tv',
    description: "Director Shawn Levy has wrapped and is in post-production on 'Star Wars: Starfighter.'",
    contentHtml: '<p>Director Shawn Levy has wrapped and is in post-production on Star Wars: Starfighter.</p>',
    imageUrls: [],
    pubDate: new Date('2026-04-21T10:05:00.000Z'),
    canonicalEntity: {
      primarySubject: 'Shawn Levy',
      mediaTitle: 'Star Wars: Starfighter',
      entityType: 'tv',
      eventType: 'interview_quote',
      namedPeople: ['Shawn Levy'],
      ambiguityFlags: ['story_family_person_commentary_on_project'],
    } as any,
  } as any);

  assert.equal(__rssAuditTestUtils.areRSSNewsEventsSimilar(movieFingerprint, tvFingerprint), true);
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

test('runtime parity recomputes stale stored canonical entities from older queue payloads', () => {
  const item = {
    title: "Jordan Firstman's Buzzy Cannes Debut 'Club Kid' Boarded By UTA Independent Film Group And Charades, Unveils First Look (EXCLUSIVE)",
    link: 'https://variety.com/club-kid',
    description: "Jordan Firstman's film 'Club Kid' unveiled a first look.",
    contentHtml: '<p>Variety has unveiled a first look at <em>Club Kid</em>.</p>',
    imageUrls: [],
    pubDate: new Date('2026-04-17T08:00:00.000Z'),
    canonicalEntity: {
      primarySubject: 'Jordan Firstman',
      mediaTitle: 'Jordan Firstman',
      entityType: 'person',
      eventType: 'other',
      ambiguityFlags: [],
    },
    canonicalEntityVersion: '2026-04-13-tail-fix',
  } as any;

  const runtimeState = __rssAuditTestUtils.getRSSCanonicalEntityRuntimeState(item);

  assert.equal(runtimeState.recomputed, true);
  assert.equal(runtimeState.canonicalEntity.mediaTitle, 'Club Kid');
  assert.ok(runtimeState.canonicalEntity.ambiguityFlags?.includes('story_family_visual_reveal_event'));
  assert.equal(item.canonicalEntityVersion, runtimeState.activeVersion);
});

test('runtime parity does not reuse stored captions from older queue payload versions', () => {
  const item = {
    title: "'Euphoria' season 3 trailer pays tribute to Angus Cloud",
    link: 'https://example.com/euphoria-tribute',
    description: 'The new episode ends on a black screen memorial.',
    contentHtml: '<p>The episode ends with a memorial for Angus Cloud, Eric Dane and Kevin Turen.</p>',
    imageUrls: [],
    pubDate: new Date('2026-04-17T08:30:00.000Z'),
    generatedCaption: "'Euphoria' has a new release date. The Season 3 premiere of 'Euphoria' paid tribute to three key members of the show who died after Season 2 [...]",
    captionGenerationPath: 'ai_prompted',
    captionGenerationVersion: '2026-04-13-caption-fix',
    canonicalEntity: {
      primarySubject: 'Euphoria',
      mediaTitle: 'Euphoria',
      entityType: 'tv',
      eventType: 'tribute',
      allowedEntities: ['Euphoria', 'Angus Cloud', 'Eric Dane', 'Kevin Turen'],
    },
    canonicalEntityVersion: '2026-04-17-runtime-parity-1',
    platformPostIds: { facebook: '123' },
  } as any;

  const canReuse = __rssAuditTestUtils.canReuseStoredRSSCaption(
    item,
    'TVLine',
    item.canonicalEntity,
    item.platformPostIds,
  );

  assert.equal(canReuse, false);
});

test('editorial brain fallback decision keeps recovered wrapper-title projects instead of wrapper canonicals', () => {
  const item = {
    title: "Dan Levy's New Crime Comedy Series Is A Must-Watch On Netflix",
    link: 'https://slashfilm.com/big-mistakes',
    description: 'Netflix will release Big Mistakes in 2026.',
    contentHtml: '<p>Dan Levy stars in the 2026 crime comedy series <em>Big Mistakes</em> for Netflix.</p>',
    imageUrls: [],
    pubDate: new Date('2026-04-17T08:30:00.000Z'),
  } as any;
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity(item);
  const decision = __rssAuditTestUtils.buildRssEditorialBrainFallbackDecision(item, canonical, 'SlashFilm');

  assert.equal(decision.primary_entity, 'Big Mistakes');
  assert.equal(decision.primary_entity_type, 'project');
  assert.equal(decision.lane, 'core_auto_publish');
  assert.equal(decision.image_strategy.mode, 'project_first');
  assert.equal(decision.caption_strategy.mode, 'headline_news');
});

test('editorial brain disagreement buckets are structured by failure class', () => {
  const disagreements = computeRssEditorialBrainDisagreements(
    {
      lane: 'core_auto_publish',
      primary_entity: 'Euphoria',
      event: 'tribute',
      image_strategy: { mode: 'project_first' },
      caption_strategy: { mode: 'tribute' },
      spoiler_risk: 'none',
    } as any,
    {
      lane: 'core_manual_review_spoiler',
      primary_entity: 'Zendaya',
      event: 'interview_quote',
      image_strategy: { mode: 'dual_person_project' },
      caption_strategy: { mode: 'person_commentary' },
      spoiler_risk: 'medium',
    } as any,
  );

  assert.deepEqual(disagreements, [
    'lane_disagreement',
    'canonical_disagreement',
    'event_disagreement',
    'image_strategy_disagreement',
    'caption_strategy_disagreement',
    'spoiler_risk_disagreement',
  ]);
});

test('audit analysis records editorial brain shadow output when enabled', async () => {
  const result = await analyzeRssAuditCase({
    sourceName: 'SlashFilm',
    feedUrl: 'https://slashfilm.com/feed',
    articleUrl: 'https://slashfilm.com/ray-gunn',
    articleTitle: "Incredibles Director Brad Bird's Netflix Sci-Fi Movie Looks Like Everything We've Always Wanted",
    articleDescription: 'Brad Bird is directing the Netflix sci-fi movie Ray Gunn.',
    articleBody: '<p>Brad Bird is directing the Netflix sci-fi movie <em>Ray Gunn</em> for Netflix.</p>',
    publishedAt: '2026-04-17T09:00:00.000Z',
  }, {
    imageLimit: 2,
    captionMode: 'deterministic',
    editorialBrainMode: 'shadow',
  } as any);

  assert.ok(result.editorialBrain);
  assert.equal(result.editorialBrain?.primaryEntity, 'Ray Gunn');
  assert.equal(result.editorialBrain?.lane, 'core_auto_publish');
  assert.equal(result.editorialBrain?.imageStrategy, 'project_first');
  assert.ok(['headline_news', 'project_announcement'].includes(result.editorialBrain?.captionStrategy || ''));
  assert.ok(result.editorialBrain?.contentHash);
  assert.equal(
    result.editorialBrain?.contentHash,
    buildRssEditorialBrainContentHash({
      source: 'SlashFilm',
      url: 'https://slashfilm.com/ray-gunn',
      headline: "Incredibles Director Brad Bird's Netflix Sci-Fi Movie Looks Like Everything We've Always Wanted",
      summary: 'Brad Bird is directing the Netflix sci-fi movie Ray Gunn.',
      bodyText: 'Brad Bird is directing the Netflix sci-fi movie Ray Gunn for Netflix.',
      extractedQuotes: [],
      articleImages: [],
    } as any),
  );
  assert.ok(Array.isArray(result.editorialBrain?.disagreements));
});

test('editorial brain invocation skips obvious non-core editorial items', () => {
  const item = {
    title: "Malcolm In The Middle Review: Hulu's Messy Family Reunion Struggles To Recapture The Original's Zing",
    description: 'A review of the revival episode.',
    contentHtml: '<p>This review breaks down the revival and whether it works.</p>',
  } as any;
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity(item);

  const plan = planRssEditorialBrainInvocation('TVLine', item, canonical);

  assert.equal(plan.enabled, false);
  assert.equal(plan.reason, 'editorial_brain_skipped_non_core_lane');
});

test('editorial brain invocation enables wrapper-headline trade cases with compressed evidence packets', () => {
  const item = {
    title: "Incredibles Director Brad Bird's Netflix Sci-Fi Movie Looks Like Everything We've Always Wanted",
    description: 'Brad Bird is directing the Netflix sci-fi movie Ray Gunn.',
    contentHtml: [
      '<p>Brad Bird is directing the Netflix sci-fi movie <em>Ray Gunn</em> for Netflix.</p>',
      '<p>Ray Gunn is set in 2026 and stars a cast led by emerging sci-fi talent.</p>',
      '<p>The project was first unveiled by Netflix with new artwork.</p>',
      '<figure><img src="https://example.com/ray-gunn.jpg" alt="Ray Gunn concept art"><figcaption>Ray Gunn concept art released by Netflix.</figcaption></figure>',
    ].join(''),
  } as any;
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity(item);

  const plan = planRssEditorialBrainInvocation('SlashFilm', item, canonical);

  assert.equal(plan.enabled, true);
  assert.match(plan.reason, /enabled/i);
  assert.match(plan.compressedBodyText, /Ray Gunn/);
  assert.match(plan.compressedBodyText, /Netflix/);
  assert.ok(plan.compressedBodyText.length < 1200);
  assert.deepEqual(plan.imageEvidence, ['Ray Gunn concept art', 'Ray Gunn concept art released by Netflix.']);
});

test('compressed editorial brain evidence packet preserves title-bearing and platform paragraphs without shipping the whole body', () => {
  const item = {
    title: "Dan Levy's New Crime Comedy Series Is A Must-Watch On Netflix",
    description: 'Netflix will release Big Mistakes in 2026.',
    contentHtml: [
      '<p>This opening paragraph is mostly filler about the broader streaming landscape.</p>',
      '<p>Dan Levy stars in the 2026 crime comedy series <em>Big Mistakes</em> for Netflix.</p>',
      '<p>The show was initially titled Good News but is now called Big Mistakes.</p>',
      '<p>Another filler paragraph about how audiences respond to crime comedies in general.</p>',
      '<p>Netflix confirmed the project will debut in 2026.</p>',
    ].join(''),
  } as any;
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity(item);

  const packet = buildCompressedRssEditorialBrainEvidencePacket(item, canonical);

  assert.match(packet.compressedBodyText, /Big Mistakes/);
  assert.match(packet.compressedBodyText, /Netflix confirmed/);
  assert.ok(packet.compressedBodyText.length < 1000);
});

test('editorial brain activity projection exposes current-vs-brain comparison fields for review UI', () => {
  const item = {
    title: "Incredibles Director Brad Bird's Netflix Sci-Fi Movie Looks Like Everything We've Always Wanted",
    link: 'https://slashfilm.com/ray-gunn',
    description: 'Brad Bird is directing the Netflix sci-fi movie Ray Gunn.',
    contentHtml: '<p>Brad Bird is directing the Netflix sci-fi movie <em>Ray Gunn</em> for Netflix.</p>',
    pubDate: new Date('2026-04-17T09:00:00.000Z'),
    editorialBrain: {
      editorialBrainVersion: 'rss-editorial-brain-test',
      promptVersion: 'prompt-v1',
      schemaVersion: 'schema-v1',
      contentHash: 'hash-1',
      sourceTrustTier: 'tier_2_editorial',
      agentModel: 'gpt-5.4-mini',
      decisionHash: 'decision-1',
      usedFallback: false,
      normalizationNotes: [],
      currentSystem: {
        lane: 'core_auto_publish',
        primary_entity: 'Ray Gunn',
        event: 'development',
        image_strategy: { mode: 'project_first' },
        caption_strategy: { mode: 'headline_news' },
        spoiler_risk: 'none',
      },
      decision: normalizeRssEditorialBrainDecision({
        lane: 'core_auto_publish',
        story_family: 'project_announcement',
        primary_entity_type: 'project',
        primary_entity: 'Ray Gunn',
        secondary_entities: ['Brad Bird'],
        canonical_aliases: ['Ray Gunn'],
        current_title_over_development_title: true,
        development_title_aliases: [],
        format: 'movie',
        event: 'project announcement',
        headline_trust: 'low',
        body_recovery_required: true,
        spoiler_risk: 'none',
        manual_review_reason: '',
        image_strategy: {
          mode: 'project_first',
          primary_preference: ['backdrop still'],
          secondary_preference: ['person portrait'],
          avoid: ['wrapper headline phrasing'],
        },
        caption_strategy: {
          mode: 'project_announcement',
          lead_subject: 'Ray Gunn',
          must_name: ['Ray Gunn'],
          must_not_use: ['This article'],
          must_not_spoil: false,
        },
        caption_facts: {
          headline_fact: "Brad Bird's Netflix sci-fi movie is 'Ray Gunn'.",
          supporting_fact: 'The film is set up at Netflix.',
          quote: '',
          bullets: [],
        },
        evidence: {
          body_titles: ['Ray Gunn'],
          people: ['Brad Bird'],
          projects: ['Ray Gunn'],
          networks_platforms: ['Netflix'],
          years: ['2026'],
          quotes: [],
        },
        confidence: 0.92,
        notes: 'Shadow review payload.',
      }, __rssAuditTestUtils.buildRssEditorialBrainFallbackDecision({
        title: "Incredibles Director Brad Bird's Netflix Sci-Fi Movie Looks Like Everything We've Always Wanted",
        description: 'Brad Bird is directing the Netflix sci-fi movie Ray Gunn.',
        contentHtml: '<p>Brad Bird is directing the Netflix sci-fi movie <em>Ray Gunn</em> for Netflix.</p>',
      } as any, __rssAuditTestUtils.buildRSSCanonicalEntity({
        title: "Incredibles Director Brad Bird's Netflix Sci-Fi Movie Looks Like Everything We've Always Wanted",
        link: 'https://slashfilm.com/ray-gunn',
        description: 'Brad Bird is directing the Netflix sci-fi movie Ray Gunn.',
        contentHtml: '<p>Brad Bird is directing the Netflix sci-fi movie <em>Ray Gunn</em> for Netflix.</p>',
        pubDate: new Date('2026-04-17T09:00:00.000Z'),
      } as any), 'SlashFilm')),
      disagreements: ['event_disagreement', 'caption_strategy_disagreement'],
      review: {
        outcome: 'brain_better',
        reviewedAt: '2026-04-17T12:00:00.000Z',
        notes: 'Wrapper title recovered correctly.',
      },
    },
  } as any;

  const view = __rssAuditTestUtils.buildRSSEditorialBrainActivityView(item);

  assert.ok(view);
  assert.equal(view?.currentSystem.canonical, 'Ray Gunn');
  assert.equal(view?.currentSystem.imageStrategy, 'project_first');
  assert.ok(['project_announcement', 'headline_news'].includes(view?.decision.captionStrategy || ''));
  assert.ok(view?.decision.confidence === undefined || view?.decision.confidence === 0.92);
  assert.deepEqual(view?.disagreements, ['event_disagreement', 'caption_strategy_disagreement']);
  assert.equal(view?.review?.outcome, 'brain_better');
});

test('editorial brain runtime outcome metadata is exposed in activity views for promotion monitoring', () => {
  const item = __rssAuditTestUtils.applyRSSEditorialBrainRuntimeOutcomeToItem({
    title: 'Jordan Firstmanâ€™s Buzzy Cannes Debut Club Kid Bowed by UTA Independent Film Group and Charades, Unveils First Look (EXCLUSIVE)',
    link: 'https://variety.com/club-kid',
    description: 'Club Kid first look revealed.',
    pubDate: new Date('2026-04-17T10:00:00.000Z'),
    editorialBrain: {
      editorialBrainVersion: 'rss-editorial-brain-test',
      promptVersion: 'prompt-v1',
      schemaVersion: 'schema-v1',
      contentHash: 'hash-runtime',
      sourceTrustTier: 'tier_2_editorial',
      agentModel: 'gpt-5.4-mini',
      decisionHash: 'decision-runtime',
      usedFallback: false,
      normalizationNotes: [],
      currentSystem: {
        lane: 'core_auto_publish',
        primary_entity: 'Club Kid',
        event: 'first_look',
        image_strategy: { mode: 'project_first' },
        caption_strategy: { mode: 'headline_news' },
        spoiler_risk: 'none',
      },
      decision: normalizeRssEditorialBrainDecision({
        lane: 'core_auto_publish',
        story_family: 'first_look',
        primary_entity_type: 'project',
        primary_entity: 'Club Kid',
        secondary_entities: ['Jordan Firstman'],
        canonical_aliases: ['Club Kid'],
        current_title_over_development_title: true,
        development_title_aliases: [],
        format: 'movie',
        event: 'first_look',
        headline_trust: 'medium',
        body_recovery_required: false,
        spoiler_risk: 'none',
        manual_review_reason: '',
        image_strategy: {
          mode: 'article_image_first',
          primary_preference: ['article_hero_image'],
          secondary_preference: ['inline_reveal_still'],
          avoid: ['ads'],
        },
        caption_strategy: {
          mode: 'first_look',
          lead_subject: 'Club Kid',
          must_name: ['Club Kid'],
          must_not_use: ['EXCLUSIVE'],
          must_not_spoil: false,
        },
        caption_facts: {
          headline_fact: "First look revealed for 'Club Kid'.",
          supporting_fact: '',
          quote: '',
          bullets: [],
        },
        evidence: {
          body_titles: ['Club Kid'],
          people: ['Jordan Firstman'],
          projects: ['Club Kid'],
          networks_platforms: [],
          years: [],
          quotes: [],
        },
        confidence: 0.9,
        notes: '',
      }, __rssAuditTestUtils.buildRssEditorialBrainFallbackDecision({
        title: 'Club Kid',
        description: 'Club Kid first look revealed.',
        contentHtml: '<p>First look at Club Kid.</p>',
      } as any, __rssAuditTestUtils.buildRSSCanonicalEntity({
        title: 'Club Kid',
        link: 'https://variety.com/club-kid',
        description: 'Club Kid first look revealed.',
        contentHtml: '<p>First look at Club Kid.</p>',
        pubDate: new Date('2026-04-17T10:00:00.000Z'),
      } as any), 'Variety')),
      disagreements: ['image_strategy_disagreement', 'caption_strategy_disagreement'],
    },
  } as any, {
    promotedImageStrategy: 'article_image_first',
    promotedCaptionStrategy: 'first_look',
    finalFailureCodes: ['CAPTION_HEADLINE_JUNK'],
    lastOutcome: 'failed',
    now: new Date('2026-04-17T12:00:00.000Z'),
  });

  const view = __rssAuditTestUtils.buildRSSEditorialBrainActivityView(item);

  assert.ok(view?.runtime);
  assert.equal(view?.runtime?.promotedImageStrategy, 'article_image_first');
  assert.equal(view?.runtime?.promotedCaptionStrategy, 'first_look');
  assert.deepEqual(view?.runtime?.finalFailureCodes, ['CAPTION_HEADLINE_JUNK']);
  assert.equal(view?.runtime?.lastOutcome, 'failed');
});

test('activity item projection exposes stored runtime diagnostics for live debugging', () => {
  const runtimeItem = applyRSSRuntimeDiagnosticsToItem({
    title: 'Hilary Duff Felt "Quite Sad" Watching Docs on Britney Spears',
    link: 'https://example.com/hilary-duff',
    description: 'Hilary Duff reflected on child-star documentaries.',
    pubDate: new Date('2026-04-22T15:14:18.000Z'),
    imageUrls: [],
    generatedCaption: 'Hilary Duff felt "quite sad" watching documentaries about Britney Spears and exploited child stars.',
    captionGenerationPath: 'repaired_caption',
    captionGenerationVersion: '2026-04-22-live-lanes-1',
    canonicalEntityVersion: '2026-04-22-live-lanes-1',
  }, {
    rulesetVersion: '2026-04-22-live-lanes-1',
    codeVersion: '6355b41d',
    captionGenerationVersion: '2026-04-22-live-lanes-1',
    canonicalEntityVersion: '2026-04-22-live-lanes-1',
    captionPath: 'repaired_caption',
    reusedStoredCaption: false,
    finalFailureCodes: ['CAPTION_NON_PUBLISHER_FALLBACK'],
  }, {
    now: new Date('2026-04-22T15:15:21.193Z'),
  });

  const activity = buildRSSActivityItemFromFeedRecord({
    id: 'record-1',
    feedId: 'feed-1',
    title: runtimeItem.title,
    link: runtimeItem.link,
    status: 'failed',
    itemData: runtimeItem as any,
    firstSeenAt: new Date('2026-04-22T15:14:18.000Z'),
    publishedAt: new Date('2026-04-22T15:14:18.000Z'),
    errorMessage: 'Publishing blocked by RSS validation: CAPTION_NON_PUBLISHER_FALLBACK.',
    feed: {
      id: 'feed-1',
      name: 'Variety | TV',
      platformsEnabled: { facebook: true },
    },
  });

  assert.equal(activity.runtime?.rulesetVersion, '2026-04-22-live-lanes-1');
  assert.equal(activity.runtime?.captionPath, 'repaired_caption');
  assert.equal(activity.runtime?.reusedStoredCaption, false);
  assert.deepEqual(activity.runtime?.finalFailureCodes, ['CAPTION_NON_PUBLISHER_FALLBACK']);
});

test('legacy log activity projection preserves runtime diagnostics for retry investigation', () => {
  const activity = parseRSSActivityLog({
    id: 'log-1',
    timestamp: new Date('2026-04-22T15:15:21.193Z'),
    metadata: {
      category: 'rss_activity',
      status: 'failed',
      feedId: 'feed-1',
      feedName: 'Variety | TV',
      itemTitle: 'Hilary Duff Felt Quite Sad Watching Docs on Britney Spears',
      itemLink: 'https://example.com/hilary-duff',
      platforms: ['Facebook'],
      errorMessage: 'Publishing blocked by RSS validation: CAPTION_NON_PUBLISHER_FALLBACK.',
      runtime: {
        rulesetVersion: '2026-04-22-live-lanes-1',
        codeVersion: '6355b41d',
        captionGenerationVersion: '2026-04-22-live-lanes-1',
        canonicalEntityVersion: '2026-04-22-live-lanes-1',
        captionPath: 'excerpt_fallback',
        reusedStoredCaption: false,
        finalFailureCodes: ['CAPTION_NON_PUBLISHER_FALLBACK'],
      },
    },
  } as any);

  assert.equal(activity?.runtime?.rulesetVersion, '2026-04-22-live-lanes-1');
  assert.equal(activity?.runtime?.captionPath, 'excerpt_fallback');
  assert.deepEqual(activity?.runtime?.finalFailureCodes, ['CAPTION_NON_PUBLISHER_FALLBACK']);
});

test('publisher-safe deterministic fallback rewrites excerpt-shaped live caption failures', () => {
  const result = buildRSSPublishSafeDeterministicResult(
    'Hilary Duff reflected on her child star upbringing at the TIME100 Summit in Manhattan, where Time executive editor Dan Macsai asked if documentaries like "Quiet on Set" changed her perspective [...]',
    {
      articleTitle: 'Hilary Duff Felt "Quite Sad" Watching Docs on Britney Spears and Exploited Child Stars: "I\'m Grateful I Wasn\'t Put in Too Many Positions That Left Battle Wounds"',
      feedName: 'Variety | TV',
      summary: 'Hilary Duff reflected on her child star upbringing at the TIME100 Summit in Manhattan.',
      articleBody: 'Hilary Duff said she felt quite sad watching documentaries about Britney Spears and exploited child stars.',
      platform: 'Facebook',
      canonicalEntity: {
        primarySubject: 'Hilary Duff',
        entityType: 'person',
        eventType: 'reflection',
        confidence: 0.92,
      },
    }
  );

  assert.equal(result.path, 'repaired_caption');
  assert.ok(!result.caption.includes('[...]'));
  assert.match(result.caption, /Hilary Duff Felt "Quite Sad" Watching Docs on Britney Spears and Exploited Child Stars\./);
});

test('editorial brain review persistence normalizes review payloads onto stored RSS items', () => {
  const item = {
    title: 'Example title',
    link: 'https://example.com/story',
    description: 'Example',
    pubDate: new Date('2026-04-17T10:00:00.000Z'),
    editorialBrain: {
      editorialBrainVersion: 'rss-editorial-brain-test',
      promptVersion: 'prompt-v1',
      schemaVersion: 'schema-v1',
      contentHash: 'hash-2',
      sourceTrustTier: 'tier_3_noisy',
      agentModel: 'gpt-5.4-mini',
      decisionHash: 'decision-2',
      usedFallback: false,
      normalizationNotes: [],
      currentSystem: {
        lane: 'entertainment_adjacent',
        primary_entity: 'Absolute Green Arrow',
        event: 'editorial_feature',
        image_strategy: { mode: 'project_first' },
        caption_strategy: { mode: 'headline_news' },
        spoiler_risk: 'none',
      },
      decision: normalizeRssEditorialBrainDecision({
        lane: 'blocked_non_core',
        story_family: 'comics_only',
        primary_entity_type: 'project',
        primary_entity: 'Absolute Green Arrow',
        secondary_entities: [],
        canonical_aliases: ['Absolute Green Arrow'],
        current_title_over_development_title: true,
        development_title_aliases: [],
        format: 'comics',
        event: 'editorial_feature',
        headline_trust: 'medium',
        body_recovery_required: false,
        spoiler_risk: 'none',
        manual_review_reason: '',
        image_strategy: {
          mode: 'project_first',
          primary_preference: ['poster'],
          secondary_preference: [],
          avoid: [],
        },
        caption_strategy: {
          mode: 'headline_news',
          lead_subject: 'Absolute Green Arrow',
          must_name: ['Absolute Green Arrow'],
          must_not_use: [],
          must_not_spoil: false,
        },
        caption_facts: {
          headline_fact: 'Creators discuss Absolute Green Arrow.',
          supporting_fact: '',
          quote: '',
          bullets: [],
        },
        evidence: {
          body_titles: ['Absolute Green Arrow'],
          people: [],
          projects: ['Absolute Green Arrow'],
          networks_platforms: [],
          years: [],
          quotes: [],
        },
        confidence: 0.77,
        notes: '',
      }, {
        lane: 'entertainment_adjacent',
        story_family: 'editorial_feature',
        primary_entity_type: 'project',
        primary_entity: 'Absolute Green Arrow',
        secondary_entities: [],
        canonical_aliases: ['Absolute Green Arrow'],
        current_title_over_development_title: true,
        development_title_aliases: [],
        format: 'unknown',
        event: 'editorial_feature',
        headline_trust: 'medium',
        body_recovery_required: false,
        spoiler_risk: 'none',
        manual_review_reason: '',
        image_strategy: { mode: 'project_first', primary_preference: [], secondary_preference: [], avoid: [] },
        caption_strategy: { mode: 'headline_news', lead_subject: 'Absolute Green Arrow', must_name: [], must_not_use: [], must_not_spoil: false },
        caption_facts: { headline_fact: '', supporting_fact: '', quote: '', bullets: [] },
        evidence: { body_titles: [], people: [], projects: [], networks_platforms: [], years: [], quotes: [] },
        confidence: 0.5,
        notes: '',
      }),
      disagreements: ['lane_disagreement'],
    },
  } as any;

  const next = __rssAuditTestUtils.applyRSSEditorialBrainReviewToItem(item, {
    outcome: 'both_wrong',
    notes: 'Needs a manual comics policy decision.',
  });

  assert.equal(next.editorialBrain?.review?.outcome, 'both_wrong');
  assert.equal(next.editorialBrain?.review?.notes, 'Needs a manual comics policy decision.');
  assert.match(next.editorialBrain?.review?.reviewedAt || '', /^20/);
});

test('editorial brain image strategy promotion only activates for calibrated high-confidence image disagreements', () => {
  const calibration = buildRSSEditorialBrainImageStrategyCalibration([
    {
      sourceName: 'TVLine',
      disagreements: ['image_strategy_disagreement'],
      review: { outcome: 'brain_better' },
    },
    {
      sourceName: 'TVLine',
      disagreements: ['image_strategy_disagreement'],
      review: { outcome: 'brain_better' },
    },
    {
      sourceName: 'SlashFilm',
      disagreements: ['image_strategy_disagreement'],
      review: { outcome: 'deterministic_better' },
    },
  ]);

  const promotedMode = selectRSSEditorialBrainPromotedImageStrategy(
    'TVLine',
    {
      usedFallback: false,
      disagreements: ['image_strategy_disagreement'],
      currentSystem: {
        lane: 'core_auto_publish',
        primary_entity: 'Club Kid',
        event: 'first_look',
        image_strategy: { mode: 'project_first' },
        caption_strategy: { mode: 'headline_news' },
        spoiler_risk: 'none',
      },
      decision: normalizeRssEditorialBrainDecision({
        lane: 'core_auto_publish',
        story_family: 'first_look',
        primary_entity_type: 'project',
        primary_entity: 'Club Kid',
        secondary_entities: ['Jordan Firstman'],
        canonical_aliases: [],
        current_title_over_development_title: true,
        development_title_aliases: [],
        format: 'movie',
        event: 'first_look',
        headline_trust: 'high',
        body_recovery_required: false,
        spoiler_risk: 'none',
        manual_review_reason: '',
        image_strategy: { mode: 'article_image_first', primary_preference: [], secondary_preference: [], avoid: [] },
        caption_strategy: { mode: 'first_look', lead_subject: 'Club Kid', must_name: [], must_not_use: [], must_not_spoil: false },
        caption_facts: { headline_fact: '', supporting_fact: '', quote: '', bullets: [] },
        evidence: { body_titles: [], people: [], projects: [], networks_platforms: [], years: [], quotes: [] },
        confidence: 0.88,
        notes: '',
      }, {
        lane: 'core_auto_publish',
        story_family: 'first_look',
        primary_entity_type: 'project',
        primary_entity: 'Club Kid',
        secondary_entities: ['Jordan Firstman'],
        canonical_aliases: [],
        current_title_over_development_title: true,
        development_title_aliases: [],
        format: 'movie',
        event: 'first_look',
        headline_trust: 'high',
        body_recovery_required: false,
        spoiler_risk: 'none',
        manual_review_reason: '',
        image_strategy: { mode: 'article_image_first', primary_preference: [], secondary_preference: [], avoid: [] },
        caption_strategy: { mode: 'first_look', lead_subject: 'Club Kid', must_name: [], must_not_use: [], must_not_spoil: false },
        caption_facts: { headline_fact: '', supporting_fact: '', quote: '', bullets: [] },
        evidence: { body_titles: [], people: [], projects: [], networks_platforms: [], years: [], quotes: [] },
        confidence: 0.88,
        notes: '',
      }).decision,
    } as any,
    {
      rssEditorialBrainImageStrategyPromotion: true,
    } as any,
    calibration
  );

  assert.equal(promotedMode, 'article_image_first');

  const blockedMode = selectRSSEditorialBrainPromotedImageStrategy(
    'SlashFilm',
    {
      usedFallback: false,
      disagreements: ['image_strategy_disagreement', 'lane_disagreement'],
      currentSystem: {
        lane: 'core_auto_publish',
        primary_entity: 'Club Kid',
        event: 'first_look',
        image_strategy: { mode: 'project_first' },
        caption_strategy: { mode: 'headline_news' },
        spoiler_risk: 'none',
      },
      decision: normalizeRssEditorialBrainDecision({
        lane: 'entertainment_adjacent',
        story_family: 'first_look',
        primary_entity_type: 'project',
        primary_entity: 'Club Kid',
        secondary_entities: [],
        canonical_aliases: [],
        current_title_over_development_title: true,
        development_title_aliases: [],
        format: 'movie',
        event: 'first_look',
        headline_trust: 'high',
        body_recovery_required: false,
        spoiler_risk: 'none',
        manual_review_reason: '',
        image_strategy: { mode: 'article_image_first', primary_preference: [], secondary_preference: [], avoid: [] },
        caption_strategy: { mode: 'first_look', lead_subject: 'Club Kid', must_name: [], must_not_use: [], must_not_spoil: false },
        caption_facts: { headline_fact: '', supporting_fact: '', quote: '', bullets: [] },
        evidence: { body_titles: [], people: [], projects: [], networks_platforms: [], years: [], quotes: [] },
        confidence: 0.92,
        notes: '',
      }, {
        lane: 'entertainment_adjacent',
        story_family: 'first_look',
        primary_entity_type: 'project',
        primary_entity: 'Club Kid',
        secondary_entities: [],
        canonical_aliases: [],
        current_title_over_development_title: true,
        development_title_aliases: [],
        format: 'movie',
        event: 'first_look',
        headline_trust: 'high',
        body_recovery_required: false,
        spoiler_risk: 'none',
        manual_review_reason: '',
        image_strategy: { mode: 'article_image_first', primary_preference: [], secondary_preference: [], avoid: [] },
        caption_strategy: { mode: 'first_look', lead_subject: 'Club Kid', must_name: [], must_not_use: [], must_not_spoil: false },
        caption_facts: { headline_fact: '', supporting_fact: '', quote: '', bullets: [] },
        evidence: { body_titles: [], people: [], projects: [], networks_platforms: [], years: [], quotes: [] },
        confidence: 0.92,
        notes: '',
      }).decision,
    } as any,
    {
      rssEditorialBrainImageStrategyPromotion: true,
    } as any,
    calibration
  );

  assert.equal(blockedMode, undefined);
});

test('editorial brain image strategy promotion maps promoted image modes onto canonical flags without changing core identity', () => {
  const canonical = applyRSSEditorialBrainImageStrategyPromotion(
    {
      primarySubject: 'Club Kid',
      mediaTitle: 'Club Kid',
      entityType: 'movie',
      eventType: 'first_look',
      ambiguityFlags: ['body_title_recovery_required'],
    },
    'article_image_first'
  );

  assert.equal(canonical.primarySubject, 'Club Kid');
  assert.equal(canonical.mediaTitle, 'Club Kid');
  assert.ok(canonical.ambiguityFlags?.includes('story_policy_article_image_first'));
  assert.ok(canonical.ambiguityFlags?.includes('editorial_brain_image_strategy_promoted'));
  assert.ok(canonical.ambiguityFlags?.includes('editorial_brain_image_strategy_article_image_first'));
});

test('editorial brain caption strategy promotion only activates for calibrated high-confidence caption disagreements', () => {
  const calibration = buildRSSEditorialBrainCaptionStrategyCalibration([
    {
      sourceName: 'SlashFilm',
      disagreements: ['caption_strategy_disagreement'],
      review: { outcome: 'brain_better' },
    },
    {
      sourceName: 'SlashFilm',
      disagreements: ['caption_strategy_disagreement'],
      review: { outcome: 'brain_better' },
    },
    {
      sourceName: 'TVLine',
      disagreements: ['caption_strategy_disagreement'],
      review: { outcome: 'deterministic_better' },
    },
  ]);

  const promotedMode = selectRSSEditorialBrainPromotedCaptionStrategy(
    'SlashFilm',
    {
      usedFallback: false,
      disagreements: ['caption_strategy_disagreement'],
      currentSystem: {
        lane: 'core_auto_publish',
        primary_entity: 'Ray Gunn',
        event: 'trailer',
        image_strategy: { mode: 'project_first' },
        caption_strategy: { mode: 'headline_news' },
        spoiler_risk: 'none',
      },
      decision: normalizeRssEditorialBrainDecision({
        lane: 'core_auto_publish',
        story_family: 'trailer',
        primary_entity_type: 'project',
        primary_entity: 'Ray Gunn',
        secondary_entities: ['Brad Bird'],
        canonical_aliases: [],
        current_title_over_development_title: true,
        development_title_aliases: [],
        format: 'movie',
        event: 'trailer',
        headline_trust: 'high',
        body_recovery_required: false,
        spoiler_risk: 'none',
        manual_review_reason: '',
        image_strategy: { mode: 'project_first', primary_preference: [], secondary_preference: [], avoid: [] },
        caption_strategy: { mode: 'trailer', lead_subject: 'Ray Gunn', must_name: [], must_not_use: [], must_not_spoil: false },
        caption_facts: { headline_fact: '', supporting_fact: '', quote: '', bullets: [] },
        evidence: { body_titles: [], people: [], projects: [], networks_platforms: [], years: [], quotes: [] },
        confidence: 0.87,
        notes: '',
      }, {
        lane: 'core_auto_publish',
        story_family: 'trailer',
        primary_entity_type: 'project',
        primary_entity: 'Ray Gunn',
        secondary_entities: ['Brad Bird'],
        canonical_aliases: [],
        current_title_over_development_title: true,
        development_title_aliases: [],
        format: 'movie',
        event: 'trailer',
        headline_trust: 'high',
        body_recovery_required: false,
        spoiler_risk: 'none',
        manual_review_reason: '',
        image_strategy: { mode: 'project_first', primary_preference: [], secondary_preference: [], avoid: [] },
        caption_strategy: { mode: 'trailer', lead_subject: 'Ray Gunn', must_name: [], must_not_use: [], must_not_spoil: false },
        caption_facts: { headline_fact: '', supporting_fact: '', quote: '', bullets: [] },
        evidence: { body_titles: [], people: [], projects: [], networks_platforms: [], years: [], quotes: [] },
        confidence: 0.87,
        notes: '',
      }).decision,
    } as any,
    { rssEditorialBrainCaptionStrategyPromotion: true } as any,
    calibration
  );

  assert.equal(promotedMode, 'trailer');

  const blockedMode = selectRSSEditorialBrainPromotedCaptionStrategy(
    'TVLine',
    {
      usedFallback: false,
      disagreements: ['caption_strategy_disagreement', 'canonical_disagreement'],
      currentSystem: {
        lane: 'core_auto_publish',
        primary_entity: 'Ray Gunn',
        event: 'trailer',
        image_strategy: { mode: 'project_first' },
        caption_strategy: { mode: 'headline_news' },
        spoiler_risk: 'none',
      },
      decision: normalizeRssEditorialBrainDecision({
        lane: 'core_auto_publish',
        story_family: 'trailer',
        primary_entity_type: 'project',
        primary_entity: 'Ray Gunn',
        secondary_entities: [],
        canonical_aliases: [],
        current_title_over_development_title: true,
        development_title_aliases: [],
        format: 'movie',
        event: 'trailer',
        headline_trust: 'high',
        body_recovery_required: false,
        spoiler_risk: 'none',
        manual_review_reason: '',
        image_strategy: { mode: 'project_first', primary_preference: [], secondary_preference: [], avoid: [] },
        caption_strategy: { mode: 'trailer', lead_subject: 'Ray Gunn', must_name: [], must_not_use: [], must_not_spoil: false },
        caption_facts: { headline_fact: '', supporting_fact: '', quote: '', bullets: [] },
        evidence: { body_titles: [], people: [], projects: [], networks_platforms: [], years: [], quotes: [] },
        confidence: 0.92,
        notes: '',
      }, {
        lane: 'core_auto_publish',
        story_family: 'trailer',
        primary_entity_type: 'project',
        primary_entity: 'Ray Gunn',
        secondary_entities: [],
        canonical_aliases: [],
        current_title_over_development_title: true,
        development_title_aliases: [],
        format: 'movie',
        event: 'trailer',
        headline_trust: 'high',
        body_recovery_required: false,
        spoiler_risk: 'none',
        manual_review_reason: '',
        image_strategy: { mode: 'project_first', primary_preference: [], secondary_preference: [], avoid: [] },
        caption_strategy: { mode: 'trailer', lead_subject: 'Ray Gunn', must_name: [], must_not_use: [], must_not_spoil: false },
        caption_facts: { headline_fact: '', supporting_fact: '', quote: '', bullets: [] },
        evidence: { body_titles: [], people: [], projects: [], networks_platforms: [], years: [], quotes: [] },
        confidence: 0.92,
        notes: '',
      }).decision,
    } as any,
    { rssEditorialBrainCaptionStrategyPromotion: true } as any,
    calibration
  );

  assert.equal(blockedMode, undefined);
});

test('caption system prompt includes promoted editorial-brain caption strategy constraints', () => {
  const prompt = __rssAuditTestUtils.buildRSSCaptionSystemPrompt('Base prompt', {
    tone: 'Engaging',
    maxLength: 800,
    promotedCaptionStrategy: 'person_commentary',
  });

  assert.match(prompt || '', /speaker-led/i);
  assert.match(prompt || '', /comment or quote/i);
  assert.match(prompt || '', /Base prompt/);
});
