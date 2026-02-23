/**
 * Image Selection Service
 * Handles poster/backdrop/random image selection with rotation
 * Enforces the global preferredImage setting
 */

import { getImagePreference, type ImagePreference } from './tmdbSettingsService';
import {
    markImageUsed,
    getNextUnusedImage,
    resetUsedImages,
    isImageTypeExhausted,
    getUsedImages
} from './imageRotationStore';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

export interface ImageSelection {
    url: string;
    type: 'poster' | 'backdrop';
    isCustomUpload: boolean;
}

/**
 * Select the appropriate image based on global settings and rotation
 * 
 * Modes:
 * - poster: Always use posters, never fallback to backdrop
 * - backdrop: Always use backdrops, never fallback to poster  
 * - random: Context-aware selection based on aspect ratio needs
 */
export function selectImageForPost(
    tmdbId: number,
    posters: string[],
    backdrops: string[],
    preferenceOverride?: ImagePreference
): ImageSelection | null {
    const preference = preferenceOverride || getImagePreference();

    switch (preference) {
        case 'poster':
            return selectPoster(tmdbId, posters);

        case 'backdrop':
            return selectBackdrop(tmdbId, backdrops);

        case 'random':
            return selectSmartRandom(tmdbId, posters, backdrops);

        default:
            return selectPoster(tmdbId, posters);
    }
}

/**
 * Select a poster image with rotation
 * Never falls back to backdrop
 */
function selectPoster(tmdbId: number, posters: string[]): ImageSelection | null {
    if (!posters || posters.length === 0) {
        return null; // No posters available, don't fallback
    }

    // Check if all posters exhausted
    if (isImageTypeExhausted(tmdbId, 'poster', posters.length)) {
        resetUsedImages(tmdbId, 'poster');
    }

    // Get next unused poster
    const nextPoster = getNextUnusedImage(tmdbId, 'poster', posters);

    if (nextPoster) {
        markImageUsed(tmdbId, nextPoster, 'poster');
        return {
            url: nextPoster.startsWith('http') ? nextPoster : `${TMDB_IMAGE_BASE}${nextPoster}`,
            type: 'poster',
            isCustomUpload: false
        };
    }

    // Fallback to first poster if something went wrong
    const firstPoster = posters[0];
    return {
        url: firstPoster.startsWith('http') ? firstPoster : `${TMDB_IMAGE_BASE}${firstPoster}`,
        type: 'poster',
        isCustomUpload: false
    };
}

/**
 * Select a backdrop image with rotation
 * Never falls back to poster
 */
function selectBackdrop(tmdbId: number, backdrops: string[]): ImageSelection | null {
    if (!backdrops || backdrops.length === 0) {
        return null; // No backdrops available, don't fallback
    }

    // Check if all backdrops exhausted
    if (isImageTypeExhausted(tmdbId, 'backdrop', backdrops.length)) {
        resetUsedImages(tmdbId, 'backdrop');
    }

    // Get next unused backdrop
    const nextBackdrop = getNextUnusedImage(tmdbId, 'backdrop', backdrops);

    if (nextBackdrop) {
        markImageUsed(tmdbId, nextBackdrop, 'backdrop');
        return {
            url: nextBackdrop.startsWith('http') ? nextBackdrop : `${TMDB_IMAGE_BASE}${nextBackdrop}`,
            type: 'backdrop',
            isCustomUpload: false
        };
    }

    // Fallback to first backdrop if something went wrong
    const firstBackdrop = backdrops[0];
    return {
        url: firstBackdrop.startsWith('http') ? firstBackdrop : `${TMDB_IMAGE_BASE}${firstBackdrop}`,
        type: 'backdrop',
        isCustomUpload: false
    };
}

/**
 * Smart random selection based on context
 * - For landscape-oriented platforms (YouTube, etc): prefer backdrop
 * - For portrait/square platforms (Instagram, Pinterest): prefer poster
 * - Alternates between types to provide variety
 */
function selectSmartRandom(
    tmdbId: number,
    posters: string[],
    backdrops: string[]
): ImageSelection | null {
    const hasPosters = posters && posters.length > 0;
    const hasBackdrops = backdrops && backdrops.length > 0;

    if (!hasPosters && !hasBackdrops) {
        return null;
    }

    if (!hasPosters) {
        return selectBackdrop(tmdbId, backdrops);
    }

    if (!hasBackdrops) {
        return selectPoster(tmdbId, posters);
    }

    // Both available - use smart alternation
    // Check which type has more unused images proportionally
    const posterUsedRatio = getUsedRatio(tmdbId, 'poster', posters.length);
    const backdropUsedRatio = getUsedRatio(tmdbId, 'backdrop', backdrops.length);

    // Prefer the type with lower usage ratio (more fresh options)
    if (posterUsedRatio <= backdropUsedRatio) {
        return selectPoster(tmdbId, posters);
    } else {
        return selectBackdrop(tmdbId, backdrops);
    }
}

/**
 * Get the ratio of used images (0.0 to 1.0)
 */
function getUsedRatio(tmdbId: number, type: 'poster' | 'backdrop', total: number): number {
    if (total === 0) return 1.0;

    const usedImages = getUsedImages(tmdbId);
    const used = type === 'poster' ? usedImages.posters.length : usedImages.backdrops.length;

    return used / total;
}

/**
 * Switch to a new image of the specified type
 * Used when user clicks "Change Image" button
 * Always returns a DIFFERENT image than currently shown
 */
export function switchToNewImage(
    tmdbId: number,
    currentImageUrl: string,
    targetType: 'poster' | 'backdrop',
    availableImages: string[]
): ImageSelection | null {
    if (!availableImages || availableImages.length === 0) {
        return null;
    }

    // Mark current image as used if not already
    markImageUsed(tmdbId, currentImageUrl, targetType);

    // Check if exhausted
    if (isImageTypeExhausted(tmdbId, targetType, availableImages.length)) {
        // Reset and start over, but skip the current image
        resetUsedImages(tmdbId, targetType);
        markImageUsed(tmdbId, currentImageUrl, targetType);
    }

    // Get next unused
    const nextImage = getNextUnusedImage(tmdbId, targetType, availableImages);

    if (nextImage) {
        markImageUsed(tmdbId, nextImage, targetType);
        return {
            url: nextImage.startsWith('http') ? nextImage : `${TMDB_IMAGE_BASE}${nextImage}`,
            type: targetType,
            isCustomUpload: false
        };
    }

    return null;
}

/**
 * Create an image selection for a custom uploaded image
 */
export function createCustomImageSelection(uploadedUrl: string): ImageSelection {
    return {
        url: uploadedUrl,
        type: 'poster', // Custom uploads are treated as poster-style
        isCustomUpload: true
    };
}
