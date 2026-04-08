import test from 'node:test';
import assert from 'node:assert/strict';
import { __rssCaptionTestUtils } from '../services/ai.service';
import { __rssImageSelectionTestUtils } from '../services/rss-image-selection.service';

const {
  buildHeuristicRssCaptionExtraction,
  enforceRSSCaptionPunctuation,
  failsRSSCaptionFormatting,
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

test('headline normalization strips publisher prefix tokens', () => {
  assert.equal(
    normalizeRSSHeadlineInput("LISTEN: Andra Day backs No Kid Hungry's campaign"),
    "Andra Day backs No Kid Hungry's campaign"
  );
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
