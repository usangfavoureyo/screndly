import test from 'node:test';
import assert from 'node:assert/strict';
import { __designStudioAutoTestUtils } from '../services/design-studio.service';
import type { RSSActivityItem } from '../services/rss.service';

function buildActivityItem(overrides: Partial<RSSActivityItem>): RSSActivityItem {
  return {
    id: 'rss-activity-test',
    feedId: 'feed-1',
    feedName: 'Variety',
    title: 'Test title',
    description: '',
    contentHtml: '',
    status: 'pending',
    timestamp: new Date('2026-04-08T10:00:00.000Z').toISOString(),
    platforms: [],
    ...overrides,
  };
}

test('allows scripted movie and TV coverage for Design Studio auto editorials', () => {
  const movieCandidate = __designStudioAutoTestUtils.evaluateAutoEditorialNarrativeEligibility(
    buildActivityItem({
      title: "Spider-Man: Brand New Day trailer release date confirmed",
      description: 'The upcoming Marvel movie will debut a new trailer this week.',
      imageSource: 'tmdb',
    }),
    'release date',
  );

  const tvCandidate = __designStudioAutoTestUtils.evaluateAutoEditorialNarrativeEligibility(
    buildActivityItem({
      title: "Daredevil: Born Again season 2 adds a major cast member",
      description: 'The Marvel TV series expands its cast ahead of production.',
    }),
    'cast',
  );

  assert.equal(movieCandidate.eligible, true);
  assert.equal(tvCandidate.eligible, true);
});

test('blocks non-narrative categories from Design Studio auto editorials', () => {
  const blockedTitles = [
    {
      title: 'WWE announces a new SmackDown premiere special',
      reason: /wrestling/i,
    },
    {
      title: 'Netflix documentary on pop culture gets a new trailer',
      reason: /documentaries?/i,
    },
    {
      title: 'Stand-up comedy special lands a release date at Netflix',
      reason: /stand-up/i,
    },
    {
      title: 'Reality series Love Island gets a premiere update',
      reason: /reality/i,
    },
    {
      title: 'Lifestyle home renovation series gets renewed for another season',
      reason: /lifestyle/i,
    },
  ];

  for (const blocked of blockedTitles) {
    const result = __designStudioAutoTestUtils.evaluateAutoEditorialNarrativeEligibility(
      buildActivityItem({
        title: blocked.title,
        description: blocked.title,
      }),
      'premiere',
    );

    assert.equal(result.eligible, false, `${blocked.title} should be blocked`);
    assert.match(result.reason || '', blocked.reason);
  }
});
