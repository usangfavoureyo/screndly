import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import prisma from '../lib/prisma';
import { refreshTMDbContent, isTMDbConfigured, getTMDbSettings, cleanupQueuedTMDbPosts, updateTMDbPost } from './tmdb.service';
import { youtubePollerService } from './youtube-poller.service';
import { publisherService } from './publisher.service';
import { refreshAllFeeds } from './rss.service';
import { notificationService } from './notification.service';
import { commentsService } from './comments.service';
import { purgeExpiredNotifications } from './notification-retention.service';
import { deleteBackblazeFile, listBackblazeFiles, type BackblazeBucketType } from './backblaze';
import { resolveTMDbPublishImages } from './tmdb-publish-image-selection';
import { getYouTubeRuntimeSettings } from './video-enrichment.service';
import {
    getComposeState,
    mutateComposeItem,
    publishComposeItemFromState,
} from './compose.service';
import {
    generateDesignStudioAutoEditorials,
    publishScheduledDesignStudioAutoEditorials,
} from './design-studio.service';
import { sanitizeTMDbCaption } from './tmdb-caption-helpers';

const VIDEO_FILE_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']);
const IMAGE_FILE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);
const LOCAL_CLEANUP_DIRECTORIES = ['temp', 'uploads'];
const GLOBAL_CLEANUP_INTERVALS = new Set(['daily', 'weekly', 'monthly', 'never']);
const YOUTUBE_POLLING_STALE_NOTIFICATION_WINDOW_MINUTES = 60;
const YOUTUBE_POLLING_GLOBAL_STALE_THRESHOLD_MINUTES = 45;
const DEFAULT_TMDB_MASTER_REFRESH_TIME = '07:00';
const DEFAULT_TMDB_SECONDARY_REFRESH_TIME = '12:00';

function quoteTMDbCaptionTitle(title: string): string {
    return `'${String(title || '').trim()}'`;
}

function isGenericTMDbOutNowCaption(caption: string | null | undefined, title: string): boolean {
    const normalized = String(caption || '').trim();
    if (!normalized) {
        return false;
    }

    const escapedTitle = String(title || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^\\W*OUT\\s+NOW:\\s*${escapedTitle}\\W*$`, 'i').test(normalized);
}

function buildTMDbPromptAlignedFallbackCaption(post: {
    title: string;
    mediaType: string;
    moduleType?: string | null;
    cast?: string[] | null;
}): string {
    const title = quoteTMDbCaptionTitle(post.title);
    const cast = Array.isArray(post.cast)
        ? post.cast.map((name) => String(name || '').trim()).filter(Boolean).slice(0, 3)
        : [];
    const castLine = cast.length > 0 ? `\n\nStarring ${cast.join(', ')}.` : '';

    if (post.moduleType === 'today') {
        const releasePhrase = post.mediaType === 'tv' ? 'premieres today' : 'releases today';
        return `${title} ${releasePhrase}.${castLine}`;
    }

    if (post.moduleType === 'weekly') {
        return `${title} releases this week.${castLine}`;
    }

    if (post.moduleType === 'monthly') {
        return `${title} releases next month.${castLine}`;
    }

    if (post.moduleType === 'anniversary') {
        return `${title} marks an anniversary today.${castLine}`;
    }

    return `${title} arrives soon.${castLine}`;
}

function resolveTMDbPublishCaption(post: {
    title: string;
    mediaType: string;
    moduleType?: string | null;
    cast?: string[] | null;
    caption?: string | null;
}): string {
    if (isGenericTMDbOutNowCaption(post.caption, post.title)) {
        return buildTMDbPromptAlignedFallbackCaption(post);
    }

    const sanitized = sanitizeTMDbCaption(post.caption || '');
    if (sanitized.isValid && sanitized.caption.trim()) {
        return sanitized.caption;
    }

    return buildTMDbPromptAlignedFallbackCaption(post);
}

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

let youtubePollingPausedUntil: Date | null = null;
let lastYouTubePollingHealthNotificationAt: Date | null = null;
const activeCronTasks = new Set<string>();
const lastCronSkipLogAt = new Map<string, number>();

async function resolveTMDbPublishImageUrls(post: {
    id?: string | null;
    imageUrl?: string | null;
    imageUrls?: string[] | null;
    imageType?: string | null;
    imageTypes?: string[] | null;
}): Promise<string[]> {
    return (await resolveTMDbPublishImages(post)).imageUrls;
}
let youtubePollingPauseReason: string | null = null;

async function clearResolvedYouTubePollingHealthNotifications(): Promise<void> {
    await prisma.notification.updateMany({
        where: {
            title: 'YouTube Polling Fully Delayed',
            source: 'youtube',
            read: false,
        },
        data: { read: true },
    }).catch((error) => {
        console.warn('[Cron] Failed to mark resolved YouTube polling health notifications as read:', error);
    });
}

export function pauseYouTubePolling(minutes: number, reason = 'manual targeted poll'): Date {
    const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 10;
    const pausedUntil = new Date(Date.now() + safeMinutes * 60 * 1000);
    youtubePollingPausedUntil = pausedUntil;
    youtubePollingPauseReason = reason;
    return pausedUntil;
}

export function resumeYouTubePolling(): void {
    youtubePollingPausedUntil = null;
    youtubePollingPauseReason = null;
}

export function getYouTubePollingPauseStatus(now = new Date()) {
    const paused = Boolean(youtubePollingPausedUntil && youtubePollingPausedUntil > now);
    return {
        paused,
        pausedUntil: paused ? youtubePollingPausedUntil?.toISOString() : undefined,
        reason: paused ? youtubePollingPauseReason || undefined : undefined,
    };
}

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

async function runNonOverlappingCronTask(
    taskKey: string,
    task: () => Promise<void>,
    service: string = 'cron',
): Promise<void> {
    if (activeCronTasks.has(taskKey)) {
        const now = Date.now();
        const lastLoggedAt = lastCronSkipLogAt.get(taskKey) ?? 0;
        if ((now - lastLoggedAt) >= 60_000) {
            lastCronSkipLogAt.set(taskKey, now);
            await logCron('warn', `${taskKey} skipped because the previous run is still active`, service);
        }
        return;
    }

    activeCronTasks.add(taskKey);
    try {
        await task();
    } finally {
        activeCronTasks.delete(taskKey);
    }
}

function getScheduleParts(timezone: string, now = new Date()): { day: number; minutes: number } {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const weekday = parts.find((part) => part.type === 'weekday')?.value;
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || '0');
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || '0');
    const dayMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
    };

    return {
        day: dayMap[weekday || 'Sun'] ?? 0,
        minutes: (hour * 60) + minute,
    };
}

function parseScheduleMinutes(value: string | null | undefined, fallback: number): number {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) {
        return fallback;
    }

    const [hours, minutes] = value.split(':').map((part) => Number(part));
    return (hours * 60) + minutes;
}

function isValidDailyTime(value: string | null | undefined): value is string {
    return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}

function toDailyCronExpression(value: string, fallback = DEFAULT_TMDB_MASTER_REFRESH_TIME): string {
    const normalized = isValidDailyTime(value) ? value : fallback;
    const [hours, minutes] = normalized.split(':').map((part) => Number(part));

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        const [fallbackHours, fallbackMinutes] = fallback.split(':').map((part) => Number(part));
        return `${fallbackMinutes} ${fallbackHours} * * *`;
    }

    return `${minutes} ${hours} * * *`;
}

function isPollingScheduleOpenForHealthCheck(schedule: Awaited<ReturnType<typeof getYouTubeRuntimeSettings>>['pollingSchedule'], now = new Date()): boolean {
    if (!schedule.enabled) {
        return true;
    }

    const { day, minutes } = getScheduleParts(schedule.timezone || 'America/New_York', now);
    const window = schedule.windows.find((entry) => entry.day === day);
    if (!window || !window.active) {
        return false;
    }

    const startMinutes = parseScheduleMinutes(window.startTime, 0);
    const endMinutes = parseScheduleMinutes(window.endTime, (23 * 60) + 59);
    if (startMinutes <= endMinutes) {
        return minutes >= startMinutes && minutes <= endMinutes;
    }

    return minutes >= startMinutes || minutes <= endMinutes;
}

async function checkYouTubePollingHealth() {
    const now = new Date();
    const settings = await getYouTubeRuntimeSettings();
    if (!isPollingScheduleOpenForHealthCheck(settings.pollingSchedule, now)) {
        lastYouTubePollingHealthNotificationAt = null;
        return;
    }
    const staleBefore = new Date(now.getTime() - YOUTUBE_POLLING_GLOBAL_STALE_THRESHOLD_MINUTES * 60 * 1000);

    const activeChannels = await prisma.channel.findMany({
        where: {
            status: 'active',
        },
        orderBy: [
            { nextPollAt: 'asc' },
            { lastCheck: 'asc' },
        ],
        select: {
            name: true,
            nextPollAt: true,
            lastCheck: true,
            lastPollStartedAt: true,
            lockUntil: true,
        },
    });

    if (activeChannels.length === 0) {
        lastYouTubePollingHealthNotificationAt = null;
        return;
    }

    const overdueChannels = activeChannels.filter((channel) => {
        if (channel.nextPollAt) {
            return channel.nextPollAt < staleBefore;
        }

        if (channel.lastCheck) {
            return channel.lastCheck < staleBefore;
        }

        return true;
    });

    if (overdueChannels.length === 0) {
        lastYouTubePollingHealthNotificationAt = null;
        await clearResolvedYouTubePollingHealthNotifications();
        return;
    }

    if (overdueChannels.length < activeChannels.length) {
        await logCron(
            'warn',
            `YouTube polling self-heal: ${overdueChannels.length}/${activeChannels.length} active channels are overdue by more than ${YOUTUBE_POLLING_GLOBAL_STALE_THRESHOLD_MINUTES} minutes`
        );
        return;
    }

    const recoveryInProgress = activeChannels.some((channel) => {
        if (channel.lockUntil && channel.lockUntil > now) {
            return true;
        }

        return Boolean(channel.lastPollStartedAt && channel.lastPollStartedAt >= staleBefore);
    });

    if (recoveryInProgress) {
        await logCron(
            'warn',
            `YouTube polling self-heal in progress: all ${activeChannels.length} active channels are stale, but polling workers have recently claimed work`
        );
        return;
    }

    if (
        lastYouTubePollingHealthNotificationAt
        && now.getTime() - lastYouTubePollingHealthNotificationAt.getTime() < YOUTUBE_POLLING_STALE_NOTIFICATION_WINDOW_MINUTES * 60 * 1000
    ) {
        return;
    }

    const overdueLabels = overdueChannels
        .slice(0, 5)
        .map((channel) => {
            const reference = channel.nextPollAt || channel.lastCheck;
            return reference
                ? `${channel.name} (overdue since ${reference.toISOString()})`
                : channel.name;
        });

    await notificationService.notifyUserOnceWithinWindow({
        title: 'YouTube Polling Fully Delayed',
        message: `All active YouTube channels are overdue for polling by more than ${YOUTUBE_POLLING_GLOBAL_STALE_THRESHOLD_MINUTES} minutes. Example channels: ${overdueLabels.join(', ')}.`,
        type: 'warning',
        source: 'youtube',
        actionPage: '/channels'
    }, YOUTUBE_POLLING_STALE_NOTIFICATION_WINDOW_MINUTES);
    await logCron(
        'warn',
        `YouTube polling global health warning: all ${activeChannels.length} active channels are overdue by more than ${YOUTUBE_POLLING_GLOBAL_STALE_THRESHOLD_MINUTES} minutes`
    );
    lastYouTubePollingHealthNotificationAt = now;
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

    const runTMDbRefresh = async (jobLabel: string, notificationLabel: string) => {
        await logCron('info', `Starting ${jobLabel}...`);
        try {
            const configured = await isTMDbConfigured();
            if (!configured) {
                await logCron('warn', 'TMDb API key not configured, skipping refresh');
                return;
            }

            const settings = await getTMDbSettings();
            const result = await refreshTMDbContent(settings);

            await logCron('info', `${jobLabel} completed: ${result.added} posts added (run ${result.runId})`);

            if (result.added > 0) {
                const notification = buildTmdbRefreshNotification(notificationLabel, result);
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
                await notificationService.notifyUser({
                    title: 'TMDb Refresh Errors',
                    message: `Encountered ${result.errors.length} errors during the ${notificationLabel.toLowerCase()} run.`,
                    type: 'warning',
                    source: 'tmdb',
                    actionPage: '/logs'
                });
            }
        } catch (error) {
            await logCron('error', `${jobLabel} failed: ${error}`);
            await notificationService.notifyUser({
                title: 'TMDb Refresh Failed',
                message: `${notificationLabel} failed to execute.`,
                type: 'error',
                source: 'tmdb',
                actionPage: '/settings'
            });
        }
    };

    let tmdbMasterRefreshTime = DEFAULT_TMDB_MASTER_REFRESH_TIME;
    try {
        const tmdbSettings = await getTMDbSettings();
        if (isValidDailyTime(tmdbSettings.tmdbDailyRefreshTime)) {
            tmdbMasterRefreshTime = tmdbSettings.tmdbDailyRefreshTime;
        }
    } catch (error) {
        await logCron('warn', `Failed to load TMDb refresh settings, defaulting to ${DEFAULT_TMDB_MASTER_REFRESH_TIME}: ${error}`);
    }

    // TMDb Master Daily Refresh - Default at 07:00, configurable via settings
    cron.schedule(toDailyCronExpression(tmdbMasterRefreshTime), async () => {
        await runNonOverlappingCronTask(
            'tmdb-master-refresh',
            async () => {
                await runTMDbRefresh('TMDb master refresh', 'TMDb Daily Refresh');
            },
            'tmdb-cron',
        );
    }, cronOptions);

    // TMDb Secondary Refresh - Daily at 12:00 to catch items that appear later in the day
    if (tmdbMasterRefreshTime !== DEFAULT_TMDB_SECONDARY_REFRESH_TIME) {
        cron.schedule(toDailyCronExpression(DEFAULT_TMDB_SECONDARY_REFRESH_TIME, DEFAULT_TMDB_SECONDARY_REFRESH_TIME), async () => {
            await runNonOverlappingCronTask(
                'tmdb-secondary-refresh',
                async () => {
                    await runTMDbRefresh('TMDb secondary refresh', 'TMDb Midday Refresh');
                },
                'tmdb-cron',
            );
        }, cronOptions);
    }

    // YouTube Polling Scheduler - Every 10 seconds
    cron.schedule('*/10 * * * * *', async () => {
        try {
            const pauseStatus = getYouTubePollingPauseStatus();
            if (pauseStatus.paused) {
                await logCron(
                    'info',
                    `YouTube polling skipped while paused until ${pauseStatus.pausedUntil}${pauseStatus.reason ? ` (${pauseStatus.reason})` : ''}`
                );
                return;
            }
            const summary = await youtubePollerService.runSchedulerTick();
            if (summary.claimedChannels > 0 || summary.skippedLockedChannels > 0) {
                await logCron(
                    'info',
                    `YouTube scheduler tick: ${summary.claimedChannels}/${summary.dueChannels} channels claimed, ${summary.skippedLockedChannels} locked, ${summary.activeWorkerCount} active workers`
                );
            }
        } catch (error) {
            await logCron('error', `YouTube scheduler tick failed: ${error}`);
        }
    }, cronOptions);

    cron.schedule('* * * * *', async () => {
        try {
            const pauseStatus = getYouTubePollingPauseStatus();
            if (pauseStatus.paused) {
                return;
            }

            await checkYouTubePollingHealth();
        } catch (error) {
            await logCron('error', `YouTube polling health check failed: ${error}`);
        }
    }, cronOptions);

    // RSS Feed Refresh - Every minute (master tick for per-feed intervals)
    cron.schedule('* * * * *', async () => {
        await runNonOverlappingCronTask('rss-scheduled-refresh', async () => {
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
        }, 'rss');
    }, cronOptions);

    // Design Studio Auto Editorial Generation - Every minute
    cron.schedule('* * * * *', async () => {
        await runNonOverlappingCronTask('design-studio-auto-generate', async () => {
            try {
                const result = await generateDesignStudioAutoEditorials();
                if (result.generated > 0) {
                    await logCron(
                        'info',
                        `Generated ${result.generated} Design Studio auto editorial${result.generated === 1 ? '' : 's'}.`,
                        'design-studio-cron',
                    );
                }
            } catch (error) {
                await logCron('error', `Design Studio auto generation failed: ${error}`, 'design-studio-cron');
            }
        }, 'design-studio-cron');
    }, cronOptions);

    // Design Studio Auto Editorial Publisher - Every minute
    cron.schedule('* * * * *', async () => {
        await runNonOverlappingCronTask('design-studio-auto-publish', async () => {
            try {
                const result = await publishScheduledDesignStudioAutoEditorials();
                if (result.published > 0 || result.failed > 0) {
                    await logCron(
                        result.failed > 0 ? 'warn' : 'info',
                        `Design Studio auto publish run: ${result.published} published, ${result.failed} failed.`,
                        'design-studio-cron',
                    );
                }
            } catch (error) {
                await logCron('error', `Design Studio auto publishing failed: ${error}`, 'design-studio-cron');
            }
        }, 'design-studio-cron');
    }, cronOptions);

    // Post Scheduler - Every 1 minute
    cron.schedule('* * * * *', async () => {
        await runNonOverlappingCronTask('tmdb-post-scheduler', async () => {
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
                        const latestPost = await prisma.tMDbPost.findUnique({
                            where: { id: post.id },
                        });

                        if (!latestPost) {
                            await logCron('warn', `Skipping TMDb post ${post.id} because it no longer exists`);
                            continue;
                        }

                        if (latestPost.status !== 'scheduled') {
                            await logCron('info', `Skipping TMDb post ${latestPost.id} because its status is now ${latestPost.status}`);
                            continue;
                        }

                        if (latestPost.scheduledTime > now) {
                            await logCron(
                                'info',
                                `Skipping TMDb post ${latestPost.id} because it was rescheduled to ${latestPost.scheduledTime.toISOString()}`
                            );
                            continue;
                        }

                        const platforms = latestPost.platforms || [];
                        if (platforms.length === 0) {
                            await logCron('warn', `Post ${latestPost.id} has no target platforms, marking skipped`);
                            await prisma.tMDbPost.update({
                                where: { id: latestPost.id },
                                data: {
                                    status: 'failed',
                                    errorMessage: 'No target platforms configured for this TMDb post'
                                }
                            });
                            continue;
                        }

                        const publishImageUrls = await resolveTMDbPublishImageUrls(latestPost);
                        const primaryImageUrl = publishImageUrls[0] || latestPost.imageUrl || undefined;
                        if (!primaryImageUrl) {
                            const missingImageMessage = 'Auto-post skipped: no image available for this TMDb post';
                            await updateTMDbPost(latestPost.id, {
                                status: 'failed',
                                errorMessage: missingImageMessage,
                            });
                            await logCron('warn', `Skipped TMDb auto-post for ${latestPost.title}: no image available`);
                            await notificationService.notifyUser({
                                title: 'TMDb auto-post skipped',
                                message: `"${latestPost.title}" was due to publish, but it has no image so it was skipped.`,
                                type: 'warning',
                                source: 'tmdb',
                                actionPage: '/tmdb-feeds'
                            });
                            continue;
                        }

                        const publishCaption = resolveTMDbPublishCaption(latestPost);

                        if (publishCaption !== latestPost.caption) {
                            await updateTMDbPost(latestPost.id, { caption: publishCaption });
                        }

                        const content = {
                            text: publishCaption,
                            title: latestPost.title,
                            imageUrl: primaryImageUrl,
                            imageUrls: publishImageUrls.length > 0 ? publishImageUrls : undefined,
                        };

                        const results = await publisherService.publish(platforms, content);
                        const success = results.some(r => r.status === 'posted');
                        const partialSuccess = success && results.some(r => r.status !== 'posted');
                        const failureMessage = results
                            .filter(r => r.status !== 'posted')
                            .map(r => `${r.platform}: ${r.error || 'Publish failed'}`)
                            .join(', ');

                        await updateTMDbPost(latestPost.id, {
                            status: success ? 'published' : 'failed',
                            publishedTime: now,
                            dispatchedAt: now,
                            errorMessage: success ? (failureMessage || null) : (failureMessage || 'Failed to publish TMDb post'),
                        });

                        if (success && !partialSuccess) {
                            await logCron('info', `Successfully published post: ${latestPost.title}`);
                        } else if (partialSuccess) {
                            await logCron('warn', `Partially published post ${latestPost.title}: ${failureMessage}`);
                            await notificationService.notifyUser({
                                title: 'Auto-Post partially published',
                                message: `"${latestPost.title}" posted to some platforms, but failed on: ${failureMessage}`,
                                type: 'warning',
                                source: 'tmdb',
                                actionPage: '/tmdb-feeds'
                            });
                        } else {
                            const errors = results.map(r => `${r.platform}: ${r.error}`).join(', ');
                            await logCron('error', `Failed to publish post ${latestPost.title}: ${errors}`);

                            await notificationService.notifyUser({
                                title: 'Auto-Post Failed',
                                message: `Failed to publish "${latestPost.title}". Check logs.`,
                                type: 'error',
                                source: 'tmdb',
                                actionPage: '/tmdb-feeds'
                            });
                        }

                    } catch (postError) {
                        console.error(`Failed to process post ${post.id}`, postError);
                        await updateTMDbPost(post.id, {
                            status: 'failed',
                            errorMessage: postError instanceof Error ? postError.message : 'Failed to process TMDb post'
                        });
                        await logCron('error', `Error processing post ${post.title}: ${postError}`);
                    }
                }
            } catch (error) {
                await logCron('error', `Post scheduler failed: ${error}`);
            }
        }, 'tmdb-cron');
    }, cronOptions);

    // Compose Post Scheduler - Every 1 minute
    cron.schedule('* * * * *', async () => {
        await runNonOverlappingCronTask('compose-post-scheduler', async () => {
            try {
                const now = Date.now();
                const state = await getComposeState();
                const postsToPublish = state.items
                    .filter((item) =>
                        item.status === 'scheduled'
                        && typeof item.scheduledAt === 'string'
                        && new Date(item.scheduledAt).getTime() <= now
                        && (!item.publishLockExpiresAt || new Date(item.publishLockExpiresAt).getTime() <= now)
                    )
                    .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())
                    .slice(0, 5);

                if (postsToPublish.length === 0) {
                    return;
                }

                await logCron('info', `Found ${postsToPublish.length} compose posts to publish`, 'compose-cron');

                for (const item of postsToPublish) {
                    const attemptStartedAt = new Date().toISOString();
                    const publishLockExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

                    await mutateComposeItem(item.id, (currentItem) => ({
                        ...currentItem,
                        publishLockExpiresAt,
                        lastPublishAttemptAt: attemptStartedAt,
                        error: undefined,
                        updatedAt: new Date().toISOString(),
                    }));

                    try {
                        const refreshedState = await getComposeState();
                        const latestItem = refreshedState.items.find((entry) => entry.id === item.id);
                        if (!latestItem || latestItem.status !== 'scheduled' || latestItem.scheduledAt !== item.scheduledAt) {
                            continue;
                        }

                        const result = await publishComposeItemFromState(latestItem);
                        const nextStatus = result.postedPlatforms.length > 0 ? 'published' : 'failed';
                        const nextError =
                            nextStatus === 'failed'
                                ? result.errorMessage || 'Failed to publish scheduled post.'
                                : result.failedResults.length > 0
                                    ? result.errorMessage
                                    : undefined;

                        await mutateComposeItem(item.id, (currentItem) => ({
                            ...currentItem,
                            status: nextStatus,
                            scheduledAt: nextStatus === 'published' ? undefined : currentItem.scheduledAt,
                            publishLockExpiresAt: undefined,
                            lastPublishAttemptAt: attemptStartedAt,
                            publishRetryCount: nextStatus === 'failed' ? (currentItem.publishRetryCount ?? 0) + 1 : 0,
                            error: nextError,
                            updatedAt: new Date().toISOString(),
                        }));

                        if (result.postedPlatforms.length > 0) {
                            await logCron(
                                result.failedResults.length > 0 ? 'warn' : 'info',
                                result.failedResults.length > 0
                                    ? `Compose post partially published to ${result.postedPlatforms.join(', ')} with errors: ${result.errorMessage}`
                                    : `Compose post published to ${result.postedPlatforms.join(', ')}`,
                                'compose-cron',
                            );
                        } else {
                            await logCron('error', `Compose publish failed: ${nextError}`, 'compose-cron');
                        }
                    } catch (error) {
                        const message = error instanceof Error ? error.message : 'Failed to publish scheduled compose post';
                        await mutateComposeItem(item.id, (currentItem) => ({
                            ...currentItem,
                            status: 'failed',
                            publishLockExpiresAt: undefined,
                            lastPublishAttemptAt: attemptStartedAt,
                            publishRetryCount: (currentItem.publishRetryCount ?? 0) + 1,
                            error: message,
                            updatedAt: new Date().toISOString(),
                        }));
                        await logCron('error', `Compose post scheduler failed: ${message}`, 'compose-cron');
                    }
                }
            } catch (error) {
                await logCron('error', `Compose scheduler failed: ${error}`, 'compose-cron');
            }
        }, 'compose-cron');
    }, cronOptions);

    // Comment Processing - Every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
        await runNonOverlappingCronTask('comment-processing', async () => {
            try {
                // 1. Poll (Ingest) new comments (Mock/Stub for now, or real if adapters exist)
                await commentsService.pollComments();

                // 2. Process (Reply) to pending comments
                await commentsService.processUnrepliedComments();
            } catch (error) {
                await logCron('error', `Comment processing failed: ${error}`);
            }
        }, 'comments');
    }, cronOptions);

    // TMDb queued item cleanup - Every hour
    cron.schedule('0 * * * *', async () => {
        await runNonOverlappingCronTask('tmdb-queued-cleanup', async () => {
            try {
                const settings = await getTMDbSettings();
                const deletedCount = await cleanupQueuedTMDbPosts(settings.tmdbQueuedRetentionHours || 168);

                if (deletedCount > 0) {
                    await logCron('info', `Deleted ${deletedCount} stale queued TMDb posts`);
                }
            } catch (error) {
                await logCron('error', `TMDb queued cleanup failed: ${error}`);
            }
        }, 'tmdb-cron');
    }, cronOptions);

    // Cleanup - Daily at 03:00 UTC
    cron.schedule('0 3 * * *', async () => {
        await runNonOverlappingCronTask('global-cleanup', async () => {
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
        }, 'cleanup');
    }, cronOptions);

    console.log('✅ Cron Jobs started successfully');
}
