import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('../lib/auth', () => ({
  hasStoredAuthSession: () => true,
  verifyAuth: vi.fn().mockResolvedValue(true),
  logout: vi.fn(),
  login: vi.fn(),
}));

import App from '../App';

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function createDashboardStats() {
  return {
    system: {
      cacheHitRate: 0,
      systemErrors: 0,
      dailyFailures: 0,
      dailySuccess: 0,
    },
    comments: {
      repliesToday: 0,
      successRate: 0,
      recentReplies: [],
      activePlatforms: 0,
    },
    video: {
      activeChannels: 0,
      dailyVideos: 0,
      trends: [],
      recentActivity: [],
    },
    rss: {
      activeFeeds: 0,
      dailyPosted: 0,
      recentFeeds: [],
    },
    tmdb: {
      readyCount: 0,
      coverageDays: 0,
      upcoming: [],
    },
    designStudio: {
      generated: 0,
      published: 0,
      recentActivity: [],
    },
    videoStudio: {
      generated: 0,
      published: 0,
      recentActivity: [],
    },
    uploads: {
      activeUploads: 0,
      completedToday: 0,
      pipeline: [],
    },
    usage: {
      openai: 0,
      serper: 0,
      tmdb: 0,
      shotstack: 0,
      googleSearch: 0,
      googleVideo: 0,
      total: 0,
    },
    recentActivity: [],
  };
}

function mockShellRequests(options: { malformedDashboard?: boolean } = {}) {
  global.fetch = vi.fn().mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.endsWith('/health')) {
      return Promise.resolve(createJsonResponse({ status: 'ok' }));
    }

    if (url.endsWith('/api/dashboard/stats')) {
      return Promise.resolve(
        createJsonResponse({
          success: true,
          data: options.malformedDashboard ? [] : createDashboardStats(),
        })
      );
    }

    if (url.endsWith('/api/settings') && (init?.method === 'PUT' || init?.method === 'PATCH')) {
      return Promise.resolve(createJsonResponse({ success: true, data: {}, meta: {} }));
    }

    if (url.endsWith('/api/settings')) {
      return Promise.resolve(createJsonResponse({ success: true, data: {} }));
    }

    if (
      url.endsWith('/api/rss/feeds') ||
      url.endsWith('/api/tmdb/posts') ||
      url.endsWith('/api/comments/automation/stats')
    ) {
      return Promise.resolve(createJsonResponse({ success: true, data: [] }));
    }

    return Promise.resolve(createJsonResponse({ success: true, data: [] }));
  }) as typeof global.fetch;
}

describe('Screndly Comprehensive Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    vi.clearAllMocks();
    mockShellRequests();
  });

  it('renders the authenticated app shell with primary navigation', async () => {
    render(<App />);

    const primaryNav = await screen.findByRole('navigation', { name: /primary navigation/i });

    expect(primaryNav.textContent).toContain('Dashboard');
    expect(primaryNav.textContent).toContain('Channels');
    expect(primaryNav.textContent).toContain('Platforms');
    expect(primaryNav.textContent).toContain('Feeds');
    expect(primaryNav.textContent).toContain('Design Studio');
    expect(primaryNav.textContent).toContain('Video Studio');
  }, 20000);

  it('preserves deep links for valid authenticated routes', async () => {
    window.history.replaceState({}, '', '/video-studio');

    render(<App />);

    await screen.findByRole('navigation', { name: /primary navigation/i });

    expect(window.location.pathname).toBe('/video-studio');
  });
  it('includes the skip link and main landmark for accessibility', async () => {
    render(<App />);

    await screen.findByRole('navigation', { name: /primary navigation/i });

    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
