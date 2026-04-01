import { Suspense, useEffect, useState } from 'react';
import { haptics } from '../utils/haptics';
import { lazyWithRetry } from '../utils/performance';
import { useBackEntry } from '../hooks/useBackEntry';
import { PageLoader } from './PageLoader';
import { SegmentedTabSwitcher } from './SegmentedTabSwitcher';

const ChannelsTabContent = lazyWithRetry(
  () => import('./ChannelsPage').then((m) => ({ default: m.ChannelsTabContent })),
  'ChannelsTabContent',
);
const PlatformsTabContent = lazyWithRetry(
  () => import('./PlatformsPage').then((m) => ({ default: m.PlatformsTabContent })),
  'PlatformsTabContent',
);

type ConnectionsTab = 'channels' | 'platforms';

const CONNECTIONS_TAB_STORAGE_KEY = 'connectionsActiveTab';

const TAB_COPY: Record<ConnectionsTab, string> = {
  channels: 'Monitor YouTube channels for new 16:9 landscape trailers.',
  platforms: 'Connect and manage your social media platforms.',
};

export function ConnectionsPage() {
  const [activeTab, setActiveTab] = useState<ConnectionsTab>(() => {
    const savedTab = localStorage.getItem(CONNECTIONS_TAB_STORAGE_KEY);
    return savedTab === 'platforms' || savedTab === 'channels' ? savedTab : 'channels';
  });
  const [tabHistory, setTabHistory] = useState<ConnectionsTab[]>([]);

  useEffect(() => {
    localStorage.setItem(CONNECTIONS_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  const applyTabChange = (tab: ConnectionsTab, mode: 'push' | 'replace' = 'push') => {
    if (tab !== activeTab) {
      haptics.light();
      if (mode === 'push') {
        setTabHistory((current) => (
          current[current.length - 1] === activeTab ? current : [...current, activeTab]
        ));
      }
      setActiveTab(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleTabChange = (tab: ConnectionsTab) => {
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
      <div>
        <h1 className="text-gray-900 dark:text-white mb-2">Connections</h1>
        <p className="text-[#6B7280] dark:text-[#9CA3AF]">
          {TAB_COPY[activeTab]}
        </p>
      </div>

      <SegmentedTabSwitcher
        tabs={[
          { id: 'channels', label: 'Channels' },
          { id: 'platforms', label: 'Platforms' },
        ]}
        activeTab={activeTab}
        onChange={handleTabChange}
      />

      <Suspense fallback={<PageLoader />}>
        {activeTab === 'channels' && <ChannelsTabContent />}
        {activeTab === 'platforms' && <PlatformsTabContent />}
      </Suspense>
    </div>
  );
}
