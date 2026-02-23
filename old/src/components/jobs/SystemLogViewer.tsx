import { useState } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, Trash2, Filter, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { useJobsStore, JobEvent } from '../../store/useJobsStore';
import { haptics } from '../../utils/haptics';
import { cn } from '../ui/utils';
import { EmptyState } from './EmptyStates';

export function SystemLogViewer() {
  const { systemLogs, clearSystemLogs } = useJobsStore();
  const [filter, setFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'success'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [jobIdFilter, setJobIdFilter] = useState('');

  const getSeverityIcon = (severity: JobEvent['severity']) => {
    switch (severity) {
      case 'info':
        return <Info className="w-4 h-4 text-blue-600 dark:text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-500" />;
    }
  };

  const getSeverityBadgeColor = (severity: JobEvent['severity']) => {
    switch (severity) {
      case 'info':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'warning':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'error':
        return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'success':
        return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const handleClearLogs = () => {
    haptics.medium();
    if (confirm('Are you sure you want to clear all system logs? This action cannot be undone.')) {
      clearSystemLogs();
    }
  };

  const filteredLogs = systemLogs.filter(log => {
    // Filter by severity
    if (filter !== 'all' && log.severity !== filter) return false;

    // Filter by search query
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) {
      if (!log.details?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    // Filter by job ID
    if (jobIdFilter && !log.details?.includes(jobIdFilter)) return false;

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-gray-900 dark:text-white">System Logs</h3>
          <p className="text-sm text-gray-600 dark:text-[#9CA3AF] mt-1">
            {systemLogs.length} total logs • {filteredLogs.length} visible
          </p>
        </div>
        <Button
          onClick={handleClearLogs}
          variant="outline"
          size="sm"
          disabled={systemLogs.length === 0}
          className="border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear Logs
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Severity Filter */}
        <div className="space-y-2">
          <label className="text-sm text-gray-600 dark:text-[#9CA3AF]">Severity</label>
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'info', 'warning', 'error', 'success'] as const).map(severity => (
              <Button
                key={severity}
                onClick={() => {
                  haptics.light();
                  setFilter(severity);
                }}
                variant={filter === severity ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  filter === severity
                    ? 'bg-[#ec1e24] hover:bg-[#d01a1f] text-white'
                    : 'border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]'
                )}
              >
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="space-y-2">
          <label className="text-sm text-gray-600 dark:text-[#9CA3AF]">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#666666]" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Job ID Filter */}
        <div className="space-y-2">
          <label className="text-sm text-gray-600 dark:text-[#9CA3AF]">Job ID</label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#666666]" />
            <Input
              placeholder="Filter by Job ID..."
              value={jobIdFilter}
              onChange={(e) => setJobIdFilter(e.target.value)}
              className="pl-10 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Logs List */}
      {filteredLogs.length === 0 ? (
        <EmptyState type="no-results" onAction={() => {
          setFilter('all');
          setSearchQuery('');
          setJobIdFilter('');
        }} />
      ) : (
        <ScrollArea className="h-[600px] border border-gray-200 dark:border-[#333333] rounded-lg">
          <div className="p-4 space-y-2">
            {filteredLogs.map(log => (
              <div
                key={log.id}
                className="p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg hover:border-gray-300 dark:hover:border-[#444444] transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="mt-0.5">
                    {getSeverityIcon(log.severity)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={cn('text-xs', getSeverityBadgeColor(log.severity))}
                      >
                        {log.severity}
                      </Badge>
                      <span className="text-xs text-gray-500 dark:text-[#6B7280]">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {log.message}
                    </p>
                    {log.details && (
                      <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-1 font-mono">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
