import test from 'node:test';
import assert from 'node:assert/strict';
import { YouTubePollerService } from '../services/youtube-poller.service';

test('reports stale poll state when an active channel worker exceeds the stale threshold', () => {
    const service = new YouTubePollerService() as any;
    const startedAt = new Date(Date.now() - (31 * 60 * 1000));

    service.activeChannelJobs.set('channel-db-id', {
        channelDbId: 'channel-db-id',
        channelId: 'UC_TEST',
        channelName: 'Test Channel',
        startedAt,
        mode: 'scheduled',
    });
    service.lastPollStartedAt = startedAt;

    const status = service.getPollStatus();

    assert.equal(status.isPolling, true);
    assert.equal(status.currentChannelId, 'UC_TEST');
    assert.equal(status.currentChannelName, 'Test Channel');
    assert.equal(status.pollStartedAt, startedAt.toISOString());
    assert.equal(status.stale, true);
    assert.equal(status.staleAfterMs, 30 * 60 * 1000);
    assert.equal(status.activeWorkerCount, 1);
    assert.equal(status.activeChannels[0]?.mode, 'scheduled');
});

test('applies the expected polling backoff multipliers', () => {
    const service = new YouTubePollerService() as any;

    assert.equal(service.computeBackoffIntervalMinutes(2, 1), 2);
    assert.equal(service.computeBackoffIntervalMinutes(2, 2), 4);
    assert.equal(service.computeBackoffIntervalMinutes(4, 3), 15);
    assert.equal(service.computeBackoffIntervalMinutes(10, 4), 15);
});

test('classifies YouTube access issues by retryability', () => {
    const service = new YouTubePollerService() as any;

    assert.equal(
        service.getYouTubeAccessIssueKind(new Error('ERROR: [youtube] abc123: This video is not available')),
        'unavailable'
    );
    assert.equal(
        service.getYouTubeAccessIssueKind(new Error('Please sign in to continue')),
        'bot_challenge'
    );
    assert.equal(
        service.getYouTubeAccessIssueKind(new Error('Playback on other websites has been disabled by the video owner')),
        'restricted'
    );
});

test('keeps bot-challenge download failures retryable even without auth configuration', () => {
    const service = new YouTubePollerService() as any;

    assert.equal(service.shouldPauseDownloadRetries('bot_challenge', false), false);
    assert.equal(service.getDownloadFailureFeedStatus('bot_challenge', false), 'failed');
});

test('respects the configured polling schedule window', () => {
    const service = new YouTubePollerService() as any;
    const schedule = {
        enabled: true,
        timezone: 'America/New_York',
        windows: [
            { day: 0, active: true, startTime: '18:00', endTime: '23:59' },
            { day: 1, active: true, startTime: '00:00', endTime: '23:59' },
            { day: 2, active: true, startTime: '00:00', endTime: '23:59' },
            { day: 3, active: true, startTime: '00:00', endTime: '23:59' },
            { day: 4, active: true, startTime: '00:00', endTime: '23:59' },
            { day: 5, active: true, startTime: '00:00', endTime: '23:59' },
            { day: 6, active: false, startTime: null, endTime: null },
        ],
    };

    const saturdayNoonEt = new Date('2026-04-04T16:00:00.000Z');
    const sundayAfternoonEt = new Date('2026-04-05T20:30:00.000Z');
    const sundayEveningEt = new Date('2026-04-05T22:30:00.000Z');

    assert.equal(service.isPollingScheduleOpen(schedule, saturdayNoonEt).open, false);
    assert.equal(service.isPollingScheduleOpen(schedule, sundayAfternoonEt).open, false);
    assert.equal(service.isPollingScheduleOpen(schedule, sundayEveningEt).open, true);
});

test('routes destination-aware trailer keywords independently per publish area', () => {
    const service = new YouTubePollerService() as any;
    const settings = {
        platformSettings: {
            youtube: {
                autoPost: true,
                destinations: {
                    longForm: { selectedTrailerKeywords: ['Trailer', 'Title Reveal'] },
                    shorts: { selectedTrailerKeywords: ['Clip'] },
                },
            },
            instagram: {
                autoPost: true,
                destinations: {
                    reels: { selectedTrailerKeywords: ['Trailer', 'Teaser'] },
                    stories: { selectedTrailerKeywords: ['Title Reveal'] },
                },
            },
            facebook: {
                autoPost: true,
                destinations: {
                    feed: { selectedTrailerKeywords: ['Trailer'] },
                    stories: { selectedTrailerKeywords: [] },
                },
            },
            tiktok: {
                autoPost: true,
                selectedTrailerKeywords: ['Clip'],
            },
        },
    };

    const autoPostTargets = service.getAutoPostPlatforms(settings);
    const routing = service.getTargetPlatformsForVideo(
        'official trailer for example movie',
        settings,
        autoPostTargets
    );

    assert.deepEqual(
        routing.platforms.sort(),
        ['FacebookFeed', 'InstagramReels', 'YouTubeLongform'].sort()
    );
    assert.deepEqual(routing.matchedKeywordsByPlatform.YouTubeLongform, ['trailer']);
    assert.deepEqual(routing.matchedKeywordsByPlatform.YouTubeShorts, []);
    assert.deepEqual(routing.matchedKeywordsByPlatform.InstagramStories, []);
});

test('falls back from old flat platform routing into all supported destinations', () => {
    const service = new YouTubePollerService() as any;
    const settings = {
        platformSettings: {
            youtube: {
                autoPost: true,
                selectedTrailerKeywords: ['Trailer', 'Teaser'],
            },
        },
    };

    const autoPostTargets = service.getAutoPostPlatforms(settings);
    const routing = service.getTargetPlatformsForVideo(
        'official teaser for example movie',
        settings,
        autoPostTargets
    );

    assert.deepEqual(
        routing.platforms.sort(),
        ['YouTubeLongform', 'YouTubeShorts'].sort()
    );
});
