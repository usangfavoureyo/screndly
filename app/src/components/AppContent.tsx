import { useState, Suspense, useEffect, useCallback } from "react";
import { DashboardOverview } from "./DashboardOverview";
import { Navigation } from "./Navigation";
import { MobileBottomNav } from "./MobileBottomNav";
import { InstallPrompt } from "./InstallPrompt";
import { NotFoundPage } from "./NotFoundPage";
import { UndoToast } from "./UndoToast";
import { useUndo } from "./UndoContext";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { ComposeScheduler } from "./create/ComposeScheduler";
import { PullToRefresh } from "./PullToRefresh";
import { CreateFab } from "./CreateFab";
import { useDesktopShortcuts } from "../hooks/useDesktopShortcuts";
import { haptics } from "../utils/haptics";
import { lazyWithRetry } from "../utils/performance";
import { useNotifications } from "../contexts/NotificationsContext";
import { useBackNavigation } from "../contexts/BackNavigationContext";
import { setupInstallPrompt, registerServiceWorker } from "../utils/pwa";
import { toast } from "sonner";
import { logout } from "../lib/auth";
import { useTMDbModalStore } from "../stores/tmdbModalStore";

const DESKTOP_SIDEBAR_STORAGE_KEY = "screndly.desktopSidebarCollapsed";
const DESKTOP_SIDEBAR_EXPANDED_WIDTH = "16rem";
const DESKTOP_SIDEBAR_COLLAPSED_WIDTH = "5rem";
const APP_STATE_STORAGE_KEY = "screndly_app_state";

// Lazy load heavy components for better performance
const ChannelsPage = lazyWithRetry(() => import("./ChannelsPage").then(m => ({ default: m.ChannelsPage })), "ChannelsPage");
const PlatformsPage = lazyWithRetry(() => import("./PlatformsPage").then(m => ({ default: m.PlatformsPage })), "PlatformsPage");
const LogsPage = lazyWithRetry(() => import("./LogsPage").then(m => ({ default: m.LogsPage })), "LogsPage");
const RecentActivityPage = lazyWithRetry(() => import("./RecentActivityPage").then(m => ({ default: m.RecentActivityPage })), "RecentActivityPage");
const DesignSystemPage = lazyWithRetry(() => import("./DesignSystemPage").then(m => ({ default: m.DesignSystemPage })), "DesignSystemPage");
const FeedsPage = lazyWithRetry(() => import("./FeedsPage").then(m => ({ default: m.FeedsPage })), "FeedsPage");
const RSSPage = lazyWithRetry(() => import("./RSSPage").then(m => ({ default: m.RSSPage })), "RSSPage");
const RSSActivityPage = lazyWithRetry(() => import("./RSSActivityPage").then(m => ({ default: m.RSSActivityPage })), "RSSActivityPage");
const TMDbFeedsPage = lazyWithRetry(() => import("./TMDbFeedsPage").then(m => ({ default: m.TMDbFeedsPage })), "TMDbFeedsPage");
const TMDbActivityPage = lazyWithRetry(() => import("./TMDbActivityPage").then(m => ({ default: m.TMDbActivityPage })), "TMDbActivityPage");
const CreatePage = lazyWithRetry(() => import("./CreatePage").then(m => ({ default: m.CreatePage })), "CreatePage");
const ComposeEditorPage = lazyWithRetry(() => import("./create/ComposeEditorPage").then(m => ({ default: m.ComposeEditorPage })), "ComposeEditorPage");
const ComposeActivityPage = lazyWithRetry(() => import("./create/ComposeActivityPage").then(m => ({ default: m.ComposeActivityPage })), "ComposeActivityPage");
const PadWorkspacePage = lazyWithRetry(() => import("./create/PadWorkspacePage").then(m => ({ default: m.PadWorkspacePage })), "PadWorkspacePage");
const VideoDetailsPage = lazyWithRetry(() => import("./VideoDetailsPage").then(m => ({ default: m.VideoDetailsPage })), "VideoDetailsPage");
const VideoActivityPage = lazyWithRetry(() => import("./VideoActivityPage").then(m => ({ default: m.VideoActivityPage })), "VideoActivityPage");
const VideoStudioPage = lazyWithRetry(() => import("./VideoStudioPage").then(m => ({ default: m.VideoStudioPage })), "VideoStudioPage");
const VideoStudioActivityPage = lazyWithRetry(() => import("./VideoStudioActivityPage").then(m => ({ default: m.VideoStudioActivityPage })), "VideoStudioActivityPage");
const DesignStudioPage = lazyWithRetry(() => import("./DesignStudioPage").then(m => ({ default: m.default })), "DesignStudioPage");
const DesignStudioActivityPage = lazyWithRetry(() => import("./DesignStudioActivityPage").then(m => ({ default: m.DesignStudioActivityPage })), "DesignStudioActivityPage");
const SettingsPanel = lazyWithRetry(() => import("./SettingsPanel").then(m => ({ default: m.SettingsPanel })), "SettingsPanel");
const PrivacyPage = lazyWithRetry(() => import("./PrivacyPage").then(m => ({ default: m.PrivacyPage })), "PrivacyPage");
const TermsPage = lazyWithRetry(() => import("./TermsPage").then(m => ({ default: m.TermsPage })), "TermsPage");
const DisclaimerPage = lazyWithRetry(() => import("./DisclaimerPage").then(m => ({ default: m.DisclaimerPage })), "DisclaimerPage");
const CookiePage = lazyWithRetry(() => import("./CookiePage").then(m => ({ default: m.CookiePage })), "CookiePage");
const ContactPage = lazyWithRetry(() => import("./ContactPage").then(m => ({ default: m.ContactPage })), "ContactPage");
const AboutPage = lazyWithRetry(() => import("./AboutPage").then(m => ({ default: m.AboutPage })), "AboutPage");
const DataDeletionPage = lazyWithRetry(() => import("./DataDeletionPage").then(m => ({ default: m.DataDeletionPage })), "DataDeletionPage");
const AppInfoPage = lazyWithRetry(() => import("./AppInfoPage").then(m => ({ default: m.AppInfoPage })), "AppInfoPage");
const APIUsage = lazyWithRetry(() => import("./APIUsage").then(m => ({ default: m.APIUsage })), "APIUsage");
const OAuthCallbackPage = lazyWithRetry(() => import("./OAuthCallbackPage").then(m => ({ default: m.OAuthCallbackPage })), "OAuthCallbackPage");
const CommentAutomationPage = lazyWithRetry(() => import("./CommentAutomationPage").then(m => ({ default: m.CommentAutomationPage })), "CommentAutomationPage");
const UploadManagerPage = lazyWithRetry(() => import("./jobs/UploadManagerPage").then(m => ({ default: m.UploadManagerPage })), "UploadManagerPage");
const NotificationPanel = lazyWithRetry(() => import("./NotificationPanel").then(m => ({ default: m.NotificationPanel })), "NotificationPanel");
const TMDbModals = lazyWithRetry(() => import("./tmdb/TMDbModals").then(m => ({ default: m.TMDbModals })), "TMDbModals");

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ec1e24]"></div>
    <span className="sr-only">Loading...</span>
  </div>
);

const OverlayLoader = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="status" aria-live="polite">
    <div className="rounded-xl bg-white px-5 py-4 text-gray-900 shadow-lg dark:bg-[#000000] dark:text-white">
      Loading...
    </div>
  </div>
);

// Helper: Get page from URL pathname
function getPageFromURL(): string {
  if (typeof window === 'undefined') return 'dashboard';
  const pathname = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
  if (pathname === 'callback') return 'platforms/callback';
  return pathname || 'dashboard';
}

const VALID_PAGES = [
  'dashboard', 'channels', 'platforms', 'logs', 'activity', 'design-system',
  'feeds', 'rss', 'rss-activity', 'tmdb', 'tmdb-activity', 'video-details', 'video-activity',
  'create', 'compose-editor', 'compose-activity', 'pad-workspace',
  'video-studio', 'video-studio-activity', 'design-studio', 'design-studio-activity',
  'privacy', 'terms', 'disclaimer',
  'cookie', 'contact', 'about', 'data-deletion', 'app-info', 'api-usage',
  'callback',
  'platforms/callback',
  'comment-automation', 'upload-manager', 'not-found'
] as const;

type ValidPage = typeof VALID_PAGES[number];

interface PersistedAppState {
  currentPage: ValidPage;
  previousPage: string | null;
  createSourcePage: string;
  pageBeforeSettings: string;
  updatedAt: number;
}

function isValidPage(page: string): page is ValidPage {
  return (VALID_PAGES as readonly string[]).includes(page);
}

function getPersistedAppState(): PersistedAppState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawState = window.localStorage.getItem(APP_STATE_STORAGE_KEY);
    if (!rawState) {
      return null;
    }

    const parsedState = JSON.parse(rawState) as Partial<PersistedAppState>;
    if (!parsedState.currentPage || !isValidPage(parsedState.currentPage)) {
      return null;
    }

    return {
      currentPage: parsedState.currentPage,
      previousPage: typeof parsedState.previousPage === "string" ? parsedState.previousPage : null,
      createSourcePage: typeof parsedState.createSourcePage === "string" ? parsedState.createSourcePage : "dashboard",
      pageBeforeSettings: typeof parsedState.pageBeforeSettings === "string" ? parsedState.pageBeforeSettings : "dashboard",
      updatedAt: typeof parsedState.updatedAt === "number" ? parsedState.updatedAt : Date.now(),
    };
  } catch (error) {
    console.warn("[AppContent] Failed to restore persisted app state:", error);
    return null;
  }
}

function getInitialNavigationState(): PersistedAppState {
  const pageFromUrl = getPageFromURL();
  const persistedState = getPersistedAppState();

  if (pageFromUrl !== "dashboard" && isValidPage(pageFromUrl)) {
    return {
      currentPage: pageFromUrl,
      previousPage: persistedState?.previousPage ?? null,
      createSourcePage: persistedState?.createSourcePage ?? "dashboard",
      pageBeforeSettings: persistedState?.pageBeforeSettings ?? "dashboard",
      updatedAt: Date.now(),
    };
  }

  if (persistedState) {
    return persistedState;
  }

  return {
    currentPage: "dashboard",
    previousPage: null,
    createSourcePage: "dashboard",
    pageBeforeSettings: "dashboard",
    updatedAt: Date.now(),
  };
}

function scrollToTop(): void {
  if (typeof window === "undefined" || typeof window.scrollTo !== "function") {
    return;
  }

  try {
    window.scrollTo(0, 0);
  } catch {
    // Ignore environments that do not implement scroll APIs.
  }
}

export function AppContent() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    addNotification,
    deleteNotification,
    removeNotificationLocal,
    restoreNotification,
  } = useNotifications();
  const { showUndo } = useUndo();

  const [initialNavigationState] = useState<PersistedAppState>(() => getInitialNavigationState());

  // Initialize currentPage from URL (preserves state on refresh) and local storage (restores cold starts)
  const [currentPage, setCurrentPageState] = useState<string>(() => initialNavigationState.currentPage);
  const [previousPage, setPreviousPage] = useState<string | null>(() => initialNavigationState.previousPage);
  const [createSourcePage, setCreateSourcePage] = useState(() => initialNavigationState.createSourcePage);
  const [pageBeforeSettings, setPageBeforeSettings] = useState(() => initialNavigationState.pageBeforeSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialPage, setSettingsInitialPage] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCaptionEditorOpen, setIsCaptionEditorOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false,
  );
  const [shouldMountNotificationPanel, setShouldMountNotificationPanel] = useState(false);
  const [shouldMountTMDbModals, setShouldMountTMDbModals] = useState(false);
  const hasOpenTMDbModal = useTMDbModalStore((state) =>
    state.editCaptionModal.open ||
    state.changeImageModal.open ||
    state.rescheduleModal.open ||
    state.deleteModal.open ||
    state.platformSelectModal.open ||
    state.imagePreviewModal.open,
  );
  const shouldRenderNotificationPanel = shouldMountNotificationPanel || isNotificationsOpen;
  const shouldRenderTMDbModals = shouldMountTMDbModals || hasOpenTMDbModal;

  const updateCurrentPage = useCallback((page: string, historyMode: "push" | "replace" = "push") => {
    setCurrentPageState(page);

    const newUrl = page === 'dashboard' ? '/' : `/${page}`;
    if (window.location.pathname !== newUrl) {
      if (historyMode === "replace") {
        window.history.replaceState({ page }, "", newUrl);
        return;
      }

      window.history.pushState({ page }, '', newUrl);
    }
  }, []);

  // Check if current page is valid, if not show 404
  const displayPage = isValidPage(currentPage) ? currentPage : 'not-found';

  // NOTE: URL-based routing implemented. Refresh preserves current page.

  // ============================================
  // BACK NAVIGATION CONTEXT INTEGRATION
  // ============================================

  // Get BackNavigation context to sync state
  // Get BackNavigation context methods (stable identities)
  const {
    setCurrentPage: setBackNavPage,
    setOverlaySource,
    registerModalWithCloseHandler,
    unregisterModal,
    setNavigationCallback: setBackNavCallback,
    pushChildPage
  } = useBackNavigation();

  // Sync current page with BackNavigationContext
  // Sync current page with BackNavigationContext
  useEffect(() => {
    // Map page names to root page categories
    const rootPageMap: Record<string, string> = {
      'dashboard': 'dashboard',
      'channels': 'channels',
      'platforms': 'platforms',
      'feeds': 'feeds',
      'create': 'create',
      'design-studio': 'design-studio',
      'video-studio': 'video-studio',
      // Child pages map to their parent
      'rss': 'feeds',
      'tmdb': 'feeds',
      'rss-activity': 'feeds',
      'tmdb-activity': 'feeds',
      'compose-editor': 'create',
      'compose-activity': 'create',
      'pad-workspace': 'create',
      'design-studio-activity': 'design-studio',
      'video-studio-activity': 'video-studio',
    };

    const mappedPage = rootPageMap[currentPage] || currentPage;
    setBackNavPage(mappedPage);
  }, [currentPage, setBackNavPage]);

  // Track Settings/Notifications as overlays with source
  // Track Settings/Notifications as overlays with source
  useEffect(() => {
    if (isSettingsOpen || isNotificationsOpen) {
      // Store source page when opening overlay
      setOverlaySource(currentPage);

      // Push history state so back button closes overlay instead of exiting
      if (!window.history.state?.overlay) {
        window.history.pushState({ overlay: true, type: isSettingsOpen ? 'settings' : 'notifications' }, '');
      }
    } else {
      // Clear overlay source when closed
      setOverlaySource(null);
    }
  }, [isSettingsOpen, isNotificationsOpen, currentPage, setOverlaySource]);

  // Register overlay close handlers (Settings/Notifications close on back)
  // Register overlay close handlers (Settings/Notifications close on back)
  useEffect(() => {
    if (isSettingsOpen) {
      registerModalWithCloseHandler('settings', () => setIsSettingsOpen(false));
    }
    return () => {
      unregisterModal('settings');
    };
  }, [isSettingsOpen, registerModalWithCloseHandler, unregisterModal]);

  useEffect(() => {
    if (isNotificationsOpen) {
      registerModalWithCloseHandler('notifications', () => setIsNotificationsOpen(false));
    }
    return () => {
      unregisterModal('notifications');
    };
  }, [isNotificationsOpen, registerModalWithCloseHandler, unregisterModal]);
  // Push initial history state on mount (for URL support, not back navigation)
  useEffect(() => {
    const basePath = `/${currentPage === 'dashboard' ? '' : currentPage}`;
    const preservedSuffix = `${window.location.search || ''}${window.location.hash || ''}`;

    if (window.location.pathname !== basePath) {
      window.history.replaceState({ page: currentPage }, '', `${basePath}${preservedSuffix}`);
      return;
    }

    if (!window.history.state?.page) {
      window.history.replaceState({ page: currentPage }, '', `${basePath}${preservedSuffix}`);
    }
  }, [currentPage]);

  useEffect(() => {
    try {
      const nextAppState: PersistedAppState = {
        currentPage: isValidPage(currentPage) ? currentPage : "dashboard",
        previousPage,
        createSourcePage,
        pageBeforeSettings,
        updatedAt: Date.now(),
      };

      window.localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(nextAppState));
    } catch (error) {
      console.warn("[AppContent] Failed to persist app state:", error);
    }
  }, [currentPage, previousPage, createSourcePage, pageBeforeSettings]);

  // Create a stable navigation callback for BackNavigationContext
  const navigationCallback = useCallback((page: string) => {
    updateCurrentPage(page, "replace");
    scrollToTop();
  }, [updateCurrentPage]);

  // Register navigation callback with BackNavigationContext for child page back navigation
  // Register navigation callback with BackNavigationContext for child page back navigation
  useEffect(() => {
    setBackNavCallback(navigationCallback);
    return () => {
      setBackNavCallback(null);
    };
  }, [setBackNavCallback, navigationCallback]);

  const handleLogout = () => {
    // Clear saved app state so login defaults to Dashboard
    localStorage.removeItem('screndly_app_state');
    // Use the auth module's logout function which clears the correct token
    logout();
  };

  const handleNavigate = (page: string, fromPage?: string, skipHistory = false) => {
    const staticPages = ['privacy', 'terms', 'disclaimer', 'cookie', 'contact', 'about', 'data-deletion', 'app-info', 'design-system'];

    // Handle special settings sub-pages
    const settingsPages = ['settings-comment-reply', 'settings-video', 'settings-rss', 'settings-tmdb', 'settings-videostudio', 'settings-pad', 'settings-compose', 'settings-error', 'settings-cleanup', 'settings-haptic', 'settings-appearance', 'settings-notifications', 'settings-thumbnail', 'settings-autopost'];

    // Child pages that should return to parent on back
    // Dashboard View All pages → return to dashboard
    // Activity pages → return to their parent studio/feeds
    const childPageMap: Record<string, string> = {
      // Dashboard View All child pages
      'logs': 'dashboard',
      'activity': 'dashboard',
      'api-usage': 'dashboard',
      'comment-automation': 'dashboard',
      'upload-manager': 'dashboard',
      'video-details': 'dashboard',
      'video-activity': 'dashboard',
      // Feeds Activity pages
      'rss-activity': 'feeds',
      'tmdb-activity': 'feeds',
      // Create child pages
      'compose-editor': 'create',
      'compose-activity': 'create',
      'pad-workspace': 'create',
      // Studio Activity pages
      'design-studio-activity': 'design-studio',
      'video-studio-activity': 'video-studio',
    };

    // Redirect old RSS and TMDb routes to unified Feeds page
    if (page === 'rss' || page === 'tmdb') {
      page = 'feeds';
    }

    if (page === 'settings') {
      setSettingsInitialPage(null);
      setIsSettingsOpen(true);
      setIsNotificationsOpen(false);
      // Push history state for settings
      if (!skipHistory) {
        window.history.pushState({ page: currentPage, modal: 'settings' }, '', `/${currentPage}`);
      }
    } else if (settingsPages.includes(page)) {
      // Extract the settings page name (e.g., 'settings-comment-reply' -> 'comment')
      const settingsPage = page.replace('settings-', '').replace('-reply', '');
      setSettingsInitialPage(settingsPage);
      setIsSettingsOpen(true);
      setIsNotificationsOpen(false);
    } else if (page === 'shortcuts-help') {
      // Open shortcuts help modal
      setIsShortcutsHelpOpen(true);
    } else {
      // Track where we came from (if provided)
      if (fromPage) {
        setPreviousPage(fromPage);
      } else {
        // Otherwise, set current page as previous
        setPreviousPage(currentPage);
      }

      const resolvedParentPage =
        page === 'create' && !['create', 'compose-editor', 'compose-activity', 'pad-workspace'].includes(currentPage)
          ? currentPage
          : childPageMap[page];

      if (page === 'create' && !['create', 'compose-editor', 'compose-activity', 'pad-workspace'].includes(currentPage)) {
        setCreateSourcePage(fromPage || currentPage);
      }

      // If this is a child page, register it with BackNavigationContext
      if (resolvedParentPage) {
        const parentPage = resolvedParentPage;
        pushChildPage(page, parentPage);
      }

      updateCurrentPage(page, skipHistory ? "replace" : "push");

      // If navigating to a static page, close settings after setting the page
      // NO LONGER NEEDED: Static pages are now handled within SettingsPanel
      // if (staticPages.includes(page)) {
      //   setIsSettingsOpen(false);
      // }
      // Reset scroll position instantly without animation
      scrollToTop();
    }
  };

  const toggleSettings = () => {
    if (!isSettingsOpen) {
      // Save current page before opening settings
      const staticPages = ['privacy', 'terms', 'disclaimer', 'cookie', 'contact', 'about', 'data-deletion', 'app-info', 'design-system'];
      if (!staticPages.includes(currentPage)) {
        setPageBeforeSettings(currentPage);
      }
    }
    setIsSettingsOpen(!isSettingsOpen);
    setIsNotificationsOpen(false);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  const handleToggleNotifications = () => {
    setIsNotificationsOpen(!isNotificationsOpen);
    setIsSettingsOpen(false);
  };

  const handleOpenNotificationPage = (page: string, tab?: 'rss' | 'tmdb') => {
    if (page === 'feeds' && tab) {
      localStorage.setItem('feedsActiveTab', tab);
    }

    setIsNotificationsOpen(false);
    handleNavigate(page);
  };

  const handleDeleteNotification = useCallback((notificationId: string) => {
    const notificationIndex = notifications.findIndex((item) => item.id === notificationId);
    const notification = notificationIndex >= 0 ? notifications[notificationIndex] : null;
    if (!notification) return;

    haptics.medium();
    removeNotificationLocal(notificationId);

    showUndo({
      id: `notification-${notificationId}`,
      itemName: notification.title,
      onUndo: () => {
        restoreNotification(notification, notificationIndex);
      },
      onConfirm: async () => {
        try {
          await deleteNotification(notificationId);
          toast.success('Notification deleted');
        } catch (error) {
          restoreNotification(notification, notificationIndex);
          toast.error(error instanceof Error ? error.message : 'Failed to delete notification');
        }
      }
    });
  }, [deleteNotification, notifications, removeNotificationLocal, restoreNotification, showUndo]);

  const handleDeleteNotifications = useCallback(async (notificationIds: string[]) => {
    if (notificationIds.length === 0) return;
    await Promise.all(notificationIds.map((notificationId) => deleteNotification(notificationId)));
  }, [deleteNotification]);

  // Handle notification actions (approve, schedule, view, dismiss)
  const handleNotificationAction = (notificationId: string, actionType: string) => {
    haptics.medium();

    // Handle different action types
    switch (actionType) {
      case 'approve':
        // Remove the notification after action
        handleDeleteNotification(notificationId);
        break;
      case 'schedule':
        // Navigate to appropriate page
        break;
      case 'view':
        // Navigate to details page
        break;
      case 'dismiss':
        handleDeleteNotification(notificationId);
        break;
    }
  };

  // Desktop shortcuts (keyboard + trackpad gestures)
  useDesktopShortcuts({
    onNavigate: handleNavigate,
    onToggleSettings: toggleSettings,
    onToggleNotifications: handleToggleNotifications,
    currentPage,
    isSettingsOpen,
    isNotificationsOpen,
    onCloseSettings: handleCloseSettings,
    onCloseNotifications: () => setIsNotificationsOpen(false),
  });

  // Initialize PWA functionality
  useEffect(() => {
    if (import.meta.env.MODE === "test") {
      return;
    }

    // Set up the install prompt listener
    setupInstallPrompt();

    // Register the service worker
    registerServiceWorker();
  }, []);

  useEffect(() => {
    const savedSidebarState = window.localStorage.getItem(DESKTOP_SIDEBAR_STORAGE_KEY);
    if (savedSidebarState !== null) {
      setIsDesktopSidebarCollapsed(savedSidebarState === "true");
    }
  }, []);

  useEffect(() => {
    if (isNotificationsOpen) {
      setShouldMountNotificationPanel(true);
    }
  }, [isNotificationsOpen]);

  useEffect(() => {
    if (hasOpenTMDbModal) {
      setShouldMountTMDbModals(true);
    }
  }, [hasOpenTMDbModal]);

  useEffect(() => {
    window.localStorage.setItem(
      DESKTOP_SIDEBAR_STORAGE_KEY,
      String(isDesktopSidebarCollapsed),
    );
  }, [isDesktopSidebarCollapsed]);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const desktopSidebarWidth = isDesktopSidebarCollapsed
    ? DESKTOP_SIDEBAR_COLLAPSED_WIDTH
    : DESKTOP_SIDEBAR_EXPANDED_WIDTH;

  return (
    <div
      className="min-h-screen bg-white dark:bg-[#000000]"
      style={{ ["--desktop-sidebar-width" as string]: desktopSidebarWidth }}
    >
      {/* Skip to main content link for screen readers */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      <Navigation
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onToggleSettings={toggleSettings}
        onToggleNotifications={handleToggleNotifications}
        onLogout={handleLogout}
        unreadNotifications={unreadCount}
        isDesktopSidebarCollapsed={isDesktopSidebarCollapsed}
        onToggleDesktopSidebar={() => setIsDesktopSidebarCollapsed((previous) => !previous)}
      />

      <main
        id="main-content"
        className="relative z-10 mb-16 bg-white transition-[margin-left] duration-200 ease-in-out dark:bg-black lg:mb-0 lg:ml-[var(--desktop-sidebar-width)]"
        role="main"
      >
        <PullToRefresh
          disabled={isDesktopViewport || isSettingsOpen || isNotificationsOpen || isCaptionEditorOpen}
        >
          <div className="p-4 sm:p-6 lg:p-8 transition-opacity duration-200">
            {displayPage === "dashboard" && (
              <DashboardOverview onNavigate={handleNavigate} />
            )}
            {displayPage === "channels" && <Suspense fallback={<PageLoader />}><ChannelsPage /></Suspense>}
            {displayPage === "platforms" && <Suspense fallback={<PageLoader />}><PlatformsPage /></Suspense>}
            {displayPage === "logs" && <Suspense fallback={<PageLoader />}><LogsPage onNewNotification={addNotification} onNavigate={handleNavigate} /></Suspense>}
            {displayPage === "activity" && (
              <Suspense fallback={<PageLoader />}><RecentActivityPage onNavigate={handleNavigate} /></Suspense>
            )}
            {displayPage === "design-system" && (
              <Suspense fallback={<PageLoader />}><DesignSystemPage onNavigate={handleNavigate} /></Suspense>
            )}
            {displayPage === "feeds" && (
              <Suspense fallback={<PageLoader />}><FeedsPage onNavigate={handleNavigate} previousPage={previousPage} /></Suspense>
            )}
            {displayPage === "rss" && (
              <Suspense fallback={<PageLoader />}><RSSPage onNavigate={handleNavigate} /></Suspense>
            )}
            {displayPage === "rss-activity" && (
              <Suspense fallback={<PageLoader />}><RSSActivityPage onNavigate={handleNavigate} previousPage={previousPage} /></Suspense>
            )}
            {displayPage === "tmdb" && (
              <Suspense fallback={<PageLoader />}><TMDbFeedsPage onNavigate={handleNavigate} previousPage={previousPage} /></Suspense>
            )}
            {displayPage === "tmdb-activity" && (
              <Suspense fallback={<PageLoader />}><TMDbActivityPage onNavigate={handleNavigate} previousPage={previousPage} /></Suspense>
            )}
            {displayPage === "create" && (
              <Suspense fallback={<PageLoader />}><CreatePage onNavigate={handleNavigate} previousPage={createSourcePage} /></Suspense>
            )}
            {displayPage === "compose-editor" && (
              <Suspense fallback={<PageLoader />}><ComposeEditorPage onNavigate={handleNavigate} previousPage={previousPage} /></Suspense>
            )}
            {displayPage === "compose-activity" && (
              <Suspense fallback={<PageLoader />}><ComposeActivityPage onNavigate={handleNavigate} previousPage={previousPage} /></Suspense>
            )}
            {displayPage === "pad-workspace" && (
              <Suspense fallback={<PageLoader />}><PadWorkspacePage onNavigate={handleNavigate} previousPage={previousPage} /></Suspense>
            )}
            {displayPage === "video-details" && (
              <Suspense fallback={<PageLoader />}><VideoDetailsPage onNavigate={handleNavigate} previousPage={previousPage} /></Suspense>
            )}
            {displayPage === "video-activity" && (
              <Suspense fallback={<PageLoader />}><VideoActivityPage onNavigate={handleNavigate} previousPage={previousPage} /></Suspense>
            )}
            {displayPage === "video-studio" && (
              <Suspense fallback={<PageLoader />}><VideoStudioPage onNavigate={handleNavigate} previousPage={previousPage} onCaptionEditorChange={setIsCaptionEditorOpen} /></Suspense>
            )}
            {displayPage === "video-studio-activity" && (
              <Suspense fallback={<PageLoader />}><VideoStudioActivityPage onNavigate={handleNavigate} previousPage={previousPage} /></Suspense>
            )}
            {displayPage === "design-studio" && (
              <Suspense fallback={<PageLoader />}><DesignStudioPage onNavigate={handleNavigate} previousPage={previousPage} /></Suspense>
            )}
            {displayPage === "design-studio-activity" && (
              <Suspense fallback={<PageLoader />}><DesignStudioActivityPage onNavigate={handleNavigate} previousPage={previousPage} /></Suspense>
            )}
            {displayPage === "privacy" && <Suspense fallback={<PageLoader />}><PrivacyPage onNavigate={handleNavigate} /></Suspense>}
            {displayPage === "terms" && <Suspense fallback={<PageLoader />}><TermsPage onNavigate={handleNavigate} /></Suspense>}
            {displayPage === "disclaimer" && <Suspense fallback={<PageLoader />}><DisclaimerPage onNavigate={handleNavigate} /></Suspense>}
            {displayPage === "cookie" && <Suspense fallback={<PageLoader />}><CookiePage onNavigate={handleNavigate} /></Suspense>}
            {displayPage === "contact" && <Suspense fallback={<PageLoader />}><ContactPage onNavigate={handleNavigate} /></Suspense>}
            {displayPage === "about" && <Suspense fallback={<PageLoader />}><AboutPage onNavigate={handleNavigate} /></Suspense>}
            {displayPage === "data-deletion" && <Suspense fallback={<PageLoader />}><DataDeletionPage onNavigate={handleNavigate} /></Suspense>}
            {displayPage === "app-info" && <Suspense fallback={<PageLoader />}><AppInfoPage onNavigate={handleNavigate} /></Suspense>}
            {displayPage === "api-usage" && <Suspense fallback={<PageLoader />}><APIUsage onBack={() => handleNavigate(previousPage || "dashboard")} previousPage={previousPage} /></Suspense>}
            {displayPage === "comment-automation" && <Suspense fallback={<PageLoader />}><CommentAutomationPage onBack={() => handleNavigate(previousPage || "dashboard")} previousPage={previousPage} /></Suspense>}
            {displayPage === "upload-manager" && <Suspense fallback={<PageLoader />}><UploadManagerPage onBack={() => handleNavigate(previousPage || "dashboard")} /></Suspense>}
            {displayPage === "platforms/callback" && <Suspense fallback={<PageLoader />}><OAuthCallbackPage onNavigate={handleNavigate} /></Suspense>}
            {displayPage === "not-found" && <NotFoundPage onNavigate={handleNavigate} />}
          </div>
        </PullToRefresh>
      </main>
      <MobileBottomNav
        currentPage={currentPage}
        onNavigate={handleNavigate}
      />
      <CreateFab
        currentPage={currentPage}
        isSettingsOpen={isSettingsOpen}
        isNotificationsOpen={isNotificationsOpen}
        onNavigate={handleNavigate}
      />
      {isSettingsOpen && (
        <Suspense fallback={<OverlayLoader />}>
          <SettingsPanel
            isOpen={isSettingsOpen}
            onClose={handleCloseSettings}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            pageBeforeSettings={pageBeforeSettings}
            onNewNotification={addNotification}
            initialPage={settingsInitialPage}
          />
        </Suspense>
      )}
      {shouldRenderNotificationPanel && (
        <Suspense fallback={<OverlayLoader />}>
          <NotificationPanel
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            notifications={notifications}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onClearAll={clearAll}
            onDeleteNotification={handleDeleteNotification}
            onDeleteNotifications={handleDeleteNotifications}
            onNotificationAction={handleNotificationAction}
            onOpenPage={handleOpenNotificationPage}
          />
        </Suspense>
      )}

      {/* Undo Toast */}
      <UndoToast />

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Shortcuts Help */}
      <ShortcutsHelp isOpen={isShortcutsHelpOpen} onClose={() => setIsShortcutsHelpOpen(false)} />

      {/* TMDb Portal Modals - rendered at app level for render isolation */}
      {shouldRenderTMDbModals && (
        <Suspense fallback={<OverlayLoader />}>
          <TMDbModals />
        </Suspense>
      )}
      <ComposeScheduler />
    </div>
  );
}
