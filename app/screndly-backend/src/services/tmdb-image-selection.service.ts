import { createHash } from 'crypto';
import sharp from 'sharp';

const TMDB_IMAGE_SIMILARITY_SIZE = 32;
const TMDB_IMAGE_MEAN_DIFF_THRESHOLD = 0.12;
const TMDB_IMAGE_HASH_DIFF_THRESHOLD = 0.18;
const TMDB_IMAGE_HISTOGRAM_DIFF_THRESHOLD = 0.2;
const TMDB_IMAGE_CENTER_DIFF_THRESHOLD = 0.06;
const TMDB_IMAGE_EDGE_DIFF_THRESHOLD = 0.08;
const TMDB_BACKDROP_ANALYSIS_LIMIT = 10;
const TMDB_LOGO_MIN_WIDTH = 240;
const TMDB_LOGO_MIN_HEIGHT = 80;
const TMDB_BACKDROP_ELIGIBLE_SCORE_MIN = 130;
const TMDB_IMAGE_SELECTION_DEBUG = process.env.NODE_ENV !== 'production';

const tmdbImageAnalysisCache = new Map<string, Promise<TMDbImageAnalysis | null>>();

export interface TMDbImageAsset {
    file_path?: string | null;
    iso_639_1?: string | null;
    vote_average?: number;
    vote_count?: number;
    width?: number;
    height?: number;
    aspect_ratio?: number;
}

interface TMDbImageAnalysis {
    grayscale: Uint8Array;
    colorHistogram: Float32Array;
    edgeDensity: number;
    centerFocus: number;
    quadrantVariance: number;
    variance: number;
}

interface TMDbSimilarityMetrics {
    meanDifference: number;
    hashDifference: number;
    histogramDifference: number;
    centerDifference: number;
    edgeDifference: number;
}

export interface TMDbBackdropCandidateScore {
    filePath: string;
    url: string;
    finalScore: number;
    sceneStillScore: number;
    visualDifferenceScore: number;
    qualityScore: number;
    sameKeyArtPenalty: number;
    nearDuplicatePenalty: number;
    meanDifference: number | null;
    hashDifference: number | null;
    histogramDifference: number | null;
    centerDifference: number | null;
    edgeDifference: number | null;
    eligible: boolean;
    rejectionReason?: string;
}

export interface TMDbBackdropSelection {
    selected: TMDbBackdropCandidateScore | null;
    candidates: TMDbBackdropCandidateScore[];
    eligiblePool: TMDbBackdropCandidateScore[];
}

export interface TMDbImageSelectionResult {
    filePath: string;
    url: string;
    score: number;
}

export interface SelectTMDbBackdropOptions {
    baseUrl: string;
    posterUrl?: string | null;
    preferredPath?: string | null;
    minimumScore?: number;
    rotationSeed?: string;
    debugLabel?: string;
}

export interface SelectTMDbPosterOptions {
    baseUrl: string;
    preferredPath?: string | null;
    debugLabel?: string;
}

export interface SelectTMDbLogoOptions {
    baseUrl: string;
    preferredLanguage?: string | null;
    debugLabel?: string;
}

export function buildTMDbImageUrl(path: string | null | undefined, baseUrl: string): string {
    return path ? `${baseUrl}${path}` : '';
}

function debugLog(label: string | undefined, message: string, payload?: unknown) {
    if (!TMDB_IMAGE_SELECTION_DEBUG) {
        return;
    }

    const prefix = label ? `[TMDbImageSelection:${label}]` : '[TMDbImageSelection]';
    if (payload === undefined) {
        console.log(prefix, message);
        return;
    }

    console.log(prefix, message, payload);
}

function getBackdropAspectRatio(asset: TMDbImageAsset): number {
    if (typeof asset.aspect_ratio === 'number' && Number.isFinite(asset.aspect_ratio) && asset.aspect_ratio > 0) {
        return asset.aspect_ratio;
    }

    const width = asset.width || 0;
    const height = asset.height || 0;
    if (width > 0 && height > 0) {
        return width / height;
    }

    return 0;
}

function getPortraitAspectRatio(asset: TMDbImageAsset): number {
    const width = asset.width || 0;
    const height = asset.height || 0;
    if (width > 0 && height > 0) {
        return width / height;
    }

    return typeof asset.aspect_ratio === 'number' && Number.isFinite(asset.aspect_ratio) && asset.aspect_ratio > 0
        ? asset.aspect_ratio
        : 0;
}

function getAverageHashBits(values: Uint8Array): Uint8Array {
    if (values.length === 0) {
        return new Uint8Array();
    }

    let total = 0;
    for (const value of values) {
        total += value;
    }
    const average = total / values.length;

    return Uint8Array.from(values, (value) => (value >= average ? 1 : 0));
}

function getNormalizedMeanDifference(left: Uint8Array, right: Uint8Array): number {
    const length = Math.min(left.length, right.length);
    if (length === 0) {
        return 1;
    }

    let total = 0;
    for (let index = 0; index < length; index += 1) {
        total += Math.abs(left[index] - right[index]);
    }

    return total / (length * 255);
}

function getNormalizedHashDifference(left: Uint8Array, right: Uint8Array): number {
    const leftHash = getAverageHashBits(left);
    const rightHash = getAverageHashBits(right);
    const length = Math.min(leftHash.length, rightHash.length);
    if (length === 0) {
        return 1;
    }

    let diffCount = 0;
    for (let index = 0; index < length; index += 1) {
        if (leftHash[index] !== rightHash[index]) {
            diffCount += 1;
        }
    }

    return diffCount / length;
}

function getHistogramDifference(left: Float32Array, right: Float32Array): number {
    const length = Math.min(left.length, right.length);
    if (length === 0) {
        return 1;
    }

    let overlap = 0;
    for (let index = 0; index < length; index += 1) {
        overlap += Math.min(left[index] ?? 0, right[index] ?? 0);
    }

    return 1 - overlap;
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function quantizeColor(value: number): number {
    return Math.max(0, Math.min(3, Math.floor((value / 256) * 4)));
}

function buildImageAnalysis(data: Buffer, width: number, height: number): TMDbImageAnalysis {
    const grayscale = new Uint8Array(width * height);
    const histogram = new Float32Array(64);
    const quadrantSums = [0, 0, 0, 0];
    const quadrantCounts = [0, 0, 0, 0];

    let totalBrightness = 0;
    let totalSquaredBrightness = 0;
    let centerTotal = 0;
    let centerCount = 0;
    let outerTotal = 0;
    let outerCount = 0;

    const centerMinX = Math.floor(width * 0.25);
    const centerMaxX = Math.ceil(width * 0.75);
    const centerMinY = Math.floor(height * 0.25);
    const centerMaxY = Math.ceil(height * 0.75);

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const pixelIndex = (y * width) + x;
            const bufferIndex = pixelIndex * 3;
            const red = data[bufferIndex] ?? 0;
            const green = data[bufferIndex + 1] ?? 0;
            const blue = data[bufferIndex + 2] ?? 0;
            const brightness = Math.round((0.299 * red) + (0.587 * green) + (0.114 * blue));

            grayscale[pixelIndex] = brightness;
            totalBrightness += brightness;
            totalSquaredBrightness += brightness * brightness;

            const histogramIndex = (quantizeColor(red) * 16) + (quantizeColor(green) * 4) + quantizeColor(blue);
            histogram[histogramIndex] += 1;

            const quadrantIndex = (y < height / 2 ? 0 : 2) + (x < width / 2 ? 0 : 1);
            quadrantSums[quadrantIndex] += brightness;
            quadrantCounts[quadrantIndex] += 1;

            const isCenterPixel = x >= centerMinX && x < centerMaxX && y >= centerMinY && y < centerMaxY;
            if (isCenterPixel) {
                centerTotal += brightness;
                centerCount += 1;
            } else {
                outerTotal += brightness;
                outerCount += 1;
            }
        }
    }

    let gradientTotal = 0;
    let gradientCount = 0;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const pixelIndex = (y * width) + x;
            const current = grayscale[pixelIndex] ?? 0;

            if (x + 1 < width) {
                gradientTotal += Math.abs(current - (grayscale[pixelIndex + 1] ?? 0));
                gradientCount += 1;
            }

            if (y + 1 < height) {
                gradientTotal += Math.abs(current - (grayscale[pixelIndex + width] ?? 0));
                gradientCount += 1;
            }
        }
    }

    const totalPixels = width * height || 1;
    const meanBrightness = totalBrightness / totalPixels;
    const variance = clamp01(Math.sqrt(Math.max(0, (totalSquaredBrightness / totalPixels) - (meanBrightness * meanBrightness))) / 128);
    const centerMean = centerCount > 0 ? centerTotal / centerCount : meanBrightness;
    const outerMean = outerCount > 0 ? outerTotal / outerCount : meanBrightness;
    const centerFocus = clamp01(Math.abs(centerMean - outerMean) / 255);

    const quadrantMeans = quadrantSums.map((sum, index) => (quadrantCounts[index] > 0 ? sum / quadrantCounts[index] : meanBrightness));
    const quadrantAverage = quadrantMeans.reduce((sum, value) => sum + value, 0) / quadrantMeans.length;
    const quadrantVariance = clamp01(
        Math.sqrt(
            quadrantMeans.reduce((sum, value) => sum + ((value - quadrantAverage) ** 2), 0) / quadrantMeans.length,
        ) / 128,
    );

    for (let index = 0; index < histogram.length; index += 1) {
        histogram[index] = histogram[index] / totalPixels;
    }

    return {
        grayscale,
        colorHistogram: histogram,
        edgeDensity: clamp01((gradientCount > 0 ? gradientTotal / gradientCount : 0) / 255),
        centerFocus,
        quadrantVariance,
        variance,
    };
}

async function getTMDbImageAnalysis(url: string): Promise<TMDbImageAnalysis | null> {
    if (!url) {
        return null;
    }

    const cached = tmdbImageAnalysisCache.get(url);
    if (cached) {
        return cached;
    }

    const pending = (async () => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                return null;
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            const { data, info } = await sharp(buffer, { animated: false })
                .rotate()
                .resize(TMDB_IMAGE_SIMILARITY_SIZE, TMDB_IMAGE_SIMILARITY_SIZE, {
                    fit: 'cover',
                    position: 'centre',
                    withoutEnlargement: false,
                })
                .removeAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            return buildImageAnalysis(data, info.width, info.height);
        } catch {
            return null;
        }
    })();

    tmdbImageAnalysisCache.set(url, pending);
    return pending;
}

async function computePosterBackdropSimilarity(
    posterUrl: string,
    backdropUrl: string,
): Promise<TMDbSimilarityMetrics | null> {
    if (!posterUrl || !backdropUrl || posterUrl === backdropUrl) {
        return posterUrl && posterUrl === backdropUrl
            ? {
                meanDifference: 0,
                hashDifference: 0,
                histogramDifference: 0,
                centerDifference: 0,
                edgeDifference: 0,
            }
            : null;
    }

    const [posterAnalysis, backdropAnalysis] = await Promise.all([
        getTMDbImageAnalysis(posterUrl),
        getTMDbImageAnalysis(backdropUrl),
    ]);

    if (!posterAnalysis || !backdropAnalysis) {
        return null;
    }

    return {
        meanDifference: getNormalizedMeanDifference(posterAnalysis.grayscale, backdropAnalysis.grayscale),
        hashDifference: getNormalizedHashDifference(posterAnalysis.grayscale, backdropAnalysis.grayscale),
        histogramDifference: getHistogramDifference(posterAnalysis.colorHistogram, backdropAnalysis.colorHistogram),
        centerDifference: Math.abs(posterAnalysis.centerFocus - backdropAnalysis.centerFocus),
        edgeDifference: Math.abs(posterAnalysis.edgeDensity - backdropAnalysis.edgeDensity),
    };
}

function scoreBackdropMetadata(asset: TMDbImageAsset, preferredPath?: string | null): number {
    const aspectRatio = getBackdropAspectRatio(asset);
    const landscapeScore = aspectRatio >= 1.7
        ? 36
        : aspectRatio >= 1.55
            ? 22
            : aspectRatio >= 1.3
                ? 8
                : -48;
    const languageScore = asset.iso_639_1 === null
        ? 32
        : asset.iso_639_1 === 'en'
            ? 8
            : -26;
    const voteScore = ((asset.vote_average || 0) * 5) + Math.min(asset.vote_count || 0, 120) / 5;
    const resolutionScore = ((asset.width || 0) * (asset.height || 0)) / 1_000_000;
    const preferredScore = preferredPath && asset.file_path === preferredPath ? 8 : 0;

    return landscapeScore + languageScore + voteScore + resolutionScore + preferredScore;
}

export function computeBackdropSceneStillScore(
    asset: TMDbImageAsset,
    analysis?: Pick<TMDbImageAnalysis, 'edgeDensity' | 'centerFocus' | 'quadrantVariance' | 'variance'> | null,
): number {
    const aspectRatio = getBackdropAspectRatio(asset);
    const aspectScore = aspectRatio >= 1.72 && aspectRatio <= 1.95
        ? 28
        : aspectRatio >= 1.55
            ? 16
            : aspectRatio >= 1.3
                ? 4
                : -40;
    const languageScore = asset.iso_639_1 === null
        ? 26
        : asset.iso_639_1 === 'en'
            ? 6
            : -24;

    if (!analysis) {
        return aspectScore + languageScore;
    }

    const textureScore = analysis.edgeDensity * 140;
    const varianceScore = analysis.variance * 90;
    const environmentalScore = analysis.quadrantVariance * 110;
    const centeredPromoPenalty = analysis.centerFocus * 130;

    return aspectScore + languageScore + textureScore + varianceScore + environmentalScore - centeredPromoPenalty;
}

function computeBackdropQualityScore(asset: TMDbImageAsset, preferredPath?: string | null): number {
    const metadataScore = scoreBackdropMetadata(asset, preferredPath);
    return metadataScore * 1.45;
}

function computeVisualDifferenceScore(metrics: TMDbSimilarityMetrics | null): number {
    if (!metrics) {
        return 28;
    }

    return (
        (metrics.meanDifference * 110) +
        (metrics.hashDifference * 90) +
        (metrics.histogramDifference * 80) +
        (metrics.centerDifference * 45) +
        (metrics.edgeDifference * 35)
    );
}

export function isNearDuplicateKeyArt(metrics: TMDbSimilarityMetrics | null): boolean {
    if (!metrics) {
        return false;
    }

    return (
        (metrics.meanDifference <= TMDB_IMAGE_MEAN_DIFF_THRESHOLD && metrics.hashDifference <= TMDB_IMAGE_HASH_DIFF_THRESHOLD) ||
        (
            metrics.histogramDifference <= TMDB_IMAGE_HISTOGRAM_DIFF_THRESHOLD &&
            metrics.centerDifference <= TMDB_IMAGE_CENTER_DIFF_THRESHOLD &&
            metrics.edgeDifference <= TMDB_IMAGE_EDGE_DIFF_THRESHOLD
        )
    );
}

function computeDuplicatePenalties(metrics: TMDbSimilarityMetrics | null): {
    sameKeyArtPenalty: number;
    nearDuplicatePenalty: number;
    rejectionReason?: string;
} {
    if (!metrics) {
        return {
            sameKeyArtPenalty: 0,
            nearDuplicatePenalty: 0,
        };
    }

    if (isNearDuplicateKeyArt(metrics)) {
        return {
            sameKeyArtPenalty: 220,
            nearDuplicatePenalty: 120,
            rejectionReason: 'near-duplicate key art',
        };
    }

    if (metrics.histogramDifference <= 0.26 && metrics.centerDifference <= 0.09) {
        return {
            sameKeyArtPenalty: 110,
            nearDuplicatePenalty: 36,
            rejectionReason: 'same key art family',
        };
    }

    return {
        sameKeyArtPenalty: 0,
        nearDuplicatePenalty: 0,
    };
}

function getFilePath(asset: TMDbImageAsset): string {
    return typeof asset.file_path === 'string' ? asset.file_path : '';
}

async function scoreBackdropCandidate(
    asset: TMDbImageAsset,
    options: SelectTMDbBackdropOptions,
): Promise<TMDbBackdropCandidateScore | null> {
    const filePath = getFilePath(asset);
    const url = buildTMDbImageUrl(filePath, options.baseUrl);
    if (!url) {
        return null;
    }

    const [analysis, similarityMetrics] = await Promise.all([
        getTMDbImageAnalysis(url),
        options.posterUrl ? computePosterBackdropSimilarity(options.posterUrl, url) : Promise.resolve(null),
    ]);

    const sceneStillScore = computeBackdropSceneStillScore(asset, analysis);
    const visualDifferenceScore = computeVisualDifferenceScore(similarityMetrics);
    const qualityScore = computeBackdropQualityScore(asset, options.preferredPath);
    const penalties = computeDuplicatePenalties(similarityMetrics);
    const finalScore = sceneStillScore + visualDifferenceScore + qualityScore - penalties.sameKeyArtPenalty - penalties.nearDuplicatePenalty;
    const minimumScore = options.minimumScore ?? TMDB_BACKDROP_ELIGIBLE_SCORE_MIN;
    const eligible = finalScore >= minimumScore && penalties.sameKeyArtPenalty < 220;

    return {
        filePath,
        url,
        finalScore,
        sceneStillScore,
        visualDifferenceScore,
        qualityScore,
        sameKeyArtPenalty: penalties.sameKeyArtPenalty,
        nearDuplicatePenalty: penalties.nearDuplicatePenalty,
        meanDifference: similarityMetrics?.meanDifference ?? null,
        hashDifference: similarityMetrics?.hashDifference ?? null,
        histogramDifference: similarityMetrics?.histogramDifference ?? null,
        centerDifference: similarityMetrics?.centerDifference ?? null,
        edgeDifference: similarityMetrics?.edgeDifference ?? null,
        eligible,
        rejectionReason: penalties.rejectionReason,
    };
}

function sortBackdropCandidates(candidates: TMDbBackdropCandidateScore[]): TMDbBackdropCandidateScore[] {
    return [...candidates].sort((left, right) => {
        if (right.finalScore !== left.finalScore) {
            return right.finalScore - left.finalScore;
        }

        if (right.sceneStillScore !== left.sceneStillScore) {
            return right.sceneStillScore - left.sceneStillScore;
        }

        return right.visualDifferenceScore - left.visualDifferenceScore;
    });
}

function buildRotationIndex(seed: string, size: number): number {
    if (size <= 1) {
        return 0;
    }

    const hash = createHash('sha1').update(seed).digest();
    return hash.readUInt32BE(0) % size;
}

export function chooseRotatedBackdropFromPool(
    pool: TMDbBackdropCandidateScore[],
    rotationSeed: string,
): TMDbBackdropCandidateScore | null {
    if (pool.length === 0) {
        return null;
    }

    return pool[buildRotationIndex(rotationSeed, pool.length)] ?? pool[0] ?? null;
}

export async function getEligibleBackdropPool(
    assets: TMDbImageAsset[] | undefined,
    options: SelectTMDbBackdropOptions,
): Promise<TMDbBackdropCandidateScore[]> {
    if (!Array.isArray(assets) || assets.length === 0) {
        return [];
    }

    const shortlist = [...assets]
        .filter((asset) => typeof asset.file_path === 'string' && asset.file_path.length > 0)
        .sort((left, right) => scoreBackdropMetadata(right, options.preferredPath) - scoreBackdropMetadata(left, options.preferredPath))
        .slice(0, TMDB_BACKDROP_ANALYSIS_LIMIT);

    const scoredCandidates = (await Promise.all(shortlist.map((asset) => scoreBackdropCandidate(asset, options))))
        .filter((candidate): candidate is TMDbBackdropCandidateScore => Boolean(candidate));
    const rankedCandidates = sortBackdropCandidates(scoredCandidates);
    const eligiblePool = rankedCandidates.filter((candidate) => candidate.eligible);

    debugLog(options.debugLabel, 'Top scored backdrop candidates', rankedCandidates.slice(0, 5).map((candidate) => ({
        filePath: candidate.filePath,
        finalScore: Number(candidate.finalScore.toFixed(2)),
        sceneStillScore: Number(candidate.sceneStillScore.toFixed(2)),
        visualDifferenceScore: Number(candidate.visualDifferenceScore.toFixed(2)),
        qualityScore: Number(candidate.qualityScore.toFixed(2)),
        sameKeyArtPenalty: Number(candidate.sameKeyArtPenalty.toFixed(2)),
        nearDuplicatePenalty: Number(candidate.nearDuplicatePenalty.toFixed(2)),
        rejectionReason: candidate.rejectionReason,
    })));

    return eligiblePool;
}

export async function selectBestBackdropForPoster(
    assets: TMDbImageAsset[] | undefined,
    options: SelectTMDbBackdropOptions,
): Promise<TMDbBackdropSelection> {
    if (!Array.isArray(assets) || assets.length === 0) {
        return { selected: null, candidates: [], eligiblePool: [] };
    }

    const shortlist = [...assets]
        .filter((asset) => typeof asset.file_path === 'string' && asset.file_path.length > 0)
        .sort((left, right) => scoreBackdropMetadata(right, options.preferredPath) - scoreBackdropMetadata(left, options.preferredPath))
        .slice(0, TMDB_BACKDROP_ANALYSIS_LIMIT);
    const candidates = sortBackdropCandidates(
        (await Promise.all(shortlist.map((asset) => scoreBackdropCandidate(asset, options))))
            .filter((candidate): candidate is TMDbBackdropCandidateScore => Boolean(candidate)),
    );
    const eligiblePool = candidates.filter((candidate) => candidate.eligible);
    const selected = eligiblePool[0] ?? candidates.find((candidate) => candidate.sameKeyArtPenalty < 220) ?? candidates[0] ?? null;

    debugLog(options.debugLabel, 'Selected backdrop for poster pairing', selected ? {
        filePath: selected.filePath,
        sceneStillScore: Number(selected.sceneStillScore.toFixed(2)),
        similarityScore: selected.meanDifference === null ? null : Number((1 - selected.meanDifference).toFixed(3)),
        rejectionReason: selected.rejectionReason,
    } : 'none');

    return {
        selected,
        candidates,
        eligiblePool,
    };
}

export async function selectBestBackdropForLogo(
    assets: TMDbImageAsset[] | undefined,
    options: SelectTMDbBackdropOptions,
): Promise<TMDbBackdropSelection> {
    if (!Array.isArray(assets) || assets.length === 0) {
        return { selected: null, candidates: [], eligiblePool: [] };
    }

    const shortlist = [...assets]
        .filter((asset) => typeof asset.file_path === 'string' && asset.file_path.length > 0)
        .sort((left, right) => scoreBackdropMetadata(right, options.preferredPath) - scoreBackdropMetadata(left, options.preferredPath))
        .slice(0, TMDB_BACKDROP_ANALYSIS_LIMIT);
    const candidates = sortBackdropCandidates(
        (await Promise.all(shortlist.map((asset) => scoreBackdropCandidate(asset, options))))
            .filter((candidate): candidate is TMDbBackdropCandidateScore => Boolean(candidate)),
    );
    const eligiblePool = candidates.filter((candidate) => candidate.eligible);
    const selected = eligiblePool.length > 0
        ? chooseRotatedBackdropFromPool(eligiblePool, options.rotationSeed || 'tmdb-backdrop')
        : candidates.find((candidate) => candidate.sameKeyArtPenalty < 220) ?? candidates[0] ?? null;

    debugLog(options.debugLabel, 'Eligible shuffled backdrop pool for logo mode', eligiblePool.map((candidate) => ({
        filePath: candidate.filePath,
        finalScore: Number(candidate.finalScore.toFixed(2)),
    })));
    debugLog(options.debugLabel, 'Selected backdrop for logo mode', selected ? selected.filePath : 'none');

    return {
        selected,
        candidates,
        eligiblePool,
    };
}

function scorePosterAsset(asset: TMDbImageAsset, preferredPath?: string | null): number {
    const aspectRatio = getPortraitAspectRatio(asset);
    const portraitScore = aspectRatio > 0 && aspectRatio <= 0.8
        ? 42
        : aspectRatio > 0 && aspectRatio <= 1
            ? 18
            : -26;
    const languageScore = asset.iso_639_1 === null
        ? 14
        : asset.iso_639_1 === 'en'
            ? 24
            : -18;
    const voteScore = ((asset.vote_average || 0) * 6) + Math.min(asset.vote_count || 0, 160) / 6;
    const resolutionScore = ((asset.width || 0) * (asset.height || 0)) / 1_000_000;
    const preferredScore = preferredPath && asset.file_path === preferredPath ? 30 : 0;

    return portraitScore + languageScore + voteScore + resolutionScore + preferredScore;
}

export function selectBestPoster(
    assets: TMDbImageAsset[] | undefined,
    options: SelectTMDbPosterOptions,
): TMDbImageSelectionResult | null {
    if (!Array.isArray(assets) || assets.length === 0) {
        return null;
    }

    const selected = [...assets]
        .filter((asset) => typeof asset.file_path === 'string' && asset.file_path.length > 0)
        .sort((left, right) => scorePosterAsset(right, options.preferredPath) - scorePosterAsset(left, options.preferredPath))[0];

    if (!selected?.file_path) {
        return null;
    }

    const result = {
        filePath: selected.file_path,
        url: buildTMDbImageUrl(selected.file_path, options.baseUrl),
        score: scorePosterAsset(selected, options.preferredPath),
    };

    debugLog(options.debugLabel, 'Selected poster', result);
    return result;
}

function scoreLogoAsset(asset: TMDbImageAsset, preferredLanguage?: string | null): number {
    const width = asset.width || 0;
    const height = asset.height || 0;
    const aspectRatio = width > 0 && height > 0 ? width / height : 0;

    const languageScore = asset.iso_639_1 === preferredLanguage
        ? 34
        : asset.iso_639_1 === null
            ? 28
            : asset.iso_639_1 === 'en'
                ? 22
                : -18;
    const resolutionScore = ((width * height) / 1_000_000) * 6;
    const widthScore = width >= 1000
        ? 32
        : width >= 700
            ? 18
            : width >= TMDB_LOGO_MIN_WIDTH
                ? 8
                : -26;
    const heightScore = height >= 220
        ? 18
        : height >= 140
            ? 8
            : height >= TMDB_LOGO_MIN_HEIGHT
                ? 2
                : -18;
    const aspectScore = aspectRatio >= 1.2 && aspectRatio <= 6
        ? 16
        : aspectRatio > 0
            ? -10
            : -22;
    const voteScore = ((asset.vote_average || 0) * 4) + Math.min(asset.vote_count || 0, 120) / 10;

    return languageScore + resolutionScore + widthScore + heightScore + aspectScore + voteScore;
}

export function selectBestLogo(
    assets: TMDbImageAsset[] | undefined,
    options: SelectTMDbLogoOptions,
): TMDbImageSelectionResult | null {
    if (!Array.isArray(assets) || assets.length === 0) {
        return null;
    }

    const selected = [...assets]
        .filter((asset) => typeof asset.file_path === 'string' && asset.file_path.length > 0)
        .sort((left, right) => scoreLogoAsset(right, options.preferredLanguage) - scoreLogoAsset(left, options.preferredLanguage))[0];

    if (!selected?.file_path) {
        return null;
    }

    const result = {
        filePath: selected.file_path,
        url: buildTMDbImageUrl(selected.file_path, options.baseUrl),
        score: scoreLogoAsset(selected, options.preferredLanguage),
    };

    debugLog(options.debugLabel, 'Selected logo', result);
    return result;
}

export async function areTMDbImagesVisuallySimilar(primaryUrl: string, secondaryUrl: string): Promise<boolean> {
    if (!primaryUrl || !secondaryUrl || primaryUrl === secondaryUrl) {
        return Boolean(primaryUrl) && primaryUrl === secondaryUrl;
    }

    const metrics = await computePosterBackdropSimilarity(primaryUrl, secondaryUrl);
    if (!metrics) {
        return false;
    }

    return isNearDuplicateKeyArt(metrics);
}

export async function pickDistinctImageUrl(
    primaryUrl: string,
    candidateUrls: string[],
    isVisuallySimilar: (left: string, right: string) => Promise<boolean> = areTMDbImagesVisuallySimilar,
): Promise<string> {
    if (candidateUrls.length === 0) {
        return '';
    }

    if (!primaryUrl) {
        return candidateUrls[0] || '';
    }

    for (const candidateUrl of candidateUrls) {
        if (!candidateUrl || candidateUrl === primaryUrl) {
            continue;
        }

        if (!(await isVisuallySimilar(primaryUrl, candidateUrl))) {
            return candidateUrl;
        }
    }

    return candidateUrls.find((candidateUrl) => candidateUrl && candidateUrl !== primaryUrl) || '';
}

export async function rankBackdropImageUrls(
    assets: TMDbImageAsset[] | undefined,
    options: {
        baseUrl: string;
        preferredPath?: string | null;
        posterUrl?: string | null;
        minimumScore?: number;
        debugLabel?: string;
    },
): Promise<string[]> {
    if (!Array.isArray(assets) || assets.length === 0) {
        return [];
    }

    const selection = await selectBestBackdropForPoster(assets, {
        baseUrl: options.baseUrl,
        posterUrl: options.posterUrl,
        preferredPath: options.preferredPath,
        minimumScore: options.minimumScore,
        debugLabel: options.debugLabel,
    });

    const seen = new Set<string>();
    return selection.candidates
        .map((candidate) => candidate.url)
        .filter((url) => {
            if (!url || seen.has(url)) {
                return false;
            }

            seen.add(url);
            return true;
        });
}
