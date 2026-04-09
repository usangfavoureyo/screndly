import test from 'node:test';
import assert from 'node:assert/strict';
import { __rssDedupeTestUtils } from '../services/rss.service';

const {
  buildRSSTopicFingerprint,
  buildRSSNewsEventFingerprint,
  areRSSTopicFingerprintsSimilar,
  areRSSNewsEventsSimilar,
  areRSSSubjectsInCooldown,
  getRSSItemLocalSeenKeys,
  buildRSSCaptionAllowedEntities,
  buildRSSCaptionVisualContext,
} = __rssDedupeTestUtils;

test('treats cross-source Extraction 3 confirmations as the same topic', () => {
  const variety = buildRSSTopicFingerprint(
    'Chris Hemsworth\'s Extraction 3 Confirmed At Netflix'
  );
  const deadline = buildRSSTopicFingerprint(
    'Chris Hemsworth is set to return for Netflix\'s Extraction 3 as Deadline reports the reprise'
  );

  assert.equal(areRSSTopicFingerprintsSimilar(variety, deadline), true);
  assert.equal(areRSSSubjectsInCooldown(variety, deadline), true);
});

test('local seen keys include a topic key so same-story link variants can be blocked in one feed run', () => {
  const keys = getRSSItemLocalSeenKeys({
    title: "Jeff Shell Officially Out as Paramount's President",
    link: 'https://variety.com/story-a',
    description: '',
    pubDate: new Date(),
    imageUrls: [],
  });

  assert.equal(keys.some((key: string) => key.startsWith('link:')), true);
  assert.equal(keys.some((key: string) => key.startsWith('topic:')), true);
  assert.equal(keys.some((key: string) => key.startsWith('event:')), true);
});

test('canonical event fingerprint catches cross-source same-news stories with different wording', () => {
  const variety = buildRSSNewsEventFingerprint({
    title: "Chris Hemsworth's Extraction 3 Confirmed At Netflix",
    description: "Chris Hemsworth will return for Netflix's Extraction 3.",
    contentHtml: '<p>Sam Hargrave will direct the sequel.</p>',
    link: 'https://variety.com/story-a',
    pubDate: new Date(),
    imageUrls: [],
  });
  const deadline = buildRSSNewsEventFingerprint({
    title: "Chris Hemsworth is set to return for Netflix's Extraction 3 as Deadline reports the reprise",
    description: 'Sam Hargrave is returning to direct, with Idris Elba and Golshifteh Farahani also closing deals.',
    contentHtml: '<p>Netflix is moving forward with Extraction 3.</p>',
    link: 'https://deadline.com/story-b',
    pubDate: new Date(),
    imageUrls: [],
  });

  assert.equal(areRSSNewsEventsSimilar(variety, deadline), true);
});

test('caption grounding ignores image-derived entities that do not appear in the article', () => {
  const item = {
    title: "Jeff Shell Officially Out as Paramount's President",
    description: 'Company says exec is stepping down to focus on lawsuit filed against him.',
    contentHtml: '<p>Jeff Shell is officially departing his role as president of Paramount Skydance.</p>',
    pubDate: new Date(),
    imageUrls: [],
    link: 'https://variety.com/story-a',
  };

  const images = [
    {
      url: 'https://example.com/wrong-image.jpg',
      reason: 'TMDb backdrop for Brent Forever: Live From Brooklyn Paramount',
      source: 'tmdb' as const,
    },
  ];

  const allowedEntities = buildRSSCaptionAllowedEntities(item as any, images as any) || [];
  assert.equal(allowedEntities.some((entry: string) => /Brent Forever/i.test(entry)), false);
  assert.equal(buildRSSCaptionVisualContext(item as any, images as any), undefined);
});
