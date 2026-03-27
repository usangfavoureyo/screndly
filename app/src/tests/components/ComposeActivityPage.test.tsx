import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComposeActivityPage } from '../../components/create/ComposeActivityPage';
import { BackNavigationProvider } from '../../contexts/BackNavigationContext';
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

describe('ComposeActivityPage', () => {
  beforeEach(() => {
    useComposeStore.setState({ items: [], activeItemId: null });
  });

  it('shows an edit action for scheduled post cards', () => {
    useComposeStore.setState({
      items: [
        {
          id: 'draft-post',
          title: 'Draft article',
          status: 'draft',
          mediaAssets: [],
          platforms: ['x'],
          sharedCaption: '',
          platformFields: {},
          createdAt: '2026-03-12T07:00:00.000Z',
          updatedAt: '2026-03-12T08:00:00.000Z',
        },
        {
          id: 'scheduled-post',
          title: 'Campaign poster',
          status: 'scheduled',
          mediaAssets: [],
          platforms: ['instagram_feed'],
          sharedCaption: '',
          platformFields: {},
          createdAt: '2026-03-12T07:00:00.000Z',
          updatedAt: '2026-03-12T08:00:00.000Z',
          scheduledAt: '2026-03-13T09:00:00.000Z',
        },
      ],
      activeItemId: null,
    });

    render(
      <BackNavigationProvider>
        <ComposeActivityPage onNavigate={vi.fn()} previousPage="create" />
      </BackNavigationProvider>,
    );

    expect(screen.getByText('Draft article')).toBeInTheDocument();
    expect(screen.getByText('Campaign poster')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Schedule' })).not.toBeInTheDocument();
  });

  it('routes draft scheduling through the editor instead of an inline schedule sheet', () => {
    const onNavigate = vi.fn();

    useComposeStore.setState({
      items: [
        {
          id: 'draft-post',
          title: 'Draft article',
          status: 'draft',
          mediaAssets: [
            {
              id: 'asset-1',
              kind: 'image',
              fileName: 'poster.jpg',
              mimeType: 'image/jpeg',
              size: 1024,
              order: 0,
              storageUrl: 'https://cdn.example.com/poster.jpg',
              uploadStatus: 'uploaded',
            },
          ],
          platforms: ['instagram_feed'],
          sharedCaption: 'Caption ready',
          platformFields: {},
          createdAt: '2026-03-12T07:00:00.000Z',
          updatedAt: '2026-03-12T08:00:00.000Z',
        },
      ],
      activeItemId: null,
    });

    render(
      <BackNavigationProvider>
        <ComposeActivityPage onNavigate={onNavigate} previousPage="create" />
      </BackNavigationProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));

    expect(onNavigate).toHaveBeenCalledWith('compose-editor', 'create');
    expect(screen.queryByText('Schedule Post')).not.toBeInTheDocument();
  });
});
