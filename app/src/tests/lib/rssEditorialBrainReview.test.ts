import { describe, expect, it } from 'vitest';
import type { RSSActivityItem } from '../../contexts/RSSFeedsContext';
import {
  buildEditorialBrainCalibrationSummary,
  buildEditorialBrainPromotionSummary,
  buildEditorialBrainReviewExportRows,
  compareEditorialBrainReviewPriority,
  getEditorialBrainConfidenceBucket,
  getEditorialBrainPromotionKind,
  matchesEditorialBrainReviewFilters,
} from '../../lib/rss/editorialBrainReview';

function buildActivity(overrides: Partial<RSSActivityItem> = {}): RSSActivityItem {
  return {
    id: 'activity-1',
    feedId: 'feed-1',
    feedName: 'SlashFilm',
    title: 'Example title',
    status: 'failed',
    timestamp: new Date('2026-04-17T10:00:00.000Z').toISOString(),
    platforms: ['x'],
    platformPostIds: {},
    platformResults: [],
    editorialBrain: {
      sourceTrustTier: 'tier_2_editorial',
      agentModel: 'gpt-5.4-mini',
      contentHash: 'hash-1',
      usedFallback: false,
      disagreements: ['canonical_disagreement'],
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
        confidence: 0.92,
      },
      runtime: {
        promotedImageStrategy: 'article_image_first',
        promotedCaptionStrategy: 'first_look',
        finalFailureCodes: ['CAPTION_HEADLINE_JUNK'],
        lastOutcome: 'failed',
        updatedAt: '2026-04-17T12:00:00.000Z',
      },
    },
    ...overrides,
  };
}

describe('rss editorial brain review helpers', () => {
  it('prioritizes canonical disagreements ahead of event-only disagreements', () => {
    const canonical = buildActivity({
      id: 'canonical',
      editorialBrain: {
        ...buildActivity().editorialBrain!,
        disagreements: ['canonical_disagreement'],
      },
    });
    const eventOnly = buildActivity({
      id: 'event',
      editorialBrain: {
        ...buildActivity().editorialBrain!,
        disagreements: ['event_disagreement'],
      },
    });

    expect(compareEditorialBrainReviewPriority(canonical, eventOnly)).toBeLessThan(0);
  });

  it('filters by disagreement bucket, reviewed state, source, and confidence bucket', () => {
    const item = buildActivity({
      editorialBrain: {
        ...buildActivity().editorialBrain!,
        disagreements: ['image_strategy_disagreement'],
        review: {
          outcome: 'brain_better',
          reviewedAt: '2026-04-17T12:00:00.000Z',
        },
        decision: {
          ...buildActivity().editorialBrain!.decision,
          confidence: 0.83,
        },
      },
    });

    expect(matchesEditorialBrainReviewFilters(item, {
      source: 'slashfilm',
      disagreement: 'image_strategy_disagreement',
      reviewed: 'reviewed',
      confidence: 'high',
      publishOutcome: 'failed',
    })).toBe(true);

    expect(matchesEditorialBrainReviewFilters(item, {
      source: 'deadline',
      disagreement: 'image_strategy_disagreement',
      reviewed: 'reviewed',
      confidence: 'high',
      publishOutcome: 'failed',
    })).toBe(false);

    expect(matchesEditorialBrainReviewFilters(item, {
      source: 'slashfilm',
      disagreement: 'image_strategy_disagreement',
      reviewed: 'reviewed',
      confidence: 'high',
      publishOutcome: 'failed',
      promotion: 'both',
    })).toBe(true);
  });

  it('maps numeric confidence into stable review buckets', () => {
    expect(getEditorialBrainConfidenceBucket(0.91)).toBe('high');
    expect(getEditorialBrainConfidenceBucket(0.66)).toBe('medium');
    expect(getEditorialBrainConfidenceBucket(0.31)).toBe('low');
    expect(getEditorialBrainConfidenceBucket(undefined)).toBe('unknown');
  });

  it('aggregates adjudication totals by source and disagreement bucket', () => {
    const items = [
      buildActivity({
        id: 'brain-win',
        feedName: 'TVLine',
        editorialBrain: {
          ...buildActivity().editorialBrain!,
          disagreements: ['canonical_disagreement', 'lane_disagreement'],
          review: { outcome: 'brain_better', reviewedAt: '2026-04-17T12:00:00.000Z' },
        },
      }),
      buildActivity({
        id: 'deterministic-win',
        feedName: 'TVLine',
        editorialBrain: {
          ...buildActivity().editorialBrain!,
          disagreements: ['image_strategy_disagreement'],
          review: { outcome: 'deterministic_better', reviewedAt: '2026-04-17T12:05:00.000Z' },
        },
      }),
      buildActivity({
        id: 'unreviewed',
        feedName: 'SlashFilm',
        editorialBrain: {
          ...buildActivity().editorialBrain!,
          disagreements: ['caption_strategy_disagreement'],
        },
      }),
    ];

    const summary = buildEditorialBrainCalibrationSummary(items);

    expect(summary.overview.shadowItems).toBe(3);
    expect(summary.overview.reviewedItems).toBe(2);
    expect(summary.overview.unreviewedItems).toBe(1);
    expect(summary.overview.brainBetter).toBe(1);
    expect(summary.overview.deterministicBetter).toBe(1);
    expect(summary.bySource[0]).toMatchObject({
      source: 'TVLine',
      shadowItems: 2,
      reviewedItems: 2,
      brainBetter: 1,
      deterministicBetter: 1,
    });
    expect(summary.byBucket[0]).toMatchObject({
      disagreement: 'canonical_disagreement',
      shadowItems: 1,
      reviewedItems: 1,
      brainBetter: 1,
    });
  });

  it('builds promotion monitoring summaries and promotion kind classifications', () => {
    const items = [
      buildActivity({
        id: 'both',
        feedName: 'TVLine',
        editorialBrain: {
          ...buildActivity().editorialBrain!,
          disagreements: ['image_strategy_disagreement', 'caption_strategy_disagreement'],
          runtime: {
            promotedImageStrategy: 'article_image_first',
            promotedCaptionStrategy: 'first_look',
            finalFailureCodes: ['CAPTION_HEADLINE_JUNK'],
            lastOutcome: 'failed',
            updatedAt: '2026-04-17T12:00:00.000Z',
          },
        },
      }),
      buildActivity({
        id: 'image-only',
        feedName: 'SlashFilm',
        status: 'published',
        editorialBrain: {
          ...buildActivity().editorialBrain!,
          disagreements: ['image_strategy_disagreement'],
          runtime: {
            promotedImageStrategy: 'dual_person_project',
            finalFailureCodes: [],
            lastOutcome: 'published',
            updatedAt: '2026-04-17T12:05:00.000Z',
          },
        },
      }),
      buildActivity({
        id: 'shadow-only',
        editorialBrain: {
          ...buildActivity().editorialBrain!,
          runtime: {
            finalFailureCodes: [],
            lastOutcome: 'failed',
            updatedAt: '2026-04-17T12:10:00.000Z',
          },
        },
      }),
    ];

    expect(getEditorialBrainPromotionKind(items[0])).toBe('both');
    expect(getEditorialBrainPromotionKind(items[1])).toBe('image');
    expect(getEditorialBrainPromotionKind(items[2])).toBe('none');

    const summary = buildEditorialBrainPromotionSummary(items);
    expect(summary.overview.promotedItems).toBe(2);
    expect(summary.overview.imagePromotedItems).toBe(2);
    expect(summary.overview.captionPromotedItems).toBe(1);
    expect(summary.overview.bothPromotedItems).toBe(1);
    expect(summary.overview.promotedPublished).toBe(1);
    expect(summary.overview.promotedFailed).toBe(1);
    expect(summary.bySource[0]).toMatchObject({
      source: 'SlashFilm',
      promotedItems: 1,
    });
    expect(summary.byFailureCode[0]).toMatchObject({
      failureCode: 'CAPTION_HEADLINE_JUNK',
      count: 1,
    });
  });

  it('builds export rows with current-vs-brain comparison and adjudication fields', () => {
    const rows = buildEditorialBrainReviewExportRows([
      buildActivity({
        id: 'export-1',
        feedName: 'ComicBook',
        title: 'Cult Classic 1980s Comedy Movie Is Finally Getting a Sequel With a Major Hollywood Star',
        link: 'https://comicbook.com/troop-beverly-hills',
        editorialBrain: {
          ...buildActivity().editorialBrain!,
          disagreements: ['canonical_disagreement'],
          currentSystem: {
            ...buildActivity().editorialBrain!.currentSystem,
            canonical: 'Freakier Friday',
          },
          decision: {
            ...buildActivity().editorialBrain!.decision,
            canonical: 'Troop Beverly Hills',
            confidence: 0.88,
          },
          review: {
            outcome: 'brain_better',
            reviewedAt: '2026-04-17T12:10:00.000Z',
            notes: 'Body title recovery was correct.',
          },
        },
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: 'ComicBook',
      currentCanonical: 'Freakier Friday',
      brainCanonical: 'Troop Beverly Hills',
      promotedImageStrategy: 'article_image_first',
      promotedCaptionStrategy: 'first_look',
      finalFailureCodes: 'CAPTION_HEADLINE_JUNK',
      disagreements: 'canonical_disagreement',
      reviewOutcome: 'brain_better',
      confidence: '0.88',
    });
  });
});
