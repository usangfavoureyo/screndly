import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { BackIconButton } from './BackIconButton';
import { SwipeableLogRow } from './SwipeableLogRow';
import { useUndo } from './UndoContext';
import { useSettings } from '../contexts/SettingsContext';
import { useActivity } from '../hooks/useActivity';
import { apiClient } from '../lib/api/client';
import { toast } from 'sonner';

export interface LogEntry {
  id: string;
  videoTitle: string;
  platform: string;
  status: 'success' | 'failed';
  timestamp: string;
  error?: string;
  errorDetails?: string;
  type: 'video' | 'rss' | 'tmdb' | 'videostudio' | 'scenes' | 'system';
}



interface LogsPageProps {
  onNewNotification?: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (page: string) => void;
}

export function LogsPage({ onNewNotification, onNavigate }: LogsPageProps) {
  const { showUndo } = useUndo();
  const { settings } = useSettings();

  const { activities: logs, isLoading, refresh } = useActivity();
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const logsPerPage = 10;

  // Get retention period from settings (default 168 hours / 7 days)
  const retentionHours = Number(settings.videoActivityRetention ?? 168);
  const retentionMs = retentionHours * 60 * 60 * 1000; // Convert to milliseconds
  void onNewNotification;
  void isLoading;

  const platformUrls: Record<string, string> = {
    Instagram: 'https://www.instagram.com/screenrender',
    Threads: 'https://www.threads.com/@screenrender',
    Facebook: 'https://www.facebook.com/share/1A9AkTvUBA/',
    TikTok: 'https://www.tiktok.com/@screenrender?_r=1&_t=ZS-91QmcxgxZy5',
    YouTube: 'https://youtube.com/@screenrender?si=4iacQp4_QN8s5WaS',
    X: 'https://x.com/screenrender?t=KPASOaPQopdLqqmd-9JSuQ&s=09',
  };

  const handleDelete = async (logId: string) => {
    haptics.medium();
    const deletedLog = mappedLogs.find((log) => log.id === logId);
    if (!deletedLog) return;

    setDeletedIds((prev) => [...prev, logId]);

    showUndo({
      id: logId,
      itemName: deletedLog.videoTitle || 'Log entry',
      onUndo: () => {
        setDeletedIds((prev) => prev.filter((id) => id !== logId));
      },
      onConfirm: async () => {
        try {
          const response = await apiClient.delete(`/api/logs/${logId}`);
          if (!response.success) {
            throw new Error(response.error?.message || 'Failed to delete log');
          }
          toast.success('Log deleted');
          void refresh();
        } catch (error) {
          console.error('Failed to delete log', error);
          setDeletedIds((prev) => prev.filter((id) => id !== logId));
          toast.error(error instanceof Error ? error.message : 'Failed to delete log');
        }
      }
    });
  };

  // Transform ActivityLog from hook to LogEntry for display
  // Use useMemo to avoid re-calculating on every render
  const mappedLogs = useMemo<LogEntry[]>(() => {
    return logs
      .filter((log: any) => !deletedIds.includes(log.id))
      .map((log: any) => {
      // Try to extract metadata if it exists
      const metadata = log.metadata || {};

      return {
        id: log.id,
        videoTitle: metadata.videoTitle || log.message || 'Unknown Title',
        platform: metadata.platform || 'System',
        status: (log.level === 'error' ? 'failed' : 'success') as 'success' | 'failed',
        timestamp: new Date(log.timestamp).toISOString().replace('T', ' ').substring(0, 16),
        error: log.level === 'error' ? log.message : undefined,
        errorDetails: metadata.errorDetails,
        type: (metadata.type as LogEntry['type']) || 'system',
      };
    });
  }, [logs, deletedIds]);

  const filteredLogs = mappedLogs
    .filter(log => {
      // Existing filters...
      const logDate = new Date(log.timestamp);
      // Retention check (simplified)
      const now = new Date();
      if ((now.getTime() - logDate.getTime()) > retentionMs) return false;

      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      if (platformFilter !== 'all' && log.platform !== platformFilter) return false;
      if (typeFilter !== 'all' && log.type !== typeFilter) return false;

      // Time filter
      if (timeFilter !== 'all') {

        switch (timeFilter) {
          case 'last-hour':
            if (logDate < new Date(now.getTime() - 60 * 60 * 1000)) return false;
            break;
          case 'last-24h':
            if (logDate < new Date(now.getTime() - 24 * 60 * 60 * 1000)) return false;
            break;
          case 'last-7d':
            if (logDate < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) return false;
            break;
          case 'last-30d':
            if (logDate < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) return false;
            break;
        }
      }

      return true;
    });

  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const startIndex = (currentPage - 1) * logsPerPage;
  const displayedLogs = filteredLogs.slice(startIndex, startIndex + logsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        {onNavigate && (
          <BackIconButton
            onClick={() => onNavigate('dashboard')}
            className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
            ariaLabel="Back to dashboard"
          />
        )}
        <div>
          <h1 className="text-gray-900 dark:text-white mb-2">Logs Activity</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">View recent automation jobs and their status.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                haptics.light();
                setTypeFilter(value);
              }}
              onOpenChange={(open) => {
                if (!open) haptics.light(); // Haptic on collapse
              }}
            >
              <SelectTrigger className="rounded-lg border-gray-200 dark:border-[#333333]">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="rss">RSS</SelectItem>
                <SelectItem value="tmdb">TMDb Feeds</SelectItem>
                <SelectItem value="videostudio">Video Studio</SelectItem>
                <SelectItem value="scenes">Scenes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                haptics.light();
                setStatusFilter(value);
              }}
              onOpenChange={(open) => {
                if (!open) haptics.light(); // Haptic on collapse
              }}
            >
              <SelectTrigger className="rounded-lg border-gray-200 dark:border-[#333333]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select
              value={platformFilter}
              onValueChange={(value) => {
                haptics.light();
                setPlatformFilter(value);
              }}
              onOpenChange={(open) => {
                if (!open) haptics.light(); // Haptic on collapse
              }}
            >
              <SelectTrigger className="rounded-lg border-gray-200 dark:border-[#333333]">
                <SelectValue placeholder="All Platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="Instagram">Instagram</SelectItem>
                <SelectItem value="X">X</SelectItem>
                <SelectItem value="TikTok">TikTok</SelectItem>
                <SelectItem value="Threads">Threads</SelectItem>
                <SelectItem value="YouTube">YouTube</SelectItem>
                <SelectItem value="Facebook">Facebook</SelectItem>
                <SelectItem value="Pinterest">Pinterest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select
              value={timeFilter}
              onValueChange={(value) => {
                haptics.light();
                setTimeFilter(value);
              }}
              onOpenChange={(open) => {
                if (!open) haptics.light(); // Haptic on collapse
              }}
            >
              <SelectTrigger className="rounded-lg border-gray-200 dark:border-[#333333]">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="last-hour">Last Hour</SelectItem>
                <SelectItem value="last-24h">Last 24 Hours</SelectItem>
                <SelectItem value="last-7d">Last 7 Days</SelectItem>
                <SelectItem value="last-30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[600px] touch-pan-x touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full">
            <thead className="border-b border-gray-200 dark:border-[#374151] sticky top-0 bg-white dark:bg-[#000000] z-10">
              <tr>
                <th className="text-left p-4 text-[#6B7280] dark:text-[#9CA3AF]">Content</th>
                <th className="text-left p-4 text-[#6B7280] dark:text-[#9CA3AF]">Source</th>
                <th className="text-left p-4 text-[#6B7280] dark:text-[#9CA3AF]">Platform</th>
                <th className="text-left p-4 text-[#6B7280] dark:text-[#9CA3AF]">Status</th>
                <th className="text-left p-4 text-[#6B7280] dark:text-[#9CA3AF]">Timestamp</th>
                <th className="text-left p-4 text-[#6B7280] dark:text-[#9CA3AF]">Error</th>
                <th className="text-left p-4 text-[#6B7280] dark:text-[#9CA3AF]">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedLogs.map((log) => (
                <SwipeableLogRow
                  key={log.id}
                  log={log}
                  onDelete={handleDelete}
                  platformUrls={platformUrls}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-[#374151]">
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">
            Showing {startIndex + 1} to {Math.min(startIndex + logsPerPage, filteredLogs.length)} of {filteredLogs.length} results
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                haptics.light();
                setCurrentPage(prev => Math.max(1, prev - 1));
              }}
              disabled={currentPage === 1}
              className="rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                haptics.light();
                setCurrentPage(prev => Math.min(totalPages, prev + 1));
              }}
              disabled={currentPage === totalPages}
              className="rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
