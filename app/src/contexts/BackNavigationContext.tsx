/**
 * BackNavigationContext - Centralized Android Back Button Handler
 * 
 * Priority Order (Strict):
 * 1. Open bottom sheets → close
 * 2. Open modals/overlays → close  
 * 3. Child pages (View All, Activity) → return to parent
 * 4. Root tab pages → exit app
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, ReactNode } from 'react';

// ============================================
// TYPES
// ============================================

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
    // State
    activeBottomSheets: string[];
    activeModals: string[];
    childPageStack: ChildPage[];
    overlaySource: string | null;
    currentPage: string;
    rootPageHistory: string[];

    // Bottom Sheet Management
    registerBottomSheet: (id: string) => void;
    registerBottomSheetWithCloseHandler: (id: string, closeHandler: () => void) => void;
    unregisterBottomSheet: (id: string) => void;
    closeTopBottomSheet: () => boolean;

    // Modal Management
    registerModal: (id: string) => void;
    registerModalWithCloseHandler: (id: string, closeHandler: () => void) => void;
    unregisterModal: (id: string) => void;
    closeTopModal: () => boolean;

    // Generic Back Entry Management
    registerBackEntry: (id: string, priority: number, handler: (source: BackPressSource) => boolean) => void;
    unregisterBackEntry: (id: string) => void;

    // Child Page Navigation
    pushChildPage: (page: string, source: string) => void;
    popChildPage: () => ChildPage | null;
    setNavigationCallback: (callback: ((page: string) => void) | null) => void;

    // Overlay (Settings/Notifications) Management
    setOverlaySource: (source: string | null) => void;

    // Current Page Tracking
    setCurrentPage: (page: string) => void;
    recordRootNavigation: (previousRootPage: string | null, nextRootPage: string, mode?: 'push' | 'replace') => void;

    // Main Handler - Returns true if handled, false if should exit
    handleBackPress: (source?: BackPressSource) => boolean;

    // Check if can go back (has any UI layer open)
    canGoBack: () => boolean;
}

const BackNavigationContext = createContext<BackNavigationContextType | undefined>(undefined);

// Root pages that should exit app on back
const ROOT_PAGES = [
    'dashboard',
    'channels',
    'platforms',
    'feeds',
    'create',
    'design-studio',
    'video-studio'
];

const ROOT_HISTORY_LIMIT = 20;

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

// ============================================
// PROVIDER
// ============================================

export function BackNavigationProvider({ children }: { children: ReactNode }) {
    const [activeBottomSheets, setActiveBottomSheets] = useState<string[]>([]);
    const [activeModals, setActiveModals] = useState<string[]>([]);
    const [childPageStack, setChildPageStack] = useState<ChildPage[]>([]);
    const [overlaySource, setOverlaySourceState] = useState<string | null>(null);
    const [currentPage, setCurrentPageState] = useState<string>('dashboard');
    const [rootPageHistory, setRootPageHistory] = useState<string[]>([]);

    // Close handler references (set by bottom-sheet and modal components)
    const [bottomSheetCloseHandlers, setBottomSheetCloseHandlers] = useState<Map<string, () => void>>(new Map());
    const [modalCloseHandlers, setModalCloseHandlers] = useState<Map<string, () => void>>(new Map());
    const [backEntries, setBackEntries] = useState<Map<string, BackEntry>>(new Map());

    // Navigation callback for parent page navigation when child pages are popped
    const navigationCallbackRef = useRef<((page: string) => void) | null>(null);
    // Ref for handleBackPress to avoid re-registering popstate listener
    const handleBackPressRef = useRef<(source?: BackPressSource) => boolean>(() => false);

    const setNavigationCallback = useCallback((callback: ((page: string) => void) | null) => {
        navigationCallbackRef.current = callback;
    }, []);

    // ============================================
    // BOTTOM SHEET MANAGEMENT
    // ============================================

    const registerBottomSheet = useCallback((id: string) => {
        setActiveBottomSheets(prev => {
            if (prev.includes(id)) return prev;
            return [...prev, id];
        });
    }, []);

    const registerBottomSheetWithCloseHandler = useCallback((id: string, closeHandler: () => void) => {
        setActiveBottomSheets(prev => {
            if (prev.includes(id)) return prev;
            return [...prev, id];
        });
        setBottomSheetCloseHandlers(prev => {
            const next = new Map(prev);
            next.set(id, closeHandler);
            return next;
        });
    }, []);

    const unregisterBottomSheet = useCallback((id: string) => {
        setActiveBottomSheets(prev => prev.filter(s => s !== id));
        setBottomSheetCloseHandlers(prev => {
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const closeTopBottomSheet = useCallback(() => {
        if (activeBottomSheets.length === 0) return false;

        const topSheet = activeBottomSheets[activeBottomSheets.length - 1];
        const closeHandler = bottomSheetCloseHandlers.get(topSheet);

        if (closeHandler) {
            closeHandler();
            return true;
        }

        // Fallback: manually remove from stack
        unregisterBottomSheet(topSheet);
        return true;
    }, [activeBottomSheets, bottomSheetCloseHandlers, unregisterBottomSheet]);

    // ============================================
    // MODAL MANAGEMENT
    // ============================================

    const registerModal = useCallback((id: string) => {
        setActiveModals(prev => {
            if (prev.includes(id)) return prev;
            return [...prev, id];
        });
    }, []);

    const registerModalWithCloseHandler = useCallback((id: string, closeHandler: () => void) => {
        setActiveModals(prev => {
            if (prev.includes(id)) return prev;
            return [...prev, id];
        });
        setModalCloseHandlers(prev => {
            const next = new Map(prev);
            next.set(id, closeHandler);
            return next;
        });
    }, []);

    const unregisterModal = useCallback((id: string) => {
        setActiveModals(prev => prev.filter(m => m !== id));
        setModalCloseHandlers(prev => {
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const closeTopModal = useCallback(() => {
        if (activeModals.length === 0) return false;

        const topModal = activeModals[activeModals.length - 1];
        const closeHandler = modalCloseHandlers.get(topModal);

        if (closeHandler) {
            closeHandler();
            return true;
        }

        // Fallback: manually remove from stack
        unregisterModal(topModal);
        return true;
    }, [activeModals, modalCloseHandlers, unregisterModal]);

    // ============================================
    // GENERIC BACK ENTRY MANAGEMENT
    // ============================================

    const registerBackEntry = useCallback((id: string, priority: number, handler: (source: BackPressSource) => boolean) => {
        setBackEntries(prev => {
            const next = new Map(prev);
            next.set(id, { id, priority, handler });
            return next;
        });
    }, []);

    const unregisterBackEntry = useCallback((id: string) => {
        setBackEntries(prev => {
            if (!prev.has(id)) {
                return prev;
            }

            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    // ============================================
    // CHILD PAGE NAVIGATION
    // ============================================

    const pushChildPage = useCallback((page: string, source: string) => {
        setChildPageStack(prev => [...prev, { page, source }]);
    }, []);

    const popChildPage = useCallback(() => {
        if (childPageStack.length === 0) return null;

        const top = childPageStack[childPageStack.length - 1];
        setChildPageStack(prev => prev.slice(0, -1));
        return top;
    }, [childPageStack]);

    // ============================================
    // OVERLAY MANAGEMENT
    // ============================================

    const setOverlaySource = useCallback((source: string | null) => {
        setOverlaySourceState(source);
    }, []);

    // ============================================
    // CURRENT PAGE TRACKING
    // ============================================

    const setCurrentPage = useCallback((page: string) => {
        setCurrentPageState(page);
    }, []);

    const recordRootNavigation = useCallback((previousRootPage: string | null, nextRootPage: string, mode: 'push' | 'replace' = 'push') => {
        if (
            mode === 'replace' ||
            !previousRootPage ||
            previousRootPage === nextRootPage ||
            !ROOT_PAGES.includes(previousRootPage) ||
            !ROOT_PAGES.includes(nextRootPage)
        ) {
            return;
        }

        setRootPageHistory(prev => {
            const next = prev[prev.length - 1] === previousRootPage
                ? prev
                : [...prev, previousRootPage];

            return next.slice(-ROOT_HISTORY_LIMIT);
        });
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

    // ============================================
    // MAIN BACK HANDLER
    // ============================================

    const canGoBack = useCallback(() => {
        return (
            rootPageHistory.length > 0 ||
            activeBottomSheets.length > 0 ||
            activeModals.length > 0 ||
            childPageStack.length > 0 ||
            backEntries.size > 0 ||
            overlaySource !== null
        );
    }, [activeBottomSheets.length, activeModals.length, backEntries.size, childPageStack.length, overlaySource, rootPageHistory.length]);

    const handleBackPress = useCallback((source: BackPressSource = 'system') => {
        if (dismissFocusedInputOnSystemBack(source)) {
            return true;
        }

        // Priority 1: Close modals (Alerts/Dialogs sit on top of everything)
        if (activeModals.length > 0) {
            return closeTopModal();
        }

        // Priority 2: Close bottom sheets
        if (activeBottomSheets.length > 0) {
            return closeTopBottomSheet();
        }

        // Priority 3: Resolve page-specific back entries (dirty state, tab history, nested views)
        if (runBackEntries(source)) {
            return true;
        }

        if (source !== 'system') {
            return false;
        }

        // Priority 4: Return from child pages
        if (childPageStack.length > 0) {
            const popped = popChildPage();
            if (popped) {
                // Navigate back to parent page
                if (navigationCallbackRef.current) {
                    navigationCallbackRef.current(popped.source);
                }
                return true;
            }
        }

        // Priority 5: Return from overlay to source
        if (overlaySource !== null) {
            setOverlaySource(null);
            return true;
        }

        // Priority 6: Return to previously visited root section
        if (rootPageHistory.length > 0) {
            const previousRootPage = rootPageHistory[rootPageHistory.length - 1];
            setRootPageHistory(prev => prev.slice(0, -1));

            if (navigationCallbackRef.current) {
                navigationCallbackRef.current(previousRootPage);
                return true;
            }
        }

        // Priority 7: Check if on root page
        const isRootPage = ROOT_PAGES.includes(currentPage);
        if (isRootPage) {
            return false; // Signal to exit app
        }

        // Default: allow back navigation
        return false;
    }, [
        activeBottomSheets.length,
        activeModals.length,
        backEntries,
        childPageStack.length,
        dismissFocusedInputOnSystemBack,
        overlaySource,
        currentPage,
        rootPageHistory,
        closeTopBottomSheet,
        closeTopModal,
        popChildPage,
        runBackEntries,
        setOverlaySource
    ]);

    // Keep ref updated with latest handleBackPress
    useEffect(() => {
        handleBackPressRef.current = handleBackPress;
    }, [handleBackPress]);

    // ============================================
    // ANDROID BACK BUTTON LISTENER
    // ============================================

    // Push initial history state and set up popstate listener (only once)
    useEffect(() => {
        // Push initial state if not already present
        if (typeof window !== 'undefined' && !window.history.state?.backNav) {
            window.history.pushState({ backNav: true }, '');
        }

        let lastPushTime = 0;
        const DEBOUNCE_MS = 100;

        const handlePopState = (event: PopStateEvent) => {
            event.preventDefault();

            // Use ref to get latest handleBackPress without re-registering listener
            const handled = handleBackPressRef.current('system');

            if (handled) {
                const now = Date.now();
                if (now - lastPushTime > DEBOUNCE_MS) {
                    lastPushTime = now;
                    window.history.pushState({ backNav: true }, '');
                }
            } else {
                if ((window as any).Android?.exitApp) {
                    (window as any).Android.exitApp();
                } else if (navigator && (navigator as any).app?.exitApp) {
                    (navigator as any).app.exitApp();
                } else {
                    window.close();
                }
            }
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []); // Empty deps - only run once on mount

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

    // ============================================
    // CONTEXT VALUE
    // ============================================

    const value: BackNavigationContextType = useMemo(() => ({
        activeBottomSheets,
        activeModals,
        rootPageHistory,
        childPageStack,
        overlaySource,
        currentPage,
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
        rootPageHistory,
        childPageStack,
        overlaySource,
        currentPage,
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

// ============================================
// HOOK
// ============================================

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
