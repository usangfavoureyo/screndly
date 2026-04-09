import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { AnalyticsSelfOptimization } from '../../components/settings/AnalyticsSelfOptimization';

vi.mock('../../utils/haptics', () => ({
  haptics: {
    light: vi.fn(),
  },
}));

vi.mock('../../lib/optimization/analyticsIngester', () => ({
  analyticsIngester: {
    trackSettingChange: vi.fn(),
  },
}));

vi.mock('../../components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (value: boolean) => void }) => (
    <button type="button" onClick={() => onCheckedChange(!checked)}>
      {checked ? 'On' : 'Off'}
    </button>
  ),
}));

describe('AnalyticsSelfOptimization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders safely when persisted optimization state is missing enabled flags', () => {
    localStorage.setItem('tmdb_settings_optimization', JSON.stringify({ legacy: true }));

    expect(() =>
      render(
        <AnalyticsSelfOptimization
          storageKey="tmdb_settings"
          description="Test description"
        />,
      ),
    ).not.toThrow();

    expect(screen.getByText('Analytics-Driven Self-Optimization')).toBeInTheDocument();
    expect(screen.getByText('7/7 platforms enabled')).toBeInTheDocument();
  });
});
