import type { RSSActivityItem } from '../../contexts/RSSFeedsContext';

export type RSSPlatformPublishStatus =
  | 'pending'
  | 'publishing'
  | 'posted'
  | 'failed'
  | 'retrying'
  | 'skipped';

export type RSSActivityDerivedStatus =
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'partial_failed'
  | 'failed'
  | 'filtered';

export interface RSSDerivedPlatformState {
  platform: string;
  label: string;
  status: RSSPlatformPublishStatus;
  publishedAt?: string;
  postId?: string;
  url?: string;
  errorMessage?: string;
}

function normalizePlatformKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized === 'twitter' ? 'x' : normalized;
}

function formatPlatformLabel(platform: string): string {
  switch (normalizePlatformKey(platform)) {
    case 'x':
      return 'X';
    case 'threads':
      return 'Threads';
    case 'facebook':
      return 'Facebook';
    case 'pinterest':
      return 'Pinterest';
    default:
      return platform;
  }
}

export function deriveRSSPlatformStates(item: RSSActivityItem): RSSDerivedPlatformState[] {
  const selectedPlatforms = Array.from(
    new Set([
      ...(item.platforms || []).map((platform) => normalizePlatformKey(platform)),
      ...Object.keys(item.platformPostIds || {}).map((platform) => normalizePlatformKey(platform)),
      ...(item.platformResults || []).map((result) => normalizePlatformKey(result.platform)),
    ].filter(Boolean))
  );

  const postIds = new Map(
    Object.entries(item.platformPostIds || {}).map(([platform, postId]) => [normalizePlatformKey(platform), postId] as const)
  );
  const results = new Map(
    (item.platformResults || []).map((result) => [normalizePlatformKey(result.platform), result] as const)
  );

  return selectedPlatforms.map((platform) => {
    const result = results.get(platform);
    const postId = postIds.get(platform);

    if (postId || result?.status === 'posted') {
      return {
        platform,
        label: formatPlatformLabel(platform),
        status: 'posted',
        postId: postId || result?.id,
        publishedAt: result?.postedAt || item.publishedAt,
        url: result?.url,
      };
    }

    if (result?.status === 'failed') {
      return {
        platform,
        label: formatPlatformLabel(platform),
        status: 'failed',
        errorMessage: result.error,
      };
    }

    if (result?.status === 'skipped') {
      return {
        platform,
        label: formatPlatformLabel(platform),
        status: 'skipped',
      };
    }

    if (item.status === 'pending') {
      return {
        platform,
        label: formatPlatformLabel(platform),
        status: 'publishing',
      };
    }

    return {
      platform,
      label: formatPlatformLabel(platform),
      status: item.status === 'failed' ? 'failed' : 'pending',
      errorMessage: item.status === 'failed' ? item.error : undefined,
    };
  });
}

export function deriveRSSActivityStatus(
  item: RSSActivityItem,
  platformStates: RSSDerivedPlatformState[]
): RSSActivityDerivedStatus {
  if (item.status === 'filtered') {
    return 'filtered';
  }

  const activeStates = platformStates.filter((state) => state.status !== 'skipped');
  if (activeStates.length === 0) {
    return 'scheduled';
  }

  if (activeStates.every((state) => state.status === 'posted')) {
    return 'published';
  }

  if (activeStates.some((state) => state.status === 'pending' || state.status === 'publishing' || state.status === 'retrying')) {
    return 'publishing';
  }

  const failedCount = activeStates.filter((state) => state.status === 'failed').length;
  const postedCount = activeStates.filter((state) => state.status === 'posted').length;

  if (failedCount > 0 && postedCount > 0) {
    return 'partial_failed';
  }

  if (failedCount > 0) {
    return 'failed';
  }

  return 'scheduled';
}

export function getRetryableRSSPlatforms(platformStates: RSSDerivedPlatformState[]): RSSDerivedPlatformState[] {
  return platformStates.filter((state) => state.status === 'failed');
}

export function getRetryFailedLabel(count: number): string {
  if (count <= 1) {
    return 'Retry failed platform';
  }

  return `Retry ${count} failed platforms`;
}

export function getRSSPublishSummary(platformStates: RSSDerivedPlatformState[]): string | null {
  const activeStates = platformStates.filter((state) => state.status !== 'skipped');
  if (activeStates.length === 0) {
    return null;
  }

  const postedCount = activeStates.filter((state) => state.status === 'posted').length;
  const failedCount = activeStates.filter((state) => state.status === 'failed').length;
  const publishingCount = activeStates.filter((state) => state.status === 'publishing' || state.status === 'retrying').length;

  if (postedCount === activeStates.length) {
    return `${postedCount}/${activeStates.length} posted`;
  }

  const segments = [`${postedCount}/${activeStates.length} posted`];
  if (failedCount > 0) {
    segments.push(`${failedCount} failed`);
  }
  if (publishingCount > 0) {
    segments.push(`${publishingCount} publishing`);
  }

  return segments.join(', ');
}
