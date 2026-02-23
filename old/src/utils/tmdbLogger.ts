/**
 * TMDb Feed Logging Utility
 * 
 * Tracks all TMDb feed operations including generation,
 * updates, deletions, and posting activities.
 */

export interface TMDbLogEntry {
  id: string;
  feedId?: string;
  videoTitle: string;
  platform: string;
  status: 'success' | 'failed';
  timestamp: string;
  error?: string;
  errorDetails?: string;
  type: 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary' | 'tmdb_action';
  action?: 'generated' | 'updated' | 'deleted' | 'posted' | 'scheduled' | 'caption_edited' | 'image_changed' | 'rescheduled';
  metadata?: {
    tmdbId?: number;
    mediaType?: 'movie' | 'tv';
    year?: number;
    imageType?: 'poster' | 'backdrop';
    scheduledTime?: string;
  };
}

const STORAGE_KEY = 'screndly_tmdb_logs';
const MAX_LOGS = 500; // Keep last 500 logs

/**
 * Get all TMDb logs from localStorage
 */
export function getTMDbLogs(): TMDbLogEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading TMDb logs:', error);
    return [];
  }
}

/**
 * Add a new TMDb log entry
 */
export function addTMDbLog(entry: Omit<TMDbLogEntry, 'id' | 'timestamp'>): void {
  const logs = getTMDbLogs();
  
  const newEntry: TMDbLogEntry = {
    ...entry,
    id: `tmdb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
  };
  
  // Add to beginning of array (most recent first)
  logs.unshift(newEntry);
  
  // Keep only MAX_LOGS entries
  const trimmedLogs = logs.slice(0, MAX_LOGS);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedLogs));
  } catch (error) {
    console.error('Error saving TMDb log:', error);
  }
}

/**
 * Log feed generation
 */
export function logFeedGeneration(
  title: string,
  feedType: 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary',
  platforms: string[],
  metadata?: TMDbLogEntry['metadata']
): void {
  platforms.forEach(platform => {
    addTMDbLog({
      videoTitle: title,
      platform,
      status: 'success',
      type: feedType,
      action: 'generated',
      metadata,
    });
  });
}

/**
 * Log feed update (caption edit, image change, etc.)
 */
export function logFeedUpdate(
  feedId: string,
  title: string,
  action: 'caption_edited' | 'image_changed' | 'rescheduled',
  platform: string = 'System',
  metadata?: TMDbLogEntry['metadata']
): void {
  addTMDbLog({
    feedId,
    videoTitle: title,
    platform,
    status: 'success',
    type: 'tmdb_action',
    action,
    metadata,
  });
}

/**
 * Log feed deletion
 */
export function logFeedDeletion(
  feedId: string,
  title: string,
  platform: string = 'System',
  metadata?: TMDbLogEntry['metadata']
): void {
  addTMDbLog({
    feedId,
    videoTitle: title,
    platform,
    status: 'success',
    type: 'tmdb_action',
    action: 'deleted',
    metadata,
  });
}

/**
 * Log successful post
 */
export function logFeedPost(
  feedId: string,
  title: string,
  platform: string,
  feedType: 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary',
  metadata?: TMDbLogEntry['metadata']
): void {
  addTMDbLog({
    feedId,
    videoTitle: title,
    platform,
    status: 'success',
    type: feedType,
    action: 'posted',
    metadata,
  });
}

/**
 * Log failed post
 */
export function logFeedPostError(
  feedId: string,
  title: string,
  platform: string,
  feedType: 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary',
  error: string,
  errorDetails?: string,
  metadata?: TMDbLogEntry['metadata']
): void {
  addTMDbLog({
    feedId,
    videoTitle: title,
    platform,
    status: 'failed',
    type: feedType,
    action: 'posted',
    error,
    errorDetails,
    metadata,
  });
}

/**
 * Get recent TMDb activity for dashboard
 */
export function getRecentTMDbActivity(limit: number = 10): Array<{
  title: string;
  platform: string;
  status: 'success' | 'failed';
  time: string;
  type: string;
}> {
  const logs = getTMDbLogs().slice(0, limit);
  
  return logs.map(log => ({
    title: log.videoTitle,
    platform: log.platform,
    status: log.status,
    time: formatTimestamp(log.timestamp),
    type: formatFeedType(log.type, log.action),
  }));
}

/**
 * Format timestamp to relative time
 */
function formatTimestamp(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

/**
 * Format feed type for display
 */
function formatFeedType(
  type: TMDbLogEntry['type'],
  action?: TMDbLogEntry['action']
): string {
  const typeMap: Record<string, string> = {
    tmdb_today: "Today's Release",
    tmdb_weekly: 'Weekly',
    tmdb_monthly: 'Monthly',
    tmdb_anniversary: 'Anniversary',
    tmdb_action: 'TMDb Action',
  };
  
  const actionMap: Record<string, string> = {
    generated: 'Generated',
    updated: 'Updated',
    deleted: 'Deleted',
    posted: 'Posted',
    scheduled: 'Scheduled',
    caption_edited: 'Caption Edited',
    image_changed: 'Image Changed',
    rescheduled: 'Rescheduled',
  };
  
  const base = typeMap[type] || type;
  if (action) {
    return `${base} - ${actionMap[action] || action}`;
  }
  
  return base;
}

/**
 * Clear all TMDb logs
 */
export function clearTMDbLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing TMDb logs:', error);
  }
}

/**
 * Get TMDb log statistics
 */
export function getTMDbLogStats(): {
  total: number;
  successful: number;
  failed: number;
  today: number;
  weekly: number;
  monthly: number;
  anniversary: number;
} {
  const logs = getTMDbLogs();
  
  return {
    total: logs.length,
    successful: logs.filter(l => l.status === 'success').length,
    failed: logs.filter(l => l.status === 'failed').length,
    today: logs.filter(l => l.type === 'tmdb_today').length,
    weekly: logs.filter(l => l.type === 'tmdb_weekly').length,
    monthly: logs.filter(l => l.type === 'tmdb_monthly').length,
    anniversary: logs.filter(l => l.type === 'tmdb_anniversary').length,
  };
}