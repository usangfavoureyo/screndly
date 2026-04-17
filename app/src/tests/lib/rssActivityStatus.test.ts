import { describe, expect, it } from 'vitest';
import type { RSSActivityItem } from '../../contexts/RSSFeedsContext';
import {
  deriveRSSActivityStatus,
  deriveRSSPlatformStates,
  getRetryableRSSPlatforms,
} from '../../lib/rss/activityStatus';

function buildItem(overrides: Partial<RSSActivityItem> = {}): RSSActivityItem {
  return {
    id: 'activity-1',
    feedId: 'feed-1',
    feedName: 'Feed One',
    title: 'Example title',
    status: 'pending',
    timestamp: new Date('2026-03-29T10:00:00.000Z').toISOString(),
    platforms: ['x', 'threads', 'facebook'],
    platformPostIds: {},
    platformResults: [],
    ...overrides,
  };
}

describe('rss activity status helpers', () => {
  it('treats published items without platform detail rows as published', () => {
    const item = buildItem({
      status: 'published',
      platforms: [],
      platformPostIds: {},
      platformResults: [],
    });

    const platformStates = deriveRSSPlatformStates(item);

    expect(platformStates).toEqual([]);
    expect(deriveRSSActivityStatus(item, platformStates)).toBe('published');
  });

  it('treats failed items without platform detail rows as failed', () => {
    const item = buildItem({
      status: 'failed',
      platforms: [],
      platformPostIds: {},
      platformResults: [],
      error: 'Publish failed',
    });

    const platformStates = deriveRSSPlatformStates(item);

    expect(platformStates).toEqual([]);
    expect(deriveRSSActivityStatus(item, platformStates)).toBe('failed');
  });

  it('treats all posted platforms as published with no retry targets', () => {
    const item = buildItem({
      status: 'published',
      platformPostIds: {
        x: 'x-1',
        threads: 'threads-1',
        facebook: 'facebook-1',
      },
      platformResults: [
        { platform: 'X', status: 'posted', postedAt: '2026-03-29T10:01:00.000Z', id: 'x-1' },
        { platform: 'Threads', status: 'posted', postedAt: '2026-03-29T10:02:00.000Z', id: 'threads-1' },
        { platform: 'Facebook', status: 'posted', postedAt: '2026-03-29T10:03:00.000Z', id: 'facebook-1' },
      ],
    });

    const platformStates = deriveRSSPlatformStates(item);

    expect(deriveRSSActivityStatus(item, platformStates)).toBe('published');
    expect(getRetryableRSSPlatforms(platformStates)).toHaveLength(0);
  });

  it('marks one failed plus two posted as partial_failed and retries only the failed platform', () => {
    const item = buildItem({
      platformPostIds: {
        x: 'x-1',
        facebook: 'facebook-1',
      },
      platformResults: [
        { platform: 'X', status: 'posted', postedAt: '2026-03-29T10:01:00.000Z', id: 'x-1' },
        { platform: 'Threads', status: 'failed', postedAt: '2026-03-29T10:02:00.000Z', error: 'timeout' },
        { platform: 'Facebook', status: 'posted', postedAt: '2026-03-29T10:03:00.000Z', id: 'facebook-1' },
      ],
    });

    const platformStates = deriveRSSPlatformStates(item);

    expect(deriveRSSActivityStatus(item, platformStates)).toBe('partial_failed');
    expect(getRetryableRSSPlatforms(platformStates).map((platform) => platform.platform)).toEqual(['threads']);
  });

  it('retries exactly the two failed platforms when one has already posted', () => {
    const item = buildItem({
      platformPostIds: {
        facebook: 'facebook-1',
      },
      platformResults: [
        { platform: 'X', status: 'failed', postedAt: '2026-03-29T10:01:00.000Z', error: 'timeout' },
        { platform: 'Threads', status: 'failed', postedAt: '2026-03-29T10:02:00.000Z', error: 'auth expired' },
        { platform: 'Facebook', status: 'posted', postedAt: '2026-03-29T10:03:00.000Z', id: 'facebook-1' },
      ],
    });

    const platformStates = deriveRSSPlatformStates(item);

    expect(deriveRSSActivityStatus(item, platformStates)).toBe('partial_failed');
    expect(getRetryableRSSPlatforms(platformStates).map((platform) => platform.platform)).toEqual(['x', 'threads']);
  });

  it('treats all failed platforms as failed and all retryable', () => {
    const item = buildItem({
      status: 'failed',
      platformResults: [
        { platform: 'X', status: 'failed', postedAt: '2026-03-29T10:01:00.000Z', error: 'timeout' },
        { platform: 'Threads', status: 'failed', postedAt: '2026-03-29T10:02:00.000Z', error: 'auth expired' },
        { platform: 'Facebook', status: 'failed', postedAt: '2026-03-29T10:03:00.000Z', error: 'rate limit' },
      ],
    });

    const platformStates = deriveRSSPlatformStates(item);

    expect(deriveRSSActivityStatus(item, platformStates)).toBe('failed');
    expect(getRetryableRSSPlatforms(platformStates).map((platform) => platform.platform)).toEqual(['x', 'threads', 'facebook']);
  });

  it('does not leave a stale failed state once every platform has posted', () => {
    const item = buildItem({
      status: 'failed',
      platformPostIds: {
        x: 'x-1',
        threads: 'threads-1',
        facebook: 'facebook-1',
      },
      platformResults: [
        { platform: 'X', status: 'posted', postedAt: '2026-03-29T10:01:00.000Z', id: 'x-1' },
        { platform: 'Threads', status: 'posted', postedAt: '2026-03-29T10:02:00.000Z', id: 'threads-1' },
        { platform: 'Facebook', status: 'posted', postedAt: '2026-03-29T10:03:00.000Z', id: 'facebook-1' },
      ],
    });

    const platformStates = deriveRSSPlatformStates(item);

    expect(deriveRSSActivityStatus(item, platformStates)).toBe('published');
    expect(getRetryableRSSPlatforms(platformStates)).toHaveLength(0);
  });
});
