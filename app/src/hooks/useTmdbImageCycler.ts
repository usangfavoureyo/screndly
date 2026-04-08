import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildTMDbImageSelectionPayload,
  deriveTMDbImageStyle,
  getTMDbAssetUrl,
  type TMDbFeedImageStyle,
  type TMDbImageAssetType,
  type TMDbImagePools,
  type TMDbImageSelectionPayload,
} from '../lib/tmdb/feedImageSelection';

interface UseTmdbImageCyclerOptions {
  open: boolean;
  pools: TMDbImagePools;
  currentImageUrl?: string;
  currentImageType?: string;
  currentImageUrls?: string[];
  currentImageTypes?: string[];
}

type UploadableAssetType = Exclude<TMDbImageAssetType, 'custom'>;
type UploadedImageMap = Partial<Record<UploadableAssetType, string>>;

function resolveAssetIndex(urls: string[], currentUrl?: string): number {
  if (!currentUrl || urls.length === 0) {
    return 0;
  }

  const foundIndex = urls.findIndex((url) => url === currentUrl);
  return foundIndex >= 0 ? foundIndex : 0;
}

function isCustomSlotUrl(url: string | undefined, poolUrls: string[]): boolean {
  if (!url) {
    return false;
  }

  return !poolUrls.includes(url);
}

export function useTmdbImageCycler({
  open,
  pools,
  currentImageUrl,
  currentImageType,
  currentImageUrls,
  currentImageTypes,
}: UseTmdbImageCyclerOptions) {
  const [selectedStyle, setSelectedStyle] = useState<TMDbFeedImageStyle>('poster');
  const [posterIndex, setPosterIndex] = useState(0);
  const [backdropIndex, setBackdropIndex] = useState(0);
  const [logoIndex, setLogoIndex] = useState(0);
  const [uploadedImages, setUploadedImages] = useState<UploadedImageMap>({});
  const hasUserSelectionRef = useRef(false);

  const posterUrls = useMemo(() => pools.posters.map((asset) => asset.url), [pools.posters]);
  const backdropUrls = useMemo(() => pools.backdrops.map((asset) => asset.url), [pools.backdrops]);
  const logoUrls = useMemo(() => pools.logos.map((asset) => asset.url), [pools.logos]);

  useEffect(() => {
    if (!open) {
      hasUserSelectionRef.current = false;
      return;
    }

    const nextStyle = deriveTMDbImageStyle(currentImageType, currentImageTypes);
    const currentPosterUrl = getTMDbAssetUrl(currentImageUrls, currentImageTypes, 'poster');
    const currentBackdropUrl = getTMDbAssetUrl(currentImageUrls, currentImageTypes, 'backdrop');
    const currentLogoUrl = getTMDbAssetUrl(currentImageUrls, currentImageTypes, 'logo');
    const nextUploadedImages: UploadedImageMap = {};

    if (nextStyle === 'poster' && isCustomSlotUrl(currentImageUrl, posterUrls)) {
      nextUploadedImages.poster = currentImageUrl;
    }

    if (nextStyle === 'backdrop' && isCustomSlotUrl(currentImageUrl, backdropUrls)) {
      nextUploadedImages.backdrop = currentImageUrl;
    }

    if (currentPosterUrl && isCustomSlotUrl(currentPosterUrl, posterUrls)) {
      nextUploadedImages.poster = currentPosterUrl;
    }

    if (currentBackdropUrl && isCustomSlotUrl(currentBackdropUrl, backdropUrls)) {
      nextUploadedImages.backdrop = currentBackdropUrl;
    }

    if (currentLogoUrl && isCustomSlotUrl(currentLogoUrl, logoUrls)) {
      nextUploadedImages.logo = currentLogoUrl;
    }

    hasUserSelectionRef.current = false;
    setSelectedStyle(nextStyle);
    setUploadedImages(nextUploadedImages);
  }, [
    open,
    currentImageUrl,
    currentImageType,
    currentImageUrls,
    currentImageTypes,
    posterUrls,
    backdropUrls,
    logoUrls,
  ]);

  useEffect(() => {
    if (!open || hasUserSelectionRef.current) {
      return;
    }

    const currentPosterUrl = getTMDbAssetUrl(currentImageUrls, currentImageTypes, 'poster');
    const currentBackdropUrl = getTMDbAssetUrl(currentImageUrls, currentImageTypes, 'backdrop');
    const currentLogoUrl = getTMDbAssetUrl(currentImageUrls, currentImageTypes, 'logo');

    setPosterIndex(resolveAssetIndex(posterUrls, currentPosterUrl || currentImageUrl));
    setBackdropIndex(resolveAssetIndex(backdropUrls, currentBackdropUrl || currentImageUrl));
    setLogoIndex(resolveAssetIndex(logoUrls, currentLogoUrl));
  }, [
    open,
    posterUrls,
    backdropUrls,
    logoUrls,
    currentImageUrl,
    currentImageUrls,
    currentImageTypes,
  ]);

  const selectedPoster = pools.posters[posterIndex] ?? null;
  const selectedBackdrop = pools.backdrops[backdropIndex] ?? null;
  const selectedLogo = pools.logos[logoIndex] ?? null;

  const markUserSelection = () => {
    hasUserSelectionRef.current = true;
  };

  const setUploadedImageForType = (assetType: UploadableAssetType, url: string | null) => {
    markUserSelection();
    setUploadedImages((previous) => {
      if (!url) {
        const next = { ...previous };
        delete next[assetType];
        return next;
      }

      return {
        ...previous,
        [assetType]: url,
      };
    });
  };

  const clearUploadedImageForType = (assetType: UploadableAssetType) => {
    setUploadedImageForType(assetType, null);
  };

  const cyclePoster = () => {
    markUserSelection();
    setPosterIndex((previous) => (posterUrls.length <= 1 ? 0 : (previous + 1) % posterUrls.length));
  };

  const cycleBackdrop = () => {
    markUserSelection();
    setBackdropIndex((previous) => (backdropUrls.length <= 1 ? 0 : (previous + 1) % backdropUrls.length));
  };

  const cycleLogo = () => {
    markUserSelection();
    setLogoIndex((previous) => (logoUrls.length <= 1 ? 0 : (previous + 1) % logoUrls.length));
  };

  const selectStyle = (style: TMDbFeedImageStyle) => {
    markUserSelection();
    setSelectedStyle(style);
  };

  const effectivePosterUrl = uploadedImages.poster || selectedPoster?.url || null;
  const effectiveBackdropUrl = uploadedImages.backdrop || selectedBackdrop?.url || null;
  const effectiveLogoUrl = uploadedImages.logo || selectedLogo?.url || null;

  const canSave = useMemo(() => {
    if (selectedStyle === 'poster') {
      return Boolean(effectivePosterUrl);
    }

    if (selectedStyle === 'backdrop') {
      return Boolean(effectiveBackdropUrl);
    }

    if (selectedStyle === 'poster_backdrop') {
      return Boolean(effectivePosterUrl && effectiveBackdropUrl);
    }

    return Boolean(effectiveBackdropUrl && effectiveLogoUrl);
  }, [effectiveBackdropUrl, effectiveLogoUrl, effectivePosterUrl, selectedStyle]);

  const selection = useMemo<TMDbImageSelectionPayload | null>(() => (
    buildTMDbImageSelectionPayload({
      imageStyle: selectedStyle,
      posterUrl: selectedPoster?.url,
      backdropUrl: selectedBackdrop?.url,
      logoUrl: selectedLogo?.url,
      uploadedPosterUrl: uploadedImages.poster,
      uploadedBackdropUrl: uploadedImages.backdrop,
      uploadedLogoUrl: uploadedImages.logo,
    })
  ), [
    selectedBackdrop?.url,
    selectedLogo?.url,
    selectedPoster?.url,
    selectedStyle,
    uploadedImages.backdrop,
    uploadedImages.logo,
    uploadedImages.poster,
  ]);

  return {
    selectedStyle,
    selectStyle,
    selectedPoster,
    selectedBackdrop,
    selectedLogo,
    effectivePosterUrl,
    effectiveBackdropUrl,
    effectiveLogoUrl,
    cyclePoster,
    cycleBackdrop,
    cycleLogo,
    uploadedImages,
    setUploadedImageForType,
    clearUploadedImageForType,
    canSave,
    selection,
    availability: {
      hasPosters: posterUrls.length > 0,
      hasBackdrops: backdropUrls.length > 0,
      hasLogos: logoUrls.length > 0,
    },
  };
}
