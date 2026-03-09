import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSettings } from './SettingsContext';
import { desktopNotifications } from '../utils/desktopNotifications';
import { apiClient } from '../lib/api/client';

export type NotificationSource =
  | 'upload'
  | 'rss'
  | 'tmdb'
  | 'videostudio'
  | 'system'
  | 'design_studio'
  | 'youtube'
  | 'comment';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  source: NotificationSource;
  actionPage?: string;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  addNotification: (notification: {
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    source: NotificationSource;
    actionPage?: string;
  }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  deleteNotification: (id: string) => Promise<void>;
  removeNotificationLocal: (id: string) => void;
  restoreNotification: (notification: Notification, index?: number) => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

function normalizeSource(source: string | undefined): NotificationSource {
  if (source === 'video_studio') return 'videostudio';
  if (source === 'design_studio') return 'design_studio';
  if (source === 'youtube') return 'youtube';
  if (source === 'comment') return 'comment';
  if (source === 'upload' || source === 'rss' || source === 'tmdb' || source === 'videostudio' || source === 'system') {
    return source;
  }
  return 'system';
}

function formatNotificationTimestamp(value?: string | Date): string {
  if (!value) return new Date().toLocaleString();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toLocaleString();
  return date.toLocaleString();
}

function normalizeNotification(notification: any): Notification {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    timestamp: formatNotificationTimestamp(notification.timestamp || notification.createdAt),
    read: Boolean(notification.read),
    source: normalizeSource(notification.source),
    actionPage: notification.actionPage || undefined,
  };
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { settings } = useSettings();

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await apiClient.get<Notification[]>('/api/notifications');
      if (response.success && response.data) {
        setNotifications(response.data.map(normalizeNotification));
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchNotifications();

    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const addNotification = async (notification: {
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    source: NotificationSource;
    actionPage?: string;
  }) => {
    // Optimistic update
    const tempId = Date.now().toString();
    const newNotification: Notification = {
      id: tempId,
      ...notification,
      timestamp: formatNotificationTimestamp(new Date()),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Trigger desktop notification if enabled
    if (settings.desktopNotifications) {
      desktopNotifications.show(notification.title, notification.message);
    }

    try {
      await apiClient.post('/api/notifications', notification);
      // Refresh to get the real ID from server (optional, but good for consistency)
      fetchNotifications();
    } catch (error) {
      console.error('Failed to create notification on server:', error);
    }
  };

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );

    try {
      await apiClient.put(`/api/notifications/${id}`, { read: true });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    // Optimistic update
    const previous = notifications;
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));

    try {
      const response = await apiClient.post('/api/notifications/mark-all-read');
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to mark notifications as read');
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      setNotifications(previous);
    }
  };

  const deleteNotification = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.filter(notif => notif.id !== id));

    try {
      const response = await apiClient.delete(`/api/notifications/${id}`);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete notification');
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
      throw error;
    }
  };

  const removeNotificationLocal = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const restoreNotification = (notification: Notification, index = 0) => {
    setNotifications(prev => {
      if (prev.some((item) => item.id === notification.id)) {
        return prev;
      }

      const next = [...prev];
      const targetIndex = Math.max(0, Math.min(index, next.length));
      next.splice(targetIndex, 0, notification);
      return next;
    });
  };

  const clearAll = async () => {
    // Optimistic update
    const previous = notifications;
    setNotifications([]);

    try {
      const response = await apiClient.delete('/api/notifications');
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to clear notifications');
      }
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      setNotifications(previous);
    }
  };

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        deleteNotification,
        removeNotificationLocal,
        restoreNotification,
        refreshNotifications: fetchNotifications
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
