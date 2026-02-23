// ============================================================================
// API TYPE DEFINITIONS
// ============================================================================
// This file contains all type definitions for API requests and responses
// Use these types to ensure type safety across the application

// ----------------------------------------------------------------------------
// Common Types
// ----------------------------------------------------------------------------

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ----------------------------------------------------------------------------
// YouTube API Types
// ----------------------------------------------------------------------------

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface YouTubeUploadRequest {
  title: string;
  description: string;
  videoFile: File | string; // File object or URL
  tags?: string[];
  category?: string;
  privacy?: 'public' | 'private' | 'unlisted';
  thumbnail?: File;
}

export interface YouTubeUploadResponse {
  videoId: string;
  url: string;
  status: 'uploaded' | 'processing' | 'published';
}

export interface YouTubeComment {
  id: string;
  videoId: string;
  authorName: string;
  authorChannelId: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  isReply: boolean;
  parentId?: string;
}

export interface YouTubeCommentReplyRequest {
  commentId: string;
  text: string;
}

// ----------------------------------------------------------------------------
// OpenAI API Types
// ----------------------------------------------------------------------------

export interface OpenAICompletionRequest {
  model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'gpt-4' | 'gpt-3.5-turbo';
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  response_format?: {
    type: 'json_object' | 'text';
  };
  functions?: any[];
}

export interface OpenAICompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ----------------------------------------------------------------------------
// TMDb API Types
// ----------------------------------------------------------------------------

export interface TMDbMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  popularity: number;
}

export interface TMDbSearchRequest {
  query: string;
  page?: number;
  year?: number;
  include_adult?: boolean;
}

export interface TMDbFeed {
  id: string;
  type: 'upcoming' | 'now_playing' | 'popular' | 'top_rated' | 'trending';
  interval: string; // cron expression
  enabled: boolean;
  lastRun?: string;
}

// ----------------------------------------------------------------------------
// Shotstack API Types
// ----------------------------------------------------------------------------

export interface ShotstackJobRequest {
  prompt: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  duration: number; // in seconds
  segments: ShotstackSegment[];
  audioRules?: ShotstackAudioRules;
  captionTemplate?: string;
}

export interface ShotstackSegment {
  startTime: number; // in seconds
  endTime: number;
  text: string;
  keywords?: string[];
  voiceover?: {
    text: string;
    voice: string;
  };
}

export interface ShotstackAudioRules {
  ducking: {
    enabled: boolean;
    reduction: number; // 0-100 percentage
    duringVoiceover: boolean;
  };
  backgroundMusic: {
    enabled: boolean;
    genre?: string;
    intensity?: 'low' | 'medium' | 'high';
  };
}

export interface ShotstackJobResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  estimatedCompletion?: string;
}

export interface ShotstackJobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep?: string;
  outputUrl?: string;
  previewUrl?: string;
  error?: string;
}

// ----------------------------------------------------------------------------
// Video Studio Types
// ----------------------------------------------------------------------------

export interface VideoStudioJobRequest {
  title: string;
  type: 'video_review' | 'monthly_releases';
  config: VideoStudioConfig;
  captionTemplate?: CaptionTemplate;
}

export interface VideoStudioConfig {
  aspectRatio: '16:9' | '9:16' | '1:1';
  duration: number;
  segments: ShotstackSegment[];
  audioRules: ShotstackAudioRules;
  llmModel: string;
  llmTemperature: number;
  llmMaxTokens: number;
}

export interface CaptionTemplate {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  position: 'top' | 'middle' | 'bottom';
  animation?: 'none' | 'fade' | 'slide' | 'typewriter';
}

// ----------------------------------------------------------------------------
// RSS Feed Types
// ----------------------------------------------------------------------------

export interface RSSFeed {
  id: string;
  url: string;
  title: string;
  enabled: boolean;
  lastFetched?: string;
  itemCount: number;
}

export interface RSSItem {
  id: string;
  feedId: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  imageUrl?: string;
  posted: boolean;
  platforms: string[];
}

export interface RSSPostRequest {
  itemId: string;
  platforms: Array<'x' | 'threads' | 'facebook' | 'instagram' | 'youtube'>;
  customText?: string;
  imageCount?: number;
}

// ----------------------------------------------------------------------------
// Analytics Types
// ----------------------------------------------------------------------------

export interface AnalyticsData {
  period: 'day' | 'week' | 'month';
  metrics: {
    uploads: number;
    views: number;
    engagement: number;
    comments: number;
    shares: number;
  };
  trends: {
    uploadsChange: number;
    viewsChange: number;
    engagementChange: number;
  };
}

// ----------------------------------------------------------------------------
// WebSocket Event Types
// ----------------------------------------------------------------------------

export interface WebSocketEvent {
  type: WebSocketEventType;
  payload: any;
  timestamp: string;
}

export type WebSocketEventType =
  | 'job_status_update'
  | 'notification'
  | 'upload_progress'
  | 'comment_received'
  | 'error';

export interface JobStatusUpdateEvent {
  type: 'job_status_update';
  payload: {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    message?: string;
    outputUrl?: string;
  };
}

export interface UploadProgressEvent {
  type: 'upload_progress';
  payload: {
    uploadId: string;
    progress: number;
    bytesUploaded: number;
    totalBytes: number;
  };
}
