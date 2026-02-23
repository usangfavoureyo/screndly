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

interface BackNavigationContextType {
    // State
    activeBottomSheets: string[];
    activeModals: string[];
    childPageStack: ChildPage[];
    overlaySource: string | null;
    currentPage: string;

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

    // Child Page Navigation
    pushChildPage: (page: string, source: string) => void;
    popChildPage: () => ChildPage | null;
    setNavigationCallback: (callback: ((page: string) => void) | null) => void;

    // Overlay (Settings/Notifications) Management
    setOverlaySource: (source: string | null) => void;

    // Current Page Tracking
    setCurrentPage: (page: string) => void;

    // Main Handler - Returns true if handled, false if should exit
    handleBackPress: () => boolean;

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
    'design-studio',
    'video-studio'
];

// ============================================
// PROVIDER
// ============================================

export function BackNavigationProvider({ children }: { children: ReactNode }) {
    const [activeBottomSheets, setActiveBottomSheets] = useState<string[]>([]);
    const [activeModals, setActiveModals] = useState<string[]>([]);
    const [childPageStack, setChildPageStack] = useState<ChildPage[]>([]);
    const [overlaySource, setOverlaySourceState] = useState<string | null>(null);
    const [currentPage, setCurrentPageState] = useState<string>('dashboard');

    // Close handler references (set by bottom-sheet and modal components)
    const [bottomSheetCloseHandlers, setBottomSheetCloseHandlers] = useState<Map<string, () => void>>(new Map());
    const [modalCloseHandlers, setModalCloseHandlers] = useState<Map<string, () => void>>(new Map());

    // Navigation callback for parent page navigation when child pages are popped
    const navigationCallbackRef = useRef<((page: string) => void) | null>(null);
    // Ref for handleBackPress to avoid re-registering popstate listener
    const handleBackPressRef = useRef<() => boolean>(() => false);

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

    // ============================================
    // MAIN BACK HANDLER
    // ============================================

    const canGoBack = useCallback(() => {
        return (
            activeBottomSheets.length > 0 ||
            activeModals.length > 0 ||
            childPageStack.length > 0 ||
            overlaySource !== null
        );
    }, [activeBottomSheets.length, activeModals.length, childPageStack.length, overlaySource]);

    const handleBackPress = useCallback(() => {
        // Priority 1: Close modals (Alerts/Dialogs sit on top of everything)
        if (activeModals.length > 0) {
            return closeTopModal();
        }

        // Priority 2: Close bottom sheets
        if (activeBottomSheets.length > 0) {
            return closeTopBottomSheet();
        }

        // Priority 3: Return from child pages
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

        // Priority 4: Return from overlay to source
        if (overlaySource !== null) {
            setOverlaySource(null);
            return true;
        }

        // Priority 5: Check if on root page
        const isRootPage = ROOT_PAGES.includes(currentPage);
        if (isRootPage) {
            return false; // Signal to exit app
        }

        // Default: allow back navigation
        return false;
    }, [
        activeBottomSheets.length,
        activeModals.length,
        childPageStack.length,
        overlaySource,
        currentPage,
        closeTopBottomSheet,
        closeTopModal,
        popChildPage,
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
            const handled = handleBackPressRef.current();

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

    // ============================================
    // CONTEXT VALUE
    // ============================================

    const value: BackNavigationContextType = useMemo(() => ({
        activeBottomSheets,
        activeModals,
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
        pushChildPage,
        popChildPage,
        setNavigationCallback,
        setOverlaySource,
        setCurrentPage,
        handleBackPress,
        canGoBack,
    }), [
        activeBottomSheets,
        activeModals,
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
        pushChildPage,
        popChildPage,
        setNavigationCallback,
        setOverlaySource,
        setCurrentPage,
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
