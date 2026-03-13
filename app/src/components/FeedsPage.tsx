import { useState, useEffect, Suspense } from 'react';
import { haptics } from '../utils/haptics';
import { lazyWithRetry } from '../utils/performance';
import { useBackEntry } from '../hooks/useBackEntry';

// Lazy load the feed pages
const RSSPage = lazyWithRetry(() => import('./RSSPage').then(m => ({ default: m.RSSPage })), 'RSSPage');
const TMDbFeedsPage = lazyWithRetry(() => import('./TMDbFeedsPage').then(m => ({ default: m.TMDbFeedsPage })), 'TMDbFeedsPage');

interface FeedsPageProps {
  onNavigate: (page: string) => void;
  previousPage?: string | null;
}

type FeedTab = 'rss' | 'tmdb';

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ec1e24]"></div>
    <span className="sr-only">Loading...</span>
  </div>
);

export function FeedsPage({ onNavigate, previousPage }: FeedsPageProps) {
  // Load active tab from localStorage, default to RSS Feeds
  const [activeTab, setActiveTab] = useState<FeedTab>(() => {
    const savedTab = localStorage.getItem('feedsActiveTab');
    return (savedTab === 'rss' || savedTab === 'tmdb') ? savedTab : 'rss';
  });
  const [tabHistory, setTabHistory] = useState<FeedTab[]>([]);

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('feedsActiveTab', activeTab);
  }, [activeTab]);

  const applyTabChange = (tab: FeedTab, mode: 'push' | 'replace' = 'push') => {
    if (tab !== activeTab) {
      haptics.light();
      if (mode === 'push') {
        setTabHistory((current) => (
          current[current.length - 1] === activeTab ? current : [...current, activeTab]
        ));
      }
      setActiveTab(tab);
      // Scroll to top when switching tabs
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleTabChange = (tab: FeedTab) => {
    applyTabChange(tab, 'push');
  };

  useBackEntry({
    enabled: tabHistory.length > 0,
    priority: 50,
    onBack: (source) => {
      if (source !== 'system' || tabHistory.length === 0) {
        return false;
      }

      const previousTab = tabHistory[tabHistory.length - 1];
      setTabHistory((current) => current.slice(0, -1));
      applyTabChange(previousTab, 'replace');
      return true;
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-gray-900 dark:text-white mb-2">Feeds</h1>
        <p className="text-[#6B7280] dark:text-[#9CA3AF]">
          Automated feed ingestion and posting
        </p>
      </div>

      {/* Tab Selector - Matching Video Studio Style */}
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleTabChange('rss')}
            className={`px-4 py-3 rounded-xl transition-all duration-300 flex items-center justify-center ${
              activeTab === 'rss'
                ? 'bg-[#ec1e24] text-white'
                : 'text-gray-600 dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
            }`}
          >
            <span>RSS Feeds</span>
          </button>
          <button
            onClick={() => handleTabChange('tmdb')}
            className={`px-4 py-3 rounded-xl transition-all duration-300 flex items-center justify-center ${
              activeTab === 'tmdb'
                ? 'bg-[#ec1e24] text-white'
                : 'text-gray-600 dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
            }`}
          >
            <span>TMDb Feeds</span>
          </button>
        </div>
      </div>

      {/* Content Area - Conditional Rendering */}
      <Suspense fallback={<PageLoader />}>
        {activeTab === 'rss' && <RSSPage onNavigate={onNavigate} />}
        {activeTab === 'tmdb' && <TMDbFeedsPage onNavigate={onNavigate} previousPage={previousPage} />}
      </Suspense>
    </div>
  );
}
