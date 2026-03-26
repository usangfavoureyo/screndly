import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BackNavigationProvider } from '../../contexts/BackNavigationContext';
import { ComposeOverview } from '../../components/create/ComposeOverview';
import { useComposeStore } from '../../store/useComposeStore';

vi.mock('../../contexts/NotificationsContext', () => ({
  useNotifications: () => ({
    addNotification: vi.fn(),
  }),
}));

vi.mock('../../utils/haptics', () => ({
  haptics: {
    light: vi.fn(),
    medium: vi.fn(),
  },
}));

vi.mock('../../components/SwipeableActivityCard', () => ({
  SwipeableActivityCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../components/media/MediaPreviewDialog', () => ({
  MediaPreviewDialog: () => null,
}));

vi.mock('../../components/ui/date-picker', () => ({
  DatePicker: () => <div />,
}));

vi.mock('../../components/ui/time-picker', () => ({
  TimePicker: () => <div />,
}));

vi.mock('../../components/ui/bottom-sheet', () => ({
  BottomSheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BottomSheetBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BottomSheetDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BottomSheetFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BottomSheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BottomSheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('ComposeOverview', () => {
  beforeEach(() => {
    useComposeStore.setState({ items: [], activeItemId: null });
  });

  it('shows only draft items on the post overview page', () => {
    useComposeStore.setState({
      items: [
        {
          id: 'draft-post',
          title: 'Draft title',
          status: 'draft',
          mediaAssets: [],
          platforms: ['instagram'],
          sharedCaption: '',
          platformFields: {},
          createdAt: '2026-03-12T07:00:00.000Z',
          updatedAt: '2026-03-12T08:00:00.000Z',
        },
        {
          id: 'scheduled-post',
          title: 'Scheduled title',
          status: 'scheduled',
          mediaAssets: [],
          platforms: ['x'],
          sharedCaption: '',
          platformFields: {},
          createdAt: '2026-03-12T07:00:00.000Z',
          updatedAt: '2026-03-12T08:00:00.000Z',
          scheduledAt: '2026-03-13T09:00:00.000Z',
        },
        {
          id: 'published-post',
          title: 'Published title',
          status: 'published',
          mediaAssets: [],
          platforms: ['youtube'],
          sharedCaption: '',
          platformFields: {},
          createdAt: '2026-03-12T07:00:00.000Z',
          updatedAt: '2026-03-12T08:00:00.000Z',
        },
      ],
      activeItemId: null,
    });

    render(
      <BackNavigationProvider>
        <ComposeOverview onNavigate={vi.fn()} />
      </BackNavigationProvider>,
    );

    expect(screen.getByText('Draft title')).toBeInTheDocument();
    expect(screen.queryByText('Scheduled title')).not.toBeInTheDocument();
    expect(screen.queryByText('Published title')).not.toBeInTheDocument();
  });

  it('navigates to add post on click without using touchstart as a separate navigation path', () => {
    const onNavigate = vi.fn();

    render(
      <BackNavigationProvider>
        <ComposeOverview onNavigate={onNavigate} />
      </BackNavigationProvider>,
    );

    const addPostButton = screen.getByRole('button', { name: 'Add Post' });

    fireEvent.touchStart(addPostButton);
    expect(onNavigate).not.toHaveBeenCalled();

    fireEvent.click(addPostButton);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('compose-editor', 'create');
  });
});
