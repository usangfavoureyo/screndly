import { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { haptics } from '../../utils/haptics';
import { toast } from "sonner";
import { apiClient } from '../../lib/api/client';
import {
    BottomSheet,
    BottomSheetHeader,
    BottomSheetTitle,
    BottomSheetDescription,
    BottomSheetBody,
    BottomSheetFooter
} from '../ui/bottom-sheet';
import { TMDbImagePreviewDialog } from './TMDbImagePreviewDialog';
import { RedSpinner } from '../PageLoader';
import { getImagePreferences, getTMDbImagePreferenceLabel, type TMDbImagePreference } from '../../lib/tmdb/tmdbSettingsService';

type ChangeImageMode = TMDbImagePreference | 'custom';

interface ChangeImageSelection {
    imageUrl: string;
    imageType: 'poster' | 'backdrop' | 'logo' | 'custom';
    imageUrls: string[];
    imageTypes: Array<'poster' | 'backdrop' | 'logo' | 'custom'>;
}

interface ChangeImageBottomSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    mediaType: 'movie' | 'tv' | 'person';
    tmdbId: number;
    currentImageUrl?: string;
    currentImageType?: 'poster' | 'backdrop' | 'logo' | 'custom';
    currentImageUrls?: string[];
    currentImageTypes?: Array<'poster' | 'backdrop' | 'logo' | 'custom'>;
    onSave: (selection: ChangeImageSelection) => Promise<void> | void;
}

export function ChangeImageBottomSheet({
    open,
    onOpenChange,
    title,
    mediaType,
    tmdbId,
    currentImageUrl,
    currentImageUrls,
    currentImageType = 'poster',
    currentImageTypes,
    onSave
}: ChangeImageBottomSheetProps) {
    const [selectedMode, setSelectedMode] = useState<ChangeImageMode>('custom');
    const [previewImageUrls, setPreviewImageUrls] = useState<string[]>([]);
    const [previewImageTypes, setPreviewImageTypes] = useState<Array<'poster' | 'backdrop' | 'logo' | 'custom'>>([]);
    const [isFetchingImage, setIsFetchingImage] = useState(false);
    const [fetchingImageType, setFetchingImageType] = useState<ChangeImageMode | null>(null);
    const [isSavingImage, setIsSavingImage] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const preferredModes = getImagePreferences();
    const availableModes = Array.from(new Set<ChangeImageMode>([...preferredModes, 'custom']));

    const currentImageSelectionType = currentImageType === 'logo'
        ? 'backdrop_logo'
        : Array.isArray(currentImageTypes) && currentImageTypes[0] === 'poster' && currentImageTypes[1] === 'backdrop'
            ? 'poster_backdrop'
            : Array.isArray(currentImageTypes) && currentImageTypes[0] === 'backdrop' && currentImageTypes[1] === 'logo'
                ? 'backdrop_logo'
                : currentImageType === 'backdrop'
                    ? 'backdrop'
                    : currentImageType === 'custom'
                        ? 'custom'
                        : 'poster';

    // Reset state when opening
    useEffect(() => {
        if (open) {
            setSelectedMode(currentImageSelectionType);
            setPreviewImageUrls(Array.isArray(currentImageUrls) && currentImageUrls.length > 0
                ? currentImageUrls
                : (currentImageUrl ? [currentImageUrl] : []));
            setPreviewImageTypes(Array.isArray(currentImageTypes) && currentImageTypes.length > 0
                ? currentImageTypes
                : [currentImageType]);
            setIsFetchingImage(false);
            setFetchingImageType(null);
            setIsSavingImage(false);
            setIsPreviewOpen(false);
        }
    }, [open, currentImageSelectionType, currentImageUrl, currentImageUrls, currentImageType, currentImageTypes]);

    useEffect(() => {
        if (!open) {
            setIsPreviewOpen(false);
        }
    }, [open]);

    const handleSelectFile = (e: React.MouseEvent) => {
        // Prevent bubbling which might close sheet in some implementations
        e.preventDefault();
        haptics.light();

        if (fileInputRef.current) {
            fileInputRef.current.click();
        } else {
            console.error('File input ref missing');
            toast.error('Unable to open file picker');
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        haptics.light();

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size too large (max 5MB)');
            return;
        }

        setIsFetchingImage(true);
        setFetchingImageType('custom');
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            if (dataUrl) {
                setPreviewImageUrls([dataUrl]);
                setPreviewImageTypes(['custom']);
                setSelectedMode('custom');
                haptics.light();
                toast.success('Image loaded - tap Save to apply');
            }
            setIsFetchingImage(false);
            setFetchingImageType(null);
        };
        reader.onerror = () => {
            toast.error('Failed to read image file');
            setIsFetchingImage(false);
            setFetchingImageType(null);
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const handleFetchImage = async (type: TMDbImagePreference) => {
        haptics.selection();
        setIsFetchingImage(true);
        setFetchingImageType(type);

        try {
            const excludeImageUrl = previewImageUrl || currentImageUrl;
            const query = new URLSearchParams({
                type,
                random: String(Date.now()),
            });

            if (excludeImageUrl) {
                query.set('exclude', excludeImageUrl);
            }

            const result = await apiClient.get<{
                imageUrl?: string;
                imageType?: 'poster' | 'backdrop' | 'logo';
                imageUrls?: string[];
                imageTypes?: Array<'poster' | 'backdrop' | 'logo'>;
            }>(`/api/tmdb/images/${mediaType}/${tmdbId}?${query.toString()}`);

            if (result.success && result.data?.imageUrl) {
                setPreviewImageUrls(
                    Array.isArray(result.data.imageUrls) && result.data.imageUrls.length > 0
                        ? result.data.imageUrls
                        : [result.data.imageUrl]
                );
                setPreviewImageTypes(
                    Array.isArray(result.data.imageTypes) && result.data.imageTypes.length > 0
                        ? result.data.imageTypes
                        : [result.data.imageType || 'poster']
                );
                setSelectedMode(type);
                haptics.light();
                toast.success(`${getTMDbImagePreferenceLabel(type)} loaded - tap Save to apply`);
            } else {
                toast.error(result.error?.message || `No ${getTMDbImagePreferenceLabel(type)} available`);
            }
        } catch (error) {
            console.error('Error fetching image:', error);
            toast.error('Failed to fetch image');
        } finally {
            setIsFetchingImage(false);
            setFetchingImageType(null);
        }
    };

    const handleSaveImage = async () => {
        // Prevent double saves
        if (isFetchingImage || isSavingImage) return;

        if (previewImageUrls.length === 0) {
            toast.error('Please select an image first');
            return;
        }

        haptics.medium(); // Feedback immediately on click
        setIsSavingImage(true);

        try {
            await Promise.resolve(onSave({
                imageUrl: previewImageUrls[0],
                imageType: previewImageTypes[0] || 'poster',
                imageUrls: previewImageUrls,
                imageTypes: previewImageTypes,
            }));

            haptics.success();
            toast.success('Image saved');
            onOpenChange(false);
        } catch (error) {
            console.error('Save failed', error);
            toast.error('Something went wrong saving');
        } finally {
            // Check if open to avoid state update on unmounted component
            if (open) {
                setIsSavingImage(false);
            }
        }
    };

    const handleCancel = () => {
        haptics.light();
        setPreviewImageUrls([]);
        setPreviewImageTypes([]);
        setIsPreviewOpen(false);
        onOpenChange(false);
    };

    return (
        <>
            <BottomSheet open={open} onOpenChange={(val) => !val && handleCancel()}>
                <BottomSheetHeader>
                    <BottomSheetTitle>Change Image ({title})</BottomSheetTitle>
                    <BottomSheetDescription>Tap to fetch a new TMDb image mode or upload your own image</BottomSheetDescription>
                </BottomSheetHeader>
                <BottomSheetBody>
                    <div className="grid grid-cols-2 gap-3">
                        {availableModes.map((mode) => {
                            const isUpload = mode === 'custom';
                            const isSelected = selectedMode === mode && (previewImageUrls.length > 0 || isFetchingImage);
                            const label = isUpload ? 'Upload' : getTMDbImagePreferenceLabel(mode);

                            return (
                                <button
                                    key={mode}
                                    onClick={isUpload ? handleSelectFile : () => handleFetchImage(mode)}
                                    disabled={isFetchingImage || isSavingImage}
                                    className={`p-4 rounded-lg border-2 transition-all bg-white dark:bg-black
                                        ${isSelected ? 'border-[#ec1e24]' : 'border-gray-200 dark:border-[#333333]'}
                                        active:border-[#ec1e24]
                                        disabled:opacity-50`}
                                >
                                    {isFetchingImage && fetchingImageType === mode ? (
                                        <RedSpinner
                                            size="md"
                                            className="mx-auto mb-2"
                                            label={isUpload ? 'Loading uploaded image preview...' : `Loading ${label.toLowerCase()}...`}
                                        />
                                    ) : isUpload ? (
                                        <Upload className="w-6 h-6 mx-auto mb-2" />
                                    ) : (
                                        <ImageIcon className="w-6 h-6 mx-auto mb-2" />
                                    )}
                                    <p className="text-sm">{label}</p>
                                </button>
                            );
                        })}

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept="image/*"
                            className="hidden"
                            onClick={(e) => {
                                // Reset value to allow selecting same file again
                                (e.target as HTMLInputElement).value = '';
                            }}
                        />
                    </div>

                    {/* Image Preview */}
                    {previewImageUrls.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                haptics.light();
                                setIsPreviewOpen(true);
                            }}
                            className="mt-4 w-full rounded-lg overflow-hidden border-2 border-[#ec1e24] text-left transition-opacity hover:opacity-95"
                            aria-label={`Expand preview for ${title}`}
                        >
                            <img src={previewImageUrls[0]} alt="Preview" className="w-full h-32 object-cover" />
                            <p className="text-xs text-center py-2 bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-[#9CA3AF]">
                                {previewImageUrls.length > 1 ? `Preview ${previewImageUrls.length} images - tap to expand` : 'Preview - tap to expand'}
                            </p>
                        </button>
                    )}
                </BottomSheetBody>

                <BottomSheetFooter>
                    <Button variant="outline" onClick={handleCancel}>
                        Cancel
                    </Button>

                    <Button
                        onClick={handleSaveImage}
                        disabled={previewImageUrls.length === 0 || isFetchingImage || isSavingImage}
                    >
                        {isSavingImage ? (
                            <>
                                <RedSpinner size="sm" className="mr-2" label="Saving selected image..." />
                                Save
                            </>
                        ) : 'Save'}
                    </Button>
                </BottomSheetFooter>
            </BottomSheet>

            <TMDbImagePreviewDialog
                open={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                imageUrl={previewImageUrls[0]}
                imageUrls={previewImageUrls}
                title={title}
                imageType={previewImageTypes[0] === 'custom' ? 'poster' : previewImageTypes[0]}
                imageTypes={previewImageTypes.map((value) => value === 'custom' ? 'poster' : value)}
            />
        </>
    );
}
