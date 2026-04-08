import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildTMDbImageSelectionPayload,
  deriveTMDbImageStyle,
  getTMDbAssetUrl,
  type TMDbFeedImageStyle,
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

function resolveAssetIndex(
  urls: string[],
  currentUrl?: string,
): number {
  if (!currentUrl || urls.length === 0) {
    return 0;
  }

  const foundIndex = urls.findIndex((url) => url === currentUrl);
  return foundIndex >= 0 ? foundIndex : 0;
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
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
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
    const isCustomImage = currentImageType === 'custom' || currentImageTypes?.[0] === 'custom';

    hasUserSelectionRef.current = false;
    setSelectedStyle(nextStyle);
    setUploadedImageUrl(isCustomImage ? currentImageUrl || currentImageUrls?.[0] || null : null);
  }, [open, currentImageUrl, currentImageType, currentImageUrls, currentImageTypes]);

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

  const setCustomUploadedImageUrl = (url: string | null) => {
    markUserSelection();
    setUploadedImageUrl(url);
  };

  const clearUploadedImage = () => {
    markUserSelection();
    setUploadedImageUrl(null);
  };

  const cyclePoster = () => {
    markUserSelection();
    setUploadedImageUrl(null);
    setPosterIndex((previous) => (posterUrls.length <= 1 ? 0 : (previous + 1) % posterUrls.length));
  };

  const cycleBackdrop = () => {
    markUserSelection();
    setUploadedImageUrl(null);
    setBackdropIndex((previous) => (backdropUrls.length <= 1 ? 0 : (previous + 1) % backdropUrls.length));
  };

  const cycleLogo = () => {
    markUserSelection();
    setUploadedImageUrl(null);
    setLogoIndex((previous) => (logoUrls.length <= 1 ? 0 : (previous + 1) % logoUrls.length));
  };

  const selectStyle = (style: TMDbFeedImageStyle) => {
    markUserSelection();
    setUploadedImageUrl(null);
    setSelectedStyle(style);
  };

  const canSave = useMemo(() => {
    if (uploadedImageUrl) {
      return true;
    }

    if (selectedStyle === 'poster') {
      return Boolean(selectedPoster?.url);
    }

    if (selectedStyle === 'backdrop') {
      return Boolean(selectedBackdrop?.url);
    }

    if (selectedStyle === 'poster_backdrop') {
      return Boolean(selectedPoster?.url && selectedBackdrop?.url);
    }

    return Boolean(selectedBackdrop?.url && selectedLogo?.url);
  }, [selectedBackdrop?.url, selectedLogo?.url, selectedPoster?.url, selectedStyle, uploadedImageUrl]);

  const selection = useMemo<TMDbImageSelectionPayload | null>(() => (
    buildTMDbImageSelectionPayload({
      imageStyle: selectedStyle,
      posterUrl: selectedPoster?.url,
      backdropUrl: selectedBackdrop?.url,
      logoUrl: selectedLogo?.url,
      uploadedImageUrl,
    })
  ), [
    selectedBackdrop?.url,
    selectedLogo?.url,
    selectedPoster?.url,
    selectedStyle,
    uploadedImageUrl,
  ]);

  return {
    selectedStyle,
    selectStyle,
    selectedPoster,
    selectedBackdrop,
    selectedLogo,
    cyclePoster,
    cycleBackdrop,
    cycleLogo,
    uploadedImageUrl,
    setUploadedImageUrl: setCustomUploadedImageUrl,
    clearUploadedImage,
    canSave,
    selection,
    availability: {
      hasPosters: posterUrls.length > 0,
      hasBackdrops: backdropUrls.length > 0,
      hasLogos: logoUrls.length > 0,
    },
  };
}
