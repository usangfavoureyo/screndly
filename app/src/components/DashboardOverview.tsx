
import { Video, HardDrive, MessageSquare, Rss, Clapperboard, Key, Film, Image } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Button } from './ui/button';
import { haptics } from '../utils/haptics';
import { useNotifications } from '../contexts/NotificationsContext';
import { useActivity } from '../hooks/useActivity';
import { useState, useEffect } from 'react';

import { dashboardApi, DashboardStats } from '../lib/api/dashboard';
import { Skeleton } from './ui/skeleton';
import { toast } from "sonner";

const chartData = [
  { date: 'Mon', videos: 12 },
  { date: 'Tue', videos: 19 },
  { date: 'Wed', videos: 8 },
  { date: 'Thu', videos: 15 },
  { date: 'Fri', videos: 22 },
  { date: 'Sat', videos: 17 },
  { date: 'Sun', videos: 11 },
];

interface DashboardOverviewProps {
  onNavigate: (page: string, source?: string) => void;
  isDesktopHeader?: boolean;
}

export function DashboardOverview({ onNavigate, isDesktopHeader = false }: DashboardOverviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Platform Distribution Data
  const [platformData, setPlatformData] = useState<{ platform: string; posts: number }[]>([]);
  const [dailyVideos, setDailyVideos] = useState(0); // From API or calculation
  const [activeChannels, setActiveChannels] = useState(0);

  // RSS
  const [activeRSSFeeds, setActiveRSSFeeds] = useState(0);
  const [dailyRSSPosts, setDailyRSSPosts] = useState(0);

  // TMDb
  const [tmdbFeedsReady, setTmdbFeedsReady] = useState(0);

  // Design Studio
  const [designsGenerated, setDesignsGenerated] = useState(0);
  const [designsPublished, setDesignsPublished] = useState(0);

  // Video Studio
  const [videosGenerated, setVideosGenerated] = useState(0);
  const [videosPublished, setVideosPublished] = useState(0);

  // Theme detection
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    async function fetchDashboardStats() {
      setIsLoading(true);
      try {
        const response = await dashboardApi.getStats();

        if (response.success && response.data) {
          setStats(response.data);

          // Map API data to component state where necessary
          // Note for Review: Ideally we should use `stats` object directly in JSX
          // but for now keeping hybrid approach to minimize UI refactor risk.
        } else {
          console.error('Failed to fetch stats:', response.error);
          loadFromLocalStorage();
        }
      } catch (error) {
        console.error('API Error:', error);
        loadFromLocalStorage();
      } finally {
        setIsLoading(false);
      }
    }

    // Helper to keep existing logic as fallback
    function loadFromLocalStorage() {
      try {
        const stored = localStorage.getItem('videoPosts');
        if (stored) {
          const videoPosts = JSON.parse(stored);
          const platformCounts: Record<string, number> = {
            YouTube: 0, X: 0, Threads: 0, Instagram: 0, TikTok: 0, Facebook: 0, Pinterest: 0,
          };
          videoPosts.forEach((post: any) => {
            if (platformCounts.hasOwnProperty(post.platform)) platformCounts[post.platform]++;
          });
          const platformArray = Object.entries(platformCounts)
            .map(([platform, posts]) => ({ platform, posts }))
            .filter(item => item.posts > 0)
            .sort((a, b) => b.posts - a.posts);
          setPlatformData(platformArray);

          const today = new Date();
          today.setHours(0, 0, 0, 0); // Start of day
          const todayTimestamp = today.getTime();
          setDailyVideos(videoPosts.filter((post: any) => post.timestamp >= todayTimestamp).length);
        }

        const channelsData = localStorage.getItem('screndly_youtube_channels');
        if (channelsData) {
          setActiveChannels(JSON.parse(channelsData).filter((ch: any) => ch.active).length);
        }

        const rssFeeds = localStorage.getItem('screndlyRSSFeeds');
        if (rssFeeds) {
          const feeds = JSON.parse(rssFeeds);
          setActiveRSSFeeds(feeds.filter((f: any) => f.active).length);
        }

        const tmdbPosts = localStorage.getItem('screndlyTMDbPosts');
        if (tmdbPosts) {
          setTmdbFeedsReady(JSON.parse(tmdbPosts).filter((p: any) => p.status === 'queued').length);
        }

      } catch (e) { console.error("Storage load error", e); }
    }

    fetchDashboardStats();
  }, []);

  // Verification Logger
  useEffect(() => {
    if (stats) {
      console.log("Logs card:", stats.system);
      console.log("API usage card:", stats.usage);
      console.log("Upload manager card:", stats.uploads);
      console.log("Comments card:", stats.comments);
    }
  }, [stats]);

  // Restore scroll position when component mounts
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('dashboardScrollPosition');
    if (savedScrollPosition) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedScrollPosition, 10));
        // Clear the saved position after restoring
        sessionStorage.removeItem('dashboardScrollPosition');
      });
    }
  }, []);

  // Wrapper function to save scroll position before navigating
  const handleNavigate = (page: string, source?: string) => {
    // Save current scroll position
    sessionStorage.setItem('dashboardScrollPosition', window.scrollY.toString());
    // Navigate to the page
    onNavigate(page, source);
  };

  // Check initial dark mode state and listen for theme changes
  useEffect(() => {
    // Check initial dark mode state
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    // Listen for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gray-900 dark:text-white mb-2">Dashboard</h1>
        <p className="text-[#6B7280] dark:text-[#9CA3AF]">Welcome back! Here's what's happening with your automation.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Systems Log Card */}
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
            {/* Cache Hit Rate */}
            <div
              className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 dark:text-[#6B7280]">Efficient</span>
              </div>
              <div className="text-2xl text-gray-900 dark:text-white mb-0.5">
                {isLoading ? <Skeleton className="h-8 w-16" /> : (stats?.system?.cacheHitRate ?? 87) + '%'}
              </div>
              <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">Cache Hit Rate</div>
            </div>

            {/* System Errors */}
            <div
              className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 dark:text-[#6B7280]">-3 resolved</span>
              </div>
              <div className="text-2xl text-gray-900 dark:text-white mb-0.5">
                {isLoading ? <Skeleton className="h-8 w-8" /> : (stats?.system?.systemErrors ?? 2)}
              </div>
              <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">System Errors</div>
            </div>

            {/* Daily Failures */}
            <div
              className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 dark:text-[#6B7280]">Today</span>
              </div>
              <div className="text-2xl text-gray-900 dark:text-white mb-0.5">
                {isLoading ? <Skeleton className="h-8 w-8" /> : (stats?.system?.dailyFailures ?? 3)}
              </div>
              <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">Daily Failures</div>
            </div>

            {/* Daily Success */}
            <div
              className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 dark:text-[#6B7280]">Today</span>
              </div>
              <div className="text-2xl text-gray-900 dark:text-white mb-0.5">
                {isLoading ? <Skeleton className="h-8 w-12" /> : (stats?.system?.dailySuccess ?? 44)}
              </div>
              <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">Daily Success</div>
            </div>
          </div>
        </div>

        {/* Comment Automation Card */}
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
            <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
              <p className="text-2xl text-gray-900 dark:text-white mb-1">
                {isLoading ? <Skeleton className="h-8 w-12" /> : (stats?.comments?.repliesToday ?? 142)}
              </p>
              <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Replies Today</p>
            </div>
            <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
              <p className="text-2xl text-gray-900 dark:text-white mb-1">
                {isLoading ? <Skeleton className="h-8 w-12" /> : (stats?.comments?.successRate ?? '87') + '%'}
              </p>
              <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Success Rate</p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm text-gray-900 dark:text-white">Recent Replies</h4>
            {stats?.comments?.recentReplies?.map((item: any, index: number) => (
              <div key={index} className="p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm text-gray-600 dark:text-[#9CA3AF] italic">"{item.content}"</p>
                  <span className="text-xs text-gray-900 dark:text-white">{item.platform}</span>
                </div>
                <p className="text-sm text-gray-900 dark:text-white">↳ {item.reply}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Videos Card */}
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200 sm:col-span-2 lg:col-span-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Video className="w-6 h-6 text-[#ec1e24]" />
              <div>
                <h3 className="text-gray-900 dark:text-white">Video</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Active video monitoring</p>
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
            {/* Active Channels */}
            <div
              className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 dark:text-[#6B7280]">+3 new</span>
              </div>
              <div className="text-2xl text-gray-900 dark:text-white mb-0.5">
                {isLoading ? <Skeleton className="h-8 w-8" /> : activeChannels}
              </div>
              <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">Active Channels</div>
            </div>

            {/* Daily Videos Posted */}
            <div
              className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 dark:text-[#6B7280]">Today</span>
              </div>
              <div className="text-2xl text-gray-900 dark:text-white mb-0.5">
                {isLoading ? <Skeleton className="h-8 w-8" /> : dailyVideos}
              </div>
              <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">Daily Videos Posted</div>
            </div>
          </div>

          {/* Video Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Video Processing Trends */}
            <div>
              <h4 className="text-gray-900 dark:text-white mb-4">Video Processing Trends</h4>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    interval={0}
                  />
                  <YAxis stroke="#9CA3AF" />
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
                    name="Videos Processed"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Video Distribution Platform */}
            <div>
              <h4 className="text-gray-900 dark:text-white mb-4">Video Distribution Platform</h4>
              <div className="space-y-4 relative z-10 w-full mb-12">
                {(stats?.uploads?.pipeline || []).length > 0 ? (
                  stats?.uploads?.pipeline?.map((job: any) => (
                    <div key={job.id} className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333] flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
                      {/* Progress Background */}
                      <div
                        className="absolute bottom-0 left-0 h-full bg-red-50/50 dark:bg-[#ec1e24]/5 transition-all duration-300 ease-in-out z-0 border-r border-[#ec1e24]/10 dark:border-[#ec1e24]/20"
                        style={{ width: `${job.progress}%` }}
                      />

                      {/* Left Accent Bar */}
                      <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-[#ec1e24] to-red-400" />

                      <div className="flex items-center gap-4 flex-1 min-w-0 z-10">
                        <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-[#ec1e24]/10 flex items-center justify-center shrink-0">
                          {job.stage === 'queued' ? <Clock className="w-5 h-5 text-[#ec1e24]" /> :
                            job.stage === 'generating_metadata' ? <Cpu className="w-5 h-5 text-[#ec1e24] animate-pulse" /> :
                              <RefreshCw className="w-5 h-5 text-[#ec1e24] animate-spin" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate pr-4">{job.fileName}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-gray-50 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 font-mono">
                              {job.stage.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <span className="text-xs text-gray-400 capitalize flex items-center gap-1">
                              <Circle className="w-1 h-1 fill-current" />
                              {job.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 z-10 pl-4 w-24">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{job.progress}%</span>
                        {job.stage === 'queued' && <p className="text-xs text-gray-400 mt-0.5">Waiting</p>}
                        {job.stage === 'generating_metadata' && <p className="text-xs text-[#ec1e24] mt-0.5 animate-pulse">AI Active</p>}
                        {job.stage === 'processing' && <p className="text-xs text-blue-500 mt-0.5">Rendering</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center bg-white dark:bg-[#000000] rounded-xl border border-gray-100 dark:border-[#333333] border-dashed">
                    <Video className="w-8 h-8 text-gray-400 mb-3" />
                    <p className="text-gray-500 font-medium">Pipeline is empty</p>
                    <p className="text-xs text-gray-400 mt-1">No videos currently processing</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RSS Feeds Widget - Full width single column */}
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Rss className="w-6 h-6 text-[#ec1e24]" />
            <div>
              <h3 className="text-gray-900 dark:text-white">RSS Feeds</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Active feed monitoring</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
            onClick={() => {
              haptics.light();
              handleNavigate('rss-activity', 'dashboard');
            }}
          >
            View all
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* RSS Feeds Active */}
          <div
            className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 dark:text-[#6B7280]">Active</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-0.5">{activeRSSFeeds}</div>
            <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">RSS Feeds Active</div>
          </div>

          {/* Daily RSS Feeds Posted */}
          <div
            className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 dark:text-[#6B7280]">Today</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-0.5">{dailyRSSPosts}</div>
            <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">Daily RSS Feeds Posted</div>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { title: 'Variety - Latest Movie News', posts: 127, status: 'Active', color: 'green' },
            { title: 'The Hollywood Reporter', posts: 89, status: 'Active', color: 'green' },
            { title: 'IMDb News', posts: 156, status: 'Active', color: 'green' },
            { title: 'Collider', posts: 93, status: 'Paused', color: 'orange' },
          ].map((feed, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-2 h-2 rounded-full bg-gray-900 dark:bg-white"></div>
                <div>
                  <p className="text-gray-900 dark:text-white">{feed.title}</p>
                  <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">{feed.posts} posts generated</p>
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded-lg text-gray-900 dark:text-white border border-gray-200 dark:border-[#333333]">
                {feed.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* TMDb Feeds Widget */}
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clapperboard className="w-6 h-6 text-[#ec1e24]" />
            <div>
              <h3 className="text-gray-900 dark:text-white">TMDb Feeds</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Upcoming scheduled posts</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
            onClick={() => {
              haptics.light();
              handleNavigate('tmdb-activity', 'dashboard');
            }}
          >
            View all
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
            <p className="text-2xl text-gray-900 dark:text-white mb-1">{tmdbFeedsReady}</p>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">TMDb Feeds Ready</p>
          </div>
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
            <p className="text-2xl text-gray-900 dark:text-white mb-1">7 Days</p>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Coverage</p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm text-gray-900 dark:text-white">Next 7 Days</h4>
          {[
            { date: 'Nov 18', title: 'The Matrix', type: '25th Anniversary', time: '9:00 AM' },
            { date: 'Nov 19', title: 'Arcane S2', type: 'Monthly', time: '11:00 AM' },
            { date: 'Nov 20', title: 'Terrifier 3', type: 'Weekly', time: '3:30 PM' },
          ].map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
              <div className="flex items-center gap-3">
                <div className="text-center min-w-[50px]">
                  <div className="text-xs text-gray-500 dark:text-[#6B7280]">{item.date}</div>
                  <div className="text-sm text-[#ec1e24]">{item.time}</div>
                </div>
                <div>
                  <p className="text-gray-900 dark:text-white">{item.title}</p>
                  <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">{item.type}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Design Studio Widget */}
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Image className="w-6 h-6 text-[#ec1e24]" />
            <div>
              <h3 className="text-gray-900 dark:text-white">Design Studio</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Creative generation activity</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
            onClick={() => {
              haptics.light();
              handleNavigate('design-studio-activity', 'dashboard');
            }}
          >
            View all
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
            <p className="text-2xl text-gray-900 dark:text-white mb-1">{designsGenerated}</p>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Designs Generated</p>
          </div>
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
            <p className="text-2xl text-gray-900 dark:text-white mb-1">{designsPublished}</p>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Designs Published</p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm text-gray-900 dark:text-white">Recent Activity</h4>
          {[
            { title: 'Gladiator II - Poster', type: 'Social Media Post', status: 'Published', time: '1h ago' },
            { title: 'Wicked - Instagram Story', type: 'Story Template', status: 'Rendering', time: '3h ago' },
            { title: 'Dune - Facebook Post', type: 'Social Media Post', status: 'Published', time: '6h ago' },
          ].map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
              <div>
                <p className="text-gray-900 dark:text-white">{item.title}</p>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">{item.type}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-900 dark:text-white mb-0.5">{item.status}</p>
                <p className="text-xs text-gray-500 dark:text-[#6B7280]">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Video Studio Widget */}
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Film className="w-6 h-6 text-[#ec1e24]" />
            <div>
              <h3 className="text-gray-900 dark:text-white">Video Studio</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Video generation activity</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
            onClick={() => {
              haptics.light();
              handleNavigate('video-studio-activity', 'dashboard');
            }}
          >
            View all
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
            <p className="text-2xl text-gray-900 dark:text-white mb-1">{videosGenerated}</p>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Videos Generated</p>
          </div>
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
            <p className="text-2xl text-gray-900 dark:text-white mb-1">{videosPublished}</p>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Videos Published</p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm text-gray-900 dark:text-white">Recent Activity</h4>
          {[
            { title: 'Gladiator II - Review', type: 'Video Review', status: 'Published', time: '2h ago' },
            { title: 'November 2024 Releases', type: 'Monthly Releases', status: 'Generating', time: '5h ago' },
            { title: 'Wicked - Review', type: 'Video Review', status: 'Published', time: '1d ago' },
          ].map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
              <div>
                <p className="text-gray-900 dark:text-white">{item.title}</p>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">{item.type}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-900 dark:text-white mb-0.5">{item.status}</p>
                <p className="text-xs text-gray-500 dark:text-[#6B7280]">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload Manager */}
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <HardDrive className="w-6 h-6 text-[#ec1e24]" />
            <div>
              <h3 className="text-gray-900 dark:text-white">Upload Manager</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Video upload pipeline</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
            onClick={() => {
              haptics.light();
              handleNavigate('upload-manager', 'dashboard');
            }}
          >
            View all
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
            <p className="text-2xl text-gray-900 dark:text-white mb-1">{isLoading ? <Skeleton className="h-8 w-8" /> : stats?.uploads?.activeUploads ?? 0}</p>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Active Uploads</p>
          </div>
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
            <p className="text-2xl text-gray-900 dark:text-white mb-1">{isLoading ? <Skeleton className="h-8 w-8" /> : stats?.uploads?.completedToday ?? 0}</p>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Completed Today</p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm text-gray-900 dark:text-white">Pipeline Status</h4>
          {stats?.uploads?.pipeline?.map((item: any, index: number) => (
            <div key={index} className="p-3 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">{item.fileName}</p>
                  <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">{item.stage}</p>
                </div>
                <span className="text-xs text-gray-900 dark:text-white">{item.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-[#0A0A0A] rounded-full h-1.5">
                <div
                  className="bg-[#ec1e24] h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Usage */}
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-[#ec1e24]" />
            <div>
              <h3 className="text-gray-900 dark:text-white">API Usage</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Track API usage</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
            onClick={() => {
              haptics.light();
              handleNavigate('api-usage', 'dashboard');
            }}
          >
            View all
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* OpenAI API Usage */}
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 dark:text-[#6B7280]">Today</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-0.5">
              {isLoading ? <Skeleton className="h-8 w-16" /> : (stats?.usage?.openai ?? 1247)}
            </div>
            <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">OpenAI API Usage</div>
          </div>

          {/* Serper API Usage */}
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 dark:text-[#6B7280]">Today</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-0.5">
              {isLoading ? <Skeleton className="h-8 w-12" /> : (stats?.usage?.serper ?? 892)}
            </div>
            <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">Serper API Usage</div>
          </div>

          {/* TMDb API Usage */}
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 dark:text-[#6B7280]">Today</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-0.5">
              {isLoading ? <Skeleton className="h-8 w-16" /> : (stats?.usage?.tmdb ?? 3451)}
            </div>
            <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">TMDb API Usage</div>
          </div>

          {/* Shotstack API Usage */}
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 dark:text-[#6B7280]">Today</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-0.5">
              {isLoading ? <Skeleton className="h-8 w-12" /> : (stats?.usage?.shotstack ?? 127)}
            </div>
            <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">Shotstack API Usage</div>
          </div>

          {/* Google Search API Usage */}
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 dark:text-[#6B7280]">Today</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-0.5">
              {isLoading ? <Skeleton className="h-8 w-12" /> : (stats?.usage?.googleSearch ?? 543)}
            </div>
            <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">Google Search API Usage</div>
          </div>

          {/* Google Video Intelligence API Usage */}
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 dark:text-[#6B7280]">Today</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-0.5">
              {isLoading ? <Skeleton className="h-8 w-12" /> : (stats?.usage?.googleVideo ?? 284)}
            </div>
            <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">GVI API Usage</div>
          </div>

          {/* Total API Calls */}
          <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333] col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 dark:text-[#6B7280]">Today</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-0.5">6,544</div>
            <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">Total API Calls</div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivityCard onNavigate={handleNavigate} />
    </div>
  );
}

function RecentActivityCard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { activities, isLoading } = useActivity({ limit: 5 });

  const mappedActivities = activities.map((log: any) => {
    const metadata = log.metadata || {};
    const timestamp = new Date(log.timestamp).getTime();
    return {
      id: log.id,
      title: metadata.videoTitle || log.message || 'Unknown Activity',
      platform: metadata.platform || 'System',
      status: (log.level === 'error' ? 'failed' : 'success') as 'success' | 'failed',
      time: getTimeAgo(timestamp),
      type: (metadata.type as any) || 'system',
    };
  });

  return (
    <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-900 dark:text-white">Recent Activity</h3>
        <Button
          variant="outline"
          className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
          onClick={() => {
            haptics.light();
            onNavigate('activity');
          }}
        >
          View all
        </Button>
      </div>
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-4 text-gray-500">Loading...</div>
        ) : mappedActivities.length === 0 ? (
          <div className="text-center py-4 text-gray-500">No recent activity</div>
        ) : (
          mappedActivities.map((activity, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-xl transition-colors duration-200">
              <div className="flex-1">
                <p className="text-gray-900 dark:text-white">{activity.title}</p>
                <p className="text-[#6B7280] dark:text-[#9CA3AF]">{activity.platform}</p>
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
                <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  {activity.time}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Helper needed locally if not imported or moved to util
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