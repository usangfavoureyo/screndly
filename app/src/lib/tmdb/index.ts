/**
 * TMDb Library Exports
 * Centralized exports for all TMDb-related services
 */

// Settings service - single source of truth for TMDb configuration
export {
    getTMDbSettings,
    isFeedEnabled,
    getMaxItemsForFeed,
    getImagePreference,
    isAutoPostEnabled,
    getPlatformsForFeed,
    getEnabledPlatforms,
    getCaptionPrompt,
    getCaptionModel,
    getCaptionMaxLength,
    getSelectedGenres,
    getLanguageFilter,
    getMinPopularityThreshold,
    getDedupeWindow,
    getTimezone,
    getAnniversaryYears,
    getMaxPerAnniversary,
    getSettingsForBackend,
    type TMDbSettings,
    type FeedType,
    type ImagePreference,
    type PlatformFlags
} from './tmdbSettingsService';

// Image rotation store - tracks used images per TMDb item
export {
    markImageUsed,
    getUsedImages,
    resetUsedImages,
    isImageTypeExhausted,
    getNextUnusedImage,
    cleanupOldEntries
} from './imageRotationStore';

// Image selection service - handles poster/backdrop/random with rotation
export {
    selectImageForPost,
    switchToNewImage,
    createCustomImageSelection,
    type ImageSelection
} from './imageSelectionService';
