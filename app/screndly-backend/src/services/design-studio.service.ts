import prisma from '../lib/prisma';
import { generateStudioCaption } from './ai.service';
import { publisherService } from './publisher.service';
import { getRSSActivity, type RSSActivityItem } from './rss.service';
import { uploadBufferToBackblaze } from './backblaze';
import { serverPhotopeaRenderer } from './server-photopea-renderer';

const DESIGN_STUDIO_TEMPLATES_KEY = 'designStudioTemplates';
const DESIGN_STUDIO_RENDERED_KEY = 'designStudioRenderedDesigns';
const DESIGN_STUDIO_AUTO_EDITORIALS_KEY = 'designStudioAutoEditorials';

const DEFAULT_TRIGGER_KEYWORDS = [
  'renewed',
  'renewal',
  'canceled',
  'cancelled',
  'confirmed',
  'release date',
  'releasing',
  'premiere',
  'premieres',
  'in development',
];

type DesignStudioLayoutVariant =
  | 'top_left'
  | 'top_right'
  | 'top_center'
  | 'bottom_left'
  | 'bottom_right'
  | 'bottom_center';

type DesignStudioAutoEditorialStatus =
  | 'draft'
  | 'queued'
  | 'scheduled'
  | 'posted'
  | 'failed';

type DesignStudioContentType =
  | 'poster'
  | 'carousel'
  | 'story'
  | 'announcement'
  | 'general';

interface DesignStudioTemplateRecord {
  id: string;
  name: string;
  previewUrl: string;
  aspectRatio: string;
  width: number;
  height: number;
  source: 'upload' | 'backblaze';
  lastEdited: string;
  hasSubtext: boolean;
  hasCategory?: boolean;
  hasSource?: boolean;
  psdData?: Record<string, any> | null;
  layoutVariant?: DesignStudioLayoutVariant;
  mappedLayers?: string[];
  textZone?: { horizontal: 'left' | 'center' | 'right'; vertical: 'top' | 'bottom' };
  imageAnchor?: { x: number; y: number };
  overlayDirection?: 'top' | 'bottom' | 'left' | 'right';
  overlayStrength?: number;
  safeMargin?: number;
  isValidated?: boolean;
  validationState?: 'valid' | 'warning' | 'invalid';
  isDefaultManual?: boolean;
  isDefaultAuto?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface DesignStudioAutoEditorialRecord {
  id: string;
  sourceFeedItemId: string;
  sourceFeedId?: string;
  sourceFeedName?: string;
  sourceTitle: string;
  sourceUrl?: string;
  matchedKeyword?: string;
  templateId: string;
  templateName?: string;
  renderedImage: string;
  headerText: string;
  subheaderText?: string;
  caption: string;
  backgroundSource?: string;
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  zoomLevel?: number;
  overlayDirection?: 'top' | 'bottom' | 'left' | 'right';
  overlayStrength?: number;
  scheduleTime?: string | null;
  targetPlatforms: string[];
  status: DesignStudioAutoEditorialStatus;
  createdAt: string;
  updatedAt: string;
  postedAt?: string | null;
  failureReason?: string | null;
}

interface DesignStudioAutoSettings {
  enabled: boolean;
  autoPost: boolean;
  defaultTemplateId: string | null;
  postingInterval: number;
  triggerKeywords: string[];
  bannedKeywords: string[];
  selectedRssFeedIds: string[];
  maxEditorialsPerRun: number;
  captionLengthMode: 'short' | 'medium';
  minimumScoreThreshold: number;
  targetPlatforms: string[];
  model: string;
  promptGeneral: string;
  promptAnnouncement: string;
  captionTemperature: number;
  captionMaxTokens: number;
  captionTone: string;
}

interface DesignStudioRunResult {
  generated: number;
  published: number;
  failed: number;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeKeyword(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function findMatchedKeyword(title: string, keywords: string[]): string | undefined {
  const normalizedTitle = normalizeKeyword(title);
  return keywords.find((keyword) => normalizedTitle.includes(normalizeKeyword(keyword)));
}

function findBannedKeyword(title: string, keywords: string[]): string | undefined {
  const normalizedTitle = normalizeKeyword(title);
  return keywords.find((keyword) => normalizedTitle.includes(normalizeKeyword(keyword)));
}

function getContentTypeForKeyword(keyword?: string): DesignStudioContentType {
  const normalized = normalizeKeyword(keyword || '');
  if (normalized.includes('release date') || normalized.includes('premiere')) {
    return 'announcement';
  }
  if (normalized.includes('renew') || normalized.includes('cancel') || normalized.includes('confirm') || normalized.includes('development')) {
    return 'announcement';
  }
  return 'general';
}

function deriveEditorialScore(title: string, matchedKeyword: string, hasImage: boolean): number {
  let score = 50;
  score += matchedKeyword.trim().includes(' ') ? 12 : 8;
  if (title.length >= 40 && title.length <= 110) {
    score += 12;
  }
  if (hasImage) {
    score += 10;
  }
  return Math.min(100, score);
}

function deriveHeaderText(title: string): string {
  if (title.length <= 88) {
    return title;
  }
  return `${title.slice(0, 85).trim()}...`;
}

function deriveSubtext(feedName?: string, matchedKeyword?: string): string {
  if (!feedName && !matchedKeyword) {
    return '';
  }
  if (feedName && matchedKeyword) {
    return `${feedName} | ${matchedKeyword}`;
  }
  return feedName || matchedKeyword || '';
}

function buildCaptionPrompt(
  contentType: DesignStudioContentType,
  settings: DesignStudioAutoSettings,
): string {
  return contentType === 'announcement' ? settings.promptAnnouncement : settings.promptGeneral;
}

function getCaptionMaxLength(lengthMode: 'short' | 'medium'): number {
  return lengthMode === 'short' ? 160 : 220;
}

function truncateText(value: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function toTimestamp(value?: string | null): number {
  if (!value || typeof value !== 'string') {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildScheduledTime(
  index: number,
  postingInterval: number,
  existingEditorials: DesignStudioAutoEditorialRecord[],
): string {
  const futureScheduleTimes = existingEditorials
    .map((item) => item.scheduleTime)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value) && value > Date.now());

  const baseTime = futureScheduleTimes.length > 0
    ? new Date(Math.max(...futureScheduleTimes))
    : new Date();
  baseTime.setMinutes(baseTime.getMinutes() + (futureScheduleTimes.length > 0 ? postingInterval : 0) + (postingInterval * index));
  return baseTime.toISOString();
}

async function readJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  if (!setting) {
    return fallback;
  }
  return (setting.value as T) ?? fallback;
}

async function writeJsonSetting(key: string, value: unknown): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value: value as any },
    create: { key, value: value as any },
  });
}

async function createDesignStudioActivity(type: string, details: Record<string, any>): Promise<void> {
  await prisma.designStudioActivity.create({
    data: {
      type,
      details,
    },
  });
}

async function getAutoSettings(): Promise<DesignStudioAutoSettings> {
  const keys = [
    'designStudioAutoEnabled',
    'designStudioAutoPost',
    'designStudioDefaultAutoTemplateId',
    'designStudioPostingInterval',
    'designStudioTriggerKeywords',
    'designStudioBannedKeywords',
    'designStudioSelectedRssFeedIds',
    'designStudioMaxEditorialsPerRun',
    'designStudioCaptionLengthMode',
    'designStudioMinimumScoreThreshold',
    'designStudioTargetPlatforms',
    'captionOpenaiModel',
    'captionAnnouncementPrompt',
    'captionGeneralPrompt',
    'captionTemperature',
    'captionMaxTokens',
    'captionTone',
  ];
  const settings = await prisma.setting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });
  const map = new Map(settings.map((setting) => [setting.key, setting.value]));

  const triggerKeywords = asStringArray(map.get('designStudioTriggerKeywords'));
  const bannedKeywords = asStringArray(map.get('designStudioBannedKeywords'));

  return {
    enabled: parseBoolean(map.get('designStudioAutoEnabled'), false),
    autoPost: parseBoolean(map.get('designStudioAutoPost'), false),
    defaultTemplateId: typeof map.get('designStudioDefaultAutoTemplateId') === 'string'
      ? String(map.get('designStudioDefaultAutoTemplateId'))
      : null,
    postingInterval: Math.max(1, Number.parseInt(String(map.get('designStudioPostingInterval') ?? '5'), 10) || 5),
    triggerKeywords: triggerKeywords.length > 0 ? triggerKeywords : DEFAULT_TRIGGER_KEYWORDS,
    bannedKeywords,
    selectedRssFeedIds: asStringArray(map.get('designStudioSelectedRssFeedIds')),
    maxEditorialsPerRun: Math.max(1, Math.min(20, Number.parseInt(String(map.get('designStudioMaxEditorialsPerRun') ?? '5'), 10) || 5)),
    captionLengthMode: String(map.get('designStudioCaptionLengthMode') ?? 'medium') === 'short' ? 'short' : 'medium',
    minimumScoreThreshold: Math.max(0, Math.min(100, Number.parseInt(String(map.get('designStudioMinimumScoreThreshold') ?? '55'), 10) || 55)),
    targetPlatforms: asStringArray(map.get('designStudioTargetPlatforms')),
    model: typeof map.get('captionOpenaiModel') === 'string' ? String(map.get('captionOpenaiModel')) : 'gpt-5-mini',
    promptGeneral: typeof map.get('captionGeneralPrompt') === 'string'
      ? String(map.get('captionGeneralPrompt'))
      : 'Write a concise entertainment-news social caption. Keep it clear, punchy, and under 220 characters.',
    promptAnnouncement: typeof map.get('captionAnnouncementPrompt') === 'string'
      ? String(map.get('captionAnnouncementPrompt'))
      : 'Write a concise entertainment-news announcement caption. Lead with the news, keep it under 220 characters, and avoid fluff.',
    captionTemperature: Number(map.get('captionTemperature') ?? 0.7) || 0.7,
    captionMaxTokens: Number.parseInt(String(map.get('captionMaxTokens') ?? '500'), 10) || 500,
    captionTone: typeof map.get('captionTone') === 'string' ? String(map.get('captionTone')) : 'engaging',
  };
}

async function getTemplates(): Promise<DesignStudioTemplateRecord[]> {
  const templates = await readJsonSetting<unknown[]>(DESIGN_STUDIO_TEMPLATES_KEY, []);
  return Array.isArray(templates) ? templates.filter((item): item is DesignStudioTemplateRecord => Boolean(item && typeof item === 'object')) : [];
}

async function getAutoEditorials(): Promise<DesignStudioAutoEditorialRecord[]> {
  const editorials = await readJsonSetting<unknown[]>(DESIGN_STUDIO_AUTO_EDITORIALS_KEY, []);
  return Array.isArray(editorials)
    ? editorials.filter((item): item is DesignStudioAutoEditorialRecord => Boolean(item && typeof item === 'object'))
    : [];
}

async function saveAutoEditorials(editorials: DesignStudioAutoEditorialRecord[]): Promise<void> {
  await writeJsonSetting(DESIGN_STUDIO_AUTO_EDITORIALS_KEY, editorials);
}

function getAutoTemplatePool(
  templates: DesignStudioTemplateRecord[],
  defaultTemplateId: string | null,
): DesignStudioTemplateRecord[] {
  const validated = templates.filter((template) => template.isValidated !== false);
  if (validated.length > 0) {
    return validated;
  }
  if (defaultTemplateId) {
    const fallback = templates.find((template) => template.id === defaultTemplateId);
    return fallback ? [fallback] : [];
  }
  return [];
}

async function buildAutoCaption(
  item: RSSActivityItem,
  contentType: DesignStudioContentType,
  subtext: string,
  settings: DesignStudioAutoSettings,
): Promise<string> {
  const prompt = buildCaptionPrompt(contentType, settings);
  const rawCaption = await generateStudioCaption(
    {
      fileName: item.title,
      fileDescription: [subtext, item.description, item.feedName].filter(Boolean).join(' | '),
      tone: settings.captionTone,
    },
    settings.model as any,
    prompt,
    settings.captionTemperature,
    settings.captionMaxTokens,
  );

  return truncateText(rawCaption, getCaptionMaxLength(settings.captionLengthMode));
}

function selectRenderedImage(
  item: RSSActivityItem,
  template: DesignStudioTemplateRecord,
): string {
  return item.imageUrl
    || item.imageUrls?.[0]
    || template.previewUrl
    || '';
}

async function renderAutoEditorialImage(
  item: RSSActivityItem,
  template: DesignStudioTemplateRecord,
  headerText: string,
  subtext: string,
): Promise<string> {
  const psdUrl = template.psdData?.b2Url || template.psdData?.fileUrl;
  if (!psdUrl || typeof psdUrl !== 'string') {
    return selectRenderedImage(item, template);
  }

  const backgroundUrl = item.imageUrl || item.imageUrls?.[0];
  let backgroundBytes: Buffer | undefined;
  let backgroundFileName: string | undefined;

  if (backgroundUrl) {
    try {
      const imageResponse = await fetch(backgroundUrl);
      if (imageResponse.ok) {
        backgroundBytes = Buffer.from(await imageResponse.arrayBuffer());
        const parsedUrl = new URL(backgroundUrl);
        backgroundFileName = parsedUrl.pathname.split('/').pop() || 'background.jpg';
      }
    } catch {
      backgroundBytes = undefined;
      backgroundFileName = undefined;
    }
  }

  try {
    const renderedBuffer = await serverPhotopeaRenderer.renderTemplate({
      psdUrl,
      headerText,
      subtext,
      backgroundBytes,
      backgroundFileName,
      width: template.width,
      height: template.height,
      hasSubtext: template.hasSubtext,
      overlayDirection: template.overlayDirection || 'top',
      overlayStrength: template.overlayStrength || 75,
      backgroundOffsetX: template.imageAnchor?.x ?? 50,
      backgroundOffsetY: template.imageAnchor?.y ?? 50,
      zoomLevel: 1,
      headerTextColor: '#ffffff',
      subtextColor: '#ffffff',
    });
    const uploaded = await uploadBufferToBackblaze(
      renderedBuffer,
      `${template.name.replace(/[^a-zA-Z0-9-_]+/g, '-')}-auto.jpg`,
      {
        bucketTypes: ['design', 'general'],
        prefix: 'design-studio/renders',
        contentType: 'image/jpeg',
      },
    );
    return uploaded.url;
  } catch {
    return selectRenderedImage(item, template);
  }
}

export async function generateDesignStudioAutoEditorials(): Promise<DesignStudioRunResult> {
  const settings = await getAutoSettings();
  if (!settings.enabled) {
    return { generated: 0, published: 0, failed: 0 };
  }

  if (settings.selectedRssFeedIds.length === 0 || settings.triggerKeywords.length === 0) {
    return { generated: 0, published: 0, failed: 0 };
  }

  const [templates, existingEditorials, activity] = await Promise.all([
    getTemplates(),
    getAutoEditorials(),
    getRSSActivity(250),
  ]);

  const templatePool = getAutoTemplatePool(templates, settings.defaultTemplateId);
  if (templatePool.length === 0) {
    return { generated: 0, published: 0, failed: 0 };
  }

  const selectedFeedIds = new Set(settings.selectedRssFeedIds);
  const existingSourceIds = new Set(existingEditorials.map((item) => item.sourceFeedItemId));
  const seenTitles = new Set<string>();
  const candidates = activity.items
    .filter((item) => item.feedId && selectedFeedIds.has(item.feedId))
    .map((item) => {
      const blockedKeyword = findBannedKeyword(item.title, settings.bannedKeywords);
      if (blockedKeyword) {
        return null;
      }

      const matchedKeyword = findMatchedKeyword(item.title, settings.triggerKeywords);
      if (!matchedKeyword) {
        return null;
      }

      const normalizedTitle = normalizeKeyword(item.title);
      if (existingSourceIds.has(item.id) || seenTitles.has(normalizedTitle)) {
        return null;
      }
      seenTitles.add(normalizedTitle);

      const backgroundSource = item.imageUrl || item.imageUrls?.[0];
      const score = deriveEditorialScore(item.title, matchedKeyword, Boolean(backgroundSource));
      if (score < settings.minimumScoreThreshold) {
        return null;
      }

      return { item, matchedKeyword, backgroundSource, score };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((left, right) => right.score - left.score)
    .slice(0, settings.maxEditorialsPerRun);

  if (candidates.length === 0) {
    return { generated: 0, published: 0, failed: 0 };
  }

  const startingTemplateIndex = templatePool.length > 1
    ? Math.floor(Math.random() * templatePool.length)
    : 0;
  const nextEditorials: DesignStudioAutoEditorialRecord[] = [];

  for (const [index, candidate] of candidates.entries()) {
    const template = templatePool[(startingTemplateIndex + index) % templatePool.length];
    const contentType = getContentTypeForKeyword(candidate.matchedKeyword);
    const headerText = deriveHeaderText(candidate.item.title);
    const subtext = deriveSubtext(candidate.item.feedName, candidate.matchedKeyword);
    const caption = await buildAutoCaption(candidate.item, contentType, subtext, settings);
    const now = new Date().toISOString();
    const renderedImage = await renderAutoEditorialImage(candidate.item, template, headerText, subtext);

    nextEditorials.push({
      id: `auto-editorial-${Date.now()}-${index}`,
      sourceFeedItemId: candidate.item.id,
      sourceFeedId: candidate.item.feedId,
      sourceFeedName: candidate.item.feedName,
      sourceTitle: candidate.item.title,
      sourceUrl: candidate.item.link,
      matchedKeyword: candidate.matchedKeyword,
      templateId: template.id,
      templateName: template.name,
      renderedImage,
      headerText,
      subheaderText: subtext,
      caption,
      backgroundSource: candidate.backgroundSource,
      backgroundOffsetX: template.imageAnchor?.x ?? 50,
      backgroundOffsetY: template.imageAnchor?.y ?? 50,
      zoomLevel: 1,
      overlayDirection: template.overlayDirection || 'top',
      overlayStrength: template.overlayStrength || 75,
      scheduleTime: settings.autoPost ? buildScheduledTime(index, settings.postingInterval, existingEditorials) : null,
      targetPlatforms: settings.targetPlatforms,
      status: settings.autoPost ? 'scheduled' : 'draft',
      createdAt: now,
      updatedAt: now,
      postedAt: null,
      failureReason: null,
    });
  }

  if (nextEditorials.length > 0) {
    const combined = [...nextEditorials, ...existingEditorials];
    await saveAutoEditorials(combined);
    await Promise.all(
      nextEditorials.map((editorial) =>
        createDesignStudioActivity('auto_editorial_generated', {
          sourceTitle: editorial.sourceTitle,
          templateName: editorial.templateName,
          matchedKeyword: editorial.matchedKeyword,
          status: editorial.status,
        }),
      ),
    );
  }

  return { generated: nextEditorials.length, published: 0, failed: 0 };
}

export async function publishScheduledDesignStudioAutoEditorials(): Promise<DesignStudioRunResult> {
  const settings = await getAutoSettings();
  if (!settings.enabled || !settings.autoPost) {
    return { generated: 0, published: 0, failed: 0 };
  }

  const editorials = await getAutoEditorials();
  const now = Date.now();
  const dueItems = editorials
    .filter((item) =>
      item.status === 'scheduled'
      && typeof item.scheduleTime === 'string'
      && new Date(item.scheduleTime).getTime() <= now,
    )
    .sort((left, right) => toTimestamp(left.scheduleTime) - toTimestamp(right.scheduleTime))
    .slice(0, 5);

  if (dueItems.length === 0) {
    return { generated: 0, published: 0, failed: 0 };
  }

  let published = 0;
  let failed = 0;
  const editorialMap = new Map(editorials.map((item) => [item.id, { ...item }]));

  for (const editorial of dueItems) {
    const target = editorialMap.get(editorial.id);
    if (!target) {
      continue;
    }

    if (!target.targetPlatforms || target.targetPlatforms.length === 0) {
      target.status = 'failed';
      target.failureReason = 'No target platforms configured.';
      target.updatedAt = new Date().toISOString();
      failed += 1;
      await createDesignStudioActivity('auto_editorial_failed', {
        sourceTitle: target.sourceTitle,
        reason: target.failureReason,
      });
      continue;
    }

    try {
      const results = await publisherService.publish(target.targetPlatforms, {
        text: target.caption,
        title: target.headerText,
        imageUrl: target.renderedImage,
      });
      const success = results.some((result) => result.status === 'posted');
      const failureMessage = results
        .filter((result) => result.status !== 'posted')
        .map((result) => `${result.platform}: ${result.error || 'Publish failed'}`)
        .join(', ');

      target.status = success ? 'posted' : 'failed';
      target.postedAt = success ? new Date().toISOString() : null;
      target.updatedAt = new Date().toISOString();
      target.failureReason = success ? (failureMessage || null) : (failureMessage || 'Failed to publish auto editorial');

      if (success) {
        published += 1;
        await createDesignStudioActivity('auto_editorial_posted', {
          sourceTitle: target.sourceTitle,
          templateName: target.templateName,
          targetPlatforms: target.targetPlatforms,
        });
      } else {
        failed += 1;
        await createDesignStudioActivity('auto_editorial_failed', {
          sourceTitle: target.sourceTitle,
          reason: target.failureReason,
        });
      }
    } catch (error) {
      target.status = 'failed';
      target.updatedAt = new Date().toISOString();
      target.failureReason = error instanceof Error ? error.message : 'Failed to publish auto editorial';
      failed += 1;
      await createDesignStudioActivity('auto_editorial_failed', {
        sourceTitle: target.sourceTitle,
        reason: target.failureReason,
      });
    }
  }

  await saveAutoEditorials(Array.from(editorialMap.values()));
  return { generated: 0, published, failed };
}

export async function getDesignStudioStateSnapshot() {
  const [templates, renderedDesigns, autoEditorials] = await Promise.all([
    readJsonSetting(DESIGN_STUDIO_TEMPLATES_KEY, []),
    readJsonSetting(DESIGN_STUDIO_RENDERED_KEY, []),
    readJsonSetting(DESIGN_STUDIO_AUTO_EDITORIALS_KEY, []),
  ]);

  return {
    templates: Array.isArray(templates) ? templates : [],
    renderedDesigns: Array.isArray(renderedDesigns) ? renderedDesigns : [],
    autoEditorials: Array.isArray(autoEditorials) ? autoEditorials : [],
  };
}

export async function saveDesignStudioStateSnapshot(state: {
  templates: unknown[];
  renderedDesigns: unknown[];
  autoEditorials?: unknown[];
}): Promise<void> {
  await Promise.all([
    writeJsonSetting(DESIGN_STUDIO_TEMPLATES_KEY, state.templates),
    writeJsonSetting(DESIGN_STUDIO_RENDERED_KEY, state.renderedDesigns),
    writeJsonSetting(DESIGN_STUDIO_AUTO_EDITORIALS_KEY, state.autoEditorials ?? []),
  ]);
}
