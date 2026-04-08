import { describe, expect, it } from 'vitest';
import type { RSSActivityItem } from '../../contexts/RSSFeedsContext';
import { getPublishedTodayCount } from '../../utils/rssActivityStats';

function buildActivity(overrides: Partial<RSSActivityItem> = {}): RSSActivityItem {
  return {
    id: overrides.id ?? 'activity-1',
    feedName: overrides.feedName ?? 'Feed',
    title: overrides.title ?? 'Title',
    status: overrides.status ?? 'published',
    timestamp: overrides.timestamp ?? '2026-04-08T09:00:00.000Z',
    platforms: overrides.platforms ?? ['threads'],
    ...overrides,
  };
}

describe('getPublishedTodayCount', () => {
  it('counts only published items from the same local day', () => {
    const items = [
      buildActivity({
        id: 'published-today',
        status: 'published',
        publishedAt: '2026-04-08T10:00:00.000Z',
      }),
      buildActivity({
        id: 'published-yesterday',
        status: 'published',
        publishedAt: '2026-04-06T12:00:00.000Z',
      }),
      buildActivity({
        id: 'failed-today',
        status: 'failed',
        timestamp: '2026-04-08T11:00:00.000Z',
      }),
    ];

    expect(getPublishedTodayCount(items, new Date('2026-04-08T12:00:00.000Z'))).toBe(1);
  });

  it('falls back to timestamp when publishedAt is missing', () => {
    const items = [
      buildActivity({
        id: 'published-via-timestamp',
        status: 'published',
        publishedAt: undefined,
        timestamp: '2026-04-08T08:30:00.000Z',
      }),
    ];

    expect(getPublishedTodayCount(items, new Date('2026-04-08T12:00:00.000Z'))).toBe(1);
  });
});
