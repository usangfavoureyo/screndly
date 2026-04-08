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
    cyclePoster,
    cycleBackdrop,
    cycleLogo,
    uploadedImageUrl,
    setUploadedImageUrl,
    clearUploadedImage,
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
        setUploadedImageUrl(dataUrl);
        haptics.light();
        toast.success('Uploaded image ready to save');
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
  };

  const uploadDrop = useDesktopFileDrop({
    accept: 'image/*',
    onFiles: (files) => {
      handleSelectedImageFile(files[0]);
    },
  });

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
    if (uploadedImageUrl) {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl border border-[#ec1e24]/30 bg-[#ec1e24]/5 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Uploaded image active</p>
              <p className="text-xs text-gray-500 dark:text-[#9CA3AF]">
                Save now or switch back to a TMDb image style.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                haptics.light();
                clearUploadedImage();
              }}
              className="border-gray-200 dark:border-[#333333]"
            >
              Clear
            </Button>
          </div>

          <PreviewCard
            label="Uploaded Image"
            imageUrl={uploadedImageUrl}
            alt={`${title} uploaded`}
            emptyMessage="No uploaded image selected."
            onPreview={uploadedImageUrl ? () => openPreview({
              imageUrls: [uploadedImageUrl],
              imageTypes: ['custom'],
            }) : undefined}
          />
        </div>
      );
    }

    if (selectedStyle === 'poster') {
      return (
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleCycle('poster')}
            disabled={!availability.hasPosters}
            className="w-full border-gray-200 dark:border-[#333333]"
          >
            Poster
          </Button>
          <PreviewCard
            label="Poster"
            imageUrl={selectedPoster?.url}
            alt={`${title} poster`}
            emptyMessage="No posters available for this title."
            onPreview={selectedPoster?.url ? () => openPreview({
              imageUrls: [selectedPoster.url],
              imageTypes: ['poster'],
            }) : undefined}
          />
        </div>
      );
    }

    if (selectedStyle === 'backdrop') {
      return (
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleCycle('backdrop')}
            disabled={!availability.hasBackdrops}
            className="w-full border-gray-200 dark:border-[#333333]"
          >
            Backdrop
          </Button>
          <PreviewCard
            label="Backdrop"
            imageUrl={selectedBackdrop?.url}
            alt={`${title} backdrop`}
            emptyMessage="No backdrops available for this title."
            onPreview={selectedBackdrop?.url ? () => openPreview({
              imageUrls: [selectedBackdrop.url],
              imageTypes: ['backdrop'],
            }) : undefined}
          />
        </div>
      );
    }

    if (selectedStyle === 'poster_backdrop') {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCycle('poster')}
              disabled={!availability.hasPosters}
              className="border-gray-200 dark:border-[#333333]"
            >
              Poster
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCycle('backdrop')}
              disabled={!availability.hasBackdrops}
              className="border-gray-200 dark:border-[#333333]"
            >
              Backdrop
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PreviewCard
              label="Poster"
              imageUrl={selectedPoster?.url}
              alt={`${title} poster`}
              emptyMessage="No posters available for this title."
              onPreview={selectedPoster?.url && selectedBackdrop?.url ? () => openPreview({
                imageUrls: [selectedPoster.url, selectedBackdrop.url],
                imageTypes: ['poster', 'backdrop'],
                initialIndex: 0,
              }) : selectedPoster?.url ? () => openPreview({
                imageUrls: [selectedPoster.url],
                imageTypes: ['poster'],
              }) : undefined}
            />
            <PreviewCard
              label="Backdrop"
              imageUrl={selectedBackdrop?.url}
              alt={`${title} backdrop`}
              emptyMessage="No backdrops available for this title."
              onPreview={selectedPoster?.url && selectedBackdrop?.url ? () => openPreview({
                imageUrls: [selectedPoster.url, selectedBackdrop.url],
                imageTypes: ['poster', 'backdrop'],
                initialIndex: 1,
              }) : selectedBackdrop?.url ? () => openPreview({
                imageUrls: [selectedBackdrop.url],
                imageTypes: ['backdrop'],
              }) : undefined}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleCycle('backdrop')}
            disabled={!availability.hasBackdrops}
            className="border-gray-200 dark:border-[#333333]"
          >
            Backdrop
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleCycle('logo')}
            disabled={!availability.hasLogos}
            className="border-gray-200 dark:border-[#333333]"
          >
            Logo
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PreviewCard
            label="Backdrop"
            imageUrl={selectedBackdrop?.url}
            alt={`${title} backdrop`}
            emptyMessage="No backdrops available for this title."
            onPreview={selectedBackdrop?.url && selectedLogo?.url ? () => openPreview({
              imageUrls: [selectedBackdrop.url, selectedLogo.url],
              imageTypes: ['backdrop', 'logo'],
              initialIndex: 0,
            }) : selectedBackdrop?.url ? () => openPreview({
              imageUrls: [selectedBackdrop.url],
              imageTypes: ['backdrop'],
            }) : undefined}
          />
          <PreviewCard
            label="Logo"
            imageUrl={selectedLogo?.url}
            alt={`${title} logo`}
            emptyMessage="No logos available for this title."
            onPreview={selectedBackdrop?.url && selectedLogo?.url ? () => openPreview({
              imageUrls: [selectedBackdrop.url, selectedLogo.url],
              imageTypes: ['backdrop', 'logo'],
              initialIndex: 1,
            }) : selectedLogo?.url ? () => openPreview({
              imageUrls: [selectedLogo.url],
              imageTypes: ['logo'],
            }) : undefined}
          />
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
                Upload your own image
              </button>
            </div>

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

            {!uploadedImageUrl && !isLoadingAssets && !canSave && (
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
