/**
 * Image Rotation Store
 * Tracks used images per TMDb item to prevent repetition
 * Images rotate through all available options before repeating
 */

const STORAGE_KEY = 'screndly_tmdb_image_rotation';

interface UsedImagesStore {
    [tmdbId: string]: {
        posters: string[];
        backdrops: string[];
        lastUpdated: number;
    };
}

/**
 * Load used images store from localStorage
 */
function loadStore(): UsedImagesStore {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (error) {
        console.error('[ImageRotationStore] Error loading store:', error);
    }
    return {};
}

/**
 * Save store to localStorage
 */
function saveStore(store: UsedImagesStore): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
        console.error('[ImageRotationStore] Error saving store:', error);
    }
}

/**
 * Mark an image as used for a TMDb item
 */
export function markImageUsed(tmdbId: number, imageUrl: string, type: 'poster' | 'backdrop'): void {
    const store = loadStore();
    const key = String(tmdbId);

    if (!store[key]) {
        store[key] = { posters: [], backdrops: [], lastUpdated: Date.now() };
    }

    const list = type === 'poster' ? store[key].posters : store[key].backdrops;

    // Only add if not already in the list
    if (!list.includes(imageUrl)) {
        list.push(imageUrl);
        store[key].lastUpdated = Date.now();
        saveStore(store);
    }
}

/**
 * Get used images for a TMDb item
 */
export function getUsedImages(tmdbId: number): { posters: string[]; backdrops: string[] } {
    const store = loadStore();
    const key = String(tmdbId);

    if (store[key]) {
        return {
            posters: store[key].posters || [],
            backdrops: store[key].backdrops || []
        };
    }

    return { posters: [], backdrops: [] };
}

/**
 * Reset used images for a TMDb item (start fresh rotation)
 */
export function resetUsedImages(tmdbId: number, type?: 'poster' | 'backdrop'): void {
    const store = loadStore();
    const key = String(tmdbId);

    if (store[key]) {
        if (type === 'poster') {
            store[key].posters = [];
        } else if (type === 'backdrop') {
            store[key].backdrops = [];
        } else {
            // Reset both
            store[key].posters = [];
            store[key].backdrops = [];
        }
        store[key].lastUpdated = Date.now();
        saveStore(store);
    }
}

/**
 * Check if all images of a type have been used (exhausted)
 */
export function isImageTypeExhausted(
    tmdbId: number,
    type: 'poster' | 'backdrop',
    totalAvailable: number
): boolean {
    const used = getUsedImages(tmdbId);
    const usedCount = type === 'poster' ? used.posters.length : used.backdrops.length;
    return usedCount >= totalAvailable;
}

/**
 * Get the next unused image from a list
 * Returns null if all images have been used (caller should reset)
 */
export function getNextUnusedImage(
    tmdbId: number,
    type: 'poster' | 'backdrop',
    availableImages: string[]
): string | null {
    const used = getUsedImages(tmdbId);
    const usedList = type === 'poster' ? used.posters : used.backdrops;

    // Find first image not in used list
    for (const image of availableImages) {
        if (!usedList.includes(image)) {
            return image;
        }
    }

    // All exhausted
    return null;
}

/**
 * Clean up old entries (older than 7 days)
 */
export function cleanupOldEntries(): void {
    const store = loadStore();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    let changed = false;

    for (const key of Object.keys(store)) {
        if (store[key].lastUpdated < sevenDaysAgo) {
            delete store[key];
            changed = true;
        }
    }

    if (changed) {
        saveStore(store);
    }
}
