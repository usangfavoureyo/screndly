/**
 * RSS Feed Service - real feed CRUD, refresh, activity, and preview support
 */

import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import Parser from 'rss-parser';
import aiService, { DEFAULT_OPENAI_MODEL, normalizeAIModel } from './ai.service';
import { publisherService } from './publisher.service';
import { resolveRelevantRSSImages, type RSSResolvedImage } from './rss-image-selection.service';

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
  onlyFetchNewItems?: boolean;
  startFromNowAt?: string | null;
}

export interface PlatformsEnabled {
  x: boolean;
  threads: boolean;
  facebook: boolean;
  pinterest: boolean;
}

export interface PlatformImageCounts {
  x?: number;
  threads?: number;
  facebook?: number;
  pinterest?: number;
}

export interface RSSFeedInput {
  name: string;
  url: string;
  favicon?: string;
  enabled?: boolean;
  interval?: number;
  imageCount?: string;
  platformImageCounts?: PlatformImageCounts;
  dedupeDays?: number;
  filters?: RSSFeedFilters;
  serperPriority?: boolean;
  rehostImages?: boolean;
  autoPost?: boolean;
  platformsEnabled?: PlatformsEnabled;
  trickle?: 'newest_first' | 'oldest_first';
  status?: string;
  onlyFetchNewItems?: boolean;
  startFromNowAt?: string | null;
}

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  imageUrl?: string;
  imageUrls: string[];
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

const RSS_PLATFORM_IMAGE_LIMITS: Record<string, number> = {
  X: 4,
  Threads: 1,
  Facebook: 1,
  Pinterest: 1,
};

export interface RefreshResult {
  feedId: string;
  feedName: string;
  itemsAdded: number;
  checkedCount: number;
  pendingCount: number;
  failedCount: number;
  latestItemTitle?: string;
  error?: string;
  selectionMode?: 'backlog' | 'latest_item';
}

interface RefreshFeedOptions {
  manualRun?: boolean;
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

export interface RSSPipelinePreview {
  title: string;
  link: string;
  pubDate: string;
  snippet: string;
  images: Array<{
    url: string;
    reason: string;
  }>;
  caption: string;
  captionCharCount: number;
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

type RSSFeedColumnSupport = {
  platformImageCounts: boolean;
  trickle: boolean;
};

let rssFeedColumnSupportPromise: Promise<RSSFeedColumnSupport> | null = null;

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

async function getRSSFeedColumnSupport(): Promise<RSSFeedColumnSupport> {
  if (!rssFeedColumnSupportPromise) {
    rssFeedColumnSupportPromise = (async () => {
      try {
        const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'RSSFeed'
            AND column_name IN ('platformImageCounts', 'trickle')
        `;

        const columnNames = new Set(columns.map((column) => column.column_name));
        return {
          platformImageCounts: columnNames.has('platformImageCounts'),
          trickle: columnNames.has('trickle'),
        };
      } catch (error) {
        console.warn('[RSS] Failed to inspect RSSFeed columns. Assuming latest schema.', error);
        return {
          platformImageCounts: true,
          trickle: true,
        };
      }
    })();
  }

  return rssFeedColumnSupportPromise;
}

async function getRSSFeedSelect(): Promise<Prisma.RSSFeedSelect> {
  const support = await getRSSFeedColumnSupport();

  return {
    id: true,
    name: true,
    url: true,
    favicon: true,
    enabled: true,
    interval: true,
    imageCount: true,
    dedupeDays: true,
    filters: true,
    serperPriority: true,
    rehostImages: true,
    autoPost: true,
    platformsEnabled: true,
    status: true,
    lastProcessedAt: true,
    nextRunAt: true,
    source: true,
    title: true,
    description: true,
    imageUrl: true,
    publishedDate: true,
    scheduledTime: true,
    platforms: true,
    caption: true,
    errorMessage: true,
    createdAt: true,
    updatedAt: true,
    ...(support.platformImageCounts ? { platformImageCounts: true } : {}),
    ...(support.trickle ? { trickle: true } : {}),
  };
}

function applyRSSFeedCompatibility<T extends Record<string, any> | null>(feed: T): (T & {
  platformImageCounts?: Prisma.JsonValue | null;
  trickle: 'newest_first' | 'oldest_first';
}) | null {
  if (!feed) {
    return null;
  }

  return {
    ...feed,
    platformImageCounts: 'platformImageCounts' in feed ? feed.platformImageCounts : null,
    trickle: normalizeTrickle(typeof feed.trickle === 'string' ? feed.trickle : undefined),
  };
}

function applyRSSFeedCompatibilityList<T extends Record<string, any>>(feeds: T[]): Array<T & {
  platformImageCounts?: Prisma.JsonValue | null;
  trickle: 'newest_first' | 'oldest_first';
}> {
  return feeds
    .map((feed) => applyRSSFeedCompatibility(feed))
    .filter((feed): feed is T & { platformImageCounts?: Prisma.JsonValue | null; trickle: 'newest_first' | 'oldest_first' } => Boolean(feed));
}

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
  return {
    scope: filters?.scope ?? 'title_or_body',
    required: Array.isArray(filters?.required) ? filters!.required : [],
    blocked: Array.isArray(filters?.blocked) ? filters!.blocked : [],
    onlyFetchNewItems: filters?.onlyFetchNewItems ?? false,
    startFromNowAt:
      typeof filters?.startFromNowAt === 'string' ? filters.startFromNowAt : null,
  };
}

function ensurePlatformsEnabled(platforms?: PlatformsEnabled): PlatformsEnabled {
  return platforms ?? { x: true, threads: true, facebook: false, pinterest: false };
}

function ensurePlatformImageCounts(
  counts?: PlatformImageCounts | Prisma.JsonValue | null
): PlatformImageCounts | undefined {
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) {
    return undefined;
  }

  const normalized: PlatformImageCounts = {};
  for (const platform of ['x', 'threads', 'facebook', 'pinterest'] as const) {
    const rawValue = (counts as Record<string, unknown>)[platform];
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      normalized[platform] = Math.max(1, Math.min(3, Math.trunc(rawValue)));
    } else if (typeof rawValue === 'string') {
      const parsed = Number.parseInt(rawValue, 10);
      if (Number.isFinite(parsed)) {
        normalized[platform] = Math.max(1, Math.min(3, parsed));
      }
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeTrickle(
  value?: string | null
): 'newest_first' | 'oldest_first' {
  return value === 'oldest_first' ? 'oldest_first' : 'newest_first';
}

function selectImageCount(value?: string | null): number {
  if (value === '1' || value === '2' || value === '3') {
    return Number.parseInt(value, 10);
  }

  return Math.random() < 0.5 ? 1 : 2;
}

function dedupeUrls(urls: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];

  for (const url of urls) {
    if (typeof url !== 'string') continue;
    const trimmed = url.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    resolved.push(trimmed);
  }

  return resolved;
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

function getRequestedPlatformImageCount(
  platform: string,
  defaultImageCount: string | null | undefined,
  platformImageCounts?: PlatformImageCounts
): number {
  const normalizedPlatform = platform.toLowerCase() as keyof PlatformImageCounts;
  const configuredCount = platformImageCounts?.[normalizedPlatform];
  const requestedCount = configuredCount ?? selectImageCount(defaultImageCount);
  const platformLimit = RSS_PLATFORM_IMAGE_LIMITS[platform] ?? 1;
  return Math.max(1, Math.min(platformLimit, requestedCount));
}

function getRSSPublishImagePlan(
  feed: {
    imageCount?: string | null;
    platformImageCounts?: PlatformImageCounts | Prisma.JsonValue | null;
  },
  platforms: string[]
): {
  maxImageCount: number;
  platformImageCounts: Record<string, number>;
} {
  const configuredPlatformCounts = ensurePlatformImageCounts(feed.platformImageCounts);
  const platformImageCounts = Object.fromEntries(
    platforms.map((platform) => [
      platform,
      getRequestedPlatformImageCount(platform, feed.imageCount, configuredPlatformCounts),
    ])
  );

  return {
    maxImageCount: Math.max(...Object.values(platformImageCounts), 1),
    platformImageCounts,
  };
}

function resolveForwardOnlySettings(
  filters?: RSSFeedFilters,
  overrides?: {
    previousFilters?: RSSFeedFilters;
    explicitOnlyFetchNewItems?: boolean;
    explicitStartFromNowAt?: string | null;
  }
): RSSFeedFilters {
  const normalizedFilters = ensureFeedFilters(filters);
  const previousFilters = ensureFeedFilters(overrides?.previousFilters);

  const onlyFetchNewItems =
    overrides?.explicitOnlyFetchNewItems ??
    normalizedFilters.onlyFetchNewItems ??
    previousFilters.onlyFetchNewItems ??
    false;

  let startFromNowAt: string | null = previousFilters.startFromNowAt ?? null;

  if (onlyFetchNewItems) {
    if (!previousFilters.onlyFetchNewItems) {
      startFromNowAt = new Date().toISOString();
    } else {
      startFromNowAt =
        overrides?.explicitStartFromNowAt ??
        normalizedFilters.startFromNowAt ??
        previousFilters.startFromNowAt ??
        new Date().toISOString();
    }
  } else {
    startFromNowAt = null;
  }

  return {
    ...normalizedFilters,
    onlyFetchNewItems,
    startFromNowAt,
  };
}

function parseFilterTimestamp(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getFilterScopeText(item: RSSItem, scope: RSSFeedFilters['scope']): string[] {
  const title = item.title || '';
  const body = item.description || '';

  switch (scope) {
    case 'title':
      return [title];
    case 'body':
      return [body];
    case 'title_and_body':
      return [title, body];
    case 'title_or_body':
    default:
      return [`${title}\n${body}`, title, body];
  }
}

function normalizeRuleText(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value : value.toLowerCase();
}

function matchesRule(
  haystack: string,
  needle: string,
  matchType: 'contains' | 'exact',
  caseSensitive: boolean
): boolean {
  const normalizedHaystack = normalizeRuleText(haystack, caseSensitive);
  const normalizedNeedle = normalizeRuleText(needle, caseSensitive);

  if (!normalizedNeedle.trim()) {
    return true;
  }

  if (matchType === 'exact') {
    return normalizedHaystack.trim() === normalizedNeedle.trim();
  }

  return normalizedHaystack.includes(normalizedNeedle);
}

function evaluateFeedRules(item: RSSItem, filters: RSSFeedFilters): { allowed: boolean; reason?: string } {
  const activeRequired = filters.required.filter((rule) => rule.active && rule.text.trim());
  const activeBlocked = filters.blocked.filter((rule) => rule.active && rule.text.trim());
  const scopeTexts = getFilterScopeText(item, filters.scope);

  for (const rule of activeBlocked) {
    const blocked = scopeTexts.some((scopeText) =>
      matchesRule(scopeText, rule.text, rule.matchType, rule.caseSensitive)
    );

    if (blocked) {
      return {
        allowed: false,
        reason: `Blocked keyword matched: "${rule.text}"`,
      };
    }
  }

  for (const rule of activeRequired) {
    let matched = false;

    if (filters.scope === 'title_and_body') {
      matched = scopeTexts.every((scopeText) =>
        matchesRule(scopeText, rule.text, rule.matchType, rule.caseSensitive)
      );
    } else {
      matched = scopeTexts.some((scopeText) =>
        matchesRule(scopeText, rule.text, rule.matchType, rule.caseSensitive)
      );
    }

    if (!matched) {
      return {
        allowed: false,
        reason: `Required keyword missing: "${rule.text}"`,
      };
    }
  }

  return { allowed: true };
}

function extractImageUrls(item: Record<string, any>): string[] {
  const urls: Array<string | undefined> = [];
  const enclosure = item.enclosure;
  if (enclosure?.url && (!enclosure.type || String(enclosure.type).startsWith('image/'))) {
    urls.push(enclosure.url);
  }

  const mediaContent = item.mediaContent;
  if (Array.isArray(mediaContent)) {
    for (const entry of mediaContent) {
      urls.push(entry?.$?.url, entry?.url);
    }
  } else {
    urls.push(mediaContent?.$?.url, mediaContent?.url);
  }

  const mediaThumbnail = item.mediaThumbnail;
  if (Array.isArray(mediaThumbnail)) {
    for (const entry of mediaThumbnail) {
      urls.push(entry?.$?.url, entry?.url);
    }
  } else {
    urls.push(mediaThumbnail?.$?.url, mediaThumbnail?.url);
  }

  const htmlContent = item['content:encoded'] || item.contentEncoded || item.content || item.contentSnippet || item.summary;
  if (typeof htmlContent === 'string') {
    const matches = htmlContent.matchAll(/<img[^>]*src=["']([^"']+)["']/gi);
    for (const match of matches) {
      urls.push(match[1]);
    }
  }

  return dedupeUrls(urls);
}

function normalizeRSSDedupeValue(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/www\./g, '')
    .replace(/[?#].*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRSSItemDedupeKey(item: RSSItem): string {
  if (item.guid && item.guid.trim()) {
    return `guid:${normalizeRSSDedupeValue(item.guid)}`;
  }

  if (item.link && item.link.trim()) {
    return `link:${normalizeRSSDedupeValue(item.link)}`;
  }

  return `title:${normalizeRSSDedupeValue(item.title)}`;
}

function serializeRSSItem(item: RSSItem): Prisma.InputJsonValue {
  return {
    title: item.title,
    link: item.link,
    description: item.description,
    pubDate: item.pubDate.toISOString(),
    imageUrl: item.imageUrl ?? null,
    imageUrls: item.imageUrls,
    author: item.author ?? null,
    guid: item.guid ?? null,
  } satisfies Prisma.InputJsonValue;
}

function deserializeRSSItem(itemData: Prisma.JsonValue | null): RSSItem | null {
  if (!itemData || typeof itemData !== 'object' || Array.isArray(itemData)) {
    return null;
  }

  const value = itemData as Record<string, unknown>;
  const pubDateValue = typeof value.pubDate === 'string' ? new Date(value.pubDate) : null;
  const pubDate = pubDateValue && !Number.isNaN(pubDateValue.getTime()) ? pubDateValue : new Date();

  return {
    title: typeof value.title === 'string' ? value.title : '',
    link: typeof value.link === 'string' ? value.link : '',
    description: typeof value.description === 'string' ? value.description : '',
    pubDate,
    imageUrl: typeof value.imageUrl === 'string' ? value.imageUrl : undefined,
    imageUrls: Array.isArray(value.imageUrls)
      ? value.imageUrls.filter((entry): entry is string => typeof entry === 'string')
      : [],
    author: typeof value.author === 'string' ? value.author : undefined,
    guid: typeof value.guid === 'string' ? value.guid : undefined,
  };
}

async function upsertRSSFeedItem(
  feedId: string,
  item: RSSItem,
  status: 'pending' | 'published' | 'failed' | 'filtered',
  options?: {
    publishedAt?: Date | null;
    errorMessage?: string | null;
    firstSeenAt?: Date;
  }
): Promise<void> {
  const dedupeKey = getRSSItemDedupeKey(item);
  const now = new Date();

  await prisma.rSSFeedItem.upsert({
    where: {
      feedId_dedupeKey: {
        feedId,
        dedupeKey,
      },
    },
    create: {
      feedId,
      dedupeKey,
      title: item.title,
      link: item.link,
      guid: item.guid,
      status,
      itemData: serializeRSSItem(item),
      firstSeenAt: options?.firstSeenAt ?? now,
      lastAttemptedAt: status === 'pending' ? null : now,
      publishedAt: options?.publishedAt ?? null,
      errorMessage: options?.errorMessage ?? null,
    },
    update: {
      title: item.title,
      link: item.link,
      guid: item.guid,
      status,
      itemData: serializeRSSItem(item),
      lastAttemptedAt: status === 'pending' ? undefined : now,
      publishedAt: options?.publishedAt ?? undefined,
      errorMessage: options?.errorMessage ?? undefined,
    },
  });
}

async function resolveRSSItemImages(
  feed: { serperPriority: boolean },
  item: RSSItem,
  limit: number,
  model?: string
): Promise<RSSResolvedImage[]> {
  return resolveRelevantRSSImages(
    {
      title: item.title,
      description: item.description,
      author: item.author,
      fallbackImages: dedupeUrls([...(item.imageUrls || []), item.imageUrl]),
    },
    {
      serperPriority: feed.serperPriority,
      limit,
      model,
    }
  );
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
    rssCaptionModel: asString(settingsMap.get('rssCaptionModel')) || DEFAULT_OPENAI_MODEL,
    rssCaptionPrompt: asString(settingsMap.get('rssCaptionPrompt')),
    rssCaptionTemperature: asNumber(settingsMap.get('rssCaptionTemperature')),
    rssCaptionTone: asString(settingsMap.get('rssCaptionTone')) || 'Engaging',
    rssCaptionMaxLength: Math.max(50, asNumber(settingsMap.get('rssCaptionMaxLength'), 280) || 280),
    rssPostingIntervalMinutes: (() => {
      const configuredValue = asNumber(settingsMap.get('rssPostingInterval'), 10);
      if (configuredValue === undefined || configuredValue === null || Number.isNaN(configuredValue)) {
        return 10;
      }
      return Math.max(0, configuredValue);
    })(),
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

function isSameRSSActivityItem(activity: RSSActivityItem, feedId: string, item: RSSItem): boolean {
  if (activity.feedId !== feedId) {
    return false;
  }

  const sameLink = Boolean(activity.link && activity.link === item.link);
  const sameTitle = activity.title === item.title;
  return sameLink || sameTitle;
}

function getRSSActivityDedupeKey(activity: RSSActivityItem): string {
  if (activity.link) {
    return `link:${normalizeRSSDedupeValue(activity.link)}`;
  }

  return `title:${normalizeRSSDedupeValue(activity.title)}`;
}

function hasRecentRSSActivity(
  items: RSSActivityItem[],
  feedId: string,
  item: RSSItem,
  statuses: Array<RSSActivityItem['status']>
): boolean {
  return items.some((activity) =>
    statuses.includes(activity.status) && isSameRSSActivityItem(activity, feedId, item)
  );
}

function rememberRSSActivity(items: RSSActivityItem[], metadata: RSSActivityMetadata): void {
  items.unshift({
    id: `memory:${metadata.feedId}:${metadata.itemLink || metadata.itemTitle}:${metadata.status}:${Date.now()}`,
    feedId: metadata.feedId,
    feedName: metadata.feedName,
    title: metadata.itemTitle,
    link: metadata.itemLink,
    description: metadata.description,
    imageUrl: metadata.imageUrl,
    status: metadata.status,
    timestamp: new Date().toISOString(),
    publishedAt: metadata.publishedAt,
    platforms: metadata.platforms,
    error: metadata.errorMessage,
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

  if (settings.rssPostingIntervalMinutes > 0) {
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

function buildRSSPublishPayload(
  item: RSSItem,
  caption: string,
  imageUrls: string[],
  feed: {
    imageCount?: string | null;
    platformImageCounts?: PlatformImageCounts | Prisma.JsonValue | null;
  },
  platforms: string[]
) {
  const { platformImageCounts } = getRSSPublishImagePlan(feed, platforms);
  const platformOverrides = Object.fromEntries(
    platforms.map((platform) => {
      const limit = platformImageCounts[platform] ?? 1;
      const platformImages = imageUrls.slice(0, limit);
      return [platform, {
        imageUrls: platformImages,
        imageUrl: platformImages[0],
      }];
    })
  );

  return {
    text: caption,
    title: item.title,
    link: item.link,
    imageUrls,
    imageUrl: imageUrls[0],
    platformOverrides,
  };
}

async function persistFeedSnapshot(
  feedId: string,
  item: RSSItem | undefined,
  caption: string | null,
  platforms: string[],
  imageUrlOverride?: string
): Promise<void> {
  if (!item) return;

  await prisma.rSSFeed.update({
    where: { id: feedId },
    data: {
      title: item.title,
      description: item.description,
      imageUrl: imageUrlOverride || item.imageUrl,
      publishedDate: item.pubDate,
      platforms,
      caption,
    },
  });
}

async function attemptRSSPublish(
  feed: {
    id: string;
    name: string;
    serperPriority: boolean;
    imageCount?: string | null;
    platformImageCounts?: PlatformImageCounts | Prisma.JsonValue | null;
  },
  item: RSSItem,
  platforms: string[],
  imagePlan: { maxImageCount: number },
  runtimeSettings: RSSRuntimeSettings
): Promise<
  | {
      status: 'published';
      caption: string;
      imageUrl?: string;
      successfulPlatforms: string[];
    }
  | {
      status: 'failed';
      imageUrl?: string;
      errorMessage: string;
    }
> {
  try {
    const publishImages = await resolveRSSItemImages(
      feed,
      item,
      imagePlan.maxImageCount,
      runtimeSettings.rssCaptionModel
    );
    const publishImageUrls = publishImages.map((image) => image.url);
    const publishImageUrl = publishImageUrls[0];
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
      normalizeAIModel(runtimeSettings.rssCaptionModel),
      systemPrompt,
      runtimeSettings.rssCaptionTemperature
    );

    const publishResults = await publisherService.publish(
      platforms,
      buildRSSPublishPayload(item, caption, publishImageUrls, feed, platforms)
    );

    const successfulPlatforms = publishResults
      .filter((result) => result.status === 'posted')
      .map((result) => result.platform);

    if (successfulPlatforms.length === 0) {
      return {
        status: 'failed',
        imageUrl: publishImageUrl,
        errorMessage: publishResults
          .map((result) => `${result.platform}: ${result.error || result.status}`)
          .join('; ') || 'Publishing failed.',
      };
    }

    return {
      status: 'published',
      caption,
      imageUrl: publishImageUrl,
      successfulPlatforms,
    };
  } catch (error) {
    return {
      status: 'failed',
      imageUrl: item.imageUrl,
      errorMessage: error instanceof Error ? error.message : 'Failed to process RSS item.',
    };
  }
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
        const imageUrls = extractImageUrls(item);

        return {
          title: String(item.title || '').trim(),
          link: String(item.link || '').trim(),
          description: description.slice(0, 1000),
          pubDate: Number.isNaN(pubDate.getTime()) ? new Date() : pubDate,
          imageUrl: imageUrls[0],
          imageUrls,
          author: String(item.creator || item.author || item.dcCreator || '').trim() || undefined,
          guid: String(item.guid || '').trim() || undefined,
        } satisfies RSSItem;
      })
      .filter((item: RSSItem) => Boolean(item.title && item.link)),
  };
}

async function getAllFeeds() {
  const select = await getRSSFeedSelect();
  const feeds = await prisma.rSSFeed.findMany({
    orderBy: { createdAt: 'desc' },
    select,
  });

  return applyRSSFeedCompatibilityList(feeds as Array<Record<string, any>>);
}

async function getFeedById(id: string) {
  const select = await getRSSFeedSelect();
  const feed = await prisma.rSSFeed.findUnique({
    where: { id },
    select,
  });

  return applyRSSFeedCompatibility(feed as Record<string, any> | null);
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

  const resolvedFilters = resolveForwardOnlySettings(data.filters, {
    explicitOnlyFetchNewItems: data.onlyFetchNewItems,
    explicitStartFromNowAt: data.startFromNowAt,
  });
  const support = await getRSSFeedColumnSupport();
  const select = await getRSSFeedSelect();

  const createData: Prisma.RSSFeedCreateInput = {
    name: feedTitle || data.name,
    url: data.url,
    favicon,
    enabled: data.enabled ?? true,
    interval: data.interval ?? 10,
    imageCount: data.imageCount ?? '2',
    dedupeDays: data.dedupeDays ?? 30,
    filters: resolvedFilters as unknown as Prisma.InputJsonValue,
    serperPriority: data.serperPriority ?? true,
    rehostImages: data.rehostImages ?? false,
    autoPost: data.autoPost ?? true,
    platformsEnabled: ensurePlatformsEnabled(data.platformsEnabled) as unknown as Prisma.InputJsonValue,
    status: data.status ?? 'active',
    source: feedTitle || data.name,
  };

  if (support.platformImageCounts) {
    createData.platformImageCounts = ensurePlatformImageCounts(data.platformImageCounts) as unknown as Prisma.InputJsonValue;
  }

  if (support.trickle) {
    createData.trickle = normalizeTrickle(data.trickle);
  }

  const createdFeed = await prisma.rSSFeed.create({
    data: createData,
    select,
  });

  return applyRSSFeedCompatibility(createdFeed as Record<string, any>);
}

async function updateFeed(
  id: string,
  data: Partial<RSSFeedInput> & { lastProcessedAt?: Date; nextRunAt?: Date; errorMessage?: string }
) {
  const support = await getRSSFeedColumnSupport();
  const existingFeed = await prisma.rSSFeed.findUnique({
    where: { id },
    select: { filters: true },
  });

  if (!existingFeed) {
    throw new Error('Feed not found');
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.url !== undefined) updateData.url = data.url;
  if (data.favicon !== undefined) updateData.favicon = data.favicon;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.interval !== undefined) updateData.interval = data.interval;
  if (data.imageCount !== undefined) updateData.imageCount = data.imageCount;
  if (support.platformImageCounts && data.platformImageCounts !== undefined) {
    updateData.platformImageCounts = ensurePlatformImageCounts(data.platformImageCounts) as unknown as Prisma.InputJsonValue;
  }
  if (data.dedupeDays !== undefined) updateData.dedupeDays = data.dedupeDays;
  if (
    data.filters !== undefined ||
    data.onlyFetchNewItems !== undefined ||
    data.startFromNowAt !== undefined
  ) {
    updateData.filters = resolveForwardOnlySettings(data.filters, {
      previousFilters: existingFeed.filters as unknown as RSSFeedFilters,
      explicitOnlyFetchNewItems: data.onlyFetchNewItems,
      explicitStartFromNowAt: data.startFromNowAt,
    }) as unknown as Prisma.InputJsonValue;
  }
  if (data.serperPriority !== undefined) updateData.serperPriority = data.serperPriority;
  if (data.rehostImages !== undefined) updateData.rehostImages = data.rehostImages;
  if (data.autoPost !== undefined) updateData.autoPost = data.autoPost;
  if (data.platformsEnabled !== undefined) updateData.platformsEnabled = data.platformsEnabled;
  if (support.trickle && data.trickle !== undefined) updateData.trickle = normalizeTrickle(data.trickle);
  if (data.status !== undefined) updateData.status = data.status;
  if (data.lastProcessedAt !== undefined) updateData.lastProcessedAt = data.lastProcessedAt;
  if (data.nextRunAt !== undefined) updateData.nextRunAt = data.nextRunAt;
  if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;

  const select = await getRSSFeedSelect();
  const updatedFeed = await prisma.rSSFeed.update({
    where: { id },
    data: updateData,
    select,
  });

  return applyRSSFeedCompatibility(updatedFeed as Record<string, any>);
}

async function deleteFeed(id: string) {
  return prisma.rSSFeed.delete({
    where: { id },
  });
}

async function refreshFeed(id: string, options: RefreshFeedOptions = {}): Promise<RefreshResult> {
  const select = await getRSSFeedSelect();
  const feed = applyRSSFeedCompatibility(
    await prisma.rSSFeed.findUnique({ where: { id }, select }) as Record<string, any> | null
  );

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
    const feedFilters = ensureFeedFilters(feed.filters as unknown as RSSFeedFilters);
    const startFromNowDate = parseFilterTimestamp(feedFilters.startFromNowAt);
    const effectiveCutoffDate = (() => {
      if (feed.lastProcessedAt && startFromNowDate) {
        return feed.lastProcessedAt > startFromNowDate ? feed.lastProcessedAt : startFromNowDate;
      }
      if (feed.lastProcessedAt) return feed.lastProcessedAt;
      if (startFromNowDate) return startFromNowDate;
      return new Date(Date.now() - DEFAULT_ITEM_LOOKBACK_MS);
    })();

    const newItems = parsed.items
      .filter((item) => item.pubDate > effectiveCutoffDate);
    const orderedNewItems = [...newItems].sort((a, b) =>
      normalizeTrickle(feed.trickle) === 'oldest_first'
        ? a.pubDate.getTime() - b.pubDate.getTime()
        : b.pubDate.getTime() - a.pubDate.getTime()
    );
    const latestItem = [...parsed.items].sort((a, b) => a.pubDate.getTime() - b.pubDate.getTime()).at(-1);
    const itemsToProcess =
      options.manualRun && feedFilters.onlyFetchNewItems
        ? latestItem ? [latestItem] : []
        : orderedNewItems;
    const activityLookbackDays = Math.max(feed.dedupeDays, 1);
    const recentActivityLogs = await prisma.log.findMany({
      where: {
        service: 'rss',
        timestamp: { gte: new Date(Date.now() - activityLookbackDays * 24 * 60 * 60 * 1000) },
      },
      orderBy: { timestamp: 'desc' },
      take: 1000,
      select: {
        id: true,
        timestamp: true,
        metadata: true,
      },
    });
    const recentActivities = recentActivityLogs
      .map((log) => parseRSSActivityLog(log))
      .filter((activity): activity is RSSActivityItem => Boolean(activity));
    const selectionMode =
      options.manualRun && feedFilters.onlyFetchNewItems ? 'latest_item' : 'backlog';

    const platforms = getEnabledPlatforms(feed.platformsEnabled as Record<string, boolean> | null);
    const imagePlan = getRSSPublishImagePlan(feed, platforms);
    const pendingQueueRecords = await prisma.rSSFeedItem.findMany({
      where: {
        feedId: feed.id,
        status: 'pending',
      },
      orderBy: { firstSeenAt: 'asc' },
    });
    const pendingQueue = pendingQueueRecords
      .map((record) => ({
        record,
        item: deserializeRSSItem(record.itemData),
      }))
      .filter((entry): entry is typeof entry & { item: RSSItem } => Boolean(entry.item));
    const incomingDedupeKeys = Array.from(new Set(itemsToProcess.map((item) => getRSSItemDedupeKey(item))));
    const knownFeedItems = incomingDedupeKeys.length > 0
      ? await prisma.rSSFeedItem.findMany({
          where: {
            feedId: feed.id,
            dedupeKey: { in: incomingDedupeKeys },
          },
          select: {
            dedupeKey: true,
            status: true,
          },
        })
      : [];
    const seenKeys = new Set<string>([
      ...pendingQueueRecords.map((record) => record.dedupeKey),
      ...knownFeedItems.map((record) => record.dedupeKey),
      ...recentActivities
        .filter((activity) => activity.feedId === feed.id)
        .map((activity) => getRSSActivityDedupeKey(activity)),
    ]);
    let publishedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let latestHandledItem: RSSItem | undefined;
    let latestCaption: string | null = null;
    let latestPublishedImageUrl: string | undefined;

    for (const pendingEntry of pendingQueue) {
      const item = pendingEntry.item;
      latestHandledItem = item;

      if (!runtimeSettings.globalRSSPosting || !feed.autoPost || platforms.length === 0) {
        pendingCount += 1;
        continue;
      }

      const blockReason = await getPublishingBlockReason(platforms, runtimeSettings);
      if (blockReason) {
        pendingCount += 1;
        continue;
      }

      const publishAttempt = await attemptRSSPublish(feed as any, item, platforms, imagePlan, runtimeSettings);

      if (publishAttempt.status === 'published') {
        publishedCount += 1;
        latestCaption = publishAttempt.caption;
        latestPublishedImageUrl = publishAttempt.imageUrl;
        await prisma.rSSFeedItem.update({
          where: { id: pendingEntry.record.id },
          data: {
            status: 'published',
            lastAttemptedAt: new Date(),
            publishedAt: item.pubDate,
            errorMessage: null,
            itemData: serializeRSSItem(item),
          },
        });
        const publishedMetadata: RSSActivityMetadata = {
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          imageUrl: publishAttempt.imageUrl,
          publishedAt: item.pubDate.toISOString(),
          status: 'published',
          platforms: publishAttempt.successfulPlatforms,
        };
        await logRSSActivity(publishedMetadata);
        rememberRSSActivity(recentActivities, publishedMetadata);
        continue;
      }

      failedCount += 1;
      await prisma.rSSFeedItem.update({
        where: { id: pendingEntry.record.id },
        data: {
          status: 'failed',
          lastAttemptedAt: new Date(),
          errorMessage: publishAttempt.errorMessage,
          itemData: serializeRSSItem(item),
        },
      });
      const failedMetadata: RSSActivityMetadata = {
        category: RSS_ACTIVITY_CATEGORY,
        feedId: feed.id,
        feedName: feed.name,
        itemTitle: item.title,
        itemLink: item.link,
        description: item.description,
        imageUrl: publishAttempt.imageUrl,
        publishedAt: item.pubDate.toISOString(),
        status: 'failed',
        platforms,
        errorMessage: publishAttempt.errorMessage,
      };
      await logRSSActivity(failedMetadata);
      rememberRSSActivity(recentActivities, failedMetadata);
    }

    for (const item of itemsToProcess) {
      latestHandledItem = item;
      const dedupeKey = getRSSItemDedupeKey(item);

      if (seenKeys.has(dedupeKey)) {
        continue;
      }

      const ruleEvaluation = evaluateFeedRules(item, feedFilters);
      if (!ruleEvaluation.allowed) {
        await upsertRSSFeedItem(feed.id, item, 'filtered', {
          errorMessage: ruleEvaluation.reason ?? null,
          firstSeenAt: item.pubDate,
        });
        seenKeys.add(dedupeKey);
        continue;
      }

      if (!runtimeSettings.globalRSSPosting || !feed.autoPost || platforms.length === 0) {
        pendingCount += 1;
        const pendingMetadata: RSSActivityMetadata = {
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
        };
        await upsertRSSFeedItem(feed.id, item, 'pending', {
          errorMessage: pendingMetadata.errorMessage ?? null,
          firstSeenAt: item.pubDate,
        });
        seenKeys.add(dedupeKey);
        if (!hasRecentRSSActivity(recentActivities, feed.id, item, ['pending'])) {
          await logRSSActivity(pendingMetadata);
          rememberRSSActivity(recentActivities, pendingMetadata);
        }
        continue;
      }

      const blockReason = await getPublishingBlockReason(platforms, runtimeSettings);
      if (blockReason) {
        pendingCount += 1;
        const pendingMetadata: RSSActivityMetadata = {
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
        };
        await upsertRSSFeedItem(feed.id, item, 'pending', {
          errorMessage: blockReason,
          firstSeenAt: item.pubDate,
        });
        seenKeys.add(dedupeKey);
        if (!hasRecentRSSActivity(recentActivities, feed.id, item, ['pending'])) {
          await logRSSActivity(pendingMetadata);
          rememberRSSActivity(recentActivities, pendingMetadata);
        }
        continue;
      }

      const publishAttempt = await attemptRSSPublish(feed as any, item, platforms, imagePlan, runtimeSettings);
      seenKeys.add(dedupeKey);

      if (publishAttempt.status === 'published') {
        publishedCount += 1;
        latestCaption = publishAttempt.caption;
        latestPublishedImageUrl = publishAttempt.imageUrl;
        await upsertRSSFeedItem(feed.id, item, 'published', {
          publishedAt: item.pubDate,
          errorMessage: null,
          firstSeenAt: item.pubDate,
        });
        const publishedMetadata: RSSActivityMetadata = {
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          imageUrl: publishAttempt.imageUrl,
          publishedAt: item.pubDate.toISOString(),
          status: 'published',
          platforms: publishAttempt.successfulPlatforms,
        };
        await logRSSActivity(publishedMetadata);
        rememberRSSActivity(recentActivities, publishedMetadata);
        continue;
      }

      failedCount += 1;
      await upsertRSSFeedItem(feed.id, item, 'failed', {
        errorMessage: publishAttempt.errorMessage,
        firstSeenAt: item.pubDate,
      });
      const failedMetadata: RSSActivityMetadata = {
        category: RSS_ACTIVITY_CATEGORY,
        feedId: feed.id,
        feedName: feed.name,
        itemTitle: item.title,
        itemLink: item.link,
        description: item.description,
        imageUrl: publishAttempt.imageUrl,
        publishedAt: item.pubDate.toISOString(),
        status: 'failed',
        platforms,
        errorMessage: publishAttempt.errorMessage,
      };
      await logRSSActivity(failedMetadata);
      rememberRSSActivity(recentActivities, failedMetadata);
    }

    await prisma.rSSFeed.update({
      where: { id },
      data: {
        status: 'active',
        source: feed.name,
        lastProcessedAt: new Date(),
        nextRunAt,
        errorMessage: null,
        updatedAt: new Date(),
      },
    });

    await persistFeedSnapshot(feed.id, latestHandledItem || parsed.items[0], latestCaption, platforms, latestPublishedImageUrl);

    return {
      feedId: feed.id,
      feedName: feed.name,
      itemsAdded: publishedCount,
      checkedCount: itemsToProcess.length,
      pendingCount,
      failedCount,
      latestItemTitle: latestHandledItem?.title || parsed.items[0]?.title,
      selectionMode,
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
      selectionMode: options.manualRun ? 'latest_item' : 'backlog',
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

  const select = await getRSSFeedSelect();
  const feeds = applyRSSFeedCompatibilityList(
    await prisma.rSSFeed.findMany({ where, select }) as Array<Record<string, any>>
  );

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

async function previewFeedPipeline(feedId: string): Promise<RSSPipelinePreview> {
  const select = await getRSSFeedSelect();
  const feed = applyRSSFeedCompatibility(
    await prisma.rSSFeed.findUnique({ where: { id: feedId }, select }) as Record<string, any> | null
  );
  if (!feed) {
    throw new Error('Feed not found');
  }

  const xml = await fetchRSSFeed(feed.url);
  const parsed = await parseRSSFeed(xml);
  const feedFilters = ensureFeedFilters(feed.filters as unknown as RSSFeedFilters);
  const previewItem = [...parsed.items]
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .find((item) => evaluateFeedRules(item, feedFilters).allowed);

  if (!previewItem) {
    throw new Error('No feed items match the current rules');
  }

  const runtimeSettings = await getRuntimeSettings();
  const platforms = getEnabledPlatforms(feed.platformsEnabled as Record<string, boolean> | null);
  const imagePlan = getRSSPublishImagePlan(feed, platforms);
  const resolvedImages = await resolveRSSItemImages(
    feed as any,
    previewItem,
    imagePlan.maxImageCount,
    runtimeSettings.rssCaptionModel
  );
  const imageUrls = resolvedImages.map((image) => image.url);
  const systemPrompt = buildRSSCaptionSystemPrompt(runtimeSettings.rssCaptionPrompt, {
    tone: runtimeSettings.rssCaptionTone,
    maxLength: runtimeSettings.rssCaptionMaxLength,
  });
  const caption = await aiService.generateRSSCaption(
    {
      articleTitle: previewItem.title,
      feedName: feed.name,
      summary: previewItem.description,
      platform: 'X',
    },
    normalizeAIModel(runtimeSettings.rssCaptionModel),
    systemPrompt,
    runtimeSettings.rssCaptionTemperature
  );

  return {
    title: previewItem.title,
    link: previewItem.link,
    pubDate: previewItem.pubDate.toISOString(),
    snippet: previewItem.description,
    images: resolvedImages.map((image) => ({
      url: image.url,
      reason: image.reason,
    })),
    caption,
    captionCharCount: caption.length,
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
  previewFeedPipeline,
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
  previewFeedPipeline,
  getRSSActivity,
  deleteRSSActivity,
};
