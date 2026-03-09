import cron from 'node-cron';
import prisma from '../lib/prisma';
import { refreshTMDbContent, isTMDbConfigured, getTMDbSettings, cleanupQueuedTMDbPosts } from './tmdb.service';
import { youtubePollerService } from './youtube-poller.service';
import { publisherService } from './publisher.service';
import { refreshAllFeeds } from './rss.service';
import { notificationService } from './notification.service';
import { commentsService } from './comments.service';

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
                await notificationService.notifyUser({
                    title: 'TMDb Today Refresh',
                    message: `Added ${result.added} new movies releasing today.`,
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
                await notificationService.notifyUser({
                    title: 'TMDb Weekly Refresh',
                    message: `Added ${result.added} new movies releasing this week.`,
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
                await notificationService.notifyUser({
                    title: 'TMDb Monthly Refresh',
                    message: `Added ${result.added} new movies releasing this month.`,
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
                await notificationService.notifyUser({
                    title: 'TMDb Anniversary Refresh',
                    message: `Found ${result.added} movie anniversaries today.`,
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
                    await logCron('info', `RSS scheduled refresh: ${added} new items from ${result.results.length} feeds checked.`);
                    await notificationService.notifyUser({
                        title: 'RSS Feed Updates',
                        message: `Found ${added} new items across ${result.results.length} feeds.`,
                        type: 'info',
                        source: 'rss',
                        actionPage: '/rss-feeds'
                    });
                }
            }

            if (result.failed > 0) {
                const failedFeeds = result.results.filter(r => r.error).map(r => `${r.feedName}: ${r.error}`).join(', ');
                await logCron('warn', `RSS scheduled refresh errors: ${failedFeeds}`);
                await notificationService.notifyUser({
                    title: 'RSS Refresh Errors',
                    message: `Failed to refresh ${result.failed} feeds.`,
                    type: 'warning',
                    source: 'rss',
                    actionPage: '/rss-feeds'
                });
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
            // Granular Retention Settings
            const keys = [
                'retentionDays',
                'commentRetention',
                'rssActivityRetention',
                'designStudioActivityRetention',
                'videoStudioActivityRetention',
                'tmdbActivityRetention',
            ];
            const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });

            const logRetentionDays = parseInt(settings.find(s => s.key === 'retentionDays')?.value as string) || 30;
            const commentRetentionHours = parseInt(settings.find(s => s.key === 'commentRetention')?.value as string) || 168; // 7 days default
            const rssActivityRetentionHours = parseInt(settings.find(s => s.key === 'rssActivityRetention')?.value as string) || 24;
            const designStudioActivityRetentionHours = parseInt(settings.find(s => s.key === 'designStudioActivityRetention')?.value as string) || 24;
            const videoStudioActivityRetentionHours = parseInt(settings.find(s => s.key === 'videoStudioActivityRetention')?.value as string) || 24;
            const tmdbActivityRetentionHours = parseInt(settings.find(s => s.key === 'tmdbActivityRetention')?.value as string) || 24;

            const logCutoff = new Date(Date.now() - logRetentionDays * 24 * 60 * 60 * 1000);
            const commentCutoff = new Date(Date.now() - commentRetentionHours * 60 * 60 * 1000);
            const rssActivityCutoff = new Date(Date.now() - rssActivityRetentionHours * 60 * 60 * 1000);
            const designStudioCutoff = new Date(Date.now() - designStudioActivityRetentionHours * 60 * 60 * 1000);
            const videoStudioCutoff = new Date(Date.now() - videoStudioActivityRetentionHours * 60 * 60 * 1000);
            const tmdbActivityCutoff = new Date(Date.now() - tmdbActivityRetentionHours * 60 * 60 * 1000);

            // Clean old logs
            const logsDeleted = await prisma.log.deleteMany({
                where: { createdAt: { lt: logCutoff } }
            });

            // Clean old notifications
            const notifsDeleted = await prisma.notification.deleteMany({
                where: { createdAt: { lt: logCutoff }, read: true }
            });

            // Clean old processed comments (Activity Retention)
            const commentsDeleted = await prisma.comment.deleteMany({
                where: {
                    processed: true,
                    updatedAt: { lt: commentCutoff }
                }
            });

            const designStudioDeleted = await prisma.designStudioActivity.deleteMany({
                where: { createdAt: { lt: designStudioCutoff } }
            });

            const videoStudioDeleted = await prisma.videoStudioActivity.deleteMany({
                where: {
                    status: { in: ['completed', 'failed'] },
                    updatedAt: { lt: videoStudioCutoff }
                }
            });

            const tmdbPublishedDeleted = await prisma.tMDbPost.deleteMany({
                where: {
                    status: 'published',
                    publishedTime: { lt: tmdbActivityCutoff }
                }
            });

            const tmdbFailedDeleted = await prisma.tMDbPost.deleteMany({
                where: {
                    status: 'failed',
                    updatedAt: { lt: tmdbActivityCutoff }
                }
            });

            let rssActivityDeleted = 0;
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

            await logCron(
                'info',
                `Cleanup completed. Deleted ${logsDeleted.count} logs, ${notifsDeleted.count} notifications, ${commentsDeleted.count} old comments, ${rssActivityDeleted} RSS activity rows, ${designStudioDeleted.count} design activity rows, ${videoStudioDeleted.count} video activity rows, and ${tmdbPublishedDeleted.count + tmdbFailedDeleted.count} TMDb activity rows.`
            );
        } catch (error) {
            await logCron('error', `Cleanup failed: ${error}`);
        }
    }, cronOptions);

    console.log('✅ Cron Jobs started successfully');
}
