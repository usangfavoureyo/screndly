/**
 * RSS Feed Service - real feed CRUD, refresh, activity, and preview support
 */

import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { JSDOM } from 'jsdom';
import Parser from 'rss-parser';
import aiService, { DEFAULT_OPENAI_MODEL, normalizeAIModel } from './ai.service';
import { publisherService, type PublishResult } from './publisher.service';
import { resolveRelevantRSSImages, type RSSResolvedImage } from './rss-image-selection.service';
import { uploadBufferToBackblaze } from './backblaze';

const RSS_IMAGE_ANALYSIS_MODEL = DEFAULT_OPENAI_MODEL;

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
  maxItemAgeMinutes?: number | null;
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
  serperEnabled?: boolean;
  tmdbEnabled?: boolean;
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
  imageSource?: RSSResolvedImage['source'];
  imageReason?: string;
  imageScore?: number;
  imageSelectionConfidence?: 'high' | 'medium' | 'low';
  selectedImages?: RSSResolvedImage[];
  generatedCaption?: string;
  platformPostIds?: Record<string, string>;
  platformResults?: PublishResult[];
  contentHtml?: string;
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
  Threads: 3,
  Facebook: 3,
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
  contentHtml?: string;
  imageUrl?: string;
  imageUrls?: string[];
  imageSource?: RSSResolvedImage['source'];
  imageReason?: string;
  imageScore?: number;
  imageSelectionConfidence?: 'high' | 'medium' | 'low';
  selectedImages?: RSSResolvedImage[];
  status: 'pending' | 'published' | 'failed' | 'filtered';
  timestamp: string;
  publishedAt?: string;
  platforms: string[];
  platformPostIds?: Record<string, string>;
  platformResults?: PublishResult[];
  error?: string;
}

export interface RSSActivitySummary {
  total: number;
  published: number;
  pending: number;
  failed: number;
  filtered?: number;
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
  contentHtml?: string;
  imageUrl?: string;
  imageUrls?: string[];
  imageSource?: RSSResolvedImage['source'];
  imageReason?: string;
  imageScore?: number;
  imageSelectionConfidence?: 'high' | 'medium' | 'low';
  selectedImages?: RSSResolvedImage[];
  publishedAt?: string;
  status: 'pending' | 'published' | 'failed';
  platforms: string[];
  platformPostIds?: Record<string, string>;
  platformResults?: PublishResult[];
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
const RSS_ITEM_RECHECK_BUFFER_MS = 15 * 60 * 1000;
const RSS_TOPIC_DEDUPE_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const QUIET_HOURS_BLOCK_REASON = 'Publishing is paused by quiet hours.';
const RSS_FILTER_IMAGE_SOURCE_SETTINGS_KEY = '__imageSourceSettings';
const activeRSSFeedRefreshes = new Map<string, Promise<RefreshResult>>();
let activeScheduledRSSRefresh: Promise<{
  total: number;
  success: number;
  failed: number;
  isScheduledRun: boolean;
  results: RefreshResult[];
}> | null = null;
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
const RSS_TOPIC_SIGNATURE_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'was',
  'were',
  'with',
]);
const RSS_TOPIC_ENTITY_STOP_WORDS = new Set([
  ...RSS_TOPIC_SIGNATURE_STOP_WORDS,
  'actor',
  'actors',
  'actress',
  'actresses',
  'cast',
  'casts',
  'casting',
  'pilot',
  'series',
  'show',
  'movie',
  'movies',
  'tv',
  'role',
  'roles',
  'star',
  'stars',
  'starring',
  'joins',
  'join',
  'boards',
  'board',
  'opposite',
  'set',
  'lead',
  'reboot',
  'revival',
  'exclusive',
  'first',
  'look',
  'images',
  'image',
  'trailer',
  'teaser',
  'official',
  'new',
]);

type RSSFeedColumnSupport = {
  platformImageCounts: boolean;
  trickle: boolean;
  feedItemsTable: boolean;
  serperEnabled: boolean;
  tmdbEnabled: boolean;
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
        const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = current_schema()
            AND table_name IN ('RSSFeedItem')
        `;
        const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'RSSFeed'
            AND column_name IN ('platformImageCounts', 'trickle', 'serperEnabled', 'tmdbEnabled')
        `;

        const tableNames = new Set(tables.map((table) => table.table_name));
        const columnNames = new Set(columns.map((column) => column.column_name));
        return {
          platformImageCounts: columnNames.has('platformImageCounts'),
          trickle: columnNames.has('trickle'),
          feedItemsTable: tableNames.has('RSSFeedItem'),
          serperEnabled: columnNames.has('serperEnabled'),
          tmdbEnabled: columnNames.has('tmdbEnabled'),
        };
      } catch (error) {
        console.warn('[RSS] Failed to inspect RSSFeed schema. Falling back to legacy-compatible mode.', error);
        return {
          platformImageCounts: false,
          trickle: false,
          feedItemsTable: false,
          serperEnabled: false,
          tmdbEnabled: false,
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
    ...(support.serperEnabled ? { serperEnabled: true } : {}),
    ...(support.tmdbEnabled ? { tmdbEnabled: true } : {}),
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
  serperEnabled: boolean;
  tmdbEnabled: boolean;
}) | null {
  if (!feed) {
    return null;
  }

  const storedImageSourceSettings = extractStoredImageSourceSettings(
    'filters' in feed ? feed.filters as Prisma.JsonValue | undefined : undefined
  );

  return {
    ...feed,
    filters: 'filters' in feed ? ensureFeedFilters(feed.filters as RSSFeedFilters | undefined) : undefined,
    platformImageCounts: 'platformImageCounts' in feed ? feed.platformImageCounts : null,
    trickle: normalizeTrickle(typeof feed.trickle === 'string' ? feed.trickle : undefined),
    serperEnabled: typeof feed.serperEnabled === 'boolean'
      ? feed.serperEnabled
      : typeof storedImageSourceSettings.serperEnabled === 'boolean'
        ? storedImageSourceSettings.serperEnabled
      : (typeof feed.serperPriority === 'boolean' ? feed.serperPriority : true),
    tmdbEnabled: typeof feed.tmdbEnabled === 'boolean'
      ? feed.tmdbEnabled
      : typeof storedImageSourceSettings.tmdbEnabled === 'boolean'
        ? storedImageSourceSettings.tmdbEnabled
        : false,
  };
}

function applyRSSFeedCompatibilityList<T extends Record<string, any>>(feeds: T[]): Array<T & {
  platformImageCounts?: Prisma.JsonValue | null;
  trickle: 'newest_first' | 'oldest_first';
  serperEnabled: boolean;
  tmdbEnabled: boolean;
}> {
  return feeds
    .map((feed) => applyRSSFeedCompatibility(feed))
    .filter((feed): feed is T & {
      platformImageCounts?: Prisma.JsonValue | null;
      trickle: 'newest_first' | 'oldest_first';
      serperEnabled: boolean;
      tmdbEnabled: boolean;
    } => Boolean(feed));
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

function stripMarkdownLinks(value?: string): string {
  return (value || '').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|[^)\s]+)\)/gi, '$1');
}

function stripBareUrls(value?: string): string {
  return (value || '').replace(/\bhttps?:\/\/[^\s<>()]+/gi, ' ');
}

function stripDanglingLinkArtifacts(value?: string): string {
  return (value || '')
    .replace(/\(\s*[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:\/[^\s()]*)?\s*\)/g, ' ')
    .replace(/\[\s*[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:\/[^\s\]]*)?\s*\]/g, ' ');
}

function sanitizeRSSPlainText(value?: string): string {
  return stripDanglingLinkArtifacts(
    stripBareUrls(
      stripMarkdownLinks(
        stripHtml(value || '')
      )
    )
  )
    .replace(/[([]\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})\s*[)\]]/g, '$1')
    .replace(/\butm_[a-z_]+=[^\s&]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeRSSCaptionText(value: string, maxLength?: number): string {
  let sanitized = sanitizeRSSPlainText(value)
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([({\[])\s+/g, '$1')
    .replace(/\s+([)}\]])/g, '$1')
    .trim();

  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
  }

  return sanitized;
}

function buildFilterBodyText(item: RSSItem): string {
  const rawContentText = sanitizeRSSPlainText(item.contentHtml || '');
  const segments = [sanitizeRSSPlainText(item.description || ''), rawContentText].filter((segment) => segment.trim().length > 0);
  return Array.from(new Set(segments)).join('\n').trim();
}

function extractLeadParagraphText(item: Record<string, any>): string {
  const htmlContent = item['content:encoded'] || item.contentEncoded || item.content;
  if (typeof htmlContent === 'string' && htmlContent.trim()) {
    const paragraphs = Array.from(htmlContent.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
      .map((match) => sanitizeRSSPlainText(match[1] || ''))
      .filter((paragraph) => paragraph.length >= 40);

    if (paragraphs.length > 0) {
      return paragraphs
        .slice(0, 2)
        .join(' ')
        .trim();
    }
  }

  return sanitizeRSSPlainText(
    item.contentSnippet ||
    item.summary ||
    item.description ||
    htmlContent ||
    ''
  );
}

function normalizeMaxItemAgeMinutes(value: Prisma.JsonValue | undefined): number | null {
  const parsed = asNumber(value);
  if (parsed === undefined) return null;

  const normalized = Math.trunc(parsed);
  if (!Number.isFinite(normalized) || normalized < 1) {
    return null;
  }

  return Math.min(normalized, 12 * 60);
}

function normalizeFilterRule(
  rule: RSSFeedFilters['required'][number] | Prisma.JsonValue | string | null | undefined
): RSSFeedFilters['required'][number] | null {
  if (typeof rule === 'string') {
    const text = rule.trim();
    if (!text) {
      return null;
    }

    return {
      text,
      matchType: 'contains',
      caseSensitive: false,
      active: true,
    };
  }

  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    return null;
  }

  const rawRule = rule as Record<string, Prisma.JsonValue | undefined>;
  const text = asString(rawRule.text)?.trim() ?? '';
  if (!text) {
    return null;
  }

  return {
    text,
    matchType: rawRule.matchType === 'exact' ? 'exact' : 'contains',
    caseSensitive: asBoolean(rawRule.caseSensitive, false),
    active: asBoolean(rawRule.active, true),
  };
}

function ensureFeedFilters(filters?: RSSFeedFilters): RSSFeedFilters {
  return {
    scope: filters?.scope ?? 'title_or_body',
    required: Array.isArray(filters?.required)
      ? filters.required
          .map((rule) => normalizeFilterRule(rule))
          .filter((rule): rule is RSSFeedFilters['required'][number] => Boolean(rule))
      : [],
    blocked: Array.isArray(filters?.blocked)
      ? filters.blocked
          .map((rule) => normalizeFilterRule(rule))
          .filter((rule): rule is RSSFeedFilters['blocked'][number] => Boolean(rule))
      : [],
    onlyFetchNewItems: filters?.onlyFetchNewItems ?? false,
    startFromNowAt:
      typeof filters?.startFromNowAt === 'string' ? filters.startFromNowAt : null,
    maxItemAgeMinutes: normalizeMaxItemAgeMinutes(
      filters?.maxItemAgeMinutes as Prisma.JsonValue | undefined
    ),
  };
}

function extractStoredImageSourceSettings(
  filters?: Prisma.JsonValue | RSSFeedFilters | null
): {
  serperEnabled?: boolean;
  tmdbEnabled?: boolean;
} {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    return {};
  }

  const rawSettings = (filters as Record<string, unknown>)[RSS_FILTER_IMAGE_SOURCE_SETTINGS_KEY];
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return {};
  }

  const parsedSettings = rawSettings as Record<string, unknown>;
  const resolved: {
    serperEnabled?: boolean;
    tmdbEnabled?: boolean;
  } = {};

  if (typeof parsedSettings.serperEnabled === 'boolean') {
    resolved.serperEnabled = parsedSettings.serperEnabled;
  }

  if (typeof parsedSettings.tmdbEnabled === 'boolean') {
    resolved.tmdbEnabled = parsedSettings.tmdbEnabled;
  }

  return resolved;
}

function withStoredImageSourceSettings(
  filters: RSSFeedFilters,
  sourceSettings: {
    serperEnabled?: boolean;
    tmdbEnabled?: boolean;
  }
): Prisma.InputJsonValue {
  const persistedFilters: Record<string, unknown> = {
    ...filters,
  };
  const persistedSettings: Record<string, boolean> = {};

  if (typeof sourceSettings.serperEnabled === 'boolean') {
    persistedSettings.serperEnabled = sourceSettings.serperEnabled;
  }

  if (typeof sourceSettings.tmdbEnabled === 'boolean') {
    persistedSettings.tmdbEnabled = sourceSettings.tmdbEnabled;
  }

  if (Object.keys(persistedSettings).length > 0) {
    persistedFilters[RSS_FILTER_IMAGE_SOURCE_SETTINGS_KEY] = persistedSettings;
  }

  return persistedFilters as Prisma.InputJsonValue;
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

  return 2;
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

function slugifyRSSAssetName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'rss-image';
}

function getImageExtensionFromContentType(contentType?: string | null): string {
  switch ((contentType || '').split(';')[0].trim().toLowerCase()) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/avif':
      return '.avif';
    default:
      return '.jpg';
  }
}

function isBackblazeHostedUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().includes('backblazeb2.com');
  } catch {
    return false;
  }
}

async function rehostRSSResolvedImage(
  image: RSSResolvedImage,
  feedId: string,
  item: RSSItem,
  index: number
): Promise<RSSResolvedImage> {
  if (!/^https?:\/\//i.test(image.url) || isBackblazeHostedUrl(image.url)) {
    return image;
  }

  try {
    const response = await fetch(image.url, {
      headers: buildRSSFetchHeaders(image.url, RSS_BROWSER_FALLBACK_USER_AGENT),
    });

    if (!response.ok) {
      throw new Error(`download failed with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.toLowerCase().startsWith('image/')) {
      throw new Error(`expected image content but received ${contentType}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const originalName = `${slugifyRSSAssetName(item.title || `rss-image-${index + 1}`)}-${index + 1}${getImageExtensionFromContentType(contentType)}`;
    const uploaded = await uploadBufferToBackblaze(buffer, originalName, {
      bucketTypes: ['general'],
      prefix: `rss/rehosted/${slugifyRSSAssetName(feedId)}`,
      contentType: contentType || undefined,
    });

    return {
      ...image,
      url: uploaded.url,
    };
  } catch (error) {
    console.warn('[RSS] Failed to rehost selected image. Falling back to original URL.', {
      url: image.url,
      error: error instanceof Error ? error.message : String(error),
    });
    return image;
  }
}

async function maybeRehostRSSResolvedImages(
  feed: {
    id?: string;
    rehostImages?: boolean | null;
  },
  item: RSSItem,
  images: RSSResolvedImage[]
): Promise<RSSResolvedImage[]> {
  if (feed.rehostImages !== true || images.length === 0) {
    return images;
  }

  const feedId = typeof feed.id === 'string' && feed.id.trim() ? feed.id : 'preview';
  return Promise.all(images.map((image, index) => rehostRSSResolvedImage(image, feedId, item, index)));
}

function applyResolvedImagesToRSSItem(item: RSSItem, images: RSSResolvedImage[]): RSSItem {
  if (images.length === 0) {
    return item;
  }

  const primaryImage = images[0];
  const primaryScore = typeof primaryImage?.score === 'number' ? primaryImage.score : undefined;
  const imageSelectionConfidence = (() => {
    if (!primaryImage) {
      return undefined;
    }

    if (primaryImage.source === 'feed') {
      return 'medium' as const;
    }

    if (typeof primaryScore !== 'number') {
      return 'low' as const;
    }

    if (primaryImage.source === 'tmdb') {
      if (primaryScore >= 140) return 'high' as const;
      if (primaryScore >= 115) return 'medium' as const;
      return 'low' as const;
    }

    if (primaryScore >= 180) return 'high' as const;
    if (primaryScore >= 130) return 'medium' as const;
    return 'low' as const;
  })();

  return {
    ...item,
    imageUrl: primaryImage?.url,
    imageUrls: images.map((image) => image.url),
    imageSource: primaryImage?.source,
    imageReason: primaryImage?.reason,
    imageScore: primaryScore,
    imageSelectionConfidence,
    selectedImages: images,
  };
}

function mergePlatformPostIds(
  previous: Record<string, string> | undefined,
  next: Record<string, string>
): Record<string, string> | undefined {
  const merged = {
    ...(previous || {}),
    ...next,
  };

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergePlatformResults(
  previous: PublishResult[] | undefined,
  next: PublishResult[]
): PublishResult[] | undefined {
  const merged = new Map<string, PublishResult>();

  for (const result of previous || []) {
    merged.set(result.platform, result);
  }

  for (const result of next) {
    merged.set(result.platform, result);
  }

  const values = Array.from(merged.values());
  return values.length > 0 ? values : undefined;
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

function getMaxItemAgeCutoffDate(filters: RSSFeedFilters): Date | null {
  if (!filters.maxItemAgeMinutes) {
    return null;
  }

  return new Date(Date.now() - filters.maxItemAgeMinutes * 60 * 1000);
}

function getPendingQueueSkipReason(
  item: RSSItem,
  options: {
    startFromNowDate?: Date | null;
    maxItemAgeCutoffDate?: Date | null;
  }
): string | null {
  if (options.startFromNowDate && item.pubDate <= options.startFromNowDate) {
    return 'Skipped because it predates the current "Only fetch new items" start time.';
  }

  if (options.maxItemAgeCutoffDate && item.pubDate < options.maxItemAgeCutoffDate) {
    return 'Skipped because it is older than the feed article age limit.';
  }

  return null;
}

async function clearPendingFeedItems(feedId: string, reason: string): Promise<void> {
  const support = await getRSSFeedColumnSupport();
  if (!support.feedItemsTable) {
    return;
  }

  await prisma.rSSFeedItem.updateMany({
    where: {
      feedId,
      status: 'pending',
    },
    data: {
      status: 'filtered',
      lastAttemptedAt: new Date(),
      errorMessage: reason,
    },
  });
}

async function clearQuietHoursPendingFeedItems(feedId: string): Promise<void> {
  const support = await getRSSFeedColumnSupport();
  if (!support.feedItemsTable) {
    return;
  }

  await prisma.rSSFeedItem.updateMany({
    where: {
      feedId,
      status: 'pending',
      errorMessage: QUIET_HOURS_BLOCK_REASON,
    },
    data: {
      status: 'filtered',
      lastAttemptedAt: new Date(),
      errorMessage: 'Cleared because quiet hours were active.',
    },
  });
}

function getFilterScopeText(item: RSSItem, scope: RSSFeedFilters['scope']): string[] {
  const title = item.title || '';
  const body = buildFilterBodyText(item);

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

  if (activeRequired.length > 0) {
    const matchedRequiredRules = activeRequired.filter((rule) => {
      if (filters.scope === 'title_and_body') {
        return scopeTexts.every((scopeText) =>
          matchesRule(scopeText, rule.text, rule.matchType, rule.caseSensitive)
        );
      }

      return scopeTexts.some((scopeText) =>
        matchesRule(scopeText, rule.text, rule.matchType, rule.caseSensitive)
      );
    });

    if (matchedRequiredRules.length === 0) {
      const requiredSummary = activeRequired.map((rule) => `"${rule.text}"`).join(', ');
      return {
        allowed: false,
        reason: `No required keyword matched. Checked: ${requiredSummary}`,
      };
    }
  }

  return { allowed: true };
}

function extractImageUrls(item: Record<string, any>): string[] {
  const urls: Array<string | undefined> = [];
  const rankedBodyImages = extractRankedArticleBodyImageUrls(item);
  urls.push(...rankedBodyImages);
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

function getRawHtmlContent(item: Record<string, any>): string {
  const htmlContent = item['content:encoded'] || item.contentEncoded || item.content || item.contentSnippet || item.summary;
  return typeof htmlContent === 'string' ? htmlContent : '';
}

function isRevealDrivenHeadline(text: string): boolean {
  return /\b(reveals?|revealed|unveils?|unveiled|debuts?|debuted|first look|exclusive image|new poster|official poster|character poster|teaser poster|new still|new image|new images|check out .*poster|check out .*image|gallery|photos?)\b/i.test(text);
}

function getRevealAssetIntent(text: string): 'poster' | 'still' | 'logo' | 'gallery' | 'general_reveal' | null {
  if (!isRevealDrivenHeadline(text)) {
    return null;
  }

  if (/\b(logo|title treatment|wordmark|key art logo)\b/i.test(text)) {
    return 'logo';
  }

  if (/\b(gallery|photos?|set photos?|cast photos?|behind-the-scenes|bts)\b/i.test(text)) {
    return 'gallery';
  }

  if (/\b(poster|one sheet|character poster|teaser poster|imax poster|key art)\b/i.test(text)) {
    return 'poster';
  }

  if (/\b(first look|new still|exclusive image|new image|new images|stills?)\b/i.test(text)) {
    return 'still';
  }

  return 'general_reveal';
}

type RSSDomElement = {
  getAttribute: (name: string) => string | null;
  closest: (selector: string) => RSSDomElement | null;
  querySelector: (selector: string) => RSSDomElement | null;
  textContent: string | null;
  parentElement: RSSDomElement | null;
  previousElementSibling: RSSDomElement | null;
  nextElementSibling: RSSDomElement | null;
};

function resolveDomImageSource(element: RSSDomElement): string | null {
  const htmlElement = element;
  const srcCandidates = [
    htmlElement.getAttribute('src'),
    htmlElement.getAttribute('data-src'),
    htmlElement.getAttribute('data-lazy-src'),
    htmlElement.getAttribute('data-original'),
  ].filter((value): value is string => Boolean(value && value.trim()));

  const srcset = htmlElement.getAttribute('srcset') || htmlElement.getAttribute('data-srcset');
  if (srcset) {
    const first = srcset
      .split(',')
      .map((entry: string) => entry.trim().split(/\s+/)[0])
      .filter(Boolean)
      .pop();
    if (first) {
      srcCandidates.unshift(first);
    }
  }

  const source = srcCandidates.find((value) => /^https?:\/\//i.test(value));
  return source?.trim() || null;
}

function collectLocalImageContext(image: RSSDomElement): string {
  const fragments = [
    image.getAttribute('alt'),
    image.getAttribute('title'),
    image.getAttribute('class'),
    image.closest('header, .entry-header, .article-header, .hero, .featured-image, .post-featured-image, .wp-block-post-featured-image')?.getAttribute('class'),
    image.closest('figure')?.querySelector('figcaption')?.textContent,
    image.closest('figure')?.getAttribute('class'),
    image.parentElement?.textContent,
    image.parentElement?.getAttribute('class'),
    image.previousElementSibling?.textContent,
    image.nextElementSibling?.textContent,
    image.closest('article')?.querySelector('h2, h3')?.textContent,
  ];

  return stripHtml(fragments.filter(Boolean).join(' '));
}

function isComicBookBrandedExclusiveHero(
  articleText: string,
  localContext: string,
  sourceUrl: string,
  width: number,
  height: number
): boolean {
  if (!/comicbook\.com/i.test(sourceUrl)) {
    return false;
  }

  const combinedText = `${articleText} ${localContext} ${sourceUrl}`;
  const isExclusiveStory = /\bexclusive images?\b/i.test(articleText);
  const brandedHeroHints = /\b(comicbook|logo|watermark|header|hero|featured|feature|cover|masthead|banner)\b/i.test(combinedText);
  const featuredStructureHints =
    /\b(entry-header--hero|wp-block-post-featured-image|post-featured-image|featured-image|featured-media|article-hero|hero-image)\b/i.test(localContext) ||
    /\/wp-content\/themes\/comicbook-2024\/assets\/images\/comicbook-logo/i.test(sourceUrl) ||
    /\/wp-content\/uploads\/sites\/4\/\d{4}\/\d{2}\/ComicBook-logo[_-]/i.test(sourceUrl);
  const gallerySignals = /\b(gallery|photo|photos|still|stills|scene|set photo|cast photo|behind-the-scenes|bts|figcaption)\b/i.test(localContext);
  const isWideHero = width >= 600 && width > height;

  return isExclusiveStory && brandedHeroHints && featuredStructureHints && isWideHero && !gallerySignals;
}

function isGenericFeaturedHeroImage(
  articleText: string,
  localContext: string,
  sourceUrl: string,
  width: number,
  height: number
): boolean {
  const combinedText = `${localContext} ${sourceUrl}`;
  const featuredStructureHints =
    /\b(entry-header--hero|wp-block-post-featured-image|post-featured-image|featured-image|featured-media|article-hero|hero-image|hero-media|hero|header|featured|lead-image|lede)\b/i
      .test(combinedText);
  const bodyImageSignals =
    /\b(figcaption|caption|wp-caption|gallery|photo|photos|still|stills|scene|set photo|cast photo|behind-the-scenes|bts|exclusive image|first look|new still)\b/i
      .test(localContext);
  const isWideHero = width >= 600 && width > height;
  const isRevealDriven = isRevealDrivenHeadline(articleText);

  return isRevealDriven && featuredStructureHints && isWideHero && !bodyImageSignals;
}

function scoreArticleBodyImageCandidate(
  articleTitle: string,
  articleDescription: string,
  localContext: string,
  sourceUrl: string,
  width: number,
  height: number
): number {
  const articleText = `${articleTitle} ${articleDescription}`;
  const revealIntent = getRevealAssetIntent(articleText);
  let score = 0;

  if (isRevealDrivenHeadline(articleText)) {
    score += 25;
  }

  if (isRevealDrivenHeadline(localContext)) {
    score += 35;
  }

  if (revealIntent === 'poster') {
    if (height > width && width >= 240) score += 28;
    if (/\bposter|key art|one sheet|character poster\b/i.test(localContext)) score += 24;
  } else if (revealIntent === 'still') {
    if (width >= height) score += 22;
    if (/\bfirst look|still|image|scene|exclusive\b/i.test(localContext)) score += 20;
  } else if (revealIntent === 'logo') {
    if (/\blogo|wordmark|title treatment\b/i.test(localContext)) score += 22;
  } else if (revealIntent === 'gallery') {
    if (/\bgallery|photo|photos|set photo|cast photo|behind-the-scenes|bts\b/i.test(localContext)) score += 20;
  }

  const normalizedTitleTokens = articleTitle
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
  const titleMatches = normalizedTitleTokens.filter((token) => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(localContext)).length;
  score += Math.min(titleMatches * 8, 24);

  if (width * height >= 500_000) {
    score += 12;
  }

  if (/(avatar|author|logo|icon|sprite|thumbnail|thumb|related|promo|advert|adservice)/i.test(sourceUrl)) {
    score -= 45;
  }

  if (/\b(related|recommended|newsletter|subscribe)\b/i.test(localContext)) {
    score -= 30;
  }

  if (isComicBookBrandedExclusiveHero(articleText, localContext, sourceUrl, width, height)) {
    score -= 80;
  }

  if (isGenericFeaturedHeroImage(articleText, localContext, sourceUrl, width, height)) {
    score -= 55;
  }

  return score;
}

function extractRankedArticleBodyImageUrls(item: Record<string, any>): string[] {
  const htmlContent = getRawHtmlContent(item);
  if (!htmlContent || !/<img[\s>]/i.test(htmlContent)) {
    return [];
  }

  try {
    const dom = new JSDOM(`<article>${htmlContent}</article>`);
    const document = dom.window.document;
    const articleTitle = String(item.title || '').trim();
    const articleDescription = extractLeadParagraphText(item);

    const ranked = Array.from(document.querySelectorAll('img') as Iterable<RSSDomElement>)
      .map((image) => {
        const sourceUrl = resolveDomImageSource(image);
        if (!sourceUrl) {
          return null;
        }

        const width = Number.parseInt(image.getAttribute('width') || '0', 10) || 0;
        const height = Number.parseInt(image.getAttribute('height') || '0', 10) || 0;
        const localContext = collectLocalImageContext(image);
        const score = scoreArticleBodyImageCandidate(
          articleTitle,
          articleDescription,
          localContext,
          sourceUrl,
          width,
          height
        );

        if (score < 0) {
          return null;
        }

        return {
          sourceUrl,
          score,
        };
      })
      .filter((entry): entry is { sourceUrl: string; score: number } => Boolean(entry))
      .sort((left, right) => right.score - left.score);

    return dedupeUrls(ranked.map((entry) => entry.sourceUrl));
  } catch (error) {
    console.warn('[RSS] Failed to extract ranked article body images from feed item HTML.', error);
    return [];
  }
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
  if (item.link && item.link.trim()) {
    return `link:${normalizeRSSDedupeValue(item.link)}`;
  }

  if (item.guid && item.guid.trim()) {
    return `guid:${normalizeRSSDedupeValue(item.guid)}`;
  }

  return `title:${normalizeRSSDedupeValue(item.title)}`;
}

function getRSSTopicSignature(title?: string | null): string {
  const normalizedTitle = normalizeRSSDedupeValue(title);
  if (!normalizedTitle) {
    return '';
  }

  const tokens = normalizedTitle
    .split(' ')
    .filter((token) => token && !RSS_TOPIC_SIGNATURE_STOP_WORDS.has(token))
    .filter((token) => token.length > 2 || /^\d+$/.test(token));
  const uniqueTokens = Array.from(new Set(tokens)).sort();
  return uniqueTokens.join(' ');
}

function getRSSTopicTokens(title?: string | null): string[] {
  const normalizedTitle = normalizeRSSDedupeValue(title);
  if (!normalizedTitle) {
    return [];
  }

  return normalizedTitle
    .split(' ')
    .filter((token) => token && !RSS_TOPIC_SIGNATURE_STOP_WORDS.has(token))
    .filter((token) => token.length > 2 || /^\d+$/.test(token));
}

function extractRSSEntityTokens(title?: string | null): string[] {
  if (!title) {
    return [];
  }

  const entityMatches = Array.from(
    title.matchAll(/\b([A-Z][a-z0-9]+(?:['-][A-Z]?[a-z0-9]+)*|[A-Z]{2,}|[0-9]+)\b/g)
  )
    .map((match) => normalizeRSSDedupeValue(match[0]))
    .filter((token) => token && !RSS_TOPIC_ENTITY_STOP_WORDS.has(token))
    .filter((token) => token.length > 2 || /^\d+$/.test(token));

  return Array.from(new Set(entityMatches));
}

function buildRSSTopicFingerprint(title?: string | null): {
  signature: string;
  tokens: Set<string>;
  entityTokens: Set<string>;
} {
  const signature = getRSSTopicSignature(title);
  return {
    signature,
    tokens: new Set(getRSSTopicTokens(title)),
    entityTokens: new Set(extractRSSEntityTokens(title)),
  };
}

function getSetIntersectionCount(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) {
      count += 1;
    }
  }
  return count;
}

function areRSSTopicFingerprintsSimilar(
  left: { signature: string; tokens: Set<string>; entityTokens: Set<string> },
  right: { signature: string; tokens: Set<string>; entityTokens: Set<string> }
): boolean {
  if (!left.signature || !right.signature) {
    return false;
  }

  if (left.signature === right.signature) {
    return true;
  }

  const sharedTokens = getSetIntersectionCount(left.tokens, right.tokens);
  const sharedEntities = getSetIntersectionCount(left.entityTokens, right.entityTokens);
  const minTokenSize = Math.min(left.tokens.size, right.tokens.size);
  const entityHeavyMatch = sharedEntities >= 2 && sharedTokens >= 4;
  const highTokenOverlap = minTokenSize >= 4 && sharedTokens >= Math.max(4, minTokenSize - 1);
  const weightedScore = sharedTokens + sharedEntities * 2;

  return entityHeavyMatch || highTokenOverlap || weightedScore >= 8;
}

function getRSSItemTopicDedupeKey(item: RSSItem): string {
  const signature = getRSSTopicSignature(item.title);
  return signature ? `topic:${signature}` : '';
}

function serializeRSSItem(item: RSSItem): Prisma.InputJsonValue {
  return {
    title: item.title,
    link: item.link,
    description: item.description,
    pubDate: item.pubDate.toISOString(),
    imageUrl: item.imageUrl ?? null,
    imageUrls: item.imageUrls,
    imageSource: item.imageSource ?? null,
    imageReason: item.imageReason ?? null,
    imageScore: item.imageScore ?? null,
    imageSelectionConfidence: item.imageSelectionConfidence ?? null,
    selectedImages: item.selectedImages?.map((image) => ({
      url: image.url,
      reason: image.reason,
      source: image.source,
      score: image.score ?? null,
    })) ?? null,
    generatedCaption: item.generatedCaption ?? null,
    platformPostIds: item.platformPostIds ?? null,
    platformResults: item.platformResults?.map((result) => ({
      platform: result.platform,
      status: result.status,
      error: result.error ?? null,
      id: result.id ?? null,
      url: result.url ?? null,
      postedAt: result.postedAt,
    })) ?? null,
    contentHtml: item.contentHtml ?? null,
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
    imageSource: value.imageSource === 'tmdb' || value.imageSource === 'serper' || value.imageSource === 'feed'
      ? value.imageSource
      : undefined,
    imageReason: typeof value.imageReason === 'string' ? value.imageReason : undefined,
    imageScore: typeof value.imageScore === 'number' ? value.imageScore : undefined,
    imageSelectionConfidence:
      value.imageSelectionConfidence === 'high' ||
      value.imageSelectionConfidence === 'medium' ||
      value.imageSelectionConfidence === 'low'
        ? value.imageSelectionConfidence
        : undefined,
    selectedImages: Array.isArray(value.selectedImages)
      ? value.selectedImages
          .map((entry): RSSResolvedImage | null => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
              return null;
            }

            const record = entry as Record<string, unknown>;
            const url = typeof record.url === 'string' ? record.url : null;
            const reason = typeof record.reason === 'string' ? record.reason : null;
            const source = record.source;
            if (!url || !reason || (source !== 'tmdb' && source !== 'serper' && source !== 'feed')) {
              return null;
            }

            return {
              url,
              reason,
              source,
              score: typeof record.score === 'number' ? record.score : undefined,
            };
          })
          .filter((entry): entry is RSSResolvedImage => Boolean(entry))
      : undefined,
    generatedCaption: typeof value.generatedCaption === 'string' ? value.generatedCaption : undefined,
    platformPostIds: value.platformPostIds && typeof value.platformPostIds === 'object' && !Array.isArray(value.platformPostIds)
      ? Object.fromEntries(
          Object.entries(value.platformPostIds as Record<string, unknown>)
            .filter(([, entry]) => typeof entry === 'string' && entry.trim())
            .map(([platform, entry]) => [platform, String(entry).trim()])
        )
      : undefined,
    platformResults: Array.isArray(value.platformResults)
      ? value.platformResults
          .map((entry): PublishResult | null => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
              return null;
            }

            const record = entry as Record<string, unknown>;
            const platform = typeof record.platform === 'string' ? record.platform : null;
            const status = record.status;
            if (!platform || (status !== 'posted' && status !== 'failed' && status !== 'skipped')) {
              return null;
            }

            return {
              platform,
              status,
              error: typeof record.error === 'string' ? record.error : undefined,
              id: typeof record.id === 'string' ? record.id : undefined,
              url: typeof record.url === 'string' ? record.url : undefined,
              postedAt: typeof record.postedAt === 'string' ? record.postedAt : new Date().toISOString(),
            };
          })
          .filter((entry): entry is PublishResult => Boolean(entry))
      : undefined,
    contentHtml: typeof value.contentHtml === 'string' ? value.contentHtml : undefined,
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
  const support = await getRSSFeedColumnSupport();
  if (!support.feedItemsTable) {
    return;
  }

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
  feed: {
    id?: string;
    serperEnabled?: boolean | null;
    tmdbEnabled?: boolean | null;
    serperPriority: boolean;
    imageCount?: string | null;
    rehostImages?: boolean | null;
  },
  item: RSSItem,
  limit: number
): Promise<RSSResolvedImage[]> {
  const resolvedImages = await resolveRelevantRSSImages(
    {
      title: item.title,
      description: item.description,
      author: item.author,
      fallbackImages: dedupeUrls([...(item.imageUrls || []), item.imageUrl]),
    },
    {
      serperEnabled: feed.serperEnabled ?? true,
      tmdbEnabled: feed.tmdbEnabled ?? false,
      serperPriority: feed.serperPriority,
      limit,
      smartCount: feed.imageCount === 'random',
      model: RSS_IMAGE_ANALYSIS_MODEL,
    }
  );

  return maybeRehostRSSResolvedImages(feed, item, resolvedImages);
}

function buildRSSCaptionSystemPrompt(
  basePrompt: string | undefined,
  options: { tone?: string; maxLength?: number }
): string | undefined {
  const constraints = [
    options.tone ? `- Preferred tone: ${options.tone}.` : null,
    options.maxLength ? `- Keep the final caption under ${options.maxLength} characters.` : null,
    '- Focus on the single strongest lead angle from the headline rather than summarizing every sub-story in the article.',
    '- If the article is a roundup, mention secondary items only when they are essential to the lead angle.',
    '- Keep the wording aligned with the selected image so the caption and visual feel like the same story.',
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

function parseRSSActivityImageUrls(value: Prisma.JsonValue | undefined): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const imageUrls = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return imageUrls.length > 0 ? imageUrls : undefined;
}

function parseRSSActivityPlatformPostIds(value: Prisma.JsonValue | undefined): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value as Prisma.JsonObject)
    .filter(([, entryValue]) => typeof entryValue === 'string' && entryValue.trim())
    .map(([key, entryValue]) => [key, String(entryValue).trim()] as const);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function parseRSSActivityPlatformResults(value: Prisma.JsonValue | undefined): PublishResult[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const results = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Prisma.JsonObject;
      const platform = typeof record.platform === 'string' ? record.platform : null;
      const status = record.status;
      if (!platform || (status !== 'posted' && status !== 'failed' && status !== 'skipped')) {
        return null;
      }

      const result: PublishResult = {
        platform,
        status,
        postedAt: typeof record.postedAt === 'string' ? record.postedAt : new Date().toISOString(),
      };

      if (typeof record.error === 'string') {
        result.error = record.error;
      }

      if (typeof record.id === 'string') {
        result.id = record.id;
      }

      if (typeof record.url === 'string') {
        result.url = record.url;
      }

      return result;
    })
    .filter((entry): entry is PublishResult => Boolean(entry));

  return results.length > 0 ? results : undefined;
}

function parseRSSActivityLog(log: { id: string; timestamp: Date; metadata: Prisma.JsonValue | null }): RSSActivityItem | null {
  const metadata = log.metadata as Prisma.JsonObject | null;
  if (!metadata || metadata.category !== RSS_ACTIVITY_CATEGORY) {
    return null;
  }

  const status = metadata.status;
  if (status !== 'pending' && status !== 'published' && status !== 'failed' && status !== 'filtered') {
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
    contentHtml: typeof metadata.contentHtml === 'string' ? metadata.contentHtml : undefined,
    imageUrl: typeof metadata.imageUrl === 'string' ? metadata.imageUrl : undefined,
    imageUrls: parseRSSActivityImageUrls(metadata.imageUrls),
    imageSource: metadata.imageSource === 'tmdb' || metadata.imageSource === 'serper' || metadata.imageSource === 'feed'
      ? metadata.imageSource
      : undefined,
    imageReason: typeof metadata.imageReason === 'string' ? metadata.imageReason : undefined,
    imageScore: typeof metadata.imageScore === 'number' ? metadata.imageScore : undefined,
    imageSelectionConfidence:
      metadata.imageSelectionConfidence === 'high' ||
      metadata.imageSelectionConfidence === 'medium' ||
      metadata.imageSelectionConfidence === 'low'
        ? metadata.imageSelectionConfidence
        : undefined,
    selectedImages: Array.isArray(metadata.selectedImages)
      ? metadata.selectedImages
          .map((entry): RSSResolvedImage | null => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
              return null;
            }

            const record = entry as Prisma.JsonObject;
            const url = typeof record.url === 'string' ? record.url : null;
            const reason = typeof record.reason === 'string' ? record.reason : null;
            const source = record.source;
            if (!url || !reason || (source !== 'tmdb' && source !== 'serper' && source !== 'feed')) {
              return null;
            }

            return {
              url,
              reason,
              source,
              score: typeof record.score === 'number' ? record.score : undefined,
            };
          })
          .filter((entry): entry is RSSResolvedImage => Boolean(entry))
      : undefined,
    status,
    timestamp: log.timestamp.toISOString(),
    publishedAt: typeof metadata.publishedAt === 'string' ? metadata.publishedAt : undefined,
    platforms,
    platformPostIds: parseRSSActivityPlatformPostIds(metadata.platformPostIds),
    platformResults: parseRSSActivityPlatformResults(metadata.platformResults),
    error: typeof metadata.errorMessage === 'string' ? metadata.errorMessage : undefined,
  };
}

function buildActivitySummary(items: RSSActivityItem[]): RSSActivitySummary {
  return {
    total: items.length,
    published: items.filter((item) => item.status === 'published').length,
    pending: items.filter((item) => item.status === 'pending').length,
    failed: items.filter((item) => item.status === 'failed').length,
    filtered: items.filter((item) => item.status === 'filtered').length,
  };
}

function buildRSSActivityItemFromFeedRecord(record: {
  id: string;
  feedId: string;
  title: string;
  link: string;
  status: string;
  itemData: Prisma.JsonValue | null;
  firstSeenAt: Date;
  publishedAt: Date | null;
  errorMessage: string | null;
  feed: {
    id: string;
    name: string;
    platformsEnabled: Prisma.JsonValue;
  };
}): RSSActivityItem {
  const item = deserializeRSSItem(record.itemData);
  const platforms = getEnabledPlatforms(record.feed.platformsEnabled as Record<string, boolean> | null);
  const normalizedStatus: RSSActivityItem['status'] =
    record.status === 'published' || record.status === 'pending' || record.status === 'failed' || record.status === 'filtered'
      ? record.status
      : 'failed';

  return {
    id: record.id,
    feedId: record.feedId,
    feedName: record.feed.name,
    title: item?.title || record.title || 'Untitled item',
    link: item?.link || record.link || undefined,
    description: item?.description || undefined,
    contentHtml: item?.contentHtml || undefined,
    imageUrl: item?.imageUrl || undefined,
    imageUrls: item?.imageUrls && item.imageUrls.length > 0 ? item.imageUrls : undefined,
    imageSource: item?.imageSource,
    imageReason: item?.imageReason,
    imageScore: item?.imageScore,
    imageSelectionConfidence: item?.imageSelectionConfidence,
    selectedImages: item?.selectedImages,
    status: normalizedStatus,
    timestamp: (record.publishedAt || record.firstSeenAt).toISOString(),
    publishedAt: record.publishedAt?.toISOString(),
    platforms,
    error: record.errorMessage || undefined,
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

function getRSSActivityTopicDedupeKey(activity: RSSActivityItem): string {
  const signature = getRSSTopicSignature(activity.title);
  return signature ? `topic:${signature}` : '';
}

function mergeRSSActivityItems(primary: RSSActivityItem[], fallback: RSSActivityItem[], limit: number): RSSActivityItem[] {
  const merged: RSSActivityItem[] = [];
  const seen = new Set<string>();

  for (const item of [...primary, ...fallback]) {
    const dedupeKey = `${item.feedId || 'unknown'}:${getRSSActivityDedupeKey(item)}:${item.status}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    merged.push(item);
  }

  return merged
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
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
    contentHtml: metadata.contentHtml,
    imageUrl: metadata.imageUrl,
    imageUrls: metadata.imageUrls,
    imageSource: metadata.imageSource,
    imageReason: metadata.imageReason,
    imageScore: metadata.imageScore,
    imageSelectionConfidence: metadata.imageSelectionConfidence,
    selectedImages: metadata.selectedImages,
    status: metadata.status,
    timestamp: new Date().toISOString(),
    publishedAt: metadata.publishedAt,
    platforms: metadata.platforms,
    platformPostIds: metadata.platformPostIds,
    platformResults: metadata.platformResults,
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
    return QUIET_HOURS_BLOCK_REASON;
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
  const sanitizedCaption = sanitizeRSSCaptionText(caption);
  const { platformImageCounts } = getRSSPublishImagePlan(feed, platforms);
  const platformOverrides = Object.fromEntries(
    platforms.map((platform) => {
      const limit = platformImageCounts[platform] ?? 1;
      const platformImages = imageUrls.slice(0, limit);
      const override: {
        imageUrls: string[];
        imageUrl?: string;
        link?: string;
      } = {
        imageUrls: platformImages,
        imageUrl: platformImages[0],
      };

      if (platform === 'Facebook' || platform === 'Threads' || platform === 'X') {
        override.link = undefined;
      }

      return [platform, override];
    })
  );

  return {
    text: sanitizedCaption,
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

  await updateFeed(feedId, {
    title: item.title,
    description: item.description,
    imageUrl: imageUrlOverride || item.imageUrl,
    publishedDate: item.pubDate,
    platforms,
    caption,
  } as any);
}

async function attemptRSSPublish(
  feed: {
    id: string;
    name: string;
    serperPriority: boolean;
    imageCount?: string | null;
    platformImageCounts?: PlatformImageCounts | Prisma.JsonValue | null;
    rehostImages?: boolean | null;
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
      imageUrls: string[];
      resolvedImages: RSSResolvedImage[];
      successfulPlatforms: string[];
      platformPostIds: Record<string, string>;
      platformResults: PublishResult[];
      errorMessage?: string;
    }
  | {
      status: 'pending';
      caption: string;
      imageUrl?: string;
      imageUrls: string[];
      resolvedImages: RSSResolvedImage[];
      successfulPlatforms: string[];
      remainingPlatforms: string[];
      platformPostIds: Record<string, string>;
      platformResults: PublishResult[];
      errorMessage: string;
    }
  | {
      status: 'failed';
      caption?: string;
      imageUrl?: string;
      imageUrls: string[];
      resolvedImages: RSSResolvedImage[];
      platformPostIds: Record<string, string>;
      platformResults: PublishResult[];
      errorMessage: string;
    }
> {
  try {
    const previousPlatformPostIds = item.platformPostIds || {};
    const previousPlatformResults = item.platformResults || [];
    const remainingPlatforms = platforms.filter((platform) => !previousPlatformPostIds[platform]);

    if (remainingPlatforms.length === 0) {
      return {
        status: 'published',
        caption: item.generatedCaption || '',
        imageUrl: item.imageUrl,
        imageUrls: item.imageUrls || [],
        resolvedImages: item.selectedImages || [],
        successfulPlatforms: platforms,
        platformPostIds: previousPlatformPostIds,
        platformResults: previousPlatformResults,
      };
    }

    const publishImages = await resolveRSSItemImages(
      feed,
      item,
      imagePlan.maxImageCount
    );
    const publishImageUrls = publishImages.map((image) => image.url);
    const publishImageUrl = publishImageUrls[0];
    const systemPrompt = buildRSSCaptionSystemPrompt(runtimeSettings.rssCaptionPrompt, {
      tone: runtimeSettings.rssCaptionTone,
      maxLength: runtimeSettings.rssCaptionMaxLength,
    });
    const captionSource = item.generatedCaption || await aiService.generateRSSCaption(
      {
        articleTitle: item.title,
        feedName: feed.name,
        summary: sanitizeRSSPlainText(item.description),
        platform: 'X',
      },
      normalizeAIModel(runtimeSettings.rssCaptionModel),
      systemPrompt,
      runtimeSettings.rssCaptionTemperature
    );
    const caption = sanitizeRSSCaptionText(captionSource, runtimeSettings.rssCaptionMaxLength);

    const publishResults = await publisherService.publish(
      remainingPlatforms,
      buildRSSPublishPayload(item, caption, publishImageUrls, feed, remainingPlatforms)
    );

    const newlySuccessfulPlatforms = publishResults
      .filter((result) => result.status === 'posted')
      .map((result) => result.platform);
    const platformPostIds = mergePlatformPostIds(
      previousPlatformPostIds,
      Object.fromEntries(
      publishResults
        .filter((result) => result.status === 'posted' && typeof result.id === 'string' && result.id.trim())
        .map((result) => [result.platform, result.id!.trim()] as const)
      )
    ) || {};
    const platformResults = mergePlatformResults(previousPlatformResults, publishResults) || [];
    const failedResults = publishResults.filter((result) => result.status !== 'posted');
    const partialFailureMessage = failedResults.length > 0
      ? failedResults.map((result) => `${result.platform}: ${result.error || result.status}`).join('; ')
      : undefined;
    const successfulPlatforms = platforms.filter((platform) => Boolean(platformPostIds[platform]));
    const unresolvedPlatforms = platforms.filter((platform) => !platformPostIds[platform]);

    if (successfulPlatforms.length === 0) {
      return {
        status: 'failed',
        caption,
        imageUrl: publishImageUrl,
        imageUrls: publishImageUrls,
        resolvedImages: publishImages,
        platformPostIds,
        platformResults,
        errorMessage: publishResults
          .map((result) => `${result.platform}: ${result.error || result.status}`)
          .join('; ') || 'Publishing failed.',
      };
    }

    if (unresolvedPlatforms.length > 0) {
      return {
        status: 'pending',
        caption,
        imageUrl: publishImageUrl,
        imageUrls: publishImageUrls,
        resolvedImages: publishImages,
        successfulPlatforms,
        remainingPlatforms: unresolvedPlatforms,
        platformPostIds,
        platformResults,
        errorMessage: partialFailureMessage || `Pending retry for ${unresolvedPlatforms.join(', ')}`,
      };
    }

    return {
      status: 'published',
      caption,
      imageUrl: publishImageUrl,
      imageUrls: publishImageUrls,
      resolvedImages: publishImages,
      successfulPlatforms,
      platformPostIds,
      platformResults,
      errorMessage: partialFailureMessage,
    };
  } catch (error) {
    const fallbackImages = dedupeUrls([...(item.imageUrls || []), item.imageUrl]).map((url) => ({
      url,
      reason: 'Article body image',
      source: 'feed' as const,
    }));
    return {
      status: 'failed',
      caption: item.generatedCaption,
      imageUrl: fallbackImages[0]?.url,
      imageUrls: fallbackImages.map((image) => image.url),
      resolvedImages: fallbackImages,
      platformPostIds: item.platformPostIds || {},
      platformResults: item.platformResults || [],
      errorMessage: error instanceof Error ? error.message : 'Failed to process RSS item.',
    };
  }
}

const RSS_PRIMARY_USER_AGENT = 'Screndly RSS Reader/1.0';
const RSS_BROWSER_FALLBACK_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';

function buildRSSFetchHeaders(url: string, userAgent: string): Record<string, string> {
  let referer = url;
  try {
    const parsedUrl = new URL(url);
    referer = `${parsedUrl.protocol}//${parsedUrl.host}/`;
  } catch {
    referer = url;
  }

  return {
    'User-Agent': userAgent,
    Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Referer: referer,
  };
}

async function fetchRSSFeed(url: string): Promise<string> {
  const attempts = [
    {
      label: 'primary',
      headers: buildRSSFetchHeaders(url, RSS_PRIMARY_USER_AGENT),
    },
    {
      label: 'browser-fallback',
      headers: buildRSSFetchHeaders(url, RSS_BROWSER_FALLBACK_USER_AGENT),
    },
  ];

  let lastError: Error | null = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const response = await fetch(url, {
      headers: attempt.headers,
      redirect: 'follow',
    });

    if (response.ok) {
      return response.text();
    }

    lastError = new Error(`Failed to fetch RSS: ${response.status} ${response.statusText}`);

    const canRetryWithBrowserHeaders =
      index < attempts.length - 1 && (response.status === 403 || response.status === 429);

    if (!canRetryWithBrowserHeaders) {
      throw lastError;
    }

    console.warn(
      `[RSS] Feed fetch for ${url} returned ${response.status} ${response.statusText}; retrying with browser headers`
    );
  }

  throw lastError ?? new Error('Failed to fetch RSS: unknown error');
}

async function parseRSSFeed(xml: string): Promise<RSSFeedData> {
  const parsed = await parser.parseString(xml);

  return {
    title: parsed.title || 'Unknown Feed',
    description: sanitizeRSSPlainText(parsed.description || ''),
    link: parsed.link || '',
    lastBuildDate: parsed.lastBuildDate ? new Date(parsed.lastBuildDate) : undefined,
    items: (parsed.items || [])
      .map((item: any) => {
        const description = extractLeadParagraphText(item);
        const pubDate = item.isoDate || item.pubDate ? new Date(item.isoDate || item.pubDate) : new Date();
        const imageUrls = extractImageUrls(item);
        const contentHtml = getRawHtmlContent(item);

        return {
          title: String(item.title || '').trim(),
          link: String(item.link || '').trim(),
          description: sanitizeRSSPlainText(description).slice(0, 1000),
          pubDate: Number.isNaN(pubDate.getTime()) ? new Date() : pubDate,
          imageUrl: imageUrls[0],
          imageUrls,
          contentHtml: contentHtml || undefined,
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
  let feedDescription = '';
  try {
    const xml = await fetchRSSFeed(data.url);
    const parsed = await parseRSSFeed(xml);
    if (!feedTitle || feedTitle === 'New Feed') {
      feedTitle = parsed.title;
    }
    feedDescription = parsed.description || '';
  } catch (error) {
    console.warn('[RSS] Could not fetch feed during creation:', error);
  }

  const resolvedFilters = resolveForwardOnlySettings(data.filters, {
    explicitOnlyFetchNewItems: data.onlyFetchNewItems,
    explicitStartFromNowAt: data.startFromNowAt,
  });
  const persistedImageSourceSettings = {
    serperEnabled: data.serperEnabled ?? true,
    tmdbEnabled: data.tmdbEnabled ?? false,
  };
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
    filters: withStoredImageSourceSettings(resolvedFilters, persistedImageSourceSettings),
    serperPriority: data.serperPriority ?? true,
    rehostImages: data.rehostImages ?? false,
    autoPost: data.autoPost ?? true,
    platformsEnabled: ensurePlatformsEnabled(data.platformsEnabled) as unknown as Prisma.InputJsonValue,
    status: data.status ?? 'active',
    source: feedTitle || data.name,
    title: feedTitle || data.name,
    description: feedDescription,
    publishedDate: new Date(),
  };

  if (support.serperEnabled) {
    createData.serperEnabled = data.serperEnabled ?? true;
  }

  if (support.tmdbEnabled) {
    createData.tmdbEnabled = data.tmdbEnabled ?? false;
  }

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
  data: Partial<RSSFeedInput> & {
    lastProcessedAt?: Date;
    nextRunAt?: Date | null;
    errorMessage?: string | null;
    title?: string;
    description?: string;
    imageUrl?: string;
    publishedDate?: Date;
    platforms?: string[];
    caption?: string | null;
  }
) {
  const support = await getRSSFeedColumnSupport();
  const existingFeed = await prisma.rSSFeed.findUnique({
    where: { id },
    select: {
      filters: true,
      enabled: true,
      status: true,
      interval: true,
      ...(support.serperEnabled ? { serperEnabled: true } : {}),
      ...(support.tmdbEnabled ? { tmdbEnabled: true } : {}),
    },
  });

  if (!existingFeed) {
    throw new Error('Feed not found');
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  const existingFilters = ensureFeedFilters(existingFeed.filters as unknown as RSSFeedFilters);
  const existingStoredImageSourceSettings = extractStoredImageSourceSettings(existingFeed.filters);
  const nextEnabled = data.enabled ?? existingFeed.enabled;
  const nextStatus =
    data.status ??
    (data.enabled === false
      ? 'paused'
      : data.enabled === true && existingFeed.status === 'paused'
        ? 'active'
        : existingFeed.status);
  const willBePaused = !nextEnabled || nextStatus === 'paused';
  const isReactivating =
    (!existingFeed.enabled || existingFeed.status === 'paused') &&
    nextEnabled &&
    nextStatus !== 'paused';
  const requestedFilters = ensureFeedFilters(
    (data.filters ?? existingFilters) as RSSFeedFilters
  );
  const nextOnlyFetchNewItems =
    data.onlyFetchNewItems ??
    requestedFilters.onlyFetchNewItems ??
    existingFilters.onlyFetchNewItems ??
    false;
  const shouldResetStartFromNow = isReactivating && nextOnlyFetchNewItems;
  const shouldResolveFilters =
    data.filters !== undefined ||
    data.onlyFetchNewItems !== undefined ||
    data.startFromNowAt !== undefined ||
    shouldResetStartFromNow;
  const shouldPersistImageSourceSettings =
    data.serperEnabled !== undefined ||
    data.tmdbEnabled !== undefined;

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
  const nextStoredImageSourceSettings = {
    serperEnabled: data.serperEnabled ??
      (typeof (existingFeed as Record<string, unknown>).serperEnabled === 'boolean'
        ? (existingFeed as Record<string, unknown>).serperEnabled as boolean
        : existingStoredImageSourceSettings.serperEnabled ??
          (data.serperPriority ?? true)),
    tmdbEnabled: data.tmdbEnabled ??
      (typeof (existingFeed as Record<string, unknown>).tmdbEnabled === 'boolean'
        ? (existingFeed as Record<string, unknown>).tmdbEnabled as boolean
        : existingStoredImageSourceSettings.tmdbEnabled ?? false),
  };

  if (shouldResolveFilters || shouldPersistImageSourceSettings) {
    const resolvedFilters = shouldResolveFilters
      ? resolveForwardOnlySettings(data.filters ?? existingFilters, {
          previousFilters: existingFilters,
          explicitOnlyFetchNewItems: data.onlyFetchNewItems,
          explicitStartFromNowAt: shouldResetStartFromNow
            ? new Date().toISOString()
            : data.startFromNowAt,
        })
      : existingFilters;

    updateData.filters = withStoredImageSourceSettings(resolvedFilters, nextStoredImageSourceSettings);
  }
  if (support.serperEnabled && data.serperEnabled !== undefined) updateData.serperEnabled = data.serperEnabled;
  if (support.tmdbEnabled && data.tmdbEnabled !== undefined) updateData.tmdbEnabled = data.tmdbEnabled;
  if (data.serperPriority !== undefined) updateData.serperPriority = data.serperPriority;
  if (data.rehostImages !== undefined) updateData.rehostImages = data.rehostImages;
  if (data.autoPost !== undefined) updateData.autoPost = data.autoPost;
  if (data.platformsEnabled !== undefined) updateData.platformsEnabled = data.platformsEnabled;
  if (support.trickle && data.trickle !== undefined) updateData.trickle = normalizeTrickle(data.trickle);
  if (data.status !== undefined) {
    updateData.status = data.status;
  } else if (data.enabled === false) {
    updateData.status = 'paused';
  } else if (data.enabled === true && existingFeed.status === 'paused') {
    updateData.status = 'active';
  }
  if (data.lastProcessedAt !== undefined) updateData.lastProcessedAt = data.lastProcessedAt;
  if (data.nextRunAt !== undefined) updateData.nextRunAt = data.nextRunAt;
  if (data.nextRunAt === undefined && willBePaused) {
    updateData.nextRunAt = null;
  } else if (data.nextRunAt === undefined && isReactivating) {
    const intervalMinutes = data.interval ?? existingFeed.interval ?? 10;
    updateData.nextRunAt = new Date(Date.now() + intervalMinutes * 60 * 1000);
  }
  if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.publishedDate !== undefined) updateData.publishedDate = data.publishedDate;
  if (data.platforms !== undefined) updateData.platforms = data.platforms;
  if (data.caption !== undefined) updateData.caption = data.caption;

  const select = await getRSSFeedSelect();
  const updatedFeed = await prisma.rSSFeed.update({
    where: { id },
    data: updateData,
    select,
  });

  const resolvedUpdatedFilters = ensureFeedFilters(
    ((shouldResolveFilters ? updateData.filters : existingFeed.filters) ?? existingFeed.filters) as RSSFeedFilters
  );

  if (willBePaused) {
    await clearPendingFeedItems(id, 'Cleared because the feed was paused.');
  } else if (isReactivating && resolvedUpdatedFilters.onlyFetchNewItems) {
    await clearPendingFeedItems(
      id,
      'Cleared because the feed restarted with "Only fetch new items from now on".'
    );
  }

  return applyRSSFeedCompatibility(updatedFeed as Record<string, any>);
}

async function deleteFeed(id: string) {
  return prisma.rSSFeed.delete({
    where: { id },
  });
}

async function runRefreshFeed(id: string, options: RefreshFeedOptions = {}): Promise<RefreshResult> {
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

  if (!feed.enabled || feed.status === 'paused') {
    return {
      feedId: feed.id,
      feedName: feed.name,
      itemsAdded: 0,
      checkedCount: 0,
      pendingCount: 0,
      failedCount: 0,
      error: 'Feed is paused',
    };
  }

  const runtimeSettings = await getRuntimeSettings();
  const nextRunAt = new Date(Date.now() + feed.interval * 60 * 1000);
  const quietHoursBlocked = isWithinQuietHours(runtimeSettings);

  if (quietHoursBlocked) {
    await clearQuietHoursPendingFeedItems(feed.id);
    await updateFeed(id, {
      status: 'active',
      nextRunAt,
      errorMessage: null,
    });

    return {
      feedId: feed.id,
      feedName: feed.name,
      itemsAdded: 0,
      checkedCount: 0,
      pendingCount: 0,
      failedCount: 0,
      latestItemTitle: feed.title || undefined,
      error: options.manualRun ? 'RSS polling is paused by quiet hours.' : undefined,
      selectionMode: options.manualRun ? 'latest_item' : 'backlog',
    };
  }

  try {
    const xml = await fetchRSSFeed(feed.url);
    const parsed = await parseRSSFeed(xml);
    const feedFilters = ensureFeedFilters(feed.filters as unknown as RSSFeedFilters);
    const startFromNowDate = parseFilterTimestamp(feedFilters.startFromNowAt);
    const maxItemAgeCutoffDate = getMaxItemAgeCutoffDate(feedFilters);
    const effectiveCutoffDate = (() => {
      const bufferedLastProcessedAt = feed.lastProcessedAt
        ? new Date(feed.lastProcessedAt.getTime() - RSS_ITEM_RECHECK_BUFFER_MS)
        : null;

      if (feedFilters.onlyFetchNewItems) {
        if (startFromNowDate) return startFromNowDate;
        if (bufferedLastProcessedAt) return bufferedLastProcessedAt;
        return new Date(Date.now() - DEFAULT_ITEM_LOOKBACK_MS);
      }

      if (bufferedLastProcessedAt && startFromNowDate) {
        return bufferedLastProcessedAt > startFromNowDate ? bufferedLastProcessedAt : startFromNowDate;
      }
      if (bufferedLastProcessedAt) return bufferedLastProcessedAt;
      if (startFromNowDate) return startFromNowDate;
      return new Date(Date.now() - DEFAULT_ITEM_LOOKBACK_MS);
    })();

    const newItems = parsed.items
      .filter((item) => item.pubDate > effectiveCutoffDate)
      .filter((item) => !maxItemAgeCutoffDate || item.pubDate >= maxItemAgeCutoffDate);
    const orderedNewItems = [...newItems].sort((a, b) =>
      normalizeTrickle(feed.trickle) === 'oldest_first'
        ? a.pubDate.getTime() - b.pubDate.getTime()
        : b.pubDate.getTime() - a.pubDate.getTime()
    );
    const manualLatestSelection = options.manualRun;
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
    const recentTopicFingerprints = recentActivities
      .filter((activity) => activity.status === 'pending' || activity.status === 'published')
      .filter((activity) => Date.now() - new Date(activity.timestamp).getTime() <= RSS_TOPIC_DEDUPE_LOOKBACK_MS)
      .map((activity) => buildRSSTopicFingerprint(activity.title))
      .filter((fingerprint) => fingerprint.signature);
    const getCrossSourceTopicDuplicateReason = (item: RSSItem): string | null => {
      const itemFingerprint = buildRSSTopicFingerprint(item.title);
      if (!itemFingerprint.signature) {
        return null;
      }
      const matchesRecentTopic = recentTopicFingerprints.some((fingerprint) =>
        areRSSTopicFingerprintsSimilar(itemFingerprint, fingerprint)
      );
      if (!matchesRecentTopic) {
        return null;
      }
      return 'Filtered as a duplicate topic that was already queued or published recently from another source.';
    };
    const rememberRecentTopic = (item: RSSItem): void => {
      const fingerprint = buildRSSTopicFingerprint(item.title);
      if (fingerprint.signature) {
        recentTopicFingerprints.push(fingerprint);
      }
    };
    const selectionMode = manualLatestSelection ? 'latest_item' : 'backlog';

    const platforms = getEnabledPlatforms(feed.platformsEnabled as Record<string, boolean> | null);
    const imagePlan = getRSSPublishImagePlan(feed, platforms);
    const support = await getRSSFeedColumnSupport();
    const pendingQueueRecords = support.feedItemsTable
      ? await prisma.rSSFeedItem.findMany({
          where: {
            feedId: feed.id,
            status: 'pending',
          },
          orderBy: { firstSeenAt: 'asc' },
        })
      : [];
    const pendingQueue = pendingQueueRecords
      .map((record) => ({
        record,
        item: deserializeRSSItem(record.itemData),
      }))
      .filter((entry): entry is typeof entry & { item: RSSItem } => Boolean(entry.item));
    const stalePendingQueue = pendingQueue
      .map((entry) => ({
        entry,
        reason: getPendingQueueSkipReason(entry.item, {
          startFromNowDate: feedFilters.onlyFetchNewItems ? startFromNowDate : null,
          maxItemAgeCutoffDate,
        }),
      }))
      .filter((entry): entry is typeof entry & { reason: string } => Boolean(entry.reason));

    if (support.feedItemsTable && stalePendingQueue.length > 0) {
      for (const staleEntry of stalePendingQueue) {
        await prisma.rSSFeedItem.update({
          where: { id: staleEntry.entry.record.id },
          data: {
            status: 'filtered',
            lastAttemptedAt: new Date(),
            errorMessage: staleEntry.reason,
          },
        });
      }
    }

    const stalePendingIds = new Set(stalePendingQueue.map((entry) => entry.entry.record.id));
    const activePendingQueue = stalePendingIds.size > 0
      ? pendingQueue.filter((entry) => !stalePendingIds.has(entry.record.id))
      : pendingQueue;
    const activePendingQueueRecords = activePendingQueue.map((entry) => entry.record);
    const feedRecentActivities = recentActivities
      .filter((activity) => activity.feedId === feed.id);
    const manualSelectionCandidates = manualLatestSelection
      ? [...parsed.items]
          .filter((item) => !maxItemAgeCutoffDate || item.pubDate >= maxItemAgeCutoffDate)
          .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
      : [];
    const incomingDedupeKeys = Array.from(new Set(
      (manualLatestSelection ? manualSelectionCandidates : orderedNewItems).map((item) => getRSSItemDedupeKey(item))
    ));
    const knownFeedItems = support.feedItemsTable && incomingDedupeKeys.length > 0
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
    const processedKeys = new Set<string>([
      ...activePendingQueueRecords.map((record) => record.dedupeKey),
      ...knownFeedItems.map((record) => record.dedupeKey),
      ...feedRecentActivities.map((activity) => getRSSActivityDedupeKey(activity)),
    ]);
    const manualRunBlockedKeys = new Set<string>([
      ...activePendingQueueRecords.map((record) => record.dedupeKey),
      ...knownFeedItems
        .filter((record) => record.status === 'pending' || record.status === 'published')
        .map((record) => record.dedupeKey),
      ...feedRecentActivities
        .filter((activity) => activity.status === 'pending' || activity.status === 'published')
        .map((activity) => getRSSActivityDedupeKey(activity)),
    ]);
    const latestEligibleItem = manualLatestSelection
      ? manualSelectionCandidates
          .find((item) => {
            const dedupeKey = getRSSItemDedupeKey(item);
            return !manualRunBlockedKeys.has(dedupeKey)
              && !getCrossSourceTopicDuplicateReason(item)
              && evaluateFeedRules(item, feedFilters).allowed;
          })
      : undefined;
    const itemsToProcess = manualLatestSelection
      ? latestEligibleItem ? [latestEligibleItem] : []
      : orderedNewItems;
    const seenKeys = manualLatestSelection ? manualRunBlockedKeys : processedKeys;
    let publishedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let latestHandledItem: RSSItem | undefined;
    let latestPublishedItem: RSSItem | undefined;
    let latestCaption: string | null = null;
    let latestPublishedImageUrl: string | undefined;

    for (const pendingEntry of activePendingQueue) {
      const item = pendingEntry.item;
      latestHandledItem = item;

      const pendingRuleEvaluation = evaluateFeedRules(item, feedFilters);
      if (!pendingRuleEvaluation.allowed) {
        if (support.feedItemsTable) {
          await prisma.rSSFeedItem.update({
            where: { id: pendingEntry.record.id },
            data: {
              status: 'filtered',
              lastAttemptedAt: new Date(),
              errorMessage: pendingRuleEvaluation.reason ?? 'Filtered by current feed rules.',
              itemData: serializeRSSItem(item),
            },
          });
        }
        continue;
      }

      if (!runtimeSettings.globalRSSPosting || !feed.autoPost || platforms.length === 0) {
        pendingCount += 1;
        rememberRecentTopic(item);
        continue;
      }

      const blockReason = await getPublishingBlockReason(platforms, runtimeSettings);
      if (blockReason) {
        pendingCount += 1;
        continue;
      }

      const publishAttempt = await attemptRSSPublish(feed as any, item, platforms, imagePlan, runtimeSettings);
      const resolvedActivityItem = applyResolvedImagesToRSSItem(item, publishAttempt.resolvedImages);
      resolvedActivityItem.generatedCaption = publishAttempt.caption;
      resolvedActivityItem.platformPostIds = publishAttempt.platformPostIds;
      resolvedActivityItem.platformResults = publishAttempt.platformResults;

      if (publishAttempt.status === 'published') {
        publishedCount += 1;
        latestPublishedItem = resolvedActivityItem;
        latestCaption = publishAttempt.caption;
        latestPublishedImageUrl = publishAttempt.imageUrl;
        rememberRecentTopic(item);
        if (support.feedItemsTable) {
          await prisma.rSSFeedItem.update({
            where: { id: pendingEntry.record.id },
            data: {
              status: 'published',
              lastAttemptedAt: new Date(),
              publishedAt: item.pubDate,
              errorMessage: null,
              itemData: serializeRSSItem(resolvedActivityItem),
            },
          });
        }
        const publishedMetadata: RSSActivityMetadata = {
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          imageUrl: publishAttempt.imageUrl,
          imageUrls: publishAttempt.imageUrls,
          imageSource: resolvedActivityItem.imageSource,
          imageReason: resolvedActivityItem.imageReason,
          imageScore: resolvedActivityItem.imageScore,
          imageSelectionConfidence: resolvedActivityItem.imageSelectionConfidence,
          selectedImages: resolvedActivityItem.selectedImages,
          publishedAt: item.pubDate.toISOString(),
          status: 'published',
          platforms: publishAttempt.successfulPlatforms,
          platformPostIds: publishAttempt.platformPostIds,
          platformResults: publishAttempt.platformResults,
          errorMessage: publishAttempt.errorMessage,
        };
        await logRSSActivity(publishedMetadata);
        rememberRSSActivity(recentActivities, publishedMetadata);
        continue;
      }

      if (publishAttempt.status === 'pending') {
        pendingCount += 1;
        if (support.feedItemsTable) {
          await prisma.rSSFeedItem.update({
            where: { id: pendingEntry.record.id },
            data: {
              status: 'pending',
              lastAttemptedAt: new Date(),
              errorMessage: publishAttempt.errorMessage,
              itemData: serializeRSSItem(resolvedActivityItem),
            },
          });
        }
        const pendingMetadata: RSSActivityMetadata = {
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          imageUrl: publishAttempt.imageUrl,
          imageUrls: publishAttempt.imageUrls,
          imageSource: resolvedActivityItem.imageSource,
          imageReason: resolvedActivityItem.imageReason,
          imageScore: resolvedActivityItem.imageScore,
          imageSelectionConfidence: resolvedActivityItem.imageSelectionConfidence,
          selectedImages: resolvedActivityItem.selectedImages,
          publishedAt: item.pubDate.toISOString(),
          status: 'pending',
          platforms: publishAttempt.remainingPlatforms,
          platformPostIds: publishAttempt.platformPostIds,
          platformResults: publishAttempt.platformResults,
          errorMessage: publishAttempt.errorMessage,
        };
        await logRSSActivity(pendingMetadata);
        rememberRSSActivity(recentActivities, pendingMetadata);
        continue;
      }

      failedCount += 1;
      if (support.feedItemsTable) {
        await prisma.rSSFeedItem.update({
          where: { id: pendingEntry.record.id },
          data: {
            status: 'failed',
            lastAttemptedAt: new Date(),
            errorMessage: publishAttempt.errorMessage,
            itemData: serializeRSSItem(resolvedActivityItem),
          },
        });
      }
      const failedMetadata: RSSActivityMetadata = {
        category: RSS_ACTIVITY_CATEGORY,
        feedId: feed.id,
        feedName: feed.name,
        itemTitle: item.title,
        itemLink: item.link,
        description: item.description,
        imageUrl: publishAttempt.imageUrl,
        imageUrls: publishAttempt.imageUrls,
        imageSource: resolvedActivityItem.imageSource,
        imageReason: resolvedActivityItem.imageReason,
        imageScore: resolvedActivityItem.imageScore,
        imageSelectionConfidence: resolvedActivityItem.imageSelectionConfidence,
        selectedImages: resolvedActivityItem.selectedImages,
        publishedAt: item.pubDate.toISOString(),
        status: 'failed',
        platforms,
        platformPostIds: publishAttempt.platformPostIds,
        platformResults: publishAttempt.platformResults,
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

      const topicDuplicateReason = getCrossSourceTopicDuplicateReason(item);
      if (topicDuplicateReason) {
        await upsertRSSFeedItem(feed.id, item, 'filtered', {
          errorMessage: topicDuplicateReason,
          firstSeenAt: item.pubDate,
        });
        seenKeys.add(dedupeKey);
        continue;
      }

      if (!runtimeSettings.globalRSSPosting || !feed.autoPost || platforms.length === 0) {
        pendingCount += 1;
        const pendingImageUrls = dedupeUrls([...(item.imageUrls || []), item.imageUrl]);
        const pendingMetadata: RSSActivityMetadata = {
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          imageUrl: pendingImageUrls[0],
          imageUrls: pendingImageUrls,
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
        rememberRecentTopic(item);
        if (!hasRecentRSSActivity(recentActivities, feed.id, item, ['pending'])) {
          await logRSSActivity(pendingMetadata);
          rememberRSSActivity(recentActivities, pendingMetadata);
        }
        continue;
      }

      const blockReason = await getPublishingBlockReason(platforms, runtimeSettings);
      if (blockReason) {
        pendingCount += 1;
        const pendingImageUrls = dedupeUrls([...(item.imageUrls || []), item.imageUrl]);
        const pendingMetadata: RSSActivityMetadata = {
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          imageUrl: pendingImageUrls[0],
          imageUrls: pendingImageUrls,
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
        rememberRecentTopic(item);
        if (!hasRecentRSSActivity(recentActivities, feed.id, item, ['pending'])) {
          await logRSSActivity(pendingMetadata);
          rememberRSSActivity(recentActivities, pendingMetadata);
        }
        continue;
      }

      const publishAttempt = await attemptRSSPublish(feed as any, item, platforms, imagePlan, runtimeSettings);
      seenKeys.add(dedupeKey);
      const resolvedActivityItem = applyResolvedImagesToRSSItem(item, publishAttempt.resolvedImages);
      resolvedActivityItem.generatedCaption = publishAttempt.caption;
      resolvedActivityItem.platformPostIds = publishAttempt.platformPostIds;
      resolvedActivityItem.platformResults = publishAttempt.platformResults;

      if (publishAttempt.status === 'published') {
        publishedCount += 1;
        latestPublishedItem = resolvedActivityItem;
        latestCaption = publishAttempt.caption;
        latestPublishedImageUrl = publishAttempt.imageUrl;
        rememberRecentTopic(item);
        await upsertRSSFeedItem(feed.id, resolvedActivityItem, 'published', {
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
          imageUrls: publishAttempt.imageUrls,
          imageSource: resolvedActivityItem.imageSource,
          imageReason: resolvedActivityItem.imageReason,
          imageScore: resolvedActivityItem.imageScore,
          imageSelectionConfidence: resolvedActivityItem.imageSelectionConfidence,
          selectedImages: resolvedActivityItem.selectedImages,
          publishedAt: item.pubDate.toISOString(),
          status: 'published',
          platforms: publishAttempt.successfulPlatforms,
          platformPostIds: publishAttempt.platformPostIds,
          platformResults: publishAttempt.platformResults,
          errorMessage: publishAttempt.errorMessage,
        };
        await logRSSActivity(publishedMetadata);
        rememberRSSActivity(recentActivities, publishedMetadata);
        continue;
      }

      if (publishAttempt.status === 'pending') {
        pendingCount += 1;
        await upsertRSSFeedItem(feed.id, resolvedActivityItem, 'pending', {
          errorMessage: publishAttempt.errorMessage,
          firstSeenAt: item.pubDate,
        });
        const pendingMetadata: RSSActivityMetadata = {
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          imageUrl: publishAttempt.imageUrl,
          imageUrls: publishAttempt.imageUrls,
          imageSource: resolvedActivityItem.imageSource,
          imageReason: resolvedActivityItem.imageReason,
          imageScore: resolvedActivityItem.imageScore,
          imageSelectionConfidence: resolvedActivityItem.imageSelectionConfidence,
          selectedImages: resolvedActivityItem.selectedImages,
          publishedAt: item.pubDate.toISOString(),
          status: 'pending',
          platforms: publishAttempt.remainingPlatforms,
          platformPostIds: publishAttempt.platformPostIds,
          platformResults: publishAttempt.platformResults,
          errorMessage: publishAttempt.errorMessage,
        };
        await logRSSActivity(pendingMetadata);
        rememberRSSActivity(recentActivities, pendingMetadata);
        continue;
      }

      failedCount += 1;
      await upsertRSSFeedItem(feed.id, resolvedActivityItem, 'failed', {
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
        imageUrls: publishAttempt.imageUrls,
        imageSource: resolvedActivityItem.imageSource,
        imageReason: resolvedActivityItem.imageReason,
        imageScore: resolvedActivityItem.imageScore,
        imageSelectionConfidence: resolvedActivityItem.imageSelectionConfidence,
        selectedImages: resolvedActivityItem.selectedImages,
        publishedAt: item.pubDate.toISOString(),
        status: 'failed',
        platforms,
        platformPostIds: publishAttempt.platformPostIds,
        platformResults: publishAttempt.platformResults,
        errorMessage: publishAttempt.errorMessage,
      };
      await logRSSActivity(failedMetadata);
      rememberRSSActivity(recentActivities, failedMetadata);
    }

    await updateFeed(id, {
      status: 'active',
      lastProcessedAt: new Date(),
      nextRunAt,
      errorMessage: null,
    });

    await persistFeedSnapshot(feed.id, latestHandledItem || parsed.items[0], latestCaption, platforms, latestPublishedImageUrl);

    return {
      feedId: feed.id,
      feedName: feed.name,
      itemsAdded: publishedCount,
      checkedCount: itemsToProcess.length,
      pendingCount,
      failedCount,
      latestItemTitle: latestPublishedItem?.title || latestHandledItem?.title || parsed.items[0]?.title,
      selectionMode,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await updateFeed(id, {
      status: 'error',
      errorMessage,
      nextRunAt,
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

async function refreshFeed(id: string, options: RefreshFeedOptions = {}): Promise<RefreshResult> {
  const activeRefresh = activeRSSFeedRefreshes.get(id);
  if (activeRefresh) {
    return activeRefresh;
  }

  const refreshPromise = runRefreshFeed(id, options).finally(() => {
    const currentRefresh = activeRSSFeedRefreshes.get(id);
    if (currentRefresh === refreshPromise) {
      activeRSSFeedRefreshes.delete(id);
    }
  });
  activeRSSFeedRefreshes.set(id, refreshPromise);
  return refreshPromise;
}

async function runRefreshAllFeeds(checkSchedule: boolean = false): Promise<{
  total: number;
  success: number;
  failed: number;
  isScheduledRun: boolean;
  results: RefreshResult[];
}> {
  const where: Prisma.RSSFeedWhereInput = {
    enabled: true,
    status: { not: 'paused' },
  };

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

async function refreshAllFeeds(checkSchedule: boolean = false): Promise<{
  total: number;
  success: number;
  failed: number;
  isScheduledRun: boolean;
  results: RefreshResult[];
}> {
  if (!checkSchedule) {
    return runRefreshAllFeeds(false);
  }

  if (activeScheduledRSSRefresh) {
    return activeScheduledRSSRefresh;
  }

  const scheduledRefreshPromise = runRefreshAllFeeds(true).finally(() => {
    if (activeScheduledRSSRefresh === scheduledRefreshPromise) {
      activeScheduledRSSRefresh = null;
    }
  });
  activeScheduledRSSRefresh = scheduledRefreshPromise;
  return scheduledRefreshPromise;
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
    imagePlan.maxImageCount
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
      summary: sanitizeRSSPlainText(previewItem.description),
      platform: 'X',
    },
    normalizeAIModel(runtimeSettings.rssCaptionModel),
    systemPrompt,
    runtimeSettings.rssCaptionTemperature
  );
  const sanitizedCaption = sanitizeRSSCaptionText(caption, runtimeSettings.rssCaptionMaxLength);

  return {
    title: previewItem.title,
    link: previewItem.link,
    pubDate: previewItem.pubDate.toISOString(),
    snippet: sanitizeRSSPlainText(previewItem.description),
    images: resolvedImages.map((image) => ({
      url: image.url,
      reason: image.reason,
    })),
    caption: sanitizedCaption,
    captionCharCount: sanitizedCaption.length,
  };
}

async function getRSSActivity(limit: number = 100): Promise<{ items: RSSActivityItem[]; summary: RSSActivitySummary }> {
  const logs = await prisma.log.findMany({
    where: { service: 'rss' },
    orderBy: { timestamp: 'desc' },
    take: Math.max(limit * 5, 200),
  });

  const logItems = logs
    .map((log) => parseRSSActivityLog(log))
    .filter((item): item is RSSActivityItem => Boolean(item));

  const support = await getRSSFeedColumnSupport();
  if (support.feedItemsTable) {
    const records = await prisma.rSSFeedItem.findMany({
      orderBy: [
        { publishedAt: 'desc' },
        { firstSeenAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      include: {
        feed: {
          select: {
            id: true,
            name: true,
            platformsEnabled: true,
          },
        },
      },
    });

    const recordItems = records.map((record) => buildRSSActivityItemFromFeedRecord(record));
    const items = mergeRSSActivityItems(recordItems, logItems, limit);
    return {
      items,
      summary: buildActivitySummary(items),
    };
  }

  return {
    items: logItems.slice(0, limit),
    summary: buildActivitySummary(logItems.slice(0, limit)),
  };
}

async function deleteRSSActivity(id: string): Promise<void> {
  const support = await getRSSFeedColumnSupport();
  if (support.feedItemsTable) {
    try {
      await prisma.rSSFeedItem.delete({
        where: { id },
      });
      return;
    } catch (error) {
      // Fall through to legacy log deletion for old activity rows.
    }
  }

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
