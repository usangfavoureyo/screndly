import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSettings } from './SettingsContext';
import { desktopNotifications } from '../utils/desktopNotifications';
import { apiClient } from '../lib/api/client';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  source: 'upload' | 'rss' | 'tmdb' | 'videostudio' | 'system' | 'design_studio';
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
    source: 'upload' | 'rss' | 'tmdb' | 'videostudio' | 'system';
    actionPage?: string;
  }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  deleteNotification: (id: string) => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { settings } = useSettings();

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await apiClient.get<Notification[]>('/api/notifications');
      if (response.success && response.data) {
        setNotifications(response.data);
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
    source: 'upload' | 'rss' | 'tmdb' | 'videostudio' | 'system';
    actionPage?: string;
  }) => {
    // Optimistic update
    const tempId = Date.now().toString();
    const newNotification: Notification = {
      id: tempId,
      ...notification,
      timestamp: new Date().toISOString(),
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
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );

    // We would need a bulk update endpoint, but for now we'll just loop or assume client state is enough until refresh
    // Ideally: await apiClient.post('/api/notifications/mark-all-read');
  };

  const deleteNotification = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.filter(notif => notif.id !== id));

    try {
      await apiClient.delete(`/api/notifications/${id}`);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const clearAll = async () => {
    // Optimistic update
    setNotifications([]);
    // Ideally: await apiClient.delete('/api/notifications');
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
