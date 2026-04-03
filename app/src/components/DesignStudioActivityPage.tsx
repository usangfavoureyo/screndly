import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Calendar, Clock3, Image, LoaderCircle, Send } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { apiClient } from '../lib/api/client';
import {
  fetchDesignStudioRenderJobs,
  fetchDesignStudioState,
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

interface DesignStudioActivityRecord {
  id: string;
  type: string;
  details: {
    templateName?: string;
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
    exportFormat?: 'jpeg' | 'png';
  };
  createdAt: string;
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

function activityTitle(type: string): string {
  switch (type) {
    case 'template_uploaded':
      return 'Template Uploaded';
    case 'templates_loaded':
      return 'Templates Loaded';
    case 'design_render_queued':
      return 'Design Rendering';
    case 'design_rendered':
      return 'Design Rendered';
    case 'design_render_failed':
      return 'Design Render Failed';
    case 'design_published':
      return 'Design Published';
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
  const templateName = activity.details?.templateName || 'Untitled design';
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
  const [isLoading, setIsLoading] = useState(!(cachedActivityState && (cachedActivityState.activities?.length || cachedActivityState.manualRenderJobs?.length)));
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
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
      }
    } catch (error) {
      console.error('Failed to fetch design studio activity:', error);
      if (!silent) {
        setActivities([]);
        setManualRenderJobs([]);
        setTemplatePreviewUrls({});
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
    }));
  }, [activities, manualRenderJobs, templatePreviewUrls]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DESIGN_STUDIO_ACTIVITY_DISMISSED_KEY, JSON.stringify(dismissedActivityIds));
  }, [dismissedActivityIds]);

  const visibleActivities = useMemo(() => {
    const cutoff = Date.now() - retentionMs;
    const manualRenderActivityRecords: DesignStudioActivityRecord[] = manualRenderJobs
      .filter((job) => job.status === 'queued' || job.status === 'rendering')
      .map((job) => ({
        id: `render-job-${job.id}`,
        type: 'design_render_queued',
        details: {
          templateName: job.templateName,
          status: job.status,
          previewUrl: templatePreviewUrls[job.templateId],
        },
        createdAt: job.createdAt,
      }));

    return [...manualRenderActivityRecords, ...activities]
      .filter((activity) => !dismissedActivityIds.includes(activity.id))
      .filter((activity) => {
        const timestamp = new Date(activity.createdAt).getTime();
        return Number.isNaN(timestamp) || timestamp >= cutoff;
      })
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
      itemName: activityTitle(deletedActivity.type),
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
      case 'design_rendered':
      case 'template_uploaded':
      case 'templates_loaded':
      case 'template_deleted':
        return <Image className="w-5 h-5 text-[#ec1e24]" />;
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
                  className="p-4 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]"
                >
                {activity.details?.previewUrl ? (
                  <div className="flex items-start gap-4">
                    <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-gray-200 dark:border-[#333333]">
                      <img
                        src={activity.details.previewUrl}
                        alt={activity.details.templateName || 'Template preview'}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-1">{getIcon(activity.type)}</div>
                          <div className="min-w-0">
                            <p className="text-gray-900 dark:text-white">{activityTitle(activity.type)}</p>
                            <p className="text-sm text-gray-600 dark:text-[#9CA3AF] mt-1">{activityDescription(activity)}</p>
                            {activity.details.exportFormat ? (
                              <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#6B7280] dark:text-[#9CA3AF]">
                                Export: {activity.details.exportFormat}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-[#6B7280] whitespace-nowrap">{formatTime(activity.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-1">{getIcon(activity.type)}</div>
                      <div className="min-w-0">
                        <p className="text-gray-900 dark:text-white">{activityTitle(activity.type)}</p>
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
