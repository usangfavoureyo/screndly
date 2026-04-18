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
    ? normalizedImageTypes
    : imageUrls.length > 0
      ? [fallbackImageType]
      : [];

  return {
    imageUrl: imageUrls[0],
    imageUrls,
    imageType: imageTypes[0] || fallbackImageType,
    imageTypes,
  };
}
