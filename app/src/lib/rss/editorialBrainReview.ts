import type { RSSActivityItem } from '../../contexts/RSSFeedsContext';

export type EditorialBrainReviewFilters = {
  source?: string;
  disagreement?: string;
  reviewed?: 'all' | 'reviewed' | 'unreviewed';
  confidence?: 'all' | 'high' | 'medium' | 'low' | 'unknown';
  publishOutcome?: 'all' | 'published' | 'pending' | 'failed' | 'filtered';
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

export function getEditorialBrainConfidenceBucket(confidence?: number): 'high' | 'medium' | 'low' | 'unknown' {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    return 'unknown';
  }
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
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
  );
  if (hasEditorialSpecificFilter && !item.editorialBrain) {
    return false;
  }

  const sourceFilter = filters.source?.trim().toLowerCase();
  if (sourceFilter && item.feedName.trim().toLowerCase() !== sourceFilter) {
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
      disagreements: (item.editorialBrain?.disagreements || []).join('|'),
      confidence: typeof item.editorialBrain?.decision.confidence === 'number'
        ? item.editorialBrain.decision.confidence.toFixed(2)
        : '',
      reviewOutcome: item.editorialBrain?.review?.outcome || '',
      reviewedAt: item.editorialBrain?.review?.reviewedAt || '',
      reviewNotes: item.editorialBrain?.review?.notes || '',
    }));
}
