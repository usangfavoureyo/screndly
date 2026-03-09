import { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Upload, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { haptics } from '../../utils/haptics';
import { toast } from "sonner";
import {
    BottomSheet,
    BottomSheetHeader,
    BottomSheetTitle,
    BottomSheetDescription,
    BottomSheetBody,
    BottomSheetFooter
} from '../ui/bottom-sheet';

interface ChangeImageBottomSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    mediaType: 'movie' | 'tv' | 'person';
    tmdbId: number;
    currentImageType?: 'poster' | 'backdrop' | 'custom';
    onSave: (imageUrl: string, imageType: 'poster' | 'backdrop' | 'custom') => Promise<void> | void;
}

export function ChangeImageBottomSheet({
    open,
    onOpenChange,
    title,
    mediaType,
    tmdbId,
    currentImageType = 'poster',
    onSave
}: ChangeImageBottomSheetProps) {
    const [selectedImageType, setSelectedImageType] = useState<'poster' | 'backdrop' | 'custom'>(currentImageType);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [isLoadingImage, setIsLoadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when opening
    useEffect(() => {
        if (open) {
            setSelectedImageType(currentImageType);
            setPreviewImageUrl(null);
        }
    }, [open, currentImageType]);

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

        setIsLoadingImage(true);
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
            setIsLoadingImage(false);
        };
        reader.onerror = () => {
            toast.error('Failed to read image file');
            setIsLoadingImage(false);
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const handleFetchImage = async (type: 'poster' | 'backdrop') => {
        haptics.selection();
        setSelectedImageType(type);
        setIsLoadingImage(true);

        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? 'https://screndly-production.up.railway.app' : 'http://localhost:3001');
            const response = await fetch(
                `${backendUrl}/api/tmdb/images/${mediaType}/${tmdbId}?type=${type}&random=${Date.now()}`
            );

            if (!response.ok) throw new Error('Failed to fetch image');

            const result = await response.json();

            if (result.success && result.data?.imageUrl) {
                setPreviewImageUrl(result.data.imageUrl);
                haptics.light();
                toast.success(`${type} loaded - tap Save to apply`);
            } else {
                toast.error(result.error?.message || `No ${type} available`);
            }
        } catch (error) {
            console.error('Error fetching image:', error);
            toast.error('Failed to fetch image');
        } finally {
            setIsLoadingImage(false);
        }
    };

    const handleSaveImage = async () => {
        // Prevent double saves
        if (isLoadingImage) return;

        if (!previewImageUrl) {
            toast.error('Please select an image first');
            return;
        }

        haptics.medium(); // Feedback immediately on click
        setIsLoadingImage(true);

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
                setIsLoadingImage(false);
            }
        }
    };

    const handleCancel = () => {
        haptics.light();
        setPreviewImageUrl(null);
        onOpenChange(false);
    };

    return (
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
                        disabled={isLoadingImage}
                        className={`flex-1 p-4 rounded-lg border-2 transition-all bg-white dark:bg-black 
                            ${selectedImageType === 'poster' && (previewImageUrl || isLoadingImage)
                                ? 'border-[#ec1e24]'
                                : 'border-gray-200 dark:border-[#333333]'
                            } 
                            active:border-[#ec1e24] 
                            disabled:opacity-50`}
                    >
                        {isLoadingImage && selectedImageType === 'poster' ? (
                            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-[#ec1e24]" />
                        ) : (
                            <ImageIcon className="w-6 h-6 mx-auto mb-2" />
                        )}
                        <p className="text-sm">{isLoadingImage && selectedImageType === 'poster' ? 'Loading...' : 'Poster'}</p>
                    </button>

                    {/* Backdrop Button */}
                    <button
                        onClick={() => handleFetchImage('backdrop')}
                        disabled={isLoadingImage}
                        className={`flex-1 p-4 rounded-lg border-2 transition-all bg-white dark:bg-black 
                            ${selectedImageType === 'backdrop' && (previewImageUrl || isLoadingImage)
                                ? 'border-[#ec1e24]'
                                : 'border-gray-200 dark:border-[#333333]'
                            } 
                            active:border-[#ec1e24] 
                            disabled:opacity-50`}
                    >
                        {isLoadingImage && selectedImageType === 'backdrop' ? (
                            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-[#ec1e24]" />
                        ) : (
                            <ImageIcon className="w-6 h-6 mx-auto mb-2" />
                        )}
                        <p className="text-sm">{isLoadingImage && selectedImageType === 'backdrop' ? 'Loading...' : 'Backdrop'}</p>
                    </button>

                    {/* Upload Button */}
                    <button
                        onClick={handleSelectFile}
                        disabled={isLoadingImage}
                        className={`flex-1 p-4 rounded-lg border-2 transition-all bg-white dark:bg-black 
                            ${selectedImageType === 'custom' && (previewImageUrl || isLoadingImage)
                                ? 'border-[#ec1e24]'
                                : 'border-gray-200 dark:border-[#333333]'
                            } 
                            active:border-[#ec1e24] 
                            disabled:opacity-50`}
                    >
                        <Upload className="w-6 h-6 mx-auto mb-2" />
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
                    <div className="mt-4 rounded-lg overflow-hidden border-2 border-[#ec1e24]">
                        <img src={previewImageUrl} alt="Preview" className="w-full h-32 object-cover" />
                        <p className="text-xs text-center py-2 bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-[#9CA3AF]">Preview - tap Save to apply</p>
                    </div>
                )}
            </BottomSheetBody>

            <BottomSheetFooter>
                <Button variant="outline" onClick={handleCancel}>
                    Cancel
                </Button>

                <Button
                    onClick={handleSaveImage}
                    disabled={!previewImageUrl || isLoadingImage}
                >
                    {isLoadingImage ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</>
                    ) : 'Save'}
                </Button>
            </BottomSheetFooter>
        </BottomSheet>
    );
}
