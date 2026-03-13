import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useComposeStore } from '../../store/useComposeStore';

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
    useComposeStore.setState({ items: [], activeItemId: null });
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

  it('shows the compose post overview card and recent local post activity', async () => {
    useComposeStore.setState({
      items: [
        {
          id: 'post-1',
          title: 'Launch teaser',
          status: 'scheduled',
          mediaAssets: [],
          platforms: ['instagram', 'facebook'],
          sharedCaption: '',
          platformFields: {},
          createdAt: '2026-03-12T08:00:00.000Z',
          updatedAt: '2026-03-12T09:00:00.000Z',
          scheduledAt: '2026-03-13T09:00:00.000Z',
        },
      ],
      activeItemId: null,
    });

    render(<DashboardOverview onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(getStats).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Posts')).toBeInTheDocument();
    expect(screen.getByText('Scheduled Posts')).toBeInTheDocument();
    expect(screen.getByText('Launch teaser')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });
});
