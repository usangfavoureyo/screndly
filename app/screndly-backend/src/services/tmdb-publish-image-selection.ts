import { renderTMDbLogoCard } from './rss-logo-render.service';

export interface TMDbPublishImageSelectionInput {
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  imageType?: string | null;
  imageTypes?: string[] | null;
}

export interface TMDbPublishImageSelectionResult {
  imageUrl?: string;
  imageUrls: string[];
  imageType: string;
  imageTypes: string[];
}

interface ResolveTMDbPublishImagesOptions {
  renderLogoCard?: (sourceUrl: string, intent: 'logo') => Promise<string>;
}

function isRenderedLogoCardUrl(value: string): boolean {
  return value.includes('/rss/logo-cards/');
}

function inferTMDbImageTypeFromUrl(value: string): string | undefined {
  const normalized = value.toLowerCase();
  if (
    normalized.includes('/tmdb/logo-assets/')
    || normalized.includes('/rss/logo-cards/')
    || normalized.includes('trimmed-logo')
    || /(?:^|[-_/])logo(?:[-_.?/]|$)/i.test(value)
  ) {
    return 'logo';
  }

  return undefined;
}

export function normalizeTMDbPublishImages(
  input: TMDbPublishImageSelectionInput,
): TMDbPublishImageSelectionResult {
  const normalizedImageUrls = Array.isArray(input.imageUrls)
    ? input.imageUrls.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const fallbackImageUrl = typeof input.imageUrl === 'string' && input.imageUrl.trim().length > 0
    ? input.imageUrl.trim()
    : undefined;
  const imageUrls = normalizedImageUrls.length > 0
    ? normalizedImageUrls
    : fallbackImageUrl
      ? [fallbackImageUrl]
      : [];

  const normalizedImageTypes = Array.isArray(input.imageTypes)
    ? input.imageTypes.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const fallbackImageType = typeof input.imageType === 'string' && input.imageType.trim().length > 0
    ? input.imageType.trim()
    : 'poster';
  const imageTypes = normalizedImageTypes.length > 0
    ? imageUrls.map((url, index) => normalizedImageTypes[index] || inferTMDbImageTypeFromUrl(url) || fallbackImageType)
    : imageUrls.length > 0
      ? imageUrls.map((url) => inferTMDbImageTypeFromUrl(url) || fallbackImageType)
      : [];

  return {
    imageUrl: imageUrls[0],
    imageUrls,
    imageType: imageTypes[0] || fallbackImageType,
    imageTypes,
  };
}

export async function resolveTMDbPublishImages(
  input: TMDbPublishImageSelectionInput,
  options: ResolveTMDbPublishImagesOptions = {},
): Promise<TMDbPublishImageSelectionResult> {
  const normalized = normalizeTMDbPublishImages(input);
  const renderLogoCard = options.renderLogoCard ?? renderTMDbLogoCard;

  const resolvedImageUrls = await Promise.all(
    normalized.imageUrls.map(async (url, index) => {
      const imageType = normalized.imageTypes[index] || normalized.imageType;
      if (imageType !== 'logo' || isRenderedLogoCardUrl(url)) {
        return url;
      }

      try {
        return await renderLogoCard(url, 'logo');
      } catch (error) {
        console.warn('[TMDb] Failed to render publish-time logo card, using raw logo asset.', {
          source: url,
          error: error instanceof Error ? error.message : String(error),
        });
        return url;
      }
    }),
  );

  return {
    ...normalized,
    imageUrl: resolvedImageUrls[0] || normalized.imageUrl,
    imageUrls: resolvedImageUrls,
  };
}
