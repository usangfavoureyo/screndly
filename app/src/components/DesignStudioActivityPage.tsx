import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Calendar, Clock3, Image as ImageIcon, ImagePlus, LoaderCircle, MoreVertical, RefreshCw, Search, Send, Trash2, Upload, X } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { apiClient } from '../lib/api/client';
import {
  createDesignStudioActivity,
  type DesignStudioAutoEditorialRecord,
  fetchDesignStudioRenderJobs,
  fetchDesignStudioState,
  fetchDesignStudioTMDbImages,
  saveDesignStudioState,
  searchDesignStudioTMDb,
  startDesignStudioManualRender,
  type DesignStudioTemplateRecord,
  type DesignStudioTMDbImageAsset,
  type DesignStudioTMDbImagePool,
  type DesignStudioTMDbSearchResult,
  type DesignStudioRenderedDesignRecord,
  type DesignStudioManualRenderJob,
  uploadDesignStudioAsset,
} from '../lib/api/designStudio';
import { SwipeableActivityCard } from './SwipeableActivityCard';
import type { DesignData } from './EditDesignBottomSheet';
import { toast } from 'sonner';
import { useBulkSelection } from '../hooks/useBulkSelection';

const DASHBOARD_DESIGN_STUDIO_ACTIVITY_TARGET_STORAGE_KEY = 'screndly_dashboard_design_studio_activity_target';
const DESIGN_STUDIO_EDITOR_TARGET_KEY = 'screndly_design_studio_editor_target';
import { ActivitySelectionToolbar } from './ActivitySelectionToolbar';
import { useUndo } from './UndoContext';
import { useSettings } from '../contexts/SettingsContext';
import { BackIconButton } from './BackIconButton';
import { SegmentedTabSwitcher } from './SegmentedTabSwitcher';
import { PublishBottomSheet } from './PublishBottomSheet';
import { publishContent, type PlatformSelection } from '../lib/api/platforms';
import { generateDesignStudioCaption } from '../utils/designStudioCaptionGenerator';
import { Button } from './ui/button';
import { BottomSheet, BottomSheetBody, BottomSheetFooter, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription } from './ui/bottom-sheet';
import { DatePicker } from './ui/date-picker';
import { TimePicker } from './ui/time-picker';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { VisuallyHidden } from './ui/visually-hidden';
import { Input } from './ui/input';
import { buildDesignStudioMediaStreamUrl } from '../lib/designStudioMedia';

const PREVIEW_TAP_MOVE_TOLERANCE = 24;
const PREVIEW_DOUBLE_TAP_PROXIMITY = 32;
const PREVIEW_PAN_START_TOLERANCE = 10;

interface DesignStudioActivityRecord {
  id: string;
  type: string;
  details: {
    templateName?: string;
    headerText?: string;
    sourceTitle?: string;
    sourceHeadline?: string;
    sourceSummary?: string;
    sourceUrl?: string;
    sourceName?: string;
    designId?: string;
    platforms?: string;
    source?: string;
    count?: number;
    matchedKeyword?: string;
    status?: string;
    field?: string;
    failureReason?: string | null;
    previewUrl?: string;
    outputUrl?: string;
    renderJobId?: string;
    exportFormat?: 'jpeg' | 'png';
    scheduleTime?: string;
    backgroundImage?: string;
    overlayColor?: string;
    overlayStrength?: number;
    overlayDirection?: string;
    targetPlatforms?: string[] | string;
  };
  createdAt: string;
}

interface ActivityPublishTarget {
  activityId: string;
  title: string;
  outputUrl: string;
  caption?: string;
  contentType?: 'poster' | 'carousel' | 'story' | 'announcement' | 'general';
  context?: string;
  sourceTitle?: string;
  matchedKeyword?: string;
  isAutoEditorial?: boolean;
}

interface ActivityPreviewTarget {
  title: string;
  imageUrl: string;
}

interface DesignStudioEditorTarget {
  templateId: string;
  tab?: DesignStudioActivityTab;
  initialData?: DesignData | null;
}

type CardEditorMode =
  | 'caption'
  | 'header'
  | 'subtext'
  | 'background'
  | 'overlay';

interface CardEditorState {
  mode: CardEditorMode;
  activity: DesignStudioActivityRecord;
}

function safeStorageSetItem(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Failed to persist Design Studio activity cache for ${key}:`, error);
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

function normalizeActivityDetails(value: unknown): DesignStudioActivityRecord['details'] {
  const details = asRecord(value);
  return {
    templateName: typeof details.templateName === 'string' ? details.templateName : undefined,
    headerText: typeof details.headerText === 'string' ? details.headerText : undefined,
    sourceTitle: typeof details.sourceTitle === 'string' ? details.sourceTitle : undefined,
    sourceHeadline: typeof details.sourceHeadline === 'string' ? details.sourceHeadline : undefined,
    sourceSummary: typeof details.sourceSummary === 'string' ? details.sourceSummary : undefined,
    sourceUrl: typeof details.sourceUrl === 'string' ? details.sourceUrl : undefined,
    sourceName: typeof details.sourceName === 'string' ? details.sourceName : undefined,
    designId: typeof details.designId === 'string' ? details.designId : undefined,
    platforms: typeof details.platforms === 'string' ? details.platforms : undefined,
    source: typeof details.source === 'string' ? details.source : undefined,
    count: typeof details.count === 'number' ? details.count : undefined,
    matchedKeyword: typeof details.matchedKeyword === 'string' ? details.matchedKeyword : undefined,
    status: typeof details.status === 'string' ? details.status : undefined,
    field: typeof details.field === 'string' ? details.field : undefined,
    failureReason: typeof details.failureReason === 'string' ? details.failureReason : null,
    previewUrl: typeof details.previewUrl === 'string' ? details.previewUrl : undefined,
    outputUrl: typeof details.outputUrl === 'string' ? details.outputUrl : undefined,
    renderJobId: typeof details.renderJobId === 'string' ? details.renderJobId : undefined,
    exportFormat: details.exportFormat === 'png' ? 'png' : details.exportFormat === 'jpeg' ? 'jpeg' : undefined,
    scheduleTime: typeof details.scheduleTime === 'string' ? details.scheduleTime : undefined,
  };
}

function normalizeActivityRecord(activity: any): DesignStudioActivityRecord | null {
  if (!activity || typeof activity !== 'object') {
    return null;
  }

  const id = typeof activity.id === 'string' ? activity.id.trim() : '';
  const type = typeof activity.type === 'string' ? activity.type.trim() : '';
  if (!id || !type) {
    return null;
  }

  return {
    id,
    type,
    details: normalizeActivityDetails(activity.details),
    createdAt: normalizeIsoString(activity.createdAt) || new Date().toISOString(),
  };
}

function normalizeManualRenderJob(job: any): DesignStudioManualRenderJob | null {
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

function normalizeRenderedDesignRecord(renderedDesign: any): DesignStudioRenderedDesignRecord | null {
  if (!renderedDesign || typeof renderedDesign !== 'object') {
    return null;
  }

  const id = typeof renderedDesign.id === 'string' ? renderedDesign.id.trim() : '';
  const templateId = typeof renderedDesign.templateId === 'string' ? renderedDesign.templateId.trim() : '';
  const outputUrl = typeof renderedDesign.outputUrl === 'string'
    ? renderedDesign.outputUrl.trim()
    : typeof renderedDesign.previewUrl === 'string'
      ? renderedDesign.previewUrl.trim()
      : '';
  if (!id || !templateId || !outputUrl) {
    return null;
  }

  const data = asRecord(renderedDesign.data);
  return {
    ...renderedDesign,
    id,
    templateId,
    templateName: typeof renderedDesign.templateName === 'string' && renderedDesign.templateName.trim().length > 0
      ? renderedDesign.templateName
      : 'Untitled design',
    outputUrl,
    previewUrl: typeof renderedDesign.previewUrl === 'string' ? renderedDesign.previewUrl : outputUrl,
    data: {
      ...data,
      backgroundImage: compactBackgroundImage(data.backgroundImage),
    },
    createdAt: normalizeIsoString(renderedDesign.createdAt) || new Date().toISOString(),
  };
}

function compactTemplateForCache(template: DesignStudioTemplateRecord) {
  return {
    id: template.id,
    name: template.name,
    previewImage: template.previewImage,
    previewUrl: template.previewUrl,
    aspectRatio: template.aspectRatio,
    width: template.width,
    height: template.height,
    source: template.source,
    lastEdited: template.lastEdited,
    hasSubtext: template.hasSubtext,
    hasCategory: template.hasCategory,
    hasSource: template.hasSource,
    layoutVariant: template.layoutVariant,
    baseVariant: template.baseVariant,
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

function compactRenderedDesignForCache(renderedDesign: DesignStudioRenderedDesignRecord) {
  const data = asRecord(renderedDesign.data);
  return {
    ...renderedDesign,
    data: {
      ...data,
      backgroundImage: compactBackgroundImage(data.backgroundImage),
    },
  };
}

function normalizeMediaKey(value?: string | null): string {
  if (!value) return '';
  try {
    const parsed = new URL(value, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return value.split('?')[0]?.trim() || '';
  }
}

interface DesignStudioActivityPageProps {
  onNavigate: (page: string) => void;
  previousPage?: string | null;
}

type DesignStudioActivityTab = 'manual' | 'auto';

const DESIGN_STUDIO_ACTIVITY_CACHE_KEY = 'designStudioActivityCache';
const DESIGN_STUDIO_ACTIVITY_DISMISSED_KEY = 'designStudioActivityDismissed';

const MANUAL_ACTIVITY_TYPES = new Set([
  'template_uploaded',
  'templates_loaded',
  'design_render_queued',
  'design_rendered',
  'design_render_failed',
  'design_scheduled',
  'design_published',
  'template_deleted',
]);

const AUTO_ACTIVITY_TYPES = new Set([
  'auto_editorial_generated',
  'auto_editorial_updated',
  'auto_editorial_posted',
  'auto_editorial_failed',
  'auto_editorial_deleted',
]);

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return formatDistanceToNow(date, { addSuffix: true });
}

function formatFetchedDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizePlatformLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'twitter') return 'X';
  if (normalized === 'x') return 'X';
  if (normalized === 'threads') return 'Threads';
  if (normalized === 'instagram') return 'Instagram';
  if (normalized === 'facebook') return 'Facebook';
  if (normalized === 'pinterest') return 'Pinterest';
  return value.trim();
}

function parseActivityPlatforms(activity: DesignStudioActivityRecord, editorial?: DesignStudioAutoEditorialRecord): string[] {
  const fromDetails = Array.isArray(activity.details.targetPlatforms)
    ? activity.details.targetPlatforms
    : typeof activity.details.targetPlatforms === 'string'
      ? activity.details.targetPlatforms.split(',')
      : typeof activity.details.platforms === 'string'
        ? activity.details.platforms.split(',')
        : [];
  const source = fromDetails.length > 0 ? fromDetails : editorial?.targetPlatforms || [];

  return Array.from(new Set(
    source
      .map((platform) => normalizePlatformLabel(String(platform)))
      .filter(Boolean),
  ));
}

function toBackgroundImagePoolList(pool: DesignStudioTMDbImagePool, mediaType: DesignStudioTMDbSearchResult['mediaType']): Array<DesignStudioTMDbImageAsset & { kind: 'backdrop' | 'poster' | 'logo' | 'profile' }> {
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

function getActionButtonClass(isDestructive = false) {
  return [
    'w-full rounded-2xl border px-4 py-3 text-center text-sm font-medium transition-colors',
    isDestructive
      ? 'border-[#ec1e24]/30 bg-[#ec1e24]/10 text-[#ec1e24] hover:bg-[#ec1e24]/15'
      : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]',
  ].join(' ');
}

function activityTitle(activity: DesignStudioActivityRecord): string {
  const renderTitle = activity.details?.headerText || activity.details?.templateName || 'Untitled design';

  switch (activity.type) {
    case 'template_uploaded':
      return 'Template Uploaded';
    case 'templates_loaded':
      return 'Templates Loaded';
    case 'design_render_queued':
      return 'Design Rendering';
    case 'design_rendered':
      return renderTitle;
    case 'design_render_failed':
      return renderTitle;
    case 'design_scheduled':
      return renderTitle;
    case 'design_published':
      return renderTitle;
    case 'template_deleted':
      return 'Template Deleted';
    case 'auto_editorial_generated':
      return 'Auto Editorial Generated';
    case 'auto_editorial_updated':
      return 'Auto Editorial Updated';
    case 'auto_editorial_posted':
      return 'Auto Editorial Posted';
    case 'auto_editorial_failed':
      return 'Auto Editorial Failed';
    case 'auto_editorial_deleted':
      return 'Auto Editorial Deleted';
    default:
      return 'Design Activity';
  }
}

function activityDescription(activity: DesignStudioActivityRecord): string {
  const templateName = activity.details?.headerText || activity.details?.templateName || 'Untitled design';
  const sourceTitle = activity.details?.sourceTitle || 'Editorial item';

  switch (activity.type) {
    case 'templates_loaded': {
      const count = Number(activity.details?.count || 0);
      return `${count} template${count === 1 ? '' : 's'} loaded from ${activity.details?.source || 'storage'}`;
    }
    case 'design_render_queued':
      return activity.details?.status === 'rendering'
        ? `${templateName} is rendering in the background`
        : `${templateName} is queued for rendering`;
    case 'design_render_failed':
      return activity.details?.failureReason || `${templateName} failed to render`;
    case 'design_scheduled':
      return activity.details?.scheduleTime
        ? `Scheduled for ${new Date(activity.details.scheduleTime).toLocaleString()}`
        : `${templateName} was scheduled`;
    case 'design_published':
      return `${templateName}${activity.details?.platforms ? ` -> ${activity.details.platforms}` : ''}`;
    case 'auto_editorial_generated':
      return `${sourceTitle}${activity.details?.matchedKeyword ? ` | ${activity.details.matchedKeyword}` : ''}`;
    case 'auto_editorial_updated':
      return `${sourceTitle}${activity.details?.field ? ` | ${activity.details.field}` : ''}`;
    case 'auto_editorial_posted':
      return `${sourceTitle}${activity.details?.platforms ? ` -> ${activity.details.platforms}` : ''}`;
    case 'auto_editorial_failed':
      return sourceTitle;
    case 'auto_editorial_deleted':
      return sourceTitle;
    default:
      return templateName;
  }
}

function getLinkedRenderJobDismissals(
  activity: DesignStudioActivityRecord,
  manualRenderJobs: DesignStudioManualRenderJob[],
): string[] {
  if (activity.type !== 'design_rendered' && activity.type !== 'design_render_failed') {
    return [];
  }

  const renderJobId = activity.details?.renderJobId;
  const templateName = activity.details?.templateName;
  const activityCreatedAt = new Date(activity.createdAt).getTime();

  return manualRenderJobs
    .filter((job) => {
      if (renderJobId && job.id === renderJobId) {
        return true;
      }

      if (!templateName || job.templateName !== templateName) {
        return false;
      }

      const jobCreatedAt = new Date(job.createdAt).getTime();
      return Number.isNaN(activityCreatedAt)
        || Number.isNaN(jobCreatedAt)
        || jobCreatedAt <= activityCreatedAt;
    })
    .map((job) => `render-job-${job.id}`);
}

export function DesignStudioActivityPage({ onNavigate, previousPage }: DesignStudioActivityPageProps) {
  const cachedActivityState = (() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(DESIGN_STUDIO_ACTIVITY_CACHE_KEY);
      if (!raw) {
        return null;
      }
      const parsed: any = JSON.parse(raw);
      return {
        activities: Array.isArray(parsed.activities)
          ? parsed.activities.map(normalizeActivityRecord).filter((activity): activity is DesignStudioActivityRecord => Boolean(activity))
          : [],
        manualRenderJobs: Array.isArray(parsed.manualRenderJobs)
          ? parsed.manualRenderJobs.map(normalizeManualRenderJob).filter((job): job is DesignStudioManualRenderJob => Boolean(job))
          : [],
        designTemplates: Array.isArray(parsed.designTemplates)
          ? parsed.designTemplates.map((template: any) => asRecord(template)).filter((template: Record<string, any>) => typeof template.id === 'string')
          : [],
        templatePreviewUrls: asRecord(parsed.templatePreviewUrls),
        renderedDesigns: Array.isArray(parsed.renderedDesigns)
          ? parsed.renderedDesigns.map(normalizeRenderedDesignRecord).filter((design): design is DesignStudioRenderedDesignRecord => Boolean(design))
          : [],
        autoEditorials: Array.isArray(parsed.autoEditorials) ? parsed.autoEditorials : [],
      };
    } catch {
      return null;
    }
  })();
  const { settings } = useSettings();
  const { showUndo } = useUndo();
  const [activeTab, setActiveTab] = useState<DesignStudioActivityTab>(() => {
    if (typeof window === 'undefined') return 'manual';
    const savedTab = localStorage.getItem('designStudioActivityTab');
    return savedTab === 'auto' ? 'auto' : 'manual';
  });
  const [activities, setActivities] = useState<DesignStudioActivityRecord[]>(cachedActivityState?.activities || []);
  const [manualRenderJobs, setManualRenderJobs] = useState<DesignStudioManualRenderJob[]>(cachedActivityState?.manualRenderJobs || []);
  const [designTemplates, setDesignTemplates] = useState<DesignStudioTemplateRecord[]>(cachedActivityState?.designTemplates || []);
  const [templatePreviewUrls, setTemplatePreviewUrls] = useState<Record<string, string>>(cachedActivityState?.templatePreviewUrls || {});
  const [renderedDesigns, setRenderedDesigns] = useState<DesignStudioRenderedDesignRecord[]>(cachedActivityState?.renderedDesigns || []);
  const [autoEditorials, setAutoEditorials] = useState<DesignStudioAutoEditorialRecord[]>(cachedActivityState?.autoEditorials || []);
  const [isLoading, setIsLoading] = useState(!(cachedActivityState && (cachedActivityState.activities?.length || cachedActivityState.manualRenderJobs?.length)));
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [publishTarget, setPublishTarget] = useState<ActivityPublishTarget | null>(null);
  const [isPublishSheetOpen, setIsPublishSheetOpen] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [menuActivity, setMenuActivity] = useState<DesignStudioActivityRecord | null>(null);
  const [scheduleActivity, setScheduleActivity] = useState<DesignStudioActivityRecord | null>(null);
  const [isScheduleSheetOpen, setIsScheduleSheetOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
  const [scheduledTime, setScheduledTime] = useState(() => {
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    return nextHour.toTimeString().slice(0, 5);
  });
  const [renameActivity, setRenameActivity] = useState<DesignStudioActivityRecord | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenameSheetOpen, setIsRenameSheetOpen] = useState(false);
  const [cardEditor, setCardEditor] = useState<CardEditorState | null>(null);
  const [cardTextDraft, setCardTextDraft] = useState('');
  const [isSavingCardEdit, setIsSavingCardEdit] = useState(false);
  const [backgroundDraftUrl, setBackgroundDraftUrl] = useState('');
  const [isBackgroundDragging, setIsBackgroundDragging] = useState(false);
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState('');
  const [tmdbSearchResults, setTmdbSearchResults] = useState<DesignStudioTMDbSearchResult[]>([]);
  const [selectedTmdbResult, setSelectedTmdbResult] = useState<DesignStudioTMDbSearchResult | null>(null);
  const [tmdbImageAssets, setTmdbImageAssets] = useState<Array<DesignStudioTMDbImageAsset & { kind: 'backdrop' | 'poster' | 'logo' | 'profile' }>>([]);
  const [isSearchingTmdb, setIsSearchingTmdb] = useState(false);
  const [isLoadingTmdbImages, setIsLoadingTmdbImages] = useState(false);
  const [overlayDraft, setOverlayDraft] = useState({
    color: '#000000',
    opacity: 70,
    direction: 'bottom' as 'top' | 'bottom' | 'left' | 'right',
  });
  const [previewTarget, setPreviewTarget] = useState<ActivityPreviewTarget | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const pinchDistanceRef = useRef<number | null>(null);
  const previewOffsetRef = useRef({ x: 0, y: 0 });
  const previewZoomRef = useRef(1);
  const previewPanStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const previewLastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const previewTapStartRef = useRef<{ x: number; y: number } | null>(null);
  const backgroundFileInputRef = useRef<HTMLInputElement | null>(null);
  const [dismissedActivityIds, setDismissedActivityIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(DESIGN_STUDIO_ACTIVITY_DISMISSED_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const retentionHours = settings.designStudioActivityRetention || 24;
  const retentionMs = retentionHours * 60 * 60 * 1000;
  const logLevel = settings.designStudioLogLevel || 'standard';
  const hasActiveManualRender = manualRenderJobs.some((job) => job.status === 'queued' || job.status === 'rendering');

  const loadActivities = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsLoading(true);
    }
    try {
      const [response, renderJobs] = await Promise.all([
        apiClient.get<DesignStudioActivityRecord[]>('/api/design-studio/activity'),
        fetchDesignStudioRenderJobs(),
      ]);
      if (response.success && Array.isArray(response.data)) {
        setActivities(response.data.map(normalizeActivityRecord).filter((activity): activity is DesignStudioActivityRecord => Boolean(activity)));
      } else {
        setActivities([]);
      }
      setManualRenderJobs(renderJobs.map(normalizeManualRenderJob).filter((job): job is DesignStudioManualRenderJob => Boolean(job)));
      if (!silent || hasActiveManualRender) {
        const designStudioState = await fetchDesignStudioState();
        setDesignTemplates(designStudioState.templates || []);
        setTemplatePreviewUrls(
          Object.fromEntries(
            (designStudioState.templates || []).map((template) => [template.id, template.previewUrl]),
          ),
        );
        setRenderedDesigns((designStudioState.renderedDesigns || [])
          .map(normalizeRenderedDesignRecord)
          .filter((design): design is DesignStudioRenderedDesignRecord => Boolean(design)));
        setAutoEditorials(designStudioState.autoEditorials || []);
      }
    } catch (error) {
      console.error('Failed to fetch design studio activity:', error);
      if (!silent) {
        setActivities([]);
        setManualRenderJobs([]);
        setDesignTemplates([]);
        setTemplatePreviewUrls({});
        setRenderedDesigns([]);
        setAutoEditorials([]);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      void loadActivities({ silent: true });
    }, hasActiveManualRender ? 5000 : 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [hasActiveManualRender]);

  useEffect(() => {
    safeStorageSetItem('designStudioActivityTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    safeStorageSetItem(DESIGN_STUDIO_ACTIVITY_CACHE_KEY, JSON.stringify({
      activities: activities
        .map(normalizeActivityRecord)
        .filter((activity): activity is DesignStudioActivityRecord => Boolean(activity)),
      manualRenderJobs: manualRenderJobs
        .map(normalizeManualRenderJob)
        .filter((job): job is DesignStudioManualRenderJob => Boolean(job)),
      designTemplates: designTemplates.map(compactTemplateForCache),
      templatePreviewUrls,
      renderedDesigns: renderedDesigns.map(compactRenderedDesignForCache),
      autoEditorials,
    }));
  }, [activities, autoEditorials, designTemplates, manualRenderJobs, renderedDesigns, templatePreviewUrls]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    safeStorageSetItem(DESIGN_STUDIO_ACTIVITY_DISMISSED_KEY, JSON.stringify(dismissedActivityIds));
  }, [dismissedActivityIds]);

  const visibleActivities = useMemo(() => {
    const cutoff = Date.now() - retentionMs;
    const resolvedRenderJobIds = new Set(
      activities
        .filter((activity) => activity.type === 'design_rendered' || activity.type === 'design_render_failed')
        .map((activity) => activity.details?.renderJobId)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    );
    const isQueuedActivityResolved = (activity: DesignStudioActivityRecord) => {
      if (activity.type !== 'design_render_queued') {
        return false;
      }

      const renderJobId = activity.details?.renderJobId;
      const templateName = activity.details?.templateName;
      const queuedCreatedAt = new Date(activity.createdAt).getTime();

      return activities.some((candidate) => {
        if (candidate.type !== 'design_rendered' && candidate.type !== 'design_render_failed') {
          return false;
        }

        const candidateCreatedAt = new Date(candidate.createdAt).getTime();
        const resolvedAfterQueued = Number.isNaN(queuedCreatedAt)
          || Number.isNaN(candidateCreatedAt)
          || candidateCreatedAt >= queuedCreatedAt;

        if (!resolvedAfterQueued) {
          return false;
        }

        if (renderJobId && candidate.details?.renderJobId === renderJobId) {
          return true;
        }

        return !!templateName && candidate.details?.templateName === templateName;
      });
    };

    const manualRenderActivityRecords: DesignStudioActivityRecord[] = manualRenderJobs
      .filter((job) => (job.status === 'queued' || job.status === 'rendering') && !resolvedRenderJobIds.has(job.id))
      .filter((job) => {
        const jobCreatedAt = new Date(job.createdAt).getTime();
        return !activities.some((activity) => {
          if (activity.type === 'design_render_queued') {
            if (activity.details?.renderJobId && activity.details.renderJobId === job.id) {
              return true;
            }
            if (activity.details?.templateName !== job.templateName) {
              return false;
            }
            const activityCreatedAt = new Date(activity.createdAt).getTime();
            return !Number.isNaN(jobCreatedAt) && !Number.isNaN(activityCreatedAt) && activityCreatedAt >= jobCreatedAt;
          }

          if ((activity.type !== 'design_rendered' && activity.type !== 'design_render_failed')
            || activity.details?.templateName !== job.templateName) {
            return false;
          }

          const activityCreatedAt = new Date(activity.createdAt).getTime();
          return !Number.isNaN(jobCreatedAt) && !Number.isNaN(activityCreatedAt) && activityCreatedAt >= jobCreatedAt;
        });
      })
      .map((job) => ({
        id: `render-job-${job.id}`,
        type: 'design_render_queued',
        details: {
          templateName: job.templateName,
          status: job.status,
          outputUrl: job.outputUrl || undefined,
          previewUrl: job.outputUrl || templatePreviewUrls[job.templateId],
          renderJobId: job.id,
        },
        createdAt: job.createdAt,
      }));

    return [...manualRenderActivityRecords, ...activities]
      .filter((activity) => !dismissedActivityIds.includes(activity.id))
      .filter((activity) => {
        const timestamp = new Date(activity.createdAt).getTime();
        return Number.isNaN(timestamp) || timestamp >= cutoff;
      })
      .filter((activity) => !isQueuedActivityResolved(activity))
      .filter((activity) => {
        if (logLevel === 'minimal') return activity.type === 'design_published';
        if (logLevel === 'standard') {
          return activity.type === 'design_rendered'
            || activity.type === 'design_render_queued'
            || activity.type === 'design_published';
        }
        return true;
      })
      .filter((activity) => (
        activeTab === 'manual'
          ? MANUAL_ACTIVITY_TYPES.has(activity.type)
          : AUTO_ACTIVITY_TYPES.has(activity.type)
      ));
  }, [activeTab, activities, dismissedActivityIds, logLevel, manualRenderJobs, retentionMs, templatePreviewUrls]);

  useEffect(() => {
    const targetActivityId = window.localStorage.getItem(DASHBOARD_DESIGN_STUDIO_ACTIVITY_TARGET_STORAGE_KEY);
    if (!targetActivityId || !visibleActivities.some((activity) => activity.id === targetActivityId)) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const targetElement = document.getElementById(`design-studio-activity-card-${targetActivityId}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      window.localStorage.removeItem(DASHBOARD_DESIGN_STUDIO_ACTIVITY_TARGET_STORAGE_KEY);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [visibleActivities]);

  const selection = useBulkSelection(visibleActivities.map((activity) => activity.id));

  const summary = useMemo(() => ({
    total: visibleActivities.length,
    primary: activeTab === 'manual'
      ? visibleActivities.filter((activity) => activity.type === 'design_rendered').length
      : visibleActivities.filter((activity) => activity.type === 'auto_editorial_generated').length,
    secondary: activeTab === 'manual'
      ? visibleActivities.filter((activity) => activity.type === 'design_published').length
      : visibleActivities.filter((activity) => activity.type === 'auto_editorial_posted').length,
  }), [activeTab, visibleActivities]);

  const renderedDesignByOutputUrl = useMemo(
    () => new Map(renderedDesigns.map((renderedDesign) => [renderedDesign.outputUrl, renderedDesign])),
    [renderedDesigns],
  );
  const renderedDesignByOutputUrlNormalized = useMemo(
    () => new Map(renderedDesigns.map((renderedDesign) => [normalizeMediaKey(renderedDesign.outputUrl), renderedDesign])),
    [renderedDesigns],
  );
  const renderedDesignById = useMemo(
    () => new Map(renderedDesigns.map((renderedDesign) => [renderedDesign.id, renderedDesign])),
    [renderedDesigns],
  );
  const designTemplateById = useMemo(
    () => new Map(designTemplates.map((template) => [template.id, template])),
    [designTemplates],
  );
  const designTemplateByName = useMemo(
    () => new Map(designTemplates.map((template) => [template.name, template])),
    [designTemplates],
  );
  const renderJobById = useMemo(
    () => new Map(manualRenderJobs.map((job) => [job.id, job])),
    [manualRenderJobs],
  );
  const autoEditorialByImageUrl = useMemo(
    () => new Map(autoEditorials.map((editorial) => [editorial.renderedImage, editorial])),
    [autoEditorials],
  );
  const autoEditorialByImageUrlNormalized = useMemo(
    () => new Map(autoEditorials.map((editorial) => [normalizeMediaKey(editorial.renderedImage), editorial])),
    [autoEditorials],
  );
  const findAutoEditorialForActivity = (activity: DesignStudioActivityRecord) =>
    autoEditorials.find((editorial) => {
      if (activity.details.outputUrl && editorial.renderedImage === activity.details.outputUrl) {
        return true;
      }

      if (activity.details.previewUrl && editorial.renderedImage === activity.details.previewUrl) {
        return true;
      }

      return Boolean(activity.details.sourceTitle) && editorial.sourceTitle === activity.details.sourceTitle;
    });

  const buildManualEditData = (renderedDesign: DesignStudioRenderedDesignRecord): DesignData => ({
    headerText: String(renderedDesign.data?.headerText || ''),
    subtext: typeof renderedDesign.data?.subtext === 'string' ? renderedDesign.data.subtext : '',
    headerTextColor: renderedDesign.data?.headerTextColor || '#FFFFFF',
    subtextColor: renderedDesign.data?.subtextColor || '#000000',
    fontScale: typeof renderedDesign.data?.fontScale === 'number' ? renderedDesign.data.fontScale : 1,
    lineHeightMultiplier:
      typeof renderedDesign.data?.lineHeightMultiplier === 'number'
        ? renderedDesign.data.lineHeightMultiplier
        : 0.93,
    backgroundImage: renderedDesign.data?.backgroundImage || '',
    imageFocalPoint: renderedDesign.data?.imageFocalPoint || { x: 50, y: 50 },
    imageZoom: typeof renderedDesign.data?.imageZoom === 'number' ? renderedDesign.data.imageZoom : 1,
    overlayEnabled: renderedDesign.data?.overlayEnabled ?? true,
    overlayColor: renderedDesign.data?.overlayColor || '#000000',
    overlayOpacity: typeof renderedDesign.data?.overlayOpacity === 'number' ? renderedDesign.data.overlayOpacity : 70,
    gradientPosition: renderedDesign.data?.gradientPosition || 'top',
    templateVariant: renderedDesign.templateVariant || renderedDesign.data?.template_variant || 'bottom_center',
    fadeEnabled: renderedDesign.data?.fadeEnabled ?? true,
    fadeOpacity: typeof renderedDesign.data?.fadeOpacity === 'number' ? renderedDesign.data.fadeOpacity : 90,
    brandBlockMode: renderedDesign.data?.brandBlockMode || 'auto',
    caption: renderedDesign.caption,
    contentType: renderedDesign.contentType,
    exportFormat: renderedDesign.exportFormat,
  });

  const buildAutoEditData = (editorial: DesignStudioAutoEditorialRecord): DesignData => ({
    headerText: editorial.headerText || '',
    subtext: editorial.subheaderText || '',
    headerTextColor: editorial.headerTextColor || '#FFFFFF',
    subtextColor: '#000000',
    fontScale: 1,
    lineHeightMultiplier: 0.93,
    backgroundImage: editorial.backgroundSource || editorial.renderedImage || '',
    imageFocalPoint: {
      x: typeof editorial.backgroundOffsetX === 'number' ? 50 + editorial.backgroundOffsetX : 50,
      y: typeof editorial.backgroundOffsetY === 'number' ? 50 + editorial.backgroundOffsetY : 50,
    },
    imageZoom: typeof editorial.zoomLevel === 'number' ? editorial.zoomLevel : 1,
    overlayEnabled: true,
    overlayColor: editorial.overlayColor || '#000000',
    overlayOpacity: typeof editorial.overlayStrength === 'number'
      ? Math.round(editorial.overlayStrength <= 1 ? editorial.overlayStrength * 100 : editorial.overlayStrength)
      : 70,
    gradientPosition: (editorial.overlayDirection as DesignData['gradientPosition']) || 'top',
    templateVariant: editorial.templateVariant || 'bottom_center',
    fadeEnabled: editorial.fadeEnabled ?? true,
    fadeOpacity: typeof editorial.fadeOpacity === 'number' ? editorial.fadeOpacity : 90,
    brandBlockMode: editorial.brandBlockMode || 'auto',
    caption: editorial.caption,
    contentType: editorial.contentType || 'announcement',
    exportFormat: 'jpeg',
  });

  const resolveActivityEditContext = (activity: DesignStudioActivityRecord) => {
    const autoEditorialFromActivity = findAutoEditorialForActivity(activity);
    const outputUrl = activity.details.outputUrl || activity.details.previewUrl || autoEditorialFromActivity?.renderedImage;
    const normalizedOutputUrl = normalizeMediaKey(outputUrl);
    const renderedDesign = outputUrl
      ? renderedDesignByOutputUrl.get(outputUrl)
        || renderedDesignByOutputUrlNormalized.get(normalizedOutputUrl)
        || (activity.details.designId ? renderedDesignById.get(activity.details.designId) : undefined)
      : activity.details.designId
        ? renderedDesignById.get(activity.details.designId)
        : undefined;
    const autoEditorial = outputUrl
      ? autoEditorialByImageUrl.get(outputUrl)
        || autoEditorialByImageUrlNormalized.get(normalizedOutputUrl)
        || autoEditorialFromActivity
      : autoEditorialFromActivity;
    const templateId = renderedDesign?.templateId
      || autoEditorial?.templateId
      || activity.details.designId
      || designTemplateByName.get(activity.details.templateName || '')?.id;
    const template = templateId ? designTemplateById.get(templateId) : undefined;
    const data = renderedDesign
      ? buildManualEditData(renderedDesign)
      : autoEditorial
        ? buildAutoEditData(autoEditorial)
        : null;

    return { autoEditorial, data, renderedDesign, template };
  };

  const buildRenderPayload = (data: DesignData) => ({
    template_variant: data.templateVariant,
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
    backgroundOffsetX: (data.imageFocalPoint?.x ?? 50) - 50,
    backgroundOffsetY: (data.imageFocalPoint?.y ?? 50) - 50,
    zoomLevel: data.imageZoom,
    overlayColor: data.overlayColor,
    overlayOpacity: data.overlayOpacity,
    overlayStrength: data.overlayOpacity,
    gradientPosition: data.gradientPosition,
    overlayDirection: data.gradientPosition,
    fadeEnabled: data.fadeEnabled,
    fadeOpacity: data.fadeOpacity,
    brandBlockMode: data.brandBlockMode,
    caption: data.caption,
    contentType: data.contentType,
    exportFormat: data.exportFormat,
  });

  const getActivitySourceContext = (
    activity: DesignStudioActivityRecord,
    autoEditorial?: DesignStudioAutoEditorialRecord | null,
    renderedDesign?: DesignStudioRenderedDesignRecord | null,
  ) => {
    const renderedData = asRecord(renderedDesign?.data);
    const sourceHeadline =
      activity.details.sourceHeadline
      || autoEditorial?.sourceTitle
      || activity.details.sourceTitle
      || (typeof renderedData.sourceHeadline === 'string' ? renderedData.sourceHeadline : '')
      || (typeof renderedData.sourceTitle === 'string' ? renderedData.sourceTitle : '')
      || '';
    const sourceSummary =
      activity.details.sourceSummary
      || (typeof renderedData.sourceSummary === 'string' ? renderedData.sourceSummary : '')
      || (typeof renderedData.sourceDescription === 'string' ? renderedData.sourceDescription : '')
      || '';
    const sourceUrl =
      activity.details.sourceUrl
      || autoEditorial?.sourceUrl
      || (typeof renderedData.sourceUrl === 'string' ? renderedData.sourceUrl : '')
      || '';
    const sourceName =
      activity.details.sourceName
      || autoEditorial?.sourceFeedName
      || (typeof renderedData.sourceName === 'string' ? renderedData.sourceName : '')
      || '';

    return { sourceHeadline, sourceSummary, sourceUrl, sourceName };
  };

  const buildFallbackEditData = (activity: DesignStudioActivityRecord, autoEditorial?: DesignStudioAutoEditorialRecord | null): DesignData => ({
    headerText: activity.details.headerText || autoEditorial?.headerText || activity.details.templateName || '',
    subtext: autoEditorial?.subheaderText || '',
    headerTextColor: autoEditorial?.headerTextColor || '#FFFFFF',
    subtextColor: '#000000',
    fontScale: 1,
    lineHeightMultiplier: 0.93,
    backgroundImage: autoEditorial?.backgroundSource || getActivityImageUrl(activity),
    imageFocalPoint: {
      x: typeof autoEditorial?.backgroundOffsetX === 'number' ? 50 + autoEditorial.backgroundOffsetX : 50,
      y: typeof autoEditorial?.backgroundOffsetY === 'number' ? 50 + autoEditorial.backgroundOffsetY : 50,
    },
    imageZoom: typeof autoEditorial?.zoomLevel === 'number' ? autoEditorial.zoomLevel : 1,
    overlayEnabled: true,
    overlayColor: activity.details.overlayColor || autoEditorial?.overlayColor || '#000000',
    overlayOpacity: typeof activity.details.overlayStrength === 'number'
      ? activity.details.overlayStrength
      : typeof autoEditorial?.overlayStrength === 'number'
        ? Math.round(autoEditorial.overlayStrength <= 1 ? autoEditorial.overlayStrength * 100 : autoEditorial.overlayStrength)
        : 70,
    gradientPosition: ((activity.details.overlayDirection || autoEditorial?.overlayDirection || 'bottom') as DesignData['gradientPosition']),
    templateVariant: autoEditorial?.templateVariant || 'bottom_center',
    fadeEnabled: autoEditorial?.fadeEnabled ?? true,
    fadeOpacity: typeof autoEditorial?.fadeOpacity === 'number' ? autoEditorial.fadeOpacity : 90,
    brandBlockMode: autoEditorial?.brandBlockMode || 'auto',
    caption: autoEditorial?.caption || '',
    contentType: autoEditorial?.contentType || 'announcement',
    exportFormat: 'jpeg',
  });

  const persistCardEdit = async (
    activity: DesignStudioActivityRecord,
    nextData: DesignData,
    fieldLabel: string,
  ) => {
    const { autoEditorial, template } = resolveActivityEditContext(activity);

    if (!template) {
      const response = await apiClient.put(`/api/design-studio/activity/${activity.id}`, {
        details: {
          ...activity.details,
          headerText: nextData.headerText,
          backgroundImage: nextData.backgroundImage,
          overlayColor: nextData.overlayColor,
          overlayStrength: nextData.overlayOpacity,
          overlayDirection: nextData.gradientPosition,
        },
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to save design edit');
      }
      return;
    }

    const sourceContext = getActivitySourceContext(activity, autoEditorial, null);
    await startDesignStudioManualRender({
      template,
      data: {
        ...buildRenderPayload(nextData),
        sourceHeadline: sourceContext.sourceHeadline || undefined,
        sourceSummary: sourceContext.sourceSummary || undefined,
        sourceUrl: sourceContext.sourceUrl || undefined,
        sourceName: sourceContext.sourceName || undefined,
      },
    });

    if (autoEditorial) {
      const nextAutoEditorials = autoEditorials.map((editorial) => (
        editorial.id === autoEditorial.id
          ? {
              ...editorial,
              headerText: nextData.headerText,
              subheaderText: nextData.subtext,
              caption: nextData.caption || editorial.caption,
              backgroundSource: nextData.backgroundImage || editorial.backgroundSource,
              backgroundOffsetX: (nextData.imageFocalPoint?.x ?? 50) - 50,
              backgroundOffsetY: (nextData.imageFocalPoint?.y ?? 50) - 50,
              zoomLevel: nextData.imageZoom,
              overlayColor: nextData.overlayColor,
              overlayDirection: nextData.gradientPosition,
              overlayStrength: nextData.overlayOpacity,
              updatedAt: new Date().toISOString(),
            }
          : editorial
      ));
      setAutoEditorials(nextAutoEditorials);
      await saveDesignStudioState({
        templates: designTemplates,
        renderedDesigns,
        autoEditorials: nextAutoEditorials,
      });
    }

    await createDesignStudioActivity('auto_editorial_updated', {
      ...activity.details,
      headerText: nextData.headerText,
      sourceTitle: autoEditorial?.sourceTitle || activity.details.sourceTitle,
      previewUrl: activity.details.previewUrl,
      outputUrl: activity.details.outputUrl,
      field: fieldLabel,
    });
  };

  const openCardEditor = (activity: DesignStudioActivityRecord, mode: CardEditorMode) => {
    const { autoEditorial, data, renderedDesign } = resolveActivityEditContext(activity);
    const nextData = data || buildFallbackEditData(activity, autoEditorial);
    const sourceContext = getActivitySourceContext(activity, autoEditorial, renderedDesign);
    const sourceDrivenDraft = [sourceContext.sourceHeadline, sourceContext.sourceSummary].filter(Boolean).join('\n\n');
    const existingCaption = (nextData.caption || autoEditorial?.caption || '').trim();
    const existingIsHeadlineOnly =
      existingCaption.length > 0 &&
      existingCaption.toLowerCase() === (nextData.headerText || activity.details.headerText || '').trim().toLowerCase();
    const captionDraft = existingCaption && !existingIsHeadlineOnly
      ? existingCaption
      : sourceDrivenDraft || existingCaption || activity.details.headerText || '';

    setCardEditor({ activity, mode });
    setCardTextDraft(
      mode === 'caption'
        ? captionDraft
        : mode === 'header'
          ? nextData.headerText || ''
          : nextData.subtext || '',
    );
    setBackgroundDraftUrl(nextData.backgroundImage || getActivityImageUrl(activity));
    setOverlayDraft({
      color: nextData.overlayColor || '#000000',
      opacity: typeof nextData.overlayOpacity === 'number' ? nextData.overlayOpacity : 70,
      direction: ((nextData.gradientPosition || 'bottom') as 'top' | 'bottom' | 'left' | 'right'),
    });
    setTmdbSearchQuery(autoEditorial?.sourceTitle || activity.details.sourceTitle || activity.details.headerText || '');
    setTmdbSearchResults([]);
    setSelectedTmdbResult(null);
    setTmdbImageAssets([]);
  };

  const closeCardEditor = () => {
    if (isSavingCardEdit) return;
    setCardEditor(null);
    setSelectedTmdbResult(null);
    setTmdbSearchResults([]);
    setTmdbImageAssets([]);
  };

  const handleSaveCardTextEdit = async () => {
    if (!cardEditor || (cardEditor.mode !== 'caption' && cardEditor.mode !== 'header' && cardEditor.mode !== 'subtext')) {
      return;
    }

    const { activity, mode } = cardEditor;
    const { data, autoEditorial } = resolveActivityEditContext(activity);
    const baseData = data || buildFallbackEditData(activity, autoEditorial);
    const value = cardTextDraft.trim();
    if (!value && mode !== 'subtext') {
      toast.error(mode === 'caption' ? 'Enter a caption first' : 'Enter header text first');
      return;
    }

    const nextData: DesignData = {
      ...baseData,
      caption: mode === 'caption' ? value : baseData.caption,
      headerText: mode === 'header' ? value : baseData.headerText,
      subtext: mode === 'subtext' ? value : baseData.subtext,
    };

    setIsSavingCardEdit(true);
    try {
      await persistCardEdit(activity, nextData, mode === 'caption' ? 'caption' : mode === 'header' ? 'header' : 'subtext');
      setActivities((current) => current.map((entry) => (
        entry.id === activity.id
          ? {
              ...entry,
              details: {
                ...entry.details,
                headerText: nextData.headerText,
              },
            }
          : entry
      )));
      haptics.success();
      toast.success(mode === 'caption' ? 'Caption saved' : 'Render queued with updated text');
      setCardEditor(null);
      await loadActivities({ silent: true });
    } catch (error) {
      console.error('Failed to save Design Studio card edit:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save edit');
    } finally {
      setIsSavingCardEdit(false);
    }
  };

  const handleDesignBackgroundFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setIsSavingCardEdit(true);
    try {
      const uploaded = await uploadDesignStudioAsset(file, 'renders');
      setBackgroundDraftUrl(uploaded.url);
      haptics.success();
      toast.success('Image uploaded and ready to save');
    } catch (error) {
      console.error('Failed to upload Design Studio background:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setIsSavingCardEdit(false);
    }
  };

  const handleSearchBackgroundImages = async () => {
    const query = tmdbSearchQuery.trim();
    if (!query) {
      toast.error('Enter a title, logo, or person to search');
      return;
    }

    setIsSearchingTmdb(true);
    setSelectedTmdbResult(null);
    setTmdbImageAssets([]);
    try {
      const results = await searchDesignStudioTMDb(query);
      setTmdbSearchResults(results);
      if (results.length === 0) {
        toast.message('No TMDb results found');
      }
    } catch (error) {
      console.error('Failed to search TMDb for Design Studio background:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to search images');
    } finally {
      setIsSearchingTmdb(false);
    }
  };

  const handleGenerateCardCaption = async () => {
    if (!cardEditor) return;
    const { autoEditorial, renderedDesign, data } = resolveActivityEditContext(cardEditor.activity);
    const sourceContext = getActivitySourceContext(cardEditor.activity, autoEditorial, renderedDesign);
    setIsGeneratingCaption(true);
    try {
      const result = await generateDesignStudioCaption({
        title: data?.headerText || autoEditorial?.headerText || cardEditor.activity.details.headerText || cardEditor.activity.details.templateName || 'Rendered Design',
        contentType: data?.contentType || autoEditorial?.contentType || 'announcement',
        tagline: sourceContext.sourceHeadline || autoEditorial?.sourceTitle || cardEditor.activity.details.sourceTitle,
        context: [sourceContext.sourceSummary, autoEditorial?.subheaderText, sourceContext.sourceUrl].filter(Boolean).join(' | '),
      }, settings);
      setCardTextDraft(result.caption);
      haptics.success();
      toast.success('Caption regenerated');
    } catch (error) {
      console.error('Failed to regenerate Design Studio card caption:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to regenerate caption');
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleSelectBackgroundSearchResult = async (result: DesignStudioTMDbSearchResult) => {
    setSelectedTmdbResult(result);
    setIsLoadingTmdbImages(true);
    try {
      const pool = await fetchDesignStudioTMDbImages(result.mediaType, result.id);
      const assets = toBackgroundImagePoolList(pool, result.mediaType);
      setTmdbImageAssets(assets);
      if (assets.length === 0) {
        toast.message('No image assets found for this result');
      }
    } catch (error) {
      console.error('Failed to fetch TMDb image assets:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch images');
    } finally {
      setIsLoadingTmdbImages(false);
    }
  };

  const handleSaveBackgroundEdit = async () => {
    if (!cardEditor || cardEditor.mode !== 'background') return;
    const { activity } = cardEditor;
    const { data, autoEditorial } = resolveActivityEditContext(activity);
    const baseData = data || buildFallbackEditData(activity, autoEditorial);
    if (!backgroundDraftUrl) {
      toast.error('Choose or upload a background first');
      return;
    }

    setIsSavingCardEdit(true);
    try {
      await persistCardEdit(activity, {
        ...baseData,
        backgroundImage: backgroundDraftUrl,
      }, 'background');
      haptics.success();
      toast.success('Background saved and render queued');
      setCardEditor(null);
      await loadActivities({ silent: true });
    } catch (error) {
      console.error('Failed to save Design Studio background:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save background');
    } finally {
      setIsSavingCardEdit(false);
    }
  };

  const handleSaveOverlayEdit = async () => {
    if (!cardEditor || cardEditor.mode !== 'overlay') return;
    const { activity } = cardEditor;
    const { data, autoEditorial } = resolveActivityEditContext(activity);
    const baseData = data || buildFallbackEditData(activity, autoEditorial);

    setIsSavingCardEdit(true);
    try {
      await persistCardEdit(activity, {
        ...baseData,
        overlayColor: overlayDraft.color,
        overlayOpacity: overlayDraft.opacity,
        gradientPosition: overlayDraft.direction,
      }, 'overlay');
      haptics.success();
      toast.success('Overlay saved and render queued');
      setCardEditor(null);
      await loadActivities({ silent: true });
    } catch (error) {
      console.error('Failed to save Design Studio overlay:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save overlay');
    } finally {
      setIsSavingCardEdit(false);
    }
  };

  const openEditorTarget = (target: DesignStudioEditorTarget) => {
    if (typeof window !== 'undefined') {
      safeStorageSetItem(DESIGN_STUDIO_EDITOR_TARGET_KEY, JSON.stringify(target));
      safeStorageSetItem('designStudioActiveTab', target.tab === 'auto' ? 'auto' : 'manual');
      window.dispatchEvent(new CustomEvent('screndly:design-studio-edit-target', { detail: target }));
    }
    onNavigate('design-studio');
  };

  const getActivityDownloadUrl = (activity: DesignStudioActivityRecord) => {
    const autoEditorial = findAutoEditorialForActivity(activity);
    const mediaUrl = activity.details.previewUrl || activity.details.outputUrl || autoEditorial?.renderedImage;
    return buildDesignStudioMediaStreamUrl(mediaUrl) || mediaUrl || '';
  };

  const getActivityImageUrl = (activity: DesignStudioActivityRecord) => {
    const autoEditorial = findAutoEditorialForActivity(activity);
    return activity.details.previewUrl || activity.details.outputUrl || autoEditorial?.renderedImage || '';
  };

  const handleDownload = async (activity: DesignStudioActivityRecord) => {
    const downloadUrl = getActivityDownloadUrl(activity);
    if (!downloadUrl) {
      toast.error('No rendered image available to download');
      return;
    }

    try {
      const extension = activity.details.exportFormat === 'png' ? 'png' : 'jpg';
      const safeName = (activity.details.headerText || activity.details.templateName || 'design-render')
        .replace(/[^a-z0-9-_]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'design-render';

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download rendered image (${response.status})`);
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${safeName}.${extension}`;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      toast.success('Rendered image downloaded');
    } catch (error) {
      console.error('Failed to download rendered image:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to download rendered image');
    }
  };

  const handleOpenPublish = (activity: DesignStudioActivityRecord) => {
    const autoEditorial = findAutoEditorialForActivity(activity);
    const outputUrl = activity.details.outputUrl || activity.details.previewUrl || autoEditorial?.renderedImage;
    if (!outputUrl) {
      toast.error('No rendered image available to publish');
      return;
    }

    const renderedDesign = renderedDesignByOutputUrl.get(outputUrl)
      || renderedDesignByOutputUrlNormalized.get(normalizeMediaKey(outputUrl))
      || (activity.details.designId ? renderedDesignById.get(activity.details.designId) : undefined);
    const resolvedAutoEditorial = autoEditorialByImageUrl.get(outputUrl)
      || autoEditorialByImageUrlNormalized.get(normalizeMediaKey(outputUrl))
      || autoEditorial;
    const resolvedTitle = renderedDesign?.data?.headerText
      || activity.details.headerText
      || resolvedAutoEditorial?.headerText
      || resolvedAutoEditorial?.sourceTitle
      || activity.details.sourceTitle
      || activity.details.templateName
      || 'Rendered Design';

    setPublishTarget({
      activityId: activity.id,
      title: resolvedTitle,
      outputUrl,
      caption: resolvedAutoEditorial?.caption || renderedDesign?.caption,
      contentType: resolvedAutoEditorial
        ? 'announcement'
        : renderedDesign?.contentType,
      context: resolvedAutoEditorial?.subheaderText
        || renderedDesign?.data?.subtext
        || renderedDesign?.templateName
        || activity.details.templateName,
      sourceTitle: resolvedAutoEditorial?.sourceTitle || activity.details.sourceTitle,
      matchedKeyword: resolvedAutoEditorial?.matchedKeyword || activity.details.matchedKeyword,
      isAutoEditorial: Boolean(resolvedAutoEditorial),
    });
    setIsPublishSheetOpen(true);
  };

  const openOptionsMenu = (activity: DesignStudioActivityRecord) => {
    haptics.light();
    setMenuActivity(activity);
  };

  const closeMenuThen = (action: () => void) => {
    setMenuActivity(null);
    window.setTimeout(action, 120);
  };

  const openScheduleSheet = (activity: DesignStudioActivityRecord) => {
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    setScheduledDate(nextHour);
    setScheduledTime(nextHour.toTimeString().slice(0, 5));
    setScheduleActivity(activity);
    setIsScheduleSheetOpen(true);
  };

  const openPreview = (activity: DesignStudioActivityRecord) => {
    const imageUrl = getActivityImageUrl(activity);
    if (!imageUrl) {
      return;
    }
    setPreviewTarget({
      title: activity.details.headerText || activity.details.templateName || 'Rendered Design',
      imageUrl,
    });
    setPreviewZoom(1);
    setPreviewOffset({ x: 0, y: 0 });
  };

  const handleEditActivity = (activity: DesignStudioActivityRecord) => {
    const autoEditorialFromActivity = findAutoEditorialForActivity(activity);
    const outputUrl = activity.details.outputUrl || activity.details.previewUrl || autoEditorialFromActivity?.renderedImage;
    const normalizedOutputUrl = normalizeMediaKey(outputUrl);
    const matchedRenderJob = activity.details.renderJobId
      ? renderJobById.get(activity.details.renderJobId)
      : manualRenderJobs.find((job) => job.templateName === activity.details.templateName);
    const renderedDesign = outputUrl
      ? renderedDesignByOutputUrl.get(outputUrl)
        || renderedDesignByOutputUrlNormalized.get(normalizedOutputUrl)
        || (activity.details.designId ? renderedDesignById.get(activity.details.designId) : undefined)
      : activity.details.designId
        ? renderedDesignById.get(activity.details.designId)
        : undefined;
    const autoEditorial = outputUrl
      ? autoEditorialByImageUrl.get(outputUrl)
        || autoEditorialByImageUrlNormalized.get(normalizedOutputUrl)
        || autoEditorialFromActivity
      : autoEditorialFromActivity;

    if (renderedDesign) {
      openEditorTarget({
        templateId: renderedDesign.templateId,
        tab: 'manual',
        initialData: buildManualEditData(renderedDesign),
      });
      return;
    }

    if (autoEditorial) {
      openEditorTarget({
        templateId: autoEditorial.templateId,
        tab: 'auto',
        initialData: buildAutoEditData(autoEditorial),
      });
      return;
    }

    const fallbackTemplateId = matchedRenderJob?.templateId
      || designTemplateByName.get(activity.details.templateName || '')?.id
      || (activity.details.designId ? designTemplateById.get(activity.details.designId)?.id : undefined);

    if (fallbackTemplateId) {
      openEditorTarget({
        templateId: fallbackTemplateId,
        tab: 'manual',
        initialData: null,
      });
      return;
    }

    toast.error('No editable design configuration was found for this item');
  };

  useEffect(() => {
    previewOffsetRef.current = previewOffset;
  }, [previewOffset]);

  useEffect(() => {
    previewZoomRef.current = previewZoom;
  }, [previewZoom]);

  const clampPreviewOffset = (offset: { x: number; y: number }, zoom: number) => {
    const viewport = previewViewportRef.current;
    const image = previewImageRef.current;
    if (!viewport || !image || zoom <= 1) {
      return { x: 0, y: 0 };
    }

    const maxX = Math.max(0, ((image.clientWidth || viewport.clientWidth) * (zoom - 1)) / 2);
    const maxY = Math.max(0, ((image.clientHeight || viewport.clientHeight) * (zoom - 1)) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, offset.x)),
      y: Math.min(maxY, Math.max(-maxY, offset.y)),
    };
  };

  const applyPreviewZoom = (nextZoom: number, nextOffset = previewOffsetRef.current) => {
    const clampedZoom = Math.max(1, Math.min(4, nextZoom));
    const clampedOffset = clampPreviewOffset(nextOffset, clampedZoom);
    previewZoomRef.current = clampedZoom;
    previewOffsetRef.current = clampedOffset;
    setPreviewZoom(clampedZoom);
    setPreviewOffset(clampedOffset);
  };

  const togglePreviewZoom = () => {
    const nextZoom = previewZoomRef.current > 1 ? 1 : 2;
    applyPreviewZoom(nextZoom, { x: 0, y: 0 });
  };

  const handleSaveSchedule = async () => {
    if (!scheduleActivity || !scheduledDate || !scheduledTime) {
      toast.error('Choose a date and time first');
      return;
    }

    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const scheduledAt = new Date(scheduledDate);
    scheduledAt.setHours(hours || 0, minutes || 0, 0, 0);

    if (scheduledAt.getTime() <= Date.now()) {
      toast.error('Choose a future date and time');
      return;
    }

    try {
      await createDesignStudioActivity('design_scheduled', {
        templateName: scheduleActivity.details.templateName,
        headerText: scheduleActivity.details.headerText,
        previewUrl: scheduleActivity.details.previewUrl,
        outputUrl: scheduleActivity.details.outputUrl,
        exportFormat: scheduleActivity.details.exportFormat,
        scheduleTime: scheduledAt.toISOString(),
      });

      toast.success(`Scheduled for ${scheduledAt.toLocaleString()}`);
      setIsScheduleSheetOpen(false);
      setScheduleActivity(null);
      await loadActivities({ silent: true });
    } catch (error) {
      console.error('Failed to save schedule:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save schedule');
    }
  };

  const handleRename = async () => {
    if (!renameActivity) {
      return;
    }

    const nextTitle = renameValue.trim();
    if (!nextTitle) {
      toast.error('Enter a new name first');
      return;
    }

    try {
      const response = await apiClient.put(`/api/design-studio/activity/${renameActivity.id}`, {
        details: {
          ...renameActivity.details,
          headerText: nextTitle,
        },
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to rename rendered image');
      }

      setActivities((current) => current.map((activity) => (
        activity.id === renameActivity.id
          ? { ...activity, details: { ...activity.details, headerText: nextTitle } }
          : activity
      )));
      toast.success('Rendered image renamed');
      setIsRenameSheetOpen(false);
      setRenameActivity(null);
    } catch (error) {
      console.error('Failed to rename rendered image:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rename rendered image');
    }
  };

  const handlePreviewTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      previewTapStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
      if (previewZoomRef.current > 1) {
        previewPanStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          offsetX: previewOffsetRef.current.x,
          offsetY: previewOffsetRef.current.y,
        };
      } else {
        previewPanStartRef.current = null;
      }
      pinchDistanceRef.current = null;
      return;
    }

    if (event.touches.length !== 2) {
      pinchDistanceRef.current = null;
      previewPanStartRef.current = null;
      previewTapStartRef.current = null;
      return;
    }

    const firstTouch = event.touches[0];
    const secondTouch = event.touches[1];
    previewPanStartRef.current = null;
    previewTapStartRef.current = null;
    pinchDistanceRef.current = Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    );
  };

  const handlePreviewTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 1 && previewTapStartRef.current) {
      const touch = event.touches[0];
      const movedX = Math.abs(touch.clientX - previewTapStartRef.current.x);
      const movedY = Math.abs(touch.clientY - previewTapStartRef.current.y);
      if (movedX > PREVIEW_TAP_MOVE_TOLERANCE || movedY > PREVIEW_TAP_MOVE_TOLERANCE) {
        previewTapStartRef.current = null;
      }
    }

    if (event.touches.length === 1 && previewPanStartRef.current && previewZoomRef.current > 1) {
      const touch = event.touches[0];
      const deltaX = touch.clientX - previewPanStartRef.current.x;
      const deltaY = touch.clientY - previewPanStartRef.current.y;

      if (
        Math.abs(deltaX) <= PREVIEW_PAN_START_TOLERANCE &&
        Math.abs(deltaY) <= PREVIEW_PAN_START_TOLERANCE &&
        previewTapStartRef.current
      ) {
        return;
      }

      previewTapStartRef.current = null;
      event.preventDefault();
      const nextOffset = clampPreviewOffset({
        x: previewPanStartRef.current.offsetX + deltaX,
        y: previewPanStartRef.current.offsetY + deltaY,
      }, previewZoomRef.current);
      previewOffsetRef.current = nextOffset;
      setPreviewOffset(nextOffset);
      return;
    }

    if (event.touches.length !== 2 || pinchDistanceRef.current == null) {
      return;
    }

    event.preventDefault();
    const firstTouch = event.touches[0];
    const secondTouch = event.touches[1];
    const nextDistance = Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    );

    const scaleRatio = nextDistance / pinchDistanceRef.current;
    pinchDistanceRef.current = nextDistance;
    applyPreviewZoom(previewZoomRef.current * scaleRatio);
  };

  const handlePreviewTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    const tapStart = previewTapStartRef.current;
    const changedTouch = event.changedTouches[0];
    if (tapStart && changedTouch) {
      const now = Date.now();
      const tapX = changedTouch.clientX;
      const tapY = changedTouch.clientY;
      const lastTap = previewLastTapRef.current;
      if (
        lastTap &&
        now - lastTap.time <= 300 &&
        Math.abs(lastTap.x - tapX) <= PREVIEW_DOUBLE_TAP_PROXIMITY &&
        Math.abs(lastTap.y - tapY) <= PREVIEW_DOUBLE_TAP_PROXIMITY
      ) {
        togglePreviewZoom();
        previewLastTapRef.current = null;
      } else {
        previewLastTapRef.current = { time: now, x: tapX, y: tapY };
      }
    }
    previewTapStartRef.current = null;
    pinchDistanceRef.current = null;
    previewPanStartRef.current = null;
  };

  const handlePreviewTouchCancel = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    previewTapStartRef.current = null;
    pinchDistanceRef.current = null;
    previewPanStartRef.current = null;
  };

  const handlePreviewMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (previewZoom <= 1) {
      return;
    }

    event.preventDefault();
    previewPanStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: previewOffsetRef.current.x,
      offsetY: previewOffsetRef.current.y,
    };
  };

  const handlePreviewMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!previewPanStartRef.current || previewZoomRef.current <= 1) {
      return;
    }

    event.preventDefault();
    const nextOffset = clampPreviewOffset({
      x: previewPanStartRef.current.offsetX + (event.clientX - previewPanStartRef.current.x),
      y: previewPanStartRef.current.offsetY + (event.clientY - previewPanStartRef.current.y),
    }, previewZoomRef.current);
    previewOffsetRef.current = nextOffset;
    setPreviewOffset(nextOffset);
  };

  const handlePreviewMouseUp = () => {
    previewPanStartRef.current = null;
  };

  const handlePublish = async (caption: string, platforms: PlatformSelection) => {
    if (!publishTarget) {
      return;
    }

    haptics.medium();
    try {
      const result = await publishContent(platforms, {
        text: caption || publishTarget.title,
        title: publishTarget.title,
        imageUrl: publishTarget.outputUrl,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to publish rendered image');
      }

      const platformsList: string[] = [];
      if (platforms.x) platformsList.push('X');
      if (platforms.threads) platformsList.push('Threads');
      if (platforms.facebook) platformsList.push('Facebook');
      if (platforms.instagram) platformsList.push('Instagram');
      if (platforms.pinterest) platformsList.push('Pinterest');

      await apiClient.post('/api/design-studio/activity', {
        type: 'design_published',
        details: {
          templateName: publishTarget.title,
          designId: publishTarget.activityId,
          platforms: platformsList.join(', '),
        },
      });

      toast.success(`Published to ${platformsList.join(', ')}`);
      setIsPublishSheetOpen(false);
      setPublishTarget(null);
      await loadActivities({ silent: true });
    } catch (error) {
      console.error('Failed to publish rendered design:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to publish rendered design');
    }
  };

  const handleGenerateCaption = async () => {
    if (!publishTarget) {
      return '';
    }

    setIsGeneratingCaption(true);
    try {
      const result = await generateDesignStudioCaption({
        contentType: publishTarget.contentType || 'announcement',
        title: publishTarget.title,
        tagline: publishTarget.isAutoEditorial ? publishTarget.sourceTitle : undefined,
        releaseInfo: publishTarget.matchedKeyword,
        context: publishTarget.context,
      }, settings);
      return result.caption;
    } catch (error) {
      console.error('Failed to generate publish caption:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate caption');
      return publishTarget.caption || publishTarget.title;
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleDelete = async (id: string) => {
    haptics.medium();
    if (id.startsWith('render-job-')) {
      const deletedJob = manualRenderJobs.find((job) => `render-job-${job.id}` === id);
      const deletedIndex = manualRenderJobs.findIndex((job) => `render-job-${job.id}` === id);
      if (!deletedJob || deletedIndex === -1) {
        return;
      }

      setDismissedActivityIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setManualRenderJobs((prev) => prev.filter((job) => `render-job-${job.id}` !== id));

      showUndo({
        id,
        itemName: deletedJob.templateName || 'Queued design activity',
        onUndo: () => {
          setDismissedActivityIds((prev) => prev.filter((activityId) => activityId !== id));
          setManualRenderJobs((prev) => {
            if (prev.some((job) => job.id === deletedJob.id)) {
              return prev;
            }
            const next = [...prev];
            next.splice(Math.min(deletedIndex, next.length), 0, deletedJob);
            return next;
          });
        },
        onConfirm: async () => {
          toast.success('Activity deleted');
        },
      });
      return;
    }

    const deletedActivity = activities.find((activity) => activity.id === id);
    const deletedIndex = activities.findIndex((activity) => activity.id === id);
    if (!deletedActivity || deletedIndex === -1) return;
    const linkedRenderJobDismissals = getLinkedRenderJobDismissals(deletedActivity, manualRenderJobs);
    const dismissIds = [id, ...linkedRenderJobDismissals];

    setDismissedActivityIds((prev) => Array.from(new Set([...prev, ...dismissIds])));
    setActivities((prev) => prev.filter((activity) => activity.id !== id));

    showUndo({
      id,
      itemName: activityTitle(deletedActivity),
      onUndo: () => {
        setDismissedActivityIds((prev) => prev.filter((activityId) => !dismissIds.includes(activityId)));
        setActivities((prev) => {
          if (prev.some((activity) => activity.id === deletedActivity.id)) {
            return prev;
          }
          const next = [...prev];
          next.splice(Math.min(deletedIndex, next.length), 0, deletedActivity);
          return next;
        });
      },
      onConfirm: async () => {
        try {
          const response = await apiClient.delete(`/api/design-studio/activity/${id}`);
          if (!response.success) {
            throw new Error(response.error?.message || 'Failed to delete activity');
          }
          toast.success('Activity deleted');
        } catch (error) {
          console.error('Failed to delete design studio activity:', error);
          setDismissedActivityIds((prev) => prev.filter((activityId) => !dismissIds.includes(activityId)));
          setActivities((prev) => {
            if (prev.some((activity) => activity.id === deletedActivity.id)) {
              return prev;
            }
            const next = [...prev];
            next.splice(Math.min(deletedIndex, next.length), 0, deletedActivity);
            return next;
          });
          toast.error(error instanceof Error ? error.message : 'Failed to delete activity');
        }
      },
    });
  };

  const handleDeleteSelected = async () => {
    if (selection.selectedCount === 0) return;

    haptics.medium();
    setIsDeletingSelected(true);
    const selectedIdSet = new Set(selection.selectedIds);
    const syntheticIds = selection.selectedIds.filter((id) => id.startsWith('render-job-'));
    const persistedIds = selection.selectedIds.filter((id) => !id.startsWith('render-job-'));
    const linkedRenderJobDismissals = activities
      .filter((activity) => selectedIdSet.has(activity.id))
      .flatMap((activity) => getLinkedRenderJobDismissals(activity, manualRenderJobs));
    const allSyntheticDismissals = Array.from(new Set([...syntheticIds, ...linkedRenderJobDismissals]));

    try {
      if (allSyntheticDismissals.length > 0) {
        const syntheticIdSet = new Set(allSyntheticDismissals);
        setDismissedActivityIds((prev) => Array.from(new Set([...prev, ...allSyntheticDismissals])));
        setManualRenderJobs((prev) => prev.filter((job) => !syntheticIdSet.has(`render-job-${job.id}`)));
      }

      await Promise.all(
        persistedIds.map(async (id) => {
          const response = await apiClient.delete(`/api/design-studio/activity/${id}`);
          if (!response.success) {
            throw new Error(response.error?.message || 'Failed to delete selected activity');
          }
        })
      );
      setDismissedActivityIds((prev) => Array.from(new Set([...prev, ...persistedIds, ...allSyntheticDismissals])));
      setActivities((prev) => prev.filter((activity) => !selectedIdSet.has(activity.id)));
      toast.success(`${selection.selectedCount} design activity item${selection.selectedCount === 1 ? '' : 's'} deleted`);
      selection.clearSelection();
    } catch (error) {
      console.error('Failed to bulk delete design studio activity:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete selected activity');
      await loadActivities();
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'design_published':
        return <Send className="w-5 h-5 text-[#ec1e24]" />;
      case 'design_render_queued':
        return <LoaderCircle className="w-5 h-5 text-[#ec1e24] animate-spin" />;
      case 'design_render_failed':
        return <AlertCircle className="w-5 h-5 text-[#ec1e24]" />;
      case 'auto_editorial_generated':
      case 'auto_editorial_updated':
        return <ImageIcon className="w-5 h-5 text-[#ec1e24]" />;
      case 'auto_editorial_posted':
        return <Send className="w-5 h-5 text-[#ec1e24]" />;
      case 'auto_editorial_failed':
        return <AlertCircle className="w-5 h-5 text-[#ec1e24]" />;
      case 'auto_editorial_deleted':
        return <Clock3 className="w-5 h-5 text-[#ec1e24]" />;
      default:
        return <Calendar className="w-5 h-5 text-[#ec1e24]" />;
    }
  };

  const designStudioBackTarget =
    previousPage === 'design-studio' || previousPage === 'dashboard'
      ? previousPage
      : 'design-studio';

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000] pb-20 lg:pb-0">
      <div className="flex items-start gap-4">
        <BackIconButton
          onClick={() => onNavigate(designStudioBackTarget)}
          className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
        />
        <div>
          <h1 className="text-gray-900 dark:text-white mb-2">Design Studio Activity</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">
            {activeTab === 'manual'
              ? 'Track rendered, uploaded, and published manual design activity.'
              : 'Track generated, scheduled, posted, and failed auto editorial activity.'}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <SegmentedTabSwitcher
          tabs={[
            { id: 'manual', label: 'Manual' },
            { id: 'auto', label: 'Auto' },
          ]}
          activeTab={activeTab}
          onChange={(tab) => {
            haptics.light();
            setActiveTab(tab);
          }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <SummaryCard label="Total Activity" value={summary.total} />
        <SummaryCard
          label={activeTab === 'manual' ? 'Designs Rendered' : 'Auto Generated'}
          value={summary.primary}
        />
        <SummaryCard
          label={activeTab === 'manual' ? 'Designs Published' : 'Auto Posted'}
          value={summary.secondary}
        />
      </div>

      <div className="space-y-4 mt-6">
        {isLoading && visibleActivities.length > 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-[#333333] dark:bg-[#000000] dark:text-[#9CA3AF]">
            Refreshing activity...
          </div>
        ) : null}
        {isLoading && visibleActivities.length === 0 ? (
          <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-8 text-center">
            <p className="text-gray-600 dark:text-[#9CA3AF] mb-2">Loading Design Studio activity...</p>
            <p className="text-sm text-gray-500 dark:text-[#6B7280]">
              Recent renders, queued jobs, and auto editorial activity will appear here shortly.
            </p>
          </div>
        ) : visibleActivities.length === 0 ? (
          <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-12 text-center">
            <p className="text-gray-600 dark:text-[#9CA3AF] mb-2">
              {activeTab === 'manual' ? 'No manual design activity yet' : 'No auto editorial activity yet'}
            </p>
            <p className="text-sm text-gray-500 dark:text-[#6B7280]">
              {activeTab === 'manual'
                ? 'Rendered and published manual design events will appear here.'
                : 'Generated, queued, scheduled, posted, and failed auto editorials will appear here.'}
            </p>
          </div>
        ) : (
          <>
            {selection.selectionMode && (
              <ActivitySelectionToolbar
                selectedCount={selection.selectedCount}
                isDeleting={isDeletingSelected}
                allSelected={selection.allSelected}
                onSelectAll={selection.selectAll}
                onClear={selection.clearSelection}
                onDelete={handleDeleteSelected}
                itemLabel="activity items"
              />
            )}
            {visibleActivities.map((activity) => {
              const linkedAutoEditorial = findAutoEditorialForActivity(activity);
              const platformLabels = parseActivityPlatforms(activity, linkedAutoEditorial);
              const isAutoActivity = activity.type.startsWith('auto_editorial_');
              const hasRenderedActions = activity.type === 'design_rendered' || activity.type.startsWith('auto_editorial_');

              return (
              <div id={`design-studio-activity-card-${activity.id}`} key={activity.id}>
                <SwipeableActivityCard
                  id={activity.id}
                  onDelete={(id) => {
                    if (id) {
                      void handleDelete(id);
                    }
                  }}
                  selectionMode={selection.selectionMode}
                  selected={selection.isSelected(activity.id)}
                  onEnterSelectionMode={selection.enterSelectionMode}
                  onToggleSelection={selection.toggleSelection}
                  showHoverDelete={false}
                  className="p-4 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]"
                >
                {(activity.details?.previewUrl || activity.details?.outputUrl) ? (
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      onClick={() => openPreview(activity)}
                      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-[#050505] dark:border-[#333333]"
                    >
                      <img
                        src={getActivityImageUrl(activity)}
                        alt={activity.details.headerText || activity.details.templateName || 'Template preview'}
                        className="h-full w-full object-cover object-center"
                        loading="lazy"
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-gray-900 dark:text-white">{activityTitle(activity)}</p>
                          <p className="mt-1 line-clamp-3 text-sm leading-6 text-gray-600 dark:text-[#9CA3AF]">
                            {activityDescription(activity)}
                          </p>
                          {activity.details.exportFormat ? (
                            <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#6B7280] dark:text-[#9CA3AF]">
                              Export: {activity.details.exportFormat}
                            </p>
                          ) : null}
                          {platformLabels.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {platformLabels.map((platform) => (
                                <span
                                  key={platform}
                                  className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-700 shadow-sm dark:border-[#333333] dark:bg-[#111111] dark:text-[#D1D5DB]"
                                >
                                  {platform}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {!hasRenderedActions ? (
                            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 shadow-sm dark:border-[#333333] dark:bg-black dark:text-[#9CA3AF]">
                              <Clock3 className="h-3.5 w-3.5 text-[#ec1e24]" />
                              <span>{isAutoActivity ? 'Fetched' : 'Created'} {formatFetchedDateTime(activity.createdAt)}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {hasRenderedActions ? (
                        <div className="mt-4 border-t border-gray-200 pt-4 dark:border-[#333333]">
                          <div className="flex items-end justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <span className="text-sm text-gray-500 dark:text-[#8A8F98]">
                                Created:{' '}
                                <span className="text-gray-900 dark:text-white">
                                  {formatFetchedDateTime(activity.createdAt)}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                onClick={() => handleDelete(activity.id)}
                                className="hidden h-9 w-9 border border-gray-200 bg-transparent p-0 text-gray-900 opacity-0 transition-opacity hover:bg-gray-50 hover:text-[#ec1e24] group-hover:opacity-100 dark:border-[#333333] dark:bg-transparent dark:text-white dark:hover:bg-[#111111] lg:inline-flex"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                onClick={() => openOptionsMenu(activity)}
                                className="h-9 w-9 border border-gray-200 bg-transparent p-0 text-gray-900 shadow-none hover:bg-gray-50 dark:border-[#333333] dark:bg-transparent dark:text-white dark:hover:bg-[#111111]"
                              >
                                <MoreVertical className="h-3 w-3 text-gray-900 dark:text-white" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-1">{getIcon(activity.type)}</div>
                      <div className="min-w-0">
                        <p className="text-gray-900 dark:text-white">{activityTitle(activity)}</p>
                        <p className="text-sm text-gray-600 dark:text-[#9CA3AF] mt-1">{activityDescription(activity)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-[#6B7280] whitespace-nowrap">{formatTime(activity.createdAt)}</p>
                  </div>
                )}
                </SwipeableActivityCard>
              </div>
            );
            })}
          </>
        )}
      </div>

      {publishTarget ? (
        <PublishBottomSheet
          open={isPublishSheetOpen}
          onOpenChange={(open) => {
            setIsPublishSheetOpen(open);
            if (!open) {
              setPublishTarget(null);
            }
          }}
          title="Publish Rendered Design"
          description="Select platforms and add a caption for this rendered editorial"
          initialCaption={publishTarget.caption || publishTarget.title}
          onPublish={(caption, platforms) => void handlePublish(caption, platforms)}
          onCaptionGenerate={handleGenerateCaption}
          isGeneratingCaption={isGeneratingCaption}
          allowedPlatforms={['x', 'threads', 'facebook', 'instagram', 'pinterest']}
        />
      ) : null}

      <BottomSheet open={Boolean(menuActivity)} onOpenChange={(open) => !open && setMenuActivity(null)}>
        <BottomSheetHeader>
          <BottomSheetTitle>Rendered Design Options</BottomSheetTitle>
          <BottomSheetDescription>Choose what you want to do with this rendered image.</BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                if (!menuActivity) return;
                const current = menuActivity;
                closeMenuThen(() => openCardEditor(current, 'caption'));
              }}
              className={getActionButtonClass()}
            >
              Edit Caption
            </button>
            <button
              type="button"
              onClick={() => {
                if (!menuActivity) return;
                const current = menuActivity;
                closeMenuThen(() => openCardEditor(current, 'header'));
              }}
              className={getActionButtonClass()}
            >
              Edit Header
            </button>
            <button
              type="button"
              onClick={() => {
                if (!menuActivity) return;
                const current = menuActivity;
                closeMenuThen(() => openCardEditor(current, 'subtext'));
              }}
              className={getActionButtonClass()}
            >
              Edit Subtext
            </button>
            <button
              type="button"
              onClick={() => {
                if (!menuActivity) return;
                const current = menuActivity;
                closeMenuThen(() => openCardEditor(current, 'background'));
              }}
              className={getActionButtonClass()}
            >
              Change Background
            </button>
            <button
              type="button"
              onClick={() => {
                if (!menuActivity) return;
                const current = menuActivity;
                closeMenuThen(() => openCardEditor(current, 'overlay'));
              }}
              className={getActionButtonClass()}
            >
              Adjust Overlay
            </button>
            <button
              type="button"
              onClick={() => {
                if (!menuActivity) return;
                const current = menuActivity;
                closeMenuThen(() => handleEditActivity(current));
              }}
              className={getActionButtonClass()}
            >
              Change Template
            </button>
            <button
              type="button"
              onClick={() => {
                if (!menuActivity) return;
                const current = menuActivity;
                closeMenuThen(() => openScheduleSheet(current));
              }}
              className={getActionButtonClass()}
            >
              Edit Schedule
            </button>
            <button
              type="button"
              onClick={() => {
                if (!menuActivity) return;
                const current = menuActivity;
                closeMenuThen(() => handleOpenPublish(current));
              }}
              className={getActionButtonClass()}
            >
              Publish Now
            </button>
            <button
              type="button"
              onClick={() => {
                if (!menuActivity) return;
                const current = menuActivity;
                closeMenuThen(() => {
                  void handleDownload(current);
                });
              }}
              className={getActionButtonClass()}
            >
              Download
            </button>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setMenuActivity(null)}
            className="w-full border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
          >
            Cancel
          </Button>
        </BottomSheetFooter>
      </BottomSheet>

      <BottomSheet open={Boolean(cardEditor)} onOpenChange={(open) => !open && closeCardEditor()}>
        <BottomSheetHeader>
          <BottomSheetTitle>
            {cardEditor?.mode === 'caption'
              ? 'Edit Caption'
              : cardEditor?.mode === 'header'
                ? 'Edit Header'
                : cardEditor?.mode === 'subtext'
                  ? 'Edit Subtext'
                  : cardEditor?.mode === 'background'
                    ? 'Change Background'
                    : 'Adjust Overlay'}
          </BottomSheetTitle>
          <BottomSheetDescription>
            {cardEditor?.mode === 'background'
              ? 'Upload, drag, search, or pick a new visual. Saving queues a fresh render.'
              : cardEditor?.mode === 'overlay'
                ? 'Tune the overlay color, opacity, and direction for this render.'
                : 'Update the text and queue a fresh render for this design.'}
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          {(cardEditor?.mode === 'caption' || cardEditor?.mode === 'header' || cardEditor?.mode === 'subtext') ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#333333] dark:bg-black">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Label className="text-gray-900 dark:text-white">
                    {cardEditor.mode === 'caption' ? 'Social Caption' : cardEditor.mode === 'header' ? 'Header Text' : 'Subtext'}
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.light();
                      if (cardEditor.mode === 'caption') {
                        void handleGenerateCardCaption();
                      }
                    }}
                    disabled={cardEditor.mode !== 'caption' || isGeneratingCaption}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
                    aria-label="Regenerate caption"
                  >
                    {isGeneratingCaption ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </button>
                </div>
                <textarea
                  value={cardTextDraft}
                  onChange={(event) => {
                    haptics.light();
                    setCardTextDraft(event.target.value);
                  }}
                  rows={cardEditor.mode === 'caption' ? 6 : 5}
                  className="min-h-[150px] w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-900 outline-none transition-colors focus:border-[#ec1e24] dark:border-[#333333] dark:bg-black dark:text-white"
                  placeholder={cardEditor.mode === 'caption' ? 'Write the platform caption...' : 'Write the design text...'}
                />
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-[#6B7280]">
                  <span>{cardEditor.mode === 'caption' ? 'Use article title plus a short summary tone.' : 'This will re-render the image.'}</span>
                  <span>{cardTextDraft.length} chars</span>
                </div>
              </div>
            </div>
          ) : null}

          {cardEditor?.mode === 'background' ? (
            <div className="space-y-4">
              <input
                ref={backgroundFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void handleDesignBackgroundFile(event.target.files?.[0]);
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
                  void handleDesignBackgroundFile(event.dataTransfer.files?.[0]);
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
                    value={tmdbSearchQuery}
                    onChange={(event) => setTmdbSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleSearchBackgroundImages();
                      }
                    }}
                    placeholder="Search TMDb..."
                    className="bg-white text-gray-900 dark:bg-black dark:text-white"
                  />
                  <Button
                    type="button"
                    onClick={() => void handleSearchBackgroundImages()}
                    disabled={isSearchingTmdb}
                    className="rounded-full bg-[#ec1e24] text-white hover:bg-[#d01a20]"
                  >
                    {isSearchingTmdb ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>

                {selectedTmdbResult ? (
                  <div className="mt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedTmdbResult.title}</p>
                        <p className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-[#9CA3AF]">{selectedTmdbResult.mediaType}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTmdbResult(null);
                          setTmdbImageAssets([]);
                        }}
                        className="rounded-full px-3 py-1 text-xs text-[#ec1e24]"
                      >
                        Change
                      </button>
                    </div>
                    {isLoadingTmdbImages ? (
                      <p className="text-xs text-gray-500 dark:text-[#9CA3AF]">Loading images...</p>
                    ) : (
                      <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
                        {tmdbImageAssets.map((asset) => (
                          <button
                            key={`${asset.kind}-${asset.url}`}
                            type="button"
                            onClick={() => {
                              haptics.light();
                              setBackgroundDraftUrl(asset.url);
                            }}
                            className={`relative overflow-hidden rounded-xl border-2 transition-colors ${
                              backgroundDraftUrl === asset.url ? 'border-[#ec1e24]' : 'border-transparent hover:border-[#ec1e24]/70'
                            } ${asset.kind === 'backdrop' ? 'aspect-video' : 'aspect-[4/5]'}`}
                          >
                            <img src={asset.url} alt={`${selectedTmdbResult.title} ${asset.kind}`} className="h-full w-full object-cover" />
                            <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white">
                              {asset.kind}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : tmdbSearchResults.length > 0 ? (
                  <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                    {tmdbSearchResults.map((result) => {
                      const thumb = result.backdrop || result.poster || result.profile || '';
                      return (
                        <button
                          key={`${result.mediaType}-${result.id}`}
                          type="button"
                          onClick={() => void handleSelectBackgroundSearchResult(result)}
                          className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-[#ec1e24] dark:border-[#333333] dark:bg-black"
                        >
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#111111]">
                            {thumb ? <img src={thumb} alt={result.title} className="h-full w-full object-cover" /> : null}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{result.title}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-[#9CA3AF]">
                              {result.mediaType}{result.releaseDate ? ` | ${result.releaseDate.slice(0, 4)}` : ''}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              {backgroundDraftUrl ? (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-[#050505] dark:border-[#333333]">
                  <img src={backgroundDraftUrl} alt="Selected background preview" className="h-48 w-full object-cover" />
                </div>
              ) : null}
            </div>
          ) : null}

          {cardEditor?.mode === 'overlay' ? (
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#333333] dark:bg-black">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-gray-900 dark:text-white">Overlay Color</Label>
                  <span className="text-xs uppercase text-gray-500 dark:text-[#9CA3AF]">{overlayDraft.color}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={overlayDraft.color}
                    onChange={(event) => setOverlayDraft((current) => ({ ...current, color: event.target.value }))}
                    className="h-12 w-12 cursor-pointer rounded-full border border-gray-200 bg-transparent p-1 dark:border-[#333333]"
                    aria-label="Overlay color"
                  />
                  <Input
                    value={overlayDraft.color}
                    onChange={(event) => setOverlayDraft((current) => ({ ...current, color: event.target.value }))}
                    className="bg-white text-gray-900 uppercase dark:bg-black dark:text-white"
                    placeholder="#000000"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-gray-900 dark:text-white">Opacity</Label>
                  <span className="text-xs text-gray-500 dark:text-[#9CA3AF]">{overlayDraft.opacity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={overlayDraft.opacity}
                  onChange={(event) => setOverlayDraft((current) => ({ ...current, opacity: Number(event.target.value) }))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-[#ec1e24] dark:bg-[#333333]"
                />
              </div>

              <div>
                <Label className="mb-2 block text-gray-900 dark:text-white">Position</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['top', 'bottom', 'left', 'right'] as const).map((direction) => (
                    <button
                      key={direction}
                      type="button"
                      onClick={() => setOverlayDraft((current) => ({ ...current, direction }))}
                      className={`rounded-full border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                        overlayDraft.direction === direction
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
          ) : null}
        </BottomSheetBody>
        <BottomSheetFooter>
          <div className="flex w-full gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={closeCardEditor}
              disabled={isSavingCardEdit}
              className="flex-1 border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (cardEditor?.mode === 'background') {
                  void handleSaveBackgroundEdit();
                } else if (cardEditor?.mode === 'overlay') {
                  void handleSaveOverlayEdit();
                } else {
                  void handleSaveCardTextEdit();
                }
              }}
              disabled={isSavingCardEdit}
              className="flex-1 bg-[#ec1e24] text-white hover:bg-[#d01a20]"
            >
              {isSavingCardEdit ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      <BottomSheet open={isScheduleSheetOpen} onOpenChange={setIsScheduleSheetOpen}>
        <BottomSheetHeader>
          <BottomSheetTitle>Schedule Design</BottomSheetTitle>
          <BottomSheetDescription>Set the date and time for this rendered design.</BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <DatePicker
                date={scheduledDate}
                onDateChange={(date) => {
                  if (date) {
                    haptics.light();
                  }
                  setScheduledDate(date);
                }}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Time</Label>
              <TimePicker
                value={scheduledTime}
                onChange={(time) => {
                  haptics.light();
                  setScheduledTime(time);
                }}
                className="mt-2"
              />
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-[#333333] dark:bg-black">
              <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">
                Scheduled designs are saved into Design Studio activity with the chosen publish time.
              </p>
            </div>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <div className="flex w-full gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                haptics.light();
                setIsScheduleSheetOpen(false);
                setScheduleActivity(null);
              }}
              className="flex-1 border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveSchedule()}
              className="flex-1 bg-[#ec1e24] text-white hover:bg-[#d01a20]"
            >
              Schedule
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      <BottomSheet open={isRenameSheetOpen} onOpenChange={setIsRenameSheetOpen}>
        <BottomSheetHeader>
          <BottomSheetTitle>Rename Rendered Image</BottomSheetTitle>
          <BottomSheetDescription>Choose a new title for this rendered design.</BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={renameValue}
                onChange={(event) => {
                  haptics.light();
                  setRenameValue(event.target.value);
                }}
                placeholder="Enter a new title"
                className="mt-2 bg-white text-gray-900 dark:bg-[#000000] dark:text-white"
              />
            </div>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <div className="flex w-full gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                haptics.light();
                setIsRenameSheetOpen(false);
                setRenameActivity(null);
              }}
              className="flex-1 border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleRename()}
              className="flex-1 bg-[#ec1e24] text-white hover:bg-[#d01a20]"
            >
              Save
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      {previewTarget ? (
        <Dialog open={Boolean(previewTarget)} onOpenChange={(open) => !open && setPreviewTarget(null)}>
          <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none" hideCloseButton>
            <VisuallyHidden>
              <DialogTitle>{previewTarget.title}</DialogTitle>
              <DialogDescription>Expanded preview of the rendered design with zoom controls.</DialogDescription>
            </VisuallyHidden>
            <div className="relative rounded-2xl bg-black/95 p-4">
              <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => setPreviewTarget(null)}
                  className="h-10 w-10 rounded-full border border-white/20 bg-black/70 p-0 text-white hover:bg-black"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div
                ref={previewViewportRef}
                className="flex max-h-[85vh] min-h-[60vh] select-none items-center justify-center overflow-hidden"
                onTouchStart={handlePreviewTouchStart}
                onTouchMove={handlePreviewTouchMove}
                onTouchEnd={handlePreviewTouchEnd}
                onTouchCancel={handlePreviewTouchCancel}
                onMouseDown={handlePreviewMouseDown}
                onMouseMove={handlePreviewMouseMove}
                onMouseUp={handlePreviewMouseUp}
                onMouseLeave={handlePreviewMouseUp}
                style={{ touchAction: 'none' }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  togglePreviewZoom();
                }}
              >
                <img
                  ref={previewImageRef}
                  src={previewTarget.imageUrl}
                  alt={previewTarget.title}
                  draggable={false}
                  className="max-h-[78vh] w-auto max-w-full object-contain transition-transform duration-150"
                  style={{
                    transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewZoom})`,
                    transformOrigin: 'center center',
                    cursor: previewZoom > 1 ? 'grab' : 'default',
                    willChange: 'transform',
                  }}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
      <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-1">{label}</p>
      <p className="text-2xl text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
