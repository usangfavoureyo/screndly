import type { RSSActivityItem } from '../../contexts/RSSFeedsContext';

export type EditorialBrainReviewFilters = {
  source?: string;
  disagreement?: string;
  reviewed?: 'all' | 'reviewed' | 'unreviewed';
  confidence?: 'all' | 'high' | 'medium' | 'low' | 'unknown';
  publishOutcome?: 'all' | 'published' | 'pending' | 'failed' | 'filtered';
  promotion?: 'all' | 'promoted' | 'unpromoted' | 'image' | 'caption' | 'both';
};

export type EditorialBrainCalibrationBucket = {
  shadowItems: number;
  reviewedItems: number;
  brainBetter: number;
  deterministicBetter: number;
  bothWrong: number;
  ignored: number;
};

export type EditorialBrainCalibrationSummary = {
  overview: EditorialBrainCalibrationBucket & {
    unreviewedItems: number;
  };
  bySource: Array<EditorialBrainCalibrationBucket & { source: string }>;
  byBucket: Array<EditorialBrainCalibrationBucket & { disagreement: string }>;
};

export type EditorialBrainPromotionSummary = {
  overview: {
    shadowItems: number;
    promotedItems: number;
    imagePromotedItems: number;
    captionPromotedItems: number;
    bothPromotedItems: number;
    promotedPublished: number;
    promotedPending: number;
    promotedFailed: number;
    promotedFiltered: number;
  };
  bySource: Array<{
    source: string;
    promotedItems: number;
    imagePromotedItems: number;
    captionPromotedItems: number;
    bothPromotedItems: number;
    promotedFailed: number;
  }>;
  byBucket: Array<{
    disagreement: string;
    promotedItems: number;
    imagePromotedItems: number;
    captionPromotedItems: number;
    bothPromotedItems: number;
  }>;
  byConfidence: Array<{
    confidence: 'high' | 'medium' | 'low' | 'unknown';
    promotedItems: number;
    imagePromotedItems: number;
    captionPromotedItems: number;
    bothPromotedItems: number;
  }>;
  byFailureCode: Array<{
    failureCode: string;
    count: number;
  }>;
};

export type EditorialBrainReviewExportRow = {
  id: string;
  source: string;
  title: string;
  url: string;
  publishOutcome: string;
  currentLane: string;
  brainLane: string;
  currentCanonical: string;
  brainCanonical: string;
  currentEvent: string;
  brainEvent: string;
  currentImageStrategy: string;
  brainImageStrategy: string;
  currentCaptionStrategy: string;
  brainCaptionStrategy: string;
  promotedImageStrategy: string;
  promotedCaptionStrategy: string;
  finalFailureCodes: string;
  disagreements: string;
  confidence: string;
  reviewOutcome: string;
  reviewedAt: string;
  reviewNotes: string;
};

const DISAGREEMENT_PRIORITY = [
  'canonical_disagreement',
  'lane_disagreement',
  'image_strategy_disagreement',
  'caption_strategy_disagreement',
  'spoiler_risk_disagreement',
  'event_disagreement',
] as const;

export type EditorialBrainPromotionKind = 'none' | 'image' | 'caption' | 'both';

export function getEditorialBrainConfidenceBucket(confidence?: number): 'high' | 'medium' | 'low' | 'unknown' {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    return 'unknown';
  }
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

export function getEditorialBrainPromotionKind(item: RSSActivityItem): EditorialBrainPromotionKind {
  const promotedImage = Boolean(item.editorialBrain?.runtime?.promotedImageStrategy);
  const promotedCaption = Boolean(item.editorialBrain?.runtime?.promotedCaptionStrategy);
  if (promotedImage && promotedCaption) return 'both';
  if (promotedImage) return 'image';
  if (promotedCaption) return 'caption';
  return 'none';
}

function getTopDisagreementPriority(item: RSSActivityItem): number {
  const disagreements = item.editorialBrain?.disagreements || [];
  const indexes = disagreements
    .map((code) => DISAGREEMENT_PRIORITY.indexOf(code as typeof DISAGREEMENT_PRIORITY[number]))
    .filter((index) => index >= 0);
  return indexes.length > 0 ? Math.min(...indexes) : Number.MAX_SAFE_INTEGER;
}

export function compareEditorialBrainReviewPriority(left: RSSActivityItem, right: RSSActivityItem): number {
  const priorityDelta = getTopDisagreementPriority(left) - getTopDisagreementPriority(right);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const leftConfidence = left.editorialBrain?.decision.confidence ?? -1;
  const rightConfidence = right.editorialBrain?.decision.confidence ?? -1;
  if (leftConfidence !== rightConfidence) {
    return rightConfidence - leftConfidence;
  }

  return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
}

export function matchesEditorialBrainReviewFilters(
  item: RSSActivityItem,
  filters: EditorialBrainReviewFilters
): boolean {
  const hasEditorialSpecificFilter = Boolean(
    (filters.source && filters.source !== 'all')
    || (filters.disagreement && filters.disagreement !== 'all')
    || (filters.reviewed && filters.reviewed !== 'all')
    || (filters.confidence && filters.confidence !== 'all')
    || (filters.promotion && filters.promotion !== 'all')
  );
  if (hasEditorialSpecificFilter && !item.editorialBrain) {
    return false;
  }

  const sourceFilter = filters.source?.trim().toLowerCase();
  if (sourceFilter && sourceFilter !== 'all' && item.feedName.trim().toLowerCase() !== sourceFilter) {
    return false;
  }

  if (filters.publishOutcome && filters.publishOutcome !== 'all' && item.status !== filters.publishOutcome) {
    return false;
  }

  const disagreements = item.editorialBrain?.disagreements || [];
  if (filters.disagreement && filters.disagreement !== 'all' && !disagreements.includes(filters.disagreement)) {
    return false;
  }

  if (filters.reviewed === 'reviewed' && !item.editorialBrain?.review) {
    return false;
  }
  if (filters.reviewed === 'unreviewed' && item.editorialBrain?.review) {
    return false;
  }

  if (filters.confidence && filters.confidence !== 'all') {
    const bucket = getEditorialBrainConfidenceBucket(item.editorialBrain?.decision.confidence);
    if (bucket !== filters.confidence) {
      return false;
    }
  }

  const promotionKind = getEditorialBrainPromotionKind(item);
  if (filters.promotion === 'promoted' && promotionKind === 'none') {
    return false;
  }
  if (filters.promotion === 'unpromoted' && promotionKind !== 'none') {
    return false;
  }
  if (filters.promotion === 'image' && !['image', 'both'].includes(promotionKind)) {
    return false;
  }
  if (filters.promotion === 'caption' && !['caption', 'both'].includes(promotionKind)) {
    return false;
  }
  if (filters.promotion === 'both' && promotionKind !== 'both') {
    return false;
  }

  return true;
}

function createEmptyCalibrationBucket(): EditorialBrainCalibrationBucket {
  return {
    shadowItems: 0,
    reviewedItems: 0,
    brainBetter: 0,
    deterministicBetter: 0,
    bothWrong: 0,
    ignored: 0,
  };
}

function applyReviewOutcome(bucket: EditorialBrainCalibrationBucket, item: RSSActivityItem): void {
  const outcome = item.editorialBrain?.review?.outcome;
  if (!outcome) {
    return;
  }

  bucket.reviewedItems += 1;
  if (outcome === 'brain_better') bucket.brainBetter += 1;
  if (outcome === 'deterministic_better') bucket.deterministicBetter += 1;
  if (outcome === 'both_wrong') bucket.bothWrong += 1;
  if (outcome === 'ignore') bucket.ignored += 1;
}

export function buildEditorialBrainCalibrationSummary(items: RSSActivityItem[]): EditorialBrainCalibrationSummary {
  const overview = createEmptyCalibrationBucket();
  const bySource = new Map<string, EditorialBrainCalibrationBucket>();
  const byBucket = new Map<string, EditorialBrainCalibrationBucket>();

  for (const item of items) {
    const brain = item.editorialBrain;
    if (!brain) {
      continue;
    }

    overview.shadowItems += 1;
    applyReviewOutcome(overview, item);

    const sourceBucket = bySource.get(item.feedName) || createEmptyCalibrationBucket();
    sourceBucket.shadowItems += 1;
    applyReviewOutcome(sourceBucket, item);
    bySource.set(item.feedName, sourceBucket);

    for (const disagreement of brain.disagreements) {
      const disagreementBucket = byBucket.get(disagreement) || createEmptyCalibrationBucket();
      disagreementBucket.shadowItems += 1;
      applyReviewOutcome(disagreementBucket, item);
      byBucket.set(disagreement, disagreementBucket);
    }
  }

  return {
    overview: {
      ...overview,
      unreviewedItems: Math.max(0, overview.shadowItems - overview.reviewedItems),
    },
    bySource: Array.from(bySource.entries())
      .map(([source, bucket]) => ({ source, ...bucket }))
      .sort((left, right) => right.shadowItems - left.shadowItems || left.source.localeCompare(right.source)),
    byBucket: Array.from(byBucket.entries())
      .map(([disagreement, bucket]) => ({ disagreement, ...bucket }))
      .sort((left, right) => right.shadowItems - left.shadowItems || left.disagreement.localeCompare(right.disagreement)),
  };
}

export function buildEditorialBrainPromotionSummary(items: RSSActivityItem[]): EditorialBrainPromotionSummary {
  const overview = {
    shadowItems: 0,
    promotedItems: 0,
    imagePromotedItems: 0,
    captionPromotedItems: 0,
    bothPromotedItems: 0,
    promotedPublished: 0,
    promotedPending: 0,
    promotedFailed: 0,
    promotedFiltered: 0,
  };
  const bySource = new Map<string, Omit<EditorialBrainPromotionSummary['bySource'][number], 'source'>>();
  const byBucket = new Map<string, Omit<EditorialBrainPromotionSummary['byBucket'][number], 'disagreement'>>();
  const byConfidence = new Map<'high' | 'medium' | 'low' | 'unknown', EditorialBrainPromotionSummary['byConfidence'][number]>();
  const byFailureCode = new Map<string, number>();

  for (const item of items) {
    const brain = item.editorialBrain;
    if (!brain) continue;

    overview.shadowItems += 1;
    const promotionKind = getEditorialBrainPromotionKind(item);
    if (promotionKind === 'none') {
      continue;
    }

    overview.promotedItems += 1;
    if (promotionKind === 'image') overview.imagePromotedItems += 1;
    if (promotionKind === 'caption') overview.captionPromotedItems += 1;
    if (promotionKind === 'both') {
      overview.imagePromotedItems += 1;
      overview.captionPromotedItems += 1;
      overview.bothPromotedItems += 1;
    }

    if (item.status === 'published') overview.promotedPublished += 1;
    if (item.status === 'pending') overview.promotedPending += 1;
    if (item.status === 'failed') overview.promotedFailed += 1;
    if (item.status === 'filtered') overview.promotedFiltered += 1;

    const sourceBucket = bySource.get(item.feedName) || {
      promotedItems: 0,
      imagePromotedItems: 0,
      captionPromotedItems: 0,
      bothPromotedItems: 0,
      promotedFailed: 0,
    };
    sourceBucket.promotedItems += 1;
    if (promotionKind === 'image') sourceBucket.imagePromotedItems += 1;
    if (promotionKind === 'caption') sourceBucket.captionPromotedItems += 1;
    if (promotionKind === 'both') {
      sourceBucket.imagePromotedItems += 1;
      sourceBucket.captionPromotedItems += 1;
      sourceBucket.bothPromotedItems += 1;
    }
    if (item.status === 'failed') sourceBucket.promotedFailed += 1;
    bySource.set(item.feedName, sourceBucket);

    for (const disagreement of brain.disagreements || []) {
      const bucket = byBucket.get(disagreement) || {
        promotedItems: 0,
        imagePromotedItems: 0,
        captionPromotedItems: 0,
        bothPromotedItems: 0,
      };
      bucket.promotedItems += 1;
      if (promotionKind === 'image') bucket.imagePromotedItems += 1;
      if (promotionKind === 'caption') bucket.captionPromotedItems += 1;
      if (promotionKind === 'both') {
        bucket.imagePromotedItems += 1;
        bucket.captionPromotedItems += 1;
        bucket.bothPromotedItems += 1;
      }
      byBucket.set(disagreement, bucket);
    }

    const confidence = getEditorialBrainConfidenceBucket(brain.decision.confidence);
    const confidenceBucket = byConfidence.get(confidence) || {
      confidence,
      promotedItems: 0,
      imagePromotedItems: 0,
      captionPromotedItems: 0,
      bothPromotedItems: 0,
    };
    confidenceBucket.promotedItems += 1;
    if (promotionKind === 'image') confidenceBucket.imagePromotedItems += 1;
    if (promotionKind === 'caption') confidenceBucket.captionPromotedItems += 1;
    if (promotionKind === 'both') {
      confidenceBucket.imagePromotedItems += 1;
      confidenceBucket.captionPromotedItems += 1;
      confidenceBucket.bothPromotedItems += 1;
    }
    byConfidence.set(confidence, confidenceBucket);

    for (const failureCode of brain.runtime?.finalFailureCodes || []) {
      byFailureCode.set(failureCode, (byFailureCode.get(failureCode) || 0) + 1);
    }
  }

  return {
    overview,
    bySource: Array.from(bySource.entries())
      .map(([source, bucket]) => ({ source, ...bucket }))
      .sort((left, right) => right.promotedItems - left.promotedItems || left.source.localeCompare(right.source)),
    byBucket: Array.from(byBucket.entries())
      .map(([disagreement, bucket]) => ({ disagreement, ...bucket }))
      .sort((left, right) => right.promotedItems - left.promotedItems || left.disagreement.localeCompare(right.disagreement)),
    byConfidence: Array.from(byConfidence.values())
      .sort((left, right) => right.promotedItems - left.promotedItems),
    byFailureCode: Array.from(byFailureCode.entries())
      .map(([failureCode, count]) => ({ failureCode, count }))
      .sort((left, right) => right.count - left.count || left.failureCode.localeCompare(right.failureCode)),
  };
}

export function buildEditorialBrainReviewExportRows(items: RSSActivityItem[]): EditorialBrainReviewExportRow[] {
  return items
    .filter((item) => item.editorialBrain)
    .map((item) => ({
      id: item.id,
      source: item.feedName,
      title: item.title,
      url: item.link || '',
      publishOutcome: item.status,
      currentLane: item.editorialBrain?.currentSystem.lane || '',
      brainLane: item.editorialBrain?.decision.lane || '',
      currentCanonical: item.editorialBrain?.currentSystem.canonical || '',
      brainCanonical: item.editorialBrain?.decision.canonical || '',
      currentEvent: item.editorialBrain?.currentSystem.event || '',
      brainEvent: item.editorialBrain?.decision.event || '',
      currentImageStrategy: item.editorialBrain?.currentSystem.imageStrategy || '',
      brainImageStrategy: item.editorialBrain?.decision.imageStrategy || '',
      currentCaptionStrategy: item.editorialBrain?.currentSystem.captionStrategy || '',
      brainCaptionStrategy: item.editorialBrain?.decision.captionStrategy || '',
      promotedImageStrategy: item.editorialBrain?.runtime?.promotedImageStrategy || '',
      promotedCaptionStrategy: item.editorialBrain?.runtime?.promotedCaptionStrategy || '',
      finalFailureCodes: (item.editorialBrain?.runtime?.finalFailureCodes || []).join('|'),
      disagreements: (item.editorialBrain?.disagreements || []).join('|'),
      confidence: typeof item.editorialBrain?.decision.confidence === 'number'
        ? item.editorialBrain.decision.confidence.toFixed(2)
        : '',
      reviewOutcome: item.editorialBrain?.review?.outcome || '',
      reviewedAt: item.editorialBrain?.review?.reviewedAt || '',
      reviewNotes: item.editorialBrain?.review?.notes || '',
    }));
}
