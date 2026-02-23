import { apiClient } from './client';
import { ApiResponse } from './types';

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface SystemStats {
    cacheHitRate: number;
    systemErrors: number;
    dailyFailures: number;
    dailySuccess: number;
}

export interface CommentStats {
    repliesToday: number;
    successRate: number;
    recentReplies: Array<{
        comment: string;
        reply: string;
        platform: string;
    }>;
}

export interface UploadStats {
    activeUploads: number;
    completedToday: number;
    pipeline: Array<{
        title: string;
        stage: string;
        progress: number;
    }>;
}

export interface ApiUsageStats {
    openai: number;
    serper: number;
    tmdb: number;
    shotstack: number;
    googleSearch: number;
    googleVideo: number;
}

export interface DashboardStats {
    system: SystemStats;
    comments: CommentStats;
    uploads: UploadStats;
    usage: ApiUsageStats;
}

// ============================================================================
// DASHBOARD API CLIENT
// ============================================================================

export class DashboardApi {
    /**
     * Get aggregated dashboard stats
     * In a real app, this might be a single endpoint or parallel calls
     */
    async getStats(): Promise<ApiResponse<DashboardStats>> {
        return apiClient.get<DashboardStats>('/dashboard/stats');
    }

    /**
     * Get system logs stats
     */
    async getSystemStats(): Promise<ApiResponse<SystemStats>> {
        return apiClient.get<SystemStats>('/dashboard/system-stats');
    }

    /**
     * Get comment automation stats
     */
    async getCommentStats(): Promise<ApiResponse<CommentStats>> {
        return apiClient.get<CommentStats>('/dashboard/comment-stats');
    }

    /**
     * Get upload manager stats
     */
    async getUploadStats(): Promise<ApiResponse<UploadStats>> {
        return apiClient.get<UploadStats>('/dashboard/upload-stats');
    }

    /**
     * Get API usage stats
     */
    async getApiUsage(): Promise<ApiResponse<ApiUsageStats>> {
        return apiClient.get<ApiUsageStats>('/dashboard/api-usage');
    }
}

export const dashboardApi = new DashboardApi();
