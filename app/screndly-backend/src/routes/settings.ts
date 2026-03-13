import { Router } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { encrypt, decrypt } from '../lib/encryption';
import { notificationService } from '../services/notification.service';

const router = Router();

// Validation Schema for Settings Update
const settingsSchema = z.object({
    // Add specific validations as needed, using record/any for flexibility initially
    // checking against known keys would be better but the settings object is huge
}).passthrough();

// SENSITIVE KEYS LIST
// These keys will be masked on GET and Encrypted on PUT
const SENSITIVE_KEYS = [
    'youtubeKey', 'openaiKey', 'serperKey', 'tmdbKey', 'flash3Key',
    'googleVideoIntelligenceKey', 'shotstackKey', 's3Key',
    'backblazeKeyId', 'backblazeApplicationKey',
    'backblazeVideosKeyId', 'backblazeVideosApplicationKey',
    'backblazeDesignKeyId', 'backblazeDesignApplicationKey',
    'videoGoogleSearchApiKey', 'photopeaApiKey',
    'commentGoogleSearchApiKey'
];

// Mask string for UI
const MASK_STRING = '••••••••••••••••';

const SETTING_LABEL_OVERRIDES: Record<string, string> = {
    fetchInterval: 'Polling interval',
    postInterval: 'Post interval',
    advancedFilters: 'Trailer keywords',
    regionFilter: 'Region filter',
    videoAgeGateHours: 'Upload age gate',
    videoBacklogMode: 'Backlog mode',
    videoFutureOnlySince: 'Future-only cutoff',
    excludeShorts: 'Exclude Shorts',
    videoOpenaiModel: 'Caption model',
    videoYoutubeSelectedPlaylists: 'YouTube playlists',
    rssCaptionPrompt: 'Caption prompt',
    rssCaptionModel: 'Caption model',
    rssCaptionTone: 'Caption tone',
    rssCaptionMaxLength: 'Max caption length',
    rssPostingInterval: 'Posting interval',
    rssEventDrivenPosting: 'Event-driven posting',
    rssImageCount: 'Image count',
    rssFetchInterval: 'Fetch interval',
    rssDeduplication: 'Deduplication',
    rssLogLevel: 'Log level',
    tmdbCaptionModel: 'Caption model',
    todayPrompt: 'Today prompt',
    weeklyPrompt: 'Weekly prompt',
    monthlyPrompt: 'Monthly prompt',
    anniversaryPrompt: 'Anniversary prompt',
    captionPosterPrompt: 'Poster caption prompt',
    captionCarouselPrompt: 'Carousel caption prompt',
    captionStoryPrompt: 'Story caption prompt',
    captionAnnouncementPrompt: 'Announcement caption prompt',
    captionGeneralPrompt: 'General caption prompt',
    systemPrompt: 'System prompt',
    captionReviewPrompt: 'Review prompt',
    captionReleasesPrompt: 'Releases prompt',
    captionScenesPrompt: 'Scenes prompt',
    composeDefaultScheduleTime: 'Default schedule time',
    composeActivityRetention: 'Activity retention',
    cleanupEnabled: 'Auto cleanup',
    cleanupInterval: 'Cleanup interval',
    storageRetention: 'Storage retention',
    videoCleanupInterval: 'Video cleanup interval',
    videoStorageRetention: 'Video storage retention',
    imageCleanupInterval: 'Image cleanup interval',
    imageStorageRetention: 'Image storage retention',
    videoStudioCleanupInterval: 'Video Studio cleanup interval',
    videoStudioStorageRetention: 'Video Studio storage retention',
    logsRetention: 'Log retention',
    recentActivityRetention: 'Recent activity retention',
    darkMode: 'Dark mode',
    hapticsEnabled: 'Haptics',
    emailNotifications: 'Email notifications',
    pushNotifications: 'Push notifications',
    desktopNotifications: 'Desktop notifications',
};

function humanizeSettingKey(key: string): string {
    if (SETTING_LABEL_OVERRIDES[key]) {
        return SETTING_LABEL_OVERRIDES[key];
    }

    return key
        .replace(/_/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\bapi\b/gi, 'API')
        .replace(/\brss\b/gi, 'RSS')
        .replace(/\btmdb\b/gi, 'TMDb')
        .replace(/\bpsd\b/gi, 'PSD')
        .replace(/\bai\b/gi, 'AI')
        .replace(/\boauth\b/gi, 'OAuth')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSettingsSectionLabel(key: string): string {
    if (
        key.startsWith('rss')
        || key.startsWith('dailyQuota')
        || key.startsWith('quietHours')
        || key === 'globalRSSPosting'
        || key === 'postingInterval'
    ) {
        return 'RSS Feeds';
    }

    if (
        key.startsWith('tmdb')
        || key === 'todayPrompt'
        || key === 'weeklyPrompt'
        || key === 'monthlyPrompt'
        || key === 'anniversaryPrompt'
        || key.includes('Anniversary')
    ) {
        return 'TMDb Feeds';
    }

    if (
        key.startsWith('captionPoster')
        || key.startsWith('captionCarousel')
        || key.startsWith('captionStory')
        || key.startsWith('captionAnnouncement')
        || key.startsWith('captionGeneral')
        || key.startsWith('designStudio')
    ) {
        return 'Design Studio';
    }

    if (
        key === 'systemPrompt'
        || key.startsWith('captionReview')
        || key.startsWith('captionReleases')
        || key.startsWith('captionScenes')
        || key.startsWith('videoStudio')
    ) {
        return 'Video Studio';
    }

    if (
        key.startsWith('video')
        || key === 'fetchInterval'
        || key === 'postInterval'
        || key === 'advancedFilters'
        || key === 'regionFilter'
        || key === 'excludeShorts'
        || key.startsWith('thumbnailConfig_')
    ) {
        return 'Video';
    }

    if (key.startsWith('comment')) {
        return 'Comment Reply';
    }

    if (key.startsWith('compose')) {
        return 'Post';
    }

    if (
        key.startsWith('cleanup')
        || key.startsWith('videoCleanup')
        || key.startsWith('imageCleanup')
        || key.startsWith('videoStudioCleanup')
        || key.endsWith('StorageRetention')
        || key === 'storageRetention'
        || key === 'logsRetention'
        || key === 'recentActivityRetention'
    ) {
        return 'Cleanup';
    }

    if (key.startsWith('pad')) {
        return 'PAD';
    }

    if (
        key === 'darkMode'
        || key === 'hapticsEnabled'
        || key === 'emailNotifications'
        || key === 'pushNotifications'
        || key === 'desktopNotifications'
    ) {
        return 'Preferences';
    }

    if (SENSITIVE_KEYS.includes(key) || key.toLowerCase().includes('key') || key.toLowerCase().includes('token')) {
        return 'API Keys';
    }

    return 'Settings';
}

function normalizeStoredSettingValue(key: string, value: unknown): unknown {
    if (!SENSITIVE_KEYS.includes(key)) {
        return value ?? null;
    }

    if (typeof value !== 'string' || value.length === 0) {
        return value ?? null;
    }

    try {
        return decrypt(value);
    } catch {
        return value;
    }
}

function settingsValuesEqual(key: string, previousValue: unknown, nextValue: unknown): boolean {
    return JSON.stringify(normalizeStoredSettingValue(key, previousValue)) === JSON.stringify(nextValue ?? null);
}

function buildSettingsSaveSummary(changedKeys: string[]) {
    if (changedKeys.length === 0) {
        return null;
    }

    const grouped = new Map<string, string[]>();

    for (const key of changedKeys) {
        const section = getSettingsSectionLabel(key);
        const labels = grouped.get(section) ?? [];
        labels.push(humanizeSettingKey(key));
        grouped.set(section, labels);
    }

    if (changedKeys.length === 1) {
        const onlyKey = changedKeys[0];
        return {
            title: `${humanizeSettingKey(onlyKey)} saved`,
            message: `${getSettingsSectionLabel(onlyKey)} settings updated.`,
        };
    }

    if (grouped.size === 1) {
        const [section, labels] = Array.from(grouped.entries())[0];
        const visibleLabels = labels.slice(0, 4);
        const extraCount = labels.length - visibleLabels.length;
        return {
            title: `${section} settings saved`,
            message: `Updated ${visibleLabels.join(', ')}${extraCount > 0 ? `, and ${extraCount} more` : ''}.`,
        };
    }

    const sections = Array.from(grouped.entries()).slice(0, 3).map(([section, labels]) => {
        const visibleLabels = labels.slice(0, 3).join(', ');
        const extraCount = labels.length - Math.min(labels.length, 3);
        return `${section}: ${visibleLabels}${extraCount > 0 ? `, +${extraCount} more` : ''}`;
    });
    const extraSections = grouped.size - sections.length;

    return {
        title: 'Settings saved',
        message: `${sections.join('; ')}${extraSections > 0 ? `; +${extraSections} more section${extraSections > 1 ? 's' : ''}` : ''}.`,
    };
}

// GET /api/settings
// NOW PROTECTED WITH AUTH
router.get('/', authenticate, async (req, res) => {
    try {
        const allSettings = await prisma.setting.findMany();

        // Transform into a single object
        const settingsObject: Record<string, any> = {};
        allSettings.forEach(s => {
            // We store values encrypted in DB.
            // But for the frontend, we just want to know if they are set (masked)
            // OR if they are non-sensitive, return the value.
            // We COULD decrypt everything here, but best practice is to never send secrets to frontend.

            if (SENSITIVE_KEYS.includes(s.key)) {
                // Check if value exists and is not empty to show mask
                const valueStr = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
                settingsObject[s.key] = valueStr && valueStr.length > 0 ? MASK_STRING : '';
            } else {
                settingsObject[s.key] = s.value;
            }
        });

        res.json({ success: true, data: settingsObject });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to fetch settings' } });
    }
});

// PUT /api/settings
// NOW PROTECTED WITH AUTH
router.put('/', authenticate, async (req, res) => {
    try {
        const updates = req.body;
        const updateEntries = Object.entries(updates).filter(([_, value]) => !(typeof value === 'string' && value === MASK_STRING));
        const existingSettings = updateEntries.length > 0
            ? await prisma.setting.findMany({
                where: {
                    key: {
                        in: updateEntries.map(([key]) => key),
                    },
                },
            })
            : [];
        const existingSettingsByKey = new Map(existingSettings.map((setting) => [setting.key, setting.value]));
        const changedEntries = updateEntries.filter(([key, value]) => !settingsValuesEqual(key, existingSettingsByKey.get(key), value));

        const promises = changedEntries.map(async ([key, value]) => {
            // 1. Encrypt if sensitive
            let valueToSave = value;
            if (SENSITIVE_KEYS.includes(key) && typeof value === 'string' && value.length > 0) {
                valueToSave = encrypt(value);
            }

            // 3. Upsert
            return prisma.setting.upsert({
                where: { key },
                update: { value: valueToSave as any },
                create: { key, value: valueToSave as any }
            });
        });

        await Promise.all(promises);
        const saveSummary = buildSettingsSaveSummary(changedEntries.map(([key]) => key));

        if (saveSummary) {
            await notificationService.notifyUser({
                type: 'success',
                source: 'system',
                title: saveSummary.title,
                message: saveSummary.message,
            });
        }

        // Return updated settings (masked)
        // Re-fetch to be consistent
        const allSettings = await prisma.setting.findMany();
        const settingsObject: Record<string, any> = {};

        allSettings.forEach(s => {
            if (SENSITIVE_KEYS.includes(s.key)) {
                const valueStr = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
                settingsObject[s.key] = valueStr && valueStr.length > 0 ? MASK_STRING : '';
            } else {
                settingsObject[s.key] = s.value;
            }
        });

        res.json({
            success: true,
            data: settingsObject,
            meta: saveSummary
                ? {
                    changedKeys: changedEntries.map(([key]) => key),
                    notificationTitle: saveSummary.title,
                    notificationMessage: saveSummary.message,
                }
                : {
                    changedKeys: [],
                },
        });

    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ success: false, error: { message: 'Failed to update settings' } });
    }
});

export default router;
