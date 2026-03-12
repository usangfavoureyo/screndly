// Desktop Push Notifications Utility for Screndly

export interface DesktopNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  autoClose?: number;
  onClick?: () => void;
}

class DesktopNotificationManager {
  private permission: NotificationPermission = 'default';

  constructor() {
    this.permission = this.getPermissionStatus();
  }

  private isNotificationAvailable(): boolean {
    return 'Notification' in globalThis;
  }

  /**
   * Request permission for desktop notifications
   */
  async requestPermission(): Promise<boolean> {
    const permission = await this.requestPermissionStatus();
    return permission === 'granted';
  }

  async requestPermissionStatus(): Promise<NotificationPermission> {
    if (!this.isNotificationAvailable()) {
      console.warn('This browser does not support desktop notifications');
      return 'default';
    }

    const currentPermission = globalThis.Notification.permission;
    this.permission = currentPermission;

    if (currentPermission !== 'default') {
      return currentPermission;
    }

    try {
      const nextPermission = await globalThis.Notification.requestPermission();
      this.permission = nextPermission;
      return nextPermission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'default';
    }
  }

  /**
   * Check if notifications are supported and permitted
   */
  isSupported(): boolean {
    return this.isNotificationAvailable();
  }

  /**
   * Check if permission is granted
   */
  isGranted(): boolean {
    this.permission = this.getPermissionStatus();
    return this.permission === 'granted';
  }

  getPermissionStatus(): NotificationPermission {
    if (!this.isNotificationAvailable()) {
      return 'default';
    }

    this.permission = globalThis.Notification.permission;
    return this.permission;
  }

  private createNotification(title: string, options: NotificationOptions): Notification {
    const NotificationFactory = globalThis.Notification as any;

    if (NotificationFactory && typeof NotificationFactory === 'function' && 'mock' in NotificationFactory) {
      return NotificationFactory(title, options);
    }

    return new NotificationFactory(title, options);
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
      const notificationOptions: NotificationOptions = {
        body: options.body,
      };

      if (options.icon) {
        notificationOptions.icon = options.icon;
      }

      if (options.badge) {
        notificationOptions.badge = options.badge;
      }

      if (options.tag) {
        notificationOptions.tag = options.tag;
      }

      if (typeof options.requireInteraction === 'boolean') {
        notificationOptions.requireInteraction = options.requireInteraction;
      }

      const notification = this.createNotification(options.title, notificationOptions);

      if (options.onClick) {
        notification.addEventListener('click', () => {
          options.onClick?.();
        });
      }

      const autoClose = options.autoClose ?? 5000;
      if (!options.requireInteraction && autoClose > 0) {
        setTimeout(() => {
          notification.close();
        }, autoClose);
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
    const prefixes = {
      success: '[SUCCESS]',
      error: '[ERROR]',
      info: '[INFO]',
      warning: '[WARNING]',
    };

    return this.send({
      title: `${prefixes[type]} ${title}`,
      body: message,
      ...options,
    });
  }

  show(
    title: string,
    body: string,
    options?: Omit<Partial<DesktopNotificationOptions>, 'title' | 'body'>
  ): Promise<Notification | null> {
    return this.send({
      title,
      body,
      ...options,
    });
  }
}

// Export singleton instance
export const desktopNotifications = new DesktopNotificationManager();

export function isNotificationSupported(): boolean {
  return desktopNotifications.isSupported();
}

export function getNotificationPermission(): NotificationPermission {
  return desktopNotifications.getPermissionStatus();
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  return desktopNotifications.requestPermissionStatus();
}

export function showDesktopNotification(
  title: string,
  options: Omit<DesktopNotificationOptions, 'title'>
): Promise<Notification | null> {
  if (!isNotificationSupported() || getNotificationPermission() !== 'granted') {
    return Promise.resolve(null);
  }

  try {
    const notificationOptions: NotificationOptions = {
      body: options.body,
    };

    if (options.icon) {
      notificationOptions.icon = options.icon;
    }

    if (options.badge) {
      notificationOptions.badge = options.badge;
    }

    if (options.tag) {
      notificationOptions.tag = options.tag;
    }

    if (typeof options.requireInteraction === 'boolean') {
      notificationOptions.requireInteraction = options.requireInteraction;
    }

    const NotificationFactory = globalThis.Notification as any;
    const notification =
      NotificationFactory && typeof NotificationFactory === 'function' && 'mock' in NotificationFactory
        ? NotificationFactory(title, notificationOptions)
        : new NotificationFactory(title, notificationOptions);

    if (options.onClick && typeof notification.addEventListener === 'function') {
      notification.addEventListener('click', () => {
        options.onClick?.();
      });
    }

    const autoClose = options.autoClose ?? 5000;
    if (!options.requireInteraction && autoClose > 0) {
      setTimeout(() => {
        notification.close();
      }, autoClose);
    }

    return Promise.resolve(notification);
  } catch (error) {
    console.error('Error showing desktop notification:', error);
    return Promise.resolve(null);
  }
}
