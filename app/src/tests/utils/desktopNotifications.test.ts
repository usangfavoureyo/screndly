// ============================================================================
// DESKTOP NOTIFICATIONS TESTS
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  requestNotificationPermission,
  showDesktopNotification,
  isNotificationSupported,
  getNotificationPermission
} from '../../utils/desktopNotifications';

describe('Desktop Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Notification API
    global.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as any;
  });

  describe('isNotificationSupported', () => {
    it('should return true when Notification API is available', () => {
      expect(isNotificationSupported()).toBe(true);
    });

    it('should return false when Notification API is not available', () => {
      const originalNotification = global.Notification;
      delete (global as any).Notification;

      expect(isNotificationSupported()).toBe(false);

      global.Notification = originalNotification;
    });
  });

  describe('getNotificationPermission', () => {
    it('should return current permission status', () => {
      global.Notification.permission = 'granted';
      expect(getNotificationPermission()).toBe('granted');

      global.Notification.permission = 'denied';
      expect(getNotificationPermission()).toBe('denied');

      global.Notification.permission = 'default';
      expect(getNotificationPermission()).toBe('default');
    });

    it('should return "default" when API is not supported', () => {
      delete (global as any).Notification;
      expect(getNotificationPermission()).toBe('default');
    });
  });

  describe('requestNotificationPermission', () => {
    it('should request notification permission', async () => {
      global.Notification.requestPermission = vi.fn().mockResolvedValue('granted');

      const permission = await requestNotificationPermission();

      expect(global.Notification.requestPermission).toHaveBeenCalled();
      expect(permission).toBe('granted');
    });

    it('should handle denied permission', async () => {
      global.Notification.requestPermission = vi.fn().mockResolvedValue('denied');

      const permission = await requestNotificationPermission();

      expect(permission).toBe('denied');
    });

    it('should return "default" when API is not supported', async () => {
      delete (global as any).Notification;

      const permission = await requestNotificationPermission();

      expect(permission).toBe('default');
    });
  });

  describe('showDesktopNotification', () => {
    it('should show notification when permission is granted', () => {
      global.Notification.permission = 'granted';
      const mockNotification = {
        close: vi.fn(),
        addEventListener: vi.fn(),
      };
      global.Notification = vi.fn().mockReturnValue(mockNotification) as any;
      global.Notification.permission = 'granted';

      showDesktopNotification('Test Title', {
        body: 'Test message',
        icon: '/icon.png',
      });

      expect(global.Notification).toHaveBeenCalledWith('Test Title', {
        body: 'Test message',
        icon: '/icon.png',
      });
    });

    it('should not show notification when permission is denied', () => {
      global.Notification.permission = 'denied';
      const NotificationConstructor = vi.fn();
      global.Notification = NotificationConstructor as any;
      global.Notification.permission = 'denied';

      showDesktopNotification('Test', { body: 'Message' });

      expect(NotificationConstructor).not.toHaveBeenCalled();
    });

    it('should not show notification when API is not supported', () => {
      delete (global as any).Notification;

      expect(() => {
        showDesktopNotification('Test', { body: 'Message' });
      }).not.toThrow();
    });

    it('should handle notification click events', () => {
      global.Notification.permission = 'granted';
      const mockNotification = {
        close: vi.fn(),
        addEventListener: vi.fn(),
      };
      global.Notification = vi.fn().mockReturnValue(mockNotification) as any;
      global.Notification.permission = 'granted';

      const onClick = vi.fn();
      showDesktopNotification('Test', { 
        body: 'Message',
        onClick 
      });

      expect(mockNotification.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should auto-close notification after timeout', () => {
      vi.useFakeTimers();
      
      global.Notification.permission = 'granted';
      const mockNotification = {
        close: vi.fn(),
        addEventListener: vi.fn(),
      };
      global.Notification = vi.fn().mockReturnValue(mockNotification) as any;
      global.Notification.permission = 'granted';

      showDesktopNotification('Test', { 
        body: 'Message',
        autoClose: 3000 
      });

      expect(mockNotification.close).not.toHaveBeenCalled();

      vi.advanceTimersByTime(3000);

      expect(mockNotification.close).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
