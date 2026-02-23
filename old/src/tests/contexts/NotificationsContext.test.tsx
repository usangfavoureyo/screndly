// ============================================================================
// NOTIFICATIONS CONTEXT TESTS
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { NotificationsProvider, useNotifications } from '../../contexts/NotificationsContext';
import React from 'react';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationsProvider>{children}</NotificationsProvider>
);

describe('NotificationsContext', () => {
  it('should add a notification', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        title: 'Test Notification',
        message: 'This is a test',
        type: 'success',
        source: 'system',
      });
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].title).toBe('Test Notification');
    expect(result.current.unreadCount).toBe(1);
  });

  it('should mark notification as read', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        title: 'Test',
        message: 'Message',
        type: 'info',
        source: 'system',
      });
    });

    const notificationId = result.current.notifications[0].id;

    act(() => {
      result.current.markAsRead(notificationId);
    });

    expect(result.current.notifications[0].read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('should mark all notifications as read', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        title: 'Test 1',
        message: 'Message 1',
        type: 'info',
        source: 'system',
      });
      result.current.addNotification({
        title: 'Test 2',
        message: 'Message 2',
        type: 'info',
        source: 'system',
      });
      result.current.addNotification({
        title: 'Test 3',
        message: 'Message 3',
        type: 'info',
        source: 'system',
      });
    });

    expect(result.current.unreadCount).toBe(3);

    act(() => {
      result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every(n => n.read)).toBe(true);
  });

  it('should delete a notification', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        title: 'Test',
        message: 'Message',
        type: 'info',
        source: 'system',
      });
    });

    const notificationId = result.current.notifications[0].id;

    act(() => {
      result.current.deleteNotification(notificationId);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('should clear all notifications', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        title: 'Test 1',
        message: 'Message 1',
        type: 'info',
        source: 'system',
      });
      result.current.addNotification({
        title: 'Test 2',
        message: 'Message 2',
        type: 'info',
        source: 'system',
      });
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });

  it('should track unread count correctly', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        title: 'Test 1',
        message: 'Message',
        type: 'info',
        source: 'system',
      });
      result.current.addNotification({
        title: 'Test 2',
        message: 'Message',
        type: 'info',
        source: 'system',
      });
      result.current.addNotification({
        title: 'Test 3',
        message: 'Message',
        type: 'info',
        source: 'system',
      });
    });

    expect(result.current.unreadCount).toBe(3);

    act(() => {
      result.current.markAsRead(result.current.notifications[0].id);
    });

    expect(result.current.unreadCount).toBe(2);

    act(() => {
      result.current.markAsRead(result.current.notifications[1].id);
    });

    expect(result.current.unreadCount).toBe(1);
  });

  it('should assign unique IDs to notifications', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        title: 'Test 1',
        message: 'Message',
        type: 'info',
        source: 'system',
      });
      result.current.addNotification({
        title: 'Test 2',
        message: 'Message',
        type: 'info',
        source: 'system',
      });
    });

    const ids = result.current.notifications.map(n => n.id);
    expect(new Set(ids).size).toBe(2); // All IDs should be unique
  });
});
