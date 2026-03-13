import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import prisma from '../lib/prisma';
import { refreshTMDbContent, isTMDbConfigured, getTMDbSettings, cleanupQueuedTMDbPosts } from './tmdb.service';
import { youtubePollerService } from './youtube-poller.service';
import { publisherService } from './publisher.service';
import { refreshAllFeeds } from './rss.service';
import { notificationService } from './notification.service';
import { commentsService } from './comments.service';
import { purgeExpiredNotifications } from './notification-retention.service';
import { deleteBackblazeFile, listBackblazeFiles, type BackblazeBucketType } from './backblaze';

const VIDEO_FILE_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']);
const IMAGE_FILE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);
const LOCAL_CLEANUP_DIRECTORIES = ['temp', 'uploads'];
const GLOBAL_CLEANUP_INTERVALS = new Set(['daily', 'weekly', 'monthly', 'never']);

const VIDEO_STORAGE_TARGETS: Array<{ bucketTypes: BackblazeBucketType[]; prefixes: string[] }> = [
    {
        bucketTypes: ['videos', 'general'],
        prefixes: ['youtube-poller/videos'],
    },
];

const IMAGE_STORAGE_TARGETS: Array<{ bucketTypes: BackblazeBucketType[]; prefixes: string[] }> = [
    {
        bucketTypes: ['general', 'design'],
        prefixes: ['social-publish/meta-images', 'rss/logo-cards', 'generated-thumbnails/'],
    },
];

const VIDEO_STUDIO_STORAGE_TARGETS: Array<{ bucketTypes: BackblazeBucketType[]; prefixes: string[] }> = [
    {
        bucketTypes: ['videos', 'general'],
        prefixes: ['video-studio/'],
    },
];

function parseBooleanSettingValue(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    if (value === null || value === undefined) {
        return fallback;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
        return false;
    }

    return fallback;
}

function parsePositiveIntSettingValue(value: unknown, fallback: number): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCleanupIntervalValue(value: unknown, fallback: string = 'daily'): 'daily' | 'weekly' | 'monthly' | 'never' {
    const normalized = String(value ?? fallback).trim().toLowerCase();
    if (GLOBAL_CLEANUP_INTERVALS.has(normalized)) {
        return normalized as 'daily' | 'weekly' | 'monthly' | 'never';
    }

    return fallback as 'daily' | 'weekly' | 'monthly' | 'never';
}

function shouldRunCleanupInterval(interval: 'daily' | 'weekly' | 'monthly' | 'never', now: Date): boolean {
    switch (interval) {
        case 'never':
            return false;
        case 'weekly':
            return now.getUTCDay() === 0;
        case 'monthly':
            return now.getUTCDate() === 1;
        default:
            return true;
    }
}

async function collectFilesRecursively(rootPath: string): Promise<string[]> {
    try {
        const entries = await fs.readdir(rootPath, { withFileTypes: true });
        const nested = await Promise.all(entries.map(async (entry) => {
            const entryPath = path.join(rootPath, entry.name);
            if (entry.isDirectory()) {
                return collectFilesRecursively(entryPath);
            }

            return [entryPath];
        }));

        return nested.flat();
    } catch {
        return [];
    }
}

async function cleanupLocalFilesByExtension(
    rootDirectories: string[],
    cutoff: Date,
    allowedExtensions: Set<string>
): Promise<number> {
    let deletedCount = 0;

    for (const directory of rootDirectories) {
        const absoluteRoot = path.join(process.cwd(), directory);
        const files = await collectFilesRecursively(absoluteRoot);

        for (const filePath of files) {
            const extension = path.extname(filePath).toLowerCase();
            if (!allowedExtensions.has(extension)) {
                continue;
            }

            try {
                const stats = await fs.stat(filePath);
                if (!stats.isFile() || stats.mtime >= cutoff) {
                    continue;
                }

                await fs.unlink(filePath);
                deletedCount += 1;
            } catch (error) {
                console.warn(`[CRON] Failed to delete local file "${filePath}":`, error);
            }
        }
    }

    return deletedCount;
}

async function cleanupBackblazeTargets(
    targets: Array<{ bucketTypes: BackblazeBucketType[]; prefixes: string[] }>,
    cutoff: Date
): Promise<number> {
    let deletedCount = 0;

    for (const target of targets) {
        for (const bucketType of target.bucketTypes) {
            for (const prefix of target.prefixes) {
                try {
                    const files = await listBackblazeFiles(bucketType, {
                        prefix,
                        maxFileCount: 1000,
                    });

                    for (const file of files) {
                        if (file.lastModified >= cutoff) {
                            continue;
                        }

                        await deleteBackblazeFile(bucketType, file);
                        deletedCount += 1;
                    }
                } catch (error) {
                    console.warn(`[CRON] Failed to clean Backblaze prefix "${prefix}" in bucket "${bucketType}":`, error);
                }
            }
        }
    }

    return deletedCount;
}

// Log helper
async function logCron(level: string, message: string, service: string = 'cron') {
    console.log(`[CRON] ${message}`);
    try {
        await prisma.log.create({
            data: { level, message, service }
        });
    } catch (err) {
        console.error('Failed to log to DB:', err);
    }
}

function quoteItem(value: string): string {
    return `"${value.replace(/\s+/g, ' ').trim()}"`;
}

function formatHighlightedTitles(titles: string[], max = 3): string {
    const normalized = titles
        .map((title) => title?.trim())
        .filter((title): title is string => Boolean(title));

    if (normalized.length === 0) {
        return '';
    }

    const visible = normalized.slice(0, max).map(quoteItem);
    const extraCount = normalized.length - visible.length;
    return `${visible.join(', ')}${extraCount > 0 ? `, and ${extraCount} more` : ''}`;
}

function buildTmdbRefreshNotification(
    label: string,
    result: { added: number; addedTitles?: string[] }
): { title: string; message: string } {
    const highlightedTitles = formatHighlightedTitles(result.addedTitles || []);

    if (result.added === 1 && result.addedTitles?.[0]) {
        return {
            title: `${label}: ${result.addedTitles[0]}`,
            message: `${quoteItem(result.addedTitles[0])} was added to the ${label.toLowerCase()} queue.`,
        };
    }

    return {
        title: label,
        message: highlightedTitles
            ? `Added ${result.added} items: ${highlightedTitles}.`
            : `Added ${result.added} new items.`,
    };
}

function buildRssSuccessNotification(results: Array<{ feedName: string; itemsAdded: number; latestItemTitle?: string }>) {
    const successfulFeeds = results.filter((result) => result.itemsAdded > 0);
    const totalItems = successfulFeeds.reduce((sum, result) => sum + result.itemsAdded, 0);

    if (successfulFeeds.length === 0 || totalItems === 0) {
        return null;
    }

    if (successfulFeeds.length === 1) {
        const [feed] = successfulFeeds;
        if (feed.latestItemTitle) {
            return {
                title: `RSS: ${feed.feedName}`,
                message: `Published ${quoteItem(feed.latestItemTitle)} from ${feed.feedName}.`,
            };
        }

        return {
            title: `RSS: ${feed.feedName}`,
            message: `Published ${feed.itemsAdded} new item${feed.itemsAdded === 1 ? '' : 's'} from ${feed.feedName}.`,
        };
    }

    const feedHighlights = successfulFeeds.slice(0, 3).map((feed) => (
        feed.latestItemTitle
            ? `${feed.feedName}: ${quoteItem(feed.latestItemTitle)}`
            : `${feed.feedName}: ${feed.itemsAdded} item${feed.itemsAdded === 1 ? '' : 's'}`
    ));
    const extraFeeds = successfulFeeds.length - Math.min(successfulFeeds.length, 3);

    return {
        title: 'RSS Feed Updates',
        message: `Published ${totalItems} item${totalItems === 1 ? '' : 's'}. ${feedHighlights.join('; ')}${extraFeeds > 0 ? `; +${extraFeeds} more feed${extraFeeds === 1 ? '' : 's'}` : ''}.`,
    };
}

function buildRssFailureNotification(results: Array<{ feedName: string; error?: string }>) {
    const failedFeeds = results.filter((result) => Boolean(result.error));
    if (failedFeeds.length === 0) {
        return null;
    }

    const highlights = failedFeeds.slice(0, 3).map((feed) => `${feed.feedName}: ${feed.error}`);
    const extraFeeds = failedFeeds.length - Math.min(failedFeeds.length, 3);

    return {
        title: failedFeeds.length === 1 ? `RSS Refresh Error: ${failedFeeds[0].feedName}` : 'RSS Refresh Errors',
        message: `${highlights.join('; ')}${extraFeeds > 0 ? `; +${extraFeeds} more feed${extraFeeds === 1 ? '' : 's'}` : ''}.`,
    };
}

export async function initCronJobs() {
    console.log('🕐 Initializing Cron Jobs...');

    // 1. Fetch System Settings (Timezone)
    let timezone = 'UTC';
    try {
        const setting = await prisma.setting.findUnique({ where: { key: 'timezone' } });
        if (setting?.value && typeof setting.value === 'string') {
            timezone = setting.value;
            console.log(`[CRON] Using Timezone: ${timezone}`);
        }
    } catch (e) {
        console.warn('[CRON] Failed to fetch timezone, defaulting to UTC');
    }

    const cronOptions = {
        timezone
    };

    // TMDb Today Refresh - Daily at 06:00
    cron.schedule('0 6 * * *', async () => {
        await logCron('info', 'Starting TMDb Today refresh...');
        try {
            const configured = await isTMDbConfigured();
            if (!configured) {
                await logCron('warn', 'TMDb API key not configured, skipping refresh');
                return;
            }

            const settings = await getTMDbSettings();
            if (!settings.enableToday) {
                await logCron('info', 'TMDb Today refresh is disabled in settings, skipping.');
                return;
            }

            // Run ONLY Today refresh
            const result = await refreshTMDbContent({
                ...settings,
                enableToday: true,
                enableWeekly: false,
                enableMonthly: false,
                enableAnniversaries: false
            });

            await logCron('info', `TMDb Today refresh completed: ${result.added} posts added`);

            // NOTIFY: Success
            if (result.added > 0) {
                const notification = buildTmdbRefreshNotification('TMDb Today Refresh', result);
                await notificationService.notifyUser({
                    title: notification.title,
                    message: notification.message,
                    type: 'success',
                    source: 'tmdb',
                    actionPage: '/tmdb-feeds'
                });
            }

            if (result.errors.length > 0) {
                await logCron('warn', `TMDb refresh had errors: ${result.errors.join(', ')}`);
                // NOTIFY: Error
                await notificationService.notifyUser({
                    title: 'TMDb Today Errors',
                    message: `Encountered ${result.errors.length} errors during refresh.`,
                    type: 'warning',
                    source: 'tmdb',
                    actionPage: '/logs'
                });
            }
        } catch (error) {
            await logCron('error', `TMDb Today refresh failed: ${error}`);
            await notificationService.notifyUser({
                title: 'TMDb Refresh Failed',
                message: 'Daily refresh cycle failed to execute.',
                type: 'error',
                source: 'tmdb',
                actionPage: '/settings'
            });
        }
    }, cronOptions);

    // TMDb Weekly Refresh - Daily at 08:00
    cron.schedule('0 8 * * *', async () => {
        await logCron('info', 'Starting TMDb Weekly refresh...');
        try {
            const configured = await isTMDbConfigured();
            if (!configured) return;

            const settings = await getTMDbSettings();
            if (!settings.enableWeekly) {
                await logCron('info', 'TMDb Weekly refresh is disabled in settings, skipping.');
                return;
            }

            const result = await refreshTMDbContent({
                ...settings,
                enableToday: false,
                enableWeekly: true,
                enableMonthly: false,
                enableAnniversaries: false
            });

            await logCron('info', `TMDb Weekly refresh completed: ${result.added} posts added`);

            if (result.added > 0) {
                const notification = buildTmdbRefreshNotification('TMDb Weekly Refresh', result);
                await notificationService.notifyUser({
                    title: notification.title,
                    message: notification.message,
                    type: 'success',
                    source: 'tmdb',
                    actionPage: '/tmdb-feeds'
                });
            }
        } catch (error) {
            await logCron('error', `TMDb Weekly refresh failed: ${error}`);
        }
    }, cronOptions);

    // TMDb Monthly Refresh - Daily at 09:00
    cron.schedule('0 9 * * *', async () => {
        await logCron('info', 'Starting TMDb Monthly refresh...');
        try {
            const configured = await isTMDbConfigured();
            if (!configured) return;

            const settings = await getTMDbSettings();
            if (!settings.enableMonthly) {
                await logCron('info', 'TMDb Monthly refresh is disabled in settings, skipping.');
                return;
            }

            const result = await refreshTMDbContent({
                ...settings,
                enableToday: false,
                enableWeekly: false,
                enableMonthly: true,
                enableAnniversaries: false
            });

            await logCron('info', `TMDb Monthly refresh completed: ${result.added} posts added`);

            if (result.added > 0) {
                const notification = buildTmdbRefreshNotification('TMDb Monthly Refresh', result);
                await notificationService.notifyUser({
                    title: notification.title,
                    message: notification.message,
                    type: 'success',
                    source: 'tmdb',
                    actionPage: '/tmdb-feeds'
                });
            }
        } catch (error) {
            await logCron('error', `TMDb Monthly refresh failed: ${error}`);
        }
    }, cronOptions);

    // TMDb Anniversary Refresh - Daily at 07:00
    cron.schedule('0 7 * * *', async () => {
        await logCron('info', 'Starting TMDb Anniversary refresh...');
        try {
            const configured = await isTMDbConfigured();
            if (!configured) return;

            const settings = await getTMDbSettings();
            if (!settings.enableAnniversaries) {
                await logCron('info', 'TMDb Anniversary refresh is disabled in settings, skipping.');
                return;
            }

            const result = await refreshTMDbContent({
                ...settings,
                enableToday: false,
                enableWeekly: false,
                enableMonthly: false,
                enableAnniversaries: true
            });

            await logCron('info', `TMDb Anniversary refresh completed: ${result.added} posts added`);

            if (result.added > 0) {
                const notification = buildTmdbRefreshNotification('TMDb Anniversary Refresh', result);
                await notificationService.notifyUser({
                    title: notification.title,
                    message: notification.message,
                    type: 'success',
                    source: 'tmdb',
                    actionPage: '/tmdb-feeds'
                });
            }
        } catch (error) {
            await logCron('error', `TMDb Anniversary refresh failed: ${error}`);
        }
    }, cronOptions);

    // YouTube Polling - Every 2 minutes
    cron.schedule('*/2 * * * *', async () => {
        try {
            await youtubePollerService.pollChannels();
        } catch (error) {
            await logCron('error', `YouTube polling cycle failed: ${error}`);
        }
    }, cronOptions);

    // RSS Feed Refresh - Every minute (master tick for per-feed intervals)
    cron.schedule('* * * * *', async () => {
        try {
            const result = await refreshAllFeeds(true);

            if (result.results.length > 0) {
                const added = result.results.reduce((acc, r) => acc + r.itemsAdded, 0);
                if (added > 0) {
                    const notification = buildRssSuccessNotification(result.results);
                    await logCron('info', `RSS scheduled refresh: ${added} new items from ${result.results.length} feeds checked.`);
                    if (notification) {
                        await notificationService.notifyUser({
                            title: notification.title,
                            message: notification.message,
                            type: 'info',
                            source: 'rss',
                            actionPage: '/rss-feeds'
                        });
                    }
                }
            }

            if (result.failed > 0) {
                const failedFeeds = result.results.filter(r => r.error).map(r => `${r.feedName}: ${r.error}`).join(', ');
                const notification = buildRssFailureNotification(result.results);
                await logCron('warn', `RSS scheduled refresh errors: ${failedFeeds}`);
                if (notification) {
                    await notificationService.notifyUser({
                        title: notification.title,
                        message: notification.message,
                        type: 'warning',
                        source: 'rss',
                        actionPage: '/rss-feeds'
                    });
                }
            }
        } catch (error) {
            await logCron('error', `RSS Feed refresh failed: ${error}`);
        }
    }, cronOptions);

    // Post Scheduler - Every 1 minute
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const postsToPublish = await prisma.tMDbPost.findMany({
                where: {
                    status: 'scheduled',
                    scheduledTime: { lte: now }
                },
                orderBy: {
                    scheduledTime: 'asc',
                },
                take: 5
            });

            if (postsToPublish.length === 0) return;

            await logCron('info', `Found ${postsToPublish.length} posts to publish`);

            for (const post of postsToPublish) {
                try {
                    const platforms = post.platforms || [];
                    if (platforms.length === 0) {
                        await logCron('warn', `Post ${post.id} has no target platforms, marking skipped`);
                        await prisma.tMDbPost.update({
                            where: { id: post.id },
                            data: {
                                status: 'failed',
                                errorMessage: 'No target platforms configured for this TMDb post'
                            }
                        });
                        continue;
                    }

                    const content = {
                        text: post.caption || post.title,
                        title: post.title,
                        imageUrl: post.imageUrl || undefined
                    };

                    const results = await publisherService.publish(platforms, content);
                    const success = results.some(r => r.status === 'posted');
                    const failureMessage = results
                        .filter(r => r.status !== 'posted')
                        .map(r => `${r.platform}: ${r.error || 'Publish failed'}`)
                        .join(', ');

                    await prisma.tMDbPost.update({
                        where: { id: post.id },
                        data: {
                            status: success ? 'published' : 'failed',
                            publishedTime: now,
                            errorMessage: success ? null : (failureMessage || 'Failed to publish TMDb post'),
                        }
                    });

                    if (success) {
                        await logCron('info', `Successfully published post: ${post.title}`);
                    } else {
                        const errors = results.map(r => `${r.platform}: ${r.error}`).join(', ');
                        await logCron('error', `Failed to publish post ${post.title}: ${errors}`);

                        await notificationService.notifyUser({
                            title: 'Auto-Post Failed',
                            message: `Failed to publish "${post.title}". Check logs.`,
                            type: 'error',
                            source: 'tmdb',
                            actionPage: '/tmdb-feeds'
                        });
                    }

                } catch (postError) {
                    console.error(`Failed to process post ${post.id}`, postError);
                    await prisma.tMDbPost.update({
                        where: { id: post.id },
                        data: {
                            status: 'failed',
                            errorMessage: postError instanceof Error ? postError.message : 'Failed to process TMDb post'
                        }
                    });
                    await logCron('error', `Error processing post ${post.title}: ${postError}`);
                }
            }
        } catch (error) {
            await logCron('error', `Post scheduler failed: ${error}`);
        }
    }, cronOptions);

    // Comment Processing - Every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
        try {
            // 1. Poll (Ingest) new comments (Mock/Stub for now, or real if adapters exist)
            await commentsService.pollComments();

            // 2. Process (Reply) to pending comments
            await commentsService.processUnrepliedComments();
        } catch (error) {
            await logCron('error', `Comment processing failed: ${error}`);
        }
    }, cronOptions);

    // TMDb queued item cleanup - Every hour
    cron.schedule('0 * * * *', async () => {
        try {
            const settings = await getTMDbSettings();
            const deletedCount = await cleanupQueuedTMDbPosts(settings.tmdbQueuedRetentionHours || 168);

            if (deletedCount > 0) {
                await logCron('info', `Deleted ${deletedCount} stale queued TMDb posts`);
            }
        } catch (error) {
            await logCron('error', `TMDb queued cleanup failed: ${error}`);
        }
    }, cronOptions);

    // Cleanup - Daily at 03:00 UTC
    cron.schedule('0 3 * * *', async () => {
        await logCron('info', 'Running cleanup tasks...');
        try {
            const now = new Date();
            const keys = [
                'cleanupEnabled',
                'cleanupInterval',
                'storageRetention',
                'videoCleanupInterval',
                'videoStorageRetention',
                'imageCleanupInterval',
                'imageStorageRetention',
                'videoStudioCleanupInterval',
                'videoStudioStorageRetention',
                'logsRetention',
                'recentActivityRetention',
                'retentionDays',
                'commentRetention',
                'rssActivityRetention',
                'videoActivityRetention',
                'designStudioActivityRetention',
                'videoStudioActivityRetention',
                'tmdbActivityRetention',
            ];
            const settings = await prisma.setting.findMany({
                where: { key: { in: keys } },
                select: { key: true, value: true },
            });
            const settingsMap = new Map(settings.map((setting) => [setting.key, setting.value]));

            const cleanupEnabled = parseBooleanSettingValue(settingsMap.get('cleanupEnabled'), true);
            if (!cleanupEnabled) {
                await logCron('info', 'Cleanup skipped because Auto Cleanup is disabled.');
                return;
            }

            const globalCleanupInterval = parseCleanupIntervalValue(settingsMap.get('cleanupInterval'), 'daily');
            const globalStorageRetentionHours = parsePositiveIntSettingValue(settingsMap.get('storageRetention'), 48);
            const legacyLogRetentionHours = parsePositiveIntSettingValue(settingsMap.get('retentionDays'), 7) * 24;
            const recentActivityRetentionHours = parsePositiveIntSettingValue(settingsMap.get('recentActivityRetention'), 24);

            const logsRetentionHours = parsePositiveIntSettingValue(
                settingsMap.get('logsRetention'),
                legacyLogRetentionHours
            );
            const commentRetentionHours = parsePositiveIntSettingValue(settingsMap.get('commentRetention'), 168);
            const rssActivityRetentionHours = parsePositiveIntSettingValue(
                settingsMap.get('rssActivityRetention'),
                recentActivityRetentionHours
            );
            const designStudioActivityRetentionHours = parsePositiveIntSettingValue(
                settingsMap.get('designStudioActivityRetention'),
                recentActivityRetentionHours
            );
            const videoStudioActivityRetentionHours = parsePositiveIntSettingValue(
                settingsMap.get('videoStudioActivityRetention'),
                recentActivityRetentionHours
            );
            const tmdbActivityRetentionHours = parsePositiveIntSettingValue(
                settingsMap.get('tmdbActivityRetention'),
                recentActivityRetentionHours
            );

            const videoCleanupInterval = parseCleanupIntervalValue(
                settingsMap.get('videoCleanupInterval'),
                globalCleanupInterval
            );
            const imageCleanupInterval = parseCleanupIntervalValue(
                settingsMap.get('imageCleanupInterval'),
                globalCleanupInterval
            );
            const videoStudioCleanupInterval = parseCleanupIntervalValue(
                settingsMap.get('videoStudioCleanupInterval'),
                globalCleanupInterval
            );

            const videoStorageRetentionHours = parsePositiveIntSettingValue(
                settingsMap.get('videoStorageRetention'),
                globalStorageRetentionHours
            );
            const imageStorageRetentionHours = parsePositiveIntSettingValue(
                settingsMap.get('imageStorageRetention'),
                globalStorageRetentionHours
            );
            const videoStudioStorageRetentionHours = parsePositiveIntSettingValue(
                settingsMap.get('videoStudioStorageRetention'),
                globalStorageRetentionHours
            );

            let logsDeleted = 0;
            if (shouldRunCleanupInterval(globalCleanupInterval, now)) {
                const logCutoff = new Date(now.getTime() - logsRetentionHours * 60 * 60 * 1000);
                const logDeletion = await prisma.log.deleteMany({
                    where: { createdAt: { lt: logCutoff } },
                });
                logsDeleted = logDeletion.count;
            }

            const notifsDeleted = await purgeExpiredNotifications(now);

            let commentsDeleted = 0;
            let rssActivityDeleted = 0;
            let designStudioDeleted = 0;
            let videoStudioDeleted = 0;
            let tmdbActivityDeleted = 0;

            if (shouldRunCleanupInterval(globalCleanupInterval, now)) {
                const commentCutoff = new Date(now.getTime() - commentRetentionHours * 60 * 60 * 1000);
                const rssActivityCutoff = new Date(now.getTime() - rssActivityRetentionHours * 60 * 60 * 1000);
                const designStudioCutoff = new Date(now.getTime() - designStudioActivityRetentionHours * 60 * 60 * 1000);
                const videoStudioCutoff = new Date(now.getTime() - videoStudioActivityRetentionHours * 60 * 60 * 1000);
                const tmdbActivityCutoff = new Date(now.getTime() - tmdbActivityRetentionHours * 60 * 60 * 1000);

                const commentsDeletion = await prisma.comment.deleteMany({
                    where: {
                        processed: true,
                        updatedAt: { lt: commentCutoff },
                    },
                });
                commentsDeleted = commentsDeletion.count;

                const designStudioDeletion = await prisma.designStudioActivity.deleteMany({
                    where: { createdAt: { lt: designStudioCutoff } },
                });
                designStudioDeleted = designStudioDeletion.count;

                const videoStudioDeletion = await prisma.videoStudioActivity.deleteMany({
                    where: {
                        status: { in: ['completed', 'failed'] },
                        updatedAt: { lt: videoStudioCutoff },
                    },
                });
                videoStudioDeleted = videoStudioDeletion.count;

                const tmdbPublishedDeleted = await prisma.tMDbPost.deleteMany({
                    where: {
                        status: 'published',
                        publishedTime: { lt: tmdbActivityCutoff },
                    },
                });

                const tmdbFailedDeleted = await prisma.tMDbPost.deleteMany({
                    where: {
                        status: 'failed',
                        updatedAt: { lt: tmdbActivityCutoff },
                    },
                });
                tmdbActivityDeleted = tmdbPublishedDeleted.count + tmdbFailedDeleted.count;

                try {
                    rssActivityDeleted = Number(
                        await prisma.$executeRaw`
                            DELETE FROM "Log"
                            WHERE service = 'rss'
                              AND "createdAt" < ${rssActivityCutoff}
                              AND metadata IS NOT NULL
                              AND metadata->>'category' = 'rss_activity'
                        `
                    );
                } catch (rssCleanupError) {
                    console.error('[CRON] Failed to clean RSS activity logs:', rssCleanupError);
                }
            }

            let localVideosDeleted = 0;
            let remoteVideosDeleted = 0;
            if (shouldRunCleanupInterval(videoCleanupInterval, now)) {
                const videoCutoff = new Date(now.getTime() - videoStorageRetentionHours * 60 * 60 * 1000);
                localVideosDeleted = await cleanupLocalFilesByExtension(
                    LOCAL_CLEANUP_DIRECTORIES,
                    videoCutoff,
                    VIDEO_FILE_EXTENSIONS
                );
                remoteVideosDeleted = await cleanupBackblazeTargets(VIDEO_STORAGE_TARGETS, videoCutoff);
            }

            let localImagesDeleted = 0;
            let remoteImagesDeleted = 0;
            if (shouldRunCleanupInterval(imageCleanupInterval, now)) {
                const imageCutoff = new Date(now.getTime() - imageStorageRetentionHours * 60 * 60 * 1000);
                localImagesDeleted = await cleanupLocalFilesByExtension(
                    LOCAL_CLEANUP_DIRECTORIES,
                    imageCutoff,
                    IMAGE_FILE_EXTENSIONS
                );
                remoteImagesDeleted = await cleanupBackblazeTargets(IMAGE_STORAGE_TARGETS, imageCutoff);
            }

            let remoteVideoStudioDeleted = 0;
            if (shouldRunCleanupInterval(videoStudioCleanupInterval, now)) {
                const videoStudioCutoff = new Date(now.getTime() - videoStudioStorageRetentionHours * 60 * 60 * 1000);
                remoteVideoStudioDeleted = await cleanupBackblazeTargets(VIDEO_STUDIO_STORAGE_TARGETS, videoStudioCutoff);
            }

            await logCron(
                'info',
                `Cleanup completed. Deleted ${logsDeleted} logs, ${notifsDeleted} notifications, ${commentsDeleted} old comments, ${rssActivityDeleted} RSS activity rows, ${designStudioDeleted} design activity rows, ${videoStudioDeleted} video studio activity rows, ${tmdbActivityDeleted} TMDb activity rows, ${localVideosDeleted} local videos, ${remoteVideosDeleted} hosted videos, ${localImagesDeleted} local images, ${remoteImagesDeleted} hosted images, and ${remoteVideoStudioDeleted} hosted Video Studio files.`
            );
        } catch (error) {
            await logCron('error', `Cleanup failed: ${error}`);
        }
    }, cronOptions);

    console.log('✅ Cron Jobs started successfully');
}
