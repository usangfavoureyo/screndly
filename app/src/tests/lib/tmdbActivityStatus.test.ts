import { describe, expect, it } from 'vitest';
import type { TMDbActivityStatusSource, TMDbPlatformResultRecord } from '../../lib/tmdb/activityStatus';
import {
  deriveTMDbActivityStatus,
  deriveTMDbPlatformStates,
  getRetryableTMDbPlatforms,
} from '../../lib/tmdb/activityStatus';

function buildItem(overrides: Partial<TMDbActivityStatusSource> = {}): TMDbActivityStatusSource {
  return {
    status: 'queued',
    platforms: ['X', 'Threads', 'Facebook'],
    platformPostIds: {},
    platformResults: [],
    publishedTime: undefined,
    errorMessage: undefined,
    ...overrides,
  };
}

function posted(platform: string, id: string): TMDbPlatformResultRecord {
  return {
    platform,
    status: 'posted',
    id,
    postedAt: '2026-03-29T10:01:00.000Z',
  };
}

function failed(platform: string, error: string): TMDbPlatformResultRecord {
  return {
    platform,
    status: 'failed',
    error,
    postedAt: '2026-03-29T10:01:00.000Z',
  };
}

describe('tmdb activity status helpers', () => {
  it('treats all posted platforms as published with no retry targets', () => {
    const item = buildItem({
      status: 'failed',
      platformPostIds: {
        x: 'x-1',
        threads: 'threads-1',
        facebook: 'facebook-1',
      },
      platformResults: [
        posted('X', 'x-1'),
        posted('Threads', 'threads-1'),
        posted('Facebook', 'facebook-1'),
      ],
    });

    const platformStates = deriveTMDbPlatformStates(item);

    expect(deriveTMDbActivityStatus(item, platformStates)).toBe('published');
    expect(getRetryableTMDbPlatforms(platformStates)).toHaveLength(0);
  });

  it('marks one failed plus two posted as partial_failed and retries only the failed platform', () => {
    const item = buildItem({
      platformPostIds: {
        x: 'x-1',
        facebook: 'facebook-1',
      },
      platformResults: [
        posted('X', 'x-1'),
        failed('Threads', 'timeout'),
        posted('Facebook', 'facebook-1'),
      ],
    });

    const platformStates = deriveTMDbPlatformStates(item);

    expect(deriveTMDbActivityStatus(item, platformStates)).toBe('partial_failed');
    expect(getRetryableTMDbPlatforms(platformStates).map((platform) => platform.platform)).toEqual(['threads']);
  });

  it('retries exactly the two failed platforms when one has already posted', () => {
    const item = buildItem({
      platformPostIds: {
        facebook: 'facebook-1',
      },
      platformResults: [
        failed('X', 'timeout'),
        failed('Threads', 'auth expired'),
        posted('Facebook', 'facebook-1'),
      ],
    });

    const platformStates = deriveTMDbPlatformStates(item);

    expect(deriveTMDbActivityStatus(item, platformStates)).toBe('partial_failed');
    expect(getRetryableTMDbPlatforms(platformStates).map((platform) => platform.platform)).toEqual(['x', 'threads']);
  });

  it('treats all failed platforms as failed and all retryable', () => {
    const item = buildItem({
      status: 'failed',
      platformResults: [
        failed('X', 'timeout'),
        failed('Threads', 'auth expired'),
        failed('Facebook', 'rate limit'),
      ],
    });

    const platformStates = deriveTMDbPlatformStates(item);

    expect(deriveTMDbActivityStatus(item, platformStates)).toBe('failed');
    expect(getRetryableTMDbPlatforms(platformStates).map((platform) => platform.platform)).toEqual(['x', 'threads', 'facebook']);
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
        posted('X', 'x-1'),
        posted('Threads', 'threads-1'),
        posted('Facebook', 'facebook-1'),
      ],
    });

    const platformStates = deriveTMDbPlatformStates(item);

    expect(deriveTMDbActivityStatus(item, platformStates)).toBe('published');
    expect(getRetryableTMDbPlatforms(platformStates)).toHaveLength(0);
  });

  it('treats unscheduled items with a terminal error as failed instead of publishing', () => {
    const item = buildItem({
      status: 'unscheduled',
      platforms: ['X', 'Threads'],
      errorMessage: 'Could not schedule this post on the same day because the day is already full.',
    });

    const platformStates = deriveTMDbPlatformStates(item);

    expect(platformStates.map((platform) => platform.status)).toEqual(['failed', 'failed']);
    expect(deriveTMDbActivityStatus(item, platformStates)).toBe('failed');
  });

  it('treats queued items with a terminal scheduling error as failed instead of publishing', () => {
    const item = buildItem({
      status: 'queued',
      errorMessage: 'Could not schedule this post on the same day because the day is already full.',
    });

    const platformStates = deriveTMDbPlatformStates(item);

    expect(platformStates.map((platform) => platform.status)).toEqual(['failed', 'failed', 'failed']);
    expect(deriveTMDbActivityStatus(item, platformStates)).toBe('failed');
  });
});
