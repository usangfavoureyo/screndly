import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Upload, Cloud, X, MoreVertical, Plus, Calendar, Clock3, ImagePlus, LoaderCircle, RefreshCw, Search, ExternalLink, Bookmark, BookmarkCheck, ArrowDownWideNarrow, Check } from 'lucide-react';
import { toast } from "sonner";
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { EditDesignBottomSheet, DesignData } from './EditDesignBottomSheet';
import { PublishBottomSheet } from './PublishBottomSheet';
import { BackblazeTemplateBrowser } from './BackblazeTemplateBrowser';
import { SwipeableTemplateCard } from './SwipeableTemplateCard';
import { SwipeableActivityCard } from './SwipeableActivityCard';
import { VisuallyHidden } from './ui/visually-hidden';
import { MediaPreviewDialog } from './media/MediaPreviewDialog';
import { haptics } from '../utils/haptics';
import { addRecentActivity, addLogEntry } from '../utils/activityStore';
import { useNotifications } from '../contexts/NotificationsContext';
import { useSettings } from '../contexts/SettingsContext';
import { useRSSFeeds, type RSSActivityItem } from '../contexts/RSSFeedsContext';
import { useUndo } from './UndoContext';
import { SegmentedTabSwitcher } from './SegmentedTabSwitcher';
import { BottomSheet, BottomSheetBody, BottomSheetFooter, BottomSheetHeader, BottomSheetTitle } from './ui/bottom-sheet';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  createDesignStudioActivity,
  fetchDesignStudioRenderJobs,
  fetchDesignStudioState,
  fetchDesignStudioTMDbImages,
  importDesignStudioTemplate,
  saveDesignStudioState,
  searchDesignStudioTMDb,
  startDesignStudioManualRender,
  uploadDesignStudioAsset,
  uploadDesignStudioTemplate,
  type DesignStudioAutoEditorialRecord,
  type DesignStudioLayoutVariant,
  type DesignStudioManualRenderJob,
  type DesignStudioTMDbImageAsset,
  type DesignStudioTMDbImagePool,
  type DesignStudioTMDbSearchResult,
} from '../lib/api/designStudio';
import { publishContent, type PlatformSelection } from '../lib/api/platforms';

interface DesignStudioPageProps {
  onNavigate: (page: string, fromPage?: string | null) => void;
  previousPage?: string | null;
}

const TEMPLATE_PREVIEW_DOUBLE_TAP_PROXIMITY = 32;

const PSD_FILE_ACCEPT =
  '.psd,application/vnd.adobe.photoshop,application/photoshop,application/x-photoshop,application/psd,application/octet-stream';

type FilePickerHandle = {
  getFile: () => Promise<File>;
};

interface Template {
  id: string;
  name: string;
  sourceType?: 'device' | 'backblaze';
  sourceFilePath?: string;
  previewImage?: string;
  previewUrl: string;
  aspectRatio: string;
  width: number;
  height: number;
  source: 'upload' | 'backblaze';
  lastEdited: Date;
  hasHeader: boolean;
  hasBackground: boolean;
  hasSubtext: boolean;
  hasOverlay: boolean;
  hasCategory?: boolean;
  hasSource?: boolean;
  psdData?: any; // Will store actual PSD data in production
  baseVariant?: DesignStudioLayoutVariant;
  layoutVariant?: DesignStudioLayoutVariant;
  mappedLayers?: Record<string, string>;
  mappedLayerNames?: string[];
  layerReferences?: Array<Record<string, any>>;
  fontFamily?: string;
  fontStyle?: string;
  fontWeight?: number;
  baseFontSize?: number;
  fontColor?: string;
  lineHeightMultiplier?: number;
  tracking?: number;
  isPointText?: boolean;
  variants?: Array<Record<string, any>>;
  textZone?: { horizontal: 'left' | 'center' | 'right'; vertical: 'top' | 'bottom' };
  imageAnchor?: { x: number; y: number };
  overlayDirection?: string;
  overlayStrength?: number;
  safeMargin?: number;
  isValidated?: boolean;
  validationState?: 'valid' | 'warning' | 'invalid';
  validationErrors?: string[];
  isDefaultManual?: boolean;
  isDefaultAuto?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RenderedDesign {
  id: string;
  templateId: string;
  templateName: string;
  templateVariant?: DesignStudioLayoutVariant;
  exportFormat?: 'jpeg' | 'png';
  outputUrl: string;
  data: DesignData;
  createdAt: Date;
  aspectRatio: string;
  caption?: string; // AI-generated caption
  contentType?: 'poster' | 'carousel' | 'story' | 'announcement' | 'general';
}

interface DesignStudioEditorTarget {
  templateId: string;
  tab?: DesignStudioTab;
  initialData?: DesignData | null;
}

function safeStorageSetItem(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Failed to persist Design Studio cache for ${key}:`, error);
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Failed to persist Design Studio session cache for ${key}:`, error);
  }
}

function safeStorageGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const localValue = window.localStorage.getItem(key);
    if (localValue !== null) {
      return localValue;
    }
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function normalizeIsoString(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return fallback;
}

function compactBackgroundImage(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('data:')) {
    return '';
  }
  return trimmed;
}

function normalizeManualRenderJob(job: any): ManualRenderJob | null {
  if (!job || typeof job !== 'object') {
    return null;
  }

  const id = typeof job.id === 'string' ? job.id.trim() : '';
  const templateId = typeof job.templateId === 'string' ? job.templateId.trim() : '';
  const templateName = typeof job.templateName === 'string' ? job.templateName.trim() : 'Untitled template';
  if (!id || !templateId) {
    return null;
  }

  const status = job.status === 'rendering'
    || job.status === 'completed'
    || job.status === 'failed'
    ? job.status
    : 'queued';

  return {
    id,
    templateId,
    templateName,
    status,
    createdAt: normalizeIsoString(job.createdAt) || new Date().toISOString(),
    updatedAt: normalizeIsoString(job.updatedAt) || normalizeIsoString(job.createdAt) || new Date().toISOString(),
    renderedDesignId: typeof job.renderedDesignId === 'string' && job.renderedDesignId.trim().length > 0
      ? job.renderedDesignId
      : null,
    outputUrl: typeof job.outputUrl === 'string' && job.outputUrl.trim().length > 0 ? job.outputUrl : null,
    failureReason: typeof job.failureReason === 'string' && job.failureReason.trim().length > 0 ? job.failureReason : null,
  };
}

function compactTemplateForCache(template: ReturnType<typeof serializeTemplates>[number]) {
  return {
    id: template.id,
    name: template.name,
    sourceType: template.sourceType,
    sourceFilePath: template.sourceFilePath,
    previewImage: template.previewImage,
    previewUrl: template.previewUrl,
    aspectRatio: template.aspectRatio,
    width: template.width,
    height: template.height,
    source: template.source,
    lastEdited: template.lastEdited,
    hasHeader: template.hasHeader,
    hasBackground: template.hasBackground,
    hasSubtext: template.hasSubtext,
    hasOverlay: template.hasOverlay,
    hasCategory: template.hasCategory,
    hasSource: template.hasSource,
    baseVariant: template.baseVariant,
    layoutVariant: template.layoutVariant,
    fontFamily: template.fontFamily,
    fontStyle: template.fontStyle,
    fontWeight: template.fontWeight,
    baseFontSize: template.baseFontSize,
    fontColor: template.fontColor,
    lineHeightMultiplier: template.lineHeightMultiplier,
    tracking: template.tracking,
    isPointText: template.isPointText,
    overlayDirection: template.overlayDirection,
    overlayStrength: template.overlayStrength,
    safeMargin: template.safeMargin,
    isValidated: template.isValidated,
    validationState: template.validationState,
    validationErrors: template.validationErrors,
    isDefaultManual: template.isDefaultManual,
    isDefaultAuto: template.isDefaultAuto,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function compactRenderedDesignForCache(renderedDesign: ReturnType<typeof serializeRenderedDesigns>[number]) {
  const data = asRecord(renderedDesign.data);
  return {
    ...renderedDesign,
    data: {
      ...data,
      backgroundImage: compactBackgroundImage(data.backgroundImage),
    },
  };
}

function compactAutoEditorialForCache(editorial: AutoEditorial) {
  return {
    id: editorial.id,
    sourceFeedItemId: editorial.sourceFeedItemId,
    sourceFeedId: editorial.sourceFeedId,
    sourceFeedName: editorial.sourceFeedName,
    sourceTitle: editorial.sourceTitle,
    sourceUrl: editorial.sourceUrl,
    matchedKeyword: editorial.matchedKeyword,
    templateId: editorial.templateId,
    templateName: editorial.templateName,
    templateVariant: editorial.templateVariant,
    renderedImage: editorial.renderedImage,
    headerText: editorial.headerText,
    subheaderText: editorial.subheaderText,
    contentType: editorial.contentType,
    caption: editorial.caption,
    captions: editorial.captions,
    backgroundSource: editorial.backgroundSource,
    backgroundOffsetX: editorial.backgroundOffsetX,
    backgroundOffsetY: editorial.backgroundOffsetY,
    zoomLevel: editorial.zoomLevel,
    headerTextColor: editorial.headerTextColor,
    brandBlockMode: editorial.brandBlockMode,
    overlayDirection: editorial.overlayDirection,
    overlayStrength: editorial.overlayStrength,
    scheduleTime: editorial.scheduleTime,
    targetPlatforms: editorial.targetPlatforms,
    status: editorial.status,
    createdAt: editorial.createdAt,
    updatedAt: editorial.updatedAt,
    postedAt: editorial.postedAt,
    failureReason: editorial.failureReason,
  };
}

function readPendingEditorTarget(): DesignStudioEditorTarget | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DESIGN_STUDIO_EDITOR_TARGET_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

type DesignStudioTab = 'manual' | 'auto';
type DesignStudioTopTab = 'templates' | 'manual' | 'auto';
type ManualWorkspaceTab = 'templates' | 'news_queue';
type NewsQueueSortOption = 'recent-desc' | 'recent-asc';
type NewsQueueFilterSheetTab = 'sort' | 'source';

type AutoEditorial = DesignStudioAutoEditorialRecord;
type ManualRenderJob = DesignStudioManualRenderJob;

interface ManualDraftSourceContext {
  feedItemId: string;
  sourceName: string;
  sourceHeadline: string;
  suggestedHeadline: string;
  sourceUrl?: string;
  sourceSummary?: string;
  fetchedAt: string;
  matchedKeyword?: string;
}

type AutoEditorialAction =
  | 'caption'
  | 'header'
  | 'subheader'
  | 'background'
  | 'overlay'
  | 'template'
  | 'schedule';

function formatPlatformLabel(platform: string): string {
  const normalized = platform.trim().toLowerCase();
  if (normalized === 'x' || normalized === 'twitter') return 'X';
  if (normalized === 'threads') return 'Threads';
  if (normalized === 'instagram') return 'Instagram';
  if (normalized === 'facebook') return 'Facebook';
  if (normalized === 'pinterest') return 'Pinterest';
  return platform;
}

function formatEditorialDateTime(value?: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getActionButtonClass(isDestructive = false): string {
  return [
    'w-full rounded-2xl border px-4 py-4 text-left text-sm font-medium transition-colors',
    isDestructive
      ? 'border-[#ec1e24]/35 bg-[#ec1e24]/10 text-[#ec1e24] hover:bg-[#ec1e24]/15'
      : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]',
  ].join(' ');
}

function buildDatetimeLocalParts(value?: string | null): { date: string; time: string } {
  if (!value) {
    return { date: '', time: '' };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: '', time: '' };
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

function combineDatetimeLocal(date: string, time: string): string | null {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function toBackgroundImagePoolList(
  pool: DesignStudioTMDbImagePool,
  mediaType: DesignStudioTMDbSearchResult['mediaType'],
): Array<DesignStudioTMDbImageAsset & { kind: 'backdrop' | 'poster' | 'logo' | 'profile' }> {
  if (mediaType === 'person') {
    return (pool.profiles || []).map((asset) => ({ ...asset, kind: 'profile' as const }));
  }

  if (mediaType === 'company') {
    return (pool.logos || []).map((asset) => ({ ...asset, kind: 'logo' as const }));
  }

  return [
    ...(pool.backdrops || []).map((asset) => ({ ...asset, kind: 'backdrop' as const })),
    ...(pool.posters || []).map((asset) => ({ ...asset, kind: 'poster' as const })),
    ...(pool.logos || []).map((asset) => ({ ...asset, kind: 'logo' as const })),
  ];
}

const DESIGN_STUDIO_PAGE_CACHE_KEY = 'designStudioPageCache';
const DESIGN_STUDIO_EDITOR_TARGET_KEY = 'screndly_design_studio_editor_target';
const DESIGN_STUDIO_MANUAL_WORKSPACE_TAB_KEY = 'designStudioManualWorkspaceTab';
const DESIGN_STUDIO_TOP_TAB_KEY = 'designStudioTopTab';
const DESIGN_STUDIO_TEMPLATE_LIST_COLLAPSED_KEY = 'designStudioTemplateListCollapsed';
const DESIGN_STUDIO_NEWS_QUEUE_DISMISSED_KEY = 'designStudioNewsQueueDismissed';
const DESIGN_STUDIO_NEWS_QUEUE_SAVED_KEY = 'designStudioNewsQueueSaved';
const DESIGN_STUDIO_NEWS_QUEUE_USED_KEY = 'designStudioNewsQueueUsed';
const NEWS_QUEUE_SORT_LABELS: Record<NewsQueueSortOption, string> = {
  'recent-desc': 'Recently Added',
  'recent-asc': 'Oldest Added',
};

function buildTemplateInitialData(template: Template, exportFormat: 'jpeg' | 'png'): DesignData {
  return {
    headerText: '',
    subtext: '',
    headerTextColor: template.fontColor || '#FFFFFF',
    fontScale: 1,
    headlineWidthScale: 1,
    lineHeightMultiplier: template.lineHeightMultiplier || 0.93,
    backgroundImage: '',
    imageFocalPoint: { x: 50, y: 50 },
    imageZoom: 1,
    overlayEnabled: true,
    overlayColor: '#000000',
    overlayOpacity: typeof template.overlayStrength === 'number'
      ? Math.round(template.overlayStrength * 100)
      : 70,
    gradientPosition: (template.overlayDirection as DesignData['gradientPosition']) || 'top',
    templateVariant: template.layoutVariant || template.baseVariant || 'bottom_center',
    fadeEnabled: true,
    fadeOpacity: 90,
    brandBlockMode: 'auto',
    exportFormat,
  };
}

function parseTemplate(template: any): Template {
  const source = asRecord(template);
  const lastEditedSource = template.lastEdited || template.updatedAt || template.createdAt || new Date().toISOString();
  return {
    ...source,
    id: typeof source.id === 'string' ? source.id : `template-${Math.random().toString(36).slice(2, 10)}`,
    name: typeof source.name === 'string' && source.name.trim().length > 0 ? source.name : 'Untitled template',
    previewUrl: source.previewUrl || source.previewImage,
    hasHeader: source.hasHeader ?? true,
    hasBackground: source.hasBackground ?? true,
    hasSubtext: source.hasSubtext ?? false,
    hasOverlay: source.hasOverlay ?? Boolean(asRecord(source.psdData).detectedLayers?.hasOverlay),
    lastEdited: new Date(lastEditedSource),
    createdAt: source.createdAt ? normalizeDate(source.createdAt) : undefined,
    updatedAt: source.updatedAt ? normalizeDate(source.updatedAt) : undefined,
  };
}

function parseRenderedDesign(renderedDesign: any): RenderedDesign {
  const source = asRecord(renderedDesign);
  const data = asRecord(source.data);
  const outputUrl = typeof source.outputUrl === 'string'
    ? source.outputUrl.trim()
    : typeof source.previewUrl === 'string'
      ? source.previewUrl.trim()
      : '';
  return {
    ...source,
    id: typeof source.id === 'string' ? source.id : `rendered-design-${Math.random().toString(36).slice(2, 10)}`,
    templateId: typeof source.templateId === 'string' ? source.templateId : '',
    templateName: typeof source.templateName === 'string' && source.templateName.trim().length > 0
      ? source.templateName
      : 'Untitled design',
    outputUrl,
    data: {
      ...data,
      backgroundImage: compactBackgroundImage(data.backgroundImage),
    },
    createdAt: normalizeDate(source.createdAt),
  };
}

function serializeTemplates(templates: Template[]) {
  return templates.map((template) => ({
    ...template,
    lastEdited: template.lastEdited.toISOString(),
    createdAt: template.createdAt?.toISOString(),
    updatedAt: template.updatedAt?.toISOString(),
  }));
}

function serializeRenderedDesigns(renderedDesigns: RenderedDesign[]) {
  return renderedDesigns.map((renderedDesign) => ({
    ...renderedDesign,
    createdAt: normalizeDate(renderedDesign.createdAt).toISOString(),
  }));
}

function readStoredIdSet(storageKey: string): Set<string> {
  if (typeof window === 'undefined') {
    return new Set<string>();
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return new Set<string>();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }
    return new Set(parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0));
  } catch {
    return new Set<string>();
  }
}

function saveStoredIdSet(storageKey: string, ids: Set<string>) {
  if (typeof window === 'undefined') {
    return;
  }
  safeStorageSetItem(storageKey, JSON.stringify(Array.from(ids)));
}

function toPlainTextSnippet(value?: string, maxLength = 170): string {
  if (!value) {
    return '';
  }

  const stripped = value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();

  if (stripped.length <= maxLength) {
    return stripped;
  }
  return `${stripped.slice(0, maxLength - 1).trimEnd()}...`;
}

function buildSuggestedEditorialHeadline(rawTitle: string): string {
  const trimmed = rawTitle.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return '';
  }

  const withoutSourceSuffix = trimmed.replace(/\s+[-|]\s+[^-|]{1,45}$/, '').trim();
  const withoutEditorialTags = withoutSourceSuffix
    .replace(/^\s*(exclusive|report|watch|new)\s*:\s*/i, '')
    .replace(/\s+\((exclusive|report|updated)\)\s*$/i, '')
    .replace(/\s+\[(exclusive|report|updated)\]\s*$/i, '')
    .trim();

  const withoutFiller = withoutEditorialTags
    .replace(/\s+in\s+latest\s+update$/i, '')
    .replace(/\s+in\s+new\s+update$/i, '')
    .replace(/\s+in\s+latest\s+trailer$/i, '')
    .trim();

  const words = withoutFiller.split(' ').filter(Boolean);
  const compactWords = words.length > 10 ? words.slice(0, 10) : words;

  const headline = compactWords
    .map((word, index) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) {
        return word;
      }
      if (/^[a-z]{1,3}$/.test(word) && index !== 0 && index !== compactWords.length - 1) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');

  return headline.length <= 72 ? headline : `${headline.slice(0, 69).trimEnd()}...`;
}

function parseAutoEditorial(editorial: any): AutoEditorial {
  const source = asRecord(editorial);
  return {
    ...source,
    id: typeof source.id === 'string' ? source.id : `auto-editorial-${Math.random().toString(36).slice(2, 10)}`,
    sourceFeedItemId: typeof source.sourceFeedItemId === 'string' ? source.sourceFeedItemId : '',
    sourceTitle: typeof source.sourceTitle === 'string' && source.sourceTitle.trim().length > 0
      ? source.sourceTitle
      : 'Editorial item',
    templateId: typeof source.templateId === 'string' ? source.templateId : '',
    renderedImage: typeof source.renderedImage === 'string' ? source.renderedImage : '',
    headerText: typeof source.headerText === 'string' ? source.headerText : '',
    caption: typeof source.caption === 'string' ? source.caption : '',
    targetPlatforms: Array.isArray(source.targetPlatforms) ? source.targetPlatforms : [],
    createdAt: normalizeIsoString(source.createdAt) || new Date().toISOString(),
    updatedAt: normalizeIsoString(source.updatedAt) || normalizeIsoString(source.createdAt) || new Date().toISOString(),
  };
}

function readDesignStudioPageCache(): {
  templates: Template[];
  renderedDesigns: RenderedDesign[];
  autoEditorials: AutoEditorial[];
  manualRenderJobs: ManualRenderJob[];
} | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(DESIGN_STUDIO_PAGE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      templates: Array.isArray(parsed.templates) ? parsed.templates.map(parseTemplate).filter((template) => template.id && template.previewUrl) : [],
      renderedDesigns: Array.isArray(parsed.renderedDesigns)
        ? parsed.renderedDesigns.map(parseRenderedDesign).filter((design) => design.templateId && design.outputUrl)
        : [],
      autoEditorials: Array.isArray(parsed.autoEditorials)
        ? parsed.autoEditorials.map(parseAutoEditorial).filter((editorial) => editorial.templateId)
        : [],
      manualRenderJobs: Array.isArray(parsed.manualRenderJobs)
        ? parsed.manualRenderJobs.map(normalizeManualRenderJob).filter((job): job is ManualRenderJob => Boolean(job))
        : [],
    };
  } catch {
    return null;
  }
}

function isPsdLikeFile(file: File): boolean {
  const normalizedName = file.name.trim().toLowerCase();
  const normalizedType = (file.type || '').trim().toLowerCase();

  if (normalizedName.endsWith('.psd')) {
    return true;
  }

  return [
    'application/vnd.adobe.photoshop',
    'application/photoshop',
    'application/x-photoshop',
    'application/psd',
    'application/octet-stream',
  ].includes(normalizedType);
}

async function readPsdSignature(file: File): Promise<string | null> {
  try {
    const headerBuffer = await file.slice(0, 4).arrayBuffer();
    return Array.from(new Uint8Array(headerBuffer))
      .map((value) => String.fromCharCode(value))
      .join('');
  } catch {
    return null;
  }
}

export default function DesignStudioPage({ onNavigate }: DesignStudioPageProps) {
  const cachedPageState = readDesignStudioPageCache();
  const { addNotification } = useNotifications();
  const { settings } = useSettings();
  const { feeds, getActivity } = useRSSFeeds();
  const { showUndo } = useUndo();
  const [activeTab, setActiveTab] = useState<DesignStudioTab>(() => {
    const savedTab = safeStorageGetItem('designStudioActiveTab');
    return savedTab === 'auto' ? 'auto' : 'manual';
  });
  const [studioTopTab, setStudioTopTab] = useState<DesignStudioTopTab>(() => {
    const savedTopTab = safeStorageGetItem(DESIGN_STUDIO_TOP_TAB_KEY);
    if (savedTopTab === 'templates' || savedTopTab === 'manual' || savedTopTab === 'auto') {
      return savedTopTab;
    }
    return 'manual';
  });
  const [manualWorkspaceTab, setManualWorkspaceTab] = useState<ManualWorkspaceTab>(() => {
    const savedTab = safeStorageGetItem(DESIGN_STUDIO_MANUAL_WORKSPACE_TAB_KEY);
    return savedTab === 'news_queue' ? 'news_queue' : 'templates';
  });
  const [templates, setTemplates] = useState<Template[]>(cachedPageState?.templates || []);
  const [renderedDesigns, setRenderedDesigns] = useState<RenderedDesign[]>(cachedPageState?.renderedDesigns || []);
  const [manualRenderJobs, setManualRenderJobs] = useState<ManualRenderJob[]>(cachedPageState?.manualRenderJobs || []);
  const [autoEditorials, setAutoEditorials] = useState<AutoEditorial[]>(cachedPageState?.autoEditorials || []);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [manualDraftSource, setManualDraftSource] = useState<ManualDraftSourceContext | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<Template | null>(null);
  const [expandedTemplateZoom, setExpandedTemplateZoom] = useState(1);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isPublishSheetOpen, setIsPublishSheetOpen] = useState(false);
  const [editorInitialData, setEditorInitialData] = useState<DesignData | null>(null);
  const [livePreviewData, setLivePreviewData] = useState<DesignData | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [pendingEditorTarget, setPendingEditorTarget] = useState<DesignStudioEditorTarget | null>(() => readPendingEditorTarget());
  const [isRendering, setIsRendering] = useState(false);
  const [publishTarget, setPublishTarget] = useState<RenderedDesign | null>(null);
  const [showBackblazeBrowser, setShowBackblazeBrowser] = useState(false);
  const [isTemplateListCollapsed, setIsTemplateListCollapsed] = useState(
    () => safeStorageGetItem(DESIGN_STUDIO_TEMPLATE_LIST_COLLAPSED_KEY) === 'true',
  );
  const [isLoadingState, setIsLoadingState] = useState(!(cachedPageState && cachedPageState.templates.length > 0));
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [isFinalizingTemplateUpload, setIsFinalizingTemplateUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingTemplateName, setUploadingTemplateName] = useState('');
  const [isGeneratingAutoEditorials, setIsGeneratingAutoEditorials] = useState(false);
  const [previewEditorial, setPreviewEditorial] = useState<AutoEditorial | null>(null);
  const templatePreviewLastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const [selectedEditorial, setSelectedEditorial] = useState<AutoEditorial | null>(null);
  const [isEditorialActionsOpen, setIsEditorialActionsOpen] = useState(false);
  const [isEditorialEditorOpen, setIsEditorialEditorOpen] = useState(false);
  const [editorialEditorMode, setEditorialEditorMode] = useState<AutoEditorialAction>('caption');
  const [editorialDraftValue, setEditorialDraftValue] = useState('');
  const [editorialScheduleDate, setEditorialScheduleDate] = useState('');
  const [editorialScheduleTime, setEditorialScheduleTime] = useState('');
  const [editorialOverlayDirection, setEditorialOverlayDirection] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [editorialOverlayStrength, setEditorialOverlayStrength] = useState(75);
  const [editorialOverlayColor, setEditorialOverlayColor] = useState('#000000');
  const [isSavingEditorialEdit, setIsSavingEditorialEdit] = useState(false);
  const [isGeneratingEditorialCaption, setIsGeneratingEditorialCaption] = useState(false);
  const [isBackgroundDragging, setIsBackgroundDragging] = useState(false);
  const [backgroundSearchQuery, setBackgroundSearchQuery] = useState('');
  const [backgroundSearchResults, setBackgroundSearchResults] = useState<DesignStudioTMDbSearchResult[]>([]);
  const [selectedBackgroundSearchResult, setSelectedBackgroundSearchResult] = useState<DesignStudioTMDbSearchResult | null>(null);
  const [backgroundImageAssets, setBackgroundImageAssets] = useState<Array<DesignStudioTMDbImageAsset & { kind: 'backdrop' | 'poster' | 'logo' | 'profile' }>>([]);
  const [isSearchingBackgrounds, setIsSearchingBackgrounds] = useState(false);
  const [isLoadingBackgroundAssets, setIsLoadingBackgroundAssets] = useState(false);
  const [newsQueueItems, setNewsQueueItems] = useState<RSSActivityItem[]>([]);
  const [isLoadingNewsQueue, setIsLoadingNewsQueue] = useState(false);
  const [newsQueueError, setNewsQueueError] = useState<string | null>(null);
  const [isSourceFilterSheetOpen, setIsSourceFilterSheetOpen] = useState(false);
  const [newsQueueFilterSheetTab, setNewsQueueFilterSheetTab] = useState<NewsQueueFilterSheetTab>('sort');
  const [newsQueueSort, setNewsQueueSort] = useState<NewsQueueSortOption>('recent-desc');
  const [selectedNewsSources, setSelectedNewsSources] = useState<string[]>([]);
  const [dismissedQueueIds, setDismissedQueueIds] = useState<Set<string>>(() => readStoredIdSet(DESIGN_STUDIO_NEWS_QUEUE_DISMISSED_KEY));
  const [savedQueueIds, setSavedQueueIds] = useState<Set<string>>(() => readStoredIdSet(DESIGN_STUDIO_NEWS_QUEUE_SAVED_KEY));
  const [usedQueueIds, setUsedQueueIds] = useState<Set<string>>(() => readStoredIdSet(DESIGN_STUDIO_NEWS_QUEUE_USED_KEY));
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundFileInputRef = useRef<HTMLInputElement>(null);
  const renderJobStatusRef = useRef<Map<string, ManualRenderJob['status']>>(new Map());

  useEffect(() => {
    safeStorageSetItem('designStudioActiveTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    safeStorageSetItem(DESIGN_STUDIO_TOP_TAB_KEY, studioTopTab);

    if (studioTopTab === 'auto') {
      setActiveTab('auto');
      return;
    }

    setActiveTab('manual');
    setManualWorkspaceTab(studioTopTab === 'templates' ? 'templates' : 'news_queue');
  }, [studioTopTab]);

  useEffect(() => {
    safeStorageSetItem(DESIGN_STUDIO_MANUAL_WORKSPACE_TAB_KEY, manualWorkspaceTab);
  }, [manualWorkspaceTab]);

  useEffect(() => {
    safeStorageSetItem(DESIGN_STUDIO_TEMPLATE_LIST_COLLAPSED_KEY, isTemplateListCollapsed ? 'true' : 'false');
  }, [isTemplateListCollapsed]);

  useEffect(() => {
    saveStoredIdSet(DESIGN_STUDIO_NEWS_QUEUE_DISMISSED_KEY, dismissedQueueIds);
  }, [dismissedQueueIds]);

  useEffect(() => {
    saveStoredIdSet(DESIGN_STUDIO_NEWS_QUEUE_SAVED_KEY, savedQueueIds);
  }, [savedQueueIds]);

  useEffect(() => {
    saveStoredIdSet(DESIGN_STUDIO_NEWS_QUEUE_USED_KEY, usedQueueIds);
  }, [usedQueueIds]);

  useEffect(() => {
    if (!pendingEditorTarget) {
      return;
    }

    const template = templates.find((entry) => entry.id === pendingEditorTarget.templateId);
    if (!template) {
      return;
    }

    if (pendingEditorTarget.tab) {
      setActiveTab(pendingEditorTarget.tab);
    }

    setSelectedTemplate(template);
    setEditingTemplateId(template.id);
    setEditorInitialData(pendingEditorTarget.initialData || buildTemplateInitialData(template, settings.exportFormat === 'png' ? 'png' : 'jpeg'));
    setLivePreviewData(pendingEditorTarget.initialData || null);
    setIsEditSheetOpen(true);
    setPendingEditorTarget(null);

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DESIGN_STUDIO_EDITOR_TARGET_KEY);
    }
  }, [pendingEditorTarget, settings.exportFormat, templates]);

  useEffect(() => {
    const syncPendingTarget = () => {
      const target = readPendingEditorTarget();
      if (target) {
        setPendingEditorTarget(target);
      }
    };

    syncPendingTarget();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === DESIGN_STUDIO_EDITOR_TARGET_KEY) {
        syncPendingTarget();
      }
    };

    const handleCustomTarget = () => {
      syncPendingTarget();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleCustomTarget);
    window.addEventListener('screndly:design-studio-edit-target', handleCustomTarget as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleCustomTarget);
      window.removeEventListener('screndly:design-studio-edit-target', handleCustomTarget as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    safeStorageSetItem(DESIGN_STUDIO_PAGE_CACHE_KEY, JSON.stringify({
      templates: serializeTemplates(templates).map(compactTemplateForCache),
      renderedDesigns: serializeRenderedDesigns(renderedDesigns).map(compactRenderedDesignForCache),
      autoEditorials: autoEditorials.map(compactAutoEditorialForCache),
      manualRenderJobs: manualRenderJobs
        .map(normalizeManualRenderJob)
        .filter((job): job is ManualRenderJob => Boolean(job)),
    }));
  }, [autoEditorials, manualRenderJobs, renderedDesigns, templates]);

  useEffect(() => {
    for (const job of manualRenderJobs) {
      const previousStatus = renderJobStatusRef.current.get(job.id);
      if (previousStatus && previousStatus !== job.status) {
        if (job.status === 'completed') {
          toast.success(`"${job.templateName}" render completed`);
          addRecentActivity({
            title: job.templateName,
            platform: 'Design Studio',
            status: 'success',
            type: 'designstudio',
          });
          addLogEntry({
            videoTitle: job.templateName,
            platform: 'Design Studio',
            status: 'success',
            type: 'designstudio',
          });
          addNotification({
            type: 'success',
            title: 'Design Rendered',
            message: `"${job.templateName}" finished rendering`,
            source: 'design_studio',
            actionPage: 'design-studio-activity',
          });
        }

        if (job.status === 'failed') {
          toast.error(job.failureReason || `Failed to render "${job.templateName}"`);
          addNotification({
            type: 'error',
            title: 'Design Render Failed',
            message: job.failureReason || `Failed to render "${job.templateName}"`,
            source: 'design_studio',
            actionPage: 'design-studio-activity',
          });
        }
      }

      renderJobStatusRef.current.set(job.id, job.status);
    }
  }, [addNotification, manualRenderJobs]);

  useEffect(() => {
    let mounted = true;

    const loadState = async () => {
      try {
        const [state, jobs] = await Promise.all([
          fetchDesignStudioState(),
          fetchDesignStudioRenderJobs(),
        ]);
        if (!mounted) {
          return;
        }

        setTemplates((state.templates || []).map(parseTemplate));
        setRenderedDesigns((state.renderedDesigns || []).map(parseRenderedDesign));
        setAutoEditorials((state.autoEditorials || []).map(parseAutoEditorial));
        setManualRenderJobs(jobs.map(normalizeManualRenderJob).filter((job): job is ManualRenderJob => Boolean(job)));
      } catch (error) {
        console.error('Failed to load Design Studio state:', error);
        if (mounted) {
          toast.error('Failed to load Design Studio data');
        }
      } finally {
        if (mounted) {
          setIsLoadingState(false);
        }
      }
    };

    loadState();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const hasActiveManualRender = manualRenderJobs.some(
      (job) => job.status === 'queued' || job.status === 'rendering',
    );
    const interval = window.setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      try {
        const jobs = await fetchDesignStudioRenderJobs();
        setManualRenderJobs(jobs.map(normalizeManualRenderJob).filter((job): job is ManualRenderJob => Boolean(job)));
        if (hasActiveManualRender) {
          const state = await fetchDesignStudioState();
          setTemplates((state.templates || []).map(parseTemplate));
          setRenderedDesigns((state.renderedDesigns || []).map(parseRenderedDesign));
          setAutoEditorials((state.autoEditorials || []).map(parseAutoEditorial));
        }
      } catch (error) {
        console.error('Failed to refresh Design Studio state:', error);
      }
    }, hasActiveManualRender ? 5000 : 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [manualRenderJobs]);

  // Calculate aspect ratio from dimensions
  const calculateAspectRatio = (width: number, height: number): string => {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    const w = width / divisor;
    const h = height / divisor;
    
    // Common aspect ratios
    if (w === 16 && h === 9) return '16:9';
    if (w === 9 && h === 16) return '9:16';
    if (w === 1 && h === 1) return '1:1';
    if (w === 4 && h === 5) return '4:5';
    if (w === 5 && h === 4) return '5:4';
    if (w === 3 && h === 4) return '3:4';
    if (w === 4 && h === 3) return '4:3';
    
    return `${w}:${h}`;
  };

  const persistState = async (
    nextTemplates: Template[],
    nextRenderedDesigns: RenderedDesign[],
    nextAutoEditorials: AutoEditorial[] = autoEditorials,
  ) => {
    await saveDesignStudioState({
      templates: serializeTemplates(nextTemplates),
      renderedDesigns: serializeRenderedDesigns(nextRenderedDesigns),
      autoEditorials: nextAutoEditorials,
    });
  };

  const processPsdFile = async (file: File) => {
    const signature = await readPsdSignature(file);
    const validPsd = isPsdLikeFile(file) || signature === '8BPS';

    if (!validPsd) {
      toast.error('Please choose a PSD file from your Files/Documents app');
      return;
    }

    haptics.medium();
    setIsUploadingTemplate(true);
    setIsFinalizingTemplateUpload(false);
    setUploadProgress(0);
    setUploadingTemplateName(file.name);
    toast.success('Uploading and analyzing PSD template...');

    try {
      const uploadedTemplate = await uploadDesignStudioTemplate(file, (progress) => {
        setUploadProgress(Math.max(0, Math.min(100, Math.round(progress))));
      });
      setIsUploadingTemplate(false);
      setUploadProgress(0);
      setIsFinalizingTemplateUpload(true);
      const detectedHeader = Boolean(uploadedTemplate.detectedLayers.hasHeader);
      const detectedBackground = Boolean(uploadedTemplate.detectedLayers.hasBackground);
      const detectedOverlay = Boolean(uploadedTemplate.detectedLayers.hasOverlay);
      const detectedSubtext = Boolean(uploadedTemplate.detectedLayers.hasSubtext);

      toast.info('PSD Debug', {
        description: [
          `Filename: ${file.name}`,
          `Signature: ${uploadedTemplate.signature || signature || 'Unknown'}`,
          `Header: ${detectedHeader ? 'Yes' : 'No'}`,
          `Background: ${detectedBackground ? 'Yes' : 'No'}`,
          `Overlay: ${detectedOverlay ? 'Yes' : 'No'}`,
          `Subtext: ${detectedSubtext ? 'Yes' : 'No'}`,
        ].join('\n'),
        duration: 8000,
      });

      const template = parseTemplate(uploadedTemplate.template);
      const nextTemplates = [template, ...templates.filter((entry) => entry.id !== template.id)];
      setTemplates(nextTemplates);
      await persistState(nextTemplates, renderedDesigns);
      await createDesignStudioActivity('template_uploaded', {
        templateName: template.name,
      });

      toast.success(`Template "${template.name}" analyzed and uploaded!`);
    } catch (error) {
      console.error('PSD template analysis error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process PSD template');
    } finally {
      setIsUploadingTemplate(false);
      setIsFinalizingTemplateUpload(false);
      setUploadProgress(0);
      setUploadingTemplateName('');
    }
  };

  const handleUploadPSD = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await processPsdFile(file);
    } finally {
      e.target.value = '';
    }
  };

  const handleOpenPsdPicker = async () => {
    const picker = (window as Window & {
      showOpenFilePicker?: (options?: {
        multiple?: boolean;
        excludeAcceptAllOption?: boolean;
        types?: Array<{
          description?: string;
          accept: Record<string, string[]>;
        }>;
      }) => Promise<FilePickerHandle[]>;
    }).showOpenFilePicker;

    if (picker) {
      try {
        const [handle] = await picker({
          multiple: false,
          excludeAcceptAllOption: false,
          types: [
            {
              description: 'Photoshop PSD Files',
              accept: {
                'application/vnd.adobe.photoshop': ['.psd'],
                'application/photoshop': ['.psd'],
                'application/x-photoshop': ['.psd'],
                'application/psd': ['.psd'],
                'application/octet-stream': ['.psd'],
              },
            },
          ],
        });

        if (!handle) {
          return;
        }

        const file = await handle.getFile();
        await processPsdFile(file);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('Direct PSD picker failed, falling back to input:', error);
      }
    }

    fileInputRef.current?.click();
  };

  const handleLoadFromBackblaze = async () => {
    haptics.medium();
    setShowBackblazeBrowser(true);
  };

  const handleLoadSelectedTemplates = async (selectedFiles: any[]) => {
      const importedTemplates = await Promise.all(
      selectedFiles.map(async (file: any) => {
        const result = await importDesignStudioTemplate({
          url: file.url,
          fileName: file.fileName,
        });
        return parseTemplate(result.template);
      }),
    );

    const nextTemplates = [...importedTemplates, ...templates.filter((template) => !importedTemplates.some((entry) => entry.id === template.id))];
    setTemplates(nextTemplates);
    await persistState(nextTemplates, renderedDesigns);
    await createDesignStudioActivity('templates_loaded', {
      source: 'backblaze',
      count: importedTemplates.length,
    });

    toast.success(`${importedTemplates.length} template${importedTemplates.length !== 1 ? 's' : ''} loaded from Backblaze`);
    haptics.success();
    setShowBackblazeBrowser(false);
  };

  const handleExpandTemplate = (template: Template) => {
    haptics.light();
    setExpandedTemplate(template);
    setExpandedTemplateZoom(1);
    setIsExpanded(true);
  };

  const handleDoubleTapZoom = (
    event: React.TouchEvent<HTMLElement>,
  ) => {
    if (event.touches.length > 1) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    const now = Date.now();
    const ref = templatePreviewLastTapRef;
    const lastTap = ref.current;

    if (
      lastTap &&
      now - lastTap.time <= 300 &&
      Math.abs(lastTap.x - touch.clientX) <= TEMPLATE_PREVIEW_DOUBLE_TAP_PROXIMITY &&
      Math.abs(lastTap.y - touch.clientY) <= TEMPLATE_PREVIEW_DOUBLE_TAP_PROXIMITY
    ) {
      setExpandedTemplateZoom((value) => (value > 1 ? 1 : 2));
      ref.current = null;
      return;
    }

    ref.current = { time: now, x: touch.clientX, y: touch.clientY };
  };

  const handleEditTemplate = (template: Template) => {
    haptics.light();
    setSelectedTemplate(template);
    setEditingTemplateId(template.id);
    setEditorInitialData(buildTemplateInitialData(template, settings.exportFormat === 'png' ? 'png' : 'jpeg'));
    setLivePreviewData(null);
    setIsEditSheetOpen(true);
  };

  const handleCreateDesign = () => {
    const preferredTemplate = templates.find((template) => template.isDefaultManual)
      || templates.find((template) => template.isValidated !== false)
      || templates[0];

    if (!preferredTemplate) {
      toast.error('Upload or load a template first');
      return;
    }

    haptics.light();
    setStudioTopTab('manual');
    setActiveTab('manual');
    setManualDraftSource(null);
    setSelectedTemplate(preferredTemplate);
    setEditingTemplateId(preferredTemplate.id);
    const initialData = buildTemplateInitialData(preferredTemplate, settings.exportFormat === 'png' ? 'png' : 'jpeg');
    setEditorInitialData(initialData);
    setLivePreviewData(initialData);
    setIsEditSheetOpen(true);
  };

  const handleSaveDesign = async (data: DesignData) => {
    if (!selectedTemplate) return;

    setIsRendering(true);
    setIsEditSheetOpen(false);

    try {
      const resolvedCaption = data.caption?.trim().length
        ? data.caption
        : manualDraftSource
          ? [manualDraftSource.sourceHeadline, manualDraftSource.sourceSummary].filter(Boolean).join('\n\n')
          : data.caption;

      const job = await startDesignStudioManualRender({
        template: {
          ...selectedTemplate,
          lastEdited: selectedTemplate.lastEdited.toISOString(),
          createdAt: selectedTemplate.createdAt?.toISOString(),
          updatedAt: selectedTemplate.updatedAt?.toISOString(),
        },
        data: {
          template_variant: data.templateVariant || selectedTemplate.layoutVariant || selectedTemplate.baseVariant,
          headerText: data.headerText,
          subtext: data.subtext,
          headerTextColor: data.headerTextColor,
          subtextColor: data.subtextColor,
          fontScale: data.fontScale,
          headlineWidthScale: data.headlineWidthScale,
          lineHeightMultiplier: data.lineHeightMultiplier,
          backgroundImage: data.backgroundImage,
          imageFocalPoint: data.imageFocalPoint,
          imageZoom: data.imageZoom,
          overlayColor: data.overlayColor,
          overlayOpacity: data.overlayOpacity,
          gradientPosition: data.gradientPosition,
          fadeEnabled: data.fadeEnabled,
          fadeOpacity: data.fadeOpacity,
          brandBlockMode: data.brandBlockMode,
          caption: resolvedCaption,
          contentType: data.contentType,
          sourceHeadline: manualDraftSource?.sourceHeadline,
          sourceSummary: manualDraftSource?.sourceSummary,
          sourceUrl: manualDraftSource?.sourceUrl,
          sourceName: manualDraftSource?.sourceName,
          exportFormat: data.exportFormat || (settings.exportFormat === 'png' ? 'png' : 'jpeg'),
        },
      });
      setManualRenderJobs((currentJobs) => [job, ...currentJobs.filter((currentJob) => currentJob.id !== job.id)]);
      setTemplates((currentTemplates) => [...currentTemplates]);
      setIsRendering(false);
      toast.success('Moved to render queue. You can leave this page while it finishes.');
      haptics.success();
      setManualDraftSource(null);
    } catch (error) {
      console.error('Failed to queue Design Studio render:', error);
      setIsRendering(false);
      toast.error(error instanceof Error ? error.message : 'Failed to queue render');
    }
  };

  const handlePublish = async (caption: string, platforms: PlatformSelection) => {
    if (!publishTarget) return;

    haptics.medium();
    try {
      const result = await publishContent(platforms, {
        text: caption || publishTarget.caption || publishTarget.templateName,
        title: publishTarget.templateName,
        imageUrl: publishTarget.outputUrl,
      });

      if (!result.success || !result.data) {
        toast.error(result.error?.message || 'Failed to publish design');
        return;
      }

      const successfulPlatforms = result.data.results
        .filter((item: any) => item.status === 'posted')
        .map((item: any) => item.platform);
      const failedPlatforms = result.data.results
        .filter((item: any) => item.status === 'failed')
        .map((item: any) => `${item.platform}${item.error ? `: ${item.error}` : ''}`);

      if (successfulPlatforms.length === 0) {
        toast.error(failedPlatforms[0] || 'Failed to publish design');
        return;
      }

      const nextRenderedDesigns = renderedDesigns.map((design) =>
        design.id === publishTarget.id
          ? { ...design, caption: caption || design.caption }
          : design
      );
      await persistState(templates, nextRenderedDesigns);
      setRenderedDesigns(nextRenderedDesigns);

      const platformsList = successfulPlatforms.join(', ');

      await createDesignStudioActivity('design_published', {
        templateName: publishTarget.templateName,
        designId: publishTarget.id,
        platforms: platformsList,
      });

      addRecentActivity({
        title: publishTarget.templateName,
        platform: platformsList,
        status: 'success',
        type: 'designstudio',
      });

      addLogEntry({
        videoTitle: publishTarget.templateName,
        platform: platformsList,
        status: 'success',
        type: 'designstudio',
        errorDetails: failedPlatforms.length > 0 ? failedPlatforms.join(' | ') : undefined,
      });

      addNotification({
        type: 'success',
        title: 'Design Published',
        message: `"${publishTarget.templateName}" published to ${platformsList}`,
        source: 'design_studio',
        actionPage: 'design-studio-activity',
      });

      if (failedPlatforms.length > 0) {
        toast.success(`Published to ${platformsList}`, {
          description: `Failed: ${failedPlatforms.join(' | ')}`,
        });
        return;
      }

      toast.success('Design published to selected platforms!');
    } catch (error) {
      console.error('Failed to finish Design Studio publish flow:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to publish design');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const template = templates.find(t => t.id === id);
    if (!template) return;

    const previousTemplates = [...templates];
    const previousRenderedDesigns = [...renderedDesigns];
    const nextTemplates = templates.filter(t => t.id !== id);
    const nextRenderedDesigns = renderedDesigns.filter(d => d.templateId !== id);

    try {
      await persistState(nextTemplates, nextRenderedDesigns);
      setTemplates(nextTemplates);
      setRenderedDesigns(nextRenderedDesigns);
      await createDesignStudioActivity('template_deleted', {
        templateName: template.name,
      });

      haptics.medium();
      toast.success(`Template deleted`);

      showUndo({
        id: `undo-template-${id}`,
        itemName: template.name,
        onUndo: async () => {
          await persistState(previousTemplates, previousRenderedDesigns);
          setTemplates(previousTemplates);
          setRenderedDesigns(previousRenderedDesigns);
          haptics.light();
          toast.success('Template restored');
        }
      });
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete template');
    }
  };

  const validatedTemplates = useMemo(
    () => templates.filter((template) => template.isValidated !== false),
    [templates],
  );

  const autoStats = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return {
      generatedToday: autoEditorials.filter((item) => new Date(item.createdAt) >= startOfDay).length,
      queued: autoEditorials.filter((item) => item.status === 'queued').length,
      posted: autoEditorials.filter((item) => item.status === 'posted').length,
      failed: autoEditorials.filter((item) => item.status === 'failed').length,
    };
  }, [autoEditorials]);

  const defaultAutoTemplate = useMemo(() => {
    const requestedTemplate = templates.find((template) => template.id === settings.designStudioDefaultAutoTemplateId);
    return requestedTemplate && requestedTemplate.isValidated !== false
      ? requestedTemplate
      : validatedTemplates[0] || null;
  }, [templates, validatedTemplates, settings.designStudioDefaultAutoTemplateId]);

  const autoTemplatePool = useMemo(() => {
    if (validatedTemplates.length > 0) {
      return validatedTemplates;
    }

    return defaultAutoTemplate ? [defaultAutoTemplate] : [];
  }, [defaultAutoTemplate, validatedTemplates]);

  const deriveSubtext = (feedName?: string, matchedKeyword?: string) => {
    if (!feedName && !matchedKeyword) {
      return '';
    }
    if (feedName && matchedKeyword) {
      return `${feedName} • ${matchedKeyword}`;
    }
    return feedName || matchedKeyword || '';
  };

  const updateEditorial = async (editorialId: string, updates: Partial<AutoEditorial>) => {
    const nextAutoEditorials = autoEditorials.map((item) =>
      item.id === editorialId
        ? { ...item, ...updates, updatedAt: new Date().toISOString() }
        : item,
    );
    await persistState(templates, renderedDesigns, nextAutoEditorials);
    setAutoEditorials(nextAutoEditorials);
  };

  const handlePublishAutoEditorial = async (editorial: AutoEditorial) => {
    try {
      const platforms = (editorial.targetPlatforms || []).reduce<Record<string, boolean>>((accumulator, platform) => {
        accumulator[platform] = true;
        return accumulator;
      }, {}) as unknown as PlatformSelection;

      const result = await publishContent(platforms, {
        text: editorial.caption,
        title: editorial.headerText,
        imageUrl: editorial.renderedImage,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to publish auto editorial');
      }

      const nextStatus: AutoEditorial['status'] = result.data.results.some((entry: { status: string }) => entry.status === 'posted')
        ? 'posted'
        : 'failed';

      await updateEditorial(editorial.id, {
        status: nextStatus,
        postedAt: nextStatus === 'posted' ? new Date().toISOString() : editorial.postedAt || null,
        failureReason: nextStatus === 'failed' ? 'No platform accepted the editorial' : null,
      });

      await createDesignStudioActivity(nextStatus === 'posted' ? 'auto_editorial_posted' : 'auto_editorial_failed', {
        sourceTitle: editorial.sourceTitle,
        templateName: editorial.templateName,
        platforms: (editorial.targetPlatforms || []).join(', '),
      });

      if (nextStatus === 'posted') {
        toast.success('Auto editorial published');
      } else {
        toast.error('Auto editorial failed to publish');
      }
    } catch (error) {
      console.error('Failed to publish auto editorial:', error);
      await updateEditorial(editorial.id, {
        status: 'failed',
        failureReason: error instanceof Error ? error.message : 'Failed to publish auto editorial',
      });
      toast.error(error instanceof Error ? error.message : 'Failed to publish auto editorial');
    }
  };

  const openEditorialEditor = (editorial: AutoEditorial, mode: AutoEditorialAction) => {
    const scheduleParts = buildDatetimeLocalParts(editorial.scheduleTime);
    setSelectedEditorial(editorial);
    setEditorialEditorMode(mode);
    setEditorialDraftValue(
      mode === 'caption'
        ? editorial.caption
        : mode === 'header'
          ? editorial.headerText
          : mode === 'subheader'
            ? editorial.subheaderText || ''
            : mode === 'background'
              ? editorial.backgroundSource || ''
              : mode === 'schedule'
                ? editorial.scheduleTime || ''
                : mode === 'template'
                  ? editorial.templateId
                  : '',
    );
    setEditorialScheduleDate(scheduleParts.date);
    setEditorialScheduleTime(scheduleParts.time);
    setEditorialOverlayDirection((editorial.overlayDirection as 'top' | 'bottom' | 'left' | 'right') || 'top');
    setEditorialOverlayStrength(editorial.overlayStrength || 75);
    setEditorialOverlayColor(editorial.overlayColor || '#000000');
    setBackgroundSearchQuery(editorial.sourceTitle || editorial.headerText || '');
    setBackgroundSearchResults([]);
    setSelectedBackgroundSearchResult(null);
    setBackgroundImageAssets([]);
    setIsEditorialActionsOpen(false);
    setIsEditorialEditorOpen(true);
  };

  const handleGenerateEditorialCaption = async () => {
    if (!selectedEditorial) {
      return;
    }

    setIsGeneratingEditorialCaption(true);
    try {
      const sharedCaption = selectedEditorial.captions?.shared_caption;
      const fallbackCaption = `${selectedEditorial.headerText}. ${selectedEditorial.subheaderText || selectedEditorial.sourceTitle}`.trim();
      setEditorialDraftValue(sharedCaption || fallbackCaption);
      toast.success('Caption refreshed');
    } catch (error) {
      console.error('Failed to generate editorial caption:', error);
      toast.error('Failed to refresh caption');
    } finally {
      setIsGeneratingEditorialCaption(false);
    }
  };

  const handleEditorialBackgroundFile = async (file?: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    try {
      const uploaded = await uploadDesignStudioAsset(file, 'renders');
      setEditorialDraftValue(uploaded.url);
      toast.success('Background uploaded');
    } catch (error) {
      console.error('Failed to upload Design Studio background:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload background');
    }
  };

  const handleSearchEditorialBackgrounds = async () => {
    const query = backgroundSearchQuery.trim();
    if (!query) {
      toast.error('Enter a movie, TV show, logo, or person');
      return;
    }

    setIsSearchingBackgrounds(true);
    setSelectedBackgroundSearchResult(null);
    setBackgroundImageAssets([]);
    try {
      const results = await searchDesignStudioTMDb(query);
      setBackgroundSearchResults(results.slice(0, 8));
      if (results.length === 0) {
        toast.error('No matching images found');
      }
    } catch (error) {
      console.error('Failed to search Design Studio backgrounds:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to search images');
    } finally {
      setIsSearchingBackgrounds(false);
    }
  };

  const handleSelectBackgroundResult = async (result: DesignStudioTMDbSearchResult) => {
    setSelectedBackgroundSearchResult(result);
    setIsLoadingBackgroundAssets(true);
    try {
      const pool = await fetchDesignStudioTMDbImages(result.mediaType, result.id);
      setBackgroundImageAssets(toBackgroundImagePoolList(pool, result.mediaType));
    } catch (error) {
      console.error('Failed to load Design Studio image assets:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load images');
      setBackgroundImageAssets([]);
    } finally {
      setIsLoadingBackgroundAssets(false);
    }
  };

  const handleSaveEditorialEdit = async () => {
    if (!selectedEditorial) {
      return;
    }

    setIsSavingEditorialEdit(true);
    const updates: Partial<AutoEditorial> = {};

    try {
      switch (editorialEditorMode) {
        case 'caption':
          updates.caption = editorialDraftValue;
          break;
        case 'header':
          updates.headerText = editorialDraftValue;
          break;
        case 'subheader':
          updates.subheaderText = editorialDraftValue;
          break;
        case 'background':
          updates.backgroundSource = editorialDraftValue;
          break;
        case 'schedule': {
          const scheduleIso = combineDatetimeLocal(editorialScheduleDate, editorialScheduleTime);
          updates.scheduleTime = scheduleIso;
          updates.status = scheduleIso ? 'queued' : 'detected';
          break;
        }
        case 'template': {
          const nextTemplate = templates.find((template) => template.id === editorialDraftValue);
          if (nextTemplate) {
            updates.templateId = nextTemplate.id;
            updates.templateName = nextTemplate.name;
          }
          break;
        }
        case 'overlay':
          updates.overlayDirection = editorialOverlayDirection;
          updates.overlayStrength = editorialOverlayStrength;
          updates.overlayColor = editorialOverlayColor;
          break;
        default:
          break;
      }

      await updateEditorial(selectedEditorial.id, updates);
      await createDesignStudioActivity('auto_editorial_updated', {
        sourceTitle: selectedEditorial.sourceTitle,
        field: editorialEditorMode,
      });
      setIsEditorialEditorOpen(false);
      toast.success('Auto editorial updated');
    } finally {
      setIsSavingEditorialEdit(false);
    }
  };

  const handleDeleteEditorial = async (editorial: AutoEditorial) => {
    const previousAutoEditorials = [...autoEditorials];
    const nextAutoEditorials = autoEditorials.filter((item) => item.id !== editorial.id);
    await persistState(templates, renderedDesigns, nextAutoEditorials);
    setAutoEditorials(nextAutoEditorials);
    setIsEditorialActionsOpen(false);
    await createDesignStudioActivity('auto_editorial_deleted', {
      sourceTitle: editorial.sourceTitle,
      templateName: editorial.templateName,
    });
    showUndo({
      id: `undo-auto-editorial-${editorial.id}`,
      itemName: editorial.sourceTitle,
      onUndo: async () => {
        await persistState(templates, renderedDesigns, previousAutoEditorials);
        setAutoEditorials(previousAutoEditorials);
        toast.success('Auto editorial restored');
      },
      onConfirm: () => {
        toast.success('Auto editorial deleted');
      },
    });
  };

  const loadNewsQueue = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setIsLoadingNewsQueue(true);
    }
    setNewsQueueError(null);

    try {
      const response = await getActivity(300);
      const activityItems = response?.items || [];

      const ordered = [...activityItems]
        .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

      const dedupedByStory = new Map<string, RSSActivityItem>();
      for (const item of ordered) {
        const key = (item.link || item.title || item.id).trim().toLowerCase();
        if (!key || dedupedByStory.has(key)) {
          continue;
        }
        dedupedByStory.set(key, item);
      }

      setNewsQueueItems(Array.from(dedupedByStory.values()).slice(0, 120));
    } catch (error) {
      console.error('Failed to load Design Studio news queue:', error);
      setNewsQueueError(error instanceof Error ? error.message : 'Failed to load fetched stories');
    } finally {
      if (!options.silent) {
        setIsLoadingNewsQueue(false);
      }
    }
  }, [getActivity]);

  useEffect(() => {
    if (studioTopTab !== 'manual') {
      return;
    }

    void loadNewsQueue();
    const intervalId = window.setInterval(() => {
      void loadNewsQueue({ silent: true });
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadNewsQueue, studioTopTab]);

  const visibleNewsQueueItems = useMemo(
    () => newsQueueItems.filter((item) => !dismissedQueueIds.has(item.id)),
    [dismissedQueueIds, newsQueueItems],
  );

  const manualNewsQueueRetentionHours = Number(settings.designStudioManualNewsQueueRetentionHours || 24);
  const manualNewsQueueRetentionMs = Math.max(1, manualNewsQueueRetentionHours) * 60 * 60 * 1000;

  const retentionFilteredNewsQueueItems = useMemo(() => {
    const now = Date.now();
    return visibleNewsQueueItems.filter((item) => {
      if (savedQueueIds.has(item.id)) {
        return true;
      }

      const itemTime = new Date(item.timestamp).getTime();
      if (Number.isNaN(itemTime)) {
        return true;
      }

      return now - itemTime <= manualNewsQueueRetentionMs;
    });
  }, [manualNewsQueueRetentionMs, savedQueueIds, visibleNewsQueueItems]);

  const newsQueueSourceOptions = useMemo(
    () =>
      Array.from(
        new Set(
          retentionFilteredNewsQueueItems.map((item) => (item.feedName || 'RSS Feed').trim() || 'RSS Feed'),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [retentionFilteredNewsQueueItems],
  );

  useEffect(() => {
    setSelectedNewsSources((current) => current.filter((source) => newsQueueSourceOptions.includes(source)));
  }, [newsQueueSourceOptions]);

  const sourceFilteredNewsQueueItems = useMemo(() => {
    if (selectedNewsSources.length === 0) {
      return retentionFilteredNewsQueueItems;
    }

    const selectedSourceSet = new Set(selectedNewsSources);
    return retentionFilteredNewsQueueItems.filter((item) => selectedSourceSet.has((item.feedName || 'RSS Feed').trim() || 'RSS Feed'));
  }, [selectedNewsSources, retentionFilteredNewsQueueItems]);

  const sortedNewsQueueItems = useMemo(() => {
    const sorted = [...sourceFilteredNewsQueueItems];
    sorted.sort((left, right) => {
      const leftTime = new Date(left.timestamp).getTime();
      const rightTime = new Date(right.timestamp).getTime();
      return newsQueueSort === 'recent-asc' ? leftTime - rightTime : rightTime - leftTime;
    });
    return sorted;
  }, [newsQueueSort, sourceFilteredNewsQueueItems]);

  const savedNewsQueueItems = useMemo(
    () => sortedNewsQueueItems.filter((item) => savedQueueIds.has(item.id)),
    [savedQueueIds, sortedNewsQueueItems],
  );

  const inboxNewsQueueItems = useMemo(
    () => sortedNewsQueueItems.filter((item) => !savedQueueIds.has(item.id)),
    [savedQueueIds, sortedNewsQueueItems],
  );

  const setSavedStateForNewsQueueItem = (itemId: string, shouldSave: boolean) => {
    setSavedQueueIds((current) => {
      const next = new Set(current);
      if (shouldSave) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  };

  const deleteNewsQueueItem = (item: RSSActivityItem) => {
    const wasSaved = savedQueueIds.has(item.id);
    setDismissedQueueIds((current) => {
      const next = new Set(current);
      next.add(item.id);
      return next;
    });
    if (wasSaved) {
      setSavedStateForNewsQueueItem(item.id, false);
    }
    showUndo({
      id: `undo-news-queue-delete-${item.id}-${Date.now()}`,
      itemName: 'Story deleted',
      onUndo: async () => {
        setDismissedQueueIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
        if (wasSaved) {
          setSavedStateForNewsQueueItem(item.id, true);
        }
        toast.success('Story restored');
      },
      onConfirm: () => {
        toast.success('Story deleted');
      },
    });
  };

  const handleCreateDesignFromNewsQueue = (item: RSSActivityItem) => {
    const preferredTemplate = templates.find((template) => template.isDefaultManual)
      || templates.find((template) => template.isValidated !== false)
      || templates[0];

    if (!preferredTemplate) {
      toast.error('Upload or load a template first');
      return;
    }

    const originalHeadline = item.title?.trim() || 'Untitled story';
    const suggestedHeadline = buildSuggestedEditorialHeadline(originalHeadline) || originalHeadline;
    const snippet = toPlainTextSnippet(item.description || item.contentHtml, 200);

    const initialData = buildTemplateInitialData(preferredTemplate, settings.exportFormat === 'png' ? 'png' : 'jpeg');
    initialData.headerText = suggestedHeadline;
    initialData.subtext = '';
    initialData.caption = [
      suggestedHeadline,
      snippet || null,
      item.link ? `Source: ${item.link}` : null,
    ].filter(Boolean).join('\n\n');
    if (item.imageUrl) {
      initialData.backgroundImage = item.imageUrl;
    }

    setStudioTopTab('manual');
    setActiveTab('manual');
    setSelectedTemplate(preferredTemplate);
    setEditingTemplateId(preferredTemplate.id);
    setEditorInitialData(initialData);
    setLivePreviewData(initialData);
    setManualDraftSource({
      feedItemId: item.id,
      sourceName: item.feedName || 'RSS Feed',
      sourceHeadline: originalHeadline,
      suggestedHeadline,
      sourceUrl: item.link,
      sourceSummary: snippet,
      fetchedAt: item.timestamp,
      matchedKeyword: item.editorialBrain?.decision?.event || undefined,
    });
    setIsEditSheetOpen(true);
    setUsedQueueIds((current) => {
      const next = new Set(current);
      next.add(item.id);
      return next;
    });
    haptics.light();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 dark:text-white mb-2">Design Studio</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">
            {studioTopTab === 'templates'
              ? 'Upload, load, and manage your PSD template library'
              : studioTopTab === 'manual'
                ? 'Build manual designs from templates or fetched feed stories'
                : 'Generate editorial designs automatically'}
          </p>
        </div>
        <Button
          onClick={() => {
            haptics.light();
            safeStorageSetItem('designStudioActivityTab', activeTab);
            onNavigate('design-studio-activity', 'design-studio');
          }}
          variant="outline"
          className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
        >
          View Activity
        </Button>
      </div>

      <SegmentedTabSwitcher
        tabs={[
          { id: 'templates', label: 'Templates' },
          { id: 'manual', label: 'Manual' },
          { id: 'auto', label: 'Auto' },
        ] as const}
        activeTab={studioTopTab}
        onChange={(tab) => {
          haptics.light();
          safeStorageSetItem(DESIGN_STUDIO_TOP_TAB_KEY, tab);
          setStudioTopTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {activeTab === 'manual' ? (
        <>
          {studioTopTab === 'templates' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="block">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={PSD_FILE_ACCEPT}
                    onChange={handleUploadPSD}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={handleOpenPsdPicker}
                    disabled={isUploadingTemplate}
                    className="w-full border border-gray-200 dark:border-[#333333] rounded-2xl p-6 text-center hover:border-[#ec1e24] transition-colors bg-white dark:bg-[#000000]"
                  >
                    <Upload className="w-8 h-8 text-gray-400 dark:text-[#666666] mx-auto mb-3" />
                    <p className="text-gray-900 dark:text-white">
                      {isUploadingTemplate ? 'Uploading PSD Template...' : 'Upload PSD Template'}
                    </p>
                    <p className="mt-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      Select a `.psd` file from Files or Documents, not Photos
                    </p>
                  </button>
                </div>

                <button
                  onClick={handleLoadFromBackblaze}
                  className="border border-gray-200 dark:border-[#333333] rounded-2xl p-6 text-center hover:border-[#ec1e24] transition-colors bg-white dark:bg-[#000000]"
                >
                  <Cloud className="w-8 h-8 text-gray-400 dark:text-[#666666] mx-auto mb-3" />
                  <p className="text-gray-900 dark:text-white">Load from Backblaze</p>
                </button>
              </div>

              {isUploadingTemplate ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-[#333333] dark:bg-[#000000]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white">Uploading PSD template</p>
                      <p className="mt-1 truncate text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                        {uploadingTemplateName || 'Preparing upload...'}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm text-[#ec1e24]">{uploadProgress}%</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-[#111111]">
                    <div
                      className="h-full rounded-full bg-[#ec1e24] transition-[width] duration-200 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {isFinalizingTemplateUpload ? (
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-[#333333] dark:bg-[#000000] dark:text-[#9CA3AF]">
                  Finalizing PSD template...
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <h3 className="text-gray-900 dark:text-white font-medium">Templates ({templates.length})</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    haptics.light();
                    setIsTemplateListCollapsed((current) => {
                      const next = !current;
                      safeStorageSetItem(DESIGN_STUDIO_TEMPLATE_LIST_COLLAPSED_KEY, next ? 'true' : 'false');
                      return next;
                    });
                  }}
                  className="h-8 w-8 border-gray-200 bg-white p-0 text-gray-900 hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
                  aria-label={isTemplateListCollapsed ? 'Show templates' : 'Hide templates'}
                >
                  <img
                    src={isTemplateListCollapsed
                      ? '/icons/icons/hugeroundedicons/arrow-down-01-stroke-rounded.svg'
                      : '/icons/icons/hugeroundedicons/arrow-up-01-stroke-rounded.svg'}
                    alt=""
                    className="h-4 w-4 dark:invert"
                  />
                </Button>
              </div>

              {!isTemplateListCollapsed ? (
                <>
              {isLoadingState && templates.length === 0 ? (
                <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-8 text-center">
                  <p className="text-gray-600 dark:text-[#9CA3AF] mb-2">Loading your Design Studio templates...</p>
                  <p className="text-sm text-gray-500 dark:text-[#6B7280]">
                    Saved templates will appear here as soon as the workspace finishes syncing.
                  </p>
                </div>
              ) : templates.length === 0 ? (
                <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-12 text-center">
                  <p className="text-gray-600 dark:text-[#9CA3AF] mb-2">No templates yet</p>
                  <p className="text-sm text-gray-500 dark:text-[#6B7280]">
                    Upload a PSD template or load from Backblaze to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {isLoadingState ? (
                    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-[#333333] dark:bg-[#000000] dark:text-[#9CA3AF]">
                      Refreshing templates...
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map((template) => (
                      <SwipeableTemplateCard
                        key={template.id}
                        template={template}
                        onDelete={handleDeleteTemplate}
                        onEdit={handleEditTemplate}
                        onExpand={handleExpandTemplate}
                        livePreviewData={editingTemplateId === template.id ? livePreviewData : null}
                        isBeingEdited={editingTemplateId === template.id}
                      />
                    ))}
                  </div>
                </div>
              )}
                </>
              ) : null}
            </>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={handleCreateDesign}
                  className="border border-gray-200 dark:border-[#333333] rounded-2xl p-6 text-center hover:border-[#ec1e24] transition-colors bg-white dark:bg-[#000000]"
                >
                  <Plus className="w-8 h-8 text-gray-400 dark:text-[#666666] mx-auto mb-3" />
                  <p className="text-gray-900 dark:text-white">Create Design</p>
                  <p className="mt-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                    Start a new design using your saved template layout
                  </p>
                </button>
              </div>

              {newsQueueError ? (
                <div className="rounded-2xl border border-[#ec1e24]/40 bg-[#ec1e24]/10 px-4 py-3 text-sm text-[#ec1e24]">
                  {newsQueueError}
                </div>
              ) : null}

              <div className="space-y-6">
                <BottomSheet
                  open={isSourceFilterSheetOpen}
                  onOpenChange={setIsSourceFilterSheetOpen}
                  heightMode="auto"
                  showHandle
                >
                  <BottomSheetHeader>
                    <BottomSheetTitle>Sort Feeds</BottomSheetTitle>
                  </BottomSheetHeader>
                  <BottomSheetBody className="px-4 pb-4">
                    <div className="mb-4">
                      <SegmentedTabSwitcher
                        tabs={[
                          { id: 'sort', label: 'Sort' },
                          { id: 'source', label: 'Source' },
                        ] as const}
                        activeTab={newsQueueFilterSheetTab}
                        onChange={(tab) => {
                          haptics.light();
                          setNewsQueueFilterSheetTab(tab);
                        }}
                      />
                    </div>

                    {newsQueueFilterSheetTab === 'sort' ? (
                      <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-[#333333] dark:bg-[#000000]">
                        {(['recent-desc', 'recent-asc'] as const).map((option) => {
                          const selected = newsQueueSort === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                haptics.light();
                                setNewsQueueSort(option);
                              }}
                              className={`relative flex w-full items-center gap-2 rounded-sm px-3 py-3 text-left text-sm transition-colors ${
                                selected
                                  ? 'font-medium text-gray-900 dark:text-white'
                                  : 'text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-[#333333]'
                              }`}
                            >
                              <span className="flex-1 truncate">{NEWS_QUEUE_SORT_LABELS[option]}</span>
                              {selected ? <Check className="h-4 w-4 text-[#ec1e24]" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-[#333333] dark:bg-[#000000]">
                        <button
                          type="button"
                          onClick={() => {
                            haptics.light();
                            setSelectedNewsSources([]);
                          }}
                          className="flex w-full items-center gap-2 rounded-sm px-3 py-3 text-left text-sm text-gray-900 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-[#333333]"
                        >
                          <span className="flex-1 truncate">All sources</span>
                          {selectedNewsSources.length === 0 ? <Check className="h-4 w-4 text-[#ec1e24]" /> : null}
                        </button>
                        {newsQueueSourceOptions.map((source) => {
                          const selected = selectedNewsSources.includes(source);
                          return (
                            <button
                              key={source}
                              type="button"
                              onClick={() => {
                                haptics.light();
                                setSelectedNewsSources((current) =>
                                  current.includes(source)
                                    ? current.filter((entry) => entry !== source)
                                    : [...current, source],
                                );
                              }}
                              className={`flex w-full items-center gap-2 rounded-sm px-3 py-3 text-left text-sm transition-colors ${
                                selected
                                  ? 'font-medium text-gray-900 dark:text-white'
                                  : 'text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-[#333333]'
                              }`}
                            >
                              <span className="flex-1 truncate">{source}</span>
                              {selected ? <Check className="h-4 w-4 text-[#ec1e24]" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </BottomSheetBody>
                  <BottomSheetFooter>
                    <div className="flex w-full gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          haptics.light();
                          setSelectedNewsSources([]);
                        }}
                        className="flex-1 border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
                      >
                        Clear
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          haptics.light();
                          setIsSourceFilterSheetOpen(false);
                        }}
                        className="flex-1 bg-[#ec1e24] text-white hover:bg-[#d01a20]"
                      >
                        Done
                      </Button>
                    </div>
                  </BottomSheetFooter>
                </BottomSheet>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-gray-900 dark:text-white font-medium">Fetched News ({inboxNewsQueueItems.length})</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          haptics.light();
                          setIsSourceFilterSheetOpen(true);
                        }}
                        className={`h-9 w-9 p-0 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333] ${selectedNewsSources.length > 0 ? '!border-[#ec1e24] !text-[#ec1e24]' : ''}`}
                        aria-label={`Sort and filter fetched news. Current sort: ${NEWS_QUEUE_SORT_LABELS[newsQueueSort]}`}
                      >
                        <ArrowDownWideNarrow size={16} className="shrink-0" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void loadNewsQueue()}
                        disabled={isLoadingNewsQueue}
                        className="h-9 w-9 border-gray-200 bg-white p-0 text-gray-900 dark:border-[#333333] dark:bg-black dark:text-white"
                      >
                        {isLoadingNewsQueue ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span className="sr-only">Refresh fetched news</span>
                      </Button>
                    </div>
                  </div>
                  {isLoadingNewsQueue && newsQueueItems.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-[#333333] dark:bg-[#000000]">
                      <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Loading fetched stories...</p>
                    </div>
                  ) : inboxNewsQueueItems.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-[#333333] dark:bg-[#000000]">
                      <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                        {selectedNewsSources.length > 0
                          ? 'No fetched news stories for the selected source filters.'
                          : 'No fetched news stories right now.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {inboxNewsQueueItems.map((item) => (
                        <SwipeableActivityCard
                          key={item.id}
                          id={item.id}
                          onDelete={() => deleteNewsQueueItem(item)}
                          onSwipeRight={() => setSavedStateForNewsQueueItem(item.id, true)}
                          rightSwipeLabel="Save for Later"
                          rightSwipeIcon={<Bookmark className="w-5 h-5" />}
                          hoverActions={[
                            {
                              key: 'save-for-later',
                              label: 'Save for Later',
                              icon: <Bookmark className="h-4 w-4" />,
                              onClick: () => setSavedStateForNewsQueueItem(item.id, true),
                            },
                            {
                              key: 'delete',
                              label: 'Delete',
                              icon: <X className="h-4 w-4" />,
                              onClick: () => deleteNewsQueueItem(item),
                            },
                          ]}
                          className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-[#333333] dark:bg-[#000000]"
                          deleteLabel="Delete"
                        >
                          <article>
                            <div className="flex gap-3">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.title} className="h-20 w-28 rounded-xl object-cover" />
                              ) : (
                                <div className="h-20 w-28 rounded-xl border border-dashed border-gray-200 dark:border-[#333333] flex items-center justify-center text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                                  No image
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs uppercase tracking-[0.14em] text-[#6B7280] dark:text-[#9CA3AF]">{item.feedName || 'RSS Feed'}</p>
                                <p className="mt-1 text-sm leading-5 text-gray-900 dark:text-white">{item.title}</p>
                                <p className="mt-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">Fetched {formatEditorialDateTime(item.timestamp)}</p>
                                {usedQueueIds.has(item.id) ? (
                                  <span className="mt-2 inline-flex rounded-full bg-[#ec1e24]/10 px-2.5 py-1 text-[11px] text-[#ec1e24]">
                                    Used in manual draft
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <p className="mt-3 text-sm text-[#6B7280] dark:text-[#9CA3AF] line-clamp-2">
                              {toPlainTextSnippet(item.description || item.contentHtml, 140) || 'No summary available.'}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button type="button" onClick={() => handleCreateDesignFromNewsQueue(item)} className="bg-[#ec1e24] hover:bg-[#d01a20] text-white">
                                Create Design
                              </Button>
                              {item.link ? (
                                <Button type="button" variant="outline" onClick={() => window.open(item.link, '_blank', 'noopener,noreferrer')} className="border-gray-200 dark:border-[#333333]">
                                  <ExternalLink className="mr-2 h-[12px] w-[12px]" />
                                  Open Source
                                </Button>
                              ) : null}
                            </div>
                          </article>
                        </SwipeableActivityCard>
                      ))}
                    </div>
                  )}
                </section>

                {savedNewsQueueItems.length > 0 ? (
                  <section className="space-y-3">
                    <div className="flex items-center">
                      <h3 className="text-gray-900 dark:text-white font-medium">Saved For Later ({savedNewsQueueItems.length})</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {savedNewsQueueItems.map((item) => (
                        <SwipeableActivityCard
                          key={item.id}
                          id={item.id}
                          onDelete={() => deleteNewsQueueItem(item)}
                          onSwipeRight={() => setSavedStateForNewsQueueItem(item.id, false)}
                          rightSwipeLabel="Remove Save"
                          rightSwipeIcon={<BookmarkCheck className="w-5 h-5" />}
                          hoverActions={[
                            {
                              key: 'remove-save-for-later',
                              label: 'Remove Save',
                              icon: <BookmarkCheck className="h-4 w-4" />,
                              onClick: () => setSavedStateForNewsQueueItem(item.id, false),
                            },
                            {
                              key: 'delete',
                              label: 'Delete',
                              icon: <X className="h-4 w-4" />,
                              onClick: () => deleteNewsQueueItem(item),
                            },
                          ]}
                          className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-[#333333] dark:bg-[#000000]"
                          deleteLabel="Delete"
                        >
                          <article>
                            <div className="flex gap-3">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.title} className="h-20 w-28 rounded-xl object-cover" />
                              ) : (
                                <div className="h-20 w-28 rounded-xl border border-dashed border-gray-200 dark:border-[#333333] flex items-center justify-center text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                                  No image
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs uppercase tracking-[0.14em] text-[#6B7280] dark:text-[#9CA3AF]">{item.feedName || 'RSS Feed'}</p>
                                <p className="mt-1 text-sm leading-5 text-gray-900 dark:text-white">{item.title}</p>
                                <p className="mt-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">Fetched {formatEditorialDateTime(item.timestamp)}</p>
                              </div>
                            </div>
                            <p className="mt-3 text-sm text-[#6B7280] dark:text-[#9CA3AF] line-clamp-2">
                              {toPlainTextSnippet(item.description || item.contentHtml, 140) || 'No summary available.'}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button type="button" onClick={() => handleCreateDesignFromNewsQueue(item)} className="bg-[#ec1e24] hover:bg-[#d01a20] text-white">
                                Create Design
                              </Button>
                              {item.link ? (
                                <Button type="button" variant="outline" onClick={() => window.open(item.link, '_blank', 'noopener,noreferrer')} className="border-gray-200 dark:border-[#333333]">
                                  <ExternalLink className="mr-2 h-[12px] w-[12px]" />
                                  Open Source
                                </Button>
                              ) : null}
                            </div>
                          </article>
                        </SwipeableActivityCard>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Generated Today', value: autoStats.generatedToday },
              { label: 'Queued', value: autoStats.queued },
              { label: 'Posted', value: autoStats.posted },
              { label: 'Failed', value: autoStats.failed },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] p-4 lg:p-5">
                <p className="text-xs lg:text-sm text-[#6B7280] dark:text-[#9CA3AF]">{stat.label}</p>
                <p className="mt-2 text-2xl lg:text-3xl text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] p-4 lg:p-6 space-y-4">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-gray-900 dark:text-white">Auto Editorial Controls</p>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1 max-w-2xl">
                  Auto watches your selected RSS feeds, filters matching titles, and rotates through your validated PSD templates automatically.
                </p>
              </div>
              <div className="rounded-2xl border border-dashed border-gray-200 dark:border-[#333333] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[#6B7280] dark:text-[#9CA3AF]">
                  Current behavior
                </p>
                <p className="mt-2 text-sm text-gray-900 dark:text-white">
                  {settings.designStudioAutoEnabled
                    ? isGeneratingAutoEditorials
                      ? 'Auto is scanning selected feeds and preparing editorials now.'
                      : 'Auto is enabled and will generate editorials in the background when matching feed updates arrive.'
                    : 'Auto is off. Turn it on in Design Studio settings to let the system run automatically.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <div className="rounded-2xl border border-gray-200 dark:border-[#333333] p-4">
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Auto Editorials</p>
                <p className="mt-2 text-sm text-gray-900 dark:text-white">
                  {settings.designStudioAutoEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-[#333333] p-4">
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Posting Interval</p>
                <p className="mt-2 text-sm text-gray-900 dark:text-white">{settings.designStudioPostingInterval || '5'} min</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-[#333333] p-4">
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Auto Templates</p>
                <p className="mt-2 text-sm text-gray-900 dark:text-white">
                  {autoTemplatePool.length === 0
                    ? 'None loaded'
                    : autoTemplatePool.length === 1
                      ? '1 template'
                      : `${autoTemplatePool.length} templates`}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-[#333333] p-4">
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Auto Post</p>
                <p className="mt-2 text-sm text-gray-900 dark:text-white">{settings.designStudioAutoPost ? 'On' : 'Off'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-[#333333] p-4 col-span-2 lg:col-span-1">
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Selected Feeds</p>
                <p className="mt-2 text-sm text-gray-900 dark:text-white">
                  {settings.designStudioSelectedRssFeedIds?.length || 0} of {feeds.length}
                </p>
              </div>
            </div>
          </div>

          {autoEditorials.length === 0 ? (
            <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-12 text-center">
              <p className="text-gray-600 dark:text-[#9CA3AF] mb-2">No auto editorials yet</p>
              <p className="text-sm text-gray-500 dark:text-[#6B7280]">
                Editorials will appear here when feed items match your selected trigger topics
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {autoEditorials.map((editorial) => (
                <SwipeableActivityCard
                  key={editorial.id}
                  id={editorial.id}
                  onDelete={() => {
                    void handleDeleteEditorial(editorial);
                  }}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]"
                  deleteLabel="Delete"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewEditorial(editorial);
                    }}
                    className="w-full"
                  >
                    <img
                      src={editorial.renderedImage}
                      alt={editorial.sourceTitle}
                      className="h-56 w-full object-cover lg:h-64"
                    />
                  </button>
                  <div className="p-4 lg:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-[#6B7280] dark:text-[#9CA3AF]">{editorial.sourceFeedName || 'RSS Feed'}</p>
                        <p className="mt-1 text-sm leading-6 text-gray-900 dark:text-white">{editorial.sourceTitle}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEditorial(editorial);
                          setIsEditorialActionsOpen(true);
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/70 p-0 text-white shadow-[0_8px_18px_rgba(0,0,0,0.28)] transition-colors hover:bg-black/85"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-[#111111] dark:text-[#9CA3AF]">
                        {editorial.status.charAt(0).toUpperCase() + editorial.status.slice(1)}
                      </span>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-[#111111] dark:text-[#9CA3AF]">
                        {editorial.templateName || 'Template'}
                      </span>
                      {editorial.matchedKeyword ? (
                        <span className="rounded-full bg-[#ec1e24]/10 px-3 py-1 text-[#ec1e24]">
                          {editorial.matchedKeyword}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {(editorial.targetPlatforms || []).map((platform) => (
                        <span
                          key={`${editorial.id}-${platform}`}
                          className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-700 shadow-sm dark:border-[#333333] dark:bg-[#111111] dark:text-[#D1D5DB]"
                        >
                          {formatPlatformLabel(platform)}
                        </span>
                      ))}
                      {(editorial.targetPlatforms || []).length === 0 ? (
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-700 shadow-sm dark:border-[#333333] dark:bg-[#111111] dark:text-[#D1D5DB]">
                          No platforms
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-xs text-[#6B7280] dark:text-[#9CA3AF] sm:grid-cols-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 shadow-sm dark:border-[#333333] dark:bg-black dark:text-[#9CA3AF]">
                        <Clock3 className="h-3.5 w-3.5" />
                        <span>Fetched {formatEditorialDateTime(editorial.createdAt)}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 shadow-sm dark:border-[#333333] dark:bg-black dark:text-[#9CA3AF]">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Schedule {editorial.scheduleTime ? formatEditorialDateTime(editorial.scheduleTime) : 'Not scheduled'}</span>
                      </div>
                    </div>

                    <p className="text-sm leading-6 text-[#6B7280] dark:text-[#9CA3AF] line-clamp-3">{editorial.caption}</p>
                  </div>
                </SwipeableActivityCard>
              ))}
            </div>
          )}
        </>
      )}
      
      {/* Edit Design Bottom Sheet */}
      {selectedTemplate && (
        <EditDesignBottomSheet
          key={selectedTemplate.id}
          open={isEditSheetOpen}
          onOpenChange={(open) => {
            setIsEditSheetOpen(open);
            if (!open) {
              setEditingTemplateId(null);
              setEditorInitialData(null);
              setLivePreviewData(null);
              setManualDraftSource(null);
            }
          }}
          templateName={selectedTemplate.name}
          aspectRatio={selectedTemplate.aspectRatio}
          initialData={editorInitialData || buildTemplateInitialData(selectedTemplate, settings.exportFormat === 'png' ? 'png' : 'jpeg')}
          hasHeader={selectedTemplate.hasHeader}
          hasBackground={selectedTemplate.hasBackground}
          hasSubtext={selectedTemplate.hasSubtext}
          hasOverlay={selectedTemplate.hasOverlay}
          sourceContext={manualDraftSource ? {
            sourceHeadline: manualDraftSource.sourceHeadline,
            suggestedHeadline: manualDraftSource.suggestedHeadline,
            sourceName: manualDraftSource.sourceName,
            sourceSummary: manualDraftSource.sourceSummary,
            sourceUrl: manualDraftSource.sourceUrl,
            fetchedAt: manualDraftSource.fetchedAt,
            matchedKeyword: manualDraftSource.matchedKeyword,
          } : undefined}
          onSave={handleSaveDesign}
          onChange={(data) => setLivePreviewData(data)}
          isRendering={isRendering}
        />
      )}

      {/* Publish Bottom Sheet */}
      {publishTarget && (
        <PublishBottomSheet
          open={isPublishSheetOpen}
          onOpenChange={setIsPublishSheetOpen}
          title="Publish Design"
          description="Select platforms and customize your caption"
          initialCaption={publishTarget.caption || ''}
          onPublish={(caption, platforms) => handlePublish(caption, platforms)}
          onCaptionGenerate={() => {
            return publishTarget.caption || publishTarget.templateName || 'New design created!';
          }}
        />
      )}

      {/* Expanded Template Preview Dialog */}
      {expandedTemplate && (
        <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
          <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none" hideCloseButton>
            <VisuallyHidden>
              <DialogTitle>{expandedTemplate.name}</DialogTitle>
              <DialogDescription>
                Full size preview of {expandedTemplate.name} ({expandedTemplate.aspectRatio})
              </DialogDescription>
            </VisuallyHidden>
            <div className="relative">
              <button
                onClick={() => {
                  haptics.light();
                  setExpandedTemplateZoom(1);
                  setIsExpanded(false);
                }}
                className="absolute right-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-black/78 text-white shadow-lg transition-colors hover:bg-black"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="max-h-[90vh] overflow-auto rounded-lg bg-black">
                <img
                  src={expandedTemplate.previewUrl}
                  alt={expandedTemplate.name}
                      onTouchEnd={handleDoubleTapZoom}
                  className="w-full h-auto max-h-[90vh] object-contain rounded-lg transition-transform duration-200"
                  style={{ transform: `scale(${expandedTemplateZoom})`, transformOrigin: 'center center' }}
                />
              </div>
              <div className="border-t border-white/10 bg-black/90 p-5 text-white">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.18em] text-white/60">Template Details</p>
                    <p className="mt-2 text-xl">{expandedTemplate.name}</p>
                    <p className="mt-1 text-sm text-white/70">
                      {expandedTemplate.width} x {expandedTemplate.height} • {expandedTemplate.aspectRatio}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85">
                      {expandedTemplate.validationState === 'invalid'
                        ? 'Invalid'
                        : expandedTemplate.validationState === 'warning'
                          ? 'Needs Review'
                          : expandedTemplate.isValidated === false
                            ? 'Invalid'
                            : 'Validated'}
                    </span>
                    {expandedTemplate.baseVariant ? (
                      <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85">
                        {expandedTemplate.baseVariant.replace(/_/g, ' ')}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">Mapped Layers</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(expandedTemplate.mappedLayerNames && expandedTemplate.mappedLayerNames.length > 0
                      ? expandedTemplate.mappedLayerNames
                      : Object.values(expandedTemplate.mappedLayers || {})
                    ).slice(0, 8).map((layerName) => (
                      <span
                        key={layerName}
                        className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/90"
                      >
                        {layerName}
                      </span>
                    ))}
                    {(!expandedTemplate.mappedLayerNames || expandedTemplate.mappedLayerNames.length === 0) &&
                    Object.keys(expandedTemplate.mappedLayers || {}).length === 0 ? (
                      <span className="text-sm text-white/70">No PSD layer names were extracted for this template yet.</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Backblaze Template Browser */}
      <BackblazeTemplateBrowser
        open={showBackblazeBrowser}
        onSelectTemplate={(file) => {
          handleLoadSelectedTemplates([file]).catch((error) => {
            console.error('Failed to load template from Backblaze:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to load template');
          });
        }}
        onClose={() => {
          haptics.light();
          setShowBackblazeBrowser(false);
        }}
      />

      <BottomSheet
        open={isEditorialActionsOpen}
        onOpenChange={setIsEditorialActionsOpen}
        heightMode="auto"
        className="bg-white dark:bg-[#000000]"
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Auto Editorial Actions</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-2">
            {selectedEditorial ? (
              <>
                <button
                  type="button"
                  onClick={() => openEditorialEditor(selectedEditorial, 'caption')}
                  className={getActionButtonClass()}
                >
                  Edit Caption
                </button>
                <button
                  type="button"
                  onClick={() => openEditorialEditor(selectedEditorial, 'header')}
                  className={getActionButtonClass()}
                >
                  Edit Header
                </button>
                <button
                  type="button"
                  onClick={() => openEditorialEditor(selectedEditorial, 'subheader')}
                  className={getActionButtonClass()}
                >
                  Edit Subtext
                </button>
                <button
                  type="button"
                  onClick={() => openEditorialEditor(selectedEditorial, 'background')}
                  className={getActionButtonClass()}
                >
                  Change Background
                </button>
                <button
                  type="button"
                  onClick={() => openEditorialEditor(selectedEditorial, 'overlay')}
                  className={getActionButtonClass()}
                >
                  Adjust Overlay
                </button>
                <button
                  type="button"
                  onClick={() => openEditorialEditor(selectedEditorial, 'template')}
                  className={getActionButtonClass()}
                >
                  Change Template
                </button>
                <button
                  type="button"
                  onClick={() => openEditorialEditor(selectedEditorial, 'schedule')}
                  className={getActionButtonClass()}
                >
                  Edit Schedule
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditorialActionsOpen(false);
                    void handlePublishAutoEditorial(selectedEditorial);
                  }}
                  className={getActionButtonClass()}
                >
                  Publish Now
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteEditorial(selectedEditorial)}
                  className={getActionButtonClass(true)}
                >
                  Delete
                </button>
              </>
            ) : null}
          </div>
        </BottomSheetBody>
      </BottomSheet>

      <BottomSheet
        open={isEditorialEditorOpen}
        onOpenChange={setIsEditorialEditorOpen}
        heightMode="auto"
        className="bg-white dark:bg-[#000000]"
      >
        <BottomSheetHeader>
          <BottomSheetTitle>
            {editorialEditorMode === 'caption' && 'Edit Caption'}
            {editorialEditorMode === 'header' && 'Edit Header'}
            {editorialEditorMode === 'subheader' && 'Edit Subtext'}
            {editorialEditorMode === 'background' && 'Change Background'}
            {editorialEditorMode === 'overlay' && 'Adjust Overlay'}
            {editorialEditorMode === 'template' && 'Change Template'}
            {editorialEditorMode === 'schedule' && 'Edit Schedule'}
          </BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4">
            {editorialEditorMode === 'template' ? (
              <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#333333] dark:bg-black">
                <Label className="text-gray-900 dark:text-white">Validated Template</Label>
                <Select value={editorialDraftValue} onValueChange={setEditorialDraftValue}>
                  <SelectTrigger className="border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] text-gray-900 dark:text-white">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
                    {validatedTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : editorialEditorMode === 'overlay' ? (
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#333333] dark:bg-black">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="text-gray-900 dark:text-white">Overlay Color</Label>
                    <span className="text-xs uppercase text-gray-500 dark:text-[#9CA3AF]">{editorialOverlayColor}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={editorialOverlayColor}
                      onChange={(event) => setEditorialOverlayColor(event.target.value)}
                      className="h-12 w-12 cursor-pointer rounded-full border border-gray-200 bg-transparent p-1 dark:border-[#333333]"
                    />
                    <Input
                      value={editorialOverlayColor}
                      onChange={(event) => setEditorialOverlayColor(event.target.value)}
                      className="border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="text-gray-900 dark:text-white">Overlay Strength</Label>
                    <span className="text-xs text-gray-500 dark:text-[#9CA3AF]">{editorialOverlayStrength}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={editorialOverlayStrength}
                    onChange={(event) => setEditorialOverlayStrength(Number.parseInt(event.target.value || '0', 10))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-[#ec1e24] dark:bg-[#333333]"
                  />
                </div>
                <div>
                  <Label className="mb-2 block text-gray-900 dark:text-white">Overlay Direction</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['top', 'bottom', 'left', 'right'] as const).map((direction) => (
                      <button
                        key={direction}
                        type="button"
                        onClick={() => setEditorialOverlayDirection(direction)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                          editorialOverlayDirection === direction
                            ? 'border-[#ec1e24] bg-[#ec1e24] text-white'
                            : 'border-gray-200 bg-white text-gray-900 dark:border-[#333333] dark:bg-black dark:text-white'
                        }`}
                      >
                        {direction}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : editorialEditorMode === 'caption' || editorialEditorMode === 'header' || editorialEditorMode === 'subheader' ? (
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#333333] dark:bg-black">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Label className="text-gray-900 dark:text-white">
                    {editorialEditorMode === 'caption' ? 'Social Caption' : editorialEditorMode === 'header' ? 'Header Text' : 'Subtext'}
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      if (editorialEditorMode === 'caption') {
                        void handleGenerateEditorialCaption();
                      }
                    }}
                    disabled={editorialEditorMode !== 'caption' || isGeneratingEditorialCaption}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
                  >
                    {isGeneratingEditorialCaption ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </button>
                </div>
                <textarea
                  value={editorialDraftValue}
                  onChange={(event) => setEditorialDraftValue(event.target.value)}
                  rows={editorialEditorMode === 'caption' ? 6 : 5}
                  className="min-h-[150px] w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-900 outline-none transition-colors focus:border-[#ec1e24] dark:border-[#333333] dark:bg-black dark:text-white"
                  placeholder={editorialEditorMode === 'caption' ? 'Write the social caption...' : 'Write the design text...'}
                />
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#6B7280]">
                  <span>{editorialEditorMode === 'caption' ? 'Use the article title and summary tone.' : 'This updates the editorial text.'}</span>
                  <span>{editorialDraftValue.length} chars</span>
                </div>
              </div>
            ) : editorialEditorMode === 'background' ? (
              <div className="space-y-4">
                <input
                  ref={backgroundFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    void handleEditorialBackgroundFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
                <div
                  className={`rounded-2xl border border-dashed p-5 text-center transition-colors ${
                    isBackgroundDragging
                      ? 'border-[#ec1e24] bg-[#ec1e24]/10'
                      : 'border-gray-200 bg-white dark:border-[#333333] dark:bg-black'
                  }`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsBackgroundDragging(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsBackgroundDragging(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsBackgroundDragging(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsBackgroundDragging(false);
                    void handleEditorialBackgroundFile(event.dataTransfer.files?.[0]);
                  }}
                >
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#ec1e24]/10 text-[#ec1e24]">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Upload or drag an image here</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-[#9CA3AF]">Backdrops, posters, logos, and person images are supported.</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => backgroundFileInputRef.current?.click()}
                    className="mt-4 rounded-full border-gray-200 bg-white text-gray-900 dark:border-[#333333] dark:bg-black dark:text-white"
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />
                    Upload Image
                  </Button>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#333333] dark:bg-black">
                  <Label className="text-gray-900 dark:text-white">Search Movie, TV, Logo, or Person</Label>
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={backgroundSearchQuery}
                      onChange={(event) => setBackgroundSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleSearchEditorialBackgrounds();
                        }
                      }}
                      placeholder="Search TMDb..."
                      className="bg-white text-gray-900 dark:bg-black dark:text-white"
                    />
                    <Button
                      type="button"
                      onClick={() => void handleSearchEditorialBackgrounds()}
                      disabled={isSearchingBackgrounds}
                      className="rounded-full bg-[#ec1e24] text-white hover:bg-[#d01a20]"
                    >
                      {isSearchingBackgrounds ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>

                  {selectedBackgroundSearchResult ? (
                    <div className="mt-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedBackgroundSearchResult.title}</p>
                          <p className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-[#9CA3AF]">{selectedBackgroundSearchResult.mediaType}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBackgroundSearchResult(null);
                            setBackgroundImageAssets([]);
                          }}
                          className="rounded-full px-3 py-1 text-xs text-[#ec1e24]"
                        >
                          Change
                        </button>
                      </div>
                      {isLoadingBackgroundAssets ? (
                        <p className="text-xs text-gray-500 dark:text-[#9CA3AF]">Loading images...</p>
                      ) : (
                        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
                          {backgroundImageAssets.map((asset) => (
                            <button
                              key={`${asset.kind}-${asset.url}`}
                              type="button"
                              onClick={() => setEditorialDraftValue(asset.url)}
                              className={`relative overflow-hidden rounded-xl border-2 transition-colors ${
                                editorialDraftValue === asset.url ? 'border-[#ec1e24]' : 'border-transparent hover:border-[#ec1e24]/70'
                              } ${asset.kind === 'backdrop' ? 'aspect-video' : 'aspect-[4/5]'}`}
                            >
                              <img src={asset.url} alt={`${selectedBackgroundSearchResult.title} ${asset.kind}`} className="h-full w-full object-cover" />
                              <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white">
                                {asset.kind}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : backgroundSearchResults.length > 0 ? (
                    <div className="mt-4 grid gap-2">
                      {backgroundSearchResults.map((result) => (
                        <button
                          key={`${result.mediaType}-${result.id}`}
                          type="button"
                          onClick={() => void handleSelectBackgroundResult(result)}
                          className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-[#ec1e24] dark:border-[#333333] dark:bg-black"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{result.title}</p>
                            <p className="text-xs uppercase tracking-[0.12em] text-gray-500 dark:text-[#9CA3AF]">
                              {result.mediaType}{result.releaseDate ? ` | ${result.releaseDate.slice(0, 4)}` : ''}
                            </p>
                          </div>
                          <Search className="h-4 w-4 text-[#ec1e24]" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#333333] dark:bg-black">
                  <Label className="text-gray-900 dark:text-white">Background URL</Label>
                  <Input
                    type="text"
                    value={editorialDraftValue}
                    onChange={(event) => setEditorialDraftValue(event.target.value)}
                    className="border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            ) : editorialEditorMode === 'schedule' ? (
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#333333] dark:bg-black">
                <div className="space-y-2">
                  <Label className="text-gray-900 dark:text-white">Schedule Date</Label>
                  <Input
                    type="date"
                    value={editorialScheduleDate}
                    onChange={(event) => setEditorialScheduleDate(event.target.value)}
                    className="border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] text-gray-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-900 dark:text-white">Schedule Time</Label>
                  <Input
                    type="time"
                    value={editorialScheduleTime}
                    onChange={(event) => setEditorialScheduleTime(event.target.value)}
                    className="border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div />
            )}
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditorialEditorOpen(false)}
              disabled={isSavingEditorialEdit}
              className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveEditorialEdit()}
              disabled={isSavingEditorialEdit}
              className="flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white"
            >
              {isSavingEditorialEdit ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      <MediaPreviewDialog
        open={Boolean(previewEditorial)}
        src={previewEditorial?.renderedImage}
        mediaType="image"
        title={previewEditorial?.headerText || previewEditorial?.sourceTitle || 'Auto editorial preview'}
        badgeLabel="Rendered"
        onOpenChange={(open) => {
          if (!open) {
            setPreviewEditorial(null);
          }
        }}
      />
    </div>
  );
}
