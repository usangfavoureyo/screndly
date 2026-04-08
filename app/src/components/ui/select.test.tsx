import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

const bottomSheetMock = vi.fn(
  ({
    open,
    children,
  }: {
    open: boolean;
    children: ReactNode;
  }) => (open ? <div data-testid="mock-bottom-sheet">{children}</div> : null),
);

vi.mock('./bottom-sheet', () => ({
  BottomSheet: (props: unknown) => bottomSheetMock(props),
}));

describe('Select', () => {
  it('renders dropdown content without transient history sheets', () => {
    render(
      <Select defaultValue="jpeg">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="jpeg">JPEG</SelectItem>
          <SelectItem value="png">PNG</SelectItem>
        </SelectContent>
      </Select>,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByTestId('mock-bottom-sheet')).toBeInTheDocument();
    expect(bottomSheetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        disableTransientHistory: true,
      }),
    );
  });
});
