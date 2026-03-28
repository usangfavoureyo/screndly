import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
});
