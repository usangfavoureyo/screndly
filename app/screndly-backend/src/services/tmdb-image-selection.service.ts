import sharp from 'sharp';

const TMDB_IMAGE_SIMILARITY_SIZE = 32;
const TMDB_IMAGE_MEAN_DIFF_THRESHOLD = 0.12;
const TMDB_IMAGE_HASH_DIFF_THRESHOLD = 0.18;

const tmdbImageFingerprintCache = new Map<string, Promise<Uint8Array | null>>();

export interface TMDbImageAsset {
    file_path?: string | null;
    iso_639_1?: string | null;
    vote_average?: number;
    vote_count?: number;
    width?: number;
    height?: number;
    aspect_ratio?: number;
}

export function buildTMDbImageUrl(path: string | null | undefined, baseUrl: string): string {
    return path ? `${baseUrl}${path}` : '';
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

function scoreBackdropAsset(asset: TMDbImageAsset, preferredPath?: string | null): number {
    const aspectRatio = getBackdropAspectRatio(asset);
    const landscapeScore = aspectRatio >= 1.6
        ? 140
        : aspectRatio >= 1.3
            ? 60
            : -220;

    const languageScore = asset.iso_639_1 === null
        ? 120
        : asset.iso_639_1 === 'en'
            ? 10
            : -40;

    const voteScore = ((asset.vote_average || 0) * 12) + Math.min(asset.vote_count || 0, 200);
    const resolutionScore = ((asset.width || 0) * (asset.height || 0)) / 1_000_000;
    const preferredScore = preferredPath && asset.file_path === preferredPath ? 15 : 0;

    return landscapeScore + languageScore + voteScore + resolutionScore + preferredScore;
}

export function rankBackdropImageUrls(
    assets: TMDbImageAsset[] | undefined,
    options: {
        baseUrl: string;
        preferredPath?: string | null;
    }
): string[] {
    if (!Array.isArray(assets) || assets.length === 0) {
        return [];
    }

    const seen = new Set<string>();

    return [...assets]
        .filter((asset) => typeof asset.file_path === 'string' && asset.file_path.length > 0)
        .sort((left, right) => scoreBackdropAsset(right, options.preferredPath) - scoreBackdropAsset(left, options.preferredPath))
        .map((asset) => buildTMDbImageUrl(asset.file_path, options.baseUrl))
        .filter((url) => {
            if (!url || seen.has(url)) {
                return false;
            }

            seen.add(url);
            return true;
        });
}

async function getTMDbImageFingerprint(url: string): Promise<Uint8Array | null> {
    if (!url) {
        return null;
    }

    const cached = tmdbImageFingerprintCache.get(url);
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
            const normalized = await sharp(buffer, { animated: false })
                .rotate()
                .resize(TMDB_IMAGE_SIMILARITY_SIZE, TMDB_IMAGE_SIMILARITY_SIZE, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 1 },
                    withoutEnlargement: false,
                })
                .greyscale()
                .raw()
                .toBuffer();

            return Uint8Array.from(normalized);
        } catch {
            return null;
        }
    })();

    tmdbImageFingerprintCache.set(url, pending);
    return pending;
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

export async function areTMDbImagesVisuallySimilar(primaryUrl: string, secondaryUrl: string): Promise<boolean> {
    if (!primaryUrl || !secondaryUrl || primaryUrl === secondaryUrl) {
        return Boolean(primaryUrl) && primaryUrl === secondaryUrl;
    }

    const [primaryFingerprint, secondaryFingerprint] = await Promise.all([
        getTMDbImageFingerprint(primaryUrl),
        getTMDbImageFingerprint(secondaryUrl),
    ]);

    if (!primaryFingerprint || !secondaryFingerprint) {
        return false;
    }

    const meanDifference = getNormalizedMeanDifference(primaryFingerprint, secondaryFingerprint);
    const hashDifference = getNormalizedHashDifference(primaryFingerprint, secondaryFingerprint);
    return meanDifference <= TMDB_IMAGE_MEAN_DIFF_THRESHOLD || hashDifference <= TMDB_IMAGE_HASH_DIFF_THRESHOLD;
}

export async function pickDistinctImageUrl(
    primaryUrl: string,
    candidateUrls: string[],
    isVisuallySimilar: (left: string, right: string) => Promise<boolean> = areTMDbImagesVisuallySimilar
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

    return '';
}
