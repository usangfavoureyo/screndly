import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Video,
  HardDrive,
  MessageSquare,
  Rss,
  Clapperboard,
  Key,
  Film,
  Image,
  PenSquare,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { haptics } from '../utils/haptics';
import { dashboardApi, DashboardStats } from '../lib/api/dashboard';
import { useComposeStore } from '../store/useComposeStore';
import { toast } from 'sonner';
import { PageLoader } from './PageLoader';

interface DashboardOverviewProps {
  onNavigate: (page: string, source?: string) => void;
  isDesktopHeader?: boolean;
}

function formatTimeAgo(value?: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return formatDistanceToNow(date, { addSuffix: true });
}

function formatSourceLabel(source: string): string {
  return source
    .replace(/^tmdb_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatComposeStatusLabel(status: 'draft' | 'scheduled' | 'published' | 'failed'): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled';
    case 'published':
      return 'Published';
    case 'failed':
      return 'Failed';
    default:
      return 'Draft';
  }
}

function getComposeStatusTone(status: 'draft' | 'scheduled' | 'published' | 'failed'): string {
  if (status === 'failed') {
    return 'bg-[#FEE2E2] dark:bg-[#991B1B] text-[#991B1B] dark:text-[#FEE2E2]';
  }

  return 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]';
}

const EMPTY_DASHBOARD_STATS: DashboardStats = {
  system: {
    cacheHitRate: 0,
    systemErrors: 0,
    dailyFailures: 0,
    dailySuccess: 0,
  },
  comments: {
    repliesToday: 0,
    successRate: 0,
    recentReplies: [],
    activePlatforms: 0,
  },
  video: {
    activeChannels: 0,
    dailyVideos: 0,
    trends: [],
    recentActivity: [],
  },
  rss: {
    activeFeeds: 0,
    dailyPosted: 0,
    recentFeeds: [],
  },
  tmdb: {
    readyCount: 0,
    coverageDays: 0,
    upcoming: [],
  },
  designStudio: {
    generated: 0,
    published: 0,
    recentActivity: [],
  },
  videoStudio: {
    generated: 0,
    published: 0,
    recentActivity: [],
  },
  uploads: {
    activeUploads: 0,
    completedToday: 0,
    pipeline: [],
  },
  usage: {
    openai: 0,
    serper: 0,
    tmdb: 0,
    shotstack: 0,
    googleSearch: 0,
    googleVideo: 0,
    total: 0,
  },
  recentActivity: [],
};

function normalizeDashboardStats(payload: unknown): DashboardStats {
  const raw = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Partial<DashboardStats>
    : {};

  return {
    ...EMPTY_DASHBOARD_STATS,
    ...raw,
    system: {
      ...EMPTY_DASHBOARD_STATS.system,
      ...(raw.system ?? {}),
    },
    comments: {
      ...EMPTY_DASHBOARD_STATS.comments,
      ...(raw.comments ?? {}),
      recentReplies: Array.isArray(raw.comments?.recentReplies) ? raw.comments.recentReplies : [],
    },
    video: {
      ...EMPTY_DASHBOARD_STATS.video,
      ...(raw.video ?? {}),
      trends: Array.isArray(raw.video?.trends) ? raw.video.trends : [],
      recentActivity: Array.isArray(raw.video?.recentActivity) ? raw.video.recentActivity : [],
    },
    rss: {
      ...EMPTY_DASHBOARD_STATS.rss,
      ...(raw.rss ?? {}),
      recentFeeds: Array.isArray(raw.rss?.recentFeeds) ? raw.rss.recentFeeds : [],
    },
    tmdb: {
      ...EMPTY_DASHBOARD_STATS.tmdb,
      ...(raw.tmdb ?? {}),
      upcoming: Array.isArray(raw.tmdb?.upcoming) ? raw.tmdb.upcoming : [],
    },
    designStudio: {
      ...EMPTY_DASHBOARD_STATS.designStudio,
      ...(raw.designStudio ?? {}),
      recentActivity: Array.isArray(raw.designStudio?.recentActivity) ? raw.designStudio.recentActivity : [],
    },
    videoStudio: {
      ...EMPTY_DASHBOARD_STATS.videoStudio,
      ...(raw.videoStudio ?? {}),
      recentActivity: Array.isArray(raw.videoStudio?.recentActivity) ? raw.videoStudio.recentActivity : [],
    },
    uploads: {
      ...EMPTY_DASHBOARD_STATS.uploads,
      ...(raw.uploads ?? {}),
      pipeline: Array.isArray(raw.uploads?.pipeline) ? raw.uploads.pipeline : [],
    },
    usage: {
      ...EMPTY_DASHBOARD_STATS.usage,
      ...(raw.usage ?? {}),
    },
    recentActivity: Array.isArray(raw.recentActivity) ? raw.recentActivity : [],
  };
}

export function DashboardOverview({ onNavigate }: DashboardOverviewProps) {
  const composeItems = useComposeStore((state) => state.items);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      setIsLoading(true);
      try {
        const response = await dashboardApi.getStats();
        if (response.success && response.data) {
          setStats(normalizeDashboardStats(response.data));
        } else {
          toast.error(response.error?.message || 'Failed to load dashboard');
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
        toast.error('Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('dashboardScrollPosition');
    if (savedScrollPosition) {
      requestAnimationFrame(() => {
        window.scrollTo(0, Number.parseInt(savedScrollPosition, 10));
        sessionStorage.removeItem('dashboardScrollPosition');
      });
    }
  }, []);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const handleNavigate = (page: string, source?: string) => {
    sessionStorage.setItem('dashboardScrollPosition', window.scrollY.toString());
    onNavigate(page, source);
  };

  const usageTotal = useMemo(() => stats?.usage?.total ?? 0, [stats]);
  const videoTrends = useMemo(() => stats?.video.trends ?? [], [stats]);
  const hasVideoTrendData = useMemo(
    () => videoTrends.some((point) => (point.videos ?? 0) > 0),
    [videoTrends]
  );
  const composeStats = useMemo(() => ({
    total: composeItems.length,
    drafts: composeItems.filter((item) => item.status === 'draft').length,
    scheduled: composeItems.filter((item) => item.status === 'scheduled').length,
    published: composeItems.filter((item) => item.status === 'published').length,
  }), [composeItems]);
  const recentComposeItems = useMemo(
    () =>
      [...composeItems]
        .sort((left, right) => {
          const rightTimestamp = toTimestamp(right.scheduledAt ?? right.updatedAt ?? right.createdAt);
          const leftTimestamp = toTimestamp(left.scheduledAt ?? left.updatedAt ?? left.createdAt);
          return rightTimestamp - leftTimestamp;
        })
        .slice(0, 4),
    [composeItems],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gray-900 dark:text-white mb-2">Dashboard</h1>
        <p className="text-[#6B7280] dark:text-[#9CA3AF]">Welcome back! Here&apos;s what&apos;s happening with your automation.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200 sm:col-span-2 lg:col-span-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <HardDrive className="w-6 h-6 text-[#ec1e24]" />
              <div>
                <h3 className="text-gray-900 dark:text-white">Logs</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Log monitoring</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
              onClick={() => {
                haptics.light();
                handleNavigate('logs');
              }}
            >
              View all
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Cache Hit Rate"
              value={isLoading ? <Skeleton className="h-8 w-16" /> : `${stats?.system.cacheHitRate ?? 0}%`}
              caption="TMDb cache efficiency"
            />
            <MetricCard
              label="System Errors"
              value={isLoading ? <Skeleton className="h-8 w-8" /> : stats?.system.systemErrors ?? 0}
              caption="Total errors logged"
            />
            <MetricCard
              label="Daily Failures"
              value={isLoading ? <Skeleton className="h-8 w-8" /> : stats?.system.dailyFailures ?? 0}
              caption="Errors today"
            />
            <MetricCard
              label="Daily Success"
              value={isLoading ? <Skeleton className="h-8 w-12" /> : stats?.system.dailySuccess ?? 0}
              caption="Successful events today"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200 sm:col-span-2 lg:col-span-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-[#ec1e24]" />
              <div>
                <h3 className="text-gray-900 dark:text-white">Comment Automation</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">AI-powered responses</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
              onClick={() => {
                haptics.light();
                handleNavigate('comment-automation', 'dashboard');
              }}
            >
              View all
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <MetricCard
              label="Replies Today"
              value={isLoading ? <Skeleton className="h-8 w-12" /> : stats?.comments.repliesToday ?? 0}
              caption="Comments replied today"
            />
            <MetricCard
              label="Success Rate"
              value={isLoading ? <Skeleton className="h-8 w-12" /> : `${stats?.comments.successRate ?? 0}%`}
              caption={`${stats?.comments.activePlatforms ?? 0} platforms tracked`}
            />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm text-gray-900 dark:text-white">Recent Replies</h4>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
            ) : stats?.comments.recentReplies.length ? (
              stats.comments.recentReplies.map((item) => (
                <div key={item.id} className="p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
                  <div className="flex items-start justify-between mb-2 gap-3">
                    <p className="text-sm text-gray-600 dark:text-[#9CA3AF] italic">&quot;{item.comment}&quot;</p>
                    <div className="text-right">
                      <span className="text-xs text-gray-900 dark:text-white">{item.platform}</span>
                      <p className="text-xs text-gray-500 dark:text-[#6B7280]">{formatTimeAgo(item.repliedAt)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white">↳ {item.reply || 'No reply saved'}</p>
                </div>
              ))
            ) : (
              <EmptyCardMessage message="No recent comment replies yet." />
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200 sm:col-span-2 lg:col-span-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Video className="w-6 h-6 text-[#ec1e24]" />
              <div>
                <h3 className="text-gray-900 dark:text-white">Video</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Channel monitoring activity</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
              onClick={() => {
                haptics.light();
                handleNavigate('video-activity', 'dashboard');
              }}
            >
              View all
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Active Channels"
              value={isLoading ? <Skeleton className="h-8 w-8" /> : stats?.video.activeChannels ?? 0}
              caption="Channels currently monitored"
            />
            <MetricCard
              label="Detections Today"
              value={isLoading ? <Skeleton className="h-8 w-8" /> : stats?.video.dailyVideos ?? 0}
              caption="New channel videos today"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div>
              <h4 className="text-gray-900 dark:text-white mb-4">Video Processing Trends</h4>
              {isLoading ? (
                <Skeleton className="h-[250px] w-full rounded-xl" />
              ) : hasVideoTrendData ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={videoTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} interval={0} />
                    <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} allowDecimals={false} domain={[0, 'dataMax + 1']} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
                        border: isDarkMode ? '1px solid #333333' : '1px solid #E5E7EB',
                        borderRadius: '0.5rem',
                        color: isDarkMode ? '#FFFFFF' : '#000000',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="videos"
                      stroke="#ec1e24"
                      strokeWidth={2}
                      dot={{ fill: '#ec1e24', r: 4 }}
                      name="Detected Videos"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyCardMessage message="No video detections in the last 7 days yet." />
              )}
            </div>

            <div>
              <h4 className="text-gray-900 dark:text-white mb-4">Recent Detections</h4>
              <div className="space-y-3">
                {isLoading ? (
                  [1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full rounded-xl" />)
                ) : stats?.video.recentActivity.length ? (
                  stats.video.recentActivity.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
                      <div className="min-w-0 pr-4">
                        <p className="text-gray-900 dark:text-white truncate">{item.title}</p>
                        <p className="text-sm text-gray-600 dark:text-[#9CA3AF] truncate">{item.channelName}</p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-[#6B7280] whitespace-nowrap">{formatTimeAgo(item.publishedAt)}</p>
                    </div>
                  ))
                ) : (
                  <EmptyCardMessage message="No recent channel detections yet." />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SectionCard
        icon={<PenSquare className="w-9 h-9 text-[#ec1e24]" />}
        title="Posts"
        subtitle="Drafts, scheduled items, and published post activity"
        onViewAll={() => handleNavigate('compose-activity', 'dashboard')}
      >
        <div className="grid grid-cols-2 gap-4 mb-4">
          <MetricCard
            label="Post Items"
            value={composeStats.total}
            caption="Items in the post workflow"
          />
          <MetricCard
            label="Draft Posts"
            value={composeStats.drafts}
            caption="Ready to edit or publish"
          />
          <MetricCard
            label="Scheduled Posts"
            value={composeStats.scheduled}
            caption="Queued for a future time"
          />
          <MetricCard
            label="Published Posts"
            value={composeStats.published}
            caption="Successfully published items"
          />
        </div>

        <div className="space-y-3">
          <h4 className="text-sm text-gray-900 dark:text-white">Recent Posts</h4>
          {recentComposeItems.length ? (
            recentComposeItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
                <div className="min-w-0 pr-4">
                  <p className="text-gray-900 dark:text-white truncate">{item.title}</p>
                  <p className="text-sm text-gray-600 dark:text-[#9CA3AF] truncate">
                    {item.platforms.length ? `${item.platforms.length} platform${item.platforms.length === 1 ? '' : 's'}` : 'No platforms selected'}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center rounded-lg px-3 py-1 text-xs ${getComposeStatusTone(item.status)}`}>
                    {formatComposeStatusLabel(item.status)}
                  </span>
                  <p className="mt-1 text-xs text-gray-500 dark:text-[#6B7280]">
                    {formatTimeAgo(item.scheduledAt ?? item.updatedAt ?? item.createdAt)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <EmptyCardMessage message="No post activity recorded yet." />
          )}
        </div>
      </SectionCard>

      <SectionCard
        icon={<Rss className="w-6 h-6 text-[#ec1e24]" />}
        title="RSS Feeds"
        subtitle="Active feed monitoring"
        onViewAll={() => handleNavigate('rss-activity', 'dashboard')}
      >
        <div className="grid grid-cols-2 gap-4 mb-6">
          <MetricCard
            label="RSS Feeds Active"
            value={isLoading ? <Skeleton className="h-8 w-8" /> : stats?.rss.activeFeeds ?? 0}
            caption="Enabled feeds"
          />
          <MetricCard
            label="Daily RSS Feeds Posted"
            value={isLoading ? <Skeleton className="h-8 w-8" /> : stats?.rss.dailyPosted ?? 0}
            caption="Published RSS items today"
          />
        </div>

        <div className="space-y-3">
          {!isLoading && !stats?.rss.recentFeeds.length ? (
            <EmptyCardMessage message="No RSS feeds configured yet." />
          ) : (
            (stats?.rss.recentFeeds ?? []).map((feed) => (
              <div key={feed.id} className="flex items-center justify-between p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-gray-900 dark:bg-white" />
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-white truncate">{feed.name}</p>
                    <p className="text-sm text-gray-600 dark:text-[#9CA3AF] truncate">
                      {feed.lastProcessedAt ? `Last processed ${formatTimeAgo(feed.lastProcessedAt)}` : feed.nextRunAt ? `Next run ${formatTimeAgo(feed.nextRunAt)}` : 'No run recorded yet'}
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-lg text-gray-900 dark:text-white border border-gray-200 dark:border-[#333333]">
                  {feed.status}
                </span>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard
        icon={<Clapperboard className="w-6 h-6 text-[#ec1e24]" />}
        title="TMDb Feeds"
        subtitle="Upcoming scheduled posts"
        onViewAll={() => handleNavigate('tmdb-activity', 'dashboard')}
      >
        <div className="grid grid-cols-2 gap-4 mb-4">
          <MetricCard
            label="TMDb Feeds Ready"
            value={isLoading ? <Skeleton className="h-8 w-8" /> : stats?.tmdb.readyCount ?? 0}
            caption="Queued and scheduled posts"
          />
          <MetricCard
            label="Coverage"
            value={isLoading ? <Skeleton className="h-8 w-12" /> : `${stats?.tmdb.coverageDays ?? 0} Days`}
            caption="Upcoming post coverage"
          />
        </div>

        <div className="space-y-3">
          <h4 className="text-sm text-gray-900 dark:text-white">Upcoming Schedule</h4>
          {!isLoading && !stats?.tmdb.upcoming.length ? (
            <EmptyCardMessage message="No upcoming TMDb posts are queued." />
          ) : (
            (stats?.tmdb.upcoming ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-center min-w-[50px]">
                    <div className="text-xs text-gray-500 dark:text-[#6B7280]">{item.dateLabel}</div>
                    <div className="text-sm text-[#ec1e24]">{item.timeLabel}</div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-white truncate">{item.title}</p>
                    <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">{formatSourceLabel(item.source)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard
        icon={<Image className="w-6 h-6 text-[#ec1e24]" />}
        title="Design Studio"
        subtitle="Creative generation activity"
        onViewAll={() => handleNavigate('design-studio-activity', 'dashboard')}
      >
        <div className="grid grid-cols-2 gap-4 mb-4">
          <MetricCard
            label="Designs Generated"
            value={isLoading ? <Skeleton className="h-8 w-8" /> : stats?.designStudio.generated ?? 0}
            caption="Recorded renders"
          />
          <MetricCard
            label="Designs Published"
            value={isLoading ? <Skeleton className="h-8 w-8" /> : stats?.designStudio.published ?? 0}
            caption="Published designs"
          />
        </div>

        <div className="space-y-3">
          <h4 className="text-sm text-gray-900 dark:text-white">Recent Activity</h4>
          {!isLoading && !stats?.designStudio.recentActivity.length ? (
            <EmptyCardMessage message="No design activity recorded yet." />
          ) : (
            (stats?.designStudio.recentActivity ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
                <div className="min-w-0 pr-4">
                  <p className="text-gray-900 dark:text-white truncate">{item.title}</p>
                  <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">{formatSourceLabel(item.type)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-900 dark:text-white mb-0.5">{item.status}</p>
                  <p className="text-xs text-gray-500 dark:text-[#6B7280]">{formatTimeAgo(item.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard
        icon={<Film className="w-6 h-6 text-[#ec1e24]" />}
        title="Video Studio"
        subtitle="Video generation activity"
        onViewAll={() => handleNavigate('video-studio-activity', 'dashboard')}
      >
        <div className="grid grid-cols-2 gap-4 mb-4">
          <MetricCard
            label="Videos Generated"
            value={isLoading ? <Skeleton className="h-8 w-8" /> : stats?.videoStudio.generated ?? 0}
            caption="Completed renders"
          />
          <MetricCard
            label="Videos Published"
            value={isLoading ? <Skeleton className="h-8 w-8" /> : stats?.videoStudio.published ?? 0}
            caption="Published videos"
          />
        </div>

        <div className="space-y-3">
          <h4 className="text-sm text-gray-900 dark:text-white">Recent Activity</h4>
          {!isLoading && !stats?.videoStudio.recentActivity.length ? (
            <EmptyCardMessage message="No video studio activity recorded yet." />
          ) : (
            (stats?.videoStudio.recentActivity ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
                <div className="min-w-0 pr-4">
                  <p className="text-gray-900 dark:text-white truncate">{item.title}</p>
                  <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">{formatSourceLabel(item.type)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-900 dark:text-white mb-0.5 capitalize">{item.status}</p>
                  <p className="text-xs text-gray-500 dark:text-[#6B7280]">{formatTimeAgo(item.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard
        icon={<HardDrive className="w-6 h-6 text-[#ec1e24]" />}
        title="Upload Manager"
        subtitle="Video upload pipeline"
        onViewAll={() => handleNavigate('upload-manager', 'dashboard')}
      >
        <div className="grid grid-cols-2 gap-4 mb-4">
          <MetricCard
            label="Active Uploads"
            value={isLoading ? <Skeleton className="h-8 w-8" /> : stats?.uploads.activeUploads ?? 0}
            caption="Uploads in progress"
          />
          <MetricCard
            label="Completed Today"
            value={isLoading ? <Skeleton className="h-8 w-8" /> : stats?.uploads.completedToday ?? 0}
            caption="Completed uploads today"
          />
        </div>

        <div className="space-y-3">
          <h4 className="text-sm text-gray-900 dark:text-white">Pipeline Status</h4>
          {!isLoading && !stats?.uploads.pipeline.length ? (
            <EmptyCardMessage message="No active upload jobs in the pipeline." />
          ) : (
            (stats?.uploads.pipeline ?? []).map((item) => (
              <div key={item.id} className="p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0 pr-4">
                    <p className="text-sm text-gray-900 dark:text-white truncate">{item.fileName}</p>
                    <p className="text-xs text-gray-600 dark:text-[#9CA3AF] capitalize">{item.stage.replace(/_/g, ' ')}</p>
                  </div>
                  <span className="text-xs text-gray-900 dark:text-white">{item.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-[#0A0A0A] rounded-full h-1.5">
                  <div className="bg-[#ec1e24] h-1.5 rounded-full transition-all duration-500" style={{ width: `${item.progress}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard
        icon={<Key className="w-6 h-6 text-[#ec1e24]" />}
        title="API Usage"
        subtitle="Track API usage"
        onViewAll={() => handleNavigate('api-usage', 'dashboard')}
      >
        <div className="grid grid-cols-2 gap-4">
          <MetricCard label="OpenAI API Usage" value={isLoading ? <Skeleton className="h-8 w-16" /> : stats?.usage.openai ?? 0} caption="Today" />
          <MetricCard label="Serper API Usage" value={isLoading ? <Skeleton className="h-8 w-12" /> : stats?.usage.serper ?? 0} caption="Today" />
          <MetricCard label="TMDb API Usage" value={isLoading ? <Skeleton className="h-8 w-16" /> : stats?.usage.tmdb ?? 0} caption="Today" />
          <MetricCard label="Shotstack API Usage" value={isLoading ? <Skeleton className="h-8 w-12" /> : stats?.usage.shotstack ?? 0} caption="Today" />
          <MetricCard label="Google Search API Usage" value={isLoading ? <Skeleton className="h-8 w-12" /> : stats?.usage.googleSearch ?? 0} caption="Today" />
          <MetricCard label="GVI API Usage" value={isLoading ? <Skeleton className="h-8 w-12" /> : stats?.usage.googleVideo ?? 0} caption="Today" />
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333] col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 dark:text-[#6B7280]">Today</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-0.5">
              {isLoading ? <Skeleton className="h-8 w-20" /> : usageTotal.toLocaleString()}
            </div>
            <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">Total API Calls</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Recent Activity"
        subtitle=""
        onViewAll={() => handleNavigate('activity', 'dashboard')}
      >
        <div className="space-y-3">
          {isLoading ? (
            <PageLoader size="sm" className="h-auto py-4" />
          ) : stats?.recentActivity.length ? (
            stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 rounded-xl transition-colors duration-200">
                <div className="flex-1 pr-4 min-w-0">
                  <p className="text-gray-900 dark:text-white truncate">{activity.title}</p>
                  <p className="text-[#6B7280] dark:text-[#9CA3AF] truncate">{activity.platform}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`px-3 py-1 rounded-full ${activity.status === 'success'
                      ? 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]'
                      : 'bg-[#FEE2E2] dark:bg-[#991B1B] text-[#991B1B] dark:text-[#FEE2E2]'
                      } text-xs font-medium`}
                  >
                    {activity.status === 'success' ? 'Success' : 'Failed'}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-[#6B7280] whitespace-nowrap">{formatTimeAgo(activity.timestamp)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-gray-500">No recent activity</div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function MetricCard({ label, value, caption }: { label: string; value: ReactNode; caption: string }) {
  return (
    <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
      <div className="text-2xl text-gray-900 dark:text-white mb-1">{value}</div>
      <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">{label}</div>
      <div className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">{caption}</div>
    </div>
  );
}

function EmptyCardMessage({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
      <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">{message}</p>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  onViewAll,
  children,
}: {
  icon?: ReactNode;
  title: string;
  subtitle: string;
  onViewAll: () => void;
  children: ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h3 className="text-gray-900 dark:text-white">{title}</h3>
            {subtitle && <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{subtitle}</p>}
          </div>
        </div>
        <Button
          variant="outline"
          className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
          onClick={() => {
            haptics.light();
            onViewAll();
          }}
        >
          View all
        </Button>
      </div>
      {children}
    </div>
  );
}
