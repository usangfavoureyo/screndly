import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applyYouTubeDownloaderOptions,
    DEFAULT_YT_DLP_USER_AGENT,
    getYtDlpNetworkContext,
    getYouTubeDownloaderModeSummary,
    getYouTubeDownloaderPacingConfig,
    getYtDlpImpersonationTarget,
    getYtDlpAuthOptions,
    shouldAllowAndroidSdklessMediaFallback,
} from '../lib/yt-dlp';

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
    const previous = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(overrides)) {
        previous.set(key, process.env[key]);
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }

    try {
        return fn();
    } finally {
        for (const [key, value] of previous.entries()) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

test('youtube downloader pacing config resolves default values', () => {
    const config = withEnv({
        YT_DLP_PACING_ENABLED: undefined,
        YT_DLP_SLEEP_REQUESTS_SECONDS: undefined,
        YT_DLP_SLEEP_INTERVAL_SECONDS: undefined,
        YT_DLP_MAX_SLEEP_INTERVAL_SECONDS: undefined,
        YT_DLP_MIN_GAP_BETWEEN_JOBS_SECONDS: undefined,
        YT_DLP_MAX_CONCURRENT_JOBS_PER_IDENTITY: undefined,
    }, () => getYouTubeDownloaderPacingConfig());

    assert.deepEqual(config, {
        enabled: true,
        sleepRequestsSeconds: 1.5,
        minSleepBeforeDownloadSeconds: 8,
        maxSleepBeforeDownloadSeconds: 15,
        minGapBetweenJobsSeconds: 30,
        maxConcurrentJobsPerIdentity: 1,
    });
});

test('youtube downloader options include pacing and impersonation when enabled', () => {
    const options = withEnv({
        YT_DLP_PACING_ENABLED: 'true',
        YT_DLP_SLEEP_REQUESTS_SECONDS: '1.5',
        YT_DLP_SLEEP_INTERVAL_SECONDS: '8',
        YT_DLP_MAX_SLEEP_INTERVAL_SECONDS: '15',
        YT_DLP_IMPERSONATE_TARGET: 'chrome-120',
    }, () => applyYouTubeDownloaderOptions({ quiet: true, userAgent: DEFAULT_YT_DLP_USER_AGENT }));

    assert.equal(options.quiet, true);
    assert.equal(options.sleepRequests, 1.5);
    assert.equal(options.sleepInterval, 8);
    assert.equal(options.maxSleepInterval, 15);
    assert.equal(options.impersonate, 'chrome-120');
});

test('stable authenticated session mode prefers cookies and stable identity without random UA', () => {
    const summary = withEnv({
        YT_DLP_PROXY_URL: 'http://proxy.example:8080',
        YT_DLP_COOKIE_FILE_PATH: 'C:\\cookies.txt',
        YT_DLP_USER_AGENT: undefined,
        YT_DLP_IMPERSONATE_TARGET: undefined,
    }, () => {
        const firstContext = getYtDlpNetworkContext();
        const secondContext = getYtDlpNetworkContext();
        const mode = getYouTubeDownloaderModeSummary(firstContext);

        assert.equal(firstContext.userAgent, DEFAULT_YT_DLP_USER_AGENT);
        assert.equal(secondContext.userAgent, DEFAULT_YT_DLP_USER_AGENT);
        assert.equal(firstContext.cacheKey, secondContext.cacheKey);

        return mode;
    });

    assert.equal(summary.mode, 'stable_authenticated_session');
    assert.equal(summary.proxyEnabled, true);
    assert.equal(summary.cookiesEnabled, true);
    assert.equal(summary.userAgent, DEFAULT_YT_DLP_USER_AGENT);
    assert.equal(summary.impersonationTarget, null);
    assert.equal(summary.androidSdklessMediaFallbackEnabled, false);
});

test('impersonation target stays optional', () => {
    const impersonationTarget = withEnv({
        YT_DLP_IMPERSONATE_TARGET: undefined,
    }, () => getYtDlpImpersonationTarget());

    assert.equal(impersonationTarget, null);
});

test('android sdkless media fallback is disabled by default when cookies are enabled', () => {
    const enabled = withEnv({
        YT_DLP_COOKIE_FILE_PATH: 'C:\\cookies.txt',
        YT_DLP_ALLOW_ANDROID_SDKLESS_MEDIA_FALLBACK: undefined,
    }, () => shouldAllowAndroidSdklessMediaFallback(getYtDlpNetworkContext()));

    assert.equal(enabled, false);
});

test('android sdkless media fallback can be explicitly re-enabled for debug scenarios', () => {
    const enabled = withEnv({
        YT_DLP_COOKIE_FILE_PATH: 'C:\\cookies.txt',
        YT_DLP_ALLOW_ANDROID_SDKLESS_MEDIA_FALLBACK: 'true',
    }, () => shouldAllowAndroidSdklessMediaFallback(getYtDlpNetworkContext()));

    assert.equal(enabled, true);
});

test('metadata network context stays off the download proxy and cookies by default', () => {
    const contexts = withEnv({
        YT_DLP_PROXY_URL: 'http://download-proxy.example:8080',
        YT_DLP_COOKIE_FILE_PATH: 'C:\\cookies.txt',
        YT_DLP_USE_PROXY_FOR_METADATA: undefined,
        YT_DLP_USE_COOKIES_FOR_METADATA: undefined,
    }, () => ({
        download: getYtDlpNetworkContext('download'),
        metadata: getYtDlpNetworkContext('metadata'),
        metadataOptions: getYtDlpAuthOptions('metadata'),
    }));

    assert.equal(contexts.download.proxyUrl, 'http://download-proxy.example:8080');
    assert.equal(contexts.download.cookiesEnabled, true);
    assert.equal(contexts.metadata.proxyUrl, null);
    assert.equal(contexts.metadata.cookiesEnabled, false);
    assert.equal(contexts.metadataOptions.proxy, undefined);
    assert.equal(contexts.metadataOptions.cookies, undefined);
});

test('metadata path can opt into its own proxy without reusing the download identity', () => {
    const metadata = withEnv({
        YT_DLP_PROXY_URL: 'http://download-proxy.example:8080',
        YT_DLP_METADATA_PROXY_URL: 'http://metadata-proxy.example:8080',
        YT_DLP_USE_COOKIES_FOR_METADATA: 'false',
    }, () => getYtDlpNetworkContext('metadata'));

    assert.equal(metadata.proxyUrl, 'http://metadata-proxy.example:8080');
    assert.equal(metadata.cookiesEnabled, false);
});
