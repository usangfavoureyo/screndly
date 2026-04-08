import { useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { apiClient } from '../../lib/api/client';
import { haptics } from '../../utils/haptics';
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from '../ui/bottom-sheet';
import { RedSpinner } from '../PageLoader';
import { ImageStyleSelector } from './ImageStyleSelector';
import { TMDbImagePreviewDialog } from './TMDbImagePreviewDialog';
import { useTmdbImageCycler } from '../../hooks/useTmdbImageCycler';
import { useDesktopFileDrop } from '../../hooks/useDesktopFileDrop';
import {
  getTMDbImageStyleLabel,
  type TMDbFeedImageStyle,
  type TMDbImageAssetType,
  type TMDbImagePools,
  type TMDbImageSelectionPayload,
} from '../../lib/tmdb/feedImageSelection';

interface ChangeImageBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  mediaType: 'movie' | 'tv' | 'person';
  tmdbId: number;
  currentImageUrl?: string;
  currentImageType?: 'poster' | 'backdrop' | 'logo' | 'custom';
  currentImageUrls?: Array<string>;
  currentImageTypes?: Array<'poster' | 'backdrop' | 'logo' | 'custom'>;
  onSave: (selection: TMDbImageSelectionPayload) => Promise<void> | void;
}

interface TMDbImagePoolsResponse {
  posters?: Array<{ path: string | null; url: string }>;
  backdrops?: Array<{ path: string | null; url: string }>;
  logos?: Array<{ path: string | null; url: string }>;
}

function createEmptyPools(): TMDbImagePools {
  return {
    posters: [],
    backdrops: [],
    logos: [],
  };
}

function PreviewCard({
  label,
  imageUrl,
  alt,
  emptyMessage,
  onPreview,
}: {
  label: string;
  imageUrl?: string | null;
  alt: string;
  emptyMessage: string;
  onPreview?: () => void;
}) {
  const isClickable = Boolean(imageUrl && onPreview);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-[#333333] dark:bg-black">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-[#333333]">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-[#9CA3AF]">
          {label}
        </span>
        {isClickable ? (
          <span className="text-[11px] font-medium text-[#ec1e24]">
            Tap to expand
          </span>
        ) : null}
      </div>
      {imageUrl ? (
        <button
          type="button"
          onClick={onPreview}
          className={`h-36 w-full bg-gray-100 text-left dark:bg-[#111111] ${isClickable ? 'cursor-zoom-in transition-opacity hover:opacity-90' : 'cursor-default'}`}
          disabled={!isClickable}
        >
          <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
        </button>
      ) : (
        <div className="flex h-36 items-center justify-center bg-gray-100 px-4 text-center text-xs text-gray-500 dark:bg-[#111111] dark:text-[#9CA3AF]">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

interface PreviewDialogState {
  open: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  imageType?: TMDbImageAssetType;
  imageTypes?: TMDbImageAssetType[];
  initialIndex?: number;
}

export function ChangeImageBottomSheet({
  open,
  onOpenChange,
  title,
  mediaType,
  tmdbId,
  currentImageUrl,
  currentImageType = 'poster',
  currentImageUrls,
  currentImageTypes,
  onSave,
}: ChangeImageBottomSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [pools, setPools] = useState<TMDbImagePools>(createEmptyPools);
  const [previewDialog, setPreviewDialog] = useState<PreviewDialogState>({ open: false });
  const [pendingUploadType, setPendingUploadType] = useState<'poster' | 'backdrop' | 'logo' | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isCancelled = false;

    const loadAssets = async () => {
      setIsLoadingAssets(true);

      try {
        const response = await apiClient.get<TMDbImagePoolsResponse>(`/api/tmdb/images/${mediaType}/${tmdbId}`);
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to load TMDb images');
        }

        if (!isCancelled) {
          setPools({
            posters: (response.data.posters || []).map((asset) => ({ ...asset, type: 'poster' })),
            backdrops: (response.data.backdrops || []).map((asset) => ({ ...asset, type: 'backdrop' })),
            logos: (response.data.logos || []).map((asset) => ({ ...asset, type: 'logo' })),
          });
        }
      } catch (error) {
        console.error('Failed to load TMDb image pools:', error);
        if (!isCancelled) {
          setPools(createEmptyPools());
          toast.error('Failed to load TMDb images');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingAssets(false);
        }
      }
    };

    void loadAssets();

    return () => {
      isCancelled = true;
    };
  }, [mediaType, open, tmdbId]);

  const {
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
    availability,
  } = useTmdbImageCycler({
    open,
    pools,
    currentImageUrl,
    currentImageType,
    currentImageUrls,
    currentImageTypes,
  });

  const disabledStyles = useMemo<Partial<Record<TMDbFeedImageStyle, boolean>>>(() => ({
    poster: !availability.hasPosters,
    backdrop: !availability.hasBackdrops,
    poster_backdrop: !availability.hasPosters || !availability.hasBackdrops,
    backdrop_logo: !availability.hasBackdrops || !availability.hasLogos,
  }), [availability.hasBackdrops, availability.hasLogos, availability.hasPosters]);

  const handleStyleSelect = (style: TMDbFeedImageStyle) => {
    haptics.selection();
    selectStyle(style);
  };

  const handleUploadTrigger = () => {
    haptics.light();
    setPendingUploadType(selectedStyle === 'backdrop' ? 'backdrop' : 'poster');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    fileInputRef.current?.click();
  };

  const handleSlotUploadTrigger = (assetType: 'poster' | 'backdrop' | 'logo') => {
    haptics.light();
    setPendingUploadType(assetType);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    fileInputRef.current?.click();
  };

  const handleSelectedImageFile = (file?: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size too large (max 5MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result;
      if (typeof dataUrl === 'string' && dataUrl.length > 0) {
        const targetType = pendingUploadType || (selectedStyle === 'backdrop' ? 'backdrop' : 'poster');
        setUploadedImageForType(targetType, dataUrl);
        haptics.light();
        toast.success(`${targetType[0].toUpperCase()}${targetType.slice(1)} uploaded and ready to save`);
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    handleSelectedImageFile(file);
    event.target.value = '';
    setPendingUploadType(null);
  };

  const uploadDrop = useDesktopFileDrop({
    accept: 'image/*',
    onFiles: (files) => {
      handleSelectedImageFile(files[0]);
    },
  });

  const renderSlotActions = (
    assetType: 'poster' | 'backdrop' | 'logo',
    cycleLabel: string,
    onCycle: () => void,
    disabled: boolean,
  ) => {
    const hasUploadedImage = Boolean(uploadedImages[assetType]);

    return (
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSlotUploadTrigger(assetType)}
          className="border-gray-200 dark:border-[#333333]"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload {cycleLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={hasUploadedImage ? () => {
            haptics.light();
            clearUploadedImageForType(assetType);
          } : onCycle}
          disabled={!hasUploadedImage && disabled}
          className="border-gray-200 dark:border-[#333333]"
        >
          {hasUploadedImage ? 'Use TMDb Image' : cycleLabel}
        </Button>
      </div>
    );
  };

  const handleCycle = (assetType: TMDbImageAssetType) => {
    haptics.selection();

    if (assetType === 'poster') {
      cyclePoster();
      return;
    }

    if (assetType === 'backdrop') {
      cycleBackdrop();
      return;
    }

    cycleLogo();
  };

  const handleClose = () => {
    if (isSavingImage) {
      return;
    }

    haptics.light();
    onOpenChange(false);
  };

  const openPreview = ({
    imageUrls,
    imageTypes,
    initialIndex = 0,
  }: {
    imageUrls: string[];
    imageTypes: TMDbImageAssetType[];
    initialIndex?: number;
  }) => {
    const filteredUrls = imageUrls.filter((value): value is string => typeof value === 'string' && value.length > 0);
    const filteredTypes = imageTypes.filter((value): value is TMDbImageAssetType => typeof value === 'string');

    if (filteredUrls.length === 0) {
      return;
    }

    haptics.light();
    setPreviewDialog({
      open: true,
      imageUrl: filteredUrls[initialIndex] ?? filteredUrls[0],
      imageUrls: filteredUrls,
      imageType: filteredTypes[initialIndex] ?? filteredTypes[0],
      imageTypes: filteredTypes.length > 0 ? filteredTypes : undefined,
      initialIndex,
    });
  };

  const closePreview = () => {
    setPreviewDialog({ open: false });
  };

  const handleSaveImage = async () => {
    if (!selection || !canSave || isSavingImage) {
      return;
    }

    haptics.medium();
    setIsSavingImage(true);

    try {
      await Promise.resolve(onSave(selection));
      haptics.success();
      toast.success('Image saved');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save TMDb image selection:', error);
      toast.error('Failed to save image');
    } finally {
      setIsSavingImage(false);
    }
  };

  const renderModeControls = () => {
    if (selectedStyle === 'poster') {
      return (
        <div className="space-y-3">
          {renderSlotActions('poster', 'Poster', () => handleCycle('poster'), !availability.hasPosters)}
          <PreviewCard
            label="Poster"
            imageUrl={effectivePosterUrl}
            alt={`${title} poster`}
            emptyMessage="No posters available for this title."
            onPreview={effectivePosterUrl ? () => openPreview({
              imageUrls: [effectivePosterUrl],
              imageTypes: ['poster'],
            }) : undefined}
          />
        </div>
      );
    }

    if (selectedStyle === 'backdrop') {
      return (
        <div className="space-y-3">
          {renderSlotActions('backdrop', 'Backdrop', () => handleCycle('backdrop'), !availability.hasBackdrops)}
          <PreviewCard
            label="Backdrop"
            imageUrl={effectiveBackdropUrl}
            alt={`${title} backdrop`}
            emptyMessage="No backdrops available for this title."
            onPreview={effectiveBackdropUrl ? () => openPreview({
              imageUrls: [effectiveBackdropUrl],
              imageTypes: ['backdrop'],
            }) : undefined}
          />
        </div>
      );
    }

    if (selectedStyle === 'poster_backdrop') {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-3">
              {renderSlotActions('poster', 'Poster', () => handleCycle('poster'), !availability.hasPosters)}
              <PreviewCard
                label="Poster"
                imageUrl={effectivePosterUrl}
                alt={`${title} poster`}
                emptyMessage="No posters available for this title."
                onPreview={effectivePosterUrl && effectiveBackdropUrl ? () => openPreview({
                  imageUrls: [effectivePosterUrl, effectiveBackdropUrl],
                  imageTypes: ['poster', 'backdrop'],
                  initialIndex: 0,
                }) : effectivePosterUrl ? () => openPreview({
                  imageUrls: [effectivePosterUrl],
                  imageTypes: ['poster'],
                }) : undefined}
              />
            </div>
            <div className="space-y-3">
              {renderSlotActions('backdrop', 'Backdrop', () => handleCycle('backdrop'), !availability.hasBackdrops)}
              <PreviewCard
                label="Backdrop"
                imageUrl={effectiveBackdropUrl}
                alt={`${title} backdrop`}
                emptyMessage="No backdrops available for this title."
                onPreview={effectivePosterUrl && effectiveBackdropUrl ? () => openPreview({
                  imageUrls: [effectivePosterUrl, effectiveBackdropUrl],
                  imageTypes: ['poster', 'backdrop'],
                  initialIndex: 1,
                }) : effectiveBackdropUrl ? () => openPreview({
                  imageUrls: [effectiveBackdropUrl],
                  imageTypes: ['backdrop'],
                }) : undefined}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-3">
            {renderSlotActions('backdrop', 'Backdrop', () => handleCycle('backdrop'), !availability.hasBackdrops)}
            <PreviewCard
              label="Backdrop"
              imageUrl={effectiveBackdropUrl}
              alt={`${title} backdrop`}
              emptyMessage="No backdrops available for this title."
              onPreview={effectiveBackdropUrl && effectiveLogoUrl ? () => openPreview({
                imageUrls: [effectiveBackdropUrl, effectiveLogoUrl],
                imageTypes: ['backdrop', 'logo'],
                initialIndex: 0,
              }) : effectiveBackdropUrl ? () => openPreview({
                imageUrls: [effectiveBackdropUrl],
                imageTypes: ['backdrop'],
              }) : undefined}
            />
          </div>
          <div className="space-y-3">
            {renderSlotActions('logo', 'Logo', () => handleCycle('logo'), !availability.hasLogos)}
            <PreviewCard
              label="Logo"
              imageUrl={effectiveLogoUrl}
              alt={`${title} logo`}
              emptyMessage="No logos available for this title."
              onPreview={effectiveBackdropUrl && effectiveLogoUrl ? () => openPreview({
                imageUrls: [effectiveBackdropUrl, effectiveLogoUrl],
                imageTypes: ['backdrop', 'logo'],
                initialIndex: 1,
              }) : effectiveLogoUrl ? () => openPreview({
                imageUrls: [effectiveLogoUrl],
                imageTypes: ['logo'],
              }) : undefined}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <TMDbImagePreviewDialog
        open={previewDialog.open}
        imageUrl={previewDialog.imageUrl}
        imageUrls={previewDialog.imageUrls}
        title={title}
        imageType={previewDialog.imageType}
        imageTypes={previewDialog.imageTypes}
        initialIndex={previewDialog.initialIndex}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closePreview();
          }
        }}
        onClose={closePreview}
      />

      <BottomSheet open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
        <BottomSheetHeader>
          <BottomSheetTitle>Change Image ({title})</BottomSheetTitle>
          <BottomSheetDescription>
            Choose a TMDb image style or upload your own image for this feed.
          </BottomSheetDescription>
        </BottomSheetHeader>

        <BottomSheetBody>
          <div className="space-y-4">
            <ImageStyleSelector
              selectedStyle={selectedStyle}
              disabledStyles={disabledStyles}
              onSelect={handleStyleSelect}
            />

            {(selectedStyle === 'poster' || selectedStyle === 'backdrop') ? (
              <div
                className={`rounded-2xl ${uploadDrop.isDragging ? 'ring-1 ring-[#ec1e24]/50' : ''}`}
                {...uploadDrop.bind}
              >
                <button
                  type="button"
                  onClick={handleUploadTrigger}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111] ${
                    uploadDrop.isDragging ? 'border-[#ec1e24] bg-[#ec1e24]/10' : ''
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  Upload for current slot
                </button>
              </div>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {isLoadingAssets ? (
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 dark:border-[#333333] dark:bg-black">
                <RedSpinner
                  size="md"
                  className="mx-auto"
                  label={`Loading ${getTMDbImageStyleLabel(selectedStyle).toLowerCase()} options`}
                />
              </div>
            ) : (
              renderModeControls()
            )}

            {!isLoadingAssets && !canSave && (
              <div className="flex items-start gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-[#333333] dark:bg-black">
                <ImageIcon className="mt-0.5 h-4 w-4 text-[#ec1e24]" />
                <p className="text-xs text-gray-500 dark:text-[#9CA3AF]">
                  This style needs assets that TMDb does not have for this title. Choose another style or upload your own image.
                </p>
              </div>
            )}
          </div>
        </BottomSheetBody>

        <BottomSheetFooter>
          <Button
            onClick={handleSaveImage}
            disabled={!canSave || isSavingImage || isLoadingAssets || !selection}
          >
            {isSavingImage ? (
              <>
                <RedSpinner size="sm" className="mr-2" label="Saving image selection" />
                Save
              </>
            ) : 'Save'}
          </Button>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSavingImage}
            className="border-gray-200 dark:border-[#333333]"
          >
            Cancel
          </Button>
        </BottomSheetFooter>
      </BottomSheet>
    </>
  );
}
