import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MobileBottomNav } from '../../components/MobileBottomNav';

vi.mock('../../utils/haptics', () => ({
  haptics: {
    light: vi.fn(),
    medium: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../../utils/useScrollDirection', () => ({
  useScrollDirection: () => 'up',
}));

describe('MobileBottomNav', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restores missing default destinations when saved order is stale or incomplete', () => {
    localStorage.setItem('bottomNavOrder', JSON.stringify(['dashboard', 'feeds']));

    render(
      <MobileBottomNav currentPage="dashboard" onNavigate={vi.fn()} />,
    );

    expect(screen.getByLabelText('Navigate to Dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText('Navigate to Feeds')).toBeInTheDocument();
    expect(screen.getByLabelText('Navigate to Channels')).toBeInTheDocument();
    expect(screen.getByLabelText('Navigate to Platforms')).toBeInTheDocument();
    expect(screen.getByLabelText('Navigate to Design Studio')).toBeInTheDocument();
    expect(screen.getByLabelText('Navigate to Video Studio')).toBeInTheDocument();
  });

  it('navigates using canonical shell destinations', () => {
    const onNavigate = vi.fn();

    render(
      <MobileBottomNav currentPage="dashboard" onNavigate={onNavigate} />,
    );

    fireEvent.click(screen.getByLabelText('Navigate to Feeds'));
    expect(onNavigate).toHaveBeenCalledWith('feeds');
  });
});
