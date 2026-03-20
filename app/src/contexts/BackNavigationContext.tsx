/**
 * BackNavigationContext - PWA-friendly transient back-state handler.
 *
 * Browser history remains the source of truth for route navigation.
 * This context only manages transient UI states that should close before
 * allowing the underlying route/history change to take effect.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { consumeHandledPopState } from '../hooks/useTransientHistoryState';

interface ChildPage {
  page: string;
  source: string;
}

export type BackPressSource = 'system' | 'escape' | 'programmatic';

interface BackEntry {
  id: string;
  priority: number;
  handler: (source: BackPressSource) => boolean;
}

interface BackNavigationContextType {
  activeBottomSheets: string[];
  activeModals: string[];
  childPageStack: ChildPage[];
  overlaySource: string | null;
  currentPage: string;
  rootPageHistory: string[];
  registerBottomSheet: (id: string) => void;
  registerBottomSheetWithCloseHandler: (id: string, closeHandler: (source: BackPressSource) => void) => void;
  unregisterBottomSheet: (id: string) => void;
  closeTopBottomSheet: (source?: BackPressSource) => boolean;
  registerModal: (id: string) => void;
  registerModalWithCloseHandler: (id: string, closeHandler: () => void) => void;
  unregisterModal: (id: string) => void;
  closeTopModal: () => boolean;
  registerBackEntry: (id: string, priority: number, handler: (source: BackPressSource) => boolean) => void;
  unregisterBackEntry: (id: string) => void;
  pushChildPage: (page: string, source: string) => void;
  popChildPage: () => ChildPage | null;
  setNavigationCallback: (callback: ((page: string) => void) | null) => void;
  setOverlaySource: (source: string | null) => void;
  setCurrentPage: (page: string) => void;
  recordRootNavigation: (previousRootPage: string | null, nextRootPage: string, mode?: 'push' | 'replace') => void;
  handleBackPress: (source?: BackPressSource) => boolean;
  canGoBack: () => boolean;
}

const BackNavigationContext = createContext<BackNavigationContextType | undefined>(undefined);

function isEditableElement(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const tagName = element.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    element.isContentEditable
  );
}

function shouldHandleKeyboardFirstOnSystemBack() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  if (window.matchMedia) {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  return window.innerWidth < 1024;
}

export function BackNavigationProvider({ children }: { children: ReactNode }) {
  const [activeBottomSheets, setActiveBottomSheets] = useState<string[]>([]);
  const [activeModals, setActiveModals] = useState<string[]>([]);
  const [childPageStack, setChildPageStack] = useState<ChildPage[]>([]);
  const [overlaySource, setOverlaySourceState] = useState<string | null>(null);
  const [currentPage, setCurrentPageState] = useState<string>('dashboard');
  const [rootPageHistory] = useState<string[]>([]);
  const [bottomSheetCloseHandlers, setBottomSheetCloseHandlers] = useState<Map<string, (source: BackPressSource) => void>>(new Map());
  const [modalCloseHandlers, setModalCloseHandlers] = useState<Map<string, () => void>>(new Map());
  const [backEntries, setBackEntries] = useState<Map<string, BackEntry>>(new Map());

  const navigationCallbackRef = useRef<((page: string) => void) | null>(null);
  const handleBackPressRef = useRef<(source?: BackPressSource) => boolean>(() => false);

  const setNavigationCallback = useCallback((callback: ((page: string) => void) | null) => {
    navigationCallbackRef.current = callback;
  }, []);

  const registerBottomSheet = useCallback((id: string) => {
    setActiveBottomSheets((previous) => (previous.includes(id) ? previous : [...previous, id]));
  }, []);

  const registerBottomSheetWithCloseHandler = useCallback((id: string, closeHandler: (source: BackPressSource) => void) => {
    setActiveBottomSheets((previous) => (previous.includes(id) ? previous : [...previous, id]));
    setBottomSheetCloseHandlers((previous) => {
      const next = new Map(previous);
      next.set(id, closeHandler);
      return next;
    });
  }, []);

  const unregisterBottomSheet = useCallback((id: string) => {
    setActiveBottomSheets((previous) => previous.filter((sheetId) => sheetId !== id));
    setBottomSheetCloseHandlers((previous) => {
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
  }, []);

  const closeTopBottomSheet = useCallback((source: BackPressSource = 'system') => {
    if (activeBottomSheets.length === 0) {
      return false;
    }

    const topSheet = activeBottomSheets[activeBottomSheets.length - 1];
    const closeHandler = bottomSheetCloseHandlers.get(topSheet);

    if (closeHandler) {
      closeHandler(source);
      return true;
    }

    unregisterBottomSheet(topSheet);
    return true;
  }, [activeBottomSheets, bottomSheetCloseHandlers, unregisterBottomSheet]);

  const registerModal = useCallback((id: string) => {
    setActiveModals((previous) => (previous.includes(id) ? previous : [...previous, id]));
  }, []);

  const registerModalWithCloseHandler = useCallback((id: string, closeHandler: () => void) => {
    setActiveModals((previous) => (previous.includes(id) ? previous : [...previous, id]));
    setModalCloseHandlers((previous) => {
      const next = new Map(previous);
      next.set(id, closeHandler);
      return next;
    });
  }, []);

  const unregisterModal = useCallback((id: string) => {
    setActiveModals((previous) => previous.filter((modalId) => modalId !== id));
    setModalCloseHandlers((previous) => {
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
  }, []);

  const closeTopModal = useCallback(() => {
    if (activeModals.length === 0) {
      return false;
    }

    const topModal = activeModals[activeModals.length - 1];
    const closeHandler = modalCloseHandlers.get(topModal);

    if (closeHandler) {
      closeHandler();
      return true;
    }

    unregisterModal(topModal);
    return true;
  }, [activeModals, modalCloseHandlers, unregisterModal]);

  const registerBackEntry = useCallback((id: string, priority: number, handler: (source: BackPressSource) => boolean) => {
    setBackEntries((previous) => {
      const next = new Map(previous);
      next.set(id, { id, priority, handler });
      return next;
    });
  }, []);

  const unregisterBackEntry = useCallback((id: string) => {
    setBackEntries((previous) => {
      if (!previous.has(id)) {
        return previous;
      }

      const next = new Map(previous);
      next.delete(id);
      return next;
    });
  }, []);

  const pushChildPage = useCallback((page: string, source: string) => {
    setChildPageStack((previous) => [...previous, { page, source }]);
  }, []);

  const popChildPage = useCallback(() => {
    let poppedChild: ChildPage | null = null;
    setChildPageStack((previous) => {
      if (previous.length === 0) {
        return previous;
      }

      poppedChild = previous[previous.length - 1];
      return previous.slice(0, -1);
    });
    return poppedChild;
  }, []);

  const setOverlaySource = useCallback((source: string | null) => {
    setOverlaySourceState(source);
  }, []);

  const setCurrentPage = useCallback((page: string) => {
    setCurrentPageState(page);
  }, []);

  const recordRootNavigation = useCallback((_previousRootPage: string | null, _nextRootPage: string, _mode: 'push' | 'replace' = 'push') => {
    // Root route transitions are now driven by real browser history.
  }, []);

  const runBackEntries = useCallback((source: BackPressSource) => {
    if (backEntries.size === 0) {
      return false;
    }

    const orderedEntries = Array.from(backEntries.values()).sort((left, right) => right.priority - left.priority);

    for (const entry of orderedEntries) {
      if (entry.handler(source)) {
        return true;
      }
    }

    return false;
  }, [backEntries]);

  const dismissFocusedInputOnSystemBack = useCallback((source: BackPressSource) => {
    if (source !== 'system' || !shouldHandleKeyboardFirstOnSystemBack()) {
      return false;
    }

    const activeElement = document.activeElement;
    if (!isEditableElement(activeElement)) {
      return false;
    }

    activeElement.blur();
    return true;
  }, []);

  const canGoBack = useCallback(() => {
    return activeBottomSheets.length > 0 || activeModals.length > 0 || backEntries.size > 0;
  }, [activeBottomSheets.length, activeModals.length, backEntries.size]);

  const handleBackPress = useCallback((source: BackPressSource = 'system') => {
    if (dismissFocusedInputOnSystemBack(source)) {
      return true;
    }

    if (activeModals.length > 0) {
      return closeTopModal();
    }

    if (activeBottomSheets.length > 0) {
      return closeTopBottomSheet(source);
    }

    if (runBackEntries(source)) {
      return true;
    }

    return false;
  }, [activeBottomSheets.length, activeModals.length, closeTopBottomSheet, closeTopModal, dismissFocusedInputOnSystemBack, runBackEntries]);

  useEffect(() => {
    handleBackPressRef.current = handleBackPress;
  }, [handleBackPress]);

  useEffect(() => {
    const handlePopState = () => {
      if (consumeHandledPopState()) {
        return;
      }

      handleBackPressRef.current('system');
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.repeat) {
        return;
      }

      const handled = handleBackPressRef.current('escape');
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const value: BackNavigationContextType = useMemo(() => ({
    activeBottomSheets,
    activeModals,
    childPageStack,
    overlaySource,
    currentPage,
    rootPageHistory,
    registerBottomSheet,
    registerBottomSheetWithCloseHandler,
    unregisterBottomSheet,
    closeTopBottomSheet,
    registerModal,
    registerModalWithCloseHandler,
    unregisterModal,
    closeTopModal,
    registerBackEntry,
    unregisterBackEntry,
    pushChildPage,
    popChildPage,
    setNavigationCallback,
    setOverlaySource,
    setCurrentPage,
    recordRootNavigation,
    handleBackPress,
    canGoBack,
  }), [
    activeBottomSheets,
    activeModals,
    childPageStack,
    overlaySource,
    currentPage,
    rootPageHistory,
    registerBottomSheet,
    registerBottomSheetWithCloseHandler,
    unregisterBottomSheet,
    closeTopBottomSheet,
    registerModal,
    registerModalWithCloseHandler,
    unregisterModal,
    closeTopModal,
    registerBackEntry,
    unregisterBackEntry,
    pushChildPage,
    popChildPage,
    setNavigationCallback,
    setOverlaySource,
    setCurrentPage,
    recordRootNavigation,
    handleBackPress,
    canGoBack,
  ]);

  return (
    <BackNavigationContext.Provider value={value}>
      {children}
    </BackNavigationContext.Provider>
  );
}

export function useBackNavigation() {
  const context = useContext(BackNavigationContext);
  if (context === undefined) {
    throw new Error('useBackNavigation must be used within a BackNavigationProvider');
  }
  return context;
}

export function useOptionalBackNavigation() {
  return useContext(BackNavigationContext);
}
