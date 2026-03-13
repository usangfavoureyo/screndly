import { useEffect, useState } from 'react';
import { BackIconButton } from './BackIconButton';
import { haptics } from '../utils/haptics';
import { CREATE_TAB_STORAGE_KEY, CREATE_TABS, type CreateTabId } from '../config/create';
import { ComposeOverview } from './create/ComposeOverview';
import { PadWorkspacePage } from './create/PadWorkspacePage';
import { useBackEntry } from '../hooks/useBackEntry';
import { useUnsavedBackGuard } from '../hooks/useUnsavedBackGuard';

interface CreatePageProps {
  onNavigate: (page: string, fromPage?: string) => void;
  previousPage?: string | null;
}

export function CreatePage({ onNavigate, previousPage }: CreatePageProps) {
  const [activeTab, setActiveTab] = useState<CreateTabId>(() => {
    const savedTab = localStorage.getItem(CREATE_TAB_STORAGE_KEY);
    return savedTab === 'compose' || savedTab === 'pad' ? savedTab : 'pad';
  });
  const [tabHistory, setTabHistory] = useState<CreateTabId[]>([]);
  const [hasPendingPadInput, setHasPendingPadInput] = useState(false);

  useEffect(() => {
    localStorage.setItem(CREATE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  const padGuard = useUnsavedBackGuard({
    isDirty: activeTab === 'pad' && hasPendingPadInput,
    title: 'Discard PAD draft?',
    description: 'You have unsent PAD text or attachments. Leaving PAD now will remove them.',
  });

  const applyTabChange = (nextTab: CreateTabId, mode: 'push' | 'replace' = 'push') => {
    if (nextTab === activeTab) {
      return;
    }

    const changeTab = () => {
      if (mode === 'push') {
        setTabHistory((current) => (
          current[current.length - 1] === activeTab ? current : [...current, activeTab]
        ));
      }

      haptics.light();
      setActiveTab(nextTab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (activeTab === 'pad') {
      padGuard.guardAction(changeTab);
      return;
    }

    changeTab();
  };

  useBackEntry({
    enabled: tabHistory.length > 0 || (activeTab === 'pad' && hasPendingPadInput),
    priority: 50,
    onBack: (source) => {
      if (source !== 'system') {
        return false;
      }

      if (tabHistory.length > 0) {
        const previousTab = tabHistory[tabHistory.length - 1];
        const revertTab = () => {
          setTabHistory((current) => current.slice(0, -1));
          setActiveTab(previousTab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        if (activeTab === 'pad') {
          return padGuard.guardAction(revertTab);
        }

        revertTab();
        return true;
      }

      if (activeTab === 'pad' && hasPendingPadInput) {
        return padGuard.guardAction(() => {
          onNavigate(previousPage || 'dashboard');
        });
      }

      return false;
    },
  });

  const handleNavigateBack = () => {
    const navigateBack = () => {
      onNavigate(previousPage || 'dashboard');
    };

    if (activeTab === 'pad') {
      padGuard.guardAction(navigateBack);
      return;
    }

    navigateBack();
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start gap-4 mb-4">
          <BackIconButton onClick={handleNavigateBack} className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1" />
          <div className="flex-1">
            <h1 className="text-gray-900 dark:text-white mb-2">Create Studio</h1>
            <p className="text-[#6B7280] dark:text-[#9CA3AF]">Compose and Post live here as the writing and publishing workflow for Screndly.</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-2">
        <div className="grid grid-cols-2 gap-2">
          {CREATE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => applyTabChange(tab.id)}
              className={`px-4 py-3 rounded-xl transition-all duration-300 flex items-center justify-center ${
                activeTab === tab.id
                  ? 'bg-[#ec1e24] text-white'
                  : 'text-gray-600 dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'pad' ? (
        <PadWorkspacePage
          onNavigate={onNavigate}
          previousPage={previousPage}
          embedded
          onPendingChangesChange={setHasPendingPadInput}
        />
      ) : (
        <ComposeOverview onNavigate={onNavigate} />
      )}
      {padGuard.prompt}
    </div>
  );
}
