import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NotificationsProvider,
  type Notification,
  useNotifications,
} from '../../contexts/NotificationsContext';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

const desktopNotificationsMock = vi.hoisted(() => ({
  show: vi.fn(),
}));

vi.mock('../../lib/api/client', () => ({
  apiClient: apiClientMock,
}));

vi.mock('../../utils/desktopNotifications', () => ({
  desktopNotifications: desktopNotificationsMock,
}));

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      desktopNotifications: false,
    },
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationsProvider>{children}</NotificationsProvider>
);

function createNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: overrides.id ?? 'notification-1',
    type: overrides.type ?? 'info',
    title: overrides.title ?? 'Notification',
    message: overrides.message ?? 'Body',
    timestamp: overrides.timestamp ?? '2026-03-12T00:00:00.000Z',
    read: overrides.read ?? false,
    source: overrides.source ?? 'system',
    actionPage: overrides.actionPage,
  };
}

describe('NotificationsContext', () => {
  let backendNotifications: Notification[];

  beforeEach(() => {
    backendNotifications = [];
    vi.clearAllMocks();

    apiClientMock.get.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/api/notifications') {
        return { success: true, data: [...backendNotifications] };
      }

      return { success: true, data: null };
    });

    apiClientMock.post.mockImplementation(async (endpoint: string, payload?: Partial<Notification>) => {
      if (endpoint === '/api/notifications' && payload) {
        const created = createNotification({
          id: `notification-${backendNotifications.length + 1}`,
          ...payload,
        });
        backendNotifications = [created, ...backendNotifications];
        return { success: true, data: created };
      }

      if (endpoint === '/api/notifications/mark-all-read') {
        backendNotifications = backendNotifications.map((notification) => ({
          ...notification,
          read: true,
        }));
        return { success: true, data: null };
      }

      return { success: true, data: null };
    });

    apiClientMock.put.mockImplementation(async (endpoint: string, updates: Partial<Notification>) => {
      const notificationId = endpoint.split('/').pop()!;
      backendNotifications = backendNotifications.map((notification) =>
        notification.id === notificationId ? { ...notification, ...updates } : notification
      );
      return { success: true, data: null };
    });

    apiClientMock.delete.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/api/notifications') {
        backendNotifications = [];
        return { success: true, data: null };
      }

      const notificationId = endpoint.split('/').pop()!;
      backendNotifications = backendNotifications.filter((notification) => notification.id !== notificationId);
      return { success: true, data: null };
    });
  });

  it('loads notifications from the backend on mount', async () => {
    backendNotifications = [createNotification({ id: 'notification-loaded', title: 'Loaded notification' })];

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].title).toBe('Loaded notification');
  });

  it('adds a notification optimistically and syncs it with the backend', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addNotification({
        title: 'Test Notification',
        message: 'This is a test',
        type: 'success',
        source: 'system',
      });
    });

    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    expect(result.current.notifications[0].title).toBe('Test Notification');
    expect(result.current.unreadCount).toBe(1);
    expect(apiClientMock.post).toHaveBeenCalledWith(
      '/api/notifications',
      expect.objectContaining({
        title: 'Test Notification',
        message: 'This is a test',
      })
    );
  });

  it('marks a notification as read', async () => {
    backendNotifications = [createNotification({ id: 'notification-read', read: false })];

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => {
      await result.current.markAsRead('notification-read');
    });

    expect(result.current.notifications[0].read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('marks all notifications as read', async () => {
    backendNotifications = [
      createNotification({ id: 'notification-1', read: false }),
      createNotification({ id: 'notification-2', read: false }),
    ];

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((notification) => notification.read)).toBe(true);
  });

  it('deletes a notification', async () => {
    backendNotifications = [createNotification({ id: 'notification-delete' })];

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => {
      await result.current.deleteNotification('notification-delete');
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('clears all notifications', async () => {
    backendNotifications = [
      createNotification({ id: 'notification-1' }),
      createNotification({ id: 'notification-2' }),
    ];

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    await act(async () => {
      await result.current.clearAll();
    });

    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });

  it('assigns unique IDs when multiple notifications are added quickly', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addNotification({
        title: 'First',
        message: 'One',
        type: 'info',
        source: 'system',
      });
      await result.current.addNotification({
        title: 'Second',
        message: 'Two',
        type: 'info',
        source: 'system',
      });
    });

    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    const ids = result.current.notifications.map((notification) => notification.id);
    expect(new Set(ids).size).toBe(2);
  });
});
