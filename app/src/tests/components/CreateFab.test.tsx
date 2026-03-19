import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CreateFab } from '../../components/CreateFab';

vi.mock('../../contexts/KeyboardContext', () => ({
  useKeyboard: () => ({
    isInputFocused: false,
  }),
}));

vi.mock('../../utils/haptics', () => ({
  haptics: {
    medium: vi.fn(),
  },
}));

const originalRequestAnimationFrame = window.requestAnimationFrame;

describe('CreateFab', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 0,
    });
    window.requestAnimationFrame = (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0) as unknown as number;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    vi.useRealTimers();
  });

  it('returns to visible after scroll direction becomes idle', async () => {
    render(
      <CreateFab
        currentPage="dashboard"
        isPostFlowOpen={false}
        isSettingsOpen={false}
        isNotificationsOpen={false}
        onOpenPostFlow={vi.fn()}
      />,
    );

    const fab = screen.getByRole('button', { name: 'Open Posts' });
    expect(fab.className).toContain('translate-y-0');
    expect(fab.className).toContain('opacity-100');

    act(() => {
      window.scrollY = 120;
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(1);
    });

    expect(fab.className).toContain('translate-y-24');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(fab.className).toContain('translate-y-0');
    expect(fab.className).toContain('opacity-100');
  });
});
