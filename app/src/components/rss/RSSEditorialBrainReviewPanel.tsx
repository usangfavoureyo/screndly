import { useMemo } from 'react';
import type {
  RSSActivityItem,
  RSSEditorialBrainReviewOutcome,
} from '../../contexts/RSSFeedsContext';
import { Button } from '../ui/button';

type RSSEditorialBrainReviewPanelProps = {
  item: RSSActivityItem;
  isSaving?: boolean;
  onReview: (outcome: RSSEditorialBrainReviewOutcome) => void;
};

const REVIEW_OPTIONS: Array<{ outcome: RSSEditorialBrainReviewOutcome; label: string }> = [
  { outcome: 'brain_better', label: 'Brain Better' },
  { outcome: 'deterministic_better', label: 'Current Better' },
  { outcome: 'both_wrong', label: 'Both Wrong' },
  { outcome: 'ignore', label: 'Ignore' },
];

function formatValue(value?: string): string {
  if (!value) return 'None';
  return value.replace(/_/g, ' ');
}

function formatConfidence(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Unknown';
  }
  return `${Math.round(value * 100)}%`;
}

export function RSSEditorialBrainReviewPanel({
  item,
  isSaving = false,
  onReview,
}: RSSEditorialBrainReviewPanelProps) {
  const editorialBrain = item.editorialBrain;
  const reviewLabel = useMemo(() => {
    switch (editorialBrain?.review?.outcome) {
      case 'brain_better':
        return 'Brain marked better';
      case 'deterministic_better':
        return 'Current system marked better';
      case 'both_wrong':
        return 'Marked both wrong';
      case 'ignore':
        return 'Marked ignore';
      default:
        return null;
    }
  }, [editorialBrain?.review?.outcome]);

  if (!editorialBrain) {
    return null;
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-[#333333] dark:bg-[#050505]">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
        <span className="rounded bg-white px-2 py-1 text-gray-700 dark:bg-[#111111] dark:text-[#D1D5DB]">
          {editorialBrain.agentModel}
        </span>
        <span className="rounded bg-white px-2 py-1 text-gray-700 dark:bg-[#111111] dark:text-[#D1D5DB]">
          {editorialBrain.sourceTrustTier}
        </span>
        <span className="rounded bg-white px-2 py-1 text-gray-700 dark:bg-[#111111] dark:text-[#D1D5DB]">
          Confidence {formatConfidence(editorialBrain.decision.confidence)}
        </span>
        {editorialBrain.usedFallback && (
          <span className="rounded bg-[#FEF3C7] px-2 py-1 text-[#92400E] dark:bg-[#78350F]/40 dark:text-[#FCD34D]">
            Used fallback
          </span>
        )}
        {editorialBrain.runtime?.promotedImageStrategy && (
          <span className="rounded bg-[#DBEAFE] px-2 py-1 text-[#1D4ED8] dark:bg-[#1E3A8A]/40 dark:text-[#93C5FD]">
            Image promoted: {formatValue(editorialBrain.runtime.promotedImageStrategy)}
          </span>
        )}
        {editorialBrain.runtime?.promotedCaptionStrategy && (
          <span className="rounded bg-[#DCFCE7] px-2 py-1 text-[#166534] dark:bg-[#14532D]/40 dark:text-[#86EFAC]">
            Caption promoted: {formatValue(editorialBrain.runtime.promotedCaptionStrategy)}
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-3 text-sm text-[#374151] dark:text-[#D1D5DB] md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-[#333333] dark:bg-[#000000]">
          <p className="mb-2 text-xs uppercase tracking-wide text-[#6B7280] dark:text-[#9CA3AF]">Current system</p>
          <p>Lane: {formatValue(editorialBrain.currentSystem.lane)}</p>
          <p>Canonical: {editorialBrain.currentSystem.canonical || 'None'}</p>
          <p>Event: {formatValue(editorialBrain.currentSystem.event)}</p>
          <p>Image: {formatValue(editorialBrain.currentSystem.imageStrategy)}</p>
          <p>Caption: {formatValue(editorialBrain.currentSystem.captionStrategy)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-[#333333] dark:bg-[#000000]">
          <p className="mb-2 text-xs uppercase tracking-wide text-[#6B7280] dark:text-[#9CA3AF]">Editorial brain</p>
          <p>Lane: {formatValue(editorialBrain.decision.lane)}</p>
          <p>Canonical: {editorialBrain.decision.canonical || 'None'}</p>
          <p>Event: {formatValue(editorialBrain.decision.event)}</p>
          <p>Image: {formatValue(editorialBrain.decision.imageStrategy)}</p>
          <p>Caption: {formatValue(editorialBrain.decision.captionStrategy)}</p>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-[#6B7280] dark:text-[#9CA3AF]">Disagreements</p>
        <div className="flex flex-wrap gap-2">
          {(editorialBrain.disagreements.length > 0 ? editorialBrain.disagreements : ['none']).map((code) => (
            <span
              key={code}
              className="rounded bg-white px-2 py-1 text-xs text-gray-700 dark:bg-[#111111] dark:text-[#D1D5DB]"
            >
              {formatValue(code)}
            </span>
          ))}
        </div>
      </div>

      {editorialBrain.runtime?.finalFailureCodes?.length ? (
        <div className="mt-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-[#6B7280] dark:text-[#9CA3AF]">Runtime failure codes</p>
          <div className="flex flex-wrap gap-2">
            {editorialBrain.runtime.finalFailureCodes.map((code) => (
              <span
                key={code}
                className="rounded bg-[#FEE2E2] px-2 py-1 text-xs text-[#B91C1C] dark:bg-[#991B1B]/30 dark:text-[#FCA5A5]"
              >
                {formatValue(code)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {REVIEW_OPTIONS.map((option) => (
          <Button
            key={option.outcome}
            variant="outline"
            size="sm"
            onClick={() => onReview(option.outcome)}
            disabled={isSaving}
            className="h-8 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
          >
            {option.label}
          </Button>
        ))}
      </div>

      {reviewLabel && (
        <p className="mt-3 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
          {reviewLabel}
        </p>
      )}
    </div>
  );
}
