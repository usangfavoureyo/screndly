
import prisma from '../lib/prisma';

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

            // Master switch
            if (!getSetting('inAppNotifications')) {
                // console.log('[NotificationService] Skipped: In-App Notifications disabled');
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
            await prisma.notification.create({
                data: {
                    type,
                    title,
                    message,
                    source,
                    actionPage,
                    read: false,
                    // metadata: metadata ? JSON.stringify(metadata) : undefined // Schema doesn't have metadata yet? Check schema.
                    // Assuming schema is simple for now based on route view.
                }
            });

            console.log(`[NotificationService] Sent: ${title}`);

            // 3. (Future) Push / Email / Desktop
            // This is where we would integrate Web Push or Nodemailer using 'desktopNotifications' or 'emailNotifications' settings.

        } catch (error) {
            console.error('[NotificationService] Error sending notification:', error);
        }
    }
}

export const notificationService = new NotificationService();
