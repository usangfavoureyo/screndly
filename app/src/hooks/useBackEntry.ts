import { useEffect, useRef } from 'react';
import { type BackPressSource, useOptionalBackNavigation } from '../contexts/BackNavigationContext';

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

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!backNavigation || !enabled) {
      return;
    }

    const entryId = entryIdRef.current;
    backNavigation.registerBackEntry(entryId, priority, (source) => onBackRef.current(source));

    return () => {
      backNavigation.unregisterBackEntry(entryId);
    };
  }, [backNavigation, enabled, priority]);
}
