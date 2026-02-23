import { useState } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { haptics } from '../../utils/haptics';

interface QueueItem {
  id: string;
  feedName: string;
  title: string;
  status: 'queued' | 'enriched' | 'captioned' | 'published' | 'failed';
  timestamp: string;
  platforms?: string[];
  error?: string;
}

interface QueueWidgetProps {
  items: QueueItem[];
  onItemClick: (id: string) => void;
  onNavigateToLogs: () => void;
}

export function QueueWidget({ items, onItemClick, onNavigateToLogs }: QueueWidgetProps) {
  const [filter, setFilter] = useState<'all' | 'failures' | 'published' | 'pending'>('all');

  const filteredItems = items.filter((item) => {
    if (filter === 'failures') return item.status === 'failed';
    if (filter === 'published') return item.status === 'published';
    if (filter === 'pending') return item.status === 'queued' || item.status === 'enriched' || item.status === 'captioned';
    return true;
  });

  const getStatusConfig = (status: QueueItem['status']) => {
    switch (status) {
      case 'queued':
        return { icon: Clock, color: 'text-gray-500 dark:text-[#9CA3AF]', bg: 'bg-gray-100 dark:bg-[#374151]', label: 'Queued' };
      case 'enriched':
        return { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Enriched' };
      case 'captioned':
        return { icon: Clock, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', label: 'Captioned' };
      case 'published':
        return { icon: CheckCircle, color: 'text-[#10B981]', bg: 'bg-[#D1FAE5] dark:bg-[#065F46]', label: 'Published' };
      case 'failed':
        return { icon: XCircle, color: 'text-[#EF4444]', bg: 'bg-[#FEE2E2] dark:bg-[#991B1B]', label: 'Failed' };
    }
  };

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-900 dark:text-white">Recent Activity</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            haptics.light();
            onNavigateToLogs();
          }}
          className="text-[#ec1e24] hover:text-[#ec1e24]/80 text-sm"
        >
          View all logs
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {[
          { value: 'all', label: 'All' },
          { value: 'failures', label: 'Failures' },
          { value: 'published', label: 'Published' },
          { value: 'pending', label: 'Pending' },
        ].map((filterOption) => (
          <button
            key={filterOption.value}
            onClick={() => {
              haptics.light();
              setFilter(filterOption.value as any);
            }}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
              filter === filterOption.value
                ? 'bg-[#ec1e24] text-white'
                : 'bg-gray-100 dark:bg-[#111111] text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-[#1F1F1F]'
            }`}
          >
            {filterOption.label}
          </button>
        ))}
      </div>

      {/* Items List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-[#6B7280] dark:text-[#9CA3AF]">
            No items to display
          </div>
        ) : (
          filteredItems.map((item) => {
            const statusConfig = getStatusConfig(item.status);
            const StatusIcon = statusConfig.icon;

            return (
              <button
                key={item.id}
                onClick={() => {
                  haptics.light();
                  onItemClick(item.id);
                }}
                className="w-full text-left p-3 rounded-xl bg-gray-50 dark:bg-[#111111] hover:bg-gray-100 dark:hover:bg-[#1F1F1F] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-white text-sm truncate mb-1">{item.title}</p>
                    <div className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      <span>{item.feedName}</span>
                      <span>•</span>
                      <span>{item.timestamp}</span>
                    </div>
                    {item.platforms && item.platforms.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {item.platforms.map((platform) => (
                          <span
                            key={platform}
                            className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-[#1F1F1F] text-gray-700 dark:text-[#9CA3AF]"
                          >
                            {platform}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.error && (
                      <p className="text-xs text-[#EF4444] mt-1 line-clamp-1">{item.error}</p>
                    )}
                  </div>
                  <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs flex-shrink-0 ${statusConfig.bg} ${statusConfig.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusConfig.label}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}