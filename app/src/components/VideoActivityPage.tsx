import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { haptics } from '../utils/haptics';
import { apiClient } from '../lib/api/client';
import { useSettings } from '../contexts/SettingsContext';
import { BackIconButton } from './BackIconButton';

const DASHBOARD_VIDEO_ACTIVITY_TARGET_STORAGE_KEY = 'screndly_dashboard_video_activity_target';

interface ChannelItem {
  id: string;
  name: string;
  status: string;
}

interface ChannelActivityItem {
  id: string;
  title: string;
  publishedAt: string;
  status?: string;
  channel: {
    id: string;
    name: string;
  };
}

interface VideoActivityPageProps {
  onNavigate: (page: string) => void;
  previousPage?: string | null;
}

function timeAgo(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return formatDistanceToNow(date, { addSuffix: true });
}

export function VideoActivityPage({ onNavigate, previousPage }: VideoActivityPageProps) {
  const { settings } = useSettings();
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [items, setItems] = useState<ChannelActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [channelsResponse, activityResponse] = await Promise.all([
        apiClient.get<ChannelItem[]>('/api/channels'),
        apiClient.get<ChannelActivityItem[]>('/api/channels/activity'),
      ]);

      if (channelsResponse.success && Array.isArray(channelsResponse.data)) {
        setChannels(channelsResponse.data);
      } else {
        setChannels([]);
      }

      if (activityResponse.success && Array.isArray(activityResponse.data)) {
        setItems(activityResponse.data);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Failed to load video activity:', error);
      setChannels([]);
      setItems([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const retentionHours = Number(settings.videoActivityRetention || 24);
  const retentionMs = retentionHours * 60 * 60 * 1000;

  const visibleItems = useMemo(() => {
    const cutoff = Date.now() - retentionMs;

    return items.filter((item) => {
      const publishedAt = new Date(item.publishedAt).getTime();
      return Number.isNaN(publishedAt) || publishedAt >= cutoff;
    });
  }, [items, retentionMs]);

  useEffect(() => {
    const targetItemId = window.localStorage.getItem(DASHBOARD_VIDEO_ACTIVITY_TARGET_STORAGE_KEY);
    if (!targetItemId || !visibleItems.some((item) => item.id === targetItemId)) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const targetElement = document.getElementById(`video-activity-card-${targetItemId}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      window.localStorage.removeItem(DASHBOARD_VIDEO_ACTIVITY_TARGET_STORAGE_KEY);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [visibleItems]);

  const activeChannels = channels.filter((channel) => channel.status === 'active').length;
  const inactiveChannels = channels.filter((channel) => channel.status !== 'active').length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const detectedToday = visibleItems.filter((item) => {
    const publishedAt = new Date(item.publishedAt);
    return !Number.isNaN(publishedAt.getTime()) && publishedAt >= todayStart;
  }).length;

  const groupedChannels = useMemo(() => {
    const counts = new Map<string, number>();
    visibleItems.forEach((item) => {
      const name = item.channel?.name || 'Unknown channel';
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [visibleItems]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <BackIconButton
          onClick={() => onNavigate(previousPage || 'dashboard')}
          className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
        />
        <div className="flex-1">
          <h1 className="text-gray-900 dark:text-white mb-2">Video Activity</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">Recent YouTube channel detections and monitoring activity.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            haptics.light();
            loadData();
          }}
          disabled={isRefreshing}
          className="h-9 w-9 p-0 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
          aria-label="Refresh video activity"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Channels" value={activeChannels} />
        <StatCard label="Detected Today" value={detectedToday} />
        <StatCard label="Recent Detections" value={visibleItems.length} />
        <StatCard label="Inactive Channels" value={inactiveChannels} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
          <h2 className="text-gray-900 dark:text-white mb-4">Recent Channel Videos</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 rounded-xl bg-gray-100 dark:bg-[#111111] animate-pulse" />
              ))}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No recent detections</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] max-w-sm">
                Channel detections will appear here after the poller finds new videos within your retention window.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleItems.map((item) => (
                <div id={`video-activity-card-${item.id}`} key={item.id} className="p-4 rounded-xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-gray-900 dark:text-white">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">{item.channel?.name || 'Unknown channel'}</p>
                        {item.status === 'failed' ? (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-600 dark:bg-red-500/10 dark:text-red-300">
                            Failed
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-[#6B7280] whitespace-nowrap">{timeAgo(item.publishedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
          <h2 className="text-gray-900 dark:text-white mb-4">Top Channels</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-16 rounded-xl bg-gray-100 dark:bg-[#111111] animate-pulse" />
              ))}
            </div>
          ) : groupedChannels.length === 0 ? (
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">No channel activity recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {groupedChannels.map(([channelName, count]) => (
                <div key={channelName} className="p-4 rounded-xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-gray-900 dark:text-white truncate">{channelName}</p>
                    <span className="text-sm text-[#ec1e24]">{count}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">Detected videos in recent activity</p>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full mt-4 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
            onClick={() => {
              haptics.light();
              onNavigate('channels');
            }}
          >
            Open Channels
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
      <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">{label}</p>
      <p className="text-gray-900 dark:text-white text-2xl">{value}</p>
    </div>
  );
}
