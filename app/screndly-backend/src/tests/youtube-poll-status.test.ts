import test from 'node:test';
import assert from 'node:assert/strict';
import { YouTubePollerService } from '../services/youtube-poller.service';

test('reports stale poll state when in-memory lock exceeds threshold', () => {
    const service = new YouTubePollerService() as any;
    const startedAt = new Date(Date.now() - (31 * 60 * 1000));

    service.isPolling = true;
    service.pollStartedAt = startedAt;
    service.currentChannelId = 'UC_TEST';
    service.currentChannelName = 'Test Channel';
    service.lastPollStartedAt = startedAt;

    const status = service.getPollStatus();

    assert.equal(status.isPolling, true);
    assert.equal(status.currentChannelId, 'UC_TEST');
    assert.equal(status.currentChannelName, 'Test Channel');
    assert.equal(status.pollStartedAt, startedAt.toISOString());
    assert.equal(status.stale, true);
    assert.equal(status.staleAfterMs, 30 * 60 * 1000);
});

