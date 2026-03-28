import { getTMDbImagePreferenceLabel, type TMDbImagePreference } from './tmdbSettingsService';

export type TMDbFeedImageStyle = TMDbImagePreference;
export type TMDbImageAssetType = 'poster' | 'backdrop' | 'logo' | 'custom';

export interface TMDbImagePoolAsset {
  path: string | null;
  url: string;
  type: Exclude<TMDbImageAssetType, 'custom'>;
}

export interface TMDbImagePools {
  posters: TMDbImagePoolAsset[];
  backdrops: TMDbImagePoolAsset[];
  logos: TMDbImagePoolAsset[];
}

export interface TMDbImageSelectionPayload {
  imageStyle: TMDbFeedImageStyle;
  imageUrl: string;
  imageType: TMDbImageAssetType;
  imageUrls: string[];
  imageTypes: TMDbImageAssetType[];
}

const VALID_ASSET_TYPES: TMDbImageAssetType[] = ['poster', 'backdrop', 'logo', 'custom'];

function isValidAssetType(value: unknown): value is TMDbImageAssetType {
  return typeof value === 'string' && VALID_ASSET_TYPES.includes(value as TMDbImageAssetType);
}

export function normalizeTMDbImageTypes(
  imageType?: string | null,
  imageTypes?: Array<string | null | undefined>,
): TMDbImageAssetType[] {
  const normalized = Array.isArray(imageTypes)
    ? imageTypes.filter(isValidAssetType)
    : [];

  if (normalized.length > 0) {
    return normalized;
  }

  if (isValidAssetType(imageType)) {
    return [imageType];
  }

  return ['poster'];
}

export function deriveTMDbImageStyle(
  imageType?: string | null,
  imageTypes?: Array<string | null | undefined>,
): TMDbFeedImageStyle {
  const normalizedTypes = normalizeTMDbImageTypes(imageType, imageTypes);

  if (normalizedTypes.includes('poster') && normalizedTypes.includes('backdrop')) {
    return 'poster_backdrop';
  }

  if (normalizedTypes.includes('backdrop') && normalizedTypes.includes('logo')) {
    return 'backdrop_logo';
  }

  if (normalizedTypes[0] === 'backdrop') {
    return 'backdrop';
  }

  return 'poster';
}

export function getTMDbImageStyleLabel(style: TMDbFeedImageStyle): string {
  return getTMDbImagePreferenceLabel(style);
}

export function getTMDbImageBadgeLabel(
  imageType?: string | null,
  imageTypes?: Array<string | null | undefined>,
): string {
  const normalizedTypes = normalizeTMDbImageTypes(imageType, imageTypes);

  if (normalizedTypes[0] === 'custom') {
    return 'Uploaded';
  }

  return getTMDbImageStyleLabel(deriveTMDbImageStyle(imageType, imageTypes));
}

export function getTMDbAssetUrl(
  imageUrls?: string[] | null,
  imageTypes?: Array<string | null | undefined>,
  targetType?: TMDbImageAssetType,
): string | undefined {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return undefined;
  }

  const normalizedTypes = normalizeTMDbImageTypes(undefined, imageTypes);

  if (!targetType) {
    return imageUrls[0];
  }

  const matchIndex = normalizedTypes.findIndex((type) => type === targetType);
  if (matchIndex >= 0 && imageUrls[matchIndex]) {
    return imageUrls[matchIndex];
  }

  return undefined;
}

export function isTMDbLogoCardUrl(url?: string | null): boolean {
  return typeof url === 'string' && url.includes('/rss/logo-cards/');
}

export function buildTMDbImageSelectionPayload(input: {
  imageStyle: TMDbFeedImageStyle;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  logoUrl?: string | null;
  uploadedImageUrl?: string | null;
}): TMDbImageSelectionPayload | null {
  const {
    imageStyle,
    posterUrl,
    backdropUrl,
    logoUrl,
    uploadedImageUrl,
  } = input;

  if (uploadedImageUrl) {
    return {
      imageStyle,
      imageUrl: uploadedImageUrl,
      imageType: 'custom',
      imageUrls: [uploadedImageUrl],
      imageTypes: ['custom'],
    };
  }

  if (imageStyle === 'poster') {
    if (!posterUrl) {
      return null;
    }

    return {
      imageStyle,
      imageUrl: posterUrl,
      imageType: 'poster',
      imageUrls: [posterUrl],
      imageTypes: ['poster'],
    };
  }

  if (imageStyle === 'backdrop') {
    if (!backdropUrl) {
      return null;
    }

    return {
      imageStyle,
      imageUrl: backdropUrl,
      imageType: 'backdrop',
      imageUrls: [backdropUrl],
      imageTypes: ['backdrop'],
    };
  }

  if (imageStyle === 'poster_backdrop') {
    if (!posterUrl || !backdropUrl) {
      return null;
    }

    return {
      imageStyle,
      imageUrl: posterUrl,
      imageType: 'poster',
      imageUrls: [posterUrl, backdropUrl],
      imageTypes: ['poster', 'backdrop'],
    };
  }

  if (!backdropUrl || !logoUrl) {
    return null;
  }

  return {
    imageStyle,
    imageUrl: backdropUrl,
    imageType: 'backdrop',
    imageUrls: [backdropUrl, logoUrl],
    imageTypes: ['backdrop', 'logo'],
  };
}
