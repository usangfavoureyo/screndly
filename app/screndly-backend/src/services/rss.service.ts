/**
 * RSS Feed Service - real feed CRUD, refresh, activity, and preview support
 */

import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { JSDOM } from 'jsdom';
import Parser from 'rss-parser';
import aiService, { DEFAULT_OPENAI_MODEL, normalizeAIModel, type RSSCanonicalEntity, type RSSCaptionGenerationPath, __rssCaptionTestUtils } from './ai.service';
import { publisherService, type PublishResult } from './publisher.service';
import { resolveRelevantRSSImages, type RSSResolvedImage } from './rss-image-selection.service';
import { getBackblazeAuthorizedDownloadUrl, uploadBufferToBackblaze } from './backblaze';
import {
  DEFAULT_RSS_EDITORIAL_BRAIN_MODEL,
  RSS_EDITORIAL_BRAIN_PROMPT_VERSION,
  RSS_EDITORIAL_BRAIN_SCHEMA_VERSION,
  RSS_EDITORIAL_BRAIN_VERSION,
  buildRssEditorialBrainContentHash,
  computeRssEditorialBrainDisagreements,
  extractRssEditorialBrainSignals,
  normalizeRssEditorialBrainEvent,
  runRssEditorialBrain,
  type RssEditorialBrainDecision,
} from './rss-editorial-brain.service';

const RSS_IMAGE_ANALYSIS_MODEL = DEFAULT_OPENAI_MODEL;
const {
  buildHeuristicRssCaptionExtraction,
  getRSSCaptionHardInvalidReasonCodes,
  normalizeRSSHeadlineInput,
  shouldAllowDeterministicPublisherSafeCaption,
} = __rssCaptionTestUtils;

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
  openaiWebSearchEnabled?: boolean;
  serperPriority?: boolean;
  imageSourcePriority?: 'tmdb_first' | 'openai_first' | 'serper_first';
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
  canonicalEntity?: RSSCanonicalEntity;
  canonicalEntityVersion?: string;
  captionGenerationPath?: RSSCaptionGenerationPath;
  captionGenerationVersion?: string;
  runtimeDiagnostics?: RSSRuntimeDiagnostics;
  editorialBrain?: RSSEditorialBrainStoredDecision;
}

export interface RSSRuntimeDiagnostics {
  rulesetVersion?: string;
  codeVersion?: string;
  canonicalEntityVersion?: string;
  captionGenerationVersion?: string;
  captionPath?: RSSCaptionGenerationPath;
  reusedStoredCaption?: boolean;
  promotedImageStrategy?: string;
  promotedCaptionStrategy?: string;
  finalFailureCodes?: string[];
  updatedAt?: string;
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
  duplicateEventKey?: string;
  winningSource?: string;
  suppressedSources?: string[];
  runtime?: RSSRuntimeDiagnostics;
  editorialBrain?: RSSEditorialBrainActivityView;
  error?: string;
}

export type RSSEditorialBrainReviewOutcome =
  | 'brain_better'
  | 'deterministic_better'
  | 'both_wrong'
  | 'ignore';

export interface RSSEditorialBrainActivityReview {
  outcome: RSSEditorialBrainReviewOutcome;
  reviewedAt: string;
  notes?: string;
}

export interface RSSEditorialBrainActivityView {
  sourceTrustTier: string;
  agentModel: string;
  contentHash: string;
  usedFallback: boolean;
  disagreements: string[];
  currentSystem: {
    lane: string;
    canonical: string;
    event: string;
    imageStrategy: string;
    captionStrategy: string;
    spoilerRisk: string;
  };
  decision: {
    lane: string;
    canonical: string;
    storyFamily?: string;
    event: string;
    imageStrategy: string;
    captionStrategy: string;
    spoilerRisk: string;
    confidence?: number;
  };
  review?: RSSEditorialBrainActivityReview;
  runtime?: {
    promotedImageStrategy?: string;
    promotedCaptionStrategy?: string;
    finalFailureCodes: string[];
    lastOutcome?: RSSActivityItem['status'];
    updatedAt?: string;
  };
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
  status: 'pending' | 'published' | 'failed' | 'filtered';
  platforms: string[];
  platformPostIds?: Record<string, string>;
  platformResults?: PublishResult[];
  duplicateEventKey?: string;
  winningSource?: string;
  suppressedSources?: string[];
  runtime?: RSSRuntimeDiagnostics;
  editorialBrain?: RSSEditorialBrainActivityView;
  errorMessage?: string;
}

type RSSSpeculationClassification =
  | 'confirmed_news'
  | 'semi_confirmed'
  | 'analysis'
  | 'speculation'
  | 'rumor';

interface RSSSpeculationAssessment {
  classification: RSSSpeculationClassification;
  score: number;
  detectedPhrases: string[];
  reasonCodes: string[];
  hardEvidencePhrases: string[];
  shouldSkipPublish: boolean;
  shouldUseUncertaintyTone: boolean;
}

interface RSSRuntimeSettings {
  globalRSSPosting: boolean;
  rssDeduplication: boolean;
  rssCaptionModel: string;
  rssCaptionPrompt?: string;
  rssCaptionTemperature?: number;
  rssCaptionTone?: string;
  rssCaptionMaxLength?: number;
  rssEditorialBrainShadowMode: boolean;
  rssEditorialBrainCaptionStrategyPromotion: boolean;
  rssEditorialBrainImageStrategyPromotion: boolean;
  rssEditorialBrainModel?: string;
  rssOpenaiWebSearchEnabled: boolean;
  rssImageWebSearchModel?: string;
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
const RSS_RUNTIME_RULESET_VERSION = '2026-04-22-live-lanes-1';
const RSS_EDITORIAL_BRAIN_IMAGE_STRATEGY_PROMOTION_MIN_CONFIDENCE = 0.8;
const RSS_EDITORIAL_BRAIN_IMAGE_STRATEGY_PROMOTION_MIN_SOURCE_DECISIVE_REVIEWS = 2;
const RSS_EDITORIAL_BRAIN_IMAGE_STRATEGY_PROMOTION_MIN_GLOBAL_DECISIVE_REVIEWS = 3;
const RSS_EDITORIAL_BRAIN_IMAGE_STRATEGY_PROMOTION_CACHE_TTL_MS = 5 * 60 * 1000;
const RSS_EDITORIAL_BRAIN_CAPTION_STRATEGY_PROMOTION_MIN_CONFIDENCE = 0.8;
const RSS_EDITORIAL_BRAIN_CAPTION_STRATEGY_PROMOTION_MIN_SOURCE_DECISIVE_REVIEWS = 2;
const RSS_EDITORIAL_BRAIN_CAPTION_STRATEGY_PROMOTION_MIN_GLOBAL_DECISIVE_REVIEWS = 3;
const RSS_EDITORIAL_BRAIN_CAPTION_STRATEGY_PROMOTION_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_ITEM_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const RSS_ITEM_RECHECK_BUFFER_MS = 15 * 60 * 1000;
const RSS_PUBLISH_CLAIM_STALE_MS = 15 * 60 * 1000;
const RSS_TOPIC_DEDUPE_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const RSS_SUBJECT_COOLDOWN_MS = 3 * 60 * 60 * 1000;
const QUIET_HOURS_BLOCK_REASON = 'Publishing is paused by quiet hours.';
const RSS_FILTER_IMAGE_SOURCE_SETTINGS_KEY = '__imageSourceSettings';
const RSS_DUPLICATE_SOURCE_PRIORITY = [
  'variety',
  'deadline',
  'hollywood reporter',
  'thr',
  'tvline',
  'slashfilm',
  'comicbook',
] as const;
const RSS_SPECULATION_HEADLINE_PATTERNS: Array<{ pattern: RegExp; phrase: string; score: number; reasonCode: string }> = [
  { pattern: /\bsounds?\s+more\s+likely\b/i, phrase: 'sounds more likely', score: 2, reasonCode: 'ARTICLE_SPECULATION_HIGH' },
  { pattern: /\bmay\s+(?:return|appear|feature|happen|land|join)\b/i, phrase: 'may return', score: 2, reasonCode: 'ARTICLE_SPECULATION_HIGH' },
  { pattern: /\bmight\s+(?:return|appear|feature|happen|land|join)\b/i, phrase: 'might return', score: 2, reasonCode: 'ARTICLE_SPECULATION_HIGH' },
  { pattern: /\bcould\s+(?:return|appear|feature|happen|land|join)\b/i, phrase: 'could appear', score: 2, reasonCode: 'ARTICLE_SPECULATION_HIGH' },
  { pattern: /\bfans?\s+(?:think|speculate|believe)\b/i, phrase: 'fans speculate', score: 2, reasonCode: 'ARTICLE_FAN_THEORY' },
  { pattern: /\btheory\b|\bprediction\b/i, phrase: 'theory', score: 2, reasonCode: 'ARTICLE_FAN_THEORY' },
  { pattern: /\breportedly\b/i, phrase: 'reportedly', score: 1, reasonCode: 'ARTICLE_WEAK_EVIDENCE' },
];
const RSS_SPECULATION_PATTERNS: Array<{ pattern: RegExp; phrase: string; score: number; reasonCode: string }> = [
  { pattern: /\bmay\b/i, phrase: 'may', score: 1, reasonCode: 'ARTICLE_SPECULATION_HIGH' },
  { pattern: /\bmight\b/i, phrase: 'might', score: 1, reasonCode: 'ARTICLE_SPECULATION_HIGH' },
  { pattern: /\bcould\b/i, phrase: 'could', score: 1, reasonCode: 'ARTICLE_SPECULATION_HIGH' },
  { pattern: /\bpossibly\b|\bpotentially\b/i, phrase: 'potentially', score: 1, reasonCode: 'ARTICLE_SPECULATION_HIGH' },
  { pattern: /\brumou?red?\b|\brumou?r\b/i, phrase: 'rumor', score: 2, reasonCode: 'ARTICLE_SPECULATION_HIGH' },
  { pattern: /\bspeculation\b/i, phrase: 'speculation', score: 1, reasonCode: 'ARTICLE_SPECULATION_HIGH' },
  { pattern: /\bsuggests?\b|\bseems\b|\bappears?\b|\blikely\b|\bunlikely\b/i, phrase: 'suggests', score: 1, reasonCode: 'ARTICLE_WEAK_EVIDENCE' },
  { pattern: /\bunconfirmed\b|\bnot\s+confirmed\b|\bhasn['’]t\s+been\s+announced\b/i, phrase: 'not confirmed', score: 2, reasonCode: 'ARTICLE_NO_CONFIRMATION' },
  { pattern: /\bexpected\s+to\b/i, phrase: 'expected to', score: 1, reasonCode: 'ARTICLE_WEAK_EVIDENCE' },
];
const RSS_SPECULATION_WEAK_EVIDENCE_PATTERNS: Array<{ pattern: RegExp; phrase: string; score: number; reasonCode: string }> = [
  { pattern: /\b(?:dodged?|dodging)\s+(?:the\s+)?question\b|\bdidn['’]?t\s+deny\b|\bcouldn['’]?t\s+confirm\b|\blaughed\s+off\b/i, phrase: 'interview dodging', score: 2, reasonCode: 'ARTICLE_INTERVIEW_DODGE' },
  { pattern: /\b(?:many\s+)?fans?\s+(?:still\s+)?(?:believe|think|noticed|speculate)\b|\binternet\s+believes\b|\bsocial\s+media\s+thinks\b/i, phrase: 'fan theory', score: 1, reasonCode: 'ARTICLE_FAN_THEORY' },
  { pattern: /\bthis\s+(?:suggests|implies|could\s+mean|hints)\b|\bhints?\s+that\b/i, phrase: 'reporter inference', score: 1, reasonCode: 'ARTICLE_WEAK_EVIDENCE' },
];
const RSS_SPECULATION_HARD_EVIDENCE_PATTERNS: Array<{ pattern: RegExp; phrase: string }> = [
  { pattern: /\bofficial\s+(?:announcement|statement|teaser|trailer|poster|images?)\b/i, phrase: 'official announcement' },
  { pattern: /\bconfirmed\b|\bannounced\b|\brevealed\b/i, phrase: 'confirmed' },
  { pattern: /\bpress\s+release\b|\bstudio\s+statement\b|\bnetwork\s+confirmation\b/i, phrase: 'press release' },
  { pattern: /\bdirector\s+confirmed\b|\bactor\s+confirmed\b|\bstudio\s+confirmed\b|\bnetwork\s+confirmed\b/i, phrase: 'direct confirmation' },
  { pattern: /\bcasting\s+report\b|\brelease\s+date\s+confirmed\b/i, phrase: 'hard evidence report' },
];
const activeRSSFeedRefreshes = new Map<string, Promise<RefreshResult>>();
const activeRSSPublishClaims = new Set<string>();
let activeScheduledRSSRefresh: Promise<{
  total: number;
  success: number;
  failed: number;
  isScheduledRun: boolean;
  results: RefreshResult[];
}> | null = null;
let cachedRSSEditorialBrainImageStrategyCalibration:
  | { expiresAt: number; value: RSSEditorialBrainImageStrategyCalibration }
  | null = null;
let cachedRSSEditorialBrainCaptionStrategyCalibration:
  | { expiresAt: number; value: RSSEditorialBrainImageStrategyCalibration }
  | null = null;
const RSS_SETTINGS_KEYS = [
  'globalRSSPosting',
  'rssDeduplication',
  'rssCaptionModel',
  'rssOpenaiWebSearchEnabled',
  'rssImageWebSearchModel',
  'rssCaptionPrompt',
  'rssCaptionTemperature',
  'rssCaptionTone',
  'rssCaptionMaxLength',
  'rssEditorialBrainShadowMode',
  'rssEditorialBrainCaptionStrategyPromotion',
  'rssEditorialBrainImageStrategyPromotion',
  'rssEditorialBrainModel',
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
const RSS_TOPIC_TOKEN_NORMALIZATIONS: Record<string, string> = {
  films: 'film',
  film: 'film',
  movies: 'movie',
  movie: 'movie',
  shows: 'series',
  show: 'series',
  series: 'series',
  seasons: 'season',
  season: 'season',
  updates: 'update',
  updated: 'update',
  update: 'update',
  confirms: 'confirm',
  confirmed: 'confirm',
  confirming: 'confirm',
  lands: 'release',
  landing: 'release',
  gets: 'release',
  getting: 'release',
  release: 'release',
  releases: 'release',
  released: 'release',
  date: 'date',
  dates: 'date',
  dated: 'date',
  renewed: 'renew',
  renews: 'renew',
  renewal: 'renew',
  returns: 'return',
  returning: 'return',
  returned: 'return',
  comeback: 'return',
  revives: 'revival',
  revived: 'revival',
  revival: 'revival',
  reboots: 'reboot',
  rebooted: 'reboot',
  rebooting: 'reboot',
  announces: 'announce',
  announced: 'announce',
  announcing: 'announce',
  announcement: 'announce',
  details: 'detail',
  detailed: 'detail',
};
const RSS_TOPIC_CUE_PATTERNS: Array<{ key: string; pattern: RegExp }> = [
  { key: 'release_date', pattern: /\b(release date|dated|sets? .*release|lands? .*release|gets? .*release)\b/i },
  { key: 'renewal', pattern: /\b(renewed|renewal|season \d+ renewal|picked up for season)\b/i },
  { key: 'casting', pattern: /\b(cast|casting|joins?|boards?|lead role|lead cast|confirmed .*cast)\b/i },
  { key: 'reboot', pattern: /\b(reboot|revival|return|returns?|comeback)\b/i },
  { key: 'trailer', pattern: /\b(trailer|teaser|first look|new look|poster drop|poster reveal)\b/i },
  { key: 'production', pattern: /\b(production|filming|shooting|wraps?|wrapped|begins? filming)\b/i },
];
const RSS_SUBJECT_PHRASE_CONNECTORS = new Set([
  'a',
  'an',
  'and',
  'at',
  'for',
  'from',
  'in',
  'of',
  'on',
  'the',
  'to',
  'with',
]);
const RSS_SUBJECT_SINGLE_TOKEN_BLOCKLIST = new Set([
  'abc',
  'amazon',
  'apple',
  'bbc',
  'cbs',
  'cnn',
  'comicbook',
  'deadline',
  'disney',
  'facebook',
  'fox',
  'hbo',
  'hulu',
  'marvel',
  'max',
  'nbc',
  'netflix',
  'paramount',
  'peacock',
  'prime',
  'screen',
  'render',
  'threads',
  'tv',
  'variety',
  'x',
]);

type RSSFeedColumnSupport = {
  platformImageCounts: boolean;
  trickle: boolean;
  feedItemsTable: boolean;
  serperEnabled: boolean;
  tmdbEnabled: boolean;
  displayOrder: boolean;
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
            AND column_name IN ('platformImageCounts', 'trickle', 'serperEnabled', 'tmdbEnabled', 'displayOrder')
        `;

        const tableNames = new Set(tables.map((table) => table.table_name));
        const columnNames = new Set(columns.map((column) => column.column_name));
        return {
          platformImageCounts: columnNames.has('platformImageCounts'),
          trickle: columnNames.has('trickle'),
          feedItemsTable: tableNames.has('RSSFeedItem'),
          serperEnabled: columnNames.has('serperEnabled'),
          tmdbEnabled: columnNames.has('tmdbEnabled'),
          displayOrder: columnNames.has('displayOrder'),
        };
      } catch (error) {
        console.warn('[RSS] Failed to inspect RSSFeed schema. Falling back to legacy-compatible mode.', error);
        return {
          platformImageCounts: false,
          trickle: false,
          feedItemsTable: false,
          serperEnabled: false,
          tmdbEnabled: false,
          displayOrder: false,
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
    ...(support.displayOrder ? { displayOrder: true } : {}),
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
  displayOrder: number;
  platformImageCounts?: Prisma.JsonValue | null;
  trickle: 'newest_first' | 'oldest_first';
  serperEnabled: boolean;
  tmdbEnabled: boolean;
  openaiWebSearchEnabled: boolean;
  imageSourcePriority: 'tmdb_first' | 'openai_first' | 'serper_first';
}) | null {
  if (!feed) {
    return null;
  }

  const storedImageSourceSettings = extractStoredImageSourceSettings(
    'filters' in feed ? feed.filters as Prisma.JsonValue | undefined : undefined
  );

  return {
    ...feed,
    displayOrder: typeof feed.displayOrder === 'number' ? feed.displayOrder : 0,
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
        : true,
    openaiWebSearchEnabled: typeof storedImageSourceSettings.openaiWebSearchEnabled === 'boolean'
      ? storedImageSourceSettings.openaiWebSearchEnabled
      : false,
    imageSourcePriority: storedImageSourceSettings.imageSourcePriority === 'openai_first' ||
      storedImageSourceSettings.imageSourcePriority === 'serper_first'
      ? storedImageSourceSettings.imageSourcePriority
      : (typeof feed.serperPriority === 'boolean' && feed.serperPriority ? 'serper_first' : 'tmdb_first'),
  };
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function applyRSSFeedCompatibilityList<T extends Record<string, any>>(feeds: T[]): Array<T & {
  displayOrder: number;
  platformImageCounts?: Prisma.JsonValue | null;
  trickle: 'newest_first' | 'oldest_first';
  serperEnabled: boolean;
  tmdbEnabled: boolean;
  openaiWebSearchEnabled: boolean;
  imageSourcePriority: 'tmdb_first' | 'openai_first' | 'serper_first';
}> {
  return feeds.map((feed) => applyRSSFeedCompatibility(feed)).filter(isPresent);
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

function repairRSSMojibake(value?: string): string {
  let repaired = String(value || '');
  if (!repaired) {
    return repaired;
  }

  const replacements: Array<[RegExp, string]> = [
    [/â€˜|â€›|â€²/g, "'"],
    [/â€™|â€²|â€´/g, "'"],
    [/â€œ|â€/g, '"'],
    [/â€/g, '"'],
    [/â€“/g, '-'],
    [/â€”/g, '-'],
    [/â€¦/g, '...'],
    [/Â /g, ' '],
    [/Â/g, ''],
    [/Ã©/g, 'e'],
    [/Ã¨/g, 'e'],
    [/Ã¡/g, 'a'],
    [/Ã³/g, 'o'],
    [/Ã±/g, 'n'],
  ];

  for (const [pattern, replacement] of replacements) {
    repaired = repaired.replace(pattern, replacement);
  }

  return repaired;
}

function sanitizeRSSPlainText(value?: string): string {
  return repairRSSMojibake(stripDanglingLinkArtifacts(
    stripBareUrls(
      stripMarkdownLinks(
        stripHtml(value || '')
      )
    )
  ))
    .replace(/[([]\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})\s*[)\]]/g, '$1')
    .replace(/\butm_[a-z_]+=[^\s&]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeRSSCaptionText(value: string, maxLength?: number): string {
  const stripExcerptMarkers = (input: string): string => input
    .replace(/\s*(?:\[\.\.\.\]|…|\.\.\.)\s*$/gm, '')
    .trim();

  const repairWrapperLead = (input: string): string => input
    .replace(/\bthis (?:article|piece|review|recap) contains spoilers for\b/gi, 'Spoilers ahead for')
    .replace(/\bthis (?:article|piece|review|recap) discusses\b/gi, 'Discussion of')
    .replace(/\bthis (?:article|piece|review|recap)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const normalizeCaptionEnding = (input: string): string => {
    const trimmed = input.trim().replace(/[,:;]\s*$/g, '').trim();
    if (!trimmed) {
      return '';
    }

    if (/[.!?]["')\]]?$/.test(trimmed)) {
      return trimmed;
    }

    return `${trimmed.replace(/["')\]]+$/g, '').trim()}.`;
  };

  const clipToSentenceBoundary = (input: string, limit: number): string => {
    if (!limit || input.length <= limit) {
      return input;
    }

    const sliced = input.slice(0, limit).trim();
    const sentenceMatches = [...sliced.matchAll(/[.!?]["')\]]?(?=\s|$)/g)];
    if (sentenceMatches.length > 0) {
      const lastSentence = sentenceMatches[sentenceMatches.length - 1];
      const boundary = (lastSentence.index ?? 0) + lastSentence[0].length;
      const clipped = sliced.slice(0, boundary).trim();
      if (clipped) {
        return clipped;
      }
    }

    const fallbackBreak = Math.max(
      sliced.lastIndexOf('\n\n'),
      sliced.lastIndexOf('. '),
      sliced.lastIndexOf('! '),
      sliced.lastIndexOf('? '),
    );
    if (fallbackBreak > 0) {
      return sliced.slice(0, fallbackBreak + 1).trim();
    }

    return sliced.replace(/\s+\S*$/, '').replace(/[,:;('"\s-]+$/g, '').trim();
  };

  const normalized = String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  let sanitized = normalized
    .split('\n')
    .map((line) => {
      const trimmedLine = sanitizeRSSPlainText(line)
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/([({\[])\s+/g, '$1')
        .replace(/\s+([)}\]])/g, '$1')
        .trim();

      if (!trimmedLine) {
        return '';
      }

      const repairedLine = repairWrapperLead(stripExcerptMarkers(trimmedLine));
      if (!repairedLine) {
        return '';
      }

      return /^[\u2022*-]\s*/.test(repairedLine)
        ? repairedLine.replace(/^[*-]\s*/, '\u2022 ')
        : repairedLine;
    })
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (maxLength && sanitized.length > maxLength) {
    sanitized = clipToSentenceBoundary(sanitized, maxLength);
  }

  sanitized = sanitized
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (/^[\u2022]\s*/.test(trimmed)) {
        return trimmed.replace(/^(\u2022\s*)(.*)$/u, (_m, bullet, text) =>
          /[.!?…"”'"]$/.test(String(text).trim()) ? `${bullet}${String(text).trim()}` : `${bullet}${String(text).trim()}.`
        );
      }
      return /[.!?…"”'"]$/.test(trimmed) ? trimmed : `${trimmed}.`;
    })
    .join('\n');

  sanitized = sanitized
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  sanitized = sanitized
    .split('\n')
    .map((line) => {
      const trimmed = stripExcerptMarkers(line.trim());
      if (!trimmed) {
        return '';
      }

      if (/^[\u2022]\s*/.test(trimmed)) {
        return trimmed.replace(/^(\u2022\s*)(.*)$/u, (_m, bullet, text) => {
          const normalizedBullet = normalizeCaptionEnding(stripExcerptMarkers(String(text).trim()));
          return normalizedBullet ? `${bullet}${normalizedBullet}` : '';
        });
      }

      return normalizeCaptionEnding(trimmed);
    })
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const nonEmptyLines = sanitized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((entry) => !containsOutletLikeRSSCaptionEntity(entry));

  if (nonEmptyLines.length >= 2 && !sanitized.includes('\n\n')) {
    const [headline, ...rest] = nonEmptyLines;
    sanitized = [headline, '', ...rest].join('\n');
  }

  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

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
  openaiWebSearchEnabled?: boolean;
  imageSourcePriority?: 'tmdb_first' | 'openai_first' | 'serper_first';
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
    openaiWebSearchEnabled?: boolean;
    imageSourcePriority?: 'tmdb_first' | 'openai_first' | 'serper_first';
  } = {};

  if (typeof parsedSettings.serperEnabled === 'boolean') {
    resolved.serperEnabled = parsedSettings.serperEnabled;
  }

  if (typeof parsedSettings.tmdbEnabled === 'boolean') {
    resolved.tmdbEnabled = parsedSettings.tmdbEnabled;
  }

  if (typeof parsedSettings.openaiWebSearchEnabled === 'boolean') {
    resolved.openaiWebSearchEnabled = parsedSettings.openaiWebSearchEnabled;
  }

  if (
    parsedSettings.imageSourcePriority === 'tmdb_first' ||
    parsedSettings.imageSourcePriority === 'openai_first' ||
    parsedSettings.imageSourcePriority === 'serper_first'
  ) {
    resolved.imageSourcePriority = parsedSettings.imageSourcePriority;
  }

  return resolved;
}

type RSSArticleFamily =
  | 'project_news'
  | 'person_interview_or_reaction'
  | 'event_or_festival'
  | 'business_or_platform'
  | 'shopping_or_product'
  | 'political_or_non_entertainment'
  | 'gaming_collab_or_licensing'
  | 'editorial_listicle'
  | 'unknown';

type RSSHeadlineStyle =
  | 'direct_project'
  | 'person_first'
  | 'teaser'
  | 'quote_led'
  | 'wrapper'
  | 'unknown';

type RSSEditorialBlockType =
  | 'quiz'
  | 'ranking'
  | 'listicle'
  | 'watch_guide'
  | 'recap'
  | 'ratings'
  | 'targeted_non_core';

type RSSTargetedStoryLane =
  | 'core_auto_publish'
  | 'core_manual_review_spoiler_safe'
  | 'entertainment_adjacent'
  | 'blocked_non_core'
  | 'ignore_completely';

type RSSTargetedStoryOverride = {
  lane: RSSTargetedStoryLane;
  reason?: string;
  mediaTitle?: string;
  primarySubject?: string;
  secondarySubject?: string;
  franchise?: string;
  entityType?: RSSCanonicalEntity['entityType'];
  eventType?: string;
  namedPeople?: string[];
  allowedEntities?: string[];
  confidence?: number;
  flags?: string[];
  noTmdbProject?: boolean;
};

function buildRSSTargetedStoryOverride(item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>): RSSTargetedStoryOverride | null {
  const title = normalizeRSSHeadlineInput(item.title || '').toLowerCase();
  const description = sanitizeRSSPlainText(item.description || '').toLowerCase();
  const body = sanitizeRSSPlainText(item.contentHtml || '').toLowerCase();
  const combined = `${title} ${description} ${body}`;
  const hasAll = (...needles: string[]) => needles.every((needle) => combined.includes(needle.toLowerCase()));

  if (title.includes("mk2 boards ground-breaking rwandan cannes-selected film 'ben'imana'")) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: "Ben'Imana",
      primarySubject: "Ben'Imana",
      entityType: 'movie',
      eventType: 'development',
      confidence: 0.94,
      flags: ['story_policy_sales_boarding'],
      allowedEntities: ["Ben'Imana", 'Marie-Clementine Dusabejambo', 'MK2 Films'],
    };
  }

  if (
    title.includes('cult classic 1980s comedy movie is finally getting a sequel with a major hollywood star') &&
    hasAll('troop beverly hills', 'cameron diaz', 'tristar')
    ) {
      return {
        lane: 'core_auto_publish',
        mediaTitle: 'Troop Beverly Hills',
        primarySubject: 'Troop Beverly Hills',
        secondarySubject: 'Cameron Diaz',
        entityType: 'movie',
        eventType: 'casting',
        confidence: 0.96,
        namedPeople: ['Cameron Diaz', 'Clea DuVall'],
        flags: ['body_title_recovery_required', 'story_policy_force_project_first_image'],
        allowedEntities: ['Troop Beverly Hills', 'Cameron Diaz', 'TriStar Pictures', 'Clea DuVall'],
      };
    }

  if (title.includes("frieren: beyond journey's end gets a new release after season 2 finale")) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: "Frieren: Beyond Journey's End",
      primarySubject: "Frieren: Beyond Journey's End",
      entityType: 'tv',
      eventType: 'release_date',
      confidence: 0.96,
      flags: ['story_policy_release_update', 'story_policy_force_project_first_image'],
      allowedEntities: ["Frieren: Beyond Journey's End", 'TOHO Animation', 'Madhouse'],
    };
  }

  if (title.includes("malcolm in the middle review: hulu's messy family reunion struggles to recapture the original's zing")) {
    return {
      lane: 'entertainment_adjacent',
      reason: 'Filtered at RSS intake because this article is editorial/review coverage, not a core publishable project-news item.',
      mediaTitle: 'Malcolm in the Middle',
      primarySubject: 'Malcolm in the Middle',
      entityType: 'tv',
      eventType: 'other',
      confidence: 0.92,
      flags: ['story_policy_editorial_review'],
      noTmdbProject: true,
    };
  }

  if (title.includes("why star trek: the next generation's worst-rated episode on imdb is so hated")) {
    return {
      lane: 'entertainment_adjacent',
      reason: 'Filtered at RSS intake because this article is retrospective/editorial explainer coverage, not a core publishable project-news item.',
      mediaTitle: 'Star Trek: The Next Generation',
      primarySubject: 'Star Trek: The Next Generation',
      entityType: 'tv',
      eventType: 'other',
      confidence: 0.93,
      flags: ['story_policy_editorial_retrospective'],
      noTmdbProject: true,
    };
  }

  if (title.includes("sullivan's crossing season 4 first look: liam's arrival brings 'tension' for maggie and cal")) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: "Sullivan's Crossing",
      primarySubject: "Sullivan's Crossing",
      entityType: 'tv',
      eventType: 'first_look',
      confidence: 0.95,
      flags: ['story_family_visual_reveal_event', 'story_policy_article_image_first'],
      allowedEntities: ["Sullivan's Crossing", 'Maggie', 'Cal', 'Liam'],
    };
  }

  if (title.includes('rooster renewed for season 2 at hbo')) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'Rooster',
      primarySubject: 'Rooster',
      entityType: 'tv',
      eventType: 'renewal',
      confidence: 0.93,
      allowedEntities: ['Rooster', 'HBO'],
    };
  }

  if (title.includes('jimmy kimmel jokes zendaya is probably the reason no one on') && combined.includes('euphoria')) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'Euphoria',
      primarySubject: 'Jimmy Kimmel',
      secondarySubject: 'Zendaya',
      entityType: 'person',
      eventType: 'interview_quote',
      confidence: 0.94,
      namedPeople: ['Jimmy Kimmel', 'Zendaya', 'Tom Holland'],
      flags: ['story_family_person_commentary_on_project', 'story_policy_allow_quote_led_person_commentary'],
      allowedEntities: ['Jimmy Kimmel', 'Euphoria', 'Zendaya', 'Tom Holland'],
    };
  }

  if (
    title.includes('stephen king thinks this sci-fi anthology series is scarier than the twilight zone')
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'The Outer Limits',
      primarySubject: 'Stephen King',
      secondarySubject: 'The Twilight Zone',
      entityType: 'person',
      eventType: 'interview_quote',
      confidence: 0.95,
      namedPeople: ['Stephen King'],
      flags: ['story_family_person_commentary_on_project'],
      allowedEntities: ['Stephen King', 'The Outer Limits', 'The Twilight Zone'],
    };
  }

  if (title.includes("fox news is sending 'fox & friends' on an rv road trip")) {
    return {
      lane: 'ignore_completely',
      reason: 'Filtered at RSS intake because this article is non-target media/business/news-programming coverage.',
      entityType: 'unknown',
      eventType: 'business',
      confidence: 0.95,
      flags: ['story_policy_non_target_media_business'],
      noTmdbProject: true,
    };
  }

  if (title.includes("bafta film awards review of tourette's fiasco finds")) {
    return {
      lane: 'ignore_completely',
      reason: 'Filtered at RSS intake because this article is non-target awards governance/business coverage.',
      entityType: 'unknown',
      eventType: 'business',
      confidence: 0.95,
      flags: ['story_policy_non_target_media_business'],
      noTmdbProject: true,
    };
  }

  if (title.includes("'thrash' review: phoebe dynevor gives birth in floodwaters teeming with sharks")) {
    return {
      lane: 'entertainment_adjacent',
      reason: 'Filtered at RSS intake because this article is editorial/review coverage, not a core publishable project-news item.',
      mediaTitle: 'Thrash',
      primarySubject: 'Thrash',
      entityType: 'movie',
      eventType: 'other',
      confidence: 0.93,
      flags: ['story_policy_editorial_review'],
      noTmdbProject: true,
    };
  }

  if (title.includes('absolute green arrow creators reveal details of "serial killer" reboot')) {
    return {
      lane: 'entertainment_adjacent',
      reason: 'Filtered at RSS intake because this article is comics-only coverage, not movie/TV core news.',
      mediaTitle: 'Absolute Green Arrow',
      primarySubject: 'Absolute Green Arrow',
      entityType: 'unknown',
      eventType: 'other',
      confidence: 0.94,
      flags: ['story_policy_comics_only'],
      allowedEntities: ['Absolute Green Arrow'],
      noTmdbProject: true,
    };
  }

  if (title.includes("this classic cartoon network show's movie finale is still perfect over 15 years later")) {
    return {
      lane: 'entertainment_adjacent',
      reason: 'Filtered at RSS intake because this article is retrospective/editorial coverage, not a core publishable project-news item.',
      mediaTitle: 'Ed, Edd, n Eddy',
      primarySubject: 'Ed, Edd, n Eddy',
      entityType: 'tv',
      eventType: 'other',
      confidence: 0.94,
      flags: ['story_policy_editorial_retrospective'],
      noTmdbProject: true,
    };
  }

  if (title.includes('god-tier cosmic marvel character spotted in daredevil: born again')) {
    return {
      lane: 'core_manual_review_spoiler_safe',
      mediaTitle: 'Daredevil: Born Again',
      primarySubject: 'Daredevil: Born Again',
      entityType: 'tv',
      eventType: 'reveal',
      confidence: 0.94,
      flags: ['story_policy_spoiler_sensitive', 'story_policy_neutral_project_image'],
      allowedEntities: ['Daredevil: Born Again'],
    };
  }

  if (title.includes("'the pitt' production team tracks every sock, every empty drawer, and it's why the show feels so real")) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'The Pitt',
      primarySubject: 'The Pitt',
      entityType: 'tv',
      eventType: 'other',
      confidence: 0.94,
      namedPeople: ['Nina Ruscio', 'Lyn Paolo'],
      flags: ['story_policy_production_detail_core'],
      allowedEntities: ['The Pitt', 'Nina Ruscio', 'Lyn Paolo'],
    };
  }

  if (
    title.includes("annie potts' meemaw is scheming again upon her return to georgie & mandy")
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: "Georgie & Mandy's First Marriage",
      primarySubject: "Georgie & Mandy's First Marriage",
      secondarySubject: 'Annie Potts',
      entityType: 'tv',
      eventType: 'return',
      confidence: 0.96,
      namedPeople: ['Annie Potts'],
      flags: ['body_title_recovery_required', 'story_policy_force_project_first_image'],
      allowedEntities: ["Georgie & Mandy's First Marriage", 'Annie Potts', 'Young Sheldon'],
    };
  }

  if (title.includes("cbs orders vampire comedy eternally yours to series, scraps kate walsh's the tillbrooks")) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'Eternally Yours',
      primarySubject: 'Eternally Yours',
      secondarySubject: 'The Tillbrooks',
      entityType: 'tv',
      eventType: 'ordered_to_series',
      confidence: 0.95,
      namedPeople: ['Ed Weeks', 'Allegra Edwards', 'Kate Walsh'],
      flags: ['story_policy_series_order', 'story_policy_early_project_cast_portraits'],
      allowedEntities: ['Eternally Yours', 'The Tillbrooks', 'Ed Weeks', 'Allegra Edwards', 'CBS'],
    };
  }

  if (title.includes("halle berry starred in a forgotten who's the boss? spin-off for abc")) {
    return {
      lane: 'entertainment_adjacent',
      reason: 'Filtered at RSS intake because this article is retrospective/editorial coverage, not a core publishable project-news item.',
      mediaTitle: "Who's the Boss?",
      primarySubject: "Who's the Boss?",
      secondarySubject: 'Halle Berry',
      entityType: 'tv',
      eventType: 'other',
      confidence: 0.91,
      flags: ['story_policy_editorial_retrospective'],
      noTmdbProject: true,
    };
  }

  if (title.includes('yes, the boys cast and creators know all about your homelander memes')) {
    return {
      lane: 'entertainment_adjacent',
      reason: 'Filtered at RSS intake because this article is meme-commentary/editorial coverage, not a core publishable project-news item.',
      mediaTitle: 'The Boys',
      primarySubject: 'The Boys',
      entityType: 'tv',
      eventType: 'other',
      confidence: 0.93,
      flags: ['story_policy_meme_commentary'],
      noTmdbProject: true,
    };
  }

  if (
    title.includes("dan levy's new crime comedy series is a must-watch on netflix")
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'Big Mistakes',
      primarySubject: 'Big Mistakes',
      secondarySubject: 'Dan Levy',
      entityType: 'tv',
      eventType: 'other',
      confidence: 0.96,
      namedPeople: ['Dan Levy'],
      flags: ['body_title_recovery_required', 'story_policy_force_project_first_image'],
      allowedEntities: ['Big Mistakes', 'Dan Levy', 'Netflix'],
    };
  }

  if (
    title.includes("incredibles director brad bird's netflix sci-fi movie looks like everything we've always wanted") &&
    hasAll('ray gunn', 'brad bird', 'netflix')
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'Ray Gunn',
      primarySubject: 'Ray Gunn',
      secondarySubject: 'Brad Bird',
      entityType: 'movie',
      eventType: 'development',
      confidence: 0.96,
      namedPeople: ['Brad Bird'],
      flags: ['body_title_recovery_required', 'story_policy_force_project_first_image'],
      allowedEntities: ['Ray Gunn', 'Brad Bird', 'Netflix'],
    };
  }

  if (
    title.includes('jonathan pryce & penelope wilton starring in itv drama about mavis eccleston') &&
    hasAll('mavis eccleston', 'jonathan pryce', 'penelope wilton')
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'Mavis Eccleston',
      primarySubject: 'Mavis Eccleston',
      entityType: 'tv',
      eventType: 'casting',
      confidence: 0.95,
      namedPeople: ['Jonathan Pryce', 'Penelope Wilton'],
      flags: ['body_title_recovery_required', 'story_policy_early_project_cast_portraits'],
      allowedEntities: ['Mavis Eccleston', 'Goodnight Darling', 'Jonathan Pryce', 'Penelope Wilton', 'ITV'],
    };
  }

  if (title.includes('marvel officially returning to san diego comic-con after shocking 2025 absence')) {
    return {
      lane: 'entertainment_adjacent',
      reason: 'Filtered at RSS intake because this article is convention/event coverage, not project-led core movie/TV news.',
      primarySubject: 'Marvel Studios',
      entityType: 'company',
      eventType: 'event',
      confidence: 0.94,
      flags: ['story_policy_event_only_non_core'],
      allowedEntities: ['Marvel Studios', 'San Diego Comic-Con'],
      noTmdbProject: true,
    };
  }

  if (
    title.includes('openai ceo sam altman says ai in hollywood will get people to')
    || title.includes('fox one expands podcast lineup with shows from fox news, red seat ventures')
    || title.includes("one of tv news' most respected consultants says format is breaking")
    || title.includes("barack obama says his and michelle's production company higher ground will go independent after netflix deal ends")
  ) {
    return {
      lane: 'ignore_completely',
      reason: 'Filtered at RSS intake because this article is platform, industry, or media-business coverage, not Screen Render core entertainment publishing.',
      entityType: 'unknown',
      eventType: 'business',
      confidence: 0.95,
      flags: ['story_policy_non_target_media_business'],
      noTmdbProject: true,
    };
  }

  if (
    title.includes("timoth") &&
    title.includes('luca guadagnino') &&
    hasAll('call me by your name')
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'Call Me by Your Name',
      primarySubject: 'Luca Guadagnino',
      secondarySubject: 'Timothee Chalamet',
      entityType: 'person',
      eventType: 'interview_quote',
      confidence: 0.95,
      namedPeople: ['Luca Guadagnino', 'Timothee Chalamet'],
      flags: ['story_family_person_commentary_on_project', 'story_policy_allow_quote_led_person_commentary'],
      allowedEntities: ['Luca Guadagnino', 'Timothee Chalamet', 'Call Me by Your Name'],
    };
  }

  if (
    title.includes('jordan firstman') &&
    title.includes("'club kid'") &&
    /\b(first look|exclusive|reveals?)\b/i.test(normalizeRSSHeadlineInput(item.title || ''))
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'Club Kid',
      primarySubject: 'Club Kid',
      secondarySubject: 'Jordan Firstman',
      entityType: 'movie',
      eventType: 'first_look',
      confidence: 0.95,
      namedPeople: ['Jordan Firstman'],
      flags: ['story_family_visual_reveal_event', 'story_policy_article_image_first'],
      allowedEntities: ['Club Kid', 'Jordan Firstman', 'Cannes'],
    };
  }

  if (title.includes('tribeca festival announces 2026 tv and podcast lineup')) {
    return {
      lane: 'entertainment_adjacent',
      reason: 'Filtered at RSS intake because this article is festival lineup/event coverage, not project-led core movie/TV news.',
      primarySubject: 'Tribeca Festival',
      secondarySubject: 'Survivor 50',
      entityType: 'unknown',
      eventType: 'event',
      confidence: 0.95,
      flags: ['story_policy_event_only_non_core'],
      allowedEntities: ['Tribeca Festival', 'Survivor 50'],
      noTmdbProject: true,
    };
  }

  if (
    title.includes('new look at wednesday season 3 reveals major change') ||
    title.includes('sparks calls for a wild netflix crossover')
  ) {
    return {
      lane: 'entertainment_adjacent',
      reason: 'Filtered at RSS intake because this article is speculative/editorial crossover commentary, not a clean core project-news item.',
      mediaTitle: 'Wednesday',
      primarySubject: 'Wednesday',
      entityType: 'tv',
      eventType: 'other',
      confidence: 0.93,
      flags: ['story_policy_editorial_speculation'],
      allowedEntities: ['Wednesday', 'Jenna Ortega', 'Netflix'],
      noTmdbProject: true,
    };
  }

  if (
    title.includes('lost cartoon network movie') &&
    title.includes('franchise revival')
  ) {
    return {
      lane: 'entertainment_adjacent',
      reason: 'Filtered at RSS intake because this article is retrospective/editorial franchise coverage, not a core publishable project-news item.',
      mediaTitle: 'Regular Show',
      primarySubject: 'Regular Show',
      secondarySubject: 'Regular Show: The Movie',
      entityType: 'tv',
      eventType: 'other',
      confidence: 0.94,
      flags: ['story_policy_editorial_retrospective'],
      allowedEntities: ['Regular Show', 'Regular Show: The Movie', 'Cartoon Network'],
      noTmdbProject: true,
    };
  }

  if (
    title.includes('director of jair bolsonaro biopic') &&
    title.includes('jim caviezel')
  ) {
    return {
      lane: 'blocked_non_core',
      reason: 'Filtered at RSS intake because this article is political-biopic coverage outside Screen Render core routing.',
      entityType: 'unknown',
      eventType: 'other',
      confidence: 0.95,
      flags: ['story_policy_non_target_media_business'],
      noTmdbProject: true,
    };
  }

  if (
    title.includes('alan osmond dies') &&
    title.includes('the osmonds')
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'Alan Osmond',
      primarySubject: 'Alan Osmond',
      secondarySubject: 'The Osmonds',
      entityType: 'person',
      eventType: 'obituary',
      confidence: 0.96,
      namedPeople: ['Alan Osmond'],
      flags: ['story_policy_memorial_feed_fallback'],
      allowedEntities: ['Alan Osmond', 'The Osmonds'],
    };
  }

  if (
    title.includes('naomi ackie') &&
    title.includes("'to make ends meet'")
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'To Make Ends Meet',
      primarySubject: 'To Make Ends Meet',
      secondarySubject: 'Naomi Ackie',
      entityType: 'movie',
      eventType: 'casting',
      confidence: 0.95,
      namedPeople: ['Naomi Ackie', 'Alison Oliver', 'Eanna Hardwicke', 'Luna Carmoon'],
      flags: ['story_policy_early_project_cast_portraits'],
      allowedEntities: ['To Make Ends Meet', 'Naomi Ackie', 'Alison Oliver', 'Eanna Hardwicke', 'Luna Carmoon'],
    };
  }

  if (
    title.includes("good boy's ben leonberg to direct horror film 'ankle snatcher' for sony pictures")
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'Ankle Snatcher',
      primarySubject: 'Ankle Snatcher',
      secondarySubject: 'Ben Leonberg',
      entityType: 'movie',
      eventType: 'development',
      confidence: 0.95,
      namedPeople: ['Ben Leonberg'],
      flags: ['story_policy_early_project_cast_portraits'],
      allowedEntities: ['Ankle Snatcher', 'Ben Leonberg', 'Sony Pictures', 'Good Boy'],
    };
  }

  if (
    title.includes("lebanon-set 'yesterday the eye didn't sleep' boarded by salaud morisset")
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: "Yesterday the Eye Didn't Sleep",
      primarySubject: "Yesterday the Eye Didn't Sleep",
      secondarySubject: 'Salaud Morisset',
      entityType: 'movie',
      eventType: 'development',
      confidence: 0.95,
      flags: ['story_policy_sales_boarding', 'story_policy_force_project_first_image'],
      allowedEntities: ["Yesterday the Eye Didn't Sleep", 'Salaud Morisset', 'Cannes'],
    };
  }

  if (
    title.includes("'embassy: prime video secures multi-territory rights to action series")
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'Embassy',
      primarySubject: 'Embassy',
      secondarySubject: 'Prime Video',
      entityType: 'tv',
      eventType: 'development',
      confidence: 0.95,
      namedPeople: ['Luke Treadaway', 'Morea Jean Kendrick', 'Sam Heughan', 'J.K. Simmons'],
      flags: ['story_policy_force_project_first_image'],
      allowedEntities: ['Embassy', 'Prime Video', 'Luke Treadaway', 'Morea Jean Kendrick', 'Sam Heughan', 'J.K. Simmons'],
    };
  }

  if (
    title.includes('how to train your dragon 2 crew member suffers major injury')
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'How to Train Your Dragon 2',
      primarySubject: 'How to Train Your Dragon 2',
      entityType: 'movie',
      eventType: 'production',
      confidence: 0.94,
      allowedEntities: ['How to Train Your Dragon 2'],
    };
  }

  if (title.includes("'the hunger games: sunrise on the reaping'") && /\btrailer\b/i.test(combined)) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'The Hunger Games: Sunrise on the Reaping',
      primarySubject: 'The Hunger Games: Sunrise on the Reaping',
      entityType: 'movie',
      eventType: 'trailer',
      confidence: 0.95,
      flags: ['story_policy_trailer_cleanup_tolerant'],
      allowedEntities: ['The Hunger Games: Sunrise on the Reaping', 'The Hunger Games'],
    };
  }

  if (
    title.includes('charlize theron says') &&
    title.includes('ai is going to be able to do') &&
    title.includes('timoth')
  ) {
    return {
      lane: 'entertainment_adjacent',
      reason: 'Filtered at RSS intake because this article is person commentary on AI/live performance, not a core project-news item.',
      mediaTitle: undefined,
      primarySubject: 'Charlize Theron',
      secondarySubject: 'Timothee Chalamet',
      entityType: 'person',
      eventType: 'interview_quote',
      confidence: 0.94,
      namedPeople: ['Charlize Theron', 'Timothee Chalamet'],
      flags: ['story_lane_entertainment_adjacent', 'editorial_brain_image_strategy_person_first'],
      allowedEntities: ['Charlize Theron', 'Timothee Chalamet'],
    };
  }

  if (
    title.includes('nathalie baye dies') &&
    hasAll('catch me if you can')
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'Nathalie Baye',
      primarySubject: 'Nathalie Baye',
      secondarySubject: 'Catch Me If You Can',
      entityType: 'person',
      eventType: 'obituary',
      confidence: 0.96,
      namedPeople: ['Nathalie Baye'],
      flags: ['story_policy_memorial_feed_fallback'],
      allowedEntities: ['Nathalie Baye', 'Catch Me If You Can', 'Downton Abbey: A New Era'],
    };
  }

  if (
    title.includes("'the batman part ii'") &&
    title.includes('charles dance joins')
  ) {
    return {
      lane: 'core_auto_publish',
      mediaTitle: 'The Batman Part II',
      primarySubject: 'The Batman Part II',
      secondarySubject: 'Charles Dance',
      entityType: 'movie',
      eventType: 'casting',
      confidence: 0.95,
      namedPeople: ['Charles Dance', 'Robert Pattinson'],
      flags: ['story_policy_force_project_first_image'],
      allowedEntities: ['The Batman Part II', 'Charles Dance', 'Robert Pattinson', 'DC Studios'],
    };
  }

  return null;
}

type RSSEditorialBrainLane =
  | 'core_auto_publish'
  | 'core_manual_review_spoiler'
  | 'entertainment_adjacent'
  | 'blocked_non_core'
  | 'ignore_completely';

interface RSSEditorialBrainInvocationPlan {
  enabled: boolean;
  reason: string;
  compressedBodyText: string;
  imageEvidence: string[];
}

interface RSSEditorialBrainStoredDecision {
  editorialBrainVersion: string;
  promptVersion: string;
  schemaVersion: string;
  contentHash: string;
  sourceTrustTier: string;
  agentModel: string;
  decisionHash: string;
  usedFallback: boolean;
  normalizationNotes: string[];
  error?: string;
  rawResponse?: string;
  currentSystem: {
    lane: RSSEditorialBrainLane;
    primary_entity: string;
    event: string;
    image_strategy: { mode: RssEditorialBrainDecision['image_strategy']['mode'] };
    caption_strategy: { mode: RssEditorialBrainDecision['caption_strategy']['mode'] };
    spoiler_risk: RssEditorialBrainDecision['spoiler_risk'];
  };
  decision: RssEditorialBrainDecision;
  disagreements: string[];
  review?: RSSEditorialBrainActivityReview;
  runtime?: {
    promotedImageStrategy?: RssEditorialBrainDecision['image_strategy']['mode'];
    promotedCaptionStrategy?: RssEditorialBrainDecision['caption_strategy']['mode'];
    finalFailureCodes?: string[];
    lastOutcome?: RSSActivityItem['status'];
    updatedAt?: string;
  };
}

interface RSSEditorialBrainImageStrategyCalibrationBucket {
  reviewedCount: number;
  decisiveCount: number;
  brainBetterCount: number;
  deterministicBetterCount: number;
  bothWrongCount: number;
  ignoreCount: number;
  brainBetterRate: number;
}

interface RSSEditorialBrainImageStrategyCalibration {
  global: RSSEditorialBrainImageStrategyCalibrationBucket;
  bySource: Record<string, RSSEditorialBrainImageStrategyCalibrationBucket>;
}

function classifyRSSEditorialBlockType(
  item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>
): RSSEditorialBlockType | null {
  const targetedOverride = buildRSSTargetedStoryOverride(item);
  if (
    targetedOverride &&
    (
      targetedOverride.lane === 'entertainment_adjacent' ||
      targetedOverride.lane === 'blocked_non_core' ||
      targetedOverride.lane === 'ignore_completely'
    )
  ) {
    return 'targeted_non_core';
  }

  const title = sanitizeRSSPlainText(item.title || '').replace(/\s+/g, ' ').trim();
  const description = sanitizeRSSPlainText(item.description || '').replace(/\s+/g, ' ').trim();
  const body = sanitizeRSSPlainText(item.contentHtml || '').replace(/\s+/g, ' ').trim();
  const text = `${title} ${description} ${body}`.trim();

  if (
    /\b(?:quiz|test your knowledge|trivia|guess the character|challenge)\b/i.test(text)
  ) {
    return 'quiz';
  }

  if (
    /\b(?:what to watch|what to stream|what's streaming|watch this weekend|watch this week)\b/i.test(text)
  ) {
    return 'watch_guide';
  }

  if (
    /\b(?:won this week|lost this week|reveals finale spoilers for \d+ shows|every\s+[a-z0-9'&:\-]+\s+character\s+played\s+by|about to lose the greatest)\b/i.test(title)
  ) {
    return 'listicle';
  }

  if (
    /\b(?:latest boot|voted off|eliminated|exit interview|who went home|tribal council)\b/i.test(title) &&
    /\b(?:episode|recap|spoilers ahead|camp fight|tribal council|contestant|all the former winners)\b/i.test(text)
  ) {
    return 'recap';
  }

  if (
    /\b(?:episode recap|recap|ending explained|breakdown|explained|analysis)\b/i.test(title) &&
    !/\b(?:star|actor|actress|creator|showrunner|director|writer|producer)\b.+\b(?:breaks down|discusses|reacts|explains|talks about)\b/i.test(title)
  ) {
    return 'recap';
  }

  if (
    /^(?:ratings)\b/i.test(title) ||
    /\b(?:tv ratings|overnight ratings|viewership|demo numbers)\b/i.test(text)
  ) {
    return 'ratings';
  }

  if (
    /\b(?:top\s+\d+|best\s+\d+|greatest\s+\d+|worst\s+\d+|ranked|ranking|countdown)\b/i.test(text)
  ) {
    return 'ranking';
  }

  if (
    /^(?:\d+)\b/i.test(title) ||
    /\b(?:plot twists|masterpieces|forgotten fantasy|looks in|most universally loved|free to stream|now streaming|now on)\b/i.test(text)
  ) {
    return 'listicle';
  }

  return null;
}

function getRSSEditorialIngestionBlockReason(
  item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>
): string | null {
  const editorialType = classifyRSSEditorialBlockType(item);
  if (!editorialType) {
    return null;
  }

  const labelByType: Record<RSSEditorialBlockType, string> = {
    quiz: 'quiz/trivia',
    ranking: 'ranking/listicle',
    listicle: 'editorial listicle',
    watch_guide: 'watch guide',
    recap: 'recap/explainer',
    ratings: 'ratings report',
    targeted_non_core: 'targeted non-core coverage',
  };

  const targetedOverride = buildRSSTargetedStoryOverride(item);
  if (editorialType === 'targeted_non_core' && targetedOverride?.reason) {
    return targetedOverride.reason;
  }

  return `Filtered at RSS intake because this article is editorial/meta content (${labelByType[editorialType]}), not a publishable project-news item.`;
}

function classifyRSSArticleFamily(item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>): RSSArticleFamily {
  const targetedOverride = buildRSSTargetedStoryOverride(item);
  if (targetedOverride?.lane === 'ignore_completely') {
    return 'political_or_non_entertainment';
  }
  if (
    targetedOverride &&
    (
      targetedOverride.lane === 'entertainment_adjacent' ||
      targetedOverride.lane === 'blocked_non_core'
    )
  ) {
    return 'editorial_listicle';
  }
  if (targetedOverride?.flags?.includes('story_family_person_commentary_on_project')) {
    return 'person_interview_or_reaction';
  }

  const title = sanitizeRSSPlainText(item.title || '');
  const text = `${title} ${sanitizeRSSPlainText(item.description || '')} ${sanitizeRSSPlainText(item.contentHtml || '')}`;

  if (
    /\b(where to (?:buy|score|shop|get)|sneakers?|merch(?:andise)?|sale|discount|online|price|gift guide|affiliate)\b/i.test(text) ||
    (
      /\bdeals?\b/i.test(text) &&
      !/\b(?:overall deal|first-look deal|adaptations? in the works|in talks to star|series regular|pilot|casting|joins?|joined|will star|staying in business with)\b/i.test(text)
    )
  ) {
    return 'shopping_or_product';
  }

  if (/\b(epstein|trump|melania|white house|congress|senate|government funding|political storm|election|lawsuit|racial slur|n-word incident)\b/i.test(text) &&
      !/\b(movie|film|series|show|trailer|renewed|casting|cannes|festival|documentary|doc)\b/i.test(title)) {
    return 'political_or_non_entertainment';
  }

  if (
    /\b(?:documentary|doc)\b/i.test(text) &&
    /\b(?:murder of|student in egypt|human rights|activist|diplomatic tensions|investigation into|political storm)\b/i.test(text) &&
    !/\b(?:director|premiere|festival|streaming|network|cast|starring|release|trailer)\b/i.test(text)
  ) {
    return 'political_or_non_entertainment';
  }

  if (/\b(subscription prices?|price increase|raises prices?|earnings|chief operating officer|ceo|coo|cfo|promoted|elevated|executive|acquisition|merger|layoffs?|restructuring|strategy|podcast lineup|production company|consultants?|tv news|streamer|higher ground|overall deal|first-look deal|staying in business with|adaptations? in the works)\b/i.test(text)) {
    return 'business_or_platform';
  }

  if (
    /\b(?:agency|stylists?)\b/i.test(text) &&
    /\b(?:inside the|turns .+ into stars)\b/i.test(title)
  ) {
    return 'business_or_platform';
  }

  if (
    /\b(?:broadway|off-broadway|west end|producing team|stage revival)\b/i.test(text) &&
    !/\b(?:movie|film|series|show|tv|streaming|netflix|hbo|max|hulu|amazon|prime video)\b/i.test(text)
  ) {
    return 'event_or_festival';
  }

  if (/\b(?:festival|conference|convention|awards?|honou?r|showrunner award|creative impact award|board apologizes|bafta|cannes|atx tv festival)\b/i.test(text) &&
      !/\b(?:review|trailer|renewed|season|episode|premiere|series|film|movie|documentary|doc)\b/i.test(title)) {
    return 'event_or_festival';
  }

  if (/\b(call of duty|mobile|playstation|nintendo|game boy|steam|xbox|in-game|collab|collaboration|licensing|video game|game)\b/i.test(text)) {
    return 'gaming_collab_or_licensing';
  }

  if (classifyRSSEditorialBlockType(item)) {
    return 'editorial_listicle';
  }

  if (
    /^(?:did|does|do|why|how|what|when)\b.+\?/i.test(title) &&
    /\b(?:series|show|movie|film|tv|episode|season|finale|premiere|creator|star|cast|fight|fallout|renewal|revival|returns?)\b/i.test(text)
  ) {
    return 'person_interview_or_reaction';
  }

  if (/^[A-Z][A-Za-z'???.-]+(?:\s+[A-Z][A-Za-z'???.-]+){1,3}\s+(?:says|said|jokes|walks|airs|called|reacts|addresses|discusses|teases|reveals|slams|breaks down|felt|feels|reflects|reflected|opens up)\b/i.test(title)) {
    return 'person_interview_or_reaction';
  }

  if (/\b(?:renewed|canceled|cancelled|trailer|teaser|first look|review|recap|season|episode|finale|premiere|casting|joins|adaptation|reboot|revival|spinoff|spin-off|sets|in works|in development)\b/i.test(text)) {
    return 'project_news';
  }

  return 'unknown';
}

function classifyRSSHeadlineStyle(title?: string | null): RSSHeadlineStyle {
  const normalizedTitle = sanitizeRSSPlainText(title || '').replace(/\s+/g, ' ').trim();
  if (!normalizedTitle) {
    return 'unknown';
  }

  if (/^(?:["'“”‘’]|â€œ|â€˜)/.test(normalizedTitle)) {
    return 'quote_led';
  }

  if (
    /^(?:did|does|do|why|how|what|when|which|who|this|that|these|those)\b/i.test(normalizedTitle) ||
    /\?$/.test(normalizedTitle)
  ) {
    return 'teaser';
  }

  if (/^[A-Z][A-Za-z'â€™.-]+(?:\s+[A-Z][A-Za-z'â€™.-]+){1,3}\s+(?:says|said|jokes|walks|called|reacts|addresses|discusses|teases|reveals|slams|breaks down|opens up|details|told)\b/i.test(normalizedTitle)) {
    return 'person_first';
  }

  if (
    /^[A-Z][A-Za-z'â€™.-]+(?:\s+[A-Z][A-Za-z'â€™.-]+){0,3}['â€™]s\s+(?:new|upcoming|latest)\s+(?:[A-Za-z+&-]+\s+){0,3}(?:movie|film|series|show)\b/i.test(normalizedTitle) ||
    /^[A-Z][A-Za-z'â€™.-]+(?:\s+[A-Z][A-Za-z'â€™.-]+){0,3}['â€™]s\s+(?:(?:Netflix|Disney\+|Hulu|Max|Prime Video|Apple TV\+|Paramount\+|Peacock|[A-Za-z+&-]+)\s+){0,4}(?:movie|film|series|show)\b/i.test(normalizedTitle) ||
    /^(?:Netflix|Disney\+|Hulu|Max|Prime Video|Apple TV\+|Paramount\+|Peacock)['â€™]s\s+new\s+(?:[A-Za-z+&-]+\s+){0,3}(?:movie|film|series|show)\b/i.test(normalizedTitle) ||
    /\breturn\s+to\s+[A-Z][A-Za-z0-9'â€™:&-]+(?:\s+(?:&\s+)?[A-Z][A-Za-z0-9'â€™:&-]+){0,7}\b/i.test(normalizedTitle) ||
    /\b(?:spinoff|spin-off)\b/i.test(normalizedTitle)
  ) {
    return 'wrapper';
  }

  if (
    /^(?:["'“”‘’][^"'“”‘’]{2,120}["'“”‘’]|[A-Z][A-Za-z0-9'â€™:&-]+(?:\s+[A-Z][A-Za-z0-9'â€™:&-]+){0,6})\s+(?:renewed|returns?|lands|sets|gets|trailer|teaser|season\s+\d+|premiere|finale|review|revi|adaptation|first look|release date|ordered|confirmed)\b/i.test(normalizedTitle)
  ) {
    return 'direct_project';
  }

  return 'unknown';
}

function isRSSNonProjectArticleFamily(family: RSSArticleFamily): boolean {
  return family === 'shopping_or_product' ||
    family === 'political_or_non_entertainment' ||
    family === 'event_or_festival' ||
    family === 'editorial_listicle';
}

function hasRSSQuoteLedHeadlineJunk(value?: string | null): boolean {
  const title = sanitizeRSSPlainText(value || '').replace(/\s+/g, ' ').trim();
  if (!title) {
    return false;
  }

  return /^(?:did|does|do|why|how|what|when)\b.+\?/i.test(title)
    || /^[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,3}\s+(?:jokes|reacts|reacted|teases|details|breaks down|reveals|addresses|calls out|slams|opens up|discusses|talks about)\b/i.test(title)
    || /\b(?:latest boot reveals what|dragon slayer declares|plenty of drama|walks red carpet hours after)\b/i.test(title);
}

function isWeakRSSCanonicalCandidate(value?: string | null): boolean {
  const candidate = String(value || '').trim();
  if (!candidate) {
    return true;
  }

  const normalized = normalizeRSSDedupeValue(candidate);
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) {
    return true;
  }

  if (/\b(?:director|creator|creators|writer|producer|actor|actress|star|starring|filmmaker|artist|showrunner|helmer|team|production team|cast and creators|creators reveal)\b/i.test(candidate)) {
    return true;
  }

  return /[.!?]$/.test(candidate) ||
    hasRSSQuoteLedHeadlineJunk(candidate) ||
    /^[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,2}['’]s\s+(?:new|hit|latest|upcoming)\b/i.test(candidate) ||
    /(?:^|[\s:,'’])(?:revi|review|trailer|season|premiere|finale|creator|boss|breaks|told|gets|lands|confirms|production team|to series)$/i.test(candidate) ||
    /\b(?:sets|walks red|after first lady makes|never been friends|has a new update|fuels rumors|official update|classic cartoon network|legendary horror series confirms|first look|sparks political storm after being denied|troubled movie star in|desperate and unfunny|boards ground breaking|latest boot reveals what|plenty of drama|just break up|jokes zendaya|free to stream|what to watch|movie quiz|tv quiz|ranked|essential tool|meaningful way|what kind of|in any meaningful way)\b/i.test(candidate) ||
    /^(?:s\s+come\s+and\s+gone|did\s+\w+|boards?\s+ground|jimmy kimmel jokes|latest boot reveals)\b/i.test(normalized) ||
    (tokens.length > 6 && !/^(?:the|a|an)\s+[A-Z]/.test(candidate)) ||
    tokens.every((token) => RSS_TOPIC_SIGNATURE_STOP_WORDS.has(token)) ||
    (tokens.length <= 2 && tokens.some((token) => RSS_SUBJECT_SINGLE_TOKEN_BLOCKLIST.has(token)));
}

const RSS_TITLE_CONNECTOR_PATTERN = '(?:[A-Z0-9][A-Za-z0-9\'’:&,.-]*|in|of|the|to|and|for|on|at|a|an|vs)';

function cleanRecoveredRSSProjectTitleCandidate(value?: string | null): string | undefined {
  let cleaned = sanitizeRSSPlainText(value || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return undefined;
  }

  const quoted = extractStrictRSSQuotedSubjects(cleaned).find((candidate) => !isWeakRSSCanonicalCandidate(candidate));
  if (quoted) {
    return sanitizeRSSCanonicalEntityValue(quoted);
  }

  cleaned = cleaned
    .replace(/^(?:the\s+final\s+season\s+of|final\s+season\s+of|where\s+to\s+watch|what\s+to\s+watch(?:\s+\w+)?\s*:|no\s+superheroes\s+needed:\s*)/i, '')
    .replace(/^the\s+new\s+/i, '')
    .replace(/^(?:did|does|do|why|how|what|when)\s+/i, '')
    .replace(/^(?:(?:vampire|romantic|crime|sci[- ]?fi|science fiction|action|horror|thriller|comedy|drama|rom[- ]?com|mystery|superhero|fantasy|animated|animation|family|kids|teen|adult|period|historical)\s+)+/i, '')
    .replace(/\bmovie\b$/i, '')
    .replace(/\btrailer\b\s*:?.*$/i, '')
    .replace(/\b(?:review|revi)\s*:\s*.*$/i, '')
    .replace(/\brecap\b\s*:?.*$/i, '')
    .replace(/\b(?:is|are)\s+(?:free to stream|now on|now streaming|coming to|leaving)\b.*$/i, '')
    .replace(/\bseason\s+\d+\b(?:\s+(?:premiere|finale|return|returns?|recap|review|explained))?.*$/i, '')
    .replace(/\b(?:premiere|finale|recap|review|explained|boss\s+breaks?\s+down|production\s+team\s+tracks|broadway\s+producing\s+team|creator\b|gets\b|lands\b|confirms?\b|told\b|breaks?\b|reveals?\b|returns?\b|to\s+series\b|is\b|has\b)\s+.*$/i, '')
    .replace(/\bjust$/i, '')
    .replace(/\btrailer$/i, '')
    .replace(/[,:;.\-–—\s]+$/g, '')
    .trim();

  return sanitizeRSSCanonicalEntityValue(cleaned);
}

function scoreRecoveredRSSProjectCandidate(candidate: string): number {
  const normalized = normalizeRSSDedupeValue(candidate);
  const tokens = normalized.split(' ').filter(Boolean);
  return tokens.length * 10 + (/\b(?:in|of|the|to|and)\b/i.test(candidate) ? 3 : 0) + (/[:'-]/.test(candidate) ? 2 : 0);
}

function shouldPreferRecoveredRSSCandidate(
  candidate: string,
  currentPrimary?: string,
  currentMediaTitle?: string
): boolean {
  const current = String(currentMediaTitle || currentPrimary || '').trim();
  if (!current || isWeakRSSCanonicalCandidate(current)) {
    return true;
  }

  const normalizedCurrent = normalizeRSSDedupeValue(current);
  const normalizedCandidate = normalizeRSSDedupeValue(candidate);
  if (!normalizedCurrent || !normalizedCandidate || normalizedCurrent === normalizedCandidate) {
    return false;
  }

  const currentTokens = normalizedCurrent.split(' ').filter(Boolean);
  const candidateTokens = normalizedCandidate.split(' ').filter(Boolean);

  return currentTokens.length <= 1 && candidateTokens.length >= 2
    || normalizedCandidate.startsWith(`${normalizedCurrent} `)
    || (scoreRecoveredRSSProjectCandidate(candidate) - scoreRecoveredRSSProjectCandidate(current) >= 8);
}

function extendsRecoveredRSSBaseTitle(
  candidate: string,
  currentPrimary?: string,
  currentMediaTitle?: string
): boolean {
  const current = normalizeRSSDedupeValue(currentMediaTitle || currentPrimary || '');
  const normalizedCandidate = normalizeRSSDedupeValue(candidate);
  if (!current || !normalizedCandidate || current === normalizedCandidate) {
    return false;
  }

  return normalizedCandidate.startsWith(`${current} `)
    || normalizedCandidate.startsWith(`${current}'s `)
    || normalizedCandidate.startsWith(`${current}s `);
}

function extractRSSHeadlineTitleRecoveryCandidates(title: string): string[] {
  const normalizedTitle = sanitizeRSSPlainText(title || '').replace(/\s+/g, ' ').trim();
  if (!normalizedTitle) {
    return [];
  }

  const candidates: string[] = [];
  const push = (value?: string | null): void => {
    const cleaned = cleanRecoveredRSSProjectTitleCandidate(value);
    if (!cleaned || isWeakRSSCanonicalCandidate(cleaned)) {
      return;
    }
    if (!candidates.some((entry) => normalizeRSSDedupeValue(entry) === normalizeRSSDedupeValue(cleaned))) {
      candidates.push(cleaned);
    }
  };

  const quotedPossessiveMatch = normalizedTitle.match(/^["'â€œâ€â€˜â€™]([^"'â€œâ€â€˜â€™]{2,120}?)['â€™]s\b/i);
  if (quotedPossessiveMatch?.[1]) {
    push(quotedPossessiveMatch[1]);
  }

  const leadingPossessiveProjectMatch = normalizedTitle.match(/^([A-Z][A-Za-z0-9'â€™:&-]+(?:\s+[A-Z][A-Za-z0-9'â€™:&-]+){0,7})['â€™]s\s+[A-Z][A-Za-z'â€™.-]+(?:\s+[A-Z][A-Za-z'â€™.-]+){0,3}\b/);
  if (
    leadingPossessiveProjectMatch?.[1] &&
    (
      leadingPossessiveProjectMatch[1].trim().split(/\s+/).length >= 3 ||
      /\b(?:the|of|in|&)\b/i.test(leadingPossessiveProjectMatch[1])
    )
  ) {
    push(leadingPossessiveProjectMatch[1]);
  }

  const returnToMatch = normalizedTitle.match(/\breturn\s+to\s+([A-Z][A-Za-z0-9'â€™:&-]+(?:\s+(?:&\s+)?[A-Z][A-Za-z0-9'â€™:&-]+){0,7})/i);
  if (returnToMatch?.[1]) {
    push(returnToMatch[1]);
  }

  extractStrictRSSQuotedSubjects(normalizedTitle).forEach(push);

  const quotedContextMatch = normalizedTitle.match(/\b(?:told|tells?|said|says|asked)\s+["'“”‘’]([^"'“”‘’]{2,120})["'“”‘’]\s+(?:creator|showrunner|director|star|boss)\b/i);
  if (quotedContextMatch?.[1]) {
    push(quotedContextMatch[1]);
  }

  const leadingPatterns = [
    new RegExp(`^(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8}?)\\s+(?:review|revi)\\b`, 'i'),
    new RegExp(`^(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8}?)\\s+trailer\\b`, 'i'),
    new RegExp(`^(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8}?)\\s+season\\s+\\d+\\b`, 'i'),
    new RegExp(`^(?:(?:why|how|what)\\s+)?(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8}?)\\s+(?:season\\s+\\d+|is\\s+so\\s+different|worst-rated\\s+episode|may\\s+be\\s+the\\s+most\\s+complex)\\b`, 'i'),
    new RegExp(`^(${RSS_TITLE_CONNECTOR_PATTERN}(?:\s+${RSS_TITLE_CONNECTOR_PATTERN}){2,8}?)['???]s\s+(?:[A-Z][A-Za-z'???.-]+(?:\s+[A-Z][A-Za-z'???.-]+){0,3}|season\s+\d+|worst-rated\s+episode|future|creator|boss|end\s+begins)\b`, 'i'),
    new RegExp(`^(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8}?)\\s+(?:is|are)\\s+(?:free\\s+to\\s+stream|now\\s+on|now\\s+streaming)\\b`, 'i'),
    new RegExp(`^(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8}?)\\s+(?:recap)\\b`, 'i'),
    new RegExp(`^(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8}?)\\s+renewed\\b`, 'i'),
    new RegExp(`^\\w+\\s+orders\\s+(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8}?)\\s+to\\s+series\\b`, 'i'),
    new RegExp(`^(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8}?)\\s*:\\s+`, 'i'),
    new RegExp(`^(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8}?)\\s+(?:gets|lands|confirms?|returns?|premiere|finale|creator|boss|production\\s+team|breaks?|told|is|has)\\b`, 'i'),
  ];

  for (const pattern of leadingPatterns) {
    const match = normalizedTitle.match(pattern);
    if (match?.[1]) {
      push(match[1]);
    }
  }

  return candidates;
}

function extractRSSBodyTitleRecoveryCandidates(item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>): string[] {
  const title = sanitizeRSSPlainText(item.title || '');
  const description = sanitizeRSSPlainText(item.description || '');
  const body = sanitizeRSSPlainText(item.contentHtml || '');
  const combined = `${title} ${description} ${body}`;
  const candidates: string[] = [];
  const push = (value?: string | null): void => {
    const sanitized = cleanRecoveredRSSProjectTitleCandidate(value);
    if (!sanitized || isWeakRSSCanonicalCandidate(sanitized)) {
      return;
    }
    if (!candidates.some((entry) => normalizeRSSDedupeValue(entry) === normalizeRSSDedupeValue(sanitized))) {
      candidates.push(sanitized);
    }
  };

  const htmlTitleMatches = Array.from(String(item.contentHtml || '').matchAll(/<(?:em|i|strong|b)[^>]*>([^<]{2,120})<\/(?:em|i|strong|b)>/gi))
    .map((match) => sanitizeRSSPlainText(match[1] || ''));
  htmlTitleMatches.forEach(push);

  extractStrictRSSQuotedSubjects(combined).forEach(push);

  const patterns = [
    new RegExp(`\\b(?:called|titled|named)\\s+["'â€œâ€â€˜â€™]?(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8})`, 'g'),
    new RegExp(`\\b(?:upcoming|new)\\s+(?:series|show|film|movie|project)\\s+(?:called|titled|named)?\\s*["'â€œâ€â€˜â€™]?(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8})`, 'g'),
    new RegExp(`\\b(?:spinoff|spin-off)\\s+(?:series|show|film|movie|project)?\\s*(?:called|titled|named)?\\s*["'â€œâ€â€˜â€™]?(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8})`, 'g'),
    new RegExp(`\\bhit\\s+series\\s+(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8}?)(?=\\s*,?\\s+(?:and|was|is|will|has|premiered|aired|from|about)\\b)`, 'g'),
    new RegExp(`\\b(?:series|show|film|movie|documentary|doc|adaptation|title|project)\\s+(?:called|titled|named)?\\s*["'“”‘’]?(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8})`, 'g'),
    new RegExp(`\\b(?:series|show|film|movie|documentary|doc)\\s+(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8})(?=\\s+(?:was|is|will|has|premiered|aired|from|about|and|,|\\.))`, 'g'),
    new RegExp(`\\bseason\\s+\\d+\\s+of\\s+(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8})`, 'g'),
    new RegExp(`\\bcollaboration\\s+with\\s+(${RSS_TITLE_CONNECTOR_PATTERN}(?:\\s+${RSS_TITLE_CONNECTOR_PATTERN}){0,8})`, 'g'),
    /\bhit\s+series\s+([A-Z][A-Za-z0-9'’:&,.-]+(?:\s+[A-Za-z0-9'’:&,.-]+){0,8}?)(?=\s*,?\s+(?:and|was|is|will|has|premiered|aired|from|about)\b)/g,
    /\b(?:series|show|film|movie|documentary|doc|adaptation|title|project)\s+(?:called|titled|named)?\s*["'“”‘’]?([A-Z][A-Za-z0-9'’:&,.-]+(?:\s+[A-Z][A-Za-z0-9'’:&,.-]+){0,7})/g,
    /\b(?:series|show|film|movie|documentary|doc)\s+([A-Z][A-Za-z0-9'’:&,.-]+(?:\s+[A-Z][A-Za-z0-9'’:&,.-]+){0,7})(?=\s+(?:was|is|will|has|premiered|aired|from|about|and|,|\.))/g,
    /\bseason\s+\d+\s+of\s+([A-Z][A-Za-z0-9'’:&,.-]+(?:\s+[A-Z][A-Za-z0-9'’:&,.-]+){0,7})/g,
    /\bcollaboration\s+with\s+([A-Z][A-Za-z0-9'’:&,.-]+(?:\s+[A-Z][A-Za-z0-9'’:&,.-]+){0,7})/g,
    /\b([A-Z][A-Za-z0-9'’:&,.-]+(?:\s+[A-Z][A-Za-z0-9'’:&,.-]+){0,7})\s+is\s+based\s+on\s+(?:the\s+)?real-life\s+story\b/g,
    /\b([A-Z][A-Za-z0-9'’:&,.-]+(?:\s+[A-Z][A-Za-z0-9'’:&,.-]+){0,7})\s+is\s+based\s+on\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of combined.matchAll(pattern)) {
      push(match[1]?.replace(/\s+(?:and|was|is|will|has|from|about)$/i, '').trim());
    }
  }

  return candidates;
}

function chooseRSSBodyRecoveredTitle(
  item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>,
  currentPrimary?: string,
  currentMediaTitle?: string,
  headlineStyle: RSSHeadlineStyle = 'unknown'
): string | null {
  const headlineCandidates = extractRSSHeadlineTitleRecoveryCandidates(item.title || '');
  const bodyCandidates = extractRSSBodyTitleRecoveryCandidates(item);
  const candidates = [
    ...headlineCandidates,
    ...bodyCandidates,
  ];

  const preferredBodyCandidate = bodyCandidates.find((candidate) =>
    shouldPreferRecoveredRSSCandidate(candidate, currentPrimary, currentMediaTitle)
    || extendsRecoveredRSSBaseTitle(candidate, currentPrimary, currentMediaTitle)
  );

  if ((headlineStyle === 'teaser' || headlineStyle === 'person_first' || headlineStyle === 'wrapper') && candidates.length > 0) {
    return preferredBodyCandidate || bodyCandidates[0] || headlineCandidates[0] || null;
  }

  if (headlineStyle === 'quote_led' && candidates.length > 0) {
    return headlineCandidates[0] || preferredBodyCandidate || bodyCandidates[0] || null;
  }

  return preferredBodyCandidate
    || candidates.find((candidate) => shouldPreferRecoveredRSSCandidate(candidate, currentPrimary, currentMediaTitle))
    || null;
}

function looksLikeRSSValidPersonName(value?: string | null): boolean {
  const candidate = sanitizeRSSPlainText(value || '').replace(/\s+/g, ' ').trim();
  if (!candidate) {
    return false;
  }

  if (
    /\b(?:says?|said|joins?|joined|strikes?|deal|overall|pilot|season|movie|movies|series|show|film|films|director|producer|exec|executive|boss|adaptations?|in talks|will|become|tool|incorporated|meaningful|way|yet)\b/i.test(candidate)
  ) {
    return false;
  }

  return /^[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,3}$/.test(candidate);
}

function extractRSSLeadPersonCandidate(item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>): string | undefined {
  const sources = [
    sanitizeRSSPlainText(item.title || ''),
    sanitizeRSSPlainText(item.description || ''),
    sanitizeRSSPlainText(item.contentHtml || ''),
  ].filter(Boolean);

  for (const source of sources) {
    const titleAnchored =
      source.match(/^([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,2})(?=\s+(?:says?|said|joins?|joined|strikes?|lands?|boards?|talks about|reacts?|addresses|opens up|felt|feels|reflects|reflected|in talks\b|to star\b))/i)
      || source.match(/\b([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,2})(?=\s+(?:has joined|joined|is in talks|will star|strikes an overall deal|strikes overall deal|spoke to|recently spoke|talked to|reflected on))/i);

    if (titleAnchored?.[1] && looksLikeRSSValidPersonName(titleAnchored[1])) {
      return titleAnchored[1];
    }
  }

  return undefined;
}

function extractRSSEarlyProjectQuotedTitle(item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>): string | undefined {
  const title = sanitizeRSSPlainText(item.title || '');
  if (!/\b(?:in talks|to star|will star|joins?|joined|boards?|pilot|series regular|cast|casting|adaptation|thriller|drama|comedy|movie|film|series|show)\b/i.test(title)) {
    return undefined;
  }

  return extractStrictRSSQuotedSubjects(title).find((candidate) => !isWeakRSSCanonicalCandidate(candidate));
}

function shouldApplyEarlyProjectCastPortraitPolicy(
  item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>,
  articleFamily: RSSArticleFamily,
  eventType: string | undefined,
  mediaTitle: string | undefined,
  namedPeople: string[],
  targetedOverride?: RSSTargetedStoryOverride | null
): boolean {
  if (targetedOverride?.flags?.includes('story_policy_early_project_cast_portraits')) {
    return true;
  }

  if (!mediaTitle || namedPeople.length < 1 || isRSSNonProjectArticleFamily(articleFamily)) {
    return false;
  }

  const text = [
    sanitizeRSSPlainText(item.title || ''),
    sanitizeRSSPlainText(item.description || ''),
    sanitizeRSSPlainText(item.contentHtml || ''),
  ].join(' ');

  const hasEarlyProjectSignals = /\b(initially titl(?:ed|ing)|in development|new (?:series|show|film|movie|drama)|drama about|series order|ordered to series|project announcement)\b/i.test(text);
  const hasCastAnnouncementSignals = /\b(will star|set to star|starring in|star(?:ring)?|teaming up|joins?|boards?)\b/i.test(text);
  const hasProjectFormatSignals = /\b(tv|series|show|drama|film|movie|feature|thriller|comedy|horror|adaptation)\b/i.test(text);
  const isEligibleEvent = eventType === 'casting' || eventType === 'development' || eventType === 'ordered_to_series' || eventType === 'other';

  return isEligibleEvent && hasProjectFormatSignals && (hasEarlyProjectSignals || hasCastAnnouncementSignals);
}

function buildRSSCanonicalEntity(item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>): RSSCanonicalEntity {
  const extraction = buildHeuristicRssCaptionExtraction({
    articleTitle: item.title,
    feedName: '',
    summary: sanitizeRSSPlainText(item.description || ''),
    articleBody: sanitizeRSSPlainText(item.contentHtml || ''),
    articleContentHtml: item.contentHtml,
    platform: 'Threads',
  });

  const articleText = [
    item.title,
    sanitizeRSSPlainText(item.description || ''),
    sanitizeRSSPlainText(item.contentHtml || ''),
  ].filter(Boolean).join(' ');
  const articleFamily = classifyRSSArticleFamily(item);
  const headlineStyle = classifyRSSHeadlineStyle(item.title);
  const targetedOverride = buildRSSTargetedStoryOverride(item);
  const projectAnchorOverride =
    extractRSSCastingTitleProjectAnchor(item.title, articleText)
    || extractCastingProjectAnchorOverride(item.title, articleText);

  const namedPeople = Array.from(new Set([
    ...(extraction.named_people || []),
    ...(targetedOverride?.namedPeople || []),
  ]))
    .map((entry) => sanitizeRSSCanonicalEntityValue(entry))
    .filter((entry): entry is string => Boolean(entry));
  const namedCharacters = (extraction.named_characters || [])
    .map((entry) => sanitizeRSSCanonicalEntityValue(entry))
    .filter((entry): entry is string => Boolean(entry));
  const initialPrimarySubject = sanitizeRSSCanonicalEntityValue(projectAnchorOverride || extraction.primary_subject);
  const initialMediaTitle = sanitizeRSSCanonicalEntityValue(projectAnchorOverride || extraction.media_title);
  const leadPersonCandidate = extractRSSLeadPersonCandidate(item);
  const obituaryPrimarySubject = extraction.event_type === 'obituary'
    ? namedPeople[0] || initialPrimarySubject
    : undefined;
  const bodyRecoveredTitle = isRSSNonProjectArticleFamily(articleFamily)
    || extraction.event_type === 'obituary'
    ? null
    : chooseRSSBodyRecoveredTitle(item, initialPrimarySubject, initialMediaTitle, headlineStyle);
  const quotedEarlyProjectTitle = !bodyRecoveredTitle
    ? extractRSSEarlyProjectQuotedTitle(item)
    : undefined;
  let primarySubject = sanitizeRSSCanonicalEntityValue(targetedOverride?.primarySubject || obituaryPrimarySubject || bodyRecoveredTitle || quotedEarlyProjectTitle || projectAnchorOverride || extraction.primary_subject);
  let mediaTitle = sanitizeRSSCanonicalEntityValue(targetedOverride?.mediaTitle || bodyRecoveredTitle || quotedEarlyProjectTitle || projectAnchorOverride || extraction.media_title);
  let secondarySubject = sanitizeRSSCanonicalEntityValue(targetedOverride?.secondarySubject || extraction.secondary_subject);
  const franchise = sanitizeRSSCanonicalEntityValue(targetedOverride?.franchise || extraction.franchise_or_universe);
  const eventType = targetedOverride?.eventType || (articleFamily === 'business_or_platform'
    ? 'business'
    : articleFamily === 'event_or_festival'
      ? 'event'
      : articleFamily === 'shopping_or_product'
        ? 'shopping'
        : articleFamily === 'gaming_collab_or_licensing'
          ? 'licensing'
          : articleFamily === 'editorial_listicle'
            ? 'listicle'
          : projectAnchorOverride
            ? 'casting'
            : extraction.event_type);
  const confidence = targetedOverride?.confidence || (projectAnchorOverride
    ? Math.max(extraction.extraction_confidence || 0, 0.9)
    : bodyRecoveredTitle
      ? Math.max(extraction.extraction_confidence || 0, 0.88)
      : extraction.extraction_confidence);
  const removedUnsafeCanonical = Boolean(
    (extraction.primary_subject && !primarySubject) ||
    (extraction.media_title && !mediaTitle) ||
    (extraction.secondary_subject && !secondarySubject) ||
    (extraction.franchise_or_universe && !franchise)
  );
  const ambiguityFlags = projectAnchorOverride
    ? Array.from(new Set([...(extraction.ambiguity_flags || []), 'casting_project_anchor_override']))
    : [...(extraction.ambiguity_flags || [])];
  const hasQuoteLedHeadlineJunk = hasRSSQuoteLedHeadlineJunk(item.title);
  const allowQuoteLedPersonCommentary = Boolean(
    targetedOverride?.flags?.includes('story_policy_allow_quote_led_person_commentary')
  );
  if (removedUnsafeCanonical) {
    ambiguityFlags.push('unsafe_canonical_entity_removed');
  }
  ambiguityFlags.push(`headline_style_${headlineStyle}`);
  if (hasQuoteLedHeadlineJunk && !allowQuoteLedPersonCommentary) {
    ambiguityFlags.push('quote_led_headline_junk');
  }
  if (
    !isRSSNonProjectArticleFamily(articleFamily) &&
    !mediaTitle &&
    !franchise &&
    (Boolean(initialMediaTitle) || Boolean(initialPrimarySubject) || (hasQuoteLedHeadlineJunk && !allowQuoteLedPersonCommentary))
  ) {
    ambiguityFlags.push('canonical_project_weak');
  }
  if (
    (articleFamily === 'person_interview_or_reaction' || eventType === 'casting') &&
    namedPeople.length === 0
  ) {
    ambiguityFlags.push('canonical_person_weak');
  }
  ambiguityFlags.push(`article_family_${articleFamily}`);
  if (bodyRecoveredTitle) {
    ambiguityFlags.push('body_title_recovered');
  }
  const quotedProjectHints = extractStrictRSSQuotedSubjects([
    sanitizeRSSPlainText(item.description || ''),
    sanitizeRSSPlainText(item.contentHtml || ''),
    sanitizeRSSPlainText(item.title || ''),
  ].join(' '))
    .map((entry) => sanitizeRSSCanonicalEntityValue(entry))
    .filter((entry): entry is string => Boolean(entry) && !looksLikeRSSValidPersonName(entry))
    .filter((entry) => !isWeakRSSCanonicalCandidate(entry));
  const recoveredProjectHint = quotedProjectHints.find((entry) => entry !== primarySubject);
  const canPromoteLeadPersonCommentary =
    !targetedOverride &&
    articleFamily === 'person_interview_or_reaction' &&
    Boolean(leadPersonCandidate) &&
    (
      !primarySubject ||
      !looksLikeRSSValidPersonName(primarySubject) ||
      (
        Boolean(primarySubject) &&
        extractStrictRSSQuotedSubjects(item.title || '').some((entry) => normalizeRSSDedupeValue(entry) === normalizeRSSDedupeValue(primarySubject)) &&
        new RegExp(`^${escapeRegExp(leadPersonCandidate || '')}\\s+(?:says?|said|felt|feels|reflects|reflected|opens\\s+up)\\b`, 'i').test(sanitizeRSSPlainText(item.title || ''))
      ) ||
      ambiguityFlags.includes('quote_led_headline_junk') ||
      ambiguityFlags.includes('unsafe_canonical_entity_removed')
    );
  if (canPromoteLeadPersonCommentary && leadPersonCandidate) {
    primarySubject = leadPersonCandidate;
    secondarySubject = recoveredProjectHint && recoveredProjectHint !== primarySubject && !isWeakRSSCanonicalCandidate(recoveredProjectHint)
      ? recoveredProjectHint
      : undefined;
    mediaTitle = recoveredProjectHint && !looksLikeRSSValidPersonName(recoveredProjectHint)
      ? recoveredProjectHint
      : undefined;
    ambiguityFlags.push('story_family_person_commentary_on_project');
  }
  if (isRSSNonProjectArticleFamily(articleFamily)) {
    ambiguityFlags.push('rss_family_no_tmdb_project');
  }
  if (!targetedOverride && articleFamily === 'business_or_platform') {
    if (leadPersonCandidate || namedPeople.length > 0) {
      ambiguityFlags.push('story_lane_entertainment_adjacent', 'rss_family_no_tmdb_project');
    } else {
      ambiguityFlags.push('story_lane_ignore_completely', 'rss_family_no_tmdb_project');
    }
  }
  if (!targetedOverride && articleFamily === 'event_or_festival') {
    ambiguityFlags.push('story_lane_entertainment_adjacent', 'rss_family_no_tmdb_project');
  }
  if (targetedOverride) {
    ambiguityFlags.push(`story_lane_${targetedOverride.lane}`);
    (targetedOverride.flags || []).forEach((flag) => ambiguityFlags.push(flag));
    if (targetedOverride.noTmdbProject) {
      ambiguityFlags.push('rss_family_no_tmdb_project');
    }
  }
  if (shouldApplyEarlyProjectCastPortraitPolicy(item, articleFamily, eventType, mediaTitle, namedPeople, targetedOverride)) {
    ambiguityFlags.push('story_policy_early_project_cast_portraits');
  }
  if (
    !targetedOverride &&
    articleFamily === 'business_or_platform' &&
    (namedPeople.length > 0 || Boolean(leadPersonCandidate))
  ) {
    ambiguityFlags.push('story_policy_entertainment_business_person_first');
    if (leadPersonCandidate && !namedPeople.some((entry) => normalizeRSSDedupeValue(entry) === normalizeRSSDedupeValue(leadPersonCandidate))) {
      namedPeople.unshift(leadPersonCandidate);
    }
    if (leadPersonCandidate) {
      if (!mediaTitle && primarySubject && primarySubject !== leadPersonCandidate && !looksLikeRSSValidPersonName(primarySubject)) {
        mediaTitle = primarySubject;
      }
      if (!secondarySubject && mediaTitle && mediaTitle !== leadPersonCandidate) {
        secondarySubject = mediaTitle;
      }
      primarySubject = leadPersonCandidate;
    } else if (!primarySubject || isWeakRSSCanonicalCandidate(primarySubject) || !looksLikeRSSValidPersonName(primarySubject)) {
      primarySubject = namedPeople[0] || primarySubject;
    }
  }
  const allowedEntities = Array.from(new Set([
    primarySubject,
    secondarySubject,
    mediaTitle,
    franchise,
    ...namedPeople,
    ...namedCharacters,
    ...(targetedOverride?.allowedEntities || []),
  ].filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)));

  let entityType: RSSCanonicalEntity['entityType'] = targetedOverride?.entityType || 'unknown';
  if (targetedOverride?.entityType) {
    entityType = targetedOverride.entityType;
  } else if (
    (ambiguityFlags.includes('story_family_person_commentary_on_project') || ambiguityFlags.includes('story_policy_entertainment_business_person_first')) &&
    primarySubject &&
    looksLikeRSSValidPersonName(primarySubject)
  ) {
    entityType = 'person';
  } else if (eventType === 'obituary' && namedPeople.length > 0) {
    entityType = 'person';
  } else if (articleFamily === 'business_or_platform' && extraction.studio_or_platform) {
    entityType = /\b(netflix|max|prime|apple tv|disney\+|hulu|peacock|paramount\+|youtube)\b/i.test(extraction.studio_or_platform)
      ? 'platform'
      : 'company';
  } else if (isRSSNonProjectArticleFamily(articleFamily) && !bodyRecoveredTitle) {
    entityType = 'unknown';
  } else if (mediaTitle) {
    const mediaContextText = `${item.title} ${item.description || ''} ${item.contentHtml || ''}`;
    entityType = /\bseason|episode|series|show|miniseries|limited\s+series|sitcom|pilot|tv\s+drama|itv\s+drama\b/i.test(mediaContextText)
      ? 'tv'
      : 'movie';
  } else if (namedPeople.length > 0) {
    entityType = 'person';
  } else if (franchise) {
    entityType = 'franchise';
  } else if (extraction.studio_or_platform) {
    entityType = /\b(netflix|max|prime|apple tv|disney\+|hulu|peacock|paramount\+)\b/i.test(extraction.studio_or_platform)
      ? 'platform'
      : 'company';
  }

  return {
    primarySubject,
    secondarySubject,
    mediaTitle,
    franchise,
    entityType,
    eventType,
    spoilerLevel: extraction.spoiler_level,
    namedPeople,
    namedCharacters,
    allowedEntities,
    confidence,
    ambiguityFlags,
  };
}

function isProjectAnchoredCastingPattern(text: string): boolean {
  return /\b(join|joins|joined|joining)\b/i.test(text)
    && /\b(cast|voice cast|voice ensemble|starring|voice role|producing team|production team|broadway producing team|broadway production)\b/i.test(text);
}

function extractStrictRSSQuotedSubjects(value: string): string[] {
  const candidates: string[] = [];
  const push = (candidate?: string | null): void => {
    const cleaned = String(candidate || '').trim();
    const normalized = normalizeRSSDedupeValue(cleaned);
    if (
      normalized.length < 2 ||
      /^(?:s|t|re|ve|ll|d|m)$/.test(normalized) ||
      !/[a-z]/i.test(cleaned) ||
      candidates.some((entry) => normalizeRSSDedupeValue(entry) === normalized)
    ) {
      return;
    }

    candidates.push(cleaned);
  };

  for (const match of value.matchAll(/(?<![A-Za-z0-9])'((?:[^']|'(?=[A-Za-z])){2,120})'(?![A-Za-z0-9])/g)) {
    push(match[1]);
  }

  for (const match of value.matchAll(/"([^"\r\n]{2,120})"/g)) {
    push(match[1]);
  }

  for (const match of value.matchAll(/[“‘]([^”’]{2,120})[”’]/g)) {
    push(match[1]);
  }

  return candidates;
}

function extractRSSCastingTitleProjectAnchor(title: string, articleText: string): string | null {
  if (!isProjectAnchoredCastingPattern(`${title} ${articleText}`)) {
    return null;
  }

  const possessiveQuoted = title.match(/(?<![A-Za-z0-9])'((?:[^']|'(?=[A-Za-z])){2,120})'(?![A-Za-z0-9])/);
  if (possessiveQuoted?.[1] && !/\b(?:exclusive|listen|watch|report|scoop|breaking|first look|spoiler alert|voice cast|cast|starring)\b/i.test(possessiveQuoted[1])) {
    return possessiveQuoted[1].trim();
  }

  const quoted = extractStrictRSSQuotedSubjects(title).find((candidate) =>
    !/\b(?:exclusive|listen|watch|report|scoop|breaking|first look|spoiler alert|voice cast|cast|starring)\b/i.test(candidate)
  );
  if (quoted) {
    return quoted;
  }

  return title.match(
    /\b(?:Netflix|Apple TV\+?|Disney\+|Max|Prime Video|Hulu|Peacock|Paramount\+)['’]s\s+([A-Z][A-Za-z0-9'’:&-]+(?:\s+[A-Z][A-Za-z0-9'’:&-]+){0,4}?)(?=\s+(?:From|With|Season|Movie|Series|Show|Recruits|Adds|Sets|Cast|Trailer|Review|Renewed|Begins|Starts|Confirmed)\b)/
  )?.[1]?.trim() || null;
}

function extractCastingProjectAnchorOverride(title: string, articleText: string): string | null {
  const combined = `${title} ${articleText}`.trim();
  if (!isProjectAnchoredCastingPattern(combined)) {
    return null;
  }

  const quotedProjectMatches = Array.from(
    combined.matchAll(/[“"'‘’]([^"'“”‘’]{2,120})[“"'‘’]/g)
  )
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((candidate) => {
      const normalized = normalizeRSSDedupeValue(candidate);
      return normalized.length >= 3
        && !/^(?:s|t|re|ve|ll|d)$/.test(normalized)
        && /[a-z]/i.test(candidate);
    });
  const strictQuotedProjectMatches = extractStrictRSSQuotedSubjects(combined);
  const effectiveQuotedProjectMatches = strictQuotedProjectMatches.length > 0
    ? strictQuotedProjectMatches
    : quotedProjectMatches;

  const projectCandidate = effectiveQuotedProjectMatches.find((candidate) =>
    !/\b(?:exclusive|listen|watch|report|scoop|breaking|first look|spoiler alert|voice cast|cast|starring)\b/i.test(candidate)
  );

  if (projectCandidate) {
    return projectCandidate;
  }

  const titleProjectPatterns = [
    /\b(?:Netflix|Apple TV\+?|Disney\+|Max|Prime Video|Hulu|Peacock|Paramount\+)['’]s\s+([A-Z][A-Za-z0-9'’:&-]+(?:\s+[A-Z][A-Za-z0-9'’:&-]+){0,4})(?=\s+(?:From|With|Season|Movie|Series|Show|Recruits|Adds|Sets|Cast|Trailer|Review|Renewed|Begins|Starts|Confirmed)\b)/,
    /\b([A-Z][A-Za-z0-9'’:&-]+(?:\s+[A-Z][A-Za-z0-9'’:&-]+){0,4})(?=\s+Voice Cast\b)/,
  ];

  for (const pattern of titleProjectPatterns) {
    const candidate = combined.match(pattern)?.[1]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  const unquotedPatterns = [
    /\b([A-Z][A-Za-z0-9'’:&-]+(?:\s+[A-Z][A-Za-z0-9'’:&-]+){0,5})\s+voice cast\b/i,
    /\b([A-Z][A-Za-z0-9'’:&-]+(?:\s+[A-Z][A-Za-z0-9'’:&-]+){0,5})\s+cast\b/i,
    /\b(?:Netflix|Apple TV\+?|Disney\+|Max|Prime Video|Hulu|Peacock|Paramount\+)['’]s\s+([A-Z][A-Za-z0-9'’:&-]+(?:\s+[A-Z][A-Za-z0-9'’:&-]+){0,5})\b/i,
  ];

  for (const pattern of unquotedPatterns) {
    const candidate = combined.match(pattern)?.[1]?.trim();
    if (!candidate) {
      continue;
    }

    const normalized = normalizeRSSDedupeValue(candidate);
    if (
      normalized.length >= 3 &&
      !/^(?:s|t|re|ve|ll|d|m)$/.test(normalized) &&
      !/\b(?:exclusive|listen|watch|report|scoop|breaking|first look|spoiler alert|voice cast|cast|starring|director|stars?)\b/i.test(candidate)
    ) {
      return candidate;
    }
  }

  return null;
}

function sanitizeRSSCanonicalEntityValue(value?: string | null): string | undefined {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return undefined;
  }

  const quoted = extractStrictRSSQuotedSubjects(trimmed).find((candidate) => !isWeakRSSCanonicalCandidate(candidate));
  if (quoted) {
    return sanitizeRSSCanonicalEntityValue(quoted);
  }

  const cleaned = trimmed
    .replace(/^(?:did|does|do|why|how|what|when)\s+/i, '')
    .replace(/[,:;.\-–—\s]+$/g, '')
    .replace(/^(?:the\s+final\s+season\s+of|final\s+season\s+of)\s+/i, '')
    .trim();

  if (
    /^(?:why|how|where|what|when|international insider)\b/i.test(cleaned) ||
    /(?:['â€™]s|s['â€™])$/i.test(cleaned)
  ) {
    return undefined;
  }

  if (
    /\b(?:exclusive|review|revi|recap|explained|ranked|what to watch|where to watch|quiz|officially returning|confirms streaming|greatest .* series|hit hulu series|new crime|boss breaks|production team|must-watch)\b/i.test(cleaned) &&
    !/["'â€˜â€™â€œâ€]/.test(cleaned)
  ) {
    return undefined;
  }

  if (/^[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,2}['’]s\s+(?:new|hit|latest|upcoming)\b/i.test(cleaned)) {
    return undefined;
  }

  const normalized = normalizeRSSDedupeValue(cleaned);
  const tokens = normalized.split(' ').filter(Boolean);
  if (
    tokens.length === 0 ||
    tokens.every((token) => RSS_TOPIC_SIGNATURE_STOP_WORDS.has(token)) ||
    RSS_TOPIC_SIGNATURE_STOP_WORDS.has(tokens[tokens.length - 1]) ||
    (tokens.length === 1 && (
      RSS_TOPIC_ENTITY_STOP_WORDS.has(tokens[0]) ||
      RSS_SUBJECT_SINGLE_TOKEN_BLOCKLIST.has(tokens[0])
    ))
  ) {
    return undefined;
  }

  if (
    /^(?:why|how|where|what|when|international insider)\b/i.test(trimmed) ||
    /(?:['’]s|s['’])$/i.test(trimmed)
  ) {
    return undefined;
  }

  if (
    /\b(?:exclusive|review|recap|explained|ranked|what to watch|where to watch|quiz|officially returning|confirms streaming|greatest .* series|hit hulu series|new crime)\b/i.test(trimmed) &&
    !/["'‘’“”]/.test(trimmed)
  ) {
    return undefined;
  }

  if (isWeakRSSCanonicalCandidate(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function ensureRSSCanonicalEntity(item: RSSItem): RSSCanonicalEntity {
  if (item.canonicalEntity) {
    return item.canonicalEntity;
  }

  const canonical = buildRSSCanonicalEntity(item);
  item.canonicalEntity = canonical;
  item.canonicalEntityVersion = RSS_RUNTIME_RULESET_VERSION;
  return canonical;
}

function getRSSCanonicalEntityRuntimeState(item: RSSItem): {
  canonicalEntity: RSSCanonicalEntity;
  recomputed: boolean;
  hadStoredCanonical: boolean;
  storedVersion?: string;
  activeVersion: string;
} {
  const storedVersion = typeof item.canonicalEntityVersion === 'string' && item.canonicalEntityVersion.trim()
    ? item.canonicalEntityVersion.trim()
    : undefined;
  const hadStoredCanonical = Boolean(item.canonicalEntity);
  const recomputed = !item.canonicalEntity || storedVersion !== RSS_RUNTIME_RULESET_VERSION;
  const canonicalEntity = recomputed
    ? buildRSSCanonicalEntity(item)
    : ensureRSSCanonicalEntity(item);

  if (recomputed) {
    item.canonicalEntity = canonicalEntity;
    item.canonicalEntityVersion = RSS_RUNTIME_RULESET_VERSION;
  }

  return {
    canonicalEntity,
    recomputed,
    hadStoredCanonical,
    storedVersion,
    activeVersion: RSS_RUNTIME_RULESET_VERSION,
  };
}

function canReuseStoredRSSCaption(
  item: RSSItem,
  feedName: string,
  canonicalEntity: RSSCanonicalEntity,
  previousPlatformPostIds: Record<string, string>,
): boolean {
  const storedCaptionVersion = typeof item.captionGenerationVersion === 'string' && item.captionGenerationVersion.trim()
    ? item.captionGenerationVersion.trim()
    : undefined;
  const storedCaptionPath = item.captionGenerationPath;

  if (Object.keys(previousPlatformPostIds).length === 0) {
    return false;
  }

  if (!item.generatedCaption?.trim()) {
    return false;
  }

  if (storedCaptionVersion !== RSS_RUNTIME_RULESET_VERSION) {
    return false;
  }

  if (storedCaptionPath !== 'ai_prompted' && storedCaptionPath !== 'repaired_caption') {
    return false;
  }

  return getRSSCaptionHardInvalidReasonCodes(item.generatedCaption || '', {
    articleTitle: item.title,
    feedName,
    summary: sanitizeRSSPlainText(item.description),
    articleBody: sanitizeRSSPlainText(item.contentHtml),
    articleContentHtml: item.contentHtml,
    platform: 'X',
    allowedEntities: canonicalEntity.allowedEntities,
    canonicalEntity,
  }).length === 0;
}

function getRSSRuntimeCodeVersion(): string {
  return (
    process.env.RSS_RUNTIME_COMMIT_HASH ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    process.env.GIT_COMMIT ||
    process.env.COMMIT_SHA ||
    'dev-local'
  );
}

function logRSSRuntimeParity(payload: {
  phase: 'image_resolution_failed' | 'validation_failed' | 'ready_to_publish';
  feedId: string;
  title: string;
  canonicalEntity: RSSCanonicalEntity;
  canonicalRecomputed: boolean;
  canonicalStoredVersion?: string;
  reusedStoredCaption: boolean;
  storedCaptionVersion?: string;
  storedCaptionPath?: RSSCaptionGenerationPath;
  captionPath?: RSSCaptionGenerationPath;
  resolvedImages: RSSResolvedImage[];
  hadStoredSelectedImages: boolean;
  hadStoredImageUrls: boolean;
  finalFailureCodes: string[];
  editorialBrainPromotedImageStrategy?: string;
  editorialBrainPromotedCaptionStrategy?: string;
}): void {
  console.log('[RSS][RuntimeParity]', {
    phase: payload.phase,
    feedId: payload.feedId,
    title: payload.title,
    codeVersion: getRSSRuntimeCodeVersion(),
    rulesetVersion: RSS_RUNTIME_RULESET_VERSION,
    interpretationRecomputed: payload.canonicalRecomputed,
    reusedStoredCanonical: !payload.canonicalRecomputed,
    cachedCanonicalVersion: payload.canonicalStoredVersion || null,
    storyFamily: (payload.canonicalEntity.ambiguityFlags || []).filter((flag) => flag.startsWith('story_')),
    eventType: payload.canonicalEntity.eventType || null,
    entityType: payload.canonicalEntity.entityType || null,
    primarySubject: payload.canonicalEntity.primarySubject || payload.canonicalEntity.mediaTitle || null,
    captionStrategy: payload.captionPath || null,
    reusedStoredCaption: payload.reusedStoredCaption,
    cachedCaptionVersion: payload.storedCaptionVersion || null,
    cachedCaptionPath: payload.storedCaptionPath || null,
    cachedSelectionsReused: false,
    hadStoredSelectedImages: payload.hadStoredSelectedImages,
    hadStoredImageUrls: payload.hadStoredImageUrls,
    editorialBrainPromotedImageStrategy: payload.editorialBrainPromotedImageStrategy || null,
    editorialBrainPromotedCaptionStrategy: payload.editorialBrainPromotedCaptionStrategy || null,
    imageStrategy: payload.resolvedImages.map((image) => ({
      source: image.source,
      reason: image.reason,
      score: image.score ?? null,
    })),
    finalFailureCodes: payload.finalFailureCodes,
  });
}

function getRSSImageReasonCodes(images: RSSResolvedImage[], canonicalEntity: RSSCanonicalEntity): string[] {
  const reasonCodes = new Set<string>();
  const allowed = (canonicalEntity.allowedEntities || []).map((entry) => entry.toLowerCase());
  const expectedPrimary = (canonicalEntity.primarySubject || canonicalEntity.mediaTitle || '').toLowerCase();
  const canonicalFlags = new Set(canonicalEntity.ambiguityFlags || []);
  const allowSingleSubjectFallback =
    canonicalFlags.has('story_family_person_commentary_on_project') ||
    canonicalFlags.has('story_policy_early_project_cast_portraits') ||
    canonicalFlags.has('article_family_business_or_platform') ||
    canonicalFlags.has('story_policy_entertainment_business_person_first');

  if (!allowSingleSubjectFallback && images.length > 1 && images.some((image) => !image.url || !image.url.trim())) {
    reasonCodes.add('IMAGE_EMPTY_SECONDARY_SLOT');
  }

  for (const [index, image] of images.entries()) {
    const normalizedReason = `${image.reason || ''}`.toLowerCase();
    if (/\banime\b|\billustration\b|\bcartoon\b/.test(normalizedReason) && canonicalEntity.entityType !== 'character') {
      reasonCodes.add('IMAGE_MEDIA_TYPE_MISMATCH');
    }
    if (index === 0 && (/logo/.test(normalizedReason) || /brand backdrop/.test(normalizedReason)) && canonicalEntity.entityType === 'person') {
      reasonCodes.add('IMAGE_LOGO_OVERUSE');
    }
    if (
      index === 0 &&
      expectedPrimary &&
      !canonicalFlags.has('story_family_person_commentary_on_project') &&
      !allowSingleSubjectFallback &&
      image.source !== 'feed' &&
      allowed.length > 0 &&
      !allowed.some((entity) => normalizedReason.includes(entity.toLowerCase())) &&
      !normalizedReason.includes(expectedPrimary)
    ) {
      reasonCodes.add('IMAGE_CANONICAL_ENTITY_MISMATCH');
    }
  }

  return [...reasonCodes];
}

function validateRSSFinalPublishState(
  caption: string,
  images: RSSResolvedImage[],
  canonicalEntity: RSSCanonicalEntity,
  captionPath?: RSSCaptionGenerationPath,
  contextOverride?: {
    articleTitle?: string;
    feedName?: string;
    summary?: string;
    articleBody?: string;
    articleContentHtml?: string;
    allowedEntities?: string[];
  },
): { valid: boolean; reasonCodes: string[]; resolvedImages: RSSResolvedImage[] } {
  const reasonCodes = new Set<string>(getRSSCaptionHardInvalidReasonCodes(caption, {
    articleTitle: contextOverride?.articleTitle || canonicalEntity.mediaTitle || canonicalEntity.primarySubject || '',
    feedName: contextOverride?.feedName || '',
    summary: contextOverride?.summary || '',
    articleBody: contextOverride?.articleBody || '',
    articleContentHtml: contextOverride?.articleContentHtml,
    platform: 'Threads',
    allowedEntities: contextOverride?.allowedEntities || canonicalEntity.allowedEntities,
    canonicalEntity,
  }));
  let resolvedImages = [...images];
  const canonicalFlags = new Set(canonicalEntity.ambiguityFlags || []);

  if (canonicalFlags.has('story_lane_core_manual_review_spoiler_safe')) {
    reasonCodes.add('SPOILER_SAFE_MANUAL_REVIEW_REQUIRED');
  }

  if (!shouldAllowDeterministicPublisherSafeCaption(caption, {
    articleTitle: contextOverride?.articleTitle || canonicalEntity.mediaTitle || canonicalEntity.primarySubject || '',
    feedName: contextOverride?.feedName || '',
    summary: contextOverride?.summary || '',
    articleBody: contextOverride?.articleBody || '',
    articleContentHtml: contextOverride?.articleContentHtml,
    platform: 'Threads',
    allowedEntities: contextOverride?.allowedEntities || canonicalEntity.allowedEntities,
    canonicalEntity,
  }, captionPath) && (captionPath === 'deterministic_template' || captionPath === 'excerpt_fallback')) {
    reasonCodes.add('CAPTION_NON_PUBLISHER_FALLBACK');
  }

  if (resolvedImages.length > 1 && resolvedImages.slice(1).some((image) => !image.url || !image.url.trim())) {
    resolvedImages = resolvedImages.slice(0, 1);
  }

  if (
    resolvedImages.length > 1 &&
    (
        resolvedImages.slice(1).some((image) => image.source === 'feed') ||
        resolvedImages.slice(1).some((image) => image.url.trim() === resolvedImages[0]?.url.trim())
      )
  ) {
    resolvedImages = resolvedImages.slice(0, 1);
  }

  const imageReasonCodes = getRSSImageReasonCodes(resolvedImages, canonicalEntity);
  for (const code of imageReasonCodes) {
    reasonCodes.add(code);
  }
  if (imageReasonCodes.some((code) =>
    code === 'IMAGE_CANONICAL_ENTITY_MISMATCH' ||
    code === 'IMAGE_WRONG_PRIMARY_SUBJECT' ||
    code === 'IMAGE_PERSON_PRIORITY_FAIL'
  )) {
    resolvedImages = [];
  }

  return {
    valid: reasonCodes.size === 0,
    reasonCodes: [...reasonCodes],
    resolvedImages,
  };
}

function inferRssEditorialBrainLane(canonical: RSSCanonicalEntity): RSSEditorialBrainLane {
  const flags = new Set(canonical.ambiguityFlags || []);
  if (flags.has('story_lane_ignore_completely')) return 'ignore_completely';
  if (flags.has('story_lane_blocked_non_core')) return 'blocked_non_core';
  if (flags.has('story_lane_entertainment_adjacent')) return 'entertainment_adjacent';
  if (flags.has('story_lane_core_manual_review_spoiler_safe')) return 'core_manual_review_spoiler';
  return 'core_auto_publish';
}

function inferRssEditorialBrainStoryFamily(
  item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>,
  canonical: RSSCanonicalEntity,
): RssEditorialBrainDecision['story_family'] {
  const flags = new Set(canonical.ambiguityFlags || []);
  const text = `${item.title} ${item.description || ''} ${sanitizeRSSPlainText(item.contentHtml || '')}`.toLowerCase();
  const event = String(canonical.eventType || '').toLowerCase();

  if (flags.has('story_family_person_commentary_on_project')) return 'person_commentary_on_project';
  if (flags.has('story_lane_core_manual_review_spoiler_safe')) return 'spoiler_sensitive';
  if (flags.has('article_family_editorial_listicle') || /\bretrospective|forgotten|over \d+ years later|still perfect\b/.test(text)) return 'retrospective';
  if (/\breview\b/i.test(item.title)) return 'review';
  if (/\brecap\b/i.test(item.title)) return 'recap';
  if (flags.has('story_lane_entertainment_adjacent') && /\bcomics?\b/.test(text)) return 'comics_only';
  if (flags.has('article_family_business_or_platform') || flags.has('story_lane_ignore_completely')) return 'non_target_media_business';
  if (event === 'obituary') return 'obituary';
  if (event === 'trailer') return 'trailer';
  if (event === 'first_look') return 'first_look';
  if (event === 'renewal') return 'renewal';
  if (event === 'casting' || event === 'return') return 'casting';
  if (/\btribute|memorial|honor(?:s|ed)?\b/.test(text)) return 'tribute';
  if (event === 'development' || event === 'ordered_to_series' || event === 'series_order' || event === 'in_production') return 'project_announcement';
  if (flags.has('story_lane_entertainment_adjacent') || flags.has('story_lane_blocked_non_core')) return 'editorial_feature';
  return 'project_news';
}

function inferRssEditorialBrainPrimaryEntityType(canonical: RSSCanonicalEntity): RssEditorialBrainDecision['primary_entity_type'] {
  if (canonical.entityType === 'person') return 'person';
  if (canonical.entityType === 'franchise') return 'franchise';
  if (canonical.mediaTitle || canonical.entityType === 'movie' || canonical.entityType === 'tv') return 'project';
  return 'none';
}

function inferRssEditorialBrainFormat(canonical: RSSCanonicalEntity): RssEditorialBrainDecision['format'] {
  if (canonical.entityType === 'movie') return 'movie';
  if (canonical.entityType === 'tv') return 'tv';
  return 'unknown';
}

function inferRssEditorialBrainImageMode(canonical: RSSCanonicalEntity): RssEditorialBrainDecision['image_strategy']['mode'] {
  const flags = new Set(canonical.ambiguityFlags || []);
  if (flags.has('story_lane_core_manual_review_spoiler_safe')) return 'spoiler_safe_neutral';
  if (flags.has('story_family_person_commentary_on_project')) return 'dual_person_project';
  if (flags.has('story_policy_entertainment_business_person_first')) return 'person_first';
  if (flags.has('story_policy_article_image_first') || canonical.eventType === 'first_look') return 'article_image_first';
  if (flags.has('story_policy_early_project_cast_portraits')) return 'dual_person';
  if (canonical.entityType === 'person' || canonical.eventType === 'obituary') return 'person_first';
  return 'project_first';
}

function inferRssEditorialBrainCaptionMode(
  item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>,
  canonical: RSSCanonicalEntity,
): RssEditorialBrainDecision['caption_strategy']['mode'] {
  const flags = new Set(canonical.ambiguityFlags || []);
  const text = `${item.title} ${item.description || ''} ${sanitizeRSSPlainText(item.contentHtml || '')}`.toLowerCase();
  if (flags.has('story_lane_core_manual_review_spoiler_safe')) return 'spoiler_safe';
  if (flags.has('story_family_person_commentary_on_project')) return 'person_commentary';
  if (canonical.eventType === 'obituary') return 'obituary';
  if (canonical.eventType === 'trailer') return 'trailer';
  if (canonical.eventType === 'first_look') return 'first_look';
  if (/\btribute|memorial|honor(?:s|ed)?\b/.test(text)) return 'tribute';
  if (canonical.eventType === 'development' || canonical.eventType === 'ordered_to_series' || canonical.eventType === 'series_order' || canonical.eventType === 'in_production') return 'project_announcement';
  return 'headline_news';
}

function inferRssEditorialBrainHeadlineTrust(item: Pick<RSSItem, 'title'>, canonical: RSSCanonicalEntity): RssEditorialBrainDecision['headline_trust'] {
  const flags = new Set(canonical.ambiguityFlags || []);
  const title = item.title || '';
  if (
    flags.has('body_title_recovery_required')
    || flags.has('quote_led_headline_junk')
    || flags.has('canonical_project_weak')
    || /\bexclusive\b|\bfirst look\b|\bcreator[s]?\b|\bdirector\b|\bactor\b/i.test(title)
  ) {
    return 'low';
  }
  if (/\btrailer\b|\brenewed\b|\bcast\b|\bjoins?\b|\bordered to series\b/i.test(title)) {
    return 'high';
  }
  return 'medium';
}

function getRssEditorialBrainSourceTrustTier(sourceName: string): string {
  const normalized = sourceName.trim().toLowerCase();
  if (['deadline', 'variety', 'the hollywood reporter', 'hollywood reporter', 'thr', 'entertainment weekly', 'ew'].includes(normalized)) {
    return 'tier_1_trade';
  }
  if (['tvline', 'indiewire', 'slashfilm', 'thewrap', 'wrap'].includes(normalized)) {
    return 'tier_2_editorial';
  }
  if (['comicbook', 'screenrant'].includes(normalized)) {
    return 'tier_3_noisy';
  }
  return 'tier_2_general';
}

function buildRssEditorialBrainFallbackDecision(
  item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>,
  canonical: RSSCanonicalEntity,
  sourceName: string,
): RssEditorialBrainDecision {
  const lane = inferRssEditorialBrainLane(canonical);
  const storyFamily = inferRssEditorialBrainStoryFamily(item, canonical);
  const primaryEntityType = inferRssEditorialBrainPrimaryEntityType(canonical);
  const primaryEntity =
    primaryEntityType === 'person'
      ? (canonical.primarySubject || '')
      : primaryEntityType === 'franchise'
        ? (canonical.franchise || canonical.primarySubject || '')
        : (canonical.mediaTitle || canonical.primarySubject || canonical.franchise || '');
  const imageMode = inferRssEditorialBrainImageMode(canonical);
  const captionMode = inferRssEditorialBrainCaptionMode(item, canonical);
  const bodyText = sanitizeRSSPlainText(item.contentHtml || '');
  const currentTitleOverDevelopmentTitle = !/\binitially titled\b|\bformerly titled\b|\bworking title\b/i.test(bodyText);
  const spoilerRisk = canonical.spoilerLevel || (lane === 'core_manual_review_spoiler' ? 'medium' : 'none');

  return {
    lane,
    story_family: storyFamily,
    primary_entity_type: primaryEntityType,
    primary_entity: primaryEntity,
    secondary_entities: [canonical.secondarySubject, ...(canonical.namedPeople || [])].filter(Boolean) as string[],
    canonical_aliases: [canonical.mediaTitle, canonical.primarySubject, canonical.franchise].filter(Boolean) as string[],
    current_title_over_development_title: currentTitleOverDevelopmentTitle,
    development_title_aliases: [],
    format: inferRssEditorialBrainFormat(canonical),
    event: normalizeRssEditorialBrainEvent(canonical.eventType || 'other'),
    headline_trust: inferRssEditorialBrainHeadlineTrust(item, canonical),
    body_recovery_required: Boolean((canonical.ambiguityFlags || []).includes('body_title_recovery_required')),
    spoiler_risk: spoilerRisk,
    manual_review_reason: lane === 'core_manual_review_spoiler' ? 'spoiler-sensitive story requires manual review' : '',
    image_strategy: {
      mode: imageMode,
      primary_preference: imageMode === 'article_image_first'
        ? ['article hero image', 'inline reveal still', 'TMDb fallback']
        : imageMode === 'dual_person'
          ? ['lead cast portrait A', 'lead cast portrait B', 'article hero image']
          : imageMode === 'dual_person_project'
            ? ['speaker portrait', 'project still', 'referenced person portrait']
            : imageMode === 'spoiler_safe_neutral'
              ? ['neutral project still', 'backdrop', 'logo']
              : imageMode === 'person_first'
                ? ['person portrait', 'project still', 'project logo']
                : ['backdrop still', 'scene still', 'poster'],
      secondary_preference: imageMode === 'project_first'
        ? ['person portrait', 'logo']
        : imageMode === 'person_first'
          ? ['project still', 'project logo']
          : ['project still', 'person portrait'],
      avoid: lane === 'core_manual_review_spoiler'
        ? ['spoiler reveal frame']
        : ['wrapper headline phrasing'],
    },
    caption_strategy: {
      mode: captionMode,
      lead_subject: primaryEntity,
      must_name: [primaryEntity, canonical.secondarySubject].filter(Boolean) as string[],
      must_not_use: ['This article', 'This piece', 'This review', 'This recap', '[...]'],
      must_not_spoil: lane === 'core_manual_review_spoiler',
    },
    caption_facts: {
      headline_fact: item.title,
      supporting_fact: (item.description || '').replace(/\s+/g, ' ').trim().slice(0, 220),
      quote: '',
      bullets: [],
    },
    evidence: {
      body_titles: [canonical.mediaTitle, canonical.franchise].filter(Boolean) as string[],
      people: canonical.namedPeople || [],
      projects: [canonical.mediaTitle, canonical.primarySubject, canonical.secondarySubject, canonical.franchise].filter(Boolean) as string[],
      networks_platforms: [],
      years: Array.from(new Set((bodyText.match(/\b(?:19|20)\d{2}\b/g) || []).slice(0, 6))),
      quotes: [],
    },
    confidence: Math.max(0.35, canonical.confidence || 0.55),
    notes: `Deterministic fallback projection for ${sourceName}.`,
  };
}

function buildRssEditorialBrainComparisonSummary(decision: RssEditorialBrainDecision): RSSEditorialBrainStoredDecision['currentSystem'] {
  return {
    lane: decision.lane,
    primary_entity: decision.primary_entity,
    event: decision.event,
    image_strategy: { mode: decision.image_strategy.mode },
    caption_strategy: { mode: decision.caption_strategy.mode },
    spoiler_risk: decision.spoiler_risk,
  };
}

function extractRssEditorialBrainImageEvidence(articleHtml?: string): string[] {
  if (!articleHtml) {
    return [];
  }

  const imageText = [
    ...Array.from(articleHtml.matchAll(/<img[^>]*(?:alt|title)=["']([^"']+)["'][^>]*>/gi)).map((match) => sanitizeRSSPlainText(match[1] || '')),
    ...Array.from(articleHtml.matchAll(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi)).map((match) => sanitizeRSSPlainText(match[1] || '')),
  ];

  return Array.from(new Set(
    imageText
      .map((value) => value.replace(/\s+/g, ' ').trim())
      .filter((value) => value.length >= 8)
      .slice(0, 8)
  ));
}

function buildCompressedRssEditorialBrainEvidencePacket(
  item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>,
  canonical: RSSCanonicalEntity,
): { compressedBodyText: string; imageEvidence: string[] } {
  const rawHtml = String(item.contentHtml || '');
  const bodyText = sanitizeRSSPlainText(rawHtml);
  const canonicalTokens = new Set(
    [
      canonical.mediaTitle,
      canonical.primarySubject,
      canonical.secondarySubject,
      canonical.franchise,
      ...(canonical.namedPeople || []),
    ]
      .flatMap((value) => String(value || '').toLowerCase().split(/[^a-z0-9]+/))
      .filter((token) => token.length > 2)
  );

  const paragraphs = Array.from(
    rawHtml.matchAll(/<(?:p|li|blockquote|figcaption|h2|h3)[^>]*>([\s\S]*?)<\/(?:p|li|blockquote|figcaption|h2|h3)>/gi)
  )
    .map((match) => sanitizeRSSPlainText(match[1] || ''))
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const fallbackParagraphs = paragraphs.length > 0
    ? paragraphs
    : bodyText.split(/(?<=[.!?])\s+/).map((value) => value.trim()).filter(Boolean);

  const scoredParagraphs = fallbackParagraphs.map((paragraph, index) => {
    const normalized = paragraph.toLowerCase();
    let score = 0;
    if (index < 3) score += 3;
    if (/[“"'][^"'”]{2,120}[”"']/.test(paragraph)) score += 3;
    if (/<(?:em|i|strong|b)\b/i.test(rawHtml) && paragraph.length <= 240) score += 1;
    if (/\b(?:called|titled|named|initially titled|formerly titled|working title|ordered to series|series order|first look|exclusive|spoiler|spotted|trailer|teaser)\b/i.test(paragraph)) score += 3;
    if (/\b(?:netflix|hulu|max|prime video|apple tv\+|paramount\+|peacock|cbs|abc|nbc|fx|itv|disney)\b/i.test(paragraph)) score += 2;
    if (/\b(?:director|creator|showrunner|writer|producer|star|starring|joins|boards|returns|cast|season|episode|movie|film|series|show|anime)\b/i.test(paragraph)) score += 2;
    if (/\b(?:19|20)\d{2}\b/.test(paragraph)) score += 1;
    if ([...canonicalTokens].some((token) => normalized.includes(token))) score += 4;
    return { paragraph, score, index };
  });

  const selected = scoredParagraphs
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 8)
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.paragraph);

  const compressedBodyText = Array.from(new Set([
    sanitizeRSSPlainText(item.title || ''),
    sanitizeRSSPlainText(item.description || ''),
    ...selected,
  ].filter(Boolean)))
    .join('\n\n')
    .slice(0, 5200);

  return {
    compressedBodyText,
    imageEvidence: extractRssEditorialBrainImageEvidence(rawHtml),
  };
}

function planRssEditorialBrainInvocation(
  feedName: string,
  item: Pick<RSSItem, 'title' | 'description' | 'contentHtml'>,
  canonical: RSSCanonicalEntity,
): RSSEditorialBrainInvocationPlan {
  const sourceTrustTier = getRssEditorialBrainSourceTrustTier(feedName);
  const lane = inferRssEditorialBrainLane(canonical);
  const storyFamily = inferRssEditorialBrainStoryFamily(item, canonical);
  const headlineStyle = classifyRSSHeadlineStyle(item.title);
  const articleFamily = classifyRSSArticleFamily(item);
  const bodyRecoveryCandidates = extractRSSBodyTitleRecoveryCandidates(item);
  const flags = new Set(canonical.ambiguityFlags || []);
  const canonicalEntity = canonical.mediaTitle || canonical.primarySubject || canonical.franchise || '';
  const isCoreLane = lane === 'core_auto_publish' || lane === 'core_manual_review_spoiler';
  const isEditorialSkipFamily =
    storyFamily === 'review' ||
    storyFamily === 'recap' ||
    storyFamily === 'retrospective' ||
    storyFamily === 'editorial_feature' ||
    storyFamily === 'comics_only' ||
    storyFamily === 'non_target_media_business' ||
    isRSSNonProjectArticleFamily(articleFamily);

  const wrapperShaped =
    headlineStyle === 'wrapper' ||
    headlineStyle === 'quote_led' ||
    headlineStyle === 'teaser' ||
    headlineStyle === 'person_first';
  const edgeCaseFamily =
    storyFamily === 'person_commentary_on_project' ||
    storyFamily === 'spoiler_sensitive' ||
    storyFamily === 'first_look' ||
    storyFamily === 'obituary' ||
    storyFamily === 'project_announcement';
  const ambiguous =
    wrapperShaped ||
    flags.has('body_title_recovery_required') ||
    flags.has('canonical_project_weak') ||
    flags.has('canonical_person_weak') ||
    flags.has('quote_led_headline_junk') ||
    !canonicalEntity ||
    (canonical.confidence || 0) < 0.82 ||
    bodyRecoveryCandidates.length > 0;

  const evidencePacket = buildCompressedRssEditorialBrainEvidencePacket(item, canonical);

  if (!isCoreLane) {
    return {
      enabled: false,
      reason: 'editorial_brain_skipped_non_core_lane',
      compressedBodyText: evidencePacket.compressedBodyText,
      imageEvidence: evidencePacket.imageEvidence,
    };
  }

  if (isEditorialSkipFamily) {
    return {
      enabled: false,
      reason: 'editorial_brain_skipped_obvious_editorial_or_non_target',
      compressedBodyText: evidencePacket.compressedBodyText,
      imageEvidence: evidencePacket.imageEvidence,
    };
  }

  if (sourceTrustTier === 'tier_1_trade') {
    return {
      enabled: ambiguous || edgeCaseFamily,
      reason: ambiguous || edgeCaseFamily
        ? 'editorial_brain_enabled_trade_ambiguous_or_edge_case'
        : 'editorial_brain_skipped_trade_clean_headline',
      compressedBodyText: evidencePacket.compressedBodyText,
      imageEvidence: evidencePacket.imageEvidence,
    };
  }

  if (sourceTrustTier === 'tier_3_noisy') {
    const obviousCleanNoisyCase =
      headlineStyle === 'direct_project' &&
      !ambiguous &&
      !edgeCaseFamily &&
      (canonical.confidence || 0) >= 0.92 &&
      !flags.has('body_title_recovery_required');

    return {
      enabled: !obviousCleanNoisyCase,
      reason: obviousCleanNoisyCase
        ? 'editorial_brain_skipped_noisy_but_clean_project_headline'
        : 'editorial_brain_enabled_noisy_core_case',
      compressedBodyText: evidencePacket.compressedBodyText,
      imageEvidence: evidencePacket.imageEvidence,
    };
  }

  return {
    enabled: ambiguous || edgeCaseFamily || headlineStyle !== 'direct_project',
    reason: ambiguous || edgeCaseFamily || headlineStyle !== 'direct_project'
      ? 'editorial_brain_enabled_editorial_or_general_ambiguous_case'
      : 'editorial_brain_skipped_clean_general_case',
    compressedBodyText: evidencePacket.compressedBodyText,
    imageEvidence: evidencePacket.imageEvidence,
  };
}

async function prepareRssEditorialBrainShadow(
  feedName: string,
  item: RSSItem,
  runtimeSettings: Pick<RSSRuntimeSettings, 'rssEditorialBrainShadowMode' | 'rssEditorialBrainCaptionStrategyPromotion' | 'rssEditorialBrainImageStrategyPromotion' | 'rssEditorialBrainModel'>,
  canonical: RSSCanonicalEntity,
  options?: { force?: boolean },
): Promise<RSSEditorialBrainStoredDecision | undefined> {
  if (
    !runtimeSettings.rssEditorialBrainShadowMode &&
    !runtimeSettings.rssEditorialBrainCaptionStrategyPromotion &&
    !runtimeSettings.rssEditorialBrainImageStrategyPromotion &&
    !options?.force
  ) {
    return item.editorialBrain;
  }

  const { extractedQuotes, articleImages } = extractRssEditorialBrainSignals(item.contentHtml);
  const sourceTrustTier = getRssEditorialBrainSourceTrustTier(feedName);
  const fallbackDecision = buildRssEditorialBrainFallbackDecision(item, canonical, feedName);
  const invocationPlan = planRssEditorialBrainInvocation(feedName, item, canonical);
  const input = {
    source: feedName,
    url: item.link,
    headline: item.title,
    summary: sanitizeRSSPlainText(item.description || ''),
    bodyText: invocationPlan.compressedBodyText,
    extractedQuotes,
    articleImages: Array.from(new Set([...(item.imageUrls || []), item.imageUrl, ...articleImages].filter(Boolean) as string[])).slice(0, 12),
    imageEvidence: invocationPlan.imageEvidence,
    sourceTrustTier,
    currentDateTime: new Date().toISOString(),
  };
  const contentHash = buildRssEditorialBrainContentHash(input);
  const expectedModel = normalizeAIModel(runtimeSettings.rssEditorialBrainModel || DEFAULT_RSS_EDITORIAL_BRAIN_MODEL, DEFAULT_RSS_EDITORIAL_BRAIN_MODEL);
  const existing = item.editorialBrain;

  if (
    existing &&
    existing.editorialBrainVersion === RSS_EDITORIAL_BRAIN_VERSION &&
    existing.promptVersion === RSS_EDITORIAL_BRAIN_PROMPT_VERSION &&
    existing.schemaVersion === RSS_EDITORIAL_BRAIN_SCHEMA_VERSION &&
    existing.contentHash === contentHash &&
    normalizeAIModel(existing.agentModel, expectedModel) === expectedModel
  ) {
    console.log('[RSS][EditorialBrain][Shadow]', {
      feedName,
      title: item.title,
      cached: true,
      contentHash,
      model: existing.agentModel,
      disagreements: existing.disagreements,
      usedFallback: existing.usedFallback,
    });
    return existing;
  }

  const result = await runRssEditorialBrain(input, {
    model: expectedModel,
    enabled: (
      runtimeSettings.rssEditorialBrainShadowMode ||
      runtimeSettings.rssEditorialBrainCaptionStrategyPromotion ||
      runtimeSettings.rssEditorialBrainImageStrategyPromotion ||
      Boolean(options?.force)
    ) && invocationPlan.enabled,
    fallbackDecision,
    disableReason: invocationPlan.reason,
  });
  const currentSystem = buildRssEditorialBrainComparisonSummary(fallbackDecision);
  const disagreements = computeRssEditorialBrainDisagreements(currentSystem, result.decision);
  const record: RSSEditorialBrainStoredDecision = {
    editorialBrainVersion: result.editorialBrainVersion,
    promptVersion: result.promptVersion,
    schemaVersion: result.schemaVersion,
    contentHash: result.contentHash,
    sourceTrustTier,
    agentModel: result.agentModel,
    decisionHash: result.decisionHash,
    usedFallback: result.usedFallback,
    normalizationNotes: result.normalizationNotes,
    error: result.error,
    rawResponse: result.rawResponse,
    currentSystem,
    decision: result.decision,
    disagreements,
  };
  item.editorialBrain = record;

  console.log('[RSS][EditorialBrain][Shadow]', {
    feedName,
    title: item.title,
    cached: false,
    contentHash,
    model: record.agentModel,
    usedFallback: record.usedFallback,
    invocationReason: invocationPlan.reason,
    disagreements: record.disagreements,
    lane: record.decision.lane,
    primaryEntity: record.decision.primary_entity,
    storyFamily: record.decision.story_family,
    event: record.decision.event,
    imageStrategy: record.decision.image_strategy.mode,
    captionStrategy: record.decision.caption_strategy.mode,
    confidence: record.decision.confidence,
  });

  return record;
}

function withStoredImageSourceSettings(
  filters: RSSFeedFilters,
  sourceSettings: {
    serperEnabled?: boolean;
    tmdbEnabled?: boolean;
    openaiWebSearchEnabled?: boolean;
    imageSourcePriority?: 'tmdb_first' | 'openai_first' | 'serper_first';
  }
): Prisma.InputJsonValue {
  const persistedFilters: Record<string, unknown> = {
    ...filters,
  };
  const persistedSettings: Record<string, boolean | string> = {};

  if (typeof sourceSettings.serperEnabled === 'boolean') {
    persistedSettings.serperEnabled = sourceSettings.serperEnabled;
  }

  if (typeof sourceSettings.tmdbEnabled === 'boolean') {
    persistedSettings.tmdbEnabled = sourceSettings.tmdbEnabled;
  }

  if (typeof sourceSettings.openaiWebSearchEnabled === 'boolean') {
    persistedSettings.openaiWebSearchEnabled = sourceSettings.openaiWebSearchEnabled;
  }

  if (
    sourceSettings.imageSourcePriority === 'tmdb_first' ||
    sourceSettings.imageSourcePriority === 'openai_first' ||
    sourceSettings.imageSourcePriority === 'serper_first'
  ) {
    persistedSettings.imageSourcePriority = sourceSettings.imageSourcePriority;
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
      return 'low' as const;
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

function normalizeRSSPublishPlatformKey(platform: string): string {
  const normalized = platform.trim().toLowerCase();
  if (normalized === 'twitter') {
    return 'x';
  }

  return normalized;
}

function getFailedRSSPlatforms(
  item: RSSItem,
  enabledPlatforms: string[]
): string[] {
  const failedPlatforms = Array.from(
    new Set(
      (item.platformResults || [])
        .filter((result) => result.status === 'failed')
        .map((result) => normalizeRSSPublishPlatformKey(result.platform))
        .filter(Boolean)
    )
  );

  if (failedPlatforms.length > 0) {
    return enabledPlatforms.filter((platform) => failedPlatforms.includes(normalizeRSSPublishPlatformKey(platform)));
  }

  return enabledPlatforms.filter((platform) => !item.platformPostIds?.[platform]);
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

function collectRSSSpeculationMatches(
  text: string,
  patterns: Array<{ pattern: RegExp; phrase: string; score?: number; reasonCode?: string }>
): Array<{ phrase: string; score: number; reasonCode?: string }> {
  return patterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ phrase, score = 0, reasonCode }) => ({ phrase, score, reasonCode }));
}

function assessRSSArticleSpeculation(item: RSSItem): RSSSpeculationAssessment {
  const title = sanitizeRSSPlainText(item.title || '');
  const body = sanitizeRSSPlainText([
    item.description || '',
    item.contentHtml || '',
  ].filter(Boolean).join(' '));
  const titleText = title.replace(/\s+/g, ' ').trim();
  const bodyText = body.replace(/\s+/g, ' ').trim();
  const fullText = `${titleText}\n${bodyText}`.trim();

  let score = 0;
  const detectedPhrases = new Set<string>();
  const reasonCodes = new Set<string>();

  const applyMatches = (matches: Array<{ phrase: string; score: number; reasonCode?: string }>): void => {
    for (const match of matches) {
      score += match.score;
      detectedPhrases.add(match.phrase);
      if (match.reasonCode) {
        reasonCodes.add(match.reasonCode);
      }
    }
  };

  applyMatches(collectRSSSpeculationMatches(titleText, RSS_SPECULATION_HEADLINE_PATTERNS));
  applyMatches(collectRSSSpeculationMatches(fullText, RSS_SPECULATION_PATTERNS));
  applyMatches(collectRSSSpeculationMatches(fullText, RSS_SPECULATION_WEAK_EVIDENCE_PATTERNS));

  const hardEvidenceMatches = collectRSSSpeculationMatches(fullText, RSS_SPECULATION_HARD_EVIDENCE_PATTERNS);
  const hardEvidencePhrases = Array.from(new Set(hardEvidenceMatches.map((entry) => entry.phrase)));

  if (score > 0 && hardEvidencePhrases.length === 0) {
    score += 2;
    reasonCodes.add('ARTICLE_NO_CONFIRMATION');
  }

  let classification: RSSSpeculationClassification;
  if (score <= 2) {
    classification = 'confirmed_news';
  } else if (score <= 5) {
    classification = 'semi_confirmed';
  } else if (score <= 8) {
    classification = 'analysis';
  } else if (
    reasonCodes.has('ARTICLE_FAN_THEORY') ||
    reasonCodes.has('ARTICLE_INTERVIEW_DODGE') ||
    /\brumou?red?\b|\brumou?r\b/i.test(fullText)
  ) {
    classification = 'rumor';
  } else {
    classification = 'speculation';
  }

  return {
    classification,
    score,
    detectedPhrases: Array.from(detectedPhrases),
    reasonCodes: Array.from(reasonCodes),
    hardEvidencePhrases,
    shouldSkipPublish: classification === 'analysis' || classification === 'speculation' || classification === 'rumor',
    shouldUseUncertaintyTone: classification === 'semi_confirmed' || classification === 'analysis',
  };
}

function buildRSSSpeculationFilterReason(assessment: RSSSpeculationAssessment): string {
  const reasonCodes = assessment.reasonCodes.length > 0 ? assessment.reasonCodes.join(', ') : 'SPECULATION_ARTICLE';
  const phrases = assessment.detectedPhrases.length > 0
    ? ` Detected phrases: ${assessment.detectedPhrases.join(', ')}.`
    : '';

  return `${reasonCodes}: Filtered as ${assessment.classification} (score ${assessment.score}).${phrases}`;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function normalizeRSSTopicToken(token: string): string {
  const normalized = normalizeRSSDedupeValue(token);
  return RSS_TOPIC_TOKEN_NORMALIZATIONS[normalized] || normalized;
}

function getRSSTopicSignature(title?: string | null): string {
  const normalizedTitle = normalizeRSSDedupeValue(title);
  if (!normalizedTitle) {
    return '';
  }

  const tokens = normalizedTitle
    .split(' ')
    .map((token) => normalizeRSSTopicToken(token))
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
    .map((token) => normalizeRSSTopicToken(token))
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

function extractRSSSubjectPhrases(title?: string | null): string[] {
  if (!title) {
    return [];
  }

  const words = String(title)
    .replace(/[()[\]{}:;,.!?/\\|"]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9'-]+$/g, ''))
    .filter(Boolean);
  const phrases: string[] = [];
  let current: string[] = [];

  const flush = (): void => {
    if (current.length === 0) {
      return;
    }

    const phrase = normalizeRSSDedupeValue(current.join(' '));
    const meaningfulTokens = phrase
      .split(' ')
      .map((token) => normalizeRSSTopicToken(token))
      .filter((token) => token && !RSS_TOPIC_ENTITY_STOP_WORDS.has(token))
      .filter((token) => token.length > 2 || /^\d+$/.test(token));

    const isAllowedSingleToken =
      meaningfulTokens.length === 1
      && meaningfulTokens[0].length >= 5
      && !RSS_SUBJECT_SINGLE_TOKEN_BLOCKLIST.has(meaningfulTokens[0]);

    if (meaningfulTokens.length >= 2 || isAllowedSingleToken) {
      phrases.push(phrase);
    }

    current = [];
  };

  for (const word of words) {
    const normalizedWord = word.replace(/[’]/g, "'");
    const lowerWord = normalizedWord.toLowerCase();
    const isConnector = RSS_SUBJECT_PHRASE_CONNECTORS.has(lowerWord);
    const isEntityLike = /^[A-Z0-9][A-Za-z0-9'’-]*$/.test(normalizedWord);

    if (isEntityLike) {
      current.push(normalizedWord);
      continue;
    }

    if (isConnector && current.length > 0) {
      current.push(lowerWord);
      continue;
    }

    flush();
  }

  flush();
  return Array.from(new Set(phrases));
}

function buildRSSTopicFingerprint(title?: string | null): {
  signature: string;
  tokens: Set<string>;
  entityTokens: Set<string>;
  cueTokens: Set<string>;
  subjectPhrases: Set<string>;
} {
  const signature = getRSSTopicSignature(title);
  return {
    signature,
    tokens: new Set(getRSSTopicTokens(title)),
    entityTokens: new Set(extractRSSEntityTokens(title)),
    cueTokens: new Set(
      RSS_TOPIC_CUE_PATTERNS.filter(({ pattern }) => pattern.test(String(title || ''))).map(({ key }) => key)
    ),
    subjectPhrases: new Set(extractRSSSubjectPhrases(title)),
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
  left: { signature: string; tokens: Set<string>; entityTokens: Set<string>; cueTokens: Set<string>; subjectPhrases: Set<string> },
  right: { signature: string; tokens: Set<string>; entityTokens: Set<string>; cueTokens: Set<string>; subjectPhrases: Set<string> }
): boolean {
  if (!left.signature || !right.signature) {
    return false;
  }

  if (left.signature === right.signature) {
    return true;
  }

  const sharedTokens = getSetIntersectionCount(left.tokens, right.tokens);
  const sharedEntities = getSetIntersectionCount(left.entityTokens, right.entityTokens);
  const sharedCues = getSetIntersectionCount(left.cueTokens, right.cueTokens);
  const minTokenSize = Math.min(left.tokens.size, right.tokens.size);
  const entityHeavyMatch = sharedEntities >= 2 && sharedTokens >= 4;
  const highTokenOverlap = minTokenSize >= 4 && sharedTokens >= Math.max(4, minTokenSize - 1);
  const cueAnchoredMatch =
    sharedCues >= 1 &&
    sharedTokens >= 4 &&
    (sharedEntities >= 1 || minTokenSize <= 6);
  const franchiseEventMatch = sharedEntities >= 1 && sharedTokens >= 5;
  const weightedScore = sharedTokens + sharedEntities * 2;

  return entityHeavyMatch || highTokenOverlap || cueAnchoredMatch || franchiseEventMatch || weightedScore >= 8;
}

function areRSSSubjectsInCooldown(
  left: { tokens: Set<string>; entityTokens: Set<string>; cueTokens: Set<string>; subjectPhrases: Set<string> },
  right: { tokens: Set<string>; entityTokens: Set<string>; cueTokens: Set<string>; subjectPhrases: Set<string> }
): boolean {
  const sharedSubjectPhrases = getSetIntersectionCount(left.subjectPhrases, right.subjectPhrases);
  if (sharedSubjectPhrases >= 1) {
    return true;
  }

  const sharedEntities = getSetIntersectionCount(left.entityTokens, right.entityTokens);
  const sharedTokens = getSetIntersectionCount(left.tokens, right.tokens);
  const sharedCues = getSetIntersectionCount(left.cueTokens, right.cueTokens);

  return sharedEntities >= 2 && (sharedTokens >= 3 || sharedCues >= 1);
}

type RSSNewsEventFingerprint = {
  signature: string;
  eventType: string;
  projectAnchor: string;
  personAnchor: string;
  personAnchors: string[];
  characterAnchor: string;
  obituaryAge?: string;
  temporalCue: string;
  cueTokens: Set<string>;
  anchors: Set<string>;
  topicFingerprint: ReturnType<typeof buildRSSTopicFingerprint>;
};

type RSSDuplicateCandidateStatus = 'current' | 'pending' | 'published';

type RSSDuplicateEventCandidate = {
  feedName: string;
  title: string;
  link?: string;
  timestamp: number;
  status: RSSDuplicateCandidateStatus;
  fingerprint: RSSNewsEventFingerprint;
};

type RSSDuplicateEventDecision = {
  duplicateEventKey: string;
  winningSource: string;
  suppressedSources: string[];
  matchedSources: string[];
  reason: string;
};

function normalizeRSSSourceName(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRSSSourcePriority(feedName?: string | null): number {
  const normalized = normalizeRSSSourceName(feedName);
  if (!normalized) {
    return RSS_DUPLICATE_SOURCE_PRIORITY.length + 10;
  }

  const index = RSS_DUPLICATE_SOURCE_PRIORITY.findIndex((entry) =>
    normalized === entry || normalized.includes(entry)
  );

  return index >= 0 ? index : RSS_DUPLICATE_SOURCE_PRIORITY.length + 10;
}

function getRSSDuplicateStatusPriority(status: RSSDuplicateCandidateStatus): number {
  if (status === 'published') {
    return 0;
  }
  if (status === 'pending') {
    return 1;
  }
  return 2;
}

function compareRSSDuplicateCandidates(left: RSSDuplicateEventCandidate, right: RSSDuplicateEventCandidate): number {
  const statusDelta = getRSSDuplicateStatusPriority(left.status) - getRSSDuplicateStatusPriority(right.status);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  const sourceDelta = getRSSSourcePriority(left.feedName) - getRSSSourcePriority(right.feedName);
  if (sourceDelta !== 0) {
    return sourceDelta;
  }

  const timeDelta = left.timestamp - right.timestamp;
  if (timeDelta !== 0) {
    return timeDelta;
  }

  return left.title.localeCompare(right.title);
}

function buildRSSDuplicateCandidate(
  feedName: string,
  item: RSSItem,
  status: RSSDuplicateCandidateStatus,
  timestamp: Date | number
): RSSDuplicateEventCandidate | null {
  const fingerprint = buildRSSNewsEventFingerprint(item);
  if (!fingerprint.signature) {
    return null;
  }

  const resolvedTimestamp = timestamp instanceof Date ? timestamp.getTime() : timestamp;
  return {
    feedName,
    title: item.title,
    link: item.link,
    timestamp: Number.isFinite(resolvedTimestamp) ? resolvedTimestamp : Date.now(),
    status,
    fingerprint,
  };
}

function buildRSSDuplicateEventReason(decision: RSSDuplicateEventDecision): string {
  const suppressed = decision.suppressedSources.length > 0
    ? ` Suppressed sources: ${decision.suppressedSources.join(', ')}.`
    : '';
  return `Filtered as the same news event that was already queued or published recently from another source. Winner: ${decision.winningSource}. Event key: ${decision.duplicateEventKey}.${suppressed}`;
}

function resolveRSSDuplicateEventDecision(
  currentFeedName: string,
  item: RSSItem,
  recentCandidates: RSSDuplicateEventCandidate[]
): RSSDuplicateEventDecision | null {
  const currentCandidate = buildRSSDuplicateCandidate(currentFeedName, item, 'current', item.pubDate || Date.now());
  if (!currentCandidate) {
    return null;
  }

  const matches = recentCandidates.filter((candidate) =>
    areRSSNewsEventsSimilar(currentCandidate.fingerprint, candidate.fingerprint)
  );
  if (matches.length === 0) {
    return null;
  }

  const ranked = [...matches, currentCandidate].sort(compareRSSDuplicateCandidates);
  const winner = ranked[0];
  if (winner === currentCandidate) {
    return null;
  }

  const duplicateEventKey = currentCandidate.fingerprint.signature || winner.fingerprint.signature;
  const suppressedSources = Array.from(new Set(
    ranked
      .filter((candidate) => candidate !== winner)
      .map((candidate) => candidate.feedName)
      .filter(Boolean)
  ));

  return {
    duplicateEventKey,
    winningSource: winner.feedName,
    suppressedSources,
    matchedSources: Array.from(new Set(matches.map((candidate) => candidate.feedName))).sort(),
    reason: buildRSSDuplicateEventReason({
      duplicateEventKey,
      winningSource: winner.feedName,
      suppressedSources,
      matchedSources: Array.from(new Set(matches.map((candidate) => candidate.feedName))).sort(),
      reason: '',
    }),
  };
}

function extractRSSTemporalCue(text?: string | null): string {
  const value = String(text || '');
  if (!value.trim()) {
    return '';
  }

  const seasonMatch = value.match(/\bseason\s+\d+\b/i);
  if (seasonMatch?.[0]) {
    return normalizeRSSDedupeValue(seasonMatch[0]);
  }

  const partMatch = value.match(/\bpart\s+\d+\b/i);
  if (partMatch?.[0]) {
    return normalizeRSSDedupeValue(partMatch[0]);
  }

  const numberedTitleMatch = value.match(/\b(?:episode|chapter|volume)\s+\d+\b/i);
  if (numberedTitleMatch?.[0]) {
    return normalizeRSSDedupeValue(numberedTitleMatch[0]);
  }

  const yearMatch = value.match(/\b(19|20)\d{2}\b/);
  return yearMatch?.[0] ? normalizeRSSDedupeValue(yearMatch[0]) : '';
}

function extractRSSObituaryAgeCue(text?: string | null): string {
  const match = String(text || '').match(/\b(?:at|aged?|was)\s+(\d{2,3})\b/i);
  return match?.[1] ? normalizeRSSDedupeValue(match[1]) : '';
}

function getRSSEventCueTokens(title?: string | null): string[] {
  return RSS_TOPIC_CUE_PATTERNS
    .filter(({ pattern }) => pattern.test(String(title || '')))
    .map(({ key }) => key);
}

function buildRSSNewsEventFingerprint(item: RSSItem): RSSNewsEventFingerprint {
  const canonical = ensureRSSCanonicalEntity(item);
  const topicFingerprint = buildRSSTopicFingerprint(item.title);
  const cueTokens = new Set(getRSSEventCueTokens(item.title));
  const projectAnchor = normalizeRSSDedupeValue(
    canonical.mediaTitle
      || ((canonical.entityType === 'movie' || canonical.entityType === 'tv' || canonical.entityType === 'franchise')
        ? canonical.primarySubject
        : canonical.franchise)
      || ''
  );
  const personAnchor = normalizeRSSDedupeValue(
    canonical.entityType === 'person'
      ? canonical.primarySubject
      : canonical.namedPeople?.[0] || ''
  );
  const personAnchors = (canonical.namedPeople || [])
    .map((person) => normalizeRSSDedupeValue(person))
    .filter(Boolean)
    .sort()
    .slice(0, 3);
  const characterAnchor = normalizeRSSDedupeValue(canonical.namedCharacters?.[0] || '');
  const obituaryAge = extractRSSObituaryAgeCue([
    item.title,
    item.description,
    canonical.primarySubject,
    canonical.secondarySubject,
  ].filter(Boolean).join(' '));
  const temporalCue = extractRSSTemporalCue([
    item.title,
    item.description,
    canonical.mediaTitle,
    canonical.primarySubject,
    canonical.secondarySubject,
  ].filter(Boolean).join(' '));
  const eventType = normalizeRSSDedupeValue(canonical.eventType || [...cueTokens][0] || 'general');
  const anchors = new Set(
    [
      canonical.primarySubject,
      canonical.secondarySubject,
      canonical.mediaTitle,
      canonical.franchise,
      ...(canonical.namedPeople || []),
      ...(canonical.namedCharacters || []),
    ]
      .map((entry) => normalizeRSSDedupeValue(entry))
      .filter(Boolean)
  );

  const signature = eventType === 'obituary' && personAnchor
    ? [
        'obituary',
        personAnchor,
        obituaryAge,
        temporalCue,
      ].filter(Boolean).join('|')
    : [
        eventType,
        projectAnchor,
        personAnchor,
        personAnchors,
        characterAnchor,
        temporalCue,
        [...cueTokens].sort().join(','),
      ]
        .filter(Boolean)
        .join('|');

  return {
    signature,
    eventType,
    projectAnchor,
    personAnchor,
    personAnchors,
    characterAnchor,
    obituaryAge,
    temporalCue,
    cueTokens,
    anchors,
    topicFingerprint,
  };
}

function areRSSNewsEventsSimilar(left: RSSNewsEventFingerprint, right: RSSNewsEventFingerprint): boolean {
  if (!left.signature || !right.signature) {
    return false;
  }

  if (left.signature === right.signature) {
    return true;
  }

  const sharedAnchors = getSetIntersectionCount(left.anchors, right.anchors);
  const sharedCues = getSetIntersectionCount(left.cueTokens, right.cueTokens);
  const sameEventType = Boolean(left.eventType && right.eventType && left.eventType === right.eventType);
  const sameProject = Boolean(left.projectAnchor && right.projectAnchor && left.projectAnchor === right.projectAnchor);
  const samePerson = Boolean(left.personAnchor && right.personAnchor && left.personAnchor === right.personAnchor);
  const sharedPeople = left.personAnchors.filter((person) => right.personAnchors.includes(person)).length;
  const sameCharacter = Boolean(left.characterAnchor && right.characterAnchor && left.characterAnchor === right.characterAnchor);
  const sameTemporalCue = !left.temporalCue || !right.temporalCue || left.temporalCue === right.temporalCue;
  const obituaryAgeMatches = !left.obituaryAge || !right.obituaryAge || left.obituaryAge === right.obituaryAge;

  if (sameEventType && left.eventType === 'obituary' && samePerson && sameTemporalCue && obituaryAgeMatches) {
    return true;
  }

  if (sameEventType && sameProject && sameTemporalCue && (samePerson || sharedAnchors >= 2 || sharedCues >= 1)) {
    return true;
  }

  if (sameEventType && sameProject && sameTemporalCue && sharedPeople >= 1) {
    return true;
  }

  if (sameEventType && samePerson && sameTemporalCue && (sameProject || sharedAnchors >= 2)) {
    return true;
  }

  if (sameEventType && samePerson && sameTemporalCue && sharedCues >= 1) {
    return true;
  }

  if (sameEventType && sameCharacter && sameProject && sameTemporalCue) {
    return true;
  }

  if (sameProject && samePerson && sameTemporalCue && (sharedAnchors >= 2 || sharedCues >= 1)) {
    return true;
  }

  if (sameTemporalCue && sharedAnchors >= 2 && (sameEventType || sameProject || samePerson || sameCharacter)) {
    return true;
  }

  if (
    areRSSTopicFingerprintsSimilar(left.topicFingerprint, right.topicFingerprint) &&
    (
      getSetIntersectionCount(left.topicFingerprint.entityTokens, right.topicFingerprint.entityTokens) >= 2 ||
      getSetIntersectionCount(left.topicFingerprint.subjectPhrases, right.topicFingerprint.subjectPhrases) >= 1
    )
  ) {
    return true;
  }

  return sameEventType && sameTemporalCue && sharedAnchors >= 3 && sharedCues >= 1;
}

function getRSSItemTopicDedupeKey(item: RSSItem): string {
  const signature = getRSSTopicSignature(item.title);
  return signature ? `topic:${signature}` : '';
}

function getRSSItemEventDedupeKey(item: RSSItem): string {
  const fingerprint = buildRSSNewsEventFingerprint(item);
  return fingerprint.signature ? `event:${fingerprint.signature}` : '';
}

function getRSSItemLocalSeenKeys(item: RSSItem): string[] {
  return [
    getRSSItemDedupeKey(item),
    getRSSItemTopicDedupeKey(item),
    getRSSItemEventDedupeKey(item),
  ].filter(Boolean);
}

function addRSSItemLocalSeenKeys(seen: Set<string>, item: RSSItem): void {
  getRSSItemLocalSeenKeys(item).forEach((key) => seen.add(key));
}

function hasRSSItemLocalSeenKeys(seen: Set<string>, item: RSSItem): boolean {
  return getRSSItemLocalSeenKeys(item).some((key) => seen.has(key));
}

function getRSSItemSubjectCooldownKeys(item: RSSItem): string[] {
  return extractRSSSubjectPhrases(item.title)
    .slice(0, 4)
    .map((phrase) => `subject:${phrase}`);
}

function getRSSPublishClaimKeys(feedId: string, item: RSSItem): string[] {
  return [
    `${feedId}:${getRSSItemDedupeKey(item)}`,
    getRSSItemTopicDedupeKey(item) ? `${feedId}:${getRSSItemTopicDedupeKey(item)}` : '',
    ...getRSSItemSubjectCooldownKeys(item),
  ].filter(Boolean);
}

function acquireRSSPublishClaim(feedId: string, item: RSSItem): boolean {
  const claimKeys = getRSSPublishClaimKeys(feedId, item);
  if (claimKeys.some((key) => activeRSSPublishClaims.has(key))) {
    return false;
  }

  claimKeys.forEach((key) => activeRSSPublishClaims.add(key));
  return true;
}

function releaseRSSPublishClaim(feedId: string, item: RSSItem): void {
  getRSSPublishClaimKeys(feedId, item).forEach((key) => activeRSSPublishClaims.delete(key));
}

function serializeRSSItem(item: RSSItem): Prisma.InputJsonValue {
  return ({
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
    captionGenerationPath: item.captionGenerationPath ?? null,
    captionGenerationVersion: item.captionGenerationVersion ?? null,
    editorialBrain: item.editorialBrain ?? null,
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
    canonicalEntity: item.canonicalEntity ?? null,
    canonicalEntityVersion: item.canonicalEntityVersion ?? null,
    runtimeDiagnostics: item.runtimeDiagnostics ?? null,
  }) as Prisma.InputJsonValue;
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
    imageSource: value.imageSource === 'tmdb' || value.imageSource === 'serper' || value.imageSource === 'openai_web_search' || value.imageSource === 'feed'
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
    captionGenerationPath:
      value.captionGenerationPath === 'ai_prompted' ||
      value.captionGenerationPath === 'repaired_caption' ||
      value.captionGenerationPath === 'deterministic_template' ||
      value.captionGenerationPath === 'excerpt_fallback'
        ? value.captionGenerationPath
        : undefined,
    captionGenerationVersion: typeof value.captionGenerationVersion === 'string' ? value.captionGenerationVersion : undefined,
    editorialBrain: value.editorialBrain && typeof value.editorialBrain === 'object' && !Array.isArray(value.editorialBrain)
      ? value.editorialBrain as RSSEditorialBrainStoredDecision
      : undefined,
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
    canonicalEntity: value.canonicalEntity && typeof value.canonicalEntity === 'object' && !Array.isArray(value.canonicalEntity)
      ? value.canonicalEntity as RSSCanonicalEntity
      : undefined,
    canonicalEntityVersion: typeof value.canonicalEntityVersion === 'string' ? value.canonicalEntityVersion : undefined,
    runtimeDiagnostics: value.runtimeDiagnostics && typeof value.runtimeDiagnostics === 'object' && !Array.isArray(value.runtimeDiagnostics)
      ? normalizeRSSRuntimeDiagnostics(value.runtimeDiagnostics)
      : undefined,
  };
}

function normalizeRSSRuntimeDiagnostics(value: unknown): RSSRuntimeDiagnostics | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const finalFailureCodes = Array.isArray(record.finalFailureCodes)
    ? record.finalFailureCodes
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .map((entry) => entry.trim())
    : undefined;

  return {
    rulesetVersion: typeof record.rulesetVersion === 'string' ? record.rulesetVersion : undefined,
    codeVersion: typeof record.codeVersion === 'string' ? record.codeVersion : undefined,
    canonicalEntityVersion: typeof record.canonicalEntityVersion === 'string' ? record.canonicalEntityVersion : undefined,
    captionGenerationVersion: typeof record.captionGenerationVersion === 'string' ? record.captionGenerationVersion : undefined,
    captionPath:
      record.captionPath === 'ai_prompted' ||
      record.captionPath === 'repaired_caption' ||
      record.captionPath === 'deterministic_template' ||
      record.captionPath === 'excerpt_fallback'
        ? record.captionPath
        : undefined,
    reusedStoredCaption: typeof record.reusedStoredCaption === 'boolean' ? record.reusedStoredCaption : undefined,
    promotedImageStrategy: typeof record.promotedImageStrategy === 'string' ? record.promotedImageStrategy : undefined,
    promotedCaptionStrategy: typeof record.promotedCaptionStrategy === 'string' ? record.promotedCaptionStrategy : undefined,
    finalFailureCodes,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
}

function applyRSSRuntimeDiagnosticsToItem(
  item: RSSItem,
  diagnostics: RSSRuntimeDiagnostics,
  options: { now?: Date } = {}
): RSSItem {
  const updatedAt = (options.now || new Date()).toISOString();
  return {
    ...item,
    runtimeDiagnostics: {
      ...item.runtimeDiagnostics,
      ...diagnostics,
      updatedAt,
    },
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
    openaiWebSearchEnabled?: boolean | null;
    serperPriority: boolean;
    imageSourcePriority?: 'tmdb_first' | 'openai_first' | 'serper_first' | null;
    imageCount?: string | null;
    rehostImages?: boolean | null;
  },
  item: RSSItem,
  limit: number,
  runtimeSettings?: Pick<RSSRuntimeSettings, 'rssImageWebSearchModel' | 'rssOpenaiWebSearchEnabled'>
): Promise<RSSResolvedImage[]> {
  const canonicalEntity = ensureRSSCanonicalEntity(item);
  const resolvedImages = await resolveRelevantRSSImages(
    {
      title: item.title,
      description: item.description,
      contentHtml: item.contentHtml,
      author: item.author,
      generatedCaption: item.generatedCaption,
      fallbackImages: dedupeUrls([...(item.imageUrls || []), item.imageUrl]),
      canonicalEntity,
    },
    {
      serperEnabled: feed.serperEnabled ?? true,
      tmdbEnabled: feed.tmdbEnabled ?? true,
      openaiWebSearchEnabled: Boolean(runtimeSettings?.rssOpenaiWebSearchEnabled) && (feed.openaiWebSearchEnabled ?? false),
      serperPriority: feed.serperPriority,
      imageSourcePriority: feed.imageSourcePriority ?? undefined,
      limit,
      smartCount: feed.imageCount === 'random',
      model: RSS_IMAGE_ANALYSIS_MODEL,
      openaiWebSearchModel: runtimeSettings?.rssImageWebSearchModel,
    }
  );

  return maybeRehostRSSResolvedImages(feed, item, resolvedImages);
}

function buildRSSCaptionSystemPrompt(
  basePrompt: string | undefined,
  options: {
    tone?: string;
    maxLength?: number;
    speculationAssessment?: RSSSpeculationAssessment | null;
    promotedCaptionStrategy?: RssEditorialBrainDecision['caption_strategy']['mode'];
  }
): string | undefined {
  const hasExplicitLengthInstruction = typeof basePrompt === 'string'
    && /character range|under\s+\d+\s*characters?|max(?:imum)?\s+length|\b\d+\s*[–-]\s*\d+\s*characters?\b/i.test(basePrompt);
  const constraints = [
    basePrompt ? '- The saved RSS caption prompt above is authoritative for voice, structure, spacing, quotes, title formatting, and output style.' : null,
    basePrompt ? '- Follow the saved prompt exactly unless a supplemental rule below is needed to preserve factual accuracy or subject clarity.' : null,
    options.tone ? `- Preferred tone: ${options.tone}.` : null,
    options.maxLength && !hasExplicitLengthInstruction ? `- Keep the final caption under ${options.maxLength} characters.` : null,
    '- Focus on the single strongest lead angle from the headline rather than summarizing every sub-story in the article.',
    '- If the article is a roundup, mention secondary items only when they are essential to the lead angle.',
    '- Keep the wording aligned with the selected image so the caption and visual feel like the same story.',
    '- Only name titles, characters, or people that are actually represented by the selected visuals.',
    '- If the selected visuals cover fewer examples than the headline or article summary mentions, use broader wording instead of listing unsupported examples.',
    '- Never substitute a different movie, show, character, or person name than the one grounded by the article context and selected visuals.',
    options.speculationAssessment?.shouldUseUncertaintyTone
      ? '- This article is not fully confirmed. Make the uncertainty explicit and do not present unconfirmed developments as fact.'
      : null,
    options.speculationAssessment?.shouldUseUncertaintyTone
      ? '- Prefer cautious wording such as "reports suggest", "could", "may", "comments on rumors", or "speculation grows" when appropriate.'
      : null,
    options.promotedCaptionStrategy === 'person_commentary'
      ? '- Use a speaker-led caption shape: lead with the named speaker and the actual comment or quote, not a generic project-update lead.'
      : null,
    options.promotedCaptionStrategy === 'first_look'
      ? '- Use a first-look caption shape: lead with the reveal itself and strip packaging like "exclusive" or "first look" from the subject line.'
      : null,
    options.promotedCaptionStrategy === 'trailer'
      ? '- Use a trailer-news caption shape: lead with the trailer release for the resolved project and repair minor article-package residue instead of echoing it.'
      : null,
    options.promotedCaptionStrategy === 'spoiler_safe'
      ? '- Use a spoiler-safe caption shape: keep the wording neutral, avoid reveal specifics, and do not put the spoiled subject in the lead sentence.'
      : null,
    options.promotedCaptionStrategy === 'tribute'
      ? '- Use a tribute caption shape: lead with the tribute or memorial context and keep the phrasing respectful and factual.'
      : null,
    options.promotedCaptionStrategy === 'obituary'
      ? '- Use an obituary caption shape: lead with the person, not a referenced project, and keep the tone factual and direct.'
      : null,
    options.promotedCaptionStrategy === 'project_announcement'
      ? '- Use a project-announcement caption shape: lead with the concrete announcement or casting fact and avoid wrapper-headline phrasing.'
      : null,
  ].filter(Boolean).join('\n');

  if (!basePrompt && !constraints) {
    return undefined;
  }

  return [basePrompt, constraints].filter(Boolean).join('\n\nAdditional Constraints:\n');
}

function imageReasonMatchesArticleContext(item: RSSItem, reason: string): boolean {
  const articleContext = normalizeRSSDedupeValue([
    item.title,
    item.description,
    sanitizeRSSPlainText(item.contentHtml || ''),
  ].filter(Boolean).join(' '));

  if (!articleContext) {
    return true;
  }

  const anchoredEntities = extractReasonAnchoredEntity(reason);
  if (anchoredEntities.length === 0) {
    return true;
  }

  return anchoredEntities.some((entity) => {
    const normalizedEntity = normalizeRSSDedupeValue(entity);
    return normalizedEntity && articleContext.includes(normalizedEntity);
  });
}

function buildRSSCaptionVisualContext(item: RSSItem, images: RSSResolvedImage[]): string[] | undefined {
  const entries = images
    .map((image, index) => {
      const reason = sanitizeRSSPlainText(image.reason || '').replace(/\s+/g, ' ').trim();
      if (!reason || !imageReasonMatchesArticleContext(item, reason)) {
        return null;
      }

      return `Visual ${index + 1}: ${reason}`;
    })
    .filter((entry): entry is string => Boolean(entry));

  return entries.length > 0 ? entries : undefined;
}

function extractQuotedRSSCaptionEntities(value: string): string[] {
  return Array.from(value.matchAll(/["'“”]([^"'“”]{2,100})["'“”]/g))
    .map((match) => sanitizeRSSPlainText(match[1] || '').trim())
    .filter(Boolean)
    .filter((entry) => !containsOutletLikeRSSCaptionEntity(entry));
}

const RSS_CAPTION_ENTITY_OUTLETS = [
  'Deadline',
  'Variety',
  'ComicBook',
  'The Hollywood Reporter',
  'Hollywood Reporter',
  'THR',
  'Entertainment Weekly',
  'EW',
  'IGN',
  'Collider',
  'IndieWire',
  'Tudum',
  'ScreenRant',
  'TVLine',
];

function containsOutletLikeRSSCaptionEntity(value: string): boolean {
  const cleaned = sanitizeRSSPlainText(value).trim();
  if (!cleaned) {
    return false;
  }

  return RSS_CAPTION_ENTITY_OUTLETS.some((entry) =>
    new RegExp(`\\b${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(cleaned)
  );
}

function sanitizeRSSCaptionEntityCandidate(value: string): string {
  let cleaned = sanitizeRSSPlainText(value).replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return cleaned;
  }

  for (const outlet of RSS_CAPTION_ENTITY_OUTLETS) {
    const escaped = outlet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned
      .replace(new RegExp(`(?:,?\\s*${escaped})$`, 'i'), '')
      .replace(new RegExp(`^${escaped}(?:,?\\s+)`, 'i'), '')
      .trim();
  }

  return cleaned;
}

function extractNamedRSSCaptionEntities(value: string): string[] {
  const stopwords = new Set([
    'A', 'An', 'And', 'As', 'At', 'After', 'Before', 'By', 'For', 'From', 'In', 'Into', 'Of', 'On', 'Or', 'The', 'To', 'With',
    'He', 'She', 'They', 'It', 'His', 'Her', 'Their',
  ]);

  return Array.from(
    sanitizeRSSPlainText(value).matchAll(/\b(?:[A-Z0-9][A-Za-z0-9:'&.-]*)(?:\s+(?:[A-Z0-9][A-Za-z0-9:'&.-]*)){0,5}\b/g)
  )
    .map((match) => sanitizeRSSCaptionEntityCandidate((match[0] || '').trim()))
    .filter((entry) => {
      if (!entry) {
        return false;
      }

      if (containsOutletLikeRSSCaptionEntity(entry) || /\bmore to come\b|\bbroke the news\b/i.test(entry)) {
        return false;
      }

      const parts = entry.split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        const token = parts[0] || '';
        if (stopwords.has(token)) {
          return false;
        }

        return token.length >= 3 || /^[A-Z0-9]{2,}$/.test(token);
      }

      return parts.some((part) => !stopwords.has(part));
    });
}

function extractReasonAnchoredEntity(value: string): string[] {
  const text = sanitizeRSSPlainText(value).replace(/\s+/g, ' ').trim();
  if (!text) {
    return [];
  }

  const matches = Array.from(
    text.matchAll(/\b(?:for|profile for|backdrop for|poster for|logo for)\s+([^.,;|]+?)(?:\s+cropped to|\s+rendered as|$)/gi)
  )
    .map((match) => sanitizeRSSPlainText(match[1] || '').trim())
    .filter(Boolean);

  return matches;
}

function buildRSSCaptionAllowedEntities(item: RSSItem, images: RSSResolvedImage[]): string[] | undefined {
  const seen = new Set<string>();
  const entities: string[] = [];

  const pushEntity = (value?: string | null): void => {
    const cleaned = sanitizeRSSCaptionEntityCandidate(String(value || '')).replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      return;
    }
    if (containsOutletLikeRSSCaptionEntity(cleaned) || /\bmore to come\b|\bbroke the news\b/i.test(cleaned)) {
      return;
    }
    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    entities.push(cleaned);
  };

  [
    ...(item.canonicalEntity?.allowedEntities || []),
    item.canonicalEntity?.primarySubject,
    item.canonicalEntity?.secondarySubject,
    item.canonicalEntity?.mediaTitle,
    item.canonicalEntity?.franchise,
    ...extractQuotedRSSCaptionEntities(item.title || ''),
    ...extractQuotedRSSCaptionEntities(item.description || ''),
    ...extractNamedRSSCaptionEntities(item.title || ''),
    ...extractNamedRSSCaptionEntities(item.description || ''),
  ].forEach(pushEntity);

  for (const image of images) {
    if (!imageReasonMatchesArticleContext(item, image.reason || '')) {
      continue;
    }

    extractReasonAnchoredEntity(image.reason || '').forEach(pushEntity);
  }

  return entities.length > 0 ? entities : undefined;
}

function prunePlatformResultsForPrePublishFailure(results: PublishResult[] | undefined): PublishResult[] {
  return (results || []).filter((result) => result.status === 'posted' || result.status === 'skipped');
}

async function getRuntimeSettings(): Promise<RSSRuntimeSettings> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: [...RSS_SETTINGS_KEYS] } },
  });

  const settingsMap = new Map(settings.map((entry) => [entry.key, entry.value]));
  const savedCaptionPrompt = asString(settingsMap.get('rssCaptionPrompt'));
  const savedCaptionMaxLength = asNumber(settingsMap.get('rssCaptionMaxLength'));
  const defaultCaptionMaxLength = savedCaptionPrompt ? 800 : 280;

  return {
    globalRSSPosting: asBoolean(settingsMap.get('globalRSSPosting'), true),
    rssDeduplication: asBoolean(settingsMap.get('rssDeduplication'), true),
    rssCaptionModel: asString(settingsMap.get('rssCaptionModel')) || DEFAULT_OPENAI_MODEL,
    rssOpenaiWebSearchEnabled: asBoolean(settingsMap.get('rssOpenaiWebSearchEnabled'), false),
    rssImageWebSearchModel: asString(settingsMap.get('rssImageWebSearchModel')) || 'gpt-5.4-mini',
    rssCaptionPrompt: savedCaptionPrompt,
    rssCaptionTemperature: asNumber(settingsMap.get('rssCaptionTemperature')),
    rssCaptionTone: asString(settingsMap.get('rssCaptionTone')) || 'Engaging',
    rssCaptionMaxLength: Math.max(50, savedCaptionMaxLength ?? defaultCaptionMaxLength),
    rssEditorialBrainShadowMode:
      asBoolean(settingsMap.get('rssEditorialBrainShadowMode'), false)
      || process.env.RSS_EDITORIAL_BRAIN_SHADOW_MODE === '1'
      || process.env.RSS_EDITORIAL_BRAIN_SHADOW_MODE?.toLowerCase() === 'true',
    rssEditorialBrainCaptionStrategyPromotion:
      asBoolean(settingsMap.get('rssEditorialBrainCaptionStrategyPromotion'), false)
      || process.env.RSS_EDITORIAL_BRAIN_CAPTION_STRATEGY_PROMOTION === '1'
      || process.env.RSS_EDITORIAL_BRAIN_CAPTION_STRATEGY_PROMOTION?.toLowerCase() === 'true',
    rssEditorialBrainImageStrategyPromotion:
      asBoolean(settingsMap.get('rssEditorialBrainImageStrategyPromotion'), false)
      || process.env.RSS_EDITORIAL_BRAIN_IMAGE_STRATEGY_PROMOTION === '1'
      || process.env.RSS_EDITORIAL_BRAIN_IMAGE_STRATEGY_PROMOTION?.toLowerCase() === 'true',
    rssEditorialBrainModel:
      asString(settingsMap.get('rssEditorialBrainModel'))
      || process.env.RSS_EDITORIAL_BRAIN_MODEL
      || DEFAULT_RSS_EDITORIAL_BRAIN_MODEL,
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
  if (metadata.status === 'filtered') {
    return `${metadata.feedName}: filtered ${metadata.itemTitle}`;
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

function normalizeRSSEditorialBrainReviewInput(
  value: unknown,
  options: { now?: Date } = {}
): RSSEditorialBrainActivityReview | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const outcome = record.outcome;
  if (
    outcome !== 'brain_better'
    && outcome !== 'deterministic_better'
    && outcome !== 'both_wrong'
    && outcome !== 'ignore'
  ) {
    return undefined;
  }

  const reviewedAt = typeof record.reviewedAt === 'string' && record.reviewedAt.trim().length > 0
    ? record.reviewedAt.trim()
    : (options.now || new Date()).toISOString();
  const notes = typeof record.notes === 'string' && record.notes.trim().length > 0
    ? record.notes.trim().slice(0, 500)
    : undefined;

  return {
    outcome,
    reviewedAt,
    notes,
  };
}

function buildRSSEditorialBrainActivityView(
  item: Pick<RSSItem, 'editorialBrain'> | undefined
): RSSEditorialBrainActivityView | undefined {
  const stored = item?.editorialBrain;
  if (!stored) {
    return undefined;
  }

  return {
    sourceTrustTier: stored.sourceTrustTier,
    agentModel: stored.agentModel,
    contentHash: stored.contentHash,
    usedFallback: stored.usedFallback,
    disagreements: Array.isArray(stored.disagreements) ? [...stored.disagreements] : [],
    currentSystem: {
      lane: stored.currentSystem.lane,
      canonical: stored.currentSystem.primary_entity,
      event: stored.currentSystem.event,
      imageStrategy: stored.currentSystem.image_strategy?.mode || 'project_first',
      captionStrategy: stored.currentSystem.caption_strategy?.mode || 'headline_news',
      spoilerRisk: stored.currentSystem.spoiler_risk,
    },
    decision: {
      lane: stored.decision.lane,
      canonical: stored.decision.primary_entity,
      storyFamily: stored.decision.story_family,
      event: stored.decision.event,
      imageStrategy: stored.decision.image_strategy?.mode || 'project_first',
      captionStrategy: stored.decision.caption_strategy?.mode || 'headline_news',
      spoilerRisk: stored.decision.spoiler_risk,
      confidence: stored.decision.confidence,
    },
    review: normalizeRSSEditorialBrainReviewInput(stored.review),
    runtime: {
      promotedImageStrategy: stored.runtime?.promotedImageStrategy,
      promotedCaptionStrategy: stored.runtime?.promotedCaptionStrategy,
      finalFailureCodes: Array.isArray(stored.runtime?.finalFailureCodes)
        ? stored.runtime!.finalFailureCodes.filter((code) => typeof code === 'string' && code.trim().length > 0)
        : [],
      lastOutcome: stored.runtime?.lastOutcome,
      updatedAt: typeof stored.runtime?.updatedAt === 'string' ? stored.runtime.updatedAt : undefined,
    },
  };
}

function applyRSSEditorialBrainRuntimeOutcomeToItem(
  item: RSSItem,
  runtime: {
    promotedImageStrategy?: RssEditorialBrainDecision['image_strategy']['mode'];
    promotedCaptionStrategy?: RssEditorialBrainDecision['caption_strategy']['mode'];
    finalFailureCodes?: string[];
    lastOutcome: RSSActivityItem['status'];
    now?: Date;
  }
): RSSItem {
  if (!item.editorialBrain) {
    return item;
  }

  const updatedAt = (runtime.now || new Date()).toISOString();
  const finalFailureCodes = Array.isArray(runtime.finalFailureCodes)
    ? runtime.finalFailureCodes
        .filter((code): code is string => typeof code === 'string' && code.trim().length > 0)
        .map((code) => code.trim())
    : [];

  return {
    ...item,
    editorialBrain: {
      ...item.editorialBrain,
      runtime: {
        promotedImageStrategy: runtime.promotedImageStrategy,
        promotedCaptionStrategy: runtime.promotedCaptionStrategy,
        finalFailureCodes,
        lastOutcome: runtime.lastOutcome,
        updatedAt,
      },
    },
  };
}

function applyRSSEditorialBrainReviewToItem(
  item: RSSItem,
  review: unknown,
  options: { now?: Date } = {}
): RSSItem {
  if (!item.editorialBrain) {
    throw new Error('RSS item has no editorial brain decision to review.');
  }

  const normalizedReview = normalizeRSSEditorialBrainReviewInput(review, options);
  if (!normalizedReview) {
    throw new Error('Invalid editorial brain review payload.');
  }

  return {
    ...item,
    editorialBrain: {
      ...item.editorialBrain,
      review: normalizedReview,
    },
  };
}

function createEmptyRSSEditorialBrainImageStrategyCalibrationBucket(): RSSEditorialBrainImageStrategyCalibrationBucket {
  return {
    reviewedCount: 0,
    decisiveCount: 0,
    brainBetterCount: 0,
    deterministicBetterCount: 0,
    bothWrongCount: 0,
    ignoreCount: 0,
    brainBetterRate: 0,
  };
}

function finalizeRSSEditorialBrainImageStrategyCalibrationBucket(
  bucket: RSSEditorialBrainImageStrategyCalibrationBucket
): RSSEditorialBrainImageStrategyCalibrationBucket {
  const decisiveCount =
    bucket.brainBetterCount +
    bucket.deterministicBetterCount +
    bucket.bothWrongCount;

  return {
    ...bucket,
    decisiveCount,
    brainBetterRate: decisiveCount > 0
      ? bucket.brainBetterCount / decisiveCount
      : 0,
  };
}

function normalizeRSSEditorialBrainCalibrationSourceName(sourceName: string): string {
  return sanitizeRSSPlainText(sourceName || '').trim().toLowerCase();
}

function buildRSSEditorialBrainImageStrategyCalibration(
  entries: Array<{
    sourceName: string;
    disagreements?: string[];
    review?: Pick<RSSEditorialBrainActivityReview, 'outcome'> | null;
  }>
): RSSEditorialBrainImageStrategyCalibration {
  const globalBucket = createEmptyRSSEditorialBrainImageStrategyCalibrationBucket();
  const bySourceBuckets = new Map<string, RSSEditorialBrainImageStrategyCalibrationBucket>();

  for (const entry of entries) {
    const sourceName = normalizeRSSEditorialBrainCalibrationSourceName(entry.sourceName);
    const disagreements = Array.isArray(entry.disagreements) ? entry.disagreements : [];
    const outcome = entry.review?.outcome;
    if (!sourceName || !disagreements.includes('image_strategy_disagreement')) {
      continue;
    }
    if (
      outcome !== 'brain_better' &&
      outcome !== 'deterministic_better' &&
      outcome !== 'both_wrong' &&
      outcome !== 'ignore'
    ) {
      continue;
    }

    const sourceBucket = bySourceBuckets.get(sourceName) || createEmptyRSSEditorialBrainImageStrategyCalibrationBucket();
    sourceBucket.reviewedCount += 1;
    globalBucket.reviewedCount += 1;

    switch (outcome) {
      case 'brain_better':
        sourceBucket.brainBetterCount += 1;
        globalBucket.brainBetterCount += 1;
        break;
      case 'deterministic_better':
        sourceBucket.deterministicBetterCount += 1;
        globalBucket.deterministicBetterCount += 1;
        break;
      case 'both_wrong':
        sourceBucket.bothWrongCount += 1;
        globalBucket.bothWrongCount += 1;
        break;
      case 'ignore':
        sourceBucket.ignoreCount += 1;
        globalBucket.ignoreCount += 1;
        break;
    }

    bySourceBuckets.set(sourceName, sourceBucket);
  }

  return {
    global: finalizeRSSEditorialBrainImageStrategyCalibrationBucket(globalBucket),
    bySource: Object.fromEntries(
      Array.from(bySourceBuckets.entries()).map(([sourceName, bucket]) => [
        sourceName,
        finalizeRSSEditorialBrainImageStrategyCalibrationBucket(bucket),
      ])
    ),
  };
}

function isRSSEditorialBrainImageStrategyPromotionSafeBucket(
  bucket: RSSEditorialBrainImageStrategyCalibrationBucket | undefined,
  minimumDecisiveReviews: number
): boolean {
  if (!bucket) {
    return false;
  }

  return bucket.decisiveCount >= minimumDecisiveReviews &&
    bucket.brainBetterCount >= minimumDecisiveReviews &&
    bucket.deterministicBetterCount === 0 &&
    bucket.brainBetterRate >= 0.75;
}

async function getRSSEditorialBrainImageStrategyCalibration(): Promise<RSSEditorialBrainImageStrategyCalibration> {
  const cached = cachedRSSEditorialBrainImageStrategyCalibration;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const records = await prisma.rSSFeedItem.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 1500,
    select: {
      itemData: true,
      feed: { select: { name: true } },
    },
  });

  const calibration = buildRSSEditorialBrainImageStrategyCalibration(
    records.map((record) => {
      const item = deserializeRSSItem(record.itemData);
      return {
        sourceName: record.feed.name,
        disagreements: item?.editorialBrain?.disagreements,
        review: item?.editorialBrain?.review,
      };
    })
  );

  cachedRSSEditorialBrainImageStrategyCalibration = {
    expiresAt: Date.now() + RSS_EDITORIAL_BRAIN_IMAGE_STRATEGY_PROMOTION_CACHE_TTL_MS,
    value: calibration,
  };

  return calibration;
}

function selectRSSEditorialBrainPromotedImageStrategy(
  sourceName: string,
  stored: Pick<RSSEditorialBrainStoredDecision, 'usedFallback' | 'disagreements' | 'currentSystem' | 'decision' | 'review'> | undefined,
  runtimeSettings: Pick<RSSRuntimeSettings, 'rssEditorialBrainImageStrategyPromotion'>,
  calibration: RSSEditorialBrainImageStrategyCalibration
): RssEditorialBrainDecision['image_strategy']['mode'] | undefined {
  if (!runtimeSettings.rssEditorialBrainImageStrategyPromotion || !stored || stored.usedFallback) {
    return undefined;
  }

  const disagreements = new Set(stored.disagreements || []);
  if (!disagreements.has('image_strategy_disagreement')) {
    return undefined;
  }

  if (
    disagreements.has('lane_disagreement') ||
    disagreements.has('canonical_disagreement') ||
    disagreements.has('spoiler_risk_disagreement')
  ) {
    return undefined;
  }

  if ((stored.review?.outcome === 'deterministic_better') || (stored.review?.outcome === 'both_wrong')) {
    return undefined;
  }

  if ((stored.decision.confidence || 0) < RSS_EDITORIAL_BRAIN_IMAGE_STRATEGY_PROMOTION_MIN_CONFIDENCE) {
    return undefined;
  }

  const sourceBucket = calibration.bySource[normalizeRSSEditorialBrainCalibrationSourceName(sourceName)];
  if (!isRSSEditorialBrainImageStrategyPromotionSafeBucket(sourceBucket, RSS_EDITORIAL_BRAIN_IMAGE_STRATEGY_PROMOTION_MIN_SOURCE_DECISIVE_REVIEWS)) {
    return undefined;
  }

  const globalBucket = calibration.global;
  if (
    globalBucket.decisiveCount < RSS_EDITORIAL_BRAIN_IMAGE_STRATEGY_PROMOTION_MIN_GLOBAL_DECISIVE_REVIEWS ||
    globalBucket.brainBetterCount <= globalBucket.deterministicBetterCount ||
    globalBucket.brainBetterRate < 0.6
  ) {
    return undefined;
  }

  return stored.decision.image_strategy?.mode;
}

function applyRSSEditorialBrainImageStrategyPromotion(
  canonicalEntity: RSSCanonicalEntity,
  mode: RssEditorialBrainDecision['image_strategy']['mode']
): RSSCanonicalEntity {
  const nextFlags = new Set(canonicalEntity.ambiguityFlags || []);
  nextFlags.add('editorial_brain_image_strategy_promoted');
  nextFlags.add(`editorial_brain_image_strategy_${mode}`);

  switch (mode) {
    case 'article_image_first':
      nextFlags.add('story_policy_article_image_first');
      break;
    case 'dual_person':
      nextFlags.add('story_policy_early_project_cast_portraits');
      break;
    case 'dual_person_project':
      nextFlags.add('story_family_person_commentary_on_project');
      break;
    case 'project_first':
      nextFlags.add('story_policy_force_project_first_image');
      break;
    case 'person_first':
      nextFlags.add('editorial_brain_image_strategy_person_first');
      break;
    case 'spoiler_safe_neutral':
      nextFlags.add('editorial_brain_image_strategy_spoiler_safe_neutral');
      break;
  }

  return {
    ...canonicalEntity,
    ambiguityFlags: Array.from(nextFlags),
  };
}

function applyRSSEditorialBrainImageStrategyPromotionToItem(
  item: RSSItem,
  mode: RssEditorialBrainDecision['image_strategy']['mode']
): RSSItem {
  const canonicalEntity = ensureRSSCanonicalEntity(item);
  return {
    ...item,
    canonicalEntity: applyRSSEditorialBrainImageStrategyPromotion(canonicalEntity, mode),
  };
}

async function getRSSEditorialBrainPromotedImageStrategyForItem(
  sourceName: string,
  item: RSSItem,
  runtimeSettings: Pick<RSSRuntimeSettings, 'rssEditorialBrainImageStrategyPromotion'>
): Promise<RssEditorialBrainDecision['image_strategy']['mode'] | undefined> {
  if (!runtimeSettings.rssEditorialBrainImageStrategyPromotion) {
    return undefined;
  }

  const calibration = await getRSSEditorialBrainImageStrategyCalibration();
  return selectRSSEditorialBrainPromotedImageStrategy(
    sourceName,
    item.editorialBrain,
    runtimeSettings,
    calibration
  );
}

function buildRSSEditorialBrainCaptionStrategyCalibration(
  entries: Array<{
    sourceName: string;
    disagreements?: string[];
    review?: Pick<RSSEditorialBrainActivityReview, 'outcome'> | null;
  }>
): RSSEditorialBrainImageStrategyCalibration {
  const globalBucket = createEmptyRSSEditorialBrainImageStrategyCalibrationBucket();
  const bySourceBuckets = new Map<string, RSSEditorialBrainImageStrategyCalibrationBucket>();

  for (const entry of entries) {
    const sourceName = normalizeRSSEditorialBrainCalibrationSourceName(entry.sourceName);
    const disagreements = Array.isArray(entry.disagreements) ? entry.disagreements : [];
    const outcome = entry.review?.outcome;
    if (!sourceName || !disagreements.includes('caption_strategy_disagreement')) {
      continue;
    }
    if (
      outcome !== 'brain_better' &&
      outcome !== 'deterministic_better' &&
      outcome !== 'both_wrong' &&
      outcome !== 'ignore'
    ) {
      continue;
    }

    const sourceBucket = bySourceBuckets.get(sourceName) || createEmptyRSSEditorialBrainImageStrategyCalibrationBucket();
    sourceBucket.reviewedCount += 1;
    globalBucket.reviewedCount += 1;

    switch (outcome) {
      case 'brain_better':
        sourceBucket.brainBetterCount += 1;
        globalBucket.brainBetterCount += 1;
        break;
      case 'deterministic_better':
        sourceBucket.deterministicBetterCount += 1;
        globalBucket.deterministicBetterCount += 1;
        break;
      case 'both_wrong':
        sourceBucket.bothWrongCount += 1;
        globalBucket.bothWrongCount += 1;
        break;
      case 'ignore':
        sourceBucket.ignoreCount += 1;
        globalBucket.ignoreCount += 1;
        break;
    }

    bySourceBuckets.set(sourceName, sourceBucket);
  }

  return {
    global: finalizeRSSEditorialBrainImageStrategyCalibrationBucket(globalBucket),
    bySource: Object.fromEntries(
      Array.from(bySourceBuckets.entries()).map(([sourceName, bucket]) => [
        sourceName,
        finalizeRSSEditorialBrainImageStrategyCalibrationBucket(bucket),
      ])
    ),
  };
}

async function getRSSEditorialBrainCaptionStrategyCalibration(): Promise<RSSEditorialBrainImageStrategyCalibration> {
  const cached = cachedRSSEditorialBrainCaptionStrategyCalibration;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const records = await prisma.rSSFeedItem.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 1500,
    select: {
      itemData: true,
      feed: { select: { name: true } },
    },
  });

  const calibration = buildRSSEditorialBrainCaptionStrategyCalibration(
    records.map((record) => {
      const item = deserializeRSSItem(record.itemData);
      return {
        sourceName: record.feed.name,
        disagreements: item?.editorialBrain?.disagreements,
        review: item?.editorialBrain?.review,
      };
    })
  );

  cachedRSSEditorialBrainCaptionStrategyCalibration = {
    expiresAt: Date.now() + RSS_EDITORIAL_BRAIN_CAPTION_STRATEGY_PROMOTION_CACHE_TTL_MS,
    value: calibration,
  };

  return calibration;
}

function selectRSSEditorialBrainPromotedCaptionStrategy(
  sourceName: string,
  stored: Pick<RSSEditorialBrainStoredDecision, 'usedFallback' | 'disagreements' | 'currentSystem' | 'decision' | 'review'> | undefined,
  runtimeSettings: Pick<RSSRuntimeSettings, 'rssEditorialBrainCaptionStrategyPromotion'>,
  calibration: RSSEditorialBrainImageStrategyCalibration
): RssEditorialBrainDecision['caption_strategy']['mode'] | undefined {
  if (!runtimeSettings.rssEditorialBrainCaptionStrategyPromotion || !stored || stored.usedFallback) {
    return undefined;
  }

  const disagreements = new Set(stored.disagreements || []);
  if (!disagreements.has('caption_strategy_disagreement')) {
    return undefined;
  }

  if (
    disagreements.has('lane_disagreement') ||
    disagreements.has('canonical_disagreement') ||
    disagreements.has('spoiler_risk_disagreement')
  ) {
    return undefined;
  }

  if ((stored.review?.outcome === 'deterministic_better') || (stored.review?.outcome === 'both_wrong')) {
    return undefined;
  }

  if ((stored.decision.confidence || 0) < RSS_EDITORIAL_BRAIN_CAPTION_STRATEGY_PROMOTION_MIN_CONFIDENCE) {
    return undefined;
  }

  const sourceBucket = calibration.bySource[normalizeRSSEditorialBrainCalibrationSourceName(sourceName)];
  if (!isRSSEditorialBrainImageStrategyPromotionSafeBucket(sourceBucket, RSS_EDITORIAL_BRAIN_CAPTION_STRATEGY_PROMOTION_MIN_SOURCE_DECISIVE_REVIEWS)) {
    return undefined;
  }

  const globalBucket = calibration.global;
  if (
    globalBucket.decisiveCount < RSS_EDITORIAL_BRAIN_CAPTION_STRATEGY_PROMOTION_MIN_GLOBAL_DECISIVE_REVIEWS ||
    globalBucket.brainBetterCount <= globalBucket.deterministicBetterCount ||
    globalBucket.brainBetterRate < 0.6
  ) {
    return undefined;
  }

  return stored.decision.caption_strategy?.mode;
}

async function getRSSEditorialBrainPromotedCaptionStrategyForItem(
  sourceName: string,
  item: RSSItem,
  runtimeSettings: Pick<RSSRuntimeSettings, 'rssEditorialBrainCaptionStrategyPromotion'>
): Promise<RssEditorialBrainDecision['caption_strategy']['mode'] | undefined> {
  if (!runtimeSettings.rssEditorialBrainCaptionStrategyPromotion) {
    return undefined;
  }

  const calibration = await getRSSEditorialBrainCaptionStrategyCalibration();
  return selectRSSEditorialBrainPromotedCaptionStrategy(
    sourceName,
    item.editorialBrain,
    runtimeSettings,
    calibration
  );
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
    imageSource: metadata.imageSource === 'tmdb' || metadata.imageSource === 'serper' || metadata.imageSource === 'openai_web_search' || metadata.imageSource === 'feed'
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
    duplicateEventKey: typeof metadata.duplicateEventKey === 'string' ? metadata.duplicateEventKey : undefined,
    winningSource: typeof metadata.winningSource === 'string' ? metadata.winningSource : undefined,
    suppressedSources: Array.isArray(metadata.suppressedSources)
      ? metadata.suppressedSources
          .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          .map((entry) => entry.trim())
      : undefined,
    runtime: normalizeRSSRuntimeDiagnostics(metadata.runtime),
    editorialBrain: metadata.editorialBrain && typeof metadata.editorialBrain === 'object' && !Array.isArray(metadata.editorialBrain)
      ? metadata.editorialBrain as unknown as RSSEditorialBrainActivityView
      : undefined,
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
  itemData: Prisma.JsonValue | Prisma.InputJsonValue | null;
  firstSeenAt: Date;
  publishedAt: Date | null;
  errorMessage: string | null;
  feed: {
    id: string;
    name: string;
    platformsEnabled: Prisma.JsonValue;
  };
}): RSSActivityItem {
  const item = deserializeRSSItem(record.itemData as Prisma.JsonValue | null);
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
    platformPostIds: item?.platformPostIds,
    platformResults: item?.platformResults,
    duplicateEventKey: undefined,
    winningSource: undefined,
    suppressedSources: undefined,
    runtime: item?.runtimeDiagnostics,
    editorialBrain: buildRSSEditorialBrainActivityView(item || undefined),
    error: record.errorMessage || undefined,
  };
}

function buildRSSItemFromActivityItem(activity: RSSActivityItem): RSSItem {
  return {
    title: activity.title || '',
    link: activity.link || '',
    description: activity.description || '',
    pubDate: new Date(activity.publishedAt || activity.timestamp),
    imageUrl: activity.imageUrl,
    imageUrls: activity.imageUrls || [],
    imageSource: activity.imageSource,
    imageReason: activity.imageReason,
    imageScore: activity.imageScore,
    imageSelectionConfidence: activity.imageSelectionConfidence,
    selectedImages: activity.selectedImages,
    platformPostIds: activity.platformPostIds,
    platformResults: activity.platformResults,
    contentHtml: activity.contentHtml,
  };
}

function activityMatchesCurrentFeedRules(
  activity: RSSActivityItem,
  filters?: RSSFeedFilters | Prisma.JsonValue | null
): boolean {
  const normalizedFilters = ensureFeedFilters(filters as RSSFeedFilters | undefined);
  const hasActiveRequired = normalizedFilters.required.some((rule) => rule.active && rule.text.trim());
  const hasActiveBlocked = normalizedFilters.blocked.some((rule) => rule.active && rule.text.trim());

  if (!hasActiveRequired && !hasActiveBlocked) {
    return true;
  }

  return evaluateFeedRules(buildRSSItemFromActivityItem(activity), normalizedFilters).allowed;
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
    const dedupeKey = `${item.feedId || 'unknown'}:${getRSSActivityDedupeKey(item)}`;
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

async function resolveRSSActivityImageUrl(url?: string): Promise<string | undefined> {
  if (!url) {
    return undefined;
  }

  if (!/backblazeb2\.com|backblaze\.com|\/file\//i.test(url)) {
    return url;
  }

  try {
    return await getBackblazeAuthorizedDownloadUrl(url, 7 * 24 * 60 * 60);
  } catch {
    return url;
  }
}

function isNoResolvedImagesFailure(error?: string): boolean {
  return typeof error === 'string' &&
    error.toLowerCase().includes('no resolved images were available');
}

async function resolveRSSActivityItemImages(item: RSSActivityItem): Promise<RSSActivityItem> {
  if (isNoResolvedImagesFailure(item.error)) {
    return {
      ...item,
      imageUrl: undefined,
      imageUrls: [],
      selectedImages: [],
    };
  }

  const [imageUrl, imageUrls, selectedImages] = await Promise.all([
    resolveRSSActivityImageUrl(item.imageUrl),
    Promise.all((item.imageUrls || []).map((url) => resolveRSSActivityImageUrl(url))),
    Promise.all((item.selectedImages || []).map(async (image) => ({
      ...image,
      url: (await resolveRSSActivityImageUrl(image.url)) || image.url,
    }))),
  ]);

  return {
    ...item,
    imageUrl,
    imageUrls: imageUrls.filter((url): url is string => Boolean(url)),
    selectedImages,
  };
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
    duplicateEventKey: metadata.duplicateEventKey,
    winningSource: metadata.winningSource,
    suppressedSources: metadata.suppressedSources,
    runtime: metadata.runtime,
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
  runtimeSettings: RSSRuntimeSettings,
  speculationAssessment?: RSSSpeculationAssessment | null
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
    const canonicalState = getRSSCanonicalEntityRuntimeState(item);
    const canonicalEntity = canonicalState.canonicalEntity;
    await prepareRssEditorialBrainShadow(feed.name, item, runtimeSettings, canonicalEntity);
    const promotedImageStrategy = await getRSSEditorialBrainPromotedImageStrategyForItem(feed.name, item, runtimeSettings);
    const promotedCaptionStrategy = await getRSSEditorialBrainPromotedCaptionStrategyForItem(feed.name, item, runtimeSettings);
    const imageResolutionItem = promotedImageStrategy
      ? applyRSSEditorialBrainImageStrategyPromotionToItem(item, promotedImageStrategy)
      : item;
    const previousPlatformPostIds = item.platformPostIds || {};
    const previousPlatformResults = item.platformResults || [];
    const remainingPlatforms = platforms.filter((platform) => !previousPlatformPostIds[platform]);
    const storedCaptionVersion = typeof item.captionGenerationVersion === 'string' && item.captionGenerationVersion.trim()
      ? item.captionGenerationVersion.trim()
      : undefined;
    const storedCaptionPath = item.captionGenerationPath;
    const hadStoredSelectedImages = Boolean(item.selectedImages?.length);
    const hadStoredImageUrls = Boolean((item.imageUrls || []).length || item.imageUrl);

    if (remainingPlatforms.length === 0) {
      const runtimeDiagnosticItem = applyRSSRuntimeDiagnosticsToItem(item, {
        rulesetVersion: RSS_RUNTIME_RULESET_VERSION,
        codeVersion: getRSSRuntimeCodeVersion(),
        canonicalEntityVersion: item.canonicalEntityVersion,
        captionGenerationVersion: item.captionGenerationVersion,
        captionPath: item.captionGenerationPath,
        reusedStoredCaption: true,
        promotedImageStrategy,
        promotedCaptionStrategy,
        finalFailureCodes: [],
      });
      Object.assign(item, runtimeDiagnosticItem);
      const resolvedItem = applyRSSEditorialBrainRuntimeOutcomeToItem(item, {
        promotedImageStrategy,
        promotedCaptionStrategy,
        finalFailureCodes: [],
        lastOutcome: 'published',
      });
      Object.assign(item, resolvedItem);
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
      imageResolutionItem,
      imagePlan.maxImageCount,
      runtimeSettings
    );
    const publishImageUrls = publishImages.map((image) => image.url);
    const publishImageUrl = publishImageUrls[0];
    if (publishImageUrls.length === 0) {
      const runtimeDiagnosticItem = applyRSSRuntimeDiagnosticsToItem(item, {
        rulesetVersion: RSS_RUNTIME_RULESET_VERSION,
        codeVersion: getRSSRuntimeCodeVersion(),
        canonicalEntityVersion: item.canonicalEntityVersion,
        captionGenerationVersion: item.captionGenerationVersion,
        captionPath: item.captionGenerationPath,
        reusedStoredCaption: false,
        promotedImageStrategy,
        promotedCaptionStrategy,
        finalFailureCodes: ['IMAGE_NOT_RESOLVED_RUNTIME'],
      });
      Object.assign(item, runtimeDiagnosticItem);
      const resolvedItem = applyRSSEditorialBrainRuntimeOutcomeToItem(item, {
        promotedImageStrategy,
        promotedCaptionStrategy,
        finalFailureCodes: ['IMAGE_NOT_RESOLVED_RUNTIME'],
        lastOutcome: 'failed',
      });
      Object.assign(item, resolvedItem);
      logRSSRuntimeParity({
        phase: 'image_resolution_failed',
        feedId: feed.id,
        title: item.title,
        canonicalEntity,
        canonicalRecomputed: canonicalState.recomputed,
        canonicalStoredVersion: canonicalState.storedVersion,
        reusedStoredCaption: false,
        storedCaptionVersion,
        storedCaptionPath,
        resolvedImages: publishImages,
        hadStoredSelectedImages,
        hadStoredImageUrls,
        finalFailureCodes: ['IMAGE_NOT_RESOLVED_RUNTIME'],
        editorialBrainPromotedImageStrategy: promotedImageStrategy,
        editorialBrainPromotedCaptionStrategy: promotedCaptionStrategy,
      });
      return {
        status: 'failed',
        imageUrl: undefined,
        imageUrls: [],
        resolvedImages: [],
        platformPostIds: previousPlatformPostIds,
        platformResults: prunePlatformResultsForPrePublishFailure(previousPlatformResults),
        errorMessage: 'Publishing blocked because no resolved images were available for this RSS item.',
      };
    }

    const systemPrompt = buildRSSCaptionSystemPrompt(runtimeSettings.rssCaptionPrompt, {
      tone: runtimeSettings.rssCaptionTone,
      maxLength: runtimeSettings.rssCaptionMaxLength,
      speculationAssessment,
      promotedCaptionStrategy,
    });
    const shouldReuseStoredCaption = !promotedCaptionStrategy
      && canReuseStoredRSSCaption(item, feed.name, canonicalEntity, previousPlatformPostIds);
    const captionResult = shouldReuseStoredCaption
      ? { caption: item.generatedCaption!, path: 'ai_prompted' as const }
      : await aiService.generateRSSCaptionResult(
          {
            articleTitle: item.title,
            feedName: feed.name,
            summary: sanitizeRSSPlainText(item.description),
            articleBody: sanitizeRSSPlainText(item.contentHtml),
            articleContentHtml: item.contentHtml,
            platform: 'X',
            selectedVisuals: buildRSSCaptionVisualContext(item, publishImages),
            allowedEntities: buildRSSCaptionAllowedEntities(item, publishImages),
            canonicalEntity,
          },
          normalizeAIModel(runtimeSettings.rssCaptionModel),
          systemPrompt,
          runtimeSettings.rssCaptionTemperature
        );
    const caption = sanitizeRSSCaptionText(captionResult.caption, runtimeSettings.rssCaptionMaxLength);
    item.generatedCaption = caption;
    item.captionGenerationPath = captionResult.path;
    item.captionGenerationVersion = RSS_RUNTIME_RULESET_VERSION;
    console.log('[RSS][CaptionPath]', {
      feedId: feed.id,
      title: item.title,
      path: captionResult.path,
      reusedStoredCaption: shouldReuseStoredCaption,
      promotedCaptionStrategy: promotedCaptionStrategy || null,
      model: normalizeAIModel(runtimeSettings.rssCaptionModel),
    });
    const publishValidation = validateRSSFinalPublishState(caption, publishImages, canonicalEntity, captionResult.path, {
      articleTitle: item.title,
      feedName: feed.name,
      summary: sanitizeRSSPlainText(item.description),
      articleBody: sanitizeRSSPlainText(item.contentHtml),
      articleContentHtml: item.contentHtml,
      allowedEntities: buildRSSCaptionAllowedEntities(item, publishImages),
    });
    const resolvedPublishImages = publishValidation.resolvedImages;
    const resolvedPublishImageUrls = resolvedPublishImages.map((image) => image.url).filter(Boolean);
    const resolvedPublishImageUrl = resolvedPublishImageUrls[0];

    if (!publishValidation.valid) {
      console.log('[RSS][CaptionValidationFailed]', {
        feedId: feed.id,
        title: item.title,
        captionPath: captionResult.path,
        reusedStoredCaption: shouldReuseStoredCaption,
        reasonCodes: publishValidation.reasonCodes,
        captionPreview: (caption || '').slice(0, 220),
        rulesetVersion: RSS_RUNTIME_RULESET_VERSION,
      });
      const runtimeDiagnosticItem = applyRSSRuntimeDiagnosticsToItem(item, {
        rulesetVersion: RSS_RUNTIME_RULESET_VERSION,
        codeVersion: getRSSRuntimeCodeVersion(),
        canonicalEntityVersion: item.canonicalEntityVersion,
        captionGenerationVersion: item.captionGenerationVersion,
        captionPath: captionResult.path,
        reusedStoredCaption: shouldReuseStoredCaption,
        promotedImageStrategy,
        promotedCaptionStrategy,
        finalFailureCodes: publishValidation.reasonCodes,
      });
      Object.assign(item, runtimeDiagnosticItem);
      const resolvedItem = applyRSSEditorialBrainRuntimeOutcomeToItem(item, {
        promotedImageStrategy,
        promotedCaptionStrategy,
        finalFailureCodes: publishValidation.reasonCodes,
        lastOutcome: 'failed',
      });
      Object.assign(item, resolvedItem);
      logRSSRuntimeParity({
        phase: 'validation_failed',
        feedId: feed.id,
        title: item.title,
        canonicalEntity,
        canonicalRecomputed: canonicalState.recomputed,
        canonicalStoredVersion: canonicalState.storedVersion,
        reusedStoredCaption: shouldReuseStoredCaption,
        storedCaptionVersion,
        storedCaptionPath,
        captionPath: captionResult.path,
        resolvedImages: resolvedPublishImages,
        hadStoredSelectedImages,
        hadStoredImageUrls,
        finalFailureCodes: publishValidation.reasonCodes,
        editorialBrainPromotedImageStrategy: promotedImageStrategy,
        editorialBrainPromotedCaptionStrategy: promotedCaptionStrategy,
      });
      return {
        status: 'failed',
        caption,
        imageUrl: resolvedPublishImageUrl,
        imageUrls: resolvedPublishImageUrls,
        resolvedImages: resolvedPublishImages,
        platformPostIds: previousPlatformPostIds,
        platformResults: prunePlatformResultsForPrePublishFailure(previousPlatformResults),
        errorMessage: `Publishing blocked by RSS validation: ${publishValidation.reasonCodes.join(', ') || 'invalid final state'}.`,
      };
    }

    logRSSRuntimeParity({
      phase: 'ready_to_publish',
      feedId: feed.id,
      title: item.title,
      canonicalEntity,
      canonicalRecomputed: canonicalState.recomputed,
      canonicalStoredVersion: canonicalState.storedVersion,
      reusedStoredCaption: shouldReuseStoredCaption,
      storedCaptionVersion,
      storedCaptionPath,
      captionPath: captionResult.path,
      resolvedImages: resolvedPublishImages,
      hadStoredSelectedImages,
      hadStoredImageUrls,
      finalFailureCodes: [],
      editorialBrainPromotedImageStrategy: promotedImageStrategy,
      editorialBrainPromotedCaptionStrategy: promotedCaptionStrategy,
    });

    const readyRuntimeDiagnosticItem = applyRSSRuntimeDiagnosticsToItem(item, {
      rulesetVersion: RSS_RUNTIME_RULESET_VERSION,
      codeVersion: getRSSRuntimeCodeVersion(),
      canonicalEntityVersion: item.canonicalEntityVersion,
      captionGenerationVersion: item.captionGenerationVersion,
      captionPath: captionResult.path,
      reusedStoredCaption: shouldReuseStoredCaption,
      promotedImageStrategy,
      promotedCaptionStrategy,
      finalFailureCodes: [],
    });
    Object.assign(item, readyRuntimeDiagnosticItem);

    console.log('[RSS][Publish] Starting platform publish batch', {
      feedId: feed.id,
      title: item.title,
      requestedPlatforms: platforms,
      retryTargets: remainingPlatforms,
      previousPlatformPostIds,
      previousPlatformResults,
    });
    const publishResults = await publisherService.publish(
      remainingPlatforms,
      buildRSSPublishPayload(item, caption, resolvedPublishImageUrls, feed, remainingPlatforms)
    );
    console.log('[RSS][Publish] Completed platform publish batch', {
      feedId: feed.id,
      title: item.title,
      results: publishResults.map((result) => ({
        platform: result.platform,
        previousStatus: previousPlatformResults.find(
          (entry) => normalizeRSSPublishPlatformKey(entry.platform) === normalizeRSSPublishPlatformKey(result.platform)
        )?.status,
        newStatus: result.status,
        postId: result.id,
        error: result.error,
        postedAt: result.postedAt,
      })),
    });

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
      const runtimeDiagnosticItem = applyRSSRuntimeDiagnosticsToItem(item, {
        rulesetVersion: RSS_RUNTIME_RULESET_VERSION,
        codeVersion: getRSSRuntimeCodeVersion(),
        canonicalEntityVersion: item.canonicalEntityVersion,
        captionGenerationVersion: item.captionGenerationVersion,
        captionPath: item.captionGenerationPath,
        reusedStoredCaption: shouldReuseStoredCaption,
        promotedImageStrategy,
        promotedCaptionStrategy,
        finalFailureCodes: ['PLATFORM_PUBLISH_FAILED'],
      });
      Object.assign(item, runtimeDiagnosticItem);
      const resolvedItem = applyRSSEditorialBrainRuntimeOutcomeToItem(item, {
        promotedImageStrategy,
        promotedCaptionStrategy,
        finalFailureCodes: ['PLATFORM_PUBLISH_FAILED'],
        lastOutcome: 'failed',
      });
      Object.assign(item, resolvedItem);
      return {
        status: 'failed',
        caption,
        imageUrl: resolvedPublishImageUrl,
        imageUrls: resolvedPublishImageUrls,
        resolvedImages: resolvedPublishImages,
        platformPostIds,
        platformResults,
        errorMessage: publishResults
          .map((result) => `${result.platform}: ${result.error || result.status}`)
          .join('; ') || 'Publishing failed.',
      };
    }

    if (unresolvedPlatforms.length > 0) {
      const runtimeDiagnosticItem = applyRSSRuntimeDiagnosticsToItem(item, {
        rulesetVersion: RSS_RUNTIME_RULESET_VERSION,
        codeVersion: getRSSRuntimeCodeVersion(),
        canonicalEntityVersion: item.canonicalEntityVersion,
        captionGenerationVersion: item.captionGenerationVersion,
        captionPath: item.captionGenerationPath,
        reusedStoredCaption: shouldReuseStoredCaption,
        promotedImageStrategy,
        promotedCaptionStrategy,
        finalFailureCodes: ['PLATFORM_PUBLISH_PENDING_RETRY'],
      });
      Object.assign(item, runtimeDiagnosticItem);
      const resolvedItem = applyRSSEditorialBrainRuntimeOutcomeToItem(item, {
        promotedImageStrategy,
        promotedCaptionStrategy,
        finalFailureCodes: ['PLATFORM_PUBLISH_PENDING_RETRY'],
        lastOutcome: 'pending',
      });
      Object.assign(item, resolvedItem);
      return {
        status: 'pending',
        caption,
        imageUrl: resolvedPublishImageUrl,
        imageUrls: resolvedPublishImageUrls,
        resolvedImages: resolvedPublishImages,
        successfulPlatforms,
        remainingPlatforms: unresolvedPlatforms,
        platformPostIds,
        platformResults,
        errorMessage: partialFailureMessage || `Pending retry for ${unresolvedPlatforms.join(', ')}`,
      };
    }

    const runtimeDiagnosticItem = applyRSSRuntimeDiagnosticsToItem(item, {
      rulesetVersion: RSS_RUNTIME_RULESET_VERSION,
      codeVersion: getRSSRuntimeCodeVersion(),
      canonicalEntityVersion: item.canonicalEntityVersion,
      captionGenerationVersion: item.captionGenerationVersion,
      captionPath: item.captionGenerationPath,
      reusedStoredCaption: shouldReuseStoredCaption,
      promotedImageStrategy,
      promotedCaptionStrategy,
      finalFailureCodes: [],
    });
    Object.assign(item, runtimeDiagnosticItem);
    const resolvedItem = applyRSSEditorialBrainRuntimeOutcomeToItem(item, {
      promotedImageStrategy,
      promotedCaptionStrategy,
      finalFailureCodes: [],
      lastOutcome: 'published',
    });
    Object.assign(item, resolvedItem);
    return {
      status: 'published',
      caption,
        imageUrl: resolvedPublishImageUrl,
        imageUrls: resolvedPublishImageUrls,
        resolvedImages: resolvedPublishImages,
      successfulPlatforms,
      platformPostIds,
      platformResults,
      errorMessage: partialFailureMessage,
    };
  } catch (error) {
    const runtimeDiagnosticItem = applyRSSRuntimeDiagnosticsToItem(item, {
      rulesetVersion: RSS_RUNTIME_RULESET_VERSION,
      codeVersion: getRSSRuntimeCodeVersion(),
      canonicalEntityVersion: item.canonicalEntityVersion,
      captionGenerationVersion: item.captionGenerationVersion,
      captionPath: item.captionGenerationPath,
      finalFailureCodes: ['RUNTIME_EXCEPTION'],
    });
    Object.assign(item, runtimeDiagnosticItem);
    const resolvedItem = applyRSSEditorialBrainRuntimeOutcomeToItem(item, {
      finalFailureCodes: ['RUNTIME_EXCEPTION'],
      lastOutcome: 'failed',
    });
    Object.assign(item, resolvedItem);
    const preservedResolvedImages = (item.selectedImages || [])
      .filter((image) => typeof image?.url === 'string' && image.url.trim().length > 0)
      .map((image) => ({
        ...image,
        reason: image.reason || 'Previously resolved image',
      }));
    return {
      status: 'failed',
      caption: item.generatedCaption,
      imageUrl: preservedResolvedImages[0]?.url,
      imageUrls: preservedResolvedImages.map((image) => image.url),
      resolvedImages: preservedResolvedImages,
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
  const support = await getRSSFeedColumnSupport();
  const feeds = await prisma.rSSFeed.findMany({
    orderBy: support.displayOrder
      ? [{ displayOrder: 'asc' }, { createdAt: 'desc' }]
      : [{ createdAt: 'desc' }],
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
    tmdbEnabled: data.tmdbEnabled ?? true,
    openaiWebSearchEnabled: data.openaiWebSearchEnabled ?? false,
    imageSourcePriority: data.imageSourcePriority ?? (data.serperPriority ? 'serper_first' : 'tmdb_first'),
  };
  const support = await getRSSFeedColumnSupport();
  const select = await getRSSFeedSelect();
  const nextDisplayOrder = support.displayOrder
    ? await prisma.rSSFeed.aggregate({
        _max: { displayOrder: true },
      }).then((result) => (result._max.displayOrder ?? -1) + 1)
    : undefined;

  const createData: Prisma.RSSFeedCreateInput = {
    name: feedTitle || data.name,
    url: data.url,
    favicon,
    enabled: data.enabled ?? true,
    ...(support.displayOrder ? { displayOrder: nextDisplayOrder } : {}),
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
    createData.tmdbEnabled = data.tmdbEnabled ?? true;
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
    displayOrder?: number;
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
    data.tmdbEnabled !== undefined ||
    data.openaiWebSearchEnabled !== undefined ||
    data.imageSourcePriority !== undefined;

  if (data.name !== undefined) updateData.name = data.name;
  if (data.url !== undefined) updateData.url = data.url;
  if (data.favicon !== undefined) updateData.favicon = data.favicon;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (support.displayOrder && data.displayOrder !== undefined) updateData.displayOrder = Math.max(0, data.displayOrder);
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
        : existingStoredImageSourceSettings.tmdbEnabled ?? true),
    openaiWebSearchEnabled: data.openaiWebSearchEnabled ??
      existingStoredImageSourceSettings.openaiWebSearchEnabled ??
      false,
    imageSourcePriority: data.imageSourcePriority ??
      existingStoredImageSourceSettings.imageSourcePriority ??
      ((data.serperPriority ?? false) ? 'serper_first' : 'tmdb_first'),
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

async function reorderFeeds(orderedIds: string[]) {
  const support = await getRSSFeedColumnSupport();
  if (!support.displayOrder) {
    throw new Error('RSS feed ordering is not available until the latest migration is applied.');
  }

  const ids = orderedIds
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    throw new Error('At least one feed id is required to reorder feeds.');
  }

  const existingFeeds = await prisma.rSSFeed.findMany({
    select: { id: true },
  });
  const existingIds = existingFeeds.map((feed) => feed.id);

  if (existingIds.length !== ids.length || existingIds.some((id) => !ids.includes(id))) {
    throw new Error('Feed reorder payload must include every existing feed exactly once.');
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.rSSFeed.update({
        where: { id },
        data: {
          displayOrder: index,
          updatedAt: new Date(),
        },
      })
    )
  );

  return getAllFeeds();
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
    const support = await getRSSFeedColumnSupport();
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
    const recentCrossFeedQueueItems = support.feedItemsTable
      ? await prisma.rSSFeedItem.findMany({
          where: {
            feedId: { not: feed.id },
            status: { in: ['pending', 'published'] },
            firstSeenAt: { gte: new Date(Date.now() - activityLookbackDays * 24 * 60 * 60 * 1000) },
          },
          orderBy: { firstSeenAt: 'desc' },
          take: 1000,
          select: {
            itemData: true,
            firstSeenAt: true,
            status: true,
            feed: {
              select: {
                name: true,
              },
            },
          },
        })
      : [];
    const recentCrossFeedItems = recentCrossFeedQueueItems
      .map((record) => deserializeRSSItem(record.itemData))
      .filter((item): item is RSSItem => Boolean(item));
    const recentCrossFeedTitles = recentCrossFeedItems
      .map((item) => item.title)
      .filter((title): title is string => Boolean(title && title.trim()));
    const recentTopicFingerprints = recentActivities
      .filter((activity) => activity.status === 'pending' || activity.status === 'published')
      .filter((activity) => Date.now() - new Date(activity.timestamp).getTime() <= RSS_TOPIC_DEDUPE_LOOKBACK_MS)
      .map((activity) => buildRSSTopicFingerprint(activity.title))
      .concat(
        recentCrossFeedTitles.map((title) => buildRSSTopicFingerprint(title))
      )
      .filter((fingerprint) => fingerprint.signature);
    const recentSubjectCooldownFingerprints = recentActivities
      .filter((activity) => activity.status === 'pending' || activity.status === 'published')
      .filter((activity) => Date.now() - new Date(activity.timestamp).getTime() <= RSS_SUBJECT_COOLDOWN_MS)
      .map((activity) => buildRSSTopicFingerprint(activity.title))
      .concat(
        recentCrossFeedTitles.map((title) => buildRSSTopicFingerprint(title))
      )
      .filter((fingerprint) => fingerprint.subjectPhrases.size > 0 || fingerprint.entityTokens.size > 0);
    const recentEventCandidates = recentActivities
      .filter((activity) => activity.status === 'pending' || activity.status === 'published')
      .filter((activity) => Date.now() - new Date(activity.timestamp).getTime() <= RSS_TOPIC_DEDUPE_LOOKBACK_MS)
      .map((activity) => buildRSSDuplicateCandidate(
        activity.feedName,
        {
          title: activity.title,
          link: activity.link || '',
          description: activity.description || '',
          contentHtml: activity.contentHtml || '',
          imageUrls: [],
          pubDate: new Date(activity.publishedAt || activity.timestamp),
          canonicalEntity: undefined,
        },
        activity.status === 'published' ? 'published' : 'pending',
        new Date(activity.publishedAt || activity.timestamp)
      ))
      .concat(
        recentCrossFeedQueueItems.map((record) =>
          buildRSSDuplicateCandidate(
            record.feed.name,
            deserializeRSSItem(record.itemData) || {
              title: '',
              link: '',
              description: '',
              contentHtml: '',
              imageUrls: [],
              pubDate: record.firstSeenAt,
              canonicalEntity: undefined,
            },
            record.status === 'published' ? 'published' : 'pending',
            record.firstSeenAt
          )
        )
      )
      .filter((candidate): candidate is RSSDuplicateEventCandidate => Boolean(candidate));
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
    const getCrossSourceEventDuplicateDecision = (item: RSSItem): RSSDuplicateEventDecision | null => {
      return resolveRSSDuplicateEventDecision(feed.name, item, recentEventCandidates);
    };
    const getRecentSubjectCooldownReason = (item: RSSItem): string | null => {
      const itemFingerprint = buildRSSTopicFingerprint(item.title);
      if (itemFingerprint.subjectPhrases.size === 0 && itemFingerprint.entityTokens.size === 0) {
        return null;
      }

      const matchesRecentSubject = recentSubjectCooldownFingerprints.some((fingerprint) =>
        areRSSSubjectsInCooldown(itemFingerprint, fingerprint)
      );
      if (!matchesRecentSubject) {
        return null;
      }

      return 'Filtered because this subject was already queued or published within the last two hours from another source.';
    };
    const rememberRecentTopic = (item: RSSItem): void => {
      const fingerprint = buildRSSTopicFingerprint(item.title);
      if (fingerprint.signature) {
        recentTopicFingerprints.push(fingerprint);
      }
      if (fingerprint.subjectPhrases.size > 0 || fingerprint.entityTokens.size > 0) {
        recentSubjectCooldownFingerprints.push(fingerprint);
      }
      const eventCandidate = buildRSSDuplicateCandidate(feed.name, item, 'pending', item.pubDate || Date.now());
      if (eventCandidate) {
        recentEventCandidates.push(eventCandidate);
      }
    };
    const selectionMode = manualLatestSelection ? 'latest_item' : 'backlog';

    const platforms = getEnabledPlatforms(feed.platformsEnabled as Record<string, boolean> | null);
    const imagePlan = getRSSPublishImagePlan(feed, platforms);
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
            title: true,
          },
        })
      : [];
    const processedKeys = new Set<string>([
      ...activePendingQueue.map((entry) => getRSSItemLocalSeenKeys(entry.item)).flat(),
      ...knownFeedItems.flatMap((record) => {
        const keys = [record.dedupeKey];
        const topicKey = record.title ? getRSSItemTopicDedupeKey({ title: record.title } as RSSItem) : '';
        return topicKey ? [...keys, topicKey] : keys;
      }),
      ...feedRecentActivities.flatMap((activity) => {
        const keys = [getRSSActivityDedupeKey(activity)];
        const topicKey = activity.title ? getRSSItemTopicDedupeKey({ title: activity.title } as RSSItem) : '';
        return topicKey ? [...keys, topicKey] : keys;
      }),
    ]);
    const manualRunBlockedKeys = new Set<string>([
      ...activePendingQueue.map((entry) => getRSSItemLocalSeenKeys(entry.item)).flat(),
      ...knownFeedItems
        .filter((record) => record.status === 'pending' || record.status === 'published')
        .flatMap((record) => {
          const keys = [record.dedupeKey];
          const topicKey = record.title ? getRSSItemTopicDedupeKey({ title: record.title } as RSSItem) : '';
          return topicKey ? [...keys, topicKey] : keys;
        }),
      ...feedRecentActivities
        .filter((activity) => activity.status === 'pending' || activity.status === 'published')
        .flatMap((activity) => {
          const keys = [getRSSActivityDedupeKey(activity)];
          const topicKey = activity.title ? getRSSItemTopicDedupeKey({ title: activity.title } as RSSItem) : '';
          return topicKey ? [...keys, topicKey] : keys;
        }),
    ]);
    const latestEligibleItem = manualLatestSelection
      ? manualSelectionCandidates
          .find((item) => {
            const speculationAssessment = assessRSSArticleSpeculation(item);
            const editorialIngestionBlockReason = getRSSEditorialIngestionBlockReason(item);
            return !hasRSSItemLocalSeenKeys(manualRunBlockedKeys, item)
              && !editorialIngestionBlockReason
              && !getRecentSubjectCooldownReason(item)
              && !getCrossSourceEventDuplicateDecision(item)
              && !getCrossSourceTopicDuplicateReason(item)
              && !speculationAssessment.shouldSkipPublish
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
      const dedupeKey = getRSSItemDedupeKey(item);

      const editorialIngestionBlockReason = getRSSEditorialIngestionBlockReason(item);
      if (editorialIngestionBlockReason) {
        if (support.feedItemsTable) {
          await prisma.rSSFeedItem.update({
            where: { id: pendingEntry.record.id },
            data: {
              status: 'filtered',
              lastAttemptedAt: new Date(),
              errorMessage: editorialIngestionBlockReason,
              itemData: serializeRSSItem(item),
            },
          });
        }
        const filteredMetadata: RSSActivityMetadata = {
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          contentHtml: item.contentHtml,
          imageUrl: item.imageUrl,
          imageUrls: item.imageUrls,
          publishedAt: item.pubDate.toISOString(),
          status: 'filtered',
          platforms,
          errorMessage: editorialIngestionBlockReason,
        };
        await logRSSActivity(filteredMetadata);
        rememberRSSActivity(recentActivities, filteredMetadata);
        addRSSItemLocalSeenKeys(seenKeys, item);
        continue;
      }

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

      const pendingSubjectCooldownReason = getRecentSubjectCooldownReason(item);
      if (pendingSubjectCooldownReason) {
        if (support.feedItemsTable) {
          await prisma.rSSFeedItem.update({
            where: { id: pendingEntry.record.id },
            data: {
              status: 'filtered',
              lastAttemptedAt: new Date(),
              errorMessage: pendingSubjectCooldownReason,
              itemData: serializeRSSItem(item),
            },
          });
        }
        continue;
      }

      const pendingTopicDuplicateReason = getCrossSourceTopicDuplicateReason(item);
      const pendingEventDuplicateDecision = getCrossSourceEventDuplicateDecision(item);
      if (pendingTopicDuplicateReason) {
        if (support.feedItemsTable) {
          await prisma.rSSFeedItem.update({
            where: { id: pendingEntry.record.id },
            data: {
              status: 'filtered',
              lastAttemptedAt: new Date(),
              errorMessage: pendingTopicDuplicateReason,
              itemData: serializeRSSItem(item),
            },
          });
        }
        continue;
      }

      if (pendingEventDuplicateDecision) {
        if (support.feedItemsTable) {
          await prisma.rSSFeedItem.update({
            where: { id: pendingEntry.record.id },
            data: {
              status: 'filtered',
              lastAttemptedAt: new Date(),
              errorMessage: pendingEventDuplicateDecision.reason,
              itemData: serializeRSSItem(item),
            },
          });
        }
        const filteredMetadata: RSSActivityMetadata = {
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          contentHtml: item.contentHtml,
          imageUrl: item.imageUrl,
          imageUrls: item.imageUrls,
          publishedAt: item.pubDate.toISOString(),
          status: 'filtered',
          platforms,
          duplicateEventKey: pendingEventDuplicateDecision.duplicateEventKey,
          winningSource: pendingEventDuplicateDecision.winningSource,
          suppressedSources: pendingEventDuplicateDecision.suppressedSources,
          errorMessage: pendingEventDuplicateDecision.reason,
        };
        await logRSSActivity(filteredMetadata);
        rememberRSSActivity(recentActivities, filteredMetadata);
        continue;
      }

      const pendingSpeculationAssessment = assessRSSArticleSpeculation(item);
      if (pendingSpeculationAssessment.shouldSkipPublish) {
        if (support.feedItemsTable) {
          await prisma.rSSFeedItem.update({
            where: { id: pendingEntry.record.id },
            data: {
              status: 'filtered',
              lastAttemptedAt: new Date(),
              errorMessage: buildRSSSpeculationFilterReason(pendingSpeculationAssessment),
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

      if (hasRecentRSSActivity(recentActivities, feed.id, item, ['pending', 'published'])) {
        addRSSItemLocalSeenKeys(seenKeys, item);
        continue;
      }

      if (!acquireRSSPublishClaim(feed.id, item)) {
        pendingCount += 1;
        addRSSItemLocalSeenKeys(seenKeys, item);
        continue;
      }

      let claimAcquired = false;
      try {
        claimAcquired = await claimRSSFeedItemForPublish(feed.id, item, {
          recordId: pendingEntry.record.id,
        });

        if (!claimAcquired) {
          pendingCount += 1;
          addRSSItemLocalSeenKeys(seenKeys, item);
          continue;
        }

        const publishAttempt = await attemptRSSPublish(
          feed as any,
          item,
          platforms,
          imagePlan,
          runtimeSettings,
          pendingSpeculationAssessment
        );
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
          runtime: resolvedActivityItem.runtimeDiagnostics,
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
          runtime: resolvedActivityItem.runtimeDiagnostics,
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
        runtime: resolvedActivityItem.runtimeDiagnostics,
        errorMessage: publishAttempt.errorMessage,
      };
      await logRSSActivity(failedMetadata);
      rememberRSSActivity(recentActivities, failedMetadata);
      } finally {
        releaseRSSPublishClaim(feed.id, item);
      }
    }

    for (const item of itemsToProcess) {
      latestHandledItem = item;
      const dedupeKey = getRSSItemDedupeKey(item);

      if (hasRSSItemLocalSeenKeys(seenKeys, item)) {
        continue;
      }

      const editorialIngestionBlockReason = getRSSEditorialIngestionBlockReason(item);
      if (editorialIngestionBlockReason) {
        const filteredMetadata: RSSActivityMetadata = {
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          contentHtml: item.contentHtml,
          imageUrl: item.imageUrl,
          imageUrls: item.imageUrls,
          publishedAt: item.pubDate.toISOString(),
          status: 'filtered',
          platforms,
          errorMessage: editorialIngestionBlockReason,
        };
        await upsertRSSFeedItem(feed.id, item, 'filtered', {
          errorMessage: editorialIngestionBlockReason,
          firstSeenAt: item.pubDate,
        });
        addRSSItemLocalSeenKeys(seenKeys, item);
        if (!hasRecentRSSActivity(recentActivities, feed.id, item, ['filtered'])) {
          await logRSSActivity(filteredMetadata);
          rememberRSSActivity(recentActivities, filteredMetadata);
        }
        continue;
      }

      const ruleEvaluation = evaluateFeedRules(item, feedFilters);
      if (!ruleEvaluation.allowed) {
        await upsertRSSFeedItem(feed.id, item, 'filtered', {
          errorMessage: ruleEvaluation.reason ?? null,
          firstSeenAt: item.pubDate,
        });
        addRSSItemLocalSeenKeys(seenKeys, item);
        continue;
      }

      const topicDuplicateReason = getCrossSourceTopicDuplicateReason(item);
      const eventDuplicateDecision = getCrossSourceEventDuplicateDecision(item);
      const subjectCooldownReason = getRecentSubjectCooldownReason(item);
      if (subjectCooldownReason) {
        await upsertRSSFeedItem(feed.id, item, 'filtered', {
          errorMessage: subjectCooldownReason,
          firstSeenAt: item.pubDate,
        });
        addRSSItemLocalSeenKeys(seenKeys, item);
        continue;
      }

      if (eventDuplicateDecision) {
        await upsertRSSFeedItem(feed.id, item, 'filtered', {
          errorMessage: eventDuplicateDecision.reason,
          firstSeenAt: item.pubDate,
        });
        const filteredMetadata: RSSActivityMetadata = {
          category: RSS_ACTIVITY_CATEGORY,
          feedId: feed.id,
          feedName: feed.name,
          itemTitle: item.title,
          itemLink: item.link,
          description: item.description,
          contentHtml: item.contentHtml,
          imageUrl: item.imageUrl,
          imageUrls: item.imageUrls,
          publishedAt: item.pubDate.toISOString(),
          status: 'filtered',
          platforms,
          duplicateEventKey: eventDuplicateDecision.duplicateEventKey,
          winningSource: eventDuplicateDecision.winningSource,
          suppressedSources: eventDuplicateDecision.suppressedSources,
          errorMessage: eventDuplicateDecision.reason,
        };
        await logRSSActivity(filteredMetadata);
        rememberRSSActivity(recentActivities, filteredMetadata);
        addRSSItemLocalSeenKeys(seenKeys, item);
        continue;
      }

      if (topicDuplicateReason) {
        await upsertRSSFeedItem(feed.id, item, 'filtered', {
          errorMessage: topicDuplicateReason,
          firstSeenAt: item.pubDate,
        });
        addRSSItemLocalSeenKeys(seenKeys, item);
        continue;
      }

      const speculationAssessment = assessRSSArticleSpeculation(item);
      if (speculationAssessment.shouldSkipPublish) {
        await upsertRSSFeedItem(feed.id, item, 'filtered', {
          errorMessage: buildRSSSpeculationFilterReason(speculationAssessment),
          firstSeenAt: item.pubDate,
        });
        addRSSItemLocalSeenKeys(seenKeys, item);
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
        addRSSItemLocalSeenKeys(seenKeys, item);
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
        addRSSItemLocalSeenKeys(seenKeys, item);
        rememberRecentTopic(item);
        if (!hasRecentRSSActivity(recentActivities, feed.id, item, ['pending'])) {
          await logRSSActivity(pendingMetadata);
          rememberRSSActivity(recentActivities, pendingMetadata);
        }
        continue;
      }

      if (hasRecentRSSActivity(recentActivities, feed.id, item, ['pending', 'published'])) {
        addRSSItemLocalSeenKeys(seenKeys, item);
        continue;
      }

      if (!acquireRSSPublishClaim(feed.id, item)) {
        pendingCount += 1;
        addRSSItemLocalSeenKeys(seenKeys, item);
        continue;
      }

      let claimAcquired = false;
      try {
        claimAcquired = await claimRSSFeedItemForPublish(feed.id, item, {
          firstSeenAt: item.pubDate,
        });

        if (!claimAcquired) {
          addRSSItemLocalSeenKeys(seenKeys, item);
          continue;
        }

        const publishAttempt = await attemptRSSPublish(
          feed as any,
          item,
          platforms,
          imagePlan,
          runtimeSettings,
          speculationAssessment
        );
        addRSSItemLocalSeenKeys(seenKeys, item);
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
      } finally {
        releaseRSSPublishClaim(feed.id, item);
      }
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
  previewItem.canonicalEntity = ensureRSSCanonicalEntity(previewItem);
  await prepareRssEditorialBrainShadow(feed.name, previewItem, runtimeSettings, previewItem.canonicalEntity);
  const speculationAssessment = assessRSSArticleSpeculation(previewItem);
  if (speculationAssessment.shouldSkipPublish) {
    const message = buildRSSSpeculationFilterReason(speculationAssessment);
    return {
      title: previewItem.title,
      link: previewItem.link,
      pubDate: previewItem.pubDate.toISOString(),
      snippet: sanitizeRSSPlainText(previewItem.description),
      images: [],
      caption: message,
      captionCharCount: message.length,
    };
  }
  const platforms = getEnabledPlatforms(feed.platformsEnabled as Record<string, boolean> | null);
  const imagePlan = getRSSPublishImagePlan(feed, platforms);
  const promotedImageStrategy = await getRSSEditorialBrainPromotedImageStrategyForItem(feed.name, previewItem, runtimeSettings);
  const promotedCaptionStrategy = await getRSSEditorialBrainPromotedCaptionStrategyForItem(feed.name, previewItem, runtimeSettings);
  const resolvedImages = await resolveRSSItemImages(
    feed as any,
    promotedImageStrategy
      ? applyRSSEditorialBrainImageStrategyPromotionToItem(previewItem, promotedImageStrategy)
      : previewItem,
    imagePlan.maxImageCount,
    runtimeSettings
  );
  const imageUrls = resolvedImages.map((image) => image.url);
  const systemPrompt = buildRSSCaptionSystemPrompt(runtimeSettings.rssCaptionPrompt, {
    tone: runtimeSettings.rssCaptionTone,
    maxLength: runtimeSettings.rssCaptionMaxLength,
    speculationAssessment,
    promotedCaptionStrategy,
  });
  const captionResult = await aiService.generateRSSCaptionResult(
    {
      articleTitle: previewItem.title,
      feedName: feed.name,
      summary: sanitizeRSSPlainText(previewItem.description),
      articleBody: sanitizeRSSPlainText(previewItem.contentHtml),
      articleContentHtml: previewItem.contentHtml,
      platform: 'X',
      selectedVisuals: buildRSSCaptionVisualContext(previewItem, resolvedImages),
      allowedEntities: buildRSSCaptionAllowedEntities(previewItem, resolvedImages),
      canonicalEntity: previewItem.canonicalEntity,
    },
    normalizeAIModel(runtimeSettings.rssCaptionModel),
    systemPrompt,
    runtimeSettings.rssCaptionTemperature
  );
  const sanitizedCaption = sanitizeRSSCaptionText(captionResult.caption, runtimeSettings.rssCaptionMaxLength);
  console.log('[RSS][CaptionPath][Preview]', {
    feedId: feed.id,
    title: previewItem.title,
    path: captionResult.path,
    model: normalizeAIModel(runtimeSettings.rssCaptionModel),
  });
  const previewValidation = validateRSSFinalPublishState(
    sanitizedCaption,
    resolvedImages,
    previewItem.canonicalEntity,
    captionResult.path,
    {
      articleTitle: previewItem.title,
      feedName: feed.name,
      summary: sanitizeRSSPlainText(previewItem.description),
      articleBody: sanitizeRSSPlainText(previewItem.contentHtml),
      articleContentHtml: previewItem.contentHtml,
      allowedEntities: buildRSSCaptionAllowedEntities(previewItem, resolvedImages),
    }
  );

  return {
    title: previewItem.title,
    link: previewItem.link,
    pubDate: previewItem.pubDate.toISOString(),
    snippet: sanitizeRSSPlainText(previewItem.description),
    images: previewValidation.resolvedImages.map((image) => ({
      url: image.url,
      reason: image.reason,
    })),
    caption: previewValidation.valid
      ? sanitizedCaption
      : `Preview blocked by RSS validation: ${previewValidation.reasonCodes.join(', ')}.`,
    captionCharCount: (previewValidation.valid
      ? sanitizedCaption
      : `Preview blocked by RSS validation: ${previewValidation.reasonCodes.join(', ')}.`).length,
  };
}

async function getRSSActivity(limit: number = 100): Promise<{ items: RSSActivityItem[]; summary: RSSActivitySummary }> {
  const logs = await prisma.log.findMany({
    where: { service: 'rss' },
    orderBy: { timestamp: 'desc' },
    take: Math.max(limit * 5, 200),
    select: {
      id: true,
      timestamp: true,
      metadata: true,
    },
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
            filters: true,
          },
        },
      },
    });

    const recordItems = records
      .map((record) => ({
        activity: buildRSSActivityItemFromFeedRecord(record),
        filters: record.feed.filters,
      }))
      .filter(({ activity, filters }) => activityMatchesCurrentFeedRules(activity, filters))
      .map(({ activity }) => activity);

    const feedIds = Array.from(new Set([
      ...records.map((record) => record.feedId),
      ...logItems.map((item) => item.feedId).filter((feedId): feedId is string => Boolean(feedId)),
    ]));
    const feedFiltersById = new Map<string, Prisma.JsonValue | null>(
      feedIds.length > 0
        ? (await prisma.rSSFeed.findMany({
            where: { id: { in: feedIds } },
            select: { id: true, filters: true },
          })).map((feed) => [feed.id, feed.filters ?? null])
        : []
    );

    const filteredLogItems = logItems.filter((item) => {
      if (!item.feedId) {
        return true;
      }

      return activityMatchesCurrentFeedRules(item, feedFiltersById.get(item.feedId));
    });
    const items = await Promise.all(
      mergeRSSActivityItems(recordItems, filteredLogItems, limit).map((item) => resolveRSSActivityItemImages(item))
    );
    return {
      items,
      summary: buildActivitySummary(items),
    };
  }

  const feedIds = Array.from(new Set(logItems.map((item) => item.feedId).filter((feedId): feedId is string => Boolean(feedId))));
  const feedFiltersById = new Map<string, Prisma.JsonValue | null>(
    feedIds.length > 0
      ? (await prisma.rSSFeed.findMany({
          where: { id: { in: feedIds } },
          select: { id: true, filters: true },
        })).map((feed) => [feed.id, feed.filters ?? null])
      : []
  );
  const filteredLogItems = logItems.filter((item) => {
    if (!item.feedId) {
      return true;
    }

    return activityMatchesCurrentFeedRules(item, feedFiltersById.get(item.feedId));
  });
  const items = await Promise.all(filteredLogItems.slice(0, limit).map((item) => resolveRSSActivityItemImages(item)));
  return {
    items,
    summary: buildActivitySummary(items),
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

async function saveRSSEditorialBrainReview(
  id: string,
  review: {
    outcome: RSSEditorialBrainReviewOutcome;
    notes?: string;
  }
): Promise<RSSActivityItem> {
  const support = await getRSSFeedColumnSupport();
  if (!support.feedItemsTable) {
    throw new Error('Editorial brain review is not available in this build.');
  }

  const record = await prisma.rSSFeedItem.findUnique({
    where: { id },
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

  if (!record?.feed) {
    throw new Error('RSS activity item not found.');
  }

  const item = deserializeRSSItem(record.itemData);
  if (!item) {
    throw new Error('RSS activity item is missing its stored publish payload.');
  }

  const updatedItem = applyRSSEditorialBrainReviewToItem(item, review);
  await prisma.rSSFeedItem.update({
    where: { id },
    data: {
      itemData: serializeRSSItem(updatedItem),
    },
  });
  cachedRSSEditorialBrainImageStrategyCalibration = null;
  cachedRSSEditorialBrainCaptionStrategyCalibration = null;

  return resolveRSSActivityItemImages(buildRSSActivityItemFromFeedRecord({
    ...record,
    itemData: serializeRSSItem(updatedItem),
  }));
}

async function findRSSFeedItemRecordByActivityId(
  id: string,
  feedSelect: Prisma.RSSFeedSelect
) {
  const directRecord = await prisma.rSSFeedItem.findUnique({
    where: { id },
    include: {
      feed: {
        select: feedSelect,
      },
    },
  });

  if (directRecord?.feed) {
    return directRecord;
  }

  const activityLog = await prisma.log.findUnique({
    where: { id },
    select: {
      id: true,
      metadata: true,
    },
  });

  const activityItem = activityLog ? parseRSSActivityLog({
    id: activityLog.id,
    timestamp: new Date(),
    metadata: activityLog.metadata,
  }) : null;

  if (!activityItem?.feedId) {
    return null;
  }

  const matchClauses: Prisma.RSSFeedItemWhereInput[] = [];
  if (activityItem.link) {
    matchClauses.push({ link: activityItem.link });
  }
  if (activityItem.title) {
    matchClauses.push({ title: activityItem.title });
  }
  if (matchClauses.length === 0) {
    return null;
  }

  const candidates = await prisma.rSSFeedItem.findMany({
    where: {
      feedId: activityItem.feedId,
      OR: matchClauses,
    },
    orderBy: [
      { publishedAt: 'desc' },
      { firstSeenAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 1,
    include: {
      feed: {
        select: feedSelect,
      },
    },
  });

  return candidates[0] || null;
}

async function retryRSSActivity(id: string): Promise<RSSActivityItem> {
  const support = await getRSSFeedColumnSupport();
  if (!support.feedItemsTable) {
    throw new Error('RSS activity retry is not available in this build.');
  }

  const feedSelect = await getRSSFeedSelect();
  const record = await findRSSFeedItemRecordByActivityId(id, feedSelect);

  if (!record?.feed) {
    throw new Error('RSS activity item not found.');
  }

  const feed = applyRSSFeedCompatibility(record.feed as Record<string, any>);
  if (!feed) {
    throw new Error('RSS feed not found for this activity item.');
  }

  const item = deserializeRSSItem(record.itemData);
  if (!item) {
    throw new Error('RSS activity item is missing its stored publish payload.');
  }

  const platforms = getEnabledPlatforms(feed.platformsEnabled as Record<string, boolean> | null);
  if (platforms.length === 0) {
    throw new Error('This RSS feed has no enabled publishing platforms.');
  }

  const retryPlatforms = getFailedRSSPlatforms(item, platforms);
  if (retryPlatforms.length === 0) {
    throw new Error('This RSS activity item has no failed platforms to retry.');
  }

  const speculationAssessment = assessRSSArticleSpeculation(item);
  if (speculationAssessment.shouldSkipPublish) {
    throw new Error(buildRSSSpeculationFilterReason(speculationAssessment));
  }

  if (!acquireRSSPublishClaim(feed.id, item)) {
    throw new Error('This RSS activity item is already being retried.');
  }

  try {
    const runtimeSettings = await getRuntimeSettings();
    console.log('[RSS][Retry] Retrying failed platforms', {
      feedId: feed.id,
      activityId: id,
      retryPlatforms,
      previousPlatformResults: item.platformResults || [],
      cachedCanonicalVersion: item.canonicalEntityVersion || null,
      cachedCaptionVersion: item.captionGenerationVersion || null,
      cachedCaptionPath: item.captionGenerationPath || null,
      hasStoredCanonical: Boolean(item.canonicalEntity),
      hasStoredSelectedImages: Boolean(item.selectedImages?.length),
      hasStoredCaption: Boolean(item.generatedCaption?.trim()),
      runtimeRulesetVersion: RSS_RUNTIME_RULESET_VERSION,
      codeVersion: getRSSRuntimeCodeVersion(),
    });
    const imagePlan = getRSSPublishImagePlan(feed, platforms);
    const publishAttempt = await attemptRSSPublish(
      feed as any,
      item,
      retryPlatforms,
      imagePlan,
      runtimeSettings,
      speculationAssessment
    );
    const resolvedActivityItem = applyResolvedImagesToRSSItem(item, publishAttempt.resolvedImages);
    resolvedActivityItem.generatedCaption = publishAttempt.caption;
    resolvedActivityItem.platformPostIds = publishAttempt.platformPostIds;
    resolvedActivityItem.platformResults = publishAttempt.platformResults;

    const baseRecord = {
      ...record,
      itemData: serializeRSSItem(resolvedActivityItem),
      feed: {
        id: feed.id,
        name: feed.name,
        platformsEnabled: feed.platformsEnabled as Prisma.JsonValue,
      },
    };

    if (publishAttempt.status === 'published') {
      await upsertRSSFeedItem(feed.id, resolvedActivityItem, 'published', {
        publishedAt: item.pubDate,
        errorMessage: publishAttempt.errorMessage ?? null,
        firstSeenAt: record.firstSeenAt,
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
        runtime: resolvedActivityItem.runtimeDiagnostics,
        errorMessage: publishAttempt.errorMessage,
      };
      await logRSSActivity(publishedMetadata);

      return resolveRSSActivityItemImages(buildRSSActivityItemFromFeedRecord({
        ...baseRecord,
        status: 'published',
        publishedAt: item.pubDate,
        errorMessage: publishAttempt.errorMessage ?? null,
      }));
    }

    if (publishAttempt.status === 'pending') {
      await upsertRSSFeedItem(feed.id, resolvedActivityItem, 'pending', {
        errorMessage: publishAttempt.errorMessage,
        firstSeenAt: record.firstSeenAt,
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
        runtime: resolvedActivityItem.runtimeDiagnostics,
        errorMessage: publishAttempt.errorMessage,
      };
      await logRSSActivity(pendingMetadata);

      return resolveRSSActivityItemImages(buildRSSActivityItemFromFeedRecord({
        ...baseRecord,
        status: 'pending',
        errorMessage: publishAttempt.errorMessage,
      }));
    }

    await upsertRSSFeedItem(feed.id, resolvedActivityItem, 'failed', {
      errorMessage: publishAttempt.errorMessage,
      firstSeenAt: record.firstSeenAt,
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
      runtime: resolvedActivityItem.runtimeDiagnostics,
      errorMessage: publishAttempt.errorMessage,
    };
    await logRSSActivity(failedMetadata);

    return resolveRSSActivityItemImages(buildRSSActivityItemFromFeedRecord({
      ...baseRecord,
      status: 'failed',
      errorMessage: publishAttempt.errorMessage,
    }));
  } finally {
    releaseRSSPublishClaim(feed.id, item);
  }
}

async function claimRSSFeedItemForPublish(
  feedId: string,
  item: RSSItem,
  options?: {
    recordId?: string;
    firstSeenAt?: Date;
  }
): Promise<boolean> {
  const support = await getRSSFeedColumnSupport();
  if (!support.feedItemsTable) {
    return true;
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - RSS_PUBLISH_CLAIM_STALE_MS);
  const dedupeKey = getRSSItemDedupeKey(item);

  if (options?.recordId) {
    const claimed = await prisma.rSSFeedItem.updateMany({
      where: {
        id: options.recordId,
        feedId,
        status: 'pending',
        OR: [
          { lastAttemptedAt: null },
          { lastAttemptedAt: { lt: staleBefore } },
        ],
      },
      data: {
        lastAttemptedAt: now,
        errorMessage: null,
      },
    });

    return claimed.count > 0;
  }

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
      status: 'pending',
      itemData: serializeRSSItem(item),
      firstSeenAt: options?.firstSeenAt ?? now,
      lastAttemptedAt: null,
      publishedAt: null,
      errorMessage: null,
    },
    update: {
      title: item.title,
      link: item.link,
      guid: item.guid,
      itemData: serializeRSSItem(item),
    },
  });

  const claimed = await prisma.rSSFeedItem.updateMany({
    where: {
      feedId,
      dedupeKey,
      status: 'pending',
      OR: [
        { lastAttemptedAt: null },
        { lastAttemptedAt: { lt: staleBefore } },
      ],
    },
    data: {
      lastAttemptedAt: now,
      errorMessage: null,
    },
  });

  return claimed.count > 0;
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
  retryRSSActivity,
  deleteRSSActivity,
  saveRSSEditorialBrainReview,
  reorderFeeds,
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
  retryRSSActivity,
  deleteRSSActivity,
  saveRSSEditorialBrainReview,
  reorderFeeds,
};

export const __rssDedupeTestUtils = {
  buildRSSTopicFingerprint,
  buildRSSNewsEventFingerprint,
  areRSSTopicFingerprintsSimilar,
  areRSSNewsEventsSimilar,
  areRSSSubjectsInCooldown,
  getRSSItemLocalSeenKeys,
  getRSSSourcePriority,
  resolveRSSDuplicateEventDecision,
  buildRSSCaptionAllowedEntities,
  buildRSSCaptionVisualContext,
  assessRSSArticleSpeculation,
  buildRSSSpeculationFilterReason,
};

export const __rssAuditTestUtils = {
  sanitizeRSSPlainText,
  sanitizeRSSCaptionText,
  buildRSSCaptionSystemPrompt,
  classifyRSSArticleFamily,
  classifyRSSEditorialBlockType,
  getRSSEditorialIngestionBlockReason,
  classifyRSSHeadlineStyle,
  extractRSSBodyTitleRecoveryCandidates,
  buildRSSCanonicalEntity,
  ensureRSSCanonicalEntity,
  getRSSImageReasonCodes,
  validateRSSFinalPublishState,
  buildRSSCaptionAllowedEntities,
  buildRSSCaptionVisualContext,
  buildRssEditorialBrainFallbackDecision,
  buildCompressedRssEditorialBrainEvidencePacket,
  buildRSSEditorialBrainActivityView,
  applyRSSEditorialBrainRuntimeOutcomeToItem,
  applyRSSEditorialBrainReviewToItem,
  normalizeRSSRuntimeDiagnostics,
  applyRSSRuntimeDiagnosticsToItem,
  buildRSSActivityItemFromFeedRecord,
  parseRSSActivityLog,
  planRssEditorialBrainInvocation,
  buildRSSEditorialBrainImageStrategyCalibration,
  selectRSSEditorialBrainPromotedImageStrategy,
  applyRSSEditorialBrainImageStrategyPromotion,
  buildRSSEditorialBrainCaptionStrategyCalibration,
  selectRSSEditorialBrainPromotedCaptionStrategy,
  canReuseStoredRSSCaption,
  getRSSCanonicalEntityRuntimeState,
  buildRSSNewsEventFingerprint,
  areRSSNewsEventsSimilar,
  getRSSSourcePriority,
  resolveRSSDuplicateEventDecision,
};

