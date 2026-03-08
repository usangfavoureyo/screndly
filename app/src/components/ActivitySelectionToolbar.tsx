import { Button } from './ui/button';
import { haptics } from '../utils/haptics';

interface ActivitySelectionToolbarProps {
  selectedCount: number;
  isDeleting?: boolean;
  onClear: () => void;
  onDelete: () => void;
  itemLabel?: string;
}

export function ActivitySelectionToolbar({
  selectedCount,
  isDeleting = false,
  onClear,
  onDelete,
  itemLabel = 'items',
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

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#ec1e24]/30 bg-[#ec1e24]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedCount} {itemWord} selected</p>
        <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">Tap more cards to add or remove them from the selection.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleClear}
          disabled={isDeleting}
          className="border-gray-300 bg-white text-gray-900 dark:border-[#333333] dark:bg-[#000000] dark:text-white"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting || selectedCount === 0}
          className="bg-[#ec1e24] text-white hover:bg-[#d01a20]"
        >
          {isDeleting ? 'Deleting...' : 'Delete Selected'}
        </Button>
      </div>
    </div>
  );
}
