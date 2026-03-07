/**
 * RSS Feed Service - real feed CRUD, refresh, activity, and preview support
 */

import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import Parser from 'rss-parser';
import aiService, { type AIModel } from './ai.service';
import { publisherService } from './publisher.service';

export interface RSSFeedFilters {
  scope: 'title' | 'body' | 'title_or_body' | 'title_and_body';
  required: Array<{
    text: string;
    matchType: 'contains' | 'exact';
    caseSensitive: boolean;
    active: boolean;
  }>;
  blocked: Array<{
    text: string;
    matchType: 'contains' | 'exact';
    caseSensitive: boolean;
    active: boolean;
  }>;
}

export interface PlatformsEnabled {
  x: boolean;
  threads: boolean;
  facebook: boolean;
  pinterest: boolean;
}

export interface RSSFeedInput {
  name: string;
  url: string;
  favicon?: string;
  enabled?: boolean;
  interval?: number;
  imageCount?: string;
  dedupeDays?: number;
  filters?: RSSFeedFilters;
  serperPriority?: boolean;
  rehostImages?: boolean;
  autoPost?: boolean;
  platformsEnabled?: PlatformsEnabled;
  status?: string;
}

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  imageUrl?: string;
  author?: string;
  guid?: string;
}

interface RSSFeedData {
  title: string;
  description: string;
  link: string;
  items: RSSItem[];
  lastBuildDate?: Date;
}

export interface RefreshResult {
  feedId: string;
  feedName: string;
  itemsAdded: number;
  checkedCount: number;
  pendingCount: number;
  failedCount: number;
  latestItemTitle?: string;
  error?: string;
}

export interface RSSActivityItem {
  id: string;
  feedId?: string;
  feedName: string;
  title: string;
  link?: string;
  description?: string;
  imageUrl?: string;
  status: 'pending' | 'published' | 'failed';
  timestamp: string;
  publishedAt?: string;
  platforms: string[];
  error?: string;
}

export interface RSSActivitySummary {
  total: number;
  published: number;
  pending: number;
  failed: number;
}

interface RSSActivityMetadata {
  category: 'rss_activity';
  feedId: string;
  feedName: string;
  itemTitle: string;
  itemLink?: string;
  description?: string;
  imageUrl?: string;
  publishedAt?: string;
  status: 'pending' | 'published' | 'failed';
  platforms: string[];
  errorMessage?: string;
}

interface RSSRuntimeSettings {
  globalRSSPosting: boolean;
  rssDeduplication: boolean;
  rssCaptionModel: string;
  rssCaptionPrompt?: string;
  rssCaptionTemperature?: number;
  rssCaptionTone?: string;
  rssCaptionMaxLength?: number;
  rssPostingIntervalMinutes: number;
  dailyQuotaX: number;
  dailyQuotaThreads: number;
  dailyQuotaFacebook: number;
  dailyQuotaPinterest: number;
  quietHoursEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  timezone: string;
}

const RSS_ACTIVITY_CATEGORY = 'rss_activity';
const DEFAULT_ITEM_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const RSS_SETTINGS_KEYS = [
  'globalRSSPosting',
  'rssDeduplication',
  'rssCaptionModel',
  'rssCaptionPrompt',
  'rssCaptionTemperature',
  'rssCaptionTone',
  'rssCaptionMaxLength',
  'rssPostingInterval',
  'dailyQuotaX',
  'dailyQuotaThreads',
  'dailyQuotaFacebook',
  'dailyQuotaPinterest',
  'quietHoursEnabled',
  'quietHoursStart',
  'quietHoursEnd',
  'timezone',
] as const;

const parser = new Parser<any, any>({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'dcCreator'],
    ],
  },
});

function asString(value: Prisma.JsonValue | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function asBoolean(value: Prisma.JsonValue | undefined, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function asNumber(value: Prisma.JsonValue | undefined, fallback?: number): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function stripHtml(value?: string): string {
  return (value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function ensureFeedFilters(filters?: RSSFeedFilters): RSSFeedFilters {
  return filters ?? { scope: 'title_or_body', required: [], blocked: [] };
}

function ensurePlatformsEnabled(platforms?: PlatformsEnabled): PlatformsEnabled {
  return platforms ?? { x: true, threads: true, facebook: false, pinterest: false };
}

function getEnabledPlatforms(platforms: PlatformsEnabled | Record<string, boolean> | null | undefined): string[] {
  const platformMap = platforms ?? {};
  return Object.entries(platformMap)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => {
      switch (key) {
        case 'x':
          return 'X';
        case 'threads':
          return 'Threads';
        case 'facebook':
          return 'Facebook';
        case 'pinterest':
          return 'Pinterest';
        default:
          return key;
      }
    });
}

function toAIModel(value: string): AIModel {
  switch (value) {
    case 'gpt-4o':
    case 'gpt-4o-mini':
    case 'gpt-4-turbo':
    case 'gpt-3.5-turbo':
    case 'flash-3':
      return value;
    default:
      return 'gpt-4o';
  }
}

function extractImageUrl(item: Record<string, any>): string | undefined {
  const enclosure = item.enclosure;
  if (enclosure?.url && (!enclosure.type || String(enclosure.type).startsWith('image/'))) {
    return enclosure.url;
  }

  const mediaContent = item.mediaContent;
  if (Array.isArray(mediaContent)) {
    for (const entry of mediaContent) {
      if (entry?.$?.url) return entry.$.url;
      if (entry?.url) return entry.url;
    }
  } else if (mediaContent?.$?.url) {
    return mediaContent.$.url;
  } else if (mediaContent?.url) {
    return mediaContent.url;
  }

  const mediaThumbnail = item.mediaThumbnail;
  if (Array.isArray(mediaThumbnail)) {
    for (const entry of mediaThumbnail) {
      if (entry?.$?.url) return entry.$.url;
      if (entry?.url) return entry.url;
    }
  } else if (mediaThumbnail?.$?.url) {
    return mediaThumbnail.$.url;
  } else if (mediaThumbnail?.url) {
    return mediaThumbnail.url;
  }

  const htmlContent = item['content:encoded'] || item.contentEncoded || item.content || item.contentSnippet || item.summary;
  const imageMatch = typeof htmlContent === 'string' ? htmlContent.match(/<img[^>]*src=["']([^"']+)["']/i) : null;
  return imageMatch?.[1];
}

function buildRSSCaptionSystemPrompt(
  basePrompt: string | undefined,
  options: { tone?: string; maxLength?: number }
): string | undefined {
  const constraints = [
    options.tone ? `- Preferred tone: ${options.tone}.` : null,
    options.maxLength ? `- Keep the final caption under ${options.maxLength} characters.` : null,
  ].filter(Boolean).join('\n');

  if (!basePrompt && !constraints) {
    return undefined;
  }

  return [basePrompt, constraints].filter(Boolean).join('\n\nAdditional Constraints:\n');
}

async function getRuntimeSettings(): Promise<RSSRuntimeSettings> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: [...RSS_SETTINGS_KEYS] } },
  });

  const settingsMap = new Map(settings.map((entry) => [entry.key, entry.value]));

  return {
    globalRSSPosting: asBoolean(settingsMap.get('globalRSSPosting'), true),
    rssDeduplication: asBoolean(settingsMap.get('rssDeduplication'), true),
    rssCaptionModel: asString(settingsMap.get('rssCaptionModel')) || 'gpt-4o',
    rssCaptionPrompt: asString(settingsMap.get('rssCaptionPrompt')),
    rssCaptionTemperature: asNumber(settingsMap.get('rssCaptionTemperature')),
    rssCaptionTone: asString(settingsMap.get('rssCaptionTone')) || 'Engaging',
    rssCaptionMaxLength: Math.max(50, asNumber(settingsMap.get('rssCaptionMaxLength'), 280) || 280),
    rssPostingIntervalMinutes: Math.max(1, asNumber(settingsMap.get('rssPostingInterval'), 10) || 10),
    dailyQuotaX: Math.max(1, asNumber(settingsMap.get('dailyQuotaX'), 50) || 50),
    dailyQuotaThreads: Math.max(1, asNumber(settingsMap.get('dailyQuotaThreads'), 100) || 100),
    dailyQuotaFacebook: Math.max(1, asNumber(settingsMap.get('dailyQuotaFacebook'), 25) || 25),
    dailyQuotaPinterest: Math.max(1, asNumber(settingsMap.get('dailyQuotaPinterest'), 100) || 100),
    quietHoursEnabled: asBoolean(settingsMap.get('quietHoursEnabled'), true),
    quietHoursStart: Math.max(0, Math.min(23, asNumber(settingsMap.get('quietHoursStart'), 0) || 0)),
    quietHoursEnd: Math.max(0, Math.min(23, asNumber(settingsMap.get('quietHoursEnd'), 7) || 7)),
    timezone: asString(settingsMap.get('timezone')) || 'UTC',
  };
}

function buildActivityMessage(metadata: RSSActivityMetadata): string {
  if (metadata.status === 'published') {
    return `${metadata.feedName}: published ${metadata.itemTitle}`;
  }
  if (metadata.status === 'failed') {
    return `${metadata.feedName}: failed ${metadata.itemTitle}`;
  }
  return `${metadata.feedName}: pending ${metadata.itemTitle}`;
}

async function logRSSActivity(metadata: RSSActivityMetadata): Promise<void> {
  await prisma.log.create({
    data: {
      level: metadata.status === 'failed' ? 'error' : 'info',
      message: buildActivityMessage(metadata),
      service: 'rss',
      metadata: metadata as unknown as Prisma.InputJsonValue,
    },
  });
}

function parseRSSActivityLog(log: { id: string; timestamp: Date; metadata: Prisma.JsonValue | null }): RSSActivityItem | null {
  const metadata = log.metadata as Prisma.JsonObject | null;
  if (!metadata || metadata.category !== RSS_ACTIVITY_CATEGORY) {
    return null;
  }

  const status = metadata.status;
  if (status !== 'pending' && status !== 'published' && status !== 'failed') {
    return null;
  }

  const platforms = Array.isArray(metadata.platforms)
    ? metadata.platforms.map((platform) => String(platform))
    : [];

  return {
    id: log.id,
    feedId: typeof metadata.feedId === 'string' ? metadata.feedId : undefined,
    feedName: typeof metadata.feedName === 'string' ? metadata.feedName : 'Unknown feed',
    title: typeof metadata.itemTitle === 'string' ? metadata.itemTitle : 'Untitled item',
    link: typeof metadata.itemLink === 'string' ? metadata.itemLink : undefined,
    description: typeof metadata.description === 'string' ? metadata.description : undefined,
    imageUrl: typeof metadata.imageUrl === 'string' ? metadata.imageUrl : undefined,
    status,
    timestamp: log.timestamp.toISOString(),
    publishedAt: typeof metadata.publishedAt === 'string' ? metadata.publishedAt : undefined,
    platforms,
    error: typeof metadata.errorMessage === 'string' ? metadata.errorMessage : undefined,
  };
}

function buildActivitySummary(items: RSSActivityItem[]): RSSActivitySummary {
  return {
    total: items.length,
    published: items.filter((item) => item.status === 'published').length,
    pending: items.filter((item) => item.status === 'pending').length,
    failed: items.filter((item) => item.status === 'failed').length,
  };
}

async function wasRecentlyPublished(feedId: string, item: RSSItem, dedupeDays: number): Promise<boolean> {
  const cutoff = new Date(Date.now() - Math.max(dedupeDays, 1) * 24 * 60 * 60 * 1000);
  const logs = await prisma.log.findMany({
    where: {
      service: 'rss',
      timestamp: { gte: cutoff },
    },
    orderBy: { timestamp: 'desc' },
    take: 500,
  });

  return logs.some((log) => {
    const metadata = log.metadata as Prisma.JsonObject | null;
    if (!metadata || metadata.category !== RSS_ACTIVITY_CATEGORY || metadata.status !== 'published') {
      return false;
    }

    const sameFeed = metadata.feedId === feedId;
    const sameLink = typeof metadata.itemLink === 'string' && metadata.itemLink === item.link;
    const sameTitle = typeof metadata.itemTitle === 'string' && metadata.itemTitle === item.title;
    return sameFeed && (sameLink || sameTitle);
  });
}

function isWithinQuietHours(settings: RSSRuntimeSettings, now: Date = new Date()): boolean {
  if (!settings.quietHoursEnabled) return false;

  const hourFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: settings.timezone,
    hour: 'numeric',
    hour12: false,
  });
  const currentHour = Number.parseInt(hourFormatter.format(now), 10);

  if (!Number.isFinite(currentHour)) {
    return false;
  }

  if (settings.quietHoursStart === settings.quietHoursEnd) {
    return true;
  }

  if (settings.quietHoursStart < settings.quietHoursEnd) {
    return currentHour >= settings.quietHoursStart && currentHour < settings.quietHoursEnd;
  }

  return currentHour >= settings.quietHoursStart || currentHour < settings.quietHoursEnd;
}

async function getPublishingBlockReason(platforms: string[], settings: RSSRuntimeSettings): Promise<string | null> {
  if (isWithinQuietHours(settings)) {
    return 'Publishing is paused by quiet hours.';
  }

  const recentPublishedLogs = await prisma.log.findMany({
    where: {
      service: 'rss',
      timestamp: { gte: new Date(Date.now() - settings.rssPostingIntervalMinutes * 60 * 1000) },
    },
    orderBy: { timestamp: 'desc' },
    take: 200,
  });

  const recentPublished = recentPublishedLogs
    .map((log) => parseRSSActivityLog(log))
    .find((item) => item?.status === 'published');

  if (recentPublished) {
    return `Waiting for the ${settings.rssPostingIntervalMinutes}-minute minimum gap before the next post.`;
  }

  const quotaMap: Record<string, number> = {
    X: settings.dailyQuotaX,
    Threads: settings.dailyQuotaThreads,
    Facebook: settings.dailyQuotaFacebook,
    Pinterest: settings.dailyQuotaPinterest,
  };

  const recentDayLogs = await prisma.log.findMany({
    where: {
      service: 'rss',
      timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { timestamp: 'desc' },
    take: 1000,
  });

  const publishedItems = recentDayLogs
    .map((log) => parseRSSActivityLog(log))
    .filter((item): item is RSSActivityItem => Boolean(item && item.status === 'published'));

  for (const platform of platforms) {
    const quota = quotaMap[platform];
    if (!quota) continue;

    const used = publishedItems.filter((item) => item.platforms.includes(platform)).length;
    if (used >= quota) {
      return `${platform} has reached its daily publishing quota.`;
    }
  }

  return null;
}

async function persistFeedSnapshot(feedId: string, item: RSSItem | undefined, caption: string | null, platforms: string[]): Promise<void> {
  if (!item) return;

  await prisma.rSSFeed.update({
    where: { id: feedId },
    data: {
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      publishedDate: item.pubDate,
      platforms,
      caption,
    },
  });
}

async function fetchRSSFeed(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Screndly RSS Reader/1.0',
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch RSS: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function parseRSSFeed(xml: string): Promise<RSSFeedData> {
  const parsed = await parser.parseString(xml);

  return {
    title: parsed.title || 'Unknown Feed',
    description: stripHtml(parsed.description || ''),
    link: parsed.link || '',
    lastBuildDate: parsed.lastBuildDate ? new Date(parsed.lastBuildDate) : undefined,
    items: (parsed.items || [])
      .map((item: any) => {
        const description = stripHtml(item.contentSnippet || item.content || item['content:encoded'] || item.summary || item.contentEncoded || '');
        const pubDate = item.isoDate || item.pubDate ? new Date(item.isoDate || item.pubDate) : new Date();

        return {
          title: String(item.title || '').trim(),
          link: String(item.link || '').trim(),
          description: description.slice(0, 1000),
          pubDate: Number.isNaN(pubDate.getTime()) ? new Date() : pubDate,
          imageUrl: extractImageUrl(item),
          author: String(item.creator || item.author || item.dcCreator || '').trim() || undefined,
          guid: String(item.guid || '').trim() || undefined,
        } satisfies RSSItem;
      })
      .filter((item: RSSItem) => Boolean(item.title && item.link)),
  };
}

async function getAllFeeds() {
  return prisma.rSSFeed.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

async function getFeedById(id: string) {
  return prisma.rSSFeed.findUnique({
    where: { id },
  });
}

async function createFeed(data: RSSFeedInput) {
  let favicon = data.favicon;
  if (!favicon) {
    try {
      const urlObj = new URL(data.url);
      favicon = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
    } catch {
      favicon = undefined;
    }
  }

  let feedTitle = data.name;
  try {
    const xml = await fetchRSSFeed(data.url);
    const parsed = await parseRSSFeed(xml);
    if (!feedTitle || feedTitle === 'New Feed') {
      feedTitle = parsed.title;
    }
  } catch (error) {
    console.warn('[RSS] Could not fetch feed during creation:', error);
  }

  return prisma.rSSFeed.create({
    data: {
      name: feedTitle || data.name,
      url: data.url,
      favicon,
      enabled: data.enabled ?? true,
      interval: data.interval ?? 10,
      imageCount: data.imageCount ?? '2',
      dedupeDays: data.dedupeDays ?? 30,
      filters: ensureFeedFilters(data.filters) as unknown as Prisma.InputJsonValue,
      serperPriority: data.serperPriority ?? true,
      rehostImages: data.rehostImages ?? false,
      autoPost: data.autoPost ?? true,
      platformsEnabled: ensurePlatformsEnabled(data.platformsEnabled) as unknown as Prisma.InputJsonValue,
      status: data.status ?? 'active',
      source: feedTitle || data.name,
    },
  });
}

async function updateFeed(
  id: string,
  data: Partial<RSSFeedInput> & { lastProcessedAt?: Date; nextRunAt?: Date; errorMessage?: string }
) {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.url !== undefined) updateData.url = data.url;
  if (data.favicon !== undefined) updateData.favicon = data.favicon;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.interval !== undefined) updateData.interval = data.interval;
  if (data.imageCount !== undefined) updateData.imageCount = data.imageCount;
  if (data.dedupeDays !== undefined) updateData.dedupeDays = data.dedupeDays;
  if (data.filters !== undefined) updateData.filters = data.filters;
  if (data.serperPriority !== undefined) updateData.serperPriority = data.serperPriority;
  if (data.rehostImages !== undefined) updateData.rehostImages = data.rehostImages;
  if (data.autoPost !== undefined) updateData.autoPost = data.autoPost;
  if (data.platformsEnabled !== undefined) updateData.platformsEnabled = data.platformsEnabled;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.lastProcessedAt !== undefined) updateData.lastProcessedAt = data.lastProcessedAt;
  if (data.nextRunAt !== undefined) updateData.nextRunAt = data.nextRunAt;
  if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;

  return prisma.rSSFeed.update({
    where: { id },
    data: updateData,
  });
}

async function deleteFeed(id: string) {
  return prisma.rSSFeed.delete({
    where: { id },
  });
}

async function refreshFeed(id: string): Promise<RefreshResult> {
  const feed = await prisma.rSSFeed.findUnique({ where: { id } });

  if (!feed) {
    return {
      feedId: id,
      feedName: 'Unknown',
      itemsAdded: 0,
      checkedCount: 0,
      pendingCount: 0,
      failedCount: 0,
      error: 'Feed not found',
    };
  }

  const runtimeSettings = await getRuntimeSettings();
  const nextRunAt = new Date(Date.now() + feed.interval * 60 * 1000);

  try {
    const xml = await fetchRSSFeed(feed.url);
    const parsed = await parseRSSFeed(xml);
    const cutoffDate = feed.lastProcessedAt || new Date(Date.now() - DEFAULT_ITEM_LOOKBACK_MS);
    const newItems = parsed.items
      .filter((item) => item.pubDate > cutoffDate)
      .sort((a, b) => a.pubDate.getTime() - b.pubDate.getTime());

    const platforms = getEnabledPlatforms(feed.platformsEnabled as Record<string, boolean> | null);
    let publishedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let latestHandledItem: RSSItem | undefined;
    let latestCaption: string | null = null;
    let retryFromDate: Date | null = null;

    for (const item of newItems) {
      latestHandledItem = item;

      if (runtimeSettings.rssDeduplication && await wasRecentlyPublished(feed.id, item, feed.dedupeDays)) {
        continue;
      }

      if (!runtimeSettings.globalRSSPosting || !feed.autoPost || platforms.length === 0) {
        pendingCount += 1;
        retryFromDate = !retryFromDate || item.pubDate.getTime() < retryFromDate.getTime() ? item.pubDate : retryFromDate;
        await logRSSActivity({
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          imageUrl: item.imageUrl,
          publishedAt: item.pubDate.toISOString(),
          status: 'pending',
          platforms,
          errorMessage: !runtimeSettings.globalRSSPosting
            ? 'Global RSS posting is disabled.'
            : !feed.autoPost
              ? 'Auto-post is disabled for this feed.'
              : 'No publishing platforms are enabled for this feed.',
        });
        continue;
      }

      const blockReason = await getPublishingBlockReason(platforms, runtimeSettings);
      if (blockReason) {
        pendingCount += 1;
        retryFromDate = !retryFromDate || item.pubDate.getTime() < retryFromDate.getTime() ? item.pubDate : retryFromDate;
        await logRSSActivity({
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          imageUrl: item.imageUrl,
          publishedAt: item.pubDate.toISOString(),
          status: 'pending',
          platforms,
          errorMessage: blockReason,
        });
        continue;
      }

      try {
        const systemPrompt = buildRSSCaptionSystemPrompt(runtimeSettings.rssCaptionPrompt, {
          tone: runtimeSettings.rssCaptionTone,
          maxLength: runtimeSettings.rssCaptionMaxLength,
        });
        const caption = await aiService.generateRSSCaption(
          {
            articleTitle: item.title,
            feedName: feed.name,
            summary: item.description,
            platform: 'X',
          },
          toAIModel(runtimeSettings.rssCaptionModel),
          systemPrompt,
          runtimeSettings.rssCaptionTemperature
        );

        const publishResults = await publisherService.publish(platforms, {
          text: caption,
          title: item.title,
          link: item.link,
          imageUrl: item.imageUrl,
        });

        const successfulPlatforms = publishResults
          .filter((result) => result.status === 'posted')
          .map((result) => result.platform);

        if (successfulPlatforms.length === 0) {
          failedCount += 1;
          await logRSSActivity({
            category: RSS_ACTIVITY_CATEGORY,
            feedId: feed.id,
            feedName: feed.name,
            itemTitle: item.title,
            itemLink: item.link,
            description: item.description,
            imageUrl: item.imageUrl,
            publishedAt: item.pubDate.toISOString(),
            status: 'failed',
            platforms,
            errorMessage: publishResults
              .map((result) => `${result.platform}: ${result.error || result.status}`)
              .join('; ') || 'Publishing failed.',
          });
          continue;
        }

        publishedCount += 1;
        latestCaption = caption;
        await logRSSActivity({
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          imageUrl: item.imageUrl,
          publishedAt: item.pubDate.toISOString(),
          status: 'published',
          platforms: successfulPlatforms,
        });
      } catch (error) {
        failedCount += 1;
        await logRSSActivity({
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          imageUrl: item.imageUrl,
          publishedAt: item.pubDate.toISOString(),
          status: 'failed',
          platforms,
          errorMessage: error instanceof Error ? error.message : 'Failed to process RSS item.',
        });
      }
    }

    await prisma.rSSFeed.update({
      where: { id },
      data: {
        status: 'active',
        source: feed.name,
        lastProcessedAt: retryFromDate ? new Date(retryFromDate.getTime() - 1000) : new Date(),
        nextRunAt,
        errorMessage: null,
        updatedAt: new Date(),
      },
    });

    await persistFeedSnapshot(feed.id, latestHandledItem || parsed.items[0], latestCaption, platforms);

    return {
      feedId: feed.id,
      feedName: feed.name,
      itemsAdded: publishedCount,
      checkedCount: newItems.length,
      pendingCount,
      failedCount,
      latestItemTitle: latestHandledItem?.title || parsed.items[0]?.title,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await prisma.rSSFeed.update({
      where: { id },
      data: {
        status: 'error',
        errorMessage,
        nextRunAt,
        updatedAt: new Date(),
      },
    });

    return {
      feedId: feed.id,
      feedName: feed.name,
      itemsAdded: 0,
      checkedCount: 0,
      pendingCount: 0,
      failedCount: 1,
      error: errorMessage,
    };
  }
}

async function refreshAllFeeds(checkSchedule: boolean = false): Promise<{
  total: number;
  success: number;
  failed: number;
  isScheduledRun: boolean;
  results: RefreshResult[];
}> {
  const where: Prisma.RSSFeedWhereInput = { enabled: true };

  if (checkSchedule) {
    where.OR = [
      { nextRunAt: null },
      { nextRunAt: { lte: new Date() } },
    ];
  }

  const feeds = await prisma.rSSFeed.findMany({ where });

  if (checkSchedule && feeds.length === 0) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      isScheduledRun: true,
      results: [],
    };
  }

  const results: RefreshResult[] = [];
  for (const feed of feeds) {
    results.push(await refreshFeed(feed.id));
  }

  return {
    total: feeds.length,
    success: results.filter((result) => !result.error).length,
    failed: results.filter((result) => Boolean(result.error)).length,
    isScheduledRun: checkSchedule,
    results,
  };
}

async function getRSSActivity(limit: number = 100): Promise<{ items: RSSActivityItem[]; summary: RSSActivitySummary }> {
  const logs = await prisma.log.findMany({
    where: { service: 'rss' },
    orderBy: { timestamp: 'desc' },
    take: Math.max(limit * 5, 200),
  });

  const items = logs
    .map((log) => parseRSSActivityLog(log))
    .filter((item): item is RSSActivityItem => Boolean(item))
    .slice(0, limit);

  return {
    items,
    summary: buildActivitySummary(items),
  };
}

async function deleteRSSActivity(id: string): Promise<void> {
  await prisma.log.delete({
    where: { id },
  });
}

export {
  fetchRSSFeed,
  parseRSSFeed,
  getAllFeeds,
  getFeedById,
  createFeed,
  updateFeed,
  deleteFeed,
  refreshFeed,
  refreshAllFeeds,
  getRSSActivity,
  deleteRSSActivity,
};

export default {
  fetchRSSFeed,
  parseRSSFeed,
  getAllFeeds,
  getFeedById,
  createFeed,
  updateFeed,
  deleteFeed,
  refreshFeed,
  refreshAllFeeds,
  getRSSActivity,
  deleteRSSActivity,
};
