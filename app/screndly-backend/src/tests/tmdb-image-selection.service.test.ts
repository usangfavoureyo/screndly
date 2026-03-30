import test from 'node:test';
import assert from 'node:assert/strict';
import {
    chooseRotatedBackdropFromPool,
    selectBestLogo,
    pickDistinctImageUrl,
    rankBackdropImageUrls,
    type TMDbImageAsset,
    type TMDbBackdropCandidateScore,
} from '../services/tmdb-image-selection.service';

const TMDB_BACKDROP_IMAGE_BASE = 'https://image.tmdb.org/t/p/w1280';

test('rankBackdropImageUrls prefers true landscape stills over poster-like backdrops', async () => {
    const assets: TMDbImageAsset[] = [
        {
            file_path: '/poster-like.jpg',
            iso_639_1: 'en',
            aspect_ratio: 0.7,
            vote_average: 9,
            vote_count: 120,
            width: 1000,
            height: 1500,
        },
        {
            file_path: '/scene-still.jpg',
            iso_639_1: null,
            aspect_ratio: 1.78,
            vote_average: 7,
            vote_count: 30,
            width: 1920,
            height: 1080,
        },
    ];

    const ranked = await rankBackdropImageUrls(assets, { baseUrl: TMDB_BACKDROP_IMAGE_BASE });

    assert.equal(ranked[0], `${TMDB_BACKDROP_IMAGE_BASE}/scene-still.jpg`);
    assert.equal(ranked[1], `${TMDB_BACKDROP_IMAGE_BASE}/poster-like.jpg`);
});

test('pickDistinctImageUrl skips similar candidates and returns the first distinct backdrop', async () => {
    const similarityMap = new Map<string, boolean>([
        ['https://image.tmdb.org/t/p/original/similar-1.jpg', true],
        ['https://image.tmdb.org/t/p/original/distinct-1.jpg', false],
    ]);

    const selected = await pickDistinctImageUrl(
        'https://image.tmdb.org/t/p/original/poster.jpg',
        [
            'https://image.tmdb.org/t/p/original/similar-1.jpg',
            'https://image.tmdb.org/t/p/original/distinct-1.jpg',
        ],
        async (_primary, candidate) => similarityMap.get(candidate) ?? false,
    );

    assert.equal(selected, 'https://image.tmdb.org/t/p/original/distinct-1.jpg');
});

test('pickDistinctImageUrl falls back to the first available backdrop when every candidate is poster-like', async () => {
    const selected = await pickDistinctImageUrl(
        'https://image.tmdb.org/t/p/original/poster.jpg',
        [
            'https://image.tmdb.org/t/p/original/similar-1.jpg',
            'https://image.tmdb.org/t/p/original/similar-2.jpg',
        ],
        async () => true,
    );

    assert.equal(selected, 'https://image.tmdb.org/t/p/original/similar-1.jpg');
});

test('selectBestLogo prefers strong English or neutral TMDb logos with solid dimensions', () => {
    const assets: TMDbImageAsset[] = [
        {
            file_path: '/tiny-logo.png',
            iso_639_1: 'en',
            width: 180,
            height: 70,
            vote_average: 9,
            vote_count: 100,
        },
        {
            file_path: '/strong-logo.png',
            iso_639_1: 'en',
            width: 1400,
            height: 320,
            vote_average: 6,
            vote_count: 30,
        },
        {
            file_path: '/foreign-logo.png',
            iso_639_1: 'fr',
            width: 1600,
            height: 340,
            vote_average: 8,
            vote_count: 60,
        },
    ];

    const selected = selectBestLogo(assets, {
        baseUrl: TMDB_BACKDROP_IMAGE_BASE,
        preferredLanguage: 'en',
    });

    assert.equal(selected?.url, `${TMDB_BACKDROP_IMAGE_BASE}/strong-logo.png`);
});

test('chooseRotatedBackdropFromPool rotates deterministically within strong eligible candidates', () => {
    const pool: TMDbBackdropCandidateScore[] = [
        {
            filePath: '/a.jpg',
            url: `${TMDB_BACKDROP_IMAGE_BASE}/a.jpg`,
            finalScore: 240,
            sceneStillScore: 100,
            visualDifferenceScore: 70,
            qualityScore: 70,
            sameKeyArtPenalty: 0,
            nearDuplicatePenalty: 0,
            meanDifference: 0.4,
            hashDifference: 0.5,
            histogramDifference: 0.6,
            centerDifference: 0.2,
            edgeDifference: 0.2,
            eligible: true,
        },
        {
            filePath: '/b.jpg',
            url: `${TMDB_BACKDROP_IMAGE_BASE}/b.jpg`,
            finalScore: 230,
            sceneStillScore: 96,
            visualDifferenceScore: 68,
            qualityScore: 66,
            sameKeyArtPenalty: 0,
            nearDuplicatePenalty: 0,
            meanDifference: 0.41,
            hashDifference: 0.51,
            histogramDifference: 0.61,
            centerDifference: 0.21,
            edgeDifference: 0.21,
            eligible: true,
        },
        {
            filePath: '/c.jpg',
            url: `${TMDB_BACKDROP_IMAGE_BASE}/c.jpg`,
            finalScore: 225,
            sceneStillScore: 94,
            visualDifferenceScore: 66,
            qualityScore: 65,
            sameKeyArtPenalty: 0,
            nearDuplicatePenalty: 0,
            meanDifference: 0.42,
            hashDifference: 0.52,
            histogramDifference: 0.62,
            centerDifference: 0.22,
            edgeDifference: 0.22,
            eligible: true,
        },
    ];

    const first = chooseRotatedBackdropFromPool(pool, 'movie:123:2026-03-30');
    const second = chooseRotatedBackdropFromPool(pool, 'movie:123:2026-03-30');
    const differentSeed = chooseRotatedBackdropFromPool(pool, 'movie:123:2026-03-31');

    assert.equal(first?.url, second?.url);
    assert.ok(pool.some((candidate) => candidate.url === differentSeed?.url));
});
