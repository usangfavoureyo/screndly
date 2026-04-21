import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildComposeSourceTextFromMetadata,
  buildComposeMediaDownloadOptions,
  buildComposeMediaNetworkOptions,
  detectComposeMediaUrlPlatform,
  normalizeComposeMediaUrlEntries,
} from '../services/compose-media-url-import.service';

test('detectComposeMediaUrlPlatform supports public YouTube URLs', () => {
  assert.equal(detectComposeMediaUrlPlatform('https://www.youtube.com/watch?v=abc123'), 'youtube');
  assert.equal(detectComposeMediaUrlPlatform('https://youtu.be/abc123'), 'youtube');
  assert.equal(detectComposeMediaUrlPlatform('https://www.youtube.com/shorts/abc123'), 'youtube');
});

test('detectComposeMediaUrlPlatform supports public Instagram URLs', () => {
  assert.equal(detectComposeMediaUrlPlatform('https://www.instagram.com/p/abc123/'), 'instagram');
  assert.equal(detectComposeMediaUrlPlatform('https://www.instagram.com/reel/abc123/'), 'instagram');
});

test('buildComposeMediaDownloadOptions caps YouTube video imports at 1080p mp4', () => {
  const options = buildComposeMediaDownloadOptions('youtube', 'video', '/tmp/asset.%(ext)s');

  assert.equal(options.output, '/tmp/asset.%(ext)s');
  assert.equal(options.mergeOutputFormat, 'mp4');
  assert.match(String(options.format), /height<=1080/);
  assert.match(String(options.format), /mp4/);
});

test('buildComposeMediaDownloadOptions uses best available Instagram media quality', () => {
  const videoOptions = buildComposeMediaDownloadOptions('instagram', 'video', '/tmp/video.%(ext)s');
  const imageOptions = buildComposeMediaDownloadOptions('instagram', 'image', '/tmp/image.%(ext)s');

  assert.equal(videoOptions.output, '/tmp/video.%(ext)s');
  assert.equal(videoOptions.format, 'best');
  assert.equal(videoOptions.mergeOutputFormat, 'mp4');
  assert.equal(imageOptions.output, '/tmp/image.%(ext)s');
  assert.equal(imageOptions.format, 'best');
});

test('buildComposeMediaNetworkOptions applies configured auth context to Instagram imports', () => {
  const previousProxy = process.env.YT_DLP_PROXY_URL;
  const previousUserAgent = process.env.YT_DLP_USER_AGENT;
  const previousCookieFilePath = process.env.YT_DLP_COOKIE_FILE_PATH;
  const previousCookiesFromBrowser = process.env.YT_DLP_COOKIES_FROM_BROWSER;

  process.env.YT_DLP_PROXY_URL = 'http://127.0.0.1:8080';
  process.env.YT_DLP_USER_AGENT = 'ScrendlyImportAgent/1.0';
  process.env.YT_DLP_COOKIE_FILE_PATH = '/tmp/instagram-cookies.txt';
  process.env.YT_DLP_COOKIES_FROM_BROWSER = 'chrome';

  try {
    const authenticated = buildComposeMediaNetworkOptions('download', 'authenticated');
    const publicOptions = buildComposeMediaNetworkOptions('download', 'public');

    assert.equal(authenticated.proxy, 'http://127.0.0.1:8080');
    assert.equal(authenticated.userAgent, 'ScrendlyImportAgent/1.0');
    assert.equal(authenticated.cookies, '/tmp/instagram-cookies.txt');
    assert.equal(authenticated.cookiesFromBrowser, 'chrome');

    assert.equal(publicOptions.proxy, 'http://127.0.0.1:8080');
    assert.equal(publicOptions.userAgent, 'ScrendlyImportAgent/1.0');
    assert.equal(publicOptions.cookies, undefined);
    assert.equal(publicOptions.cookiesFromBrowser, undefined);
  } finally {
    if (previousProxy === undefined) {
      delete process.env.YT_DLP_PROXY_URL;
    } else {
      process.env.YT_DLP_PROXY_URL = previousProxy;
    }

    if (previousUserAgent === undefined) {
      delete process.env.YT_DLP_USER_AGENT;
    } else {
      process.env.YT_DLP_USER_AGENT = previousUserAgent;
    }

    if (previousCookieFilePath === undefined) {
      delete process.env.YT_DLP_COOKIE_FILE_PATH;
    } else {
      process.env.YT_DLP_COOKIE_FILE_PATH = previousCookieFilePath;
    }

    if (previousCookiesFromBrowser === undefined) {
      delete process.env.YT_DLP_COOKIES_FROM_BROWSER;
    } else {
      process.env.YT_DLP_COOKIES_FROM_BROWSER = previousCookiesFromBrowser;
    }
  }
});

test('buildComposeMediaNetworkOptions can reuse download auth context for YouTube metadata fallbacks', () => {
  const previousProxy = process.env.YT_DLP_PROXY_URL;
  const previousUserAgent = process.env.YT_DLP_USER_AGENT;
  const previousCookieFilePath = process.env.YT_DLP_COOKIE_FILE_PATH;
  const previousCookiesFromBrowser = process.env.YT_DLP_COOKIES_FROM_BROWSER;
  const previousUseCookiesForMetadata = process.env.YT_DLP_USE_COOKIES_FOR_METADATA;

  process.env.YT_DLP_PROXY_URL = 'http://127.0.0.1:8080';
  process.env.YT_DLP_USER_AGENT = 'ScrendlyYouTubeImportAgent/1.0';
  process.env.YT_DLP_COOKIE_FILE_PATH = '/tmp/youtube-cookies.txt';
  delete process.env.YT_DLP_COOKIES_FROM_BROWSER;
  delete process.env.YT_DLP_USE_COOKIES_FOR_METADATA;

  try {
    const defaultMetadataOptions = buildComposeMediaNetworkOptions('metadata', 'authenticated');
    const cookieBackedMetadataOptions = buildComposeMediaNetworkOptions('metadata', 'authenticated', 'download');

    assert.equal(defaultMetadataOptions.cookies, undefined);
    assert.equal(cookieBackedMetadataOptions.proxy, 'http://127.0.0.1:8080');
    assert.equal(cookieBackedMetadataOptions.userAgent, 'ScrendlyYouTubeImportAgent/1.0');
    assert.equal(cookieBackedMetadataOptions.cookies, '/tmp/youtube-cookies.txt');
  } finally {
    if (previousProxy === undefined) {
      delete process.env.YT_DLP_PROXY_URL;
    } else {
      process.env.YT_DLP_PROXY_URL = previousProxy;
    }

    if (previousUserAgent === undefined) {
      delete process.env.YT_DLP_USER_AGENT;
    } else {
      process.env.YT_DLP_USER_AGENT = previousUserAgent;
    }

    if (previousCookieFilePath === undefined) {
      delete process.env.YT_DLP_COOKIE_FILE_PATH;
    } else {
      process.env.YT_DLP_COOKIE_FILE_PATH = previousCookieFilePath;
    }

    if (previousCookiesFromBrowser === undefined) {
      delete process.env.YT_DLP_COOKIES_FROM_BROWSER;
    } else {
      process.env.YT_DLP_COOKIES_FROM_BROWSER = previousCookiesFromBrowser;
    }

    if (previousUseCookiesForMetadata === undefined) {
      delete process.env.YT_DLP_USE_COOKIES_FOR_METADATA;
    } else {
      process.env.YT_DLP_USE_COOKIES_FOR_METADATA = previousUseCookiesForMetadata;
    }
  }
});

test('normalizeComposeMediaUrlEntries expands Instagram carousel metadata into ordered media entries', () => {
  const entries = normalizeComposeMediaUrlEntries('https://www.instagram.com/p/test/', {
    title: 'Carousel',
    entries: [
      { id: 'img-1', title: 'Slide 1', ext: 'jpg', webpage_url: 'https://www.instagram.com/p/test/?img_index=1' },
      { id: 'vid-2', title: 'Slide 2', ext: 'mp4', webpage_url: 'https://www.instagram.com/p/test/?img_index=2' },
    ],
  });

  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => entry.kind), ['image', 'video']);
  assert.deepEqual(entries.map((entry) => entry.order), [0, 1]);
});

test('buildComposeSourceTextFromMetadata formats YouTube descriptions into generation-friendly source text', () => {
  const sourceText = buildComposeSourceTextFromMetadata(
    'youtube',
    'https://www.youtube.com/watch?v=test123',
    {
      title: 'Animal Farm Trailer',
      description: 'A new adaptation arrives this fall.',
      uploader: 'StudioChannel',
      channel: 'StudioChannel',
      duration: 95,
      upload_date: '20260421',
      tags: ['trailer', 'movie'],
      webpage_url: 'https://www.youtube.com/watch?v=test123',
    },
  );

  assert.match(sourceText, /Title: Animal Farm Trailer/);
  assert.match(sourceText, /Description: A new adaptation arrives this fall\./);
  assert.match(sourceText, /Source Platform: YouTube/);
  assert.match(sourceText, /Duration Seconds: 95/);
  assert.match(sourceText, /Tags: trailer, movie/);
});

test('buildComposeSourceTextFromMetadata formats Instagram captions into generation-friendly source text', () => {
  const sourceText = buildComposeSourceTextFromMetadata(
    'instagram',
    'https://www.instagram.com/reel/test123/',
    {
      title: 'Animal Farm reel',
      description: 'Behind the scenes from the new video.',
      uploader: 'animalfarmmovie',
      channel: 'animalfarmmovie',
      webpage_url: 'https://www.instagram.com/reel/test123/',
    },
  );

  assert.match(sourceText, /Title: Animal Farm reel/);
  assert.match(sourceText, /Description: Behind the scenes from the new video\./);
  assert.match(sourceText, /Source Platform: Instagram/);
  assert.match(sourceText, /Creator: animalfarmmovie/);
});
