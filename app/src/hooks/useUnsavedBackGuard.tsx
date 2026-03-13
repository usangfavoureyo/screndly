import { useCallback, useRef, useState } from 'react';
import { UnsavedChangesPrompt } from '../components/UnsavedChangesPrompt';

interface UseUnsavedBackGuardOptions {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  isDirty: boolean;
  title?: string;
}

export function useUnsavedBackGuard({
  cancelLabel,
  confirmLabel,
  description,
  isDirty,
  title,
}: UseUnsavedBackGuardOptions) {
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const cancelDiscard = useCallback(() => {
    pendingActionRef.current = null;
    setIsPromptOpen(false);
  }, []);

  const confirmDiscard = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setIsPromptOpen(false);
    action?.();
  }, []);

  const guardAction = useCallback((action: () => void) => {
    if (!isDirty) {
      action();
      return true;
    }

    pendingActionRef.current = action;
    setIsPromptOpen(true);
    return true;
  }, [isDirty]);

  const prompt = (
    <UnsavedChangesPrompt
      open={isPromptOpen}
      onOpenChange={(open) => {
        if (open) {
          setIsPromptOpen(true);
          return;
        }

        cancelDiscard();
      }}
      onCancel={cancelDiscard}
      onConfirm={confirmDiscard}
      title={title}
      description={description}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
    />
  );

  return {
    cancelDiscard,
    confirmDiscard,
    guardAction,
    isPromptOpen,
    prompt,
  };
}
