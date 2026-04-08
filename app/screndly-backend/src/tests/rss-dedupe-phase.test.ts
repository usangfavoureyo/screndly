import test from 'node:test';
import assert from 'node:assert/strict';
import { __rssDedupeTestUtils } from '../services/rss.service';

const {
  buildRSSTopicFingerprint,
  areRSSTopicFingerprintsSimilar,
  areRSSSubjectsInCooldown,
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

