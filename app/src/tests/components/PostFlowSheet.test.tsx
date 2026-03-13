import { useEffect, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PostFlowSheet } from '../../components/create/PostFlowSheet';

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
    <div>
      <button type="button" onClick={() => onOpenChange(false)}>
        Close Sheet
      </button>
      {children}
    </div>
  ) : null),
}));

vi.mock('../../components/create/ComposeOverview', () => ({
  ComposeOverview: ({ onNavigate }: { onNavigate: (page: string) => void }) => (
    <div>
      <p>Overview</p>
      <button type="button" onClick={() => onNavigate('compose-activity')}>
        Open Activity
      </button>
      <button type="button" onClick={() => onNavigate('compose-editor')}>
        Open Editor
      </button>
    </div>
  ),
}));

vi.mock('../../components/create/ComposeActivityPage', () => ({
  ComposeActivityPage: ({
    onNavigate,
    previousPage,
  }: {
    onNavigate: (page: string) => void;
    previousPage?: string | null;
  }) => (
    <div>
      <p>Activity</p>
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
    onNavigate,
    previousPage,
    registerCloseRequestHandler,
  }: {
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
        <button type="button" onClick={() => onNavigate(previousPage || 'create')}>
          Editor Back
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

    fireEvent.click(screen.getByRole('button', { name: 'Close Sheet' }));
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(handleOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close Sheet' }));
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(handleOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close Sheet' }));
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
