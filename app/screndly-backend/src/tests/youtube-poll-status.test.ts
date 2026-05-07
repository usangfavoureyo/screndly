import test from 'node:test';
import assert from 'node:assert/strict';
import {
    formatYouTubePromoNotificationTitle,
    inferYouTubePromoNotificationAssetLabel,
    YouTubePollerService,
} from '../services/youtube-poller.service';
import { getYtDlpAuthOptions } from '../lib/yt-dlp';
import prisma from '../lib/prisma';

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

test('formats YouTube polling notification titles from the detected promo type', () => {
    assert.equal(
        inferYouTubePromoNotificationAssetLabel('THE SHEEP DETECTIVES | "I Have A Question As Well" Official Clip'),
        'Clip'
    );
    assert.equal(
        inferYouTubePromoNotificationAssetLabel('Squid Game Season 3 | Official Teaser | Netflix'),
        'Teaser'
    );
    assert.equal(
        inferYouTubePromoNotificationAssetLabel('Send Help | Official Trailer | In Theaters Jan 30'),
        'Trailer'
    );
    assert.equal(
        inferYouTubePromoNotificationAssetLabel('Stranger Things 5 | Date Announcement | Netflix'),
        'Announcement'
    );
    assert.equal(
        formatYouTubePromoNotificationTitle('OBSESSION - "Nice Date" Official Clip', 'Published'),
        'New Clip Published'
    );
    assert.equal(
        formatYouTubePromoNotificationTitle('The Witcher Season 5 Cast Announcement', 'Detected'),
        'New Announcement Detected'
    );
    assert.equal(
        formatYouTubePromoNotificationTitle('Example Title | Official Teaser Trailer', 'Detected'),
        'New Teaser Detected'
    );
    assert.equal(
        formatYouTubePromoNotificationTitle('Untitled promo announcement', 'Failed'),
        'New Video Failed'
    );
});

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

test('uses hardened downloader pacing defaults when env is unset', () => {
    withEnv({
        YT_DLP_PACING_ENABLED: undefined,
        YT_DLP_SLEEP_REQUESTS_SECONDS: undefined,
        YT_DLP_SLEEP_INTERVAL_SECONDS: undefined,
        YT_DLP_MAX_SLEEP_INTERVAL_SECONDS: undefined,
        YT_DLP_MIN_GAP_BETWEEN_JOBS_SECONDS: undefined,
        YT_DLP_MAX_CONCURRENT_JOBS_PER_IDENTITY: undefined,
    }, () => {
        const service = new YouTubePollerService() as any;
        const pacing = service.getDownloaderPacingConfig();
        assert.equal(pacing.enabled, true);
        assert.equal(pacing.sleepRequestsSeconds, 2.5);
        assert.equal(pacing.minSleepBeforeDownloadSeconds, 10);
        assert.equal(pacing.maxSleepBeforeDownloadSeconds, 20);
        assert.equal(pacing.minGapBetweenJobsSeconds, 45);
        assert.equal(pacing.maxConcurrentJobsPerIdentity, 1);
    });
});

test('opens identity breaker after repeated 403/bot-challenge failures and blocks new download starts', async () => {
    const service = new YouTubePollerService() as any;
    const identityKey = 'direct|stable-ua|cookies:on|impersonate:none';
    const attempts = [{
        mode: 'stable_authenticated_session',
        identityKey,
        proxyEnabled: false,
        cookiesEnabled: true,
        poTokenEnabled: false,
        userAgent: 'stable-ua',
        downloaderMode: 'stable_authenticated_session',
        impersonationTarget: null,
        pacing: {
            enabled: true,
            sleepRequestsSeconds: 2.5,
            minSleepBeforeDownloadSeconds: 10,
            maxSleepBeforeDownloadSeconds: 20,
            minGapBetweenJobsSeconds: 45,
        },
        success: false,
        errorSummary: 'HTTP Error 403: Forbidden',
    }];

    await service.recordDownloaderIdentityFailure(identityKey, 'other', 'HTTP Error 403: Forbidden', attempts);
    await service.recordDownloaderIdentityFailure(identityKey, 'bot_challenge', 'Sign in to confirm you are not a bot', attempts);

    const state = service.getDownloaderIdentityState(identityKey);
    assert.ok(state.breakerOpenUntil instanceof Date);
    assert.equal(state.isHealthy, false);

    const health = await service.ensureDownloaderIdentityHealthy(identityKey, {
        proxyUrl: null,
        userAgent: 'stable-ua',
        cookieFilePath: null,
        cookiesFromBrowser: null,
        cookiesEnabled: true,
        cacheKey: 'download|direct|stable-ua',
    }, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ');

    assert.equal(health.healthy, false);
    assert.ok(health.deferredMs > 0);
});

test('preflight success restores identity health', async () => {
    const service = new YouTubePollerService() as any;
    const identityKey = 'proxy|stable-ua|cookies:on|impersonate:none';
    const state = service.getDownloaderIdentityState(identityKey);
    state.isHealthy = false;
    state.breakerOpenUntil = null;
    state.lastPreflightAt = null;

    const originalFetch = service.fetchYtDlpInfo;
    service.fetchYtDlpInfo = async () => ({ id: 'ok' });

    const ok = await service.runDownloaderIdentityPreflight(identityKey, {
        proxyUrl: 'http://proxy.example:8080',
        userAgent: 'stable-ua',
        cookieFilePath: 'cookies.txt',
        cookiesFromBrowser: null,
        cookiesEnabled: true,
        cacheKey: 'download|proxy|stable-ua',
    }, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ');

    service.fetchYtDlpInfo = originalFetch;

    assert.equal(ok, true);
    assert.equal(state.isHealthy, true);
    assert.equal(state.lastPreflightStatus, 'ok');
    assert.equal(state.breakerOpenUntil, null);
});

test('preflight failure keeps identity unhealthy and opens breaker', async () => {
    const service = new YouTubePollerService() as any;
    const identityKey = 'proxy|stable-ua|cookies:on|impersonate:none';
    const state = service.getDownloaderIdentityState(identityKey);
    state.isHealthy = false;
    state.breakerOpenUntil = null;

    const originalFetch = service.fetchYtDlpInfo;
    const originalIsBotChallenge = service.isYouTubeBotChallengeError;
    service.fetchYtDlpInfo = async () => {
        throw new Error('HTTP Error 403: Forbidden');
    };
    service.isYouTubeBotChallengeError = () => false;

    const ok = await service.runDownloaderIdentityPreflight(identityKey, {
        proxyUrl: 'http://proxy.example:8080',
        userAgent: 'stable-ua',
        cookieFilePath: 'cookies.txt',
        cookiesFromBrowser: null,
        cookiesEnabled: true,
        cacheKey: 'download|proxy|stable-ua',
    }, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ');

    service.fetchYtDlpInfo = originalFetch;
    service.isYouTubeBotChallengeError = originalIsBotChallenge;

    assert.equal(ok, false);
    assert.equal(state.isHealthy, false);
    assert.equal(state.lastPreflightStatus, 'failed');
    assert.ok(state.breakerOpenUntil instanceof Date);
});

test('metadata auth options do not inherit downloader proxy/cookies by default', () => {
    withEnv({
        YT_DLP_PROXY_URL: 'http://download-proxy.example:8080',
        YT_DLP_COOKIE_FILE_PATH: 'C:\\\\cookies.txt',
        YT_DLP_USE_PROXY_FOR_METADATA: undefined,
        YT_DLP_USE_COOKIES_FOR_METADATA: undefined,
    }, () => {
        const metadataOptions = getYtDlpAuthOptions('metadata');
        assert.equal(metadataOptions.proxy, undefined);
        assert.equal(metadataOptions.cookies, undefined);
    });
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

test('upgrades single newline paragraph breaks to blank-line paragraph spacing', () => {
    const service = new YouTubePollerService() as any;
    const captions = {
        generated: 'Prime Video has released the trailer for Off Campus Season 1.\nElla Bright, Belmont Cameli, and Mika Abdalla star in the college drama.',
        fallback: 'Fallback text',
    };
    const settings = {
        platformSettings: {
            facebook: {
                autoCaption: true,
                autoHashtag: false,
            },
        },
    };

    const text = service.buildPlatformPostText('Facebook', captions, {}, settings);

    assert.equal(
        text,
        'Prime Video has released the trailer for Off Campus Season 1.\n\nElla Bright, Belmont Cameli, and Mika Abdalla star in the college drama.'
    );
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

test('boundary-based owned scan keeps trailer candidate even with repeated non-matching noise above it', () => {
    const service = new YouTubePollerService() as any;
    const now = Date.now();
    const videos = [
        { id: 'v1', link: 'https://www.youtube.com/watch?v=v1', title: 'The Devil Wears Prada 2 | In Theaters May 1', pubDate: new Date(now - 1 * 60 * 1000).toISOString() },
        { id: 'v2', link: 'https://www.youtube.com/watch?v=v2', title: 'The Devil Wears Prada 2 | In Theaters May 1', pubDate: new Date(now - 2 * 60 * 1000).toISOString() },
        { id: 'v3', link: 'https://www.youtube.com/watch?v=v3', title: 'The Devil Wears Prada 2 | In Theaters May 1', pubDate: new Date(now - 3 * 60 * 1000).toISOString() },
        { id: 'v4', link: 'https://www.youtube.com/watch?v=v4', title: 'Send Help | Official Trailer | In Theaters Jan 30', pubDate: new Date(now - 4 * 60 * 1000).toISOString() },
        { id: 'known1', link: 'https://www.youtube.com/watch?v=known1', title: 'Older Known Upload', pubDate: new Date(now - 5 * 60 * 1000).toISOString() },
    ];
    const knownVideoIds = new Set<string>(['known1']);
    const trailerKeywords = ['trailer', 'teaser', 'official'];
    const plan = service.buildOwnedScanCandidatesFromRecentVideos(
        videos,
        trailerKeywords,
        knownVideoIds,
        now - (2 * 24 * 60 * 60 * 1000)
    );

    const titles = plan.candidates.map((video: any) => video.title);
    assert.ok(titles.some((title: string) => /send help/i.test(title)));
    assert.equal(plan.knownBoundaryHit, true);
    assert.ok(plan.dedupedNoiseCount >= 1);
});

test('tryClaimChannel allows reclaiming stale locks before lockUntil expiry', async () => {
    const service = new YouTubePollerService() as any;
    const channelModel = (prisma as any).channel;
    const originalUpdateMany = channelModel.updateMany;
    let capturedWhere: any = null;

    channelModel.updateMany = async (args: any) => {
        capturedWhere = args.where;
        return { count: 0 };
    };

    try {
        await service.tryClaimChannel(
            {
                id: 'db-channel-id',
                status: 'active',
                channelId: 'UC_TEST',
                name: 'Test Channel',
                nextPollAt: new Date(Date.now() - 60_000).toISOString(),
                failureCount: 0,
            },
            { fetchInterval: 2 }
        );
    } finally {
        channelModel.updateMany = originalUpdateMany;
    }

    const staleLockBranch = capturedWhere?.OR?.[2];
    assert.ok(staleLockBranch?.AND);
    assert.equal(Array.isArray(staleLockBranch.AND), true);
});

test('catch-up prioritization moves heavily overdue channels to the front', () => {
    const service = new YouTubePollerService() as any;
    const now = new Date();
    const dueChannels = [
        { id: 'normal', name: 'Normal', nextPollAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString() },
        { id: 'overdue', name: 'Overdue', nextPollAt: new Date(now.getTime() - 25 * 60 * 1000).toISOString() },
        { id: 'mild', name: 'Mild', nextPollAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString() },
    ];

    const result = service.prioritizeDueChannelsForCatchUp(dueChannels, now);
    assert.equal(result.catchUpSweepTriggered, true);
    assert.equal(result.overdueChannels.length, 1);
    assert.equal(result.prioritizedDueChannels[0].id, 'overdue');
});

test('owned-upload yt-dlp fallback does not trigger just because RSS has no newer upload than last check', () => {
    const service = new YouTubePollerService() as any;
    const now = Date.now();
    const channel = {
        id: 'db-channel-id',
        channelId: 'UC_RSS',
        name: 'RSS Channel',
        lastCheck: new Date(now).toISOString(),
    };
    const rssItems = [
        {
            id: 'yt:video:abc123',
            title: 'Older upload',
            pubDate: new Date(now - (10 * 60 * 1000)).toISOString(),
        },
    ];

    const decision = service.shouldRunOwnedVideoYtDlpFallback(channel, { fetchInterval: 2 }, rssItems);
    assert.equal(decision.shouldFallback, false);
});

test('owned-upload yt-dlp fallback applies per-channel cooldown after a stale-RSS fallback run', () => {
    const service = new YouTubePollerService() as any;
    const now = Date.now();
    const channel = {
        id: 'db-channel-id',
        channelId: 'UC_STALE',
        name: 'Stale Channel',
    };
    const rssItems = [
        {
            id: 'yt:video:old',
            title: 'Old upload',
            pubDate: new Date(now - (8 * 60 * 60 * 1000)).toISOString(),
        },
    ];

    const firstDecision = service.shouldRunOwnedVideoYtDlpFallback(channel, { fetchInterval: 2 }, rssItems);
    assert.equal(firstDecision.shouldFallback, true);

    service.ownedVideoYtDlpFallbackLastRunAtByChannel.set(channel.channelId, Date.now());
    const secondDecision = service.shouldRunOwnedVideoYtDlpFallback(channel, { fetchInterval: 2 }, rssItems);
    assert.equal(secondDecision.shouldFallback, false);
});
