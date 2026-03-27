import { useMemo, useEffect, useState } from 'react';
import { useActivity } from '../hooks/useActivity';
import { useUndo } from './UndoContext';
import { haptics } from '../utils/haptics';
import { SwipeableActivityItem } from './SwipeableActivityItem';
import { apiClient } from '../lib/api/client';
import { useBackNavigation } from '../contexts/BackNavigationContext';
import { navigateBackWithFallback } from '../utils/historyNavigation';
import { toast } from 'sonner';

interface Activity {
  id: string;
  title: string;
  platform: string;
  status: 'success' | 'failed';
  time: string;
  type: string;
  timestamp: number;
}

interface RecentActivityPageProps {
  onNavigate: (page: string) => void;
}

// Calculate time ago from timestamp
function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export function RecentActivityPage({ onNavigate }: RecentActivityPageProps) {
  const { showUndo } = useUndo();
  const { handleAppBack } = useBackNavigation();

  const { activities: logs } = useActivity({ limit: 20 });
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  // Activity list is sourced from backend logs via useActivity()
  // Mapped from logs
  const activities = useMemo<Activity[]>(() => {
    if (!Array.isArray(logs)) return [];
    return logs
      .filter((log: any) => !deletedIds.includes(log.id))
      .map((log: any) => {
      const metadata = log.metadata || {};
      const timestamp = new Date(log.timestamp).getTime();
      return {
        id: log.id,
        title: metadata.videoTitle || log.message || 'Unknown Activity',
        platform: metadata.platform || 'System',
        status: (log.level === 'error' ? 'failed' : 'success') as 'success' | 'failed',
        time: getTimeAgo(timestamp),
        type: (metadata.type as any) || 'system',
        timestamp: timestamp,
      };
      });
  }, [logs, deletedIds]);

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);



  const handleDelete = (id: string) => {
    haptics.medium();
    const deletedActivity = activities.find(activity => activity.id === id);
    if (!deletedActivity) return;

    setDeletedIds((prev) => [...prev, id]);

    showUndo({
      id,
      itemName: deletedActivity.title,
      onUndo: () => {
        setDeletedIds((prev) => prev.filter((entryId) => entryId !== id));
      },
      onConfirm: async () => {
        try {
          const response = await apiClient.delete(`/api/logs/${id}`);
          if (!response.success) {
            throw new Error(response.error?.message || 'Failed to delete activity');
          }
          toast.success('Activity deleted');
        } catch (error) {
          console.error('Failed to delete recent activity:', error);
          setDeletedIds((prev) => prev.filter((entryId) => entryId !== id));
          toast.error(error instanceof Error ? error.message : 'Failed to delete activity');
        }
      },
    });
  };



  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <button
          onClick={() => {
            haptics.light();
            navigateBackWithFallback({ handleAppBack }, () => onNavigate('dashboard'));
          }}
          className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12H2M9 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-gray-900 dark:text-white mb-2">Recent Activity</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">Complete history of all automation activities.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Recent Activity</h3>
            <p className="text-gray-500 dark:text-[#9CA3AF] max-w-sm">
              Your automation history will appear here once tasks are completed.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <SwipeableActivityItem
                key={activity.id}
                activity={activity}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
