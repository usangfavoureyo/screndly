import { useState, lazy, Suspense, useEffect, useCallback } from "react";
import { DashboardOverview } from "./DashboardOverview";
import { Navigation } from "./Navigation";
import { MobileBottomNav } from "./MobileBottomNav";
import { SettingsPanel } from "./SettingsPanel";
import { NotificationPanel } from "./NotificationPanel";
import { InstallPrompt } from "./InstallPrompt";
import { NotFoundPage } from "./NotFoundPage";
import { UndoToast } from "./UndoToast";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { TMDbModals } from "./tmdb/TMDbModals";
import { useSwipeNavigation } from "../hooks/useSwipeNavigation";
import { useDesktopShortcuts } from "../hooks/useDesktopShortcuts";
import { haptics } from "../utils/haptics";
import { useNotifications } from "../contexts/NotificationsContext";
import { useBackNavigation } from "../contexts/BackNavigationContext";
import { setupInstallPrompt, registerServiceWorker } from "../utils/pwa";
import { logout } from "../lib/auth";

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

// ABSOLUTE TRUTH: STALE CLIENT SENTRY
const StaleVersionBanner = () => {
  const [isStale, setIsStale] = useState(false);
  const [version, setVersion] = useState('unknown');

  useEffect(() => {
    const checkVersion = async () => {
      const { CLIENT_VERSION } = await import('../lib/api/authToken');
      const TARGET_VERSION = '1.0.1-auth-debug-phase-5-final';
      setVersion(CLIENT_VERSION);
      if (CLIENT_VERSION !== TARGET_VERSION) {
        setIsStale(true);
      }
    };
    checkVersion();
  }, []);

  if (!isStale) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#ec1e24] text-white p-3 text-center font-bold shadow-xl animate-bounce">
      <p className="text-sm">
        ⚠️ STALE VERSION DETECTED (Running: {version})
      </p>
      <button
        onClick={async () => {
          const { nukeApp } = await import('../utils/pwa');
          await nukeApp();
        }}
        className="mt-2 bg-white text-[#ec1e24] px-4 py-1 rounded-full text-xs hover:bg-gray-100 transition-colors uppercase tracking-widest"
      >
        Force Clear Cache & Update Now
      </button>
    </div>
  );
};

// Helper: Get page from URL pathname
function getPageFromURL(): string {
  if (typeof window === 'undefined') return 'dashboard';
  const pathname = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
  return pathname || 'dashboard';
}

export function AppContent() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, addNotification, deleteNotification } = useNotifications();

  // Initialize currentPage from URL (preserves state on refresh)
  const [currentPage, setCurrentPageState] = useState(() => getPageFromURL());
  const [previousPage, setPreviousPage] = useState<string | null>(null);
  const [pageBeforeSettings, setPageBeforeSettings] = useState("dashboard");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialPage, setSettingsInitialPage] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCaptionEditorOpen, setIsCaptionEditorOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isNavDragging, setIsNavDragging] = useState(false);

  // List of all valid pages
  const validPages = [
    'dashboard', 'channels', 'platforms', 'logs', 'activity', 'design-system',
    'feeds', 'rss', 'rss-activity', 'tmdb', 'tmdb-activity', 'video-details', 'video-activity',
    'video-studio', 'video-studio-activity', 'design-studio', 'design-studio-activity',
    'privacy', 'terms', 'disclaimer',
    'cookie', 'contact', 'about', 'data-deletion', 'app-info', 'api-usage',
    'platforms/callback',
    'comment-automation', 'upload-manager', 'not-found'
  ];

  // Global Auth Watcher for Production Debugging
  useEffect(() => {
    const checkAuthStatus = async () => {
      const { getToken, CLIENT_VERSION } = await import('../lib/api/authToken');
      const token = getToken();
      const hostname = window.location.hostname;
      const isProduction = hostname.includes('railway') || hostname.includes('vercel.app') || hostname === 'screndly.com';

      if (isProduction) {
        console.warn(`[System v${CLIENT_VERSION}] App initialized on ${hostname}`);
        if (!token) {
          console.warn('[System] No auth token found on startup.');
        } else {
          const type = token.includes('.') ? 'JWT' : 'OTHER';
          console.warn(`[System] Auth token found (Type: ${type}, Len: ${token.length})`);
        }
      }
    };
    checkAuthStatus();
  }, []);

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
      'design-studio': 'design-studio',
      'video-studio': 'video-studio',
      // Child pages map to their parent
      'rss': 'feeds',
      'tmdb': 'feeds',
      'rss-activity': 'feeds',
      'tmdb-activity': 'feeds',
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
      window.history.replaceState({ page: currentPage }, '', `/${currentPage === 'dashboard' ? '' : currentPage}`);
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

      // If this is a child page, register it with BackNavigationContext
      if (childPageMap[page]) {
        const parentPage = childPageMap[page];
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

  // Handle notification actions (approve, schedule, view, dismiss)
  const handleNotificationAction = (notificationId: string, actionType: string) => {
    haptics.medium();

    // Handle different action types
    switch (actionType) {
      case 'approve':
        // Remove the notification after action
        deleteNotification(notificationId);
        break;
      case 'schedule':
        // Navigate to appropriate page
        break;
      case 'view':
        // Navigate to details page
        break;
      case 'dismiss':
        deleteNotification(notificationId);
        break;
    }
  };

  // Bottom navigation pages in order - read from localStorage to match user's custom order
  const [bottomNavPages, setBottomNavPages] = useState<string[]>(() => {
    const savedOrder = localStorage.getItem('bottomNavOrder');
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        // Migrate old 'rss' and 'tmdb' to 'feeds'
        const migrated = parsed.map((page: string) => {
          if (page === 'rss' || page === 'tmdb') return 'feeds';
          return page;
        });
        // Remove duplicates (in case both rss and tmdb existed)
        const unique = Array.from(new Set(migrated));
        // Save the migrated version back to localStorage
        localStorage.setItem('bottomNavOrder', JSON.stringify(unique));
        return unique;
      } catch {
        return ['dashboard', 'channels', 'platforms', 'feeds', 'design-studio', 'video-studio'];
      }
    }
    return ['dashboard', 'channels', 'platforms', 'feeds', 'design-studio', 'video-studio'];
  });

  // Listen for changes to bottomNavOrder in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const savedOrder = localStorage.getItem('bottomNavOrder');
      if (savedOrder) {
        try {
          setBottomNavPages(JSON.parse(savedOrder));
        } catch {
          // Ignore parse errors
        }
      }
    };

    // Listen for storage events (from other tabs/windows)
    window.addEventListener('storage', handleStorageChange);

    // Also check periodically for changes from same tab
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Swipe navigation handlers
  const handleSwipeLeft = () => {
    // Disable swipe when caption editor is open
    if (isCaptionEditorOpen) {
      return;
    }

    // If notifications panel is open, close it
    if (isNotificationsOpen) {
      haptics.light();
      setIsNotificationsOpen(false);
      return;
    }

    const currentIndex = bottomNavPages.indexOf(currentPage);

    if (currentIndex !== -1 && currentIndex < bottomNavPages.length - 1) {
      haptics.light();
      handleNavigate(bottomNavPages[currentIndex + 1]);
    }
  };

  const handleSwipeRight = () => {
    // Disable swipe when caption editor is open
    if (isCaptionEditorOpen) {
      return;
    }

    // Disable swipe right when notifications panel is open
    if (isNotificationsOpen) {
      return;
    }

    // If settings panel is open, close it (swipe to logs page)
    if (isSettingsOpen) {
      haptics.light();
      handleCloseSettings();
      return;
    }

    const currentIndex = bottomNavPages.indexOf(currentPage);

    if (currentIndex > 0) {
      haptics.light();
      handleNavigate(bottomNavPages[currentIndex - 1]);
    }
  };

  // Only enable swipe navigation on bottom nav pages or when notifications/settings are open
  // Disable swipe when caption editor is open or nav is being dragged
  const isBottomNavPage = bottomNavPages.includes(currentPage);
  const isSwipeEnabled = (isBottomNavPage || isNotificationsOpen || isSettingsOpen) && !isCaptionEditorOpen && !isNavDragging;

  useSwipeNavigation({
    onSwipeLeft: isSwipeEnabled ? handleSwipeLeft : () => { },
    onSwipeRight: isSwipeEnabled ? handleSwipeRight : () => { },
    // Decreased sensitivity (increased swipe distance) - 80px default, 120px for logs
    minSwipeDistance: 80,
    increasedMinSwipeDistance: currentPage === 'logs' ? 120 : undefined,
  });

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

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000]">
      <StaleVersionBanner />
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
      />

      <main id="main-content" className="lg:ml-64 mb-16 lg:mb-0 relative z-10 bg-white dark:bg-black" role="main">
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
      </main>
      <MobileBottomNav
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onDragStateChange={setIsNavDragging}
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
        onDeleteNotification={deleteNotification}
        onNotificationAction={handleNotificationAction}
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
