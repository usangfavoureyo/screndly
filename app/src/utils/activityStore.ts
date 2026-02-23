// Centralized activity store for tracking all user actions across the app
// Used by Video Studio Activity, Recent Activity, and Logs pages

export interface VideoStudioActivity {
  id: string;
  type: 'review' | 'monthly' | 'scenes';
  title: string;
  status: 'completed' | 'processing' | 'failed';
  timestamp: string;
  timestampMs: number;
  aspectRatio?: string;
  duration: string;
  downloads: number;
  published: boolean;
  platforms: string[];
  progress?: number;
  error?: string;
  // Scene-specific fields
  sceneStart?: string;
  sceneEnd?: string;
  sceneSource?: 'local' | 'backblaze';
  sceneSourceName?: string;
}

export interface RecentActivity {
  id: string;
  title: string;
  platform: string;
  status: 'success' | 'failed';
  time: string;
  type: 'video' | 'videostudio' | 'rss' | 'tmdb' | 'scenes' | 'designstudio';
  timestamp: number;
}

export interface LogEntry {
  id: string;
  videoTitle: string;
  platform: string;
  status: 'success' | 'failed';
  timestamp: string;
  error?: string;
  errorDetails?: string;
  type: 'video' | 'rss' | 'tmdb' | 'videostudio' | 'scenes' | 'designstudio';
}

export interface CreativeStudioActivity {
  id: string;
  type: 'render_completed' | 'render_failed' | 'creative_downloaded' | 'creative_published';
  timestamp: string;
  details: {
    templateName?: string;
    jobId?: string;
    platform?: string;
    error?: string;
  };
}

export interface DesignStudioActivity {
  id: string;
  type: 'template_uploaded' | 'design_rendered' | 'design_published' | 'template_deleted';
  timestamp: string;
  details: {
    templateName?: string;
    designId?: string;
    platforms?: string;
  };
}

// Add a new video studio activity
export function addVideoStudioActivity(activity: Omit<VideoStudioActivity, 'id' | 'timestampMs'>) {
  const id = `vsa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestampMs = Date.now();

  const newActivity: VideoStudioActivity = {
    ...activity,
    id,
    timestampMs,
  };

  // Get existing activities
  const stored = localStorage.getItem('videoStudioActivities');
  const activities: VideoStudioActivity[] = stored ? JSON.parse(stored) : [];

  // Add new activity at the beginning
  activities.unshift(newActivity);

  // Keep only last 100 activities
  if (activities.length > 100) {
    activities.splice(100);
  }

  // Save back to localStorage
  localStorage.setItem('videoStudioActivities', JSON.stringify(activities));

  return newActivity;
}

// Add a new recent activity
export async function addRecentActivity(activity: Omit<RecentActivity, 'id' | 'timestamp' | 'time'>) {
  try {
    // Push to Backend as a Log
    await apiClient.post('/api/logs', {
      level: activity.status === 'failed' ? 'error' : 'info',
      message: activity.title,
      service: activity.type || 'activity',
      metadata: {
        videoTitle: activity.title,
        platform: activity.platform,
        status: activity.status,
        type: activity.type,
        isRecentActivity: true
      }
    });
  } catch (e) {
    console.error('Failed to push activity to backend:', e);
  }

  const id = `ra_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = Date.now();
  const time = 'Just now';

  const newActivity: RecentActivity = {
    ...activity,
    id,
    timestamp,
    time,
  };

  // Get existing activities
  const stored = localStorage.getItem('recentActivities');
  const activities: RecentActivity[] = stored ? JSON.parse(stored) : [];

  // Add new activity at the beginning
  activities.unshift(newActivity);

  // Keep only last 100 activities
  if (activities.length > 100) {
    activities.splice(100);
  }

  // Save back to localStorage
  localStorage.setItem('recentActivities', JSON.stringify(activities));

  return newActivity;
}

// Add a new log entry
import { apiClient } from '../lib/api/client';

export async function addLogEntry(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
  try {
    // Push to Backend
    await apiClient.post('/api/logs', {
      level: 'info', // Default, logic can improve this
      message: entry.videoTitle, // Using videoTitle as main message for now
      service: entry.type || 'client',
      metadata: {
        videoTitle: entry.videoTitle,
        platform: entry.platform,
        status: entry.status,
        error: entry.error,
        errorDetails: entry.errorDetails,
        type: entry.type
      }
    });
  } catch (e) {
    console.error('Failed to push log to backend:', e);
  }

  const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 16).replace('T', ' ');

  const newEntry: LogEntry = {
    ...entry,
    id,
    timestamp,
  };

  // Get existing logs
  const stored = localStorage.getItem('systemLogs');
  const logs: LogEntry[] = stored ? JSON.parse(stored) : [];

  // Add new log at the beginning
  logs.unshift(newEntry);

  // Keep only last 200 logs
  if (logs.length > 200) {
    logs.splice(200);
  }

  // Save back to localStorage (Keeping this for resilience/offline support if needed, but UI now uses API)
  localStorage.setItem('systemLogs', JSON.stringify(logs));

  return newEntry;
}

// Update an existing video studio activity (for progress updates)
export function updateVideoStudioActivity(id: string, updates: Partial<VideoStudioActivity>) {
  const stored = localStorage.getItem('videoStudioActivities');
  if (!stored) return null;

  const activities: VideoStudioActivity[] = JSON.parse(stored);
  const index = activities.findIndex(a => a.id === id);

  if (index === -1) return null;

  activities[index] = {
    ...activities[index],
    ...updates,
  };

  localStorage.setItem('videoStudioActivities', JSON.stringify(activities));

  return activities[index];
}

// Get all video studio activities
export function getVideoStudioActivities(): VideoStudioActivity[] {
  const stored = localStorage.getItem('videoStudioActivities');
  return stored ? JSON.parse(stored) : [];
}

// Get all recent activities
export function getRecentActivities(): RecentActivity[] {
  const stored = localStorage.getItem('recentActivities');
  return stored ? JSON.parse(stored) : [];
}

// Get all log entries
export function getLogEntries(): LogEntry[] {
  const stored = localStorage.getItem('systemLogs');
  return stored ? JSON.parse(stored) : [];
}

// Add a new creative studio activity
export function addCreativeStudioActivity(activity: CreativeStudioActivity) {
  const stored = localStorage.getItem('creativeStudioActivities');
  const activities: CreativeStudioActivity[] = stored ? JSON.parse(stored) : [];

  activities.unshift(activity);

  // Keep only last 100 activities
  if (activities.length > 100) {
    activities.splice(100);
  }

  localStorage.setItem('creativeStudioActivities', JSON.stringify(activities));

  return activity;
}

// Get all creative studio activities
export function getCreativeStudioActivities(): CreativeStudioActivity[] {
  const stored = localStorage.getItem('creativeStudioActivities');
  return stored ? JSON.parse(stored) : [];
}

// Clear creative studio activity
export function clearCreativeStudioActivity() {
  localStorage.setItem('creativeStudioActivities', JSON.stringify([]));
}

// Add a new design studio activity
export function addDesignStudioActivity(activity: DesignStudioActivity) {
  const stored = localStorage.getItem('designStudioActivities');
  const activities: DesignStudioActivity[] = stored ? JSON.parse(stored) : [];

  activities.unshift(activity);

  // Keep only last 100 activities
  if (activities.length > 100) {
    activities.splice(100);
  }

  localStorage.setItem('designStudioActivities', JSON.stringify(activities));

  return activity;
}

// Get all design studio activities
export function getDesignStudioActivities(): DesignStudioActivity[] {
  const stored = localStorage.getItem('designStudioActivities');
  return stored ? JSON.parse(stored) : [];
}

// Clear design studio activity
export function clearDesignStudioActivity() {
  localStorage.setItem('designStudioActivities', JSON.stringify([]));
}