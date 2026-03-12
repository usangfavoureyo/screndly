import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const { getStats } = vi.hoisted(() => ({
  getStats: vi.fn(),
}));

vi.mock('../../lib/api/dashboard', () => ({
  dashboardApi: {
    getStats,
  },
}));

import { DashboardOverview } from '../../components/DashboardOverview';

describe('DashboardOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    getStats.mockResolvedValue({
      success: true,
      data: [],
    });
  });

  it('normalizes malformed dashboard stats payloads instead of crashing', async () => {
    render(<DashboardOverview onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(getStats).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });
});
