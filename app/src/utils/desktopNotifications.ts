// Desktop Push Notifications Utility for Screndly

export interface DesktopNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

class DesktopNotificationManager {
  private permission: NotificationPermission = 'default';
  
  constructor() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Request permission for desktop notifications
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    if (this.permission === 'denied') {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Check if notifications are supported and permitted
   */
  isSupported(): boolean {
    return 'Notification' in window;
  }

  /**
   * Check if permission is granted
   */
  isGranted(): boolean {
    return this.permission === 'granted';
  }

  /**
   * Send a desktop notification
   */
  async send(options: DesktopNotificationOptions): Promise<Notification | null> {
    if (!this.isSupported()) {
      return null;
    }

    if (!this.isGranted()) {
      const granted = await this.requestPermission();
      if (!granted) {
        return null;
      }
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/screndly-logo.png',
        badge: options.badge || '/screndly-logo.png',
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
      });

      // Auto-close after 5 seconds unless requireInteraction is true
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      return notification;
    } catch (error) {
      console.error('Error sending desktop notification:', error);
      return null;
    }
  }

  /**
   * Send a notification based on type
   */
  async sendTyped(
    type: 'success' | 'error' | 'info' | 'warning',
    title: string,
    message: string,
    options?: Partial<DesktopNotificationOptions>
  ): Promise<Notification | null> {
    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️',
    };

    return this.send({
      title: `${icons[type]} ${title}`,
      body: message,
      ...options,
    });
  }
}

// Export singleton instance
export const desktopNotifications = new DesktopNotificationManager();
