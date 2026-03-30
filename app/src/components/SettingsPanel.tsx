import { Suspense, useState, useRef, useEffect, type ReactNode } from 'react';
import { X, Video02, MessageSquare, Rss, Globe, Clock01, AlertTriangle, Trash2, Smartphone03, Palette, Bell, Download, Search, ChevronRight, LogOut, Auction, Mail, Film, Album01, Image, WifiNoSignal } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useSettings } from '../contexts/SettingsContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { haptics } from '../utils/haptics';
import { lazyWithRetry } from '../utils/performance';
import { useBackNavigation } from '../contexts/BackNavigationContext';
import { useTransientHistoryState } from '../hooks/useTransientHistoryState';
import { useScrollLock } from '../hooks/useScrollLock';
import { PageLoader } from './PageLoader';

const VideoSettings = lazyWithRetry(() => import('./settings/VideoSettings').then((module) => ({ default: module.VideoSettings })), 'VideoSettings');
const CommentReplySettings = lazyWithRetry(() => import('./settings/CommentReplySettings').then((module) => ({ default: module.CommentReplySettings })), 'CommentReplySettings');
const RssSettings = lazyWithRetry(() => import('./settings/RssSettings').then((module) => ({ default: module.RssSettings })), 'RssSettings');
const TmdbFeedsSettings = lazyWithRetry(() => import('./settings/TmdbFeedsSettings').then((module) => ({ default: module.TmdbFeedsSettings })), 'TmdbFeedsSettings');
const ErrorHandlingSettings = lazyWithRetry(() => import('./settings/ErrorHandlingSettings').then((module) => ({ default: module.ErrorHandlingSettings })), 'ErrorHandlingSettings');
const CleanupSettings = lazyWithRetry(() => import('./settings/CleanupSettings').then((module) => ({ default: module.CleanupSettings })), 'CleanupSettings');
const HapticSettings = lazyWithRetry(() => import('./settings/HapticSettings').then((module) => ({ default: module.HapticSettings })), 'HapticSettings');
const AppearanceSettings = lazyWithRetry(() => import('./settings/AppearanceSettings').then((module) => ({ default: module.AppearanceSettings })), 'AppearanceSettings');
const NotificationsSettings = lazyWithRetry(() => import('./settings/NotificationsSettings').then((module) => ({ default: module.NotificationsSettings })), 'NotificationsSettings');
const VideoStudioSettings = lazyWithRetry(() => import('./settings/VideoStudioSettings').then((module) => ({ default: module.VideoStudioSettings })), 'VideoStudioSettings');
const DesignStudioSettings = lazyWithRetry(() => import('./settings/DesignStudioSettings').then((module) => ({ default: module.DesignStudioSettings })), 'DesignStudioSettings');
const PWASettings = lazyWithRetry(() => import('./settings/PWASettings').then((module) => ({ default: module.PWASettings })), 'PWASettings');
const TimezoneSettings = lazyWithRetry(() => import('./settings/TimezoneSettings').then((module) => ({ default: module.TimezoneSettings })), 'TimezoneSettings');
const ThumbnailSettings = lazyWithRetry(() => import('./settings/ThumbnailSettings').then((module) => ({ default: module.ThumbnailSettings })), 'ThumbnailSettings');
const PrivacyPage = lazyWithRetry(() => import('./PrivacyPage').then((module) => ({ default: module.PrivacyPage })), 'PrivacyPage');
const TermsPage = lazyWithRetry(() => import('./TermsPage').then((module) => ({ default: module.TermsPage })), 'TermsPage');
const DisclaimerPage = lazyWithRetry(() => import('./DisclaimerPage').then((module) => ({ default: module.DisclaimerPage })), 'DisclaimerPage');
const CookiePage = lazyWithRetry(() => import('./CookiePage').then((module) => ({ default: module.CookiePage })), 'CookiePage');
const ContactPage = lazyWithRetry(() => import('./ContactPage').then((module) => ({ default: module.ContactPage })), 'ContactPage');
const AboutPage = lazyWithRetry(() => import('./AboutPage').then((module) => ({ default: module.AboutPage })), 'AboutPage');
const DesignSystemPage = lazyWithRetry(() => import('./DesignSystemPage').then((module) => ({ default: module.DesignSystemPage })), 'DesignSystemPage');
const AppInfoPage = lazyWithRetry(() => import('./AppInfoPage').then((module) => ({ default: module.AppInfoPage })), 'AppInfoPage');
const DataDeletionPage = lazyWithRetry(() => import('./DataDeletionPage').then((module) => ({ default: module.DataDeletionPage })), 'DataDeletionPage');

const SettingsContentLoader = () => (
  <div className="fixed inset-0 z-[60] bg-white/95 dark:bg-black/95">
    <PageLoader fullScreen size="md" className="bg-transparent" label="Loading settings..." />
  </div>
);

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onNavigate: (page: string) => void;
  pageBeforeSettings?: string;
  onNewNotification?: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning', source: 'upload' | 'rss' | 'tmdb' | 'videostudio' | 'system') => void;
  initialPage?: string | null;
}

function normalizeSettingsPage(page: string | null | undefined): string | null {
  if (page === 'pad' || page === 'compose') {
    return null;
  }

  return page ?? null;
}

export function SettingsPanel({ isOpen, onClose, onLogout, onNavigate, onNewNotification, initialPage }: SettingsPanelProps) {
  const { theme, setTheme } = useTheme();
  const { settings, updateSetting, updateSettings } = useSettings();

  const { registerModalWithCloseHandler, unregisterModal } = useBackNavigation();

  useScrollLock(isOpen);

  const [activeSettingsPage, setActiveSettingsPage] = useState<string | null>(normalizeSettingsPage(initialPage));
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const staticPageScrollRef = useRef<HTMLDivElement>(null);
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);
  const floatingSurfaceClasses = 'border border-black/10 bg-white/90 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#050505]/88 dark:shadow-[0_16px_38px_rgba(0,0,0,0.46)]';

  // Unified Navigation Handlers (UI drives History)
  const handleCloseSettings = () => {
    window.history.back();
  };

  const handleCloseSubpage = () => {
    haptics.light();
    setActiveSettingsPage(null);
  };

  // Integration with BackNavigationContext to resolve conflicts
  useEffect(() => {
    if (activeSettingsPage) {
      registerModalWithCloseHandler('settings-subpage', () => {
        setActiveSettingsPage(null);
      });
    } else {
      unregisterModal('settings-subpage');
    }

    return () => {
      unregisterModal('settings-subpage');
    };
  }, [activeSettingsPage, registerModalWithCloseHandler, unregisterModal]);

  useTransientHistoryState(
    activeSettingsPage !== null,
    'settings-subpage',
    'settings-subpage',
    activeSettingsPage ? { page: activeSettingsPage } : undefined,
  );

  // Restore scroll position when SettingsPanel opens
  // Using useEffect instead of useLayoutEffect to avoid blocking paint
  useEffect(() => {
    if (isOpen && activeSettingsPage === null && scrollContainerRef.current) {
      // First check if we're returning from a static page (mobile/tablet only)
      const isDesktop = window.innerWidth >= 1024;
      if (!isDesktop) {
        const savedStaticPageScroll = sessionStorage.getItem('settingsPanelScrollFromStaticPage');
        if (savedStaticPageScroll) {
          scrollContainerRef.current.scrollTop = parseInt(savedStaticPageScroll, 10);
          sessionStorage.removeItem('settingsPanelScrollFromStaticPage');
          return;
        }
      }
      // Otherwise restore from regular settings sub-page navigation
      scrollContainerRef.current.scrollTop = savedScrollPosition;
    }
  }, [activeSettingsPage, savedScrollPosition, isOpen]);

  useEffect(() => {
    if (
      activeSettingsPage &&
      [
        'privacy',
        'terms',
        'disclaimer',
        'cookie',
        'data-deletion',
        'contact',
        'about',
        'design-system',
        'app-info',
      ].includes(activeSettingsPage)
    ) {
      staticPageScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeSettingsPage]);

  const handleOpenSettingsPage = (pageId: string) => {
    if (scrollContainerRef.current) {
      setSavedScrollPosition(scrollContainerRef.current.scrollTop);
    }
    haptics.light();
    setActiveSettingsPage(pageId);
  };

  // Define all settings items with searchable terms
  const settingsItems = [
    {
      id: 'video',
      label: 'Video',
      icon: Video02,
      keywords: [
        'video', 'trailer', 'monitoring', 'fetch', 'tracking',
        'interval', 'fetch interval', 'check frequency', 'polling',
        'region', 'region filter', 'location', 'country', 'geographic',
        'enabled', 'disable', 'turn off', 'turn on',
        'automatic', 'auto fetch', 'auto check'
      ]
    },
    {
      id: 'thumbnail',
      label: 'Thumbnail Overlay',
      icon: Album01,
      keywords: [
        'thumbnail', 'template', 'logo', 'position', 'overlay', 'image',
        'youtube', 'twitter', 'x', 'facebook', 'instagram', 'tiktok', 'platform',
        'backdrop', 'poster', 'cover', 'banner',
        'movie', 'tv', 'show', 'media',
        'auto', 'scale', 'size', 'resize', 'scaling',
        'placement', 'positioning', 'location',
        'preview', 'live preview',
        'top left', 'top center', 'top right', 'middle left', 'middle center', 'middle right', 'bottom left', 'bottom center', 'bottom right',
        'upload', 'custom logo', 'logo upload'
      ]
    },
    {
      id: 'comment',
      label: 'Comment Automation',
      icon: MessageSquare,
      keywords: [
        'comment', 'reply', 'automation', 'auto reply', 'automatic reply',
        'ai', 'artificial intelligence', 'openai', 'gpt', 'llm',
        'model', 'ai model', 'openai model',
        'blacklist', 'block', 'filter', 'ignore', 'banned words',
        'throttle', 'rate limit', 'frequency', 'limit',
        'retention', 'history', 'keep', 'delete', 'cleanup',
        'activity', 'log', 'tracking', 'record',
        'enable', 'disable', 'turn on', 'turn off'
      ]
    },
    {
      id: 'rss',
      label: 'RSS Feeds',
      icon: Rss,
      keywords: [
        'rss', 'feed', 'feeds', 'syndication',
        'posting', 'post', 'share', 'publish',
        'image', 'photo', 'thumbnail', 'media',
        'platform', 'social media', 'youtube', 'twitter', 'x', 'facebook', 'instagram',
        'deduplication', 'duplicate', 'unique', 'prevent duplicates',
        'fetch', 'check', 'poll', 'interval', 'frequency',
        'url', 'feed url', 'source',
        'enable', 'disable', 'turn on', 'turn off'
      ]
    },
    {
      id: 'tmdb',
      label: 'TMDb Feeds',
      icon: WifiNoSignal,
      keywords: [
        'tmdb', 'the movie database', 'movie', 'database', 'film',
        'feeds', 'feed', 'content',
        'anniversary', 'birthday', 'release date', 'celebration',
        'scheduler', 'schedule', 'timing', 'frequency',
        'popular', 'trending', 'now playing', 'upcoming', 'top rated',
        'enable', 'disable', 'turn on', 'turn off',
        'interval', 'fetch interval', 'check frequency'
      ]
    },
    {
      id: 'designstudio',
      label: 'Design Studio',
      icon: Image,
      keywords: [
        'design', 'studio', 'creation', 'generate', 'create',
        'llm', 'language model', 'ai', 'artificial intelligence',
        'photopea', 'design editing', 'rendering',
        'gpt', 'openai', 'chatgpt', 'model',
        'caption', 'captions', 'subtitles', 'text',
        'scenes', 'scene detection', 'segments',
        'web search', 'search', 'google', 'serper', 'context',
        'provider', 'search provider',
        'max results', 'result limit',
        'enable', 'disable', 'turn on', 'turn off'
      ]
    },
    {
      id: 'videostudio',
      label: 'Video Studio',
      icon: Film,
      keywords: [
        'video', 'studio', 'generation', 'create', 'generate',
        'llm', 'language model', 'ai', 'artificial intelligence',
        'shotstack', 'video editing', 'rendering',
        'gpt', 'openai', 'chatgpt', 'model',
        'caption', 'captions', 'subtitles', 'text',
        'scenes', 'scene detection', 'segments',
        'web search', 'search', 'google', 'serper', 'context',
        'provider', 'search provider',
        'max results', 'result limit',
        'enable', 'disable', 'turn on', 'turn off'
      ]
    },
    {
      id: 'timezone',
      label: 'Timezone',
      icon: Clock01,
      keywords: [
        'timezone', 'time zone', 'time', 'zone', 'clock',
        'schedule', 'scheduling', 'timing',
        'generation', 'post timing', 'publish time',
        'feeds', 'rss', 'tmdb',
        'utc', 'gmt', 'offset',
        'location', 'region', 'area',
        'america', 'europe', 'asia', 'pacific', 'new york', 'los angeles', 'london', 'tokyo'
      ]
    },
    {
      id: 'error',
      label: 'Error Handling',
      icon: AlertTriangle,
      keywords: [
        'error', 'errors', 'failure', 'failed', 'problem',
        'handling', 'management', 'recovery',
        'retry', 'retry attempts', 'max retries', 'retry limit',
        'logging', 'log', 'record', 'track',
        'alert', 'notification', 'notify', 'warning',
        'automatic', 'auto retry', 'automatic retry',
        'enable', 'disable', 'turn on', 'turn off'
      ]
    },
    {
      id: 'cleanup',
      label: 'Cleanup',
      icon: Trash2,
      keywords: [
        'cleanup', 'clean', 'maintenance', 'housekeeping',
        'storage', 'disk', 'space', 'memory',
        'retention', 'keep', 'preserve', 'duration',
        'delete', 'remove', 'purge', 'clear',
        'comment', 'comments', 'comment activity', 'comment logs',
        'logs', 'log files', 'activity logs',
        'activity', 'history', 'recent activity',
        'recent', 'recent videos', 'recent uploads',
        'combined', 'combined activity', 'all activity',
        'automatic', 'auto delete', 'auto cleanup',
        'days', 'retention days', 'keep for days',
        'enable', 'disable', 'turn on', 'turn off'
      ]
    },
    {
      id: 'haptic',
      label: 'Haptic Feedback',
      icon: Smartphone03,
      keywords: [
        'haptic', 'haptics', 'vibration', 'vibrate', 'buzz',
        'feedback', 'tactile', 'touch',
        'mobile', 'phone', 'device',
        'enable', 'disable', 'turn on', 'turn off'
      ]
    },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: Palette,
      keywords: [
        'appearance', 'theme', 'style', 'look', 'visual',
        'dark', 'dark mode', 'dark theme', 'night mode',
        'light', 'light mode', 'light theme', 'day mode',
        'mode', 'color', 'colors', 'scheme', 'color scheme',
        'switch', 'toggle', 'change'
      ]
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      keywords: [
        'notifications', 'notification', 'alerts', 'alert',
        'email', 'email notification', 'mail',
        'push', 'push notification', 'browser notification',
        'notify', 'inform', 'update',
        'enable', 'disable', 'turn on', 'turn off',
        'sound', 'badge', 'banner'
      ]
    },
    {
      id: 'pwa',
      label: 'Progressive Web App',
      icon: Download,
      keywords: [
        'pwa', 'progressive web app', 'progressive',
        'web', 'app', 'application',
        'install', 'installation', 'add to home', 'add to homescreen',
        'offline', 'offline mode', 'work offline',
        'cache', 'caching', 'cached',
        'service', 'worker', 'service worker',
        'update', 'version', 'latest version'
      ]
    },
  ];

  const legalItems = [
    { id: 'privacy', label: 'Privacy Policy', keywords: ['privacy', 'policy', 'data', 'gdpr'] },
    { id: 'terms', label: 'Terms of Service', keywords: ['terms', 'service', 'agreement', 'legal'] },
    { id: 'disclaimer', label: 'Disclaimer', keywords: ['disclaimer', 'liability', 'legal'] },
    { id: 'cookie', label: 'Cookie Policy', keywords: ['cookie', 'tracking', 'privacy'] },
  ];

  const companyItems = [
    { id: 'contact', label: 'Contact', keywords: ['contact', 'support', 'help', 'email'] },
    { id: 'about', label: 'About', keywords: ['about', 'company', 'screen', 'render'] },
    { id: 'design-system', label: 'Design System', keywords: ['design', 'system', 'tokens', 'components', 'ui'] },
  ];

  // Filter items based on search query
  const filterItems = (items: typeof settingsItems) => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item =>
      item.label.toLowerCase().includes(query) ||
      item.keywords.some(keyword => keyword.includes(query))
    );
  };

  const filteredSettings = filterItems(settingsItems);
  const filteredLegal = filterItems(legalItems.map(item => ({ ...item, icon: Auction })));
  const filteredCompany = filterItems(companyItems.map(item => ({ ...item, icon: Mail })));

  const hasResults = filteredSettings.length > 0 || filteredLegal.length > 0 || filteredCompany.length > 0;

  if (!isOpen) return null;

  const renderSettingsSubpage = (
    content: ReactNode,
    overlayClassName = 'hidden lg:block fixed inset-0 bg-black/50 z-50 lg:pl-64',
    onOverlayClick = handleCloseSubpage,
  ) => (
    <>
      <div className={overlayClassName} onClick={onOverlayClick} />
      <Suspense fallback={<SettingsContentLoader />}>{content}</Suspense>
    </>
  );

  const renderStaticSettingsPage = (content: ReactNode) => (
    <>
      <div className="hidden lg:block fixed inset-0 bg-black/50 z-40 lg:pl-64" onClick={handleCloseSubpage} />
      <div
        key={activeSettingsPage}
        ref={staticPageScrollRef}
        className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto overscroll-y-contain touch-pan-y"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <Suspense fallback={<SettingsContentLoader />}>{content}</Suspense>
      </div>
    </>
  );

  // Render sub-page if one is active

  if (activeSettingsPage === 'video') {
    return renderSettingsSubpage(
      <VideoSettings settings={settings} updateSetting={updateSetting} updateSettings={updateSettings} onBack={handleCloseSubpage} />
    );
  }
  if (activeSettingsPage === 'comment') {
    return renderSettingsSubpage(
      <CommentReplySettings settings={settings} updateSetting={updateSetting} onBack={handleCloseSubpage} />
    );
  }
  if (activeSettingsPage === 'rss') {
    return renderSettingsSubpage(
      <RssSettings settings={settings} updateSetting={updateSetting} onBack={handleCloseSubpage} />
    );
  }
  if (activeSettingsPage === 'tmdb') {
    return renderSettingsSubpage(
      <TmdbFeedsSettings onBack={handleCloseSubpage} />
    );
  }
  if (activeSettingsPage === 'videostudio') {
    return renderSettingsSubpage(
      <VideoStudioSettings onSave={updateSetting} onBack={handleCloseSubpage} />,
      'hidden lg:block fixed inset-0 bg-black/50 z-50 lg:pl-64',
      () => {
        haptics.light();
        handleCloseSubpage();
      }
    );
  }
  if (activeSettingsPage === 'designstudio') {
    return renderSettingsSubpage(
      <DesignStudioSettings onSave={updateSetting} onBack={handleCloseSubpage} />,
      'hidden lg:block fixed inset-0 bg-black/50 z-50 lg:pl-64',
      () => {
        haptics.light();
        handleCloseSubpage();
      }
    );
  }
  if (activeSettingsPage === 'error') {
    return renderSettingsSubpage(
      <ErrorHandlingSettings onBack={handleCloseSubpage} />
    );
  }
  if (activeSettingsPage === 'cleanup') {
    return renderSettingsSubpage(
      <CleanupSettings
        settings={settings}
        updateSetting={updateSetting}
        updateSettings={updateSettings}
        onBack={handleCloseSubpage}
      />
    );
  }
  if (activeSettingsPage === 'haptic') {
    return renderSettingsSubpage(
      <HapticSettings settings={settings} updateSetting={updateSetting} onBack={handleCloseSubpage} />
    );
  }
  if (activeSettingsPage === 'appearance') {
    return renderSettingsSubpage(
      <AppearanceSettings theme={theme} setTheme={setTheme} updateSetting={updateSetting} onBack={handleCloseSubpage} />
    );
  }
  if (activeSettingsPage === 'notifications') {
    return renderSettingsSubpage(
      <NotificationsSettings settings={settings} updateSetting={updateSetting} onBack={handleCloseSubpage} />,
      'hidden lg:block fixed inset-0 bg-black/50 z-40 lg:pl-64'
    );
  }
  if (activeSettingsPage === 'pwa') {
    return renderSettingsSubpage(
      <PWASettings settings={settings} updateSetting={updateSetting} onBack={handleCloseSubpage} />,
      'hidden lg:block fixed inset-0 bg-black/50 z-40 lg:pl-64'
    );
  }
  if (activeSettingsPage === 'timezone') {
    return renderSettingsSubpage(
      <TimezoneSettings onBack={handleCloseSubpage} />,
      'hidden lg:block fixed inset-0 bg-black/50 z-40 lg:pl-64'
    );
  }
  if (activeSettingsPage === 'thumbnail') {
    return renderSettingsSubpage(
      <ThumbnailSettings
        settings={settings}
        updateSetting={updateSetting}
        onBack={handleCloseSubpage}
      />,
      'hidden lg:block fixed inset-0 bg-black/50 z-40 lg:pl-64'
    );
  }

  // Legal Pages
  if (activeSettingsPage === 'privacy') {
    return renderStaticSettingsPage(<PrivacyPage onNavigate={() => handleCloseSubpage()} />);
  }
  if (activeSettingsPage === 'terms') {
    return renderStaticSettingsPage(<TermsPage onNavigate={() => handleCloseSubpage()} />);
  }
  if (activeSettingsPage === 'disclaimer') {
    return renderStaticSettingsPage(<DisclaimerPage onNavigate={() => handleCloseSubpage()} />);
  }
  if (activeSettingsPage === 'cookie') {
    return renderStaticSettingsPage(<CookiePage onNavigate={() => handleCloseSubpage()} />);
  }
  if (activeSettingsPage === 'data-deletion') {
    return renderStaticSettingsPage(<DataDeletionPage onNavigate={() => handleCloseSubpage()} />);
  }

  // Company Pages
  if (activeSettingsPage === 'contact') {
    return renderStaticSettingsPage(<ContactPage onNavigate={() => handleCloseSubpage()} />);
  }
  if (activeSettingsPage === 'about') {
    return renderStaticSettingsPage(<AboutPage onNavigate={() => handleCloseSubpage()} />);
  }
  if (activeSettingsPage === 'design-system') {
    return renderStaticSettingsPage(<DesignSystemPage onNavigate={() => handleCloseSubpage()} />);
  }
  if (activeSettingsPage === 'app-info') {
    return renderStaticSettingsPage(<AppInfoPage onNavigate={() => handleCloseSubpage()} />);
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50 lg:pl-64"
        onClick={handleCloseSettings}
      />

      {/* Settings Panel */}
      <div
        ref={scrollContainerRef}
        className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto"
      >
        <div className="sticky top-0 z-10 bg-gradient-to-b from-white via-white/95 to-transparent px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] dark:from-[#000000] dark:via-[#000000]/95">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="pt-1">
              <h2 className="text-xl text-gray-900 dark:text-white">Settings</h2>
            </div>
            <button
              className={`flex h-12 w-12 items-center justify-center rounded-full text-gray-900 transition-[transform,background-color,color] duration-200 hover:scale-[1.03] active:scale-95 dark:text-white ${floatingSurfaceClasses}`}
              onClick={() => {
                try {
                  haptics.light();
                } catch (e) {
                  // Silently fail if haptics not available
                }
                handleCloseSettings();
              }}
              aria-label="Close settings"
            >
              <X className="h-[22px] w-[22px] stroke-[1.75]" />
            </button>
          </div>
        </div>

        <div className="p-6 pt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => {
                haptics.light();
                setSearchQuery(e.target.value);
              }}
              onFocus={() => haptics.light()}
              className="h-11 rounded-full border border-gray-200 bg-white pl-10 pr-10 text-gray-900 shadow-none dark:border-[#333333] dark:bg-[#000000] dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  haptics.light();
                  setSearchQuery('');
                }}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-black/[0.04] hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Settings Navigation Items */}
          <div className="space-y-1">
            {filteredSettings.map(item => (
              <button
                key={item.id}
                onClick={() => handleOpenSettingsPage(item.id)}
                className="w-full flex items-center justify-between p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-[#ec1e24]" />
                  <span className="text-gray-900 dark:text-white">{item.label}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>
            ))}
          </div>

          {filteredLegal.length > 0 && (
            <>
              <Separator className="bg-gray-200 dark:bg-[#1F1F1F] my-4" />

              {/* Legal */}
              <div>
                <div className="flex items-center gap-2 px-4 mb-2">
                  <Auction className="w-5 h-5 text-[#ec1e24]" />
                  <h3 className="text-gray-900 dark:text-white">Legal</h3>
                </div>
                <div className="space-y-1">
                  {filteredLegal.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        haptics.light();
                        handleOpenSettingsPage(item.id);
                      }}
                      className="block text-gray-600 dark:text-[#9CA3AF] hover:text-[#ec1e24] text-left w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#1A1A1A] rounded-lg transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {filteredCompany.length > 0 && (
            <>
              <Separator className="bg-[#374151]" />

              {/* Company */}
              <div>
                <div className="flex items-center gap-2 px-4 mb-2">
                  <Mail className="w-5 h-5 text-[#ec1e24]" />
                  <h3 className="text-gray-900 dark:text-white">Company</h3>
                </div>
                <div className="space-y-1">
                  {filteredCompany.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        haptics.light();
                        handleOpenSettingsPage(item.id);
                      }}
                      className="block text-gray-600 dark:text-[#9CA3AF] hover:text-[#ec1e24] text-left w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#1A1A1A] rounded-lg transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* No Results State */}
          {!hasResults && searchQuery && (
            <div className="text-center py-12">
              <h3 className="text-gray-900 dark:text-white mb-2">No results found</h3>
              <p className="text-gray-600 dark:text-[#9CA3AF]">
                Try searching for "api", "video", "theme", or "notifications"
              </p>
              <button
                onClick={() => {
                  haptics.light();
                  setSearchQuery('');
                }}
                className="mt-4 text-[#ec1e24] hover:underline"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Always show Logout button */}
          {!searchQuery && (
            <>
              <Separator className="bg-[#374151]" />

              {/* Logout */}
              <div>
                <Button
                  onClick={() => {
                    haptics.medium();
                    onLogout();
                  }}
                  variant="outline"
                  className="w-full gap-2 text-[#EF4444] border-[#EF4444] hover:bg-[#EF4444] hover:text-white bg-white dark:bg-black"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
