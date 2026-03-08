import { CalendarDays, FileText, AlertTriangle, CheckCircle2, PencilLine } from 'lucide-react';
import { Button } from '../ui/button';
import { haptics } from '../../utils/haptics';
import { useComposeStore } from '../../store/useComposeStore';
import type { ComposeItem } from '../../types/compose';

interface ComposeOverviewProps {
  onNavigate: (page: string, fromPage?: string) => void;
}

function formatItemMeta(item: ComposeItem): string {
  if (item.scheduledAt) {
    return `Scheduled ${new Date(item.scheduledAt).toLocaleString()}`;
  }

  return `Updated ${new Date(item.updatedAt).toLocaleString()}`;
}

function getStatusTone(status: ComposeItem['status']): string {
  switch (status) {
    case 'scheduled':
      return 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]';
    case 'published':
      return 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]';
    case 'failed':
      return 'bg-[#FEE2E2] dark:bg-[#991B1B] text-[#EF4444]';
    case 'draft':
    default:
      return 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]';
  }
}

export function ComposeOverview({ onNavigate }: ComposeOverviewProps) {
  const { items, setActiveItemId } = useComposeStore();

  const stats = {
    drafts: items.filter((item) => item.status === 'draft').length,
    scheduled: items.filter((item) => item.status === 'scheduled').length,
    published: items.filter((item) => item.status === 'published').length,
    pending: items.filter((item) => item.status === 'failed').length,
  };

  const handleCreate = () => {
    setActiveItemId(null);
    onNavigate('compose-editor', 'create');
  };

  const handleEdit = (itemId: string) => {
    setActiveItemId(itemId);
    onNavigate('compose-editor', 'create');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Total Drafts</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.drafts}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Scheduled Posts</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.scheduled}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Published Posts</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.published}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 transition-all duration-200">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Pending Issues</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.pending}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 transition-all duration-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Compose Queue</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Build drafts, prepare schedules, and review posting status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                haptics.light();
                onNavigate('compose-activity', 'create');
              }}
            >
              View Compose Activity
            </Button>
            <Button
              onClick={() => {
                haptics.medium();
                handleCreate();
              }}
            >
              Add Content
            </Button>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3 gap-3">
          <h3 className="text-gray-900 dark:text-white">Content Items ({items.length})</h3>
        </div>

        {items.length === 0 ? (
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-12 text-center">
            <PencilLine className="w-12 h-12 text-gray-400 dark:text-[#9CA3AF] mx-auto mb-4" />
            <h3 className="text-gray-900 dark:text-white mb-2">No compose drafts yet</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              Start a draft to prepare media, captions, and schedules in one place.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl bg-[#ec1e24]/10 p-2 text-[#ec1e24]">
                        {item.status === 'failed' ? (
                          <AlertTriangle className="h-5 w-5" />
                        ) : item.status === 'published' ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : item.status === 'scheduled' ? (
                          <CalendarDays className="h-5 w-5" />
                        ) : (
                          <FileText className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-gray-900 dark:text-white mb-1 truncate">{item.title}</h4>
                        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-2">
                          {formatItemMeta(item)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {item.platforms.map((platform) => (
                            <span
                              key={platform}
                              className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-[#1F1F1F] text-gray-700 dark:text-[#9CA3AF] uppercase"
                            >
                              {platform}
                            </span>
                          ))}
                        </div>
                        {item.error ? (
                          <p className="mt-3 text-sm text-[#EF4444]">{item.error}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end">
                    <span className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm ${getStatusTone(item.status)}`}>
                      {item.status === 'scheduled'
                        ? 'Scheduled'
                        : item.status === 'published'
                          ? 'Published'
                          : item.status === 'failed'
                            ? 'Failed'
                            : 'Draft'}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        haptics.light();
                        handleEdit(item.id);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
