import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComposeEditorPage } from '../../components/create/ComposeEditorPage';
import { useComposeStore } from '../../store/useComposeStore';

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: toastMock,
}));

vi.mock('../../contexts/NotificationsContext', () => ({
  useNotifications: () => ({
    addNotification: vi.fn(),
  }),
}));

const settingsMock = {
  videoOpenaiModel: 'gpt-5-mini',
  videoUniversalCaptionPrompt: 'caption prompt',
  videoYoutubeTitlePrompt: 'youtube title prompt',
  videoYoutubeDescriptionPrompt: 'youtube description prompt',
  videoYoutubePlaylistPrompt: 'playlist prompt',
  videoReviewPrompt: 'review prompt',
  videoSummaryPrompt: 'summary prompt',
};

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: settingsMock,
  }),
}));

vi.mock('../../utils/haptics', () => ({
  haptics: {
    light: vi.fn(),
    medium: vi.fn(),
    selection: vi.fn(),
  },
}));

vi.mock('../../utils/platformConnections', () => ({
  getConnectedPlatforms: () => ['x', 'instagram'],
}));

vi.mock('../../hooks/useBackEntry', () => ({
  useBackEntry: vi.fn(),
}));

vi.mock('../../hooks/useUnsavedBackGuard', () => ({
  useUnsavedBackGuard: () => ({
    isPromptOpen: false,
    guardAction: (action: () => void) => {
      action();
      return true;
    },
    prompt: null,
  }),
}));

const generateComposeContentMock = vi.fn();
const generateComposeThumbnailMock = vi.fn();

vi.mock('../../lib/api/ai', () => ({
  generateComposeContent: (...args: unknown[]) => generateComposeContentMock(...args),
  generateComposeThumbnail: (...args: unknown[]) => generateComposeThumbnailMock(...args),
}));

const fetchYouTubePlaylistsMock = vi.fn();

vi.mock('../../lib/api/youtube', () => ({
  fetchYouTubePlaylists: () => fetchYouTubePlaylistsMock(),
}));

vi.mock('../../components/BackIconButton', () => ({
  BackIconButton: ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      Back
    </button>
  ),
}));

vi.mock('../../components/media/MediaPreviewDialog', () => ({
  MediaPreviewDialog: () => null,
}));

vi.mock('../../components/PageLoader', () => ({
  PageLoader: () => null,
  RedSpinner: () => null,
}));

vi.mock('../../components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type = 'button',
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('../../components/ui/input', () => ({
  Input: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
  }) => (
    <input
      value={value}
      onChange={(event) => onChange?.({ target: { value: event.target.value } })}
    />
  ),
}));

vi.mock('../../components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label={placeholder ?? 'textarea'}
      value={value}
      onChange={(event) => onChange?.({ target: { value: event.target.value } })}
    />
  ),
}));

vi.mock('../../components/ui/label', () => ({
  Label: ({ children }: { children: ReactNode }) => <label>{children}</label>,
}));

vi.mock('../../components/ui/slider', () => ({
  Slider: () => <div />,
}));

vi.mock('../../components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => <div />,
}));

vi.mock('../../components/ui/bottom-sheet', () => ({
  BottomSheet: ({
    children,
    onOpenChange,
    open,
  }: {
    children: ReactNode;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) => (open ? (
    <div data-testid="schedule-sheet">
      <button type="button" onClick={() => onOpenChange(false)}>
        Dismiss Sheet
      </button>
      {children}
    </div>
  ) : null),
  BottomSheetBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BottomSheetDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BottomSheetFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BottomSheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BottomSheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../components/ui/date-picker', () => ({
  DatePicker: ({
    date,
    onDateChange,
    onOpenChange,
  }: {
    date?: Date;
    onDateChange?: (date: Date | undefined) => void;
    onOpenChange?: (open: boolean) => void;
  }) => {
    const [open, setOpen] = useState(false);

    return (
      <div>
        <div>{date ? date.toDateString() : 'No date'}</div>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            onOpenChange?.(true);
          }}
        >
          Open Date Picker
        </button>
        {open ? (
          <button
            type="button"
            onClick={() => {
              onDateChange?.(new Date(2026, 3, 3));
              setOpen(false);
              onOpenChange?.(false);
            }}
          >
            Done Date
          </button>
        ) : null}
      </div>
    );
  },
}));

vi.mock('../../components/ui/time-picker', () => ({
  TimePicker: ({
    value,
    onChange,
    onOpenChange,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    onOpenChange?: (open: boolean) => void;
  }) => {
    const [open, setOpen] = useState(false);

    return (
      <div>
        <div>{value}</div>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            onOpenChange?.(true);
          }}
        >
          Open Time Picker
        </button>
        {open ? (
          <button
            type="button"
            onClick={() => {
              onChange?.('14:45');
              setOpen(false);
              onOpenChange?.(false);
            }}
          >
            Done Time
          </button>
        ) : null}
      </div>
    );
  },
}));

describe('ComposeEditorPage scheduling', () => {
  beforeEach(() => {
    useComposeStore.setState({
      items: [],
      activeItemId: null,
      lastModifiedAt: null,
    });
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    generateComposeContentMock.mockReset();
    generateComposeThumbnailMock.mockReset();
    fetchYouTubePlaylistsMock.mockReset();
    fetchYouTubePlaylistsMock.mockResolvedValue([]);
  });

  it('keeps the schedule sheet open while a nested picker is active and saves the updated schedule', () => {
    useComposeStore.setState({
      items: [
        {
          id: 'draft-post',
          title: 'Trailer drop',
          status: 'draft',
          mediaAssets: [
            {
              id: 'asset-1',
              kind: 'image',
              fileName: 'poster.jpg',
              mimeType: 'image/jpeg',
              size: 1024,
              order: 0,
              previewUrl: 'https://cdn.example.com/poster.jpg',
              storageUrl: 'https://cdn.example.com/poster.jpg',
              uploadStatus: 'uploaded',
            },
          ],
          platforms: ['x'],
          sharedCaption: 'New trailer tonight',
          platformFields: {},
          createdAt: '2026-03-27T09:00:00.000Z',
          updatedAt: '2026-03-27T09:00:00.000Z',
        },
      ],
      activeItemId: 'draft-post',
      lastModifiedAt: '2026-03-27T09:00:00.000Z',
    });

    const onNavigate = vi.fn();

    render(
      <ComposeEditorPage
        onNavigate={onNavigate}
        previousPage="create"
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Schedule' })[0]);
    expect(screen.getByText('Schedule Post')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Date Picker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Sheet' }));
    expect(screen.getByText('Schedule Post')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done Date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Time Picker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done Time' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Schedule' })[1]);

    const scheduledItem = useComposeStore.getState().items.find((item) => item.id === 'draft-post');
    const expectedScheduledAt = new Date(2026, 3, 3);
    expectedScheduledAt.setHours(14, 45, 0, 0);

    expect(scheduledItem?.status).toBe('scheduled');
    expect(scheduledItem?.scheduledAt).toBe(expectedScheduledAt.toISOString());
    expect(onNavigate).toHaveBeenCalledWith('create', 'create');
    expect(screen.queryByTestId('schedule-sheet')).not.toBeInTheDocument();
  }, 60000);

  it('blocks scheduling when a caption-required platform is selected but the caption is empty', () => {
    useComposeStore.setState({
      items: [
        {
          id: 'draft-post',
          title: 'Trailer drop',
          status: 'draft',
          mediaAssets: [
            {
              id: 'asset-1',
              kind: 'image',
              fileName: 'poster.jpg',
              mimeType: 'image/jpeg',
              size: 1024,
              order: 0,
              previewUrl: 'https://cdn.example.com/poster.jpg',
              storageUrl: 'https://cdn.example.com/poster.jpg',
              uploadStatus: 'uploaded',
            },
          ],
          platforms: ['x'],
          sharedCaption: '',
          platformFields: {},
          createdAt: '2026-03-27T09:00:00.000Z',
          updatedAt: '2026-03-27T09:00:00.000Z',
        },
      ],
      activeItemId: 'draft-post',
      lastModifiedAt: '2026-03-27T09:00:00.000Z',
    });

    render(
      <ComposeEditorPage
        onNavigate={vi.fn()}
        previousPage="create"
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Schedule' })[0]);
    const confirmScheduleButton = screen.getAllByRole('button', { name: 'Schedule' })[1];

    expect(screen.getByText('Enter a caption before scheduling or publishing to the selected platforms')).toBeInTheDocument();
    expect(confirmScheduleButton).toBeDisabled();
    expect(useComposeStore.getState().items[0]?.status).toBe('draft');
  }, 60000);

  it('blocks publishing when a caption-required platform is selected but the caption is empty', () => {
    useComposeStore.setState({
      items: [
        {
          id: 'draft-post',
          title: 'Trailer drop',
          status: 'draft',
          mediaAssets: [
            {
              id: 'asset-1',
              kind: 'image',
              fileName: 'poster.jpg',
              mimeType: 'image/jpeg',
              size: 1024,
              order: 0,
              previewUrl: 'https://cdn.example.com/poster.jpg',
              storageUrl: 'https://cdn.example.com/poster.jpg',
              uploadStatus: 'uploaded',
            },
          ],
          platforms: ['x'],
          sharedCaption: '',
          platformFields: {},
          createdAt: '2026-03-27T09:00:00.000Z',
          updatedAt: '2026-03-27T09:00:00.000Z',
        },
      ],
      activeItemId: 'draft-post',
      lastModifiedAt: '2026-03-27T09:00:00.000Z',
    });

    render(
      <ComposeEditorPage
        onNavigate={vi.fn()}
        previousPage="create"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(toastMock.error).toHaveBeenCalledWith('Enter a caption before scheduling or publishing to the selected platforms');
    expect(useComposeStore.getState().items[0]?.status).toBe('draft');
  }, 60000);

  it('fills shared and youtube fields from a direct AI request when YouTube is selected', async () => {
    useComposeStore.setState({
      items: [
        {
          id: 'youtube-post',
          title: 'Matrix review',
          status: 'draft',
          mediaAssets: [],
          sourceMetadata: '',
          platforms: ['youtube_longform'],
          sharedCaption: '',
          platformFields: {
            youtube: {
              title: '',
              description: '',
              playlist: '',
            },
          },
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-01T09:00:00.000Z',
        },
      ],
      activeItemId: 'youtube-post',
      lastModifiedAt: '2026-04-01T09:00:00.000Z',
    });

    fetchYouTubePlaylistsMock.mockResolvedValue([
      { id: 'playlist-1', title: 'Movie Reviews' },
    ]);

    generateComposeContentMock.mockResolvedValue({
      success: true,
      data: {
        intentResult: {
          intent: 'review_generation',
          outputMode: 'post_fields',
          format: 'short_form_video',
          durationSeconds: 60,
          directFieldFillAllowed: true,
          detectedTitle: 'The Matrix',
          containsMetadata: false,
        },
        mediaMetadata: {
          title: 'The Matrix',
          year: 1999,
          mediaType: 'movie',
          cast: ['Keanu Reeves'],
          director: '',
          creator: '',
          studio: '',
          platform: '',
          releaseDate: '',
          synopsis: '',
          producers: [],
          franchise: 'The Matrix',
          tone: 'sci-fi',
          sourceType: 'title_only_request',
        },
        postFields: {
          sharedCaption: 'The Matrix still feels razor-sharp 60 seconds later.',
          youtubeTitle: 'The Matrix Review in 60 Seconds',
          youtubeDescription: 'A quick review of The Matrix.',
          playlistSelection: {
            playlistId: 'playlist-1',
            playlistName: 'Movie Reviews',
            reason: 'Best fit',
            confidence: 0.91,
          },
        },
        editorialResult: {
          type: null,
          text: '',
        },
      },
    });

    render(
      <ComposeEditorPage
        onNavigate={vi.fn()}
        previousPage="create"
      />,
    );

    fireEvent.change(
      screen.getByLabelText(/Paste metadata or type a request/i),
      { target: { value: 'Give me a review for The Matrix for 60 seconds video' } },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Generate content' }));

    await waitFor(() => {
      expect(generateComposeContentMock).toHaveBeenCalled();
    });

    expect(screen.getByDisplayValue('The Matrix still feels razor-sharp 60 seconds later.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('The Matrix Review in 60 Seconds')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A quick review of The Matrix.')).toBeInTheDocument();
    expect(screen.getByText('Review • Direct fill')).toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith('Content generated. Playlist matched: Best fit');
  });

  it('shows a preview card for standalone review requests instead of overwriting the shared caption', async () => {
    useComposeStore.setState({
      items: [
        {
          id: 'preview-post',
          title: 'Preview mode',
          status: 'draft',
          mediaAssets: [],
          sourceMetadata: '',
          platforms: ['instagram_feed'],
          sharedCaption: 'Keep this caption',
          platformFields: {},
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-01T09:00:00.000Z',
        },
      ],
      activeItemId: 'preview-post',
      lastModifiedAt: '2026-04-01T09:00:00.000Z',
    });

    generateComposeContentMock.mockResolvedValue({
      success: true,
      data: {
        intentResult: {
          intent: 'review_generation',
          outputMode: 'preview_only',
          format: 'general',
          durationSeconds: null,
          directFieldFillAllowed: false,
          detectedTitle: 'The Matrix',
          containsMetadata: false,
        },
        mediaMetadata: {
          title: 'The Matrix',
          year: 1999,
          mediaType: 'movie',
          cast: [],
          director: '',
          creator: '',
          studio: '',
          platform: '',
          releaseDate: '',
          synopsis: '',
          producers: [],
          franchise: '',
          tone: 'sci-fi',
          sourceType: 'title_only_request',
        },
        postFields: {
          sharedCaption: '',
          youtubeTitle: '',
          youtubeDescription: '',
          playlistSelection: {
            playlistId: null,
            playlistName: null,
            reason: 'Preview-only request; no direct playlist mapping applied.',
            confidence: 0,
          },
        },
        editorialResult: {
          type: 'review',
          text: 'The Matrix is still one of the cleanest sci-fi action movies ever made.',
        },
      },
    });

    render(
      <ComposeEditorPage
        onNavigate={vi.fn()}
        previousPage="create"
      />,
    );

    fireEvent.change(
      screen.getByLabelText(/Paste metadata or type a request/i),
      { target: { value: 'Write me a review of The Matrix' } },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Generate content' }));

    await waitFor(() => {
      expect(screen.getByText('Generated Review')).toBeInTheDocument();
    });

    expect(screen.getByText('The Matrix is still one of the cleanest sci-fi action movies ever made.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Keep this caption')).toBeInTheDocument();
  });
});
