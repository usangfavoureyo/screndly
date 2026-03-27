import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BackNavigationProvider, useBackNavigation } from '../../contexts/BackNavigationContext';

interface HarnessProps {
  onReady: (value: ReturnType<typeof useBackNavigation>) => void;
}

function Harness({ onReady }: HarnessProps) {
  const navigation = useBackNavigation();

  onReady(navigation);
  return null;
}

describe('BackNavigationContext', () => {
  it('does not walk browser history when already at the dashboard root', () => {
    window.history.replaceState({ page: 'dashboard' }, '', '/');

    let navigation: ReturnType<typeof useBackNavigation> | null = null;
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    render(
      <BackNavigationProvider>
        <Harness onReady={(value) => {
          navigation = value;
        }} />
      </BackNavigationProvider>,
    );

    expect(navigation).not.toBeNull();
    expect(navigation!.handleAppBack()).toBe(false);
    expect(backSpy).not.toHaveBeenCalled();

    backSpy.mockRestore();
  });

  it('uses browser history when navigating away from the dashboard root', () => {
    window.history.pushState({ page: 'activity' }, '', '/activity');

    let navigation: ReturnType<typeof useBackNavigation> | null = null;
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    render(
      <BackNavigationProvider>
        <Harness onReady={(value) => {
          navigation = value;
        }} />
      </BackNavigationProvider>,
    );

    expect(navigation).not.toBeNull();

    act(() => {
      navigation!.setCurrentPage('activity');
    });

    expect(navigation!.handleAppBack()).toBe(true);
    expect(backSpy).toHaveBeenCalledTimes(1);

    backSpy.mockRestore();
  });
});
