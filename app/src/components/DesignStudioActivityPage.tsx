import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Calendar, Clock3, LoaderCircle, MoreVertical, Send, Trash2, X } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { apiClient } from '../lib/api/client';
import {
  createDesignStudioActivity,
  type DesignStudioAutoEditorialRecord,
  fetchDesignStudioRenderJobs,
  fetchDesignStudioState,
  type DesignStudioRenderedDesignRecord,
  type DesignStudioManualRenderJob,
} from '../lib/api/designStudio';
import { SwipeableActivityCard } from './SwipeableActivityCard';
import { toast } from 'sonner';
import { useBulkSelection } from '../hooks/useBulkSelection';

const DASHBOARD_DESIGN_STUDIO_ACTIVITY_TARGET_STORAGE_KEY = 'screndly_dashboard_design_studio_activity_target';
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

interface DesignStudioActivityRecord {
  id: string;
  type: string;
  details: {
    templateName?: string;
    headerText?: string;
    sourceTitle?: string;
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

export function DesignStudioActivityPage({ onNavigate, previousPage }: DesignStudioActivityPageProps) {
  const cachedActivityState = (() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(DESIGN_STUDIO_ACTIVITY_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
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
  const [previewTarget, setPreviewTarget] = useState<ActivityPreviewTarget | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
  const pinchDistanceRef = useRef<number | null>(null);
  const previewOffsetRef = useRef({ x: 0, y: 0 });
  const previewPanStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
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
        setActivities(response.data);
      } else {
        setActivities([]);
      }
      setManualRenderJobs(renderJobs);
      if (!silent || hasActiveManualRender) {
        const designStudioState = await fetchDesignStudioState();
        setTemplatePreviewUrls(
          Object.fromEntries(
            (designStudioState.templates || []).map((template) => [template.id, template.previewUrl]),
          ),
        );
        setRenderedDesigns(designStudioState.renderedDesigns || []);
        setAutoEditorials(designStudioState.autoEditorials || []);
      }
    } catch (error) {
      console.error('Failed to fetch design studio activity:', error);
      if (!silent) {
        setActivities([]);
        setManualRenderJobs([]);
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
    localStorage.setItem('designStudioActivityTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DESIGN_STUDIO_ACTIVITY_CACHE_KEY, JSON.stringify({
      activities,
      manualRenderJobs,
      templatePreviewUrls,
      renderedDesigns,
      autoEditorials,
    }));
  }, [activities, autoEditorials, manualRenderJobs, renderedDesigns, templatePreviewUrls]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DESIGN_STUDIO_ACTIVITY_DISMISSED_KEY, JSON.stringify(dismissedActivityIds));
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
  const autoEditorialByImageUrl = useMemo(
    () => new Map(autoEditorials.map((editorial) => [editorial.renderedImage, editorial])),
    [autoEditorials],
  );

  const getActivityDisplayUrl = (activity: DesignStudioActivityRecord) =>
    buildDesignStudioMediaStreamUrl(activity.details.previewUrl || activity.details.outputUrl)
    || activity.details.previewUrl
    || activity.details.outputUrl
    || '';

  const handleDownload = async (activity: DesignStudioActivityRecord) => {
    const downloadUrl = getActivityDisplayUrl(activity);
    if (!downloadUrl) {
      toast.error('No rendered image available to download');
      return;
    }

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const extension = activity.details.exportFormat === 'png' ? 'png' : 'jpg';
      const safeName = (activity.details.headerText || activity.details.templateName || 'design-render')
        .replace(/[^a-z0-9-_]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'design-render';

      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${safeName}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success('Rendered image downloaded');
    } catch (error) {
      console.error('Failed to download rendered image:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to download rendered image');
    }
  };

  const handleOpenPublish = (activity: DesignStudioActivityRecord) => {
    const outputUrl = activity.details.outputUrl || activity.details.previewUrl;
    if (!outputUrl) {
      toast.error('No rendered image available to publish');
      return;
    }

    const renderedDesign = renderedDesignByOutputUrl.get(outputUrl);
    const autoEditorial = autoEditorialByImageUrl.get(outputUrl);
    const resolvedTitle = renderedDesign?.data?.headerText
      || activity.details.headerText
      || autoEditorial?.headerText
      || autoEditorial?.sourceTitle
      || activity.details.sourceTitle
      || activity.details.templateName
      || 'Rendered Design';

    setPublishTarget({
      activityId: activity.id,
      title: resolvedTitle,
      outputUrl,
      caption: autoEditorial?.caption || renderedDesign?.caption,
      contentType: autoEditorial
        ? 'announcement'
        : renderedDesign?.contentType,
      context: autoEditorial?.subheaderText
        || renderedDesign?.data?.subtext
        || renderedDesign?.templateName
        || activity.details.templateName,
      sourceTitle: autoEditorial?.sourceTitle || activity.details.sourceTitle,
      matchedKeyword: autoEditorial?.matchedKeyword || activity.details.matchedKeyword,
      isAutoEditorial: Boolean(autoEditorial),
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

  const openRenameSheet = (activity: DesignStudioActivityRecord) => {
    setRenameActivity(activity);
    setRenameValue(activity.details.headerText || activity.details.templateName || '');
    setIsRenameSheetOpen(true);
  };

  const openPreview = (activity: DesignStudioActivityRecord) => {
    const imageUrl = getActivityDisplayUrl(activity);
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

  useEffect(() => {
    previewOffsetRef.current = previewOffset;
  }, [previewOffset]);

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
    if (event.touches.length === 1 && previewZoom > 1) {
      const touch = event.touches[0];
      previewPanStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        offsetX: previewOffsetRef.current.x,
        offsetY: previewOffsetRef.current.y,
      };
      pinchDistanceRef.current = null;
      return;
    }

    if (event.touches.length !== 2) {
      pinchDistanceRef.current = null;
      previewPanStartRef.current = null;
      return;
    }

    const [firstTouch, secondTouch] = event.touches;
    previewPanStartRef.current = null;
    pinchDistanceRef.current = Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    );
  };

  const handlePreviewTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 1 && previewPanStartRef.current && previewZoom > 1) {
      event.preventDefault();
      const touch = event.touches[0];
      setPreviewOffset({
        x: previewPanStartRef.current.offsetX + (touch.clientX - previewPanStartRef.current.x),
        y: previewPanStartRef.current.offsetY + (touch.clientY - previewPanStartRef.current.y),
      });
      return;
    }

    if (event.touches.length !== 2 || pinchDistanceRef.current == null) {
      return;
    }

    event.preventDefault();
    const [firstTouch, secondTouch] = event.touches;
    const nextDistance = Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    );

    const scaleRatio = nextDistance / pinchDistanceRef.current;
    pinchDistanceRef.current = nextDistance;
    setPreviewZoom((current) => Math.max(1, Math.min(4, current * scaleRatio)));
  };

  const handlePreviewTouchEnd = () => {
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
    if (!previewPanStartRef.current || previewZoom <= 1) {
      return;
    }

    event.preventDefault();
    setPreviewOffset({
      x: previewPanStartRef.current.offsetX + (event.clientX - previewPanStartRef.current.x),
      y: previewPanStartRef.current.offsetY + (event.clientY - previewPanStartRef.current.y),
    });
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
      setDismissedActivityIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setManualRenderJobs((prev) => prev.filter((job) => `render-job-${job.id}` !== id));
      toast.success('Activity deleted');
      return;
    }

    const deletedActivity = activities.find((activity) => activity.id === id);
    const deletedIndex = activities.findIndex((activity) => activity.id === id);
    if (!deletedActivity || deletedIndex === -1) return;

    setDismissedActivityIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActivities((prev) => prev.filter((activity) => activity.id !== id));

    showUndo({
      id,
      itemName: activityTitle(deletedActivity),
      onUndo: () => {
        setDismissedActivityIds((prev) => prev.filter((activityId) => activityId !== id));
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
          setDismissedActivityIds((prev) => prev.filter((activityId) => activityId !== id));
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

    try {
      if (syntheticIds.length > 0) {
        setDismissedActivityIds((prev) => Array.from(new Set([...prev, ...syntheticIds])));
        setManualRenderJobs((prev) => prev.filter((job) => !selectedIdSet.has(`render-job-${job.id}`)));
      }

      await Promise.all(
        persistedIds.map(async (id) => {
          const response = await apiClient.delete(`/api/design-studio/activity/${id}`);
          if (!response.success) {
            throw new Error(response.error?.message || 'Failed to delete selected activity');
          }
        })
      );
      setDismissedActivityIds((prev) => Array.from(new Set([...prev, ...persistedIds])));
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
        return <Image className="w-5 h-5 text-[#ec1e24]" />;
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

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000] pb-20 lg:pb-0">
      <div className="flex items-start gap-4">
        <BackIconButton
          onClick={() => onNavigate(previousPage || 'design-studio')}
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
            {visibleActivities.map((activity) => (
              <div id={`design-studio-activity-card-${activity.id}`} key={activity.id}>
                <SwipeableActivityCard
                  id={activity.id}
                  onDelete={handleDelete}
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
                        src={getActivityDisplayUrl(activity)}
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
                          <p className="mt-2 text-xs text-gray-500 dark:text-[#6B7280] whitespace-nowrap">
                            {formatTime(activity.createdAt)}
                          </p>
                        </div>
                      </div>
                      {activity.type === 'design_rendered' ? (
                        <div className="mt-3 flex justify-end">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => handleDelete(activity.id)}
                            className="mr-2 hidden h-10 w-11 rounded-[14px] border-gray-200 bg-white text-gray-900 opacity-0 transition-opacity hover:bg-gray-50 hover:text-[#ec1e24] group-hover:opacity-100 dark:border-[#333333] dark:bg-[#000000] dark:text-white dark:hover:bg-[#111111] lg:inline-flex"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => openOptionsMenu(activity)}
                            className="h-10 w-11 rounded-[14px] border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-[#333333] dark:bg-[#000000] dark:text-white dark:hover:bg-[#111111]"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
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
            ))}
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
              onClick={() => {
                if (!menuActivity) return;
                const current = menuActivity;
                closeMenuThen(() => handleOpenPublish(current));
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
            >
              Publish
            </button>
            <button
              onClick={() => {
                if (!menuActivity) return;
                const current = menuActivity;
                closeMenuThen(() => openScheduleSheet(current));
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
            >
              Schedule
            </button>
            <button
              onClick={() => {
                if (!menuActivity) return;
                const current = menuActivity;
                closeMenuThen(() => {
                  void handleDownload(current);
                });
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
            >
              Download
            </button>
            <button
              onClick={() => {
                if (!menuActivity) return;
                const current = menuActivity;
                closeMenuThen(() => openRenameSheet(current));
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
            >
              Rename
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
                className="flex max-h-[85vh] min-h-[60vh] items-center justify-center overflow-auto touch-pan-y"
                onTouchStart={handlePreviewTouchStart}
                onTouchMove={handlePreviewTouchMove}
                onTouchEnd={handlePreviewTouchEnd}
                onMouseDown={handlePreviewMouseDown}
                onMouseMove={handlePreviewMouseMove}
                onMouseUp={handlePreviewMouseUp}
                onMouseLeave={handlePreviewMouseUp}
              >
                <img
                  src={previewTarget.imageUrl}
                  alt={previewTarget.title}
                  draggable={false}
                  className="max-h-[78vh] w-auto max-w-full object-contain transition-transform duration-150"
                  style={{
                    transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewZoom})`,
                    transformOrigin: 'center center',
                    cursor: previewZoom > 1 ? 'grab' : 'default',
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
