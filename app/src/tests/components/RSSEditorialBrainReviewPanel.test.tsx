import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import type { RSSActivityItem } from '../../contexts/RSSFeedsContext';
import { RSSEditorialBrainReviewPanel } from '../../components/rss/RSSEditorialBrainReviewPanel';

function buildItem(overrides: Partial<RSSActivityItem> = {}): RSSActivityItem {
  return {
    id: 'activity-1',
    feedId: 'feed-1',
    feedName: 'SlashFilm',
    title: 'Example title',
    status: 'failed',
    timestamp: '2026-04-17T10:00:00.000Z',
    platforms: ['x'],
    platformResults: [],
    editorialBrain: {
      sourceTrustTier: 'tier_2_editorial',
      agentModel: 'gpt-5.4-mini',
      contentHash: 'hash-1',
      usedFallback: false,
      disagreements: ['canonical_disagreement', 'image_strategy_disagreement'],
      currentSystem: {
        lane: 'core_auto_publish',
        canonical: 'Dan Levy’s New Crime Comedy Series',
        event: 'development',
        imageStrategy: 'project_first',
        captionStrategy: 'headline_news',
        spoilerRisk: 'none',
      },
      decision: {
        lane: 'core_auto_publish',
        canonical: 'Big Mistakes',
        storyFamily: 'project_announcement',
        event: 'project_announcement',
        imageStrategy: 'project_first',
        captionStrategy: 'project_announcement',
        spoilerRisk: 'none',
        confidence: 0.91,
      },
      runtime: {
        promotedImageStrategy: 'article_image_first',
        promotedCaptionStrategy: 'project_announcement',
        finalFailureCodes: ['CAPTION_HEADLINE_JUNK'],
        lastOutcome: 'failed',
        updatedAt: '2026-04-17T12:00:00.000Z',
      },
    },
    ...overrides,
  };
}

describe('RSSEditorialBrainReviewPanel', () => {
  it('renders current-vs-brain comparison and emits review outcomes', () => {
    const onReview = vi.fn();
    render(<RSSEditorialBrainReviewPanel item={buildItem()} onReview={onReview} />);

    expect(screen.getByText('Current system')).toBeInTheDocument();
    expect(screen.getByText('Editorial brain')).toBeInTheDocument();
    expect(screen.getByText(/Big Mistakes/)).toBeInTheDocument();
    expect(screen.getByText(/canonical disagreement/i)).toBeInTheDocument();
    expect(screen.getByText(/Image promoted:/i)).toBeInTheDocument();
    expect(screen.getByText(/Caption promoted:/i)).toBeInTheDocument();
    expect(screen.getByText(/Runtime failure codes/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Brain Better' }));
    expect(onReview).toHaveBeenCalledWith('brain_better');
  });
});
