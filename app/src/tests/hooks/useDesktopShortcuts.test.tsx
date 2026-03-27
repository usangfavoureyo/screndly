import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDesktopShortcuts } from '../../hooks/useDesktopShortcuts';

vi.mock('../../utils/haptics', () => ({
  haptics: {
    light: vi.fn(),
  },
}));

function Harness(props: Parameters<typeof useDesktopShortcuts>[0]) {
  useDesktopShortcuts(props);
  return null;
}

describe('useDesktopShortcuts', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'ontouchstart', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: 0,
    });
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'Win32',
    });
  });

  it('uses canonical shell routes for desktop keyboard shortcuts', () => {
    const onNavigate = vi.fn();

    render(
      <Harness
        onNavigate={onNavigate}
        onToggleSettings={vi.fn()}
        onToggleNotifications={vi.fn()}
        currentPage="dashboard"
        isSettingsOpen={false}
        isNotificationsOpen={false}
        onCloseSettings={vi.fn()}
        onCloseNotifications={vi.fn()}
      />,
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '4', ctrlKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', ctrlKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '6', ctrlKey: true }));

    expect(onNavigate).toHaveBeenNthCalledWith(1, 'feeds');
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'design-studio');
    expect(onNavigate).toHaveBeenNthCalledWith(3, 'video-studio');
  });
});
