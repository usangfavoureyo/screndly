import test from 'node:test';
import assert from 'node:assert/strict';
import {
    pickDistinctImageUrl,
    rankBackdropImageUrls,
    type TMDbImageAsset,
} from '../services/tmdb-image-selection.service';

const TMDB_BACKDROP_IMAGE_BASE = 'https://image.tmdb.org/t/p/w1280';

test('rankBackdropImageUrls prefers true landscape stills over poster-like backdrops', () => {
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

    const ranked = rankBackdropImageUrls(assets, { baseUrl: TMDB_BACKDROP_IMAGE_BASE });

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

test('pickDistinctImageUrl returns an empty string when every backdrop candidate is poster-like', async () => {
    const selected = await pickDistinctImageUrl(
        'https://image.tmdb.org/t/p/original/poster.jpg',
        [
            'https://image.tmdb.org/t/p/original/similar-1.jpg',
            'https://image.tmdb.org/t/p/original/similar-2.jpg',
        ],
        async () => true,
    );

    assert.equal(selected, '');
});
