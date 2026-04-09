import test from 'node:test';
import assert from 'node:assert/strict';
import { __rssCaptionTestUtils } from '../services/ai.service';
import { __rssImageSelectionTestUtils } from '../services/rss-image-selection.service';

const {
  buildHeuristicRssCaptionExtraction,
  buildDeterministicRssCaption,
  enforceRSSCaptionPunctuation,
  failsRSSCaptionFormatting,
  getRSSCaptionHardInvalidReasonCodes,
  hasMissingRSSBlankLineSeparation,
  hasUnsupportedRSSStructure,
  lacksSingleQuotedDetectedRSSTitles,
  hasUnsupportedRSSDemographicMutation,
  hasInvalidRSSJoinLead,
  mirrorsRSSHeadlineTooClosely,
  normalizeRSSHeadlineInput,
} = __rssCaptionTestUtils;

test('rss caption extraction uses article body to recover a specific project subject', () => {
  const extraction = buildHeuristicRssCaptionExtraction({
    articleTitle: 'Major MCU return explained in latest episode',
    feedName: 'Variety',
    summary: 'The article discusses a major MCU return.',
    articleBody: "The latest episode of 'Daredevil: Born Again' sheds new light on Bullseye's status in the MCU.",
    platform: 'Threads',
    allowedEntities: ['Daredevil: Born Again', 'Bullseye'],
  });

  assert.equal(extraction.media_title, 'Daredevil: Born Again');
  assert.equal(extraction.primary_subject, 'Daredevil: Born Again');
});

test('rss caption formatting flags captions that mirror the raw headline too closely', () => {
  const context = {
    articleTitle: "Identity Comes Under Focus at IFF Panama's Primera Mirada Showcase",
    feedName: 'Variety',
    summary: 'IFF Panama has selected four finalists.',
    platform: 'Facebook' as const,
    allowedEntities: ['IFF Panama', 'Primera Mirada'],
  };

  assert.equal(
    mirrorsRSSHeadlineTooClosely(
      "Identity Comes Under Focus at IFF Panama's Primera Mirada Showcase.",
      context
    ),
    true
  );
  assert.equal(
    failsRSSCaptionFormatting(
      "Identity Comes Under Focus at IFF Panama's Primera Mirada Showcase.",
      context
    ),
    true
  );
});

test('rss caption punctuation enforcer adds periods to each line', () => {
  const caption = enforceRSSCaptionPunctuation(
    "'Spider-Man: Brand New Day' adds new scenes to expand its villain story\nTom Holland discussed the extra photography"
  );

  assert.equal(
    caption,
    "'Spider-Man: Brand New Day' adds new scenes to expand its villain story.\nTom Holland discussed the extra photography."
  );
});

test('rss punctuation enforcer preserves paragraph breaks between caption blocks', () => {
  const caption = enforceRSSCaptionPunctuation(
    "'Spider-Man: Brand New Day' adds new scenes after production wrapped\n\nTom Holland discussed the extra photography"
  );

  assert.equal(
    caption,
    "'Spider-Man: Brand New Day' adds new scenes after production wrapped.\n\nTom Holland discussed the extra photography."
  );
});

test('deterministic fallback caption does not collapse to the raw article title', () => {
  const context = {
    articleTitle: "Spider-Man: Brand New Day Reshoots Officially Confirmed, And They're Changing a Villain Story",
    feedName: 'ComicBook',
    summary: "As one of only two new Marvel Cinematic Universe movies hitting theaters this year, Spider-Man: Brand New Day is an important release for the franchise.",
    articleBody: "Spider-Man: Brand New Day recently returned for additional photography. The reshoots are changing part of the film's villain story.",
    platform: 'Threads' as const,
    allowedEntities: ['Spider-Man: Brand New Day'],
  };

  const caption = buildDeterministicRssCaption(
    buildHeuristicRssCaptionExtraction(context),
    context
  );

  assert.notEqual(
    normalizeRSSHeadlineInput(caption.split('\n')[0] || ''),
    normalizeRSSHeadlineInput(context.articleTitle)
  );
  assert.match(caption, /Reshoots for 'Spider-Man: Brand New Day' have been confirmed\./);
});

test('headline normalization strips publisher prefix tokens', () => {
  assert.equal(
    normalizeRSSHeadlineInput("LISTEN: Andra Day backs No Kid Hungry's campaign"),
    "Andra Day backs No Kid Hungry's campaign"
  );
});

test('caption validation rejects unsupported demographic mutations like Gen Zers', () => {
  const context = {
    articleTitle: 'Gen Z Goes to the Movies! Younger Audiences Are Driving the Box Office, Study Shows',
    feedName: 'Variety',
    summary: 'A new study says Gen Z is now the most active moviegoing demographic.',
    articleBody: 'During the pandemic, Hollywood feared Gen Z would skip theaters for smartphone streaming.',
    platform: 'Threads' as const,
    allowedEntities: ['Gen Z'],
  };

  assert.equal(
    hasUnsupportedRSSDemographicMutation(
      'Gen Zers are now the most active moviegoing demographic, according to a new study.',
      context
    ),
    true
  );
  assert.equal(
    failsRSSCaptionFormatting(
      'Gen Zers are now the most active moviegoing demographic, according to a new study.',
      context
    ),
    true
  );
});

test('caption validation rejects captions missing the required blank line before a second block', () => {
  const context = {
    articleTitle: "'Spider-Man: Brand New Day' adds new scenes after production wrapped",
    feedName: 'Variety',
    summary: 'Tom Holland discussed the extra footage.',
    articleBody: "Tom Holland says 'Spider-Man: Brand New Day' added scenes in London.",
    platform: 'Threads' as const,
    allowedEntities: ['Spider-Man: Brand New Day', 'Tom Holland'],
  };

  const caption = "'Spider-Man: Brand New Day' adds new scenes after production wrapped.\nTom Holland discussed the extra footage.";

  assert.equal(hasMissingRSSBlankLineSeparation(caption), true);
  assert.equal(failsRSSCaptionFormatting(caption, context), true);
});

test('caption validation rejects unquoted detected titles', () => {
  const context = {
    articleTitle: "First trailer released for 'The Running Man'",
    feedName: 'Variety',
    summary: "The first trailer for 'The Running Man' has been released.",
    articleBody: "The first trailer for 'The Running Man' has arrived.",
    platform: 'Threads' as const,
    allowedEntities: ['The Running Man'],
  };

  const caption = "First trailer released for The Running Man.\n\nDirected by Edgar Wright.";

  assert.equal(lacksSingleQuotedDetectedRSSTitles(caption, context), true);
  assert.equal(failsRSSCaptionFormatting(caption, context), true);
});

test('caption validation rejects structures that exceed the saved prompt shape', () => {
  const caption = "'The Running Man' trailer arrives.\n\nDirected by Edgar Wright.\nIn theaters November 7.\nTickets on sale now.";

  assert.equal(hasUnsupportedRSSStructure(caption), true);
});

test('caption validation rejects invalid repeated joins headlines', () => {
  const context = {
    articleTitle: "Peter Dinklage joins 'Alien: Earth' Season 2",
    feedName: 'Deadline',
    summary: "Peter Dinklage has joined the cast of FX's 'Alien: Earth' Season 2.",
    articleBody: 'Deadline confirmed Peter Dinklage has joined the cast. More to come.',
    platform: 'Threads' as const,
    allowedEntities: ['Alien: Earth', 'Peter Dinklage'],
  };

  const caption = "Noah Hawley, Deadline joins 'Noah Hawley, Deadline'.";

  assert.equal(hasInvalidRSSJoinLead(caption), true);
  assert.equal(failsRSSCaptionFormatting(caption, context), true);
});

test('deterministic casting fallback prefers the project headline when the subject is not a grounded person', () => {
  const context = {
    articleTitle: "Peter Dinklage joins 'Alien: Earth' Season 2",
    feedName: 'Deadline',
    summary: "Peter Dinklage has joined the cast of FX's 'Alien: Earth' Season 2.",
    articleBody: 'Deadline confirmed the casting. More to come.',
    platform: 'Threads' as const,
    allowedEntities: ['Alien: Earth', 'Peter Dinklage'],
  };

  const caption = buildDeterministicRssCaption({
    article_title: context.articleTitle,
    event_type: 'casting',
    primary_subject: 'Deadline',
    media_title: 'Alien: Earth',
    supporting_facts: ['More to come.'],
  }, context as any);

  assert.match(caption, /'Alien: Earth' has added a new cast member\./);
  assert.doesNotMatch(caption, /\bDeadline joins\b/i);
});

test('caption validation rejects truncated excerpt markers and ellipsis endings', () => {
  const context = {
    articleTitle: "'Nobody Wants This' Season 3 sets new cast",
    feedName: 'Variety',
    summary: "'Nobody Wants This' Season 3 has added nine new cast members.",
    articleBody: "Variety has learned the season added more guest stars, who are: Avas Jogia ('56 [...])",
    platform: 'Threads' as const,
    allowedEntities: ['Nobody Wants This'],
  };

  assert.equal(
    failsRSSCaptionFormatting(
      "'Nobody Wants This' Season 3 has added nine new cast members.\n\nVariety has learned more guest stars are joining the show [...]",
      context
    ),
    true
  );
});

test('caption validation rejects HTML entity leakage', () => {
  const context = {
    articleTitle: "Disney expected to lay off as many as 1,000 employees",
    feedName: 'Variety',
    summary: 'The Walt Disney Company could make deep cuts.',
    articleBody: 'Disney&#8217;s cuts are expected to affect the marketing department.',
    platform: 'Threads' as const,
    allowedEntities: ['The Walt Disney Company', 'Disney'],
  };

  const caption = "Disney&#8217;s layoffs are expected to affect the marketing department.";

  assert.equal(failsRSSCaptionFormatting(caption, context), true);
  assert.match(getRSSCaptionHardInvalidReasonCodes(caption, context).join(','), /CAPTION_CONTAINS_HTML_ENTITY/);
});

test('caption validation rejects named HTML entities in final output', () => {
  const context = {
    articleTitle: "Jenna Ortega joins Netflix's 'You'",
    feedName: 'Deadline',
    summary: "Jenna Ortega joins Netflix's 'You'.",
    articleBody: 'A new casting update has been announced.',
    platform: 'Threads' as const,
    allowedEntities: ['Jenna Ortega', 'You'],
  };

  const caption = 'Jenna Ortega &amp; Netflix confirm a new update for "You".';

  assert.equal(failsRSSCaptionFormatting(caption, context), true);
  assert.match(getRSSCaptionHardInvalidReasonCodes(caption, context).join(','), /CAPTION_CONTAINS_HTML_ENTITY/);
});

test('caption validation rejects publisher marker leakage in final output', () => {
  const context = {
    articleTitle: "EXCLUSIVE: Jenna Ortega joins Netflix's 'You'",
    feedName: 'Deadline',
    summary: "Jenna Ortega is in talks to join Netflix's 'You'.",
    articleBody: "Deadline reports Jenna Ortega is joining Netflix's 'You'.",
    platform: 'Threads' as const,
    allowedEntities: ['Jenna Ortega', 'You'],
  };

  const caption = "EXCLUSIVE: Jenna Ortega joins Netflix's 'You'.";

  assert.equal(failsRSSCaptionFormatting(caption, context), true);
  assert.match(getRSSCaptionHardInvalidReasonCodes(caption, context).join(','), /CAPTION_ARTICLE_PACKAGE_LABEL/);
});

test('caption validation rejects broken quote fragments', () => {
  const context = {
    articleTitle: "Olivia Munn says a male co-star refused to film a scene on 'The Drew Barrymore Show'",
    feedName: 'Variety',
    summary: "Olivia Munn discussed the incident on 'The Drew Barrymore Show'.",
    articleBody: `"It's like, She Can't Save Me. We're Not Doing This."`,
    platform: 'Threads' as const,
    allowedEntities: ['Olivia Munn', 'The Drew Barrymore Show'],
  };

  const caption = "Olivia Munn comments on 'The Drew Barrymore Show'.\n\n\"fell in love with\"";

  assert.equal(failsRSSCaptionFormatting(caption, context), true);
  assert.match(getRSSCaptionHardInvalidReasonCodes(caption, context).join(','), /CAPTION_BROKEN_QUOTE/);
});

test('caption validation allows single-quoted title mentions inside factual supporting lines', () => {
  const context = {
    articleTitle: "Kevin Bacon to star in 'Southern Bastards' pilot at Hulu",
    feedName: 'Variety',
    summary: "Kevin Bacon will lead Hulu pilot 'Southern Bastards'.",
    articleBody: "The Onyx Collective pilot 'Southern Bastards' at Hulu has cast Kevin Bacon in a lead role.",
    platform: 'Facebook' as const,
    canonicalEntity: {
      primarySubject: 'Kevin Bacon',
      mediaTitle: 'Southern Bastards',
      entityType: 'tv' as const,
      eventType: 'casting',
      namedPeople: ['Kevin Bacon'],
      namedCharacters: [],
      allowedEntities: ['Kevin Bacon', 'Southern Bastards'],
      confidence: 0.95,
      ambiguityFlags: [],
    },
    allowedEntities: ['Kevin Bacon', 'Southern Bastards'],
  };

  const caption = "Kevin Bacon to star in 'Southern Bastards' pilot at Hulu.\n\nThe Onyx Collective pilot 'Southern Bastards' has cast Kevin Bacon in a lead role.";

  assert.equal(getRSSCaptionHardInvalidReasonCodes(caption, context).includes('CAPTION_BROKEN_QUOTE'), false);
});

test('caption validation rejects malformed junk headline subjects', () => {
  const context = {
    articleTitle: "The Boys prequel gets a new release date",
    feedName: 'Variety',
    summary: "The Boys prequel has a new release date.",
    articleBody: 'The prequel tied to The Boys is moving forward at Prime Video.',
    platform: 'Threads' as const,
    allowedEntities: ['The Boys'],
  };

  const caption = "'Prequel With Season 5' has a new release date.";

  assert.equal(failsRSSCaptionFormatting(caption, context), true);
  assert.match(getRSSCaptionHardInvalidReasonCodes(caption, context).join(','), /CAPTION_HEADLINE_JUNK/);
});

test('project-led casting extraction prefers the series title over malformed cast fragments', () => {
  const context = {
    articleTitle: "'Wednesday' Season 3 Casts Lena Headey, Andrew McCarthy, James Lance",
    feedName: 'Variety',
    summary: "'Wednesday' Season 3 has added three guest stars.",
    articleBody: 'Lena Headey, Andrew McCarthy, and James Lance will appear in guest star roles in the Netflix series.',
    platform: 'Threads' as const,
    canonicalEntity: {
      primarySubject: 'Wednesday',
      mediaTitle: 'Wednesday',
      entityType: 'tv' as const,
      eventType: 'casting',
      namedPeople: ['Lena Headey', 'Andrew McCarthy', 'James Lance'],
      namedCharacters: [],
      allowedEntities: ['Wednesday', 'Lena Headey', 'Andrew McCarthy', 'James Lance'],
      confidence: 0.95,
      ambiguityFlags: [],
    },
    allowedEntities: ['Wednesday', 'Lena Headey', 'Andrew McCarthy', 'James Lance'],
  };

  const extraction = buildHeuristicRssCaptionExtraction(context);

  assert.equal(extraction.media_title, 'Wednesday');
  assert.equal(extraction.primary_subject, 'Wednesday');
});

test('caption validation rejects malformed casting join headlines built from article fragments', () => {
  const context = {
    articleTitle: "'Wednesday' Season 3 Casts Lena Headey, Andrew McCarthy, James Lance",
    feedName: 'Variety',
    summary: "'Wednesday' Season 3 has added three guest stars.",
    articleBody: 'Lena Headey, Andrew McCarthy, and James Lance will appear in guest star roles in the Netflix series.',
    platform: 'Threads' as const,
    allowedEntities: ['Wednesday', 'Lena Headey', 'Andrew McCarthy', 'James Lance'],
  };

  const caption = "Casts Lena Headey joins 'Season 3 Casts Lena Headey'.\n\n'Wednesday' Season 3 has added three guest stars [...]";

  assert.equal(failsRSSCaptionFormatting(caption, context), true);
  assert.match(getRSSCaptionHardInvalidReasonCodes(caption, context).join(','), /CAPTION_HEADLINE_JUNK/);
});

test('feed fallback is no longer forced for reveal-driven headlines', () => {
  assert.notEqual(
    __rssImageSelectionTestUtils.getRevealDrivenArticleMode({
      title: "First look at 'Clayface' revealed",
      description: 'New images from the film have been released.',
      fallbackImages: [],
    }),
    null
  );

  assert.equal(
    __rssImageSelectionTestUtils.shouldUseFeedFallbackImages({
      title: "First look at 'Clayface' revealed",
      description: 'New images from the film have been released.',
      fallbackImages: [],
    }),
    false
  );
});
