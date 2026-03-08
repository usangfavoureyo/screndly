import { useCallback, useEffect, useState } from 'react';

export function useBulkSelection(validIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const validIdSet = new Set(validIds);
    setSelectedIds((previous) => {
      const next = previous.filter((id) => validIdSet.has(id));
      const unchanged =
        next.length === previous.length && next.every((id, index) => id === previous[index]);
      return unchanged ? previous : next;
    });
  }, [validIds]);

  const enterSelectionMode = useCallback((id?: string) => {
    if (!id) return;
    setSelectedIds((previous) => (previous.includes(id) ? previous : [...previous, id]));
  }, []);

  const toggleSelection = useCallback((id?: string) => {
    if (!id) return;
    setSelectedIds((previous) =>
      previous.includes(id) ? previous.filter((entryId) => entryId !== id) : [...previous, id]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const isSelected = useCallback(
    (id?: string) => {
      if (!id) return false;
      return selectedIds.includes(id);
    },
    [selectedIds]
  );

  return {
    selectedIds,
    selectedCount: selectedIds.length,
    selectionMode: selectedIds.length > 0,
    enterSelectionMode,
    toggleSelection,
    clearSelection,
    isSelected,
  };
}
