import { useEffect, useRef } from 'react';
import { type BackPressSource, useOptionalBackNavigation } from '../contexts/BackNavigationContext';
import { useTransientHistoryState } from './useTransientHistoryState';

interface UseBackEntryOptions {
  enabled?: boolean;
  id?: string;
  priority?: number;
  onBack: (source: BackPressSource) => boolean;
}

export function useBackEntry({
  enabled = true,
  id,
  priority = 0,
  onBack,
}: UseBackEntryOptions) {
  const backNavigation = useOptionalBackNavigation();
  const entryIdRef = useRef(id ?? `back-entry-${Math.random().toString(36).slice(2)}`);
  const onBackRef = useRef(onBack);
  const rearmTransientHistoryState = useTransientHistoryState(enabled, entryIdRef.current, 'back-entry');

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!backNavigation || !enabled) {
      return;
    }

    const entryId = entryIdRef.current;
    backNavigation.registerBackEntry(entryId, priority, (source) => {
      const handled = onBackRef.current(source);
      if (handled && source === 'system') {
        rearmTransientHistoryState();
      }
      return handled;
    });

    return () => {
      backNavigation.unregisterBackEntry(entryId);
    };
  }, [backNavigation, enabled, priority, rearmTransientHistoryState]);
}
