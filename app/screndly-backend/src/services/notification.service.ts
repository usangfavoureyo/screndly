
import prisma from '../lib/prisma';
import { webPushService } from './web-push.service';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationSource = 'system' | 'tmdb' | 'rss' | 'youtube' | 'upload' | 'design_studio' | 'video_studio';

interface NotificationOptions {
    title: string;
    message: string;
    type?: NotificationType;
    source: NotificationSource;
    actionPage?: string;
    metadata?: any;
}

function normalizePushTarget(actionPage?: string): string {
    switch (actionPage) {
        case '/tmdb-feeds':
            return '/tmdb';
        case '/rss-feeds':
            return '/rss';
        case '/uploads':
            return '/upload-manager';
        case '/settings':
            return '/dashboard';
        default:
            return actionPage || '/';
    }
}

export class NotificationService {
    /**
     * Send a notification to the user, respecting their settings.
     */
    async notifyUser(options: NotificationOptions): Promise<void> {
        try {
            const { title, message, type = 'info', source, actionPage, metadata } = options;

            // 1. Check Settings
            // Fetch all notification settings at once (optimization: could cache or fetch specific)
            const settings = await prisma.setting.findMany({
                where: {
                    key: {
                        in: [
                            'inAppNotifications', // Master switch
                            'notifyTMDb',
                            'notifyRSS',
                            'notifyUploads',
                            'notifyVideoStudio',
                            'notifyDesignStudio',
                            'notifySystem'
                        ]
                    }
                }
            });

            const getSetting = (key: string) => {
                const s = settings.find(s => s.key === key);
                // Default to TRUE if setting missing, except for specific annoyances maybe?
                // Actually safer to default to FALSE if unsure, but user experience usually expects notifications enabled by default.
                // The frontend defaults show TRUE.
                if (!s) return true;
                return s.value === true || s.value === 'true';
            };

            const inAppNotificationsEnabled = getSetting('inAppNotifications');
            if (!inAppNotificationsEnabled) {
                return;
            }

            // Category switches
            let categoryEnabled = true;
            switch (source) {
                case 'tmdb': categoryEnabled = getSetting('notifyTMDb'); break;
                case 'rss': categoryEnabled = getSetting('notifyRSS'); break;
                case 'upload': categoryEnabled = getSetting('notifyUploads'); break;
                case 'video_studio': categoryEnabled = getSetting('notifyVideoStudio'); break;
                case 'design_studio': categoryEnabled = getSetting('notifyDesignStudio'); break;
                case 'system': categoryEnabled = getSetting('notifySystem'); break;
                default: categoryEnabled = true;
            }

            if (!categoryEnabled) {
                // console.log(`[NotificationService] Skipped: ${source} notifications disabled`);
                return;
            }

            // 2. Create In-App Notification (Database)
            const [createdNotification, unreadCount] = await prisma.$transaction([
                prisma.notification.create({
                    data: {
                        type,
                        title,
                        message,
                        source,
                        actionPage,
                        read: false,
                    }
                }),
                prisma.notification.count({
                    where: {
                        read: false,
                    },
                }),
            ]);

            console.log(`[NotificationService] Sent: ${title}`);

            // 3. Send Web Push to subscribed PWA devices.
            await webPushService.sendNotification({
                title,
                body: message,
                url: normalizePushTarget(actionPage),
                badgeCount: unreadCount,
                source,
                type,
                tag: `screndly-${source}-${createdNotification.id}`,
                notificationId: createdNotification.id,
                renotify: true,
            });

        } catch (error) {
            console.error('[NotificationService] Error sending notification:', error);
        }
    }

    async notifyUserOnceWithinWindow(options: NotificationOptions, windowMinutes: number): Promise<void> {
        try {
            const recentDuplicate = await prisma.notification.findFirst({
                where: {
                    title: options.title,
                    message: options.message,
                    source: options.source,
                    createdAt: {
                        gte: new Date(Date.now() - windowMinutes * 60 * 1000),
                    },
                },
            });

            if (recentDuplicate) {
                return;
            }
        } catch (error) {
            console.error('[NotificationService] Error checking duplicate notifications:', error);
        }

        await this.notifyUser(options);
    }
}

export const notificationService = new NotificationService();
