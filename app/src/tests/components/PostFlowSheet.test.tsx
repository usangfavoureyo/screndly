import { useEffect, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PostFlowSheet } from '../../components/create/PostFlowSheet';

vi.mock('../../components/ui/bottom-sheet', () => ({
  BottomSheet: ({
    children,
    onBackRequest,
    onOpenChange,
    open,
  }: {
    children: ReactNode;
    onBackRequest?: () => boolean;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) => (open ? (
    <div>
      <button
        type="button"
        onClick={() => {
          if (!onBackRequest?.()) {
            onOpenChange(false);
          }
        }}
      >
        Back Request
      </button>
      <button type="button" onClick={() => onOpenChange(false)}>
        Close Sheet
      </button>
      {children}
    </div>
  ) : null),
}));

vi.mock('../../components/ui/sheet', () => ({
  Sheet: ({
    children,
    onOpenChange,
    open,
  }: {
    children: ReactNode;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) => (open ? (
    <div>
      <button type="button" onClick={() => onOpenChange(false)}>
        Close Desktop Sheet
      </button>
      {children}
    </div>
  ) : null),
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../components/create/ComposeOverview', () => ({
  ComposeOverview: ({
    isCompactLayout,
    onNavigate,
  }: {
    isCompactLayout?: boolean;
    onNavigate: (page: string) => void;
  }) => (
    <div>
      <p>Overview</p>
      <p>{isCompactLayout ? 'Compact Overview' : 'Default Overview'}</p>
      <button type="button" onClick={() => onNavigate('compose-activity')}>
        Open Activity
      </button>
      <button type="button" onClick={() => onNavigate('compose-editor')}>
        Open Editor
      </button>
      <button type="button" onClick={() => onNavigate('create', 'compose-activity')}>
        Return To Activity
      </button>
    </div>
  ),
}));

vi.mock('../../components/create/ComposeActivityPage', () => ({
  ComposeActivityPage: ({
    isCompactLayout,
    onNavigate,
    previousPage,
  }: {
    isCompactLayout?: boolean;
    onNavigate: (page: string) => void;
    previousPage?: string | null;
  }) => (
    <div>
      <p>Activity</p>
      <p>{isCompactLayout ? 'Compact Activity' : 'Default Activity'}</p>
      <button type="button" onClick={() => onNavigate('compose-editor')}>
        Open Editor
      </button>
      <button type="button" onClick={() => onNavigate(previousPage || 'create')}>
        Activity Back
      </button>
    </div>
  ),
}));

vi.mock('../../components/create/ComposeEditorPage', () => ({
  ComposeEditorPage: ({
    isCompactLayout,
    onNavigate,
    previousPage,
    registerCloseRequestHandler,
  }: {
    isCompactLayout?: boolean;
    onNavigate: (page: string) => void;
    previousPage?: string | null;
    registerCloseRequestHandler?: (handler: (() => boolean) | null) => void;
  }) => {
    useEffect(() => {
      registerCloseRequestHandler?.(null);

      return () => {
        registerCloseRequestHandler?.(null);
      };
    }, [registerCloseRequestHandler]);

    return (
      <div>
        <p>Editor</p>
        <p>{isCompactLayout ? 'Compact Editor' : 'Default Editor'}</p>
        <button type="button" onClick={() => onNavigate(previousPage || 'create')}>
          Editor Back
        </button>
        <button type="button" onClick={() => onNavigate('create', 'compose-activity')}>
          Return To Activity
        </button>
      </div>
    );
  },
}));

describe('PostFlowSheet', () => {
  it('steps back through activity and overview before closing the sheet', () => {
    const handleOpenChange = vi.fn();

    render(
      <PostFlowSheet
        open
        initialView="overview"
        onOpenChange={handleOpenChange}
      />,
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Activity' }));
    expect(screen.getByText('Activity')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Editor' }));
    expect(screen.getByText('Editor')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editor Back' }));
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(handleOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Activity Back' }));
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(handleOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close Sheet' }));
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('ignores a stale back request immediately after opening the editor', () => {
    const handleOpenChange = vi.fn();

    render(
      <PostFlowSheet
        open
        initialView="overview"
        onOpenChange={handleOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Editor' }));
    expect(screen.getByText('Editor')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back Request' }));
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('uses the same shared editor and overview flow in desktop mode', () => {
    const handleOpenChange = vi.fn();

    render(
      <PostFlowSheet
        open
        initialView="overview"
        isDesktopViewport
        onOpenChange={handleOpenChange}
      />,
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Compact Overview')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Editor' }));
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.getByText('Compact Editor')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close Desktop Sheet' }));
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('returns to activity when the editor closes back to compose activity', () => {
    const handleOpenChange = vi.fn();

    render(
      <PostFlowSheet
        open
        initialView="overview"
        onOpenChange={handleOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Activity' }));
    expect(screen.getByText('Activity')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Editor' }));
    expect(screen.getByText('Editor')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editor Back' }));
    expect(screen.getByText('Activity')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Editor' }));
    expect(screen.getByText('Editor')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Return To Activity' }));
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('fully closes the mobile sheet when swipe-dismiss is triggered from the editor', () => {
    const handleOpenChange = vi.fn();

    render(
      <PostFlowSheet
        open
        initialView="overview"
        onOpenChange={handleOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Editor' }));
    expect(screen.getByText('Editor')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close Sheet' }));
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
