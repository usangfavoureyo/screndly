import { Button } from './ui/button';
import { createPortal } from 'react-dom';
import { haptics } from '../utils/haptics';

interface ActivitySelectionToolbarProps {
  selectedCount: number;
  isDeleting?: boolean;
  allSelected?: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
  itemLabel?: string;
  mobilePortalClassName?: string;
}

export function ActivitySelectionToolbar({
  selectedCount,
  isDeleting = false,
  allSelected = false,
  onSelectAll,
  onClear,
  onDelete,
  itemLabel = 'items',
  mobilePortalClassName = '',
}: ActivitySelectionToolbarProps) {
  const itemWord = selectedCount === 1 ? itemLabel.replace(/s$/, '') : itemLabel;
  const handleClear = () => {
    haptics.light();
    onClear();
  };

  const handleDelete = () => {
    haptics.medium();
    onDelete();
  };

  const handleSelectAll = () => {
    haptics.light();
    onSelectAll();
  };

  const toolbarContent = (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-white lg:text-gray-900 dark:text-white">{selectedCount} {itemWord} selected</p>
        <p className="text-xs text-gray-300 lg:text-gray-600 dark:text-[#9CA3AF]">Tap more cards to add or remove them from the selection.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleSelectAll}
          disabled={isDeleting || allSelected}
          className="border-gray-300 bg-white text-gray-900 dark:border-[#333333] dark:bg-[#000000] dark:text-white"
        >
          {allSelected ? 'All Selected' : 'Select All'}
        </Button>
        <Button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting || selectedCount === 0}
          className="bg-[#ec1e24] text-white hover:bg-[#d01a20]"
        >
          {isDeleting ? 'Deleting...' : 'Delete Selected'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleClear}
          disabled={isDeleting}
          className="border-gray-300 bg-white text-gray-900 dark:border-[#333333] dark:bg-[#000000] dark:text-white"
        >
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="mb-4 hidden rounded-2xl border border-[#ec1e24]/30 bg-[#ec1e24]/5 p-4 lg:block">
        {toolbarContent}
      </div>
      {typeof document !== 'undefined' && createPortal(
        <div className={`pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-40 lg:hidden ${mobilePortalClassName}`}>
          <div className="pointer-events-auto rounded-2xl border border-[#ec1e24]/30 bg-[#120304]/95 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-sm">
            {toolbarContent}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
