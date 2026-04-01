export type TMDbPlatformPublishStatus =
  | 'pending'
  | 'publishing'
  | 'posted'
  | 'failed'
  | 'retrying'
  | 'skipped';

export type TMDbActivityDerivedStatus =
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'partial_failed'
  | 'failed';

export interface TMDbPlatformResultRecord {
  platform: string;
  status: TMDbPlatformPublishStatus;
  error?: string;
  id?: string;
  url?: string;
  postedAt?: string;
  lastAttemptAt?: string;
  retryCount?: number;
}

export interface TMDbActivityStatusSource {
  status?: string;
  platforms?: string[];
  platformPostIds?: Record<string, string>;
  platformResults?: TMDbPlatformResultRecord[];
  publishedTime?: string;
  errorMessage?: string;
}

export interface TMDbDerivedPlatformState {
  platform: string;
  label: string;
  status: TMDbPlatformPublishStatus;
  publishedAt?: string;
  postId?: string;
  url?: string;
  errorMessage?: string;
  lastAttemptAt?: string;
  retryCount?: number;
}

export function normalizeTMDbPlatformKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized === 'twitter' ? 'x' : normalized;
}

export function formatTMDbPlatformLabel(platform: string): string {
  switch (normalizeTMDbPlatformKey(platform)) {
    case 'x':
      return 'X';
    case 'threads':
      return 'Threads';
    case 'facebook':
      return 'Facebook';
    case 'youtube':
      return 'YouTube';
    case 'pinterest':
      return 'Pinterest';
    default:
      return platform;
  }
}

export function deriveTMDbPlatformStates(item: TMDbActivityStatusSource): TMDbDerivedPlatformState[] {
  const selectedPlatforms = Array.from(
    new Set([
      ...(item.platforms || []).map((platform) => normalizeTMDbPlatformKey(platform)),
      ...Object.keys(item.platformPostIds || {}).map((platform) => normalizeTMDbPlatformKey(platform)),
      ...(item.platformResults || []).map((result) => normalizeTMDbPlatformKey(result.platform)),
    ].filter(Boolean))
  );

  const postIds = new Map(
    Object.entries(item.platformPostIds || {}).map(([platform, postId]) => [normalizeTMDbPlatformKey(platform), postId] as const)
  );
  const results = new Map(
    (item.platformResults || []).map((result) => [normalizeTMDbPlatformKey(result.platform), result] as const)
  );

  return selectedPlatforms.map((platform) => {
    const result = results.get(platform);
    const postId = postIds.get(platform);

    if (postId || result?.status === 'posted') {
      return {
        platform,
        label: formatTMDbPlatformLabel(platform),
        status: 'posted',
        postId: postId || result?.id,
        publishedAt: result?.postedAt || item.publishedTime,
        url: result?.url,
        lastAttemptAt: result?.lastAttemptAt,
        retryCount: result?.retryCount,
      };
    }

    if (result?.status === 'failed') {
      return {
        platform,
        label: formatTMDbPlatformLabel(platform),
        status: 'failed',
        errorMessage: result.error,
        lastAttemptAt: result.lastAttemptAt,
        retryCount: result.retryCount,
      };
    }

    if (result?.status === 'retrying' || result?.status === 'publishing' || result?.status === 'pending') {
      return {
        platform,
        label: formatTMDbPlatformLabel(platform),
        status: result.status,
        lastAttemptAt: result.lastAttemptAt,
        retryCount: result.retryCount,
      };
    }

    if (result?.status === 'skipped') {
      return {
        platform,
        label: formatTMDbPlatformLabel(platform),
        status: 'skipped',
      };
    }

    if (item.status === 'queued' || item.status === 'dispatched') {
      return {
        platform,
        label: formatTMDbPlatformLabel(platform),
        status: 'publishing',
      };
    }

    return {
      platform,
      label: formatTMDbPlatformLabel(platform),
      status: item.status === 'failed' ? 'failed' : 'pending',
      errorMessage: item.status === 'failed' ? item.errorMessage : undefined,
    };
  });
}

export function deriveTMDbActivityStatus(
  item: TMDbActivityStatusSource,
  platformStates: TMDbDerivedPlatformState[]
): TMDbActivityDerivedStatus {
  const activeStates = platformStates.filter((state) => state.status !== 'skipped');

  if (activeStates.length === 0) {
    return item.status === 'scheduled' ? 'scheduled' : 'publishing';
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

  return item.status === 'scheduled' ? 'scheduled' : 'publishing';
}

export function getRetryableTMDbPlatforms(platformStates: TMDbDerivedPlatformState[]): TMDbDerivedPlatformState[] {
  return platformStates.filter((state) => state.status === 'failed');
}

export function getRetryFailedLabel(count: number): string {
  if (count <= 1) {
    return 'Retry failed platform';
  }

  return `Retry ${count} failed platforms`;
}

export function getTMDbPublishSummary(platformStates: TMDbDerivedPlatformState[]): string | null {
  const activeStates = platformStates.filter((state) => state.status !== 'skipped');
  if (activeStates.length === 0) {
    return null;
  }

  const postedCount = activeStates.filter((state) => state.status === 'posted').length;
  const failedCount = activeStates.filter((state) => state.status === 'failed').length;
  const publishingCount = activeStates.filter((state) => state.status === 'publishing' || state.status === 'retrying' || state.status === 'pending').length;

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
