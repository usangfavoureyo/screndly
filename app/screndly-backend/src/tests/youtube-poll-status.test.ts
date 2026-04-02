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
