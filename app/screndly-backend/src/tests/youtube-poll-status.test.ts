import test from 'node:test';
import assert from 'node:assert/strict';
import { YouTubePollerService } from '../services/youtube-poller.service';

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => Promise<T> | T): Promise<T> | T {
    const previous = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(overrides)) {
        previous.set(key, process.env[key]);
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }

    const restore = () => {
        for (const [key, value] of previous.entries()) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    };

    try {
        const result = fn();
        if (result && typeof (result as Promise<T>).then === 'function') {
            return (result as Promise<T>).finally(restore);
        }
        restore();
        return result;
    } catch (error) {
        restore();
        throw error;
    }
}

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

test('classifies bot challenge download failures into a probable cause for notifications', () => {
    const service = new YouTubePollerService() as any;

    const classification = service.classifyYouTubeDownloadFailure({
        issueKind: 'bot_challenge',
        issueMessage: 'Please sign in to continue',
        attempts: [{
            mode: 'stable_authenticated_session',
            identityKey: 'direct|stable-ua|cookies:on|impersonate:none',
            proxyEnabled: false,
            cookiesEnabled: true,
            poTokenEnabled: false,
            userAgent: 'stable-ua',
            downloaderMode: 'stable_authenticated_session',
            impersonationTarget: null,
            pacing: {
                enabled: true,
                sleepRequestsSeconds: 1.5,
                minSleepBeforeDownloadSeconds: 8,
                maxSleepBeforeDownloadSeconds: 15,
                minGapBetweenJobsSeconds: 30,
            },
            success: false,
            errorSummary: 'Please sign in to continue',
        }],
        authConfigured: true,
        nextRetryDelayMinutes: 10,
        nextRetryAt: '2026-04-13T10:10:00.000Z',
    });

    assert.equal(classification.category, 'bot_challenge');
    assert.match(classification.probableCause, /bot challenge/i);
    assert.match(classification.retrySummary, /10m/i);
});

test('classifies cookie-auth failures separately from generic blocked downloads', () => {
    const service = new YouTubePollerService() as any;

    const classification = service.classifyYouTubeDownloadFailure({
        issueKind: 'other',
        issueMessage: 'Use --cookies-from-browser or --cookies for the authentication required by this video',
        attempts: [{
            mode: 'stable_identity_proxy_po_token',
            identityKey: 'proxy|stable-ua|cookies:off|impersonate:none',
            proxyEnabled: true,
            cookiesEnabled: false,
            poTokenEnabled: true,
            userAgent: 'stable-ua',
            downloaderMode: 'stable_identity',
            impersonationTarget: null,
            pacing: {
                enabled: true,
                sleepRequestsSeconds: 1.5,
                minSleepBeforeDownloadSeconds: 8,
                maxSleepBeforeDownloadSeconds: 15,
                minGapBetweenJobsSeconds: 30,
            },
            success: false,
            errorSummary: 'Use --cookies-from-browser or --cookies for the authentication required by this video',
        }],
        authConfigured: false,
        nextRetryDelayMinutes: 2,
        nextRetryAt: '2026-04-13T10:02:00.000Z',
    });

    assert.equal(classification.category, 'cookies_missing');
    assert.match(classification.detail, /authenticated youtube session/i);
});

test('classifies rate-limited failures from HTTP 429 responses', () => {
    const service = new YouTubePollerService() as any;

    const classification = service.classifyYouTubeDownloadFailure({
        issueKind: 'other',
        issueMessage: 'HTTP Error 429: Too Many Requests',
        attempts: [{
            mode: 'stable_authenticated_session',
            identityKey: 'proxy|stable-ua|cookies:on|impersonate:none',
            proxyEnabled: true,
            cookiesEnabled: true,
            poTokenEnabled: false,
            userAgent: 'stable-ua',
            downloaderMode: 'stable_authenticated_session',
            impersonationTarget: null,
            pacing: {
                enabled: true,
                sleepRequestsSeconds: 1.5,
                minSleepBeforeDownloadSeconds: 8,
                maxSleepBeforeDownloadSeconds: 15,
                minGapBetweenJobsSeconds: 30,
            },
            success: false,
            errorSummary: 'HTTP Error 429: Too Many Requests',
        }],
        authConfigured: true,
        nextRetryDelayMinutes: 30,
        nextRetryAt: '2026-04-13T10:30:00.000Z',
    });

    assert.equal(classification.category, 'http_429_rate_limited');
    assert.equal(classification.httpStatus, 429);
});

test('keeps bot-challenge download failures retryable even without auth configuration', () => {
    const service = new YouTubePollerService() as any;

    assert.equal(service.shouldPauseDownloadRetries('bot_challenge', false), false);
    assert.equal(service.getDownloadFailureFeedStatus('bot_challenge', false), 'failed');
});

test('applies escalating download retry backoff delays', () => {
    const service = new YouTubePollerService() as any;

    assert.equal(service.getDownloadRetryDelayMinutes(1), 2);
    assert.equal(service.getDownloadRetryDelayMinutes(2), 10);
    assert.equal(service.getDownloadRetryDelayMinutes(3), 30);
    assert.equal(service.getDownloadRetryDelayMinutes(4), 120);
});

test('reads queued download retry state from an existing failed feed item', () => {
    const service = new YouTubePollerService() as any;
    const nextRetryAt = '2026-04-09T18:15:00.000Z';

    const state = service.getDownloadRetryState({
        status: 'failed',
        decisionLog: {
            downloadFailure: {
                attemptCount: 3,
                nextRetryAt,
            },
        },
    });

    assert.equal(state?.attemptCount, 3);
    assert.equal(state?.nextRetryAt?.toISOString(), nextRetryAt);
});

test('queue-level cooldown delays immediate back-to-back downloads on the same identity', async () => {
    await withEnv({
        YT_DLP_MIN_GAP_BETWEEN_JOBS_SECONDS: '0.05',
        YT_DLP_MAX_CONCURRENT_JOBS_PER_IDENTITY: '1',
    }, async () => {
        const service = new YouTubePollerService() as any;
        const identityKey = 'direct|stable-ua|cookies:on|impersonate:none';
        const pacing = service.getDownloaderPacingConfig();

        await service.withDownloaderIdentityGate(identityKey, pacing, async () => undefined);

        const startedAt = Date.now();
        const gate = await service.acquireDownloaderIdentitySlot(identityKey, pacing);
        service.releaseDownloaderIdentitySlot(identityKey);

        assert.ok(Date.now() - startedAt >= 40);
        assert.ok(gate.cooldownDelayMs >= 40);
    });
});

test('identity concurrency limit serializes same-identity downloads', async () => {
    await withEnv({
        YT_DLP_MIN_GAP_BETWEEN_JOBS_SECONDS: '0.001',
        YT_DLP_MAX_CONCURRENT_JOBS_PER_IDENTITY: '1',
    }, async () => {
        const service = new YouTubePollerService() as any;
        const identityKey = 'direct|stable-ua|cookies:on|impersonate:none';
        const pacing = service.getDownloaderPacingConfig();
        const executionOrder: string[] = [];
        const releaseHolder: { release?: () => void } = {};

        const first = service.withDownloaderIdentityGate(identityKey, pacing, async () => {
            executionOrder.push('first-start');
            await new Promise<void>((resolve) => {
                releaseHolder.release = () => {
                    executionOrder.push('first-end');
                    resolve();
                };
            });
        });

        await new Promise((resolve) => setTimeout(resolve, 20));

        const gateHolder: { gate?: { cooldownDelayMs: number; concurrencyDelayMs: number } } = {};
        const second = service.withDownloaderIdentityGate(identityKey, pacing, async (gate: any) => {
            gateHolder.gate = gate;
            executionOrder.push('second-start');
        });

        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.deepEqual(executionOrder, ['first-start']);

        if (releaseHolder.release) {
            releaseHolder.release();
        }
        await Promise.all([first, second]);

        assert.deepEqual(executionOrder, ['first-start', 'first-end', 'second-start']);
        assert.ok((gateHolder.gate?.concurrencyDelayMs ?? 0) >= 15);
    });
});

test('preserves paragraph spacing while stripping hashtags in platform captions', () => {
    const service = new YouTubePollerService() as any;
    const captions = {
        generated: 'First paragraph line one. #Trailer\n\nSecond paragraph line two. #AppleTV',
        fallback: 'Fallback text',
    };
    const settings = {
        platformSettings: {
            instagram: {
                autoCaption: true,
                autoHashtag: false,
            },
        },
    };

    const text = service.buildPlatformPostText('Instagram', captions, {}, settings);

    assert.equal(text, 'First paragraph line one.\n\nSecond paragraph line two.');
});

test('preserves paragraph spacing when hashtags remain enabled', () => {
    const service = new YouTubePollerService() as any;
    const captions = {
        generated: 'Paragraph one.\n\nParagraph two with #Tag',
        fallback: 'Fallback text',
    };
    const settings = {
        platformSettings: {
            instagram: {
                autoCaption: true,
                autoHashtag: true,
            },
        },
    };

    const text = service.buildPlatformPostText('Instagram', captions, {}, settings);

    assert.equal(text, 'Paragraph one.\n\nParagraph two with #Tag');
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

test('keeps polling open on Friday midnight in the configured New York schedule', () => {
    const service = new YouTubePollerService() as any;
    const schedule = {
        enabled: true,
        timezone: 'America/New_York',
        windows: [
            { day: 0, active: false, startTime: null, endTime: null },
            { day: 1, active: true, startTime: '00:00', endTime: '23:59' },
            { day: 2, active: true, startTime: '00:00', endTime: '23:59' },
            { day: 3, active: true, startTime: '00:00', endTime: '23:59' },
            { day: 4, active: true, startTime: '00:00', endTime: '23:59' },
            { day: 5, active: true, startTime: '00:00', endTime: '23:59' },
            { day: 6, active: false, startTime: null, endTime: null },
        ],
    };

    const fridayMidnightEt = new Date('2026-04-10T04:00:00.000Z');
    const fridayMorningEt = new Date('2026-04-10T09:00:00.000Z');

    assert.deepEqual(service.getCurrentScheduleParts('America/New_York', fridayMidnightEt), {
        day: 5,
        minutes: 0,
    });
    assert.equal(service.isPollingScheduleOpen(schedule, fridayMidnightEt).open, true);
    assert.equal(service.isPollingScheduleOpen(schedule, fridayMorningEt).open, true);
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

test('collaborative discovery is throttled onto a slower background cadence', () => {
    const service = new YouTubePollerService() as any;
    const channel = {
        channelId: 'UC_COLLAB',
        name: 'Collab Channel',
    };

    assert.equal(service.shouldRunCollaborativeDiscovery(channel, {}), true);

    const cooldownKey = service.getCollaborativeDiscoveryCooldownKey(channel);
    service.collaborativeDiscoveryLastRunAtByChannel.set(cooldownKey, Date.now());

    assert.equal(service.shouldRunCollaborativeDiscovery(channel, {}), false);
    assert.equal(service.shouldRunCollaborativeDiscovery(channel, { force: true }), true);
});
