import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Calendar, Image, Send } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { apiClient } from '../lib/api/client';
import { SwipeableActivityCard } from './SwipeableActivityCard';
import { toast } from 'sonner';

interface DesignStudioActivityRecord {
  id: string;
  type: string;
  details: {
    templateName?: string;
    designId?: string;
    platforms?: string;
  };
  createdAt: string;
}

interface DesignStudioActivityPageProps {
  onNavigate: (page: string) => void;
  previousPage?: string | null;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return formatDistanceToNow(date, { addSuffix: true });
}

function activityTitle(type: string): string {
  switch (type) {
    case 'template_uploaded':
      return 'Template Uploaded';
    case 'design_rendered':
      return 'Design Rendered';
    case 'design_published':
      return 'Design Published';
    default:
      return 'Design Activity';
  }
}

function activityDescription(activity: DesignStudioActivityRecord): string {
  const templateName = activity.details?.templateName || 'Untitled design';
  if (activity.type === 'design_published') {
    return `${templateName}${activity.details?.platforms ? ` → ${activity.details.platforms}` : ''}`;
  }
  return templateName;
}

export function DesignStudioActivityPage({ onNavigate, previousPage }: DesignStudioActivityPageProps) {
  const [activities, setActivities] = useState<DesignStudioActivityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<DesignStudioActivityRecord[]>('/api/design-studio/activity');
      if (response.success && Array.isArray(response.data)) {
        setActivities(response.data);
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error('Failed to fetch design studio activity:', error);
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const summary = useMemo(() => ({
    total: activities.length,
    rendered: activities.filter((activity) => activity.type === 'design_rendered').length,
    published: activities.filter((activity) => activity.type === 'design_published').length,
  }), [activities]);

  const handleDelete = async (id: string) => {
    haptics.medium();
    try {
      const response = await apiClient.delete(`/api/design-studio/activity/${id}`);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete activity');
      }
      setActivities((prev) => prev.filter((activity) => activity.id !== id));
      toast.success('Activity deleted');
    } catch (error) {
      console.error('Failed to delete design studio activity:', error);
      toast.error('Failed to delete activity');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'design_published':
        return <Send className="w-5 h-5 text-[#ec1e24]" />;
      case 'design_rendered':
      case 'template_uploaded':
        return <Image className="w-5 h-5 text-[#ec1e24]" />;
      default:
        return <Calendar className="w-5 h-5 text-[#ec1e24]" />;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000] pb-20 lg:pb-0">
      <div className="flex items-start gap-4">
        <button
          onClick={() => {
            haptics.light();
            onNavigate(previousPage || 'design-studio');
          }}
          className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12H2M9 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-gray-900 dark:text-white mb-2">Design Studio Activity</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">Track rendered, uploaded, and published design activity.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <SummaryCard label="Total Activity" value={summary.total} />
        <SummaryCard label="Designs Rendered" value={summary.rendered} />
        <SummaryCard label="Designs Published" value={summary.published} />
      </div>

      <div className="space-y-4 mt-6">
        {isLoading ? (
          [1, 2, 3].map((item) => (
            <div key={item} className="h-24 rounded-xl bg-gray-100 dark:bg-[#111111] animate-pulse" />
          ))
        ) : activities.length === 0 ? (
          <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-12 text-center">
            <p className="text-gray-600 dark:text-[#9CA3AF] mb-2">No design activity yet</p>
            <p className="text-sm text-gray-500 dark:text-[#6B7280]">Rendered and published design events will appear here.</p>
          </div>
        ) : (
          activities.map((activity) => (
            <SwipeableActivityCard
              key={activity.id}
              id={activity.id}
              onDelete={handleDelete}
              className="p-4 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]"
            >
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
            </SwipeableActivityCard>
          ))
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
