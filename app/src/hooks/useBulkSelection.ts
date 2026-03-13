import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOptionalBackNavigation } from '../contexts/BackNavigationContext';

export function useBulkSelection(validIds: string[]) {
  const selectableIds = useMemo(() => Array.from(new Set(validIds)), [validIds]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectionModalIdRef = useRef(`bulk-selection-${Math.random().toString(36).slice(2)}`);
  const backNavigation = useOptionalBackNavigation();

  useEffect(() => {
    const validIdSet = new Set(selectableIds);
    setSelectedIds((previous) => {
      const next = previous.filter((id) => validIdSet.has(id));
      const unchanged =
        next.length === previous.length && next.every((id, index) => id === previous[index]);
      return unchanged ? previous : next;
    });
  }, [selectableIds]);

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

  const selectAll = useCallback(() => {
    if (selectableIds.length === 0) return;

    setSelectedIds((previous) => {
      const unchanged =
        previous.length === selectableIds.length &&
        previous.every((id, index) => id === selectableIds[index]);
      return unchanged ? previous : selectableIds;
    });
  }, [selectableIds]);

  const isSelected = useCallback(
    (id?: string) => {
      if (!id) return false;
      return selectedIds.includes(id);
    },
    [selectedIds]
  );

  const allSelected =
    selectableIds.length > 0 && selectedIds.length === selectableIds.length;

  useEffect(() => {
    if (!backNavigation) return;

    const selectionModalId = selectionModalIdRef.current;

    if (!allSelected && selectedIds.length === 0) {
      backNavigation.unregisterModal(selectionModalId);
      return;
    }

    backNavigation.registerModalWithCloseHandler(selectionModalId, clearSelection);

    return () => {
      backNavigation.unregisterModal(selectionModalId);
    };
  }, [allSelected, backNavigation, clearSelection, selectedIds.length]);

  return {
    selectedIds,
    selectedCount: selectedIds.length,
    selectionMode: selectedIds.length > 0,
    allSelected,
    enterSelectionMode,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
  };
}
