import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Film, Image as ImageIcon, FileText } from 'lucide-react';
import { BackIconButton } from '../BackIconButton';
import { SwipeableActivityCard } from '../SwipeableActivityCard';
import { ActivitySelectionToolbar } from '../ActivitySelectionToolbar';
import { haptics } from '../../utils/haptics';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { useComposeStore } from '../../store/useComposeStore';
import type { ComposeItem, ComposeStatus } from '../../types/compose';

interface ComposeActivityPageProps {
  onNavigate: (page: string, fromPage?: string) => void;
  previousPage?: string | null;
}

const FILTERS: Array<{ id: 'all' | ComposeStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
  { id: 'failed', label: 'Failed' },
];

function getStatusTone(status: ComposeStatus): string {
  switch (status) {
    case 'failed':
      return 'bg-[#FEE2E2] dark:bg-[#991B1B] text-[#EF4444]';
    default:
      return 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]';
  }
}

function getLeadingIcon(status: ComposeStatus) {
  if (status === 'scheduled') return CalendarClock;
  if (status === 'published') return CheckCircle2;
  if (status === 'failed') return AlertTriangle;
  return FileText;
}

function getPrimaryAsset(item: ComposeItem) {
  return item.mediaAssets?.[0] ?? item.media;
}

export function ComposeActivityPage({ onNavigate, previousPage }: ComposeActivityPageProps) {
  const { items, deleteItem, setActiveItemId } = useComposeStore();
  const [filter, setFilter] = useState<'all' | ComposeStatus>('all');
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  const filteredItems = useMemo(
    () => items.filter((item) => (filter === 'all' ? true : item.status === filter)),
    [filter, items],
  );
  const selection = useBulkSelection(filteredItems.map((item) => item.id));

  const stats = {
    total: items.length,
    drafts: items.filter((item) => item.status === 'draft').length,
    scheduled: items.filter((item) => item.status === 'scheduled').length,
    published: items.filter((item) => item.status === 'published').length,
    failed: items.filter((item) => item.status === 'failed').length,
  };

  const handleDeleteSelected = async () => {
    if (selection.selectedCount === 0) return;

    setIsDeletingSelected(true);
    selection.selectedIds.forEach((id) => deleteItem(id));
    selection.clearSelection();
    setIsDeletingSelected(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start gap-4 mb-4">
          <BackIconButton onClick={() => onNavigate(previousPage || 'create')} className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1" />
          <div className="flex-1">
            <h1 className="text-gray-900 dark:text-white mb-2">Compose Activity</h1>
            <p className="text-[#6B7280] dark:text-[#9CA3AF]">Review drafts, scheduled items, published content, and failures from the Compose workflow.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Total Items</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Drafts</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.drafts}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Scheduled</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.scheduled}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Published</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.published}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Failed</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.failed}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
        {selection.selectionMode && (
          <ActivitySelectionToolbar
            selectedCount={selection.selectedCount}
            isDeleting={isDeletingSelected}
            onClear={selection.clearSelection}
            onDelete={handleDeleteSelected}
            itemLabel="activity items"
          />
        )}

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                haptics.light();
                setFilter(option.id);
              }}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                filter === option.id
                  ? 'bg-[#ec1e24] text-white'
                  : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-[#1F1F1F]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 p-12 text-center dark:border-[#333333]">
            <p className="text-gray-900 dark:text-white mb-2">No compose activity</p>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Items will appear here once drafts or scheduled content are created.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const LeadingIcon = getLeadingIcon(item.status);
              const primaryAsset = getPrimaryAsset(item);
              const extraAssetCount = Math.max((item.mediaAssets?.length ?? (item.media ? 1 : 0)) - 1, 0);

              return (
                <SwipeableActivityCard
                  key={item.id}
                  id={item.id}
                  onDelete={(id) => {
                    if (!id) return;
                    deleteItem(id);
                  }}
                  selectionMode={selection.selectionMode}
                  selected={selection.isSelected(item.id)}
                  onEnterSelectionMode={selection.enterSelectionMode}
                  onToggleSelection={selection.toggleSelection}
                  className="w-full text-left p-5 rounded-2xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] transition-all duration-200"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="relative mt-0.5 h-14 w-14 overflow-hidden rounded-xl bg-[#ec1e24]/10">
                          {primaryAsset?.previewUrl ? (
                            primaryAsset.kind === 'video' ? (
                              <video
                                src={primaryAsset.previewUrl}
                                className="h-full w-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={primaryAsset.previewUrl}
                                alt={primaryAsset.fileName}
                                className="h-full w-full object-cover"
                              />
                            )
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[#ec1e24]">
                              {primaryAsset?.kind === 'video' ? <Film className="h-5 w-5" /> : primaryAsset ? <ImageIcon className="h-5 w-5" /> : <LeadingIcon className="h-5 w-5" />}
                            </div>
                          )}
                          {extraAssetCount > 0 ? (
                            <span className="absolute bottom-1 right-1 rounded-full bg-black/75 px-1.5 py-0.5 text-[10px] text-white">
                              +{extraAssetCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-gray-900 dark:text-white mb-1">{item.title}</h3>
                          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-2">
                            {item.scheduledAt ? `Scheduled ${new Date(item.scheduledAt).toLocaleString()}` : `Updated ${new Date(item.updatedAt).toLocaleString()}`}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.platforms.map((platform) => (
                              <span key={platform} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-[#1F1F1F] text-gray-700 dark:text-[#9CA3AF] uppercase">
                                {platform}
                              </span>
                            ))}
                          </div>
                          {item.error ? <p className="mt-3 text-sm text-[#EF4444]">{item.error}</p> : null}
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm ${getStatusTone(item.status)}`}>
                        {item.status === 'scheduled'
                          ? 'Scheduled'
                          : item.status === 'published'
                            ? 'Published'
                            : item.status === 'failed'
                              ? 'Failed'
                              : 'Draft'}
                      </span>
                    </div>

                    {!selection.selectionMode ? (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-50 dark:border-[#333333] dark:text-white dark:hover:bg-[#111111]"
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveItemId(item.id);
                            onNavigate('compose-editor', 'create');
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    ) : null}
                  </div>
                </SwipeableActivityCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
