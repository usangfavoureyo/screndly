import { useEffect, useMemo, useRef } from 'react';

const TRANSIENT_HISTORY_KEY = '__screndlyTransient';
const SUPPRESS_POPSTATE_KEY = '__screndlySuppressTransientPopstate';

type HistoryStateRecord = Record<string, unknown>;

interface TransientHistoryPayload {
  id: string;
  kind: string;
  data?: HistoryStateRecord;
}

function getHistoryState(): HistoryStateRecord {
  if (typeof window === 'undefined') {
    return {};
  }

  return (window.history.state as HistoryStateRecord | null) ?? {};
}

function getTransientPayload(state: HistoryStateRecord | null | undefined): TransientHistoryPayload | null {
  const payload = state?.[TRANSIENT_HISTORY_KEY];
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const transientPayload = payload as Partial<TransientHistoryPayload>;
  if (typeof transientPayload.id !== 'string' || typeof transientPayload.kind !== 'string') {
    return null;
  }

  return {
    id: transientPayload.id,
    kind: transientPayload.kind,
    data: typeof transientPayload.data === 'object' && transientPayload.data !== null
      ? transientPayload.data as HistoryStateRecord
      : undefined,
  };
}

function buildNextHistoryState(id: string, kind: string, data?: HistoryStateRecord): HistoryStateRecord {
  const currentState = getHistoryState();
  return {
    ...currentState,
    ...(data ?? {}),
    [TRANSIENT_HISTORY_KEY]: {
      id,
      kind,
      data,
    },
  };
}

export function getTransientHistoryPayload(state: HistoryStateRecord | null | undefined) {
  return getTransientPayload(state);
}

export function isCurrentTransientHistoryState(id: string) {
  if (typeof window === 'undefined') {
    return false;
  }

  return getTransientPayload(getHistoryState())?.id === id;
}

export function markNextPopStateAsHandled() {
  if (typeof window === 'undefined') {
    return;
  }

  const transientWindow = window as Window & Record<string, number | undefined>;
  transientWindow[SUPPRESS_POPSTATE_KEY] = (transientWindow[SUPPRESS_POPSTATE_KEY] ?? 0) + 1;
}

export function consumeHandledPopState() {
  if (typeof window === 'undefined') {
    return false;
  }

  const transientWindow = window as Window & Record<string, number | undefined>;
  const pendingCount = transientWindow[SUPPRESS_POPSTATE_KEY] ?? 0;
  if (pendingCount <= 0) {
    return false;
  }

  transientWindow[SUPPRESS_POPSTATE_KEY] = pendingCount - 1;
  return true;
}

export function useTransientHistoryState(
  enabled: boolean,
  id: string,
  kind: string,
  data?: HistoryStateRecord,
) {
  const pushedRef = useRef(false);
  const serializedData = useMemo(() => JSON.stringify(data ?? {}), [data]);
  const stableData = useMemo<HistoryStateRecord | undefined>(() => {
    if (!serializedData || serializedData === '{}') {
      return undefined;
    }

    return JSON.parse(serializedData) as HistoryStateRecord;
  }, [serializedData]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      pushedRef.current = false;
      return;
    }

    if (!pushedRef.current) {
      window.history.pushState(buildNextHistoryState(id, kind, stableData), '', window.location.href);
      pushedRef.current = true;
      return;
    }

    if (isCurrentTransientHistoryState(id)) {
      window.history.replaceState(buildNextHistoryState(id, kind, stableData), '', window.location.href);
    }
  }, [enabled, id, kind, serializedData, stableData]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    return () => {
      if (pushedRef.current && isCurrentTransientHistoryState(id)) {
        markNextPopStateAsHandled();
        window.history.back();
      }

      pushedRef.current = false;
    };
  }, [enabled, id]);
}
