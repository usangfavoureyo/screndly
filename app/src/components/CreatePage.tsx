import { useState } from 'react';
import { PadWorkspacePage } from './create/PadWorkspacePage';
import { useBackEntry } from '../hooks/useBackEntry';
import { useUnsavedBackGuard } from '../hooks/useUnsavedBackGuard';
import { navigateBackWithFallback } from '../utils/historyNavigation';

interface CreatePageProps {
  onNavigate: (page: string, fromPage?: string) => void;
  previousPage?: string | null;
}

export function CreatePage({ onNavigate, previousPage }: CreatePageProps) {
  const [hasPendingPadInput, setHasPendingPadInput] = useState(false);

  const padGuard = useUnsavedBackGuard({
    isDirty: hasPendingPadInput,
    title: 'Discard post draft?',
    description: 'You have unsent post text or attachments. Leaving this post now will remove them.',
  });

  useBackEntry({
    enabled: hasPendingPadInput,
    priority: 50,
    onBack: () => {
      return padGuard.guardAction(() => {
        navigateBackWithFallback(() => {
          onNavigate(previousPage || 'dashboard');
        });
      });
    },
  });

  return (
    <div className="space-y-6">
      <PadWorkspacePage
        onNavigate={onNavigate}
        previousPage={previousPage}
        embedded
        onPendingChangesChange={setHasPendingPadInput}
      />
      {padGuard.prompt}
    </div>
  );
}
