import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { NotificationPanel } from '../../components/NotificationPanel';

const registerModalWithCloseHandler = vi.fn();
const unregisterModal = vi.fn();
const useTransientHistoryStateMock = vi.fn();
const apiGetMock = vi.fn();

vi.mock('../../contexts/BackNavigationContext', () => ({
  useBackNavigation: () => ({
    registerModalWithCloseHandler,
    unregisterModal,
  }),
  useOptionalBackNavigation: () => ({
    registerModalWithCloseHandler,
    unregisterModal,
  }),
}));

vi.mock('../../hooks/useTransientHistoryState', () => ({
  useTransientHistoryState: (...args: unknown[]) => useTransientHistoryStateMock(...args),
}));

vi.mock('../../utils/haptics', () => ({
  haptics: {
    light: vi.fn(),
    medium: vi.fn(),
  },
}));

vi.mock('../../store/useComposeStore', () => ({
  useComposeStore: (selector: (state: { items: never[] }) => unknown) => selector({ items: [] }),
}));

vi.mock('../../lib/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

vi.mock('../../components/ActivitySelectionToolbar', () => ({
  ActivitySelectionToolbar: () => null,
}));

vi.mock('../../components/SwipeableNotificationCard', () => ({
  SwipeableNotificationCard: ({
    notification,
    onOpen,
  }: {
    notification: { title: string };
    onOpen: (notification: { title: string }) => void;
  }) => (
    <button type="button" onClick={() => onOpen(notification)}>
      {notification.title}
    </button>
  ),
}));

vi.mock('../../components/PageLoader', () => ({
  PageLoader: () => <div>Loading…</div>,
}));

vi.mock('../../components/ui/bottom-sheet', () => ({
  BottomSheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BottomSheetBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BottomSheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BottomSheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('NotificationPanel', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
    registerModalWithCloseHandler.mockReset();
    unregisterModal.mockReset();
    useTransientHistoryStateMock.mockReset();
    apiGetMock.mockReset();
  });

  it('locks body scroll while open and restores it when closed', () => {
    const { rerender, unmount } = render(
      <NotificationPanel
        isOpen
        onClose={vi.fn()}
        notifications={[]}
        onMarkAsRead={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <NotificationPanel
        isOpen={false}
        onClose={vi.fn()}
        notifications={[]}
        onMarkAsRead={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    expect(document.body.style.overflow).toBe('');

    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('creates a transient history layer when notification detail is open', async () => {
    apiGetMock.mockResolvedValue({
      success: true,
      data: {
        notification: null,
        detail: {
          kind: 'generic',
          actionTarget: null,
          relatedItems: [],
        },
      },
    });

    render(
      <NotificationPanel
        isOpen
        onClose={vi.fn()}
        notifications={[
          {
            id: 'note-1',
            title: 'Test notification',
            message: 'Body',
            type: 'info',
            source: 'system',
            read: false,
            timestamp: '2026-03-27T12:00:00.000Z',
          },
        ]}
        onMarkAsRead={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    expect(useTransientHistoryStateMock).toHaveBeenCalledWith(false, 'notification-detail', 'notification-detail', undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Test notification' }));

    await waitFor(() => {
      expect(useTransientHistoryStateMock).toHaveBeenLastCalledWith(
        true,
        'notification-detail',
        'notification-detail',
        { notificationId: 'note-1' },
      );
    });
  });
});
