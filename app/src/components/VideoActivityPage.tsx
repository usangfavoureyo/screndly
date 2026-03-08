import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { RefreshCw, Video } from 'lucide-react';
import { Button } from './ui/button';
import { haptics } from '../utils/haptics';
import { apiClient } from '../lib/api/client';

interface ChannelItem {
  id: string;
  name: string;
  status: string;
}

interface ChannelActivityItem {
  id: string;
  title: string;
  publishedAt: string;
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

  const activeChannels = channels.filter((channel) => channel.status === 'active').length;
  const inactiveChannels = channels.filter((channel) => channel.status !== 'active').length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const detectedToday = items.filter((item) => {
    const publishedAt = new Date(item.publishedAt);
    return !Number.isNaN(publishedAt.getTime()) && publishedAt >= todayStart;
  }).length;

  const groupedChannels = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const name = item.channel?.name || 'Unknown channel';
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <button
          onClick={() => {
            haptics.light();
            onNavigate(previousPage || 'dashboard');
          }}
          className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12H2M9 19l-7-7 7-7" />
          </svg>
        </button>
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
        <StatCard label="Recent Detections" value={items.length} />
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
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-[#ec1e24]/10 flex items-center justify-center mb-4">
                <Video className="w-8 h-8 text-[#ec1e24]" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No detections yet</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] max-w-sm">
                Channel detections will appear here after the poller finds new videos.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="p-4 rounded-xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-gray-900 dark:text-white">{item.title}</p>
                      <p className="text-sm text-gray-600 dark:text-[#9CA3AF] mt-1">{item.channel?.name || 'Unknown channel'}</p>
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
