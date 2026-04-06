import test from 'node:test';
import assert from 'node:assert/strict';
import { decideYouTubeCandidate } from '../services/youtube-detection/decisionEngine';
import { buildPromoFingerprint, parsePromoAssetType } from '../services/youtube-detection/promoAssetParsing';

process.env.NODE_ENV = 'test';

function buildSettings(overrides: Record<string, unknown> = {}) {
    return {
        fetchInterval: 10,
        postInterval: 10,
        advancedFilters: 'trailer, teaser',
        regionFilter: 'US, UK, Korea, Hong Kong',
        allowedRegions: 'US, UK, Korea, Hong Kong',
        strictRegionMode: false,
        allowPremiumGlobalExceptions: true,
        excludeDubOnlyImports: true,
        trustedSupportingChannels: ['UC_NETFLIX', 'UC_LIONSGATE'],
        videoAgeGateHours: 24,
        videoBacklogMode: 'process-backlog',
        videoFutureOnlySince: '',
        excludeShorts: true,
        videoOpenaiModel: 'gpt-5-mini',
        videoFilterCache: true,
        videoFilterTmdbValidation: true,
        videoTmdbFallback: 'use-youtube-thumbnail',
        platformSettings: {},
        thumbnailConfigYoutube: {},
        thumbnailConfigX: {},
        ...overrides,
    } as any;
}

function buildMetadata(overrides: Record<string, unknown> = {}) {
    return {
        cleanedTitle: 'Example Title',
        trailerType: 'trailer',
        regionAllowed: true,
        tmdbMatchStatus: 'matched',
        tmdbMatch: {
            tmdbId: 100,
            mediaType: 'movie',
            title: 'Example Title',
            aliases: ['Example Title'],
            overview: 'Overview',
            originalLanguage: 'en',
            spokenLanguages: ['en'],
            productionCountries: ['US'],
            originCountries: ['US'],
            releaseDate: '2026-07-01',
            year: 2026,
            genres: ['Action'],
            allowedRegions: ['US'],
            castNames: ['Actor One'],
            productionNames: ['Warner Bros. Pictures'],
            distributors: ['Warner Bros. Pictures'],
            networks: [],
            popularity: 12,
            voteCount: 150,
            releaseStatus: 'Released',
        },
        ...overrides,
    } as any;
}

function buildCandidate(title: string, channelId = 'UC_WARNER', channelName = 'Warner Bros. Pictures') {
    return {
        youtubeVideoId: `video-${title.replace(/\W+/g, '-')}`,
        rawTitle: title,
        normalizedTitle: title,
        description: `${title} official promo`,
        channelId,
        channelName,
        publishedAt: new Date('2026-03-26T12:00:00.000Z'),
        mediaTypeGuess: 'movie',
        extractedYear: 2026,
        promoAssetType: parsePromoAssetType(title),
    } as any;
}

test('allows standard English trailer without popularity gate', async () => {
    const result = await decideYouTubeCandidate(
        buildCandidate('Flight Risk | Official Trailer'),
        buildMetadata(),
        buildSettings()
    );

    assert.equal(result.allow, true);
    assert.equal(result.decisionPath, 'standard');
});

test('allows distributor-backed English-speaking foreign title', async () => {
    const result = await decideYouTubeCandidate(
        buildCandidate('The Furious (2026) Official Trailer', 'UC_LIONSGATE', 'Lionsgate Movies'),
        buildMetadata({
            regionAllowed: false,
            tmdbMatch: {
                ...buildMetadata().tmdbMatch,
                productionCountries: ['HK'],
                originCountries: ['HK'],
                allowedRegions: ['HK'],
                distributors: ['Lionsgate'],
                productionNames: ['Lionsgate'],
            },
        }),
        buildSettings()
    );

    assert.equal(result.allow, true);
    assert.notEqual(result.decisionPath, 'global_exception');
});

test('rejects dubbed import when dub-only exclusions are enabled', async () => {
    const result = await decideYouTubeCandidate(
        buildCandidate('Shadow Blade Official Trailer English Dub', 'UC_ANIME', 'Random Anime Channel'),
        buildMetadata({
            tmdbMatch: {
                ...buildMetadata().tmdbMatch,
                originalLanguage: 'ja',
                spokenLanguages: ['ja', 'en'],
                productionCountries: ['JP'],
                originCountries: ['JP'],
                distributors: [],
                productionNames: [],
                popularity: 3,
                voteCount: 12,
            },
        }),
        buildSettings()
    );

    assert.equal(result.allow, false);
});

test('allows global exception only for strong non-English global title', async () => {
    const result = await decideYouTubeCandidate(
        buildCandidate('Squid Game Season 3 Official Teaser', 'UC_NETFLIX', 'Netflix'),
        buildMetadata({
            regionAllowed: false,
            tmdbMatch: {
                ...buildMetadata().tmdbMatch,
                mediaType: 'tv',
                originalLanguage: 'ko',
                spokenLanguages: ['ko'],
                productionCountries: ['KR'],
                originCountries: ['KR'],
                genres: ['Drama'],
                distributors: ['Netflix'],
                networks: ['Netflix'],
                productionNames: ['Netflix'],
                popularity: 60,
                voteCount: 5000,
            },
        }),
        buildSettings()
    );

    assert.equal(result.preLLMDecision, 'SEND_TO_LLM');
});

test('rejects older platform-drop movie trailer after release window', async () => {
    const result = await decideYouTubeCandidate(
        buildCandidate('The Testament of Ann Lee | Trailer | Hulu', 'UC_HULU', 'Hulu'),
        buildMetadata({
            tmdbMatch: {
                ...buildMetadata().tmdbMatch,
                title: 'The Testament of Ann Lee',
                releaseDate: '2025-12-15',
                year: 2025,
                productionNames: ['Hulu'],
                distributors: [],
                networks: ['Hulu'],
                popularity: 18,
                voteCount: 210,
                releaseStatus: 'Released',
            },
        }),
        buildSettings()
    );

    assert.equal(result.allow, false);
    assert.equal(result.preLLMDecision, 'REJECT_PRELLM');
    assert.match(result.reasonSummary, /post-release catalog\/platform trailer/i);
});

test('keeps new season trailer eligible when season context is present', async () => {
    const result = await decideYouTubeCandidate(
        {
            ...buildCandidate('Running Point | Season 2 Official Trailer | Netflix', 'UC_NETFLIX', 'Netflix'),
            mediaTypeGuess: 'tv',
            seasonNumber: 2,
        },
        buildMetadata({
            tmdbMatch: {
                ...buildMetadata().tmdbMatch,
                mediaType: 'tv',
                title: 'Running Point',
                releaseDate: '2026-05-15',
                year: 2026,
                seasonNumber: 2,
                productionNames: ['Netflix'],
                distributors: ['Netflix'],
                networks: ['Netflix'],
            },
        }),
        buildSettings()
    );

    assert.equal(result.allow, true);
});

test('rejects reposted trailer for an already released TV season', async () => {
    const result = await decideYouTubeCandidate(
        {
            ...buildCandidate('Daredevil: Born Again Season 2 | Official Trailer | Marvel Entertainment', 'UC_MARVEL', 'Marvel Entertainment'),
            mediaTypeGuess: 'tv',
            seasonNumber: 2,
            publishedAt: new Date('2026-04-06T12:00:00.000Z'),
        },
        buildMetadata({
            tmdbMatch: {
                ...buildMetadata().tmdbMatch,
                mediaType: 'tv',
                title: 'Daredevil: Born Again',
                releaseDate: '2026-03-01',
                year: 2026,
                seasonNumber: 2,
                productionNames: ['Disney+'],
                distributors: ['Disney'],
                networks: ['Disney+'],
                popularity: 60,
                voteCount: 2400,
                releaseStatus: 'Released',
            },
        }),
        buildSettings()
    );

    assert.equal(result.allow, false);
    assert.equal(result.preLLMDecision, 'REJECT_PRELLM');
    assert.match(result.reasonSummary, /already released tv season 2/i);
});

test('promo fingerprint keeps teaser and trailer distinct', () => {
    const teaser = buildPromoFingerprint(buildCandidate('Example Title | Official Teaser'));
    const trailer = buildPromoFingerprint(buildCandidate('Example Title | Official Trailer'));

    assert.notEqual(teaser.fingerprint, trailer.fingerprint);
    assert.equal(teaser.promoAssetType, 'teaser');
    assert.equal(trailer.promoAssetType, 'trailer');
});
