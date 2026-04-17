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

const mediaPreviewDialogMock = vi.fn(() => null);

vi.mock('../../components/media/MediaPreviewDialog', () => ({
  MediaPreviewDialog: (props: unknown) => mediaPreviewDialogMock(props),
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
    mediaPreviewDialogMock.mockClear();
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

  it('opens the editor when editing a scheduled post card', () => {
    const onNavigate = vi.fn();

    useComposeStore.setState({
      items: [
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
        <ComposeActivityPage onNavigate={onNavigate} previousPage="create" />
      </BackNavigationProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(useComposeStore.getState().activeItemId).toBe('scheduled-post');
    expect(onNavigate).toHaveBeenCalledWith('compose-editor', 'create');
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

  it('prefers the authorized preview URL for published media thumbnails and preview dialog items', () => {
    useComposeStore.setState({
      items: [
        {
          id: 'published-post',
          title: 'Published trailer',
          status: 'published',
          mediaAssets: [
            {
              id: 'asset-1',
              kind: 'video',
              fileName: 'trailer.mp4',
              mimeType: 'video/mp4',
              size: 1024,
              order: 0,
              previewUrl: 'https://f005.backblazeb2.com/file/ScrendlyVideos/compose/videos/trailer.mp4?Authorization=fresh-token',
              storageUrl: 'https://f005.backblazeb2.com/file/ScrendlyVideos/compose/videos/trailer.mp4',
              uploadStatus: 'uploaded',
            },
          ],
          platforms: ['threads'],
          sharedCaption: '',
          platformFields: {},
          createdAt: '2026-03-12T07:00:00.000Z',
          updatedAt: '2026-03-12T08:00:00.000Z',
        },
      ],
      activeItemId: null,
    });

    const { container } = render(
      <BackNavigationProvider>
        <ComposeActivityPage onNavigate={vi.fn()} previousPage="create" />
      </BackNavigationProvider>,
    );

    const thumbnail = container.querySelector('video');
    expect(thumbnail).toHaveAttribute(
      'src',
      'https://f005.backblazeb2.com/file/ScrendlyVideos/compose/videos/trailer.mp4?Authorization=fresh-token',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preview video trailer.mp4' }));

    const lastCall = mediaPreviewDialogMock.mock.lastCall?.[0] as { mediaItems?: Array<{ src: string }> } | undefined;
    expect(lastCall?.mediaItems?.[0]?.src).toBe(
      'https://f005.backblazeb2.com/file/ScrendlyVideos/compose/videos/trailer.mp4?Authorization=fresh-token',
    );
  });
});
