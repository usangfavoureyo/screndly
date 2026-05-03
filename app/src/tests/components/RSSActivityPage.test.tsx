import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { RSSActivityPage } from '../../components/RSSActivityPage';
import type { RSSActivityItem, RSSActivityResponse } from '../../contexts/RSSFeedsContext';

const getActivityMock = vi.fn<(...args: any[]) => Promise<RSSActivityResponse | null>>();

vi.mock('../../contexts/RSSFeedsContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/RSSFeedsContext')>('../../contexts/RSSFeedsContext');
  return {
    ...actual,
    useRSSFeeds: () => ({
      getActivity: getActivityMock,
      retryActivity: vi.fn(),
      saveEditorialBrainReview: vi.fn(),
    }),
  };
});

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      rssActivityRetention: 24,
    },
  }),
}));

vi.mock('../../hooks/useBulkSelection', () => ({
  useBulkSelection: () => ({
    selectionMode: false,
    selectedCount: 0,
    allSelected: false,
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
    isSelected: vi.fn(() => false),
    toggleSelection: vi.fn(),
    enterSelectionMode: vi.fn(),
  }),
}));

vi.mock('../../components/UndoContext', () => ({
  useUndo: () => ({
    showUndo: vi.fn(),
  }),
}));

vi.mock('../../utils/haptics', () => ({
  haptics: {
    light: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../components/SwipeableActivityCard', () => ({
  SwipeableActivityCard: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('../../components/ActivitySelectionToolbar', () => ({
  ActivitySelectionToolbar: () => null,
}));

vi.mock('../../components/BackIconButton', () => ({
  BackIconButton: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>Back</button>,
}));

vi.mock('../../components/ui/optimized-image', () => ({
  OptimizedImage: ({ alt }: { alt: string }) => <div>{alt}</div>,
}));

vi.mock('../../components/rss/RSSEditorialBrainReviewPanel', () => ({
  RSSEditorialBrainReviewPanel: () => <div>Review Panel</div>,
}));

vi.mock('../../lib/api/client', () => ({
  apiClient: {
    delete: vi.fn(),
  },
}));

vi.mock('../../utils/rssOfflineStore', () => ({
  saveRSSActivitySnapshot: vi.fn(),
}));

function buildItem(overrides: Partial<RSSActivityItem> = {}): RSSActivityItem {
  return {
    id: 'item-1',
    feedId: 'feed-1',
    feedName: 'SlashFilm',
    title: 'Example RSS item',
    description: 'Example description',
    status: 'failed',
    timestamp: new Date().toISOString(),
    platforms: ['x'],
    platformResults: [],
    editorialBrain: {
      sourceTrustTier: 'tier_2_editorial',
      agentModel: 'gpt-5.4-mini',
      contentHash: 'hash-1',
      usedFallback: false,
      disagreements: ['image_strategy_disagreement'],
      currentSystem: {
        lane: 'core_auto_publish',
        canonical: 'Example',
        event: 'development',
        imageStrategy: 'project_first',
        captionStrategy: 'headline_news',
        spoilerRisk: 'none',
      },
      decision: {
        lane: 'core_auto_publish',
        canonical: 'Example',
        storyFamily: 'project_announcement',
        event: 'development',
        imageStrategy: 'person_first',
        captionStrategy: 'headline_news',
        spoilerRisk: 'none',
        confidence: 0.92,
      },
      runtime: {
        finalFailureCodes: [],
        lastOutcome: 'failed',
      },
    },
    ...overrides,
  };
}

describe('RSSActivityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    getActivityMock.mockResolvedValue({
      items: [buildItem()],
      summary: {
        total: 1,
        published: 0,
        pending: 0,
        failed: 1,
        filtered: 0,
      },
    });
  });

  it('collapses and expands the editorial brain monitoring card', async () => {
    render(<RSSActivityPage onNavigate={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Editorial Brain Monitoring')).toBeInTheDocument());
    expect(screen.getByText('Export JSON')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide editorial brain monitoring' }));
    expect(screen.queryByText('Export JSON')).not.toBeInTheDocument();
    expect(screen.queryByText('Shadow Items')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show editorial brain monitoring' }));
    expect(screen.getByText('Export JSON')).toBeInTheDocument();
    expect(screen.getByText('Shadow Items')).toBeInTheDocument();
  });

  it('sorts activity items by recently added and oldest added', async () => {
    const now = Date.now();
    getActivityMock.mockResolvedValueOnce({
      items: [
        buildItem({
          id: 'older-item',
          title: 'Older RSS item',
          timestamp: new Date(now - 60 * 60 * 1000).toISOString(),
        }),
        buildItem({
          id: 'recent-item',
          title: 'Recent RSS item',
          timestamp: new Date(now - 5 * 60 * 1000).toISOString(),
        }),
      ],
      summary: {
        total: 2,
        published: 0,
        pending: 0,
        failed: 2,
        filtered: 0,
      },
    });

    render(<RSSActivityPage onNavigate={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Recent RSS item')).toBeInTheDocument());
    const getRenderedTitles = () => screen.getAllByText(/RSS item$/).map((element) => element.textContent);

    expect(getRenderedTitles()).toEqual(['Recent RSS item', 'Older RSS item']);

    fireEvent.click(screen.getByRole('button', { name: 'Oldest Added' }));

    expect(getRenderedTitles()).toEqual(['Older RSS item', 'Recent RSS item']);
  });
});
