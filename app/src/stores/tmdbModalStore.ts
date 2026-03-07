import { create } from 'zustand';

/**
 * TMDb Modal Store
 * 
 * Centralized state for all TMDb-related modals.
 * This isolates modal state from feed cards, preventing re-renders
 * when modals open/close.
 */

export interface TMDbFeed {
    id: string;
    tmdbId: number;
    mediaType: 'movie' | 'tv';
    title: string;
    year: number;
    releaseDate: string;
    caption: string;
    imageUrl: string;
    imageType: 'poster' | 'backdrop';
    scheduledTime: string;
    source: 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary' | 'tmdb_today';
    cast: string[];
    popularity: number;
    cacheHit: boolean;
    platforms?: string[];
    status?: 'queued' | 'scheduled' | 'published' | 'failed';
    publishedTime?: string;
    errorMessage?: string;
}

interface ModalState {
    // Edit Caption Modal
    editCaptionModal: {
        open: boolean;
        feed: TMDbFeed | null;
    };

    // Change Image Modal
    changeImageModal: {
        open: boolean;
        feed: TMDbFeed | null;
    };

    // Reschedule Modal
    rescheduleModal: {
        open: boolean;
        feed: TMDbFeed | null;
    };

    // Delete Confirmation Modal
    deleteModal: {
        open: boolean;
        feed: TMDbFeed | null;
    };

    // Platform Select Modal
    platformSelectModal: {
        open: boolean;
        feed: TMDbFeed | null;
        isPostNow: boolean;
    };

    // Image Preview Modal
    imagePreviewModal: {
        open: boolean;
        feed: TMDbFeed | null;
    };
}

interface ModalActions {
    // Edit Caption
    openEditCaption: (feed: TMDbFeed) => void;
    closeEditCaption: () => void;

    // Change Image
    openChangeImage: (feed: TMDbFeed) => void;
    closeChangeImage: () => void;

    // Reschedule
    openReschedule: (feed: TMDbFeed) => void;
    closeReschedule: () => void;

    // Delete
    openDelete: (feed: TMDbFeed) => void;
    closeDelete: () => void;

    // Platform Select
    openPlatformSelect: (feed: TMDbFeed, isPostNow?: boolean) => void;
    closePlatformSelect: () => void;

    // Image Preview
    openImagePreview: (feed: TMDbFeed) => void;
    closeImagePreview: () => void;

    // Close all modals
    closeAll: () => void;
}

const initialState: ModalState = {
    editCaptionModal: { open: false, feed: null },
    changeImageModal: { open: false, feed: null },
    rescheduleModal: { open: false, feed: null },
    deleteModal: { open: false, feed: null },
    platformSelectModal: { open: false, feed: null, isPostNow: false },
    imagePreviewModal: { open: false, feed: null },
};

export const useTMDbModalStore = create<ModalState & ModalActions>((set) => ({
    ...initialState,

    // Edit Caption
    openEditCaption: (feed) => set({
        editCaptionModal: { open: true, feed }
    }),
    closeEditCaption: () => set({
        editCaptionModal: { open: false, feed: null }
    }),

    // Change Image
    openChangeImage: (feed) => set({
        changeImageModal: { open: true, feed }
    }),
    closeChangeImage: () => set({
        changeImageModal: { open: false, feed: null }
    }),

    // Reschedule
    openReschedule: (feed) => set({
        rescheduleModal: { open: true, feed }
    }),
    closeReschedule: () => set({
        rescheduleModal: { open: false, feed: null }
    }),

    // Delete
    openDelete: (feed) => set({
        deleteModal: { open: true, feed }
    }),
    closeDelete: () => set({
        deleteModal: { open: false, feed: null }
    }),

    // Platform Select
    openPlatformSelect: (feed, isPostNow = false) => set({
        platformSelectModal: { open: true, feed, isPostNow }
    }),
    closePlatformSelect: () => set({
        platformSelectModal: { open: false, feed: null, isPostNow: false }
    }),

    // Image Preview
    openImagePreview: (feed) => set({
        imagePreviewModal: { open: true, feed }
    }),
    closeImagePreview: () => set({
        imagePreviewModal: { open: false, feed: null }
    }),

    // Close all
    closeAll: () => set(initialState),
}));
