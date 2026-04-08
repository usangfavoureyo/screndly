import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OptimalTimeSuggestion } from './OptimalTimeSuggestion';

vi.mock('../lib/optimization', () => ({
  postTimeOptimizer: {
    getOptimalPostTime: vi.fn((platform: string) => {
      const date = new Date(2026, 3, 10, 15, 0, 0);
      if (platform === 'instagram') {
        date.setHours(18);
      }
      return date;
    }),
    getHeatmap: vi.fn((platform: string) => ({
      hours: {},
      days: {},
      confidence: platform === 'instagram' ? 64 : 72,
    })),
  },
}));

describe('OptimalTimeSuggestion', () => {
  it('renders recommendations for selected platforms without crashing', () => {
    render(<OptimalTimeSuggestion selectedPlatforms={['x', 'instagram']} />);

    expect(screen.getByText('Optimal Posting Time')).toBeInTheDocument();
    expect(screen.getByText('68% confident')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /optimal posting time/i }));

    expect(screen.getByText('x')).toBeInTheDocument();
    expect(screen.getByText('instagram')).toBeInTheDocument();
    expect(screen.getByText('3:00 PM')).toBeInTheDocument();
    expect(screen.getByText('6:00 PM')).toBeInTheDocument();
  });
});
