import test from 'node:test';
import assert from 'node:assert/strict';
import { __rssDedupeTestUtils } from '../services/rss.service';

const { assessRSSArticleSpeculation, buildRSSSpeculationFilterReason } = __rssDedupeTestUtils;

test('classifies speculation-heavy rumor articles as blocked speculation or rumor', () => {
  const assessment = assessRSSArticleSpeculation({
    title: "Captain Marvel's Avengers: Doomsday Return Suddenly Sounds More Likely",
    link: 'https://comicbook.com/example',
    description:
      "Though Brie Larson's return to the next Avengers movie hasn't been announced, many fans still believe she may appear and new comments suggest it could happen.",
    contentHtml:
      "<p>Though Brie Larson's return to the next Avengers movie hasn't been announced, many fans still believe she may appear. This suggests Captain Marvel could still factor into the film.</p>",
    pubDate: new Date(),
    imageUrls: [],
  });

  assert.equal(assessment.shouldSkipPublish, true);
  assert.match(assessment.classification, /speculation|rumor/);
  assert.ok(assessment.score >= 9);
  assert.ok(assessment.reasonCodes.includes('ARTICLE_NO_CONFIRMATION'));
});

test('classifies reportedly-driven stories as semi-confirmed and keeps uncertainty tone enabled', () => {
  const assessment = assessRSSArticleSpeculation({
    title: "Ryan Gosling reportedly in talks to join Shawn Levy's next Star Wars film",
    link: 'https://deadline.com/example',
    description:
      'Ryan Gosling is reportedly in talks to star in the upcoming Star Wars project directed by Shawn Levy.',
    contentHtml:
      '<p>Deadline reports Ryan Gosling is in talks to star in Shawn Levy\'s next Star Wars film.</p>',
    pubDate: new Date(),
    imageUrls: [],
  });

  assert.equal(assessment.classification, 'semi_confirmed');
  assert.equal(assessment.shouldSkipPublish, false);
  assert.equal(assessment.shouldUseUncertaintyTone, true);
});

test('keeps hard-confirmation articles out of speculation mode', () => {
  const assessment = assessRSSArticleSpeculation({
    title: "Prime Video renews 'Fallout' for Season 3",
    link: 'https://variety.com/example',
    description: "Prime Video has officially announced that 'Fallout' will return for a third season.",
    contentHtml:
      "<p>Prime Video officially announced and confirmed 'Fallout' Season 3 in a new statement.</p>",
    pubDate: new Date(),
    imageUrls: [],
  });

  assert.equal(assessment.classification, 'confirmed_news');
  assert.equal(assessment.shouldSkipPublish, false);
});

test('builds a readable speculation filter reason with reason codes and phrases', () => {
  const reason = buildRSSSpeculationFilterReason({
    classification: 'speculation',
    score: 11,
    detectedPhrases: ['sounds more likely', 'not confirmed'],
    reasonCodes: ['ARTICLE_SPECULATION_HIGH', 'ARTICLE_NO_CONFIRMATION'],
    hardEvidencePhrases: [],
    shouldSkipPublish: true,
    shouldUseUncertaintyTone: true,
  });

  assert.match(reason, /ARTICLE_SPECULATION_HIGH/);
  assert.match(reason, /ARTICLE_NO_CONFIRMATION/);
  assert.match(reason, /sounds more likely/);
});
