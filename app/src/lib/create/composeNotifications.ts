import type { NotificationSource } from '../../contexts/NotificationsContext';
import type { ComposeItem, ComposePlatformKey } from '../../types/compose';
import type { ComposePublishOutcome } from './composePublish';

type CreateStudioNotification = {
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  source: NotificationSource;
  actionPage: string;
};

const PLATFORM_NAME_BY_KEY: Record<ComposePlatformKey, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  threads: 'Threads',
  x: 'X',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
};

function formatList(values: string[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function describePlatforms(platforms: ComposePlatformKey[]): string {
  const unique = Array.from(new Set(platforms)).map((platform) => PLATFORM_NAME_BY_KEY[platform]);
  return formatList(unique);
}

function describeMedia(item: ComposeItem): string {
  const imageCount = item.mediaAssets.filter((asset) => asset.kind === 'image').length;
  const videoCount = item.mediaAssets.filter((asset) => asset.kind === 'video').length;
  const parts: string[] = [];

  if (imageCount > 0) {
    parts.push(`${imageCount} image${imageCount === 1 ? '' : 's'}`);
  }

  if (videoCount > 0) {
    parts.push(`${videoCount} video${videoCount === 1 ? '' : 's'}`);
  }

  if (parts.length === 0) return 'no media';
  return formatList(parts);
}

function describeItem(item: ComposeItem): string {
  const title = item.title?.trim();
  if (title && title !== 'Untitled post') {
    return title;
  }

  const firstAsset = item.mediaAssets[0]?.fileName?.trim();
  if (firstAsset) {
    return firstAsset;
  }

  const caption = item.sharedCaption?.trim();
  if (caption) {
    return caption.slice(0, 60);
  }

  return 'Untitled post';
}

function baseNotification(
  title: string,
  message: string,
  type: CreateStudioNotification['type'],
): CreateStudioNotification {
  return {
    title,
    message,
    type,
    source: 'create_studio',
    actionPage: '/create',
  };
}

export function buildComposeDraftNotification(item: ComposeItem, mode: 'created' | 'updated'): CreateStudioNotification {
  const itemLabel = describeItem(item);
  const platforms = describePlatforms(item.platforms);
  const media = describeMedia(item);

  return baseNotification(
    mode === 'created' ? `Post draft saved: ${itemLabel}` : `Post draft updated: ${itemLabel}`,
    platforms
      ? `Saved ${media} for ${platforms}.`
      : `Saved ${media}.`,
    'success',
  );
}

export function buildComposeScheduledNotification(item: ComposeItem, scheduledAt: string): CreateStudioNotification {
  const itemLabel = describeItem(item);
  const scheduleLabel = new Date(scheduledAt).toLocaleString();
  const platforms = describePlatforms(item.platforms);

  return baseNotification(
    `Post scheduled: ${itemLabel}`,
    platforms
      ? `Scheduled for ${scheduleLabel} on ${platforms}.`
      : `Scheduled for ${scheduleLabel}.`,
    'success',
  );
}

export function buildComposePublishSuccessNotification(
  item: ComposeItem,
  result: ComposePublishOutcome,
): CreateStudioNotification {
  const itemLabel = describeItem(item);
  const postedPlatforms = formatList(result.postedPlatforms);

  if (result.failedResults.length > 0) {
    const failed = result.failedResults
      .map((entry) => `${entry.platform}: ${entry.error}`)
      .join('; ');

    return baseNotification(
      `Post partially published: ${itemLabel}`,
      `${itemLabel} posted to ${postedPlatforms}. Remaining issues: ${failed}`,
      'warning',
    );
  }

  return baseNotification(
    `Post published: ${itemLabel}`,
    `${itemLabel} posted to ${postedPlatforms}.`,
    'success',
  );
}

export function buildComposePublishFailureNotification(item: ComposeItem, message: string): CreateStudioNotification {
  const itemLabel = describeItem(item);
  return baseNotification(
    `Post publish failed: ${itemLabel}`,
    message,
    'error',
  );
}
