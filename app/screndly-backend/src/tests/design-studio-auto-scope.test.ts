import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { __designStudioAutoTestUtils } from '../services/design-studio.service';
import type { RSSActivityItem } from '../services/rss.service';

function buildActivityItem(overrides: Partial<RSSActivityItem>): RSSActivityItem {
  return {
    id: 'rss-activity-test',
    feedId: 'feed-1',
    feedName: 'Variety',
    title: 'Test title',
    description: '',
    contentHtml: '',
    status: 'pending',
    timestamp: new Date('2026-04-08T10:00:00.000Z').toISOString(),
    platforms: [],
    ...overrides,
  };
}

test('allows scripted movie and TV coverage for Design Studio auto editorials', () => {
  const movieCandidate = __designStudioAutoTestUtils.evaluateAutoEditorialNarrativeEligibility(
    buildActivityItem({
      title: "Spider-Man: Brand New Day trailer release date confirmed",
      description: 'The upcoming Marvel movie will debut a new trailer this week.',
      imageSource: 'tmdb',
    }),
    'release date',
  );

  const tvCandidate = __designStudioAutoTestUtils.evaluateAutoEditorialNarrativeEligibility(
    buildActivityItem({
      title: "Daredevil: Born Again season 2 adds a major cast member",
      description: 'The Marvel TV series expands its cast ahead of production.',
    }),
    'cast',
  );

  assert.equal(movieCandidate.eligible, true);
  assert.equal(tvCandidate.eligible, true);
});

test('blocks non-narrative categories from Design Studio auto editorials', () => {
  const blockedTitles = [
    {
      title: 'WWE announces a new SmackDown premiere special',
      reason: /wrestling/i,
    },
    {
      title: 'Netflix documentary on pop culture gets a new trailer',
      reason: /documentaries?/i,
    },
    {
      title: 'Stand-up comedy special lands a release date at Netflix',
      reason: /stand-up/i,
    },
    {
      title: 'Reality series Love Island gets a premiere update',
      reason: /reality/i,
    },
    {
      title: 'Lifestyle home renovation series gets renewed for another season',
      reason: /lifestyle/i,
    },
  ];

  for (const blocked of blockedTitles) {
    const result = __designStudioAutoTestUtils.evaluateAutoEditorialNarrativeEligibility(
      buildActivityItem({
        title: blocked.title,
        description: blocked.title,
      }),
      'premiere',
    );

    assert.equal(result.eligible, false, `${blocked.title} should be blocked`);
    assert.match(result.reason || '', blocked.reason);
  }
});

test('selects only clean artwork for Design Studio auto backgrounds', () => {
  const item = buildActivityItem({
    title: 'Dune: Part Three starts filming this summer',
    description: 'The next movie in the franchise is moving forward.',
    selectedImages: [
      {
        url: 'https://image.tmdb.org/t/p/original/poster-with-title.jpg',
        reason: 'TMDb poster for Dune: Part Three',
        source: 'tmdb',
        score: 96,
      },
      {
        url: 'https://image.tmdb.org/t/p/original/backdrop-clean.jpg',
        reason: 'TMDb backdrop variant for Dune: Part Three',
        source: 'tmdb',
        score: 88,
      },
    ],
  });

  const selected = __designStudioAutoTestUtils.selectDesignStudioAutoBackgroundSource(item, 'filming');

  assert.equal(selected?.url, 'https://image.tmdb.org/t/p/original/backdrop-clean.jpg');
  assert.match(selected?.reason || '', /backdrop/i);
});

test('rejects text-heavy posters, logos, and weak feed fallbacks for Design Studio auto backgrounds', () => {
  const selected = __designStudioAutoTestUtils.selectDesignStudioAutoBackgroundSource(
    buildActivityItem({
      title: 'Spider-Man: Brand New Day confirms a new cast member',
      description: 'The Marvel movie expands its cast.',
      selectedImages: [
        {
          url: 'https://image.tmdb.org/t/p/original/title-logo.png',
          reason: 'TMDb logo for Spider-Man: Brand New Day rendered as logo card',
          source: 'tmdb',
          score: 91,
        },
        {
          url: 'https://image.tmdb.org/t/p/original/official-poster.jpg',
          reason: 'TMDb poster for Spider-Man: Brand New Day',
          source: 'tmdb',
          score: 90,
        },
      ],
      imageUrl: 'https://example.com/article-thumbnail.jpg',
      imageReason: 'Explicit article/feed fallback image',
      imageSource: 'feed',
    }),
    'cast',
  );

  assert.equal(selected, null);
});

test('allows company or network logos as Design Studio logo-card backgrounds', () => {
  const selected = __designStudioAutoTestUtils.selectDesignStudioAutoBackgroundSource(
    buildActivityItem({
      title: 'HBO renews major drama series for season 3',
      description: 'The network confirms the scripted series will continue.',
      selectedImages: [
        {
          url: 'https://image.tmdb.org/t/p/original/hbo-logo.png',
          reason: 'TMDb company logo for HBO',
          source: 'tmdb',
          score: 92,
        },
      ],
    }),
    'renewed',
  );

  assert.equal(selected?.role, 'logo_card');
  assert.equal(selected?.url, 'https://image.tmdb.org/t/p/original/hbo-logo.png');
});

test('allows explicitly textless posters for Design Studio auto backgrounds', () => {
  const selected = __designStudioAutoTestUtils.selectDesignStudioAutoBackgroundSource(
    buildActivityItem({
      title: 'The Batman Part II debuts a new poster',
      description: 'The studio released new key art for the sequel.',
      selectedImages: [
        {
          url: 'https://image.tmdb.org/t/p/original/textless-poster.jpg',
          reason: 'TMDb textless poster for The Batman Part II',
          source: 'tmdb',
          score: 90,
        },
      ],
    }),
    'poster',
  );

  assert.equal(selected?.url, 'https://image.tmdb.org/t/p/original/textless-poster.jpg');
  assert.match(selected?.reason || '', /textless poster/i);
});

test('logo card generator creates a 4:5 contrast-safe composition', async () => {
  const logoPng = await sharp({
    create: {
      width: 900,
      height: 220,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: {
        create: {
          width: 900,
          height: 112,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 1 },
        },
      },
      left: 0,
      top: 54,
    }])
    .png()
    .toBuffer();
  const logoDataUri = `data:image/png;base64,${logoPng.toString('base64')}`;
  const { buffer, logoMode } = await __designStudioAutoTestUtils.buildDesignStudioLogoCardBackground({
    source: logoDataUri,
    width: 1080,
    height: 1350,
  });
  const metadata = await sharp(buffer).metadata();

  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1350);
  assert.equal(logoMode, 'dark_on_light');
});
