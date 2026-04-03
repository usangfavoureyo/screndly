import { apiClient } from './client';
import { ApiResponse } from './types';

export interface SystemStats {
  cacheHitRate: number;
  systemErrors: number;
  dailyFailures: number;
  dailySuccess: number;
}

export interface CommentReplySummary {
  id: string;
  comment: string;
  reply: string;
  platform: string;
  commentUrl?: string;
  repliedAt: string;
  username?: string;
  postTitle?: string;
}

export interface CommentStats {
  repliesToday: number;
  successRate: number;
  recentReplies: CommentReplySummary[];
  activePlatforms: number;
}

export interface VideoTrendPoint {
  date: string;
  videos: number;
}

export interface VideoRecentItem {
  id: string;
  title: string;
  channelName: string;
  publishedAt: string;
}

export interface VideoStats {
  activeChannels: number;
  dailyVideos: number;
  trends: VideoTrendPoint[];
  recentActivity: VideoRecentItem[];
}

export interface RSSFeedSummary {
  id: string;
  name: string;
  status: string;
  lastProcessedAt: string | null;
  nextRunAt: string | null;
}

export interface RSSStats {
  activeFeeds: number;
  dailyPosted: number;
  recentFeeds: RSSFeedSummary[];
}

export interface TMDbUpcomingItem {
  id: string;
  title: string;
  source: string;
  scheduledTime: string;
  dateLabel: string;
  timeLabel: string;
}

export interface TMDbStats {
  readyCount: number;
  coverageDays: number;
  upcoming: TMDbUpcomingItem[];
}

export interface DesignStudioActivitySummary {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  status: string;
}

export interface DesignStudioStats {
  generated: number;
  published: number;
  recentActivity: DesignStudioActivitySummary[];
}

export interface VideoStudioActivitySummary {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
}

export interface VideoStudioStats {
  generated: number;
  published: number;
  recentActivity: VideoStudioActivitySummary[];
}

export interface UploadPipelineItem {
  id: string;
  fileName: string;
  stage: string;
  progress: number;
  status: string;
}

export interface UploadStats {
  activeUploads: number;
  completedToday: number;
  pipeline: UploadPipelineItem[];
}

export interface ApiUsageStats {
  openai: number;
  serper: number;
  tmdb: number;
  shotstack: number;
  googleSearch: number;
  googleVideo: number;
  total: number;
}

export type ApiUsageService = keyof Omit<ApiUsageStats, 'total'>;

export interface ApiUsageSummaryRow {
  service: ApiUsageService | 'total';
  label: string;
  daily: number;
  weekly: number;
  monthly: number;
}

export interface ApiUsageActivity {
  cards: ApiUsageStats;
  summary: ApiUsageSummaryRow[];
}

export interface RecentActivityItem {
  id: string;
  title: string;
  platform: string;
  status: 'success' | 'failed';
  type: string;
  timestamp: string;
}

export interface DashboardStats {
  system: SystemStats;
  comments: CommentStats;
  video: VideoStats;
  rss: RSSStats;
  tmdb: TMDbStats;
  designStudio: DesignStudioStats;
  videoStudio: VideoStudioStats;
  uploads: UploadStats;
  usage: ApiUsageStats;
  recentActivity: RecentActivityItem[];
}

export class DashboardApi {
  async getStats(): Promise<ApiResponse<DashboardStats>> {
    return apiClient.get<DashboardStats>('/api/dashboard/stats');
  }

  async getSystemStats(): Promise<ApiResponse<SystemStats>> {
    return apiClient.get<SystemStats>('/api/dashboard/system-stats');
  }

  async getApiUsage(): Promise<ApiResponse<ApiUsageActivity>> {
    return apiClient.get<ApiUsageActivity>('/api/dashboard/api-usage');
  }
}

export const dashboardApi = new DashboardApi();
