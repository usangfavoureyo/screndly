import test from 'node:test';
import assert from 'node:assert/strict';
import { __rssCaptionTestUtils } from '../services/ai.service';
import { __rssImageSelectionTestUtils } from '../services/rss-image-selection.service';
import { __rssAuditTestUtils } from '../services/rss.service';
import { __rssTmdbDisambiguationTestUtils } from '../services/rss-tmdb-image-selection.service';
import { buildDuplicateGroups, buildRssAuditReport } from '../audit/rss-audit-report';
import { buildDiagnosisAndFixes, getRssAuditImageResolverOptions, hasCanonicalTokenOverlap } from '../audit/rss-audit-runner';
import type { RssAuditResult } from '../audit/rss-audit-types';

const { getRSSCaptionHardInvalidReasonCodes, headlineAnchorsToCoreProject, failsRSSCaptionFormatting } = __rssCaptionTestUtils;
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
  assert.ok(canonical.ambiguityFlags?.includes('body_title_recovered'));
});

test('canonical extraction recovers documentary title from descriptive body', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "'All the Evil in the World' Doc Sparks Political Storm After Being Denied Government Funding",
    description: "The documentary All the Evil in the World follows the murder of an Italian student in Egypt.",
    contentHtml: '<p>The documentary <em>All the Evil in the World</em> has sparked debate.</p>',
  });

  assert.equal(canonical.mediaTitle, 'All the Evil in the World');
  assert.equal(canonical.entityType, 'movie');
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
  assert.equal(canonical.mediaTitle, undefined);
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
  assert.ok(canonical.ambiguityFlags?.includes('quote_led_headline_junk'));
});

test('joke headlines do not survive as clean canonicals when only quoted project context is safe', () => {
  const canonical = __rssAuditTestUtils.buildRSSCanonicalEntity({
    title: "Jimmy Kimmel Jokes Zendaya Is Probably the Reason No One on 'Euphoria' Knows Its Future: 'Tom Holland Can’t Be Trusted'",
    description: 'Jimmy Kimmel joked about the future of Euphoria.',
    contentHtml: '',
  });

  assert.notEqual(canonical.primarySubject, 'Jimmy Kimmel Jokes Zendaya');
  assert.ok(canonical.ambiguityFlags?.includes('quote_led_headline_junk'));
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
