import { useState, lazy, Suspense, useEffect, useCallback } from "react";
import { DashboardOverview } from "./DashboardOverview";
import { Navigation } from "./Navigation";
import { MobileBottomNav } from "./MobileBottomNav";
import { SettingsPanel } from "./SettingsPanel";
import { NotificationPanel } from "./NotificationPanel";
import { InstallPrompt } from "./InstallPrompt";
import { NotFoundPage } from "./NotFoundPage";
import { UndoToast } from "./UndoToast";
import { useUndo } from "./UndoContext";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { TMDbModals } from "./tmdb/TMDbModals";
import { PullToRefresh } from "./PullToRefresh";
import { CreateFab } from "./CreateFab";
import { useDesktopShortcuts } from "../hooks/useDesktopShortcuts";
import { haptics } from "../utils/haptics";
import { useNotifications } from "../contexts/NotificationsContext";
import { useBackNavigation } from "../contexts/BackNavigationContext";
import { setupInstallPrompt, registerServiceWorker } from "../utils/pwa";
import { toast } from "sonner";
import { logout } from "../lib/auth";

const DESKTOP_SIDEBAR_STORAGE_KEY = "screndly.desktopSidebarCollapsed";
const DESKTOP_SIDEBAR_EXPANDED_WIDTH = "16rem";
const DESKTOP_SIDEBAR_COLLAPSED_WIDTH = "5rem";

// Lazy load heavy components for better performance
const ChannelsPage = lazy(() => import("./ChannelsPage").then(m => ({ default: m.ChannelsPage })));
const PlatformsPage = lazy(() => import("./PlatformsPage").then(m => ({ default: m.PlatformsPage })));
const LogsPage = lazy(() => import("./LogsPage").then(m => ({ default: m.LogsPage })));
const RecentActivityPage = lazy(() => import("./RecentActivityPage").then(m => ({ default: m.RecentActivityPage })));
const DesignSystemPage = lazy(() => import("./DesignSystemPage").then(m => ({ default: m.DesignSystemPage })));
const FeedsPage = lazy(() => import("./FeedsPage").then(m => ({ default: m.FeedsPage })));
const RSSPage = lazy(() => import("./RSSPage").then(m => ({ default: m.RSSPage })));
const RSSActivityPage = lazy(() => import("./RSSActivityPage").then(m => ({ default: m.RSSActivityPage })));
const TMDbFeedsPage = lazy(() => import("./TMDbFeedsPage").then(m => ({ default: m.TMDbFeedsPage })));
const TMDbActivityPage = lazy(() => import("./TMDbActivityPage").then(m => ({ default: m.TMDbActivityPage })));
const CreatePage = lazy(() => import("./CreatePage").then(m => ({ default: m.CreatePage })));
const ComposeEditorPage = lazy(() => import("./create/ComposeEditorPage").then(m => ({ default: m.ComposeEditorPage })));
const ComposeActivityPage = lazy(() => import("./create/ComposeActivityPage").then(m => ({ default: m.ComposeActivityPage })));
const PadWorkspacePage = lazy(() => import("./create/PadWorkspacePage").then(m => ({ default: m.PadWorkspacePage })));
const VideoDetailsPage = lazy(() => import("./VideoDetailsPage").then(m => ({ default: m.VideoDetailsPage })));
const VideoActivityPage = lazy(() => import("./VideoActivityPage").then(m => ({ default: m.VideoActivityPage })));
const VideoStudioPage = lazy(() => import("./VideoStudioPage").then(m => ({ default: m.VideoStudioPage })));
const VideoStudioActivityPage = lazy(() => import("./VideoStudioActivityPage").then(m => ({ default: m.VideoStudioActivityPage })));
const DesignStudioPage = lazy(() => import("./DesignStudioPage").then(m => ({ default: m.default })));
const DesignStudioActivityPage = lazy(() => import("./DesignStudioActivityPage").then(m => ({ default: m.DesignStudioActivityPage })));
const PrivacyPage = lazy(() => import("./PrivacyPage").then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import("./TermsPage").then(m => ({ default: m.TermsPage })));
const DisclaimerPage = lazy(() => import("./DisclaimerPage").then(m => ({ default: m.DisclaimerPage })));
const CookiePage = lazy(() => import("./CookiePage").then(m => ({ default: m.CookiePage })));
const ContactPage = lazy(() => import("./ContactPage").then(m => ({ default: m.ContactPage })));
const AboutPage = lazy(() => import("./AboutPage").then(m => ({ default: m.AboutPage })));
const DataDeletionPage = lazy(() => import("./DataDeletionPage").then(m => ({ default: m.DataDeletionPage })));
const AppInfoPage = lazy(() => import("./AppInfoPage").then(m => ({ default: m.AppInfoPage })));
const APIUsage = lazy(() => import("./APIUsage").then(m => ({ default: m.APIUsage })));
const OAuthCallbackPage = lazy(() => import("./OAuthCallbackPage").then(m => ({ default: m.OAuthCallbackPage })));
const CommentAutomationPage = lazy(() => import("./CommentAutomationPage").then(m => ({ default: m.CommentAutomationPage })));
const UploadManagerPage = lazy(() => import("./jobs/UploadManagerPage").then(m => ({ default: m.UploadManagerPage })));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ec1e24]"></div>
    <span className="sr-only">Loading...</span>
  </div>
);

// Helper: Get page from URL pathname
function getPageFromURL(): string {
  if (typeof window === 'undefined') return 'dashboard';
  const pathname = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
  if (pathname === 'callback') return 'platforms/callback';
  return pathname || 'dashboard';
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

  // Initialize currentPage from URL (preserves state on refresh)
  const [currentPage, setCurrentPageState] = useState(() => getPageFromURL());
  const [previousPage, setPreviousPage] = useState<string | null>(null);
  const [createSourcePage, setCreateSourcePage] = useState("dashboard");
  const [pageBeforeSettings, setPageBeforeSettings] = useState("dashboard");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialPage, setSettingsInitialPage] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCaptionEditorOpen, setIsCaptionEditorOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false,
  );

  // List of all valid pages
  const validPages = [
    'dashboard', 'channels', 'platforms', 'logs', 'activity', 'design-system',
    'feeds', 'rss', 'rss-activity', 'tmdb', 'tmdb-activity', 'video-details', 'video-activity',
    'create', 'compose-editor', 'compose-activity', 'pad-workspace',
    'video-studio', 'video-studio-activity', 'design-studio', 'design-studio-activity',
    'privacy', 'terms', 'disclaimer',
    'cookie', 'contact', 'about', 'data-deletion', 'app-info', 'api-usage',
    'callback',
    'platforms/callback',
    'comment-automation', 'upload-manager', 'not-found'
  ];
  // Wrapper to update URL when page changes
  const setCurrentPage = (page: string) => {
    setCurrentPageState(page);
    // Update URL without reload (for bookmarking/sharing)
    const newUrl = page === 'dashboard' ? '/' : `/${page}`;
    if (window.location.pathname !== newUrl) {
      window.history.pushState({ page }, '', newUrl);
    }
  };

  // Check if current page is valid, if not show 404
  const displayPage = validPages.includes(currentPage) ? currentPage : 'not-found';

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
    if (!window.history.state?.page) {
      const basePath = `/${currentPage === 'dashboard' ? '' : currentPage}`;
      const preservedSuffix = `${window.location.search || ''}${window.location.hash || ''}`;
      window.history.replaceState({ page: currentPage }, '', `${basePath}${preservedSuffix}`);
    }
  }, []);

  // Create a stable navigation callback for BackNavigationContext
  const navigationCallback = useCallback((page: string) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  }, []);

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
    const settingsPages = ['settings-comment-reply', 'settings-video', 'settings-rss', 'settings-tmdb', 'settings-videostudio', 'settings-error', 'settings-cleanup', 'settings-haptic', 'settings-appearance', 'settings-notifications', 'settings-thumbnail', 'settings-autopost'];

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

      setCurrentPage(page);

      // Push to browser history for back button support (crucial for Android PWA)
      if (!skipHistory) {
        const url = page === 'dashboard' ? '/' : `/${page}`;
        window.history.pushState({ page }, '', url);
      }

      // If navigating to a static page, close settings after setting the page
      // NO LONGER NEEDED: Static pages are now handled within SettingsPanel
      // if (staticPages.includes(page)) {
      //   setIsSettingsOpen(false);
      // }
      // Reset scroll position instantly without animation
      window.scrollTo(0, 0);
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
        <SettingsPanel
          isOpen={isSettingsOpen}
          onClose={handleCloseSettings}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
          pageBeforeSettings={pageBeforeSettings}
          onNewNotification={addNotification}
          initialPage={settingsInitialPage}
        />
      )}
        <NotificationPanel
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onClearAll={clearAll}
          onDeleteNotification={handleDeleteNotification}
          onNotificationAction={handleNotificationAction}
          onOpenPage={handleOpenNotificationPage}
        />

      {/* Undo Toast */}
      <UndoToast />

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Shortcuts Help */}
      <ShortcutsHelp isOpen={isShortcutsHelpOpen} onClose={() => setIsShortcutsHelpOpen(false)} />

      {/* TMDb Portal Modals - rendered at app level for render isolation */}
      <TMDbModals />
    </div>
  );
}
