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

interface ChangeImageBottomSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    mediaType: 'movie' | 'tv' | 'person';
    tmdbId: number;
    currentImageUrl?: string;
    currentImageType?: 'poster' | 'backdrop' | 'custom';
    onSave: (imageUrl: string, imageType: 'poster' | 'backdrop' | 'custom') => Promise<void> | void;
}

export function ChangeImageBottomSheet({
    open,
    onOpenChange,
    title,
    mediaType,
    tmdbId,
    currentImageUrl,
    currentImageType = 'poster',
    onSave
}: ChangeImageBottomSheetProps) {
    const [selectedImageType, setSelectedImageType] = useState<'poster' | 'backdrop' | 'custom'>(currentImageType);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [isFetchingImage, setIsFetchingImage] = useState(false);
    const [fetchingImageType, setFetchingImageType] = useState<'poster' | 'backdrop' | 'custom' | null>(null);
    const [isSavingImage, setIsSavingImage] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when opening
    useEffect(() => {
        if (open) {
            setSelectedImageType(currentImageType);
            setPreviewImageUrl(null);
            setIsFetchingImage(false);
            setFetchingImageType(null);
            setIsSavingImage(false);
            setIsPreviewOpen(false);
        }
    }, [open, currentImageType]);

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
                setPreviewImageUrl(dataUrl);
                setSelectedImageType('custom'); // Or 'backdrop' as previous logic? User logic says "custom" or "upload"
                // Previous logic set it to 'backdrop' for custom uploads, but let's be explicit if we can.
                // However, the backend/types might expect 'poster' or 'backdrop'.
                // The prompt says "Support Poster / Backdrop / Upload". Upload usually maps to custom or backdrop.
                // In TMDbModals line 197 it set it to 'backdrop'. 
                // But TMDbActivityPage has 'custom'.
                // To support both, I will use the type passed in or default to 'backdrop' if 'custom' isn't supported by the parent?
                // Actually, the parent `onSave` expects specialized types.
                // Let's stick to the props interface: 'poster' | 'backdrop' | 'custom'.
                // If the parent (TMDbModals) only supports 'poster' | 'backdrop', it might be an issue.
                // Checking TMDbModals again... `updatePost` uses `imageType: selectedImageType`.
                // In `TMDbModals` line 71: `useState<'poster' | 'backdrop'>('poster')`. It didn't support 'custom' explicitly in state type there?
                // But Line 197 says `setSelectedImageType('backdrop')`.
                // So custom uploads were treated as backdrops.
                // In `TMDbActivityPage`, it explicitly supports 'custom'.
                // I should probably support 'custom' to be safe, loops back to 'backdrop' if needed.
                // Let's use 'custom' for uploaded files to distinguish them.
                setSelectedImageType('custom');
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

    const handleFetchImage = async (type: 'poster' | 'backdrop') => {
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
                imageType?: 'poster' | 'backdrop';
            }>(`/api/tmdb/images/${mediaType}/${tmdbId}?${query.toString()}`);

            if (result.success && result.data?.imageUrl) {
                setPreviewImageUrl(result.data.imageUrl);
                setSelectedImageType(result.data.imageType || type);
                haptics.light();
                toast.success(`${type} loaded - tap Save to apply`);
            } else {
                toast.error(result.error?.message || `No ${type} available`);
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

        if (!previewImageUrl) {
            toast.error('Please select an image first');
            return;
        }

        haptics.medium(); // Feedback immediately on click
        setIsSavingImage(true);

        try {
            // Note: onSave might be void or return a Promise. We handle both.
            await Promise.resolve(onSave(previewImageUrl, selectedImageType));

            // Standardized Feedback & Dismissal
            haptics.success();
            // Optional: You could pass a success message prop if needed, defaulting to 'Image saved'
            // But for now, we standardized on 'Image saved' based on user request.
            // If the parent wants to handle the toast, they can do so in onSave, but standardization suggests we do it here.
            // However, checking TMDbModals (Line 370) it says "Image saved".
            // TMDbActivityPage (Line 900) says "Image changed to [type]".
            // To be truly standard, we should pick one. "Image saved" is cleaner.
            // But if I put it here, I should remove it from parents.
            toast.success('Image saved');

            // Close immediately after save
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
        setPreviewImageUrl(null);
        setIsPreviewOpen(false);
        onOpenChange(false);
    };

    const previewImageType =
        selectedImageType === 'backdrop'
            ? 'backdrop'
            : currentImageType === 'backdrop'
                ? 'backdrop'
                : 'poster';

    return (
        <>
            <BottomSheet open={open} onOpenChange={(val) => !val && handleCancel()}>
                <BottomSheetHeader>
                    <BottomSheetTitle>Change Image ({title})</BottomSheetTitle>
                    <BottomSheetDescription>Tap to fetch a new image</BottomSheetDescription>
                </BottomSheetHeader>
                <BottomSheetBody>
                    <div className="flex gap-3">
                        {/* Poster Button */}
                        <button
                            onClick={() => handleFetchImage('poster')}
                            disabled={isFetchingImage || isSavingImage}
                            className={`flex-1 p-4 rounded-lg border-2 transition-all bg-white dark:bg-black 
                                ${selectedImageType === 'poster' && (previewImageUrl || isFetchingImage)
                                    ? 'border-[#ec1e24]'
                                    : 'border-gray-200 dark:border-[#333333]'
                                } 
                                active:border-[#ec1e24] 
                                disabled:opacity-50`}
                        >
                            {isFetchingImage && fetchingImageType === 'poster' ? (
                                <RedSpinner size="md" className="mx-auto mb-2" label="Loading poster image..." />
                            ) : (
                                <ImageIcon className="w-6 h-6 mx-auto mb-2" />
                            )}
                            <p className="text-sm">Poster</p>
                        </button>

                        {/* Backdrop Button */}
                        <button
                            onClick={() => handleFetchImage('backdrop')}
                            disabled={isFetchingImage || isSavingImage}
                            className={`flex-1 p-4 rounded-lg border-2 transition-all bg-white dark:bg-black 
                                ${selectedImageType === 'backdrop' && (previewImageUrl || isFetchingImage)
                                    ? 'border-[#ec1e24]'
                                    : 'border-gray-200 dark:border-[#333333]'
                                } 
                                active:border-[#ec1e24] 
                                disabled:opacity-50`}
                        >
                            {isFetchingImage && fetchingImageType === 'backdrop' ? (
                                <RedSpinner size="md" className="mx-auto mb-2" label="Loading backdrop image..." />
                            ) : (
                                <ImageIcon className="w-6 h-6 mx-auto mb-2" />
                            )}
                            <p className="text-sm">Backdrop</p>
                        </button>

                        {/* Upload Button */}
                        <button
                            onClick={handleSelectFile}
                            disabled={isFetchingImage || isSavingImage}
                            className={`flex-1 p-4 rounded-lg border-2 transition-all bg-white dark:bg-black 
                                ${selectedImageType === 'custom' && (previewImageUrl || isFetchingImage)
                                    ? 'border-[#ec1e24]'
                                    : 'border-gray-200 dark:border-[#333333]'
                                } 
                                active:border-[#ec1e24] 
                                disabled:opacity-50`}
                        >
                            {isFetchingImage && fetchingImageType === 'custom' ? (
                                <RedSpinner size="md" className="mx-auto mb-2" label="Loading uploaded image preview..." />
                            ) : (
                                <Upload className="w-6 h-6 mx-auto mb-2" />
                            )}
                            <p className="text-sm">Upload</p>
                        </button>

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
                    {previewImageUrl && (
                        <button
                            type="button"
                            onClick={() => {
                                haptics.light();
                                setIsPreviewOpen(true);
                            }}
                            className="mt-4 w-full rounded-lg overflow-hidden border-2 border-[#ec1e24] text-left transition-opacity hover:opacity-95"
                            aria-label={`Expand ${previewImageType} preview for ${title}`}
                        >
                            <img src={previewImageUrl} alt="Preview" className="w-full h-32 object-cover" />
                            <p className="text-xs text-center py-2 bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-[#9CA3AF]">Preview - tap to expand</p>
                        </button>
                    )}
                </BottomSheetBody>

                <BottomSheetFooter>
                    <Button variant="outline" onClick={handleCancel}>
                        Cancel
                    </Button>

                    <Button
                        onClick={handleSaveImage}
                        disabled={!previewImageUrl || isFetchingImage || isSavingImage}
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
                imageUrl={previewImageUrl}
                title={title}
                imageType={previewImageType}
            />
        </>
    );
}
